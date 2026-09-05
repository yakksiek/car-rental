// core
import { test, expect } from "@playwright/test";

// others
import { waitForIslands } from "./support/hydration";
import { isInViewport, isTopmostAtItsOwnCentre, scrollToBottom } from "./support/reachability";
import { createRetiredVehicle, deleteVehicle } from "./fixtures/booking";

// ---------------------------------------------------------------------------
// FLEET ADMIN — WHERE the row action's failure is reported
// (invite-journey-fixes, phase 11).
//
// `/dashboard/vehicles` carried phase 10's defect in its row-action half.
// `Restore` is per-row and reachable at any scroll depth; `restore`'s banner is
// anchored above the list. So the message landed outside the viewport — measured
// against the running app, 2026-08-24, with a retired row at the bottom:
//
//   restore failure, 390×844, scrollY 1186 → banner top -879, hit `null`
//
// and `toBeVisible()` passed. That is why this spec asserts BOTH halves rather
// than presence: in the viewport, and topmost at its own centre.
//
// Half of phase 10's problem was already absent here and must STAY absent: the
// retire confirmation reports inside its own dialog (`setDialogError` →
// `RetireDialog`'s `error` prop), which is the shape phase 9 had to build for the
// staff add modal. The second test pins it.
//
// Why a browser: this is a geometry defect. No unit or integration layer can see
// a scroll position or a compositor hit-test, and `staff-report.ts`'s unit
// invariants deliberately do not try — they gate WHICH surface an arm targets,
// never whether that surface is reachable (design-contract §10 entry 4).
//
// Admin session: /dashboard/vehicles is staff-gated, and the admin storageState
// is what the rest of the suite already uses. Fixture rows are created and torn
// down through the service-role client, never by driving another flow.
// ---------------------------------------------------------------------------

test.use({ storageState: "playwright/.auth/admin.json" });

