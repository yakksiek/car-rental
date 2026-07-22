// core
import { describe, expect, it } from "vitest";

// others
import type { AppRole } from "../types";
import { isRoleSufficient, resolveRequiredRole } from "./access";

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
