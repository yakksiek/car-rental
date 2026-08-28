// core
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

// others
import type { Database } from "../../db/database.types";
import type { AppRole } from "../../types";
import { deriveStaffStatus, type StaffStatus } from "../staff-status";

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
  status: StaffStatus;
  deactivatedAt: string | null;
  invitedAt: string | null;
  lastSignInAt: string | null;
  createdAt: string;
}

/**
 * What became of the activation email on a repair. `not_needed` means the person
 * already has a working password, so none was attempted. Carried in the result
 * rather than thrown or swallowed, the same two-systems shape
 * `services/email-delivery.ts` uses: the account really was repaired, so the
 * route still answers 200 and the mail outcome rides in the body.
 *
 * Since the two-step add (phase 8) the activation mail IS the GoTrue invite —
 * a never-activated hire reached through the repair arm is invited, not sent a
 * recovery link, so their first contact is the invite journey rather than the
 * password-reset one.
 */
export type ActivationMailOutcome = "sent" | "failed" | "not_needed";

/**
 * Outcome of the second, explicit step: sending the invitation.
 *
 * `has_password` is our OWN gate, not GoTrue's. GoTrue does refuse an invite for
 * an address it considers registered, but that flag keys on `email_confirmed_at`
 * and we cannot see it from the roster — so the callable-or-not decision is an
 * in-app check on `profiles.password_set_at` that a test can hold, and GoTrue's
 * refusal is defence in depth beneath it (lessons.md → "prefer an explicit
 * in-app check you can test over a provider flag you cannot see").
 */
export interface InviteEmployeeResult {
  status: "sent" | "failed" | "has_password" | "not_found" | "unauthorized";
  /** `auth.users.invited_at` after a successful send — lets the roster row move to ZAPROSZONY. */
  invitedAt?: string | null;
}

export type CreateEmployeeResult =
  | { status: "created"; member: StaffMember }
  | { status: "reactivated"; member: StaffMember; activationMail: ActivationMailOutcome }
  | { status: "duplicate_active" }
  // The profiles insert can still fail after the auth user exists, so the
  // failure cannot be a bare throw. Since the two-step add (phase 8) NOTHING has
  // been sent at that point, which makes the compensating delete unconditionally
  // safe — but the two outcomes stay distinct tags because they are a
  // system-health signal: `provision_rolled_back` → the auth user is gone;
  // `provision_orphaned` → the compensating delete ALSO failed and a role-less
  // auth user survives, and re-adding takes the `existing` repair arm.
  // The roster renders one sentence for both (`lib/staff-report.ts`, phase 7).
  | { status: "provision_rolled_back" }
  | { status: "provision_orphaned" }
  | { status: "unauthorized" };

export interface DeactivateResult {
  // `demo` is the RPC's own refusal of the published demo account
  // (20260828140000_demo_account_write_gate.sql). Unreachable through
  // `api/staff/[id]/deactivate.ts`, whose route guard answers first — it exists
  // for the DIRECT caller, since SECURITY DEFINER bypasses the RLS that closes
  // the same hole on plain table writes. Carried here so the tag has a home
  // rather than falling off the union and reading as an unhandled string.
  status: "ok" | "demo" | "self" | "last_admin" | "not_found" | "unauthorized";
}

// GoTrue ban durations: a 100-year ban to revoke sign-in, and "none" to lift it.
const BAN_DURATION = "876000h";
const UNBAN_DURATION = "none";

interface ListStaffRow {
  user_id: string;
  full_name: string | null;
  email: string;
  role: AppRole;
  deactivated_at: string | null;
  invited_at: string | null;
  last_sign_in_at: string | null;
  password_set_at: string | null;
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
    status: deriveStaffStatus(row.password_set_at, row.invited_at),
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
): Promise<{ id: string; lastSignInAt: string | null; invitedAt: string | null } | null> {
  const target = email.trim().toLowerCase();
  // Single-tenant scale (a handful of staff): one large page suffices. If a
  // deployment ever outgrows this, page through `nextPage`.
  const { data, error } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (error) {
    throw error;
  }
  const match = data.users.find((u) => (u.email ?? "").toLowerCase() === target);
  return match
    ? { id: match.id, lastSignInAt: match.last_sign_in_at ?? null, invitedAt: match.invited_at ?? null }
    : null;
}

