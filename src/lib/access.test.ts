// core
import { describe, expect, it } from "vitest";

// others
import type { AppRole } from "../types";
import { isDemoAccount, isRoleSufficient, resolveRequiredRole } from "./access";

// The access matrix is the most expensive thing in this slice to get wrong:
// a too-loose gate leaks staff surfaces; a too-tight one locks out legitimate
// staff. These tests lock both the route→role resolution (most-specific prefix
// wins) and the `admin ⊇ employee`, fail-closed-on-null precedence.

describe("resolveRequiredRole", () => {
  it("returns null for a public path (no gate)", () => {
    expect(resolveRequiredRole("/")).toBeNull();
    expect(resolveRequiredRole("/auth/signin")).toBeNull();
  });

  it("resolves the employee area to 'employee'", () => {
    expect(resolveRequiredRole("/dashboard")).toBe("employee");
  });

  it("resolves the returns worklist to 'employee' (S-06)", () => {
    expect(resolveRequiredRole("/dashboard/returns")).toBe("employee");
  });

  it("inherits the prefix role on a deep sub-path", () => {
    expect(resolveRequiredRole("/dashboard/anything/deep")).toBe("employee");
  });

  it("most-specific prefix wins: admin sub-path under an employee prefix → admin", () => {
    expect(resolveRequiredRole("/dashboard/staff")).toBe("admin");
    expect(resolveRequiredRole("/dashboard/staff/new")).toBe("admin");
  });

  it("matches only on a path boundary (no false prefix match)", () => {
    expect(resolveRequiredRole("/dashboardx")).toBeNull();
  });
});

// (role, required) → expected sufficiency. Locks the superset relationship and
// the fail-closed null rule in one table.
const sufficiency: { role: AppRole | null; required: AppRole; ok: boolean }[] = [
  { role: "employee", required: "employee", ok: true },
  { role: "admin", required: "employee", ok: true }, // admin ⊇ employee
  { role: "admin", required: "admin", ok: true },
  { role: "employee", required: "admin", ok: false }, // employee ⊉ admin
  { role: null, required: "employee", ok: false }, // fail-closed
  { role: null, required: "admin", ok: false }, // fail-closed
];

describe("isRoleSufficient", () => {
  it.each(sufficiency)("role=$role vs required=$required → $ok", ({ role, required, ok }) => {
    expect(isRoleSufficient(role, required)).toBe(ok);
  });
});

// `isDemoAccount` is the demo gate's only decision point. It must be
// fail-closed (absent flag → not demo) and must NOT be entangled with `role`:
// the flag denies three mutations, it grants nothing, so reading it through a
// role check would be the wrong shape even though only a demo admin is seeded.

// `cfContext` is a required member of App.Locals only because the Cloudflare
// adapter augments the interface with the Worker's ExecutionContext. It carries
// no access information, so it is stubbed rather than modelled. Left
// un-annotated on purpose: `ExecutionContext` is an ambient Workers global with
// no type available here, so naming it would push an error-typed value through
// the helper.
const cfContextStub = {
  waitUntil: () => undefined,
  passThroughOnException: () => undefined,
};

function localsWith(overrides: Partial<App.Locals>): App.Locals {
  return { user: null, role: null, isDemo: false, supabase: null, cfContext: cfContextStub, ...overrides };
}

describe("isDemoAccount", () => {
  it("is true for a flagged account", () => {
    expect(isDemoAccount(localsWith({ isDemo: true, role: "admin" }))).toBe(true);
  });

  it("is false for an unflagged account", () => {
    expect(isDemoAccount(localsWith({ isDemo: false, role: "admin" }))).toBe(false);
  });

  it("is false for an unauthenticated, profile-less caller (fail-closed default)", () => {
    expect(isDemoAccount(localsWith({}))).toBe(false);
  });

  it("is independent of role — a demo employee is still demo", () => {
    expect(isDemoAccount(localsWith({ isDemo: true, role: "employee" }))).toBe(true);
    expect(isDemoAccount(localsWith({ isDemo: true, role: null }))).toBe(true);
    expect(isDemoAccount(localsWith({ isDemo: false, role: "employee" }))).toBe(false);
  });
});
