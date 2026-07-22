// core
import type { APIRoute } from "astro";
import { z } from "zod";

// others
import { requireRole } from "../../../../lib/access";
import { isValidObjectPath } from "../../../../lib/protocol-storage-paths";
import { resendProtocolEmail, setProtocolPdf } from "../../../../lib/services/protocols";

// Finalize an issue protocol (S-05): record where the client-generated PDF landed
// in storage, then mail it. This is the ONLY place `pdf_path` is written and the
// only place the protocol email is sent for the first time.
//
// A dedicated POST action sub-route through a definer RPC, following the
// single-scalar-update convention of `api/vehicles/[id]/active.ts` →
// `set_vehicle_active` — not a PATCH.
//
// The route returns 200 **regardless of the email outcome**, carrying the
// delivery status so the island picks its overlay variant (`sent` / `email`).
// The vehicle has physically changed hands; a provider 503 must not read as a
// failed handover. `sendTracked` records the outcome in `email_deliveries`, which
// is what makes the dispatch-list badge and the resend action possible. If the
// client never reaches this route at all (PDF generation threw), the protocol
// stands with `pdf_path` null and no delivery row — the `pdf` overlay, recovered
// from the dispatch list.
//
// Gate order per lessons.md, vehicles two-step (401 anon / 403 wrong role).

const MSG = {
  badOrigin: "Nieprawidłowe źródło żądania.",
  badBody: "Nieprawidłowe zgłoszenie.",
  unauthenticated: "Wymagane logowanie.",
  forbidden: "Brak uprawnień.",
  notFound: "Nie znaleziono protokołu.",
  badPath: "Nieprawidłowa ścieżka pliku.",
  noPdf: "Protokół nie ma zapisanego pliku PDF.",
} as const;

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

/**
 * The path must sit under this protocol's own folder, mirroring the
 * `protocolInputSchema` superRefine: `storage.objects` RLS scopes only to the
 * `issue/` prefix and the RPC records whatever path it is handed, so without this
 * a caller could point one protocol's `pdf_path` at another's evidence.
 */
function pdfPathSchema(protocolId: string) {
  return z.object({
    path: z
      .string(MSG.badPath)
      .trim()
      .refine((path) => isValidObjectPath("issue", protocolId, path) && path.endsWith(".pdf"), MSG.badPath),
  });
}

export const POST: APIRoute = async (context) => {
  // (a) CSRF: reject anything not same-origin before doing any work.
  const origin = context.request.headers.get("origin");
  if (origin !== context.url.origin) {
    return json(403, { error: MSG.badOrigin });
  }

  // (b) Auth + role gate: a signed-out caller is 401, a non-staff role 403.
  if (!context.locals.user) {
    return json(401, { error: MSG.unauthenticated });
  }
  if (!requireRole(context.locals, "employee")) {
    return json(403, { error: MSG.forbidden });
  }

  const id = context.params.id;
  if (!id) {
    return json(400, { error: MSG.badBody });
  }

  let payload: unknown;
  try {
    payload = await context.request.json();
  } catch {
    return json(400, { error: MSG.badBody, errors: {} });
  }

  // (c) Validate the storage path against this protocol's folder.
  const parsed = pdfPathSchema(id).safeParse(payload);
  if (!parsed.success) {
    return json(400, { errors: { path: MSG.badPath } });
  }

  // (d) Store the path. Idempotent — a retry overwrites it with the same value.
  const stored = await setProtocolPdf(context.locals.supabase, id, parsed.data.path);
  if (stored.status === "not_found") {
    return json(404, { error: MSG.notFound });
  }
  if (stored.status === "unauthorized") {
    return json(403, { error: MSG.forbidden });
  }

  // (e) Now that the object exists and its path is recorded, mint a short-TTL
  // signed URL and mail it. Never throws; a provider failure is a `failed` row.
  const delivery = await resendProtocolEmail(context.locals.supabase, id);
  switch (delivery.status) {
    case "sent":
    case "failed":
      return json(200, { status: "ok", delivery: delivery.status });
    case "no_pdf":
      // Unreachable: `set_protocol_pdf` just succeeded. Kept so the union stays
      // exhaustive if the service's tags change.
      return json(409, { error: MSG.noPdf, status: "no_pdf" });
    case "not_found":
      return json(404, { error: MSG.notFound });
    case "unauthorized":
      return json(403, { error: MSG.forbidden });
  }
};
