// Polish calendar-date formatting for server-rendered headers.
//
// Built from lookup tables, never `Intl` with a `pl-PL` locale: the Cloudflare
// workerd runtime ships a trimmed ICU and cannot be trusted for Polish
// month/weekday names server-side (see the locale lesson in
// `context/foundation/lessons.md`). Keyed on the UTC calendar so the strings agree
// with the `today` (server UTC date) split the dispatch/returns worklists use.
//
// Extracted from `returns.astro` / `dashboard.astro`, which hand-rolled the same
// two shapes; both now import from here.

/** Weekday abbreviations, lower-case, indexed by `Date.prototype.getUTCDay()`. */
export const WEEKDAYS_PL = ["niedz", "pon", "wt", "śr", "czw", "pt", "sob"] as const;

/** Month names in the genitive case ("25 lipca"), indexed by `getUTCMonth()`. */
export const MONTHS_PL = [
  "stycznia",
  "lutego",
  "marca",
  "kwietnia",
  "maja",
  "czerwca",
  "lipca",
  "sierpnia",
  "września",
  "października",
  "listopada",
  "grudnia",
] as const;

/** Three-letter month abbreviations, indexed by `getUTCMonth()`. */
export const MONTHS_ABBR_PL = ["sty", "lut", "mar", "kwi", "maj", "cze", "lip", "sie", "wrz", "paź", "lis", "gru"];

/**
 * The uppercase mobile-header eyebrow — `PT · 25 LIPCA`. Weekday abbrev · day
 * month, all upper-case.
 */
export function dateEyebrowPl(date: Date): string {
  return `${WEEKDAYS_PL[date.getUTCDay()]} · ${date.getUTCDate()} ${MONTHS_PL[date.getUTCMonth()]}`.toUpperCase();
}

/**
 * The title-case short label — `Pt, 25 lip`. Used on the desktop returns filter
 * bar (design O2).
 */
export function dateLabelPl(date: Date): string {
  const weekday = WEEKDAYS_PL[date.getUTCDay()];
  const titleCased = `${weekday.charAt(0).toUpperCase()}${weekday.slice(1)}`;
  return `${titleCased}, ${date.getUTCDate()} ${MONTHS_ABBR_PL[date.getUTCMonth()]}`;
}
