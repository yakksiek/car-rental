// core
import { afterAll, beforeAll, describe, expect, it } from "vitest";

// others
import { POST as staffCreatePOST } from "../../src/pages/api/staff";
import { POST as staffDeactivatePOST } from "../../src/pages/api/staff/[id]/deactivate";
import { POST as staffInvitePOST } from "../../src/pages/api/staff/[id]/invite";
import { POST as staffResetPasswordPOST } from "../../src/pages/api/staff/[id]/reset-password";
import { anonClient, as, serviceClient } from "../helpers/clients";
import { asContext } from "../helpers/context";
import { settledMailCount, waitForMailCount } from "../helpers/mailpit";
import { DEMO_BLOCKED_CODE, demoBlockedMessage } from "../../src/lib/staff-report";
import { createEmployee, deactivateStaff, inviteEmployee, listStaff } from "../../src/lib/services/staff";

// The four `/api/staff*` routes still carry their own Polish `MSG.demoBlocked`
// literal — the API layer gains its locale parameter in Phase 5 §4 — so the
// expected body is pinned to the Polish half here rather than to the request
// locale. When those routes localize, this becomes a per-locale assertion.
// An integration request carries no locale cookie, so the middleware resolves
// `DEFAULT_LOCALE` (`en`) — that is what these routes answer with, and asserting
// the English arm is asserting what a fresh caller actually gets. The Polish
// twin is held by the catalog's own key-parity test, not by re-running every
// route here in a second language.
const DEMO_BLOCKED_MESSAGE = demoBlockedMessage("en");

// Staff account-lifecycle suite (S-08). Locks the invariants that are expensive
// to get wrong: the create → duplicate → deactivate → reactivate lifecycle, the
// self / last-admin / ok guards in `deactivate_staff` (+ roster hiding), and the
// non-admin RLS boundary on both RPCs.
//
// `serviceClient()` plays the SERVICE-ROLE admin client the routes construct via
// createAdminClient(); every guard assertion that must see an admin JWT runs
// through `as("admin")` (the seed admin, Tomasz). Disposable users only —
// created ids are torn down in afterAll; the seed admin is always restored.

const svc = serviceClient();
const SEED_ADMIN = "a0000000-0000-0000-0000-0000000000ad";
// The published portfolio account (supabase/seed.sql) — a real admin whose only
// distinguishing property is `profiles.is_demo`.
const DEMO_ADMIN = "d0000000-0000-0000-0000-0000000000de";
const ORIGIN = "http://localhost:4321";
const PASSWORD = "Fl33tRent-Admin_2026!";

// Auth user ids created by this suite, cleaned up in afterAll.
const createdIds: string[] = [];

function uniqueEmail(tag: string): string {
  return `staff-${tag}-${Date.now()}-${Math.floor(Math.random() * 1_000_000)}@fleetrent.test`;
}

/** The auth user id GoTrue holds for `email`, or null. Proves a rollback landed. */
async function findAuthUserId(email: string): Promise<string | null> {
  const { data } = await svc.auth.admin.listUsers({ page: 1, perPage: 1000 });
  const match = data.users.find((u) => (u.email ?? "").toLowerCase() === email.toLowerCase());
  return match?.id ?? null;
}

// `serviceClient()` is constructed without the Database generic, so its rows
// arrive as `any`. Narrow through an `unknown` parameter, the same shape
// `bannedUntil` below already uses.
function stampFrom(row: unknown): string | null {
  return (row as { password_set_at?: string | null } | null)?.password_set_at ?? null;
}

/** `user_id` column of a service-role select, narrowed the same way. */
function userIdsFrom(rows: unknown): string[] {
  return ((rows as { user_id: string }[] | null) ?? []).map((row) => row.user_id);
}

/** `profiles.password_set_at` for a user — the owned "has a password" signal. */
async function stampOf(userId: string): Promise<string | null> {
  const { data } = await svc.from("profiles").select("password_set_at").eq("user_id", userId).maybeSingle();
  return stampFrom(data);
}

const INSERT_FAILURE = {
  data: null,
  error: { message: "simulated profiles insert failure", code: "XXTST", details: "", hint: "" },
  count: null,
  status: 500,
  statusText: "Internal Server Error",
};

/**
 * Partial double over the service-role client that fails ONLY
 * `.from("profiles").insert(...)`. `auth.admin` is passed through untouched, so
 * the GoTrue create and the compensating delete are real round-trips and the
 * rollback assertion below is a real assertion. Precedent for doubles at this
 * altitude: `tests/helpers/context.ts:119-139`, `src/lib/auth-session.test.ts:27-37`.
 *
 * `breakRollback` additionally makes `deleteUser` answer an error, which is the
 * only way to reach the `provision_orphaned` arm without leaving a live DB
 * constraint on a Supabase stack four worktrees share.
 */
function failingProfileInsert(real: typeof svc, opts: { breakRollback?: boolean } = {}): typeof svc {
  const realAdmin = real.auth.admin;
  // Bound method references, not a spread — spreading a class instance drops its
  // prototype. These six are every `auth.admin` member `createEmployee` reaches.
  const adminApi = {
    listUsers: realAdmin.listUsers.bind(realAdmin),
    createUser: realAdmin.createUser.bind(realAdmin),
    inviteUserByEmail: realAdmin.inviteUserByEmail.bind(realAdmin),
    updateUserById: realAdmin.updateUserById.bind(realAdmin),
    getUserById: realAdmin.getUserById.bind(realAdmin),
    deleteUser: opts.breakRollback
      ? () => Promise.resolve({ data: { user: null }, error: { message: "simulated rollback failure" } })
      : realAdmin.deleteUser.bind(realAdmin),
  };
  const double = {
    auth: {
      admin: adminApi,
      resetPasswordForEmail: real.auth.resetPasswordForEmail.bind(real.auth),
    },
    // Only the net-new arm runs under this double, and it touches exactly one
    // builder method on `profiles`.
    from: (table: string) =>
      table === "profiles" ? { insert: () => Promise.resolve(INSERT_FAILURE) } : real.from(table as never),
  };
  return double as unknown as typeof svc;
}

/**
 * Partial double whose ONLY difference is that the activation mail fails.
 * Everything the repair arm does — unban, profile upsert — runs for real, so the
 * assertion is "repaired AND mail failed", not "nothing happened".
 *
 * The activation mail IS the invite since phase 8, so that is the one sender to
 * break. `createEmployee` no longer calls `resetPasswordForEmail` at all.
 */
