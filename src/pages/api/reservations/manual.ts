// core
import type { APIRoute } from "astro";

// others
import { api } from "../../../lib/i18n/api";
import { translator } from "../../../lib/i18n/types";
import { isDemoAccount, isRoleSufficient } from "../../../lib/access";
import { manualReservationSchema } from "../../../lib/reservation-schema";
import { notifyReservationConfirmed } from "../../../lib/services/reservation-email";
import { createConfirmedReservation } from "../../../lib/services/reservations";

// Manual-reservation create endpoint (S-12). A staff-only sibling of the public
// funnel: same atomic write guarantee, but the row lands `confirmed` +
// `source='manual'` and the customer gets the standard confirmation immediately.
//
// Self-gate order (the /api tree is outside middleware's gate — every route
// gates itself):
//   (a) same-origin `Origin` check (CSRF) before any work,
//   (b) auth — a signed-out caller is 401,
//   (c) role — employee or above, else 403 (the RPC gates a third time),
//   (c2) the demo gate — this route takes a caller-supplied `customer_email`
//        and mails it, so the published demo account must not reach it,
//   (d) zod body validation (`manualReservationSchema`) → 400 `{ errors }`,
//   (e) the atomic write; a lost race is a typed `conflict` 409, never a 500,
//   (f) best-effort confirmation email — the booking is already committed.

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

export const POST: APIRoute = async (context) => {
  const t = translator(context.locals.locale, api);

  // (a) CSRF: reject anything not same-origin before doing any work.
  const origin = context.request.headers.get("origin");
  if (origin !== context.url.origin) {
    return json(403, { error: t("badOrigin") });
  }

  // (b) + (c) Auth then role: a signed-out caller is 401, a non-staff role 403.
  if (!context.locals.user) {
    return json(401, { error: t("unauthenticated") });
  }
  if (!isRoleSufficient(context.locals.role, "employee")) {
    return json(403, { error: t("forbidden") });
  }

  // (c2) The demo gate, placed above the body parse so a refused request never
  // reaches `customer_email` — the caller-supplied address this route would
  // otherwise hand to a real provider send at (f). `code` matches the three
  // staff routes so a client can tell a demo refusal from a role refusal.
  if (isDemoAccount(context.locals)) {
    return json(403, { error: t("demoBlocked"), code: "demo_blocked" });
  }

  let payload: unknown;
  try {
    payload = await context.request.json();
  } catch {
    return json(400, { error: t("badBody"), errors: {} });
  }

  // (d) Validate — the same schema the modal island runs client-side.
  const parsed = manualReservationSchema(context.locals.locale).safeParse(payload);
  if (!parsed.success) {
    return json(400, { errors: fieldErrors(parsed.error.issues) });
  }

  // (e) The atomic write. The modal's live availability check is advisory; the
  // EXCLUDE constraint inside the RPC is what actually prevents a double booking,
  // so a range taken between the check and the submit lands here as `conflict`.
  //
  // `createConfirmedReservation` THROWS on an RPC error (e.g. the migration's
  // deliberate `raise` after 3 reference-clash retries). Unhandled, that renders
  // Astro's 500 HTML page where the island expects JSON — so catch it and answer
  // in shape, matching the sibling `api/vehicles/[id]/busy-ranges.ts`.
  let result: Awaited<ReturnType<typeof createConfirmedReservation>>;
  try {
    result = await createConfirmedReservation(context.locals.supabase, parsed.data);
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("[api/reservations/manual] create failed:", error);
    return json(500, { error: t("createReservationFailed") });
  }

  switch (result.status) {
    case "unauthorized":
      return json(403, { error: t("forbidden") });
    case "unavailable":
      return json(409, { error: t("vehicleUnavailable"), reason: "unavailable" });
    case "conflict":
      return json(409, { error: t("manualConflict"), reason: "conflict" });
    case "created":
      // (f) Best-effort confirmation — shared with the decision endpoint's
      // confirmed branch, so both paths send the identical email.
      await notifyReservationConfirmed(context.locals.supabase, result.email, context.url.origin, result.id);
      // Reference only. The customer's `access_token` is their secret /r/<token>
      // credential; the public funnel returns it because it redirects the
      // customer there, but no staff caller reads it — the modal shows the
      // reference and links to the calendar.
      return json(201, { reference: result.reference });
  }
};
