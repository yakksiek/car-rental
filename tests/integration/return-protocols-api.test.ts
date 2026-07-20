// core
import { afterEach, beforeEach, describe, expect, it } from "vitest";

// others
import { POST as returnCreatePOST } from "../../src/pages/api/return-protocols";
import { POST as returnPdfPOST } from "../../src/pages/api/return-protocols/[id]/pdf";
import { POST as returnResendPOST } from "../../src/pages/api/return-protocols/[id]/resend-email";
import { as, serviceClient } from "../helpers/clients";
import { asContext } from "../helpers/context";
import { captureEmails, failEmails, restoreEmailAdapter } from "../helpers/email";

// Return-protocol API behaviour (S-06 Phase 4). The authz matrix for these three
// routes is extended in api-authz.test.ts (Phase 7); this suite proves the
// contracts that make the return slice recoverable, mirroring protocols-api.test.ts:
//
//   • COMMIT-THEN-EMAIL — `POST /api/return-protocols` sends nothing and writes no
//     delivery row. The PDF (with the comparison section) does not exist yet.
//   • IDEMPOTENCY — a second submit is a 409 carrying the EXISTING return id.
//   • NO BASELINE — a reservation with no issue protocol is a 409 `no_baseline`
//     (a return may never stand without an issue baseline).
//   • FAILURE IS VISIBLE, NOT FATAL — a finalize whose adapter throws still
//     returns 200 and writes a `failed` row. The vehicle physically came back.
//   • THE RETURN TEMPLATE — the finalize send carries the "protokół zwrotu"
//     subject and a `protocol_returned` delivery row, proving `resendProtocolEmail`
//     picked the return template + comparison deltas off the row's `type`.
//
// The email adapter is swapped via `setEmailAdapter` (tests/helpers/email.ts): the
// send is server-side, so there is nothing on the wire to intercept.
//
// SERVICE-ROLE ISOLATION: `serviceClient()` appears only in setup/teardown and in
// reading back what a route wrote. Every route call runs through `asContext`.

const svc = serviceClient();

// Seeded baseline (supabase/seed.sql): the demo issue protocol sits on R-0002
// (Anna Nowak, confirmed, past return), NOT R-0001 — R-0001 is the S-05 suites'
// fixture and a seeded issue row there would collide on unique (reservation, type).
const BASELINE_RESERVATION = "aaaaaaaa-0000-0000-0000-000000000002";
const CUSTOMER_EMAIL = "anna.nowak@example.com";
// The seed baseline lives in the `d6…` id namespace, disjoint from every test's
// `dddddddd…` fixtures (so protocols-rls's cleanup never deletes it).
const BASELINE_PROTOCOL_ID = "d6000000-0000-0000-0000-000000000001";
const BASELINE_DAMAGE_ID = "dd000000-0000-0000-0000-0000000000d1";

// A confirmed reservation with NO issue protocol (R-0001, once the baseline moved
// off it) — the `no_baseline` precondition case.
const NO_BASELINE_RESERVATION = "aaaaaaaa-0000-0000-0000-000000000001";

// Client-minted (crypto.randomUUID in production). The `…a6/b6/c6` tails are
// distinct from every other suite's protocol ids — notably dispatch-list's
// `…f1` — so cleanup stays independent under serial execution.
const RETURN_PROTOCOL_ID = "dddddddd-0000-0000-0000-0000000000a6";
const OTHER_RETURN_ID = "dddddddd-0000-0000-0000-0000000000b6";
const UNKNOWN_RETURN_ID = "dddddddd-0000-0000-0000-0000000000c6";
const DAMAGE_ID = "eeeeeeee-0000-0000-0000-0000000000a6";

const BUCKET = "protocols";
const PDF_PATH = `return/${RETURN_PROTOCOL_ID}/protocol.pdf`;

// Every fixture on an encoding-sensitive path carries the full diacritic set
// (lessons.md) — a damage note reaches the PDF and the email subject.
const DAMAGE_LOCATION = "prawy przedni błotnik — zażółć gęślą jaźń";

/** Six `return/`-prefixed photo paths under the given protocol's folder. */
function photos(protocolId: string) {
  return {
    front: `return/${protocolId}/photo-front.jpg`,
    rear: `return/${protocolId}/photo-rear.jpg`,
    left: `return/${protocolId}/photo-left.jpg`,
    right: `return/${protocolId}/photo-right.jpg`,
    interior: `return/${protocolId}/photo-interior.jpg`,
    dashboard: `return/${protocolId}/photo-dashboard.jpg`,
  };
}

