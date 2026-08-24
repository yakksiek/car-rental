// core
import { createClient } from "@supabase/supabase-js";

// others
import type { Database } from "../../src/db/database.types";

// Staff fixtures for the E2E auth flows (S-08). Accounts are provisioned through
// the service-role admin client (invite / createUser), never by driving the UI —
// same isolation invariant as fixtures/booking.ts: this client bypasses RLS and
// is for setup/teardown only. Every access assertion runs through the real app.

const SUPABASE_URL = process.env.SUPABASE_URL ?? "";
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
const BASE_URL = process.env.E2E_BASE_URL ?? "http://localhost:4321";

function admin() {
  return createClient<Database>(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function uniqueEmail(tag: string): string {
  return `e2e-${tag}-${Date.now()}-${Math.floor(Math.random() * 1_000_000)}@fleetrent.test`;
}

export interface StaffFixture {
  id: string;
  email: string;
}

/** An ACTIVE employee (has a password + confirmed email) for the reset flow. */
export async function createActiveEmployee(password: string): Promise<StaffFixture> {
  const db = admin();
  const email = uniqueEmail("active");
  const { data, error } = await db.auth.admin.createUser({ email, password, email_confirm: true });
  if (error) {
    throw new Error(`fixture: createUser failed — ${error.message}`);
  }
  // `createUser({ password })` mints the password out-of-band — it never passes
  // through api/auth/{reset,change}-password.ts, the only writers of
  // password_set_at — so stamp it here or this ACTIVE fixture reads as INVITED.
  const { error: pErr } = await db.from("profiles").insert({
    user_id: data.user.id,
    role: "employee",
    full_name: "E2E Aktywny",
    password_set_at: new Date().toISOString(),
  });
  if (pErr) {
    await db.auth.admin.deleteUser(data.user.id).catch(() => undefined);
    throw new Error(`fixture: profile insert failed — ${pErr.message}`);
  }
  return { id: data.user.id, email };
}

/**
 * A DODANY employee — created, never invited, no password (phase 8's first step).
 *
 * Mirrors what `createEmployee` does on the net-new arm, and deliberately sends
 * NOTHING: no `inviteUserByEmail`, so it burns none of the two emails per hour
 * `config.toml` allows and cannot collide with the invite specs. The row it
 * produces is the one that offers `Wyślij zaproszenie`, which is what a spec
 * about the row actions' feedback needs.
 */
export async function createPendingEmployee(): Promise<StaffFixture> {
  const db = admin();
  const email = uniqueEmail("pending");
  const { data, error } = await db.auth.admin.createUser({ email, email_confirm: false });
  if (error) {
    throw new Error(`fixture: createUser failed — ${error.message}`);
  }
  // No `password_set_at`: that is what makes `deriveStaffStatus` read this row
  // as password-less, and `invited_at` being null is what makes it DODANY rather
  // than ZAPROSZONY.
  const { error: pErr } = await db
    .from("profiles")
    .insert({ user_id: data.user.id, role: "employee", full_name: "E2E Dodany" });
  if (pErr) {
    await db.auth.admin.deleteUser(data.user.id).catch(() => undefined);
    throw new Error(`fixture: profile insert failed — ${pErr.message}`);
  }
  return { id: data.user.id, email };
}

/**
 * Soft-remove a staffer: set `profiles.deactivated_at`, which is what middleware
 * reads to resolve their app role to `null` (`middleware.ts:36`).
 *
 * Written straight through the private service-role client rather than the
 * `deactivate_staff` RPC: that RPC carries self- and last-admin guards a fixture
 * has no reason to satisfy, and the property under test is what the APP does with
 * a role-less session, not how the row got that way.
 */
export async function deactivateStaffUser(id: string): Promise<void> {
  const db = admin();
  const { error } = await db.from("profiles").update({ deactivated_at: new Date().toISOString() }).eq("user_id", id);
  if (error) {
    throw new Error(`fixture: deactivate failed — ${error.message}`);
  }
}

/** An INVITED employee (invite email sent, no password yet) for the accept flow. */
export async function inviteEmployee(): Promise<StaffFixture> {
  const db = admin();
  const email = uniqueEmail("invite");
  const { data, error } = await db.auth.admin.inviteUserByEmail(email, {
    data: { full_name: "E2E Zaproszony" },
    redirectTo: `${BASE_URL}/auth/callback?flow=invite`,
  });
  if (error) {
    throw new Error(`fixture: invite failed — ${error.message}`);
  }
  const { error: pErr } = await db
    .from("profiles")
    .insert({ user_id: data.user.id, role: "employee", full_name: "E2E Zaproszony" });
  if (pErr) {
    await db.auth.admin.deleteUser(data.user.id).catch(() => undefined);
    throw new Error(`fixture: profile insert failed — ${pErr.message}`);
  }
  return { id: data.user.id, email };
}

/**
 * The `/auth/callback` link a recovery email WOULD carry, minted directly (S-14).
 *
 * `generateLink` produces the token without sending mail, so a spec that only
 * cares what the callback does with a link doesn't burn one of the two emails
 * `config.toml` allows per hour, and doesn't depend on SMTP timing. The URL is
 * assembled to match `supabase/templates/recovery.html` — `{{ .SiteURL }}
 * /auth/callback?token_hash={{ .TokenHash }}&type=recovery`. That the real
 * template still produces this shape is proven by `staff-auth.spec.ts`, which
 * reads the actual message out of Mailpit.
 */
export async function recoveryCallbackLink(email: string): Promise<string> {
  const db = admin();
  const { data, error } = await db.auth.admin.generateLink({ type: "recovery", email });
  if (error || !data.properties.hashed_token) {
    throw new Error(`fixture: generateLink failed — ${error?.message ?? "no hashed_token"}`);
  }
  return `${BASE_URL}/auth/callback?token_hash=${data.properties.hashed_token}&type=recovery`;
}

/**
 * An invited hire plus the `/auth/callback` link their invite email WOULD carry
 * (S-14). `generateLink({ type: "invite" })` provisions the user the same way
 * `inviteUserByEmail` does but sends no mail, so this costs none of the two
 * emails per hour `config.toml` allows. The profiles row mirrors
 * `services/staff.ts`, which writes one immediately after inviting — that is what
 * gives a new hire a role before they ever accept.
 *
 * IDEMPOTENT since invite-journey-fixes: `/auth/callback` resolves the token but
 * does NOT exchange it, so the link renders the set-password form every time it
 * is opened. It is spent only by a successful POST to /api/auth/reset-password.
 * (It used to be single-use from the first render — that was Bug 2.)
 *
 * The profiles row deliberately carries NO `password_set_at`: this fixture is the
 * password-less invited shape the phase-group-B specs are read from.
 */
export async function inviteCallbackLink(): Promise<StaffFixture & { link: string }> {
  const db = admin();
  const email = uniqueEmail("invite-link");
  const { data, error } = await db.auth.admin.generateLink({ type: "invite", email });
  if (error || !data.properties.hashed_token) {
    throw new Error(`fixture: invite generateLink failed — ${error?.message ?? "no hashed_token"}`);
  }
  const { error: pErr } = await db
    .from("profiles")
    .insert({ user_id: data.user.id, role: "employee", full_name: "E2E Zaproszony Link" });
  if (pErr) {
    await db.auth.admin.deleteUser(data.user.id).catch(() => undefined);
    throw new Error(`fixture: profile insert failed — ${pErr.message}`);
  }
  return {
    id: data.user.id,
    email,
    link: `${BASE_URL}/auth/callback?token_hash=${data.properties.hashed_token}&type=invite&flow=invite`,
  };
}

/** Tear down a fixture staffer. Safe to call twice / on an already-gone user. */
export async function deleteStaffUser(id: string): Promise<void> {
  const db = admin();
  await db.from("profiles").delete().eq("user_id", id);
  await db.auth.admin.deleteUser(id).catch(() => undefined);
}

/** Tear down by email (for the add flow, where the test never sees the id). */
export async function deleteStaffByEmail(email: string): Promise<void> {
  const db = admin();
  const { data } = await db.auth.admin.listUsers({ page: 1, perPage: 1000 });
  const target = email.trim().toLowerCase();
  const user = data.users.find((u) => (u.email ?? "").toLowerCase() === target);
  if (user) {
    await deleteStaffUser(user.id);
  }
}
