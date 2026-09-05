// core
import { describe, expect, it } from "vitest";

// others
import {
  dateEyebrow,
  dateLabel,
  dateTimeCompany,
  dayFull,
  dayMonthLong,
  dayMonthRange,
  dayMonthShort,
  dayMonthShortPadded,
  dayMonthYearRange,
  dayMonthYearShort,
  monthShort,
  monthYearLong,
  timeAgo,
  timeCompany,
} from "./format-date";

// The suite that guards the phase's central claim: `Intl` reproduces every string
// the five deleted Polish lookup tables (`pl-date.ts`'s weekday, genitive-month
// and abbreviated-month rows, plus `ReservationCalendar`'s twin
// nominative/genitive pair) used to hand-roll, BYTE FOR BYTE. Each Polish
// expectation below is the literal the old table
// produced; if a future ICU changes one, this fails rather than the design
// drifting silently.
//
// Every helper takes a calendar or an instant and formats it on a FIXED zone, so
// these assertions do not depend on the machine's TZ.

// 2026-07-25 is a Saturday; 2026-04-02 a Thursday.
const JULY_25 = new Date(2026, 6, 25);
const APRIL_2 = new Date(2026, 3, 2);
const APRIL_9 = new Date(2026, 3, 9);
const MAY_3 = new Date(2026, 4, 3);

describe("dateEyebrow / dateLabel (the deleted pl-date.ts surface)", () => {
  // `dateEyebrowPl(now)` read `getUTCDay()` / `getUTCMonth()`, so the instant is
  // formatted on the UTC calendar — the same one the worklists' `today` split uses.
  const instant = new Date("2026-07-25T09:00:00Z");

  it("renders the uppercase mobile eyebrow exactly as the tables did", () => {
    expect(dateEyebrow(instant, "pl")).toBe("SOB · 25 LIPCA");
    expect(dateEyebrow(instant, "en")).toBe("SAT · 25 JULY");
  });

  it("renders the title-case filter-bar label exactly as the tables did", () => {
    expect(dateLabel(instant, "pl")).toBe("Sob, 25 lip");
    expect(dateLabel(instant, "en")).toBe("Sat, 25 Jul");
  });

  // CLDR abbreviates Polish weekdays with a trailing full stop (`sob.`); the
  // design's eyebrow and chip carry none, so the helper strips it.
  it("drops CLDR's trailing full stop from the Polish weekday", () => {
    expect(dateEyebrow(instant, "pl")).not.toContain(".");
    expect(dateLabel(instant, "pl")).not.toContain(".");
  });
});

describe("single-date shapes (the date-fns patterns they replaced)", () => {
  it('"d MMM" → day-then-month in both locales', () => {
    expect(dayMonthShort(JULY_25, "pl")).toBe("25 lip");
    expect(dayMonthShort(JULY_25, "en")).toBe("25 Jul");
  });

  it('"dd MMM" zero-pads the day', () => {
    expect(dayMonthShortPadded(APRIL_2, "pl")).toBe("02 kwi");
    expect(dayMonthShortPadded(APRIL_2, "en")).toBe("02 Apr");
  });

  // The genitive/nominative split the deleted tables existed for: a month asked
  // for BESIDE A DAY inflects, a month asked for alone does not. `Intl` makes the
  // distinction on its own.
  it('"d MMMM" gives the genitive month, "LLLL yyyy" the nominative', () => {
    expect(dayMonthLong(JULY_25, "pl")).toBe("25 lipca");
    expect(monthYearLong(JULY_25, "pl")).toBe("lipiec 2026");
    expect(dayMonthLong(JULY_25, "en")).toBe("25 July");
    expect(monthYearLong(JULY_25, "en")).toBe("July 2026");
  });

  it('"d MMM yyyy" carries the year', () => {
    expect(dayMonthYearShort(JULY_25, "pl")).toBe("25 lip 2026");
    expect(dayMonthYearShort(JULY_25, "en")).toBe("25 Jul 2026");
  });

  it("names a month from its index, for the search rows", () => {
    expect(monthShort(3, "pl")).toBe("kwi");
    expect(monthShort(9, "pl")).toBe("paź");
    expect(monthShort(3, "en")).toBe("Apr");
  });

  it("spells a day out in full for a calendar cell's accessible name", () => {
    expect(dayFull(JULY_25, "pl")).toBe("sobota, 25 lipca 2026");
    expect(dayFull(JULY_25, "en")).toBe("Saturday, 25 July 2026");
  });
});

