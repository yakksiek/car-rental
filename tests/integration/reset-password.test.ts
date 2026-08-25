// core
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

// others
import { POST as resetPasswordPOST } from "../../src/pages/api/auth/reset-password";
import { LINK_ORIGIN_COOKIE, PW_SET_DONE_COOKIE, readPendingToken } from "../../src/lib/auth-session";
import { anonClient, serviceClient } from "../helpers/clients";
import { anonContext, buildApiContext, cookieOptions } from "../helpers/context";
import { pendingTokenContext } from "../helpers/link-session";

// Set-password endpoint (S-14 Phase 1, re-shaped by invite-journey-fixes).
//
// Until S-14 the route set a password for ANY authenticated session — an ordinary
// sign-in cookie was enough (F1, reproduced twice) — and NO test in the repo
// would have failed if the guard had been deleted outright.
//
// WHAT THE GATE IS NOW: the exchange moved here from the callback GET, so
// provenance is "holds an unspent token" rather than "holds a session whose `amr`
// says otp". That is strictly stronger — GoTrue mints the token and GoTrue spends
// it — but it is a DIFFERENT mechanism, so every case below was rewritten against
// it rather than retargeted. The two properties that must survive verbatim are
// the F1 refusal (a password session must not be able to set a password) and the
// retryability of a typo (a validation failure must NOT spend the link).
//
// THE PROPERTY THAT MATTERS is the negative one, and it is asserted against the
// stored password rather than the response status: a suite that only checks "the
// thing changed" cannot tell an enforced gate from an ignored one (lessons: "A
// typed, accepted API parameter is not evidence that it is enforced").
//
// DISPOSABLE USERS: these cases mutate passwords, so they run against users
// created here — never the seeded roles the rest of the suite signs in with.
// `beforeEach` restores the password so each case is order-independent.
//
// DENY ISOLATION: `serviceClient()` is used ONLY to create/reset/delete fixtures
// and to mint the link (as `/api/auth/forgot-password` does in production). Every
// exchange and every assertion runs on the anon key, exactly as a browser would.

const svc = serviceClient();

const EMAIL = "s14-reset-password@fleetrent.test";
const INVITE_EMAIL = "s14-invite-accept@fleetrent.test";
const OTHER_EMAIL = "s14-reset-colleague@fleetrent.test";
const ORIGINAL = "Fl33tRent-S14_Original!";
const NEXT = "Fl33tRent-S14_Zmienione!";
const INVITE_PASSWORD = "Fl33tRent-S14_Zaproszenie!";
const PATH = "/api/auth/reset-password";
const PAGE = "/auth/reset-password";

let userId = "";
let otherUserId = "";

async function dropUser(email: string): Promise<void> {
  const { data } = await svc.auth.admin.listUsers({ page: 1, perPage: 1000 });
  const existing = data.users.find((u) => u.email === email);
  if (existing) {
    await svc.from("profiles").delete().eq("user_id", existing.id);
    await svc.auth.admin.deleteUser(existing.id);
  }
}

/** Sign in with the anon key exactly as a browser would — never service-role. */
async function signIn(email: string, password: string) {
  return anonClient().auth.signInWithPassword({ email, password });
}

/** A recovery-link context for the disposable user: unspent token, no session. */
async function recoveryContext(opts: { formBody: Record<string, string>; token?: boolean }) {
  return pendingTokenContext({
    type: "recovery",
    email: EMAIL,
    method: "POST",
    path: PATH,
    formBody: opts.formBody,
    token: opts.token,
  });
}

/**
 * A context carrying an ordinary password session and NO usable token — the
 * shape F1 was about. The cookie is pre-set to the OLD bare-marker value on
 * purpose: it proves the refusal comes from the token parser rejecting a
 * non-credential, not from an empty jar.
 */
async function passwordSessionContext(formBody: Record<string, string>, origin?: string | null) {
  const client = anonClient();
  const { data, error } = await client.auth.signInWithPassword({ email: EMAIL, password: ORIGINAL });
  if (error) {
    throw new Error(`Failed to sign in the disposable S-14 user: ${error.message}`);
  }
  return buildApiContext({
    method: "POST",
    path: PATH,
    supabase: client,
    user: data.user,
    role: "employee",
    formBody,
    origin,
    cookies: { [LINK_ORIGIN_COOKIE]: "recovery" },
  });
}

