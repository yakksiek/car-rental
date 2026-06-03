# Booking-Integrity Data Layer (F-01) — Plan Brief

> Full plan: `context/changes/booking-integrity-data/plan.md`

## What & Why

Build the foundational data model — `vehicles` + `reservations` — and the no-double-booking guarantee that every later booking slice rests on. The double-booking rule is the product's core integrity guardrail (PRD FR-005), so it's enforced twice from one set of semantics: a Postgres `EXCLUDE` constraint (race-proof, can't be bypassed) and a unit-tested TypeScript predicate (so the future public funnel, S-02, can block conflicts *before* the customer submits). Not user-visible on its own; it unlocks S-01, S-02, S-04, S-07.

## Starting Point

Supabase SSR auth is wired but the data layer is empty — no migrations, no `src/types.ts`, no test runner. Only `anon`/`authenticated` Postgres roles exist (the employee/admin split is F-02). `supabase db reset` works locally (Postgres 17, seed enabled).

## Desired End State

`supabase db reset` produces both tables with RLS; the database physically rejects overlapping pending-or-confirmed reservations on a vehicle while allowing same-day turnover (return 10:00 → next pickup 14:00); `npm test` green on the overlap predicate; generated `Database` types + hand-written DTOs in place; a seeded fleet across all five categories ready for the catalog.

## Key Decisions Made

| Decision | Choice | Why | Source |
| --- | --- | --- | --- |
| Rule enforcement | DB `EXCLUDE` constraint + TS predicate mirror | Race-proof DB guarantee *and* a client-usable rule for S-02's pre-submit block | Plan |
| Time-window storage | `date` columns + generated **`tsrange`** `[pickup 14:00, return 10:00)` | Encodes the 4-hour buffer once; same-day turnover is non-overlapping automatically | Plan |
| Timezone handling | Naive-local `tsrange`, not `tstzrange` with a named zone | Named-zone conversion is `STABLE` → illegal in a generated/immutable expression; zone is irrelevant to overlap math | Plan |
| What blocks a slot | **pending + confirmed** both block (partial `EXCLUDE`) | First-come-first-served at request time (user choice over the FR-005 confirmed-only reading) | Plan |
| Unit-verifiability | Add **Vitest** + `test` script | Roadmap requires "unit-verifiable"; lightweight for the Vite stack; wires CI for all later slices | Plan |
| Vehicle schema breadth | Full FR-003 surface now | Stable contract for S-01/S-04 — avoids re-migrating the foundation everything depends on | Plan |
| Categories | Postgres `enum` | DB-enforced fixed set; clean generated TS union | Plan |
| Photos / cargo dims | `photos text[]` + numeric dimension columns | Dimensions stay filterable for S-02; simple ordered photo array | Plan |
| Money | `numeric(10,2)` PLN | Exact decimal, single currency, no cents-conversion friction (no payments in v1) | Plan |
| Hide a vehicle | `is_active` boolean | Soft-hide without losing reservation history; honored by S-01, toggled by S-04 | Plan |
| RLS posture | Vehicles public-read (active only); reservations `authenticated`-only; defer `anon`-insert to S-02 | Catalog renders publicly; customer PII protected (guardrail); each slice owns its write policy | Plan |
| FK on delete | `ON DELETE RESTRICT` | DB-level groundwork for FR-011's deletion guard — no orphaned reservations | Plan |
| Types | Generated `Database` type + hand-written DTOs | Row types never drift from schema; ergonomic app aliases | Plan |

## Scope

**In scope:** `vehicles` + `reservations` schema; `vehicle_category` / `reservation_status` enums; generated booking window + `EXCLUDE` no-overlap constraint; RLS policies; `ON DELETE RESTRICT` FK; generated types + DTOs; Vitest + overlap predicate + unit tests; seed across all categories.

**Out of scope:** employee/admin roles (F-02); public reservation funnel & `anon`-insert (S-02); protocol/photo/signature schema (S-05/S-06); catalog & CRUD UI/API (S-01/S-04); overdue detection (S-07); payments/cost engine; abandoned-pending-request cleanup.

## Architecture / Approach

One migration creates the enums, both tables, the immutable generated `tsrange`, the GiST `EXCLUDE` constraint (requires `btree_gist`), RLS policies, and indexes — schema + integrity + access as one contract. Types are generated from the applied schema into `src/db/database.types.ts`, with DTO aliases in `src/types.ts`. A pure, I/O-free predicate in `src/lib/availability.ts` mirrors the SQL rule and is unit-tested by Vitest. Seed exercises the finished constraint last.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Schema & Integrity | Migration (tables, enums, `EXCLUDE`, RLS, FK), generated types + DTOs | Immutability rule on the generated column — resolved via naive-local `tsrange` |
| 2. Overlap Predicate & Tests | Pure TS rule + Vitest + boundary unit tests | TS mirror must agree with SQL on the half-open boundary — guarded by a shared case table |
| 3. Seed & Verification | Seed across categories + conflict-rejection proof | Seed must not itself trip the constraint; negative case kept in a separate snippet |

**Prerequisites:** Local Supabase running (`npx supabase start`, Docker). None upstream — F-01 has no roadmap prerequisites.
**Estimated effort:** ~1–2 sessions across 3 phases.

## Open Risks & Assumptions

- **Pending requests block slots** (deliberate choice): a request holds the dates immediately, so no customer ever gets a confirmed booking cancelled out from under them. Accepted cost — a forgotten/never-actioned pending request silently freezes a vehicle. Chosen mitigation is **operational, not automated**: employees must react quickly to pending requests because they block the calendar, so S-03's dashboard must surface pending requests prominently/urgently. Auto-expiry (TTL) is an *optional* future enhancement, not a required deferral.
- **Submit-time race is closed by the DB, not app code:** if two customers submit overlapping dates near-simultaneously, the `EXCLUDE` constraint lets the first insert win and rejects the second atomically (`23P01`). No separate "re-check availability on submit" query is needed (and none should be written — it would reintroduce a race). The client-side TS predicate is advisory UX; the constraint is the authority. S-02 catches `23P01` and shows a friendly "just taken" message.
- The naive-local `tsrange` assumes a single implied timezone for all bookings (true for a single-tenant Polish operator). Absolute-time display/overdue logic (S-07) must apply `Europe/Warsaw` at read time.
- `numeric` deserializes as `string` in supabase-js — DTO/formatter layer must parse; noted in `src/types.ts`.

## Success Criteria (Summary)

- `supabase db reset` applies migration + seed cleanly; the DB rejects an overlapping confirmed reservation but accepts a same-day-turnover pair.
- `npm test` passes the overlap predicate across all boundary cases.
- `anon` can read active vehicles but is denied all reservation rows (PII guardrail holds).
