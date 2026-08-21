import type { APIRoute } from "astro";
import { createClient } from "../../../lib/supabase";
import { shouldSecureCookies } from "../../../lib/secure-cookies";
import { LINK_ORIGIN_COOKIE } from "../../../lib/auth-session";

export const POST: APIRoute = async (context) => {
  // Sign-out clears the auth cookies by re-setting them with `maxAge: 0`, and a
  // browser matches the clearing cookie on name/path/domain — so the attributes
  // must line up with the ones sign-in wrote (S-14).
  const supabase = createClient(context.request.headers, context.cookies, {
    secure: shouldSecureCookies(context.url),
  });
  if (supabase) {
    await supabase.auth.signOut();
  }
  // Drop any pending link token too (invite-journey-fixes). The cookie now
  // carries a `token_hash` a POST would spend, so a signed-out browser must not
  // keep one. Strictly narrowing: the cookie can only ever deny, never grant —
  // and this is what makes R11's "sign out, then open the link again" land on a
  // clean slate rather than on a stale token from the colleague's session.
  context.cookies.delete(LINK_ORIGIN_COOKIE, { path: "/" });
  return context.redirect("/");
};
