// core
import type { SupabaseClient } from "@supabase/supabase-js";

// others
import { shouldSecureCookies } from "./secure-cookies";
import type { AppRole } from "../types";

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
// invisible to the handler.
//
// `maxAge` matches the link it gates — `config.toml` sets `otp_expiry = 3600`
// and `jwt_expiry = 3600`, and the copy tells the user "ważne 60 minut" in three
// places. It must NOT be shorter: freshness here comes from the marker being
// stamped by *this* navigation and spent on success, not from its lifetime, so a
// tighter value buys nothing and strands anyone who takes longer than it to type
// a password. They would get a false "Link wygasł" while their link session was
// still alive, and its CTA would send them for a new link that `/auth/callback`
// then refuses — because they are still signed in.
//
// `secure` is NOT here because it is decided per request — under `npm run dev`
// the app is served over plain http, where a blanket `secure: true` drops the
// cookie entirely and takes the whole reset flow down with it.
export const LINK_COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: "lax",
  path: "/",
  maxAge: 3600,
} as const;

/**
 * `LINK_COOKIE_OPTIONS` plus the `secure` for *this* request. Shares the one
 * rule with the session cookies (`shouldSecureCookies`), so the marker can never
 * end up with a weaker posture than the session it gates.
 */
export function linkCookieOptions(url: URL) {
  return { ...LINK_COOKIE_OPTIONS, secure: shouldSecureCookies(url) };
}

/** Narrow a raw marker-cookie value to a known link origin; anything else → null. */
export function readLinkOrigin(value: string | undefined): LinkOrigin | null {
  return value === "recovery" || value === "invite" ? value : null;
}

// ---------------------------------------------------------------------------
// Pending link token (invite-journey-fixes) — the cookie's new payload.
//
// The exchange no longer happens on the callback GET, so the cookie stops being
// a freshness MARKER and becomes the CARRIER for the credential the POST will
// spend: `token_hash` + `type`. Freshness is subsumed by GoTrue's own token
// expiry, which is the authority now (and is re-enforced by
// `resolve_link_token`, since auth.one_time_tokens has no expiry column).
//
// The cookie name is unchanged on purpose: a stale value left in a browser from
// before this deploy is a bare "invite"/"recovery" string, which `readPendingToken`
// rejects — so it fails closed to R13/R12 rather than granting anything.
//
// `httpOnly` + short-lived + single-use (from LINK_COOKIE_OPTIONS) is the posture
// a cookie-borne credential requires; it is unchanged from the marker's.
// ---------------------------------------------------------------------------

/** The link kinds this app actually mints. `?type` is caller-supplied, so it is
 * validated against this closed SET before it reaches the lookup. It bounds the
 * set; it does NOT bound the PAIRING of hash-to-type — `resolve_link_token`'s
 * clause 1 does that, and both are required. */
export const LINK_TYPES = ["recovery", "invite", "signup"] as const;
export type LinkType = (typeof LINK_TYPES)[number];

export const isLinkType = (raw: string | null | undefined): raw is LinkType =>
  raw != null && (LINK_TYPES as readonly string[]).includes(raw);

/** Which copy the link selects. GoTrue treats invite and signup as one token
 * type, and so does the page: both get the welcome. */
export function linkOriginOf(type: LinkType): LinkOrigin {
  return type === "recovery" ? "recovery" : "invite";
}

export interface PendingLinkToken {
  type: LinkType;
  tokenHash: string;
}

// GoTrue's token hash is a hex digest today (56 chars, probed against v2.188.1),
// but PKCE variants prefix it. Bound the shape rather than pinning a length:
// URL-safe characters only, so a value can never smuggle a cookie separator, and
// a length window so a malformed cookie is rejected before it reaches the DB.
const TOKEN_HASH_RE = /^[A-Za-z0-9_-]{16,255}$/;

/** `<type>.<token_hash>` — type first, so a malformed tail can never be read as a type. */
export function serializePendingToken(token: PendingLinkToken): string {
  return `${token.type}.${token.tokenHash}`;
}

/** Parse the pending-token cookie. Fails closed on ANY malformed input. */
export function readPendingToken(value: string | undefined): PendingLinkToken | null {
  if (!value) {
    return null;
  }
  const separator = value.indexOf(".");
  if (separator <= 0) {
    return null;
  }
  const type = value.slice(0, separator);
  const tokenHash = value.slice(separator + 1);
  if (!isLinkType(type) || !TOKEN_HASH_RE.test(tokenHash)) {
    return null;
  }
  return { type, tokenHash };
}

