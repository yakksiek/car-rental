// core
import { test, expect } from "@playwright/test";

// others
import { waitForIslands } from "./support/hydration";

// ---------------------------------------------------------------------------
// Risk protected: "a phone visitor on a public page cannot reach the other
// public pages because the menu fails to open, hydrate, or navigate, or the
// landing page silently ships a different menu than the rest of the site."
//
// Named here rather than in `test-plan.md`'s register: it belongs to this change
// (`context/changes/public-mobile-nav-alignment/`), not to the standing risk map.
//
// Why this risk needs a browser. Two reasons, and neither is reachable below
// this layer.
//
// 1. Hydration. The hamburger is a `client:idle` island. Astro server-renders it
//    and hydrates it afterwards, so between paint and hydration the button is
//    fully present and fully inert — a click in that window is silently lost and
//    the menu never opens. Nothing but a real browser can observe that window.
//    `waitForIslands` is what makes the click land; see `e2e/e2e-rules.md`.
//
// 2. Two headers, one island. `LandingNav.astro` and `SiteHeader.astro` are
//    separate components that now mount the SAME `MobileNav` island in two
//    tones. That sharing is the whole point of this change, and it is invisible
//    to every cheaper layer: there is no DOM or component test layer in this
//    repo (`CLAUDE.md`), so nothing below Playwright renders either header. A
//    regression that reverted the landing to its own menu — or that broke the
//    shared overlay for the eight `SiteHeader` pages — would type-check, lint,
//    build, and pass the whole unit suite. So the two tests below deliberately
//    drive the same flow from BOTH headers: that is the assertion, not
//    duplication.
//
// Both tests address the overlay through `getByRole("dialog", { name: "Menu" })`
// and reach the links THROUGH that dialog. The scoping is load-bearing, not
// stylistic: "Pricing" matches two links on a public page — the one in the
// overlay and the one in the site footer — so an unscoped locator would be
// ambiguous, and a locator that resolved to the footer would pass while the
// menu was entirely broken.
//
// No fixture rows are needed (these are public, read-only pages), so there is
// nothing to clean up.
// ---------------------------------------------------------------------------

// Anonymous visitor at phone width. The public header is a logged-out surface,
// so opt out of the employee session the chromium project loads by default; the
// anonymous default locale is `en`, which is why the labels below are English.
// The viewport is set per file rather than by adding a mobile Playwright
// project — the overlay only renders below `md`.
test.use({
  storageState: { cookies: [], origins: [] },
  viewport: { width: 390, height: 844 },
});

test("a phone visitor can open the landing menu, close it with Escape, and reach another public page", async ({
  page,
}) => {
  await page.goto("/");
  await waitForIslands(page);

  // Opens at all: the risk's first failure mode is a menu that never appears.
  await page.getByRole("button", { name: "Menu", exact: true }).click();
  const menu = page.getByRole("dialog", { name: "Menu" });
  await expect(menu).toBeVisible();

  // Escape closes it. The landing is the DARK tone — the surface this change
  // added — so the close path is proven here rather than on a `SiteHeader` page.
  await page.keyboard.press("Escape");
  await expect(menu).toBeHidden();

  // Reopening proves the island's state resets rather than latching closed.
  await page.getByRole("button", { name: "Menu", exact: true }).click();
  await expect(menu).toBeVisible();

  // The business outcome: the visitor actually reaches another public page.
  await menu.getByRole("link", { name: "Pricing" }).click();
  await page.waitForURL("/pricing");
  await expect(menu).toBeHidden();
});

test("a phone visitor can open the same menu from a SiteHeader page and reach another public page", async ({
  page,
}) => {
  await page.goto("/fleet");
  await waitForIslands(page);

  await page.getByRole("button", { name: "Menu", exact: true }).click();
  const menu = page.getByRole("dialog", { name: "Menu" });
  await expect(menu).toBeVisible();

  await menu.getByRole("link", { name: "Pricing" }).click();
  await page.waitForURL("/pricing");
  await expect(menu).toBeHidden();
});
