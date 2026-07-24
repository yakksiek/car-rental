import { defineMiddleware } from "astro:middleware";
import { createClient } from "./lib/supabase";
import { isRoleSufficient, resolveRequiredRole } from "./lib/access";

export const onRequest = defineMiddleware(async (context, next) => {
  const supabase = createClient(context.request.headers, context.cookies);

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
      const { data: profile } = await supabase
        .from("profiles")
        .select("role, deactivated_at")
        .eq("user_id", user.id)
        .maybeSingle();
      context.locals.role = profile && profile.deactivated_at == null ? profile.role : null;
    } else {
      context.locals.role = null;
    }
  } else {
    // Supabase unconfigured — auth disabled, no user and no role.
    context.locals.user = null;
    context.locals.role = null;
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
