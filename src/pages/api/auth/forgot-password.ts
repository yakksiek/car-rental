// core
import type { APIRoute } from "astro";
import { z } from "zod";

// Forgot-password request endpoint (S-08). Triggers a GoTrue recovery email and
// ALWAYS redirects to the neutral check-email state — it never reveals whether
// the address has an account (no existence leak). CSRF-guarded (native form POST).
const emailSchema = z.email();

export const POST: APIRoute = async (context) => {
  // CSRF: same-origin only.
  const origin = context.request.headers.get("origin");
  if (origin !== context.url.origin) {
    return context.redirect("/auth/forgot-password");
  }

  const form = await context.request.formData();
  const emailRaw = form.get("email");
  const parsed = emailSchema.safeParse(typeof emailRaw === "string" ? emailRaw.trim() : "");

  // Even an invalid email lands on the neutral state — the request page's own
  // client validation catches the empty/malformed case first.
  if (parsed.success && context.locals.supabase) {
    // Fire-and-forget from the caller's perspective: any GoTrue error (rate
    // limit, unknown address) is swallowed so timing/response never leaks state.
    await context.locals.supabase.auth
      .resetPasswordForEmail(parsed.data, { redirectTo: `${context.url.origin}/auth/callback` })
      .catch(() => undefined);
  }

  return context.redirect("/auth/forgot-password?sent=1");
};
