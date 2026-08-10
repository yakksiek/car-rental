// core
import type { APIRoute } from "astro";
import { z } from "zod";

// others
import { isRoleSufficient } from "../../lib/access";
import { isVehicleAvailable } from "../../lib/services/reservations";

// Live availability check (S-12). The manual-reservation modal debounces a call
// here whenever the vehicle or either date changes, so the employee sees "Termin
// wolny" / "Termin zajęty" before submitting.
//
// ADVISORY ONLY: this is a check-then-act read, so its answer can go stale
// between the check and the submit. The EXCLUDE constraint inside
// `create_confirmed_reservation` is the authority — a lost race is a 409 on the
// create, not a double booking.
//
// Self-gate: auth then role (the /api tree is outside middleware's gate). No
// Origin check — a GET read is not a CSRF sink, matching `reservations/calendar.ts`.

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
// Loose hex-UUID shape, same as the services' guard — `z.uuid()` is strict
// RFC-4122 and would reject the fixed seed ids.
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const MSG = {
  unauthenticated: "Wymagane logowanie.",
  forbidden: "Brak uprawnień.",
  badQuery: "Nieprawidłowe parametry zapytania.",
  failed: "Nie udało się sprawdzić dostępności.",
} as const;

const querySchema = z.object({
  vehicle_id: z.string().regex(UUID_RE),
  pickup: z.string().regex(ISO_DATE),
  return: z.string().regex(ISO_DATE),
});

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

export const GET: APIRoute = async (context) => {
  if (!context.locals.user) {
    return json(401, { error: MSG.unauthenticated });
  }
  if (!isRoleSufficient(context.locals.role, "employee")) {
    return json(403, { error: MSG.forbidden });
  }

  const parsed = querySchema.safeParse({
    vehicle_id: context.url.searchParams.get("vehicle_id"),
    pickup: context.url.searchParams.get("pickup"),
    return: context.url.searchParams.get("return"),
  });
  if (!parsed.success) {
    return json(400, { error: MSG.badQuery });
  }

  // `isVehicleAvailable` THROWS on an RPC error (unlike the advisory reads that
  // swallow), so catch here rather than letting an unhandled rejection 500 with
  // no shape the island can read.
  try {
    const available = await isVehicleAvailable(
      context.locals.supabase,
      parsed.data.vehicle_id,
      parsed.data.pickup,
      parsed.data.return,
    );
    return json(200, { available });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("[api/availability] availability check failed:", error);
    return json(500, { error: MSG.failed });
  }
};
