// ---------------------------------------------------------------------------
// The COMPOSED translator — SERVER-ONLY, and the other half of the accessor
// boundary described in `./types.ts`.
//
// This module imports every namespace, so anything that reaches it pulls the
// whole catalog — both locales, every domain. That is free for `.astro`
// components, which ship no JavaScript to the browser, and it is why
// `Astro.locals.t` is the ergonomic accessor there. It is NOT free for a React
// island, so:
//
//   * `.astro` components + API routes + server-only `src/lib` modules →
//     `useTranslations(locale)` / `Astro.locals.t` (here).
//   * React islands, and any `src/lib` module an island imports →
//     `translator(locale, namespace)` from `./types`, importing only the one
//     namespace they need.
//
// Nothing downstream catches a breach of that rule automatically until the
// island-chunk comparison in the copy phases (baseline in
// `context/changes/english-localization/island-baseline.md`), so the rule is
// stated at both ends rather than in one place.
// ---------------------------------------------------------------------------

// others
import { api } from "./api";
import { auth } from "./auth";
import { config } from "./config";
import { footer } from "./footer";
import { landing } from "./landing";
import { layout } from "./layout";
import { nav } from "./nav";
import { search } from "./search";
import { staff } from "./staff";
import { vehicle } from "./vehicle";
import { DEFAULT_LOCALE, type Dict, type Locale } from "./types";

export { DEFAULT_LOCALE, LOCALES, defineDict, isLocale, translator } from "./types";
export type { Dict, Locale } from "./types";
export { LOCALE_COOKIE, resolveLocale } from "./resolve";
export type { LocaleSignals } from "./resolve";

// Register every namespace here. The key becomes the `ns.` prefix of its keys.
const NAMESPACES = { api, auth, config, footer, landing, layout, nav, search, staff, vehicle };

type Namespaces = typeof NAMESPACES;

/**
 * Every valid `"ns.key"` string, derived from the namespaces themselves — so a
 * typo, or a key that only one locale has, is a compile error rather than a
 * silent fallback at runtime.
 */
export type TranslationKey = {
  [N in keyof Namespaces]: `${N}.${keyof Namespaces[N]["en"] & string}`;
}[keyof Namespaces];

/**
 * Bind a translator to one locale. `src/middleware.ts` puts the result on
 * `Astro.locals.t`; plain server modules call this directly, exactly as
 * Starlight's `useTranslations(lang)` does for its non-component code.
 *
 * Falls back to `DEFAULT_LOCALE`, then to the key itself. Both fallbacks are
 * production robustness only — the `Dict` type makes a missing key a type error
 * long before either can fire.
 */
export function useTranslations(locale: Locale) {
  return function t(key: TranslationKey): string {
    const separator = key.indexOf(".");
    const namespace = key.slice(0, separator) as keyof Namespaces;
    const entry = key.slice(separator + 1);

    // The `TranslationKey` union has already proved both halves resolve; the
    // widening to an optional-valued map is only so the runtime fallbacks are
    // expressible (see `translator`).
    const dict = NAMESPACES[namespace] as Dict<Record<string, string>>;
    const table = dict[locale] as Record<string, string | undefined>;
    const fallback = dict[DEFAULT_LOCALE] as Record<string, string | undefined>;
    return table[entry] ?? fallback[entry] ?? key;
  };
}
