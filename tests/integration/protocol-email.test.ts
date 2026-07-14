// core
import { afterEach, beforeEach, describe, expect, it } from "vitest";

// components
import { deliveryBadge } from "../../src/components/protocol/DeliveryBadge";

// others
import { POST as protocolCreatePOST } from "../../src/pages/api/protocols";
import { POST as protocolPdfPOST } from "../../src/pages/api/protocols/[id]/pdf";
import { as, serviceClient } from "../helpers/clients";
import { asContext } from "../helpers/context";
import { captureEmails, failEmails, restoreEmailAdapter } from "../helpers/email";

// Risk #3 contract suite (S-05 Phase 7) — closes test-plan.md §3 Phase 4, which
// `test-plan.md:287` records as "untestable at any layer until S-05 ships".
//
// `test-plan.md:56` wants three things proven about the handover email, and the
// named anti-pattern is "mocking the transport so deeply nothing real is
// asserted". This suite drives the REAL routes (`POST /api/protocols` then the
// finalize route) against a local Supabase and asserts on real rows:
//
//   • ATTEMPTED    — after finalize an `email_deliveries` row exists (zero
//                    mocking of the recording path; the adapter is the only fake).
//   • SURFACED     — with the throwing adapter the row is `failed`, carries the
//                    error, the route still returns 200, and the dashboard badge
//                    derivation reports `bad` — the failure is loud, not silent.
//   • CORRECT PAYLOAD — the captured message carries the right recipient and an
//                    `attachments[0].path` for THIS protocol's own `pdf_path`,
//                    with a subject whose Polish diacritics survive intact.
//
// The transport double is injected at the adapter (`setEmailAdapter`), not on the
// wire: the send is server-side, so `page.route()` cannot reach it
// (e2e/e2e-rules.md:87-88). The doubles themselves live in tests/helpers/email.ts.

const svc = serviceClient();

// Seeded fixture (supabase/seed.sql): Jan Kowalski, confirmed.
const CONFIRMED_RESERVATION = "aaaaaaaa-0000-0000-0000-000000000001";
const CUSTOMER_EMAIL = "jan.kowalski@example.com";

// Client-minted ids (crypto.randomUUID in production), distinct from the Phase 3
// API suite's so cleanup stays independent under serial execution.
const PROTOCOL_ID = "dddddddd-0000-0000-0000-0000000000c1";
const DAMAGE_ID = "eeeeeeee-0000-0000-0000-0000000000c1";

const BUCKET = "protocols";
const PDF_PATH = `issue/${PROTOCOL_ID}/protocol.pdf`;

// Every fixture on an encoding-sensitive path carries the full diacritic set
// (lessons.md). This note reaches the PDF and travels through the send path.
const DAMAGE_LOCATION = "lewy tylny błotnik — zażółć gęślą jaźń";

function body() {
  return {
    protocolId: PROTOCOL_ID,
    reservationId: CONFIRMED_RESERVATION,
    odometerKm: "124500",
    fuelEighths: 6,
    customerAck: true,
    signedAt: new Date("2026-07-14T12:08:00Z").toISOString(),
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
  };
}

/** `POST /api/protocols` as a real employee. */
async function submit() {
  return protocolCreatePOST(await asContext("employee", { method: "POST", path: "/api/protocols", body: body() }));
}

/** `POST /api/protocols/[id]/pdf` as a real employee — stores the path, then sends. */
async function finalize() {
  return protocolPdfPOST(
    await asContext("employee", {
      method: "POST",
      path: `/api/protocols/${PROTOCOL_ID}/pdf`,
      params: { id: PROTOCOL_ID },
      body: { path: PDF_PATH },
    }),
  );
}

/**
 * Put a real object at `pdf_path`, through the employee's own JWT so
 * `storage.objects` RLS is exercised exactly as the browser exercises it.
 * Without it `createSignedUrl` has nothing to sign and the send would degrade to
 * `failed` for the wrong reason — the SURFACED test would then pass vacuously.
 * `upsert` because staff have no DELETE policy (the protocol is dispute evidence).
 */