function mailFails(real: typeof svc): typeof svc {
  const realAdmin = real.auth.admin;
  const double = {
    auth: {
      admin: {
        listUsers: realAdmin.listUsers.bind(realAdmin),
        createUser: realAdmin.createUser.bind(realAdmin),
        updateUserById: realAdmin.updateUserById.bind(realAdmin),
        getUserById: realAdmin.getUserById.bind(realAdmin),
        deleteUser: realAdmin.deleteUser.bind(realAdmin),
        inviteUserByEmail: () =>
          Promise.resolve({ data: { user: null }, error: { message: "simulated invite failure" } }),
      },
      resetPasswordForEmail: real.auth.resetPasswordForEmail.bind(real.auth),
    },
    from: real.from.bind(real),
  };
  return double as unknown as typeof svc;
}

function bannedUntil(user: unknown): string | null {
  return (user as { banned_until?: string | null } | null)?.banned_until ?? null;
}

function isBanned(user: unknown): boolean {
  const until = bannedUntil(user);
  return until != null && new Date(until) > new Date();
}

afterAll(async () => {
  for (const id of createdIds) {
    await svc.from("profiles").delete().eq("user_id", id);
    await svc.auth.admin.deleteUser(id).catch(() => undefined);
  }
  // Defensive: guarantee the seeded admins are active for every later test file.
  // DEMO_ADMIN belongs here too (impl-review F9): the last-admin test silences
  // every OTHER active admin, and since the demo account landed that set includes
  // it. Its own `finally` restores it, but a killed run or a worker timeout skips
  // that — and a deactivated demo admin resolves to a null role in middleware, so
  // the NEXT Playwright run fails at `authenticate as demo` with nothing pointing
  // back here.
  await svc.from("profiles").update({ deactivated_at: null }).in("user_id", [SEED_ADMIN, DEMO_ADMIN]);
});

describe("staff account lifecycle (S-08)", () => {
  it("createEmployee creates a net-new employee SILENTLY (created + profile + auth user, no mail)", async () => {
    const email = uniqueEmail("create");
    const res = await createEmployee(svc, { email, full_name: "Jan Kowalski Żółć", origin: ORIGIN });
    expect(res.status).toBe("created");
    if (res.status !== "created") return;
    createdIds.push(res.member.id);

    const { data: got } = await svc.auth.admin.getUserById(res.member.id);
    expect(got.user?.email).toBe(email); // GoTrue lowercases; our tag is lowercase
    // Step 1 of two: nothing has been sent, so nothing is stamped.
    expect(got.user?.invited_at ?? null).toBeNull();
    expect(got.user?.last_sign_in_at ?? null).toBeNull();
    // `email_confirm: false` is load-bearing: GoTrue refuses `inviteUserByEmail`
    // for an address it already considers registered, so confirming here would
    // make step 2 impossible.
    expect(got.user?.email_confirmed_at ?? null).toBeNull();

    const { data: profile } = await svc
      .from("profiles")
      .select("role, full_name, deactivated_at")
      .eq("user_id", res.member.id)
      .single();
    expect(profile?.role).toBe("employee");
    expect(profile?.full_name).toBe("Jan Kowalski Żółć");
    expect(profile?.deactivated_at).toBeNull();
    expect(res.member.status).toBe("created");

    // The claim that matters, and the one an absent error cannot make: ZERO mail.
    expect(await settledMailCount(email)).toBe(0);
  });

  it("refuses a second invite for an active email (duplicate_active)", async () => {
    const email = uniqueEmail("dup");
    const first = await createEmployee(svc, { email, full_name: "Ada Nowak", origin: ORIGIN });
    expect(first.status).toBe("created");
    if (first.status === "created") createdIds.push(first.member.id);

    const second = await createEmployee(svc, { email, full_name: "Ada Nowak", origin: ORIGIN });
    expect(second.status).toBe("duplicate_active");
  });

  it("reactivates a deactivated email — clears deactivated_at and lifts the ban", async () => {
    const email = uniqueEmail("react");
    const first = await createEmployee(svc, { email, full_name: "Ola Reakt", origin: ORIGIN });
    expect(first.status).toBe("created");
    if (first.status !== "created") return;
    const id = first.member.id;
    createdIds.push(id);

    // Full deactivate path: RPC on the admin cookie client + the auth ban.
    const admin = await as("admin");
    const deac = await deactivateStaff(svc, admin, id);
    expect(deac.status).toBe("ok");

    const { data: afterDeac } = await svc.from("profiles").select("deactivated_at").eq("user_id", id).single();
    expect(afterDeac?.deactivated_at).not.toBeNull();
    const { data: bannedUser } = await svc.auth.admin.getUserById(id);
    expect(isBanned(bannedUser.user)).toBe(true);

    // Re-add the same email → reactivated: deactivated_at cleared, unbanned,
    // name refreshed. This user has no password, so the repair arm invites them
    // — a real invitation, not a recovery link — and they land INVITED.
    const react = await createEmployee(svc, { email, full_name: "Ola Reakt II", origin: ORIGIN });
    expect(react.status).toBe("reactivated");
    if (react.status === "reactivated") {
      expect(react.member.status).toBe("invited");
      expect(react.activationMail).toBe("sent");
    }

    const { data: afterReact } = await svc
      .from("profiles")
      .select("deactivated_at, full_name")
      .eq("user_id", id)
      .single();
    expect(afterReact?.deactivated_at).toBeNull();
    expect(afterReact?.full_name).toBe("Ola Reakt II");
    const { data: unbannedUser } = await svc.auth.admin.getUserById(id);
    expect(isBanned(unbannedUser.user)).toBe(false);
  });

  it("reactivating a previously-ACTIVE user restores them as active (not a phantom invite)", async () => {
    const email = uniqueEmail("react-active");
    const password = "Fl0ta-ReactActive-2026!";
    // An account that HAS signed in (last_sign_in_at is stamped).
    const created = await svc.auth.admin.createUser({ email, password, email_confirm: true });
    const id = created.data.user?.id;
    if (!id) throw new Error("createUser failed");
    createdIds.push(id);
    // `createUser({ password })` mints the password out-of-band, bypassing the two
    // routes that write password_set_at — stamp it so this fixture really is the
    // "has a working password" shape the assertion below reads.
    await svc.from("profiles").insert({
      user_id: id,
      role: "employee",
      full_name: "Aktywny Wraca",
      password_set_at: new Date().toISOString(),
    });
    expect((await anonClient().auth.signInWithPassword({ email, password })).error).toBeNull();

    const admin = await as("admin");
    expect((await deactivateStaff(svc, admin, id)).status).toBe("ok");

    const react = await createEmployee(svc, { email, full_name: "Aktywny Wraca", origin: ORIGIN });
    expect(react.status).toBe("reactivated");
    // The fix: not hardcoded "invited" — a returning active user is ACTIVE again.
    if (react.status === "reactivated") expect(react.member.status).toBe("active");
  });
});

