// core
import type { APIRoute } from "astro";

// others
import { requireRole } from "../../lib/access";
import { firstIssuePerField, returnProtocolSchema } from "../../lib/return-protocol-schema";
import { createReturnProtocol } from "../../lib/services/protocols";

// Return-protocol submit endpoint (S-06). Commits the return — and **nothing is
// emailed here**, exactly like POST /api/protocols: the PDF (now carrying the
// comparison section) is built client-side *after* this call returns, so a send
// attempted now would attach a signed URL to an object that does not yet exist.
// The send belongs to POST /api/return-protocols/[id]/pdf.
//
// Intentionally STAFF-ONLY and self-gated: middleware does not cover /api
// (lessons.md — `ROUTE_ROLES` gates only /dashboard pages), so this route runs
// the same gate order as the issue route:
//   (a) same-origin `Origin` check (CSRF) before any work,
//   (b) auth (401) then role (403) — the vehicles two-step (F2 resolution),
//   (c) zod body validation, 400 `{ errors }`,
//   (d) the definer RPC via the service, whose result tags map to HTTP.
//
// The only shape difference from the issue route: a return has no `not_confirmed`
// (the RPC does not re-assert `reservation_status` — a return is filed against an
// already-issued booking), but it does carry `no_baseline` — no issue protocol
// exists for the reservation, or the submitted baseline id is not that issue
// protocol's id. A return may never stand without an issue baseline.

const MSG = {
  badOrigin: "Nieprawidłowe źródło żądania.",
  badBody: "Nieprawidłowe zgłoszenie.",
  unauthenticated: "Wymagane logowanie.",
  forbidden: "Brak uprawnień.",
  notFound: "Nie znaleziono rezerwacji.",
  noBaseline: "Brak protokołu wydania dla tej rezerwacji.",
  conflict: "Dla tej rezerwacji przyjęto już zwrot.",
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

  // (c) Validate — the same schema the return island runs client-side. It pins
  // every storage path to this protocol's `return/` folder via the shared
  // `protocol-storage-paths` module (no inline `return/` literal).
  const parsed = returnProtocolSchema.safeParse(payload);
  if (!parsed.success) {
    return json(400, { errors: firstIssuePerField(parsed.error.issues) });
  }

  // (d) The guarded insert. The RPC is the authority for the issue-baseline
  // precondition and the one-return-per-reservation invariant — two employees
  // tapping simultaneously both go through it, and the loser gets `conflict`
  // carrying the *existing* return id so the conflict screen can link to it.
  const result = await createReturnProtocol(context.locals.supabase, parsed.data);
  switch (result.status) {
    case "ok":
      return json(201, { protocol_id: result.protocolId });
    case "conflict":
      return json(409, { error: MSG.conflict, status: "conflict", protocol_id: result.protocolId });
    case "no_baseline":
      return json(409, { error: MSG.noBaseline, status: "no_baseline" });
    case "not_found":
      return json(404, { error: MSG.notFound });
    case "unauthorized":
      return json(403, { error: MSG.forbidden });
  }
};
