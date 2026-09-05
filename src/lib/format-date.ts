// others
import type { Locale } from "./i18n/types";

// Locale-aware calendar-date formatting. Replaces `pl-date.ts`, whose three
// hand-rolled Polish tables existed on a premise that is FALSE: workerd ships a
// full ICU. Probed 2026-09-01 on `wrangler dev` and re-probed 2026-09-02 —
// `Intl.DateTimeFormat("pl-PL", {day:"numeric",month:"long"})` yields the
// GENITIVE `25 lipca`, `{month:"long"}` alone yields the nominative `lipiec`,
// and `{month:"short"}` yields `lip` — the exact three tables this module used to
// carry. See `context/foundation/lessons.md`.
//
// Two calendar conventions live here and must not be mixed:
//   * `dateEyebrow` / `dateLabel` take an INSTANT (`new Date()`) and read it on
//     the UTC calendar, matching the server-UTC `today` split the dispatch and
//     returns worklists apply (`return_date <= current_date`, Supabase runs UTC).
//   * everything else takes a CALENDAR DATE — a `Date` whose LOCAL components
//     carry the day, which is what `fromIsoDate` builds and what `date-fns`
//     `format` used to read. Those are re-anchored to UTC before formatting, so
//     a server render (workerd, UTC) and its hydrated counterpart in Europe/Warsaw
//     produce the same string. Never hand `Intl` a local-midnight `Date` directly:
//     under UTC it would fall back a day for any zone east of Greenwich.

/**
 * BCP-47 tag per app locale. `en` formats as **en-GB**, not en-US: it is a
 * structural mirror of `pl-PL` (`25 Jul`, `02 Apr`, `25–31 July 2026`), so every
 * composed label in the app keeps its day-then-month rhythm across the switch,
 * while grouping and decimals stay the English `1,234.50`.
 */
const TAGS: Record<Locale, string> = { en: "en-GB", pl: "pl-PL" };

/** The depot's zone. Company-anchored event TIMES are shown here (locale lesson). */
export const COMPANY_TIME_ZONE = "Europe/Warsaw";

type DateOptions = Omit<Intl.DateTimeFormatOptions, "timeZone">;

// `Intl.DateTimeFormat` construction is the expensive part; the same handful of
// (locale, option) pairs is re-requested on every row of every list.
const cache = new Map<string, Intl.DateTimeFormat>();

function formatter(locale: Locale, options: DateOptions): Intl.DateTimeFormat {
  const key = `${locale}|${JSON.stringify(options)}`;
  let found = cache.get(key);
  if (!found) {
    found = new Intl.DateTimeFormat(TAGS[locale], { timeZone: "UTC", ...options });
    cache.set(key, found);
  }
  return found;
}

/** Re-anchor a calendar date's LOCAL components onto the UTC calendar. */
function calendarUtc(date: Date): Date {
  return new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
}

/** Format a calendar date (local components carry the day). */
function fmt(date: Date, locale: Locale, options: DateOptions): string {
  return formatter(locale, options).format(calendarUtc(date));
}

const SHORT: DateOptions = { day: "numeric", month: "short" };
const SHORT_PADDED: DateOptions = { day: "2-digit", month: "short" };
const LONG: DateOptions = { day: "numeric", month: "long" };

/**
 * CLDR abbreviates Polish weekdays WITH a trailing full stop (`pt.`, `sob.`);
 * the design's eyebrow and filter-bar chip carry none. Strip it rather than
 * reintroduce a table — every other locale is unaffected.
 */
function weekdayShort(instant: Date, locale: Locale): string {
  return formatter(locale, { weekday: "short" }).format(instant).replace(/\.$/, "");
}

/**
 * The uppercase mobile-header eyebrow — `PT · 25 LIPCA` / `SAT · 25 JULY`.
 * Takes an instant, read on the UTC calendar.
 */
export function dateEyebrow(instant: Date, locale: Locale): string {
  return `${weekdayShort(instant, locale)} · ${formatter(locale, LONG).format(instant)}`.toUpperCase();
}

/**
 * The title-case short label — `Pt, 25 lip` / `Sat, 25 Jul`. Used on the desktop
 * returns filter bar (design O2). Takes an instant, read on the UTC calendar.
 */
export function dateLabel(instant: Date, locale: Locale): string {
  const weekday = weekdayShort(instant, locale);
  const titleCased = `${weekday.charAt(0).toUpperCase()}${weekday.slice(1)}`;
  return `${titleCased}, ${formatter(locale, SHORT).format(instant)}`;
}

/** `25 lip` / `25 Jul` — calendar date, unpadded day. (was date-fns `"d MMM"`) */
export function dayMonthShort(date: Date, locale: Locale): string {
  return fmt(date, locale, SHORT);
}

/** `02 kwi` / `02 Apr` — calendar date, zero-padded day. (was `"dd MMM"`) */
export function dayMonthShortPadded(date: Date, locale: Locale): string {
  return fmt(date, locale, SHORT_PADDED);
}

/** `25 lipca` / `25 July` — calendar date, month in the case the day demands. */
export function dayMonthLong(date: Date, locale: Locale): string {
  return fmt(date, locale, LONG);
}

/** `25 lip 2026` / `25 Jul 2026`. (was `"d MMM yyyy"`) */
export function dayMonthYearShort(date: Date, locale: Locale): string {
  return fmt(date, locale, { ...SHORT, year: "numeric" });
}

/** `lipiec 2026` / `July 2026` — standalone (NOMINATIVE in Polish) month + year. */
export function monthYearLong(date: Date, locale: Locale): string {
  return fmt(date, locale, { month: "long", year: "numeric" });
}