describe("the two-step add — step 2 sends the invitation (invite-journey-fixes phase 8)", () => {
  it("invites an already-created user: exactly one mail, invited_at stamped, roster moves DODANY → ZAPROSZONY", async () => {
    const email = uniqueEmail("invite-step2");
    const created = await createEmployee(svc, { email, full_name: "Robert Zieliński", origin: ORIGIN });
    expect(created.status).toBe("created");
    if (created.status !== "created") return;
    const id = created.member.id;
    createdIds.push(id);

    // The roster's third state, read through the real admin-gated RPC.
    const admin = await as("admin");
    expect((await listStaff(admin)).find((m) => m.id === id)?.status).toBe("created");

    // The probe this phase rests on: `inviteUserByEmail` works on a user that
    // ALREADY EXISTS, so we never have to own the send and the real GoTrue
    // invite template still carries it.
    const sent = await inviteEmployee(svc, id, ORIGIN);
    expect(sent.status).toBe("sent");
    expect(sent.invitedAt ?? null).not.toBeNull();

    expect(await waitForMailCount(email, 1)).toBe(1);

    const { data: got } = await svc.auth.admin.getUserById(id);
    expect(got.user?.invited_at ?? null).not.toBeNull();
    expect((await listStaff(admin)).find((m) => m.id === id)?.status).toBe("invited");
  });

  it("resends to an already-invited hire — the roster's one remedy for a lost invite", async () => {
    const email = uniqueEmail("invite-resend");
    const created = await createEmployee(svc, { email, full_name: "Ponowne Zaproszenie", origin: ORIGIN });
    expect(created.status).toBe("created");
    if (created.status !== "created") return;
    createdIds.push(created.member.id);

    expect((await inviteEmployee(svc, created.member.id, ORIGIN)).status).toBe("sent");
    expect(await waitForMailCount(email, 1)).toBe(1);
    // A resend is a second real send. GoTrue invalidates the previous link, so
    // there is never more than one live token per person.
    expect((await inviteEmployee(svc, created.member.id, ORIGIN)).status).toBe("sent");
    expect(await waitForMailCount(email, 2)).toBe(2);
  });

  it("REFUSES a target that already has a password — our own gate, not GoTrue's", async () => {
    const email = uniqueEmail("invite-haspw");
    const password = "Fl0ta-InviteGate-2026!";
    const created = await svc.auth.admin.createUser({ email, password, email_confirm: true });
    const id = created.data.user?.id;
    if (!id) throw new Error("createUser failed");
    createdIds.push(id);
    await svc.from("profiles").insert({
      user_id: id,
      role: "employee",
      full_name: "Ma Hasło",
      password_set_at: new Date().toISOString(),
    });

    const res = await inviteEmployee(svc, id, ORIGIN);
    expect(res.status).toBe("has_password");
    // The refusal is ours and fires BEFORE GoTrue is asked, so nothing is sent.
    expect(await settledMailCount(email)).toBe(0);
  });

  it("refuses an unknown id and an id with no profile row", async () => {
    expect((await inviteEmployee(svc, "00000000-0000-0000-0000-000000000000", ORIGIN)).status).toBe("not_found");
    expect((await inviteEmployee(svc, "not-a-uuid", ORIGIN)).status).toBe("not_found");

    // An auth user with no profiles row — the orphan shape — is not invitable.
    const email = uniqueEmail("invite-noprofile");
    const created = await svc.auth.admin.createUser({ email, email_confirm: false });
    const id = created.data.user?.id;
    if (!id) throw new Error("createUser failed");
    createdIds.push(id);
    expect((await inviteEmployee(svc, id, ORIGIN)).status).toBe("not_found");
  });

  it("reports `failed` — not a silent success — when GoTrue refuses a confirmed address", async () => {
    // GoTrue decides "already registered" on `email_confirmed_at` alone, so it
    // refuses `inviteUserByEmail` for an account that is confirmed but still
    // password-less (probed 2026-08-21: 422, `code: "email_exists"`). Only the
    // OLD callback could produce that state — it ran verifyOtp on the GET —
    // and phase group B stopped it, so this is unreachable through the app.
    // Pinned anyway because the shape of the answer matters: the service must
    // report the refusal honestly rather than paper over it by quietly sending
    // a recovery link, which would reopen the reset journey phase 8 closes.
    const email = uniqueEmail("invite-confirmed");
    const created = await createEmployee(svc, { email, full_name: "Kliknął Nie Ustawił", origin: ORIGIN });
    expect(created.status).toBe("created");
    if (created.status !== "created") return;
    const id = created.member.id;
    createdIds.push(id);

    const generated = await svc.auth.admin.generateLink({ type: "invite", email });
    expect(generated.error).toBeNull();
    if (generated.error) return;
    const exchange = await anonClient().auth.verifyOtp({
      token_hash: generated.data.properties.hashed_token,
      type: "invite",
    });
    expect(exchange.error).toBeNull();

    // Confirmed, still password-less — exactly the shape GoTrue now refuses.
    const { data: confirmed } = await svc.auth.admin.getUserById(id);
    expect(confirmed.user?.email_confirmed_at ?? null).not.toBeNull();
    expect(await stampOf(id)).toBeNull();
    const refused = await svc.auth.admin.inviteUserByEmail(email, { redirectTo: `${ORIGIN}/auth/callback` });
    expect(refused.error?.code).toBe("email_exists");

    const res = await inviteEmployee(svc, id, ORIGIN);
    expect(res.status).toBe("failed");
    expect(res.invitedAt ?? null).toBeNull();
  });
});

