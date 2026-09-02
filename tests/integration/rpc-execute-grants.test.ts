// core
import { describe, expect, it } from "vitest";

// others
import { anonClient } from "../helpers/clients";

// RPC EXECUTE-grant hardening regression guard (rpc-execute-grant-hardening).
//
// Pins the grant layer BENEATH the in-function current_app_role() gates. The
// staff RPCs are granted only to `authenticated` (anon revoked in migration
// 20260714120000, and re-revoked per recreation); the four intentionally-public
// RPCs keep their explicit `anon` grant for the booking funnel. This suite proves
// both sides so a future migration can neither silently re-open a staff RPC to
// anon nor lock anon out of a public one.
//
// `current_is_demo` (demo-account-gate) joins them: it is called from inside the
// `profiles` write policies, and a policy helper executes as the QUERYING role,
// so it needs its own `authenticated` grant — the exact carve-out in which it is
// easiest to over-grant and never notice.
//
// `list_staff`, `deactivate_staff` and `mark_password_set` were added to the
// refused block by invite-journey-fixes: 20260821100000_password_set_signal
// DROPs and recreates `list_staff` to add an OUT column, and a drop resets the
// ACL to Supabase's default (EXECUTE to PUBLIC + anon). That is exactly the
// regression 20260731212650 had to fix forward on list_pending_reservations —
// which was caught only because that RPC was in this suite and list_staff was not.
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
  describe("anon is refused on the staff RPCs", () => {
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
      // S-12 drops + recreates this function to add `source`, which re-grants
      // PUBLIC/anon by default. This case is the guard that the revoke was
      // re-issued in that migration (20260810120000_manual_reservation.sql).
      const res = await anonClient().rpc("list_reservations_for_calendar", {
        p_start: "2026-07-01",
        p_end: "2026-07-31",
      });
      expect(isPermissionDenied(res.error)).toBe(true);
    });

    it("create_confirmed_reservation -> permission denied", async () => {
      const res = await anonClient().rpc("create_confirmed_reservation", {
        p_vehicle_id: MISSING_VEHICLE,
        p_pickup: "2026-08-01",
        p_return: "2026-08-05",
        p_customer_name: "Grant Guard",
        p_customer_email: "grant.guard@example.com",
        p_customer_phone: "+48600000000",
      });
      expect(isPermissionDenied(res.error)).toBe(true);
    });

    it("list_staff -> permission denied", async () => {
      const res = await anonClient().rpc("list_staff");
      expect(isPermissionDenied(res.error)).toBe(true);
    });

    it("deactivate_staff -> permission denied", async () => {
      const res = await anonClient().rpc("deactivate_staff", { target: MISSING_VEHICLE });
      expect(isPermissionDenied(res.error)).toBe(true);
    });

    it("mark_password_set -> permission denied", async () => {
      const res = await anonClient().rpc("mark_password_set");
      expect(isPermissionDenied(res.error)).toBe(true);
    });

    it("create_protocol -> permission denied", async () => {
      // english-localization drops + recreates this to add `p_locale`, and a DROP
      // resets the ACL to Supabase's default (EXECUTE to PUBLIC + anon). Same
      // regression shape as list_pending_reservations in 20260731212650 — which
      // was caught only because it was in this suite.
      const res = await anonClient().rpc("create_protocol", {
        p_id: MISSING_VEHICLE,
        p_reservation_id: MISSING_VEHICLE,
        p_odometer_km: 1,
        p_fuel_eighths: 4,
        p_signed_at: "2026-08-01T10:00:00Z",
        p_customer_ack: true,
        p_signature: "issue/none/sig.png",
        p_photos: [],
        p_damages: [],
      });
      expect(isPermissionDenied(res.error)).toBe(true);
    });

    it("create_return_protocol -> permission denied", async () => {
      // Dropped + recreated by the same migration, for the same reason.
      const res = await anonClient().rpc("create_return_protocol", {
        p_id: MISSING_VEHICLE,
        p_reservation_id: MISSING_VEHICLE,
        p_baseline_protocol_id: MISSING_VEHICLE,
        p_odometer_km: 1,
        p_fuel_eighths: 4,
        p_signed_at: "2026-08-01T10:00:00Z",
        p_customer_ack: true,
        p_signature: "return/none/sig.png",
        p_photos: [],
        p_damages: [],
      });
      expect(isPermissionDenied(res.error)).toBe(true);
    });

    it("set_profile_locale -> permission denied", async () => {
      // english-localization: the definer seam that makes profiles.locale
      // writable at all. It takes no target parameter and stamps auth.uid()'s own
      // row, so an anon caller has nothing to stamp — but the grant layer must
      // refuse it before that ever matters.
      const res = await anonClient().rpc("set_profile_locale", { p_locale: "pl" });
      expect(isPermissionDenied(res.error)).toBe(true);
    });

    it("current_is_demo -> permission denied", async () => {
      // Added by demo-account-gate. It is an RLS POLICY helper, so like
      // `current_app_role()` it must stay granted to `authenticated` or every
      // profiles write policy errors — but anon has no policy to satisfy and no
      // business reason to read the marker, so the revoke applies as usual.
      const res = await anonClient().rpc("current_is_demo");
      expect(isPermissionDenied(res.error)).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // Public RPCs: anon must STILL be able to execute them (booking funnel).
  // The read-only three should return cleanly; create_reservation_request must
  // not be a permission error (it returns a business outcome for a missing vehicle).
  // -------------------------------------------------------------------------
  describe("anon still executes the public RPCs", () => {
    // invite-journey-fixes: intentionally public (lessons.md carve-out (a)).
    // `/auth/callback` runs with no session, so a revoked grant here would take
    // the whole invite + recovery journey down. Asserted as ADMITTED, not refused.
    it("resolve_link_token -> executes (no permission error)", async () => {
      const res = await anonClient().rpc("resolve_link_token", {
        p_token_hash: "no-such-token-hash-value",
        p_type: "recovery",
      });
      expect(isPermissionDenied(res.error)).toBe(false);
      expect(res.error).toBeNull();
      // A hash nobody holds resolves to nothing — the grant is intact, the lookup
      // still fails closed.
      expect(res.data).toEqual([]);
    });

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

    it("create_reservation_request -> still anon-callable with the locale params", async () => {
      // english-localization DROPs and recreates this function to add p_locale /
      // p_terms_version / p_terms_locale. A drop resets the ACL, and this one is
      // intentionally PUBLIC (lessons.md carve-out (a)) — so the failure mode is
      // the mirror image of the staff RPCs above: not "silently re-opened" but
      // "silently closed", which would take the entire booking funnel down.
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
        p_locale: "en",
        p_terms_version: "v1",
        p_terms_locale: "en",
      });
      expect(isPermissionDenied(res.error)).toBe(false);
    });
  });
});
