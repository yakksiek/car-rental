// core
import { afterEach, describe, expect, it } from "vitest";

// others
import { POST as localePOST } from "../../src/pages/api/locale";
import { resolveLocale } from "../../src/lib/i18n/resolve";
import { DEFAULT_LOCALE } from "../../src/lib/i18n/types";
import { as, serviceClient } from "../helpers/clients";
import { anonContext, asContext, cookieOptions } from "../helpers/context";

// The locale dimension's DB half (english-localization Phase 1).
//
// Three things the unit suite cannot reach, because each needs the real
// database or the real route handler:
//
//   1. `set_profile_locale` is the seam that makes `profiles.locale` writable at
//      all. The only UPDATE policy on `profiles` is admin-only, and an
//      RLS-denied UPDATE is a successful update of ZERO rows — so a broken seam
//      fails SILENTLY. The sharp case is an EMPLOYEE, who matches that policy on
//      nothing.
//   2. The demo carve-out. The write side is deliberately ungated, so the ONLY
//      thing stopping one recruiter's language choice from leaking to the next
//      is the read-side skip in `resolveLocale`. This drives a REAL write and
//      then the REAL resolver over what was actually stored.
//   3. `POST /api/locale` is deliberately public (no auth gate) — the two guards
//      that remain, the CSRF check and the redirect sanitiser, therefore carry
//      all of the weight.

// `serviceClient()` is constructed without the Database generic, so its rows
// arrive as `any`. Narrow through an `unknown` parameter, the idiom
// `staff.test.ts` already uses.
function localeFrom(row: unknown): string | null {
  return (row as { locale?: string | null } | null)?.locale ?? null;
}

function isDemoFrom(row: unknown): boolean {
  return (row as { is_demo?: boolean } | null)?.is_demo ?? false;
}

/** `profiles.locale` as stored, read out of band (service role bypasses RLS). */
async function storedLocale(userId: string): Promise<string | null> {
  const { data, error } = await serviceClient().from("profiles").select("locale").eq("user_id", userId).single();
  if (error) {
    throw error;
  }
  return localeFrom(data);
}

/** Restore the seeded "no preference" state so the suite stays re-runnable. */
async function clearStoredLocale(userId: string): Promise<void> {
  const { error } = await serviceClient().from("profiles").update({ locale: null }).eq("user_id", userId);
  if (error) {
    throw error;
  }
}

async function userIdOf(role: "employee" | "admin" | "demo"): Promise<string> {
  const client = await as(role);
  const { data } = await client.auth.getUser();
  const id = data.user?.id;
  if (!id) {
    throw new Error(`could not resolve the seeded ${role} user id`);
  }
  return id;
}

describe("set_profile_locale — the write seam for profiles.locale", () => {
  const touched: string[] = [];

  afterEach(async () => {
    for (const userId of touched.splice(0, touched.length)) {
      await clearStoredLocale(userId);
    }
  });

  it("stamps an EMPLOYEE's own row — the case the admin-only RLS policy denies", async () => {
    const client = await as("employee");
    const userId = await userIdOf("employee");
    touched.push(userId);

    // Baseline: the seeded row expresses no preference.
    expect(await storedLocale(userId)).toBeNull();

    const { error } = await client.rpc("set_profile_locale", { p_locale: "pl" });
    expect(error).toBeNull();
    expect(await storedLocale(userId)).toBe("pl");
  });

  it("a direct table UPDATE by the same employee writes ZERO rows — why the RPC exists", async () => {
    const client = await as("employee");
    const userId = await userIdOf("employee");

    // No error: an RLS-denied UPDATE is a *successful* update of nothing. This is
    // the silent failure the definer RPC exists to avoid, asserted rather than
    // assumed.
    const { error } = await client.from("profiles").update({ locale: "pl" }).eq("user_id", userId);
    expect(error).toBeNull();
    expect(await storedLocale(userId)).toBeNull();
  });

  it("stamps only the CALLER's row — it takes no target parameter", async () => {
    const employeeId = await userIdOf("employee");
    const adminId = await userIdOf("admin");
    touched.push(adminId);

    const client = await as("admin");
    const { error } = await client.rpc("set_profile_locale", { p_locale: "pl" });
    expect(error).toBeNull();

    expect(await storedLocale(adminId)).toBe("pl");
    expect(await storedLocale(employeeId)).toBeNull();
  });

  it("normalises an unrecognised locale away rather than raising", async () => {
    const client = await as("employee");
    const userId = await userIdOf("employee");

    const { error } = await client.rpc("set_profile_locale", { p_locale: "de" });
    expect(error).toBeNull();
    expect(await storedLocale(userId)).toBeNull();
  });
});

