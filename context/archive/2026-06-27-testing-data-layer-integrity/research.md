---
date: 2026-06-27T13:16:26+0200
researcher: MarcinK
git_commit: 5293eb5e7beff2cb31648ff43e48de56a3bb599e
branch: main
repository: yakksiek/car-rental
topic: "Data-layer integrity harness — RLS PII isolation (#1) + reservation overlap constraint (#2)"
tags: [research, codebase, rls, supabase, reservations, overlap, integration-tests, test-plan-phase-1]
status: complete
last_updated: 2026-06-27
last_updated_by: MarcinK
---

# Research: Data-layer integrity harness — RLS PII isolation (#1) + reservation overlap (#2)

**Date**: 2026-06-27T13:16:26+0200
**Researcher**: MarcinK
**Git Commit**: 5293eb5e7beff2cb31648ff43e48de56a3bb599e
**Branch**: main
**Repository**: yakksiek/car-rental

## Research Question

Rollout Phase 1 of `context/foundation/test-plan.md` — "Data-layer integrity harness + RLS/overlap". Ground, against current code, the two risks the integration suite must cover:

- **#1 (RLS PII leak):** prove each role (anon / employee / admin) gets exactly the rows policy allows, and a wrong-role SELECT returns 0 PII rows. Do **not** accept "logged in == allowed"; watch for a service-role client masking the gap.
- **#2 (double-booking):** prove a second overlapping reservation is rejected at the DB while a same-day return-10:00 / pickup-14:00 turnover is allowed. The residual risk is the DB constraint + service insert path — **not** the already-unit-tested pure rule.

## Summary

The harness is **well-supported by existing infrastructure** and has **one high-severity finding** that should become its headline assertion.

