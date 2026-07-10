// core
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

// others
import { POST as reservationFunnelPOST } from "../../src/pages/api/reservations";
import { PATCH as reservationDecidePATCH } from "../../src/pages/api/reservations/[id]";
import { GET as calendarGET } from "../../src/pages/api/reservations/calendar";
import { POST as vehicleCreatePOST } from "../../src/pages/api/vehicles";
import { PATCH as vehicleUpdatePATCH } from "../../src/pages/api/vehicles/[id]";
import { POST as vehicleActivePOST } from "../../src/pages/api/vehicles/[id]/active";
import { serviceClient } from "../helpers/clients";
import { anonContext, asContext } from "../helpers/context";

// API authz matrix (Risk #4). Proves each protected `/api` route enforces its
// OWN guard, because middleware does not gate `/api` at all (`ROUTE_ROLES`
// covers only `/dashboard` pages). For every protected route this suite drives
// the exported handler through a constructed APIContext (see
// tests/helpers/context.ts) and asserts:
//   • the deny contract for an anon caller and for a logged-in `norole` user,
//   • the allow contract for the correct staff role,
//   • that the same-origin CSRF check on each mutation fires BEFORE auth, and
//   • the public funnel's by-design openness (anon allowed) + the honeypot
//     short-circuit (success shape, nothing written).
//
// DENY ISOLATION: every deny assertion runs through `anonContext()` /
// `asContext("norole")` — a real unauthenticated or role-null caller, never the
// service-role client. An RLS/role bypass therefore cannot make a deny test
// pass falsely. `serviceClient()` is used ONLY to seed/tear down disposable rows.
//
// ANON-STATUS SPLIT (documented finding, asserted as-is, NOT normalized):
// vehicle routes return 401 for a signed-out caller (`!locals.user` check);
// reservation routes return 403 (no user check — a null role just fails the
// role gate). See finding-anon-status-inconsistency.md (Phase 5).
//
// Disposable scope: a dedicated vehicle outside the seeded `1111…`–`7777…`
// fleet, on far-future dates, seeded/torn down via service-role like
// reservations-overlap.test.ts. `beforeEach` normalizes its state (active, no
// reservations) so each allow-path case is independent regardless of order.

const svc = serviceClient();

// Fixed ids outside the seeded fleet so resets/reruns are reproducible and
// teardown can scope by id.
const TEST_VEHICLE_ID = "dddddddd-0000-0000-0000-0000000000a1";
const TEST_RESERVATION_ID = "aaaaaaaa-0000-0000-0000-0000000000a1";
const TEST_RESERVATION_TOKEN = "cccccccc-0000-0000-0000-0000000000a1";
// A non-existent but well-formed uuid for deny cases that never reach the DB.
const DUMMY_ID = "dddddddd-0000-0000-0000-0000000000ff";

// The harness vehicle's stable identity (re-asserted by `beforeEach` upsert).
const TEST_VEHICLE_NAME = "Authz Harness Vehicle";
// Unique name so a create allow-path row can be found + torn down without an id.
const CREATE_PROBE_NAME = "AUTHZ Create Probe";
// The PATCH-edit allow-path renames the harness vehicle to this; `beforeEach`'s
// upsert restores its identity, and `afterAll` deletes by id — so it never leaks.
const UPDATE_EDITED_NAME = "Authz Harness Vehicle (edited)";

// Far-future window so seeded/funnel reservations never collide with seed data.
const FUTURE_PICKUP = "2031-05-01";
const FUTURE_RETURN = "2031-05-10";

const FOREIGN_ORIGIN = "https://evil.example.com";

/**
 * A complete, schema-valid vehicle create/edit payload (strings coerce).
 * `plate` is required + unique since S-05, so the create probe and the edit probe
 * must carry different ones — the employee-authorized POST and PATCH both write.
 */
