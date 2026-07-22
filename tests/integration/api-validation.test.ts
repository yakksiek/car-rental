// core
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

// others
import { POST as reservationFunnelPOST } from "../../src/pages/api/reservations";
import { PATCH as reservationDecidePATCH } from "../../src/pages/api/reservations/[id]";
import { POST as returnCreatePOST } from "../../src/pages/api/return-protocols";
import { POST as vehicleCreatePOST } from "../../src/pages/api/vehicles";
import { PATCH as vehicleUpdatePATCH } from "../../src/pages/api/vehicles/[id]";
import { POST as vehicleActivePOST } from "../../src/pages/api/vehicles/[id]/active";
import { serviceClient } from "../helpers/clients";
import { anonContext, asContext } from "../helpers/context";

// API validation-parity suite (Risk #5). Proves each WRITE route applies its
// zod schema server-side: a payload the client would block returns a clean 400
// AND writes nothing. This is a regression guard on the schema *wiring* (does
// the route actually run the schema and refuse to write on failure?), NOT a
// re-assertion of the schema's field rules — those are unit-covered
// (reservation-schema.test.ts) or owned by Phase 4 (vehicle-schema.test.ts).
//
// Two cases per write route:
//   • one representative client-bypassing payload → 400 (the rule class differs
//     per route: past dates, reject-without-reason, non-positive rate, a
//     `javascript:` photo URL, a non-boolean toggle), and
//   • a malformed-JSON body → 400 from the handler's pre-schema `request.json()`
//     try/catch (sent via the harness `rawBody` escape hatch).
//
// NO-WRITE IS PROVEN AGAINST THE DB, not the status alone: after every 400 the
// disposable scope is read back through `serviceClient()` and asserted unchanged
// (zero new rows / unchanged row). A sufficient role is used so the request
// reaches validation rather than stopping at the gate (the gate matrix is
// api-authz.test.ts). `serviceClient()` is seed/teardown/readback ONLY.

const svc = serviceClient();

// Disposable ids outside the seeded fleet (distinct from the authz suite's).
const TEST_VEHICLE_ID = "dddddddd-0000-0000-0000-0000000000b1";
const TEST_RESERVATION_ID = "aaaaaaaa-0000-0000-0000-0000000000b1";
const TEST_RESERVATION_TOKEN = "cccccccc-0000-0000-0000-0000000000b1";
const TEST_VEHICLE_NAME = "Validation Harness Vehicle";
const TEST_VEHICLE_RATE = 100;
const CREATE_PROBE_NAME = "VALIDATION Create Probe";

const FUTURE_PICKUP = "2031-06-01";
const FUTURE_RETURN = "2031-06-10";

// Invalid JSON text — `JSON.parse` throws, so the handler's pre-schema catch fires.
const MALFORMED_JSON = "{ this is not valid json";

/** A schema-valid vehicle payload; spread + override one field to make it invalid. */
function validVehicle(name: string) {
  return {
    name,
    category: "cargo_van",
    daily_rate: "150.00",
    monthly_rate: "3000",
    deposit: "1000",
    per_extra_km_rate: "1.5",
  };
}

/** A schema-valid funnel body; spread + override to make it invalid. */
function validFunnelBody() {
  return {
    vehicle_id: TEST_VEHICLE_ID,
    pickup: FUTURE_PICKUP,
    return: FUTURE_RETURN,
    customer_name: "Validation Funnel",
    customer_email: "validation.funnel@example.com",
    customer_phone: "+48600000000",
    terms_accepted: true,
  };
}

async function clearReservations() {
  const { error } = await svc.from("reservations").delete().eq("vehicle_id", TEST_VEHICLE_ID);
  if (error) throw error;
}

async function clearProbeVehicles() {
  const { error } = await svc.from("vehicles").delete().eq("name", CREATE_PROBE_NAME);
  if (error) throw error;
}

