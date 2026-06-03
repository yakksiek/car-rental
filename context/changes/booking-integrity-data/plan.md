# Booking-Integrity Data Layer (F-01) Implementation Plan

## Overview

Stand up the foundational `vehicles` + `reservations` data model with Row Level Security, enforce the no-double-booking guarantee with a Postgres `EXCLUDE` constraint, mirror that same rule in a unit-tested pure TypeScript predicate (so the future public funnel in S-02 can block conflicts before submission), and seed a realistic fleet so the public catalog (S-01) can render. This slice is not user-visible on its own — it is the load-bearing integrity layer every booking slice depends on.

## Current State Analysis

- **Auth is wired, data layer is empty.** Supabase SSR client exists (`src/lib/supabase.ts:5` — returns `null` without env), middleware resolves `locals.user` (`src/middleware.ts:6`). There is **zero domain schema**: no `supabase/migrations/`, no `src/types.ts` (file does not exist), no `src/lib/services/`.
- **No role model yet.** Only `anon` and `authenticated` Supabase roles exist; the employee/admin split is F-02. Policies here must therefore gate on `authenticated` (not on a role), and leave room for F-02 to refine.
- **No test runner.** `package.json` has no `test` script; CLAUDE.md confirms "No test runner is configured." The roadmap requires the overlap rule be "unit-verifiable" → this slice introduces Vitest.
- **Supabase local is ready.** `supabase/config.toml` present (Postgres `major_version = 17`); `[db.seed]` enabled with `sql_paths = ["./seed.sql"]`, so `supabase db reset` applies migrations then seed.
- **Conventions** (CLAUDE.md): migrations named `YYYYMMDDHHmmss_short_description.sql`; **RLS mandatory** with per-operation, per-role policies; shared types in `src/types.ts`; import groups with `// core` / `// components` / `// others` headers; Polish UI copy is canonical (not relevant to this non-UI slice).

## Desired End State

After this plan:

- `supabase db reset` applies one migration and one seed file with no errors, producing a `vehicles` table (full FR-003 field surface) and a `reservations` table with RLS enabled and policies in place.
- The database **physically refuses** to store two pending-or-confirmed reservations whose hotel-style windows overlap on the same vehicle (`EXCLUDE` constraint), while permitting same-day turnover (return 10:00 → next pickup 14:00).
- `npm test` runs a Vitest suite that exercises the pure TS overlap predicate across boundary cases and passes.
- `supabase gen types` output lives at `src/db/database.types.ts`; `src/types.ts` exposes ergonomic entity/DTO aliases and the predicate's input types.
- The seed contains vehicles spanning all five categories plus reservations that demonstrate the rule (an allowed same-day-turnover pair; a conflicting pair proven to be rejected).

**Verification:** `supabase db reset` exits 0; `npm test` green; `npm run lint` and `npx astro check` clean; manually attempting to insert an overlapping confirmed reservation in `supabase db reset`'s seed fails the constraint (proven by keeping that insert in a separately-run snippet, not in seed.sql).

### Key Discoveries:

- **Immutability gotcha (load-bearing).** A generated column / index expression must be `IMMUTABLE`. `timestamp AT TIME ZONE 'Europe/Warsaw'` is `STABLE` (named-zone rules can change), so Postgres rejects it inside a generated column or `EXCLUDE` expression. **Resolution:** store the window as a naive-local `tsrange` (`timestamp without time zone`), i.e. `[pickup_date + 14:00, return_date + 10:00)`. Every reservation shares the same implied local zone, so the timezone is irrelevant to *overlap* math — it only matters for absolute display, which F-01 does not do. This keeps the expression immutable and the same-day buffer exact. Overdue detection (S-07) can apply the zone at read time.

  > **Why `tsrange`, in plain terms.** A "range" stores a start–end pair as one value, and Postgres answers "do two ranges overlap?" with one operator (`&&`) — which *is* the no-double-booking check. `tsrange` holds bare wall-clock timestamps (no timezone); `tstzrange` holds real global instants anchored to a zone like `Europe/Warsaw`. The zone version looks more correct (our rule has real clock times: return 10:00, pickup 14:00), but two things make `tsrange` the right call: (1) **It's required** — auto-computing a `tstzrange` from the dates needs a timezone lookup, which Postgres treats as `STABLE` and forbids in a generated column. (2) **It's also correct** — every booking on a given vehicle is in the same place/zone, so the timezone cancels out of any overlap comparison; bare clock numbers give the identical answer (A returns June 10 10:00, B picks up June 10 14:00 → B starts after A ends → no overlap → same-day turnover allowed). The zone only matters when you need a *real-world instant* — i.e. S-07 asking "is it now past the return time?" — and that's handled by applying `Europe/Warsaw` at read time, not by baking it into storage here.
