// core
import { test, expect } from "@playwright/test";

// others
import { ORIENTATION_COOKIE } from "../src/lib/orientation";
import { waitForIslands } from "./support/hydration";

// ---------------------------------------------------------------------------
// The first-visit orientation overlay (staff-panel-discovery Phase 6).
//
// Risk protected: the overlay shows on EVERY visit, or never shows again once
// dismissed by the route that navigates away.
//
// Why this risk needs a browser. "Once per browser, reopenable" is not a
// property of any single module. It is the agreement between four of them:
//
//   1. `shouldAutoShowOrientation` reads the cookie   (unit-tested)
//   2. `POST /api/orientation` writes it              (integration-tested)
//   3. `index.astro` server-renders the answer into the island's props
//   4. the hydrated island closes in place and re-sends the write
//
// Steps 1 and 2 are already proven cheaply and are NOT re-proven here. What no
// cheaper layer can prove is that the four agree — and every way they can
// disagree looks fine in a screenshot. A cookie written with the wrong `path`,
// a prop that is computed but not passed, an island that closes without ever
// posting: each of those ships an overlay that greets the visitor on every
// single page view, which is the failure this file exists to catch.
//
// The second test covers the one control that is deliberately NOT intercepted.
// The staff button submits natively so the cookie is set on the way to sign-in
// rather than racing a fetch the navigation would cancel; if that regressed,
// the overlay would return the moment the visitor came back.
// ---------------------------------------------------------------------------

// The overlay is for anonymous first-time visitors, so opt out of the employee
// session the chromium project loads by default. A signed-in request never
// auto-shows it — which is also why no existing spec had to change.
test.use({ storageState: { cookies: [], origins: [] } });

/** The modal, by the accessible name its visually-hidden dialog title gives it. */
const DIALOG = { name: "About this project" };

test("a first visit shows the overlay once, and the header pill brings it back", async ({ page, context }) => {
  // ── 1. First visit: the overlay is there ────────────────────────────────
  await page.goto("/");
  const overlay = page.getByRole("dialog", DIALOG);
  await expect(overlay).toBeVisible();

  // The island owns the dismiss interception and the reopen listener, and both
  // are inert until it mounts — `e2e-rules.md`, "wait for island hydration".
  await waitForIslands(page);

  // ── 2. Dismissing it reveals the landing page ───────────────────────────
  // `exact` because the skip link at the bottom reads "Skip and explore the
  // site" and a substring match would resolve to both.
  await overlay.getByRole("button", { name: "Explore the site", exact: true }).click();
  await expect(overlay).toBeHidden();
  // The landing page's own heading — the thing the modal was covering. Not the
  // header CTA: that collapses into the action menu below 1444px, so it is
  // absent at Playwright's default viewport.
  await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible();

  // The close is not allowed to wait on the network, so the background write can
  // still be in flight here. Wait for the cookie the server set, not for a
  // duration — that is the state the next assertion actually depends on.
  await expect
    .poll(async () => (await context.cookies()).find((c) => c.name === ORIENTATION_COOKIE)?.value)
    .toBe("seen");

  // ── 3. A reload does NOT show it again ──────────────────────────────────
  // The assertion the whole file exists for. If the cookie, the resolver, the
  // prop or the mount regressed, this is what goes red.
  await page.reload();
  await expect(page.getByRole("dialog", DIALOG)).toBeHidden();

  // ── 4. The header pill brings it back ───────────────────────────────────
  await waitForIslands(page);
  await page.getByRole("button", { name: "About this project" }).click();
  await expect(page.getByRole("dialog", DIALOG)).toBeVisible();
});

test("the staff button reaches sign-in and sets the seen cookie on the way", async ({ page }) => {
  await page.goto("/");
  const overlay = page.getByRole("dialog", DIALOG);
  await expect(overlay).toBeVisible();
  await waitForIslands(page);

  await overlay.getByRole("button", { name: "Go to the staff area" }).click();
  await page.waitForURL("**/auth/signin");

  // Back on the landing page, the overlay must stay closed — proving the native
  // submit set the cookie rather than being cancelled by the navigation.
  await page.goto("/");
  await expect(page.getByRole("dialog", DIALOG)).toBeHidden();
});
