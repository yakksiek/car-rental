// core
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

// others
import type { Database } from "../../db/database.types";
import type { AppRole } from "../../types";

// Staff service (S-08). Encapsulates the roster read + the three account
// provisioning mutations, mirroring the tagged-union result convention of
// `vehicles.ts`. Two client shapes flow in:
//   • the per-request COOKIE client (locals.supabase) — carries the admin's JWT,
//     used for the roster read and the guarded `deactivate_staff` RPC (whose
//     current_app_role() gate needs auth.uid()).
//   • the SERVICE-ROLE ADMIN client (createAdminClient()) — bypasses RLS, used
//     for the GoTrue admin provisioning calls (invite / ban / lookup). Its
//     auth.uid() is null, so it must NEVER be the one calling deactivate_staff.
// Both degrade a `null` client to the "cannot act" outcome rather than throwing.

type Client = SupabaseClient<Database>;

// A malformed uuid would make the deactivate RPC throw `invalid input syntax for
// type uuid` (a 500). Guard the shape first so it maps to `not_found` instead.
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// ---------------------------------------------------------------------------
// Shared validation contract (client island + API route reuse the same schema).
// ---------------------------------------------------------------------------

export const employeeInviteSchema = z.object({
  email: z.email("Nieprawidłowy adres e-mail."),
  full_name: z.string().trim().min(1, "Podaj imię i nazwisko."),
});

export type EmployeeInviteInput = z.infer<typeof employeeInviteSchema>;

// ---------------------------------------------------------------------------
// Domain shapes
// ---------------------------------------------------------------------------

export interface StaffMember {
  id: string;
  email: string;
  fullName: string | null;
  role: AppRole;
  status: "active" | "invited";
  deactivatedAt: string | null;
  invitedAt: string | null;
  lastSignInAt: string | null;
  createdAt: string;
}

export type CreateEmployeeResult =
  | { status: "created"; member: StaffMember }
  | { status: "reactivated"; member: StaffMember }
  | { status: "duplicate_active" }
  | { status: "unauthorized" };

export interface DeactivateResult {
  status: "ok" | "self" | "last_admin" | "not_found" | "unauthorized";
}

// GoTrue ban durations: a 100-year ban to revoke sign-in, and "none" to lift it.
const BAN_DURATION = "876000h";
const UNBAN_DURATION = "none";

// Status derivation (plan.md): ACTIVE once the user has ever signed in; INVITED
// while the invite is outstanding (no last_sign_in_at yet).
function deriveStatus(lastSignInAt: string | null): StaffMember["status"] {
  return lastSignInAt ? "active" : "invited";
}

interface ListStaffRow {
  user_id: string;
  full_name: string | null;
  email: string;
  role: AppRole;
  deactivated_at: string | null;
  invited_at: string | null;
  last_sign_in_at: string | null;
  created_at: string;
}

/**
 * The admin roster. Reads through the admin-gated `list_staff` RPC on the
 * caller's (cookie) client — a non-admin session gets zero rows. Derives each
 * row's `status`. A `null` client (Supabase unconfigured) yields `[]`.
 */
export async function listStaff(client: Client | null): Promise<StaffMember[]> {
  if (!client) {
    return [];
  }
  const { data, error } = await client.rpc("list_staff");
  if (error) {
    throw error;
  }
  return ((data as ListStaffRow[] | null) ?? []).map((row) => ({
    id: row.user_id,
    email: row.email,
    fullName: row.full_name,
    role: row.role,
    status: deriveStatus(row.last_sign_in_at),
    deactivatedAt: row.deactivated_at,
    invitedAt: row.invited_at,
    lastSignInAt: row.last_sign_in_at,
    createdAt: row.created_at,
  }));
}

/** Find an existing auth user by (case-insensitive) email, or null. */
async function findAuthUserByEmail(
  admin: Client,
  email: string,
): Promise<{ id: string; lastSignInAt: string | null } | null> {
  const target = email.trim().toLowerCase();
  // Single-tenant scale (a handful of staff): one large page suffices. If a
  // deployment ever outgrows this, page through `nextPage`.
  const { data, error } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (error) {
    throw error;
  }
  const match = data.users.find((u) => (u.email ?? "").toLowerCase() === target);
  return match ? { id: match.id, lastSignInAt: match.last_sign_in_at ?? null } : null;
}

/**
 * Create/invite an employee, or reactivate a previously soft-removed one.
 *
 * - active account already exists          → `duplicate_active`
 * - deactivated (or profile-less) account  → reactivate: clear deactivated_at,
 *                                             lift the ban, keep the auth user
 * - no account                             → GoTrue invite + profiles insert
 *
 * The admin (service-role) client is required; `null` → `unauthorized`.
 */