function vehiclePayload(name: string, plate = "ZZ PROBE1") {
  return {
    name,
    plate,
    category: "cargo_van",
    daily_rate: "150.00",
    monthly_rate: "3000",
    deposit: "1000",
    per_extra_km_rate: "1.5",
  };
}

/** A complete, schema-valid public reservation funnel body. */
function funnelBody(extra: Record<string, unknown> = {}) {
  return {
    vehicle_id: TEST_VEHICLE_ID,
    pickup: FUTURE_PICKUP,
    return: FUTURE_RETURN,
    customer_name: "Authz Funnel",
    customer_email: "authz.funnel@example.com",
    customer_phone: "+48600000000",
    terms_accepted: true,
    ...extra,
  };
}

/** Remove every disposable reservation on the test vehicle (FK is restrict). */
async function clearReservations() {
  const { error } = await svc.from("reservations").delete().eq("vehicle_id", TEST_VEHICLE_ID);
  if (error) throw error;
}

/** Remove any create-probe vehicles a prior run may have left behind. */
async function clearProbeVehicles() {
  const { error } = await svc.from("vehicles").delete().eq("name", CREATE_PROBE_NAME);
  if (error) throw error;
}

/** (Re)assert the harness vehicle row: fixed id, active, known name. */
async function upsertHarnessVehicle() {
  const { error } = await svc.from("vehicles").upsert({
    id: TEST_VEHICLE_ID,
    name: TEST_VEHICLE_NAME,
    // `plate` is NOT NULL + unique since S-05; each harness vehicle needs its own.
    plate: "ZZ AUTH01",
    category: "cargo_van",
    daily_rate: 100,
    monthly_rate: 2000,
    deposit: 500,
    per_extra_km_rate: 1,
    is_active: true,
  });
  if (error) throw error;
}

/** Seed a fresh PENDING reservation on the test vehicle for a decide allow-path. */
async function seedPendingReservation() {
  const { error } = await svc.from("reservations").insert({
    id: TEST_RESERVATION_ID,
    vehicle_id: TEST_VEHICLE_ID,
    customer_name: "Authz Decide",
    customer_email: "authz.decide@example.com",
    customer_phone: "+48600000001",
    pickup_date: FUTURE_PICKUP,
    return_date: FUTURE_RETURN,
    status: "pending",
    reference: "R-AUTHZ-01",
    access_token: TEST_RESERVATION_TOKEN,
  });
  if (error) throw error;
}

beforeAll(async () => {
  // Idempotent setup: wipe leftovers from any crashed prior run.
  await clearReservations();
  await clearProbeVehicles();
  await upsertHarnessVehicle();
});

beforeEach(async () => {
  // Each allow-path case starts from a known clean state: the harness vehicle
  // present, active, with no reservations and no leftover probe rows. This
  // decouples tests from order — the active-toggle case retires the vehicle and
  // the edit case renames it, so the row is re-asserted before every test.
  await clearReservations();
  await clearProbeVehicles();
  await upsertHarnessVehicle();
});

afterEach(async () => {
  await clearReservations();
  await clearProbeVehicles();
});

afterAll(async () => {
  await clearReservations();
  await clearProbeVehicles();
  await svc.from("vehicles").delete().eq("id", TEST_VEHICLE_ID);
});