describe("provisioning rollback when the profiles insert fails (invite-journey-fixes)", () => {
  it("provision_rolled_back leaves no auth user behind — and, since the two-step add, no mail either", async () => {
    const email = uniqueEmail("rollback");
    const res = await createEmployee(failingProfileInsert(svc), {
      email,
      full_name: "Nieudane Konto",
      origin: ORIGIN,
    });
    expect(res.status).toBe("provision_rolled_back");

    // The auth user really was created (real GoTrue hop) and really was rolled
    // back: no orphaned auth.users row survives for that address.
    expect(await findAuthUserId(email)).toBeNull();
    // What phase 8 changes: nothing was sent, so a failed create leaves no
    // delivered invite and no dead link for the hire to walk into.
    expect(await settledMailCount(email)).toBe(0);
  });

  it("reports provision_orphaned when the rollback also fails — and `Ponów` repairs it", async () => {
    const email = uniqueEmail("orphan");
    const res = await createEmployee(failingProfileInsert(svc, { breakRollback: true }), {
      email,
      full_name: "Osierocone Konto",
      origin: ORIGIN,
    });
    expect(res.status).toBe("provision_orphaned");

    // The exact orphan shape: an auth user with no profiles row.
    const orphanId = await findAuthUserId(email);
    expect(orphanId).not.toBeNull();
    if (!orphanId) return;
    createdIds.push(orphanId);
    const { data: noProfile } = await svc.from("profiles").select("user_id").eq("user_id", orphanId).maybeSingle();
    expect(noProfile).toBeNull();

    // What the banner's `Ponów` does: re-POST the same payload. It takes the
    // `existing` repair arm and completes the account.
    const repair = await createEmployee(svc, { email, full_name: "Osierocone Konto", origin: ORIGIN });
    expect(repair.status).toBe("reactivated");
    if (repair.status !== "reactivated") return;
    // The orphan never set a password, so the repair must label them INVITED and
    // actually send the activation mail — the outcome is now reported, not
    // swallowed by a `.catch()` that never fired. Since phase 8 that mail is a
    // real INVITE rather than a recovery link, which is what keeps a new hire's
    // first contact in the invite journey.
    expect(repair.member.status).toBe("invited");
    expect(repair.activationMail).toBe("sent");
    expect(await waitForMailCount(email, 1)).toBe(1);
    expect(await stampOf(orphanId)).toBeNull();

    const { data: repaired } = await svc
      .from("profiles")
      .select("role, deactivated_at")
      .eq("user_id", orphanId)
      .single();
    expect(repaired?.role).toBe("employee");
    expect(repaired?.deactivated_at).toBeNull();
  });
});

describe("the link exchange is not a password (research §1.5(a), invite-journey-fixes)", () => {
  it("a hire who opened their invite link but set no password is INVITED, and a repair tries to mail them", async () => {
    const email = uniqueEmail("clicked");
    // Provision exactly like `services/staff.ts` does, but through generateLink
    // so no mail is spent: an auth user + a profiles row with NO password_set_at.
    const generated = await svc.auth.admin.generateLink({ type: "invite", email });
    expect(generated.error).toBeNull();
    if (generated.error) return;
    const tokenHash = generated.data.properties.hashed_token;
    const id = generated.data.user.id;
    createdIds.push(id);
    await svc.from("profiles").insert({ user_id: id, role: "employee", full_name: "Kliknął Nie Ustawił" });

    // SPEND the link the way opening it does today. This is the event that
    // stamps last_sign_in_at while no password has ever been chosen.
    const exchange = await anonClient().auth.verifyOtp({ token_hash: tokenHash, type: "invite" });
    expect(exchange.error).toBeNull();

    // The corrupted proxy is now set...
    const { data: authUser } = await svc.auth.admin.getUserById(id);
    expect(authUser.user?.last_sign_in_at ?? null).not.toBeNull();
    // ...and the owned signal is correctly still empty.
    expect(await stampOf(id)).toBeNull();

    // The roster reads the owned signal: ZAPROSZONY, where it used to say AKTYWNY.
    const admin = await as("admin");
    const roster = await listStaff(admin);
    expect(roster.find((m) => m.id === id)?.status).toBe("invited");

    // And a repair ATTEMPTS the activation mail. `not_needed` is the assertion
    // that matters: that is what the old `wasActive` proxy returned here — it
    // read last_sign_in_at as proof of a password, so the repair sent nothing at
    // all and the roster went green on someone who could not sign in.
    //
    // The attempt reports `failed` rather than `sent` because the verifyOtp
    // above confirmed the address and GoTrue refuses to invite a confirmed one.
    // That is deliberate, not a gap: the app itself can no longer create this
    // state (phase group B stopped exchanging the token on the GET), and the
    // service reports the refusal instead of quietly falling back to a recovery
    // link. `staff-status.test.ts` holds the derivation half of this regression.
    expect((await deactivateStaff(svc, admin, id)).status).toBe("ok");
    const react = await createEmployee(svc, { email, full_name: "Kliknął Nie Ustawił", origin: ORIGIN });
    expect(react.status).toBe("reactivated");
    if (react.status !== "reactivated") return;
    expect(react.member.status).toBe("invited");
    expect(react.activationMail).not.toBe("not_needed");
    expect(react.activationMail).toBe("failed");
  });

  it("reports a failed activation mail instead of swallowing it", async () => {
    const email = uniqueEmail("mailfail");
    const created = await createEmployee(svc, { email, full_name: "Poczta Padła", origin: ORIGIN });
    expect(created.status).toBe("created");
    if (created.status !== "created") return;
    const id = created.member.id;
    createdIds.push(id);

    const admin = await as("admin");
    expect((await deactivateStaff(svc, admin, id)).status).toBe("ok");

    // Fail ONLY the activation mail; the repair itself must still succeed.
    const mailBroken = mailFails(svc);
    const react = await createEmployee(mailBroken, { email, full_name: "Poczta Padła", origin: ORIGIN });
    expect(react.status).toBe("reactivated");
    if (react.status !== "reactivated") return;
    expect(react.activationMail).toBe("failed");

    // The account really was repaired — that is why the route still answers 200.
    const { data: repaired } = await svc.from("profiles").select("deactivated_at").eq("user_id", id).single();
    expect(repaired?.deactivated_at).toBeNull();
  });
});

describe("mark_password_set() stamps only the caller (invite-journey-fixes)", () => {
  const EMPLOYEE_ID = "e0000000-0000-0000-0000-0000000000e0";

  it("stamps the caller's own row and leaves every other row alone", async () => {
    const employeeBefore = await stampOf(EMPLOYEE_ID);
    const adminBefore = await stampOf(SEED_ADMIN);

    try {
      const employee = await as("employee");
      const { error } = await employee.rpc("mark_password_set");
      expect(error).toBeNull();

      // The caller's own row is stamped...
      const employeeAfter = await stampOf(EMPLOYEE_ID);
      expect(employeeAfter).not.toBeNull();
      expect(employeeAfter).not.toBe(employeeBefore);

      // ...and nobody else's is. The RPC takes no target parameter precisely so
      // an authenticated caller cannot reach another person's row, and it runs
      // SECURITY DEFINER over an admin-only-UPDATE table.
      expect(await stampOf(SEED_ADMIN)).toBe(adminBefore);
    } finally {
      await svc.from("profiles").update({ password_set_at: employeeBefore }).eq("user_id", EMPLOYEE_ID);
    }
  });
});

