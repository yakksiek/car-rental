// core
import type { APIRoute } from "astro";

// PKCE recovery / invite-accept callback (S-08). GoTrue's default confirmation
// link routes through /auth/v1/verify and redirects here with a PKCE `?code=`
// (recovery/invite initiated server-side); a `?token_hash=&type=` variant is
// also handled defensively. Exchanging it establishes the session cookie BEFORE
// we redirect to /auth/reset-password, so that page sees `locals.user`.
//
// The invite link carries `?flow=invite` (set as the invite redirectTo) so the
// reset page can pick its invite-accept mode. An expired/invalid link redirects
// to the forgot-password expired state (R5) — never a 500.
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

  return context.redirect(`/auth/reset-password${mode}`);
};
