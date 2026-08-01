// core
import { describe, expect, it } from "vitest";

// others
import { queryDb } from "../helpers/db";

// SECURITY DEFINER anon-grant guardrail.
//
// This is the property-based complement to rpc-execute-grants.test.ts. That
// sibling pins a HAND-WRITTEN list of 8 named functions; this one asks the
// catalog for EVERY `SECURITY DEFINER` function in `public` that anon can
// EXECUTE and fails if any is not on the intentional-public allowlist. So a NEW
// or re-created function that silently defaults to the anon-callable state --
// exactly the list_pending_reservations regression (change
// list-pending-reservations-grant-leak) -- is caught even when nobody thought
// to add it to a named test.
//
// WHY IT MATTERS: a `SECURITY DEFINER` function runs with its owner's privileges
// and BYPASSES RLS, so anon EXECUTE on a non-public one means anyone holding the
// public anon key can call it directly (`POST /rest/v1/rpc/<name>`) with only
// the in-function role gate -- if the author remembered to write one -- between
// them and the data. The grant-layer revoke is the durable control
// (lessons.md -> "Revoke EXECUTE before granting it"); this test keeps it honest.
//
// Mirrors Supabase security advisor lint 0028
// ("anon_security_definer_function_executable"), run here in the suite so it
// blocks a regression BEFORE merge instead of only surfacing in the dashboard
// after it has shipped to production.

// The ONLY public.* SECURITY DEFINER functions anon is intentionally allowed to
// execute -- the public booking funnel. Adding a name here is a DELIBERATE,
// reviewable decision that a new function is meant to be public; every other
// definer function must be revoked from public + anon.
const ANON_EXECUTABLE_ALLOWLIST = new Set<string>([
  "available_vehicles", // public catalog: PII-safe date-range availability
  "get_vehicle_busy_ranges", // public catalog: busy ranges for one vehicle
  "get_reservation_status", // customer self-service: status by token
  "create_reservation_request", // public booking funnel: submit a request
]);

interface FnRow {
  proname: string;
}

describe("SECURITY DEFINER anon-grant guardrail", () => {
  it("no SECURITY DEFINER function is anon-executable outside the allowlist", async () => {
    const rows = await queryDb<FnRow>`
      select p.proname
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public'
        and p.prosecdef
        and has_function_privilege('anon', p.oid, 'EXECUTE')
      order by p.proname
    `;

    const unexpected = rows.map((r) => r.proname).filter((name) => !ANON_EXECUTABLE_ALLOWLIST.has(name));

    // On failure the message NAMES the leaked function(s); the fix is to add
    // `revoke execute on function public.<name>(...) from public, anon;`.
    expect(
      unexpected,
      `SECURITY DEFINER function(s) callable by anon and not on the allowlist: ${unexpected.join(", ")}`,
    ).toEqual([]);
  });

  it("every allowlisted name still exists as a SECURITY DEFINER function (no stale entries)", async () => {
    const rows = await queryDb<FnRow>`
      select p.proname
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public' and p.prosecdef
    `;

    const definerNames = new Set(rows.map((r) => r.proname));
    const stale = [...ANON_EXECUTABLE_ALLOWLIST].filter((name) => !definerNames.has(name));

    // A stale entry (renamed/removed function) would silently widen the
    // allowlist -- flag it so the list tracks reality.
    expect(stale, `Allowlist name(s) no longer a SECURITY DEFINER function: ${stale.join(", ")}`).toEqual([]);
  });
});
