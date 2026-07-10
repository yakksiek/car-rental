// core
import { afterEach, beforeEach, describe, expect, it } from "vitest";

// others
import { POST as protocolCreatePOST } from "../../src/pages/api/protocols";
import { POST as protocolPdfPOST } from "../../src/pages/api/protocols/[id]/pdf";
import { POST as protocolResendPOST } from "../../src/pages/api/protocols/[id]/resend-email";
import { as, serviceClient } from "../helpers/clients";
import { asContext } from "../helpers/context";
import { captureEmails, failEmails, restoreEmailAdapter } from "../helpers/email";

// Issue-protocol API behaviour (S-05 Phase 3). The authz matrix for these three
// routes lives in api-authz.test.ts alongside its siblings; this suite proves the
// contracts that make the slice recoverable:
//
//   • COMMIT-THEN-EMAIL — `POST /api/protocols` sends nothing and writes no
//     delivery row. The PDF does not exist yet, so a send here would attach a
//     signed URL to a missing object and Resend (which fetches `path` server-side)
//     would deliver an empty mail while `email_deliveries` recorded `sent`.
//   • IDEMPOTENCY — a second submit is a 409 carrying the EXISTING protocol id,
//     so the conflict screen can link to it.
//   • FAILURE IS VISIBLE, NOT FATAL — a finalize call whose adapter throws still
//     returns 200 and writes a `failed` row. The vehicle physically changed hands;
//     a provider 503 must not read as a failed handover.
//   • THE ATTACHMENT IS REAL — the captured message carries a signed URL for that
//     protocol's own `pdf_path`.
//
// The email adapter is swapped via `setEmailAdapter` (tests/helpers/email.ts):
// the send is server-side, so there is nothing on the wire to intercept.
//
// SERVICE-ROLE ISOLATION: `serviceClient()` appears only in setup/teardown and in
// reading back what a route wrote. Every route call runs through `asContext`,
// which pairs a real JWT with matching `locals`.

const svc = serviceClient();

// Seeded fixture (supabase/seed.sql): Jan Kowalski, confirmed.
const CONFIRMED_RESERVATION = "aaaaaaaa-0000-0000-0000-000000000001";
const PENDING_RESERVATION = "aaaaaaaa-0000-0000-0000-000000000003";

// Client-minted (crypto.randomUUID in production): the ids key the storage
// objects, so they exist before the first byte is uploaded.
const PROTOCOL_ID = "dddddddd-0000-0000-0000-0000000000b1";
const OTHER_PROTOCOL_ID = "dddddddd-0000-0000-0000-0000000000b2";
const DAMAGE_ID = "eeeeeeee-0000-0000-0000-0000000000b1";
const UNKNOWN_PROTOCOL_ID = "dddddddd-0000-0000-0000-0000000000bf";

const BUCKET = "protocols";
const PDF_PATH = `issue/${PROTOCOL_ID}/protocol.pdf`;

// Every fixture on an encoding-sensitive path carries the full diacritic set
// (lessons.md) — a damage note reaches the PDF and the email subject.
const DAMAGE_LOCATION = "lewy tylny błotnik — zażółć gęślą jaźń";

