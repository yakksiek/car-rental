// core
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

// others
import { anonClient, as, serviceClient } from "../helpers/clients";

// Return-protocol data-layer suite (S-06 Phase 7). The return analogue of
// protocols-rls.test.ts + dispatch-list.test.ts, pinning the invariants the
// return slice is load-bearing on:
//
//   1. PRECONDITION — `create_return_protocol` refuses a reservation with no
//      issue baseline (`no_baseline`), and refuses a baseline id that is not the
//      reservation's own issue protocol (`no_baseline`). A return may NEVER stand
//      without an issue baseline — the differentiating comparison needs one.
//   2. IDEMPOTENCY — a second return on one reservation returns a clean `conflict`
//      tag carrying the EXISTING return id; the composite `unique (reservation_id,
//      type)` is the backstop, so two employees tapping produce one return.
//   3. STATUS UNTOUCHED — completing a return does NOT change `reservation_status`.
//      "Returned" is the existence of a `type='return'` row, mirroring "issued";
//      the enum and the reservations_no_overlap EXCLUDE constraint stay put.
//   4. GRANTS — a role-null / anon caller reads ZERO rows from every protocol
//      table even when RETURN rows exist. Return rows are not special-cased into
//      visibility: the `revoke all` + RLS-on + zero-policies posture covers them.
//   5. RPC AUTHZ — anon cannot execute any of the three new RPCs; a null role gets
//      empty / `unauthorized` (the in-RPC `current_app_role()` gate, not merely an
//      unreadable table).
//   6. WORKLIST FOLD — `list_returns_today()` KEEPS overdue-open rows and today's
//      just-filed returns (email recovery) and DROPS older-filed returns; an open
//      row folds in a null `return_protocol_id`.
//   7. STORAGE-PREFIX PARITY — a `return/`-prefixed object is writable + readable
//      by a staff client and invisible to anon / a null role. This is the single
//      test that pins the SQL `storage.objects` RLS predicate
//      (`(storage.foldername(name))[1] in ('issue','return')`) to the TypeScript
//      `protocol-storage-paths` module — the prefix's one boundary that cannot be
//      shared by import (SQL can't read TypeScript).
//
// SERVICE-ROLE ISOLATION: every access assertion runs on `anonClient()` /
// `as(role)` (anon key + a real JWT, subject to RLS). `serviceClient()` appears
// only in setup/teardown/readback, never in an assertion — routing an access
// assertion through it would make a leak test pass falsely.

const svc = serviceClient();

// The test client is built without generated DB types, so `.rpc()` / `.from()`
// results are `any`; these shapes type the payloads we assert against.
interface CreateRow {
  result: string;
  protocol_id: string | null;
}
interface ReturnRow {
  reservation_id: string;
  return_protocol_id: string | null;
  baseline_protocol_id: string | null;
  baseline_odometer_km: number | null;
  baseline_fuel_eighths: number | null;
}

/** Cast an untyped supabase-js result to a row list, treating a denial as zero rows. */
function rows<T>(data: unknown): T[] {
  return (data as T[] | null) ?? [];
}

