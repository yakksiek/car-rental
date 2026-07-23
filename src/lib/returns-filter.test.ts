// core
import { describe, expect, it } from "vitest";

// others
import { captionOf, parseReturnsFilter, selectReturns, toggleReturnsFilter } from "./returns-filter";
import type { ReturnCaption } from "./returns-filter";
import type { DispatchReturnRow } from "../types";

// `captionOf`/`selectReturns` only read `return_protocol_id` + `return_date`, so a
// partial cast keeps the fixtures readable without spelling out every RPC column. The
// override values are `unknown` because the RPC type-gen types `return_protocol_id`
// non-null, yet it IS null at runtime for open rows — exactly the split under test.
function row(fields: Partial<Record<keyof DispatchReturnRow, unknown>>): DispatchReturnRow {
  return fields as DispatchReturnRow;
}

const TODAY = "2026-07-23";
// A returned row wins regardless of its (past) return_date; an open row splits on
// the strict `<` boundary — same-day is `due`, not `overdue`.
const overdue = row({ return_protocol_id: null, return_date: "2026-07-20" });
const dueToday = row({ return_protocol_id: null, return_date: TODAY });
const returned = row({ return_protocol_id: "rp-1", return_date: "2026-07-19" });
const rows = [overdue, dueToday, returned];

describe("captionOf", () => {
  it("classifies returned (protocol filed) over any date", () => {
    expect(captionOf(returned, TODAY)).toBe("returned");
  });

  it("splits open rows on the strict return_date < today boundary", () => {
    expect(captionOf(overdue, TODAY)).toBe("overdue");
    expect(captionOf(dueToday, TODAY)).toBe("due"); // same-day return is due, not overdue
  });
});

describe("selectReturns", () => {
  it("returns every row unchanged when the filter is null (all)", () => {
    expect(selectReturns(rows, TODAY, null)).toEqual(rows);
  });

  it("selects only the caption's subset", () => {
    expect(selectReturns(rows, TODAY, "overdue")).toEqual([overdue]);
    expect(selectReturns(rows, TODAY, "due")).toEqual([dueToday]);
    expect(selectReturns(rows, TODAY, "returned")).toEqual([returned]);
  });

  it("yields an empty list when no row matches the caption", () => {
    expect(selectReturns([returned], TODAY, "overdue")).toEqual([]);
  });
});

describe("parseReturnsFilter", () => {
  it("round-trips each of the three valid captions", () => {
    for (const caption of ["due", "overdue", "returned"] as ReturnCaption[]) {
      expect(parseReturnsFilter(caption)).toBe(caption);
    }
  });

  it("rejects junk, empty, and absent values to null (all)", () => {
    expect(parseReturnsFilter("wszystkie")).toBeNull();
    expect(parseReturnsFilter("OVERDUE")).toBeNull(); // case-sensitive
    expect(parseReturnsFilter("")).toBeNull();
    expect(parseReturnsFilter(null)).toBeNull();
    expect(parseReturnsFilter(undefined)).toBeNull();
  });
});

describe("toggleReturnsFilter", () => {
  it("selects a caption when a different one (or none) is active", () => {
    expect(toggleReturnsFilter(null, "overdue")).toBe("overdue");
    expect(toggleReturnsFilter("due", "overdue")).toBe("overdue");
  });

  it("clears to null (all) when the active caption is re-clicked", () => {
    expect(toggleReturnsFilter("overdue", "overdue")).toBeNull();
  });
});
