// core
import { test, expect, type Page } from "@playwright/test";
import { format } from "date-fns";
import { pl } from "date-fns/locale";

// others
import { createBookedVehicle, deleteVehicle, nextMonthDay } from "./fixtures/booking";
import { waitForIslands } from "./support/hydration";

// ---------------------------------------------------------------------------
// SEED TEST — the exemplar every other spec in `e2e/` is modeled on.
// Read `e2e/e2e-rules.md` alongside it. What this file shows is what a generator
// will produce: role-based locators, one self-contained test with its own
// setup/action/assertion/cleanup, waits on state rather than time, unique test
// data, and a name bound to a named risk.
//
// Risk protected: `context/foundation/test-plan.md` risk #6 — "the dashboard
// shows wrong reservation/availability state (phantom availability) → an
// employee accepts a conflict."
//
// Why this risk needs a browser. The half-open window `[pickup 14:00, return
// 10:00)` is enforced by an EXCLUDE constraint in Postgres and mirrored by the
// pure `dayAvailabilityMap` helper, which `src/lib/availability.test.ts` already
// covers. What no unit test can prove is that the *rendered, hydrated* calendar
// consumes that helper faithfully. It once did not: finding F1 of the S-02
// Phase-6 review shipped a calendar that greyed booked ranges inclusive of both
// bounds, refusing back-to-back rentals the database happily accepts. Extracting
// a correct helper does not prove the widget calls it.
//
// So this test drives the real boundaries — Postgres EXCLUDE window → the
// `get_vehicle_busy_ranges` RPC → the SSR'd vehicle page → the hydrated React
// island — and asserts the calendar agrees with the database in *both*
// directions:
//
//   1. a booking's interior days are genuinely unbookable   (no phantom availability)
//   2. its changeover days stay bookable back-to-back        (no phantom conflict, F1)
//
// Per `test-plan.md`'s anti-pattern note for risk #6 ("asserting rendered DOM
// over the derivation logic"), nothing below touches a CSS class or the greying.
// It asserts only what a user can do: whether a day is disabled, what a screen
// reader announces, and whether the booking actually completes.
// ---------------------------------------------------------------------------

// Anonymous visitor: the booking calendar is a public surface, so opt out of the
// employee session the chromium project loads by default.
test.use({ storageState: { cookies: [], origins: [] } });

/**
 * A calendar day button, located by the accessible name react-day-picker renders
 * under the `pl` locale — e.g. "piątek, 14 sierpnia 2026". Matched as a regex on
 * the date fragment because changeover days carry an extra suffix.
 */
function dayButton(page: Page, isoDate: string) {
  const label = format(new Date(`${isoDate}T12:00:00`), "d MMMM yyyy", { locale: pl });
  return page.getByRole("button", { name: new RegExp(label) });
}

let vehicleId: string | undefined;

test.afterEach(async () => {
  if (vehicleId) {
    await deleteVehicle(vehicleId);
    vehicleId = undefined;
  }
});

test("a confirmed booking blocks its interior days but leaves changeover days bookable", async ({ page }) => {
  // Setup: a vehicle of this test's own, carrying one confirmed booking.
  // Its own vehicle is what makes the spec safe under `fullyParallel` — two
  // tests can never contend for the same calendar.
  const booked = await createBookedVehicle();
  vehicleId = booked.vehicleId;

  const interiorDay = nextMonthDay(12); // strictly inside [bookedFrom, bookedTo]
  const newReturnDay = nextMonthDay(16); // two days after the booking ends

  await page.goto(`/fleet/${booked.vehicleId}`);

  // BookingWidget is a `client:load` island: its day buttons are rendered by the
  // server but carry no click handlers until React mounts. Clicking early is a
  // silent no-op, so wait for the island to become interactive before driving it.
  await waitForIslands(page);

  // The fixture books next month; the calendar opens on the current one.
  await page.getByRole("button", { name: "Go to the Next Month" }).click();
  await expect(dayButton(page, booked.bookedTo)).toBeVisible();

  // (1) No phantom availability: an interior day of a confirmed booking cannot
  // be picked at all. If the calendar ever stopped reading the busy ranges, this
  // day would become selectable and a visitor could request a conflicting range.
  await expect(dayButton(page, interiorDay)).toBeDisabled();

  // (2) No phantom conflict (regression guard for F1): the booking's return day
  // is half-free — its morning belongs to the old booking, its afternoon does
  // not — so it must remain selectable, and announce itself as pickup-only.
  await expect(dayButton(page, booked.bookedTo)).toBeEnabled();
  await expect(dayButton(page, booked.bookedTo)).toHaveAccessibleName(/dostępny tylko jako dzień odbioru/);

  // Symmetrically, the booking's pickup day stays valid as a new *return*.
  await expect(dayButton(page, booked.bookedFrom)).toHaveAccessibleName(/dostępny tylko jako dzień zwrotu/);

  // Action: book back-to-back — pick up at 14:00 on the very day the previous
  // rental returns at 10:00. The EXCLUDE constraint permits this; before F1 was
  // fixed, the UI did not.
  await dayButton(page, booked.bookedTo).click();
  await dayButton(page, newReturnDay).click();

  // Assertion: the funnel actually accepts the range and carries it forward.
  // A greyed-out changeover day would leave this button disabled and never
  // navigate — which is precisely how the risk shows up to a customer.
  const reserve = page.getByRole("button", { name: "Zarezerwuj" });
  await expect(reserve).toBeEnabled();
  await reserve.click();

  await page.waitForURL(
    (url) =>
      url.pathname === "/reserve" &&
      url.searchParams.get("pickup") === booked.bookedTo &&
      url.searchParams.get("return") === newReturnDay,
  );
});
