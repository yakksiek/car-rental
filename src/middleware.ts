import { defineMiddleware } from "astro:middleware";
import { createClient } from "./lib/supabase";
import { isRoleSufficient, resolveRequiredRole } from "./lib/access";
import { shouldSecureCookies } from "./lib/secure-cookies";

export const onRequest = defineMiddleware(async (context, next) => {
  // `secure` is decided per request by the one shared rule (S-14) — see
  // `shouldSecureCookies`. Middleware is where a token refresh rewrites the auth
  // cookies, so it is the call site that matters most.
  const supabase = createClient(context.request.headers, context.cookies, {
    secure: shouldSecureCookies(context.url),
  });

  // Expose the per-request client (may be `null` when unconfigured) so pages and
  // services reuse it instead of re-creating one. Consumed by the catalog
  // services (S-01) and the S-02 reservation funnel.
  context.locals.supabase = supabase;

  if (supabase) {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    context.locals.user = user ?? null;

    // Role read piggybacks on the already-authenticated request: one indexed PK
    // lookup. A missing profile resolves to `null` (no access) — never granted.
    // A deactivated profile (S-08: deactivated_at set) also resolves to `null`,
    // so a soft-removed staffer is denied every gated route on their next
    // request even while their auth.users row persists.
    if (user) {
      const { data: profile, error } = await supabase
        .from("profiles")
        .select("role, deactivated_at, is_demo")
        .eq("user_id", user.id)
        .maybeSingle();
      // A failed lookup is indistinguishable from a missing profile downstream —
      // both leave `profile` null, which resolves `role` to null and 403s EVERY
      // gated route for EVERY staffer, silently. That is the right security
      // direction and the wrong availability one, so the cause has to be
      // recoverable from a log rather than guessed at. The sharpest case is a
      // Worker deploy that outran its migration (`is_demo` not yet on the table):
      // merging to main deploys the Worker but pushes no migrations, so this
      // select 400s app-wide with nothing else to say why. See the plan's
      // Migration Notes.
      if (error) {
        // eslint-disable-next-line no-console
        console.error("[middleware] profile lookup failed — role denied for this request:", error);
      }
      context.locals.role = profile && profile.deactivated_at == null ? profile.role : null;
      // The demo marker rides the same row, so it costs no extra round trip. It
      // follows the RAW column rather than the resolved role: deactivation and
      // demo-ness are independent decisions, and collapsing them would make a
      // deactivated demo account read as a non-demo one. Missing profile → false.
      context.locals.isDemo = profile?.is_demo ?? false;
    } else {
      context.locals.role = null;
      context.locals.isDemo = false;
    }
  } else {
    // Supabase unconfigured — auth disabled, no user, no role, no demo account.
    context.locals.user = null;
    context.locals.role = null;
    context.locals.isDemo = false;
  }

  // Centralized, fail-closed gate. There is no path where an unresolved or
  // insufficient role falls through to access.
  const required = resolveRequiredRole(context.url.pathname);
  if (required) {
    if (!context.locals.user) {
      // Remember where the user was headed so sign-in can return them there
      // (A1). `safeRedirectPath` re-validates this on the way back out, so a
      // tampered value can only ever resolve to an internal path.
      const dest = context.url.pathname + context.url.search;
      return context.redirect(`/auth/signin?redirect=${encodeURIComponent(dest)}`);
    }
    if (!isRoleSufficient(context.locals.role, required)) {
      return new Response("Forbidden", { status: 403 });
    }
  }

  return next();
});