const pad = (n: number) => String(n).padStart(2, "0");
/** Local calendar date, matching the DB's `current_date` (same machine clock). */
function isoDate(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

// -------------------------------------------------------------------------
// Seeded baseline (supabase/seed.sql): the demo issue protocol on R-0002 (Anna
// Nowak, confirmed, past return), in the `d6…` id namespace disjoint from every
// test's `dddddddd…` fixtures, so this suite's cleanup never deletes it.
// -------------------------------------------------------------------------
const BASELINE_RESERVATION = "aaaaaaaa-0000-0000-0000-000000000002";
const BASELINE_PROTOCOL_ID = "d6000000-0000-0000-0000-000000000001";
const BASELINE_DAMAGE_ID = "dd000000-0000-0000-0000-0000000000d1";
// A confirmed reservation with NO issue protocol (R-0001) — the `no_baseline` case.
const NO_BASELINE_RESERVATION = "aaaaaaaa-0000-0000-0000-000000000001";
const UNKNOWN_RESERVATION = "aaaaaaaa-0000-0000-0000-0000000000ff";

// Client-minted return ids, distinct tails (`…a7/b7`) from every other suite's
// fixtures so cleanup stays independent under serial execution.
const RETURN_PROTOCOL_ID = "dddddddd-0000-0000-0000-0000000000a7";
const OTHER_RETURN_ID = "dddddddd-0000-0000-0000-0000000000b7";
const DAMAGE_ID = "eeeeeeee-0000-0000-0000-0000000000a7";

// The full Polish diacritic set rides every fixture on an encoding-sensitive path
// (lessons.md) — a damage note reaches the PDF built against this baseline.
const DAMAGE_LOCATION = "prawy przedni błotnik — zażółć gęślą jaźń";

const ALL_TABLES = ["protocols", "protocol_photos", "protocol_damages", "protocol_damage_photos", "email_deliveries"];

/** `create_return_protocol` args against the seeded baseline; override per case. */
function returnArgs(overrides: Record<string, unknown> = {}) {
  return {
    p_id: RETURN_PROTOCOL_ID,
    p_reservation_id: BASELINE_RESERVATION,
    p_baseline_protocol_id: BASELINE_PROTOCOL_ID,
    // Baseline odometer 42000 → 42850 = 850 km; fuel 8/8 → 4/8 = −4 (adverse).
    p_odometer_km: 42_850,
    p_fuel_eighths: 4,
    p_signed_at: new Date("2026-07-17T10:08:00Z").toISOString(),
    p_customer_ack: true,
    p_signature: `return/${RETURN_PROTOCOL_ID}/signature.png`,
    p_photos: [
      { slot: "front", path: `return/${RETURN_PROTOCOL_ID}/photo-front.jpg` },
      { slot: "rear", path: `return/${RETURN_PROTOCOL_ID}/photo-rear.jpg` },
    ],
    p_damages: [
      {
        id: DAMAGE_ID,
        type: "scratch",
        location: DAMAGE_LOCATION,
        size: "15 cm",
        // Carried over from the seeded baseline scratch — an EXISTING damage.
        baseline_damage_id: BASELINE_DAMAGE_ID,
        photos: [`return/${RETURN_PROTOCOL_ID}/damage-${DAMAGE_ID}-1.jpg`],
      },
    ],
    ...overrides,
  };
}

const deliveryArgs = {
  p_entity_type: "protocol",
  p_entity_id: RETURN_PROTOCOL_ID,
  p_template: "protocol_returned",
  p_recipient: "anna.nowak@example.com",
  p_status: "sent",
  p_error: null,
};

/** Delete only the return rows this suite mints — NEVER the seeded baseline. */
async function clearReturns() {
  // FK cascade clears the return's photos, damages and damage photos.
  await svc.from("protocols").delete().in("id", [RETURN_PROTOCOL_ID, OTHER_RETURN_ID]);
  await svc.from("email_deliveries").delete().in("entity_id", [RETURN_PROTOCOL_ID, OTHER_RETURN_ID]);
}

beforeEach(clearReturns);
afterEach(clearReturns);

describe("return protocol data layer (S-06 Phase 7)", () => {
  // -------------------------------------------------------------------------
  // 1. Precondition + 2. idempotency
  // -------------------------------------------------------------------------
  describe("create_return_protocol precondition + idempotency", () => {
    it("commits a return against the seeded issue baseline", async () => {
      const employee = await as("employee");
      const res = await employee.rpc("create_return_protocol", returnArgs());

      expect(res.error).toBeNull();
      expect(rows<CreateRow>(res.data)).toEqual([{ result: "ok", protocol_id: RETURN_PROTOCOL_ID }]);

      // The baseline linkage is persisted on the return row and the carried-over
      // damage — the comparison reads these back, they cannot be re-derived.
      const stored = await svc.from("protocols").select("type, baseline_protocol_id").eq("id", RETURN_PROTOCOL_ID);
      expect(rows<{ type: string; baseline_protocol_id: string }>(stored.data)[0]).toEqual({
        type: "return",
        baseline_protocol_id: BASELINE_PROTOCOL_ID,
      });

      const damage = await svc.from("protocol_damages").select("baseline_damage_id").eq("id", DAMAGE_ID);
      expect(rows<{ baseline_damage_id: string }>(damage.data)[0].baseline_damage_id).toBe(BASELINE_DAMAGE_ID);
    });

    it("returns `no_baseline` for a reservation with no issue protocol, writing nothing", async () => {
      const employee = await as("employee");
      const res = await employee.rpc(
        "create_return_protocol",
        returnArgs({ p_reservation_id: NO_BASELINE_RESERVATION }),
      );

      expect(res.error).toBeNull();
      expect(rows<CreateRow>(res.data)).toEqual([{ result: "no_baseline", protocol_id: null }]);

      const written = await svc.from("protocols").select("id").eq("id", RETURN_PROTOCOL_ID);
      expect(rows(written.data)).toHaveLength(0);
    });

    it("returns `no_baseline` when the submitted baseline id is not the reservation's issue protocol", async () => {
      const employee = await as("employee");
      // A well-formed id that is NOT R-0002's issue protocol — the RPC must reject
      // it even though an issue baseline DOES exist for the reservation.
      const res = await employee.rpc(
        "create_return_protocol",
        returnArgs({ p_baseline_protocol_id: "d6000000-0000-0000-0000-0000000000ff" }),
      );

      expect(rows<CreateRow>(res.data)).toEqual([{ result: "no_baseline", protocol_id: null }]);
    });

    it("returns `not_found` for an unknown reservation", async () => {
      const employee = await as("employee");
      const res = await employee.rpc("create_return_protocol", returnArgs({ p_reservation_id: UNKNOWN_RESERVATION }));

      expect(rows<CreateRow>(res.data)).toEqual([{ result: "not_found", protocol_id: null }]);
    });

    it("returns `conflict` (not a 500) on a second return, carrying the existing return id", async () => {
      const employee = await as("employee");
      await employee.rpc("create_return_protocol", returnArgs());

      // A different client-minted id, same reservation — two employees tapping.
      const res = await employee.rpc(
        "create_return_protocol",
        returnArgs({
          p_id: OTHER_RETURN_ID,
          p_signature: `return/${OTHER_RETURN_ID}/signature.png`,
          p_photos: [],
          p_damages: [],
        }),
      );

      expect(res.error).toBeNull();
      expect(rows<CreateRow>(res.data)).toEqual([{ result: "conflict", protocol_id: RETURN_PROTOCOL_ID }]);

      // Exactly one return survived on the reservation.
      const survivors = await svc
        .from("protocols")
        .select("id")
        .eq("reservation_id", BASELINE_RESERVATION)
        .eq("type", "return");
      expect(rows(survivors.data)).toHaveLength(1);
    });

    it("fails closed for a role-null authenticated caller, writing nothing", async () => {
      const norole = await as("norole");
      const res = await norole.rpc("create_return_protocol", returnArgs());

      expect(rows<CreateRow>(res.data)).toEqual([{ result: "unauthorized", protocol_id: null }]);

      const written = await svc.from("protocols").select("id").eq("id", RETURN_PROTOCOL_ID);
      expect(rows(written.data)).toHaveLength(0);
    });
  });

  // -------------------------------------------------------------------------
  // 3. Status untouched — "returned" is a row, never a reservation_status value.
  // -------------------------------------------------------------------------
  describe("completing a return does not change reservation_status", () => {
    it("leaves the reservation `confirmed` after a return is filed", async () => {
      const before = await svc.from("reservations").select("status").eq("id", BASELINE_RESERVATION);
      expect(rows<{ status: string }>(before.data)[0].status).toBe("confirmed");

      const employee = await as("employee");
      const res = await employee.rpc("create_return_protocol", returnArgs());
      expect(rows<CreateRow>(res.data)[0].result).toBe("ok");

      const after = await svc.from("reservations").select("status").eq("id", BASELINE_RESERVATION);
      expect(rows<{ status: string }>(after.data)[0].status).toBe("confirmed");
    });
  });

  // -------------------------------------------------------------------------
  // 4. Grants — return rows do not leak past the revoke-all posture.
  // -------------------------------------------------------------------------
  describe("a role-null / anon caller reads zero rows from every table, RETURN rows included", () => {
    beforeEach(async () => {
      // Populate ALL five tables through the real staff path with RETURN data, so a
      // passing denial below means "denied", never "nothing to read".
      const employee = await as("employee");
      await employee.rpc("create_return_protocol", returnArgs());
      await employee.rpc("record_email_delivery", deliveryArgs);

      // Guard the guard: if the fixture did not land, the denials pass vacuously.
      const seeded = await svc.from("email_deliveries").select("id").eq("entity_id", RETURN_PROTOCOL_ID);
      expect(rows(seeded.data)).toHaveLength(1);
      const photos = await svc.from("protocol_photos").select("id").eq("protocol_id", RETURN_PROTOCOL_ID);
      expect(rows(photos.data).length).toBeGreaterThan(0);
    });

    it.each(ALL_TABLES)("%s is unreadable by a role-null user", async (table) => {
      const norole = await as("norole");
      const res = await norole.from(table).select("*");
      // A revoked grant surfaces as an error with null data; either way the row
      // count a caller can observe must be zero.
      expect(rows(res.data)).toHaveLength(0);
    });

    it.each(ALL_TABLES)("%s is unreadable by anon", async (table) => {
      const res = await anonClient().from(table).select("*");
      expect(rows(res.data)).toHaveLength(0);
    });
  });

  // -------------------------------------------------------------------------
  // 5. RPC authz — anon reaches none of the three new RPCs; null role fails closed.
  // -------------------------------------------------------------------------
  describe("anon cannot execute any of the three new RPCs", () => {
    it("create_return_protocol", async () => {
      const res = await anonClient().rpc("create_return_protocol", returnArgs());
      expect(res.error).not.toBeNull();
    });

    it("list_returns_today", async () => {
      const res = await anonClient().rpc("list_returns_today");
      expect(res.error).not.toBeNull();
    });

    it("get_return_baseline", async () => {
      const res = await anonClient().rpc("get_return_baseline", { p_reservation_id: BASELINE_RESERVATION });
      expect(res.error).not.toBeNull();
    });
  });

  describe("the new RPCs fail closed on a null role", () => {
    it("list_returns_today returns zero rows", async () => {
      const norole = await as("norole");
      const res = await norole.rpc("list_returns_today");
      expect(rows(res.data)).toHaveLength(0);
    });

    it("get_return_baseline returns zero rows (an empty result is the not-found signal)", async () => {
      const norole = await as("norole");
      const res = await norole.rpc("get_return_baseline", { p_reservation_id: BASELINE_RESERVATION });
      expect(rows(res.data)).toHaveLength(0);
    });

    it("create_return_protocol is unauthorized and writes nothing", async () => {
      const norole = await as("norole");
      const res = await norole.rpc("create_return_protocol", returnArgs());
      expect(rows<CreateRow>(res.data)).toEqual([{ result: "unauthorized", protocol_id: null }]);

      const written = await svc.from("protocols").select("id").eq("id", RETURN_PROTOCOL_ID);
      expect(rows(written.data)).toHaveLength(0);
    });
  });

  // -------------------------------------------------------------------------
  // get_return_baseline loads the issue baseline for a staff caller.
  // -------------------------------------------------------------------------
  describe("get_return_baseline (staff read)", () => {
    interface BaselineRow {
      baseline_protocol_id: string;
      baseline_odometer_km: number;
      baseline_fuel_eighths: number;
      customer_email: string;
      return_protocol_id: string | null;
    }

    it("returns the seeded issue protocol + reservation fields for a confirmed, issued reservation", async () => {
      const employee = await as("employee");
      const res = await employee.rpc("get_return_baseline", { p_reservation_id: BASELINE_RESERVATION });
      expect(res.error).toBeNull();

      const row = rows<BaselineRow>(res.data)[0];
      expect(row).toBeDefined();
      expect(row.baseline_protocol_id).toBe(BASELINE_PROTOCOL_ID);
      expect(row.baseline_odometer_km).toBe(42_000);
      expect(row.baseline_fuel_eighths).toBe(8);
      expect(row.customer_email).toBe("anna.nowak@example.com");
      // No return filed yet on this reservation in a clean seed.
      expect(row.return_protocol_id).toBeNull();
    });

    it("returns zero rows for a reservation with no issue protocol (the 404 signal)", async () => {
      const employee = await as("employee");
      const res = await employee.rpc("get_return_baseline", { p_reservation_id: NO_BASELINE_RESERVATION });
      expect(rows(res.data)).toHaveLength(0);
    });

    it("folds in the existing return id once a return has been filed", async () => {
      const employee = await as("employee");
      await employee.rpc("create_return_protocol", returnArgs());

      const res = await employee.rpc("get_return_baseline", { p_reservation_id: BASELINE_RESERVATION });
      expect(rows<BaselineRow>(res.data)[0].return_protocol_id).toBe(RETURN_PROTOCOL_ID);
    });
  });
});

// ===========================================================================
// 6. WORKLIST FOLD — its own disposable scope of four dedicated vehicles +
// reservations dated relative to today, mirroring dispatch-list.test.ts, so no
// seed row is touched and the fold's four cases are controlled precisely.
// ===========================================================================
const now = new Date();
const TODAY = isoDate(now);
const OVERDUE = isoDate(new Date(now.getTime() - 3 * 86_400_000));
const OLDER_RETURN_DUE = isoDate(new Date(now.getTime() - 5 * 86_400_000));
const FILED_TODAY_DUE = isoDate(new Date(now.getTime() - 2 * 86_400_000));
// A fixed pickup floor comfortably before every return_date above, so the
// reservations busy-range (pickup → return, with its adjacency buffer) is always
// well-ordered — a same-day pickup/return would invert once the buffer applies.
const PICKUP = isoDate(new Date(now.getTime() - 30 * 86_400_000));
// A return filed two days ago — comfortably before `current_date` under any DB
// session timezone, so the "older-filed drops off" assertion cannot flake.
const TWO_DAYS_AGO = new Date(now.getTime() - 2 * 86_400_000).toISOString();

// Disposable ids in the `d8…` / `a8…` namespaces, disjoint from every fixture.
const V_OVERDUE = "d8000000-0000-0000-0000-000000000001";
const V_DUE = "d8000000-0000-0000-0000-000000000002";
const V_FILED_TODAY = "d8000000-0000-0000-0000-000000000003";
const V_FILED_OLDER = "d8000000-0000-0000-0000-000000000004";
const VEHICLE_IDS = [V_OVERDUE, V_DUE, V_FILED_TODAY, V_FILED_OLDER];

const R_OVERDUE = "a8000000-0000-0000-0000-000000000001";
const R_DUE = "a8000000-0000-0000-0000-000000000002";
const R_FILED_TODAY = "a8000000-0000-0000-0000-000000000003";
const R_FILED_OLDER = "a8000000-0000-0000-0000-000000000004";
const RESERVATION_IDS = [R_OVERDUE, R_DUE, R_FILED_TODAY, R_FILED_OLDER];

const IP_OVERDUE = "d8000000-0000-0000-0000-0000000000a1";
const IP_DUE = "d8000000-0000-0000-0000-0000000000a2";
const IP_FILED_TODAY = "d8000000-0000-0000-0000-0000000000a3";
const IP_FILED_OLDER = "d8000000-0000-0000-0000-0000000000a4";

const RP_FILED_TODAY = "d8000000-0000-0000-0000-0000000000f3";
const RP_FILED_OLDER = "d8000000-0000-0000-0000-0000000000f4";

async function clearFoldScope() {
  // Return rows first (self-FK baseline_protocol_id → issue rows), then issue rows,
  // then reservations (FK restrict from protocols), then vehicles.
  await svc.from("protocols").delete().in("id", [RP_FILED_TODAY, RP_FILED_OLDER]);
  await svc.from("protocols").delete().in("id", [IP_OVERDUE, IP_DUE, IP_FILED_TODAY, IP_FILED_OLDER]);
  await svc.from("reservations").delete().in("id", RESERVATION_IDS);
  await svc.from("vehicles").delete().in("id", VEHICLE_IDS);
}

describe("list_returns_today fold (S-06 Phase 7)", () => {
  beforeAll(async () => {
    await clearFoldScope();

    const vehicle = (id: string, plate: string) => ({
      id,
      name: "Returns Fold Vehicle",
      plate,
      category: "cargo_van" as const,
      daily_rate: 100,
      monthly_rate: 2000,
      deposit: 500,
      per_extra_km_rate: 1,
      is_active: true,
    });
    const vErr = await svc
      .from("vehicles")
      .insert([
        vehicle(V_OVERDUE, "ZZ RFLD01"),
        vehicle(V_DUE, "ZZ RFLD02"),
        vehicle(V_FILED_TODAY, "ZZ RFLD03"),
        vehicle(V_FILED_OLDER, "ZZ RFLD04"),
      ]);
    if (vErr.error) throw vErr.error;

    // Each reservation on its OWN vehicle so no confirmed-overlap EXCLUDE trips.
    const reservation = (id: string, vehicleId: string, ret: string, ref: string, token: string) => ({
      id,
      vehicle_id: vehicleId,
      customer_name: "Returns Fold",
      customer_email: "returns.fold@example.com",
      customer_phone: "+48600000000",
      pickup_date: PICKUP,
      return_date: ret,
      status: "confirmed" as const,
      reference: ref,
      access_token: token,
    });
    const rErr = await svc
      .from("reservations")
      .insert([
        reservation(R_OVERDUE, V_OVERDUE, OVERDUE, "R-RFLD1", "c8000000-0000-0000-0000-000000000001"),
        reservation(R_DUE, V_DUE, TODAY, "R-RFLD2", "c8000000-0000-0000-0000-000000000002"),
        reservation(R_FILED_TODAY, V_FILED_TODAY, FILED_TODAY_DUE, "R-RFLD3", "c8000000-0000-0000-0000-000000000003"),
        reservation(R_FILED_OLDER, V_FILED_OLDER, OLDER_RETURN_DUE, "R-RFLD4", "c8000000-0000-0000-0000-000000000004"),
      ]);
    if (rErr.error) throw rErr.error;

    // Issue baselines — the INNER join requires one per reservation. Distinct
    // odometer/fuel so the folded baseline summary is unambiguous.
    const issue = (id: string, reservationId: string, odo: number, fuel: number) => ({
      id,
      reservation_id: reservationId,
      type: "issue" as const,
      odometer_km: odo,
      fuel_eighths: fuel,
      signed_at: TWO_DAYS_AGO,
      signature: `issue/${id}/signature.png`,
      customer_ack: true,
    });
    const ipErr = await svc
      .from("protocols")
      .insert([
        issue(IP_OVERDUE, R_OVERDUE, 60_000, 8),
        issue(IP_DUE, R_DUE, 61_000, 7),
        issue(IP_FILED_TODAY, R_FILED_TODAY, 70_000, 6),
        issue(IP_FILED_OLDER, R_FILED_OLDER, 99_000, 4),
      ]);
    if (ipErr.error) throw ipErr.error;

    // The filed-TODAY return goes through the RPC so its created_at is server-set
    // to now() — unambiguously today, no timezone edge.
    const employee = await as("employee");
    const filedToday = await employee.rpc("create_return_protocol", {
      p_id: RP_FILED_TODAY,
      p_reservation_id: R_FILED_TODAY,
      p_baseline_protocol_id: IP_FILED_TODAY,
      p_odometer_km: 70_500,
      p_fuel_eighths: 5,
      p_signed_at: new Date().toISOString(),
      p_customer_ack: true,
      p_signature: `return/${RP_FILED_TODAY}/signature.png`,
      p_photos: [],
      p_damages: [],
    });
    if (filedToday.error) throw filedToday.error;
    expect(rows<CreateRow>(filedToday.data)[0].result).toBe("ok");

    // The filed-OLDER return is inserted directly with an explicit past created_at
    // — the one thing the RPC (server-now default) cannot express.
    const filedOlder = await svc.from("protocols").insert({
      id: RP_FILED_OLDER,
      reservation_id: R_FILED_OLDER,
      type: "return",
      baseline_protocol_id: IP_FILED_OLDER,
      odometer_km: 99_800,
      fuel_eighths: 4,
      signed_at: TWO_DAYS_AGO,
      signature: `return/${RP_FILED_OLDER}/signature.png`,
      customer_ack: true,
      created_at: TWO_DAYS_AGO,
    });
    if (filedOlder.error) throw filedOlder.error;
  });

  afterAll(clearFoldScope);

  it("includes an overdue-open return with a null return_protocol_id and the folded baseline summary", async () => {
    const employee = await as("employee");
    const res = await employee.rpc("list_returns_today");
    expect(res.error).toBeNull();

    const row = rows<ReturnRow>(res.data).find((r) => r.reservation_id === R_OVERDUE);
    expect(row).toBeDefined();
    expect(row?.return_protocol_id).toBeNull();
    // The baseline summary is folded in even before any return is filed.
    expect(row?.baseline_protocol_id).toBe(IP_OVERDUE);
    expect(row?.baseline_odometer_km).toBe(60_000);
    expect(row?.baseline_fuel_eighths).toBe(8);
  });

  it("includes a due-today open return (return_date = current_date, the <= boundary)", async () => {
    const employee = await as("employee");
    const row = rows<ReturnRow>((await employee.rpc("list_returns_today")).data).find(
      (r) => r.reservation_id === R_DUE,
    );
    expect(row).toBeDefined();
    expect(row?.return_protocol_id).toBeNull();
  });

  it("KEEPS a return filed today, folding in its return_protocol_id (email recovery)", async () => {
    const employee = await as("employee");
    const row = rows<ReturnRow>((await employee.rpc("list_returns_today")).data).find(
      (r) => r.reservation_id === R_FILED_TODAY,
    );
    expect(row).toBeDefined();
    expect(row?.return_protocol_id).toBe(RP_FILED_TODAY);
  });

  it("DROPS a return filed before today (the vehicle is fully processed)", async () => {
    const employee = await as("employee");
    const row = rows<ReturnRow>((await employee.rpc("list_returns_today")).data).find(
      (r) => r.reservation_id === R_FILED_OLDER,
    );
    expect(row).toBeUndefined();
  });
});

// ===========================================================================
// 7. STORAGE-PREFIX PARITY — the one boundary that cannot be shared by import.
// The SQL predicate `(storage.foldername(name))[1] in ('issue','return')` is the
// second hand-written copy of the prefix set (the TypeScript side shares
// `protocol-storage-paths`). This pins the two together: a `return/`-prefixed
// object is staff-writable + staff-readable and invisible to anon / a null role.
// ===========================================================================
const BUCKET = "protocols";
const STORAGE_PROBE_ID = "d8000000-0000-0000-0000-0000000000e7";
const RETURN_OBJECT_PATH = `return/${STORAGE_PROBE_ID}/protocol.pdf`;
// A minimal PDF byte blob — the bucket's allowed_mime_types rejects octet-stream.
const PDF_BYTES = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d]);

