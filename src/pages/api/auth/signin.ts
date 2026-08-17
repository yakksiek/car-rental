import type { APIRoute } from "astro";
import { createClient } from "../../../lib/supabase";
import { safeRedirectPath } from "../../../lib/safe-redirect";
import { gotrueErrorCode, type AuthErrorCode } from "../../../lib/auth-messages";
import { shouldSecureCookies } from "../../../lib/secure-cookies";

export const POST: APIRoute = async (context) => {
  const form = await context.request.formData();
  const email = form.get("email") as string;
  const password = form.get("password") as string;

  // Where to land after a successful login. Validated to a safe internal path;
  // defaults to the staff dashboard so staff aren't dropped on the public
  // landing page (A1). Carried back on failure so a retry keeps the target.
  const redirectParam = form.get("redirect");
  const target = safeRedirectPath(typeof redirectParam === "string" ? redirectParam : null);
  // Only a short code travels in the URL (S-14, F6) — the page resolves it to
  // Polish. Codes are ASCII identifiers from a closed set, so no encoding needed.
  const back = (code: AuthErrorCode) =>
    context.redirect(`/auth/signin?error=${code}&redirect=${encodeURIComponent(target)}`);

  // Session cookies are minted here, so this call site carries `secure` too
  // (S-14) — not just middleware's refresh path.
  const supabase = createClient(context.request.headers, context.cookies, {
    secure: shouldSecureCookies(context.url),
  });
  if (!supabase) {
    return back("unconfigured");
  }
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    // Never `error.message` — GoTrue answers in English, and a wrong password
    // and an unknown address both come back as 400 `invalid_credentials`, which
    // is also the non-enumerable answer we want to give.
    return back(gotrueErrorCode(error));
  }

  return context.redirect(target);
};