// ---------------------------------------------------------------------------
// Token lookup + page branch selection
// ---------------------------------------------------------------------------

/** Who a link is for, resolved WITHOUT spending it. `role` is null for a
 * deactivated staffer or a profile-less orphan — R14's population. */
export interface ResolvedLinkTarget {
  userId: string;
  email: string;
  fullName: string | null;
  role: AppRole | null;
}

interface ResolveLinkTokenRow {
  user_id: string;
  email: string;
  full_name: string | null;
  role: AppRole | null;
}

/**
 * Resolve a pending token's target through `resolve_link_token`. Returns null
 * when the RPC yields no row — which is the single answer to "bad hash", "wrong
 * type for this hash", and "past the otp window". LOOKUP ONLY: the token is not
 * spent, so this is safe to run on a GET and safe to repeat.
 */
export async function resolveLinkTarget(
  supabase: SupabaseClient,
  token: PendingLinkToken,
): Promise<ResolvedLinkTarget | null> {
  try {
    // `SupabaseClient` here is the untyped default generic (same as
    // `readSessionOrigin`), so the result arrives as `any` — name its shape once.
    const { data, error } = (await supabase.rpc("resolve_link_token", {
      p_token_hash: token.tokenHash,
      p_type: token.type,
    })) as { data: ResolveLinkTokenRow[] | null; error: { message: string } | null };
    if (error) {
      return null;
    }
    // `.at()` rather than `[0]`: without `noUncheckedIndexedAccess` an index read
    // types as always-present, and the fail-closed arm below would read as dead
    // code to the type-checker while being the load-bearing one at runtime.
    const row = (data ?? []).at(0);
    return row ? { userId: row.user_id, email: row.email, fullName: row.full_name, role: row.role } : null;
  } catch {
    return null;
  }
}

/** Which screen `/auth/reset-password` renders. */
export type ResetPasswordBranch =
  | "done" // R4  — password just set
  | "nothing-to-set" // R13 — cold visitor, no link
  | "inactive-account" // R14 — the link's target is deactivated / role-less
  | "in-app" // R12 — signed in, no link: use the account screen
  | "expired" // R5  — a token cookie that no longer resolves
  | "form"; // R3/R9 (recovery) or R6/R10 (invite)

/**
 * The page's branch, as a pure function so the `unit` project can hold it — an
 * `.astro`-only edit runs no test at all (research §4).
 *
 * Branches 2 and 4 partition the "no pending token" case BY WHETHER A SESSION
 * EXISTS. Collapsing them into a single "no token" test would swallow branch 4's
 * whole population — a signed-in staffer who typed the URL — and take R12's block
 * dead with it, including its AccountBox. Order below is the page's documented order.
 */
export function selectResetPasswordBranch(input: {
  done: boolean;
  hasSession: boolean;
  pendingToken: PendingLinkToken | null;
  target: ResolvedLinkTarget | null;
}): ResetPasswordBranch {
  if (input.done) {
    return "done";
  }
  if (!input.pendingToken && !input.hasSession) {
    return "nothing-to-set";
  }
  if (input.pendingToken && input.target?.role === null) {
    return "inactive-account";
  }
  if (!input.pendingToken) {
    return "in-app";
  }
  if (!input.target) {
    return "expired";
  }
  return "form";
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
  //
  // ⚠ `amr` ACCUMULATES, and `otp` is checked first — so a session carrying BOTH
  // `password` and `otp` classifies as `"link"`. That shape is unreachable today
  // only because `/auth/callback` refuses to exchange a token when a session
  // already exists (`callback.ts:30-32`), and nothing else in the app calls
  // `verifyOtp` / `exchangeCodeForSession` / `signInWithOtp` / `setSession`. That
  // guard is therefore not only the R3 anti-fixation fix it is documented as — it
  // is what stops this OR from promoting an ordinary password session to
  // link-origin. Any new link-exchange call site must preserve it.
  if (methods.includes("otp")) {
    return "link";
  }
  if (methods.includes("password")) {
    return "password";
  }
  return "unknown";
}
