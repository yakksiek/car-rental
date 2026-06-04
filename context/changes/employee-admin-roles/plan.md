# Employee/Admin Role Model (F-02) Implementation Plan

## Overview

Add an `employee`/`admin` role layer on top of the already-wired Supabase email/password auth, so every authenticated slice (S-03 through S-08) can gate behavior by role without re-implementing access checks. The role lives in a new `public.profiles` table, is read once per request into `Astro.locals.role`, and is enforced through a centralized route→role map in middleware (`admin ⊇ employee`, fail-closed). Because v1 has **no customer accounts** (PRD §Access Control — every account is staff), public self-service signup is closed; roles are admin-assigned (S-08), with a deterministic dev seed and a documented production first-admin runbook. This slice ships no user-facing feature — it is the access foundation the employee/admin slices consume.

## Current State Analysis

- **Auth is wired but role-less.** `src/lib/supabase.ts:5` creates the SSR client (returns `null` without env). `src/middleware.ts:6-13` resolves `context.locals.user` from `supabase.auth.getUser()`, and `PROTECTED_ROUTES = ["/dashboard"]` (`middleware.ts:4`) gates only on *authenticated*, not role. `App.Locals` (`src/env.d.ts`) exposes only `user`.
- **No role storage exists.** There is no `public` profiles/roles table — only Supabase-managed `auth.users`. The F-01 migration (`supabase/migrations/20260603155136_booking_integrity_data.sql:153-154`) ends with RLS gating on `authenticated` and an explicit comment inviting F-02 to refine.
- **Public signup is ON.** `supabase/config.toml` `enable_signup = true`; `src/pages/api/auth/signup.ts` calls `supabase.auth.signUp()` unconditionally. With no customer accounts in v1, an open signup is a standing surface with no product purpose and a PII-leak risk (the #2 guardrail).
- **No service-role key.** `astro.config.mjs` env schema declares only `SUPABASE_URL` / `SUPABASE_KEY` (public). Admin *user creation* is S-08 — not this slice.
- **PRD §Access Control (lines 139-147):** two roles — **employee** (all fleet/reservation/protocol ops) and **admin** (everything an employee can do **plus** staff management). Admin is a strict superset of employee. One role per user.
- **Precedent from F-01:** migration + generated `src/db/database.types.ts` + hand-written aliases in `src/types.ts` + Vitest for pure logic (`src/lib/availability.ts` + `.test.ts`), seeded via `supabase/seed.sql` on `supabase db reset`. This slice mirrors that shape.
- **No `docs/reference/contract-surfaces.md` yet.** CLAUDE.md names it as the load-bearing-names registry; it does not exist. This slice creates it (the role contract is exactly the kind of name later slices must not rename).

## Desired End State

After this plan:

- A `public.profiles` table maps `auth.users.id → app_role` with RLS (a user reads their own row; an admin reads/writes all). A `SECURITY DEFINER` helper `public.current_app_role()` returns the caller's role for use in policies.
- `supabase db reset` brings up a role-complete system: a seeded **admin** and **employee** (deterministic dev credentials) can sign in.
- `Astro.locals.role` is typed `'employee' | 'admin' | null` and populated on every request from the signed-in user's profile.
- Middleware enforces a declarative route→role map: role-gated routes redirect unauthenticated *or* under-privileged users; `admin` satisfies any `employee`-gated route; an authenticated user with **no** role is denied (fail-closed).
- Consuming slices have a stable contract: `locals.role` plus a `requireRole(locals, min)` helper, both recorded in `docs/reference/contract-surfaces.md`.
- Public self-service signup is disabled (config + the signup route refuses); the production first-admin procedure is documented in a runbook.
- A Vitest suite exercises the pure gating logic (route→required-role resolution + `admin ⊇ employee` precedence + null-role deny).

**Verification:** `supabase db reset` exits 0 and the two seeded accounts exist with roles; `npm test` green (gating suite); `npx astro check` and `npm run lint` clean; signing in as the seeded **employee** is denied an admin-only route and allowed an employee route; signing in as **admin** is allowed both; a role-less authenticated session is denied; `POST /api/auth/signup` no longer creates an account.

### Key Discoveries:

- **Profile must be auto-created, role must not.** `auth.users` rows are created outside our control (dashboard, future S-08 admin API). A row in `auth.users` with **no** `profiles` row must resolve to `role = null` and be denied — never auto-granted (that would reopen the self-grant hole). So: do **not** auto-insert a privileged profile on user creation. Either leave profile creation to the role-granting step, or auto-create a profile with no privileged default — this plan creates the profile **at grant time** (seed / S-08 / the documented prod step), keeping "no profile ⇒ no access" as the safe default. `middleware` treats a missing profile as `role = null`.
- **RLS recursion trap on `profiles`.** A `profiles` policy that checks "is the caller an admin?" by selecting from `profiles` inside its own `USING` clause recurses infinitely. Resolution: read the role through a `SECURITY DEFINER` function (`current_app_role()`) that bypasses RLS, so the admin-check policy does not re-trigger `profiles` RLS. This is the load-bearing reason the helper function exists (not just ergonomics).
- **Disabling signup is config + route, not just config.** `enable_signup = false` in `config.toml` stops Supabase's GoTrue from accepting signups, but the app's `src/pages/api/auth/signup.ts` should also refuse (defense-in-depth + correct UX) rather than surface a raw GoTrue error. The signup UI page is made inert (remove/hide the entry point).
- **Seeding `auth.users` needs the `crypt()` password pattern.** Local seed can insert into `auth.users` with `encrypted_password = crypt('<pw>', gen_salt('bf'))` (pgcrypto, available in Supabase). This is the documented dev-seed approach; credentials are dev-only and must never be reused in production.
- **Role read is per-request and cheap.** Single-tenant, v1 scale — one indexed lookup by `auth.uid()` per authenticated request. No JWT hook / token-refresh complexity, and role changes take effect immediately.
- **`getUser()` already runs in middleware.** The role read piggybacks on the existing authenticated request; no extra round-trip to Supabase auth, just one DB select.

## What We're NOT Doing

- **No employee/account management UI or admin user-creation flow** — that is S-08. This slice models roles and ships the dev seed + a documented manual prod bootstrap, not a UI.
- **No service-role key wiring** — deferred to S-08 (admin-creates-users). Not needed for read-per-request role resolution.
- **No refinement of `vehicles` / `reservations` RLS** — both roles have identical data access in v1, so per-role DB gating there has no behavioral effect. The only role-aware data boundary (employee management) lands in S-08. App/middleware is the enforcement point, per the roadmap.
- **No JWT custom-claims / auth-hook** — explicitly chosen against in favor of the profiles-table read (lower rework risk, immediate role changes).
- **No multi-role / per-vehicle assignment** — one role per user; employee has fleet-wide access (PRD).
- **No password-reset / self-service account flows** — S-08 (`employees self-reset password`).
- **No new protected feature pages** (fleet, approvals, etc.) — those arrive with their owning slices; this slice only provides the gate they plug into. `/dashboard` is updated minimally to prove role resolution.
- **No automated production bootstrap** — production first-admin is a documented one-time operator action, by decision.

## Implementation Approach

Three phases, mirroring F-01's schema → logic → seed rhythm. Phase 1 lays the DB contract (enum, table, helper fn, RLS) and regenerates types — the durable surface. Phase 2 wires role propagation and centralized gating, with the access decision extracted into a pure, unit-tested function (the `admin ⊇ employee` precedence and fail-closed deny are the thing most expensive to get wrong, so they are tested in isolation). Phase 3 closes the auth posture: disable public signup, seed staff for dev, and document the production first-admin runbook.

## Critical Implementation Details

- **State sequencing.** `app_role` enum and `profiles` table and `current_app_role()` must exist before the `profiles` RLS policies reference the function; types must be regenerated **after** `supabase db reset`. The seed (Phase 3) depends on the table existing (Phase 1).
- **Fail-closed gate.** The middleware decision is: resolve required role for the path → if none required, continue → if required and `locals.role` is `null` *or* insufficient, redirect. There is no path where an unresolved role falls through to access. `admin` always satisfies an `employee` requirement; the reverse never holds.
- **RLS via `SECURITY DEFINER` only.** Every "is the caller an admin?" check in a `profiles` policy goes through `current_app_role()`, never an inline self-select, to avoid infinite RLS recursion.

## Phase 1: Role Schema & RLS

### Overview

Create the role enum, the `profiles` table, the `SECURITY DEFINER` role-reader function, the table's RLS policies, and the `updated_at` trigger in one migration. Regenerate the `Database` type and add hand-written aliases.

### Changes Required:

#### 1. Role schema migration

**File**: `supabase/migrations/<YYYYMMDDHHmmss>_employee_admin_roles.sql`

**Intent**: Define the role enum, the profile→role table, the recursion-safe role reader, and the RLS posture (a user sees only their own role; an admin manages all profiles). Establishes "no profile ⇒ no access" as the safe default.

**Contract**:
- `create type app_role as enum ('employee', 'admin');`
- `profiles` columns: `user_id uuid primary key references auth.users(id) on delete cascade`, `role app_role not null`, `created_at timestamptz not null default now()`, `updated_at timestamptz not null default now()`. (No `email`/`name` here — those live in `auth.users` / arrive with S-08.)
- `current_app_role()` — `SECURITY DEFINER`, `set search_path = ''`, returns `app_role`; body selects `role from public.profiles where user_id = auth.uid()` (returns `null` when absent). This is the recursion-safe reader used by policies and re-usable later.
- Reuse the existing `set_updated_at()` trigger function (from F-01's migration) with a `before update` trigger on `profiles`.
- RLS: `alter table profiles enable row level security`, then per-operation policies:
  - SELECT: a caller reads their own row (`user_id = auth.uid()`) **or** any row when `current_app_role() = 'admin'`.
  - INSERT / UPDATE / DELETE: `to authenticated` with `using` / `with check` requiring `current_app_role() = 'admin'` (admin manages staff; the dev seed and prod bootstrap write as the table owner / service context, bypassing RLS).

A snippet is warranted only for the recursion-safe helper (the one non-obvious piece):
```sql
create function public.current_app_role()
returns app_role
language sql
stable
security definer
set search_path = ''
as $$
  select role from public.profiles where user_id = auth.uid();
$$;
```

#### 2. Regenerated database types

**File**: `src/db/database.types.ts`

**Intent**: Reflect the new `profiles` table, `app_role` enum, and `current_app_role` function in the typed `Database` contract.

**Contract**: Output of `supabase gen types typescript --local > src/db/database.types.ts` after the migration applies. Generated — do not hand-edit.

#### 3. Entity/DTO aliases

**File**: `src/types.ts`

**Intent**: Give app code ergonomic, stable names for the role contract.

**Contract**: Add `export type Profile = Database["public"]["Tables"]["profiles"]["Row"];`, `ProfileInsert` likewise, and `export type AppRole = Database["public"]["Enums"]["app_role"];`. Follow the existing import-group convention in the file.

### Success Criteria:

#### Automated Verification:

- Migration applies cleanly: `supabase db reset`
- Types generate without error: `supabase gen types typescript --local > src/db/database.types.ts`
- Type checking passes: `npx astro check`
- Linting passes: `npm run lint`

#### Manual Verification:

- In Supabase Studio / `psql`: `profiles` exists with RLS enabled and the four per-operation policies; `app_role` enum and `current_app_role()` exist.
- A non-admin authenticated session can `select` only its own `profiles` row; an admin session can read all (verified after Phase 3 seed, or via a temporary manual row).
- A self-select inside a policy is **not** used anywhere (no RLS recursion error on `select * from profiles`).

**Implementation Note**: After this phase and all automated verification passes, pause for manual confirmation before proceeding to Phase 2.

---

## Phase 2: Role Propagation, Middleware Gating & Access Contract

### Overview

Read the signed-in user's role into `locals.role`, type it, and replace the flat `PROTECTED_ROUTES` check with a declarative route→role map enforced fail-closed. Extract the access decision into a pure, unit-tested module and ship the `requireRole()` helper. Surface the role on the dashboard and register the load-bearing names.

### Changes Required:

#### 1. App.Locals type

**File**: `src/env.d.ts`

**Intent**: Make the role a typed, first-class request value alongside `user`.

**Contract**: Add `role: import("./types").AppRole | null;` to `App.Locals` (or import the alias per the file's style). `null` means authenticated-but-no-role *and* unauthenticated.

#### 2. Pure access-decision module

**File**: `src/lib/access.ts` (new)

**Intent**: Centralize *which routes need which role* and *whether a role satisfies a requirement*, as pure functions with no I/O — the unit-testable core of the access boundary.

**Contract**:
- `ROUTE_ROLES`: an ordered list/map of `{ prefix, role: AppRole }` declaring the minimum role per protected path prefix (e.g. `/dashboard` → `employee`; admin-only prefixes → `admin`). Documented as the single place future slices register protected routes.
- `resolveRequiredRole(pathname: string): AppRole | null` — returns the minimum role for the path, or `null` if the path is public. (Longest/most-specific prefix wins so an `admin` sub-path under an `employee` prefix resolves correctly.)
- `isRoleSufficient(userRole: AppRole | null, required: AppRole): boolean` — encodes `admin ⊇ employee` and `null ⇒ never sufficient` (fail-closed).
- No Astro/Supabase imports — pure TS.

#### 3. Role-aware middleware

**File**: `src/middleware.ts`

**Intent**: Populate `locals.role` from the user's profile and enforce the route→role map fail-closed, replacing the authenticated-only `PROTECTED_ROUTES` gate.

**Contract**: After resolving `locals.user`, when a user exists, read their role via the Supabase client (`select role from profiles where user_id = <user.id>`, or call the `current_app_role` RPC) and set `locals.role`; else `null`. Then: `const required = resolveRequiredRole(url.pathname)`; if `required` and (`!user` or `!isRoleSufficient(locals.role, required)`) → `redirect("/auth/signin")` (unauthenticated) or a denied response/redirect (authenticated but insufficient). Remove the old `PROTECTED_ROUTES` constant. Keep the `supabase === null` (unconfigured) path setting both `user` and `role` to `null`.

#### 4. requireRole helper

**File**: `src/lib/access.ts` (same module) or `src/lib/auth.ts`

**Intent**: Give pages/API routes an explicit in-handler guard for checks beyond the middleware map (e.g. S-08's admin-only mutations).

**Contract**: `requireRole(locals: App.Locals, min: AppRole): boolean` (or a throwing/`Response`-returning variant) built on `isRoleSufficient(locals.role, min)`. Pure decision delegated to `access.ts`; the helper just adapts it to `locals`.

#### 5. Pure-logic unit tests

**Files**: `src/lib/access.test.ts` (new)

**Intent**: Lock the access boundary — the most expensive thing to get wrong — with fast deterministic tests.

**Contract**: Cases — public path → `null` required (allowed); employee path with `employee` role → allowed, with `admin` → allowed, with `null` → denied; admin path with `employee` → denied, with `admin` → allowed; most-specific-prefix precedence (admin sub-path under an employee prefix resolves to `admin`); unknown/deep path inherits its prefix's role. Reuses the existing Vitest config from F-01 (no new runner setup).

#### 6. Dashboard role surface

**File**: `src/pages/dashboard.astro`

**Intent**: Prove role resolution end-to-end with a minimal, real consumer (no new feature).

**Contract**: Read `Astro.locals.role` and display it alongside the email. No styling beyond the existing card.

#### 7. Contract-surfaces registry

**File**: `docs/reference/contract-surfaces.md` (new)

**Intent**: Record the load-bearing names this slice introduces so later slices don't rename them.

**Contract**: Create the registry (if absent) and list: `app_role` enum, `profiles` table + `current_app_role()` fn, `App.Locals.role`, `requireRole()`, `ROUTE_ROLES` / `resolveRequiredRole` / `isRoleSufficient`. One line each with file path and "consumed by S-03…S-08".

### Success Criteria:

#### Automated Verification:

- Gating unit tests pass: `npm test`
- Type checking passes: `npx astro check`
- Linting passes: `npm run lint`

#### Manual Verification:

- Signed in as the seeded **employee** (after Phase 3): allowed `/dashboard`, denied an admin-only test route.
- Signed in as **admin**: allowed both.
- A role-less authenticated session is denied every gated route (fail-closed).
- Unauthenticated access to a gated route still redirects to `/auth/signin`.
- `/dashboard` shows the resolved role.

**Implementation Note**: After this phase and all automated verification passes, pause for manual confirmation before proceeding to Phase 3.

---

## Phase 3: Signup Lockdown, Dev Seed & Production Bootstrap

### Overview

Close public self-service signup, seed a working admin + employee for dev, and document how the first admin is created in a real deployment.

### Changes Required:

#### 1. Disable public signup (config)

**File**: `supabase/config.toml`

**Intent**: Stop GoTrue from accepting self-service signups — v1 has no customer accounts.

**Contract**: Set `enable_signup = false` under `[auth]`. (Leave email auth otherwise intact; signin unaffected.)

#### 2. Make the signup route inert

**File**: `src/pages/api/auth/signup.ts`

**Intent**: App-level defense-in-depth + correct UX rather than a raw GoTrue error.

**Contract**: The `POST` handler refuses (redirect to `/auth/signin` with an explanatory message, or return 403) without calling `supabase.auth.signUp()`. Do not delete the file — keep the route as an explicit, documented refusal.

#### 3. Hide the signup entry point

**Files**: `src/pages/auth/signup.astro` (and any link to it from `signin.astro` / nav)

**Intent**: Remove the user-facing path to a disabled feature.

**Contract**: Make `/auth/signup` render a "registration is managed by an administrator" notice (or redirect to signin), and remove/hide links pointing to it. Minimal copy; Polish UI copy is canonical per lessons.

#### 4. Dev seed: staff accounts

**File**: `supabase/seed.sql`

**Intent**: `supabase db reset` yields a role-complete, signable-in system for development and manual/future-e2e testing.

**Contract**: Insert one **admin** and one **employee** into `auth.users` using the `encrypted_password = crypt('<dev-pw>', gen_salt('bf'))` pattern (with the matching `identities` row Supabase expects for email login), then insert their `profiles` rows with the corresponding `app_role`. Deterministic, clearly-marked **dev-only** credentials (e.g. `admin@fleetrent.test`, `employee@fleetrent.test`). Append to the existing seed without disturbing F-01's vehicle/reservation rows.

#### 5. Production first-admin runbook

**File**: `context/changes/employee-admin-roles/runbook-first-admin.md` (new) + a pointer from the project README

**Intent**: Document the one-time operator procedure to create the first admin in production (signup is disabled, no admin exists yet).

**Contract**: Step-by-step: (1) operator creates the user in the Supabase dashboard (Authentication → Add user); (2) run the documented SQL to insert that user's `profiles` row with `role = 'admin'` (`insert into profiles (user_id, role) select id, 'admin' from auth.users where email = '<admin-email>'`); (3) verify sign-in + admin access. Note this is per-deployment and one-time; subsequent staff come from S-08.

### Success Criteria:

#### Automated Verification:

- Full reset applies migration + seed with no errors: `supabase db reset`
- Tests still pass: `npm test`
- Type checking passes: `npx astro check`
- Linting passes: `npm run lint`

#### Manual Verification:

- The seeded **admin** and **employee** can each sign in; their roles resolve correctly on `/dashboard`.
- `POST /api/auth/signup` does **not** create an account; `/auth/signup` shows the managed-registration notice; no signup link is reachable from the UI.
- Following the runbook against a clean DB (operator-created user + the grant SQL) produces a working admin.

**Implementation Note**: After this phase and all automated verification passes, pause for final manual confirmation.

---

## Testing Strategy

### Unit Tests:

- `src/lib/access.ts` across the access matrix: public vs gated paths, `employee`/`admin`/`null` against employee- and admin-gated routes, most-specific-prefix precedence, fail-closed `null` role.

### Integration Tests:

- None automated for this slice (no HTTP/Astro test harness exists yet). The live middleware + RLS path is covered by manual verification with the two seeded accounts.

### Manual Testing Steps:

1. `supabase db reset` → clean apply of migration + staff seed.
2. Sign in as `employee@fleetrent.test` → `/dashboard` allowed, admin-only route denied.
3. Sign in as `admin@fleetrent.test` → both allowed; role shown on dashboard.
4. Create an `auth.users` row with **no** profile (or delete a seeded profile) → that session is denied every gated route.
5. `POST /api/auth/signup` (e.g. via curl) → no account created; `/auth/signup` shows the notice.
6. Walk the first-admin runbook on a fresh DB → working admin.
7. `npm test` → gating suite green.

## Performance Considerations

One indexed `profiles` lookup by `user_id` per authenticated request (PK lookup). Negligible at v1 single-tenant scale, and it rides on the request that already calls `getUser()`. No token-refresh or hook latency.

## Migration Notes

Additive over F-01: a new enum, table, function, trigger, and policies; no changes to existing tables or their RLS. Reversible by dropping `profiles`, `current_app_role()`, and `app_role`. Types must be regenerated after the migration (standing convention from F-01). Production deployments must run the first-admin runbook once after migrating.

## References

- Roadmap item: `context/foundation/roadmap.md` → F-02 (lines 83-94)
- PRD: `context/foundation/prd.md` → Access Control (lines 139-147), Guardrails (customer PII / unauthorized access)
- Change identity: `context/changes/employee-admin-roles/change.md`
- Sibling foundation (patterns to mirror): `context/changes/booking-integrity-data/plan.md`
- Existing auth: `src/middleware.ts`, `src/lib/supabase.ts`, `src/pages/api/auth/*`, `src/env.d.ts`
- F-01 migration (RLS/trigger patterns + `set_updated_at()`): `supabase/migrations/20260603155136_booking_integrity_data.sql`
- RLS / migration conventions: `CLAUDE.md` → Key conventions
- UI copy rule: `context/foundation/lessons.md`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Role Schema & RLS

#### Automated

- [x] 1.1 Migration applies cleanly: `supabase db reset` — 7770ff7
- [x] 1.2 Types generate without error: `supabase gen types typescript --local > src/db/database.types.ts` — 7770ff7
- [x] 1.3 Type checking passes: `npx astro check` — 7770ff7
- [x] 1.4 Linting passes: `npm run lint` — 7770ff7

#### Manual

- [x] 1.5 `profiles` table + RLS + 4 policies, `app_role` enum, and `current_app_role()` exist (verified in Studio/psql) — 7770ff7
- [x] 1.6 Non-admin reads only own row; admin reads all
- [x] 1.7 No RLS recursion error on `select * from profiles` — 7770ff7

### Phase 2: Role Propagation, Middleware Gating & Access Contract

#### Automated

- [x] 2.1 Gating unit tests pass: `npm test` — 54c9e2a
- [x] 2.2 Type checking passes: `npx astro check` — 54c9e2a
- [x] 2.3 Linting passes: `npm run lint` — 54c9e2a

#### Manual

- [x] 2.4 Seeded employee: allowed `/dashboard`, denied admin-only route
- [x] 2.5 Seeded admin: allowed both
- [x] 2.6 Role-less authenticated session denied every gated route (fail-closed) — 54c9e2a
- [x] 2.7 Unauthenticated access to a gated route redirects to `/auth/signin` — 54c9e2a
- [x] 2.8 `/dashboard` shows the resolved role

### Phase 3: Signup Lockdown, Dev Seed & Production Bootstrap

#### Automated

- [x] 3.1 Full reset applies migration + seed with no errors: `supabase db reset`
- [x] 3.2 Tests still pass: `npm test`
- [x] 3.3 Type checking passes: `npx astro check`
- [x] 3.4 Linting passes: `npm run lint`

#### Manual

- [x] 3.5 Seeded admin and employee can sign in; roles resolve on `/dashboard`
- [x] 3.6 `POST /api/auth/signup` creates no account; `/auth/signup` shows managed-registration notice; no reachable signup link
- [x] 3.7 First-admin runbook on a fresh DB produces a working admin