describe("dayMonthRange", () => {
  it("collapses the month when both ends share it", () => {
    expect(dayMonthRange(APRIL_2, APRIL_9, "pl", { pad: true })).toBe("02 – 09 kwi");
    expect(dayMonthRange(APRIL_2, APRIL_9, "en", { pad: true })).toBe("02 – 09 Apr");
  });

  it("carries both months across a boundary", () => {
    expect(dayMonthRange(APRIL_9, MAY_3, "pl", { pad: true })).toBe("09 kwi – 03 maj");
  });

  it("takes the long month for the reservation headline", () => {
    expect(dayMonthRange(APRIL_2, APRIL_9, "pl", { month: "long" })).toBe("2 – 9 kwietnia");
    expect(dayMonthRange(APRIL_9, MAY_3, "pl", { month: "long" })).toBe("9 kwietnia – 3 maja");
  });
});

describe("dayMonthYearRange (the calendar's week caption)", () => {
  // Byte-identical to the twin-table composition it replaced, elision included.
  it("elides the shared month and year", () => {
    expect(dayMonthYearRange(new Date(2026, 6, 25), new Date(2026, 6, 31), "pl")).toBe("25–31 lipca 2026");
  });

  it("carries both months across a boundary", () => {
    expect(dayMonthYearRange(new Date(2026, 5, 28), new Date(2026, 6, 4), "pl")).toBe("28 czerwca – 4 lipca 2026");
  });

  it("words the same span in English", () => {
    expect(dayMonthYearRange(new Date(2026, 6, 25), new Date(2026, 6, 31), "en")).toBe("25–31 July 2026");
  });

  // The spacing around the dash is OURS, not the runtime's. Node 24 emits a bare
  // `25–31 July 2026`; Node 22 — what CI runs — emits `25<U+2009>–<U+2009>31 July
  // 2026`, and production is workerd, a third ICU. Before this was normalized, the
  // caption's spacing was whatever the host's CLDR happened to say, and the suite
  // pinned only the one spelling the author's laptop produced.
  //
  // These assert the SHAPE rather than a literal, so they hold on any ICU build.
  it.each(["pl", "en"] as const)("pads the dash the same way on any ICU build (%s)", (locale) => {
    const sameMonth = dayMonthYearRange(new Date(2026, 6, 25), new Date(2026, 6, 31), locale);
    const crossMonth = dayMonthYearRange(new Date(2026, 5, 28), new Date(2026, 6, 4), locale);

    // No CLDR padding survives: no thin (U+2009), narrow-no-break (U+202F) or
    // non-breaking (U+00A0) space anywhere in the caption.
    for (const caption of [sameMonth, crossMonth]) {
      expect(caption, `${locale}: stray CLDR space in ${JSON.stringify(caption)}`).not.toMatch(/[\u2009\u202f\u00a0]/);
    }

    // Month elided -> tight. Both months present -> one plain space either side.
    expect(sameMonth).toMatch(/\d\u2013\d/);
    expect(sameMonth).not.toMatch(/\s\u2013|\u2013\s/);
    expect(crossMonth).toContain(" \u2013 ");
  });
});

describe("company-zone timestamps", () => {
  // 12:08 UTC is 14:08 in Warsaw. The zone is PINNED, not read from the runtime:
  // this renders inside a `client:load` island, and an unpinned formatter would
  // give UTC on workerd and Warsaw in the browser — the hydration mismatch the
  // locale lesson records from 2026-07-22.
  const signedAt = new Date("2026-07-10T12:08:00Z");

  it("shows the signature date and time in Europe/Warsaw", () => {
    expect(dateTimeCompany(signedAt, "pl")).toBe("10 lip 2026, 14:08");
    expect(dateTimeCompany(signedAt, "en")).toBe("10 Jul 2026, 14:08");
  });

  it("shows the clock alone in Europe/Warsaw, on a 24-hour cycle", () => {
    expect(timeCompany(signedAt, "pl")).toBe("14:08");
    expect(timeCompany(signedAt, "en")).toBe("14:08");
  });
});

describe("timeAgo (replacing date-fns formatDistanceToNow)", () => {
  const now = Date.parse("2026-07-25T12:00:00Z");
  const ago = (ms: number) => new Date(now - ms);

  it("words minutes and hours", () => {
    expect(timeAgo(ago(5 * 60_000), now, "pl")).toBe("5 minut temu");
    expect(timeAgo(ago(3 * 3_600_000), now, "pl")).toBe("3 godziny temu");
    expect(timeAgo(ago(5 * 60_000), now, "en")).toBe("5 minutes ago");
  });

  it("never says zero minutes for a just-arrived row", () => {
    expect(timeAgo(ago(2_000), now, "pl")).toBe("1 minutę temu");
  });

  it("uses the idiomatic day words where the locale has them", () => {
    expect(timeAgo(ago(86_400_000), now, "pl")).toBe("wczoraj");
    expect(timeAgo(ago(2 * 86_400_000), now, "pl")).toBe("przedwczoraj");
    expect(timeAgo(ago(86_400_000), now, "en")).toBe("yesterday");
  });

  it("steps up to months and years", () => {
    expect(timeAgo(ago(60 * 86_400_000), now, "en")).toBe("2 months ago");
    expect(timeAgo(ago(400 * 86_400_000), now, "en")).toBe("last year");
  });
});
