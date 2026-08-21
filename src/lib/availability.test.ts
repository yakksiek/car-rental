// core
import { describe, expect, it } from "vitest";

// others
import type { BookingWindow, VehicleBusyRange } from "../types";
import {
  bookingWindow,
  checkRangeBookable,
  dayAvailabilityMap,
  hasConflict,
  isRangeBookable,
  windowsOverlap,
} from "./availability";

// Boundary table locking the half-open `[pickup 14:00, return 10:00)` rule —
// the exact agreement with the SQL `EXCLUDE` constraint. The load-bearing case
// is same-day turnover: it MUST be allowed (4-hour buffer), or we either lose
// same-day revenue (false conflict) or admit a real double-booking.
//
// `base` is a fixed confirmed booking; each case is a candidate tested against
// it. Dates are deterministic ISO calendar dates — no `now()`-relative drift.
const base: BookingWindow = { pickupDate: "2026-08-05", returnDate: "2026-08-10" };

const cases: { name: string; candidate: BookingWindow; conflict: boolean }[] = [
  {
    name: "same-day turnover: candidate returns on base's pickup day",
    candidate: { pickupDate: "2026-08-01", returnDate: "2026-08-05" },
    conflict: false,
  },
  {
    name: "same-day turnover: candidate picks up on base's return day",
    candidate: { pickupDate: "2026-08-10", returnDate: "2026-08-14" },
    conflict: false,
  },
  {
    name: "true overlap: candidate starts inside base's window",
    candidate: { pickupDate: "2026-08-07", returnDate: "2026-08-12" },
    conflict: true,
  },
  {
    name: "back-to-back across days: candidate ends day before base starts",
    candidate: { pickupDate: "2026-07-28", returnDate: "2026-08-04" },
    conflict: false,
  },
  {
    name: "fully nested: candidate sits entirely within base",
    candidate: { pickupDate: "2026-08-06", returnDate: "2026-08-09" },
    conflict: true,
  },
  {
    name: "fully containing: candidate envelops base",
    candidate: { pickupDate: "2026-08-03", returnDate: "2026-08-12" },
    conflict: true,
  },
  {
    name: "identical window: candidate equals base",
    candidate: { pickupDate: "2026-08-05", returnDate: "2026-08-10" },
    conflict: true,
  },
  {
    name: "one-day rental on base's pickup day (overlaps base's first night)",
    candidate: { pickupDate: "2026-08-05", returnDate: "2026-08-06" },
    conflict: true,
  },
  {
    name: "one-day rental ending on base's pickup day (turnover, allowed)",
    candidate: { pickupDate: "2026-08-04", returnDate: "2026-08-05" },
    conflict: false,
  },
];

describe("hasConflict", () => {
  it.each(cases)("$name -> conflict=$conflict", ({ candidate, conflict }) => {
    expect(hasConflict(candidate, [base])).toBe(conflict);
  });

  it("returns false against an empty existing set", () => {
    expect(hasConflict(base, [])).toBe(false);
  });

  it("detects a conflict against any member of a multi-booking set", () => {
    const other: BookingWindow = { pickupDate: "2026-09-01", returnDate: "2026-09-03" };
    const candidate: BookingWindow = { pickupDate: "2026-09-02", returnDate: "2026-09-05" };
    expect(hasConflict(candidate, [base, other])).toBe(true);
  });
});

describe("windowsOverlap (half-open & symmetry)", () => {
  it("is symmetric: overlap(a, b) === overlap(b, a)", () => {
    const a = bookingWindow("2026-08-05", "2026-08-10");
    const b = bookingWindow("2026-08-07", "2026-08-12");
    expect(windowsOverlap(a, b)).toBe(windowsOverlap(b, a));
    expect(windowsOverlap(a, b)).toBe(true);
  });

  it("treats adjacency (return 10:00 -> pickup 14:00 same day) as non-overlapping", () => {
    const earlier = bookingWindow("2026-08-01", "2026-08-05");
    const later = bookingWindow("2026-08-05", "2026-08-09");
    expect(windowsOverlap(earlier, later)).toBe(false);
  });
});

describe("bookingWindow", () => {
  it("applies fixed hotel hours (pickup 14:00, return 10:00)", () => {
    const w = bookingWindow("2026-08-05", "2026-08-10");
    expect(w.start).toBe(Date.UTC(2026, 7, 5, 14));
    expect(w.end).toBe(Date.UTC(2026, 7, 10, 10));
    expect(w.start).toBeLessThan(w.end);
  });
});

// Half-state model (S-02a). The load-bearing edge cases live here — adjacent
// bookings sharing a day, one-day gaps, and the three range-validity rules — so
// the calendar↔DB asymmetry stays closed without a UI test runner. The seeded
// production fixture (`07-01→07-10` + `07-10→07-15`) is reused as the canonical
// adjacency case so the test mirrors real data.
const r = (pickup_date: string, return_date: string): VehicleBusyRange => ({ pickup_date, return_date });