/** (Re)assert the harness vehicle: fixed id, active, known name + rate. */
async function upsertHarnessVehicle() {
  const { error } = await svc.from("vehicles").upsert({
    id: TEST_VEHICLE_ID,
    name: TEST_VEHICLE_NAME,
    // `plate` is NOT NULL + unique since S-05; each harness vehicle needs its own.
    plate: "ZZ VALD01",
    category: "cargo_van",
    daily_rate: TEST_VEHICLE_RATE,
    monthly_rate: 2000,
    deposit: 500,
    per_extra_km_rate: 1,
    is_active: true,
  });
  if (error) throw error;
}

async function seedPendingReservation() {
  const { error } = await svc.from("reservations").insert({
    id: TEST_RESERVATION_ID,
    vehicle_id: TEST_VEHICLE_ID,
    customer_name: "Validation Decide",
    customer_email: "validation.decide@example.com",
    customer_phone: "+48600000001",
    pickup_date: FUTURE_PICKUP,
    return_date: FUTURE_RETURN,
    status: "pending",
    reference: "R-VALID-01",
    access_token: TEST_RESERVATION_TOKEN,
  });
  if (error) throw error;
}

// The test client is built without generated DB types, so reads come back `any`;
// these casts type each readback (and double as a spec of the column we assert).
/** Count reservations on the disposable vehicle (the no-write oracle for writes). */
async function reservationCount(): Promise<number> {
  const { data } = await svc.from("reservations").select("id").eq("vehicle_id", TEST_VEHICLE_ID);
  return ((data as unknown[] | null) ?? []).length;
}

beforeAll(async () => {
  await clearReservations();
  await clearProbeVehicles();
  await upsertHarnessVehicle();
});

