// core
import { createClient } from "@supabase/supabase-js";

// Test client factories for the integration harness, built directly on
// `@supabase/supabase-js` — `src/lib/supabase.ts` can't be reused because it is
// SSR/cookie-bound and imports `astro:env/server`, which doesn't resolve under
// plain Vitest.
//
// SERVICE-ROLE ISOLATION INVARIANT: `serviceClient()` bypasses RLS. It exists
// ONLY for setup/teardown (seeding/deleting rows). NEVER run an access
// assertion through it — doing so would make a PII-leak test pass falsely.
// Every access assertion runs through `anonClient()` or `as(role)`, which carry
// the anon key + a real per-user JWT and are subject to RLS exactly as
// production callers are.

// setup.ts has already asserted these are present before any test file imports
// this module; the `?? ""` only satisfies the type checker.
const SUPABASE_URL = process.env.SUPABASE_URL ?? "";
const ANON_KEY = process.env.SUPABASE_ANON_KEY ?? "";
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

export type SeededRole = "admin" | "employee" | "norole";

// Seeded credentials (see supabase/seed.sql). `norole` is an authenticated user
// with NO `profiles` row, so `current_app_role()` resolves to null (fail-closed)
// — the sharpest probe for the F1 grant hole.
export const SEEDED_CREDENTIALS: Record<SeededRole, { email: string; password: string }> = {
  admin: { email: "admin@fleetrent.test", password: "Fl33tRent-Admin_2026!" },
  employee: { email: "employee@fleetrent.test", password: "Fl33tRent-Employee_2026!" },
  norole: { email: "norole@fleetrent.test", password: "Fl33tRent-NoRole_2026!" },
};

const sessionlessOptions = {
  auth: { autoRefreshToken: false, persistSession: false },
} as const;

/** Anon-key client with no session — the unauthenticated (`anon` role) caller. */
export function anonClient() {
  return createClient(SUPABASE_URL, ANON_KEY, sessionlessOptions);
}

/**
 * Anon-key client signed in as a seeded role via `signInWithPassword`, so it
 * carries a real `authenticated` JWT (and a `profiles` role lookup for
 * admin/employee; null for norole). Throws if sign-in fails.
 */
export async function as(role: SeededRole) {
  const client = createClient(SUPABASE_URL, ANON_KEY, sessionlessOptions);
  const { email, password } = SEEDED_CREDENTIALS[role];
  const { error } = await client.auth.signInWithPassword({ email, password });
  if (error) {
    throw new Error(`Failed to sign in seeded role "${role}" (${email}): ${error.message}`);
  }
  return client;
}

/**
 * Service-role client — bypasses RLS. SETUP/TEARDOWN ONLY. Never use for an
 * access assertion (see the isolation invariant at the top of this file).
 */
export function serviceClient() {
  return createClient(SUPABASE_URL, SERVICE_ROLE_KEY, sessionlessOptions);
}
