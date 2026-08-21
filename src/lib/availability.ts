// others
import type { BookingWindow, VehicleBusyRange } from "../types";

// Pure, I/O-free mirror of the DB's no-double-booking rule. This is the exact
// twin of the SQL `EXCLUDE` constraint on `reservations` (migration
// 20260603155136): a half-open hotel-style window per booking, overlap tested
// with the same `&&` semantics. S-02 reuses this to block conflicts in the
// client before submission; the DB constraint remains the atomic backstop.
//
// Hours are fixed and naive-local — pickup 14:00, return 10:00 — matching the
// generated `reserved_period tsrange(pickup + 14:00, return + 10:00, '[)')`.
// Every booking on a vehicle shares one implied local zone, so the zone cancels
// out of any overlap comparison; bare wall-clock numbers give the identical
// verdict. We build those numbers with `Date.UTC` purely as a calendar→epoch
// helper (the offset is the same for both endpoints, so it has no effect on the
// comparison) — never to assert a real-world instant.

const PICKUP_HOUR = 14;
const RETURN_HOUR = 10;

/** A comparable half-open interval `[start, end)` in epoch milliseconds. */
interface Interval {
  start: number;
  end: number;
}

/** Convert an ISO `YYYY-MM-DD` date + a fixed hour into a comparable number. */
function instantOf(isoDate: string, hour: number): number {
  const [year, month, day] = isoDate.split("-").map(Number);
  return Date.UTC(year, month - 1, day, hour);
}

/**
 * Build the half-open booking window `[pickup 14:00, return 10:00)` for a
 * candidate. Same-day turnover falls out for free: a return on `D 10:00` is
 * adjacent to — not overlapping — the next pickup on `D 14:00`.
 */
export function bookingWindow(pickupDate: string, returnDate: string): Interval {
  return {
    start: instantOf(pickupDate, PICKUP_HOUR),
    end: instantOf(returnDate, RETURN_HOUR),
  };
}

/** Half-open overlap (`&&`): true iff the two intervals share any instant. */
export function windowsOverlap(a: Interval, b: Interval): boolean {
  return a.start < b.end && b.start < a.end;
}

/**
 * True iff `candidate` conflicts with any window in `existing`. An empty
 * `existing` is never a conflict. Caller is responsible for passing only
 * blocking-status reservations (pending + confirmed), matching the partial
 * `WHERE status in ('pending','confirmed')` on the DB constraint.
 */
export function hasConflict(candidate: BookingWindow, existing: BookingWindow[]): boolean {
  const candidateWindow = bookingWindow(candidate.pickupDate, candidate.returnDate);
  return existing.some((e) => windowsOverlap(candidateWindow, bookingWindow(e.pickupDate, e.returnDate)));
}

// ---------------------------------------------------------------------------
// Per-day half-state model (S-02a). The booking calendar greys booked ranges,
// but the half-open `[pickup 14:00, return 10:00)` window above leaves each
// booking's two *changeover* days half-free: the pickup day's morning is still a
// valid new return, the return day's afternoon a valid new pickup. This block
// turns the busy ranges into a per-day state the calendar consumes, deriving the
// am/pm split from the SAME `PICKUP_HOUR`/`RETURN_HOUR` so it cannot drift from
// the `EXCLUDE` window. Dates are compared as ISO `YYYY-MM-DD` strings, which
// sort chronologically (lexicographic == calendar order), avoiding tz pitfalls.

/**
 * Half-availability of a single calendar day relative to a vehicle's bookings:
 * - `free` — fully bookable (never materialized in the map; absence ⇒ free).
 * - `pickupOnly` — an existing booking's **return** day; morning taken, so a new
 *   booking may only **start** (pick up) here.
 * - `returnOnly` — an existing booking's **pickup** day; afternoon taken, so a
 *   new booking may only **end** (return) here.
 * - `blocked` — interior day, or a day that is both a return and a pickup of
 *   adjacent bookings; fully disabled.
 */
export type DayAvailability = "free" | "pickupOnly" | "returnOnly" | "blocked";

/** Morning occupied: an interior day or a return day (`∃ range: P < d ≤ R`). */
function amTaken(day: string, busy: VehicleBusyRange[]): boolean {
  return busy.some((r) => r.pickup_date < day && day <= r.return_date);
}

