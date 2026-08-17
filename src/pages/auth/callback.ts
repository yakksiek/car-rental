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

  // (auth-followups, F3) The marker's VALUE now derives from `type` alone. An
  // ORed `?flow === "invite"` used to sit here, attacker-settable and validated
  // by nothing, so appending `&flow=invite` to a genuine recovery link greeted a
  // password reset with "Witaj we Flocie". `type` is different in kind:
  // `verifyOtp` resolves the token by hash AND type, so a mismatched pair mints
  // no session at all — probed, not assumed (lessons: "A typed, accepted API
  // parameter is not evidence that it is enforced"). Against GoTrue v2.188.1 a
  // recovery token presented as `type=invite` answers 403 `otp_expired`; the
  // probe is committed at `tests/integration/auth-callback.test.ts` so a later
  // GoTrue cannot loosen it silently. By the time the marker is stamped below,
  // the exchange has therefore already vouched for this value.
  //
  // The invite template still sends `?flow=invite` — harmless, and editing a
  // template is a prod-rollout concern; nothing reads it any more.
  //
  // The PKCE `?code=` branch carries no type at all (`exchangeCodeForSession`
  // reports no link kind), so `invite` stays false there and the marker is
  // stamped `recovery`. That is the conservative default: labelling an invite as
  // a recovery only costs the softer welcome, the other way round is the defect
  // above. Our own templates never take that branch.
  const invite = type === "invite" || type === "signup";
  const mode = invite ? "?mode=invite" : "";

  try {
    if (code) {
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (error) {
        return context.redirect("/auth/forgot-password?expired=1");
      }
    } else if (tokenHash && type) {
      const { error } = await supabase.auth.verifyOtp({
        token_hash: tokenHash,
        type: type as "recovery" | "invite" | "signup" | "email",
      });
      if (error) {
        return context.redirect("/auth/forgot-password?expired=1");
      }
    } else {
      // No usable credential in the link.
      return context.redirect("/auth/forgot-password?expired=1");
    }
  } catch {
    return context.redirect("/auth/forgot-password?expired=1");
  }

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
