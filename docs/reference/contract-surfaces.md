# Contract Surfaces

Load-bearing names other slices depend on. **Do not rename or change the shape**
of anything listed here without updating every consumer. Each entry is a name,
where it lives, and who consumes it.

## Role / access layer (F-02 — `employee-admin-roles`)

| Name | Location | Consumed by |
| --- | --- | --- |
| `app_role` enum (`'employee' \| 'admin'`) | `supabase/migrations/*_employee_admin_roles.sql`, `src/db/database.types.ts` | S-03…S-08 |
| `profiles` table (`user_id → role`) | `supabase/migrations/*_employee_admin_roles.sql` | S-08 (staff mgmt), middleware |
| `current_app_role()` SQL fn (`SECURITY DEFINER`, recursion-safe role reader) | `supabase/migrations/*_employee_admin_roles.sql` | RLS policies, S-08 |
| `App.Locals.role` (`AppRole \| null`) | `src/env.d.ts`, populated in `src/middleware.ts` | every server page / API route |
| `ROUTE_ROLES` (route→min-role registry) | `src/lib/access.ts` | S-03…S-08 register protected routes here |
| `resolveRequiredRole(pathname)` | `src/lib/access.ts` | `src/middleware.ts` |
| `isRoleSufficient(userRole, required)` | `src/lib/access.ts` | `src/middleware.ts`, `requireRole` |
| `requireRole(locals, min)` | `src/lib/access.ts` | in-handler guards (e.g. S-08 admin-only mutations) |
| `AppRole`, `Profile`, `ProfileInsert` type aliases | `src/types.ts` | app code consuming the role contract |
