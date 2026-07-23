// core
import type { APIRoute } from "astro";
import { z } from "zod";

// Set-password endpoint (S-08). With the recovery/invite session already
// established by /auth/callback, updates the password on that session. CSRF +
// session-required + confirm-match. The enforced minimum matches the
// config.toml policy (6); the design's "10 chars" checklist is a UI hint only.
const schema = z
  .object({
    password: z.string().min(6, "Hasło musi mieć co najmniej 6 znaków"),
    confirm: z.string(),
    mode: z.enum(["recovery", "invite"]).catch("recovery"),
  })
  .refine((v) => v.password === v.confirm, { message: "Hasła nie są takie same", path: ["confirm"] });

export const POST: APIRoute = async (context) => {
  const modeQs = (m: string) => (m === "invite" ? "&mode=invite" : "");

  // CSRF: same-origin only.
  const origin = context.request.headers.get("origin");
  if (origin !== context.url.origin) {
    return context.redirect("/auth/reset-password");
  }

  const form = await context.request.formData();
  const mode = form.get("mode") === "invite" ? "invite" : "recovery";

  // The recovery session must exist (set by the callback exchange). If it is
  // gone, the link expired → the R5 screen.
  if (!context.locals.user || !context.locals.supabase) {
    return context.redirect("/auth/reset-password");
  }

  const parsed = schema.safeParse({
    password: form.get("password"),
    confirm: form.get("confirm"),
    mode,
  });
  if (!parsed.success) {
    const msg = parsed.error.issues[0]?.message ?? "Nieprawidłowe hasło.";
    return context.redirect(`/auth/reset-password?error=${encodeURIComponent(msg)}${modeQs(mode)}`);
  }

  const { error } = await context.locals.supabase.auth.updateUser({ password: parsed.data.password });
  if (error) {
    return context.redirect(`/auth/reset-password?error=${encodeURIComponent(error.message)}${modeQs(mode)}`);
  }

  return context.redirect("/auth/reset-password?done=1");
};
