// core
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

// others
import { GET as busyRangesGET } from "../../src/pages/api/vehicles/[id]/busy-ranges";
import { PATCH as decisionPATCH } from "../../src/pages/api/reservations/[id]";
import { POST as manualPOST } from "../../src/pages/api/reservations/manual";
import { serviceClient } from "../helpers/clients";
import { anonContext, asContext } from "../helpers/context";
import { captureEmails, restoreEmailAdapter } from "../helpers/email";

// Manual-reservation endpoint suite (S-12 Phase 2).
//
// Drives the REAL route handlers against local Supabase via the constructed-context
// helper; only the email TRANSPORT is a double (the send is server-side, so there
// is nothing on the wire to intercept). The `email_deliveries` recording path is
// entirely real — a row must land, or the confirmation is silent.
//
// The /api tree is outside middleware's gate, so the self-gate order
// (Origin → auth → role → zod → RPC) is asserted case by case: a regression that
// drops any one of them is a route anyone can reach.

const svc = serviceClient();

const VEHICLE_ID = "dddddddd-0000-0000-0000-0000000000f1";
// Client-minted id for the decision-regression fixture (see that test's note).
const PENDING_ID = "aaaaaaaa-0000-0000-0000-0000000000f1";

// Polish diacritics in the fixture: the name rides the confirmation email, and
// every encoding-sensitive path in this repo carries the full set (lessons.md).
const CUSTOMER = {
  customer_name: "Zażółć Gęślą Jaźń",
  customer_email: "manual.api@example.com",
  customer_phone: "+48600000124",
} as const;

// `locale` is the CUSTOMER's language, answered by the employee on the modal —
// the one field the public funnel has no equivalent of (the funnel takes it off
// the session). `pl` here matches the modal's own default and the fixture's
// Polish name.
function body(pickup: string, returnDate: string) {
  return { vehicle_id: VEHICLE_ID, pickup, return: returnDate, locale: "pl", ...CUSTOMER };
}

async function clearReservations() {
  const { data } = await svc.from("reservations").select("id").eq("vehicle_id", VEHICLE_ID);
  for (const row of data ?? []) {
    await svc.from("email_deliveries").delete().eq("entity_id", row.id);
  }
  const { error } = await svc.from("reservations").delete().eq("vehicle_id", VEHICLE_ID);
  if (error) throw error;
}

beforeAll(async () => {
  await clearReservations();
  await svc.from("vehicles").delete().eq("id", VEHICLE_ID);

  const { error } = await svc.from("vehicles").insert({
    id: VEHICLE_ID,
    name: "Manual API Harness Vehicle",
    plate: "ZZ MAN03",
    make: "Renault",
    model: "Master",
    production_year: 2024,
    category: "cargo_van",
    daily_rate: 100,
    monthly_rate: 2000,
    deposit: 500,
    per_extra_km_rate: 1,
    is_active: true,
  });
  if (error) throw error;
});

beforeEach(() => {
  captureEmails();
});

afterEach(async () => {
  restoreEmailAdapter();
  await clearReservations();
});

afterAll(async () => {
  await clearReservations();
  await svc.from("vehicles").delete().eq("id", VEHICLE_ID);
});

describe("POST /api/reservations/manual (S-12)", () => {
  it("staff create returns 201 {reference}, writes a confirmed manual row, and logs the confirmation", async () => {
    const { messages } = captureEmails();

    const res = await manualPOST(
      await asContext("employee", {
        method: "POST",
        path: "/api/reservations/manual",
        body: body("2032-04-01", "2032-04-10"),
      }),
    );
    expect(res.status).toBe(201);

    // Reference ONLY: the customer's secret access_token must not ride a staff
    // response nobody reads it from (asserted on the key set, so a re-added
    // field fails here rather than leaking quietly).
    const payload = (await res.json()) as { reference: string };
    expect(payload.reference).toMatch(/^R-[0-9A-Z]{4,}$/);
    expect(Object.keys(payload)).toEqual(["reference"]);

    const { data: row } = await svc
      .from("reservations")
      .select("id, status, source, customer_email")
      .eq("vehicle_id", VEHICLE_ID)
      .single();
    expect(row).toMatchObject({ status: "confirmed", source: "manual", customer_email: CUSTOMER.customer_email });

    // The recording path is real: a delivery row for THIS reservation, tagged
    // with the shared confirmed template.
    const { data: deliveries } = await svc
      .from("email_deliveries")
      .select("entity_type, template, recipient, status")
      .eq("entity_id", row?.id ?? "");
    expect(deliveries).toEqual([
      {
        entity_type: "reservation",
        template: "reservation_confirmed",
        recipient: CUSTOMER.customer_email,
        status: "sent",
      },
    ]);

    // And the message itself actually reached the transport.
    expect(messages).toHaveLength(1);
    expect(messages[0]?.to).toBe(CUSTOMER.customer_email);
  });

  it("an overlapping range is 409 {reason: 'conflict'} with no second row", async () => {
    const first = await manualPOST(
      await asContext("employee", {
        method: "POST",
        path: "/api/reservations/manual",
        body: body("2032-05-01", "2032-05-10"),
      }),
    );
    expect(first.status).toBe(201);

    const second = await manualPOST(
      await asContext("employee", {
        method: "POST",
        path: "/api/reservations/manual",
        body: body("2032-05-05", "2032-05-12"),
      }),
    );
    expect(second.status).toBe(409);
    expect(await second.json()).toMatchObject({ reason: "conflict" });

    const { count } = await svc
      .from("reservations")
      .select("id", { count: "exact", head: true })
      .eq("vehicle_id", VEHICLE_ID);
    expect(count).toBe(1);
  });

  it("a cross-origin POST is 403 before any work (CSRF)", async () => {
    const res = await manualPOST(
      await asContext("employee", {
        method: "POST",
        path: "/api/reservations/manual",
        body: body("2032-06-01", "2032-06-05"),
        origin: "https://evil.example",
      }),
    );
    expect(res.status).toBe(403);

    const { count } = await svc
      .from("reservations")
      .select("id", { count: "exact", head: true })
      .eq("vehicle_id", VEHICLE_ID);
    expect(count).toBe(0);
  });

  it("an unauthenticated caller is 401", async () => {
    const res = await manualPOST(
      anonContext({ method: "POST", path: "/api/reservations/manual", body: body("2032-06-01", "2032-06-05") }),
    );
    expect(res.status).toBe(401);
  });

  it("an authenticated non-staff caller is 403", async () => {
    const res = await manualPOST(
      await asContext("norole", {
        method: "POST",
        path: "/api/reservations/manual",
        body: body("2032-06-01", "2032-06-05"),
      }),
    );
    expect(res.status).toBe(403);
  });

  it("a missing e-mail and phone is 400 with per-field errors (D1: both required)", async () => {
    const res = await manualPOST(
      await asContext("employee", {
        method: "POST",
        path: "/api/reservations/manual",
        body: {
          vehicle_id: VEHICLE_ID,
          pickup: "2032-07-01",
          return: "2032-07-05",
          customer_name: "Tylko Nazwisko",
          locale: "pl",
        },
      }),
    );
    expect(res.status).toBe(400);

    const payload = (await res.json()) as { errors: Record<string, string> };
    expect(Object.keys(payload.errors).sort()).toEqual(["customer_email", "customer_phone"]);
  });

  it("rejects an unrecognised customer language rather than defaulting one", async () => {
    // The modal's control can only emit `en`/`pl`, so this is the crafted-payload
    // arm — and it must FAIL rather than fall back, because falling back would
    // silently pick what language a stranger is written to. The route is the
    // trust boundary; the RPC's own normalisation is the second line, not the first.
    const res = await manualPOST(
      await asContext("employee", {
        method: "POST",
        path: "/api/reservations/manual",
        body: { ...body("2032-08-01", "2032-08-05"), locale: "de" },
      }),
    );
    expect(res.status).toBe(400);

    const payload = (await res.json()) as { errors: Record<string, string> };
    expect(Object.keys(payload.errors)).toEqual(["locale"]);
  });
});

