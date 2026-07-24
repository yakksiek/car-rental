// core
import { afterAll, beforeAll, describe, expect, it } from "vitest";

// others
import { anonClient, as, serviceClient } from "../helpers/clients";

// Overdue-returns count suite (S-07 Phase 1). Pins the one invariant the "Zwroty"
// nav danger badge is load-bearing on: `count_overdue_returns()` counts EXACTLY the
// rows `ReturnQueue` classifies as `overdue`, so the badge can never disagree with
// the on-page count. Plus the additive `customer_phone` column and the grants that
// must survive the `list_returns_today` drop+recreate.
//
//   1. PARITY — the scalar count equals the strict-overdue-open subset of
//      list_returns_today (return_protocol_id null AND return_date < today) on the
//      SAME live DB, so the two surfaces cannot drift. Seed-independent.
//   2. CLASSIFICATION — a strictly-overdue + still-open + issued + confirmed rental
//      counts; due-today, returned, never-issued-past-due and non-confirmed do NOT.
//      Proven both per-reservation (against the list) and numerically (a +2 delta
//      on the scalar count from the six-reservation fixture).
//   3. AUTHZ — a null-role caller gets 0 (the in-RPC role gate, not just an
//      unreadable table); anon cannot execute the RPC at all.
//   4. PHONE + GRANTS — list_returns_today still returns rows AFTER the drop+recreate,
//      now carrying customer_phone; a staff caller reads them (grant survived) and
//      anon cannot execute it (the revoke from public,anon is back in place).
//
// SERVICE-ROLE ISOLATION: every access assertion runs on `as(role)` / `anonClient()`
// (subject to RLS). `serviceClient()` appears only in setup/teardown.

const svc = serviceClient();

/** Cast an untyped supabase-js result to a row list, treating a denial as zero rows. */
function rows<T>(data: unknown): T[] {
  return (data as T[] | null) ?? [];
}

