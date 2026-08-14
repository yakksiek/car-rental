// core
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

// others
import { POST as resetPasswordPOST } from "../../src/pages/api/auth/reset-password";
import { LINK_ORIGIN_COOKIE, PW_SET_DONE_COOKIE } from "../../src/lib/auth-session";
import { anonClient, serviceClient } from "../helpers/clients";
import { anonContext, buildApiContext } from "../helpers/context";
import { linkSessionContext } from "../helpers/link-session";

// Set-password endpoint (S-14 Phase 1). Until this slice the route set a password
// for ANY authenticated session — an ordinary sign-in cookie was enough (F1,
// reproduced twice on HEAD) — and NO test in the repo would have failed if the
// guard had been deleted outright. Every property below is therefore net-new.
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
const ORIGINAL = "Fl33tRent-S14_Original!";
const NEXT = "Fl33tRent-S14_Zmienione!";
const INVITE_PASSWORD = "Fl33tRent-S14_Zaproszenie!";
const PATH = "/api/auth/reset-password";
const PAGE = "/auth/reset-password";

let userId = "";

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

/**
 * A context carrying an ordinary password session — the exact shape the gate
 * must refuse. The marker cookie is pre-set on purpose: a rejection here proves
 * the JWT-provenance check did the work, not a missing cookie.
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

/** A context carrying a genuine recovery-link session for the disposable user. */
async function recoveryContext(opts: { formBody: Record<string, string>; marker?: boolean; role?: "employee" | null }) {
  const { context } = await linkSessionContext({
    type: "recovery",
    email: EMAIL,
    method: "POST",
    path: PATH,
    formBody: opts.formBody,
    marker: opts.marker,
    role: opts.role,
  });
  return context;
}

beforeAll(async () => {
  await dropUser(EMAIL);
  await dropUser(INVITE_EMAIL);

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
});

afterAll(async () => {
  await dropUser(EMAIL);
  await dropUser(INVITE_EMAIL);
});

beforeEach(async () => {
  const { error } = await svc.auth.admin.updateUserById(userId, { password: ORIGINAL });
  if (error) {
    throw new Error(`Failed to reset the disposable S-14 password: ${error.message}`);
  }
});

