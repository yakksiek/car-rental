# RLS InitPlan Optimization — Plan Brief

> Full plan: `context/changes/rls-auth-initplan/plan.md`
> Research: `context/changes/rls-auth-initplan/research.md`

## What & Why

The Supabase `auth_rls_initplan` linter flags `profiles_select_authenticated` for re-evaluating `auth.uid()` once per row instead of once per query. We wrap every per-row auth call in a scalar subquery — `(select auth.uid())`, `(select public.current_app_role())` — so Postgres hoists it to a one-time InitPlan. It's a pure performance/hygiene fix with zero change to access semantics.

## Starting Point

One policy (`profiles_select_authenticated`) has a bare `auth.uid()`; five more role-gated policies (`profiles_insert/update/delete`, `vehicles_insert_staff`, `vehicles_update_staff`) carry the same per-row cost invisibly through the `current_app_role()` SECURITY DEFINER helper, which the linter can't see into. The `reservations_*` policies use `using (true)` and are unaffected.

## Desired End State

All six role-gated policies evaluate their auth check once per statement (an InitPlan), the Supabase advisor stops reporting `auth_rls_initplan` for `public.profiles`, and who-can-do-what is byte-for-byte unchanged.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| --- | --- | --- | --- |
| Scope | All 6 role-gated policies, not just the flagged one | Removes the latent cost the linter can't see and sets the idiom for future slices | Plan |
| Mechanism | `ALTER POLICY` in place | Minimal, reversible diff that preserves policy name/role/command | Plan |
| Wrap the helper too | Yes — `(select public.current_app_role())` | A `STABLE` function in a policy clause is still re-evaluated per row; only `(select …)` forces an InitPlan | Research |
| Capture a lesson | Yes — `lessons.md` entry | Stops S-05/06/07/08 from reintroducing the un-wrapped form | Plan |
| Type regen | Not needed | RLS policy bodies don't change the generated `Database` type contract | Research |

## Scope

**In scope:** one forward migration wrapping `auth.uid()`/`current_app_role()` in `(select …)` across the six role-gated policies; one `lessons.md` entry.

**Out of scope:** clean policies (`vehicles_select_*`, `reservations_*`); `current_app_role()` internals and access semantics; type regeneration; app code; production deploy (separate `db push`); new indexes.

## Architecture / Approach

A single additive migration (`supabase/migrations/20260627120000_rls_initplan_optimization.sql`) issuing six `ALTER POLICY … USING/WITH CHECK` statements with the wrapped predicates, following the project's standing migration convention. The lesson edit lands in the same change.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Migration + lesson | Wrapped predicates on all 6 policies via `ALTER POLICY`, plus the `lessons.md` idiom entry | A wrapped predicate accidentally altering semantics — mitigated by an EXPLAIN + own-row/admin-all/denied-write spot-check |

**Prerequisites:** local Supabase (`npx supabase start`, Docker) to run `db reset` and `EXPLAIN`.
**Estimated effort:** ~1 short session, single phase.

## Open Risks & Assumptions

- Assumes the `auth_rls_initplan` advisor only runs on the hosted project, so the "warning cleared" check is a post-deploy manual step, not local-automated.
- Low real-world impact at v1 scale (tiny `profiles`, small `vehicles`); value is correctness + future-proofing, not a hot-path rescue.

## Success Criteria (Summary)

- `npx supabase db reset` applies the migration cleanly; `astro check`, `npm run lint`, `npm run build` all pass.
- `EXPLAIN` shows the auth check as an InitPlan, not a per-row Filter; access semantics unchanged.
- Post-deploy, the Supabase advisor no longer flags `auth_rls_initplan` for `public.profiles`.
