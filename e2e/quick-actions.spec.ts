// core
import { test, expect } from "@playwright/test";

// others
import { waitForIslands } from "./support/hydration";

// ---------------------------------------------------------------------------
// QUICK-ACTION MENU → MANUAL RESERVATION (S-12b, plan Phase 5).
//
// Risk protected: `test-plan.md` risk #4's rendered half — "a route 'is
// protected' ≠ it is actually reachable by the role that needs it". The
// authorization triple on `GET /api/vehicles` (anon 401 / role-null 403 /
// employee 200) is proven deterministically in
// `tests/integration/api-authz.test.ts`; nothing there proves a signed-in
// staffer's browser can actually get that payload into the picker.
//
// Why this one needs a browser. S-12 handed the modal an SSR-loaded `Vehicle[]`
// prop, so the fleet was on the page before any interaction. S-12b replaced that
// with a fetch issued from the hydrated island *at pick time*, over a cookie
// session, against a route that self-gates. That chain — hydrated trigger →
// menu → `fetch('/api/vehicles')` with the session cookie → the seven-column
// projection → the modal's `<select>` — exists only at runtime, in a browser.
// Neither the unit tests (which see `buildQuickActions`, not the network) nor
// the integration tests (which invoke the handler directly with a constructed
// context, no cookies and no DOM) can reach it. A regression here — a dropped
// cookie, a gate that 403s a real employee, a modal mounted before its data —
// is invisible to every cheaper layer and total for the user: the menu opens
// onto nothing.
//
// Employee session (the chromium project's default, lowest privilege that
// clears the /dashboard gate). Read-only: the spec stops at the populated
// picker and creates nothing, so there is nothing to tear down — the create
// path itself is covered by `tests/integration/manual-reservation-api.test.ts`.
// ---------------------------------------------------------------------------

test("quick-action menu fetches the fleet on demand and opens the manual-reservation modal with it", async ({
  page,
}) => {
  await page.goto("/dashboard/reservations");

  // The pill is a `client:load` island in the shell band: pre-hydration its
  // markup is present and its click handler is not, so a click here would be
  // silently swallowed.
  await waitForIslands(page);

  await page.getByRole("button", { name: "New" }).click();

  const reservationRow = page.getByRole("button", { name: /New reservation/ });
  await expect(reservationRow).toBeVisible();

  // Wait on the response, never a timeout. This is the request that only exists
  // because the fleet is no longer an SSR prop.
  const [response] = await Promise.all([
    page.waitForResponse((r) => r.url().includes("/api/vehicles") && r.request().method() === "GET"),
    reservationRow.click(),
  ]);
  expect(response.status()).toBe(200);

  // The business outcome: the modal is open AND its picker carries the fleet the
  // staffer can actually book. An empty picker would mean the fetch landed but
  // never reached the modal — exactly the failure this spec exists to catch.
  const picker = page.getByRole("combobox", { name: "Pojazd" });
  await expect(picker).toBeVisible();
  await expect.poll(async () => picker.locator("option").count()).toBeGreaterThan(0);
});
