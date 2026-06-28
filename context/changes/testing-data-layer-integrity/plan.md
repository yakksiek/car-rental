# Data-layer Integrity Harness — RLS PII Isolation + Reservation Overlap Implementation Plan

## Overview

Stand up the project's first **integration-test harness** against local Supabase
and use it to lock down the two highest-priority data-layer risks from
`context/foundation/test-plan.md`:

- **Risk #2 (double-booking)** — prove the `reservations_no_overlap` GiST
  `EXCLUDE` constraint rejects an overlapping booking (`23P01` → `conflict`)
  while *allowing* a same-day 14:00/10:00 turnover, driven through the real
  `create_reservation_request` RPC + service path.
- **Risk #1 (PII access)** — prove each role (anon / employee / admin /
  role-null) reads exactly the reservation PII its policies + RPC gates allow,
  and **close the confirmed direct-table PII leak (F1)**. The leak was verified
  empirically during planning: an `authenticated` role-null user reads all 4
  customer rows (name/email/phone) directly off the table, because a
  schema-wide `SELECT` grant exists (Gate 1) and the policy is `using (true)`
  (Gate 2). This change ships a regression test asserting the *secure* behavior
  plus the migration that makes it pass.

Every assertion targets **our** SQL config (policies, grants, the constraint,
the generated range, the SECURITY DEFINER RPCs) — all hand-written in
`supabase/migrations/`. The harness drives *through* the Postgres/Supabase
engine because that is the only way to observe the real behavior of our config;
it never asserts engine primitives themselves.

## Current State Analysis

- **No integration test layer exists.** `vitest.config.ts` is a flat single
  config: `environment: "node"`, `include: ["src/**/*.test.ts"]`, no
  `setupFiles`, no env loading, `@`→`./src` alias. The 9 existing unit tests are
  pure-logic helpers colocated in `src/lib/` (`vitest.config.ts:8-18`,
  `package.json:13-14`).