describe("deactivate_staff guards + RLS boundary (S-08)", () => {
  it("returns 'self' when an admin targets their own account", async () => {
    const admin = await as("admin");
    const res = await admin.rpc("deactivate_staff", { target: SEED_ADMIN });
    expect(res.error).toBeNull();
    expect(res.data).toBe("self");
  });

  it("returns 'ok' for a normal employee and hides the row from list_staff", async () => {
    const email = uniqueEmail("hide");
    const created = await createEmployee(svc, { email, full_name: "Do Ukrycia", origin: ORIGIN });
    expect(created.status).toBe("created");
    if (created.status !== "created") return;
    createdIds.push(created.member.id);

    const admin = await as("admin");
    const before = await listStaff(admin);
    expect(before.some((m) => m.id === created.member.id)).toBe(true);

    const res = await admin.rpc("deactivate_staff", { target: created.member.id });
    expect(res.data).toBe("ok");

    const after = await listStaff(admin);
    expect(after.some((m) => m.id === created.member.id)).toBe(false);
  });

  it("denies both RPCs to a non-admin (employee, norole, anon)", async () => {
    const employee = await as("employee");
    expect(await listStaff(employee)).toHaveLength(0);
    expect((await employee.rpc("deactivate_staff", { target: SEED_ADMIN })).data).toBe("unauthorized");

    const norole = await as("norole");
    expect(await listStaff(norole)).toHaveLength(0);
    expect((await norole.rpc("deactivate_staff", { target: SEED_ADMIN })).data).toBe("unauthorized");

    // anon is refused beneath the in-RPC gate, at the EXECUTE grant layer.
    expect((await anonClient().rpc("list_staff")).error).not.toBeNull();
    expect((await anonClient().rpc("deactivate_staff", { target: SEED_ADMIN })).error).not.toBeNull();
  });

  // Runs LAST: it deactivates the seed admin to make a target the sole active
  // admin, then restores the seed admin in a finally so nothing downstream breaks.
  it("returns 'last_admin' when the target is the only active admin", async () => {
    const caller = await svc.auth.admin.createUser({
      email: uniqueEmail("caller-admin"),
      password: PASSWORD,
      email_confirm: true,
    });
    const target = await svc.auth.admin.createUser({
      email: uniqueEmail("target-admin"),
      password: PASSWORD,
      email_confirm: true,
    });
    const callerUser = caller.data.user;
    const targetUser = target.data.user;
    if (!callerUser?.email || !targetUser) {
      throw new Error("Failed to create admin fixtures");
    }
    const callerId = callerUser.id;
    const targetId = targetUser.id;
    createdIds.push(callerId, targetId);
    await svc.from("profiles").insert([
      { user_id: callerId, role: "admin", full_name: "Caller Admin" },
      { user_id: targetId, role: "admin", full_name: "Target Admin" },
    ]);

    // The caller signs in for a real admin JWT (current_app_role() reads role
    // only, so a deactivated-but-admin caller still passes the RPC's admin gate).
    const callerClient = anonClient();
    const signIn = await callerClient.auth.signInWithPassword({
      email: callerUser.email,
      password: PASSWORD,
    });
    expect(signIn.error).toBeNull();

    // Make `target` the ONLY active admin. The set to silence is queried rather
    // than hardcoded: the seed carries more than one admin (SEED_ADMIN plus the
    // published demo admin), and hardcoding the pair silently turns this
    // assertion into a no-op the moment another admin is seeded — which is
    // exactly what happened when the demo account landed.
    const { data: otherAdmins } = await svc
      .from("profiles")
      .select("user_id")
      .eq("role", "admin")
      .is("deactivated_at", null)
      .neq("user_id", targetId);
    const silenced = userIdsFrom(otherAdmins);
    expect(silenced).toContain(callerId);
    expect(silenced).toContain(SEED_ADMIN);
    // The case the comment above exists for: the demo admin is the extra seeded
    // admin that turned the old hardcoded pair into a no-op. Assert it explicitly so
    // a future seeded admin cannot silently re-open the same hole.
    expect(silenced).toContain(DEMO_ADMIN);

    const now = new Date().toISOString();
    await svc.from("profiles").update({ deactivated_at: now }).in("user_id", silenced);
    try {
      const res = await callerClient.rpc("deactivate_staff", { target: targetId });
      expect(res.error).toBeNull();
      expect(res.data).toBe("last_admin");

      // The guard fired before any write — target is still active.
      const { data: targetProfile } = await svc
        .from("profiles")
        .select("deactivated_at")
        .eq("user_id", targetId)
        .single();
      expect(targetProfile?.deactivated_at).toBeNull();
    } finally {
      // Restore exactly what was silenced (the caller is torn down by
      // `createdIds`; every seeded admin has to come back active).
      await svc.from("profiles").update({ deactivated_at: null }).in("user_id", silenced);
    }
  });
});

