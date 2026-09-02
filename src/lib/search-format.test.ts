// core
import { describe, expect, it } from "vitest";

// others
import { highlightSegments, relativeDayPl, searchDateRange } from "./search-format";

// Unit suite for the search rows' pure presentation helpers (S-13 Phase 3). These
// carry the two things most likely to break silently in a result row: the date
// wording and the match segmentation the `<mark>` highlighting is built from.
//
// The Polish assertions below are unchanged from before the month names moved to
// `Intl`, and that is deliberate: byte-identical PL output is the gate on the
// swap (plan criterion 2.8), so an assertion written against the deleted
// `MONTHS_ABBR_PL` table is exactly what proves `Intl` reproduced it. The English
// rows are new — `en` formats as en-GB, so the day-then-month order survives and
// one composition serves both locales.

describe("searchDateRange", () => {
  it("collapses the month when both ends share it", () => {
    expect(searchDateRange("2026-04-02", "2026-04-09", "pl")).toBe("02 – 09 kwi");
  });

  it("carries the month on both ends across a boundary", () => {
    expect(searchDateRange("2026-04-28", "2026-05-03", "pl")).toBe("28 kwi – 03 maj");
  });

  it("carries the month on both ends across a year boundary in the same month number", () => {
    expect(searchDateRange("2025-12-30", "2026-12-02", "pl")).toBe("30 gru – 02 gru");
  });

  it("zero-pads single-digit days", () => {
    expect(searchDateRange("2026-01-01", "2026-01-05", "pl")).toBe("01 – 05 sty");
  });

  it("returns a dash for a malformed date rather than throwing", () => {
    expect(searchDateRange("nie-data", "2026-01-05", "pl")).toBe("—");
    expect(searchDateRange("2026-01-05", "", "pl")).toBe("—");
  });

  it("keeps the same shape under en, with English month abbreviations", () => {
    expect(searchDateRange("2026-04-02", "2026-04-09", "en")).toBe("02 – 09 Apr");
    expect(searchDateRange("2026-04-28", "2026-05-03", "en")).toBe("28 Apr – 03 May");
  });
});

describe("relativeDayPl", () => {
  const TODAY = "2026-08-10";

  it("words the day relative to today inside the ±1 window", () => {
    expect(relativeDayPl("2026-08-10", TODAY, "pl")).toBe("dziś");
    expect(relativeDayPl("2026-08-09", TODAY, "pl")).toBe("wczoraj");
    expect(relativeDayPl("2026-08-11", TODAY, "pl")).toBe("jutro");
  });

  it("falls back to an abbreviated date beyond that window", () => {
    expect(relativeDayPl("2026-08-07", TODAY, "pl")).toBe("07 sie");
    expect(relativeDayPl("2026-09-01", TODAY, "pl")).toBe("01 wrz");
  });

  it("crosses month and year boundaries without drifting", () => {
    expect(relativeDayPl("2026-07-31", "2026-08-01", "pl")).toBe("wczoraj");
    expect(relativeDayPl("2026-01-01", "2025-12-31", "pl")).toBe("jutro");
  });

  it("returns a dash for a malformed date", () => {
    expect(relativeDayPl("", TODAY, "pl")).toBe("—");
  });
});

describe("highlightSegments", () => {
  it("splits around a single case-insensitive match", () => {
    expect(highlightSegments("Krzysztof Dąbrowski", "krzysztof")).toEqual([
      { text: "Krzysztof", match: true },
      { text: " Dąbrowski", match: false },
    ]);
  });

  it("marks every occurrence, not just the first", () => {
    expect(highlightSegments("ana banana", "an")).toEqual([
      { text: "an", match: true },
      { text: "a b", match: false },
      { text: "an", match: true },
      { text: "an", match: true },
      { text: "a", match: false },
    ]);
  });

  it("preserves the original casing of the matched text", () => {
    expect(highlightSegments("WX 5519M", "wx 55")).toEqual([
      { text: "WX 55", match: true },
      { text: "19M", match: false },
    ]);
  });

  it("is diacritic-sensitive — ILIKE would not have matched, so neither does the mark", () => {
    expect(highlightSegments("Wąsik", "wasik")).toEqual([{ text: "Wąsik", match: false }]);
    expect(highlightSegments("Wąsik", "wąs")).toEqual([
      { text: "Wąs", match: true },
      { text: "ik", match: false },
    ]);
  });

  it("returns the whole string unmarked for an empty or whitespace query", () => {
    expect(highlightSegments("Anna Nowak", "")).toEqual([{ text: "Anna Nowak", match: false }]);
    expect(highlightSegments("Anna Nowak", "   ")).toEqual([{ text: "Anna Nowak", match: false }]);
  });

  it("returns the whole string unmarked when nothing matches", () => {
    expect(highlightSegments("Anna Nowak", "zzz")).toEqual([{ text: "Anna Nowak", match: false }]);
  });
});