// Orientation (per the half-state model): a booking's PICKUP day has its
// afternoon taken (pm) → `returnOnly` (a new booking may only END/return there);
// its RETURN day has its morning taken (am) → `pickupOnly` (a new booking may
// only START/pick up there). Interior days are `blocked`.
describe("dayAvailabilityMap", () => {
  it("case 1: a single booking splits into returnOnly / blocked interior / pickupOnly", () => {
    const map = dayAvailabilityMap([r("2026-08-16", "2026-08-20")]);
    expect(map.get("2026-08-16")).toBe("returnOnly"); // existing pickup day → new return ok
    expect(map.get("2026-08-17")).toBe("blocked");
    expect(map.get("2026-08-18")).toBe("blocked");
    expect(map.get("2026-08-19")).toBe("blocked");
    expect(map.get("2026-08-20")).toBe("pickupOnly"); // existing return day → new pickup ok
  });

  it("case 2: adjacent bookings sharing a day mark the shared day blocked", () => {
    const map = dayAvailabilityMap([r("2026-07-01", "2026-07-10"), r("2026-07-10", "2026-07-15")]);
    expect(map.get("2026-07-01")).toBe("returnOnly"); // first booking's pickup day
    expect(map.get("2026-07-10")).toBe("blocked"); // return of the first AND pickup of the second
    expect(map.get("2026-07-15")).toBe("pickupOnly"); // second booking's return day
  });

  it("case 3: a one-day gap between two bookings resolves from both sides", () => {
    // first: 01→05 (returnOnly 01, pickupOnly 05), gap day 06, second: 07→10.
    const map = dayAvailabilityMap([r("2026-07-01", "2026-07-05"), r("2026-07-07", "2026-07-10")]);
    expect(map.get("2026-07-05")).toBe("pickupOnly"); // first booking's return day
    expect(map.get("2026-07-06")).toBeUndefined(); // fully free gap day ⇒ absent
    expect(map.get("2026-07-07")).toBe("returnOnly"); // second booking's pickup day
  });

  it("case 8: empty busy ⇒ empty map", () => {
    expect(dayAvailabilityMap([]).size).toBe(0);
  });
});

describe("isRangeBookable", () => {
  // 16 returnOnly (pickup day), 17-19 blocked, 20 pickupOnly (return day).
  const single = [r("2026-08-16", "2026-08-20")];

  it("case 4: a new range ENDING on a pickupOnly day is rejected (rule 2)", () => {
    // 20 is the existing return day — its morning is occupied until 10:00.
    expect(isRangeBookable(single, "2026-08-12", "2026-08-20")).toBe(false);
  });

  it("case 5: a new range STARTING on a returnOnly day is rejected (rule 1)", () => {
    // 16 is the existing pickup day — its afternoon is occupied from 14:00.
    expect(isRangeBookable(single, "2026-08-16", "2026-08-24")).toBe(false);
  });

  it("case 6: a back-to-back range ENDING on a returnOnly day is accepted (turnover return)", () => {
    // returning at 10:00 on 16 clears before the existing 14:00 pickup.
    expect(isRangeBookable(single, "2026-08-13", "2026-08-16")).toBe(true);
  });

  it("case 6b: a back-to-back range STARTING on a pickupOnly day is accepted (turnover pickup)", () => {
    // picking up at 14:00 on 20 starts after the existing 10:00 return.
    expect(isRangeBookable(single, "2026-08-20", "2026-08-24")).toBe(true);
  });

  it("case 7: a range whose interior straddles a changeover day is rejected (rule 3)", () => {
    // overnight booking 10→11 (10 returnOnly, 11 pickupOnly) sits inside 08→13.
    const overnight = [r("2026-08-10", "2026-08-11")];
    expect(isRangeBookable(overnight, "2026-08-08", "2026-08-13")).toBe(false);
  });

  it("case 8: any well-ordered range is bookable against empty busy", () => {
    expect(isRangeBookable([], "2026-08-01", "2026-08-10")).toBe(true);
  });
});

describe("checkRangeBookable (conflict reason)", () => {
  // 16 returnOnly (pickup day), 17-19 blocked, 20 pickupOnly (return day).
  const single = [r("2026-08-16", "2026-08-20")];

  it("reports pickupTaken when the start day's afternoon is occupied (rule 1)", () => {
    expect(checkRangeBookable(single, "2026-08-16", "2026-08-24")).toEqual({ ok: false, reason: "pickupTaken" });
  });

  it("reports returnTaken when the end day's morning is occupied (rule 2)", () => {
    expect(checkRangeBookable(single, "2026-08-12", "2026-08-20")).toEqual({ ok: false, reason: "returnTaken" });
  });

  it("reports spansBooked when an interior day is occupied (rule 3)", () => {
    const overnight = [r("2026-08-10", "2026-08-11")];
    expect(checkRangeBookable(overnight, "2026-08-08", "2026-08-13")).toEqual({ ok: false, reason: "spansBooked" });
  });

  it("checks rules in order: a range failing both endpoints reports pickupTaken first", () => {
    // 16→20 starts on the returnOnly day (pm taken ⇒ rule 1) AND ends on the
    // pickupOnly day (am taken ⇒ rule 2); rule 1 short-circuits first.
    expect(checkRangeBookable(single, "2026-08-16", "2026-08-20")).toEqual({ ok: false, reason: "pickupTaken" });
  });

  it("returns ok for a valid turnover range", () => {
    expect(checkRangeBookable(single, "2026-08-20", "2026-08-24")).toEqual({ ok: true });
  });
});
