// others
import { Constants } from "../db/database.types";
import type { CatalogSort, VehicleCategory, VehicleFilters } from "../types";
import { bookingWindow } from "./availability";

// Single source for catalog state in the URL. The fleet listing reads filters
// from `Astro.url.searchParams`; the filter island writes them back via
// `serializeFilters` and navigates. `validateDateRange` is the third mirror of
// the booking rule (after the SQL `EXCLUDE` and `availability.ts`): it reuses
// `bookingWindow`'s fixed hotel hours so the picker, the RPC, and the DB cannot
// disagree about what a valid range is.

// URL parameter keys — the contract the island and the page share.
export const PARAM = {
  category: "category",
  pickup: "pickup",
  return: "return",
  minPayload: "minPayload",
  sort: "sort",
} as const;

const VALID_SORTS: readonly CatalogSort[] = ["price_asc", "price_desc"];

// Polish validation copy (canonical UI language).
const MSG = {
  incomplete: "Wybierz datę odbioru i datę zwrotu.",
  invalidFormat: "Nieprawidłowy format daty.",
  pastPickup: "Data odbioru nie może być w przeszłości.",
  returnBeforePickup: "Data zwrotu musi być późniejsza niż data odbioru.",
} as const;

type DateRangeResult = { ok: true } | { ok: false; error: string };

/** True iff `value` is a real `YYYY-MM-DD` calendar date. */
function isValidIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }
  const [year, month, day] = value.split("-").map(Number);
  const d = new Date(Date.UTC(year, month - 1, day));
  return d.getUTCFullYear() === year && d.getUTCMonth() === month - 1 && d.getUTCDate() === day;
}

/** Today's local calendar date as `YYYY-MM-DD`. */
function todayIso(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function isValidCategory(value: string): value is VehicleCategory {
  return (Constants.public.Enums.vehicle_category as readonly string[]).includes(value);
}

function isValidSort(value: string): value is CatalogSort {
  return (VALID_SORTS as readonly string[]).includes(value);
}

/**
 * Read catalog filter state from URL search params. Unknown / malformed values
 * fall back to `null` (the unfiltered default) rather than throwing — a bad URL
 * degrades to the full listing, never an error page.
 */
export function parseFilters(searchParams: URLSearchParams): VehicleFilters {
  const rawCategory = searchParams.get(PARAM.category);
  const rawPickup = searchParams.get(PARAM.pickup);
  const rawReturn = searchParams.get(PARAM.return);
  const rawMinPayload = searchParams.get(PARAM.minPayload);
  const rawSort = searchParams.get(PARAM.sort);

  const minPayloadNum = rawMinPayload === null ? NaN : Number(rawMinPayload);

  return {
    category: rawCategory && isValidCategory(rawCategory) ? rawCategory : null,
    pickup: rawPickup && isValidIsoDate(rawPickup) ? rawPickup : null,
    return: rawReturn && isValidIsoDate(rawReturn) ? rawReturn : null,
    minPayload: Number.isFinite(minPayloadNum) && minPayloadNum > 0 ? minPayloadNum : null,
    sort: rawSort && isValidSort(rawSort) ? rawSort : null,
  };
}

/**
 * Serialize filters to URL search params, emitting only the keys that are set.
 * `parseFilters(serializeFilters(f))` round-trips any valid `VehicleFilters`.
 */
export function serializeFilters(filters: VehicleFilters): URLSearchParams {
  const params = new URLSearchParams();
  if (filters.category) {
    params.set(PARAM.category, filters.category);
  }
  if (filters.pickup) {
    params.set(PARAM.pickup, filters.pickup);
  }
  if (filters.return) {
    params.set(PARAM.return, filters.return);
  }
  if (filters.minPayload !== null && filters.minPayload > 0) {
    params.set(PARAM.minPayload, String(filters.minPayload));
  }
  if (filters.sort) {
    params.set(PARAM.sort, filters.sort);
  }
  return params;
}

/**
 * Validate a chosen pickup/return range against the booking rule before it
 * reaches the availability RPC (which would error on an empty/inverted
 * `tsrange`). Both-absent is a valid "no date filter" state. The window must be
 * strictly positive under `bookingWindow`'s fixed hours (pickup 14:00, return
 * 10:00), so a return on the pickup day is rejected; a pickup of *today* is
 * allowed (not a past pickup). `today` is injectable for deterministic tests.
 */
export function validateDateRange(
  pickup: string | null,
  returnDate: string | null,
  today: string = todayIso(),
): DateRangeResult {
  // No range at all → fine; the listing path runs unfiltered by date.
  if (!pickup && !returnDate) {
    return { ok: true };
  }
  // A half-filled range is incomplete.
  if (!pickup || !returnDate) {
    return { ok: false, error: MSG.incomplete };
  }
  if (!isValidIsoDate(pickup) || !isValidIsoDate(returnDate)) {
    return { ok: false, error: MSG.invalidFormat };
  }
  if (pickup < today) {
    return { ok: false, error: MSG.pastPickup };
  }
  // Reuse the half-open booking window: a valid rental needs start < end, which
  // rejects both return < pickup and a same-day (return == pickup) range.
  const window = bookingWindow(pickup, returnDate);
  if (window.start >= window.end) {
    return { ok: false, error: MSG.returnBeforePickup };
  }
  return { ok: true };
}
