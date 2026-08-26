// core
import type { APIRoute } from "astro";
import { z } from "zod";

// others
import { isRoleSufficient } from "../../../lib/access";
import { gotrueErrorCode, type AuthErrorCode } from "../../../lib/auth-messages";
import {
  LINK_ORIGIN_COOKIE,
  PW_SET_DONE_COOKIE,
  linkCookieOptions,
  linkOriginOf,
  readPendingToken,
  resolveLinkTarget,
  type LinkOrigin,
} from "../../../lib/auth-session";

// Set-password endpoint (S-08, gated in S-14, re-shaped by invite-journey-fixes).
//
// This route sets a password with NO current password, because the emailed link
// is supposed to be the proof of identity. Until S-14 nothing checked that a link
// was involved at all — the guard tested only that *some* session existed, which
// is true of an ordinary `signInWithPassword` cookie, so any signed-in staffer
// could POST here and set a new password (F1, reproduced twice).
//
// THE EXCHANGE NOW HAPPENS HERE. `/auth/callback` used to spend the token on its
// GET, i.e. when the form RENDERED. Doing it on submit makes the link idempotent
// (Bug 2) and means no session is ever minted for someone with no password.
//
// The gate order changes shape with it: there is no incoming session to classify,
// so provenance comes from HOLDING AN UNSPENT TOKEN rather than from a session's
// `amr`. S-14's two origin signals (the JWT `amr` classifier + the freshness
// marker) collapse into that one question, and both of the things they guarded are
// re-enforced: the token is unforgeable (GoTrue minted it) and single-use (GoTrue
// spends it), which is strictly stronger than an `otp` claim that never cleared.
//
// /api routes sit outside the middleware gate (lessons: "API routes are outside
// middleware's gate"), so this self-gates in order:
//   (a) CSRF → (b) pending token → (c) identity + role from the token lookup →
//   (d) conflict → (e) zod → (f) exchange → (g) update → (h) stamp → (i) revoke.
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

// `mode` is cosmetic on the redirect — the page reads it from the token cookie —
// but it keeps the URL shape stable for anyone who bookmarked it.
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

  const supabase = context.locals.supabase;
  if (!supabase) {
    return new Response("Unauthorized", { status: 401 });
  }

  // (b) Provenance + freshness in one: an unspent token cookie stamped by THIS
  // link navigation. `readPendingToken` fails closed on anything malformed, so a
  // hand-written cookie can only ever deny. Reachable legitimately (a double
  // submit or the back button), so it redirects to the page rather than 403-ing.
  const pending = readPendingToken(context.cookies.get(LINK_ORIGIN_COOKIE)?.value);
  if (!pending) {
    return context.redirect(PAGE);
  }
  const mode = linkOriginOf(pending.type);

  // (c) Identity + role, resolved WITHOUT spending the token. No row means the
  // link is dead (bad hash, wrong type, past the otp window) — the page's own
  // lookup will reach the same answer and render R5. A null role is a deactivated
  // staffer or a profile-less orphan; the page renders R14. Neither spends anything.
  const target = await resolveLinkTarget(supabase, pending);
  if (!target || !isRoleSufficient(target.role, "employee")) {
    return context.redirect(PAGE);
  }

  // (d) Conflict (R11). `verifyOtp` below mints a session, which on a shared
  // workstation would replace a signed-in colleague's. Refuse and explain rather
  // than switching accounts silently — and the token is still unspent here, so
  // the card's promise ("sign out, then open the link again") is now literally
  // true. Same user is fine: it is their own account either way.
  if (context.locals.user && context.locals.user.id !== target.userId) {
    return context.redirect("/auth/link-conflict");
  }

  // (e) Validate. An unparseable body is a malformed request, not a user error.
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
    // THE TOKEN SURVIVES — this is why validation is ordered ahead of the
    // exchange. A typo'd confirmation must leave the user able to retry;
    // spending the link over a typo would bounce them to "Link wygasł".
    return fail(context, mode, (parsed.error.issues[0]?.message ?? "generic") as AuthErrorCode);
  }

  // (f) THE EXCHANGE. From here the token is spent, which is why every refusal
  // that could be decided without it is already behind us.
  const { error: exchangeError } = await supabase.auth.verifyOtp({
    token_hash: pending.tokenHash,
    type: pending.type,
  });
  if (exchangeError) {
    // The cookie deliberately survives: the page repeats the lookup, finds no
    // row, and says "Link wygasł" — which is the true statement.
    return fail(context, mode, gotrueErrorCode(exchangeError));
  }

  // (g) The password itself.
  //
  // A rejection here is the one refusal that CANNOT leave the token unspent, so
  // the schema above is deliberately the whole policy: `config.toml` sets
  // `minimum_password_length = 6` with an empty `password_requirements`, so zod's
  // `.min(6)` covers everything GoTrue would reject, and `same_password` is
  // unreachable because the exchange stamps a random one. IF THAT CONFIG IS EVER
  // WIDENED, mirror it in the schema — otherwise this branch becomes reachable
  // and a weak password costs the user their link.
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) {
    return fail(context, mode, gotrueErrorCode(error));
  }

  // (h) Stamp the owned password-set signal. MUST precede the global sign-out
  // below, which invalidates the session the RPC authenticates with. A failed
  // stamp does not fail the request — the password has already changed, and the
  // cost of a miss is a stale ZAPROSZONY badge, not a broken account.
  await supabase.rpc("mark_password_set");

  // (i) Success. Spend the token cookie, hand the page a one-shot success token
  // (the old `?done=1` check was forgeable by anyone typing the URL), then revoke
  // EVERY session for this user (R1) — including the one just minted.
  //
  // `updateUser` revokes nothing on its own, so without this the self-service
  // "I've been compromised" flow leaves the intruder's cookie live: the one
  // remedy a compromised staffer has would not actually remedy anything. Scope is
  // "global", not "others", because OWASP wants the user sent to sign in fresh
  // after a reset.
  context.cookies.delete(LINK_ORIGIN_COOKIE, { path: "/" });
  context.cookies.set(PW_SET_DONE_COOKIE, "1", linkCookieOptions(context.url));
  await supabase.auth.signOut({ scope: "global" });

  return context.redirect(`${PAGE}?done=1`);
};
