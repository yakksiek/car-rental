// core
import type { APIRoute } from "astro";

// others
import { api } from "../../lib/i18n/api";
import { translator } from "../../lib/i18n/types";
import { sendEmail } from "../../lib/email";
import { reservationReceivedEmail } from "../../lib/email/templates";
import { reservationRequestSchema, TERMS_VERSION } from "../../lib/reservation-schema";
import { createReservationRequest, isVehicleAvailable } from "../../lib/services/reservations";
import { getVehicleById } from "../../lib/services/vehicles";

// The reservation funnel's trust boundary (S-02). Order of defenses:
//   (a) same-origin `Origin` check (CSRF) before any work,
//   (b) honeypot short-circuit (benign success shape, nothing inserted),
//   (c) zod re-validation of the body (`reservationRequestSchema`),
//   (d) availability pre-check via `isVehicleAvailable` — server-side because
//       Supabase credentials are server-only secrets (the island cannot run it),
//   (e) the atomic write through `create_reservation_request`, whose 23P01
//       mapping is the no-double-booking authority (the pre-check is UX sugar),
//   (f) confirmation email through the dev/log seam — a send failure is logged
//       and never fails the request.

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

  // (a) CSRF: the browser sends Origin on every cross-site POST; reject anything
  // not same-origin before doing any work (dev origin is http://localhost:4321).
  const origin = context.request.headers.get("origin");
  if (origin !== context.url.origin) {
    return json(403, { error: t("badOrigin") });
  }

  let payload: unknown;
  try {
    payload = await context.request.json();
  } catch {
    return json(400, { error: t("badBody"), errors: {} });
  }

  // (b) Honeypot: a non-empty `company_url` is a bot. Return a success-shaped
  // response (fake reference + token) without touching the database, so the
  // bot learns nothing; the schema's empty-only rule below is defense-in-depth.
  if (
    typeof payload === "object" &&
    payload !== null &&
    "company_url" in payload &&
    typeof payload.company_url === "string" &&
    payload.company_url !== ""
  ) {
    const fakeToken = crypto.randomUUID();
    return json(201, { reference: `R-${fakeToken.slice(0, 4).toUpperCase()}`, token: fakeToken });
  }

  // (c) Validate — the same schema the island runs client-side.
  const parsed = reservationRequestSchema(context.locals.locale).safeParse(payload);
  if (!parsed.success) {
    return json(400, { errors: fieldErrors(parsed.error.issues) });
  }
  const input = parsed.data;

  const supabase = context.locals.supabase;

  // The vehicle must exist and be active (RLS hides inactive rows). Fetched
  // here anyway because the confirmation email needs its display fields.
  const vehicle = await getVehicleById(supabase, input.vehicle_id);
  if (!vehicle) {
    return json(409, { error: t("vehicleUnavailable"), reason: "unavailable" });
  }

  // (d) Pre-check: friendly early exit when the range was just taken.
  const available = await isVehicleAvailable(supabase, input.vehicle_id, input.pickup, input.return);
  if (!available) {
    return json(409, { error: t("bookingConflict"), reason: "conflict" });
  }

  // (e) The atomic write — a lost race still lands here as a typed `conflict`,
  // never a 500 (the EXCLUDE constraint is the truth; first insert wins).
  //
  // The locale is stamped from the SESSION, not from the body: on this one path
  // the sender IS the customer, so the language they read the funnel in is the
  // language they want to be mailed in — and taking it server-side keeps a
  // crafted payload from choosing what language we write to a stranger in.
  // This is the funnel's only chance to record it; the confirmation is sent days
  // later by staff who cannot know.
  //
  // The consent attribution rides the same rule and for the same reason. Both
  // values describe what the SERVER rendered on `/terms` — the version constant
  // it exports and the locale it rendered the funnel in — so neither is read off
  // the body. A body field here would let a crafted payload record a consent to
  // a document that was never shown, which is precisely the claim these columns
  // exist to be able to make. (The window where a deploy bumps `TERMS_VERSION`
  // between render and submit is real and knowingly accepted: this is an
  // SSR'd page, so it is minutes wide, and a stamp one version ahead is a far
  // smaller lie than an attacker-chosen one.)
  const result = await createReservationRequest(supabase, {
    ...input,
    locale: context.locals.locale,
    terms_version: TERMS_VERSION,
    terms_locale: context.locals.locale,
  });
  if (result.status === "conflict") {
    return json(409, { error: t("bookingConflict"), reason: "conflict" });
  }
  if (result.status === "unavailable") {
    return json(409, { error: t("vehicleUnavailable"), reason: "unavailable" });
  }

  // (f) Confirmation email with the durable status link. Best-effort: the
  // reservation already exists, so a send failure must not fail the request.
  const statusUrl = new URL(`/r/${result.token}`, context.url.origin).href;
  const vehicleLabel = [
    [vehicle.make ?? vehicle.name, vehicle.model].filter(Boolean).join(" "),
    vehicle.production_year ? `(${vehicle.production_year})` : null,
  ]
    .filter(Boolean)
    .join(" ");
  try {
    const content = reservationReceivedEmail({
      reference: result.reference,
      statusUrl,
      vehicle: vehicleLabel,
      pickup: input.pickup,
      return: input.return,
      dailyRate: vehicle.daily_rate,
      locale: context.locals.locale,
    });
    await sendEmail({ to: input.customer_email, ...content });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("[api/reservations] confirmation email failed (request still succeeds):", error);
  }

  return json(201, { reference: result.reference, token: result.token });
};
