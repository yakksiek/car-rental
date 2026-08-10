// core
import { afterAll, beforeAll, describe, expect, it } from "vitest";

// others
import { GET as searchGET } from "../../src/pages/api/search";
import { anonClient, as, serviceClient } from "../helpers/clients";
import { anonContext, asContext } from "../helpers/context";

// Staff global search suite (S-13 Phase 1). `search_staff` is the ONLY read path
// the ⌘K omnisearch has: `reservations` SELECT is revoked and `protocols` carries
// zero policies, so everything the dropdown shows crosses the RLS boundary through
// this one definer RPC. That makes four things load-bearing:
//
//   1. MATCHING — a query hits reservations by customer name / reference / vehicle
//      plate, vehicles by name / make / model / plate, and returns by the same
//      reservation fields; each row is tagged with its `kind`.
//   2. RETURNS CLASSIFICATION — the Zwroty group mirrors `list_returns_today`'s join
//      (issued + confirmed) and derives `due` vs `returned` from the return
//      protocol's existence. A never-issued reservation must NOT appear there (it
//      would be an un-actionable row), while a still-due one MUST (gating on a
//      return protocol instead would surface only completed returns).
//   3. AUTHZ — a role-null authenticated caller gets zero rows from the in-RPC gate,
//      and anon cannot execute the function at all (the revoke, not just the gate).
//      The endpoint answers 401 anon / 403 role-null before it ever reaches the DB.
//   4. INPUT HANDLING — a sub-2-character query returns nothing rather than the whole
//      table, ILIKE metacharacters are escaped instead of widening the match, and the
//      per-group cap holds.
//
// SERVICE-ROLE ISOLATION: every access assertion runs through `as(role)` /
// `anonClient()` / a constructed APIContext carrying those clients. `serviceClient()`
// appears only in setup/teardown.
//
// POLISH DIACRITICS BY DEFAULT (lessons.md): the fixtures carry `ą ć ę ł ń ó ś ź ż`,
// so ILIKE's case folding is exercised on real Polish data, not on ASCII stand-ins.

const svc = serviceClient();

/** Cast an untyped supabase-js result to a row list, treating a denial as zero rows. */
function rows<T>(data: unknown): T[] {
  return (data as T[] | null) ?? [];
}

interface SearchRowShape {
  kind: string;
  id: string;
  reference: string | null;
  customer_name: string | null;
  vehicle_id: string;
  vehicle_name: string;
  vehicle_make: string | null;
  vehicle_model: string | null;
  vehicle_plate: string;
  vehicle_category: string;
  pickup_date: string | null;
  return_date: string | null;
  status: string;
  daily_rate: string | number;
}

interface GroupedResults {
  reservations: { id: string; reference: string; status: string }[];
  returns: { id: string; reference: string; status: string }[];
  vehicles: { id: string; name: string; plate: string; is_active: boolean }[];
}

