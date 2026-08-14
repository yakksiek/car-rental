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
// The invite carries `?flow=invite` (and `type=invite`) so the reset page picks
// its invite-accept mode. An expired/invalid link redirects to the
// forgot-password expired state (R5) — never a 500.
export const GET: APIRoute = async (context) => {
  const supabase = context.locals.supabase;
  if (!supabase) {
    return context.redirect("/auth/forgot-password?expired=1");
  }

  const url = context.url;
  const code = url.searchParams.get("code");
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type");
  const invite = url.searchParams.get("flow") === "invite" || type === "invite" || type === "signup";
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
