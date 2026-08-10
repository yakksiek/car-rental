// core
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

// others
import { POST as changePasswordPOST } from "../../src/pages/api/auth/change-password";
import { anonClient, serviceClient } from "../helpers/clients";
import { anonContext, asContext, buildApiContext } from "../helpers/context";

// In-session change-password endpoint (S-11 Phase 3). The one piece of net-new
// server logic in the slice, and the only place in the app where a password is
// changed WITHOUT a recovery link to prove identity — so the load-bearing
// property is the ordering: reauthenticate first, update only on success. A
// wrong current password must leave the account byte-for-byte unchanged.
//
// DISPOSABLE USER: these cases mutate a password, so they run against a
// dedicated user created here — never the seeded `employee@fleetrent.test`,
// whose credentials the rest of the suite signs in with. `beforeEach` resets the
// password so each case is independent of order and of a previous failed run.
//
// DENY ISOLATION: every deny assertion drives a real anon / role-null caller
// (`anonContext` / `asContext("norole")`); `serviceClient()` is used ONLY to
// create, reset and delete the disposable user.

const svc = serviceClient();

const EMAIL = "s11-change-password@fleetrent.test";
const ORIGINAL = "Fl33tRent-S11_Original!";
const NEXT = "Fl33tRent-S11_Zmienione!";
const PATH = "/api/auth/change-password";
const PAGE = "/dashboard/account/password";

let userId = "";

async function dropTestUser(): Promise<void> {
  const { data } = await svc.auth.admin.listUsers({ page: 1, perPage: 1000 });
  const existing = data.users.find((u) => u.email === EMAIL);
  if (existing) {
    await svc.from("profiles").delete().eq("user_id", existing.id);
    await svc.auth.admin.deleteUser(existing.id);
  }
}

/** Sign in with the anon key exactly as a browser would — never service-role. */
async function signIn(password: string) {
  return anonClient().auth.signInWithPassword({ email: EMAIL, password });
}

/**
 * An authed employee context for the disposable user, posting a native form.
 * `origin` defaults to same-origin; pass a foreign origin for a cross-site POST,
 * or `null` to send no Origin header at all.
 */
async function employeeContext(formBody: Record<string, string>, origin?: string | null) {
  const client = anonClient();
  const { data, error } = await client.auth.signInWithPassword({ email: EMAIL, password: ORIGINAL });
  if (error) {
    throw new Error(`Failed to sign in the disposable S-11 user: ${error.message}`);
  }
  return buildApiContext({
    method: "POST",
    path: PATH,
    supabase: client,
    user: data.user,
    role: "employee",
    formBody,
    origin,
  });
}

beforeAll(async () => {
  await dropTestUser();
  const { data, error } = await svc.auth.admin.createUser({
    email: EMAIL,
    password: ORIGINAL,
    email_confirm: true,
  });
  if (error) {
    throw new Error(`Failed to create the disposable S-11 user: ${error.message}`);
  }
  userId = data.user.id;

  // Polish diacritics in the seeded name on purpose — every fixture on a
  // text-carrying path exercises the encoding boundary (lessons).
  const { error: profileError } = await svc
    .from("profiles")
    .insert({ user_id: userId, role: "employee", full_name: "Zofia Wąsik-Łęcka" });
  if (profileError) {
    throw new Error(`Failed to seed the disposable S-11 profile: ${profileError.message}`);
  }
});

afterAll(async () => {
  await dropTestUser();
});

beforeEach(async () => {
  const { error } = await svc.auth.admin.updateUserById(userId, { password: ORIGINAL });
  if (error) {
    throw new Error(`Failed to reset the disposable S-11 password: ${error.message}`);
  }
});

