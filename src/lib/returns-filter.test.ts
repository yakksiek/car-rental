// core
import { describe, expect, it } from "vitest";

// others
import {
  captionOf,
  overdueDaysLabel,
  parseReturnsFilter,
  selectReturns,
  sortReturnsByUrgency,
  toggleReturnsFilter,
} from "./returns-filter";
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

describe("overdueDaysLabel", () => {
  it("reads `1 dzień po terminie` at the 1-day boundary", () => {
    // TODAY − return_date = 1 → singular `dzień`.
    expect(overdueDaysLabel(row({ return_protocol_id: null, return_date: "2026-07-22" }), TODAY)).toBe(
      "1 dzień po terminie",
    );
  });

  it("reads `N dni po terminie` beyond one day", () => {
    // `overdue` is 2026-07-20, i.e. 3 calendar days before TODAY.
    expect(overdueDaysLabel(overdue, TODAY)).toBe("3 dni po terminie");
  });

  it("is null for due and returned rows (they carry no overdue label)", () => {
    expect(overdueDaysLabel(dueToday, TODAY)).toBeNull();
    expect(overdueDaysLabel(returned, TODAY)).toBeNull();
  });
});

describe("sortReturnsByUrgency", () => {
  it("orders overdue → due → returned regardless of input order", () => {
    const sorted = sortReturnsByUrgency([returned, dueToday, overdue], TODAY);
    expect(sorted.map((r) => captionOf(r, TODAY))).toEqual(["overdue", "due", "returned"]);
  });

  it("keeps the input (reference) order stable within a caption group", () => {
    const first = row({ return_protocol_id: null, return_date: "2026-07-20", reference: "R-1" });
    const second = row({ return_protocol_id: null, return_date: "2026-07-18", reference: "R-2" });
    // Both overdue; a stable sort must preserve their input order.
    expect(sortReturnsByUrgency([first, second], TODAY).map((r) => r.reference)).toEqual(["R-1", "R-2"]);
  });

  it("does not mutate the input array", () => {
    const input = [returned, overdue];
    sortReturnsByUrgency(input, TODAY);
    expect(input).toEqual([returned, overdue]);
  });
});
