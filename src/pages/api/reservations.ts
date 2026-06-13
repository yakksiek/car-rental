// core
import type { APIRoute } from "astro";

// others
import { sendEmail } from "../../lib/email";
import { reservationReceivedEmail } from "../../lib/email/templates";
import { reservationRequestSchema } from "../../lib/reservation-schema";
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

const MSG = {
  badOrigin: "Nieprawidłowe źródło żądania.",
  badBody: "Nieprawidłowe zgłoszenie.",
  conflict: "Pojazd właśnie został zarezerwowany w wybranym terminie. Zmień daty i spróbuj ponownie.",
  unavailable: "Ten pojazd nie jest już dostępny.",
} as const;

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
  // (a) CSRF: the browser sends Origin on every cross-site POST; reject anything
  // not same-origin before doing any work (dev origin is http://localhost:4321).
  const origin = context.request.headers.get("origin");
  if (origin !== context.url.origin) {
    return json(403, { error: MSG.badOrigin });
  }

  let payload: unknown;
  try {
    payload = await context.request.json();
  } catch {
    return json(400, { error: MSG.badBody, errors: {} });
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
  const parsed = reservationRequestSchema.safeParse(payload);
  if (!parsed.success) {
    return json(400, { errors: fieldErrors(parsed.error.issues) });
  }
  const input = parsed.data;

  const supabase = context.locals.supabase;

  // The vehicle must exist and be active (RLS hides inactive rows). Fetched
  // here anyway because the confirmation email needs its display fields.
  const vehicle = await getVehicleById(supabase, input.vehicle_id);
  if (!vehicle) {
    return json(409, { error: MSG.unavailable, reason: "unavailable" });
  }

  // (d) Pre-check: friendly early exit when the range was just taken.
  const available = await isVehicleAvailable(supabase, input.vehicle_id, input.pickup, input.return);
  if (!available) {
    return json(409, { error: MSG.conflict, reason: "conflict" });
  }

  // (e) The atomic write — a lost race still lands here as a typed `conflict`,
  // never a 500 (the EXCLUDE constraint is the truth; first insert wins).
  const result = await createReservationRequest(supabase, input);
  if (result.status === "conflict") {
    return json(409, { error: MSG.conflict, reason: "conflict" });
  }
  if (result.status === "unavailable") {
    return json(409, { error: MSG.unavailable, reason: "unavailable" });
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
    });
    await sendEmail({ to: input.customer_email, ...content });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("[api/reservations] confirmation email failed (request still succeeds):", error);
  }

  return json(201, { reference: result.reference, token: result.token });
};
