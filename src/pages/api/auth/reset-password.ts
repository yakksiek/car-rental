// core
import type { APIRoute } from "astro";
import { z } from "zod";

// others
import { requireRole } from "../../../lib/access";
import { gotrueErrorCode, type AuthErrorCode } from "../../../lib/auth-messages";
import {
  LINK_ORIGIN_COOKIE,
  PW_SET_DONE_COOKIE,
  linkCookieOptions,
  readLinkOrigin,
  readSessionOrigin,
  type LinkOrigin,
} from "../../../lib/auth-session";

// Set-password endpoint (S-08, gated in S-14).
//
// This route sets a password with NO current password, because the emailed link
// is supposed to be the proof of identity. Until S-14 nothing checked that a
// link was involved at all — the guard tested only that *some* session existed,
// which is true of an ordinary `signInWithPassword` cookie, so any signed-in
// staffer could POST here and set a new password (F1, reproduced twice).
//
// /api routes sit outside the middleware gate (lessons: "API routes are outside
// middleware's gate"), so this self-gates in order: CSRF → session → role →
// session origin → marker → zod → update → revoke. Hard security rejections
// answer with a status (a legitimate form can never trigger them); recoverable
// user states redirect to the page, which renders the matching designed screen.
//
// The two origin signals are required TOGETHER and guard different dimensions:
// `amr` is unforgeable provenance but never clears, and the marker cookie is
// freshness but is user-writable. In an AND, an unsigned cookie can only deny.
//
// The enforced minimum matches the config.toml policy (6); the design's "10
// chars" checklist is a UI hint only (S-08 deviation 7).
//
// Zod's messages ARE the error codes (S-14, F6): no Polish sentence travels in a
// URL any more, so `issues[0].message` goes onto the redirect as-is and the page
// resolves it via `resolveAuthError`.
const schema = z
  .object({
    password: z.string().min(6, "tooShort"),
    confirm: z.string(),
  })
  .refine((v) => v.password === v.confirm, { message: "mismatch", path: ["confirm"] });

const PAGE = "/auth/reset-password";

// `mode` is cosmetic on the redirect — the page now reads it from the marker
// cookie — but it keeps the URL shape stable for anyone who bookmarked it.
const modeQs = (mode: LinkOrigin) => (mode === "invite" ? "&mode=invite" : "");

// Codes are ASCII identifiers from a closed set, so no encoding is needed.
const fail = (context: Parameters<APIRoute>[0], mode: LinkOrigin, code: AuthErrorCode) =>
  context.redirect(`${PAGE}?error=${code}${modeQs(mode)}`);

export const POST: APIRoute = async (context) => {
  // (a) CSRF: same-origin only, before any work. Fails closed on a missing
  // Origin header — `null !== url.origin`.
  const origin = context.request.headers.get("origin");
  if (origin !== context.url.origin) {
    return new Response("Forbidden", { status: 403 });
  }

  // (b) Session required.
  const { user, supabase } = context.locals;
  if (!user || !supabase) {
    return new Response("Unauthorized", { status: 401 });
  }

  // (c) Role: staff only, never a deactivated (`role = null`) account (R2). An
  // invited hire already has a `profiles` row with `role: "employee"` by the time
  // they accept (services/staff.ts:200-202), so this does not lock out new hires.
  if (!requireRole(context.locals, "employee")) {
    return new Response("Forbidden", { status: 403 });
  }

  // (d) Provenance (F1): the session's JWT must record a link exchange. Safe to
  // read here and only here — middleware already ran the validating `getUser()`
  // that (b) depends on. Unreachable from the real form, because the page
  // refuses to render it to a password session.
  if ((await readSessionOrigin(supabase)) !== "link") {
    return new Response("Forbidden", { status: 403 });
  }

  // (e) Freshness: the one-shot marker /auth/callback stamped on THIS link
  // navigation. Reachable legitimately — a double submit or the back button
  // spends it — so this is a redirect to the R5 screen, not a status.
  const mode = readLinkOrigin(context.cookies.get(LINK_ORIGIN_COOKIE)?.value);
  if (!mode) {
    return context.redirect(PAGE);
  }

  // (f) Validate. An unparseable body is a malformed request, not a user error.
  let form: FormData;
  try {
    form = await context.request.formData();
  } catch {
    return fail(context, mode, "generic");
  }

  // `form.get` yields null for an absent field, which fails zod's *type* check
  // rather than `.min(6)` — that surfaces zod's English default, which would now
  // reach the page as an unrecognised code and render nothing.
  const parsed = schema.safeParse({
    password: form.get("password") ?? "",
    confirm: form.get("confirm") ?? "",
  });
  if (!parsed.success) {
    // THE MARKER SURVIVES. A typo'd confirmation must leave the user able to
    // retry; spending it here would bounce them to "Link wygasł" over a typo.
    return fail(context, mode, (parsed.error.issues[0]?.message ?? "generic") as AuthErrorCode);
  }

  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) {
    // Marker survives here too — a rejected password is retryable. `error.message`
    // is never forwarded: it is English, and this is where `same_password` and
    // `weak_password` would otherwise land in an all-Polish UI.
    return fail(context, mode, gotrueErrorCode(error));
  }

  // Stamp the owned password-set signal. This MUST precede the global sign-out
  // below, which invalidates the caller's session and would leave the RPC
  // unauthenticated (`auth.uid()` null → zero rows updated, silently).
  //
  // A failed stamp does NOT fail the request: the password has already changed,
  // and erroring here would tell the user their reset didn't work when it did.
  // The cost of a miss is a stale ZAPROSZONY badge, not a broken account.
  await supabase.rpc("mark_password_set");

  // (g) Success. Spend the marker, hand the page a one-shot success token (the
  // old `?done=1` check was forgeable by anyone typing the URL), then revoke
  // EVERY session for this user (R1) — including the caller's.
  //
  // `updateUser` revokes nothing on its own, so without this the self-service
  // "I've been compromised" flow leaves the intruder's cookie live: the one
  // remedy a compromised staffer has would not actually remedy anything. Scope
  // is "global", not "others", because OWASP wants the user sent to sign in
  // fresh after a reset — and because the `otp` mark never clears, so leaving
  // this session alive would leave set-password rights alive with it.
  context.cookies.delete(LINK_ORIGIN_COOKIE, { path: "/" });
  context.cookies.set(PW_SET_DONE_COOKIE, "1", linkCookieOptions(context.url));
  await supabase.auth.signOut({ scope: "global" });

  return context.redirect(`${PAGE}?done=1`);
};
