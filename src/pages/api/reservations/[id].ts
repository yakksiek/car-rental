// core
import type { APIRoute } from "astro";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

// others
import { isRoleSufficient } from "../../../lib/access";
import type { Database } from "../../../db/database.types";
import { reservationConfirmedEmail, reservationRejectedEmail } from "../../../lib/email/templates";
import { sendTracked } from "../../../lib/services/email-delivery";
import { decideReservation } from "../../../lib/services/reservations";
import type { DecisionEmailPayload } from "../../../types";

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

/** Display label for the vehicle, e.g. `"Mercedes-Benz Sprinter (2022)"`. */
function vehicleLabel(email: DecisionEmailPayload): string {
  return [
    [email.vehicle_make, email.vehicle_model].filter(Boolean).join(" "),
    email.vehicle_production_year ? `(${email.vehicle_production_year})` : null,
  ]
    .filter(Boolean)
    .join(" ");
}

/**
 * Compose and send the confirm/reject email, recording the outcome in
 * `email_deliveries`. Best-effort: `sendTracked` never throws, so a send failure
 * never rolls back the committed decision — but it is no longer silent either.
 * S-05 replaced this function's own try/catch with that call.
 */
async function notifyCustomer(
  client: SupabaseClient<Database> | null,
  reservationId: string,
  status: "confirmed" | "rejected",
  email: DecisionEmailPayload,
  reason: (typeof REJECTION_REASONS)[number] | undefined,
  note: string | undefined,
  origin: string,
): Promise<void> {
  const statusUrl = new URL(`/r/${email.access_token}`, origin).href;
  const content =
    status === "confirmed"
      ? reservationConfirmedEmail({
          reference: email.reference,
          statusUrl,
          vehicle: vehicleLabel(email),
          pickup: email.pickup_date,
          return: email.return_date,
          dailyRate: email.vehicle_daily_rate,
          deposit: email.vehicle_deposit,
        })
      : reservationRejectedEmail({
          reference: email.reference,
          statusUrl,
          vehicle: vehicleLabel(email),
          // A committed reject always carried a valid reason through the zod
          // gate; default defensively so the template never receives undefined.
          reason: reason ?? "other",
          note,
        });

  await sendTracked(client, email.customer_email, content, {
    entityType: "reservation",
    entityId: reservationId,
    template: status === "confirmed" ? "reservation_confirmed" : "reservation_rejected",
  });
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
      // (e) Best-effort notification. The decision is already committed, so a
      // send failure is recorded and never fails the request (S-02 pattern).
      await notifyCustomer(context.locals.supabase, id, result.status, result.email, reason, note, context.url.origin);
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
