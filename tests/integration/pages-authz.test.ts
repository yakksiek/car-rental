// core
import { describe, expect, it } from "vitest";
import type { APIContext } from "astro";

// others
import { onRequest as rawOnRequest } from "../../src/middleware";

// `onRequest` is `defineMiddleware(...)` from the `astro:middleware` virtual
// module, whose ambient types aren't in scope for a test file — so the
// type-checked lint sees its type as unresolved. Pin it to the minimal shape
// this suite exercises (a page request → a Response). Astro resolves the real
// types at build time; this is purely to keep the lint type-aware.
type PageMiddleware = (context: APIContext, next: () => Response) => Promise<Response>;
const onRequest = rawOnRequest as unknown as PageMiddleware;

// Page-gate suite (S-05 Phase 6). The `/api` tree self-gates in each handler
// (covered by api-authz.test.ts); the `/dashboard` PAGE tree is gated centrally
// by `src/middleware.ts` via `ROUTE_ROLES`. This exercises the real middleware +
// real access rules against the real path strings, so a regression that dropped
// `/dashboard/pickups` from the gate (or mis-ordered the fail-closed branch)
// fails here.
//
// Under Vitest `astro:env/server` is stubbed to an unconfigured deployment, so
// `createClient` returns null and `locals.user` is null — precisely the
// anonymous caller. A configured deployment with no session cookie resolves the
// same `user = null`, so the redirect behaviour asserted here is identical.

/** Minimal APIContext the middleware reads: url + request + cookies + locals + redirect. */
function pageContext(pathname: string): APIContext {
  const url = new URL(pathname, "http://localhost:4321");
  return {
    request: new Request(url),
    url,
    cookies: {},
    locals: {},
    redirect: (location: string) => new Response(null, { status: 302, headers: { location } }),
  } as unknown as APIContext;
}

const passthrough = () => new Response("OK", { status: 200 });

describe("page auth gate (S-05 Phase 6)", () => {
  it("redirects an anonymous caller from /dashboard/pickups to /auth/signin", async () => {
    const res = await onRequest(pageContext("/dashboard/pickups"), passthrough);

    expect(res.status).toBe(302);
    const location = res.headers.get("location") ?? "";
    expect(location.startsWith("/auth/signin")).toBe(true);
    // The intended destination is preserved so sign-in can return the user there.
    expect(location).toContain(encodeURIComponent("/dashboard/pickups"));
  });

  it("redirects an anonymous caller from a /dashboard/protocols/[id] view too", async () => {
    const res = await onRequest(pageContext("/dashboard/protocols/dddddddd-0000-0000-0000-000000000001"), passthrough);

    expect(res.status).toBe(302);
    expect((res.headers.get("location") ?? "").startsWith("/auth/signin")).toBe(true);
  });

  it("does NOT gate a public path — the redirect is path-specific, not blanket", async () => {
    const res = await onRequest(pageContext("/"), passthrough);

    expect(res.status).toBe(200);
    expect(await res.text()).toBe("OK");
  });
});
