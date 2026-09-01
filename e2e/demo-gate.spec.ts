// core
import { test, expect } from "@playwright/test";

// ---------------------------------------------------------------------------
// DEMO GATE — MIDDLEWARE WIRING (demo-account-gate)
//
// Risk protected: `src/middleware.ts` stops populating `locals.isDemo`, and the
// three staff gates silently turn off while the whole suite stays green.
//
// Why nothing cheaper catches it. The gate is a chain — `profiles.is_demo` →
// middleware's `.select("role, deactivated_at, is_demo")` → `locals.isDemo` →
// `isDemoAccount()` → 403 — and every other layer tests it with the middle link
// removed. `src/lib/access.test.ts` calls the predicate on a hand-written
// locals. `tests/integration/staff.test.ts` imports the route handlers directly
// and builds its context with `buildApiContext({ isDemo: … })`, so middleware
// never runs. `tests/integration/pages-authz.test.ts` DOES run the real
// middleware, but under a stubbed `astro:env/server` where `createClient()`
// returns null, so it never reaches the profile lookup. Delete `is_demo` from
// that select and every one of those still passes.
//
// What that would cost: `POST /api/staff` invites through the SERVICE-ROLE
// admin client, which bypasses RLS, so Phase 2's DB-layer gate is not behind it
// — the in-handler check IS the only boundary. A demo visitor could mail an
// arbitrary address from the company domain. (`deactivate` is backstopped: it
// calls `deactivate_staff` on the caller's own cookie client, so `auth.uid()`
// resolves and the RPC's `demo` arm still fires. `reset-password` is not.)
//
// The design of the assertion. Both tests send the SAME deliberately-invalid
// body to the SAME route; the only difference is whose session cookie rides
// along. The demo gate sits after the admin check and BEFORE the body parse
// (`src/pages/api/staff.ts` step b2), so:
//
//   demo  → 403 `demo_blocked`   (refused before the body is ever read)
//   admin → 400                  (gets far enough to reject the body)
//
// The admin control is not decoration. Without it this passes for the wrong
// reason the moment anything makes the route 403 universally — a bad `Origin`,
// an unconfigured service-role key — and a universally-refused route would look
// exactly like a working demo gate.
//
// Invalid-on-purpose body: it means neither test provisions a user or sends
// mail, so there is nothing to clean up and no Mailpit traffic to race with the
// specs that read it.
// ---------------------------------------------------------------------------

const INVALID_BODY = {};

/** The route's first gate is a same-origin check, so the header is mandatory. */
function headers(baseURL: string | undefined) {
  return { Origin: baseURL ?? "", "Content-Type": "application/json" };
}

test.describe("demo session", () => {
  test.use({ storageState: "playwright/.auth/demo.json" });

  test("POST /api/staff is refused as demo_blocked — the flag survives the trip through middleware", async ({
    page,
    baseURL,
  }) => {
    // Load a gated page first: it proves the stored session is live, so a
    // failure below is the demo gate and not an expired cookie.
    await page.goto("/dashboard");
    await expect(page.getByRole("button", { name: "Wyloguj" })).toBeVisible();

    const res = await page.request.post("/api/staff", { headers: headers(baseURL), data: INVALID_BODY });

    expect(res.status()).toBe(403);
    // The code is what makes the refusal attributable: `lib/staff-report.ts`
    // maps a bare 403 to the bad-origin/unconfigured sentence, so a 403 without
    // it would render the wrong cause in the roster banner.
    expect(await res.json()).toMatchObject({ code: "demo_blocked" });
  });
});

test.describe("admin session (control)", () => {
  test.use({ storageState: "playwright/.auth/admin.json" });

  test("the identical request from a non-demo admin reaches body validation instead", async ({ page, baseURL }) => {
    await page.goto("/dashboard");
    await expect(page.getByRole("button", { name: "Wyloguj" })).toBeVisible();

    const res = await page.request.post("/api/staff", { headers: headers(baseURL), data: INVALID_BODY });

    // 400, not 403: the request got past the demo gate and died on the schema.
    // If this ever reads 403 the discriminator above has collapsed and the demo
    // test is no longer evidence of anything.
    expect(res.status()).toBe(400);
  });
});