beforeAll(async () => {
  await dropUser(EMAIL);
  await dropUser(INVITE_EMAIL);
  await dropUser(OTHER_EMAIL);

  const { data, error } = await svc.auth.admin.createUser({
    email: EMAIL,
    password: ORIGINAL,
    email_confirm: true,
  });
  if (error) {
    throw new Error(`Failed to create the disposable S-14 user: ${error.message}`);
  }
  userId = data.user.id;

  // Polish diacritics in the seeded name on purpose — every fixture on a
  // text-carrying path exercises the encoding boundary (lessons).
  const { error: profileError } = await svc
    .from("profiles")
    .insert({ user_id: userId, role: "employee", full_name: "Łucja Święcicka-Wąs" });
  if (profileError) {
    throw new Error(`Failed to seed the disposable S-14 profile: ${profileError.message}`);
  }

  const colleague = await svc.auth.admin.createUser({
    email: OTHER_EMAIL,
    password: ORIGINAL,
    email_confirm: true,
  });
  if (colleague.error) {
    throw new Error(`Failed to create the colleague fixture: ${colleague.error.message}`);
  }
  otherUserId = colleague.data.user.id;
  await svc.from("profiles").insert({ user_id: otherUserId, role: "employee", full_name: "Kolega Współdzielony" });
});

afterAll(async () => {
  await dropUser(EMAIL);
  await dropUser(INVITE_EMAIL);
  await dropUser(OTHER_EMAIL);
});

beforeEach(async () => {
  const { error } = await svc.auth.admin.updateUserById(userId, { password: ORIGINAL });
  if (error) {
    throw new Error(`Failed to reset the disposable S-14 password: ${error.message}`);
  }
  await svc.from("profiles").update({ deactivated_at: null }).eq("user_id", userId);
});