describe("GET /api/vehicles/[id]/busy-ranges (S-12a)", () => {
  function ctx(role: "employee" | "norole", id: string = VEHICLE_ID) {
    return asContext(role, { method: "GET", path: `/api/vehicles/${id}/busy-ranges`, params: { id } });
  }

  it("staff get the vehicle's blocking ranges — date bounds only, no PII", async () => {
    const empty = await busyRangesGET(await ctx("employee"));
    expect(empty.status).toBe(200);
    expect(await empty.json()).toEqual({ ranges: [] });

    const created = await manualPOST(
      await asContext("employee", {
        method: "POST",
        path: "/api/reservations/manual",
        body: body("2032-11-01", "2032-11-06"),
      }),
    );
    expect(created.status).toBe(201);

    const res = await busyRangesGET(await ctx("employee"));
    expect(res.status).toBe(200);

    const payload = (await res.json()) as { ranges: { pickup_date: string; return_date: string }[] };
    expect(payload.ranges).toEqual([{ pickup_date: "2032-11-01", return_date: "2032-11-06" }]);
    // The RPC is PII-safe by construction; asserted on the key set so a widened
    // return type fails here rather than leaking the customer quietly.
    expect(Object.keys(payload.ranges[0] ?? {}).sort()).toEqual(["pickup_date", "return_date"]);
  });

  it("an unauthenticated caller is 401 and a non-staff caller 403", async () => {
    const anon = await busyRangesGET(
      anonContext({
        method: "GET",
        path: `/api/vehicles/${VEHICLE_ID}/busy-ranges`,
        params: { id: VEHICLE_ID },
      }),
    );
    expect(anon.status).toBe(401);

    const norole = await busyRangesGET(await ctx("norole"));
    expect(norole.status).toBe(403);
  });

  it("a malformed vehicle id is 400, not a 500", async () => {
    const res = await busyRangesGET(await ctx("employee", "not-a-uuid"));
    expect(res.status).toBe(400);
  });
});

describe("PATCH /api/reservations/[id] confirmed email (regression through the extracted helper)", () => {
  it("approving a pending request still sends and records the confirmation", async () => {
    const { messages } = captureEmails();

    // A pending row on the harness vehicle, created directly so the test owns it.
    // The id is minted here rather than read back: the shared service client has
    // no `Database` generic, so a returned row would arrive as `any`.
    const { error } = await svc.from("reservations").insert({
      id: PENDING_ID,
      vehicle_id: VEHICLE_ID,
      customer_name: CUSTOMER.customer_name,
      customer_email: CUSTOMER.customer_email,
      customer_phone: CUSTOMER.customer_phone,
      pickup_date: "2032-10-01",
      return_date: "2032-10-05",
      status: "pending",
      reference: "R-MANUAL-REG",
    });
    if (error) throw error;

    const res = await decisionPATCH(
      await asContext("employee", {
        method: "PATCH",
        path: `/api/reservations/${PENDING_ID}`,
        params: { id: PENDING_ID },
        body: { decision: "confirm" },
      }),
    );
    expect(res.status).toBe(200);

    const { data: deliveries } = await svc
      .from("email_deliveries")
      .select("template, recipient, status")
      .eq("entity_id", PENDING_ID);
    expect(deliveries).toEqual([
      { template: "reservation_confirmed", recipient: CUSTOMER.customer_email, status: "sent" },
    ]);
    expect(messages).toHaveLength(1);
  });
});
