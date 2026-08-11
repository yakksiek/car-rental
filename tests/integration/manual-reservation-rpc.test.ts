// core
import type { SupabaseClient } from "@supabase/supabase-js";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

// others
import type { Database } from "../../src/db/database.types";
import { anonClient, as, serviceClient } from "../helpers/clients";

// create_confirmed_reservation RPC suite (S-12 Phase 1).
//
// The third reservation write path: unlike create_reservation_request (always
// 'pending') and decide_reservation (transitions an EXISTING pending row that
// already holds its slot), this one INSERTS a confirmed row into the
// reservations_no_overlap EXCLUDE set — so the conflict mapping is exercised on
// the insert itself, which is the behaviour this suite exists to pin.
//
// Every assertion runs through a real authenticated client (`as(role)`) or the
// anon client, subject to RLS + the grant layer exactly as production callers
// are. Service-role is used ONLY to seed/tear down the disposable fixture scope
// and to read back the persisted row's `source`/`status` (a fact about what was
// written, not an access assertion).

// Fixed ids outside the seeded `1111…`–`7777…` fleet so resets and reruns are
// reproducible and teardown can scope by `vehicle_id`.
const ACTIVE_VEHICLE_ID = "dddddddd-0000-0000-0000-0000000000e1";
const INACTIVE_VEHICLE_ID = "dddddddd-0000-0000-0000-0000000000e2";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const svc = serviceClient();

const CUSTOMER = {
  name: "Zażółć Gęślą Jaźń",
  email: "manual.rpc@example.com",
  phone: "+48600000123",
} as const;

// The shared test clients are built without the `Database` generic, so `.rpc()`
// hands back `any`. Re-attach the generated row type here — the assertions below
// are about the RPC's RETURN SHAPE, so they must be checked against the real
// type, not an `any` that would make every field access vacuously fine.
type ConfirmedRow = Database["public"]["Functions"]["create_confirmed_reservation"]["Returns"][number];

/** The RPC call under test, as the given client; returns the single result row. */
async function callRpc(client: SupabaseClient, vehicleId: string, pickup: string, returnDate: string) {
  // Not destructured: `data` off an untyped client is `any`, so it is narrowed
  // through the cast below rather than pulled out untyped first.
  const res = await client.rpc("create_confirmed_reservation", {
    p_vehicle_id: vehicleId,
    p_pickup: pickup,
    p_return: returnDate,
    p_customer_name: CUSTOMER.name,
    p_customer_email: CUSTOMER.email,
    p_customer_phone: CUSTOMER.phone,
  });
  return { row: (res.data as ConfirmedRow[] | null)?.at(0) ?? null, error: res.error };
}

async function clearReservations() {
  const { error } = await svc.from("reservations").delete().in("vehicle_id", [ACTIVE_VEHICLE_ID, INACTIVE_VEHICLE_ID]);
  if (error) throw error;
}

beforeAll(async () => {
  // Idempotent setup: wipe leftovers from a crashed prior run, then (re)create
  // the disposable pair — one bookable, one withdrawn.
  await clearReservations();
  await svc.from("vehicles").delete().in("id", [ACTIVE_VEHICLE_ID, INACTIVE_VEHICLE_ID]);

  const { error } = await svc.from("vehicles").insert([
    {
      id: ACTIVE_VEHICLE_ID,
      name: "Manual Harness Vehicle",
      plate: "ZZ MAN01",
      // make/model/production_year are nullable on the table but NOT optional
      // here: they are three of the 11 email columns the RPC returns, so the
      // fixture must populate them for the shape assertion to mean anything.
      make: "Renault",
      model: "Master",
      production_year: 2024,
      category: "cargo_van",
      daily_rate: 100,
      monthly_rate: 2000,
      deposit: 500,
      per_extra_km_rate: 1,
      is_active: true,
    },
    {
      id: INACTIVE_VEHICLE_ID,
      name: "Manual Harness Withdrawn",
      plate: "ZZ MAN02",
      make: "Renault",
      model: "Trafic",
      production_year: 2023,
      category: "cargo_van",
      daily_rate: 100,
      monthly_rate: 2000,
      deposit: 500,
      per_extra_km_rate: 1,
      is_active: false,
    },
  ]);
  if (error) throw error;
});

afterEach(async () => {
  await clearReservations();
});

afterAll(async () => {
  await clearReservations();
  await svc.from("vehicles").delete().in("id", [ACTIVE_VEHICLE_ID, INACTIVE_VEHICLE_ID]);
});