export async function createEmployee(
  admin: Client | null,
  input: EmployeeInviteInput & { origin: string },
): Promise<CreateEmployeeResult> {
  if (!admin) {
    return { status: "unauthorized" };
  }
  const email = input.email.trim();
  const fullName = input.full_name.trim();
  const redirectTo = `${input.origin}/auth/callback`;

  const existing = await findAuthUserByEmail(admin, email);

  if (existing) {
    const { data: profile, error: profileErr } = await admin
      .from("profiles")
      .select("deactivated_at")
      .eq("user_id", existing.id)
      .maybeSingle();
    if (profileErr) {
      throw profileErr;
    }
    // An active profile is a genuine duplicate — refuse.
    if (profile && profile.deactivated_at == null) {
      return { status: "duplicate_active" };
    }
    // Deactivated, or an auth user with no profile row (e.g. a partial invite):
    // reactivate/repair. Clear the ban and (re)assert an active employee profile.
    const { error: unbanErr } = await admin.auth.admin.updateUserById(existing.id, { ban_duration: UNBAN_DURATION });
    if (unbanErr) {
      throw unbanErr;
    }
    const { error: upsertErr } = await admin
      .from("profiles")
      .upsert({ user_id: existing.id, role: "employee", full_name: fullName, deactivated_at: null });
    if (upsertErr) {
      throw upsertErr;
    }
    // Reflect the person's REAL state, not a hardcoded "invited":
    //   • signed in before → ACTIVE again immediately; their existing password
    //     still works, so no email is sent (an "invited" label with no mail was
    //     the confusing bug).
    //   • never accepted the original invite (no password) → stay INVITED and
    //     send a fresh activation (recovery) email so the label is honest.
    const wasActive = existing.lastSignInAt != null;
    if (!wasActive) {
      await admin.auth.resetPasswordForEmail(email, { redirectTo }).catch(() => undefined);
    }
    return {
      status: "reactivated",
      member: buildMember(existing.id, email, fullName, wasActive ? "active" : "invited", existing.lastSignInAt),
    };
  }

  // Net-new: GoTrue invite (email lands in Inbucket/Mailpit locally), then the
  // profiles row so the roster + role gate see the employee immediately.
  const { data: invited, error: inviteErr } = await admin.auth.admin.inviteUserByEmail(email, {
    data: { full_name: fullName },
    redirectTo,
  });
  if (inviteErr) {
    throw inviteErr;
  }
  const userId = invited.user.id;
  const { error: insertErr } = await admin
    .from("profiles")
    .insert({ user_id: userId, role: "employee", full_name: fullName });
  if (insertErr) {
    throw insertErr;
  }
  return { status: "created", member: buildMember(userId, email, fullName) };
}

// The service-role admin client can't read the admin-gated list_staff, so
// synthesize the optimistic member from what we know; the roster reloads with
// authoritative timestamps on the next page load. `status`/`lastSignInAt` default
// to a fresh INVITED (net-new invite); reactivation passes the real values.
function buildMember(
  id: string,
  email: string,
  fullName: string,
  status: StaffMember["status"] = "invited",
  lastSignInAt: string | null = null,
): StaffMember {
  return {
    id,
    email,
    fullName,
    role: "employee",
    status,
    deactivatedAt: null,
    invitedAt: new Date().toISOString(),
    lastSignInAt,
    createdAt: new Date().toISOString(),
  };
}

/**
 * Soft-remove a staffer. The guards (self / last-admin) live in the
 * `deactivate_staff` RPC — call it on the COOKIE client so its current_app_role()
 * gate sees the admin's JWT. On `ok`, ban the auth user so an existing session
 * can't keep signing in. A malformed id short-circuits to `not_found`.
 */
export async function deactivateStaff(
  admin: Client | null,
  cookieClient: Client | null,
  targetId: string,
): Promise<DeactivateResult> {
  if (!admin || !cookieClient) {
    return { status: "unauthorized" };
  }
  if (!UUID_RE.test(targetId)) {
    return { status: "not_found" };
  }

  const { data, error } = await cookieClient.rpc("deactivate_staff", { target: targetId });
  if (error) {
    throw error;
  }
  const tag = data as DeactivateResult["status"];
  if (tag === "ok") {
    const { error: banErr } = await admin.auth.admin.updateUserById(targetId, { ban_duration: BAN_DURATION });
    if (banErr) {
      throw banErr;
    }
  }
  return { status: tag };
}

/**
 * Send a GoTrue recovery email so the target can set a new password. Works for
 * both invited and active users and needs no service-role key — the recovery
 * link is issued by GoTrue. `null` client → no-op `sent` (unconfigured).
 */
export async function resetStaffPassword(
  client: Client | null,
  email: string,
  origin: string,
): Promise<{ status: "sent" }> {
  if (!client) {
    return { status: "sent" };
  }
  const { error } = await client.auth.resetPasswordForEmail(email, { redirectTo: `${origin}/auth/callback` });
  if (error) {
    throw error;
  }
  return { status: "sent" };
}

/** Look up a staffer's email by id via the admin API (don't trust client-sent email). */
export async function getStaffEmail(admin: Client | null, userId: string): Promise<string | null> {
  if (!admin || !UUID_RE.test(userId)) {
    return null;
  }
  const { data, error } = await admin.auth.admin.getUserById(userId);
  if (error) {
    return null;
  }
  return data.user.email ?? null;
}
