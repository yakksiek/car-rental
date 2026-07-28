// others
import { safeRedirectPath } from "./safe-redirect";

// Where a protocol / handover screen's "back" affordance returns to.
//
// These screens used to be reachable from exactly one place — their own worklist —
// so every back link was hardcoded to it. The dispatch cockpit (`/dashboard`) made
// them reachable from a SECOND entry point, and a fixed target then strands the
// user on a page they never came from ("open a return from the pulpit, press back,
// land on the returns queue").
//
// The origin therefore travels in the URL as `?from=<path>`, validated by the same
// `safeRedirectPath` open-redirect guard the sign-in flow uses: a caller-supplied
// absolute or protocol-relative URL can never turn a back button into an off-site
// bounce. `?from` absent ⇒ the caller's own default, so every pre-existing link
// behaves exactly as before and only the dashboard has to opt in.
//
// Not `history.back()`: these screens survive a deep link and a reload, and the
// forms redirect on submit — a history hop would land back inside the form the user
// just completed.

/** The query key carrying the originating path. */
export const FROM_PARAM = "from";

/** Known origins get their own wording; anything else falls back to a bare "Wróć". */
const BACK_LABELS: Record<string, string> = {
  "/dashboard": "Wróć do pulpitu",
  "/dashboard/pickups": "Wróć do wydań",
  "/dashboard/returns": "Wróć do zwrotów",
};

export interface BackTarget {
  href: string;
  label: string;
}

/**
 * Resolve the back affordance from a raw `?from` value.
 *
 * `fallback` is the screen's own historical default (its worklist), used whenever
 * `from` is absent or fails the safety guard. The label always matches the target
 * that is actually navigated to, which also fixes the pre-existing mismatch where
 * the handover screens said "Wróć do pulpitu" while linking to a queue.
 */
export function resolveBackTarget(raw: string | null | undefined, fallback: string): BackTarget {
  // `safeRedirectPath` answers with DEFAULT_POST_LOGIN ("/dashboard") for junk, which
  // is not what a screen whose default is a worklist wants — so only trust it when a
  // value was actually supplied AND it survived unchanged.
  const href = raw && safeRedirectPath(raw) === raw ? raw : fallback;
  // The origin may carry state in its query (the cockpit sends back the active
  // `?section` so the chip survives the round trip), so key the wording on the
  // PATH alone — otherwise every stateful origin degrades to a bare "Wróć".
  const pathname = href.split(/[?#]/)[0];
  return { href, label: BACK_LABELS[pathname] ?? "Wróć" };
}

/** Append `?from=<origin>` to a link so the destination can find its way back. */
export function withFrom(href: string, origin: string): string {
  return `${href}?${FROM_PARAM}=${encodeURIComponent(origin)}`;
}
