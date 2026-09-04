// ---------------------------------------------------------------------------
// The catalog's primitives — and the ISLAND-SAFE half of the accessor pair.
//
// Everything here is pure and imports NO namespace. That is deliberate and
// load-bearing: React islands reach `translator()` from this module, and a
// bundler tree-shakes on EXPORTS, not on object keys. If the island accessor
// lived beside the composed map in `./index.ts`, every island that called it
// would pull every namespace — both locales' full dictionary — into its own
// browser chunk, which is the exact cost the per-domain namespacing exists to
// avoid. See `./index.ts` for the other half of the boundary.
// ---------------------------------------------------------------------------

// Ordered: the switcher renders them in this order, and `DEFAULT_LOCALE` is the
// one an unresolved request falls back to.
export const LOCALES = ["en", "pl"] as const;

export type Locale = (typeof LOCALES)[number];

/**
 * Each locale's ENDONYM — its name in its own language. Deliberately NOT a
 * catalog namespace: a language control has to read in the language it names,
 * so "Polski" stays "Polski" for an English reader and vice versa. It is the
 * one label in the app that must never depend on a translation key.
 *
 * Used by the staff sidebar / account locale rows (design `SidebarLangRow`);
 * the compact header toggle shows the uppercased 2-letter code instead.
 */
export const LOCALE_ENDONYMS: Record<Locale, string> = {
  en: "English",
  pl: "Polski",
};

// English is the DEFAULT; Polish is the opt-in. The driver for this whole slice
// is the portfolio/recruiter reader, who must not have to find a switch first.
export const DEFAULT_LOCALE: Locale = "en";

/**
 * The parity constraint every namespace file is declared against: `en` supplies
 * the key set, `pl` must cover exactly it. A missing Polish key is a TYPE error,
 * not a runtime fallback — the fallback below exists for robustness in
 * production, never as a licence to ship an untranslated key.
 */
export interface Dict<T extends Record<string, string>> {
  en: T;
  pl: Record<keyof T, string>;
}

/**
 * Declare a namespace. The generic is inferred from the `en` half, so `pl` is
 * then checked against it: a missing key fails to type-check, and an extra one
 * trips excess-property checking on the object literal.
 *
 * ```ts
 * export const vehicle = defineDict({
 *   en: { cargoVan: "Cargo van" },
 *   pl: { cargoVan: "Furgon" },
 * });
 * ```
 */
export function defineDict<T extends Record<string, string>>(dict: Dict<T>): Dict<T> {
  return dict;
}

/** Narrow an untrusted string (a cookie value, a form field) to a `Locale`. */
export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (LOCALES as readonly string[]).includes(value);
}

/**
 * Read a STORED locale — a `text` column, which the generated database types
 * surface as a bare `string` — as a `Locale`, falling back to the default.
 *
 * The fallback is unreachable in practice: `profiles.locale`,
 * `reservations.locale` and `protocols.locale` each carry a `check (… in
 * ('en','pl'))` constraint, so the database cannot hold anything else. It exists
 * so a column that somehow did (a hand-run UPDATE, a restored dump) renders the
 * app's default language rather than crashing an email send or a PDF build —
 * these values are read on paths where there is no user to show an error to.
 */
export function asLocale(value: string | null | undefined): Locale {
  return isLocale(value) ? value : DEFAULT_LOCALE;
}

/**
 * A translator bound to ONE namespace — the accessor anything an island can
 * reach must use. The island imports its own namespace module and takes
 * `locale` as a prop (it cannot read `Astro.locals`), so only that namespace
 * lands in its chunk.
 *
 * `src/lib` modules and API routes may use either this or the composed
 * `useTranslations` from `./index.ts` — but a `src/lib` module that ISLANDS
 * import must use this one, or the composed map follows it into the browser.
 */
export function translator<T extends Record<string, string>>(
  locale: Locale,
  namespace: Dict<T>,
): (key: keyof T & string) => string {
  // Widened to an optional-valued map so the runtime fallbacks below are
  // expressible. The `Dict` type has already made a missing key a compile error;
  // these two `??` arms exist only so a catalog that somehow ships incomplete
  // renders a key rather than `undefined` in production.
  const table = namespace[locale] as Record<string, string | undefined>;
  const fallback = namespace[DEFAULT_LOCALE] as Record<string, string | undefined>;
  return (key) => table[key] ?? fallback[key] ?? key;
}