// ---------------------------------------------------------------------------
// The demo gate (demo-account-gate phase 2)
// ---------------------------------------------------------------------------
//
// WHY THESE RUN AT THE ROUTE LAYER while the rest of this file runs at the
// service layer: the gate IS a route-handler check. It sits in the self-gating
// ladder between `requireRole` and the body parse, and no service knows it
// exists — `createEmployee`, `deactivateStaff` and `resetStaffPassword` are all
// reachable and correct for a demo caller. So the only place the property is
// true or false is the handler, driven here through a constructed APIContext
// (tests/helpers/context.ts), exactly as `api-authz.test.ts` drives its matrix.
//
// WHAT THE NEGATIVE CONTROL CAN AND CANNOT BE. Under vitest `astro:env/server`
// is stubbed unconfigured (tests/stubs/astro-env-server.ts), so
// `createAdminClient()` returns null and ALL FOUR of these routes end in their
// `unconfigured` 403 no matter who calls them. A route-layer "the admin's call
// succeeds" is therefore not available at this altitude, and pretending
// otherwise would need a stub change that flips the email seam and config-status
// for every other suite in the repo.
//
// What IS available is sharper than it sounds: the admin and the demo caller
// issue the BYTE-IDENTICAL request and differ only in `locals.isDemo`, and they
// get two different refusals — `demo_blocked` for the demo caller, an
// `unconfigured` 403 with NO `code` for the admin, which is proof the admin got
// PAST the gate and failed at the next boundary. That is precisely the claim the
// gate makes. The happy paths for the same three mutations are covered one layer
// down by the lifecycle cases above, which run the services for real.
describe("the demo gate on the three staff mutation routes (demo-account-gate)", () => {
  // ONE disposable target serves every case here: a refused call changes
  // nothing, because the gate returns before the body is parsed and before any
  // admin client is constructed. Torn down with the rest via `createdIds`.
  let targetId = "";
  let targetEmail = "";
  let ownerId = "";
  let ownerEmail = "";
  // A real auth user with NO profiles row, so an INSERT probe targets a valid FK.
  // Without it the insert cases fail on `profiles_user_id_fkey` and a policy
  // denial cannot be told apart from a bad fixture — which is exactly what the
  // first draft of these cases did, passing for the wrong reason.
  let insertProbeId = "";

  const UNCONFIGURED = "Account management isn’t configured.";

  /** The JSON body of a handler response, narrowed for the two fields asserted. */
  async function refusal(res: Response): Promise<{ error?: string; code?: string }> {
    return (await res.json()) as { error?: string; code?: string };
  }

  beforeAll(async () => {
    targetEmail = uniqueEmail("demo-gate-target");
    const created = await svc.auth.admin.createUser({
      email: targetEmail,
      password: PASSWORD,
      email_confirm: true,
    });
    const user = created.data.user;
    if (!user) {
      throw new Error("Failed to create the demo-gate target fixture");
    }
    targetId = user.id;
    createdIds.push(targetId);
    await svc.from("profiles").insert({ user_id: targetId, role: "employee", full_name: "Cel Bramki Demo Żółć" });

    // A disposable SECOND admin, standing in for the owner's real account. It is
    // what makes the lockout cases meaningful: the RPC's `self` and `last_admin`
    // guards both hold for a demo caller, so the only lockout it ever had was
    // "remove a DIFFERENT admin" — and that needs a different admin to exist.
    ownerEmail = uniqueEmail("demo-gate-owner");
    const owner = await svc.auth.admin.createUser({
      email: ownerEmail,
      password: PASSWORD,
      email_confirm: true,
    });
    const ownerUser = owner.data.user;
    if (!ownerUser) {
      throw new Error("Failed to create the stand-in owner fixture");
    }
    ownerId = ownerUser.id;
    createdIds.push(ownerId);
    await svc.from("profiles").insert({ user_id: ownerId, role: "admin", full_name: "Zastępczy Właściciel" });

    const probe = await svc.auth.admin.createUser({
      email: uniqueEmail("demo-gate-insert-probe"),
      password: PASSWORD,
      email_confirm: true,
    });
    const probeUser = probe.data.user;
    if (!probeUser) {
      throw new Error("Failed to create the insert-probe fixture");
    }
    insertProbeId = probeUser.id;
    createdIds.push(insertProbeId);
  });

  it("marks the seeded demo account and only the seeded demo account", async () => {
    // The gate is driven by the COLUMN, not by the role — an admin is an admin.
    // If this ever inverts, every case below would pass for the wrong reason.
    const { data: demo } = await svc.from("profiles").select("role, is_demo").eq("user_id", DEMO_ADMIN).single();
    expect(demo?.role).toBe("admin");
    expect(demo?.is_demo).toBe(true);

    const { data: real } = await svc.from("profiles").select("role, is_demo").eq("user_id", SEED_ADMIN).single();
    expect(real?.role).toBe("admin");
    expect(real?.is_demo).toBe(false);
  });

  it("refuses POST /api/staff — the one route that mails a caller-supplied address", async () => {
    const email = uniqueEmail("demo-blocked-add");
    const res = await staffCreatePOST(
      await asContext("demo", {
        method: "POST",
        path: "/api/staff",
        body: { email, full_name: "Nigdy Nie Powstanie" },
      }),
    );

    expect(res.status).toBe(403);
    expect(await refusal(res)).toEqual({ error: DEMO_BLOCKED_MESSAGE, code: DEMO_BLOCKED_CODE });

    // The refusal is total, not cosmetic. This is the ONLY staff route that takes
    // a caller-supplied address and hands it to GoTrue, so the claims that matter
    // are "no account exists for it" and "nothing was mailed to it" — neither of
    // which an absent error would prove.
    expect(await findAuthUserId(email)).toBeNull();
    expect(await settledMailCount(email)).toBe(0);
  });

  it("refuses POST /api/staff/[id]/deactivate, leaving the target active", async () => {
    const res = await staffDeactivatePOST(
      await asContext("demo", {
        method: "POST",
        path: `/api/staff/${targetId}/deactivate`,
        params: { id: targetId },
        body: { confirmEmail: targetEmail },
      }),
    );

    expect(res.status).toBe(403);
    expect(await refusal(res)).toEqual({ error: DEMO_BLOCKED_MESSAGE, code: DEMO_BLOCKED_CODE });

    // THE LOCKOUT THE RPC DOES NOT COVER, and the reason this route is gated at
    // all. `deactivate_staff` guards `self` and `last_admin`, so a demo admin can
    // remove neither itself nor the last admin — but nothing in the RPC stops it
    // removing a DIFFERENT admin, which in production is the owner. Note the body
    // above carries the CORRECT confirmation e-mail: this would have succeeded.
    const { data } = await svc.from("profiles").select("deactivated_at").eq("user_id", targetId).single();
    expect(data?.deactivated_at).toBeNull();
  });

  it("refuses POST /api/staff/[id]/reset-password and sends no mail", async () => {
    const res = await staffResetPasswordPOST(
      await asContext("demo", {
        method: "POST",
        path: `/api/staff/${targetId}/reset-password`,
        params: { id: targetId },
      }),
    );

    expect(res.status).toBe(403);
    expect(await refusal(res)).toEqual({ error: DEMO_BLOCKED_MESSAGE, code: DEMO_BLOCKED_CODE });
    expect(await settledMailCount(targetEmail)).toBe(0);
  });

  // ORDERING, both directions. The gate has exactly one correct position in the
  // ladder and both neighbours are asserted, because either slip is silent: too
  // early and a cross-site POST would be told it is a demo account; too late and
  // a demo caller's refusal would depend on whether their body happened to parse.
  it("sits BELOW the CSRF check — a foreign origin is still a bad-origin 403", async () => {
    const res = await staffCreatePOST(
      await asContext("demo", {
        method: "POST",
        path: "/api/staff",
        body: { email: uniqueEmail("demo-foreign"), full_name: "Obce Źródło" },
        origin: "https://evil.example.com",
      }),
    );

    expect(res.status).toBe(403);
    const body = await refusal(res);
    expect(body.error).toBe("Invalid request origin.");
    expect(body.code).toBeUndefined();
  });

  it("sits ABOVE the body parse — malformed JSON from a demo caller is still `demo_blocked`", async () => {
    const res = await staffCreatePOST(
      await asContext("demo", { method: "POST", path: "/api/staff", rawBody: "{not json" }),
    );

    expect(res.status).toBe(403);
    expect(await refusal(res)).toEqual({ error: DEMO_BLOCKED_MESSAGE, code: DEMO_BLOCKED_CODE });
  });

  it("does not fire for a NON-demo admin on any of the three — only the marker differs", async () => {
    // The identical requests as `admin`. Each gets past the gate and dies at the
    // next boundary (`createAdminClient()` is null under the env stub), which is
    // what a `code`-less `unconfigured` 403 means here. See the block header.
    const calls: { name: string; run: () => Promise<Response> }[] = [
      {
        name: "POST /api/staff",
        run: async () =>
          staffCreatePOST(
            await asContext("admin", {
              method: "POST",
              path: "/api/staff",
              body: { email: uniqueEmail("non-demo-admin"), full_name: "Prawdziwy Administrator" },
            }),
          ),
      },
      {
        name: "POST /api/staff/[id]/deactivate",
        run: async () =>
          staffDeactivatePOST(
            await asContext("admin", {
              method: "POST",
              path: `/api/staff/${targetId}/deactivate`,
              params: { id: targetId },
              body: { confirmEmail: targetEmail },
            }),
          ),
      },
      {
        name: "POST /api/staff/[id]/reset-password",
        run: async () =>
          staffResetPasswordPOST(
            await asContext("admin", {
              method: "POST",
              path: `/api/staff/${targetId}/reset-password`,
              params: { id: targetId },
            }),
          ),
      },
    ];

    for (const { name, run } of calls) {
      const body = await refusal(await run());
      expect(body.code, `${name} refused a real admin as a demo caller`).toBeUndefined();
      expect(body.error, name).toBe(UNCONFIGURED);
    }

    // And nothing was deactivated on the way through.
    const { data } = await svc.from("profiles").select("deactivated_at").eq("user_id", targetId).single();
    expect(data?.deactivated_at).toBeNull();
  });

  it("leaves POST /api/staff/[id]/invite OUTSIDE the gate — the deliberate scope boundary", async () => {
    // Not gated, and this pins why rather than merely that: unlike the three
    // above, `inviteEmployee` resolves its own recipient AND refuses anyone whose
    // `password_set_at` is set, so the worst a demo caller can do is re-send an
    // invitation to an already-listed, password-less staffer. A demo caller must
    // therefore reach the SAME refusal a real admin does.
    for (const role of ["demo", "admin"] as const) {
      const res = await staffInvitePOST(
        await asContext(role, {
          method: "POST",
          path: `/api/staff/${targetId}/invite`,
          params: { id: targetId },
        }),
      );
      const body = await refusal(res);
      expect(body.code, `invite refused ${role} with a demo code`).toBeUndefined();
      expect(body.error, `invite answered ${role} differently`).toBe(UNCONFIGURED);
    }
  });

  // ─────────────────────────────────────────────────────────────────────────
  // The DB layer. The route guard above is only one door.
  // ─────────────────────────────────────────────────────────────────────────
  //
  // `profiles.is_demo` is NOT a JWT claim — it is a column the app reads onto
  // `App.Locals` — so `current_app_role()` and every RLS policy see the demo
  // account as the plain admin it is. And the demo credentials are PUBLISHED
  // while the publishable anon key is serialized into the page HTML on the two
  // protocol screens (`pickups/[reservationId].astro:108`). A visitor holding
  // nothing but what we deliberately publish can therefore sign in with
  // supabase-js and reach PostgREST with no Astro route in the path.
  //
  // Probed 2026-08-28 BEFORE the fix: all four succeeded. These cases are the
  // regression guard, and they are deliberately driven through `as("demo")` —
  // a real JWT on the anon key, exactly as that visitor's script would be.
  describe("the same refusal at the DB layer, where no route handler runs", () => {
    /** The stand-in owner's row as service-role sees it — the ground truth. */
    async function ownerRow(): Promise<{
      role: string | null;
      deactivated_at: string | null;
      full_name: string | null;
    }> {
      const { data } = await svc
        .from("profiles")
        .select("role, deactivated_at, full_name")
        .eq("user_id", ownerId)
        .single();
      return data as { role: string | null; deactivated_at: string | null; full_name: string | null };
    }

    it("refuses `deactivate_staff` called DIRECTLY, with its own `demo` tag", async () => {
      // SECURITY DEFINER runs as the function owner, so RLS never applies to it —
      // this arm is a separate door from the policies below, not a duplicate of
      // them. Note the target is an ADMIN: `self` and `last_admin` would both
      // have returned 'ok' here, which is precisely the gap.
      const res = await (await as("demo")).rpc("deactivate_staff", { target: ownerId });

      expect(res.error).toBeNull();
      expect(res.data).toBe("demo");
      expect((await ownerRow()).deactivated_at).toBeNull();
    });

    it("refuses a direct UPDATE on profiles — the lockout with no RPC involved", async () => {
      // An RLS denial on UPDATE is not an error: the rows simply fall out of the
      // policy and PostgREST reports zero affected. Asserting on `error` alone
      // would pass whether or not the policy holds, so this asserts BOTH the
      // affected-row count and the row's actual state.
      const res = await (await as("demo"))
        .from("profiles")
        .update({ deactivated_at: new Date().toISOString(), role: "employee" })
        .eq("user_id", ownerId)
        .select();

      expect(res.data ?? []).toHaveLength(0);
      const row = await ownerRow();
      expect(row.deactivated_at).toBeNull();
      expect(row.role).toBe("admin");
    });

    it("refuses a direct DELETE on profiles — stripping the owner's role entirely", async () => {
      const res = await (await as("demo")).from("profiles").delete().eq("user_id", ownerId).select();

      expect(res.data ?? []).toHaveLength(0);
      expect((await ownerRow()).role).toBe("admin");
    });

    it("refuses a direct INSERT into profiles — as a POLICY denial, not a stray error", async () => {
      // INSERT is the one that DOES error: a failing `with check` raises rather
      // than filtering rows away. The CODE is asserted because any error would
      // otherwise satisfy this — a foreign-key violation from a synthetic uuid
      // reads identically at the `error !== null` level, which is how the first
      // draft of this case passed while the policy did nothing.
      const res = await (await as("demo"))
        .from("profiles")
        .insert({ user_id: insertProbeId, role: "admin", full_name: "Podstawiony Admin" });

      expect(res.error?.code).toBe("42501");
      expect(res.error?.message ?? "").toMatch(/row-level security/i);

      const { data } = await svc.from("profiles").select("user_id").eq("user_id", insertProbeId).maybeSingle();
      expect(data).toBeNull();
    });

    it("still lets a REAL admin do all four — the policies gate the marker, not the role", async () => {
      // The negative control that makes the four above meaningful. If the new
      // clause had been written as a plain role tightening, every case above
      // would still pass and this one would go red.
      const admin = await as("admin");

      const renamed = await admin
        .from("profiles")
        .update({ full_name: "Zmienione Przez Admina" })
        .eq("user_id", ownerId)
        .select();
      expect(renamed.data ?? []).toHaveLength(1);

      // The same row the demo caller was refused above, so the two cases differ
      // in exactly one variable: who is asking.
      const inserted = await admin
        .from("profiles")
        .insert({ user_id: insertProbeId, role: "employee", full_name: "Wstawiony Przez Admina" })
        .select();
      expect(inserted.error).toBeNull();
      expect(inserted.data ?? []).toHaveLength(1);

      const deleted = await admin.from("profiles").delete().eq("user_id", insertProbeId).select();
      expect(deleted.data ?? []).toHaveLength(1);

      const rpc = await admin.rpc("deactivate_staff", { target: ownerId });
      expect(rpc.data).toBe("ok");
      expect((await ownerRow()).deactivated_at).not.toBeNull();

      // Restore: later cases and the `afterAll` sweep both assume an active row.
      await svc
        .from("profiles")
        .update({ deactivated_at: null, full_name: "Zastępczy Właściciel" })
        .eq("user_id", ownerId);
    });

    it("keeps the marker readable by the account it describes", async () => {
      // `current_is_demo()` is granted to `authenticated` because the profiles
      // policies call it and a policy helper runs as the QUERYING role. Anon's
      // refusal is pinned separately, in `rpc-execute-grants.test.ts`.
      expect((await (await as("demo")).rpc("current_is_demo")).data).toBe(true);
      expect((await (await as("admin")).rpc("current_is_demo")).data).toBe(false);
      // Fail-closed the right way round: no profiles row must read as NOT demo,
      // so an unknown caller is never locked out of their own deployment.
      expect((await (await as("norole")).rpc("current_is_demo")).data).toBe(false);
    });
  });

  it("leaves the demo account's READ access untouched — it sees the whole roster", async () => {
    // "No read-side restrictions" is a decision, not an oversight: the seed data
    // is fictional and the cockpit is the thing a recruiter came to look at. The
    // flag denies three mutations; it must never narrow a query.
    const roster = await listStaff(await as("demo"));
    expect(roster.length).toBeGreaterThan(0);
    expect(roster.map((m) => m.email)).toContain("admin@fleetrent.test");
  });
});

