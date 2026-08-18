// core
import type { APIRoute } from "astro";

// others
import { createClient } from "../../../lib/supabase";
import { safeRedirectPath } from "../../../lib/safe-redirect";
import { gotrueErrorCode, type AuthErrorCode } from "../../../lib/auth-messages";
import { shouldSecureCookies } from "../../../lib/secure-cookies";

export const POST: APIRoute = async (context) => {
  // An unparseable body is a malformed request, not a user error — this was the
  // one auth handler that answered it with a 500 (auth-followups, F5).
  // `back(...)` is not reachable from the catch: it is defined below and closes
  // over `target`, which is itself read out of the form. So this redirects
  // directly, on the default target. `generic` is already in the signin table
  // (auth-messages.ts), so no new copy.
  let form: FormData;
  try {
    form = await context.request.formData();
  } catch {
    const fallback = encodeURIComponent(safeRedirectPath(null));
    return context.redirect(`/auth/signin?error=generic&redirect=${fallback}`);
  }

  // `form.get` answers `null` for an absent field and a `File` for a file part,
  // so the `as string` casts these replace were false on both counts. An empty
  // string reaches GoTrue instead and comes back as the same non-enumerable
  // `invalid_credentials` — the narrowing idiom used for `redirect` just below.
  const emailRaw = form.get("email");
  const passwordRaw = form.get("password");
  const email = typeof emailRaw === "string" ? emailRaw : "";
  const password = typeof passwordRaw === "string" ? passwordRaw : "";

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
