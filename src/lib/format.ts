// others
import type { Locale } from "./i18n/types";

// Pure, I/O-free presentation helpers for the public catalog. Two quirks they
// own so call sites don't have to:
//   1. Money — `numeric(10,2)` columns deserialize to `string` in supabase-js
//      despite the generated `number` type (see src/types.ts). Every money
//      helper parses `string | number` defensively; never `toFixed` a raw value.
//   2. Cargo dims — stored in cm (also string-at-runtime); the detail/card UI
//      wants metres.
//
// **This module never reaches the catalog.** Eleven React islands import it, and
// a bundler tree-shakes on exports rather than on object keys — so a single
// import of the composed `useTranslations` here would pull both locales' entire
// dictionary into every one of those chunks. It stays a pure numeric module: the
// unit words it owns (`zł`, `kg`, `m`, and the day noun `formatDuration` counts)
// are units, identical or near-identical across locales. Anything a caller could
// phrase differently belongs in a catalog namespace, reached by the caller. See
// the accessor-boundary note in `src/lib/i18n/types.ts`.
//
// The Polish enum labels this module used to carry at the bottom are GONE — they
// live in `src/lib/i18n/{vehicle,reservation}.ts` now, reached by the caller.

const DASH = "—"; // shown for absent values

/** BCP-47 tag per app locale — see `format-date.ts` for why `en` formats as en-GB. */
const TAGS: Record<Locale, string> = { en: "en-GB", pl: "pl-PL" };

/** Coerce a `string | number` (the numeric-as-string quirk) to a finite number. */
function toNumber(value: string | number): number {
  const n = typeof value === "number" ? value : parseFloat(value);
  return Number.isFinite(n) ? n : 0;
}

// `Intl.NumberFormat` construction dominates the cost; the same few
// (locale, fraction-digits) pairs are re-requested once per row of every list.
const numberFormats = new Map<string, Intl.NumberFormat>();

/**
 * `useGrouping: "always"` is NOT optional. CLDR `pl` sets
 * `minimumGroupingDigits = 2`, so the default groups only from five integer
 * digits — `5900` would render `5900`, regressing the app's most common amount
 * shape (and `format.test.ts`'s `formatPln("5900.00", "pl") === "5 900 zł"`).
 * Probed 2026-09-02. The separator `Intl` then uses for `pl` is U+00A0, which is
 * byte-identical to the hand-rolled grouper this replaced.
 */
function numberFormat(locale: Locale, fractionDigits: number): Intl.NumberFormat {
  const key = `${locale}|${fractionDigits}`;
  let found = numberFormats.get(key);
  if (!found) {
    found = new Intl.NumberFormat(TAGS[locale], {
      useGrouping: "always",
      minimumFractionDigits: fractionDigits,
      maximumFractionDigits: fractionDigits,
    });
    numberFormats.set(key, found);
  }
  return found;
}

/**
 * A thousands-grouped whole number — `128 450` under `pl`, `128,450` under `en`.
 *
 * The ONE grouper. It replaced four hand-rolled ones that disagreed on the
 * separator (`format.ts` U+00A0, `return-form.ts` U+0020, `protocol-form.ts`
 * U+202F, `protocol-pdf.ts` U+00A0) plus a scatter of bare
 * `toLocaleString("pl-PL")` calls that silently dropped grouping below five
 * digits. Anything counting km, kg or an odometer reading routes through here.
 *
 * The PDF is the one caller that must NOT: its embedded font subset carries no
 * U+202F, and a runtime whose CLDR chose that separator would draw a tofu box
 * mid-number, so it keeps its own U+00A0-pinned copy — see `media/protocol-pdf.ts`.
 */
export function formatInteger(value: string | number, locale: Locale): string {
  return numberFormat(locale, 0).format(Math.trunc(toNumber(value)));
}

/** The CLDR plural categories a locale can select. Polish uses three, English two. */
export type PluralForms = { other: string } & Partial<Record<Intl.LDMLPluralRule, string>>;

const pluralRules = new Map<Locale, Intl.PluralRules>();

/**
 * Select a counted noun's form for `n` in `locale`. Replaces the two hand-rolled
 * selectors this repo carried — one here, one in `staff-format.ts` — which each
 * open-coded Polish's 1 / 2–4 / rest split and its 12–14 exception.
 * `Intl.PluralRules("pl-PL")` reproduces both exactly
 * (probed 2026-09-01: 1→one, 2→few, 5→many, 12→many, 22→few).
 *
 * The caller supplies whichever forms its locale has and the helper falls back to
 * `other`, so **arity stops being per-language**: English passes `{one, other}`,
 * Polish `{one, few, many, other}`, and a third locale costs no code here. The
 * number is rendered by the caller — this returns the noun alone, e.g.
 * `${n} ${plural(n, locale, VEHICLE_FORMS[locale])}`.
 */
export function plural(n: number, locale: Locale, forms: PluralForms): string {
  let rules = pluralRules.get(locale);
  if (!rules) {
    rules = new Intl.PluralRules(TAGS[locale]);
    pluralRules.set(locale, rules);
  }
  return forms[rules.select(n)] ?? forms.other;
}

