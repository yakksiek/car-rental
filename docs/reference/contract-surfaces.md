# Contract Surfaces

Load-bearing names other slices depend on. **Do not rename or change the shape**
of anything listed here without updating every consumer. Each entry is a name,
where it lives, and who consumes it.

## Role / access layer (F-02 — `employee-admin-roles`)

| Name                                                                         | Location                                                                     | Consumed by                                        |
| ---------------------------------------------------------------------------- | ---------------------------------------------------------------------------- | -------------------------------------------------- |
| `app_role` enum (`'employee' \| 'admin'`)                                    | `supabase/migrations/*_employee_admin_roles.sql`, `src/db/database.types.ts` | S-03…S-08                                          |
| `profiles` table (`user_id → role`)                                          | `supabase/migrations/*_employee_admin_roles.sql`                             | S-08 (staff mgmt), middleware                      |
| `current_app_role()` SQL fn (`SECURITY DEFINER`, recursion-safe role reader) | `supabase/migrations/*_employee_admin_roles.sql`                             | RLS policies, S-08                                 |
| `App.Locals.role` (`AppRole \| null`)                                        | `src/env.d.ts`, populated in `src/middleware.ts`                             | every server page / API route                      |
| `ROUTE_ROLES` (route→min-role registry)                                      | `src/lib/access.ts`                                                          | S-03…S-08 register protected routes here           |
| `resolveRequiredRole(pathname)`                                              | `src/lib/access.ts`                                                          | `src/middleware.ts`                                |
| `isRoleSufficient(userRole, required)`                                       | `src/lib/access.ts`                                                          | `src/middleware.ts`, `requireRole`                 |
| `requireRole(locals, min)`                                                   | `src/lib/access.ts`                                                          | in-handler guards (e.g. S-08 admin-only mutations) |
| `AppRole`, `Profile`, `ProfileInsert` type aliases                           | `src/types.ts`                                                               | app code consuming the role contract               |

## Public catalog layer (S-01 — `public-fleet-catalog`)

| Name                                                                                        | Location                                                                     | Consumed by                                       |
| ------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- | ------------------------------------------------- |
| `App.Locals.supabase` (`SupabaseClient<Database> \| null`)                                  | `src/env.d.ts`, populated in `src/middleware.ts`                             | catalog services (S-01), S-02+ reservation funnel |
| `available_vehicles(date, date)` RPC (`SECURITY DEFINER`, PII-safe date-range availability) | `supabase/migrations/*_public_fleet_catalog.sql`, `src/db/database.types.ts` | `searchAvailableVehicles` (S-01), S-02            |
| `listVehicles` / `searchAvailableVehicles` / `getVehicleById`                               | `src/lib/services/vehicles.ts`                                               | catalog pages (S-01), S-02                        |
| `VehicleFilters`, `CatalogSort` type aliases                                                | `src/types.ts`                                                               | catalog filter UI + services                      |
| `parseFilters` / `serializeFilters` / `validateDateRange`                                   | `src/lib/catalog-filters.ts`                                                 | fleet listing page + filter island                |

## Employee account management (S-08 — `employee-account-management`)

| Name                                                                                              | Location                                                                            | Consumed by                                |
| ------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- | ------------------------------------------ |
| `profiles.full_name` / `profiles.deactivated_at` columns                                          | `supabase/migrations/*_employee_account_management.sql`, `src/db/database.types.ts` | staff roster, middleware deactivation gate |
| `list_staff()` RPC (`SECURITY DEFINER`, admin-gated roster read)                                  | `supabase/migrations/*_employee_account_management.sql`                             | `listStaff`, staff page                    |
| `deactivate_staff(uuid)` RPC (`SECURITY DEFINER`, self / last-admin guards)                       | `supabase/migrations/*_employee_account_management.sql`                             | `deactivateStaff`, deactivate route        |
| `createAdminClient()` (RLS-bypassing service-role client, server-only)                            | `src/lib/supabase.ts`                                                               | `/api/staff*` routes only                  |
| `SUPABASE_SERVICE_ROLE_KEY` env (server secret, optional)                                         | `astro.config.mjs` `env.schema`, `.dev.vars`                                        | `createAdminClient()`                      |
| `listStaff` / `createEmployee` / `deactivateStaff` / `resetStaffPassword` / `getStaffEmail`       | `src/lib/services/staff.ts`                                                         | `/api/staff*` routes, staff page           |
| `StaffMember`, `CreateEmployeeResult`, `DeactivateResult`, `employeeInviteSchema`                 | `src/lib/services/staff.ts`                                                         | staff API routes + `StaffList` island      |
| `POST /api/staff`, `POST /api/staff/[id]/deactivate`, `POST /api/staff/[id]/reset-password`       | `src/pages/api/staff*`                                                              | `StaffList` island                         |
| `/auth/callback`, `/auth/forgot-password`, `/auth/reset-password` (PKCE recovery + invite-accept) | `src/pages/auth/*`, `src/pages/api/auth/*`                                          | self-service reset, invite-accept          |

> **Prod rollout (ops, not code):** `wrangler secret put SUPABASE_SERVICE_ROLE_KEY`;
> configure the Supabase project's SMTP (built-in auth email is rate-limited); add
> the prod app origin to Supabase `additional_redirect_urls`. See
> `context/changes/employee-admin-roles/runbook-first-admin.md`.
