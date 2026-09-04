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

| Name                                                                                          | Location                                                                     | Consumed by                                       |
| --------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- | ------------------------------------------------- |
| `App.Locals.supabase` (`SupabaseClient<Database> \| null`)                                    | `src/env.d.ts`, populated in `src/middleware.ts`                             | catalog services (S-01), S-02+ reservation funnel |
| `available_vehicles(date, date)` RPC (`SECURITY DEFINER`, PII-safe date-range availability)   | `supabase/migrations/*_public_fleet_catalog.sql`, `src/db/database.types.ts` | `searchAvailableVehicles` (S-01), S-02            |
| `listVehicles` / `searchAvailableVehicles` / `getVehicleById`                                 | `src/lib/services/vehicles.ts`                                               | catalog pages (S-01), S-02                        |
| `VehicleFilters`, `CatalogSort` type aliases                                                  | `src/types.ts`                                                               | catalog filter UI + services                      |
| `parseFilters` / `serializeFilters` / `validateDateRange(pickup, returnDate, locale, today?)` | `src/lib/catalog-filters.ts`                                                 | fleet listing page + filter island                |

## Employee account management (S-08 — `employee-account-management`)

| Name                                                                                                                                                                                                                                                                                                                                                                             | Location                                                                                                         | Consumed by                                                               |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| `profiles.full_name` / `profiles.deactivated_at` / `profiles.password_set_at` columns                                                                                                                                                                                                                                                                                            | `supabase/migrations/*_employee_account_management.sql`, `*_password_set_signal.sql`, `src/db/database.types.ts` | staff roster, middleware deactivation gate, `deriveStaffStatus`           |
| `list_staff()` RPC (`SECURITY DEFINER`, admin-gated roster read; OUT columns include `password_set_at` since `*_password_set_signal.sql`)                                                                                                                                                                                                                                        | `supabase/migrations/*_employee_account_management.sql`, `*_password_set_signal.sql`                             | `listStaff`, staff page                                                   |
| `mark_password_set()` RPC (`SECURITY DEFINER`, no parameters — stamps `auth.uid()`'s own row only)                                                                                                                                                                                                                                                                               | `supabase/migrations/*_password_set_signal.sql`                                                                  | `POST /api/auth/reset-password`, `POST /api/auth/change-password`         |
| `deactivate_staff(uuid)` RPC (`SECURITY DEFINER`, self / last-admin guards)                                                                                                                                                                                                                                                                                                      | `supabase/migrations/*_employee_account_management.sql`                                                          | `deactivateStaff`, deactivate route                                       |
| `createAdminClient()` (RLS-bypassing service-role client, server-only)                                                                                                                                                                                                                                                                                                           | `src/lib/supabase.ts`                                                                                            | `/api/staff*` routes only                                                 |
| `SUPABASE_SERVICE_ROLE_KEY` env (server secret, optional)                                                                                                                                                                                                                                                                                                                        | `astro.config.mjs` `env.schema`, `.dev.vars`                                                                     | `createAdminClient()`                                                     |
| `listStaff` / `createEmployee` (creates SILENTLY — sends no mail) / `inviteEmployee` (the separate send) / `deactivateStaff` / `resetStaffPassword` / `getStaffEmail`                                                                                                                                                                                                            | `src/lib/services/staff.ts`                                                                                      | `/api/staff*` routes, staff page                                          |
| `StaffMember`, `CreateEmployeeResult` (arms: `created` / `reactivated` (carries the activation-mail outcome) / `duplicate_active` / `provision_rolled_back` / `provision_orphaned` / `unauthorized`), `InviteEmployeeResult` (arms: `sent` (carries `invitedAt`) / `failed` / `has_password` / `not_found` / `unauthorized`), `DeactivateResult`, `employeeInviteSchema(locale)` | `src/lib/services/staff.ts`                                                                                      | staff API routes + `StaffList` island                                     |
| `StaffStatus` union — **three** states: `active` \| `invited` \| `created`; `deriveStaffStatus(passwordSetAt, invitedAt)` and `LastActiveInput.status` follow it                                                                                                                                                                                                                 | `src/lib/staff-status.ts`, `src/lib/staff-format.ts`                                                             | `listStaff`, `StaffList` island badges + filter tabs                      |
| `POST /api/staff`, `POST /api/staff/[id]/invite`, `POST /api/staff/[id]/deactivate`, `POST /api/staff/[id]/reset-password`                                                                                                                                                                                                                                                       | `src/pages/api/staff*`                                                                                           | `StaffList` island                                                        |
| `/auth/callback`, `/auth/forgot-password`, `/auth/reset-password` (deferred exchange: the callback GET resolves + stamps a pending-token cookie; the set-password POST spends it)                                                                                                                                                                                                | `src/pages/auth/*`, `src/pages/api/auth/*`                                                                       | self-service reset, invite-accept                                         |
| `resolve_link_token(text, text)` RPC (`SECURITY DEFINER`, **intentionally anon-callable**, lookup-only — never spends the token)                                                                                                                                                                                                                                                 | `supabase/migrations/*_resolve_link_token.sql`                                                                   | `/auth/callback`, `/auth/reset-password` page + POST                      |
| `LINK_ORIGIN_COOKIE` payload `<type>.<token_hash>`; `readPendingToken` / `serializePendingToken` / `selectResetPasswordBranch`                                                                                                                                                                                                                                                   | `src/lib/auth-session.ts`                                                                                        | `/auth/callback`, `/auth/reset-password` page + POST, `/api/auth/signout` |

> **Prod rollout (ops, not code):** `wrangler secret put SUPABASE_SERVICE_ROLE_KEY`;
> configure the Supabase project's SMTP (built-in auth email is rate-limited); add
> the prod app origin to Supabase `additional_redirect_urls`. See
> `context/changes/employee-admin-roles/runbook-first-admin.md`.

## Locale seam (`english-localization`)

The app is bilingual (`en` default, `pl` opt-in). Two things make that a contract
rather than a detail: **which accessor a module is allowed to use**, and **which
exports gained a `locale` parameter**.

### The accessor boundary — the rule a bundler enforces silently

| Name                                                   | Location                                         | Consumed by                                                       |
| ------------------------------------------------------ | ------------------------------------------------ | ----------------------------------------------------------------- |
| `Locale` (`'en' \| 'pl'`), `LOCALES`, `DEFAULT_LOCALE` | `src/lib/i18n/types.ts`                          | everything                                                        |
| `defineDict` / `Dict<T>` (parity constraint)           | `src/lib/i18n/types.ts`                          | every `src/lib/i18n/<domain>.ts` namespace                        |
| `translator(locale, namespace)`                        | `src/lib/i18n/types.ts`                          | **React islands and any `src/lib` module an island imports**      |
| `useTranslations(locale)` → `t("ns.key")`              | `src/lib/i18n/index.ts`                          | **`.astro` components only** (via `Astro.locals.t`) — SERVER-ONLY |
| `App.Locals.locale` / `App.Locals.t`                   | `src/env.d.ts`, populated in `src/middleware.ts` | every server page                                                 |

`index.ts` imports every namespace, so anything reaching it pulls the whole
catalog — both locales, every domain. That is free for `.astro` (no JS ships) and
is not free for an island. A breach is invisible to types, lint and tests; the
gate is the per-chunk comparison in `context/changes/english-localization/island-baseline.md`.

The narrower half of the rule, which the accessor names do NOT express: **an
island imports the SMALLEST namespace that covers it.** Obeying the boundary
while importing a namespace full of copy the island never renders ships a
locale's worth of prose to a browser anyway (measured once, in Phase 4).

### Exports that gained a `locale` parameter

| Export                                                                                                                                                  | New signature                                                                                                                          |
| ------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| `validateDateRange`                                                                                                                                     | `(pickup, returnDate, locale, today?)` — `locale` sits BEFORE the injectable `today`                                                   |
| `vehicleInputSchema` / `reservationRequestSchema` / `manualReservationSchema` / `protocolInputSchema` / `returnProtocolSchema` / `employeeInviteSchema` | were schema VALUES, now `(locale) => schema` — zod bakes messages in at construction, so one schema is built per locale at module load |
| `stepperFor`                                                                                                                                            | `(status, locale)`                                                                                                                     |
| `resolveBackTarget`                                                                                                                                     | `(raw, fallback, locale)`                                                                                                              |
| `resolveAvailability`                                                                                                                                   | `(vehicleId, pickup, returnDate, ranges, rangesState, locale)`                                                                         |
| `formatLastActive`                                                                                                                                      | `(member, nowMs, locale, opts?)`                                                                                                       |
| `overdueDaysLabel`                                                                                                                                      | `(row, today, locale)` (since Phase 2)                                                                                                 |
| `deliveryBadge`                                                                                                                                         | `(pdfPath, deliveryStatus, locale)`                                                                                                    |
| `AVAILABILITY_COPY` (const) → `availabilityCopy(locale)`                                                                                                | the panel and the picker still resolve ONE pair of keys, so they cannot drift                                                          |

**Unchanged, despite reading like they would change**: `listVehicles` /
`searchAvailableVehicles` / `getVehicleById` return raw rows and format nothing
(`getCategoryPricing` already took a locale); `readPendingToken` /
`serializePendingToken` / `selectResetPasswordBranch` carry no copy at all. Both
modules were on the plan's watch list and are recorded here so the next reader
does not go looking for a parameter that was never needed.
