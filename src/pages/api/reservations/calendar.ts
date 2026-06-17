// core
import type { APIRoute } from "astro";
import { z } from "zod";

// others
import { isRoleSufficient } from "../../../lib/access";
import { listReservationsForCalendar } from "../../../lib/services/reservations";

// Calendar range refetch (S-03 Phase 7). The island calls this when the visible
// window changes, instead of a full page navigation. Role-gated to employee (the
// /api tree is not covered by the page middleware); GET read, so no Origin check.
// Returns the raw CalendarReservation rows — the island maps them to events.

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

const querySchema = z.object({
  start: z.string().regex(ISO_DATE),
  end: z.string().regex(ISO_DATE),
});

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

export const GET: APIRoute = async (context) => {
  if (!isRoleSufficient(context.locals.role, "employee")) {
    return json(403, { error: "Brak uprawnień." });
  }

  const parsed = querySchema.safeParse({
    start: context.url.searchParams.get("start"),
    end: context.url.searchParams.get("end"),
  });
  if (!parsed.success) {
    return json(400, { error: "Nieprawidłowy zakres dat." });
  }

  const rows = await listReservationsForCalendar(context.locals.supabase, parsed.data.start, parsed.data.end);
  return json(200, rows);
};