const pad = (n: number) => String(n).padStart(2, "0");
function isoDate(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

const now = new Date();
const PICKUP = isoDate(new Date(now.getTime() - 20 * 86_400_000));
const RETURN_DUE = isoDate(new Date(now.getTime() - 2 * 86_400_000));
const RETURN_DONE = isoDate(new Date(now.getTime() - 5 * 86_400_000));
const RETURN_FUTURE = isoDate(new Date(now.getTime() + 20 * 86_400_000));
const SIGNED_AT = new Date(now.getTime() - 10 * 86_400_000).toISOString();

// Disposable ids in the `e1…` / `b1…` namespaces, disjoint from the seeded fleet and
// from every other suite's scope (`d8…`/`a8…` returns-rls, `d9…`/`a9…` overdue).
const V_DUE = "e1000000-0000-0000-0000-000000000001";
const V_RETURNED = "e1000000-0000-0000-0000-000000000002";
const V_PENDING = "e1000000-0000-0000-0000-000000000003";
const V_NO_ISSUE = "e1000000-0000-0000-0000-000000000004";
// Nine more vehicles sharing one token, to prove the per-group LIMIT 8.
const V_CAP = Array.from({ length: 9 }, (_, i) => `e1000000-0000-0000-0000-0000000000c${i + 1}`);
const VEHICLE_IDS = [V_DUE, V_RETURNED, V_PENDING, V_NO_ISSUE, ...V_CAP];

const R_DUE = "b1000000-0000-0000-0000-000000000001";
const R_RETURNED = "b1000000-0000-0000-0000-000000000002";
const R_PENDING = "b1000000-0000-0000-0000-000000000003";
const R_NO_ISSUE = "b1000000-0000-0000-0000-000000000004";
const RESERVATION_IDS = [R_DUE, R_RETURNED, R_PENDING, R_NO_ISSUE];

const IP_DUE = "e1000000-0000-0000-0000-0000000000a1";
const IP_RETURNED = "e1000000-0000-0000-0000-0000000000a2";
const RP_RETURNED = "e1000000-0000-0000-0000-0000000000f2";

// One token shared by every fixture row so a single query sweeps the whole scope.
// "Krzy" also prefixes the vehicle name below, so it spans all three groups.
const TOKEN = "krzy";
const CUSTOMER_DUE = "Krzysztof Wąsik-Ćwikliński";
const CUSTOMER_RETURNED = "Żaneta Śledź-Krzyworęka";
const CUSTOMER_PENDING = "Łukasz Krzyżanowski";
const PLATE_DUE = "ZZ KRZY01";
const VEHICLE_DUE_NAME = "Krzyżówka Ćwikła Van";
const REFERENCE_PENDING = "R-KRZY03";
// Deliberately shares NO substring with TOKEN — it must be reachable only by plate.
const CUSTOMER_NO_ISSUE = "Bogumiła Ptaś";
const PLATE_NO_ISSUE = "ZZ KRZY04";
// The cap fixture's own token, isolated from TOKEN so the group counts stay readable.
const CAP_TOKEN = "Szczebrzeszyński";

async function clearScope() {
  // Return rows first (self-FK baseline_protocol_id → issue rows), then issue rows,
  // then reservations (FK from protocols), then vehicles.
  await svc.from("protocols").delete().in("id", [RP_RETURNED]);
  await svc.from("protocols").delete().in("id", [IP_DUE, IP_RETURNED]);
  await svc.from("reservations").delete().in("id", RESERVATION_IDS);
  await svc.from("vehicles").delete().in("id", VEHICLE_IDS);
}

describe("search_staff + GET /api/search (S-13 Phase 1)", () => {
  beforeAll(async () => {
    await clearScope();

    const vehicle = (id: string, name: string, plate: string, make: string, model: string, isActive = true) => ({
      id,
      name,
      plate,
      make,
      model,
      category: "cargo_van" as const,
      daily_rate: 300,
      monthly_rate: 6000,
      deposit: 1500,
      per_extra_km_rate: 1,
      is_active: isActive,
    });
    const vErr = await svc.from("vehicles").insert([
      vehicle(V_DUE, VEHICLE_DUE_NAME, PLATE_DUE, "Mączka", "Źrebię"),
      vehicle(V_RETURNED, "Pojazd Zwrócony", "ZZ KRZY02", "Ćma", "Łoś"),
      // Inactive, so the vehicle row's `active`/`inactive` status is exercised.
      vehicle(V_PENDING, "Pojazd Oczekujący", "ZZ KRZY03", "Żubr", "Ryś", false),
      vehicle(V_NO_ISSUE, "Pojazd Bez Wydania", PLATE_NO_ISSUE, "Sęp", "Jeż"),
      ...V_CAP.map((id, i) => vehicle(id, `${CAP_TOKEN} ${i + 1}`, `ZZ CAP0${i + 1}`, "Test", "Cap")),
    ]);
    if (vErr.error) throw vErr.error;

    // Each reservation on its OWN vehicle so no confirmed-overlap EXCLUDE trips.
    const reservation = (
      id: string,
      vehicleId: string,
      name: string,
      ret: string,
      ref: string,
      token: string,
      status: "confirmed" | "pending",
    ) => ({
      id,
      vehicle_id: vehicleId,
      customer_name: name,
      customer_email: "krzysztof.wasik@example.com",
      customer_phone: "+48511222333",
      pickup_date: PICKUP,
      return_date: ret,
      status,
      reference: ref,
      access_token: token,
    });
    const rErr = await svc.from("reservations").insert([
      reservation(R_DUE, V_DUE, CUSTOMER_DUE, RETURN_DUE, "R-KRZY01", "c1000000-0000-0000-0000-000000000001", "confirmed"), // prettier-ignore
      reservation(R_RETURNED, V_RETURNED, CUSTOMER_RETURNED, RETURN_DONE, "R-KRZY02", "c1000000-0000-0000-0000-000000000002", "confirmed"), // prettier-ignore
      reservation(R_PENDING, V_PENDING, CUSTOMER_PENDING, RETURN_FUTURE, REFERENCE_PENDING, "c1000000-0000-0000-0000-000000000003", "pending"), // prettier-ignore
      reservation(R_NO_ISSUE, V_NO_ISSUE, CUSTOMER_NO_ISSUE, RETURN_DUE, "R-NOISS4", "c1000000-0000-0000-0000-000000000004", "confirmed"), // prettier-ignore
    ]);
    if (rErr.error) throw rErr.error;

    // Issue baselines. R_NO_ISSUE deliberately gets none — it is confirmed and
    // past-due, so only the INNER issue join keeps it out of the Zwroty group.
    const issue = (id: string, reservationId: string) => ({
      id,
      reservation_id: reservationId,
      type: "issue" as const,
      odometer_km: 40_000,
      fuel_eighths: 8,
      signed_at: SIGNED_AT,
      signature: `issue/${id}/signature.png`,
      customer_ack: true,
    });
    const ipErr = await svc.from("protocols").insert([issue(IP_DUE, R_DUE), issue(IP_RETURNED, R_RETURNED)]);
    if (ipErr.error) throw ipErr.error;

    const rpErr = await svc.from("protocols").insert([
      {
        id: RP_RETURNED,
        reservation_id: R_RETURNED,
        type: "return" as const,
        baseline_protocol_id: IP_RETURNED,
        odometer_km: 41_000,
        fuel_eighths: 5,
        signed_at: SIGNED_AT,
        signature: `return/${RP_RETURNED}/signature.png`,
        customer_ack: true,
      },
    ]);
    if (rpErr.error) throw rpErr.error;
  });

  afterAll(clearScope);

  // -------------------------------------------------------------------------
  // 1. Matching — the three groups, by every advertised field.
  // -------------------------------------------------------------------------
  it("matches reservations by customer name, and tags them kind='reservation'", async () => {
    const employee = await as("employee");
    const res = await employee.rpc("search_staff", { p_query: TOKEN });
    expect(res.error).toBeNull();

    const reservations = rows<SearchRowShape>(res.data).filter((r) => r.kind === "reservation");
    const hit = reservations.find((r) => r.id === R_DUE);
    expect(hit).toBeDefined();
    expect(hit?.customer_name).toBe(CUSTOMER_DUE);
    expect(hit?.reference).toBe("R-KRZY01");
    expect(hit?.vehicle_plate).toBe(PLATE_DUE);
    expect(hit?.status).toBe("confirmed");
    // The base reservation status, never a derived one (design contract D4).
    expect(reservations.find((r) => r.id === R_PENDING)?.status).toBe("pending");
  });

  it("matches a reservation by its reference", async () => {
    const employee = await as("employee");
    const res = await employee.rpc("search_staff", { p_query: REFERENCE_PENDING });
    const ids = rows<SearchRowShape>(res.data)
      .filter((r) => r.kind === "reservation")
      .map((r) => r.id);
    expect(ids).toContain(R_PENDING);
  });

  it("matches a reservation by its vehicle's plate (the customer name shares nothing with the query)", async () => {
    const employee = await as("employee");
    const res = await employee.rpc("search_staff", { p_query: PLATE_NO_ISSUE });
    const hit = rows<SearchRowShape>(res.data).find((r) => r.kind === "reservation" && r.id === R_NO_ISSUE);
    expect(hit).toBeDefined();
    expect(hit?.customer_name).toBe(CUSTOMER_NO_ISSUE);
  });

  it("matches vehicles by name, make, model and plate", async () => {
    const employee = await as("employee");
    const byName = await employee.rpc("search_staff", { p_query: "Krzyżówka" });
    expect(rows<SearchRowShape>(byName.data).filter((r) => r.kind === "vehicle").map((r) => r.id)).toContain(V_DUE); // prettier-ignore

    const byMake = await employee.rpc("search_staff", { p_query: "Mączka" });
    expect(rows<SearchRowShape>(byMake.data).filter((r) => r.kind === "vehicle").map((r) => r.id)).toContain(V_DUE); // prettier-ignore

    const byModel = await employee.rpc("search_staff", { p_query: "Źrebię" });
    expect(rows<SearchRowShape>(byModel.data).filter((r) => r.kind === "vehicle").map((r) => r.id)).toContain(V_DUE); // prettier-ignore

    const byPlate = await employee.rpc("search_staff", { p_query: PLATE_DUE });
    const vehicleHit = rows<SearchRowShape>(byPlate.data).find((r) => r.kind === "vehicle" && r.id === V_DUE);
    expect(vehicleHit).toBeDefined();
    expect(vehicleHit?.vehicle_name).toBe(VEHICLE_DUE_NAME);
    expect(vehicleHit?.vehicle_category).toBe("cargo_van");
    // Vehicle rows carry no reservation fields — the union row's null half.
    expect(vehicleHit?.reference).toBeNull();
    expect(vehicleHit?.customer_name).toBeNull();
    expect(vehicleHit?.pickup_date).toBeNull();
    expect(vehicleHit?.return_date).toBeNull();
  });

  it("reports a withdrawn vehicle as inactive", async () => {
    const employee = await as("employee");
    const res = await employee.rpc("search_staff", { p_query: TOKEN });
    const hits = rows<SearchRowShape>(res.data).filter((r) => r.kind === "vehicle");
    expect(hits.find((r) => r.id === V_PENDING)?.status).toBe("inactive");
    expect(hits.find((r) => r.id === V_DUE)?.status).toBe("active");
  });

  // -------------------------------------------------------------------------
  // 2. Returns classification — issued+confirmed only, due vs returned derived.
  // -------------------------------------------------------------------------
  it("surfaces issued returns in BOTH states: still-due and already-returned", async () => {
    const employee = await as("employee");
    const res = await employee.rpc("search_staff", { p_query: TOKEN });
    const returns = rows<SearchRowShape>(res.data).filter((r) => r.kind === "return");

    expect(returns.find((r) => r.id === R_DUE)?.status).toBe("due");
    expect(returns.find((r) => r.id === R_RETURNED)?.status).toBe("returned");
  });

  it("excludes never-issued and non-confirmed reservations from the returns group", async () => {
    const employee = await as("employee");
    const res = await employee.rpc("search_staff", { p_query: TOKEN });
    const all = rows<SearchRowShape>(res.data);
    const returnIds = all.filter((r) => r.kind === "return").map((r) => r.id);
    const reservationIds = all.filter((r) => r.kind === "reservation").map((r) => r.id);

    // Pending: matched as a reservation, but a rental that never started has
    // nothing to return.
    expect(reservationIds).toContain(R_PENDING);
    expect(returnIds).not.toContain(R_PENDING);
  });

  it("excludes a confirmed past-due reservation that was never issued", async () => {
    const employee = await as("employee");
    const res = await employee.rpc("search_staff", { p_query: PLATE_NO_ISSUE });
    const all = rows<SearchRowShape>(res.data);
    expect(all.filter((r) => r.kind === "reservation").map((r) => r.id)).toContain(R_NO_ISSUE);
    expect(all.filter((r) => r.kind === "return").map((r) => r.id)).not.toContain(R_NO_ISSUE);
  });

  // -------------------------------------------------------------------------
  // 3. Authz — the in-RPC role gate and the EXECUTE revoke.
  // -------------------------------------------------------------------------
  it("returns zero rows for a role-null authenticated caller (the in-RPC gate)", async () => {
    const norole = await as("norole");
    const res = await norole.rpc("search_staff", { p_query: TOKEN });
    expect(res.error).toBeNull();
    expect(rows<SearchRowShape>(res.data)).toHaveLength(0);
  });

  it("anon cannot execute search_staff at all (the revoke, not just the gate)", async () => {
    const res = await anonClient().rpc("search_staff", { p_query: TOKEN });
    expect(res.error).not.toBeNull();
  });

  it("an admin sees the same rows as an employee", async () => {
    const [employee, admin] = [await as("employee"), await as("admin")];
    const forEmployee = rows<SearchRowShape>((await employee.rpc("search_staff", { p_query: TOKEN })).data);
    const forAdmin = rows<SearchRowShape>((await admin.rpc("search_staff", { p_query: TOKEN })).data);
    expect(forAdmin.map((r) => `${r.kind}:${r.id}`).sort()).toEqual(forEmployee.map((r) => `${r.kind}:${r.id}`).sort());
  });

  // -------------------------------------------------------------------------
  // 4. Input handling — short queries, ILIKE metacharacters, the per-group cap.
  // -------------------------------------------------------------------------
  it("returns nothing for a query shorter than two characters", async () => {
    const employee = await as("employee");
    for (const q of ["", " ", "k", "  a "]) {
      const res = await employee.rpc("search_staff", { p_query: q });
      expect(res.error).toBeNull();
      expect(rows<SearchRowShape>(res.data)).toHaveLength(0);
    }
  });

  it("escapes ILIKE metacharacters instead of widening the match", async () => {
    const employee = await as("employee");
    // Unescaped, '%%' would expand to '%%%' and match every row in every group.
    const res = await employee.rpc("search_staff", { p_query: "%%" });
    expect(res.error).toBeNull();
    expect(rows<SearchRowShape>(res.data)).toHaveLength(0);

    // '_' is the single-character wildcard: unescaped, 'K_zy' would match 'Krzy'.
    const underscore = await employee.rpc("search_staff", { p_query: "K_zy" });
    expect(rows<SearchRowShape>(underscore.data)).toHaveLength(0);
  });

  it("caps each group at 8 rows", async () => {
    const employee = await as("employee");
    const res = await employee.rpc("search_staff", { p_query: CAP_TOKEN });
    const vehicles = rows<SearchRowShape>(res.data).filter((r) => r.kind === "vehicle");
    // Nine vehicles carry the token; the RPC returns the first eight.
    expect(vehicles).toHaveLength(8);
  });

  // -------------------------------------------------------------------------
  // 5. GET /api/search — the endpoint's own gate and grouped response shape.
  // -------------------------------------------------------------------------
  it("returns grouped JSON for a staff caller", async () => {
    const context = await asContext("employee", { method: "GET", path: `/api/search?q=${encodeURIComponent(TOKEN)}` });
    const response = await searchGET(context);
    expect(response.status).toBe(200);

    const body = (await response.json()) as GroupedResults;
    expect(body.reservations.map((r) => r.id)).toContain(R_DUE);
    expect(body.returns.map((r) => r.id)).toContain(R_DUE);
    expect(body.returns.find((r) => r.id === R_RETURNED)?.status).toBe("returned");
    expect(body.vehicles.map((v) => v.id)).toContain(V_DUE);
    expect(body.vehicles.find((v) => v.id === V_PENDING)?.is_active).toBe(false);
  });

  it("rejects an anonymous caller with 401 before any DB work", async () => {
    const context = anonContext({ method: "GET", path: `/api/search?q=${TOKEN}` });
    const response = await searchGET(context);
    expect(response.status).toBe(401);
  });

  it("rejects a logged-in role-null caller with 403", async () => {
    const context = await asContext("norole", { method: "GET", path: `/api/search?q=${TOKEN}` });
    const response = await searchGET(context);
    expect(response.status).toBe(403);
  });

  it("answers a blank or too-short query with empty groups, not an error", async () => {
    for (const q of ["", "k", "%20"]) {
      const context = await asContext("employee", { method: "GET", path: `/api/search?q=${q}` });
      const response = await searchGET(context);
      expect(response.status).toBe(200);
      expect((await response.json()) as GroupedResults).toEqual({ reservations: [], returns: [], vehicles: [] });
    }
  });
});
