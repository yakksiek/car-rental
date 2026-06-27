# RLS InitPlan Optimization Implementation Plan

## Overview

Fix the Supabase `auth_rls_initplan` linter finding by wrapping every per-row auth evaluation in a scalar subquery so Postgres hoists it to a one-time InitPlan. A single forward migration rewrites the predicates of all six role-gated RLS policies in place (`ALTER POLICY`), wrapping both the directly-flagged `auth.uid()` call and every `current_app_role()` call as `(select …)`. The same change adds a `lessons.md` entry codifying the idiom so future role-gated slices don't reintroduce the un-wrapped form.

## Current State Analysis

The linter flags one policy — `profiles_select_authenticated` (`supabase/migrations/20260604153139_employee_admin_roles.sql:69-72`), the only policy in the schema with a **direct** `auth.uid()` call. Five more role-gated policies carry the **same per-row cost invisibly**, because they check the caller's role through the `current_app_role()` SECURITY DEFINER helper (`...:47-55`), which internally calls `auth.uid()` and is itself re-evaluated per row (a `STABLE` function in a `USING`/`WITH CHECK` clause is not auto-hoisted; only a `(select …)` subquery forces an InitPlan). The linter only matches literal `auth.*()` / `current_setting()` tokens, so it under-reports.

Full inventory of affected policies (all in `supabase/migrations/`):

| Policy | File:line | Current predicate | Fix |
| --- | --- | --- | --- |
| `profiles_select_authenticated` | `20260604153139_employee_admin_roles.sql:69` | `using (user_id = auth.uid() or current_app_role() = 'admin')` | wrap both calls |
| `profiles_insert_authenticated` | `...:75` | `with check (current_app_role() = 'admin')` | wrap helper |
| `profiles_update_authenticated` | `...:80` | `using/with check (current_app_role() = 'admin')` | wrap helper (×2) |
| `profiles_delete_authenticated` | `...:86` | `using (current_app_role() = 'admin')` | wrap helper |
| `vehicles_insert_staff` | `20260625120000_fleet_management.sql:35` | `with check (public.current_app_role() in ('employee','admin'))` | wrap helper |
| `vehicles_update_staff` | `...:40` | `using/with check (public.current_app_role() in ('employee','admin'))` | wrap helper (×2) |

Clean (no auth call, untouched): `vehicles_select_anon`, `vehicles_select_authenticated`, and the four `reservations_*` policies (`using (true)` / `with check (true)` — reservation role enforcement lives in SECURITY DEFINER RPCs, not per-row RLS).

## Desired End State

Every role-gated RLS policy evaluates its `auth.uid()` / `current_app_role()` check exactly once per statement (as an InitPlan) rather than once per row. The Supabase advisor no longer reports `auth_rls_initplan` for `public.profiles`, and `EXPLAIN` on a `select` over `profiles`/`vehicles` shows the auth call in an `InitPlan` node, not a per-row `Filter`. Policy semantics (who can see/do what) are byte-for-byte unchanged.

### Key Discoveries:

- The linter detects syntax, not semantics — it flags only the one direct `auth.uid()`, but the same cost lives in 5 helper-based policies (`research.md` → Architecture Insights).
- `current_app_role()` is `STABLE SECURITY DEFINER` (`20260604153139_employee_admin_roles.sql:47-55`); `STABLE` is necessary but **not sufficient** for one-time evaluation in a policy clause — the `(select …)` wrapper is what forces the InitPlan.
- Canonical fix confirmed against live Supabase docs (`research.md` → External References): `is_admin() or auth.uid() = user_id` → `(select is_admin()) OR (select auth.uid()) = user_id`; helper functions used in policies are themselves wrapped (`using ((select private.has_good_role()))`).
- No `current_setting()` calls exist anywhere — the `current_setting()` half of the lint does not apply.
- RLS policy bodies do not change the generated `Database` type contract, so the post-migration `gen types` step other migrations require does **not** apply here.

## What We're NOT Doing

