// core
import type { APIRoute } from "astro";
import { z } from "zod";

// others
import { isRoleSufficient } from "../../lib/access";
import { MIN_QUERY_LENGTH, searchStaff } from "../../lib/services/search";

// Staff global search (S-13 Phase 1). The live endpoint behind the ⌘K dropdown —
// the island debounces keystrokes onto it and renders the grouped response.
//
// The /api tree is NOT covered by the page middleware (`ROUTE_ROLES` lists only
// /dashboard prefixes), so this self-gates: auth first, then role. GET read, so no
// Origin/CSRF check. The `search_staff` RPC re-checks the role in the database, so
// this gate is the fast, correctly-shaped 401/403 — not the only line of defence.

const querySchema = z.object({
  q: z.string().trim().min(MIN_QUERY_LENGTH),
});

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

const EMPTY_RESULTS = { reservations: [], returns: [], vehicles: [] };

export const GET: APIRoute = async (context) => {
  if (!context.locals.user) {
    return json(401, { error: "Wymagane logowanie." });
  }
  if (!isRoleSufficient(context.locals.role, "employee")) {
    return json(403, { error: "Brak uprawnień." });
  }

  const parsed = querySchema.safeParse({ q: context.url.searchParams.get("q") ?? "" });
  // A blank or 1-character query is not an error — it is the resting state. Answer
  // with empty groups so the island renders quick-jumps instead of an error card.
  if (!parsed.success) {
    return json(200, EMPTY_RESULTS);
  }

  const results = await searchStaff(context.locals.supabase, parsed.data.q);
  return json(200, results);
};