/**
 * Send the GoTrue invitation for an account that already exists.
 *
 * Probed against local GoTrue v2.188.1 (2026-08-21): `inviteUserByEmail` is
 * accepted for a user created with `email_confirm: false` — it sends the real
 * invite through `supabase/templates/invite.html`, leaves the `profiles` row
 * intact and stamps `invited_at` — and REFUSED with `code: "email_exists"` (422)
 * for an address GoTrue already considers registered, which it decides on
 * `email_confirmed_at` alone. A resend before the link is used invalidates the
 * previous link, so there is never more than one live token per person.
 *
 * That refusal is reported as `failed` and NOT worked around. It can only be
 * reached by an account that is confirmed while still password-less — which the
 * app stopped producing when the exchange moved to submit-time (phase group B),
 * because confirmation now happens together with the password. Only rows created
 * by the OLD callback could be in that state, and this deployment has none worth
 * carrying code for (owner, 2026-08-21). Reaching for `resetPasswordForEmail`
 * here would put a second, quieter door back into the reset journey that phase 8
 * exists to close.
 */
async function sendActivationInvite(
  admin: Client,
  email: string,
  fullName: string,
  redirectTo: string,
): Promise<{ outcome: ActivationMailOutcome; invitedAt: string | null }> {
  const { data, error } = await admin.auth.admin.inviteUserByEmail(email, {
    data: { full_name: fullName },
    redirectTo,
  });
  return error ? { outcome: "failed", invitedAt: null } : { outcome: "sent", invitedAt: data.user.invited_at ?? null };
}

/**
 * Create an employee account, or reactivate a previously soft-removed one.
 *
 * - active account already exists          → `duplicate_active`
 * - deactivated (or profile-less) account  → reactivate: clear deactivated_at,
 *                                             lift the ban, keep the auth user,
 *                                             and invite them if they have no
 *                                             password
 * - no account                             → SILENT create + profiles insert.
 *                                             No mail. `inviteEmployee` below is
 *                                             the second, explicit step.
 *
 * The net-new arm sends nothing (phase 8, "two-step add"), which is what makes
 * the compensating delete below unconditionally safe: a failed create can no
 * longer leave a delivered invite pointing at an account that does not exist.
 * The failure is still reported as `provision_rolled_back` / `provision_orphaned`
 * rather than thrown, because the two are a system-health signal.
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
      .select("deactivated_at, password_set_at")
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
    //   • has a password → ACTIVE again immediately; it still works, so no email
    //     is sent (an "invited" label with no mail was the confusing bug).
    //   • never set one → send a fresh INVITE (not a recovery link — that is the
    //     option-2b journey downgrade this change exists to remove) and let the
    //     invite's own outcome decide the label.
    //
    // Read from the profile row already fetched above, NOT from
    // `existing.lastSignInAt`: GoTrue stamps last_sign_in_at on the invite link
    // exchange, so that proxy reads a hire who merely clicked their link as
    // already having a password — and then sends them nothing. A profile-less
    // orphan (`profile == null`) correctly falls to the password-less arm.
    const passwordSetAt = profile?.password_set_at ?? null;
    let activationMail: ActivationMailOutcome = "not_needed";
    let invitedAt = existing.invitedAt;
    if (passwordSetAt == null) {
      // Destructured, not `.catch()`-ed: supabase-js RESOLVES with `{ error }`
      // rather than rejecting, so the old `.catch(() => undefined)` was dead code
      // and the error was discarded either way. On hosted Supabase the 2-emails/
      // hour cap makes that failure real — a repair after the orphaning invite
      // already burned the quota returned a green roster row with no mail sent.
      const sent = await sendActivationInvite(admin, email, fullName, redirectTo);
      activationMail = sent.outcome;
      invitedAt = sent.invitedAt ?? invitedAt;
    }
    return {
      status: "reactivated",
      member: buildMember(
        existing.id,
        email,
        fullName,
        deriveStaffStatus(passwordSetAt, invitedAt),
        existing.lastSignInAt,
        invitedAt,
      ),
      activationMail,
    };
  }

  // Net-new — STEP 1 OF TWO. Create the account and NOTHING else: no mail leaves
  // the building here, so the roster's DODANY state is honest and a failed
  // create costs nobody a dead link. `email_confirm: false` is load-bearing, not
  // incidental — GoTrue refuses `inviteUserByEmail` for an address it considers
  // registered (probed 2026-08-21, `code: "email_exists"`), so confirming here
  // would make step 2 impossible. The profiles row lands second so the roster +
  // role gate see the employee immediately.
  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email,
    email_confirm: false,
    user_metadata: { full_name: fullName },
  });
  if (createErr) {
    throw createErr;
  }
  const userId = created.user.id;
  const { error: insertErr } = await admin
    .from("profiles")
    .insert({ user_id: userId, role: "employee", full_name: fullName });
  if (insertErr) {
    // Throwing here would leave an auth user with no profile row — role-less
    // forever, invisible to the roster (list_staff INNER-joins profiles), and
    // the admin would see only a bare 500. Compensate: delete the auth user we
    // just created, and report which of the two outcomes happened.
    const rolledBack = await deleteAuthUserQuietly(admin, userId);
    return { status: rolledBack ? "provision_rolled_back" : "provision_orphaned" };
  }
  return { status: "created", member: buildMember(userId, email, fullName) };
}

/**
 * STEP 2 OF TWO — send the invitation for an account that already exists.
 *
 * Offered by the roster for BOTH password-less states: a first send for someone
 * created-but-never-invited, and a resend for someone whose invite mail went
 * missing. The resend closes a real hole — before this, the only remedy for a
 * lost invite was `Resetuj hasło`, which answers with a RECOVERY link and so
 * downgrades a new hire's first contact to the reset journey.
 *
 * Gates in order: a real target (`getStaffEmail`, never a client-sent address,
 * `staff.ts` house rule) → a profile row → our own `password_set_at is null`
 * check → the send.
 */
