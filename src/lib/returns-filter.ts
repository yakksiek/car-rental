// others
import { formatDuration, rentalDays } from "./format";
import type { DispatchReturnRow } from "../types";

// Pure, DOM-free helpers for the returns worklist (S-07 Phases 2–3). They live here
// rather than inside the `ReturnQueue` island so the `unit` project (node, no DOM) can
// exercise the caption classification, the `?filter` URL parse, the toggle-to-all
// semantics, the urgency sort, and the days-overdue label — mirroring `return-form.ts`.
//
// The four filter states are the three row captions plus `null` ("Wszystkie" / all).
// A row's caption keys off `return_protocol_id` (returned wins) then the
// `return_date`-vs-today split, exactly as the queue paints it. `today` is the
// server's UTC calendar date threaded into the island, so the split never drifts
// with a client clock or a hydration mismatch.

/** A return row's lifecycle state; the filter's four states are these three + `null` (all). */
export type ReturnCaption = "returned" | "overdue" | "due";

/** The valid `?filter` URL values — each selects the caption of the same name. */
const CAPTIONS: readonly ReturnCaption[] = ["returned", "overdue", "due"];

/** Returned wins; else overdue-vs-due by `return_date` against `today` (ISO `YYYY-MM-DD`). */
export function captionOf(row: DispatchReturnRow, today: string): ReturnCaption {
  if (row.return_protocol_id) {
    return "returned";
  }
  return row.return_date < today ? "overdue" : "due";
}

/** Validate a raw `?filter` param against the three captions; junk / absent → `null` (all). */
export function parseReturnsFilter(raw: string | null | undefined): ReturnCaption | null {
  return CAPTIONS.includes(raw as ReturnCaption) ? (raw as ReturnCaption) : null;
}

/** Toggle semantics: re-clicking the active caption clears to `null` (all); else select it. */
export function toggleReturnsFilter(current: ReturnCaption | null, clicked: ReturnCaption): ReturnCaption | null {
  return current === clicked ? null : clicked;
}

/** Select the rows matching the active filter; `null` = all rows, unchanged. */
export function selectReturns(
  rows: DispatchReturnRow[],
  today: string,
  filter: ReturnCaption | null,
): DispatchReturnRow[] {
  return filter === null ? rows : rows.filter((row) => captionOf(row, today) === filter);
}

// Worklist ordering: overdue first, then due, then returned — the mockups' grouping
// (design-contract §C). The RPC returns `reference` order; this rank regroups it.
const CAPTION_RANK: Record<ReturnCaption, number> = { overdue: 0, due: 1, returned: 2 };

/**
 * Stable-sort the worklist by urgency — overdue → due → returned — preserving the
 * RPC's `reference` order within each caption group (`Array.prototype.sort` is stable
 * on Node ≥ 11 and every modern browser). Returns a new array; the input is untouched.
 */
export function sortReturnsByUrgency(rows: DispatchReturnRow[], today: string): DispatchReturnRow[] {
  return [...rows].sort((a, b) => CAPTION_RANK[captionOf(a, today)] - CAPTION_RANK[captionOf(b, today)]);
}

/**
 * The plural-aware days-overdue label for an overdue row — `1 dzień po terminie` /
 * `N dni po terminie`. `null` for due/returned rows (they carry no such label). The
 * count is the calendar span `today − return_date` (`rentalDays`), ≥ 1 exactly when
 * the row classifies as `overdue`.
 */
export function overdueDaysLabel(row: DispatchReturnRow, today: string): string | null {
  if (captionOf(row, today) !== "overdue") {
    return null;
  }
  return `${formatDuration(rentalDays(row.return_date, today))} po terminie`;
}