- **`btree_gist` required.** The `EXCLUDE` needs `vehicle_id WITH =` (equality) alongside `reserved_period WITH &&` (range overlap) in one GiST index; the equality operator class for a scalar comes from the `btree_gist` extension. Available in Supabase/Postgres 17.
- **`numeric` returns as string in supabase-js.** Money columns (`numeric(10,2)`) deserialize to `string` in the JS driver. The DTO/formatter layer owns parsing — note in `src/types.ts`.
- **Seed runs on reset.** `config.toml` `[db.seed] sql_paths = ["./seed.sql"]` (verified) — `supabase db reset` applies it automatically.
- **Pattern to follow for types directory:** none exists yet; this slice establishes `src/db/database.types.ts` as the generated source of truth, a convention every later slice reuses.

## What We're NOT Doing

- **No employee/admin role model** — that is F-02. Policies gate on `authenticated`, not on a role claim.
- **No public reservation funnel / `anon` INSERT policy** — that is S-02. Reservations are `authenticated`-only here.
- **No protocol schema** (issue/return, photos, signature) — S-05/S-06.
- **No vehicle CRUD UI, no catalog UI, no API routes** — S-01/S-04. This slice ships schema + rule + seed only.
- **No overdue detection logic** — S-07 (it reads these dates later).
- **No payments, no cost-calculation engine** — out of v1 / later business logic.
- **No vehicle maintenance/lifecycle state machine** — `is_active` boolean only.
- **No abandoned-pending-request cleanup/TTL** — a pending reservation blocks the slot by decision. The chosen mitigation is operational (employees react quickly to pending requests because they freeze the calendar; S-03's dashboard must make pending requests prominent), not an auto-expiry feature. Auto-expiry is an optional future enhancement, not owned here.
- **No app-level "re-check availability on submit" logic** — the `EXCLUDE` constraint closes the submit-time race atomically (first insert wins, second gets `23P01`); S-02 simply catches that error. Writing a separate check-then-insert would reintroduce the very race the constraint eliminates.

## Implementation Approach

Single migration establishes the schema, the integrity constraint, and RLS together (they are one logical contract). Types are generated from the applied schema. The TS overlap predicate is a standalone pure function with no I/O, unit-tested in isolation — it is the "unit-verifiable" deliverable and the exact rule S-02's client will call. Seed comes last so it can exercise the finished constraint.

## Critical Implementation Details

- **State sequencing.** The generated `reserved_period` column and the `EXCLUDE` constraint must be created in the same migration as the table; the `btree_gist` extension must be created **before** the constraint. Type generation must run **after** `supabase db reset` (the schema must exist to introspect).
- **Overlap semantics.** Window is half-open `[)`: `[pickup_date 14:00, return_date 10:00)`. Same-day turnover — vehicle A returned `D 10:00`, A picked up again `D 14:00` — yields adjacent, non-overlapping ranges (the 4-hour buffer). The TS predicate and the SQL `&&` operator must agree on this exact half-open boundary; a shared boundary-case table in the unit tests guards the agreement.

## Phase 1: Schema & Integrity

### Overview

Create the enum, both tables, the generated booking window, the no-overlap `EXCLUDE` constraint, RLS policies, the deletion-guard FK, and supporting indexes in one migration. Then generate the `Database` type and hand-author DTOs.

### Changes Required:

#### 1. Schema migration

**File**: `supabase/migrations/<YYYYMMDDHHmmss>_booking_integrity_data.sql`

**Intent**: Define the complete `vehicles` + `reservations` data model, the integrity constraint that makes double-booking physically impossible, and the RLS posture that exposes the catalog publicly while locking customer PII to authenticated users.

**Contract**:
- `create extension if not exists btree_gist;`
- `create type vehicle_category as enum ('cargo_van','passenger_van','car_transporter','refrigerated_truck','flatbed_truck');`
- `create type reservation_status as enum ('pending','confirmed','rejected','cancelled');`
- `vehicles` columns: `id uuid pk default gen_random_uuid()`, `name text not null`, `category vehicle_category not null`, spec fields (`make text`, `model text`, `production_year int`, `fuel_type text`), `payload_capacity_kg numeric(10,2)`, cargo dimensions `cargo_length_cm/cargo_width_cm/cargo_height_cm numeric(10,2)`, `photos text[] not null default '{}'`, pricing `daily_rate/monthly_rate/deposit/per_extra_km_rate numeric(10,2) not null`, `km_limit int`, `is_active boolean not null default true`, `created_at/updated_at timestamptz not null default now()`. (Exact spec-field set may be trimmed to what FR-003 names; keep filterable specs as typed columns, not jsonb.)
- `reservations` columns: `id uuid pk`, `vehicle_id uuid not null references vehicles(id) on delete restrict`, customer `customer_name/customer_email/customer_phone text not null`, `pickup_date date not null`, `return_date date not null` with `check (return_date >= pickup_date)`, `status reservation_status not null default 'pending'`, `created_at/updated_at timestamptz not null default now()`.
- Generated booking window (the immutable-`tsrange` resolution from Key Discoveries):
  ```sql
  reserved_period tsrange generated always as (
    tsrange(pickup_date + time '14:00', return_date + time '10:00', '[)')
  ) stored
  ```
- No-double-booking constraint (partial on blocking statuses — pending + confirmed both block):
  ```sql
  alter table reservations add constraint reservations_no_overlap
    exclude using gist (
      vehicle_id with =,
      reserved_period with &&
    ) where (status in ('pending','confirmed'));
  ```
- Indexes: `vehicles(category)`, `vehicles(is_active)`, `reservations(vehicle_id)`, `reservations(status)`.
- RLS: `alter table ... enable row level security` on both. Policies:
  - `vehicles`: SELECT policy `to anon, authenticated using (is_active = true)`. (No public write.)
  - `reservations`: per-operation SELECT/INSERT/UPDATE/DELETE policies `to authenticated` only (no `anon` policy → anon is denied by default). UPDATE includes a `with check`. Each operation gets its own named policy per convention.
- `updated_at` maintenance: a `set_updated_at()` trigger function + `before update` triggers on both tables (or omit and let app set it — choose trigger for correctness).

A snippet is included above only for the two non-obvious pieces (generated `tsrange`, `EXCLUDE`); the rest is routine DDL.

#### 2. Generated database types

**File**: `src/db/database.types.ts`

**Intent**: Produce the typed `Database` interface from the applied schema so row types never drift from SQL.

**Contract**: Output of `supabase gen types typescript --local`. Generated file — do not hand-edit. New directory `src/db/`.

#### 3. Hand-written entity/DTO aliases

**File**: `src/types.ts` (new)

**Intent**: Give app code ergonomic names and isolate the `numeric → string` driver quirk, plus declare the overlap predicate's input shape (consumed in Phase 2).

**Contract**: Re-export `Database`; alias `Vehicle`, `VehicleInsert`, `Reservation`, `ReservationInsert` from `Database['public']['Tables']`; alias `VehicleCategory`, `ReservationStatus` from the enums. Add a `BookingWindow` type (`{ pickupDate: string; returnDate: string }`) used by the predicate. Group imports per the `// core` / `// others` convention. Document the money-as-string note inline.

### Success Criteria:

#### Automated Verification:

- Migration + seed apply cleanly: `supabase db reset`
- Types generate without error: `supabase gen types typescript --local > src/db/database.types.ts`
- Type checking passes: `npx astro check`
- Linting passes: `npm run lint`

#### Manual Verification:

- In Supabase Studio (or `psql`), confirm RLS is enabled on both tables and the four `reservations` policies + the `vehicles` SELECT policy exist.
- Inserting an overlapping `confirmed` reservation by hand is rejected with the `reservations_no_overlap` exclusion violation; a same-day-turnover pair inserts successfully.
- `anon` (via the anon key) can SELECT active vehicles but receives zero rows / permission denial on `reservations`.

**Implementation Note**: After this phase and all automated verification passes, pause for manual confirmation before proceeding to Phase 2.

---

## Phase 2: Overlap Predicate & Tests

### Overview

Implement the pure TypeScript mirror of the DB rule and stand up Vitest so it is genuinely unit-verifiable. This is the artifact S-02 will reuse to block conflicts before submission.

### Changes Required:

#### 1. Overlap predicate

**File**: `src/lib/availability.ts` (new)

**Intent**: A pure, I/O-free function that decides whether a candidate booking conflicts with existing bookings under the exact hotel-style half-open window — the TS twin of the SQL `EXCLUDE`.

**Contract**: Export `bookingWindow(pickupDate, returnDate)` building a comparable half-open interval using the same naive-local `[pickup 14:00, return 10:00)` convention; `windowsOverlap(a, b): boolean` (half-open `&&`); `hasConflict(candidate: BookingWindow, existing: BookingWindow[]): boolean`. No date-library dependency required — compare via epoch-style numbers derived from the date strings + fixed hours. Pure functions only; no Supabase import.

#### 2. Vitest setup

**Files**: `package.json` (add `"test": "vitest run"` and `"test:watch": "vitest"`; add `vitest` devDependency), `vitest.config.ts` (new)

**Intent**: Introduce the project's first test runner, scoped and fast, idiomatic to the Vite-based stack.

**Contract**: Minimal `vitest.config.ts` (node environment, include `src/**/*.test.ts`). No Astro/React testing surface needed for this slice.

#### 3. Unit tests

**File**: `src/lib/availability.test.ts` (new)

**Intent**: Lock the rule's boundary behavior so future edits can't silently break the integrity guarantee or the same-day buffer.

**Contract**: Cases — same-day turnover (return D, pickup D) → **no conflict**; true overlap → conflict; back-to-back across days → no conflict; fully nested → conflict; identical window → conflict; one-day rental edges; empty `existing[]` → no conflict. The same boundary table documents the half-open agreement with SQL.

### Success Criteria:

#### Automated Verification:

- Tests pass: `npm test`
- Type checking passes: `npx astro check`
- Linting passes: `npm run lint`

#### Manual Verification:

- Spot-check that a hand-computed same-day-turnover case matches the predicate's verdict and the DB's behavior from Phase 1 (the two enforcement points agree).

**Implementation Note**: After this phase and all automated verification passes, pause for manual confirmation before proceeding to Phase 3.

---

## Phase 3: Seed & Verification

### Overview

Author the seed so the public catalog has realistic data and the integrity rule is demonstrably exercised end-to-end.

### Changes Required:

#### 1. Seed data

**File**: `supabase/seed.sql` (new)

**Intent**: Provide a small, realistic fleet across all five categories with full pricing/specs so S-01 can render detail cards, plus reservations that prove the rule both ways.

**Contract**: ~6–8 `vehicles` rows covering each `vehicle_category`, with non-null pricing and at least one `is_active = false` row (to verify catalog filtering later). `reservations` rows including: a confirmed booking; a **same-day-turnover** second booking on the same vehicle (return-date of one = pickup-date of the next) that must insert successfully; a couple of pending requests on other vehicles. Seed must apply without tripping the `EXCLUDE` constraint (i.e., contains no actual conflict). Deterministic dates (no `now()`-relative drift that could break reproducibility).

#### 2. Conflict-rejection proof (not in seed.sql)

**File**: `context/changes/booking-integrity-data/verify-overlap.sql` (new, dev artifact)

**Intent**: A runnable snippet demonstrating the constraint rejects a true overlap — kept out of `seed.sql` (which must succeed) so the negative case is reproducible on demand.

**Contract**: An `insert` that overlaps a seeded confirmed reservation; documented expected result: `23P01` exclusion_violation. Reference it from the plan's verification steps.

### Success Criteria:

#### Automated Verification:

- Full reset applies migration + seed with no errors: `supabase db reset`
- Tests still pass: `npm test`
- Linting passes: `npm run lint`

#### Manual Verification:

- Running `verify-overlap.sql` against the seeded DB fails with an exclusion violation (proves the hard guarantee).
- Catalog-shaped query `select * from vehicles where is_active = true` returns the expected non-retired vehicles across all categories with populated pricing/specs.
- The same-day-turnover pair coexists in `reservations` (proves the buffer).

**Implementation Note**: After this phase and all automated verification passes, pause for final manual confirmation.

---

## Testing Strategy

### Unit Tests:

- The `src/lib/availability.ts` predicate across the boundary table (same-day turnover, overlap, adjacency, nested, identical, single-day edges, empty set).

### Integration Tests:

- None automated for this slice (no API/UI yet). The DB-level integration check is the `EXCLUDE` constraint exercised by seed + `verify-overlap.sql`.

### Manual Testing Steps:

1. `supabase db reset` → confirm clean apply of migration + seed.
2. Run `verify-overlap.sql` → confirm `23P01` exclusion violation on an overlapping insert.
3. Query `reservations` → confirm the same-day-turnover pair both exist.
4. With the anon key, `select` from `vehicles` (rows for active only) and `reservations` (denied/empty) → confirms RLS posture.
5. `npm test` → confirm predicate suite green.

## Performance Considerations

Negligible at v1 scale (small data volume per PRD). The GiST `EXCLUDE` index also serves availability lookups; B-tree indexes on `category`, `is_active`, `vehicle_id`, `status` cover catalog and dashboard queries later.

## Migration Notes

Greenfield — no existing data to migrate. The migration is additive and reversible by dropping the two tables and two enum types + `btree_gist` if ever rolled back. Generated types must be regenerated after any future schema change (document the `supabase gen types` step as the standing convention this slice introduces).

## References

- Roadmap item: `context/foundation/roadmap.md` → F-01 (lines 70–81)
- PRD: `context/foundation/prd.md` → FR-005 (line 91), Guardrails (lines 48–50), Business Logic / Availability enforcement (lines 127–137), Access Control (lines 139–147)
- Change identity: `context/changes/booking-integrity-data/change.md`
- Existing Supabase client pattern: `src/lib/supabase.ts`
- RLS / migration conventions: `CLAUDE.md` → Key conventions

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Schema & Integrity

#### Automated

- [ ] 1.1 Migration + seed apply cleanly: `supabase db reset`
- [ ] 1.2 Types generate without error: `supabase gen types typescript --local > src/db/database.types.ts`
- [ ] 1.3 Type checking passes: `npx astro check`
- [ ] 1.4 Linting passes: `npm run lint`

#### Manual

- [ ] 1.5 RLS enabled + all policies present (verified in Studio/psql)
- [ ] 1.6 Overlapping confirmed insert rejected; same-day-turnover pair inserts
- [ ] 1.7 anon can SELECT active vehicles but is denied reservations

### Phase 2: Overlap Predicate & Tests

#### Automated

- [ ] 2.1 Tests pass: `npm test`
- [ ] 2.2 Type checking passes: `npx astro check`
- [ ] 2.3 Linting passes: `npm run lint`

#### Manual

- [ ] 2.4 Predicate verdict matches DB behavior on a hand-checked same-day case

### Phase 3: Seed & Verification

#### Automated

- [ ] 3.1 Full reset applies migration + seed with no errors: `supabase db reset`
- [ ] 3.2 Tests still pass: `npm test`
- [ ] 3.3 Linting passes: `npm run lint`

#### Manual

- [ ] 3.4 `verify-overlap.sql` fails with an exclusion violation
- [ ] 3.5 Catalog query returns expected active vehicles across all categories
- [ ] 3.6 Same-day-turnover pair coexists in `reservations`
