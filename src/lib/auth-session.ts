// core
import type { SupabaseClient } from "@supabase/supabase-js";

// others
import { shouldSecureCookies } from "./secure-cookies";
import type { AppRole } from "../types";

// ---------------------------------------------------------------------------
// The link-token session layer.
//
// HISTORY, because the shape of this file only makes sense with it: S-14 gated
// `/api/auth/reset-password` on TWO signals — the session's `amr` claim
// (unforgeable provenance, but it never cleared) AND a one-shot marker cookie
// (freshness, but user-writable) — because `/auth/callback` exchanged the link
// token on its GET, leaving a live session and nothing else to key on.
//
// invite-journey-fixes deferred that exchange to the set-password POST, and both
// signals went with it. Provenance and freshness now come from the same place:
// HOLDING AN UNSPENT TOKEN. GoTrue mints it and GoTrue spends it, which is
// strictly stronger than an `amr` mark that outlived its own usefulness. The
// `amr` reader — the app's only JWT-claim read — was deleted in the same change;
// `git log -S "amr" -- src/lib/auth-session.ts` has it if it is ever wanted back.
//
// What remains: the cookie that carries the pending token, the parse that fails
// closed on anything malformed, the lookup that resolves a token's target
// without spending it, and the page's branch decision.
// ---------------------------------------------------------------------------

/** Which copy a link selects. Narrower than `LinkType`: GoTrue's `signup` and
 * `invite` share one token type and one welcome screen — see `linkOriginOf`. */
export type LinkOrigin = "recovery" | "invite";

/** Carries the pending link token `/auth/callback` resolved; spent by a
 * successful set, and cleared by sign-out. Name kept from its marker days so a
 * stale pre-redesign value lands in `readPendingToken`, which rejects it. */
export const LINK_ORIGIN_COOKIE = "flota-link-origin";

/** One-shot success marker, swapped in for the above and consumed by the R4 render. */
export const PW_SET_DONE_COOKIE = "flota-pw-set-done";

// `path: "/"` is load-bearing: the page lives at /auth/reset-password but its
// form posts to /api/auth/reset-password, so an `/auth`-scoped cookie would be
// invisible to the handler.
//
// `maxAge` matches the link it carries — `config.toml` sets `otp_expiry = 3600`
// and the copy tells the user "ważne 60 minut" in three places. It must NOT be
// shorter: the authority on freshness is now GoTrue's own token expiry, re-checked
// by `resolve_link_token` on every render, so a tighter cookie lifetime buys
// nothing and strands anyone who takes longer than it to type a password — a
// false "Link wygasł" while their link was still perfectly good.
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
 * `LINK_COOKIE_OPTIONS` plus the `secure` for *this* request. Shares the one rule
 * with the session cookies (`shouldSecureCookies`), so the token this carries can
 * never end up with a weaker posture than the session it will mint.
 */
export function linkCookieOptions(url: URL) {
  return { ...LINK_COOKIE_OPTIONS, secure: shouldSecureCookies(url) };
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
    // `SupabaseClient` here is the untyped default generic, so the result
    // arrives as `any` — name its shape once.
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
