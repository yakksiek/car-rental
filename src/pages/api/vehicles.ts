// core
import type { APIRoute } from "astro";

// others
import { api } from "../../lib/i18n/api";
import { translator } from "../../lib/i18n/types";
import { requireRole } from "../../lib/access";
import { createVehicle, listFleetForPicker } from "../../lib/services/vehicles";
import { firstIssuePerField, vehicleInputSchema } from "../../lib/vehicle-schema";

// Fleet create endpoint (S-04). Mirrors the S-02/S-03 route defenses for an
// authenticated mutation:
//   (a) same-origin `Origin` check (CSRF) before any work,
//   (b) auth + role gate — a signed-out caller is 401, a non-staff role 403
//       (middleware gates /dashboard pages, not /api; the RLS WITH CHECK gates a
//       third time inside `createVehicle`),
//   (c) zod body validation (`vehicleInputSchema`, the shared client/server
//       contract), 400 `{ errors }` on failure,
//   (d) the insert, mapping an RLS denial to 403.
//
// `GET` (S-12b) serves the quick-action menu's bookable-fleet picker. It gates
// (a) auth → 401, (b) role → 403, then returns the seven-column projection. No
// Origin check: it is a read, not a mutation. This is deliberately the two-step
// 401/403 split lessons.md prescribes, NOT the collapsed 403 of
// `api/reservations/calendar.ts` — `vehicles_select_authenticated` is
// `using (true)`, so this handler is the only barrier and must fail closed at
// each step distinctly.

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

export const GET: APIRoute = async (context) => {
  const t = translator(context.locals.locale, api);

  // (a) Auth, then (b) role — no CSRF step: reads carry no state change.
  if (!context.locals.user) {
    return json(401, { error: t("unauthenticated") });
  }
  if (!requireRole(context.locals, "employee")) {
    return json(403, { error: t("forbidden") });
  }

  const vehicles = await listFleetForPicker(context.locals.supabase);
  return json(200, { vehicles });
};

export const POST: APIRoute = async (context) => {
  const t = translator(context.locals.locale, api);

  // (a) CSRF: reject anything not same-origin before doing any work.
  const origin = context.request.headers.get("origin");
  if (origin !== context.url.origin) {
    return json(403, { error: t("badOrigin") });
  }

  // (b) Auth + role gate: a signed-out caller is 401, a non-staff role 403.
  if (!context.locals.user) {
    return json(401, { error: t("unauthenticated") });
  }
  if (!requireRole(context.locals, "employee")) {
    return json(403, { error: t("forbidden") });
  }

  let payload: unknown;
  try {
    payload = await context.request.json();
  } catch {
    return json(400, { error: t("badBody"), errors: {} });
  }

  // (c) Validate — the same schema the island runs client-side.
  const parsed = vehicleInputSchema(context.locals.locale).safeParse(payload);
  if (!parsed.success) {
    return json(400, { errors: firstIssuePerField(parsed.error.issues) });
  }

  // (d) Insert through the authed client; an RLS WITH CHECK denial is 403. A
  // duplicate plate is a user-correctable field error, not a fault — it rides the
  // same `{ errors }` shape the island already re-maps onto inputs.
  const result = await createVehicle(context.locals.supabase, parsed.data);
  if (result.status === "unauthorized") {
    return json(403, { error: t("forbidden") });
  }
  if (result.status === "duplicate_plate") {
    return json(400, { errors: { plate: t("duplicatePlate") } });
  }
  return json(201, { vehicle: result.vehicle });
};