describe("API authz matrix (#4)", () => {
  // -------------------------------------------------------------------------
  // GET /api/reservations/calendar — employee read, no Origin (CSRF) check.
  // -------------------------------------------------------------------------
  describe("GET /api/reservations/calendar (employee read)", () => {
    const CAL_QUERY = "?start=2099-07-01&end=2099-07-31";
    const path = `/api/reservations/calendar${CAL_QUERY}`;

    it("anon → 403", async () => {
      const res = await calendarGET(anonContext({ method: "GET", path }));
      expect(res.status).toBe(403);
    });

    it("norole → 403", async () => {
      const res = await calendarGET(await asContext("norole", { method: "GET", path }));
      expect(res.status).toBe(403);
    });

    it("employee → 200", async () => {
      const res = await calendarGET(await asContext("employee", { method: "GET", path }));
      expect(res.status).toBe(200);
    });

    it("admin → 200", async () => {
      const res = await calendarGET(await asContext("admin", { method: "GET", path }));
      expect(res.status).toBe(200);
    });
  });

  // -------------------------------------------------------------------------
  // PATCH /api/reservations/[id] — employee decision. Anon/norole → 403.
  // -------------------------------------------------------------------------
  describe("PATCH /api/reservations/[id] (employee decision)", () => {
    const path = `/api/reservations/${DUMMY_ID}`;
    const params = { id: DUMMY_ID };
    const body = { decision: "confirm" };

    it("anon → 403 (no user check; null role fails the gate)", async () => {
      const res = await reservationDecidePATCH(anonContext({ method: "PATCH", path, params, body }));
      expect(res.status).toBe(403);
    });

    it("norole → 403", async () => {
      const res = await reservationDecidePATCH(await asContext("norole", { method: "PATCH", path, params, body }));
      expect(res.status).toBe(403);
    });

    it("CSRF: foreign Origin → 403 (before auth, runnable as anon)", async () => {
      const res = await reservationDecidePATCH(
        anonContext({ method: "PATCH", path, params, body, origin: FOREIGN_ORIGIN }),
      );
      expect(res.status).toBe(403);
    });

    it("employee → 200 on a disposable pending reservation (decision commits)", async () => {
      await seedPendingReservation();
      const res = await reservationDecidePATCH(
        await asContext("employee", {
          method: "PATCH",
          path: `/api/reservations/${TEST_RESERVATION_ID}`,
          params: { id: TEST_RESERVATION_ID },
          body: { decision: "confirm" },
        }),
      );
      expect(res.status).toBe(200);
    });
  });

  // -------------------------------------------------------------------------
  // POST /api/vehicles — staff create. Anon → 401 (vehicle-route contract).
  // -------------------------------------------------------------------------
  describe("POST /api/vehicles (staff create)", () => {
    const path = "/api/vehicles";

    it("anon → 401 (vehicle route checks !locals.user first)", async () => {
      const res = await vehicleCreatePOST(
        anonContext({ method: "POST", path, body: vehiclePayload(CREATE_PROBE_NAME) }),
      );
      expect(res.status).toBe(401);
    });

    it("norole → 403", async () => {
      const res = await vehicleCreatePOST(
        await asContext("norole", { method: "POST", path, body: vehiclePayload(CREATE_PROBE_NAME) }),
      );
      expect(res.status).toBe(403);
    });

    it("CSRF: foreign Origin → 403 (before auth, runnable as anon)", async () => {
      const res = await vehicleCreatePOST(
        anonContext({ method: "POST", path, body: vehiclePayload(CREATE_PROBE_NAME), origin: FOREIGN_ORIGIN }),
      );
      expect(res.status).toBe(403);
    });

    it("employee → 201 (disposable vehicle, torn down)", async () => {
      const res = await vehicleCreatePOST(
        await asContext("employee", { method: "POST", path, body: vehiclePayload(CREATE_PROBE_NAME) }),
      );
      expect(res.status).toBe(201);
    });
  });

  // -------------------------------------------------------------------------
  // PATCH /api/vehicles/[id] — staff edit. Anon → 401.
  // -------------------------------------------------------------------------
  describe("PATCH /api/vehicles/[id] (staff edit)", () => {
    const path = `/api/vehicles/${TEST_VEHICLE_ID}`;
    const params = { id: TEST_VEHICLE_ID };

    it("anon → 401", async () => {
      const res = await vehicleUpdatePATCH(
        anonContext({ method: "PATCH", path, params, body: vehiclePayload(UPDATE_EDITED_NAME) }),
      );
      expect(res.status).toBe(401);
    });

    it("norole → 403", async () => {
      const res = await vehicleUpdatePATCH(
        await asContext("norole", { method: "PATCH", path, params, body: vehiclePayload(UPDATE_EDITED_NAME) }),
      );
      expect(res.status).toBe(403);
    });

    it("CSRF: foreign Origin → 403 (before auth, runnable as anon)", async () => {
      const res = await vehicleUpdatePATCH(
        anonContext({
          method: "PATCH",
          path,
          params,
          body: vehiclePayload(UPDATE_EDITED_NAME),
          origin: FOREIGN_ORIGIN,
        }),
      );
      expect(res.status).toBe(403);
    });

    it("employee → 200 on the disposable vehicle", async () => {
      const res = await vehicleUpdatePATCH(
        await asContext("employee", {
          method: "PATCH",
          path,
          params,
          // A plate distinct from the create probe's, which the sibling POST test writes.
          body: vehiclePayload(UPDATE_EDITED_NAME, "ZZ EDIT01"),
        }),
      );
      expect(res.status).toBe(200);
    });
  });

  // -------------------------------------------------------------------------
  // POST /api/vehicles/[id]/active — staff retire/restore. Anon → 401.
  // -------------------------------------------------------------------------
  describe("POST /api/vehicles/[id]/active (staff retire/restore)", () => {
    const path = `/api/vehicles/${TEST_VEHICLE_ID}/active`;
    const params = { id: TEST_VEHICLE_ID };
    const body = { active: false };

    it("anon → 401", async () => {
      const res = await vehicleActivePOST(anonContext({ method: "POST", path, params, body }));
      expect(res.status).toBe(401);
    });

    it("norole → 403", async () => {
      const res = await vehicleActivePOST(await asContext("norole", { method: "POST", path, params, body }));
      expect(res.status).toBe(403);
    });

    it("CSRF: foreign Origin → 403 (before auth, runnable as anon)", async () => {
      const res = await vehicleActivePOST(anonContext({ method: "POST", path, params, body, origin: FOREIGN_ORIGIN }));
      expect(res.status).toBe(403);
    });

    it("employee → 200 retiring the disposable vehicle (no reservations on it)", async () => {
      const res = await vehicleActivePOST(await asContext("employee", { method: "POST", path, params, body }));
      expect(res.status).toBe(200);
    });
  });

  // -------------------------------------------------------------------------
  // POST /api/reservations — the public funnel. Anon allowed BY DESIGN
  // (CSRF + honeypot only); the honeypot short-circuits with no DB write.
  // -------------------------------------------------------------------------
  describe("POST /api/reservations (public funnel — anon allowed by design)", () => {
    const path = "/api/reservations";

    it("anon with a valid same-origin body → 201 (by design)", async () => {
      const res = await reservationFunnelPOST(anonContext({ method: "POST", path, body: funnelBody() }));
      expect(res.status).toBe(201);

      // It really wrote a row (the by-design contract), distinguishing this from
      // the honeypot short-circuit below.
      const { data } = await svc.from("reservations").select("id").eq("vehicle_id", TEST_VEHICLE_ID);
      expect((data ?? []).length).toBe(1);
    });

    it("CSRF: foreign Origin → 403", async () => {
      const res = await reservationFunnelPOST(
        anonContext({ method: "POST", path, body: funnelBody(), origin: FOREIGN_ORIGIN }),
      );
      expect(res.status).toBe(403);
    });

    it("honeypot (non-empty company_url) → 201 success-shape with NO row written", async () => {
      const res = await reservationFunnelPOST(
        anonContext({ method: "POST", path, body: funnelBody({ company_url: "http://bot.example" }) }),
      );
      expect(res.status).toBe(201);

      // The benign success shape carries a fake reference/token; verify via
      // service-role that the database was never touched.
      const { data } = await svc.from("reservations").select("id").eq("vehicle_id", TEST_VEHICLE_ID);
      expect(data ?? []).toHaveLength(0);
    });
  });
});