describe("demo account — the stored preference must not carry across visitors", () => {
  let demoId: string | null = null;

  afterEach(async () => {
    if (demoId) {
      await clearStoredLocale(demoId);
      demoId = null;
    }
  });

  it("a demo locale write lands, but a fresh cookie-less demo session still resolves English", async () => {
    const client = await as("demo");
    demoId = await userIdOf("demo");

    // The row really is the demo one — otherwise this whole case proves nothing.
    const { data: row } = await serviceClient()
      .from("profiles")
      .select("is_demo, locale")
      .eq("user_id", demoId)
      .single();
    expect(isDemoFrom(row)).toBe(true);

    // The WRITE is deliberately NOT gated: the demo account behaves exactly like
    // a real one for anyone inspecting it.
    const { error } = await client.rpc("set_profile_locale", { p_locale: "pl" });
    expect(error).toBeNull();
    const stored = await storedLocale(demoId);
    expect(stored).toBe("pl");

    // The READ is where the carve-out lives. A recruiter arriving next has no
    // cookie, so this is exactly what middleware would resolve for them.
    expect(resolveLocale({ cookie: null, profileLocale: stored, isDemo: true })).toBe(DEFAULT_LOCALE);

    // Not vacuous: the same stored value on a NON-demo row does win.
    expect(resolveLocale({ cookie: null, profileLocale: stored, isDemo: false })).toBe("pl");

    // And the demo visitor who actually flipped the switch keeps their choice
    // for the rest of their own session, because the cookie outranks the row.
    expect(resolveLocale({ cookie: "pl", profileLocale: stored, isDemo: true })).toBe("pl");
  });
});

describe("POST /api/locale", () => {
  const touched: string[] = [];

  afterEach(async () => {
    for (const userId of touched.splice(0, touched.length)) {
      await clearStoredLocale(userId);
    }
  });

  it("sets the cookie and 303s back to the page an ANONYMOUS visitor was on", async () => {
    // Deliberately public: the recruiter arriving from a CV link has no session.
    const context = anonContext({
      method: "POST",
      path: "/api/locale",
      formBody: { locale: "pl", redirect: "/fleet?category=cargo_van" },
    });

    const res = await localePOST(context);

    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toBe("/fleet?category=cargo_van");
    expect(context.cookies.get("locale")?.value).toBe("pl");

    const options = cookieOptions(context, "locale");
    expect(options?.path).toBe("/");
    expect(options?.sameSite).toBe("lax");
    expect(options?.httpOnly).toBe(true);
    expect(options?.maxAge).toBe(60 * 60 * 24 * 365);
  });

  it("keeps an /auth/* target intact, query string included", async () => {
    // `safeRedirectPath` would rewrite this to /dashboard and drop the params,
    // stranding someone mid-invite-accept. The sibling guard must not.
    const target = "/auth/reset-password?token_hash=abc&type=invite";
    const context = anonContext({
      method: "POST",
      path: "/api/locale",
      formBody: { locale: "en", redirect: target },
    });

    const res = await localePOST(context);
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toBe(target);
  });

  it("sanitizes an external redirect target to an internal path", async () => {
    for (const hostile of ["https://evil.test", "//evil.test", "/\\evil.test"]) {
      const context = anonContext({
        method: "POST",
        path: "/api/locale",
        formBody: { locale: "pl", redirect: hostile },
      });

      const res = await localePOST(context);
      expect(res.status).toBe(303);
      expect(res.headers.get("location")).toBe("/");
    }
  });

  it("refuses a foreign origin with 403 and writes NO cookie", async () => {
    const context = anonContext({
      method: "POST",
      path: "/api/locale",
      origin: "https://evil.test",
      formBody: { locale: "pl", redirect: "/fleet" },
    });

    const res = await localePOST(context);
    expect(res.status).toBe(403);
    expect(context.cookies.get("locale")).toBeUndefined();
  });

  it("rejects an unknown locale with 400 and writes NO cookie", async () => {
    const context = anonContext({
      method: "POST",
      path: "/api/locale",
      formBody: { locale: "de", redirect: "/fleet" },
    });

    const res = await localePOST(context);
    expect(res.status).toBe(400);
    expect(context.cookies.get("locale")).toBeUndefined();
  });

  it("persists the preference for signed-in staff, not just the cookie", async () => {
    const userId = await userIdOf("employee");
    touched.push(userId);

    const context = await asContext("employee", {
      method: "POST",
      path: "/api/locale",
      formBody: { locale: "pl", redirect: "/dashboard" },
    });

    const res = await localePOST(context);
    expect(res.status).toBe(303);
    expect(context.cookies.get("locale")?.value).toBe("pl");
    // Survives a cleared cookie because it is on the row, not only in the jar.
    expect(await storedLocale(userId)).toBe("pl");
  });
});
