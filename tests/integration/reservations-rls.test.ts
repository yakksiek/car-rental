// core
import { describe, expect, it } from "vitest";

// others
import { anonClient, as } from "../helpers/clients";

// RLS access-matrix suite (Risk #1). Proves each role reads exactly the
// reservation PII its policies + RPC gates allow, and guards the closed
// direct-table PII leak (finding F1) against regression.
//
// Two surfaces are asserted, because they disagree about who can read PII:
//   1. the SECURITY DEFINER RPCs — the real app paths (token status, staff
//      queue, staff calendar), which run as the table owner; and
//   2. the raw table SELECT — the leak surface, which the Phase 3 migration
//      closes by revoking the `anon`/`authenticated` SELECT grant + dropping
//      the misleading `using(true)` policy.
//
// SERVICE-ROLE ISOLATION: every assertion runs on `anonClient()` / `as(role)`
// (anon key + real JWT, subject to RLS). `serviceClient()` is NOT used here —
// all rows asserted against are seeded fixtures (supabase/seed.sql), so no
// setup/teardown is needed and there is no way for an RLS bypass to mask a gap.

// The test client is built without generated DB types, so `.rpc()` results are
// `any`; these row shapes type the RPC payloads we assert against (also a
// readable spec of each RPC's PII surface). Optional fields are deliberately
// absent from the RPC's return shape — asserting them `undefined` proves the
// narrower surface (e.g. the calendar RPC returns name only).
interface StatusRow {
  customer_name: string;
  customer_email: string;
  customer_phone?: string;
}
interface PendingRow {
  customer_name: string;
  customer_email: string;
  customer_phone: string;
}
interface CalendarRow {
  customer_name: string;
  customer_email?: string;
  customer_phone?: string;
}

// A seeded PENDING reservation's token — the canonical `/r/<token>` status page
// (see supabase/seed.sql). Its holder is Piotr Wiśniewski.
const SEEDED_TOKEN = "cccccccc-0000-0000-0000-000000000003";
const SEEDED_TOKEN_NAME = "Piotr Wiśniewski";
const SEEDED_TOKEN_EMAIL = "piotr.wisniewski@example.com";

// An access token that matches no seeded row.
const UNKNOWN_TOKEN = "00000000-0000-0000-0000-0000000000ff";

// A window covering every seeded reservation (all in 2026-07).
const CAL_START = "2026-07-01";
const CAL_END = "2026-07-31";

describe("reservations RLS access matrix (#1)", () => {
  // (a) anon, no token: no token-less anon PII path — neither the status RPC
  // with an unknown token nor a direct table read returns anything.
  describe("(a) anon with no valid token reads no PII", () => {
    it("get_reservation_status with an unknown token returns 0 rows", async () => {
      const anon = anonClient();
      const res = await anon.rpc("get_reservation_status", { p_token: UNKNOWN_TOKEN });

      expect(res.error).toBeNull();
      expect((res.data as StatusRow[] | null) ?? []).toHaveLength(0);
    });

    it("a direct table read as anon returns 0 PII rows (no anon SELECT policy)", async () => {
      const anon = anonClient();
      const { data } = await anon.from("reservations").select("customer_email");

      // anon has no SELECT policy → deny-by-default, regardless of the grant.
      expect(data ?? []).toHaveLength(0);
    });
  });

  // (b) any caller (incl. anon) holding a valid token reads exactly that one
  // customer's name + email — the `/r/<token>` path. Phone is never exposed.
  it("(b) a valid token returns exactly one customer's name + email (no phone)", async () => {
    const anon = anonClient();
    const res = await anon.rpc("get_reservation_status", { p_token: SEEDED_TOKEN });

    expect(res.error).toBeNull();
    const rows = (res.data as StatusRow[] | null) ?? [];
    expect(rows).toHaveLength(1);
    expect(rows[0].customer_name).toBe(SEEDED_TOKEN_NAME);
    expect(rows[0].customer_email).toBe(SEEDED_TOKEN_EMAIL);
    // The token RPC deliberately omits phone from its return shape.
    expect(rows[0].customer_phone).toBeUndefined();
  });

  // (c) staff (employee == admin for reservation PII) read full PII via the
  // pending queue and name-only rows via the calendar.
  describe.each(["employee", "admin"] as const)("(c) staff role %s", (role) => {
    it("list_pending_reservations returns full-PII rows (incl. phone)", async () => {
      const client = await as(role);
      const res = await client.rpc("list_pending_reservations");

      expect(res.error).toBeNull();
      const rows = (res.data as PendingRow[] | null) ?? [];
      // Seed carries two PENDING reservations (R-0003, R-0004).
      expect(rows.length).toBeGreaterThanOrEqual(2);
      expect(rows[0].customer_name).toBeTruthy();
      expect(rows[0].customer_email).toBeTruthy();
      expect(rows[0].customer_phone).toBeTruthy();
    });

    it("list_reservations_for_calendar returns name-only rows (no email/phone)", async () => {
      const client = await as(role);
      const res = await client.rpc("list_reservations_for_calendar", {
        p_start: CAL_START,
        p_end: CAL_END,
      });

      expect(res.error).toBeNull();
      const rows = (res.data as CalendarRow[] | null) ?? [];
      expect(rows.length).toBeGreaterThanOrEqual(2);
      expect(rows[0].customer_name).toBeTruthy();
      // The calendar RPC returns name only — email/phone are not in its shape.
      expect(rows[0].customer_email).toBeUndefined();
      expect(rows[0].customer_phone).toBeUndefined();
    });
  });

  // (d) a logged-in non-staff caller (role = null, fail-closed) gets 0 rows
  // from every staff RPC — the gate lives in the query, not just the endpoint.
  describe("(d) norole (role-null) is fail-closed on staff RPCs", () => {
    it("list_pending_reservations returns 0 rows", async () => {
      const client = await as("norole");
      const res = await client.rpc("list_pending_reservations");

      expect(res.error).toBeNull();
      expect((res.data as PendingRow[] | null) ?? []).toHaveLength(0);
    });

    it("list_reservations_for_calendar returns 0 rows", async () => {
      const client = await as("norole");
      const res = await client.rpc("list_reservations_for_calendar", {
        p_start: CAL_START,
        p_end: CAL_END,
      });

      expect(res.error).toBeNull();
      expect((res.data as CalendarRow[] | null) ?? []).toHaveLength(0);
    });
  });

  // (e) THE REGRESSION GUARD. As an authenticated role-null user, a direct
  // `from("reservations").select("*")` must yield ZERO PII rows. This is the
  // sharpest probe for finding F1: before the Phase 3 migration the schema-wide
  // SELECT grant + `using(true)` policy let this client read every customer's
  // name/email/phone; the migration revokes the grant + drops the policy, so the
  // read now returns permission-denied (no rows).
  //
  // NOTE: the plan also names `has_table_privilege('authenticated', ...)` as a
  // secondary check. That catalog function is not exposed through PostgREST
  // (only `public`-schema functions are), so it is unreachable from this
  // supabase-js-only harness. The behavioral assertion below is the stronger
  // guard — it proves the actual read is blocked, not merely that a grant is
  // absent — and is verified out-of-band via psql during phase verification.
  it("(e) authenticated role-null cannot read reservation PII off the table", async () => {
    const client = await as("norole");
    const { data } = await client.from("reservations").select("customer_name, customer_email, customer_phone");

    // Permission-denied surfaces as a null data payload; either way, no PII rows.
    expect(data ?? []).toHaveLength(0);
  });
});
