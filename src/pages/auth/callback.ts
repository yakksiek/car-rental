// core
import type { APIRoute } from "astro";

// others
import { LINK_ORIGIN_COOKIE, linkCookieOptions } from "../../lib/auth-session";

// Recovery / invite-accept callback (S-08). The custom email templates
// (supabase/templates/{invite,recovery}.html) link here with a self-contained
// `?token_hash=&type=`, which `verifyOtp` exchanges server-side with NO
// code-verifier — the default `{{ .ConfirmationURL }}` flow fails for invites
// (session lands in a URL hash the server never sees) and for cross-browser
// recovery (needs a verifier cookie the recipient lacks). A PKCE `?code=` path is
// still handled as a fallback. Either way the session cookie is established
// BEFORE we redirect to /auth/reset-password, so that page sees `locals.user`.
//
// The invite carries `type=invite`, which is what selects the reset page's
// invite-accept mode (see the marker below). An expired/invalid link redirects
// to the forgot-password expired state (R5) — never a 500.

// The link kinds this app actually mints. `?type` is caller-supplied, so it is
// checked against this closed set before it reaches GoTrue rather than cast to
// it (impl-review F4): a bare `as` narrows nothing at runtime and would forward
// `magiclink` / `email_change` — or whatever a later GoTrue adds — verbatim.
// Anything outside the set falls through to the expired redirect below.
const LINK_TYPES = ["recovery", "invite", "signup"] as const;
type LinkType = (typeof LINK_TYPES)[number];

const isLinkType = (raw: string | null): raw is LinkType =>
  raw !== null && (LINK_TYPES as readonly string[]).includes(raw);

export const GET: APIRoute = async (context) => {
  // (S-14, R3) Never install a session over an existing one. This is a GET-only
  // session *installer*, and Astro exempts safe methods from its origin check,
  // so without this a crafted top-level navigation would silently switch a
  // victim's browser onto the attacker's account — every protocol, signature and
  // photo they filed afterwards landing in it. OWASP treats session renewal on a
  // privilege change as mandatory; refusing the link satisfies that directly.
  //
  // Placed before both exchange branches on purpose: returning here means the
  // token is NOT consumed, so the link still works once the current user signs
  // out. That is what the R11 copy promises them.
  if (context.locals.user) {
    return context.redirect("/auth/link-conflict");
  }

  const supabase = context.locals.supabase;
  if (!supabase) {
    return context.redirect("/auth/forgot-password?expired=1");
  }

  const url = context.url;
  const code = url.searchParams.get("code");
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type");

  // (auth-followups, F3) The marker's VALUE derives from `type` — but only on
  // the arm that validated it. An ORed `?flow === "invite"` used to sit here,
  // attacker-settable and validated by nothing, so appending `&flow=invite` to a
  // genuine recovery link greeted a password reset with "Witaj we Flocie".
  // `type` is different in kind on ONE of the two arms below: `verifyOtp`
  // resolves the token by hash AND type, so a mismatched pair mints no session
  // at all — probed, not assumed (lessons: "A typed, accepted API parameter is
  // not evidence that it is enforced"). Against GoTrue v2.188.1 a recovery token
  // presented as `type=invite` answers 403 `otp_expired`; the probe is committed
  // at `tests/integration/auth-callback.test.ts` so a later GoTrue cannot loosen
  // it silently.
  //
  // `exchangeCodeForSession` makes no such promise — it never reads `?type`. So
  // `invite` is assigned INSIDE the `token_hash` arm, once the exchange has
  // vouched for the value, and stays false on the `?code=` arm no matter what
  // the query string claims. Computing it up here instead let `&type=invite` on
  // a PKCE link resurrect the very defect above (impl-review F1). `recovery` is
  // the conservative default: labelling an invite as a recovery only costs the
  // softer welcome; the other way round is the defect. Our own templates never
  // take the `?code=` arm.
  //
  // The invite template still sends `?flow=invite` — harmless, and editing a
  // template is a prod-rollout concern; nothing reads it any more.
  let invite = false;

  try {
    if (code) {
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (error) {
        return context.redirect("/auth/forgot-password?expired=1");
      }
    } else if (tokenHash && isLinkType(type)) {
      const { error } = await supabase.auth.verifyOtp({
        token_hash: tokenHash,
        type,
      });
      if (error) {
        return context.redirect("/auth/forgot-password?expired=1");
      }

      // Safe here and nowhere else: the call above resolved the token by hash
      // AND type, so it has vouched for this value.
      invite = type === "invite" || type === "signup";
    } else {
      // No usable credential in the link.
      return context.redirect("/auth/forgot-password?expired=1");
    }
  } catch {
    return context.redirect("/auth/forgot-password?expired=1");
  }

  const mode = invite ? "?mode=invite" : "";

  // (S-14) Stamp the one-shot marker — ON SUCCESS ONLY. This is the app's single
  // choke point for minting a link session, and the only place that *knows* the
  // navigation came from a link: `context.locals` is rebuilt from cookies after
  // the redirect, so without this stamp the downstream gate has nothing to read.
  // It also carries the mode, so the set-password page no longer takes it from
  // the attacker-settable `?mode=invite` query string. The failure branches above
  // stamp nothing.
  context.cookies.set(LINK_ORIGIN_COOKIE, invite ? "invite" : "recovery", linkCookieOptions(url));

  return context.redirect(`/auth/reset-password${mode}`);
};
