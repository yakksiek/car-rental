// others
import { captionOf, sortReturnsByUrgency } from "./returns-filter";
import type { DispatchReturnRow, DispatchRow, PendingReservation } from "../types";

// Pure, DOM-free derivation for the `/dashboard` dispatch cockpit — the KPI/chip
// counts, the Wydania/Zwroty schedule grouping with its progress label, and the
// mobile chip-filter predicate. They live here rather than inside the
// `DispatchBoard` island so the derivation stays typed, testable and free of
// render concerns, mirroring `returns-filter.ts`.
//
// `today` is the SERVER's UTC calendar date (ISO `YYYY-MM-DD`) threaded in from
// the page, so the overdue split never drifts with a client clock or a hydration
// mismatch — the same contract `ReturnQueue` uses.

/** The four KPI/chip numbers plus the `all` total. */
export interface DayCounts {
  pickups: number;
  returns: number;
  wnioski: number;
  overdue: number;
  all: number;
}

/**
 * Day totals — the row count of the view each card/chip opens, matching the
 * `ReturnQueue` convention (badge = rows shown) and the mockups. `pickups` is all
 * of today's dispatch rows, `returns` all due-or-overdue rows, `wnioski` all
 * pending requests, `overdue` the overdue subset (counted by the DB, passed in),
 * and `all` the sum of the three views. "What's left" is expressed only by the
 * schedule's progress label, never by these numbers.
 */
export function dayCounts(
  pickups: DispatchRow[],
  returns: DispatchReturnRow[],
  pending: PendingReservation[],
  overdueCount: number,
): DayCounts {
  return {
    pickups: pickups.length,
    returns: returns.length,
    wnioski: pending.length,
    overdue: overdueCount,
    all: pickups.length + returns.length + pending.length,
  };
}

/** One schedule group: its rows plus the "{done} z {total} zakończone" progress. */
export interface ScheduleGroup<Row> {
  rows: Row[];
  doneCount: number;
  total: number;
  progressLabel: string;
}

/** Today's schedule, grouped Wydania then Zwroty (the desktop card's two bands). */
export interface ScheduleGroups {
  pickups: ScheduleGroup<DispatchRow>;
  returns: ScheduleGroup<DispatchReturnRow>;
}

function progressLabel(doneCount: number, total: number): string {
  return `${doneCount} z ${total} zakończone`;
}

/**
 * Group today's work for the schedule card. Completion is free from the row data:
 * a dispatch row is done once it carries a `protocol_id`, a return row once it
 * carries a `return_protocol_id` (`captionOf` → `returned`). Returns are ordered
 * overdue → due → returned, the same urgency sort the returns worklist paints;
 * pickups keep the RPC's `reference` order.
 */
export function scheduleGroups(pickups: DispatchRow[], returns: DispatchReturnRow[], today: string): ScheduleGroups {
  // Done work sinks to the bottom of its group so the open rows — the only ones
  // that still need a person — read as the list, and the schedule shortens from
  // the top as the day progresses. `sortReturnsByUrgency` already ends on
  // `returned`, so only pickups need partitioning. Both sorts are stable, so the
  // RPC's `reference` order survives inside each block.
  const sortedReturns = sortReturnsByUrgency(returns, today);
  const sortedPickups = [...pickups].sort((a, b) => Number(Boolean(a.protocol_id)) - Number(Boolean(b.protocol_id)));
  const pickupsDone = pickups.filter((row) => Boolean(row.protocol_id)).length;
  const returnsDone = sortedReturns.filter((row) => captionOf(row, today) === "returned").length;

  return {
    pickups: {
      rows: sortedPickups,
      doneCount: pickupsDone,
      total: pickups.length,
      progressLabel: progressLabel(pickupsDone, pickups.length),
    },
    returns: {
      rows: sortedReturns,
      doneCount: returnsDone,
      total: sortedReturns.length,
      progressLabel: progressLabel(returnsDone, sortedReturns.length),
    },
  };
}

/** The mobile chip filter — single-select, `wszystko` showing all three sections. */
export type SectionKey = "wszystko" | "wydania" | "zwroty" | "wnioski";

/** The three filterable sections; `wszystko` is the "no filter" key. */
export type SectionName = Exclude<SectionKey, "wszystko">;

const SECTION_KEYS: readonly SectionKey[] = ["wszystko", "wydania", "zwroty", "wnioski"];

/** Validate a raw `?section` param; junk / absent → `wszystko` (all sections). */
export function parseSection(raw: string | null | undefined): SectionKey {
  return SECTION_KEYS.includes(raw as SectionKey) ? (raw as SectionKey) : "wszystko";
}

/** Which sections a given chip shows — `wszystko` shows all three, else just its own. */
export function isSectionVisible(active: SectionKey, section: SectionName): boolean {
  return active === "wszystko" || active === section;
}
