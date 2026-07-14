// core
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

// others
import { anonClient, as, serviceClient } from "../helpers/clients";

// Dispatch-list fold suite (S-05 Phase 6). Proves the one behaviour the recovery
// surfaces depend on: `list_dispatch_today` KEEPS issued rows (it must never
// filter on `p.id is null`, or a failed-email protocol becomes unreachable) and
// folds each row's `protocol_id`, `pdf_path` and NEWEST `email_deliveries` status
// in, while an un-issued reservation comes back with `protocol_id` null.
//
// Disposable data scope, mirroring reservations-overlap: two dedicated vehicles
// on their own reservations dated TODAY (the RPC filters `pickup_date =
// current_date`), so no seed row is touched. Every list assertion runs on
// `as("employee")` under RLS; `serviceClient()` only seeds/tears down.

const svc = serviceClient();

// Ids outside the seeded fleet so resets/reruns are reproducible.
const V_ISSUED = "dddddddd-0000-0000-0000-0000000000e1";
const V_UNISSUED = "dddddddd-0000-0000-0000-0000000000e2";
const R_ISSUED = "aaaaaaaa-0000-0000-0000-0000000000e1";
const R_UNISSUED = "aaaaaaaa-0000-0000-0000-0000000000e2";
const P_ID = "dddddddd-0000-0000-0000-0000000000f1";
const DAMAGE_ID = "eeeeeeee-0000-0000-0000-0000000000f1";
const PDF_PATH = `issue/${P_ID}/protocol.pdf`;

// The RPC keys off the DB's `current_date`; the local Postgres and this process
// share a clock, so JS local "today" matches it.
function isoDate(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
const now = new Date();
const TODAY = isoDate(now);
const RETURN = isoDate(new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000));

interface DispatchRow {
  reservation_id: string;
  protocol_id: string | null;
  pdf_path: string | null;
  delivery_status: string | null;
}

function rows<T>(data: unknown): T[] {
  return (data as T[] | null) ?? [];
}

function protocolArgs() {
  return {
    p_id: P_ID,
    p_reservation_id: R_ISSUED,
    p_odometer_km: 90_000,
    p_fuel_eighths: 5,
    p_signed_at: new Date("2026-07-14T12:08:00Z").toISOString(),
    p_customer_ack: true,
    p_signature: `issue/${P_ID}/signature.png`,
    p_photos: [
      { slot: "front", path: `issue/${P_ID}/photo-front.jpg` },
      { slot: "rear", path: `issue/${P_ID}/photo-rear.jpg` },
      { slot: "left", path: `issue/${P_ID}/photo-left.jpg` },
      { slot: "right", path: `issue/${P_ID}/photo-right.jpg` },
      { slot: "interior", path: `issue/${P_ID}/photo-interior.jpg` },
      { slot: "dashboard", path: `issue/${P_ID}/photo-dashboard.jpg` },
    ],
    p_damages: [
      { id: DAMAGE_ID, type: "scratch", location: "lewy błotnik — zażółć gęślą jaźń", size: "10 cm", photos: [] },
    ],
  };
}

async function clearProtocols() {
  await svc.from("protocols").delete().eq("id", P_ID);
  await svc.from("email_deliveries").delete().eq("entity_id", P_ID);
}

async function clearScope() {
  await clearProtocols();
  await svc.from("reservations").delete().in("id", [R_ISSUED, R_UNISSUED]);
  await svc.from("vehicles").delete().in("id", [V_ISSUED, V_UNISSUED]);
}

beforeAll(async () => {
  await clearScope();

  const vehicle = (id: string, plate: string) => ({
    id,
    name: "Dispatch Harness Vehicle",
    plate,
    category: "cargo_van" as const,
    daily_rate: 100,
    monthly_rate: 2000,
    deposit: 500,
    per_extra_km_rate: 1,
    is_active: true,
  });
  const vErr = await svc.from("vehicles").insert([vehicle(V_ISSUED, "ZZ DISP01"), vehicle(V_UNISSUED, "ZZ DISP02")]);
  if (vErr.error) throw vErr.error;

  const reservation = (id: string, vehicleId: string, ref: string, token: string) => ({
    id,
    vehicle_id: vehicleId,
    customer_name: "Dispatch Test",
    customer_email: "dispatch.test@example.com",
    customer_phone: "+48600000000",
    pickup_date: TODAY,
    return_date: RETURN,
    status: "confirmed" as const,
    reference: ref,
    access_token: token,
  });
  const rErr = await svc
    .from("reservations")
    .insert([
      reservation(R_ISSUED, V_ISSUED, "R-DISP1", "dddddddd-0000-0000-0000-0000000000a1"),
      reservation(R_UNISSUED, V_UNISSUED, "R-DISP2", "dddddddd-0000-0000-0000-0000000000a2"),
    ]);
  if (rErr.error) throw rErr.error;
});

beforeEach(clearProtocols);
afterEach(clearProtocols);
afterAll(clearScope);

describe("list_dispatch_today fold (S-05 Phase 6)", () => {
  it("returns an un-issued confirmed reservation with protocol_id null", async () => {
    const employee = await as("employee");
    const res = await employee.rpc("list_dispatch_today");
    expect(res.error).toBeNull();

    const row = rows<DispatchRow>(res.data).find((r) => r.reservation_id === R_UNISSUED);
    expect(row).toBeDefined();
    expect(row?.protocol_id).toBeNull();
    expect(row?.pdf_path).toBeNull();
    expect(row?.delivery_status).toBeNull();
  });

  it("folds protocol_id, pdf_path and the NEWEST delivery status into an issued row", async () => {
    const employee = await as("employee");

    // Commit the protocol, store its PDF path, then record two deliveries — a
    // `failed` followed by a `sent`. Separate RPC calls are separate transactions,
    // so `now()` is strictly increasing and `sent` is unambiguously newest.
    expect((await employee.rpc("create_protocol", protocolArgs())).error).toBeNull();
    expect((await employee.rpc("set_protocol_pdf", { p_id: P_ID, p_path: PDF_PATH })).error).toBeNull();
    for (const status of ["failed", "sent"]) {
      await employee.rpc("record_email_delivery", {
        p_entity_type: "protocol",
        p_entity_id: P_ID,
        p_template: "protocol_issued",
        p_recipient: "dispatch.test@example.com",
        p_status: status,
        p_error: status === "failed" ? "provider 503" : null,
      });
    }

    const res = await employee.rpc("list_dispatch_today");
    expect(res.error).toBeNull();

    const row = rows<DispatchRow>(res.data).find((r) => r.reservation_id === R_ISSUED);
    expect(row).toBeDefined();
    expect(row?.protocol_id).toBe(P_ID);
    expect(row?.pdf_path).toBe(PDF_PATH);
    // The lateral join must surface the newest row, not the first.
    expect(row?.delivery_status).toBe("sent");
  });

  it("is empty for anon and a role-null caller (the RPC self-gates)", async () => {
    expect((await anonClient().rpc("list_dispatch_today")).error).not.toBeNull();

    const norole = await as("norole");
    const noroleRes = await norole.rpc("list_dispatch_today");
    expect(rows(noroleRes.data)).toHaveLength(0);
  });
});