describe("POST /api/auth/reset-password — provenance is an unspent token", () => {
  it("refuses an ordinary password session and leaves the password unchanged (F1)", async () => {
    const context = await passwordSessionContext({ password: NEXT, confirm: NEXT });

    const response = await resetPasswordPOST(context);

    // Recoverable rather than hostile: the page explains it (R12 — "change it in
    // settings"), which is why this is a redirect and not a bare 403.
    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe(PAGE);

    // The assertion of record: the account is byte-for-byte untouched. This is
    // the scripted reproduction from review-fixes.md, run in the deterministic
    // layer — sign in normally, POST once, and the password must not move.
    expect((await signIn(EMAIL, ORIGINAL)).error).toBeNull();
    expect((await signIn(EMAIL, NEXT)).error).not.toBeNull();
  });

  it("sets the password for an unspent recovery token", async () => {
    const { context } = await recoveryContext({ formBody: { password: NEXT, confirm: NEXT } });

    const response = await resetPasswordPOST(context);

    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe(`${PAGE}?done=1`);
    expect((await signIn(EMAIL, NEXT)).error).toBeNull();

    // The token cookie is spent and swapped for the one-shot success token, so
    // neither a double submit nor a typed `?done=1` can replay either screen.
    expect(context.cookies.get(LINK_ORIGIN_COOKIE)).toBeUndefined();
    expect(context.cookies.get(PW_SET_DONE_COOKIE)?.value).toBe("1");

    // …and it is spent at the path it was written at (auth-followups, F7). The
    // page lives under /auth while its form posts to /api/auth, so an
    // `/auth`-scoped clear would leave a real browser's cookie standing and the
    // one-shot would silently stop being one — invisible to every assertion
    // above, since this double's jar is path-blind.
    expect(cookieOptions(context, LINK_ORIGIN_COOKIE)?.path).toBe("/");
  });

  it("stamps password_set_at, so the roster stops calling them ZAPROSZONY", async () => {
    const { context } = await recoveryContext({ formBody: { password: NEXT, confirm: NEXT } });
    await svc.from("profiles").update({ password_set_at: null }).eq("user_id", userId);

    expect(response(await resetPasswordPOST(context))).toBe(`${PAGE}?done=1`);

    const { data } = await svc.from("profiles").select("password_set_at").eq("user_id", userId).single();
    expect(data?.password_set_at).not.toBeNull();
  });

  it("sets the first password for an invite token (the new-hire path)", async () => {
    // `generateLink({ type: "invite" })` provisions the user, exactly as
    // `inviteUserByEmail` does in services/staff.ts; the profiles row it writes
    // alongside is what gives an invited hire a role before they ever accept —
    // the caveat that decides whether the role check locks new hires out.
    const { context, userId: invitedId } = await pendingTokenContext({
      type: "invite",
      email: INVITE_EMAIL,
      method: "POST",
      path: PATH,
      formBody: { password: INVITE_PASSWORD, confirm: INVITE_PASSWORD },
    });
    const { error: profileError } = await svc
      .from("profiles")
      .insert({ user_id: invitedId, role: "employee", full_name: "Bartosz Łagodny" });
    if (profileError) {
      throw new Error(`Failed to seed the invited S-14 profile: ${profileError.message}`);
    }

    const res = await resetPasswordPOST(context);

    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toBe(`${PAGE}?done=1`);
    expect((await signIn(INVITE_EMAIL, INVITE_PASSWORD)).error).toBeNull();
  });

  it("redirects instead of setting when there is no token cookie", async () => {
    // A double submit or the back button. Recoverable, so it must land on the
    // page, never a bare 403.
    const { context } = await recoveryContext({ formBody: { password: NEXT, confirm: NEXT }, token: false });

    const res = await resetPasswordPOST(context);

    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toBe(PAGE);
    expect((await signIn(EMAIL, ORIGINAL)).error).toBeNull();
  });

  it("refuses a token whose target has lost their staff role, without spending it (R2)", async () => {
    // A deactivated staffer. `profiles.role` stays 'employee', so the refusal can
    // only come from `resolve_link_token`'s deactivation clause — the property
    // that used to be enforced by the session the callback minted.
    const { context, tokenHash } = await recoveryContext({ formBody: { password: NEXT, confirm: NEXT } });
    await svc.from("profiles").update({ deactivated_at: new Date().toISOString() }).eq("user_id", userId);

    const res = await resetPasswordPOST(context);

    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toBe(PAGE); // the page renders R14
    expect((await signIn(EMAIL, ORIGINAL)).error).toBeNull();

    // Unspent: reactivating them must leave the same link usable.
    await svc.from("profiles").update({ deactivated_at: null }).eq("user_id", userId);
    expect(await stillResolves(tokenHash)).toBe(true);
  });

  it("revokes every session for the user after a successful set (R1)", async () => {
    // The self-service "I've been compromised" flow. `updateUser` revokes nothing
    // on its own, so without the explicit sign-out the intruder's cookie outlives
    // the reset and the remedy remedies nothing.
    const other = await signIn(EMAIL, ORIGINAL);
    if (other.error) {
      throw other.error;
    }
    const otherRefreshToken = other.data.session.refresh_token;

    const { context } = await recoveryContext({ formBody: { password: NEXT, confirm: NEXT } });
    expect(response(await resetPasswordPOST(context))).toBe(`${PAGE}?done=1`);

    const refreshed = await anonClient().auth.refreshSession({ refresh_token: otherRefreshToken });
    expect(refreshed.error).not.toBeNull();
  });

  it("spends the token exactly once — a replayed cookie sets nothing", async () => {
    const { context, tokenHash } = await recoveryContext({ formBody: { password: NEXT, confirm: NEXT } });
    expect(response(await resetPasswordPOST(context))).toBe(`${PAGE}?done=1`);

    // Replay the same credential from a browser that kept the cookie.
    const replay = buildApiContext({
      method: "POST",
      path: PATH,
      supabase: anonClient(),
      user: null,
      role: null,
      formBody: { password: `${NEXT}-replay`, confirm: `${NEXT}-replay` },
      cookies: { [LINK_ORIGIN_COOKIE]: `recovery.${tokenHash}` },
    });
    expect(response(await resetPasswordPOST(replay))).toBe(PAGE);
    expect((await signIn(EMAIL, `${NEXT}-replay`)).error).not.toBeNull();
    expect((await signIn(EMAIL, NEXT)).error).toBeNull();
  });
});

describe("POST /api/auth/reset-password — the shared-workstation conflict (R11)", () => {
  it("refuses when a DIFFERENT user is signed in, and leaves the token unspent", async () => {
    const colleague = anonClient();
    const signedIn = await colleague.auth.signInWithPassword({ email: OTHER_EMAIL, password: ORIGINAL });
    if (signedIn.error) throw signedIn.error;

    const { context, tokenHash } = await pendingTokenContext({
      type: "recovery",
      email: EMAIL,
      method: "POST",
      path: PATH,
      formBody: { password: NEXT, confirm: NEXT },
      session: { user: signedIn.data.user, role: "employee", supabase: colleague },
    });

    const res = await resetPasswordPOST(context);

    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toBe("/auth/link-conflict");
    expect((await signIn(EMAIL, ORIGINAL)).error).toBeNull();

    // THE POINT OF THE CARD: it tells them to sign out and open the link again.
    // That promise is only true if nothing here spent the token.
    expect(await stillResolves(tokenHash)).toBe(true);
  });
});

