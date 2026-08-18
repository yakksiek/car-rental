// core
import type { APIRoute } from "astro";
import { z } from "zod";

// others
import { requireRole } from "../../../lib/access";
import { gotrueErrorCode, type AuthErrorCode } from "../../../lib/auth-messages";

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
//
// Zod's messages ARE the error codes (S-14, F6): no Polish sentence travels in
// a URL any more, so `issues[0].message` is handed to the redirect as-is and the
// page resolves it via `resolveAuthError`. An empty `current` maps to
// `wrongCurrent` because that is what it is — the reauth below would refuse it
// anyway, and the client form already catches the blank field before submit.
const schema = z
  .object({
    current: z.string().min(1, "wrongCurrent"),
    password: z.string().min(6, "tooShort"),
    confirm: z.string(),
  })
  .refine((v) => v.password === v.confirm, { message: "mismatch", path: ["confirm"] });

const PAGE = "/dashboard/account/password";

// Codes are ASCII identifiers from a closed set, so no encoding is needed.
const fail = (context: Parameters<APIRoute>[0], code: AuthErrorCode) => context.redirect(`${PAGE}?error=${code}`);

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
    return fail(context, "generic");
  }

  // `form.get` yields null for an absent field, which fails zod's *type* check
  // rather than `.min(1)` — that surfaces zod's English default, which would now
  // reach the page as an unrecognised code and render nothing.
  const parsed = schema.safeParse({
    current: form.get("current") ?? "",
    password: form.get("password") ?? "",
    confirm: form.get("confirm") ?? "",
  });
  if (!parsed.success) {
    return fail(context, (parsed.error.issues[0]?.message ?? "generic") as AuthErrorCode);
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
    // Deliberately NOT `gotrueErrorCode`: here a 400 `invalid_credentials` means
    // "the current password is wrong", not "your sign-in failed".
    return fail(context, reauthError.status === 429 ? "rateLimited" : "wrongCurrent");
  }

  // (f) Only now the actual change. Was forwarding `error.message` verbatim —
  // the path by which GoTrue's English `same_password` reached a Polish UI.
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) {
    return fail(context, gotrueErrorCode(error));
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