export async function inviteEmployee(
  admin: Client | null,
  userId: string,
  origin: string,
): Promise<InviteEmployeeResult> {
  if (!admin) {
    return { status: "unauthorized" };
  }
  const email = await getStaffEmail(admin, userId);
  if (!email) {
    return { status: "not_found" };
  }
  const { data: profile, error: profileErr } = await admin
    .from("profiles")
    .select("full_name, password_set_at")
    .eq("user_id", userId)
    .maybeSingle();
  if (profileErr) {
    throw profileErr;
  }
  if (!profile) {
    return { status: "not_found" };
  }
  // The explicit in-app gate. Someone with a working password must not be sent
  // an invitation — the roster hides the action for them, and this is the check
  // that makes hiding it a rule rather than a UI habit.
  if (profile.password_set_at != null) {
    return { status: "has_password" };
  }
  const sent = await sendActivationInvite(admin, email, profile.full_name ?? "", `${origin}/auth/callback`);
  return sent.outcome === "sent" ? { status: "sent", invitedAt: sent.invitedAt } : { status: "failed" };
}

/**
 * Compensating delete for a half-provisioned invite. Never throws and never
 * rejects — a failed rollback is data for `provision_orphaned`, not an error.
 * Returns true only when the auth user is provably gone.
 */
async function deleteAuthUserQuietly(admin: Client, userId: string): Promise<boolean> {
  try {
    const { error } = await admin.auth.admin.deleteUser(userId);
    return !error;
  } catch {
    return false;
  }
}

// The service-role admin client can't read the admin-gated list_staff, so
// synthesize the optimistic member from what we know; the roster reloads with
// authoritative timestamps on the next page load. The defaults describe a fresh
// net-new account under the two-step add: DODANY, never signed in, and — the
// part that used to be hardcoded to `now()` — never invited. Reactivation passes
// the real values.
function buildMember(
  id: string,
  email: string,
  fullName: string,
  status: StaffStatus = "created",
  lastSignInAt: string | null = null,
  invitedAt: string | null = null,
): StaffMember {
  return {
    id,
    email,
    fullName,
    role: "employee",
    status,
    deactivatedAt: null,
    invitedAt,
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
