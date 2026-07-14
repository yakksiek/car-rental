// core
import { describe, expect, it } from "vitest";

// others
import { anonClient } from "../helpers/clients";

// RPC EXECUTE-grant hardening regression guard (rpc-execute-grant-hardening).
//
// Pins the grant layer BENEATH the in-function current_app_role() gates. The four
// staff RPCs are granted only to `authenticated` (anon revoked in migration
// 20260714120000); the four intentionally-public RPCs keep their explicit `anon`
// grant for the booking funnel. This suite proves both sides so a future migration
// can neither silently re-open a staff RPC to anon nor lock anon out of a public one.
//
// WHY THIS EXISTS: `grant execute ... to authenticated` alone is a no-op against
// the default PUBLIC/anon grants (lessons.md -> "Revoke EXECUTE before granting
// it"), and there is no reliable schema-level "start closed" default in Supabase
// (spike-verified 2026-07-14), so the per-function revoke is the only durable
// control -- and it needs a test.
//
// A permission-denied answer proves the revoke bit; it is DISTINCT from a
// "function not found" (PGRST202, wrong args) or a business result. Args below
// match each function's exact signature so the ONLY reason a staff RPC errors is
// the missing grant -- otherwise the test would pass for the wrong reason.

/** True when the error is a Postgres insufficient-privilege denial (42501), not an arg/shape mismatch. */
function isPermissionDenied(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  return error.code === "42501" || /permission denied/i.test(error.message ?? "");
}

// A vehicle id that does not exist -> create_reservation_request returns a business
// "not found" outcome (no row inserted), which proves EXECUTE without side effects.
const MISSING_VEHICLE = "00000000-0000-0000-0000-000000000000";
const SEEDED_VEHICLE = "11111111-1111-1111-1111-111111111111";

describe("RPC EXECUTE-grant hardening (rpc-execute-grant-hardening)", () => {
  // -------------------------------------------------------------------------
  // Staff RPCs: anon must be refused at the GRANT layer (permission denied),
  // beneath the in-function role gate.
  // -------------------------------------------------------------------------
  describe("anon is refused on the four staff RPCs", () => {
    it("decide_reservation -> permission denied", async () => {
      const res = await anonClient().rpc("decide_reservation", {
        p_id: MISSING_VEHICLE,
        p_decision: "confirm",
        p_reason: null,
        p_note: null,
      });
      expect(isPermissionDenied(res.error)).toBe(true);
    });

    it("set_vehicle_active -> permission denied", async () => {
      const res = await anonClient().rpc("set_vehicle_active", { p_id: SEEDED_VEHICLE, p_active: true });
      expect(isPermissionDenied(res.error)).toBe(true);
    });

    it("list_pending_reservations -> permission denied", async () => {
      const res = await anonClient().rpc("list_pending_reservations");
      expect(isPermissionDenied(res.error)).toBe(true);
    });

    it("list_reservations_for_calendar -> permission denied", async () => {
      const res = await anonClient().rpc("list_reservations_for_calendar", {
        p_start: "2026-07-01",
        p_end: "2026-07-31",
      });
      expect(isPermissionDenied(res.error)).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // Public RPCs: anon must STILL be able to execute them (booking funnel).
  // The read-only three should return cleanly; create_reservation_request must
  // not be a permission error (it returns a business outcome for a missing vehicle).
  // -------------------------------------------------------------------------
  describe("anon still executes the four public RPCs", () => {
    it("available_vehicles -> no permission error", async () => {
      const res = await anonClient().rpc("available_vehicles", { p_pickup: "2026-07-01", p_return: "2026-07-05" });
      expect(res.error).toBeNull();
    });

    it("get_vehicle_busy_ranges -> no permission error", async () => {
      const res = await anonClient().rpc("get_vehicle_busy_ranges", { p_vehicle_id: SEEDED_VEHICLE });
      expect(res.error).toBeNull();
    });

    it("get_reservation_status -> no permission error", async () => {
      const res = await anonClient().rpc("get_reservation_status", { p_token: MISSING_VEHICLE });
      expect(res.error).toBeNull();
    });

    it("create_reservation_request -> executes (business result, not permission denied)", async () => {
      // Missing vehicle -> a business "not found" outcome, no row inserted. The
      // point is only that EXECUTE is intact: the call must not be denied.
      const res = await anonClient().rpc("create_reservation_request", {
        p_vehicle_id: MISSING_VEHICLE,
        p_pickup: "2026-08-01",
        p_return: "2026-08-05",
        p_customer_name: "Grant Guard",
        p_customer_email: "grant.guard@example.com",
        p_customer_phone: "+48600000000",
        p_terms_accepted: true,
        p_company: null,
        p_vat_id: null,
        p_notes: null,
      });
      expect(isPermissionDenied(res.error)).toBe(false);
    });
  });
});