describe("create_confirmed_reservation (S-12)", () => {
  it("staff create yields a confirmed, source='manual' row with a minted reference", async () => {
    const staff = await as("employee");
    const { row, error } = await callRpc(staff, ACTIVE_VEHICLE_ID, "2031-04-01", "2031-04-10");
    expect(error).toBeNull();

    expect(row?.result).toBe("created");
    // R- + base36 of the shared sequence (never zero-padded), so at least 4 chars.
    expect(row?.reference).toMatch(/^R-[0-9A-Z]{4,}$/);
    expect(row?.id).toMatch(UUID_RE);

    // The 11 email columns must ALL be populated — this shape match is what lets
    // the endpoint reuse the confirmed-email path unchanged (DecisionEmailPayload).
    // Asserted as exact fixture values, so a column silently returning null (the
    // failure mode that matters here) cannot pass.
    expect(row).toMatchObject({
      customer_name: CUSTOMER.name,
      customer_email: CUSTOMER.email,
      pickup_date: "2031-04-01",
      return_date: "2031-04-10",
      vehicle_make: "Renault",
      vehicle_model: "Master",
      vehicle_production_year: 2024,
      vehicle_daily_rate: 100,
      vehicle_deposit: 500,
    });
    expect(row?.access_token).toMatch(UUID_RE);

    // What actually landed in the table (read back via service role — a fact
    // about the write, not an access assertion).
    const { data: persisted } = await svc
      .from("reservations")
      .select("status, source, customer_phone")
      .eq("id", row?.id ?? "")
      .single();
    expect(persisted).toMatchObject({
      status: "confirmed",
      source: "manual",
      customer_phone: CUSTOMER.phone,
    });
  });

  it("an overlapping second create returns conflict (atomic EXCLUDE, not a thrown error)", async () => {
    const staff = await as("employee");
    const baseline = await callRpc(staff, ACTIVE_VEHICLE_ID, "2031-05-01", "2031-05-10");
    expect(baseline.row?.result).toBe("created");

    // [05-05 14:00, 05-12 10:00) intersects [05-01 14:00, 05-10 10:00) → 23P01,
    // surfaced as the typed `conflict` tag.
    const overlap = await callRpc(staff, ACTIVE_VEHICLE_ID, "2031-05-05", "2031-05-12");
    expect(overlap.error).toBeNull();
    expect(overlap.row?.result).toBe("conflict");

    // No second row was written.
    const { count } = await svc
      .from("reservations")
      .select("id", { count: "exact", head: true })
      .eq("vehicle_id", ACTIVE_VEHICLE_ID);
    expect(count).toBe(1);
  });

  it("a non-staff caller (no profile role) is unauthorized and writes nothing", async () => {
    const norole = await as("norole");
    const { row, error } = await callRpc(norole, ACTIVE_VEHICLE_ID, "2031-06-01", "2031-06-05");
    expect(error).toBeNull();
    expect(row?.result).toBe("unauthorized");

    const { count } = await svc
      .from("reservations")
      .select("id", { count: "exact", head: true })
      .eq("vehicle_id", ACTIVE_VEHICLE_ID);
    expect(count).toBe(0);
  });

  it("an inactive vehicle is unavailable", async () => {
    const staff = await as("employee");
    const { row, error } = await callRpc(staff, INACTIVE_VEHICLE_ID, "2031-07-01", "2031-07-05");
    expect(error).toBeNull();
    expect(row?.result).toBe("unavailable");
  });

  it("a same-day or inverted range is unavailable, not a raw data_exception", async () => {
    const staff = await as("employee");

    // reserved_period is tsrange(pickup + 14:00, return + 10:00), so ret == pick
    // inverts the range (14:00 > 10:00). Without the Phase 6 guard Postgres
    // raises a data_exception that neither exception arm catches, and the caller
    // gets an error instead of a typed tag.
    const sameDay = await callRpc(staff, ACTIVE_VEHICLE_ID, "2031-09-01", "2031-09-01");
    expect(sameDay.error).toBeNull();
    expect(sameDay.row?.result).toBe("unavailable");

    const inverted = await callRpc(staff, ACTIVE_VEHICLE_ID, "2031-09-10", "2031-09-05");
    expect(inverted.error).toBeNull();
    expect(inverted.row?.result).toBe("unavailable");

    const { count } = await svc
      .from("reservations")
      .select("id", { count: "exact", head: true })
      .eq("vehicle_id", ACTIVE_VEHICLE_ID);
    expect(count).toBe(0);
  });

  it("anon is refused at the grant layer, beneath the in-RPC role gate", async () => {
    const { error } = await callRpc(anonClient(), ACTIVE_VEHICLE_ID, "2031-08-01", "2031-08-05");
    expect(error?.code === "42501" || /permission denied/i.test(error?.message ?? "")).toBe(true);
  });
});
