import type { APIRoute } from "astro";
import { createClient } from "../../../lib/supabase";
import { safeRedirectPath } from "../../../lib/safe-redirect";

export const POST: APIRoute = async (context) => {
  const form = await context.request.formData();
  const email = form.get("email") as string;
  const password = form.get("password") as string;

  // Where to land after a successful login. Validated to a safe internal path;
  // defaults to the staff dashboard so staff aren't dropped on the public
  // landing page (A1). Carried back on failure so a retry keeps the target.
  const redirectParam = form.get("redirect");
  const target = safeRedirectPath(typeof redirectParam === "string" ? redirectParam : null);
  const back = (msg: string) =>
    context.redirect(`/auth/signin?error=${encodeURIComponent(msg)}&redirect=${encodeURIComponent(target)}`);

  const supabase = createClient(context.request.headers, context.cookies);
  if (!supabase) {
    return back("Supabase is not configured");
  }
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return back(error.message);
  }

  return context.redirect(target);
};