/** `kwi` / `Apr` — the abbreviated name of a 0-based month index. */
export function monthShort(monthIndex: number, locale: Locale): string {
  return formatter(locale, { month: "short" }).format(Date.UTC(2026, monthIndex, 1));
}

/** `sobota, 25 lipca 2026` — the full spoken date, for a day cell's accessible name. */
export function dayFull(date: Date, locale: Locale): string {
  return fmt(date, locale, { weekday: "long", day: "numeric", month: "long", year: "numeric" });
}

/**
 * An INSTANT in the company's zone, day + short time — `10 lip 2026, 14:08` /
 * `10 Jul 2026, 14:08`. The zone is pinned, never the runtime's: this renders
 * inside a `client:load` island, so an unpinned formatter would produce UTC on
 * workerd and Europe/Warsaw in the browser and hydrate mismatched (locale lesson,
 * seen 2026-07-22 on this very timestamp).
 */
export function dateTimeCompany(instant: Date, locale: Locale): string {
  return new Intl.DateTimeFormat(TAGS[locale], {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: COMPANY_TIME_ZONE,
    hourCycle: "h23",
  }).format(instant);
}

/** The clock half alone — `14:08`, in the company's zone for the same reason. */
export function timeCompany(instant: Date, locale: Locale): string {
  return new Intl.DateTimeFormat(TAGS[locale], {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: COMPANY_TIME_ZONE,
    hourCycle: "h23",
  }).format(instant);
}

/**
 * A rental span, collapsing the month when both ends share one:
 * `02 – 09 kwi` / `28 kwi – 03 maj`, and `02 – 09 Apr` / `28 Apr – 03 May`.
 *
 * Hand-composed rather than `Intl.DateTimeFormat.formatRange`, which drops the
 * padding and the spaces around the dash (`"2–9 kwi"`) — the design's chips carry
 * both. The en-GB tag is what keeps the day-then-month order identical across the
 * switch, so one composition serves both locales.
 */
export function dayMonthRange(
  from: Date,
  to: Date,
  locale: Locale,
  opts?: { pad?: boolean; month?: "short" | "long" },
): string {
  const long = opts?.month === "long";
  const withMonth = long ? LONG : opts?.pad ? SHORT_PADDED : SHORT;
  const dayOnly: DateOptions = opts?.pad && !long ? { day: "2-digit" } : { day: "numeric" };
  const sameMonth = from.getMonth() === to.getMonth() && from.getFullYear() === to.getFullYear();
  const fromLabel = fmt(from, locale, sameMonth ? dayOnly : withMonth);
  return `${fromLabel} – ${fmt(to, locale, withMonth)}`;
}

/**
 * A span carrying its year — `25–31 lipca 2026` / `28 czerwca – 4 lipca 2026`.
 * Here `formatRange` IS the right tool: its output is byte-identical to the
 * calendar header's previous hand-rolled genitive composition, and it handles the
 * month/year elision every locale words differently.
 */
export function dayMonthYearRange(from: Date, to: Date, locale: Locale): string {
  const range = formatter(locale, { ...LONG, year: "numeric" }).formatRange(calendarUtc(from), calendarUtc(to));
  // *** How the dash is padded is OURS to decide, not CLDR's. ***
  //
  // This used to strip U+2009 THIN SPACE and say "same-month output has no spaces
  // around the dash in either spelling, so this only touches the cross-month arm".
  // That was true of one ICU build and false of the next: Node 24 gives
  // `25–31 July 2026`, Node 22 (what CI runs) gives `25<U+2009>–<U+2009>31 July
  // 2026`, and production is workerd — a third ICU nobody here is testing. So the
  // caption's spacing was silently a property of the runtime.
  //
  // `sameMonth` is computed from the dates, exactly as `dayMonthRange` above does,
  // and whatever CLDR padded the range dash with is normalized to the design's
  // spacing: tight when the month is elided (`25–31 lipca 2026`), spaced when both
  // ends carry their own month (`28 czerwca – 4 lipca 2026`). `\s` already covers
  // the thin, narrow-no-break and non-breaking spaces CLDR picks between builds.
  //
  // Non-global on purpose: a formatted range holds exactly one U+2013, and an
  // identical from/to collapses to a single date with none, which this leaves alone.
  const sameMonth = from.getMonth() === to.getMonth() && from.getFullYear() === to.getFullYear();
  return range.replace(/\s*\u2013\s*/, sameMonth ? "\u2013" : " \u2013 ");
}

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/**
 * How long ago an instant was, in words — `5 minut temu`, `wczoraj`,
 * `przedwczoraj`, `3 days ago`. Replaces `date-fns`' `formatDistanceToNow`, whose
 * static `pl` import emitted Polish sentences with no literal anywhere in the repo.
 *
 * `nowMs` is passed in rather than read from the clock so a server render and its
 * hydrated counterpart agree (the SSR-mismatch half of the locale lesson).
 */
export function timeAgo(instant: Date, nowMs: number, locale: Locale): string {
  const rtf = new Intl.RelativeTimeFormat(TAGS[locale], { numeric: "auto" });
  const elapsed = nowMs - instant.getTime();
  if (elapsed < HOUR) {
    return rtf.format(-Math.max(1, Math.floor(elapsed / MINUTE)), "minute");
  }
  if (elapsed < DAY) {
    return rtf.format(-Math.floor(elapsed / HOUR), "hour");
  }
  const days = Math.floor(elapsed / DAY);
  if (days < 30) {
    return rtf.format(-days, "day");
  }
  if (days < 365) {
    return rtf.format(-Math.floor(days / 30), "month");
  }
  return rtf.format(-Math.floor(days / 365), "year");
}
