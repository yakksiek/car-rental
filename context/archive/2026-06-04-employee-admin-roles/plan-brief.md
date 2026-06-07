# Employee/Admin Role Model (F-02) — Plan Brief

> Full plan: `context/changes/employee-admin-roles/plan.md`

## What & Why

Add an `employee`/`admin` role layer on the existing Supabase auth so every authenticated slice (S-03 through S-08) can gate behavior by role without re-implementing access checks. The PRD's #2 guardrail — customer PII must not reach unauthorized users — makes a correct, centralized access boundary the thing to get right. No user-facing feature; this is the access foundation later slices plug into.

## Starting Point

Auth is fully wired (email/password signin/signup/signout + `middleware.ts` resolving `locals.user`) but **role-less**: the only gate is `PROTECTED_ROUTES = ["/dashboard"]` on *authenticated*, there is no role storage, and public signup is on. F-01 already established the migration → generated-types → `src/types.ts` → Vitest pattern this slice mirrors.

## Desired End State

A `public.profiles` table holds each user's role; middleware reads it per request into a typed `locals.role` and enforces a declarative route→role map (`admin ⊇ employee`, fail-closed). Public signup is closed (v1 has no customer accounts); a seeded admin+employee make dev usable, and a documented runbook covers the production first-admin. Downstream slices consume a stable `locals.role` + `requireRole()` contract.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| --- | --- | --- | --- |
| Role storage & propagation | `profiles` table read in middleware → `locals.role` | Simplest correct fit for the roadmap's route/middleware mandate; immediate role changes, no JWT-hook upkeep | Plan |
| Signup posture | Disable public self-service signup | v1 has no customer accounts — an open signup is a PII-leak surface with no product purpose | Plan |
| Role assignment | Admin-assigned (S-08); dev seed + documented prod bootstrap | No self-grant; roles only granted deliberately | Plan |
| Middleware gating | Declarative route→role map, `admin ⊇ employee` | One place to reason about access; trivially extended per slice | Plan |
| RLS scope | Only the new `profiles` table; leave vehicles/reservations on `authenticated` | Both roles share identical data access in v1; the only per-role boundary (staff mgmt) is S-08 | Plan |
| No-role edge | Fail-closed — deny / redirect | Safe default for the PII guardrail | Plan |
| Consumer contract | `locals.role` + `requireRole()` helper | Typed source of truth + reusable in-handler guard | Plan |
| Prod first-admin | Operator creates user (dashboard) + documented SQL grant | No extra app code/secrets; one audited manual step per deployment | Plan |
| Testing | Vitest unit tests on the pure gating resolver | Locks the access boundary with fast deterministic tests | Plan |

## Scope

**In scope:** `app_role` enum + `profiles` table + `current_app_role()` helper + profiles RLS; role read into typed `locals.role`; route→role middleware gating; `requireRole()` + pure `access.ts` + Vitest tests; disable public signup; dev staff seed; production first-admin runbook; contract-surfaces registry.

**Out of scope:** employee/account-management UI & admin user-creation (S-08); service-role key; refining vehicles/reservations RLS; JWT auth-hook; password reset; multi-role/per-vehicle assignment; new feature pages.

## Architecture / Approach

`profiles(user_id → app_role)` is the single role source. Middleware (already calling `getUser()`) adds one indexed lookup to set `locals.role`, then consults a pure `resolveRequiredRole(path)` + `isRoleSufficient(role, required)` to allow/deny fail-closed. A `SECURITY DEFINER` `current_app_role()` powers the admin check inside `profiles` RLS without recursion. Signup is closed at config + route; staff are seeded for dev and bootstrapped via runbook in prod.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Role schema & RLS | enum + `profiles` + `current_app_role()` + RLS + regenerated types | RLS self-reference recursion (mitigated by the SECURITY DEFINER reader) |
| 2. Propagation, gating & contract | `locals.role`, route→role middleware, `requireRole()`, pure `access.ts` + tests | A gap/precedence bug in the gate (mitigated by unit tests + fail-closed default) |
| 3. Signup lockdown, seed & bootstrap | signup disabled, dev staff seed, prod runbook | `auth.users` seeding correctness (documented crypt()/identities pattern) |

**Prerequisites:** None (F-02 has no roadmap prerequisites). Local Supabase running for migration/seed/type-gen. Builds on F-01's migration + Vitest setup.
**Estimated effort:** ~2-3 sessions across 3 phases.

## Open Risks & Assumptions

- Seeding `auth.users` directly (password hash + `identities` row) is the trickiest mechanical step; if it proves brittle, fall back to the runbook's dashboard-create flow for dev too.
- The production first-admin is a manual operator step by design — it must be discoverable (README pointer), or a fresh deploy is locked out.
- `vehicles`/`reservations` RLS stays role-agnostic; if a later slice needs DB-level role gating there, it owns that change.

## Success Criteria (Summary)

- A seeded **employee** is allowed employee routes and denied admin-only routes; an **admin** is allowed both; a role-less session is denied everything (fail-closed).
- Public signup no longer creates accounts; the first admin is reproducible from the runbook.
- `npm test` green on the gating suite; `supabase db reset`, `npx astro check`, `npm run lint` all clean.
