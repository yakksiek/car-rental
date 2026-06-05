// core
import { describe, expect, it } from "vitest";

// others
import type { BookingWindow } from "../types";
import { bookingWindow, hasConflict, windowsOverlap } from "./availability";

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