function body(overrides: Record<string, unknown> = {}) {
  return {
    protocolId: RETURN_PROTOCOL_ID,
    reservationId: BASELINE_RESERVATION,
    baselineProtocolId: BASELINE_PROTOCOL_ID,
    // Baseline odometer 42000 → 42850 = 850 km; fuel 8/8 → 4/8 = −4 (adverse).
    odometerKm: "42850",
    fuelEighths: 4,
    customerAck: true,
    signedAt: new Date("2026-07-17T10:08:00Z").toISOString(),
    signaturePath: `return/${RETURN_PROTOCOL_ID}/signature.png`,
    photos: photos(RETURN_PROTOCOL_ID),
    damages: [
      {
        id: DAMAGE_ID,
        type: "scratch",
        location: DAMAGE_LOCATION,
        size: "15 cm",
        // Links to the seeded baseline scratch — an EXISTING damage, so newDamageCount is 0.
        baselineDamageId: BASELINE_DAMAGE_ID,
        photos: [`return/${RETURN_PROTOCOL_ID}/damage-${DAMAGE_ID}-1.jpg`],
      },
    ],
    ...overrides,
  };
}

/** `POST /api/return-protocols` as a real employee. */
async function submit(payload: unknown = body()) {
  return returnCreatePOST(
    await asContext("employee", { method: "POST", path: "/api/return-protocols", body: payload }),
  );
}

/** `POST /api/return-protocols/[id]/pdf` as a real employee. */
async function finalize(id = RETURN_PROTOCOL_ID, path = PDF_PATH) {
  return returnPdfPOST(
    await asContext("employee", {
      method: "POST",
      path: `/api/return-protocols/${id}/pdf`,
      params: { id },
      body: { path },
    }),
  );
}

/** `POST /api/return-protocols/[id]/resend-email` as a real employee. */
async function resend(id = RETURN_PROTOCOL_ID) {
  return returnResendPOST(
    await asContext("employee", { method: "POST", path: `/api/return-protocols/${id}/resend-email`, params: { id } }),
  );
}

/**
 * Put a real object at `pdf_path` through the employee's own JWT, so the
 * `return/`-prefixed `storage.objects` RLS is exercised exactly as the browser
 * exercises it. Without it `createSignedUrl` has nothing to sign and the send
 * degrades to `failed` for the wrong reason. `upsert` because staff have no DELETE
 * policy: the protocol is dispute evidence, append-only at the storage layer.
 */
async function uploadPdf() {
  const employee = await as("employee");
  const { error } = await employee.storage
    .from(BUCKET)
    .upload(PDF_PATH, new Blob([new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d])], { type: "application/pdf" }), {
      contentType: "application/pdf",
      upsert: true,
    });
  if (error) throw error;
}

async function clearReturns() {
  // Only the return rows this suite mints — NEVER the seeded issue baseline
  // (dddddddd-…001), which every create depends on. FK cascade clears the return's
  // photos and damages.
  await svc.from("protocols").delete().in("id", [RETURN_PROTOCOL_ID, OTHER_RETURN_ID]);
  await svc.from("email_deliveries").delete().in("entity_id", [RETURN_PROTOCOL_ID, OTHER_RETURN_ID]);
}

interface DeliveryRow {
  status: string;
  error: string | null;
  recipient: string;
  template: string;
}

function rows<T>(data: unknown): T[] {
  return (data as T[] | null) ?? [];
}

/** Delivery rows for this return, newest last. */
async function deliveries(): Promise<DeliveryRow[]> {
  const { data } = await svc
    .from("email_deliveries")
    .select("status, error, recipient, template")
    .eq("entity_id", RETURN_PROTOCOL_ID)
    .order("created_at", { ascending: true });
  return rows<DeliveryRow>(data);
}

/** The `pdf_path` the routes recorded, read back through service-role. */
async function storedPdfPath(): Promise<string | null> {
  const { data } = await svc.from("protocols").select("pdf_path").eq("id", RETURN_PROTOCOL_ID);
  return rows<{ pdf_path: string | null }>(data)[0]?.pdf_path ?? null;
}

beforeEach(async () => {
  await clearReturns();
  // Default to a capturing adapter so no test can accidentally hit the network,
  // and "no email was sent" is an assertion about a real array, not an absence.
  captureEmails();
});

afterEach(async () => {
  restoreEmailAdapter();
  await clearReturns();
});

