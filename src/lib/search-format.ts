// others
import { MONTHS_ABBR_PL } from "./pl-date";

// Pure, I/O-free presentation helpers for staff global-search rows (S-13). Kept
// out of the React components so the fiddly bits — Polish month abbreviations,
// the relative-day wording, and case-insensitive match segmentation — are unit
// testable on their own.
//
// Like `pl-date`, dates are handled as ISO `YYYY-MM-DD` STRINGS and never routed
// through `Intl`: the Cloudflare workerd runtime ships a trimmed ICU and cannot be
// trusted for Polish month names server-side, and these rows are server-rendered
// on the results page. Splitting the string also sidesteps the timezone question
// entirely — a calendar date has no instant to shift.

interface IsoParts {
  year: number;
  month: number;
  day: number;
}

function parseIso(iso: string): IsoParts | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!match) {
    return null;
  }
  return { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) };
}

const pad2 = (n: number) => String(n).padStart(2, "0");

/**
 * The rental span shown under a result row's customer name:
 * `searchDateRange("2026-04-02", "2026-04-09") -> "02 – 09 kwi"`. When the range
 * crosses a month boundary both ends carry their month:
 * `("2026-04-28", "2026-05-03") -> "28 kwi – 03 maj"`. Returns "—" for a
 * malformed date rather than throwing — a row must still render.
 */
export function searchDateRange(pickup: string, returnDate: string): string {
  const from = parseIso(pickup);
  const to = parseIso(returnDate);
  if (!from || !to) {
    return "—";
  }

  const toLabel = `${pad2(to.day)} ${MONTHS_ABBR_PL[to.month - 1]}`;
  if (from.year === to.year && from.month === to.month) {
    return `${pad2(from.day)} – ${toLabel}`;
  }
  return `${pad2(from.day)} ${MONTHS_ABBR_PL[from.month - 1]} – ${toLabel}`;
}

/** Whole days between two ISO calendar dates (`b - a`), or null if either is malformed. */
function dayDelta(a: string, b: string): number | null {
  const from = parseIso(a);
  const to = parseIso(b);
  if (!from || !to) {
    return null;
  }
  const MS_PER_DAY = 86_400_000;
  const fromUtc = Date.UTC(from.year, from.month - 1, from.day);
  const toUtc = Date.UTC(to.year, to.month - 1, to.day);
  return Math.round((toUtc - fromUtc) / MS_PER_DAY);
}

/**
 * When a return is (or was) due, worded relative to `today`:
 * `"dziś"` / `"wczoraj"` / `"jutro"`, and a plain `"12 kwi"` beyond that window.
 *
 * `today` is passed in rather than read from the clock so a server-rendered row
 * and its hydrated counterpart agree — the server runs UTC while the depot lives
 * in Europe/Warsaw, and a self-read clock would make the two disagree for part of
 * the day (the locale/timezone lesson).
 */
export function relativeDayPl(iso: string, today: string): string {
  const delta = dayDelta(today, iso);
  if (delta === null) {
    return "—";
  }
  if (delta === 0) {
    return "dziś";
  }
  if (delta === -1) {
    return "wczoraj";
  }
  if (delta === 1) {
    return "jutro";
  }

  const parts = parseIso(iso);
  return parts ? `${pad2(parts.day)} ${MONTHS_ABBR_PL[parts.month - 1]}` : "—";
}

export interface HighlightSegment {
  text: string;
  match: boolean;
}

/**
 * Split `text` into alternating plain / matched segments so a row can wrap the
 * matches in `<mark>`. Case-insensitive but diacritic-SENSITIVE: "wasik" must not
 * highlight inside "Wąsik", because the search itself (Postgres ILIKE) would not
 * have matched it either — highlighting more than the query found would be a lie
 * about why the row is there.
 *
 * Returns a single unmatched segment for an empty/whitespace query, and never
 * loops forever on one (the empty needle is rejected up front).
 */
export function highlightSegments(text: string, query: string): HighlightSegment[] {
  const needle = query.trim().toLowerCase();
  if (!needle) {
    return [{ text, match: false }];
  }

  const haystack = text.toLowerCase();
  const segments: HighlightSegment[] = [];
  let cursor = 0;

  for (;;) {
    const index = haystack.indexOf(needle, cursor);
    if (index === -1) {
      break;
    }
    if (index > cursor) {
      segments.push({ text: text.slice(cursor, index), match: false });
    }
    segments.push({ text: text.slice(index, index + needle.length), match: true });
    cursor = index + needle.length;
  }

  if (cursor < text.length) {
    segments.push({ text: text.slice(cursor), match: false });
  }
  return segments;
}
