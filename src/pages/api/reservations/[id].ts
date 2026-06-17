// core
import type { APIRoute } from "astro";
import { z } from "zod";

// others
import { isRoleSufficient } from "../../../lib/access";
import { decideReservation } from "../../../lib/services/reservations";

// The employee decision endpoint (S-03). Mirrors the S-02 reservation route's
// defenses, adapted for an authenticated mutation:
//   (a) same-origin `Origin` check (CSRF) before any work,
//   (b) role gate — employee/admin only (middleware gates /dashboard pages, not
//       /api, so the check is repeated here; the RPC gates a third time),
//   (c) zod body validation (decision verb + conditional reason),
//   (d) the guarded transition via `decide_reservation`, whose result tags map
//       to status codes — including the friendly already-decided 409,
//   (e) Phase 3 adds a best-effort confirm/reject email after a committed flip.

const MSG = {
  badOrigin: "Nieprawidłowe źródło żądania.",
  badBody: "Nieprawidłowe żądanie.",
  forbidden: "Brak uprawnień.",
  notFound: "Nie znaleziono rezerwacji.",
  alreadyDecided: "Ten wniosek został już rozpatrzony.",
  invalidReason: "Wybierz prawidłowy powód odrzucenia.",
} as const;

const REJECTION_REASONS = ["dates_unavailable", "no_category", "vehicle_withdrawn", "other"] as const;

// `reject` requires a reason; `confirm` ignores it. The refine mirrors the RPC's
// invalid_reason guard so a malformed reject is caught before the round-trip.
const decisionSchema = z
  .object({
    decision: z.enum(["confirm", "reject"]),
    reason: z.enum(REJECTION_REASONS).optional(),
    note: z.string().trim().max(500).optional(),
  })
  .refine((body) => body.decision !== "reject" || body.reason !== undefined, {
    message: "Wybierz powód odrzucenia.",
    path: ["reason"],
  });

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

/** First zod message per top-level field — the island mirrors this shape. */
function fieldErrors(issues: { path: PropertyKey[]; message: string }[]): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const issue of issues) {
    const key = String(issue.path[0] ?? "form");
    errors[key] ??= issue.message;
  }
  return errors;
}

export const PATCH: APIRoute = async (context) => {
  // (a) CSRF: reject anything not same-origin before doing any work.
  const origin = context.request.headers.get("origin");
  if (origin !== context.url.origin) {
    return json(403, { error: MSG.badOrigin });
  }

  // (b) Role gate: employee or above. The fail-closed default (null role) is 403.
  if (!isRoleSufficient(context.locals.role, "employee")) {
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

  // (c) Validate the decision verb + conditional reason.
  const parsed = decisionSchema.safeParse(payload);
  if (!parsed.success) {
    return json(400, { errors: fieldErrors(parsed.error.issues) });
  }
  const { decision, reason, note } = parsed.data;

  // (d) The guarded transition. The RPC is the source of truth for "still
  // pending?" — two employees racing here both go through it safely.
  const result = await decideReservation(context.locals.supabase, id, decision, reason, note);

  switch (result.status) {
    case "confirmed":
    case "rejected":
      // (e) Phase 3 composes + sends the notification email here.
      return json(200, { status: result.status });
    case "already_decided":
      return json(409, { error: MSG.alreadyDecided, reason: "already_decided" });
    case "not_found":
      return json(404, { error: MSG.notFound });
    case "invalid_reason":
      return json(400, { error: MSG.invalidReason, errors: { reason: MSG.invalidReason } });
    case "unauthorized":
      return json(403, { error: MSG.forbidden });
  }
};
