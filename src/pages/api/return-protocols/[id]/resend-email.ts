// core
import type { APIRoute } from "astro";

// others
import { requireRole } from "../../../../lib/access";
import { resendProtocolEmail } from "../../../../lib/services/protocols";

// Resend a return protocol to the customer (S-06) — the recovery path that makes
// `email_deliveries` worth having, mirroring the issue resend route. Reached from
// the post-submit `email` overlay and from the returns-list badge, both of which
// exist because a customer with no account and no portal has email as their only
// channel.
//
// `email_deliveries` is append-only, so a retry surfaces as a second row rather
// than overwriting the failure. The PDF is re-signed, never regenerated: the
// object already sits in storage. `resendProtocolEmail` is type-aware and sends
// the return template (comparison deltas) because the row's `type = 'return'`.
//
// A null `pdf_path` means PDF generation never completed, so there is nothing to
// attach — that is a 409, and the employee must regenerate from the form, not
// resend. Takes no body: the protocol id in the path is the whole request.

const MSG = {
  badOrigin: "Nieprawidłowe źródło żądania.",
  badBody: "Nieprawidłowe zgłoszenie.",
  unauthenticated: "Wymagane logowanie.",
  forbidden: "Brak uprawnień.",
  notFound: "Nie znaleziono protokołu.",
  noPdf: "Protokół nie ma zapisanego pliku PDF — wygeneruj go ponownie.",
} as const;

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
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

  // (c) Re-sign and re-send, recording the outcome. Never throws; a provider
  // failure comes back as `failed` with a 200, exactly like the finalize route.
  const delivery = await resendProtocolEmail(context.locals.supabase, id);
  switch (delivery.status) {
    case "sent":
    case "failed":
      return json(200, { status: "ok", delivery: delivery.status });
    case "no_pdf":
      return json(409, { error: MSG.noPdf, status: "no_pdf" });
    case "not_found":
      return json(404, { error: MSG.notFound });
    case "unauthorized":
      return json(403, { error: MSG.forbidden });
  }
};
