// ---------------------------------------------------------------------------
// Locale resolution — the pure, I/O-free reader middleware feeds.
//
// Mirrors `src/lib/access.ts`'s shape: middleware does the I/O (cookie jar +
// the `profiles` select it already runs), this decides. Keeping it pure is what
// makes the precedence unit-testable without a request, and what lets the
// integration suite prove the demo carve-out against a REAL stored value.
// ---------------------------------------------------------------------------

// others
import { DEFAULT_LOCALE, isLocale, type Locale } from "./types";

export interface LocaleSignals {
  /** Raw `locale` cookie value, if any. Untrusted — anything can be in here. */
  cookie?: string | null;
  /** `profiles.locale` for the signed-in staffer. Null = no preference. */
  profileLocale?: string | null;
  /**
   * Whether that profile row is the published DEMO account
   * (`profiles.is_demo`). See the carve-out below.
   */
  isDemo?: boolean;
}

/**
 * Cookie → `profiles.locale` → `DEFAULT_LOCALE`.
 *
 * Never throws and never returns null: an unrecognised value at either level is
 * treated as absent, so a hand-edited cookie degrades to the next signal rather
 * than erroring or 500ing every page.
 *
 * **The demo carve-out.** Every demo visitor shares ONE `profiles` row, so
 * without this skip the first recruiter to touch the switcher would set the
 * language for every recruiter who signs in afterwards — precisely defeating
 * the acceptance test ("reads English from a CV link to sign-out with zero
 * interaction"). The cookie still governs WITHIN a session, so a demo visitor's
 * own switch works exactly as a real staffer's; only the cross-visitor
 * carry-over is cut.
 *
 * ***PAIRED WITH `set_profile_locale` IN
 * supabase/migrations/20260902120000_locale_dimension.sql.*** That function
 * writes for the demo account like any other, so the demo is indistinguishable
 * from a real account to anyone inspecting it — this read-side skip is the ONLY
 * thing preventing the leak. A stored value that nothing reads is exactly what a
 * later change "cleans up", so neither half may be removed without the other.
 * `tests/integration/locale.test.ts` is what fails if it is.
 */
export function resolveLocale(signals: LocaleSignals): Locale {
  if (isLocale(signals.cookie)) {
    return signals.cookie;
  }
  if (!signals.isDemo && isLocale(signals.profileLocale)) {
    return signals.profileLocale;
  }
  return DEFAULT_LOCALE;
}

/** The cookie the switcher writes and middleware reads. */
export const LOCALE_COOKIE = "locale";
