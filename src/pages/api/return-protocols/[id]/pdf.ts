// core
import type { APIRoute } from "astro";
import { z } from "zod";

// others
import { api } from "../../../../lib/i18n/api";
import { translator } from "../../../../lib/i18n/types";
import { requireRole } from "../../../../lib/access";
import { isValidObjectPath } from "../../../../lib/protocol-storage-paths";
import { resendProtocolEmail, setProtocolPdf } from "../../../../lib/services/protocols";

// Finalize a return protocol (S-06): record where the client-generated PDF (with
// the comparison section) landed in storage, then mail it. This is the ONLY place
// a return's `pdf_path` is written and the only place the return email is sent for
// the first time. It reuses the type-agnostic `set_protocol_pdf` RPC and the now
// type-aware `resendProtocolEmail` (which picks the return template + comparison
// deltas because the row's `type = 'return'`) — the issue finalize route is
// untouched.
//
// Returns 200 **regardless of the email outcome**, carrying the delivery status so
// the island picks its overlay variant. The vehicle has physically been returned;
// a provider 503 must not read as a failed return. `sendTracked` records the
// outcome in `email_deliveries`, which is what makes the returns-list badge and
// the resend action possible.
//
// Gate order per lessons.md, vehicles two-step (401 anon / 403 wrong role).

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

/**
 * The path must sit under this protocol's own `return/` folder: `storage.objects`
 * RLS scopes to the `return/` prefix and the RPC records whatever path it is
 * handed, so without this a caller could point one protocol's `pdf_path` at
 * another's evidence. `isValidObjectPath` is the shared checker — **no inline
 * `return/` literal here** (the return analogue of the issue route's guard).
 */
function pdfPathSchema(protocolId: string, t: ReturnType<typeof translator<(typeof api)["en"]>>) {
  return z.object({
    path: z
      .string(t("badPath"))
      .trim()
      .refine((path) => isValidObjectPath("return", protocolId, path) && path.endsWith(".pdf"), t("badPath")),
  });
}

export const POST: APIRoute = async (context) => {
  const t = translator(context.locals.locale, api);

  // (a) CSRF: reject anything not same-origin before doing any work.
  const origin = context.request.headers.get("origin");
  if (origin !== context.url.origin) {
    return json(403, { error: t("badOrigin") });
  }

  // (b) Auth + role gate: a signed-out caller is 401, a non-staff role 403.
  if (!context.locals.user) {
    return json(401, { error: t("unauthenticated") });
  }
  if (!requireRole(context.locals, "employee")) {
    return json(403, { error: t("forbidden") });
  }

  const id = context.params.id;
  if (!id) {
    return json(400, { error: t("badBody") });
  }

  let payload: unknown;
  try {
    payload = await context.request.json();
  } catch {
    return json(400, { error: t("badBody"), errors: {} });
  }

  // (c) Validate the storage path against this protocol's `return/` folder.
  const parsed = pdfPathSchema(id, t).safeParse(payload);
  if (!parsed.success) {
    return json(400, { errors: { path: t("badPath") } });
  }

  // (d) Store the path. Idempotent — a retry overwrites it with the same value.
  const stored = await setProtocolPdf(context.locals.supabase, id, parsed.data.path);
  if (stored.status === "not_found") {
    return json(404, { error: t("protocolNotFound") });
  }
  if (stored.status === "unauthorized") {
    return json(403, { error: t("forbidden") });
  }

  // (e) Now that the object exists and its path is recorded, mint a short-TTL
  // signed URL and mail the return protocol. Never throws; a provider failure is a
  // `failed` row. `resendProtocolEmail` reads the row's `type` and sends the
  // return template with the comparison deltas.
  const delivery = await resendProtocolEmail(context.locals.supabase, id);
  switch (delivery.status) {
    case "sent":
    case "failed":
      return json(200, { status: "ok", delivery: delivery.status });
    case "no_pdf":
      // Unreachable: `set_protocol_pdf` just succeeded. Kept so the union stays
      // exhaustive if the service's tags change.
      return json(409, { error: t("noPdf"), status: "no_pdf" });
    case "not_found":
      return json(404, { error: t("protocolNotFound") });
    case "unauthorized":
      return json(403, { error: t("forbidden") });
  }
};
