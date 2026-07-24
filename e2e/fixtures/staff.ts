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
  const { error: pErr } = await db
    .from("profiles")
    .insert({ user_id: data.user.id, role: "employee", full_name: "E2E Aktywny" });
  if (pErr) {
    await db.auth.admin.deleteUser(data.user.id).catch(() => undefined);
    throw new Error(`fixture: profile insert failed — ${pErr.message}`);
  }
  return { id: data.user.id, email };
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