async function uploadPdf() {
  const employee = await as("employee");
  const { error } = await employee.storage
    .from(BUCKET)
    // The `type` must live on the Blob: the bucket's `allowed_mime_types` rejects
    // the default application/octet-stream.
    .upload(PDF_PATH, new Blob([new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d])], { type: "application/pdf" }), {
      contentType: "application/pdf",
      upsert: true,
    });
  if (error) throw error;
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

/** Delivery rows for this protocol, newest last. */
async function deliveries(): Promise<DeliveryRow[]> {
  const { data } = await svc
    .from("email_deliveries")
    .select("status, error, recipient, template")
    .eq("entity_id", PROTOCOL_ID)
    .order("created_at", { ascending: true });
  return rows<DeliveryRow>(data);
}

/** The `pdf_path` the finalize route recorded, read back through service-role. */
async function storedPdfPath(): Promise<string | null> {
  const { data } = await svc.from("protocols").select("pdf_path").eq("id", PROTOCOL_ID);
  return rows<{ pdf_path: string | null }>(data)[0]?.pdf_path ?? null;
}

async function clearProtocols() {
  // FK cascade clears photos, damages and damage photos.
  await svc.from("protocols").delete().eq("id", PROTOCOL_ID);
  await svc.from("email_deliveries").delete().eq("entity_id", PROTOCOL_ID);
}

beforeEach(async () => {
  await clearProtocols();
});

afterEach(async () => {
  restoreEmailAdapter();
  await clearProtocols();
});

describe("risk #3: protocol email is attempted, surfaces failure, carries the right payload (S-05 Phase 7)", () => {
  it("ATTEMPTED — finalize records an `email_deliveries` row (the send path really ran)", async () => {
    captureEmails();

    await submit();
    await uploadPdf();
    const res = await finalize();

    expect(res.status).toBe(200);
    // The recording is not mocked: a real row means the service reached
    // `record_email_delivery` after the adapter returned.
    const rows = await deliveries();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ status: "sent", template: "protocol_issued", recipient: CUSTOMER_EMAIL });
  });

  it("SURFACED — a provider outage lands a `failed` row, still returns 200, and the badge reads `bad`", async () => {
    failEmails("resend returned 503");

    await submit();
    await uploadPdf();
    const res = await finalize();

    // The vehicle changed hands; the outage is recorded, never fatal.
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: "ok", delivery: "failed" });

    const rows = await deliveries();
    expect(rows).toHaveLength(1);
    expect(rows[0].status).toBe("failed");
    expect(rows[0].error).toContain("resend returned 503");

    // The failure is loud, not silent: the dashboard badge the employee sees is
    // derived from exactly (`pdf_path`, newest delivery status) and reports `bad`.
    const pdfPath = await storedPdfPath();
    expect(pdfPath).toBe(PDF_PATH);
    expect(deliveryBadge(pdfPath, rows[0].status)).toEqual({ tone: "bad", label: "E-mail niewysłany" });
  });

  it("CORRECT PAYLOAD — the message carries the customer, this protocol's PDF, and diacritics intact", async () => {
    const { messages } = captureEmails();

    await submit();
    await uploadPdf();
    await finalize();

    expect(messages).toHaveLength(1);
    const [message] = messages;

    // Right recipient — the seeded reservation's customer, not the employee.
    expect(message.to).toBe(CUSTOMER_EMAIL);

    // Right attachment — a signed URL for THIS protocol's own object. The
    // customer receives the bytes; Resend fetches `path` server-side at send time.
    expect(message.attachments).toHaveLength(1);
    expect(message.attachments?.[0].path).toContain(PDF_PATH);
    expect(message.attachments?.[0].filename).toMatch(/\.pdf$/);

    // Polish survives the send path (not just the DB): the subject is byte-for-byte
    // "protokół wydania", the encoding boundary this whole slice guards.
    expect(message.subject).toContain("protokół wydania");
  });
});
