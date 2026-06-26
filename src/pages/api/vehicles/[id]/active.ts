// core
import type { APIRoute } from "astro";
import { z } from "zod";

// others
import { requireRole } from "../../../../lib/access";
import { setVehicleActive } from "../../../../lib/services/vehicles";

// Fleet retire/restore endpoint (S-04). Toggles `is_active` through the atomic
// `set_vehicle_active` definer RPC — the only "remove" path (hard delete stays
// denied). Defenses mirror the create/edit routes:
//   (a) same-origin `Origin` check (CSRF),
//   (b) auth + role gate (401 signed-out / 403 non-staff),
//   (c) body validation — just `{ active: boolean }`,
//   (d) the guarded flip, whose result tag maps to HTTP. The north-star case is
//       `has_active_reservations` → 409: retiring a vehicle with pending/confirmed
//       reservations is blocked, surfaced with a Polish message for the UI.

const MSG = {
  badOrigin: "Nieprawidłowe źródło żądania.",
  badBody: "Nieprawidłowe zgłoszenie.",
  unauthenticated: "Wymagane logowanie.",
  forbidden: "Brak uprawnień.",
  notFound: "Nie znaleziono pojazdu.",
  hasActiveReservations: "Pojazd ma aktywne rezerwacje — najpierw je anuluj.",
} as const;

const activeSchema = z.object({ active: z.boolean() });

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

  let payload: unknown;
  try {
    payload = await context.request.json();
  } catch {
    return json(400, { error: MSG.badBody });
  }

  // (c) Validate the toggle target.
  const parsed = activeSchema.safeParse(payload);
  if (!parsed.success) {
    return json(400, { error: MSG.badBody });
  }

  // (d) The guarded flip. The RPC is the authority for the retire guard — two
  // employees racing here both go through it safely.
  const result = await setVehicleActive(context.locals.supabase, id, parsed.data.active);
  switch (result.status) {
    case "ok":
      return json(200, { status: "ok" });
    case "has_active_reservations":
      return json(409, { error: MSG.hasActiveReservations, status: "has_active_reservations" });
    case "not_found":
      return json(404, { error: MSG.notFound });
    case "unauthorized":
      return json(403, { error: MSG.forbidden });
  }
};