describe("storage return/ prefix parity (S-06 Phase 7)", () => {
  beforeAll(async () => {
    // Staff has no DELETE policy (append-only), so teardown is service-role.
    await svc.storage.from(BUCKET).remove([RETURN_OBJECT_PATH]);
  });
  afterAll(async () => {
    await svc.storage.from(BUCKET).remove([RETURN_OBJECT_PATH]);
  });

  it("a staff client can INSERT a return/-prefixed object (the storage.objects INSERT policy covers 'return')", async () => {
    const employee = await as("employee");
    const { error } = await employee.storage
      .from(BUCKET)
      .upload(RETURN_OBJECT_PATH, new Blob([PDF_BYTES], { type: "application/pdf" }), {
        contentType: "application/pdf",
        upsert: true,
      });
    expect(error).toBeNull();
  });

  it("a staff client can READ the return/-prefixed object back (the SELECT policy covers 'return')", async () => {
    const employee = await as("employee");
    const { data, error } = await employee.storage.from(BUCKET).download(RETURN_OBJECT_PATH);
    expect(error).toBeNull();
    expect(data).not.toBeNull();
  });

  it("anon cannot read the return/-prefixed object", async () => {
    const { data } = await anonClient().storage.from(BUCKET).download(RETURN_OBJECT_PATH);
    expect(data).toBeNull();
  });

  it("a role-null authenticated user cannot read the return/-prefixed object", async () => {
    const norole = await as("norole");
    const { data } = await norole.storage.from(BUCKET).download(RETURN_OBJECT_PATH);
    expect(data).toBeNull();
  });
});
