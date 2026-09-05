// others
import { checkRangeBookable } from "./availability";
import { validateDateRange } from "./catalog-filters";
import { dashboard } from "./i18n/dashboard";
import { translator } from "./i18n/types";
import type { Locale } from "./i18n/types";
import type { VehicleBusyRange } from "../types";

// The manual-reservation availability panel's state, and the whole decision that
// drives it (S-12, rewritten in S-12a).
//
// The panel used to ask the server a boolean per (vehicle, pickup, return) and
// this module only answered "can we even ask?". From S-12a the answer is local:
// `checkRangeBookable` over the vehicle's fetched busy ranges — the same pure
// half-day rules the calendar cells and the EXCLUDE constraint agree on — so the
// panel resolves instantly and cannot contradict the days drawn under it.
// Keeping the whole decision here makes it unit-testable without a DOM or a
// network stub.

export type AvailabilityState =
  | { state: "idle" }
  | { state: "checking" }
  | { state: "invalid"; message: string }
  | { state: "available" }
  | { state: "conflict" }
  | { state: "error" };

/** How the vehicle's busy-ranges read is doing — see `useVehicleBusyRanges`. */
export type BusyRangesFetchState = "loading" | "ready" | "error";

/**
 * The two strings the availability panel and the date picker must say
 * IDENTICALLY. D19 requires it — the picker repeats the failure because on
 * mobile it covers the panel outright, and two wordings for one failure would
 * read as two different problems. Resolved from one pair of catalog keys rather
 * than copied into each component's local COPY map, because a copy is exactly
 * what drifts.
 */
export function availabilityCopy(locale: Locale) {
  const t = translator(locale, dashboard);
  return { readFailed: t("availabilityReadFailed"), retry: t("availabilityRetry") } as const;
}

/**
 * The panel's whole state, as a total function of the form plus the ranges
 * fetch. Order matters and is the contract:
 *
 * 1. `idle` — the form is incomplete, so there is nothing to resolve.
 * 2. `invalid` — the range itself is wrong (past pickup / same-day / inverted);
 *    carries the message from `validateDateRange`, the app's single source for
 *    that rule (shared with the picker, the schema and the EXCLUDE constraint).
 *    It beats a still-loading fetch: the range is wrong regardless of what the
 *    vehicle is booked for.
 * 3. `error` — the ranges read failed, so we cannot judge this range. Because
 *    `canCreateReservation` only passes `available`, this leaves submit disabled
 *    — the safe default, preserved rather than re-derived.
 * 4. `checking` — the read is in flight.
 * 5. `available` / `conflict` — `checkRangeBookable` over the fetched ranges.
 */
export function resolveAvailability(
  vehicleId: string,
  pickup: string,
  returnDate: string,
  ranges: VehicleBusyRange[],
  rangesState: BusyRangesFetchState,
  locale: Locale,
): AvailabilityState {
  if (!vehicleId || !pickup || !returnDate) {
    return { state: "idle" };
  }

  const range = validateDateRange(pickup, returnDate, locale);
  if (!range.ok) {
    return { state: "invalid", message: range.error };
  }

  if (rangesState === "error") {
    return { state: "error" };
  }
  if (rangesState === "loading") {
    return { state: "checking" };
  }

  return checkRangeBookable(ranges, pickup, returnDate).ok ? { state: "available" } : { state: "conflict" };
}

/** Can the booking be submitted? Availability must be confirmed AND the form valid. */
export function canCreateReservation(availability: AvailabilityState, customerValid: boolean): boolean {
  return availability.state === "available" && customerValid;
}
