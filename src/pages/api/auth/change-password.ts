// core
import type { APIRoute } from "astro";
import { z } from "zod";

// others
import { requireRole } from "../../../lib/access";

// In-session change-password endpoint (S-11). Unlike /api/auth/reset-password —
// where the recovery link itself is the proof of identity — nothing here proves
// the caller is not someone who walked up to an unlocked session, so the current
// password is verified first and the update happens ONLY on that success.
//
// /api routes sit outside the middleware gate (lessons: "API routes are outside
// middleware's gate"), so this self-gates in order: CSRF → session → role → zod
// → reauth → update. The role check rejects a deactivated staffer, whose profile
// resolves to `role = null` while their auth session still exists.
//
// Responses are redirect-shaped (like the sibling reset-password route) because
// the caller is a native <form> POST, not a fetch client; only the hard security
// rejections — which a legitimate form can never trigger — answer with a status.
const schema = z
  .object({
    current: z.string().min(1, "Podaj obecne hasło"),
    password: z.string().min(6, "Hasło musi mieć co najmniej 6 znaków"),
    confirm: z.string(),
  })
  .refine((v) => v.password === v.confirm, { message: "Hasła nie są takie same", path: ["confirm"] });

const PAGE = "/dashboard/account/password";
const MSG = {
  wrongCurrent: "Nieprawidłowe obecne hasło",
  badPassword: "Nieprawidłowe hasło.",
  rateLimited: "Zbyt wiele prób. Spróbuj ponownie za kilka minut.",
} as const;

const fail = (context: Parameters<APIRoute>[0], message: string) =>
  context.redirect(`${PAGE}?error=${encodeURIComponent(message)}`);

export const POST: APIRoute = async (context) => {
  // (a) CSRF: same-origin only, before any work.
  const origin = context.request.headers.get("origin");
  if (origin !== context.url.origin) {
    return new Response("Forbidden", { status: 403 });
  }

  // (b) Session required. `email` is read server-side for the reauth below — the
  // form never sends it, so a caller cannot reauth as somebody else.
  const { user, supabase } = context.locals;
  if (!user?.email || !supabase) {
    return new Response("Unauthorized", { status: 401 });
  }

  // (c) Role: staff only, and never a deactivated (`role = null`) account.
  if (!requireRole(context.locals, "employee")) {
    return new Response("Forbidden", { status: 403 });
  }

  // (d) Validate. An unparseable body is a malformed request rather than a user
  // error, so answer before the schema ever runs — same shape as vehicles.ts.
  let form: FormData;
  try {
    form = await context.request.formData();
  } catch {
    return fail(context, MSG.badPassword);
  }

  // `form.get` yields null for an absent field, which fails zod's *type* check
  // rather than `.min(1)` — that surfaces zod's English default in a Polish UI.
  const parsed = schema.safeParse({
    current: form.get("current") ?? "",
    password: form.get("password") ?? "",
    confirm: form.get("confirm") ?? "",
  });
  if (!parsed.success) {
    return fail(context, parsed.error.issues[0]?.message ?? MSG.badPassword);
  }

  // (e) Reauth BEFORE updating: a wrong current password must leave the account
  // untouched. On success this re-issues a session for the *same* user, so the
  // caller stays signed in.
  const { error: reauthError } = await supabase.auth.signInWithPassword({
    email: user.email,
    password: parsed.data.current,
  });
  if (reauthError) {
    // GoTrue's sign-in limit is keyed on the caller's IP, which behind Cloudflare
    // Workers is the Worker's egress IP — one bucket shared by every user. Saying
    // "wrong password" to a throttled staffer sends them chasing the wrong problem.
    return fail(context, reauthError.status === 429 ? MSG.rateLimited : MSG.wrongCurrent);
  }

  // (f) Only now the actual change.
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) {
    return fail(context, error.message);
  }

  // (g) Revoke every OTHER session for this user. `updateUser` revokes nothing on
  // its own, so without this a stolen cookie outlives the password change — the one
  // remedy a compromised staffer has would not actually remedy anything. It also
  // clears the session the caller arrived with, which (e) orphaned by minting a
  // fresh one. Verified against local GoTrue: "others" kills the orphan and every
  // other device while leaving this caller signed in. A failure here is not worth
  // failing the request over — the password has already changed.
  await supabase.auth.signOut({ scope: "others" });

  return context.redirect(`${PAGE}?done=1`);
};
