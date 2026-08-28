// core
import { afterAll, describe, expect, it } from "vitest";

// others
import { anonClient, as, serviceClient } from "../helpers/clients";
import { settledMailCount, waitForMailCount } from "../helpers/mailpit";
import { createEmployee, deactivateStaff, inviteEmployee, listStaff } from "../../src/lib/services/staff";

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
  // Defensive: guarantee the seed admin is active for every later test file.
  await svc.from("profiles").update({ deactivated_at: null }).eq("user_id", SEED_ADMIN);
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
