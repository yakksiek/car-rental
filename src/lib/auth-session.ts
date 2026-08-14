// core
import type { SupabaseClient } from "@supabase/supabase-js";

// ---------------------------------------------------------------------------
// Session origin (S-14) — the single answer to "how was this session minted?".
//
// `/api/auth/reset-password` must accept ONLY a session that came from a
// recovery/invite link exchange. GoTrue records that in the access token's `amr`
// claim (RFC 8176): `password` for `signInWithPassword`, `otp` for both
// `verifyOtp` exchanges — probe-verified against GoTrue v2.188.1, and it
// survives a token refresh verbatim. `getUser()` does not surface `amr`, so the
// claim is reachable only by decoding the token from `getSession()`.
//
// ⚠ `getSession()` DOES NOT VERIFY THE SIGNATURE — it decodes the cookie as it
// found it. This module is therefore a SUPPLEMENT to middleware's `getUser()`
// (which does validate against the auth server), never a substitute: read it
// only on a request where `locals.user` is already populated. Alone it would be
// trusting an unverified token — the opposite of what `src/middleware.ts:14-16`
// gets right today. This is also the app's first JWT-claim read (F-02 chose the
// `profiles` lookup over claims), which is why it lives in exactly one helper.
//
// And it is not sufficient alone either: the `otp` mark NEVER clears, so an
// `amr`-only gate would leave a recovery session holding set-password rights for
// its whole life. The one-shot marker cookie below supplies the freshness the
// claim structurally cannot; the route requires BOTH. An unsigned cookie is safe
// in that AND — it can only ever deny, never grant.
// ---------------------------------------------------------------------------

/** How the current session was minted. `unknown` is the fail-closed default. */
export type SessionOrigin = "link" | "password" | "unknown";

/** Which kind of link minted it — also the marker cookie's value. */
export type LinkOrigin = "recovery" | "invite";

/** One-shot marker stamped by `/auth/callback`, spent by a successful set. */
export const LINK_ORIGIN_COOKIE = "flota-link-origin";

/** One-shot success marker, swapped in for the above and consumed by the R4 render. */
export const PW_SET_DONE_COOKIE = "flota-pw-set-done";

// `path: "/"` is load-bearing: the page lives at /auth/reset-password but its
// form posts to /api/auth/reset-password, so an `/auth`-scoped cookie would be
// invisible to the handler. `maxAge` matches the reset window (15 min); `secure`
// is NOT here because it must be derived per request — local dev runs over
// http://localhost, where a blanket `secure: true` drops the cookie entirely.
export const LINK_COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: "lax",
  path: "/",
  maxAge: 900,
} as const;

/** `LINK_COOKIE_OPTIONS` plus a `secure` derived from *this* request's protocol. */
export function linkCookieOptions(url: URL) {
  return { ...LINK_COOKIE_OPTIONS, secure: url.protocol === "https:" };
}

/** Narrow a raw marker-cookie value to a known link origin; anything else → null. */
export function readLinkOrigin(value: string | undefined): LinkOrigin | null {
  return value === "recovery" || value === "invite" ? value : null;
}

/** base64url → decoded UTF-8 text, or null when the segment isn't decodable. */
function decodeBase64Url(segment: string): string | null {
  const base64 = segment.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), "=");
  try {
    // No JWT library: workerd provides `atob`, and the payload is read for a
    // hint only — the signature is checked by GoTrue via the paired `getUser()`.
    const binary = atob(padded);
    return new TextDecoder().decode(Uint8Array.from(binary, (char) => char.charCodeAt(0)));
  } catch {
    return null;
  }
}

/** The `amr` array out of a JWT payload segment, or null if absent/malformed. */
function readAmr(accessToken: string): unknown[] | null {
  const payload = accessToken.split(".")[1];
  if (!payload) {
    return null;
  }
  const json = decodeBase64Url(payload);
  if (json === null) {
    return null;
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    return null;
  }
  if (typeof parsed !== "object" || parsed === null) {
    return null;
  }
  const amr = (parsed as { amr?: unknown }).amr;
  return Array.isArray(amr) ? amr : null;
}

/**
 * Classify the caller's session by its `amr` claim. Fails closed: no session, a
 * malformed token, or an `amr` we don't recognise all resolve to `"unknown"`,
 * which no gate accepts.
 *
 * MUST be paired with a validating `getUser()` (middleware already ran one) —
 * see the module comment.
 */
export async function readSessionOrigin(supabase: SupabaseClient): Promise<SessionOrigin> {
  let accessToken: string | undefined;
  try {
    const { data } = await supabase.auth.getSession();
    accessToken = data.session?.access_token;
  } catch {
    return "unknown";
  }
  if (!accessToken) {
    return "unknown";
  }

  const amr = readAmr(accessToken);
  if (!amr) {
    return "unknown";
  }

  const methods = amr.map((entry) =>
    typeof entry === "object" && entry !== null ? (entry as { method?: unknown }).method : undefined,
  );
  // GoTrue collapses its distinct Recovery / Invite / MagicLink constants to the
  // single string `otp`, so this proves "came from a link", not which link.
  if (methods.includes("otp")) {
    return "link";
  }
  if (methods.includes("password")) {
    return "password";
  }
  return "unknown";
}
