// core
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

// components

// others
import { createReservationRequest } from "../../src/lib/services/reservations";
import type { CreateReservationInput } from "../../src/types";
import { anonClient, serviceClient } from "../helpers/clients";

// Overlap-constraint suite (Risk #2). The oracle is the DB: the
// `reservations_no_overlap` GiST EXCLUDE constraint over the generated half-open
// `[pickup 14:00, return 10:00)` window. Every booking is driven through the real
// public path — the `create_reservation_request` definer RPC via the anon client,
// exactly as the website funnel calls it — so we assert the typed `conflict`
// mapping the app sees, never a raw `23P01` exception. The pure interval rule is
// already exhaustively covered by `src/lib/availability.test.ts`; this suite owns
// only the DB + RPC layer.
//
// Disposable data scope: a DEDICATED test vehicle that no seed row touches, on
// far-future dates. Service-role is used ONLY to seed/tear down that scope — every
// booking assertion runs on the anon client, subject to RLS like production.

// Fixed, deterministic id outside the seeded `1111…`–`7777…` fleet so resets and
// reruns are reproducible and teardown can scope by `vehicle_id`.
const TEST_VEHICLE_ID = "dddddddd-0000-0000-0000-0000000000d1";

const svc = serviceClient();

// A complete private-customer booking payload; per-test the dates vary.
function booking(pickup: string, returnDate: string): CreateReservationInput {
  return {
    vehicle_id: TEST_VEHICLE_ID,
    pickup,
    return: returnDate,
    customer_name: "Overlap Test",
    customer_email: "overlap.test@example.com",
    customer_phone: "+48600000000",
    terms_accepted: true,
  };
}

// Remove every reservation on the disposable vehicle (FK is `on delete restrict`,
// so reservations must go before the vehicle itself).
async function clearReservations() {
  const { error } = await svc.from("reservations").delete().eq("vehicle_id", TEST_VEHICLE_ID);
  if (error) throw error;
}

beforeAll(async () => {
  // Idempotent setup: wipe any leftovers from a crashed prior run, then (re)create
  // the dedicated active test vehicle with the minimal NOT-NULL columns.
  await clearReservations();
  await svc.from("vehicles").delete().eq("id", TEST_VEHICLE_ID);

  const { error } = await svc.from("vehicles").insert({
    id: TEST_VEHICLE_ID,
    name: "Overlap Harness Vehicle",
    // `plate` is NOT NULL + unique since S-05; a harness-only value keeps it
    // clear of the seven seeded `WX ...` plates.
    plate: "ZZ TEST01",
    category: "cargo_van",
    daily_rate: 100,
    monthly_rate: 2000,
    deposit: 500,
    per_extra_km_rate: 1,
    is_active: true,
  });
  if (error) throw error;
});

afterEach(async () => {
  // Each case owns a clean slate so the next test's baseline never collides.
  await clearReservations();
});

afterAll(async () => {
  // Tear down the whole disposable scope: rows first, then the vehicle.
  await clearReservations();
  await svc.from("vehicles").delete().eq("id", TEST_VEHICLE_ID);
});

describe("reservations overlap constraint (#2)", () => {
  it("(a) a baseline booking on a free window succeeds", async () => {
    const result = await createReservationRequest(anonClient(), booking("2030-03-01", "2030-03-10"));
    expect(result.status).toBe("created");
  });

  it("(b) an overlapping booking on the same vehicle is rejected as conflict", async () => {
    const baseline = await createReservationRequest(anonClient(), booking("2030-03-01", "2030-03-10"));
    expect(baseline.status).toBe("created");

    // [03-05 14:00, 03-12 10:00) intersects [03-01 14:00, 03-10 10:00) → 23P01,
    // surfaced through the RPC as the typed `conflict` tag (not a thrown error).
    const overlap = await createReservationRequest(anonClient(), booking("2030-03-05", "2030-03-12"));
    expect(overlap.status).toBe("conflict");
  });

  it("(c) a same-day turnover (return 10:00 / pickup 14:00) is allowed", async () => {
    const baseline = await createReservationRequest(anonClient(), booking("2030-03-01", "2030-03-10"));
    expect(baseline.status).toBe("created");

    // Pickup on the SAME day the baseline returns. The half-open `[)` window makes
    // [03-10 14:00, …) adjacent to (…, 03-10 10:00) — no intersection, so allowed.
    const turnover = await createReservationRequest(anonClient(), booking("2030-03-10", "2030-03-15"));
    expect(turnover.status).toBe("created");
  });

  it("(d) a cancelled/rejected row does not block an overlapping booking", async () => {
    // Seed a non-blocking row directly (the RPC only ever writes `pending`). The
    // constraint's partial WHERE excludes cancelled/rejected, so this must NOT
    // reserve the window.
    const { error } = await svc.from("reservations").insert([
      {
        vehicle_id: TEST_VEHICLE_ID,
        customer_name: "Cancelled Row",
        customer_email: "cancelled@example.com",
        customer_phone: "+48600000001",
        pickup_date: "2030-03-01",
        return_date: "2030-03-10",
        status: "cancelled",
        reference: "R-OVL-CANCELLED",
        access_token: "dddddddd-0000-0000-0000-0000000000c1",
      },
      {
        vehicle_id: TEST_VEHICLE_ID,
        customer_name: "Rejected Row",
        customer_email: "rejected@example.com",
        customer_phone: "+48600000002",
        pickup_date: "2030-03-01",
        return_date: "2030-03-10",
        status: "rejected",
        // A rejected row must carry a valid reason (reservations_rejection_reason_consistency).
        rejection_reason: "dates_unavailable",
        reference: "R-OVL-REJECTED",
        access_token: "dddddddd-0000-0000-0000-0000000000c2",
      },
    ]);
    if (error) throw error;

    const result = await createReservationRequest(anonClient(), booking("2030-03-05", "2030-03-12"));
    expect(result.status).toBe("created");
  });
});
