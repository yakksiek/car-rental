# Employee Account Management (S-08) Implementation Plan

## Overview

Ship the admin **Employees** surface (`/dashboard/staff`) plus the app's first self-service password flow. An admin invites new **employee** accounts (email + name), soft-deactivates them, and triggers a password reset per row; every staff member can reset their own password from the sign-in screen. This is the slice F-02 explicitly deferred three things into: **service-role key wiring**, the **password-reset/self-service flow**, and the **admin user-management UI**.

The account-provisioning path (create / invite / deactivate) runs through a new **service-role admin client** that bypasses RLS, so it lives only inside admin-gated `/api/staff*` routes. Reads go through an admin-gated `SECURITY DEFINER list_staff()` RPC (mirroring `list_pending_reservations`), keeping the service-role key out of page renders. Removal is a **soft-deactivate** (not a hard delete) — consistent with how vehicles use `is_active`, and forced by the `protocols.created_by → auth.users` FK, which the DB uses to reject deleting anyone who has filled a protocol. Invite + reset emails go through **Supabase GoTrue** (native `inviteUserByEmail` / `resetPasswordForEmail`), verified against local **Inbucket**.

## Current State Analysis

- **The admin gate is already wired.** `ROUTE_ROLES` contains `{ prefix: "/dashboard/staff", role: "admin" }` (`src/lib/access.ts:30`) and `requireRole(locals, "admin")` exists (`src/lib/access.ts:79-81`). A page at `src/pages/dashboard/staff.astro` inherits the admin gate with **zero** middleware changes; API routes self-gate with `requireRole(context.locals, "admin")`.
- **No service-role key or admin client exists.** `astro.config.mjs` `env.schema` (lines 47-56) declares only `SUPABASE_URL`, `SUPABASE_KEY`, `RESEND_API_KEY`, `EMAIL_FROM` (all `context:"server"`, `access:"secret"`, `optional:true`). `src/lib/supabase.ts` exposes only the anon cookie client (returns `null` unconfigured). The Worker runs with `nodejs_compat_populate_process_env` (`wrangler.jsonc:7`), so a new secret needs no wrangler-config change — only `.dev.vars` (local) + a Cloudflare Worker secret (prod). The test harness already uses the name `SUPABASE_SERVICE_ROLE_KEY` (`tests/integration/setup.ts:11`) — reuse it.
- **No password-reset flow exists at all.** Grep across `src/`/`supabase/` finds no `resetPasswordForEmail`, `updateUser`, `exchangeCodeForSession`, `inviteUserByEmail`, or any `callback`/`recover`/`reset` route. `SignInForm.tsx:15-19` documents that the "forgot password" link was intentionally omitted "because password reset is a separate, unbuilt slice" — this one.
- **The client is PKCE `?code=` flow.** `createServerClient` (`src/lib/supabase.ts:11`) uses the `@supabase/ssr` defaults: `flowType:"pkce"`, `detectSessionInUrl:false`. So recovery/invite links carry `?code=` and require a server route calling `exchangeCodeForSession(code)` to establish the recovery session cookie before `updateUser({ password })`.
- **`profiles` has no name/email.** F-02 kept them in `auth.users` (`supabase/migrations/20260604153139_employee_admin_roles.sql:20-26`: `profiles(user_id pk → auth.users on delete cascade, role, created_at, updated_at)`). The middleware reads role via a direct select `profiles.select("role").eq("user_id", …).maybeSingle()` (`src/middleware.ts:22-23`).
- **`protocols.created_by → auth.users(id)` has no cascade** (`supabase/migrations/20260710120000_issue_protocol.sql:92`, default `ON DELETE NO ACTION`; return protocols carry the same attribution). A hard `auth.admin.deleteUser` of a staffer who filled a protocol is rejected by the DB — this is the concrete reason removal is a soft-deactivate.
- **Auth email is GoTrue, separate from the app's Resend seam.** `config.toml` `[auth.email.smtp]` is commented out (lines 228-235) → local mail lands in **Inbucket** (`[inbucket] enabled=true`, web UI :54324). `site_url = http://127.0.0.1:3000` (line 154) and `additional_redirect_urls = ["https://127.0.0.1:3000"]` (line 156) are both the **wrong** origin for dev (real dev is `http://localhost:4321`) — recovery `redirectTo` must be added to the allow-list or GoTrue drops it. `minimum_password_length = 6` (line 177). `enable_signup=false` top-level (line 171) closes public signup — but does **not** block recovery.
- **Canonical designs:** the S-08 screenshot set in `context/changes/employee-account-management/design-review/` (desktop roster + states A–H, mobile roster, reset flow R1–R10). The closest structural mirror is `FleetList.tsx` (raw `<table>` desktop / stacked cards mobile) + the hand-rolled `RetireDialog` confirm modal (`FleetList.tsx:125-172`). There is **no** shadcn `Table`, `Dialog`, `AlertDialog`, or toast in the repo; feedback is an inline `banner` `useState` strip + optimistic list update.

