// core
import { afterEach, beforeEach, describe, expect, it } from "vitest";

// others
import { anonClient, as, serviceClient } from "../helpers/clients";

// Issue-protocol data-layer suite (S-05 Phase 1). Proves the four invariants the
// plan calls load-bearing:
//
//   1. GRANTS — a role-null authenticated caller reads ZERO rows from all five
//      new tables. This is the `reservations` PII leak
//      (context/archive/2026-06-27-testing-data-layer-integrity/finding-rls-pii-leak.md)
//      closed prospectively: `protocols` carries customer PII *and* damage
//      photos, so every verb is revoked and no policy is ever written.
//   2. RPC AUTHZ — `anon` cannot execute any of the five RPCs. Note this needs an
//      explicit REVOKE: Postgres grants EXECUTE to PUBLIC by default and Supabase
//      adds an explicit `anon` grant, so `grant execute ... to authenticated`
//      alone leaves the RPC callable by anon (its in-RPC role gate still holds).
//   3. IDEMPOTENCY — a second `create_protocol` on one reservation returns a
//      clean `conflict` tag (carrying the existing protocol's id), not a 500.
//      The `unique (reservation_id)` constraint is the backstop, not the check.
//   4. STATE GUARD — `create_protocol` on a non-confirmed reservation is
//      `not_confirmed`.
//
// SERVICE-ROLE ISOLATION: every access assertion runs on `anonClient()` /
// `as(role)` (anon key + a real JWT, subject to RLS). `serviceClient()` appears
// only in setup/teardown, never in an assertion — routing an access assertion
// through it would make a leak test pass falsely.

const svc = serviceClient();

// The test client is built without generated DB types, so `.rpc()` / `.from()`
// results are `any`; these shapes type the payloads we assert against.
interface CreateRow {
  result: string;
  protocol_id: string | null;
}
interface PdfRow {
  result: string;
}
interface DamageRow {
  location: string;
}

/** Cast an untyped supabase-js result to a row list, treating a denial as zero rows. */
function rows<T>(data: unknown): T[] {
  return (data as T[] | null) ?? [];
}

// Seeded fixtures (supabase/seed.sql).
const CONFIRMED_RESERVATION = "aaaaaaaa-0000-0000-0000-000000000001"; // Jan Kowalski, confirmed
const PENDING_RESERVATION = "aaaaaaaa-0000-0000-0000-000000000003"; // Piotr Wiśniewski, pending
const UNKNOWN_RESERVATION = "aaaaaaaa-0000-0000-0000-0000000000ff";

// Client-minted ids (see the plan's §4: the bytes must already sit at their final
// storage key by the time the RPC records the path, so the id cannot be minted
// inside the RPC).
const PROTOCOL_ID = "dddddddd-0000-0000-0000-000000000001";
const OTHER_PROTOCOL_ID = "dddddddd-0000-0000-0000-000000000002";
const DAMAGE_ID = "eeeeeeee-0000-0000-0000-000000000001";

// The full Polish diacritic set rides every fixture on an encoding-sensitive
// path, per lessons.md — a damage note is exactly such a path (it reaches the PDF).
const DAMAGE_LOCATION = "lewy tylny błotnik — zażółć gęślą jaźń";

const ALL_TABLES = ["protocols", "protocol_photos", "protocol_damages", "protocol_damage_photos", "email_deliveries"];

function protocolArgs(overrides: Record<string, unknown> = {}) {
  return {
    p_id: PROTOCOL_ID,
    p_reservation_id: CONFIRMED_RESERVATION,
    p_odometer_km: 124_500,
    p_fuel_eighths: 6,
    p_signed_at: new Date("2026-07-10T12:08:00Z").toISOString(),
    p_customer_ack: true,
    p_signature: `issue/${PROTOCOL_ID}/signature.png`,
    p_photos: [
      { slot: "front", path: `issue/${PROTOCOL_ID}/photo-front.jpg` },
      { slot: "rear", path: `issue/${PROTOCOL_ID}/photo-rear.jpg` },
      { slot: "left", path: `issue/${PROTOCOL_ID}/photo-left.jpg` },
      { slot: "right", path: `issue/${PROTOCOL_ID}/photo-right.jpg` },
      { slot: "interior", path: `issue/${PROTOCOL_ID}/photo-interior.jpg` },
      { slot: "dashboard", path: `issue/${PROTOCOL_ID}/photo-dashboard.jpg` },
    ],
    p_damages: [
      {
        id: DAMAGE_ID,
        type: "scratch",
        location: DAMAGE_LOCATION,
        size: "15 cm",
        photos: [`issue/${PROTOCOL_ID}/damage-${DAMAGE_ID}-1.jpg`],
      },
    ],
    ...overrides,
  };
}