describe("POST /api/auth/reset-password — session origin", () => {
  it("refuses an ordinary password session and leaves the password unchanged (F1)", async () => {
    const context = await passwordSessionContext({ password: NEXT, confirm: NEXT });

    const response = await resetPasswordPOST(context);

    expect(response.status).toBe(403);

    // The assertion of record: the account is byte-for-byte untouched. This is
    // the scripted reproduction from review-fixes.md, run in the deterministic
    // layer — sign in normally, POST once, and the password must not move.
    expect((await signIn(EMAIL, ORIGINAL)).error).toBeNull();
    expect((await signIn(EMAIL, NEXT)).error).not.toBeNull();
  });

  it("sets the password for a recovery-link session holding a fresh marker", async () => {
    const context = await recoveryContext({ formBody: { password: NEXT, confirm: NEXT } });

    const response = await resetPasswordPOST(context);

    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe(`${PAGE}?done=1`);
    expect((await signIn(EMAIL, NEXT)).error).toBeNull();

    // The marker is spent and swapped for the one-shot success token, so neither
    // a double submit nor a typed `?done=1` can replay either screen.
    expect(context.cookies.get(LINK_ORIGIN_COOKIE)).toBeUndefined();
    expect(context.cookies.get(PW_SET_DONE_COOKIE)?.value).toBe("1");
  });

  it("sets the first password for an invite-link session (the new-hire path)", async () => {
    // `generateLink({ type: "invite" })` provisions the user, exactly as
    // `inviteUserByEmail` does in services/staff.ts; the profiles row it writes
    // alongside is what gives an invited hire a role before they ever accept —
    // the caveat that decides whether the new role check locks new hires out.
    const { context, userId: invitedId } = await linkSessionContext({
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

    const response = await resetPasswordPOST(context);

    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe(`${PAGE}?done=1`);
    expect((await signIn(INVITE_EMAIL, INVITE_PASSWORD)).error).toBeNull();
  });

  it("redirects instead of setting when the marker is absent", async () => {
    // A link session whose marker was already spent — a double submit or the back
    // button. Recoverable, so it must land on the page (R5), never a bare 403.
    const context = await recoveryContext({ formBody: { password: NEXT, confirm: NEXT }, marker: false });

    const response = await resetPasswordPOST(context);

    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe(PAGE);
    expect((await signIn(EMAIL, ORIGINAL)).error).toBeNull();
  });

  it("refuses a link session whose staff role is gone (R2)", async () => {
    // A deactivated staffer: `profiles.deactivated_at` set, so middleware resolves
    // `role = null` while the auth session still exists. Every other authenticated
    // route already refuses them; this one used to not even ask.
    const context = await recoveryContext({ formBody: { password: NEXT, confirm: NEXT }, role: null });

    const response = await resetPasswordPOST(context);

    expect(response.status).toBe(403);
    expect((await signIn(EMAIL, ORIGINAL)).error).toBeNull();
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

    const context = await recoveryContext({ formBody: { password: NEXT, confirm: NEXT } });
    const response = await resetPasswordPOST(context);
    expect(response.headers.get("location")).toBe(`${PAGE}?done=1`);

    const refreshed = await anonClient().auth.refreshSession({ refresh_token: otherRefreshToken });
    expect(refreshed.error).not.toBeNull();
  });
});

describe("POST /api/auth/reset-password — validation and CSRF", () => {
  it("keeps the marker when the confirmation does not match, so the user can retry", async () => {
    // The single easiest thing to get wrong: spending the marker on a zod failure
    // would bounce a staffer to "Link wygasł" over a typo, with no way back.
    const context = await recoveryContext({ formBody: { password: NEXT, confirm: `${NEXT}-inne` } });

    const response = await resetPasswordPOST(context);

    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe(`${PAGE}?error=${encodeURIComponent("Hasła nie są takie same")}`);
    expect(context.cookies.get(LINK_ORIGIN_COOKIE)?.value).toBe("recovery");
    expect((await signIn(EMAIL, ORIGINAL)).error).toBeNull();
  });

  it("keeps the marker when the new password is too short", async () => {
    const context = await recoveryContext({ formBody: { password: "krót", confirm: "krót" } });

    const response = await resetPasswordPOST(context);

    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe(
      `${PAGE}?error=${encodeURIComponent("Hasło musi mieć co najmniej 6 znaków")}`,
    );
    expect(context.cookies.get(LINK_ORIGIN_COOKIE)?.value).toBe("recovery");
  });

  it("rejects a cross-origin POST before any work", async () => {
    const context = await passwordSessionContext({ password: NEXT, confirm: NEXT }, "https://evil.example");

    const response = await resetPasswordPOST(context);

    expect(response.status).toBe(403);
    expect((await signIn(EMAIL, ORIGINAL)).error).toBeNull();
  });

  it("rejects a POST with no Origin header at all", async () => {
    // A same-origin form always sends Origin; its absence is a non-browser or
    // stripped-header caller. Fail CLOSED — `null !== url.origin`.
    const context = await passwordSessionContext({ password: NEXT, confirm: NEXT }, null);

    const response = await resetPasswordPOST(context);

    expect(response.status).toBe(403);
  });

  it("rejects an unauthenticated caller", async () => {
    const context = anonContext({
      method: "POST",
      path: PATH,
      formBody: { password: NEXT, confirm: NEXT },
      cookies: { [LINK_ORIGIN_COOKIE]: "recovery" },
    });

    const response = await resetPasswordPOST(context);

    expect(response.status).toBe(401);
    expect((await signIn(EMAIL, ORIGINAL)).error).toBeNull();
  });
});
