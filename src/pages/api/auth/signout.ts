import type { APIRoute } from "astro";
import { createClient } from "../../../lib/supabase";
import { shouldSecureCookies } from "../../../lib/secure-cookies";

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
  return context.redirect("/");
};