const pad = (n: number) => String(n).padStart(2, "0");
/** Local calendar date, matching the DB's `current_date` (same machine clock). */
function isoDate(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

interface ReturnRow {
  reservation_id: string;
  return_protocol_id: string | null;
  return_date: string;
  customer_phone: string | null;
}
interface CreateRow {
  result: string;
  protocol_id: string | null;
}

const now = new Date();
const TODAY = isoDate(now);
const OVERDUE = isoDate(new Date(now.getTime() - 3 * 86_400_000));
const OVERDUE_4 = isoDate(new Date(now.getTime() - 4 * 86_400_000));
// A fixed pickup floor comfortably before every return_date above (mirrors the
// returns-rls fold scope), so no busy-range/adjacency edge trips.
const PICKUP = isoDate(new Date(now.getTime() - 30 * 86_400_000));
const TWO_DAYS_AGO = new Date(now.getTime() - 2 * 86_400_000).toISOString();

// Disposable ids in the `d9…` / `a9…` namespaces, disjoint from every fixture and
// from the returns-rls fold scope's `d8…` / `a8…`.
const V_OVERDUE_1 = "d9000000-0000-0000-0000-000000000001";
const V_OVERDUE_2 = "d9000000-0000-0000-0000-000000000002";
const V_DUE_TODAY = "d9000000-0000-0000-0000-000000000003";
const V_RETURNED = "d9000000-0000-0000-0000-000000000004";
const V_NO_ISSUE = "d9000000-0000-0000-0000-000000000005";
const V_PENDING = "d9000000-0000-0000-0000-000000000006";
const VEHICLE_IDS = [V_OVERDUE_1, V_OVERDUE_2, V_DUE_TODAY, V_RETURNED, V_NO_ISSUE, V_PENDING];

const R_OVERDUE_1 = "a9000000-0000-0000-0000-000000000001";
const R_OVERDUE_2 = "a9000000-0000-0000-0000-000000000002";
const R_DUE_TODAY = "a9000000-0000-0000-0000-000000000003";
const R_RETURNED = "a9000000-0000-0000-0000-000000000004";
const R_NO_ISSUE = "a9000000-0000-0000-0000-000000000005";
const R_PENDING = "a9000000-0000-0000-0000-000000000006";
const RESERVATION_IDS = [R_OVERDUE_1, R_OVERDUE_2, R_DUE_TODAY, R_RETURNED, R_NO_ISSUE, R_PENDING];

const IP_OVERDUE_1 = "d9000000-0000-0000-0000-0000000000a1";
const IP_OVERDUE_2 = "d9000000-0000-0000-0000-0000000000a2";
const IP_DUE_TODAY = "d9000000-0000-0000-0000-0000000000a3";
const IP_RETURNED = "d9000000-0000-0000-0000-0000000000a4";
const IP_PENDING = "d9000000-0000-0000-0000-0000000000a6";
const ISSUE_IDS = [IP_OVERDUE_1, IP_OVERDUE_2, IP_DUE_TODAY, IP_RETURNED, IP_PENDING];

const RP_RETURNED = "d9000000-0000-0000-0000-0000000000f4";

// A distinctive phone rides the counting overdue row so the customer_phone column
// assertion cannot pass on a coincidental value.
const OVERDUE_PHONE = "+48501502503";

/** The count contributed to `count_overdue_returns` by the seed alone (measured before
 * this suite's fixtures land), so the +2 delta assertion is seed-independent. */
let baselineOverdueCount = 0;

async function clearScope() {
  // Return rows first (self-FK baseline_protocol_id → issue rows), then issue rows,
  // then reservations (FK restrict from protocols), then vehicles.
  await svc.from("protocols").delete().in("id", [RP_RETURNED]);
  await svc.from("protocols").delete().in("id", ISSUE_IDS);
  await svc.from("reservations").delete().in("id", RESERVATION_IDS);
  await svc.from("vehicles").delete().in("id", VEHICLE_IDS);
}

describe("count_overdue_returns + list_returns_today customer_phone (S-07 Phase 1)", () => {
  beforeAll(async () => {
    await clearScope();

    // Baseline: whatever the seed contributes to the global overdue count, captured
    // BEFORE our fixtures so the +2 delta below is exact regardless of seed data.
    const employee = await as("employee");
    const base = await employee.rpc("count_overdue_returns");
    baselineOverdueCount = (base.data as number | null) ?? 0;

    const vehicle = (id: string, plate: string) => ({
      id,
      name: "Overdue Count Vehicle",
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
        vehicle(V_OVERDUE_1, "ZZ OVC001"),
        vehicle(V_OVERDUE_2, "ZZ OVC002"),
        vehicle(V_DUE_TODAY, "ZZ OVC003"),
        vehicle(V_RETURNED, "ZZ OVC004"),
        vehicle(V_NO_ISSUE, "ZZ OVC005"),
        vehicle(V_PENDING, "ZZ OVC006"),
      ]);
    if (vErr.error) throw vErr.error;

    // Each reservation on its OWN vehicle so no confirmed-overlap EXCLUDE trips.
    const reservation = (
      id: string,
      vehicleId: string,
      ret: string,
      ref: string,
      token: string,
      status: "confirmed" | "pending",
      phone: string,
    ) => ({
      id,
      vehicle_id: vehicleId,
      customer_name: "Overdue Count",
      customer_email: "overdue.count@example.com",
      customer_phone: phone,
      pickup_date: PICKUP,
      return_date: ret,
      status,
      reference: ref,
      access_token: token,
    });
    const rErr = await svc
      .from("reservations")
      .insert([
        reservation(
          R_OVERDUE_1,
          V_OVERDUE_1,
          OVERDUE,
          "R-OVC01",
          "c9000000-0000-0000-0000-000000000001",
          "confirmed",
          OVERDUE_PHONE,
        ),
        reservation(
          R_OVERDUE_2,
          V_OVERDUE_2,
          OVERDUE_4,
          "R-OVC02",
          "c9000000-0000-0000-0000-000000000002",
          "confirmed",
          "+48600000002",
        ),
        reservation(
          R_DUE_TODAY,
          V_DUE_TODAY,
          TODAY,
          "R-OVC03",
          "c9000000-0000-0000-0000-000000000003",
          "confirmed",
          "+48600000003",
        ),
        reservation(
          R_RETURNED,
          V_RETURNED,
          OVERDUE_4,
          "R-OVC04",
          "c9000000-0000-0000-0000-000000000004",
          "confirmed",
          "+48600000004",
        ),
        reservation(
          R_NO_ISSUE,
          V_NO_ISSUE,
          OVERDUE,
          "R-OVC05",
          "c9000000-0000-0000-0000-000000000005",
          "confirmed",
          "+48600000005",
        ),
        reservation(
          R_PENDING,
          V_PENDING,
          OVERDUE,
          "R-OVC06",
          "c9000000-0000-0000-0000-000000000006",
          "pending",
          "+48600000006",
        ),
      ]);
    if (rErr.error) throw rErr.error;

    // Issue baselines — the INNER join requires one per counted/listed reservation.
    // R_NO_ISSUE deliberately gets none (proves the INNER issue join excludes it).
    const issue = (id: string, reservationId: string) => ({
      id,
      reservation_id: reservationId,
      type: "issue" as const,
      odometer_km: 50_000,
      fuel_eighths: 8,
      signed_at: TWO_DAYS_AGO,
      signature: `issue/${id}/signature.png`,
      customer_ack: true,
    });
    const ipErr = await svc.from("protocols").insert([
      issue(IP_OVERDUE_1, R_OVERDUE_1),
      issue(IP_OVERDUE_2, R_OVERDUE_2),
      issue(IP_DUE_TODAY, R_DUE_TODAY),
      issue(IP_RETURNED, R_RETURNED),
      // R_PENDING is issued too — proves status='confirmed' excludes it even when
      // an overdue, issued protocol exists.
      issue(IP_PENDING, R_PENDING),
    ]);
    if (ipErr.error) throw ipErr.error;

    // File R_RETURNED's return TODAY through the RPC (server-set created_at = now),
    // so it stays visible in list_returns_today as a `returned` row — present in the
    // list but excluded from the overdue subset AND from the count (rp.id not null).
    const employee2 = await as("employee");
    const filed = await employee2.rpc("create_return_protocol", {
      p_id: RP_RETURNED,
      p_reservation_id: R_RETURNED,
      p_baseline_protocol_id: IP_RETURNED,
      p_odometer_km: 50_500,
      p_fuel_eighths: 5,
      p_signed_at: new Date().toISOString(),
      p_customer_ack: true,
      p_signature: `return/${RP_RETURNED}/signature.png`,
      p_photos: [],
      p_damages: [],
    });
    if (filed.error) throw filed.error;
    expect(rows<CreateRow>(filed.data)[0].result).toBe("ok");
  });

  afterAll(clearScope);

  // -------------------------------------------------------------------------
  // 1. Parity — the count mirrors the worklist's overdue classification exactly.
  // -------------------------------------------------------------------------
  it("equals the strict-overdue-open subset of list_returns_today (badge/list parity)", async () => {
    const employee = await as("employee");
    const list = rows<ReturnRow>((await employee.rpc("list_returns_today")).data);
    const overdueSubset = list.filter((r) => r.return_protocol_id === null && r.return_date < TODAY);

    const count = (await employee.rpc("count_overdue_returns")).data as number;
    expect(count).toBe(overdueSubset.length);
  });

  // -------------------------------------------------------------------------
  // 2. Classification — per-reservation membership against the list, then the
  //    numeric +2 delta on the scalar count.
  // -------------------------------------------------------------------------
  it("counts strictly-overdue + open + issued + confirmed; excludes due-today / returned / never-issued / non-confirmed", async () => {
    const employee = await as("employee");
    const list = rows<ReturnRow>((await employee.rpc("list_returns_today")).data);
    const overdueSubset = new Set(
      list.filter((r) => r.return_protocol_id === null && r.return_date < TODAY).map((r) => r.reservation_id),
    );
    const inList = new Set(list.map((r) => r.reservation_id));

    // Counted: strictly overdue, open, issued, confirmed.
    expect(overdueSubset.has(R_OVERDUE_1)).toBe(true);
    expect(overdueSubset.has(R_OVERDUE_2)).toBe(true);
    // Due-today is in the list but NOT overdue (return_date === today, not < today).
    expect(inList.has(R_DUE_TODAY)).toBe(true);
    expect(overdueSubset.has(R_DUE_TODAY)).toBe(false);
    // Returned (filed today) is in the list but NOT overdue (return_protocol_id set).
    expect(inList.has(R_RETURNED)).toBe(true);
    expect(overdueSubset.has(R_RETURNED)).toBe(false);
    // Never-issued past-due and non-confirmed never reach the list at all.
    expect(inList.has(R_NO_ISSUE)).toBe(false);
    expect(inList.has(R_PENDING)).toBe(false);

    // And numerically: the six-reservation fixture moves the scalar count by exactly
    // +2 (only the two overdue-open-issued-confirmed rows).
    const count = (await employee.rpc("count_overdue_returns")).data as number;
    expect(count).toBe(baselineOverdueCount + 2);
  });

  // -------------------------------------------------------------------------
  // 3. Authz — null role gets 0 (in-RPC gate); anon cannot execute.
  // -------------------------------------------------------------------------
  it("returns 0 for a role-null authenticated caller (the in-RPC role gate)", async () => {
    const norole = await as("norole");
    const res = await norole.rpc("count_overdue_returns");
    expect(res.error).toBeNull();
    expect(res.data).toBe(0);
  });

  it("anon cannot execute count_overdue_returns", async () => {
    const res = await anonClient().rpc("count_overdue_returns");
    expect(res.error).not.toBeNull();
  });

  // -------------------------------------------------------------------------
  // 4. customer_phone column + grants survived the drop+recreate.
  // -------------------------------------------------------------------------
  it("list_returns_today still returns rows carrying customer_phone for a staff caller (grant survived)", async () => {
    const employee = await as("employee");
    const res = await employee.rpc("list_returns_today");
    expect(res.error).toBeNull();

    const row = rows<ReturnRow>(res.data).find((r) => r.reservation_id === R_OVERDUE_1);
    expect(row).toBeDefined();
    expect(row?.customer_phone).toBe(OVERDUE_PHONE);
  });

  it("anon still cannot execute list_returns_today after the drop+recreate (revoke re-applied)", async () => {
    const res = await anonClient().rpc("list_returns_today");
    expect(res.error).not.toBeNull();
  });
});