describe("POST /api/auth/reset-password — validation, retryability and CSRF", () => {
  it("keeps the token when the confirmation does not match, so the user can retry", async () => {
    // The single easiest thing to get wrong: spending the link on a zod failure
    // would bounce a staffer to "Link wygasł" over a typo, with no way back. This
    // is why validation is ordered ahead of the exchange.
    const { context, tokenHash } = await recoveryContext({ formBody: { password: NEXT, confirm: `${NEXT}-inne` } });

    const res = await resetPasswordPOST(context);

    expect(res.status).toBe(302);
    // A code, not a sentence (S-14 F6) — the page resolves it to Polish.
    expect(res.headers.get("location")).toBe(`${PAGE}?error=mismatch`);
    expect(readPendingToken(context.cookies.get(LINK_ORIGIN_COOKIE)?.value)).toEqual({
      type: "recovery",
      tokenHash,
    });
    expect((await signIn(EMAIL, ORIGINAL)).error).toBeNull();

    // Unspent for real, not merely un-deleted from the jar: the retry must work.
    const retry = buildApiContext({
      method: "POST",
      path: PATH,
      supabase: anonClient(),
      user: null,
      role: null,
      formBody: { password: NEXT, confirm: NEXT },
      cookies: { [LINK_ORIGIN_COOKIE]: `recovery.${tokenHash}` },
    });
    expect(response(await resetPasswordPOST(retry))).toBe(`${PAGE}?done=1`);
    expect((await signIn(EMAIL, NEXT)).error).toBeNull();
  });

  it("keeps the token when the new password is rejected as too short", async () => {
    const { context, tokenHash } = await recoveryContext({ formBody: { password: "krót", confirm: "krót" } });

    const res = await resetPasswordPOST(context);

    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toBe(`${PAGE}?error=tooShort`);
    expect(readPendingToken(context.cookies.get(LINK_ORIGIN_COOKIE)?.value)).toEqual({
      type: "recovery",
      tokenHash,
    });
  });

  it("rejects a cross-origin POST before any work", async () => {
    const context = await passwordSessionContext({ password: NEXT, confirm: NEXT }, "https://evil.example");

    const res = await resetPasswordPOST(context);

    expect(res.status).toBe(403);
    expect((await signIn(EMAIL, ORIGINAL)).error).toBeNull();
  });

  it("rejects a POST with no Origin header at all", async () => {
    // A same-origin form always sends Origin; its absence is a non-browser or
    // stripped-header caller. Fail CLOSED — `null !== url.origin`.
    const context = await passwordSessionContext({ password: NEXT, confirm: NEXT }, null);

    const res = await resetPasswordPOST(context);

    expect(res.status).toBe(403);
  });

  it("rejects a caller holding neither a session nor a token", async () => {
    const context = anonContext({
      method: "POST",
      path: PATH,
      formBody: { password: NEXT, confirm: NEXT },
      // The pre-redesign cookie payload: a bare marker is not a credential.
      cookies: { [LINK_ORIGIN_COOKIE]: "recovery" },
    });

    const res = await resetPasswordPOST(context);

    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toBe(PAGE);
    expect((await signIn(EMAIL, ORIGINAL)).error).toBeNull();
  });
});

/** Whether a recovery token is still live — i.e. genuinely unspent, not merely
 * left sitting in the cookie jar. `serviceClient()` carries no Database generic,
 * so the row shape is named here rather than inferred. */
async function stillResolves(tokenHash: string): Promise<boolean> {
  const { data } = (await anonClient().rpc("resolve_link_token", {
    p_token_hash: tokenHash,
    p_type: "recovery",
  })) as { data: unknown[] | null };
  return (data ?? []).length === 1;
}

/** The `Location` a redirect answered with — the one thing most cases assert. */
function response(res: Response): string | null {
  expect(res.status).toBe(302);
  return res.headers.get("location");
}
