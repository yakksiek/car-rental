import { defineMiddleware } from "astro:middleware";
import { createClient } from "@/lib/supabase";
import { isRoleSufficient, resolveRequiredRole } from "@/lib/access";

export const onRequest = defineMiddleware(async (context, next) => {
  const supabase = createClient(context.request.headers, context.cookies);

  if (supabase) {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    context.locals.user = user ?? null;

    // Role read piggybacks on the already-authenticated request: one indexed PK
    // lookup. A missing profile resolves to `null` (no access) — never granted.
    if (user) {
      const { data: profile } = await supabase.from("profiles").select("role").eq("user_id", user.id).maybeSingle();
      context.locals.role = profile?.role ?? null;
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
      return context.redirect("/auth/signin");
    }
    if (!isRoleSufficient(context.locals.role, required)) {
      return new Response("Forbidden", { status: 403 });
    }
  }

  return next();
});
