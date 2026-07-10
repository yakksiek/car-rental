// core
import type { APIRoute } from "astro";

// others
import { requireRole } from "../../lib/access";
import { firstIssuePerField, protocolInputSchema } from "../../lib/protocol-schema";
import { createProtocol } from "../../lib/services/protocols";

// Issue-protocol submit endpoint (S-05). Commits the handover — and **nothing is
// emailed here**. The PDF is built client-side *after* this call returns, so a
// send attempted at this point would attach a signed URL to an object that does
// not exist: Resend fetches `path` server-side at send time, so the customer
// would receive an empty mail while `email_deliveries` recorded `sent`. The send
// belongs to POST /api/protocols/[id]/pdf.
//
// Gate order per lessons.md ("API routes are outside middleware's gate"), using
// the vehicles two-step (`!user` → 401, then role → 403) rather than the
// reservation routes' single role check — the deliberate resolution of F2
// (context/archive/2026-06-30-testing-api-boundary-authz/finding-anon-status-inconsistency.md).
// This plan does not retrofit the reservation routes.
//   (a) same-origin `Origin` check (CSRF) before any work,
//   (b) auth (401) then role (403),
//   (c) zod body validation, 400 `{ errors }`,
//   (d) the definer RPC via the service, whose result tags map to HTTP.

const MSG = {
  badOrigin: "Nieprawidłowe źródło żądania.",
  badBody: "Nieprawidłowe zgłoszenie.",
  unauthenticated: "Wymagane logowanie.",
  forbidden: "Brak uprawnień.",
  notFound: "Nie znaleziono rezerwacji.",
  notConfirmed: "Rezerwacja nie jest potwierdzona.",
  conflict: "Dla tej rezerwacji wydano już protokół.",
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

  let payload: unknown;
  try {
    payload = await context.request.json();
  } catch {
    return json(400, { error: MSG.badBody, errors: {} });
  }

  // (c) Validate — the same schema the island runs client-side.
  const parsed = protocolInputSchema.safeParse(payload);
  if (!parsed.success) {
    return json(400, { errors: firstIssuePerField(parsed.error.issues) });
  }

  // (d) The guarded insert. The RPC is the authority for "still confirmed?" and
  // for the one-protocol-per-reservation invariant — two employees tapping
  // simultaneously both go through it, and the loser gets `conflict` carrying the
  // *existing* protocol's id so the conflict screen can link to it.
  const result = await createProtocol(context.locals.supabase, parsed.data);
  switch (result.status) {
    case "ok":
      return json(201, { protocol_id: result.protocolId });
    case "conflict":
      return json(409, { error: MSG.conflict, status: "conflict", protocol_id: result.protocolId });
    case "not_confirmed":
      return json(409, { error: MSG.notConfirmed, status: "not_confirmed" });
    case "not_found":
      return json(404, { error: MSG.notFound });
    case "unauthorized":
      return json(403, { error: MSG.forbidden });
  }
};