function body(overrides: Record<string, unknown> = {}) {
  return {
    protocolId: PROTOCOL_ID,
    reservationId: CONFIRMED_RESERVATION,
    odometerKm: "124500",
    fuelEighths: 6,
    customerAck: true,
    signedAt: new Date("2026-07-10T12:08:00Z").toISOString(),
    signaturePath: `issue/${PROTOCOL_ID}/signature.png`,
    photos: {
      front: `issue/${PROTOCOL_ID}/photo-front.jpg`,
      rear: `issue/${PROTOCOL_ID}/photo-rear.jpg`,
      left: `issue/${PROTOCOL_ID}/photo-left.jpg`,
      right: `issue/${PROTOCOL_ID}/photo-right.jpg`,
      interior: `issue/${PROTOCOL_ID}/photo-interior.jpg`,
      dashboard: `issue/${PROTOCOL_ID}/photo-dashboard.jpg`,
    },
    damages: [
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

/** `POST /api/protocols` as a real employee. */
async function submit(payload: unknown = body()) {
  return protocolCreatePOST(await asContext("employee", { method: "POST", path: "/api/protocols", body: payload }));
}

/** `POST /api/protocols/[id]/pdf` as a real employee. */
async function finalize(id = PROTOCOL_ID, path = PDF_PATH) {
  return protocolPdfPOST(
    await asContext("employee", { method: "POST", path: `/api/protocols/${id}/pdf`, params: { id }, body: { path } }),
  );
}

/** `POST /api/protocols/[id]/resend-email` as a real employee. */
async function resend(id = PROTOCOL_ID) {
  return protocolResendPOST(
    await asContext("employee", { method: "POST", path: `/api/protocols/${id}/resend-email`, params: { id } }),
  );
}

/**
 * Put a real object at `pdf_path`. `createSignedUrl` signs an existing object —
 * without this the finalize route's send degrades to `failed` for the wrong
 * reason, and the throwing-adapter test would pass vacuously.
 *
 * Uploaded through the employee's own JWT, so `storage.objects` RLS is exercised
 * exactly as the browser exercises it. `upsert` because staff have no DELETE
 * policy: the protocol is dispute evidence, append-only at the storage layer.
 */
async function uploadPdf() {
  const employee = await as("employee");
  const { error } = await employee.storage
    .from(BUCKET)
    // The `type` must live on the Blob: storage-js reads it off the body, and the
    // bucket's `allowed_mime_types` rejects the default application/octet-stream.
    .upload(PDF_PATH, new Blob([new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d])], { type: "application/pdf" }), {
      contentType: "application/pdf",
      upsert: true,
    });
  if (error) throw error;
}

async function clearProtocols() {
  // FK cascade clears photos, damages and damage photos.
  await svc.from("protocols").delete().in("id", [PROTOCOL_ID, OTHER_PROTOCOL_ID]);
  await svc.from("email_deliveries").delete().eq("entity_type", "protocol");
}

// The test client is built without generated DB types, so `.from()` results are
// `any`; these shapes type what we assert against.
interface DeliveryRow {
  status: string;
  error: string | null;
  recipient: string;
  template: string;
}

/** Cast an untyped supabase-js result to a row list. */
function rows<T>(data: unknown): T[] {
  return (data as T[] | null) ?? [];
}

/** Delivery rows for this protocol, newest last. */
async function deliveries(): Promise<DeliveryRow[]> {
  const { data } = await svc
    .from("email_deliveries")
    .select("status, error, recipient, template")
    .eq("entity_id", PROTOCOL_ID)
    .order("created_at", { ascending: true });
  return rows<DeliveryRow>(data);
}

/** The `pdf_path` the routes recorded, read back through service-role. */
async function storedPdfPath(): Promise<string | null> {
  const { data } = await svc.from("protocols").select("pdf_path").eq("id", PROTOCOL_ID);
  return rows<{ pdf_path: string | null }>(data)[0]?.pdf_path ?? null;
}

beforeEach(async () => {
  await clearProtocols();
  // Default to a capturing adapter so no test can accidentally hit the network,
  // and "no email was sent" is an assertion about a real array, not an absence.
  captureEmails();
});

afterEach(async () => {
  restoreEmailAdapter();
  await clearProtocols();
});

describe("issue protocol API (S-05 Phase 3)", () => {
  // -------------------------------------------------------------------------
  // Validation — the 400 body shape every island re-maps onto its inputs.
  // -------------------------------------------------------------------------
  describe("POST /api/protocols validation", () => {
    it("a malformed body → 400 with `{ errors: {...} }`", async () => {
      const res = await submit(body({ odometerKm: "", customerAck: false }));
      expect(res.status).toBe(400);

      const payload = (await res.json()) as { errors: Record<string, string> };
      expect(payload.errors.odometerKm).toBeTruthy();
      expect(payload.errors.customerAck).toBeTruthy();
    });

    it("a path outside `issue/<protocolId>/` → 400 (one protocol cannot claim another's evidence)", async () => {
      const res = await submit(body({ signaturePath: `issue/${OTHER_PROTOCOL_ID}/signature.png` }));
      expect(res.status).toBe(400);

      const payload = (await res.json()) as { errors: Record<string, string> };
      expect(payload.errors.signaturePath).toBeTruthy();
    });

    it("a pending reservation → 409 `not_confirmed`", async () => {
      const res = await submit(body({ reservationId: PENDING_RESERVATION }));
      expect(res.status).toBe(409);
      expect(await res.json()).toMatchObject({ status: "not_confirmed" });
    });
  });

  // -------------------------------------------------------------------------
  // Commit-then-email: the submit route sends nothing.
  // -------------------------------------------------------------------------
  describe("POST /api/protocols commits without emailing", () => {
    it("→ 201 with the protocol id, no message sent, no delivery row", async () => {
      const { messages } = captureEmails();

      const res = await submit();
      expect(res.status).toBe(201);
      expect(await res.json()).toEqual({ protocol_id: PROTOCOL_ID });

      // The PDF does not exist yet — a send here would mail an empty attachment.
      expect(messages).toHaveLength(0);
      expect(await deliveries()).toHaveLength(0);
    });

    it("a second submit → 409 carrying the EXISTING protocol id", async () => {
      await submit();

      // A different client-minted id, same reservation: two employees tapping.
      const res = await submit(
        body({
          protocolId: OTHER_PROTOCOL_ID,
          signaturePath: `issue/${OTHER_PROTOCOL_ID}/signature.png`,
          photos: {
            front: `issue/${OTHER_PROTOCOL_ID}/photo-front.jpg`,
            rear: `issue/${OTHER_PROTOCOL_ID}/photo-rear.jpg`,
            left: `issue/${OTHER_PROTOCOL_ID}/photo-left.jpg`,
            right: `issue/${OTHER_PROTOCOL_ID}/photo-right.jpg`,
            interior: `issue/${OTHER_PROTOCOL_ID}/photo-interior.jpg`,
            dashboard: `issue/${OTHER_PROTOCOL_ID}/photo-dashboard.jpg`,
          },
          damages: [],
        }),
      );

      expect(res.status).toBe(409);
      expect(await res.json()).toMatchObject({ status: "conflict", protocol_id: PROTOCOL_ID });
    });
  });

  // -------------------------------------------------------------------------
  // Finalize: stores `pdf_path`, then sends. 200 either way.
  // -------------------------------------------------------------------------
  describe("POST /api/protocols/[id]/pdf", () => {
    beforeEach(async () => {
      await submit();
      await uploadPdf();
    });

    it("→ 200 `sent`, stores `pdf_path`, and attaches a signed URL for that path", async () => {
      const { messages } = captureEmails();

      const res = await finalize();
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ status: "ok", delivery: "sent" });

      expect(await storedPdfPath()).toBe(PDF_PATH);

      expect(messages).toHaveLength(1);
      const [message] = messages;
      expect(message.to).toBe("jan.kowalski@example.com");
      // A signed URL for THIS protocol's object — the customer receives the bytes,
      // never a bucket URL; Resend fetches it server-side at send time.
      expect(message.attachments?.[0].path).toContain(PDF_PATH);

      const rows = await deliveries();
      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({ status: "sent", recipient: "jan.kowalski@example.com" });
    });

    it("a thrown send still → 200, with a `failed` delivery row carrying the error", async () => {
      failEmails("resend is down");

      const res = await finalize();
      // The vehicle changed hands. A provider outage is recorded, never fatal.
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ status: "ok", delivery: "failed" });

      const rows = await deliveries();
      expect(rows).toHaveLength(1);
      expect(rows[0].status).toBe("failed");
      expect(rows[0].error).toContain("resend is down");

      // The protocol still stands, with its PDF recorded — recoverable via resend.
      expect(await storedPdfPath()).toBe(PDF_PATH);
    });

    it("a path outside this protocol's folder → 400", async () => {
      const res = await finalize(PROTOCOL_ID, `issue/${OTHER_PROTOCOL_ID}/protocol.pdf`);
      expect(res.status).toBe(400);
    });

    it("an unknown protocol → 404", async () => {
      const res = await finalize(UNKNOWN_PROTOCOL_ID, `issue/${UNKNOWN_PROTOCOL_ID}/protocol.pdf`);
      expect(res.status).toBe(404);
    });
  });

  // -------------------------------------------------------------------------
  // Resend: append-only history, and a hard 409 when there is nothing to attach.
  // -------------------------------------------------------------------------
  describe("POST /api/protocols/[id]/resend-email", () => {
    it("a protocol with no `pdf_path` → 409 (regenerate, don't resend)", async () => {
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
      const res = await resend(UNKNOWN_PROTOCOL_ID);
      expect(res.status).toBe(404);
    });
  });
});