// Pinned at 390×844 for the same reason phase 10's reachability specs are.
//
// This defect only exists on a page tall enough to scroll. Measured 2026-08-24
// with the seeded fleet plus one fixture row and "Show retired" checked: the
// page scrolls 213px at Playwright's default `devices["Desktop Chrome"]`
// viewport and 1186px at 390×844. At the desktop default the banner never leaves
// the viewport — measured top 113 at maximum scroll — so both the assertion AND
// the deliberate-reintroduction check would pass whether or not the fix exists,
// a spec that cannot fail. The desktop reading stays a manual gate.
//
// Consequence carried deliberately: below `md` the fleet renders the CARD list,
// not the table (`FleetList.tsx`), so the locators here are the cards' own
// full-label buttons rather than the table's.
test.describe("the fleet banner is reachable from the row that set it", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("a failed Restore from a row below the fold is readable without scrolling", async ({ page }) => {
    // The fixture is the whole reason this spec can fail. The seed's single
    // retired vehicle (`Fiat Ducato (retired)`) sorts FIRST by name, so its
    // `Restore` sits near the top and its banner happens to be in view — a
    // property of the fixture, not of the design. This row sorts last.
    const { vehicleId, name } = await createRetiredVehicle();
    // Stubbed, not really failed: the 409/500 mapping inside `postActive` is not
    // what this spec is about, and an abort is the cheapest way to reach the arm
    // that sets the banner. Same pattern phase 9 used for `POST /api/staff`.
    await page.route("**/api/vehicles/*/active", (route) => route.abort());
    try {
      await page.goto("/dashboard/vehicles");
      await waitForIslands(page);

      // Retired rows are hidden until the toggle is on — this is the only way to
      // get a `Restore` control on screen at all.
      //
      // `.first()` because the fleet renders BOTH surfaces into the DOM and hides
      // one per breakpoint (`hidden md:block` table, `md:hidden` cards), so every
      // vehicle name is present twice at any width.
      await page.getByRole("checkbox", { name: "Show retired" }).check();
      await expect(page.getByText(name).first()).toBeAttached();

      const scrollY = await scrollToBottom(page);
      expect(scrollY, "the fleet must actually scroll or this proves nothing").toBeGreaterThan(200);

      // `.last()` is the fixture row — it sorts after every seeded vehicle.
      await page.getByRole("button", { name: "Restore" }).last().click();

      const banner = page.getByText("Something went wrong. Try again.");
      await expect(banner).toBeVisible();
      // THE PHASE-11 ASSERTIONS. Before the fix this banner sat at top -804 with
      // `elementFromPoint` answering `null`, and `toBeVisible()` passed anyway.
      expect(await isInViewport(banner), "banner is outside the viewport").toBe(true);
      expect(await isTopmostAtItsOwnCentre(banner), "banner is covered").toBe(true);
      // The admin was not moved to achieve that — the property that separates a
      // pinned banner from one scrolled into view, which would land near 0.
      // `>=` rather than `===` because Chrome's SCROLL ANCHORING bumps scrollY by
      // the banner's own height when it is inserted above the viewport, which is
      // the browser keeping the visible content still — the effect we want.
      expect(await page.evaluate(() => Math.round(window.scrollY))).toBeGreaterThanOrEqual(scrollY);

      // Pinning removed the only exit the design had (scrolling past it), so the
      // ✕ is what replaces it. The fleet banner carries no `Retry` — the row's
      // own `Restore` is the retry, so exactly one retry control is on screen.
      await expect(page.getByRole("button", { name: "Retry" })).toHaveCount(0);
      await page.getByRole("button", { name: "Close" }).click();
      await expect(banner).toHaveCount(0);
      // Dismissing the message must not remove the row it was about — the
      // vehicle is still retired, because the abort changed nothing server-side.
      await expect(page.getByText(name).first()).toBeAttached();
    } finally {
      await page.unroute("**/api/vehicles/*/active");
      await deleteVehicle(vehicleId);
    }
  });

  test("the retire confirm dialog still reports its own failure inside the dialog", async ({ page }) => {
    // The arm phase 11 must NOT move. Fleet got the modal half right before this
    // change was written, and a fix aimed at the row arm has no business
    // relocating it — the message belongs in the dialog that is still open and
    // still covering the page.
    const { vehicleId, name } = await createRetiredVehicle();
    await page.route("**/api/vehicles/*/active", (route) =>
      route.fulfill({
        status: 409,
        contentType: "application/json",
        body: JSON.stringify({ error: "Pojazd ma aktywne rezerwacje — najpierw je anuluj." }),
      }),
    );
    try {
      await page.goto("/dashboard/vehicles");
      await waitForIslands(page);

      // Retire needs an ACTIVE row, so the control under test is a seeded
      // vehicle's. The fixture is retired and sorts last, so showing it adds a
      // row at the bottom and makes the page taller — which is the point:
      // `.last()` here is the deepest retire control, and Playwright's auto-scroll
      // to it leaves the page scrolled when the dialog opens. A dialog error read
      // at scrollY 0 would prove nothing.
      await page.getByRole("checkbox", { name: "Show retired" }).check();
      await expect(page.getByText(name).first()).toBeAttached();
      await page.getByRole("button", { name: "Retire", exact: true }).last().click();

      await expect(page.getByText("Retire this vehicle from the fleet?")).toBeVisible();
      expect(await page.evaluate(() => Math.round(window.scrollY))).toBeGreaterThan(200);

      // `.last()` again, and now it resolves to a different control: `RetireDialog`
      // renders after the list, so its confirm is DOM-last. The row controls and
      // the dialog's confirm share one accessible name — `Retire` is the verb in
      // both places — which is a copy decision, not something to work around with
      // a test id.
      await page.getByRole("button", { name: "Retire", exact: true }).last().click();

      const error = page.getByText("Pojazd ma aktywne rezerwacje — najpierw je anuluj.");
      await expect(error).toBeVisible();
      // In the dialog means on top of the dialog's own overlay, at any scroll
      // depth — the two assertions the banner arm needed, applied to the arm that
      // already satisfied them, so a regression cannot pass silently.
      expect(await isInViewport(error), "dialog error is outside the viewport").toBe(true);
      expect(await isTopmostAtItsOwnCentre(error), "dialog error is covered").toBe(true);
      // And it did not leak onto the banner, whose ✕ would be on screen if it had.
      await expect(page.getByRole("button", { name: "Close" })).toHaveCount(0);
    } finally {
      await page.unroute("**/api/vehicles/*/active");
      await deleteVehicle(vehicleId);
    }
  });
});
