// ---------------------------------------------------------------------------
// The orientation overlay's seen-state — the pure, I/O-free reader the landing
// page feeds.
//
// Same split as `src/lib/i18n/resolve.ts`: the page does the I/O (cookie jar +
// `Astro.locals.user`), this decides. Keeping it pure is what makes the
// precedence unit-testable without a request, and what keeps the decision in
// ONE place rather than inline in `index.astro`.
// ---------------------------------------------------------------------------

/**
 * The cookie the dismiss route writes and the landing page reads.
 *
 * Unprefixed, like `locale`: this is the PRESENTATION class of cookie, a stated
 * preference about what the site shows. The `flota-` prefix is reserved for the
 * auth-session markers in `src/lib/auth-session.ts`.
 */
export const ORIENTATION_COOKIE = "orientation";

/** The one value the cookie ever holds. Anything else is treated as absent. */
export const ORIENTATION_SEEN = "seen";

export interface OrientationSignals {
  /** Raw `orientation` cookie value, if any. Untrusted — anything can be here. */
  cookie?: string | null;
  /** Whether this request carries a staff session (`Astro.locals.user`). */
  signedIn?: boolean;
}

/**
 * Whether the landing page should open the overlay by itself.
 *
 * Two suppressions, in order:
 *
 *   * the visitor has already dismissed it (the cookie holds the seen value);
 *   * the request is signed in — staff already know what the two products are,
 *     and this is also what keeps the overlay out of the e2e suite's default
 *     `employee` storage state (`e2e/locale-pl.spec.ts` visits `/`).
 *
 * Never throws, and an unrecognised cookie value is treated as absent — a
 * hand-edited cookie shows the overlay rather than erroring the landing page.
 */
export function shouldAutoShowOrientation(signals: OrientationSignals): boolean {
  if (signals.cookie === ORIENTATION_SEEN) {
    return false;
  }
  if (signals.signedIn) {
    return false;
  }
  return true;
}
