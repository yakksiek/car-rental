// core
import { afterEach, beforeEach, describe, expect, it } from "vitest";

// components
import { deliveryBadge } from "../../src/components/protocol/DeliveryBadge";

// others
import { POST as returnCreatePOST } from "../../src/pages/api/return-protocols";
import { POST as returnPdfPOST } from "../../src/pages/api/return-protocols/[id]/pdf";
import { as, serviceClient } from "../helpers/clients";
import { asContext } from "../helpers/context";
import { captureEmails, failEmails, restoreEmailAdapter } from "../helpers/email";

// Risk #3 contract suite for the RETURN template (S-06 Phase 7) — the return
// sibling of protocol-email.test.ts, closing test-plan.md §3 Phase 4 for S-06.
//
// The named anti-pattern is "mocking the transport so deeply nothing real is
// asserted". This suite drives the REAL routes (`POST /api/return-protocols` then
// the finalize route) against a local Supabase and asserts on real rows, proving
// the return template — NOT the issue template — is selected off the row's `type`
// (`resendProtocolEmail` reads `get_protocol().type`) and carries the comparison
// deltas:
//
//   • ATTEMPTED    — after finalize an `email_deliveries` row exists, template
//                    `protocol_returned` (zero mocking of the recording path; the
//                    adapter is the only fake).
//   • SURFACED     — with the throwing adapter the row is `failed`, carries the
//                    error, the route still returns 200, and the SHARED dashboard
//                    badge derivation reports `bad` — the failure is loud.
//   • CORRECT PAYLOAD — the captured message carries the customer, an
//                    `attachments[0].path` for THIS return's own `pdf_path`, and a
//                    subject whose Polish diacritics survive ("protokół zwrotu").
//
// The transport double is injected at the adapter (`setEmailAdapter`), not on the
// wire: the send is server-side, so `page.route()` cannot reach it. The doubles
// live in tests/helpers/email.ts.
//
// SERVICE-ROLE ISOLATION: `serviceClient()` appears only in setup/teardown and in
// reading back what a route wrote. Every route call runs through `asContext`.

const svc = serviceClient();

// Seeded baseline (supabase/seed.sql): the demo issue protocol on R-0002 (Anna
// Nowak, confirmed, past return) — the decoupled home for the return demo. Its
// `d6…` id namespace is disjoint from this suite's `dddddddd…` fixtures.
const BASELINE_RESERVATION = "aaaaaaaa-0000-0000-0000-000000000002";
const CUSTOMER_EMAIL = "anna.nowak@example.com";
const BASELINE_PROTOCOL_ID = "d6000000-0000-0000-0000-000000000001";
const BASELINE_DAMAGE_ID = "dd000000-0000-0000-0000-0000000000d1";

// Client-minted (crypto.randomUUID in production); a distinct `…c7` tail so
// cleanup stays independent of every other suite under serial execution.
const RETURN_PROTOCOL_ID = "dddddddd-0000-0000-0000-0000000000c7";
const DAMAGE_ID = "eeeeeeee-0000-0000-0000-0000000000c7";

const BUCKET = "protocols";
const PDF_PATH = `return/${RETURN_PROTOCOL_ID}/protocol.pdf`;

// Every fixture on an encoding-sensitive path carries the full diacritic set
// (lessons.md). This note reaches the PDF and travels through the send path.
const DAMAGE_LOCATION = "prawy tylny błotnik — zażółć gęślą jaźń";

function body() {
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
    photos: {
      front: `return/${RETURN_PROTOCOL_ID}/photo-front.jpg`,
      rear: `return/${RETURN_PROTOCOL_ID}/photo-rear.jpg`,
      left: `return/${RETURN_PROTOCOL_ID}/photo-left.jpg`,
      right: `return/${RETURN_PROTOCOL_ID}/photo-right.jpg`,
      interior: `return/${RETURN_PROTOCOL_ID}/photo-interior.jpg`,
      dashboard: `return/${RETURN_PROTOCOL_ID}/photo-dashboard.jpg`,
    },
    damages: [
      {
        id: DAMAGE_ID,
        type: "scratch",
        location: DAMAGE_LOCATION,
        size: "15 cm",
        // Carried over from the seeded baseline scratch — an existing damage.
        baselineDamageId: BASELINE_DAMAGE_ID,
        photos: [`return/${RETURN_PROTOCOL_ID}/damage-${DAMAGE_ID}-1.jpg`],
      },
    ],
  };
}

