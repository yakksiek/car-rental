// core
import { afterAll, describe, expect, it } from "vitest";

// others
import { anonClient, as, serviceClient } from "../helpers/clients";
import { createEmployee, deactivateStaff, listStaff } from "../../src/lib/services/staff";

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
  it("createEmployee invites a net-new employee (created + profile + auth user)", async () => {
    const email = uniqueEmail("create");
    const res = await createEmployee(svc, { email, full_name: "Jan Kowalski Żółć", origin: ORIGIN });
    expect(res.status).toBe("created");
    if (res.status !== "created") return;
    createdIds.push(res.member.id);

    const { data: got } = await svc.auth.admin.getUserById(res.member.id);
    expect(got.user?.email).toBe(email); // GoTrue lowercases; our tag is lowercase
    expect(got.user?.invited_at).not.toBeNull();
    expect(got.user?.last_sign_in_at ?? null).toBeNull(); // INVITED, not signed in yet

    const { data: profile } = await svc
      .from("profiles")
      .select("role, full_name, deactivated_at")
      .eq("user_id", res.member.id)
      .single();
    expect(profile?.role).toBe("employee");
    expect(profile?.full_name).toBe("Jan Kowalski Żółć");
    expect(profile?.deactivated_at).toBeNull();
    expect(res.member.status).toBe("invited");
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

    // Re-invite the same email → reactivated: deactivated_at cleared, unbanned,
    // name refreshed. This user never signed in, so it stays INVITED.
    const react = await createEmployee(svc, { email, full_name: "Ola Reakt II", origin: ORIGIN });
    expect(react.status).toBe("reactivated");
    if (react.status === "reactivated") expect(react.member.status).toBe("invited");

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
    await svc.from("profiles").insert({ user_id: id, role: "employee", full_name: "Aktywny Wraca" });
    expect((await anonClient().auth.signInWithPassword({ email, password })).error).toBeNull();

    const admin = await as("admin");
    expect((await deactivateStaff(svc, admin, id)).status).toBe("ok");

    const react = await createEmployee(svc, { email, full_name: "Aktywny Wraca", origin: ORIGIN });
    expect(react.status).toBe("reactivated");
    // The fix: not hardcoded "invited" — a returning active user is ACTIVE again.
    if (react.status === "reactivated") expect(react.member.status).toBe("active");
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

    // Make `target` the ONLY active admin: deactivate the caller and the seed admin.
    const now = new Date().toISOString();
    await svc.from("profiles").update({ deactivated_at: now }).in("user_id", [callerId, SEED_ADMIN]);
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
      await svc.from("profiles").update({ deactivated_at: null }).eq("user_id", SEED_ADMIN);
    }
  });
});