describe("POST /api/auth/change-password", () => {
  it("rejects a wrong current password and leaves the password unchanged", async () => {
    const context = await employeeContext({ current: "cudze-hasło-999", password: NEXT, confirm: NEXT });

    const response = await changePasswordPOST(context);

    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe(`${PAGE}?error=${encodeURIComponent("Nieprawidłowe obecne hasło")}`);

    // Unchanged: the old password still signs in and the proposed one does not.
    expect((await signIn(ORIGINAL)).error).toBeNull();
    expect((await signIn(NEXT)).error).not.toBeNull();
  });

  it("updates the password when the current one is correct", async () => {
    const context = await employeeContext({ current: ORIGINAL, password: NEXT, confirm: NEXT });

    const response = await changePasswordPOST(context);

    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe(`${PAGE}?done=1`);

    expect((await signIn(NEXT)).error).toBeNull();
    expect((await signIn(ORIGINAL)).error).not.toBeNull();
  });

  it("revokes other sessions but keeps the caller signed in", async () => {
    // A session on another device, established before the change. `updateUser`
    // revokes nothing on its own, so this is the property that has to be asserted
    // explicitly — a stolen cookie must not outlive the password change.
    const other = await signIn(ORIGINAL);
    if (other.error) {
      throw other.error;
    }
    const otherRefreshToken = other.data.session.refresh_token;

    const context = await employeeContext({ current: ORIGINAL, password: NEXT, confirm: NEXT });
    const response = await changePasswordPOST(context);
    expect(response.headers.get("location")).toBe(`${PAGE}?done=1`);

    const refreshed = await anonClient().auth.refreshSession({ refresh_token: otherRefreshToken });
    expect(refreshed.error).not.toBeNull();

    // …and the caller is still authenticated on the session (e) minted for them.
    const callerClient = context.locals.supabase;
    if (!callerClient) {
      throw new Error("expected a Supabase client on locals");
    }
    expect((await callerClient.auth.getUser()).error).toBeNull();
  });

  it("rejects a mismatched confirmation before touching the password", async () => {
    const context = await employeeContext({ current: ORIGINAL, password: NEXT, confirm: `${NEXT}-inne` });

    const response = await changePasswordPOST(context);

    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe(`${PAGE}?error=${encodeURIComponent("Hasła nie są takie same")}`);
    expect((await signIn(ORIGINAL)).error).toBeNull();
  });

  it("rejects a too-short new password before touching the password", async () => {
    const context = await employeeContext({ current: ORIGINAL, password: "krót", confirm: "krót" });

    const response = await changePasswordPOST(context);

    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe(
      `${PAGE}?error=${encodeURIComponent("Hasło musi mieć co najmniej 6 znaków")}`,
    );
    expect((await signIn(ORIGINAL)).error).toBeNull();
  });

  it("rejects a cross-origin POST before any work", async () => {
    const context = await employeeContext({ current: ORIGINAL, password: NEXT, confirm: NEXT }, "https://evil.example");

    const response = await changePasswordPOST(context);

    expect(response.status).toBe(403);
    expect((await signIn(ORIGINAL)).error).toBeNull();
  });

  it("rejects a POST with no Origin header at all", async () => {
    // A same-origin form always sends Origin; its absence is a non-browser or
    // stripped-header caller. The check must fail CLOSED — `null !== url.origin` —
    // rather than treat "no Origin" as "no cross-origin problem".
    const context = await employeeContext({ current: ORIGINAL, password: NEXT, confirm: NEXT }, null);

    const response = await changePasswordPOST(context);

    expect(response.status).toBe(403);
    expect((await signIn(ORIGINAL)).error).toBeNull();
  });

  it("rejects an unauthenticated caller", async () => {
    const context = anonContext({
      method: "POST",
      path: PATH,
      formBody: { current: ORIGINAL, password: NEXT, confirm: NEXT },
    });

    const response = await changePasswordPOST(context);

    expect(response.status).toBe(401);
    expect((await signIn(ORIGINAL)).error).toBeNull();
  });

  it("rejects an authenticated caller with no staff role", async () => {
    const context = await asContext("norole", {
      method: "POST",
      path: PATH,
      formBody: { current: ORIGINAL, password: NEXT, confirm: NEXT },
    });

    const response = await changePasswordPOST(context);

    expect(response.status).toBe(403);
    expect((await signIn(ORIGINAL)).error).toBeNull();
  });
});