1. **Overlap (#2) is enforced at the DB by a real GiST `EXCLUDE` constraint** — `reservations_no_overlap`, over `(vehicle_id =, reserved_period &&)` where `status in ('pending','confirmed')`. `reserved_period` is a **generated `tsrange` with half-open `[pickup 14:00, return 10:00)` bounds**, which is exactly what makes same-day turnover legal with no off-by-one. The pure rule (`src/lib/availability.ts`) is already exhaustively unit-tested; the new test must drive the **DB constraint + the `create_reservation_request` RPC / service path**, not re-assert interval math.

2. **RLS (#1) for reservations is enforced in SECURITY DEFINER RPCs, not in the table policy.** The table's SELECT policy is `reservations_select_authenticated USING (true)` — the literal "logged-in == allowed" anti-pattern, gating on *nothing*. The app never reads `reservations` directly (only via RPCs), so this is invisible in normal use. **But if the default Supabase base-table `SELECT` grant for `authenticated` exists on `reservations` (it almost certainly does — middleware relies on the equivalent grant for `profiles`), then any authenticated user — including one with no `profiles` row / `role = null` — can run `from('reservations').select('*')` and read every customer's name/email/phone.** This is the single highest-value thing the harness must probe, empirically (`has_table_privilege` + an actual direct SELECT as a non-staff authed client). Do not trust the migration comment claiming "no table SELECT grant"; prove it.

3. **Client model is RLS-only.** There is exactly one client factory (`src/lib/supabase.ts`, anon key + cookie SSR session). **No service-role key is wired into app code anywhere.** Production access is governed entirely by RLS (+ an app-layer role gate in middleware). The harness must therefore use **anon-key + per-user JWT** clients for all assertions; a service-role client may be used *only* for setup/teardown, never for the access assertions (it bypasses RLS and would make PII-leak tests pass falsely).

4. **Fixtures already exist.** `supabase/seed.sql` seeds signable-in `admin@fleetrent.test` and `employee@fleetrent.test` users (fixed UUIDs, `profiles` rows, `enable_confirmations=false` so `signInWithPassword` works immediately), plus a same-day-turnover reservation pair on the Sprinter. The role is a **`profiles.role` table lookup** via `public.current_app_role()`, **not** a JWT claim.

5. **What must be built:** an integration-test config/separation (current `vitest.config.ts` globs only `src/**/*.test.ts`, node env, no setup file), a client-factory test helper (can't reuse `src/lib/supabase.ts` — it's SSR/cookie-bound and imports `astro:env/server`, unresolvable in plain Vitest), a test env loader (`process.env`/dotenv — no `dotenv` installed, no `.env.test`), and a test-data isolation/teardown strategy. CI wiring of a Postgres/Supabase service is a named gap but belongs to Phase 5.

## Detailed Findings

### A. PII surface — what the test protects (Risk #1)

Only **two** tables hold identity data; only one holds **customer** PII.

- **`reservations`** — the customer PII table and the test's primary target. Defined `supabase/migrations/20260603155136_booking_integrity_data.sql:87-110`. PII columns: `customer_name` (`:91`), `customer_email` (`:92`), `customer_phone` (`:93`); plus `access_token` uuid (`20260611171737_public_reservation_request.sql:23` — a bearer secret granting PII read via RPC), `company` / `vat_id` / `notes` (`20260613090000_reservation_b2b_fields.sql:18-20`), `rejection_note` (`20260617120000_reservation_approval.sql:24`).
- **`profiles`** — staff-identity → role mapping, `20260604153139_employee_admin_roles.sql:25-30`. Holds `user_id` + `role` only; no customer PII (names/emails live in `auth.users`).
- **No handover / protocol / photo-of-customer tables exist yet.** `vehicles.photos text[]` (`20260603155136...:62`) is **catalog imagery**, publicly readable for active vehicles — intentionally non-PII. The brief's "protocol photos" have **no current surface to test** (S-05/S-06 not built).

### B. RLS policy inventory (Risk #1 oracle)

RLS is **ENABLED** on every policied table: `vehicles` (`20260603155136...:135`), `reservations` (`:136`), `profiles` (`20260604153139...:61`). No policied-but-RLS-disabled table exists.

**`reservations` (the PII table) — current live policies:**

| Policy | Cmd | Role | Predicate | Defined |
|---|---|---|---|---|
| `reservations_select_authenticated` | SELECT | `authenticated` | `using (true)` | `20260603155136...:155-158` |
| `reservations_insert_authenticated` | INSERT | `authenticated` | `with check (true)` | `20260603155136...:160-163` |
| ~~`reservations_update_authenticated`~~ | UPDATE | authenticated | `using(true) with check(true)` | created `:165-169`, **DROPPED** `20260617120000...:167` |
| ~~`reservations_delete_authenticated`~~ | DELETE | authenticated | `using(true)` | created `:171-174`, **DROPPED** `20260617120000...:168` |

- **No `anon` policy** on `reservations` → anon denied by default (deny-by-default).
- `using (true)` imposes **no row filter and no role check** on any authenticated caller. The UPDATE/DELETE blanket policies were deliberately dropped in S-03, routing all writes through the role-gated `decide_reservation` RPC — but **SELECT was left as `using(true)`**.

**The actual app PII paths are SECURITY DEFINER RPCs, not direct table reads** (`src/lib/services/reservations.ts` uses only `.rpc(...)`):

| RPC | grant | role gate inside | PII returned | who gets rows |
|---|---|---|---|---|
| `get_reservation_status(p_token)` `20260611190621...:15-43` | anon+authenticated | **none** — token is the authority | name + email (no phone) | anyone with a valid `access_token` (incl. anon); unknown token → 0 rows |
| `list_pending_reservations()` `20260617121000...:14-50` | authenticated | `current_app_role() in ('employee','admin')` | name+email+**phone**+company+vat+notes | staff: all pending; non-staff authed: **0 rows** |
| `list_reservations_for_calendar(start,end)` `20260617122000...:10-37` | authenticated | `current_app_role() in ('employee','admin')` | name only | staff: matching rows; non-staff: 0 rows |
| `decide_reservation(...)` `20260617120000...:60-157` | authenticated | role in staff else `'unauthorized'` | name+email on success | staff only |
| `available_vehicles` / `get_vehicle_busy_ranges` | anon+authenticated | none | **no PII** (dates/vehicle only) | everyone |

**Vehicles** (context, not PII): `vehicles_select_anon USING (is_active = true)` (`20260603155136...:140-143`); `vehicles_select_authenticated USING (true)` (`20260625120000_fleet_management.sql:26-31`); staff-gated INSERT/UPDATE via `(select public.current_app_role()) in ('employee','admin')` (`20260625120000...:35-44`, InitPlan-rewritten `20260627120000...:44-49`).

**Profiles**: SELECT `using (user_id = (select auth.uid()) or (select public.current_app_role()) = 'admin')` (`20260604153139...:69-72` → `20260627120000...:27-28`); INSERT/UPDATE/DELETE admin-only. No anon policy.

### C. Role mechanism (Risk #1)

- **Role is a DB table lookup, NOT a JWT claim.** Helper `public.current_app_role()` — `20260604153139...:47-55` — `language sql stable security definer set search_path = ''`, body `select role from public.profiles where user_id = auth.uid();`. The only thing taken from the JWT is `auth.uid()` (the `sub` claim) + the `authenticated` Postgres role.
- `SECURITY DEFINER` is load-bearing: it bypasses RLS so a role check inside a `profiles` policy doesn't recurse (`:42-46`).
- A user with **no `profiles` row resolves to `role = null` → fail-closed, denied** (`:22-24`).
- App layer mirrors this independently in `src/middleware.ts:21-26` (`from("profiles").select("role")` → `context.locals.role`), gating routes via `src/lib/access.ts`. Defense-in-depth, separate from DB RLS/RPC enforcement.
- Sign-in is vanilla `signInWithPassword` (`src/pages/api/auth/signin.ts:22`); no custom-claims hook (`supabase/config.toml:269-272` disabled); signup refused (`signup.ts:8-12`).

### D. Per-role access matrix (the test oracle)

Two surfaces must be asserted: **(i) direct table SELECT** (the leak risk) and **(ii) the RPCs** (the real app paths).

**(i) Direct `SELECT` on the table:**

| Table | anon | employee | admin |
|---|---|---|---|
| `reservations` (PII) | **none** (no anon policy) | **ALL rows** per `using(true)` — *iff base grant exists; see F1* | **ALL rows** per `using(true)` — *iff base grant exists* |
| `vehicles` | active only | all | all |
| `profiles` | none | own row only | own + all (admin branch) |

**(ii) RPC access** — see the table in §B. Boundary answers:
- *anon reads customer PII?* Only via `get_reservation_status` **with a valid token** (one customer's name+email). No token-less anon PII path, no direct-table path.
- *employee reads customer PII?* Yes — full PII via `list_pending_reservations` / `decide_reservation`. **Employee == admin for all reservation PII** (no admin-only narrowing on reservations).
- *own-reservation-by-token public path?* Yes — `get_reservation_status(p_token)`, the `/r/<token>` page.

### E. Client wiring (Risk #1 — the "service-role masking" guard)

- **One factory:** `createClient(requestHeaders, cookies)` — `src/lib/supabase.ts:7-26` — uses **`SUPABASE_KEY` (anon)** from `astro:env/server` (`:3`), via `@supabase/ssr`'s `createServerClient` (cookie-based SSR). Returns **`null`** when env missing (`:8-10`).
- **No service-role key anywhere.** `astro.config.mjs:49-50` declares only `SUPABASE_URL` + `SUPABASE_KEY` (optional server secrets). Grep over `src/` for `service[_-]?role` / `SERVICE_ROLE` / `auth.admin` / `createClient(`: **zero** RLS-bypass hits. Migrations/seed bypass RLS by **table ownership** (the migration runner), not via an app service-role client (`20260604153139...:64-66`, `seed.sql:157`).
- **Request → authed client:** `src/middleware.ts:6` builds the per-request anon client carrying the JWT cookie; `:13-17` `getUser()` resolves the user; all subsequent queries run as `auth.uid()` with role `authenticated`.
- **Harness recommendation:** build **anon-key + real per-user JWT** clients via `@supabase/supabase-js` directly (not `src/lib/supabase.ts`, which is SSR/cookie-bound and imports `astro:env/server`). `anonClient()` (no session), `employee`/`admin` via `signInWithPassword` with seeded creds, **plus a fourth fixture: an authenticated user with NO `profiles` row (role = null)** to prove fail-closed and to expose the F1 grant hole if present. A service-role client is acceptable **only** for setup/teardown.

### F. Overlap enforcement (Risk #2)

**The DB constraint** — `supabase/migrations/20260603155136_booking_integrity_data.sql:124-129`:

```sql
alter table reservations
  add constraint reservations_no_overlap
  exclude using gist (
    vehicle_id with =,
    reserved_period with &&
  ) where (status in ('pending', 'confirmed'));
```

- `btree_gist` enabled at `:9`. Violations raise SQLSTATE **`23P01`** (`exclusion_violation`). Never altered/dropped in any later migration.
- **The range** — generated stored column `:104-106`:
  ```sql
  reserved_period tsrange generated always as (
    tsrange(pickup_date + time '14:00', return_date + time '10:00', '[)')
  ) stored,
  ```
  Type `tsrange` (timestamp w/o tz — naive wall-clock so the expression stays IMMUTABLE, comment `:97-103`). **Half-open `[)`**: lower `pickup 14:00` inclusive, upper `return 10:00` exclusive. The 14:00/10:00 hours are a built-in turnover buffer.

**Schema/status** (`20260603155136...:87-110`): time window is **dates only** (`pickup_date`/`return_date`, `:94-95`); hours are hard-coded in the generated range, not stored. CHECK `return_date >= pickup_date` (`:109`). Status enum `('pending','confirmed','rejected','cancelled')` (`:23-28`). **Overlap applies only to `pending`/`confirmed`** (partial WHERE); cancelled/rejected rows do NOT block (`:123`).

**Service insert path** (the path the test drives) — `src/lib/services/reservations.ts:40-76`, `createReservationRequest()`: calls `client.rpc("create_reservation_request", {...})` (`:48-59`) and maps the result tag → `"created"` / `"conflict"` / `"unavailable"` (`:66-75`); null client / bad UUID → `unavailable` (`:44-46`). The RPC (current def `20260613090000_reservation_b2b_fields.sql:34-98`, replacing `20260611171737...:79-137`) checks vehicle exists+active (`:57-63`), **attempts the INSERT** with `status='pending'` (`:71-82`, never check-then-insert → race-free), catches `23P01` → `'conflict'` (`:86-89`), retries reference-code `unique_violation` up to 3× (`:90-94`). Granted to `anon, authenticated`, `security definer`. HTTP surface: `src/pages/api/reservations.ts`.

**Boundary / off-by-one analysis:** there is **no off-by-one** — both the DB range and the pure mirror use identical `[)` half-open `[14:00, 10:00)`. Base `[pickup, return)` = `[08-05 14:00, 08-10 10:00)`. New booking picking up on the base's return day → `[08-10 14:00, …)`: start `>=` exclusive end `08-10 10:00` → no overlap → **allowed**. New booking returning on the base's pickup day → `[…, 08-05 10:00)`: exclusive end `<=` base start `08-05 14:00` → **allowed**. A closed `[]` upper bound would falsely collide on the shared boundary date — that's the off-by-one `[)` deliberately avoids.

**Already-unit-tested pure rule (do NOT duplicate):** `src/lib/availability.ts` — `bookingWindow()` (`:38-43`), `windowsOverlap()` (`:46-48`), `hasConflict()` (`:56-59`). Test `src/lib/availability.test.ts` covers it exhaustively incl. both same-day turnover directions (`:26-34`), true overlap/nested/identical (`:35-69`), adjacency `:96-100`, and the half-state calendar map (`:123-214`). The integration test owns the **DB constraint + RPC/service** layer only.

### G. Test harness state — what exists vs what to build

**Exists:**
- **Vitest** `^4.1.8`, `@supabase/supabase-js ^2.99.1`, `@supabase/ssr ^0.10.3`, supabase CLI `^2.23.4`, zod `^4.4.3` (`package.json`). Scripts `test`/`test:watch` (`:13-14`).
- `vitest.config.ts` — `environment: "node"`, `include: ["src/**/*.test.ts"]`, no `setupFiles`/`globals`/`exclude`/env loading; `@`→`./src` alias (`:9-13`). Comment scopes it to pure-logic units only (`:4-7`).
- 9 colocated unit tests in `src/lib/`. Conventions (from `availability.test.ts`, `access.test.ts`): `// core` / `// others` import groups; named `{ describe, expect, it }` from `"vitest"` (no globals → imports required); relative imports; `it.each` table-driven; fixed deterministic dates; leading risk-comment block. No shared fixtures/setup/DB helper exists.
- **Local Supabase** (`supabase/config.toml`): db `54322`, api `54321`, studio `54323`, major_version 17; `[db.seed]` enabled → auto-loads `seed.sql` on `db reset`; auth `enable_signup=false`, `enable_confirmations=false` (seeded users sign in immediately), `jwt_expiry=3600`, `rate_limit.sign_in_sign_ups=30/5min`.
- **Seeded role'd users** (`seed.sql:138-206`): `admin@fleetrent.test` / `Fl33tRent-Admin_2026!` (uuid `a0…ad`, role admin) and `employee@fleetrent.test` / `Fl33tRent-Employee_2026!` (uuid `e0…e0`, role employee), each with `auth.users` + `auth.identities` + `profiles` rows. Same-day-turnover reservation pair on the Sprinter at `seed.sql:108-121`; true-conflict negative data deliberately kept out of seed (lives in `context/changes/booking-integrity-data/verify-overlap.sql`).
- 13 migrations in `supabase/migrations/`.

**Must build (gaps):**
1. **Integration-test config/separation** — current glob ignores anything outside `src/`; add a Vitest `projects`/second config splitting `unit` (no DB) vs `integration` (DB, likely serial/single-thread to avoid EXCLUDE write races), plus an `integration` script.
2. **Client-factory test helper** (e.g. `tests/helpers/clients.ts`) — `anonClient()`, `serviceClient()` (setup/teardown only), `as(role)` via `signInWithPassword` with seeded creds. Cannot reuse `src/lib/supabase.ts` (SSR/cookie + `astro:env/server`).
3. **Test env loader** — `astro:env/server` won't resolve in plain Vitest; no `dotenv` installed; no `.env.test`. Need `process.env`/dotenv wiring carrying local `SUPABASE_URL` + anon + service-role keys (from `npx supabase status`).
4. **Test-data isolation/teardown** — shared seed; inserts hit the GiST constraint + unique `reference`/`access_token`; need per-test cleanup (service-role deletes) or txn rollback, plus a known-free vehicle/date window to avoid seeded-row collisions.
5. **CI Postgres/Supabase service** — `.github/workflows/ci.yml` runs only `astro sync + lint + build` and targets `master`; no DB service. Naming it here, but wiring is **Phase 5**, not this phase.
6. **Test placement convention** — pick `src/`-colocated vs a `tests/` dir and update the glob accordingly.

## Code References

- `supabase/migrations/20260603155136_booking_integrity_data.sql:104-106` — generated `reserved_period tsrange` `[14:00, 10:00)` half-open window
- `supabase/migrations/20260603155136_booking_integrity_data.sql:124-129` — `reservations_no_overlap` GiST EXCLUDE constraint (partial: pending/confirmed)
- `supabase/migrations/20260603155136_booking_integrity_data.sql:155-163` — `reservations_select/insert_authenticated USING/CHECK (true)` (the leak surface)
- `supabase/migrations/20260604153139_employee_admin_roles.sql:25-30,47-55` — `profiles` table + `current_app_role()` helper (role = table lookup)
- `supabase/migrations/20260611190621_status_read_customer_email.sql:15-43` — `get_reservation_status` token-scoped PII RPC (anon-reachable)
- `supabase/migrations/20260617121000_list_pending_reservations.sql:14-50` — staff-gated full-PII RPC
- `supabase/migrations/20260613090000_reservation_b2b_fields.sql:34-98` — current `create_reservation_request` RPC (catches 23P01 → conflict)
- `supabase/migrations/20260617120000_reservation_approval.sql:160-168` — dropped blanket UPDATE/DELETE policies (writes routed through `decide_reservation`)
- `src/lib/supabase.ts:7-26` — the sole client factory (anon key + cookie SSR; null when unconfigured)
- `src/middleware.ts:6-26` — request → authed anon client → `getUser()` → `profiles` role lookup
- `src/lib/services/reservations.ts:40-76` — `createReservationRequest()` service path (RPC + conflict mapping)
- `src/lib/availability.ts:38-59` + `src/lib/availability.test.ts:22-214` — pure overlap rule + its existing unit test (do not duplicate)
- `astro.config.mjs:47-52` — env schema (only `SUPABASE_URL`/`SUPABASE_KEY`; no service-role)
- `vitest.config.ts:9-18` — current node/unit-only config (`include: src/**/*.test.ts`)
- `supabase/config.toml:62-65,151-212` — `[db.seed]` + auth settings (signup off, confirmations off)
- `supabase/seed.sql:108-121,138-206` — turnover reservation pair + seeded admin/employee users with profiles

## Architecture Insights

- **Two-layer enforcement, asymmetric by table.** Reservations enforce **writes** via role-gated SECURITY DEFINER RPCs and **reads** via SECURITY DEFINER RPCs, leaving the *table* SELECT policy wide-open (`using(true)`). Profiles/vehicles enforce via per-row RLS predicates calling `current_app_role()`. The test must assert at **both** the RPC layer and the raw-table layer, because they disagree about who can read reservation PII.
- **The role is data, not a claim.** Anything testing authorization must seed/teardown a `profiles` row, not mint a JWT with a role. A valid JWT with no `profiles` row is the fail-closed case — and the sharpest probe for the F1 grant hole.
- **RLS-only production posture.** With no service-role key in app code, RLS *is* the security boundary. That makes "a service-role client masking the gap" a real and easy mistake in the harness; the access assertions must run on anon-key + JWT clients exclusively.
- **Half-open ranges are the single source of correctness for turnover.** Both SQL (`tsrange … '[)'`) and TS (`src/lib/availability.ts`) encode the same `[14:00, 10:00)` convention; the test proves the DB honors it, the unit test proves the mirror does.

## Historical Context (from prior changes)

- `context/archive/2026-06-27-rls-auth-initplan/` — pure-performance InitPlan rewrite (wrapped `auth.uid()`/`current_app_role()` in `(select …)`); **no semantic change** to predicates, so the test oracle is unaffected. `research.md:133` explicitly records that reservation policies use `using(true)` with role enforcement living in the RPCs. Migration `20260627120000_rls_initplan_optimization.sql`. See also `context/foundation/lessons.md` — "Wrap auth calls and role helpers in (select …)".
- `context/archive/2026-06-04-employee-admin-roles/` — origin of `profiles`, `current_app_role()`, the SECURITY DEFINER recursion-trap rationale, and the fail-closed null-role decision.
- `context/changes/booking-integrity-data/verify-overlap.sql` — existing manual overlap-verification SQL and the true-conflict negative data kept out of the seed; a ready reference for the rejection case.

## Related Research

- `context/archive/2026-06-27-rls-auth-initplan/research.md` — prior RLS policy inventory (perf lens)
- `context/foundation/test-plan.md` §2 Risk Map (#1, #2), §3 Phase 1 row, §6.2 cookbook slot to be filled by this phase

## Open Questions

1. **Does `authenticated` hold a base-table `SELECT` grant on `reservations`?** (The crux of F1.) Resolve empirically in the harness: `select has_table_privilege('authenticated','public.reservations','SELECT')` **and** an actual `from('reservations').select('*')` as a non-staff authed client (and as a role=null user). If rows come back, that's a confirmed PII leak — escalate as a finding, not just a red test. The migration comment at `20260617121000...:4` claims no SELECT grant; the middleware's direct `from('profiles').select('role')` (`middleware.ts:22`) implies the schema-wide default grant *does* exist — these conflict and only a live probe settles it.
2. **Is "employee == admin for all reservation PII" the intended policy?** If any admin-only narrowing is intended, it does not exist today; the test should encode the current reality and flag the question.
3. **Teardown strategy** — transactional rollback vs service-role cleanup vs a dedicated disposable vehicle/date window. Affects whether integration tests can run in parallel (the GiST constraint forces care).
4. **Test placement** — colocate under `src/` (matches current glob, mixes slow DB tests into the unit run) vs a `tests/integration/` dir (needs glob/projects change). A `/10x-plan` decision.