/** `POST /api/return-protocols` as a real employee. */
async function submit() {
  return returnCreatePOST(await asContext("employee", { method: "POST", path: "/api/return-protocols", body: body() }));
}

/** `POST /api/return-protocols/[id]/pdf` as a real employee — stores the path, then sends. */
async function finalize() {
  return returnPdfPOST(
    await asContext("employee", {
      method: "POST",
      path: `/api/return-protocols/${RETURN_PROTOCOL_ID}/pdf`,
      params: { id: RETURN_PROTOCOL_ID },
      body: { path: PDF_PATH },
    }),
  );
}

/**
 * Put a real object at `pdf_path` through the employee's own JWT so the
 * `return/`-prefixed `storage.objects` RLS is exercised exactly as the browser
 * exercises it. Without it `createSignedUrl` has nothing to sign and the send
 * degrades to `failed` for the wrong reason — the SURFACED test would then pass
 * vacuously. `upsert` because staff have no DELETE policy (dispute evidence).
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

/** The `pdf_path` the finalize route recorded, read back through service-role. */
async function storedPdfPath(): Promise<string | null> {
  const { data } = await svc.from("protocols").select("pdf_path").eq("id", RETURN_PROTOCOL_ID);
  return rows<{ pdf_path: string | null }>(data)[0]?.pdf_path ?? null;
}

async function clearReturns() {
  // Only this suite's return row — NEVER the seeded baseline (d6…001), which every
  // create depends on. FK cascade clears the return's photos and damages.
  await svc.from("protocols").delete().eq("id", RETURN_PROTOCOL_ID);
  await svc.from("email_deliveries").delete().eq("entity_id", RETURN_PROTOCOL_ID);
}

beforeEach(clearReturns);

afterEach(async () => {
  restoreEmailAdapter();
  await clearReturns();
});

describe("risk #3: return email is attempted, surfaces failure, carries the right payload (S-06 Phase 7)", () => {
  it("ATTEMPTED — finalize records a `protocol_returned` delivery (the send path really ran)", async () => {
    captureEmails();

    await submit();
    await uploadPdf();
    const res = await finalize();

    expect(res.status).toBe(200);
    // The recording is not mocked: a real row means the service reached
    // `record_email_delivery` after the adapter returned — and it picked the
    // RETURN template off the row's `type`, not the issue one.
    const rows = await deliveries();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ status: "sent", template: "protocol_returned", recipient: CUSTOMER_EMAIL });
  });

  it("SURFACED — a provider outage lands a `failed` row, still returns 200, and the badge reads `bad`", async () => {
    failEmails("resend returned 503");

    await submit();
    await uploadPdf();
    const res = await finalize();

    // The vehicle physically came back; the outage is recorded, never fatal.
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: "ok", delivery: "failed" });

    const rows = await deliveries();
    expect(rows).toHaveLength(1);
    expect(rows[0].status).toBe("failed");
    expect(rows[0].error).toContain("resend returned 503");

    // The failure is loud, not silent: the SHARED dashboard badge (issue + return)
    // is derived from exactly (`pdf_path`, newest delivery status) and reads `bad`.
    const pdfPath = await storedPdfPath();
    expect(pdfPath).toBe(PDF_PATH);
    expect(deliveryBadge(pdfPath, rows[0].status)).toEqual({ tone: "bad", label: "E-mail niewysłany" });
  });

  it("CORRECT PAYLOAD — the message carries the customer, this return's PDF, and diacritics intact", async () => {
    const { messages } = captureEmails();

    await submit();
    await uploadPdf();
    await finalize();

    expect(messages).toHaveLength(1);
    const [message] = messages;

    // Right recipient — the seeded reservation's customer, not the employee.
    expect(message.to).toBe(CUSTOMER_EMAIL);

    // Right attachment — a signed URL for THIS return's own object. The customer
    // receives the bytes; Resend fetches `path` server-side at send time.
    expect(message.attachments).toHaveLength(1);
    expect(message.attachments?.[0].path).toContain(PDF_PATH);
    expect(message.attachments?.[0].filename).toMatch(/\.pdf$/);

    // Polish survives the send path (not just the DB): the subject is the return
    // subject "protokół zwrotu", byte-for-byte — the encoding boundary this slice
    // guards, proving the type-aware template selection landed on the return copy.
    expect(message.subject).toContain("protokół zwrotu");
  });
});
