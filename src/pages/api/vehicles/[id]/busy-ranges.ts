// core
import type { APIRoute } from "astro";

// others
import { api } from "../../../../lib/i18n/api";
import { translator } from "../../../../lib/i18n/types";
import { isRoleSufficient } from "../../../../lib/access";
import { getVehicleBusyRanges } from "../../../../lib/services/reservations";

// Per-vehicle busy ranges for staff (S-12a). The manual-reservation modal
// switches vehicle client-side, so — unlike the public detail page, whose
// vehicle is fixed by the URL and whose ranges are SSR'd in — it needs an HTTP
// read. The payload is PII-safe by construction: `get_vehicle_busy_ranges` is a
// definer RPC returning date bounds only, with no customer identity and no
// reference.
//
// ADVISORY, like the check it replaces: this is a check-then-act read whose
// answer can go stale between the pick and the submit. The EXCLUDE constraint
// inside `create_confirmed_reservation` is the authority — a lost race is a 409
// on the create, not a double booking. The modal re-reads here as a pre-flight
// at submit time so the gating verdict is as fresh as the write.
//
// Self-gate: auth then role (the /api tree is outside middleware's gate). No
// Origin check — a GET read is not a CSRF sink, matching `reservations/calendar.ts`.

// Loose hex-UUID shape, same as the services' guard — `z.uuid()` is strict
// RFC-4122 and would reject the fixed seed ids.
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      // Availability answers must never be replayed from a cache. The modal's
      // pre-flight already passes `cache: "no-store"` on its own fetch, but that
      // only binds THAT caller — this binds the response itself, so a future
      // caller or any intermediary is covered too. Cheap: the read is per-vehicle
      // and already indexed.
      "Cache-Control": "no-store",
    },
  });
}

export const GET: APIRoute = async (context) => {
  const t = translator(context.locals.locale, api);

  if (!context.locals.user) {
    return json(401, { error: t("unauthenticated") });
  }
  if (!isRoleSufficient(context.locals.role, "employee")) {
    return json(403, { error: t("forbidden") });
  }

  const id = context.params.id;
  if (!id || !UUID_RE.test(id)) {
    return json(400, { error: t("badQuery") });
  }

  // Fail closed: the read reports its own failures (`ok: false`), and an empty
  // list is indistinguishable from a genuinely free vehicle. Answering 200 with
  // `[]` here would paint an empty calendar under a green "Termin wolny" and arm
  // the submit button. Same shape and message as the retired availability GET's
  // own 500, so the island's error state needs no new branch.
  const { ok, ranges } = await getVehicleBusyRanges(context.locals.supabase, id);
  if (!ok) {
    return json(500, { error: t("availabilityFailed") });
  }
  return json(200, { ranges });
};