## Desired End State

- An admin visiting `/dashboard/staff` sees the Employees page: a searchable roster (name + email · role badge · status badge ACTIVE/INVITED · last-active · "Resetuj hasło" · remove ✕) with filter tabs (Wszyscy / Aktywny / Zaproszony / Administrator + counts), an "Add employee" action, and the footer note. Their own ✕ is disabled.
- **Add employee** (email + name) invites an `employee` via GoTrue; the invite email lands in Inbucket; following its link lets the new hire set a password and sign in. The row shows INVITED until first sign-in, then ACTIVE.
- **Remove** soft-deactivates (row disappears; the account can no longer reach gated routes), refusing to remove yourself or the last admin, and requiring the admin to type the target's email to confirm. Re-adding a deactivated email **reactivates** it.
- **Resetuj hasło** (admin row action) and **"Zapomniałeś hasła?"** (sign-in) both send a GoTrue recovery email; the `/auth/callback` → `/auth/reset-password` flow sets a new password.
- A new `SUPABASE_SERVICE_ROLE_KEY` secret + `createAdminClient()` exist and are used only in admin `/api/staff*` routes.

**Verification:** `supabase db reset` applies migration + seed (active + invited staff, Polish-diacritic names); `npm run test:integration` green for the staff service (create/invite, reactivate, deactivate self/last-admin guards, RLS non-admin denial); `npx astro check` + `npm run lint` clean; manual walk of invite→Inbucket→accept→sign-in, forgot-password→Inbucket→reset, and the guard/reactivation paths; the Employees page matches the design contract under a vision-diff.

### Key Discoveries:

- Admin route gate + `requireRole` are pre-built (`src/lib/access.ts:30,79-81`) — the page lives at `src/pages/dashboard/staff.astro`.
- Service-role secret name is already `SUPABASE_SERVICE_ROLE_KEY` in the test harness (`tests/integration/setup.ts:11`) — reuse it.
- Definer-RPC read pattern to mirror: `list_pending_reservations()` (`supabase/migrations/20260617121000_list_pending_reservations.sql:14-50` — `security definer`, `current_app_role() in ('employee','admin')` gate, `grant execute … to authenticated`). Apply the lessons' **revoke-before-grant** + `(select current_app_role())` wrapping.
- Mutation service pattern: tagged-union results (`CreateVehicleResult = {status:"created"|"duplicate_plate"|"unauthorized"}`, `src/lib/services/vehicles.ts:178-210`) mapped to HTTP in the route.
- API self-gate order (canonical): CSRF origin → `!user`→401 → `requireRole`→403 → zod→400 → service (`src/pages/api/vehicles.ts:31-70`); each route declares its own `json()` + Polish `MSG`.
- UI mirror: `FleetList.tsx` (table/cards split at `md`, `StatusBadge` 100-106, empty-state 356-360, `RetireDialog` 125-172, optimistic mutate 203-244, inline `banner` 184/352-354). Add-employee = a `RetireDialog`-style modal, not a page.
- Nav gap: `StaffShell.astro:37-50` `NAV` is unconditional and has no admin item; S-08 is the first slice to render a nav entry only when `role === "admin"` (the shell's own comment at `:12-14` anticipates the "Zespół" tab). `active` union (`:17`) needs a `"staff"` value; `NavIcon.astro` needs a person icon.

## What We're NOT Doing

- **No admin creation from the UI.** "Add employee" always creates `role="employee"`; additional admins stay runbook-provisioned (F-02's `runbook-first-admin.md` SQL). No role toggle, no promote/demote row action.
- **No hard delete.** Removal is soft-deactivate; the `auth.users` row persists (email stays taken until reactivation).
- **No in-app "change password"** for a logged-in user — FR-013 requires only email-based self-reset (decision: out of scope).
- **No true presence tracking.** "Last active" is `auth.users.last_sign_in_at` rendered relative; no per-request `last_seen` write. "Online now" is approximated, not literal.
- **No "show deactivated" filter** on the roster (unlike Fleet's show-retired). Deactivated users are simply hidden; reactivation is via re-adding the email.
- **No prod email send in-slice.** DoD is local Inbucket verification; configuring Supabase project SMTP for production is a documented ops step, not a code deliverable here.
- **No custom GoTrue email templates / branded Resend emails** for invite/reset — GoTrue defaults are used.
- **No RLS rework of other tables** — only `profiles` gains columns; the staff read/write path is definer-RPC + admin-client.

## Implementation Approach

Four phases in dependency order: **data → service/API → auth-recovery flow → UI**. Phase 1 lays the durable contract (columns, `list_staff` RPC, admin client, env, middleware deactivation gate, seed). Phase 2 builds the staff service + admin-gated mutation routes with the guard logic tested in isolation (self / last-admin are the expensive-to-get-wrong invariants). Phase 3 stands up the net-new PKCE recovery surface (used by both self-service reset and invite-accept). Phase 4 assembles the design-canonical Employees UI against the canonical `design-review/` screenshots. Phases 3 and 4 both consume Phases 1-2; 3 is sequenced before 4 so the "Resetuj hasło" action and the invite-accept link have a working landing flow.

## Critical Implementation Details

- **The admin (service-role) client bypasses RLS.** Construct it only inside `/api/staff*` route handlers via `createAdminClient()` (reads `SUPABASE_SERVICE_ROLE_KEY` from `astro:env/server`); never attach it to `context.locals` and never import it into a client island. Every `/api/staff*` route must still self-gate (`requireRole(locals,"admin")`) before touching it — the RLS bypass makes the in-handler gate the real boundary.
- **PKCE ordering.** The invite/recovery link carries `?code=`; `/auth/callback` must call `exchangeCodeForSession(code)` (which triggers the SSR client's cookie `setAll`) **before** any redirect, so `/auth/reset-password` sees a session. An expired/invalid code returns an error → redirect back to `/auth/forgot-password` with a message, never a 500.
- **`config.toml` reload.** `site_url` / `additional_redirect_urls` changes load only on `supabase stop && supabase start` (not `db reset`) — call this out in the phase so the recovery redirect isn't silently dropped in dev.
- **Status derivation.** `INVITED` = `invited_at is not null AND last_sign_in_at is null`; `ACTIVE` = `last_sign_in_at is not null`. The seed must set `last_sign_in_at` on "active" rows and leave it null (with `invited_at` set) on the "invited" row so both states render.
- **Guard authority.** Self / last-admin guards live in the `deactivate_staff` RPC (authoritative, runs as caller with `current_app_role()='admin'` gate), so a direct API call can't strand the org with zero admins; the service adds the auth-level ban after the RPC returns `ok`.

## Phase 1: Data Model & Service-Role Plumbing

### Overview

One migration adds the staff columns and the read RPC; wire the service-role env + admin client; make the middleware deny deactivated users; seed a renderable roster.

### Changes Required:

#### 1. Migration — staff columns, list + deactivate RPCs

**File**: `supabase/migrations/<YYYYMMDDHHmmss>_employee_account_management.sql`

**Intent**: Give `profiles` a listable name and a soft-deactivate marker, and add the two admin-gated definer RPCs that back the roster read and the guarded deactivation.

**Contract**:

- `alter table public.profiles add column full_name text;` (nullable; the invite flow always sets it, the seed backfills existing rows) and `add column deactivated_at timestamptz;` (null = active).
- `public.list_staff()` — `security definer`, `set search_path = ''`, `stable`; returns a table of `user_id, full_name, email, role, deactivated_at, invited_at, last_sign_in_at, created_at` by joining `public.profiles` to `auth.users`; gated so it yields rows only for an admin caller and only for non-deactivated profiles.
- `public.deactivate_staff(target uuid)` — `security definer`, `set search_path = ''`; returns a text result tag. Gates on admin; returns `'unauthorized'` if not admin, `'self'` if `target = auth.uid()`, `'not_found'` if no active profile, `'last_admin'` if the target is an admin and it's the only non-deactivated admin, else sets `deactivated_at = now()` and returns `'ok'`. (Reactivation is handled in the service, not here.)
- Per the lessons: `revoke execute on function public.list_staff(), public.deactivate_staff(uuid) from public, anon;` **then** `grant execute … to authenticated;`. Wrap every caller check as `(select public.current_app_role())`.

Snippet (the two non-obvious pieces — the admin-gated join over `auth.users`, and the last-admin guard):

```sql
create function public.list_staff()
returns table (user_id uuid, full_name text, email text, role public.app_role,
               deactivated_at timestamptz, invited_at timestamptz,
               last_sign_in_at timestamptz, created_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select p.user_id, p.full_name, u.email::text, p.role,
         p.deactivated_at, u.invited_at, u.last_sign_in_at, p.created_at
  from public.profiles p
  join auth.users u on u.id = p.user_id
  where (select public.current_app_role()) = 'admin'
    and p.deactivated_at is null
  order by p.created_at;
$$;
-- deactivate_staff: last-admin check is
--   role = 'admin' and (select count(*) from public.profiles
--                       where role='admin' and deactivated_at is null) <= 1  -> 'last_admin'
```

#### 2. Regenerated database types

**File**: `src/db/database.types.ts`

**Intent**: Reflect the new `profiles` columns and the `list_staff` / `deactivate_staff` functions.

**Contract**: Output of `supabase gen types typescript --local > src/db/database.types.ts` after the migration applies. Generated — do not hand-edit.

#### 3. Service-role env declaration

**File**: `astro.config.mjs` (+ `.dev.vars` locally)

**Intent**: Declare the service-role secret so `astro:env/server` resolves it; provide it locally.

**Contract**: Add `SUPABASE_SERVICE_ROLE_KEY: envField.string({ context: "server", access: "secret", optional: true })` to `env.schema` (alongside the existing four). Add the matching line to `.dev.vars` (git-ignored) with the local Supabase service_role key. Prod: `wrangler secret put SUPABASE_SERVICE_ROLE_KEY` (documented in the runbook, Phase 2 change #6). Optionally extend `src/lib/config-status.ts` so the missing-config banner notes when staff-management is unconfigured.

#### 4. Admin (service-role) client factory

**File**: `src/lib/supabase.ts`

**Intent**: A second client that authenticates with the service-role key and bypasses RLS, for admin user provisioning only.

**Contract**: Add `createAdminClient(): SupabaseClient<Database> | null` using `createClient` from `@supabase/supabase-js` (not `@supabase/ssr`) with `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` and `auth: { persistSession: false, autoRefreshToken: false }`. Return `null` when either env var is missing. Add a comment: RLS-bypassing, server-only, never attach to `locals`, never import into an island.

#### 5. Middleware deactivation gate

**File**: `src/middleware.ts`

**Intent**: A deactivated user must resolve to `role = null` (denied), reusing the existing per-request profile read.

**Contract**: Change the profile select to `.select("role, deactivated_at")` and set `context.locals.role = profile && profile.deactivated_at == null ? profile.role : null`. No other middleware change (the `/dashboard/staff → admin` gate already exists).

#### 6. Dev seed — staff roster

**File**: `supabase/seed.sql`

**Intent**: `supabase db reset` yields a renderable roster with both statuses and Polish-diacritic names.

**Contract**: Backfill `full_name` on the existing seeded admin/employee; add a few more `employee` rows (active — `last_sign_in_at` set) and one **invited** row (`invited_at` set, `last_sign_in_at` null), following F-02's `auth.users` + `identities` + `crypt()` seed idiom. Use names exercising diacritics (e.g. `Tomasz Wójcik`, `Karolina Mazur`). Dev-only credentials; do not disturb F-01/F-02 rows.

### Success Criteria:

#### Automated Verification:

- Migration + seed apply cleanly: `supabase db reset`
- Types generate without error: `supabase gen types typescript --local > src/db/database.types.ts`
- Type checking passes: `npx astro check`
- Linting passes: `npm run lint`

#### Manual Verification:

- In Studio/psql: `profiles` has `full_name` + `deactivated_at`; `list_staff()` returns rows only for an admin session and excludes deactivated; `deactivate_staff()` returns `unauthorized` for a non-admin.
- Both RPCs are `revoke`d from `anon` (an anon call is denied at the grant layer).
- A profile with `deactivated_at` set resolves to `role=null` in middleware (that session is denied `/dashboard`).

**Implementation Note**: After this phase and all automated verification passes, pause for manual confirmation before Phase 2.

---

## Phase 2: Staff Service & Admin API

### Overview

A `staff.ts` service (list, create/invite with reactivation, deactivate, admin reset) behind three admin-gated `/api/staff*` routes, with the account lifecycle covered by integration tests.

### Changes Required:

#### 1. Staff service

**File**: `src/lib/services/staff.ts` (new)

**Intent**: Encapsulate the staff read + the three provisioning mutations, mirroring the tagged-union result convention.

**Contract**:

- `listStaff(client): Promise<StaffMember[]>` — calls `client.rpc("list_staff")`; maps each row and derives `status: "active" | "invited"` from `last_sign_in_at`/`invited_at`. `null` client → `[]`.
- `createEmployee(admin, { email, fullName }): Promise<CreateEmployeeResult>` where result is `{status:"created"|"reactivated"|"duplicate_active"|"unauthorized"}` (+ rethrow on unexpected). Logic: look up the email via the admin API; if an **active** account exists → `duplicate_active`; if a **deactivated** one exists → clear `deactivated_at`, lift the auth ban, resend the invite → `reactivated`; else `admin.auth.admin.inviteUserByEmail(email, { data:{ full_name }, redirectTo: <origin>/auth/callback })`, then insert the `profiles` row (`role:"employee"`, `full_name`) → `created`.
- `deactivateStaff(admin, cookieClient, targetId): Promise<DeactivateResult>` (`{status:"ok"|"self"|"last_admin"|"not_found"|"unauthorized"}`): call `cookieClient.rpc("deactivate_staff", { target: targetId })`; on `ok`, ban the auth user (`admin.auth.admin.updateUserById(targetId, { ban_duration: "876000h" })`) to revoke sign-in; return the tag.
- `resetStaffPassword(client, email): Promise<{status:"sent"}>` — `client.auth.resetPasswordForEmail(email, { redirectTo: <origin>/auth/callback })` (works for invited and active users; no service-role needed).
- Shared zod `employeeInviteSchema` (email + `full_name`, trimmed, non-empty) exported for client + route reuse. Guard uuid shape before the deactivate RPC (as services do).

#### 2. Create/invite route

**File**: `src/pages/api/staff.ts` (new)

**Intent**: Admin-only create/invite endpoint.

**Contract**: `POST`; local `json()` + Polish `MSG`; order: CSRF origin → `!user`→401 → `requireRole(locals,"admin")`→403 → `employeeInviteSchema.safeParse`→400 → `createEmployee(createAdminClient(), …)`. Map `created`→201, `reactivated`→200, `duplicate_active`→409 (field error on email), `unauthorized`→403.

#### 3. Deactivate route

**File**: `src/pages/api/staff/[id]/deactivate.ts` (new)

**Intent**: Admin-only soft-remove with typed-confirmation.

**Contract**: `POST`; same gate order; body `{ confirmEmail }` — the server re-fetches the target's email (admin API) and rejects if it doesn't match the typed value (`400`, so the typed confirmation is enforced server-side, not just in the modal). Then `deactivateStaff(admin, locals.supabase, id)`. Map `ok`→200, `self`→403, `last_admin`→409, `not_found`→404.

#### 4. Admin reset-password route

**File**: `src/pages/api/staff/[id]/reset-password.ts` (new)

**Intent**: Admin-triggered "Resetuj hasło" row action.

**Contract**: `POST`; same gate order; look up the target email via the admin API (don't trust a client-sent email), then `resetStaffPassword(locals.supabase, email)`. Always `200 {status:"sent"}` on success.

#### 5. Integration tests

**File**: `tests/integration/staff.test.ts` (new)

**Intent**: Lock the account lifecycle + guards + RLS boundary.

**Contract**: Against local Supabase (service-role setup client): create/invite creates an `employee` profile + auth user; re-inviting a deactivated email reactivates (clears `deactivated_at`, unbans); `deactivate_staff` returns `self` for the caller, `last_admin` when it's the only admin, `ok` otherwise and hides the row from `list_staff`; a non-admin session gets `unauthorized`/empty from both RPCs. Follow `tests/helpers/clients.ts` for the service-role/anon clients.

#### 6. Contract-surfaces + prod-secret note

**Files**: `docs/reference/contract-surfaces.md`, `context/changes/employee-admin-roles/runbook-first-admin.md` (pointer)

**Intent**: Register the new load-bearing names; document provisioning the prod secret.

**Contract**: Add an S-08 section listing `full_name`/`deactivated_at` columns, `list_staff()` / `deactivate_staff()` RPCs, `createAdminClient()`, the `staff.ts` service fns + `StaffMember`/result types, and the `/api/staff*` routes. Add a one-line note that prod needs `wrangler secret put SUPABASE_SERVICE_ROLE_KEY` + Supabase project SMTP + the app origin in `additional_redirect_urls`.

### Success Criteria:

#### Automated Verification:

- Integration tests pass: `npm run test:integration`
- Type checking passes: `npx astro check`
- Linting passes: `npm run lint`

#### Manual Verification:

- `POST /api/staff` as admin invites an employee (invite email appears in Inbucket :54324); as employee → 403; anon → 401.
- `POST /api/staff/[id]/deactivate` refuses self (403) and last-admin (409); a wrong `confirmEmail` → 400; a valid one hides the row.
- Re-inviting the deactivated email reactivates the account.
- `POST /api/staff/[id]/reset-password` sends a recovery email to Inbucket.

**Implementation Note**: After this phase and all automated verification passes, pause for manual confirmation before Phase 3.

---

## Phase 3: Self-Service Reset & PKCE Callback

### Overview

The net-new unauthenticated recovery surface: request → GoTrue email → `?code=` callback → set new password. The same callback handles invite-accept. Built against the canonical reset screens **R1–R10** in `design-review/` (forgot / check-email / set-password / success / expired / invite-accept, desktop + mobile) — a card-centered `STREFA PRACOWNIKA` shell reusing `SignInForm`'s auth-card idiom.

### Changes Required:

#### 1. Auth redirect config

**File**: `supabase/config.toml`

**Intent**: Allow the app origins as recovery/invite redirect targets.

**Contract**: Set `site_url` to the real dev origin and add dev + prod app origins to `additional_redirect_urls` (e.g. `http://localhost:4321`, `http://127.0.0.1:4321`, and the prod Worker/`wujcar` origin). Note in the phase: requires `supabase stop && supabase start` to load (not `db reset`).

#### 2. Forgot-password page + route

**Files**: `src/pages/auth/forgot-password.astro` (new), `src/pages/api/auth/forgot-password.ts` (new)

**Intent**: Collect an email and trigger the recovery email without leaking account existence.

**Contract**: Page renders a small email form (mirror `SignInForm` structure + `SubmitButton` pending pattern; design R1). Route: `POST`, CSRF origin, zod email, `locals.supabase.auth.resetPasswordForEmail(email, { redirectTo: <origin>/auth/callback })`; **always** redirect to a neutral "check your email" state regardless of whether the email exists. That check-email screen (design R2) is neutral ("jeśli konto istnieje…", 60-min expiry — matches `otp_expiry=3600`) with `Open email app` / `Resend link` affordances.

#### 3. PKCE callback route

**File**: `src/pages/auth/callback.ts` (new — endpoint)

**Intent**: Exchange the `?code=` for a session cookie, then route to the password-set page.

**Contract**: `GET`; read `code`; `locals.supabase.auth.exchangeCodeForSession(code)`; on success `redirect("/auth/reset-password")`; on error route to the expired/invalid-link screen (design R5, "Request a new link"). Handles both recovery and invite links (invite-accept lands here first); pass the link type through so the reset page can pick its mode.

#### 4. Reset-password page + route

**Files**: `src/pages/auth/reset-password.astro` (new), `src/pages/api/auth/reset-password.ts` (new)

**Intent**: With the recovery session established, set the new password.

**Contract**: Page requires `locals.user` (the recovery session); if absent → the expired-link screen (R5) or `/auth/forgot-password`. Renders a password + confirm island in one of **two modes** — recovery (design R3: "Ustaw nowe hasło" / "Zapisz hasło") or **invite-accept** (design R6: "WELCOME TO FLOTA" eyebrow / "Set your password" / "Activate account"), chosen from the GoTrue link type passed through the callback. Route: `POST`, CSRF origin, require `locals.user`, zod (**confirm matches**; length per the existing `config.toml` policy — the design's "10 characters / one number-or-symbol" checklist is an illustrative UI hint, **not** a policy change), `locals.supabase.auth.updateUser({ password })`, then the success screen (R4, "Password updated → Go to sign in").

#### 5. Sign-in "forgot password" link

**File**: `src/components/auth/SignInForm.tsx`

**Intent**: Surface the now-built recovery entry point.

**Contract**: Add the "Zapomniałeś hasła?" link → `/auth/forgot-password` (the intentionally-omitted link at `:15-19`).

### Success Criteria:

#### Automated Verification:

- Type checking passes: `npx astro check`
- Linting passes: `npm run lint`
- Unit tests still pass: `npm test`

#### Manual Verification:

- From sign-in → "Zapomniałeś hasła?" → submit email → recovery email in Inbucket → link opens `/auth/reset-password` → set password → sign in with the new password.
- Accepting a Phase-2 invite email routes through `/auth/callback` → `/auth/reset-password` and lets the new hire set their first password and sign in (row flips INVITED → ACTIVE).
- An expired/invalid `code` redirects to forgot-password with a message (no 500).

**Implementation Note**: After this phase and all automated verification passes, pause for manual confirmation before Phase 4.

---

## Phase 4: Employees Admin UI

### Overview

The design-canonical Employees page: nav entry, SSR page, and the `StaffList` island with roster, add/remove/reset actions — built against the canonical S-08 screenshots in `design-review/` (desktop roster + states A–H, mobile roster, and the reset flow R1–R10).

### Changes Required:

#### 1. Admin nav entry

**Files**: `src/components/shell/StaffShell.astro`, `src/components/shell/NavIcon.astro`

**Intent**: Add the admin-only "Zespół" tab (the first role-gated nav item).

**Contract**: Add `active` union value `"staff"` (`:17`); add a `NAV` entry `{ id:"staff", href:"/dashboard/staff", label:"Zespół", icon:"users" }`; render it (both sidebar + tab-bar loops) only when `role === "admin"`. Add a person/`users` icon to `NavIcon.astro`.

#### 2. Employees page shell

**File**: `src/pages/dashboard/staff.astro` (new)

**Intent**: SSR the roster and mount the island (admin gate is already enforced by middleware).

**Contract**: Load `listStaff(locals.supabase)`; compute filter counts (wszyscy / aktywny / zaproszony / administrator); render `Layout` → `StaffShell active="staff"` → `<StaffList client:load staff={…} currentUserId={locals.user.id} />` inside the standard `<main class="mx-auto w-full max-w-5xl px-4 py-6">` wrapper.

#### 3. StaffList island

**File**: `src/components/staff/StaffList.tsx` (new)

**Intent**: The roster + all row/actions, mirroring `FleetList` idioms.

**Contract**:

- Header: eyebrow (`5 OSÓB · 1 ADMINISTRATOR` desktop / `4 STAFF` mobile) + H1 (**`Pracownicy`** on desktop, **`Zespół`** on mobile; the nav label is `Zespół` — three distinct labels) + `Dodaj pracownika` primary button (dark at md+, circular FAB below md); search box (placeholder `Imię lub e-mail…`) filtering client-side by name/email.
- **Filter tabs (desktop) / chips (mobile)**: `Wszyscy / Aktywny / Zaproszony / Administrator` with counts + a right-aligned avatar stack (desktop); selecting one filters the roster. (Replaces the old screen-19 stat cards.)
- Desktop `<table>` / mobile stacked cards (the `hidden md:block` / `md:hidden` split): avatar initials (role-colored — admin crimson, employee navy), full name + email, role badge (admin = danger-soft, employee = muted), status badge (active = success-soft, invited = warning-soft), last-active relative time (PL), "Resetuj hasło" button, remove ✕ (disabled when `id === currentUserId`). Mobile keeps search + filter chips + the per-row reset/✕ actions (parity with desktop).
- **Roster states**: empty (`Brak pracowników` + CTA), no-search-results (`Brak wyników`), loading skeleton, and a top mutation-error banner (`Nie udało się zapisać zmiany…` + `Ponów`) — all per the design contract.
- **Add modal** (`RetireDialog`-style): `full_name` + `email` fields → `POST /api/staff`; on success optimistic-insert or reload; field/duplicate errors inline.
- **Remove modal**: typed-confirmation (type the employee email) → `POST /api/staff/[id]/deactivate`; `last_admin`/`self` errors surfaced in the modal; on success remove the row.
- **Resetuj hasło** → `POST /api/staff/[id]/reset-password` → inline success banner ("wysłano e-mail…").
- Feedback via inline `banner` `useState` + optimistic list mutation (no toast). Pending spinners via the shared `animate-spin` pattern.

#### 4. Relative-time + status labels (PL)

**File**: co-located helper in `StaffList.tsx` (or `src/lib/`)

**Intent**: Render `last_sign_in_at`/`invited_at` as Polish relative strings ("12 min temu", "2 godz. temu", "wczoraj", "zaproszenie · N dni temu") consistent with the app's single-locale rule.

**Contract**: A small pure formatter; pin `Europe/Warsaw` / `pl-PL` per the locale lesson (avoid an SSR/CSR hydration mismatch — prefer computing on the client or passing a stable pre-formatted string). Exact strings recorded in the design contract.

#### 5. Design contract adherence

**File**: `context/changes/employee-account-management/design-contract.md` (authored at plan Step 6)

**Intent**: Build to exact values + verbatim Polish copy; close with a vision-diff.

**Contract**: Each surface (page, filter tabs, add modal, remove + last-admin modals, badges, empty / no-results / loading / error states, mobile roster) matches the contract; the vision-diff against the `design-review/` canonical screenshots converges (minus recorded deviations).

### Success Criteria:

#### Automated Verification:

- Type checking passes: `npx astro check`
- Linting passes: `npm run lint`
- Unit tests pass: `npm test`

#### Manual Verification:

- As admin, `/dashboard/staff` shows the roster, filter tabs, and search; the "Zespół" tab appears for admin and is absent for a plain employee.
- Add employee → row appears INVITED; remove (with typed confirm) hides it; own ✕ is disabled; last-admin removal is refused with a clear message.
- "Resetuj hasło" reports the email was sent.
- Vision-diff against the canonical `design-review/` screenshots (`employees-desktop-roster.jpg` + states, `employees-mobile-roster.jpg`) matches the design contract (minus recorded deviations).

**Implementation Note**: After this phase and all automated verification passes, pause for final manual confirmation.

---

## Testing Strategy

### Unit Tests:

- Status derivation (`last_sign_in_at`/`invited_at` → active/invited) and the PL relative-time formatter (min/hour/day boundaries, invited phrasing).
- If the last-admin/self guard logic is mirrored in TS, a pure test of it (the authoritative copy is the RPC, covered by integration).

### Integration Tests (`tests/integration/staff.test.ts`):

- Create/invite → employee profile + auth user; reactivation on re-add; `deactivate_staff` self / last-admin / ok + roster hiding; non-admin denial of both RPCs.

### Manual Testing Steps:

1. `supabase db reset` → roster renders (active + invited, diacritic names).
2. Invite an employee → invite email in Inbucket → accept → set password → sign in (INVITED→ACTIVE).
3. Sign-in → forgot-password → recovery email → reset → sign in with new password.
4. Deactivate: own ✕ disabled; last-admin refused; a normal employee removed (row gone, then denied `/dashboard`).
5. Re-add the removed email → reactivated.
6. `npm run test:integration` + `npm test` green.

## Performance Considerations

Roster read is one admin-gated RPC over a handful of staff rows (single-tenant scale). The service-role admin client is constructed per admin mutation only. Middleware adds one already-existing profile select (now selecting one more column). No hot paths touched.

## Migration Notes

Additive over F-02: two nullable `profiles` columns + two definer RPCs; no changes to existing tables' RLS. Reversible by dropping the RPCs/columns. Types regenerate after the migration. **Prod rollout** needs three ops steps (documented, not code): `wrangler secret put SUPABASE_SERVICE_ROLE_KEY`; configure Supabase project SMTP (built-in email is rate-limited); add the prod app origin to `additional_redirect_urls`.

## References

- Roadmap: `context/foundation/roadmap.md` → S-08 (lines 202-212)
- PRD: `context/foundation/prd.md` → FR-013 (line 116), Access Control (lines 139-147)
- Prerequisite role model (patterns to mirror): `context/archive/2026-06-04-employee-admin-roles/plan.md`, `runbook-first-admin.md`
- Access gate: `src/lib/access.ts:27-81`; middleware `src/middleware.ts`
- Definer-RPC read pattern: `supabase/migrations/20260617121000_list_pending_reservations.sql`
- Service/route/form/modal mirrors: `src/lib/services/vehicles.ts`, `src/pages/api/vehicles.ts`, `src/components/fleet/{FleetList,VehicleForm}.tsx`, `src/components/auth/SubmitButton.tsx`
- Email seam (reference; unused here — GoTrue path): `src/lib/email/index.ts`
- Designs: `context/changes/employee-account-management/design-review/` (17 canonical screenshots) + `design-contract.md`
- Lessons applied: revoke-before-grant EXECUTE; `(select current_app_role())` wrapping; API self-gate; RHF-for-large-forms (N/A — small form); single-locale timestamp pinning; design-alignment gate + exact values.

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Data Model & Service-Role Plumbing

#### Automated

- [ ] 1.1 Migration + seed apply cleanly: `supabase db reset`
- [ ] 1.2 Types generate without error: `supabase gen types typescript --local > src/db/database.types.ts`
- [ ] 1.3 Type checking passes: `npx astro check`
- [ ] 1.4 Linting passes: `npm run lint`

#### Manual

- [ ] 1.5 `profiles` has `full_name` + `deactivated_at`; `list_staff()` admin-only + excludes deactivated; `deactivate_staff()` denies non-admin
- [ ] 1.6 Both RPCs revoked from anon (anon call denied at grant layer)
- [ ] 1.7 Deactivated profile resolves to `role=null` in middleware (session denied `/dashboard`)

### Phase 2: Staff Service & Admin API

#### Automated

- [ ] 2.1 Integration tests pass: `npm run test:integration`
- [ ] 2.2 Type checking passes: `npx astro check`
- [ ] 2.3 Linting passes: `npm run lint`

#### Manual

- [ ] 2.4 `POST /api/staff` invites as admin (Inbucket email); 403 as employee; 401 anon
- [ ] 2.5 Deactivate refuses self (403) + last-admin (409); wrong `confirmEmail`→400; valid hides row
- [ ] 2.6 Re-inviting a deactivated email reactivates it
- [ ] 2.7 `POST /api/staff/[id]/reset-password` sends recovery email to Inbucket

### Phase 3: Self-Service Reset & PKCE Callback

#### Automated

- [ ] 3.1 Type checking passes: `npx astro check`
- [ ] 3.2 Linting passes: `npm run lint`
- [ ] 3.3 Unit tests still pass: `npm test`

#### Manual

- [ ] 3.4 Forgot-password → Inbucket email → `/auth/reset-password` → set password → sign in
- [ ] 3.5 Invite email routes through `/auth/callback` → set first password → sign in (INVITED→ACTIVE)
- [ ] 3.6 Expired/invalid `code` redirects to forgot-password (no 500)

### Phase 4: Employees Admin UI

#### Automated

- [ ] 4.1 Type checking passes: `npx astro check`
- [ ] 4.2 Linting passes: `npm run lint`
- [ ] 4.3 Unit tests pass: `npm test`

#### Manual

- [ ] 4.4 `/dashboard/staff` roster + filter tabs + search; "Zespół" tab shown for admin, absent for employee
- [ ] 4.5 Add → INVITED row; remove (typed confirm) hides it; own ✕ disabled; last-admin refused
- [ ] 4.6 "Resetuj hasło" reports email sent
- [ ] 4.7 Vision-diff vs the canonical `design-review/` screenshots matches the design contract (minus recorded deviations)