const deliveryArgs = {
  p_entity_type: "protocol",
  p_entity_id: PROTOCOL_ID,
  p_template: "protocol_issued",
  p_recipient: "jan.kowalski@example.com",
  p_status: "sent",
  p_error: null,
};

// FK is `on delete cascade` from protocols -> photos/damages -> damage photos,
// so dropping the protocol rows clears four of the five tables.
async function clearProtocols() {
  await svc.from("protocols").delete().in("id", [PROTOCOL_ID, OTHER_PROTOCOL_ID]);
  await svc.from("email_deliveries").delete().eq("entity_type", "protocol");
}

beforeEach(clearProtocols);
afterEach(clearProtocols);

describe("issue protocol data layer (S-05 Phase 1)", () => {
  // -------------------------------------------------------------------------
  // 3. Idempotency + 4. state guard
  // -------------------------------------------------------------------------
  describe("create_protocol idempotency + state guard", () => {
    it("commits a protocol on a confirmed reservation", async () => {
      const employee = await as("employee");
      const res = await employee.rpc("create_protocol", protocolArgs());

      expect(res.error).toBeNull();
      expect(rows<CreateRow>(res.data)).toEqual([{ result: "ok", protocol_id: PROTOCOL_ID }]);
    });

    it("returns `conflict` (not a 500) on a second submit, carrying the existing protocol id", async () => {
      const employee = await as("employee");
      await employee.rpc("create_protocol", protocolArgs());

      // A different client-minted id, same reservation — exactly what two
      // employees tapping simultaneously produce.
      const res = await employee.rpc("create_protocol", protocolArgs({ p_id: OTHER_PROTOCOL_ID }));

      expect(res.error).toBeNull();
      expect(rows<CreateRow>(res.data)).toEqual([{ result: "conflict", protocol_id: PROTOCOL_ID }]);

      // Exactly one protocol survived.
      const survivors = await svc.from("protocols").select("id").eq("reservation_id", CONFIRMED_RESERVATION);
      expect(rows(survivors.data)).toHaveLength(1);
    });

    it("returns `not_confirmed` on a pending reservation", async () => {
      const employee = await as("employee");
      const res = await employee.rpc("create_protocol", protocolArgs({ p_reservation_id: PENDING_RESERVATION }));

      expect(res.error).toBeNull();
      expect(rows<CreateRow>(res.data)).toEqual([{ result: "not_confirmed", protocol_id: null }]);
    });

    it("returns `not_found` for an unknown reservation", async () => {
      const employee = await as("employee");
      const res = await employee.rpc("create_protocol", protocolArgs({ p_reservation_id: UNKNOWN_RESERVATION }));

      expect(rows<CreateRow>(res.data)).toEqual([{ result: "not_found", protocol_id: null }]);
    });

    it("writes the photos and damages, keeping the damage location's diacritics intact", async () => {
      const employee = await as("employee");
      await employee.rpc("create_protocol", protocolArgs());

      const photos = await svc.from("protocol_photos").select("slot").eq("protocol_id", PROTOCOL_ID);
      expect(rows(photos.data)).toHaveLength(6);

      const damages = await svc.from("protocol_damages").select("*").eq("protocol_id", PROTOCOL_ID);
      const damageRows = rows<DamageRow>(damages.data);
      expect(damageRows).toHaveLength(1);
      expect(damageRows[0].location).toBe(DAMAGE_LOCATION);

      const damagePhotos = await svc.from("protocol_damage_photos").select("path").eq("damage_id", DAMAGE_ID);
      expect(rows(damagePhotos.data)).toHaveLength(1);
    });

    it("fails closed for a role-null authenticated caller", async () => {
      const norole = await as("norole");
      const res = await norole.rpc("create_protocol", protocolArgs());

      expect(rows<CreateRow>(res.data)).toEqual([{ result: "unauthorized", protocol_id: null }]);

      const written = await svc.from("protocols").select("id").eq("id", PROTOCOL_ID);
      expect(rows(written.data)).toHaveLength(0);
    });
  });

  // -------------------------------------------------------------------------
  // 1. Grants — the leak this slice must not repeat
  // -------------------------------------------------------------------------
  describe("a role-null authenticated caller reads zero rows from every new table", () => {
    beforeEach(async () => {
      // Populate all five tables through the real (staff) path, so a passing
      // assertion below means "denied", never "nothing to read".
      const employee = await as("employee");
      await employee.rpc("create_protocol", protocolArgs());
      await employee.rpc("record_email_delivery", deliveryArgs);

      // Guard the guard: if the fixture did not land, the denial assertions
      // below would pass vacuously.
      const seeded = await svc.from("email_deliveries").select("id").eq("entity_id", PROTOCOL_ID);
      expect(rows(seeded.data)).toHaveLength(1);
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
  // 2. RPC authz — anon reaches none of the five
  // -------------------------------------------------------------------------
  describe("anon cannot execute any of the five RPCs", () => {
    it("create_protocol", async () => {
      const res = await anonClient().rpc("create_protocol", protocolArgs());
      expect(res.error).not.toBeNull();
    });

    it("list_dispatch_today", async () => {
      const res = await anonClient().rpc("list_dispatch_today");
      expect(res.error).not.toBeNull();
    });

    it("get_protocol", async () => {
      const res = await anonClient().rpc("get_protocol", { p_id: PROTOCOL_ID });
      expect(res.error).not.toBeNull();
    });

    it("set_protocol_pdf", async () => {
      const res = await anonClient().rpc("set_protocol_pdf", {
        p_id: PROTOCOL_ID,
        p_path: `issue/${PROTOCOL_ID}/protocol.pdf`,
      });
      expect(res.error).not.toBeNull();
    });

    it("record_email_delivery", async () => {
      const res = await anonClient().rpc("record_email_delivery", { ...deliveryArgs, p_recipient: "a@example.com" });
      expect(res.error).not.toBeNull();
    });
  });

  // -------------------------------------------------------------------------
  // The read/write RPCs fail closed on a null role too — not merely because the
  // tables are unreadable.
  // -------------------------------------------------------------------------
  describe("RPCs fail closed on a null role", () => {
    it("get_protocol returns zero rows", async () => {
      const employee = await as("employee");
      await employee.rpc("create_protocol", protocolArgs());

      const norole = await as("norole");
      const res = await norole.rpc("get_protocol", { p_id: PROTOCOL_ID });
      expect(rows(res.data)).toHaveLength(0);
    });

    it("list_dispatch_today returns zero rows", async () => {
      const norole = await as("norole");
      const res = await norole.rpc("list_dispatch_today");
      expect(rows(res.data)).toHaveLength(0);
    });

    it("set_protocol_pdf is unauthorized and writes nothing", async () => {
      const employee = await as("employee");
      await employee.rpc("create_protocol", protocolArgs());

      const norole = await as("norole");
      const res = await norole.rpc("set_protocol_pdf", {
        p_id: PROTOCOL_ID,
        p_path: `issue/${PROTOCOL_ID}/protocol.pdf`,
      });
      expect(rows<PdfRow>(res.data)).toEqual([{ result: "unauthorized" }]);

      const stored = await svc.from("protocols").select("pdf_path").eq("id", PROTOCOL_ID);
      expect(rows<{ pdf_path: string | null }>(stored.data)[0].pdf_path).toBeNull();
    });

    it("record_email_delivery records nothing for a null role", async () => {
      const norole = await as("norole");
      await norole.rpc("record_email_delivery", { ...deliveryArgs, p_recipient: "attacker@example.com" });

      const written = await svc.from("email_deliveries").select("id").eq("entity_id", PROTOCOL_ID);
      expect(rows(written.data)).toHaveLength(0);
    });
  });
});