describe("return protocol API (S-06 Phase 4)", () => {
  // -------------------------------------------------------------------------
  // Validation — the 400 body shape every island re-maps onto its inputs.
  // -------------------------------------------------------------------------
  describe("POST /api/return-protocols validation", () => {
    it("a malformed body → 400 with `{ errors: {...} }`", async () => {
      const res = await submit(body({ odometerKm: "", customerAck: false }));
      expect(res.status).toBe(400);

      const payload = (await res.json()) as { errors: Record<string, string> };
      expect(payload.errors.odometerKm).toBeTruthy();
      expect(payload.errors.customerAck).toBeTruthy();
    });

    it("a path outside `return/<protocolId>/` → 400 (one protocol cannot claim another's evidence)", async () => {
      const res = await submit(body({ signaturePath: `return/${OTHER_RETURN_ID}/signature.png` }));
      expect(res.status).toBe(400);

      const payload = (await res.json()) as { errors: Record<string, string> };
      expect(payload.errors.signaturePath).toBeTruthy();
    });

    it("an `issue/`-prefixed path → 400 (the return schema pins to `return/`)", async () => {
      const res = await submit(body({ signaturePath: `issue/${RETURN_PROTOCOL_ID}/signature.png` }));
      expect(res.status).toBe(400);

      const payload = (await res.json()) as { errors: Record<string, string> };
      expect(payload.errors.signaturePath).toBeTruthy();
    });

    it("a reservation with no issue protocol → 409 `no_baseline`, nothing written", async () => {
      const res = await submit(body({ reservationId: NO_BASELINE_RESERVATION }));
      expect(res.status).toBe(409);
      expect(await res.json()).toMatchObject({ status: "no_baseline" });
      expect(await storedPdfPath()).toBeNull();
    });
  });

  // -------------------------------------------------------------------------
  // Commit-then-email: the submit route sends nothing.
  // -------------------------------------------------------------------------
  describe("POST /api/return-protocols commits without emailing", () => {
    it("→ 201 with the return id, no message sent, no delivery row", async () => {
      const { messages } = captureEmails();

      const res = await submit();
      expect(res.status).toBe(201);
      expect(await res.json()).toEqual({ protocol_id: RETURN_PROTOCOL_ID });

      // The PDF does not exist yet — a send here would mail an empty attachment.
      expect(messages).toHaveLength(0);
      expect(await deliveries()).toHaveLength(0);
    });

    it("a second submit → 409 carrying the EXISTING return id", async () => {
      await submit();

      // A different client-minted id, same reservation: two employees tapping.
      const res = await submit(
        body({
          protocolId: OTHER_RETURN_ID,
          signaturePath: `return/${OTHER_RETURN_ID}/signature.png`,
          photos: photos(OTHER_RETURN_ID),
          damages: [],
        }),
      );

      expect(res.status).toBe(409);
      expect(await res.json()).toMatchObject({ status: "conflict", protocol_id: RETURN_PROTOCOL_ID });
    });
  });

  // -------------------------------------------------------------------------
  // Finalize: stores `pdf_path`, then sends the RETURN template. 200 either way.
  // -------------------------------------------------------------------------
  describe("POST /api/return-protocols/[id]/pdf", () => {
    beforeEach(async () => {
      await submit();
      await uploadPdf();
    });

    it("→ 200 `sent`, stores `pdf_path`, and mails the return template to the customer", async () => {
      const { messages } = captureEmails();

      const res = await finalize();
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ status: "ok", delivery: "sent" });

      expect(await storedPdfPath()).toBe(PDF_PATH);

      expect(messages).toHaveLength(1);
      const [message] = messages;
      expect(message.to).toBe(CUSTOMER_EMAIL);
      // A signed URL for THIS return's object — the customer receives the bytes.
      expect(message.attachments?.[0].path).toContain(PDF_PATH);
      expect(message.attachments?.[0].filename).toMatch(/\.pdf$/);
      // The RETURN template was selected off the row's `type` — the whole point of
      // the type-aware resend. Diacritics survive the send path.
      expect(message.subject).toContain("protokół zwrotu");

      const rows = await deliveries();
      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({ status: "sent", template: "protocol_returned", recipient: CUSTOMER_EMAIL });
    });

    it("a thrown send still → 200, with a `failed` delivery row carrying the error", async () => {
      failEmails("resend is down");

      const res = await finalize();
      // The vehicle came back. A provider outage is recorded, never fatal.
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ status: "ok", delivery: "failed" });

      const rows = await deliveries();
      expect(rows).toHaveLength(1);
      expect(rows[0].status).toBe("failed");
      expect(rows[0].error).toContain("resend is down");

      // The return still stands, with its PDF recorded — recoverable via resend.
      expect(await storedPdfPath()).toBe(PDF_PATH);
    });

    it("a path outside this protocol's folder → 400", async () => {
      const res = await finalize(RETURN_PROTOCOL_ID, `return/${OTHER_RETURN_ID}/protocol.pdf`);
      expect(res.status).toBe(400);
    });

    it("an unknown protocol → 404", async () => {
      const res = await finalize(UNKNOWN_RETURN_ID, `return/${UNKNOWN_RETURN_ID}/protocol.pdf`);
      expect(res.status).toBe(404);
    });
  });

  // -------------------------------------------------------------------------
  // Resend: append-only history, and a hard 409 when there is nothing to attach.
  // -------------------------------------------------------------------------
  describe("POST /api/return-protocols/[id]/resend-email", () => {
    it("a return with no `pdf_path` → 409 (regenerate, don't resend)", async () => {
      await submit();

      const res = await resend();
      expect(res.status).toBe(409);
      expect(await res.json()).toMatchObject({ status: "no_pdf" });
      expect(await deliveries()).toHaveLength(0);
    });

    it("a retry after a failure appends a second row rather than overwriting", async () => {
      await submit();
      await uploadPdf();

      failEmails("resend is down");
      await finalize();

      const { messages } = captureEmails();
      const res = await resend();
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ status: "ok", delivery: "sent" });
      expect(messages).toHaveLength(1);

      const rows = await deliveries();
      expect(rows.map((row) => row.status)).toEqual(["failed", "sent"]);
    });

    it("an unknown protocol → 404", async () => {
      const res = await resend(UNKNOWN_RETURN_ID);
      expect(res.status).toBe(404);
    });
  });
});
