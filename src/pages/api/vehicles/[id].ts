// core
import type { APIRoute } from "astro";

// others
import { requireRole } from "../../../lib/access";
import { updateVehicle } from "../../../lib/services/vehicles";
import { firstIssuePerField, vehicleInputSchema } from "../../../lib/vehicle-schema";

// Fleet edit endpoint (S-04). Same defenses as the create route, keyed by the
// `[id]` path param; the full validated payload replaces the vehicle's fields.
//   (a) same-origin `Origin` check (CSRF),
//   (b) auth + role gate (401 signed-out / 403 non-staff),
//   (c) zod body validation (`vehicleInputSchema`), 400 `{ errors }` on failure,
//   (d) the update — a missing/hidden row is 404, an RLS denial 403.

const MSG = {
  badOrigin: "Nieprawidłowe źródło żądania.",
  badBody: "Nieprawidłowe zgłoszenie.",
  unauthenticated: "Wymagane logowanie.",
  forbidden: "Brak uprawnień.",
  notFound: "Nie znaleziono pojazdu.",
  duplicatePlate: "Pojazd o tym numerze rejestracyjnym już istnieje.",
} as const;

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

export const PATCH: APIRoute = async (context) => {
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

  let payload: unknown;
  try {
    payload = await context.request.json();
  } catch {
    return json(400, { error: MSG.badBody, errors: {} });
  }

  // (c) Validate — the same schema as create.
  const parsed = vehicleInputSchema.safeParse(payload);
  if (!parsed.success) {
    return json(400, { errors: firstIssuePerField(parsed.error.issues) });
  }

  // (d) Update through the authed client.
  const result = await updateVehicle(context.locals.supabase, id, parsed.data);
  switch (result.status) {
    case "updated":
      return json(200, { vehicle: result.vehicle });
    case "not_found":
      return json(404, { error: MSG.notFound });
    case "unauthorized":
      return json(403, { error: MSG.forbidden });
    case "duplicate_plate":
      return json(400, { errors: { plate: MSG.duplicatePlate } });
  }
};
