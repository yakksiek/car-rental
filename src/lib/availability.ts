// others
import type { BookingWindow } from "../types";

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