/**
 * The number half of a PLN amount, without the currency — `320`, `1,20`,
 * `5 900` under `pl`; `320`, `1.20`, `5,900` under `en`. For the second amount in
 * a pair that already carries the unit (e.g. "1 745 zł + 3 000 kaucji"), where
 * repeating "zł" is noise.
 */
export function formatPlnAmount(value: string | number, locale: Locale): string {
  const n = toNumber(value);
  return numberFormat(locale, Number.isInteger(n) ? 0 : 2).format(n);
}

/**
 * Format a PLN amount, e.g. `formatPln("320.00", "pl") -> "320 zł"`,
 * `formatPln(1.2, "pl") -> "1,20 zł"`, `formatPln(5900, "pl") -> "5 900 zł"`.
 * Whole amounts drop the decimal part; fractional amounts show two digits.
 *
 * **Composed by hand, never `style: "currency"`** (probed 2026-09-02). Under `pl`
 * the currency style forces two decimals (`5900 → "5900,00 zł"`), contradicting
 * the whole-amount rule above; under `en` it emits the ISO prefix
 * (`"PLN 1,234.50"`), and even `currencyDisplay: "narrowSymbol"` puts the symbol
 * BEFORE the number. `zł` stays in both locales — the business bills in PLN, and
 * a currency symbol is not a translatable word.
 */
export function formatPln(value: string | number, locale: Locale): string {
  return `${formatPlnAmount(value, locale)} zł`;
}

/** Epoch ms of an ISO `YYYY-MM-DD` date at UTC midnight (calendar math only). */
function dateValue(isoDate: string): number {
  const [year, month, day] = isoDate.split("-").map(Number);
  return Date.UTC(year, month - 1, day);
}

const MS_PER_DAY = 86_400_000;

/**
 * Whole-day rental span, e.g. `rentalDays("2026-03-24", "2026-03-27") -> 3`.
 * Calendar-day difference (`return − pickup`) — the billing unit the screens
 * show (`24 – 27 marca · 3 dni`), independent of the 14:00/10:00 hours.
 */
export function rentalDays(pickup: string, returnDate: string): number {
  return Math.round((dateValue(returnDate) - dateValue(pickup)) / MS_PER_DAY);
}

/**
 * Estimated rental total: `daily_rate × days`, e.g. `(320, 3) -> 960`.
 * Defensive about the numeric-as-string quirk; cent-rounded to avoid float
 * drift. The deposit is shown separately and never summed in.
 */
export function estimatedTotal(dailyRate: string | number, days: number): number {
  return Math.round(toNumber(dailyRate) * days * 100) / 100;
}

/**
 * Cash due at pickup: the rental estimate PLUS the refundable deposit
 * (`estimatedTotal + deposit`), e.g. `(320, 3, 2500) -> 3460`. This is the one
 * place the two are summed — the approval screen's `RAZEM DZIŚ` line shows the
 * single amount the customer pays on collection (`płatne przy odbiorze`), unlike
 * `estimatedTotal`, which deliberately keeps the deposit separate.
 */
export function totalDueAtPickup(dailyRate: string | number, days: number, deposit: string | number): number {
  return Math.round((estimatedTotal(dailyRate, days) + toNumber(deposit)) * 100) / 100;
}

// The rental-day noun, per locale. A DURATION UNIT rather than vocabulary — it is
// what `days` counts, so it belongs beside the number that arranges it, the same
// way `zł` and `kg` do. It is also the only string in this module `plural` needs,
// which is what keeps `formatDuration`'s twelve call sites from each hauling a
// forms object around (Phase 1 §1's injected-forms sketch); nothing here reaches
// the catalog either way.
const DAY_FORMS: Record<Locale, PluralForms> = {
  en: { one: "day", other: "days" },
  pl: { one: "dzień", few: "dni", many: "dni", other: "dni" },
};

/** Duration label, plural-aware: `1 dzień` / `3 dni` / `1 day` / `3 days`. */
export function formatDuration(days: number, locale: Locale): string {
  return `${days} ${plural(days, locale, DAY_FORMS[locale])}`;
}

/** Format one cm dimension as metres (`440 -> "4.40"`), or the dash when absent. */
function formatDimM(cm: string | number | null | undefined): string {
  if (cm === null || cm === undefined || cm === "") {
    return DASH;
  }
  return (toNumber(cm) / 100).toFixed(2);
}

/**
 * Cargo dimensions L × W × H in metres, e.g. `"4.30 × 1.78 × 1.94 m"`.
 * Null-safe per dimension; returns `"—"` when every dimension is absent.
 */
export function formatCargoDims(
  length: string | number | null | undefined,
  width: string | number | null | undefined,
  height: string | number | null | undefined,
): string {
  const allAbsent = [length, width, height].every((d) => d === null || d === undefined || d === "");
  if (allAbsent) {
    return DASH;
  }
  return `${formatDimM(length)} × ${formatDimM(width)} × ${formatDimM(height)} m`;
}

/** Payload capacity in kg, e.g. `"1 350 kg"` / `"1,350 kg"`, or the dash when absent. */
export function formatPayloadKg(value: string | number | null | undefined, locale: Locale): string {
  if (value === null || value === undefined || value === "") {
    return DASH;
  }
  return `${formatInteger(value, locale)} kg`;
}
