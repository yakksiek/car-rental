// others
import type { AppRole } from "../types";

// ---------------------------------------------------------------------------
// Access boundary (F-02) — the pure, I/O-free core of role gating.
//
// This module is the single place future slices (S-03…S-08) register which
// routes require which role. It performs NO auth: middleware reads the user's
// role from the DB and feeds it here; these functions only decide *which role
// a path needs* and *whether a role satisfies a requirement*. Keeping them pure
// is what makes the access matrix unit-testable in isolation.
// ---------------------------------------------------------------------------

// Role ranking encodes the PRD's `admin ⊇ employee` superset relationship:
// admin can do everything an employee can, plus staff management. A higher rank
// satisfies any requirement at or below it. `null` (no profile) ranks below
// everything and never satisfies a gate — this is the fail-closed default.
const ROLE_RANK: Record<AppRole, number> = {
  employee: 1,
  admin: 2,
};

// Minimum role per protected path prefix. Order is irrelevant — resolution
// always picks the *longest* (most-specific) matching prefix, so an admin-only
// sub-path under an employee prefix resolves to `admin`. Register new protected
// routes HERE; everything not listed is public.
export const ROUTE_ROLES: { prefix: string; role: AppRole }[] = [
  // Staff management (S-08) — admin only. Most-specific, must precede /dashboard
  // in specificity (it does: longer prefix wins regardless of array order).
  { prefix: "/dashboard/staff", role: "admin" },
  // Pending-request queue (S-03) — employee. The /dashboard rule already covers
  // it; this explicit entry documents intent.
  { prefix: "/dashboard/reservations", role: "employee" },
  // Authenticated staff area — any role with a profile.
  { prefix: "/dashboard", role: "employee" },
];

// A path matches a prefix only on a path boundary: `/dashboard` matches
// `/dashboard` and `/dashboard/x`, never `/dashboardx`.
function matchesPrefix(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(prefix + "/");
}

// Minimum role required to access `pathname`, or `null` if the path is public.
// Longest matching prefix wins, so the most-specific rule governs.
export function resolveRequiredRole(pathname: string): AppRole | null {
  let bestPrefixLen = -1;
  let required: AppRole | null = null;
  for (const { prefix, role } of ROUTE_ROLES) {
    if (matchesPrefix(pathname, prefix) && prefix.length > bestPrefixLen) {
      bestPrefixLen = prefix.length;
      required = role;
    }
  }
  return required;
}

// Does `userRole` satisfy a `required` role? Encodes `admin ⊇ employee` and the
// fail-closed rule: a `null` role never suffices.
export function isRoleSufficient(userRole: AppRole | null, required: AppRole): boolean {
  if (userRole === null) {
    return false;
  }
  return ROLE_RANK[userRole] >= ROLE_RANK[required];
}

// In-handler guard for pages/API routes needing a check beyond the middleware
// map (e.g. S-08's admin-only mutations). The decision is delegated to the pure
// core above; this only adapts it to `App.Locals`.
export function requireRole(locals: App.Locals, min: AppRole): boolean {
  return isRoleSufficient(locals.role, min);
}