// The publication side of the gate (demo-account-gate impl-review F3).
//
// `/auth/signin` used to publish `DEMO_EMAIL` — a secret set independently of
// `profiles.is_demo`. Two switches that could disagree, and the disagreement
// failed OPEN: point the secret at a real admin, or set it before marking the
// account, and the page hands out working credentials for an UNGATED admin.
// `demo_account_email()` removes the second switch by deriving the address from
// the flag. These cases pin the three NULL branches, because "returns the right
// address" is the easy half — refusing to answer is what makes it safe.
describe("demo_account_email() — the card can only name a gated account (impl-review F3)", () => {
  /** Flip the marker, run `body`, and put it back however `body` ends. */
  async function withDemoFlag(userId: string, isDemo: boolean, body: () => Promise<void>): Promise<void> {
    const { data: before } = await svc.from("profiles").select("is_demo").eq("user_id", userId).single();
    await svc.from("profiles").update({ is_demo: isDemo }).eq("user_id", userId);
    try {
      await body();
    } finally {
      await svc
        .from("profiles")
        .update({ is_demo: before?.is_demo ?? false })
        .eq("user_id", userId);
    }
  }

  it("returns the seeded demo account's address to an ANONYMOUS caller", async () => {
    // Anon on purpose: the sign-in page renders for signed-out visitors, so a
    // grant that required a session would make the card permanently invisible.
    const res = await anonClient().rpc("demo_account_email");

    expect(res.error).toBeNull();
    expect(res.data).toBe("demo@fleetrent.test");
  });

  it("returns NULL when no account is marked — the card disappears rather than guessing", async () => {
    await withDemoFlag(DEMO_ADMIN, false, async () => {
      const res = await anonClient().rpc("demo_account_email");
      expect(res.error).toBeNull();
      expect(res.data).toBeNull();
    });
  });

  it("returns NULL when TWO accounts are marked — ambiguity is refused, not resolved", async () => {
    // Picking a row here would publish an address nobody deliberately chose,
    // which is the same class of accident the whole function exists to prevent.
    await withDemoFlag(SEED_ADMIN, true, async () => {
      const { data: flagged } = await svc.from("profiles").select("user_id").eq("is_demo", true);
      expect(flagged ?? []).toHaveLength(2);

      const res = await anonClient().rpc("demo_account_email");
      expect(res.error).toBeNull();
      expect(res.data).toBeNull();
    });
  });

  it("returns NULL when the demo account is deactivated — publishing a dead login helps nobody", async () => {
    const { data: before } = await svc.from("profiles").select("deactivated_at").eq("user_id", DEMO_ADMIN).single();
    await svc.from("profiles").update({ deactivated_at: new Date().toISOString() }).eq("user_id", DEMO_ADMIN);
    try {
      const res = await anonClient().rpc("demo_account_email");
      expect(res.error).toBeNull();
      expect(res.data).toBeNull();
    } finally {
      await svc
        .from("profiles")
        .update({ deactivated_at: before?.deactivated_at ?? null })
        .eq("user_id", DEMO_ADMIN);
    }
  });
});
