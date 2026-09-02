// others
import { monthShort } from "./format-date";
import type { Locale } from "./i18n/types";

// Pure, I/O-free presentation helpers for staff global-search rows (S-13). Kept
// out of the React components so the fiddly bits — the month abbreviations, the
// relative-day wording, and case-insensitive match segmentation — are unit
// testable on their own.
//
// Dates stay ISO `YYYY-MM-DD` STRINGS and are never turned into an instant, which
// sidesteps the timezone question entirely — a calendar date has nothing to shift.
// The month names now come from `Intl` via `format-date`; the hand-rolled Polish
// abbreviation table this used to import is deleted, along with the trimmed-ICU
// premise behind it (probed false 2026-09-01).

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
 * `searchDateRange("2026-04-02", "2026-04-09", "pl") -> "02 – 09 kwi"`. When the
 * range crosses a month boundary both ends carry their month:
 * `(…"2026-04-28", "2026-05-03") -> "28 kwi – 03 maj"`. Returns "—" for a
 * malformed date rather than throwing — a row must still render.
 *
 * The day-then-month order holds in both locales (`"02 – 09 Apr"`) because `en`
 * formats as en-GB — see `format-date.ts`.
 */
export function searchDateRange(pickup: string, returnDate: string, locale: Locale): string {
  const from = parseIso(pickup);
  const to = parseIso(returnDate);
  if (!from || !to) {
    return "—";
  }

  const toLabel = `${pad2(to.day)} ${monthShort(to.month - 1, locale)}`;
  if (from.year === to.year && from.month === to.month) {
    return `${pad2(from.day)} – ${toLabel}`;
  }
  return `${pad2(from.day)} ${monthShort(from.month - 1, locale)} – ${toLabel}`;
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
 * The three relative words stay hand-written on purpose. `Intl.RelativeTimeFormat`
 * covers this shape, but its `pl` wording for day 0 is `dzisiaj` where the design
 * board says `dziś` — which makes these a COPY choice, not grammar, so they move
 * into the catalog with the rest of the search rows rather than being retired
 * here. `locale` is what the month fallback needs.
 *
 * `today` is passed in rather than read from the clock so a server-rendered row
 * and its hydrated counterpart agree — the server runs UTC while the depot lives
 * in Europe/Warsaw, and a self-read clock would make the two disagree for part of
 * the day (the locale/timezone lesson).
 */
export function relativeDayPl(iso: string, today: string, locale: Locale): string {
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
  return parts ? `${pad2(parts.day)} ${monthShort(parts.month - 1, locale)}` : "—";
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