beforeEach(async () => {
  // Known clean state per case: harness vehicle active with its seeded rate, no
  // reservations, no probe rows. Decide cases seed their own pending row so the
  // funnel no-write count starts from zero.
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

describe("API validation parity (#5)", () => {
  // -------------------------------------------------------------------------
  // POST /api/reservations — the public funnel. Sufficient "role" is anon.
  // -------------------------------------------------------------------------
  describe("POST /api/reservations (funnel)", () => {
    const path = "/api/reservations";

    it("client-bypassing payload (past pickup) → 400, no row written", async () => {
      const body = { ...validFunnelBody(), pickup: "2020-01-01", return: "2020-01-10" };
      const res = await reservationFunnelPOST(anonContext({ method: "POST", path, body }));
      expect(res.status).toBe(400);
      expect(await reservationCount()).toBe(0);
    });

    it("malformed JSON → 400, no row written", async () => {
      const res = await reservationFunnelPOST(anonContext({ method: "POST", path, rawBody: MALFORMED_JSON }));
      expect(res.status).toBe(400);
      expect(await reservationCount()).toBe(0);
    });
  });

  // -------------------------------------------------------------------------
  // PATCH /api/reservations/[id] — employee decision. No-write = stays pending.
  // -------------------------------------------------------------------------
  describe("PATCH /api/reservations/[id] (decision)", () => {
    const path = `/api/reservations/${TEST_RESERVATION_ID}`;
    const params = { id: TEST_RESERVATION_ID };

    /** Read the seeded reservation's current status through service-role. */
    async function reservationStatus(): Promise<string | null> {
      const { data } = await svc.from("reservations").select("status").eq("id", TEST_RESERVATION_ID);
      const first = ((data as unknown[] | null) ?? [])[0] as { status: string } | undefined;
      return first?.status ?? null;
    }

    it("client-bypassing payload (reject without a reason) → 400, no transition", async () => {
      await seedPendingReservation();
      const res = await reservationDecidePATCH(
        await asContext("employee", { method: "PATCH", path, params, body: { decision: "reject" } }),
      );
      expect(res.status).toBe(400);
      expect(await reservationStatus()).toBe("pending");
    });

    it("malformed JSON → 400, no transition", async () => {
      await seedPendingReservation();
      const res = await reservationDecidePATCH(
        await asContext("employee", { method: "PATCH", path, params, rawBody: MALFORMED_JSON }),
      );
      expect(res.status).toBe(400);
      expect(await reservationStatus()).toBe("pending");
    });
  });

  // -------------------------------------------------------------------------
  // POST /api/return-protocols — staff return commit. Sufficient role: employee.
  // The return schema pins storage paths to `return/`; no-write = no return row on
  // the seeded baseline reservation. Uses the seeded issue baseline (R-0002 / Anna
  // Nowak) directly — not the disposable b1 vehicle — since a return needs one.
  // -------------------------------------------------------------------------
  describe("POST /api/return-protocols (return commit)", () => {
    const path = "/api/return-protocols";
    // Seeded baseline (supabase/seed.sql): the demo issue protocol on R-0002.
    const BASELINE_RESERVATION = "aaaaaaaa-0000-0000-0000-000000000002";
    const BASELINE_PROTOCOL_ID = "d6000000-0000-0000-0000-000000000001";
    // Client-minted, a distinct `…b8` tail so cleanup never hits another suite.
    const RETURN_PROTOCOL_ID = "dddddddd-0000-0000-0000-0000000000b8";

    /** A schema-valid return body; spread + override to make it client-bypassing. */
    function validReturnBody() {
      return {
        protocolId: RETURN_PROTOCOL_ID,
        reservationId: BASELINE_RESERVATION,
        baselineProtocolId: BASELINE_PROTOCOL_ID,
        odometerKm: "42850",
        fuelEighths: 4,
        customerAck: true,
        signedAt: new Date("2026-07-17T10:08:00Z").toISOString(),
        signaturePath: `return/${RETURN_PROTOCOL_ID}/signature.png`,
        photos: {
          front: `return/${RETURN_PROTOCOL_ID}/photo-front.jpg`,
          rear: `return/${RETURN_PROTOCOL_ID}/photo-rear.jpg`,
          left: `return/${RETURN_PROTOCOL_ID}/photo-left.jpg`,
          right: `return/${RETURN_PROTOCOL_ID}/photo-right.jpg`,
          interior: `return/${RETURN_PROTOCOL_ID}/photo-interior.jpg`,
          dashboard: `return/${RETURN_PROTOCOL_ID}/photo-dashboard.jpg`,
        },
        damages: [],
      };
    }

    /** Count return rows on the seeded baseline reservation (the no-write oracle). */
    async function returnCount(): Promise<number> {
      const { data } = await svc
        .from("protocols")
        .select("id")
        .eq("reservation_id", BASELINE_RESERVATION)
        .eq("type", "return");
      return ((data as unknown[] | null) ?? []).length;
    }

    // Defensive: a bug that wrote past the 400 would strand a return on the shared
    // seeded baseline and pollute every other suite. Clean the minted id either side.
    beforeEach(async () => {
      await svc.from("protocols").delete().eq("id", RETURN_PROTOCOL_ID);
    });
    afterEach(async () => {
      await svc.from("protocols").delete().eq("id", RETURN_PROTOCOL_ID);
    });

    it("client-bypassing payload (an `issue/`-prefixed path) → 400, no return written", async () => {
      const body = { ...validReturnBody(), signaturePath: `issue/${RETURN_PROTOCOL_ID}/signature.png` };
      const res = await returnCreatePOST(await asContext("employee", { method: "POST", path, body }));
      expect(res.status).toBe(400);
      expect(await returnCount()).toBe(0);
    });

    it("malformed JSON → 400, no return written", async () => {
      const res = await returnCreatePOST(
        await asContext("employee", { method: "POST", path, rawBody: MALFORMED_JSON }),
      );
      expect(res.status).toBe(400);
      expect(await returnCount()).toBe(0);
    });
  });

  // -------------------------------------------------------------------------
  // POST /api/vehicles — staff create. No-write = no row with the probe name.
  // -------------------------------------------------------------------------
  describe("POST /api/vehicles (create)", () => {
    const path = "/api/vehicles";

    /** Count vehicles carrying the create-probe name. */
    async function probeVehicleCount(): Promise<number> {
      const { data } = await svc.from("vehicles").select("id").eq("name", CREATE_PROBE_NAME);
      return ((data as unknown[] | null) ?? []).length;
    }

    it("client-bypassing payload (non-positive daily_rate) → 400, nothing created", async () => {
      const body = { ...validVehicle(CREATE_PROBE_NAME), daily_rate: "0" };
      const res = await vehicleCreatePOST(await asContext("employee", { method: "POST", path, body }));
      expect(res.status).toBe(400);
      expect(await probeVehicleCount()).toBe(0);
    });

    it("malformed JSON → 400, nothing created", async () => {
      const res = await vehicleCreatePOST(
        await asContext("employee", { method: "POST", path, rawBody: MALFORMED_JSON }),
      );
      expect(res.status).toBe(400);
      expect(await probeVehicleCount()).toBe(0);
    });
  });

  // -------------------------------------------------------------------------
  // PATCH /api/vehicles/[id] — staff edit. No-write = harness row unchanged.
  // -------------------------------------------------------------------------
  describe("PATCH /api/vehicles/[id] (edit)", () => {
    const path = `/api/vehicles/${TEST_VEHICLE_ID}`;
    const params = { id: TEST_VEHICLE_ID };

    /** Read the harness vehicle's name + rate to prove it was not mutated. */
    async function harnessVehicle(): Promise<{ name: string; daily_rate: number } | null> {
      const { data } = await svc.from("vehicles").select("name, daily_rate").eq("id", TEST_VEHICLE_ID);
      const first = ((data as unknown[] | null) ?? [])[0] as { name: string; daily_rate: number } | undefined;
      return first ?? null;
    }

    it("client-bypassing payload (javascript: photo URL) → 400, row unchanged", async () => {
      const body = { ...validVehicle("Edited Name"), photos: ["javascript:alert(1)"] };
      const res = await vehicleUpdatePATCH(await asContext("employee", { method: "PATCH", path, params, body }));
      expect(res.status).toBe(400);

      const row = await harnessVehicle();
      expect(row?.name).toBe(TEST_VEHICLE_NAME);
      expect(Number(row?.daily_rate)).toBe(TEST_VEHICLE_RATE);
    });

    it("malformed JSON → 400, row unchanged", async () => {
      const res = await vehicleUpdatePATCH(
        await asContext("employee", { method: "PATCH", path, params, rawBody: MALFORMED_JSON }),
      );
      expect(res.status).toBe(400);

      const row = await harnessVehicle();
      expect(row?.name).toBe(TEST_VEHICLE_NAME);
      expect(Number(row?.daily_rate)).toBe(TEST_VEHICLE_RATE);
    });
  });

  // -------------------------------------------------------------------------
  // POST /api/vehicles/[id]/active — staff toggle. No-write = is_active stays.
  // -------------------------------------------------------------------------
  describe("POST /api/vehicles/[id]/active (toggle)", () => {
    const path = `/api/vehicles/${TEST_VEHICLE_ID}/active`;
    const params = { id: TEST_VEHICLE_ID };

    /** Read the harness vehicle's is_active flag. */
    async function isActive(): Promise<boolean | null> {
      const { data } = await svc.from("vehicles").select("is_active").eq("id", TEST_VEHICLE_ID);
      const first = ((data as unknown[] | null) ?? [])[0] as { is_active: boolean } | undefined;
      return first?.is_active ?? null;
    }

    it("client-bypassing payload (non-boolean active) → 400, flag unchanged", async () => {
      const res = await vehicleActivePOST(
        await asContext("employee", { method: "POST", path, params, body: { active: "yes" } }),
      );
      expect(res.status).toBe(400);
      expect(await isActive()).toBe(true);
    });

    it("malformed JSON → 400, flag unchanged", async () => {
      const res = await vehicleActivePOST(
        await asContext("employee", { method: "POST", path, params, rawBody: MALFORMED_JSON }),
      );
      expect(res.status).toBe(400);
      expect(await isActive()).toBe(true);
    });
  });
});
