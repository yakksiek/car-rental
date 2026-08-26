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

// The upper bound used to live on the deleted `/dashboard/search` page's parser;
// with the page gone this is the only search entry, so it belongs here. It is not a
// mirror of anything in the RPC (unlike MIN_QUERY_LENGTH) — it is this endpoint's
// own limit on how long an ILIKE pattern may get before reaching a definer function.
const MAX_QUERY_LENGTH = 100;

const querySchema = z.object({
  q: z.string().trim().min(MIN_QUERY_LENGTH).max(MAX_QUERY_LENGTH),
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

  // The two length failures are NOT the same event, so they do not share a response.
  // Too long is a caller error and says so; too short is the resting state and must
  // not paint an error card over the quick-jumps. Checked before `safeParse` because
  // one schema cannot answer with two statuses.
  const raw = context.url.searchParams.get("q") ?? "";
  if (raw.trim().length > MAX_QUERY_LENGTH) {
    return json(400, { error: "Zapytanie jest za długie." });
  }

  const parsed = querySchema.safeParse({ q: raw });
  // A blank or 1-character query is not an error — it is the resting state. Answer
  // with empty groups so the island renders quick-jumps instead of an error card.
  if (!parsed.success) {
    return json(200, EMPTY_RESULTS);
  }

  const results = await searchStaff(context.locals.supabase, parsed.data.q);
  return json(200, results);
};
