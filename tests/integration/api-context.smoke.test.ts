// core
import { describe, expect, it } from "vitest";

// others
import { GET } from "../../src/pages/api/reservations/calendar";
import { anonContext, asContext } from "../helpers/context";

// Harness self-check for `buildApiContext` (Phase 1). Proves the constructed
// APIContext actually drives a real exported route handler against local
// Supabase — one allow case and one deny case — before the authz/validation
// matrices (Phase 2/3) build on it.
//
// `calendar.ts` GET is the ideal probe: read-only (no disposable data, no
// teardown), role-gated to employee, and it reads `context.url.searchParams`,
// `context.locals.role` and `context.locals.supabase` — exercising every field
// the factory must populate. A far-future window returns zero rows but still
// 200, so the assertion stays independent of seed data.

const CAL_QUERY = "?start=2099-07-01&end=2099-07-31";

describe("buildApiContext harness smoke", () => {
  it("drives the calendar GET as employee → 200 (allow path)", async () => {
    const context = await asContext("employee", {
      method: "GET",
      path: `/api/reservations/calendar${CAL_QUERY}`,
    });

    const res = await GET(context);

    expect(res.status).toBe(200);
  });

  it("denies an anon caller on the same route → 403 (deny path, real anon context)", async () => {
    // anonContext carries the anon key + null role — a real unauthenticated
    // caller, NOT a service-role bypass, so the 403 proves the route's own gate.
    const context = anonContext({
      method: "GET",
      path: `/api/reservations/calendar${CAL_QUERY}`,
    });

    const res = await GET(context);

    expect(res.status).toBe(403);
  });
});