- Not touching the clean policies (`vehicles_select_*`, `reservations_*`) — they carry no auth call.
- Not changing `current_app_role()` itself, the recursion-safe design, or any access semantics — only how often Postgres evaluates an unchanged predicate.
- Not regenerating `src/db/database.types.ts` (RLS changes don't affect it).
- Not changing any application code (`middleware`, `requireRole`, services) — the access boundary result is identical.
- Not deploying to production — applying the migration to the hosted project (`db push`) is a separate, user-driven step noted in Migration Notes.
- Not adding indexes — `profiles.user_id` is already the primary key.

## Implementation Approach

One additive forward migration following the project convention (`supabase/migrations/YYYYMMDDHHmmss_short_description.sql`, RLS always enabled with per-operation/per-role policies — `CLAUDE.md` §Key conventions). The migration uses `ALTER POLICY … USING/WITH CHECK` to rewrite each predicate in place, preserving policy name, role, and command (chosen over DROP+CREATE for a minimal, reversible diff). The same change appends a `lessons.md` entry so the `(select …)` idiom is enforced on future role-gated slices.

## Phase 1: RLS InitPlan migration + lesson

### Overview

Add the forward migration that wraps all per-row auth evaluations in `(select …)`, and record the idiom as a lesson.

### Changes Required:

#### 1. Forward migration

**File**: `supabase/migrations/20260627120000_rls_initplan_optimization.sql` (new)

**Intent**: Rewrite the six role-gated RLS policy predicates so each `auth.uid()` and `current_app_role()` call is wrapped in a scalar subquery, hoisting it to a one-time InitPlan. Pure performance change; semantics unchanged. Open the file with a header comment explaining the `auth_rls_initplan` rationale and that the wrap is what forces the InitPlan.

**Contract**: Six `ALTER POLICY … ON … USING (…) [WITH CHECK (…)]` statements. Wrapped predicates:

```sql
-- profiles
alter policy profiles_select_authenticated on profiles
  using (user_id = (select auth.uid()) or (select public.current_app_role()) = 'admin');
alter policy profiles_insert_authenticated on profiles
  with check ((select public.current_app_role()) = 'admin');
alter policy profiles_update_authenticated on profiles
  using ((select public.current_app_role()) = 'admin')
  with check ((select public.current_app_role()) = 'admin');
alter policy profiles_delete_authenticated on profiles
  using ((select public.current_app_role()) = 'admin');

-- vehicles
alter policy vehicles_insert_staff on vehicles
  with check ((select public.current_app_role()) in ('employee', 'admin'));
alter policy vehicles_update_staff on vehicles
  using ((select public.current_app_role()) in ('employee', 'admin'))
  with check ((select public.current_app_role()) in ('employee', 'admin'));
```

Schema-qualify `public.current_app_role()` consistently (the `vehicles_*` policies already do; the `profiles_*` originals call it unqualified — qualifying is harmless and matches the helper's `search_path = ''` definer hygiene).

#### 2. Lesson entry

**File**: `context/foundation/lessons.md`

**Intent**: Codify the `(select …)` wrapper as the canonical role-check idiom so S-05/S-06/S-07/S-08 don't reintroduce the un-wrapped form.

**Contract**: Append one `## …` section in the existing lessons format (Context / Problem / Rule / Applies to). Rule: in any RLS policy `USING`/`WITH CHECK`, wrap auth calls and the role helper as `(select auth.uid())` / `(select public.current_app_role())`; a bare call (even a `STABLE` helper) is re-evaluated per row and trips the `auth_rls_initplan` advisor. Applies to: plan, implement, impl-review.

### Success Criteria:

#### Automated Verification:

- Migration applies cleanly from scratch: `npx supabase db reset`
- Type checking passes: `npx astro check`
- Linting passes: `npm run lint`
- Build passes: `npm run build`

#### Manual Verification:

- `EXPLAIN` on `select * from profiles` (as an authenticated non-admin) shows the auth check in an `InitPlan`/`SubPlan` node, not a per-row `Filter` calling `auth.uid()`.
- Access semantics unchanged: a non-admin authenticated user still reads only their own `profiles` row; an admin still reads all; a non-staff user is still denied `insert/update` on `vehicles` (spot-check via SQL or the fleet UI).
- After deploying to the hosted project, the Supabase advisor no longer lists `auth_rls_initplan` for `public.profiles`.

**Implementation Note**: After automated verification passes, pause for manual confirmation (EXPLAIN + semantics spot-check) before considering the phase complete.

---

## Testing Strategy

### Manual Testing Steps:

1. `npx supabase db reset` — confirm all migrations (including the new one) apply with no error.
2. In `psql`/Studio, run `explain (verbose) select * from profiles;` under an authenticated role and confirm the `auth.uid()` / `current_app_role()` evaluation appears once (InitPlan), not per row.
3. Verify semantics: own-row read as non-admin, all-rows read as admin, denied `vehicles` insert/update as a profile-less user.
4. (Post-deploy) Re-run the Supabase advisor on the hosted project; confirm the `auth_rls_initplan` warning for `public.profiles` is gone.

## Performance Considerations

This is the performance change: predicate evaluation drops from O(rows) to O(1) per statement for the six policies. Real-world impact in v1 is small — `profiles` is tiny (one row per staff member) and `vehicles` is fleet-sized — but the fix is correct, removes the advisor warning, and establishes the pattern for upcoming role-gated slices over larger tables (S-05/S-06 protocols, S-07 dashboard, S-08 employee management).

## Migration Notes

Additive and reversible: each `ALTER POLICY` is undone by a symmetric `ALTER POLICY` restoring the bare predicate. No data migration, no type regeneration, no app-code change. Local apply is `npx supabase db reset`; production rollout is a separate user-driven `npx supabase db push` (or the project's deploy path) against the hosted project — not part of this change.

## References

- Related research: `context/changes/rls-auth-initplan/research.md`
- Flagged policy + helper: `supabase/migrations/20260604153139_employee_admin_roles.sql:47-89`
- Sibling role-gated policies: `supabase/migrations/20260625120000_fleet_management.sql:35-44`
- Recursion-safe helper rationale: `context/archive/2026-06-04-employee-admin-roles/plan.md:34`
- Migration convention: `CLAUDE.md` §Key conventions (Supabase migrations)

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: RLS InitPlan migration + lesson

#### Automated

- [x] 1.1 Migration applies cleanly from scratch: `npx supabase db reset`
- [x] 1.2 Type checking passes: `npx astro check`
- [x] 1.3 Linting passes: `npm run lint`
- [x] 1.4 Build passes: `npm run build`

#### Manual

- [x] 1.5 `EXPLAIN` on `select * from profiles` shows the auth check in an InitPlan node, not a per-row Filter
- [x] 1.6 Access semantics unchanged (own-row vs admin-all read; non-staff denied vehicles insert/update)
- [ ] 1.7 Supabase advisor no longer reports `auth_rls_initplan` for `public.profiles` (post-deploy)