- **Overlap (#2) is enforced at the DB**, not in app code: constraint
  `reservations_no_overlap` (`supabase/migrations/20260603155136_booking_integrity_data.sql:124-129`)
  over a generated `tsrange` with half-open `[pickup 14:00, return 10:00)`
  bounds (`:104-106`). Violations raise `23P01`; the
  `create_reservation_request` RPC catches it → `'conflict'`
  (`20260613090000_reservation_b2b_fields.sql:86-89`). The pure mirror in
  `src/lib/availability.ts` is already exhaustively unit-tested
  (`src/lib/availability.test.ts`) — **do not duplicate it**.
- **RLS for reservations is asymmetric.** The table SELECT policy is
  `reservations_select_authenticated USING (true)` — the literal
  "logged-in == allowed" anti-pattern with no row filter and no role check
  (`20260603155136...:155-158`). The app never reads the table directly (only
  via SECURITY DEFINER RPCs), so this is invisible in normal use. **If the
  schema-wide base `SELECT` grant for `authenticated` exists** (the middleware's
  direct `from("profiles").select("role")` at `src/middleware.ts:22` strongly
  implies it does), any authed user — including one with no `profiles` row
  (`role = null`) — can `from("reservations").select("*")` and read every
  customer's name/email/phone. This is the **F1 finding**.
- **Role is a table lookup, not a JWT claim.** `public.current_app_role()`
  (`20260604153139_employee_admin_roles.sql:47-55`) reads
  `profiles.role where user_id = auth.uid()`; no `profiles` row → `role = null`
  → fail-closed. Authorization tests must seed/teardown a `profiles` row, never
  mint a role claim.
- **Client model is RLS-only.** One factory `src/lib/supabase.ts:7-26` (anon key
  + cookie SSR, imports `astro:env/server`, returns `null` when unconfigured).
  **No service-role key anywhere in app code** (`astro.config.mjs:47-52`
  declares only `SUPABASE_URL`/`SUPABASE_KEY`). RLS *is* the security boundary,
  which makes "a service-role client masking the gap" a real harness hazard.
- **Fixtures exist.** `supabase/seed.sql` seeds signable `admin@fleetrent.test`
  and `employee@fleetrent.test` (fixed UUIDs, `profiles` rows,
  `enable_confirmations=false`) plus a same-day-turnover reservation pair on the
  Sprinter (`seed.sql:108-121,162-206`). Missing: a `role = null` fixture.
- **Local Supabase config** (`supabase/config.toml`): db `54322`, api `54321`,
  `[db.seed]` auto-loads `seed.sql` on `db reset`, `enable_signup=false`,
  `enable_confirmations=false`, `jwt_expiry=3600`,
  `rate_limit.sign_in_sign_ups=30/5min`.

## Desired End State

- `npm test` runs only the fast pure-unit project (unchanged behavior, current
  `src/**/*.test.ts` glob) — no DB dependency, CI-safe today.
- `npm run test:integration` runs a new serial integration project against local
  Supabase, covering the overlap constraint (#2) and the RLS access matrix (#1).
- A reusable client-factory helper exists (`anonClient`, `serviceClient` for
  setup/teardown only, `as(role)` via `signInWithPassword`).
- `seed.sql` carries a permanent `norole@fleetrent.test` fixture (authed, no
  `profiles` row).
- `context/foundation/test-plan.md` §6.2 is filled in (no longer "TBD").
- The F1 PII-leak finding is captured as an artifact with a recommended
  follow-up change; the "employee == admin for reservation PII" question is
  flagged.

**Verification:** `npm test` green and DB-free; `npm run test:integration` green
against a freshly `db reset` local Supabase; the overlap suite proves
reject-overlap + allow-turnover; the RLS suite asserts the full role matrix and
records the direct-table probe result.

### Key Discoveries:

- GiST `EXCLUDE` constraint `reservations_no_overlap`
  (`supabase/migrations/20260603155136_booking_integrity_data.sql:124-129`) is
  the enforcement mechanism for #2; `23P01` is the rejection signal.
- Generated `reserved_period tsrange ... '[)'`
  (`...20260603155136...:104-106`) — half-open window is *why* same-day turnover
  is legal with no off-by-one.
- `reservations_select_authenticated USING (true)`
  (`...20260603155136...:155-158`) is the leak surface; the grant question is
  now **resolved** — the planning probe confirmed `authenticated` holds the
  implicit schema-wide SELECT grant, so the leak is real. Phase 3 closes it.
- RPC access matrix (`research.md` §B): `get_reservation_status` (token, anon-OK,
  name+email), `list_pending_reservations` (staff-gated, full PII),
  `list_reservations_for_calendar` (staff-gated, name only).
- Seed-user pattern to mirror for the null-role fixture: `auth.users` +
  `auth.identities` + (normally) `profiles` — omit the `profiles` insert
  (`supabase/seed.sql:162-206`).
- Vitest 4 `projects` API (Context7, checked 2026-06-27): `test.projects[]`,
  each with its own `name`/`include`/`setupFiles`; serial via
  `fileParallelism: false`; run one via `vitest run --project integration`.
- `availability.test.ts` already covers both turnover directions, true overlap,
  nested, identical, adjacency — the integration suite owns only the DB+RPC
  layer.

## What We're NOT Doing

- **Not revoking the over-broad WRITE grants** (INSERT/UPDATE/DELETE for
  anon/authenticated on `reservations`). The same schema-wide default also
  over-grants writes, but write authorization is test-plan §3 Phase 2's scope
  (risks #4/#5). This change fixes only the confirmed **SELECT** (PII read)
  leak; the write over-grants are flagged in the finding for Phase 2. (Writes
  are mitigated today: they still hit the GiST constraint, and the blanket
  UPDATE/DELETE policies were already dropped — see research §B.)
- **Not re-testing the pure overlap rule** (`src/lib/availability.ts`) — already
  unit-tested. No interval-math assertions in the integration suite.
- **Not testing Supabase/Postgres engine primitives** (that `&&` overlaps, that
  RLS enforces, that `security definer` bypasses) — only our configuration of
  them.
- **Not wiring CI** for the integration gate — that is test-plan §3 Phase 5. We
  add the script and keep `npm test` DB-free so today's CI stays green.
- **Not adding e2e / Playwright / a vision layer** — deferred (test-plan §7).
- **Not building protocol/photo email tests** — no surface exists yet (S-05/S-06
  unbuilt; test-plan §3 Phase 4).
- **Not parallelizing integration tests** — the GiST write-constraint forces
  serial execution.

## Implementation Approach

Build the harness foundation first (config split, env, client helper, the
null-role fixture) and prove it with a connectivity smoke test before writing
any risk assertions. Then add the overlap suite (#2) and the RLS matrix suite
(#1) as separate files, each owning a disposable data scope cleaned up via a
service-role client in `afterEach`/`afterAll`. Finally, fill the cookbook and
write up the leak finding. Service-role is used **only** for setup/teardown;
every *access assertion* runs on anon-key + JWT clients so it can never mask a
gap.

## Critical Implementation Details

- **Service-role isolation invariant.** The `serviceClient()` helper exists for
  setup/teardown only. No test's *access assertion* may run through it — doing
  so bypasses RLS and would make a PII-leak test pass falsely. This is the
  single most important harness discipline (research §E, Architecture Insights).
- **Vitest `projects` config shape.** Under `test.projects`, per-project options
  live inside each entry's own `test` block; root-level `test` options do not
  cascade into projects. Keep `resolve.alias` at the root, and give each project
  its own `name`/`include` (and `setupFiles`/`fileParallelism` for integration).
  Run a single project with `vitest run --project <name>`.
- **Disposable data scope to dodge the GiST constraint.** Overlap tests must not
  collide with seeded rows. Use a dedicated test vehicle (or a far-future date
  window on a known vehicle) that no seed row touches, and delete created rows in
  teardown. Inserts also hit `unique` on `reference`/`access_token` — generate
  unique values per insert.
- **`role = null` is the sharpest probe.** The null-role fixture proves both
  fail-closed RPC behavior *and* exposes the F1 grant hole if present; it must
  have an `auth.users` + `auth.identities` row but deliberately **no**
  `profiles` row.

## Phase 1: Harness Scaffolding

### Overview

Establish the integration-test foundation: dependency + env loading, the
Vitest unit/integration project split, the client-factory helper, the
permanent null-role seed fixture, and a connectivity smoke test that proves the
wiring end-to-end.

### Changes Required:

#### 1. Test env loading

**File**: `package.json`, `.env.test.example` (new), `.gitignore`

**Intent**: Add `dotenv` as a dev dependency so the integration setup can load
local Supabase credentials from a gitignored `.env.test`; commit a
`.env.test.example` documenting the required keys; ensure `.env.test` is
gitignored.

**Contract**: `.env.test.example` declares `SUPABASE_URL`, `SUPABASE_ANON_KEY`,
`SUPABASE_SERVICE_ROLE_KEY` with the local-Supabase placeholder values sourced
from `npx supabase status`. `.gitignore` ignores `.env.test` (but not the
example).

#### 2. Vitest project split

**File**: `vitest.config.ts`

**Intent**: Split the single config into two named projects — `unit` (preserves
today's `src/**/*.test.ts` behavior, no DB) and `integration` (new
`tests/integration/` glob, serial, with a setup file). Keep `resolve.alias` at
the root so both projects resolve imports identically.

**Contract**: `test.projects` array with `{ test: { name: "unit", include:
["src/**/*.test.ts"], environment: "node" } }` and `{ test: { name:
"integration", include: ["tests/integration/**/*.test.ts"], environment:
"node", setupFiles: ["tests/integration/setup.ts"], fileParallelism: false } }`.
`npm test` (`vitest run`) must continue to run the unit project DB-free —
constrain the default run to the unit project (e.g. the `test` script runs
`vitest run --project unit`), and add `test:integration` →
`vitest run --project integration`.

#### 3. Integration setup file

**File**: `tests/integration/setup.ts` (new)

**Intent**: Load `.env.test` via `dotenv` and fail fast with a clear message if
any required key is missing, so a misconfigured machine gets an actionable error
rather than an opaque connection failure.

**Contract**: Imported by the integration project's `setupFiles`. Calls
`dotenv.config({ path: ".env.test" })`; asserts `SUPABASE_URL`,
`SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` are present; throws a
descriptive error naming `.env.test.example` and `npx supabase status` when not.

#### 4. Client-factory helper

**File**: `tests/helpers/clients.ts` (new)

**Intent**: Provide the JWT/anon client factories the access assertions need,
built directly on `@supabase/supabase-js` (cannot reuse `src/lib/supabase.ts` —
it is SSR/cookie-bound and imports `astro:env/server`). Encode the service-role
isolation invariant in naming + doc comment.

**Contract**: Exports `anonClient()` (anon key, no session),
`as(role: "admin" | "employee" | "norole")` (anon-key client authenticated via
`signInWithPassword` using the seeded creds, returns the signed-in client), and
`serviceClient()` (service-role key) with a doc comment stating
**setup/teardown only — never use for access assertions**. Seeded credentials
table lives as a constant in this file.

#### 5. Null-role seed fixture

**File**: `supabase/seed.sql`

**Intent**: Add a third permanent, signable seed user `norole@fleetrent.test`
with an `auth.users` row and an `auth.identities` row but **no** `profiles` row,
so `current_app_role()` resolves to `null` (fail-closed) and the F1 grant probe
has a deterministic subject.

**Contract**: Mirrors the existing seed-user pattern
(`supabase/seed.sql:162-206`) — fixed UUID, bcrypt password via
`crypt(..., gen_salt('bf'))`, `email_confirmed_at` set, matching
`auth.identities` row — but is deliberately **absent** from the
`insert into profiles` list. Credential added to the helper's creds constant.

#### 6. Connectivity smoke test

**File**: `tests/integration/smoke.test.ts` (new)

**Intent**: Prove the whole harness wires up before any risk assertions exist:
env loads, the anon client connects, and each seeded role signs in (including
`norole`).

**Contract**: A `describe` that asserts `anonClient()` can read a public vehicle
(`vehicles_select_anon` allows active rows), and that `as("admin")`,
`as("employee")`, and `as("norole")` each return a session with the expected
`auth.uid()`. No PII or overlap assertions yet.

### Success Criteria:

#### Automated Verification:

- Unit project still passes and is DB-free: `npm test`
- Integration project runs and the smoke test passes against a reset DB:
  `npx supabase db reset && npm run test:integration`
- Lint passes: `npm run lint`
- `npm test` does NOT require Supabase running (kill local Supabase, `npm test`
  still green)

#### Manual Verification:

- `npx supabase status` keys copied into `.env.test` produce a passing smoke run
- `.env.test` is gitignored (`git status` shows it untracked-and-ignored, not
  staged)
- A fresh `db reset` makes all three seeded roles (admin/employee/norole)
  signable

**Implementation Note**: After automated verification passes, pause for manual
confirmation before Phase 2.

---

## Phase 2: Overlap Constraint Suite (Risk #2)

### Overview

Prove the double-booking protection at the DB + RPC layer: an overlapping
reservation is rejected, a same-day turnover is allowed, and cancelled/rejected
rows do not block. Drive the real `create_reservation_request` path; clean up
created rows via service-role teardown.

### Changes Required:

#### 1. Overlap integration suite

**File**: `tests/integration/reservations-overlap.test.ts` (new)

**Intent**: Assert the `reservations_no_overlap` constraint's accept/reject
decisions through the service insert path, using a disposable data scope that
never collides with seeded rows.

**Contract**: Cases —
(a) baseline booking succeeds (`create_reservation_request` → `created`);
(b) an overlapping booking on the same vehicle is rejected (RPC result
`conflict`, i.e. the `23P01` path);
(c) a same-day turnover (return-day 10:00 / pickup-day 14:00) on the same
vehicle is **allowed** (`created`), proving the `[)` half-open window;
(d) a `cancelled`/`rejected` row does not block a new overlapping booking
(partial-WHERE constraint).
Each test owns a dedicated test vehicle or far-future date window and unique
`reference`/`access_token` values; `afterEach`/`afterAll` deletes created rows
via `serviceClient()`. Inputs route through `createReservationRequest` in
`src/lib/services/reservations.ts` (or the RPC directly) — the oracle is the DB
constraint, not the pure rule.

### Success Criteria:

#### Automated Verification:

- Overlap suite passes: `npm run test:integration`
- The reject case asserts the `conflict` result (not a raw exception leaking)
- Re-running the suite twice in a row stays green (teardown is idempotent):
  `npm run test:integration && npm run test:integration`

#### Manual Verification:

- After a suite run, `select count(*)` on the disposable scope shows no leftover
  test rows (teardown verified)
- Temporarily widening the turnover case to a true overlap makes it fail (the
  test can actually catch a regression)

**Implementation Note**: After automated verification passes, pause for manual
confirmation before Phase 3.

---

## Phase 3: Close the PII Leak (Risk #1) — Regression Suite + Fix Migration

### Overview

Assert the per-role reservation-PII access matrix across both surfaces — the
SECURITY DEFINER RPCs (the real app paths) and the raw table SELECT (the leak
surface) — asserting the **secure** behavior, then ship the migration that makes
the direct-table assertion pass. The leak is already confirmed (planning probe:
an authenticated role-null user reads all customer PII off the table). The
test-then-fix is co-located in this phase: the direct-table assertion is the
regression guard, the migration is the fix. Assertions run exclusively on
anon-key + JWT clients; `serviceClient()` is setup/teardown only.

**Implementation ordering within the phase**: write the suite first (the
direct-table cases will be RED against today's schema), then add the migration
and `db reset`, which turns them GREEN. The phase's automated verification is the
full suite green *after* the migration lands.

### Changes Required:

#### 1. RLS access-matrix suite

**File**: `tests/integration/reservations-rls.test.ts` (new)

**Intent**: Prove each role reads exactly the reservation PII its policies + RPC
gates allow, and guard the closed leak against regression.

**Contract**: Cases —
(a) **anon, no token** → `get_reservation_status` with an unknown token returns
0 rows; no token-less anon PII path exists;
(b) **anon/any caller with a valid token** → `get_reservation_status` returns
exactly one customer's name+email (the `/r/<token>` path);
(c) **employee** and **admin** → `list_pending_reservations` returns full-PII
rows; `list_reservations_for_calendar` returns name-only rows;
(d) **norole (role-null)** and a logged-in non-staff caller →
`list_pending_reservations` / `list_reservations_for_calendar` return **0 rows**
(fail-closed RPC gate);
(e) **direct-table secure assertion** (the regression guard) → as the `norole`
client, `from("reservations").select("*")` returns **0 rows / permission
denied**, and `has_table_privilege('authenticated','public.reservations',
'SELECT')` is **false**. This is the assertion the Phase-3 migration makes pass.
All access assertions use `anonClient()` / `as(...)`; `serviceClient()` only sets
up any needed rows and tears them down.

#### 2. Fix migration — revoke the SELECT leak

**File**: `supabase/migrations/<YYYYMMDDHHmmss>_reservations_revoke_select_grant.sql`
(new)

**Intent**: Close the confirmed PII leak by removing the direct-table SELECT
surface from `anon`/`authenticated`, so all reservation reads flow through the
SECURITY DEFINER RPCs (which run as the table owner and are unaffected). No app
code changes — verified during planning that the public booking flow and the
`/r/<token>` status page both go through RPCs.

**Contract**: `revoke select on public.reservations from anon, authenticated;`
plus `drop policy if exists reservations_select_authenticated on reservations;`
(remove the misleading `using(true)` policy so a future re-grant can't silently
re-open the hole). Scope is **SELECT only** — INSERT/UPDATE/DELETE grants are
deliberately left for test-plan Phase 2 (see "What We're NOT Doing"). Does
**not** touch any RPC, the overlap constraint, or the generated range. Proven
safe in a transactional planning probe: post-revoke, direct SELECT as
authenticated is BLOCKED while `create_reservation_request` as anon still returns
`created`.

### Success Criteria:

#### Automated Verification:

- After the migration + `db reset`, the full RLS suite (incl. the direct-table
  secure assertion) passes: `npx supabase db reset && npm run test:integration`
- The booking flow still works end-to-end via the RPC (covered by re-running the
  Phase 2 overlap suite, which drives `create_reservation_request`):
  `npm run test:integration`
- No assertion in the suite runs through `serviceClient()` (inspection: service
  client appears only in setup/teardown blocks)
- Lint passes: `npm run lint`

#### Manual Verification:

- Public booking flow works in the running app: submit a reservation via the
  site → a `pending` row is created (the `/r/<token>` page resolves)
- The staff queue (`list_pending_reservations`) still shows pending PII for an
  employee/admin login
- Swapping a staff assertion to expect rows for `norole` makes the suite fail
  (the gate is really being tested)

**Implementation Note**: After automated verification passes, pause for manual
confirmation before Phase 4.

---

## Phase 4: Cookbook + Leak Finding

### Overview

Fill the test-plan cookbook entry this rollout phase owns, capture the F1
PII-leak as a **found-and-fixed** finding (with the planning evidence + the
Phase 3 fix), and flag the residual write-grant gap (for Phase 2) and the
"employee == admin for reservation PII" open question.

### Changes Required:

#### 1. Fill cookbook §6.2

**File**: `context/foundation/test-plan.md`

**Intent**: Replace the §6.2 "TBD" placeholder with the concrete recipe for
adding a DB/RLS integration test, now that the harness exists.

**Contract**: §6.2 gains — **Location** (`tests/integration/`), **Naming**
(`<area>-<concern>.test.ts`), **Reference test** (the overlap suite from
Phase 2), **Run command** (`npm run test:integration`), and the
service-role-teardown-only + serial-execution conventions. Optionally add a §6.6
note capturing anything surprising the rollout taught.

#### 2. F1 leak finding artifact

**File**: `context/changes/testing-data-layer-integrity/finding-rls-pii-leak.md`
(new)

**Intent**: Record the direct-table PII-access leak as a durable
**found-and-fixed** artifact — the evidence, the root cause, and the fix shipped
in Phase 3 — plus the residual gaps deferred to later phases.

**Contract**: States the **confirmed** behavior (pre-fix: `authenticated`
role-null reads all 4 customer rows incl. name/email/phone; `anon` reads 0), the
risk (customer PII exposure to any logged-in account), the root cause
(`reservations_select_authenticated USING (true)` + the implicit schema-wide
`SELECT` grant the author wrongly believed absent — see
`list_pending_reservations.sql:4`), and the **fix applied** (Phase 3 migration:
revoke SELECT + drop the dead policy). Records two residual items: (1) the
INSERT/UPDATE/DELETE over-grants still present → test-plan §3 Phase 2 (write
authz, risks #4/#5); (2) open question — "employee == admin for all reservation
PII — intended?" (encoded as current reality, not changed here).

### Success Criteria:

#### Automated Verification:

- §6.2 no longer contains "TBD": `grep -n "6.2" context/foundation/test-plan.md`
  shows the filled recipe
- Finding artifact exists:
  `test -f context/changes/testing-data-layer-integrity/finding-rls-pii-leak.md`
- Lint/format of touched markdown passes (pre-commit `prettier`)

#### Manual Verification:

- The finding accurately reflects the confirmed leak + the Phase 3 fix
- The cookbook recipe is followable by someone adding a new integration test
  from scratch

**Implementation Note**: After automated verification passes, pause for manual
confirmation. This is the final phase.

---

## Testing Strategy

### Unit Tests:

- Unchanged — the pure overlap rule stays covered by `src/lib/availability.test.ts`.
  No new unit tests; this rollout phase is integration.

### Integration Tests:

- Overlap (#2): reject-overlap, allow-turnover, cancelled/rejected non-blocking,
  via the real RPC/service path against a disposable scope.
- RLS (#1): the per-role access matrix across RPCs + the raw-table probe, on
  anon-key + JWT clients only.

### Manual Testing Steps:

1. `npx supabase status`, copy keys into `.env.test`.
2. `npx supabase db reset` (loads seed incl. the new `norole` user).
3. `npm test` — unit project green, no Supabase needed.
4. `npm run test:integration` — smoke + overlap + RLS green (incl. the
   direct-table secure assertion that the Phase 3 migration enables).
5. In the running app, submit a public reservation → confirm a `pending` row is
   created and the `/r/<token>` page resolves (the fix doesn't break booking).
6. Confirm no leftover test rows after the integration run.

## Performance Considerations

Integration tests run **serial** (`fileParallelism: false`) by necessity — the
GiST `EXCLUDE` constraint makes concurrent reservation writes collide. This is
slower but correct; the unit project remains fast and parallel and is what the
default `npm test` (and today's CI) runs.

## Migration Notes

- `seed.sql` gains a permanent `norole@fleetrent.test` fixture; existing seeded
  rows are unchanged. A `db reset` is required after this change to pick it up.
- **One schema migration (Phase 3)**:
  `<ts>_reservations_revoke_select_grant.sql` — `revoke select on reservations
  from anon, authenticated` + `drop policy reservations_select_authenticated`.
  Forward-only; reversible by a symmetric `grant`/`create policy` if ever
  needed. No data migration. All reservation reads already route through
  SECURITY DEFINER RPCs, so no app code changes and the public booking flow is
  unaffected (verified by a transactional planning probe).

## References

- Related research: `context/changes/testing-data-layer-integrity/research.md`
- Test plan (risks #1/#2, §3 Phase 1, §6.2 cookbook slot):
  `context/foundation/test-plan.md`
- Overlap constraint + range:
  `supabase/migrations/20260603155136_booking_integrity_data.sql:104-106,124-129`
- Leak surface policy: `supabase/migrations/20260603155136_booking_integrity_data.sql:155-158`
- `create_reservation_request` RPC (catches `23P01`):
  `supabase/migrations/20260613090000_reservation_b2b_fields.sql:34-98`
- Role helper: `supabase/migrations/20260604153139_employee_admin_roles.sql:47-55`
- Service path: `src/lib/services/reservations.ts:40-76`
- Seed-user pattern to mirror: `supabase/seed.sql:162-206`
- Current Vitest config: `vitest.config.ts:8-18`
- Confirmed-leak evidence (planning probe): an `authenticated` role-null client
  reads all 4 customer rows off `reservations`; `anon` reads 0; the fix
  (`revoke select` + `drop policy`) blocks the direct read while the anon
  booking RPC still returns `created` — both verified transactionally against
  local Supabase during planning.
- Lessons: `context/foundation/lessons.md` — the RLS `(select …)` wrapping
  lesson does NOT apply to the Phase 3 fix (we *revoke the grant + drop* the
  policy rather than add a per-row role check, so there's no caller predicate to
  wrap).

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Harness Scaffolding

#### Automated

- [x] 1.1 Unit project still passes and is DB-free: `npm test` — f2e7e16
- [x] 1.2 Integration project runs and smoke test passes against a reset DB: `npx supabase db reset && npm run test:integration` — f2e7e16
- [x] 1.3 Lint passes: `npm run lint` — f2e7e16
- [x] 1.4 `npm test` does NOT require Supabase running (Supabase down, `npm test` still green) — f2e7e16

#### Manual

- [x] 1.5 `npx supabase status` keys in `.env.test` produce a passing smoke run — f2e7e16
- [x] 1.6 `.env.test` is gitignored (untracked-and-ignored, not staged) — f2e7e16
- [x] 1.7 A fresh `db reset` makes all three seeded roles signable — f2e7e16

### Phase 2: Overlap Constraint Suite (Risk #2)

#### Automated

- [x] 2.1 Overlap suite passes: `npm run test:integration`
- [x] 2.2 The reject case asserts the `conflict` result (not a raw exception)
- [x] 2.3 Re-running the suite twice stays green (idempotent teardown)

#### Manual

- [ ] 2.4 No leftover test rows in the disposable scope after a run
- [ ] 2.5 Widening the turnover case to a true overlap makes it fail

### Phase 3: Close the PII Leak (Risk #1) — Regression Suite + Fix Migration

#### Automated

- [ ] 3.1 RLS suite + fix migration green after `db reset`: `npx supabase db reset && npm run test:integration`
- [ ] 3.2 Booking flow still works via the RPC (Phase 2 overlap suite re-passes): `npm run test:integration`
- [ ] 3.3 No access assertion runs through `serviceClient()` (setup/teardown only)
- [ ] 3.4 Lint passes: `npm run lint`

#### Manual

- [ ] 3.5 Public booking in the running app creates a `pending` row; `/r/<token>` resolves
- [ ] 3.6 Staff queue still shows pending PII for an employee/admin login
- [ ] 3.7 Expecting rows for `norole` on a staff RPC makes the suite fail

### Phase 4: Cookbook + Leak Finding

#### Automated

- [ ] 4.1 §6.2 no longer contains "TBD" (filled recipe present)
- [ ] 4.2 Finding artifact exists: `finding-rls-pii-leak.md`
- [ ] 4.3 Lint/format of touched markdown passes

#### Manual

- [ ] 4.4 The finding accurately reflects the confirmed leak + the Phase 3 fix
- [ ] 4.5 The cookbook recipe is followable from scratch