/** Afternoon occupied: an interior day or a pickup day (`∃ range: P ≤ d < R`). */
function pmTaken(day: string, busy: VehicleBusyRange[]): boolean {
  return busy.some((r) => r.pickup_date <= day && day < r.return_date);
}

/** Every ISO `YYYY-MM-DD` from `startIso` to `endIso` inclusive, in order. */
function eachDayInclusive(startIso: string, endIso: string): string[] {
  const [sy, sm, sd] = startIso.split("-").map(Number);
  const [ey, em, ed] = endIso.split("-").map(Number);
  const end = Date.UTC(ey, em - 1, ed);
  const days: string[] = [];
  // Step in UTC days so the +24h increment never lands on a DST seam.
  for (let t = Date.UTC(sy, sm - 1, sd); t <= end; t += 86_400_000) {
    const d = new Date(t);
    const month = String(d.getUTCMonth() + 1).padStart(2, "0");
    const dayOfMonth = String(d.getUTCDate()).padStart(2, "0");
    days.push(`${d.getUTCFullYear()}-${month}-${dayOfMonth}`);
  }
  return days;
}

/**
 * Build a per-day availability map from a vehicle's busy ranges. Only
 * changeover/interior days are present — a day absent from the map is `free`.
 * Each day's state is derived from the global `amTaken`/`pmTaken` predicates, so
 * a day shared by two adjacent bookings (a return *and* a pickup) correctly
 * resolves to `blocked` regardless of iteration order.
 */
export function dayAvailabilityMap(busy: VehicleBusyRange[]): Map<string, DayAvailability> {
  const map = new Map<string, DayAvailability>();
  for (const range of busy) {
    for (const day of eachDayInclusive(range.pickup_date, range.return_date)) {
      if (map.has(day)) {
        continue; // already resolved from the global predicates
      }
      const am = amTaken(day, busy);
      const pm = pmTaken(day, busy);
      if (am && pm) {
        map.set(day, "blocked");
      } else if (am) {
        map.set(day, "pickupOnly");
      } else if (pm) {
        map.set(day, "returnOnly");
      }
      // am && pm both false ⇒ free; leave it out of the map.
    }
  }
  return map;
}

/**
 * Why a candidate range fails the half-day rules — discriminates which boundary
 * collided so the UI can show a specific hint instead of a generic one:
 *   - `pickupTaken` — the start (pickup) day's afternoon is already taken,
 *   - `returnTaken` — the end (return) day's morning is already taken,
 *   - `spansBooked` — a strictly-interior day is occupied in either half.
 */
export type RangeConflict = "pickupTaken" | "returnTaken" | "spansBooked";

export type RangeBookableResult = { ok: true } | { ok: false; reason: RangeConflict };

/**
 * Evaluate a candidate `[pickup, returnDate]` range against the half-day rules
 * (1: start pm free, 2: end am free, 3: interior fully free), reporting the
 * first rule that fails. This is the `onSelect` veto's authority — `excludeDisabled`
 * only auto-rejects ranges that *span* a fully-`blocked` day, missing the half-day
 * boundary cases. Rules are checked in order, so a range that violates more than
 * one reports `pickupTaken` first.
 */
export function checkRangeBookable(busy: VehicleBusyRange[], pickup: string, returnDate: string): RangeBookableResult {
  if (pmTaken(pickup, busy)) {
    return { ok: false, reason: "pickupTaken" }; // rule 1: start day's afternoon already taken
  }
  if (amTaken(returnDate, busy)) {
    return { ok: false, reason: "returnTaken" }; // rule 2: end day's morning already taken
  }
  // rule 3: no interior day may be occupied in either half.
  for (const day of eachDayInclusive(pickup, returnDate)) {
    if (day <= pickup || day >= returnDate) {
      continue; // endpoints handled by rules 1 & 2
    }
    if (amTaken(day, busy) || pmTaken(day, busy)) {
      return { ok: false, reason: "spansBooked" };
    }
  }
  return { ok: true };
}

/** Boolean shorthand for {@link checkRangeBookable} — true iff the range is bookable. */
export function isRangeBookable(busy: VehicleBusyRange[], pickup: string, returnDate: string): boolean {
  return checkRangeBookable(busy, pickup, returnDate).ok;
}
