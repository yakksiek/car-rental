// core
import type { APIRoute } from "astro";

// others
import {
  LINK_ORIGIN_COOKIE,
  isLinkType,
  linkCookieOptions,
  linkOriginOf,
  resolveLinkTarget,
  serializePendingToken,
} from "../../lib/auth-session";

// Recovery / invite-accept callback (S-08, redesigned by invite-journey-fixes).
//
// The custom email templates (supabase/templates/{invite,recovery}.html) link
// here with a self-contained `?token_hash=&type=`. This handler used to EXCHANGE
// that token with `verifyOtp` — on a GET, so the token was spent the moment the
// set-password form rendered. Two defects followed: reopening the link answered
// "Link wygasł" (Bug 2), and clicking it alone minted a full employee session
// before any password existed (measured 2026-08-20: `/dashboard` answered 200).
//
// Nothing irreversible happens here any more. The GET now does
// validate → resolve → gate → stamp, and the POST at
// /api/auth/reset-password spends the token as one operation with the password
// set. The link is therefore IDEMPOTENT: opening it twice renders the form twice.
//
// ⚠ `verifyOtp` was enforcing four guarantees at once, not just "the exchange"
// (lessons.md -> "Moving a call moves only the guarantee you named"). Identity,
// the hash↔type pairing, the otp expiry window, and deactivation-awareness all
// moved into `resolve_link_token`, which returns NO ROW unless every one holds.
// This comment block used to credit `verifyOtp` with the type-pairing guarantee;
// that is now clause 1 of the RPC, and the committed probe lives at
// tests/integration/auth-callback.test.ts.
//
// The `?code=` PKCE arm is GONE. Our own templates never mint one, it has no
// deferred form, and keeping it would leave one arm that defers and one that
// exchanges. Removing it also retires the impl-review F1 hazard that forced
// `invite` to be computed inside the `token_hash` arm.

const EXPIRED = "/auth/forgot-password?expired=1";

export const GET: APIRoute = async (context) => {
  // (S-14, R3) Never install anything over an existing session. This stays even
  // though no session is minted here: a colleague signed in on a shared
  // workstation must be routed to the R11 card rather than have the hire's link
  // quietly stamped into their browser. Returning here spends nothing, which is
  // exactly what the R11 copy promises — and under this design that promise is
  // now literally true, because the token is still unspent afterwards.
  if (context.locals.user) {
    return context.redirect("/auth/link-conflict");
  }

  const supabase = context.locals.supabase;
  if (!supabase) {
    return context.redirect(EXPIRED);
  }

  const url = context.url;
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type");

  // `type` is caller-supplied and must be validated before it reaches the lookup.
  // This bounds the SET; the RPC's clause 1 bounds the PAIRING. Both are needed —
  // neither replaces what `verifyOtp` used to guarantee on its own.
  if (!tokenHash || !isLinkType(type)) {
    return context.redirect(EXPIRED);
  }

  // Resolve WITHOUT spending. No row means bad hash, wrong type for this hash, or
  // past the otp window — all of which are "your link doesn't work", never a 500.
  const target = await resolveLinkTarget(supabase, { type, tokenHash });
  if (!target) {
    return context.redirect(EXPIRED);
  }

  // Stamp the pending token. A non-employee target (deactivated, or a
  // profile-less orphan) is stamped too and refused one hop later by the page's
  // R14 branch, which needs the cookie to know WHICH link it is refusing. The
  // cookie grants nothing on its own: it carries only the credential the visitor
  // already holds, and the POST re-checks the role before spending it.
  context.cookies.set(LINK_ORIGIN_COOKIE, serializePendingToken({ type, tokenHash }), linkCookieOptions(url));

  // `?mode=invite` is cosmetic — the page reads the type out of the cookie — but
  // it keeps the URL shape stable for anyone who bookmarked it.
  const mode = linkOriginOf(type) === "invite" ? "?mode=invite" : "";
  return context.redirect(`/auth/reset-password${mode}`);
};
