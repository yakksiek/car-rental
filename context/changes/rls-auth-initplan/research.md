---
date: 2026-06-27T08:53:05Z
researcher: MarcinK
git_commit: 507b360011eaaf7bee16eff2d5136ec231920f9f
branch: main
repository: car-rental
topic: "RLS InitPlan re-evaluation — profiles_select_authenticated and the current_app_role() pattern"
tags: [research, codebase, rls, supabase, performance, security]
status: complete
last_updated: 2026-06-27
last_updated_by: MarcinK
---

# Research: RLS InitPlan re-evaluation (`auth_rls_initplan` lint)

**Date**: 2026-06-27T08:53:05Z
**Researcher**: MarcinK
**Git Commit**: 507b360011eaaf7bee16eff2d5136ec231920f9f
**Branch**: main
**Repository**: car-rental

## Research Question

Supabase database linter (`auth_rls_initplan`, lint 0003) reports:

> Table `public.profiles` has a row level security policy `profiles_select_authenticated` that re-evaluates `current_setting()` or `auth.<function>()` for each row. This produces suboptimal query performance at scale. Resolve the issue by replacing `auth.<function>()` with `(select auth.<function>())`.

Where does this occur in the codebase, how broad is the pattern, and what is the correct fix?

## Summary

- **One policy is flagged**, and it is the only one in the schema with a **direct** `auth.<fn>()` call: `profiles_select_authenticated` at `supabase/migrations/20260604153139_employee_admin_roles.sql:69-72`, whose `USING` clause is `user_id = auth.uid() or current_app_role() = 'admin'`.
- **The same per-row cost is latent in more policies than the linter can see.** Every other role-gated policy checks the caller's role through the `public.current_app_role()` SECURITY DEFINER helper (`...:47-55`), which internally calls `auth.uid()`. The linter only detects *direct* `auth.*()` / `current_setting()` in the policy text, so it does **not** flag these — but a `STABLE` function in a `USING`/`WITH CHECK` clause is still evaluated **per row** unless wrapped in a scalar subquery. So the architecturally complete fix wraps `current_app_role()` too.
- **No `current_setting()` calls exist anywhere** in the migrations — the lint's `current_setting()` half does not apply here.
- **Canonical fix (confirmed against live Supabase docs via Context7):** wrap each auth call and helper-function call in a scalar subquery so the planner hoists it to a one-time InitPlan:
  - `auth.uid() = user_id` → `(select auth.uid()) = user_id`
  - `is_admin() or auth.uid() = user_id` → `(select is_admin()) OR (select auth.uid()) = user_id`
- **Real-world impact in this codebase is low** (see [Architecture Insights](#architecture-insights)): `profiles` is tiny (one row per staff member), `vehicles` is small (fleet size), and the `reservations` policies use `using (true)` with no auth call at all. But the fix is cheap, removes the warning, and — most importantly — establishes the correct pattern for the upcoming role-gated slices (S-05/S-06 protocols, S-07 dashboard, S-08 employee management) that will add policies over larger tables.

## Detailed Findings

### Full RLS policy inventory

Complete list of every policy in the schema and whether it carries a per-row auth re-evaluation. The migrations live in `supabase/migrations/`.

| Policy | File:line | Predicate | Auth re-eval? | Linter flags? |
| --- | --- | --- | --- | --- |
| `profiles_select_authenticated` | `20260604153139_employee_admin_roles.sql:69` | `user_id = auth.uid() or current_app_role() = 'admin'` | **Yes** — direct `auth.uid()` **and** `current_app_role()` | **Yes** (direct `auth.uid()`) |
| `profiles_insert_authenticated` | `20260604153139_employee_admin_roles.sql:75` | `with check (current_app_role() = 'admin')` | Yes — `current_app_role()` | No (hidden in helper) |
| `profiles_update_authenticated` | `20260604153139_employee_admin_roles.sql:80` | `using/with check (current_app_role() = 'admin')` | Yes — `current_app_role()` (×2) | No |
| `profiles_delete_authenticated` | `20260604153139_employee_admin_roles.sql:86` | `using (current_app_role() = 'admin')` | Yes — `current_app_role()` | No |
| `vehicles_insert_staff` | `20260625120000_fleet_management.sql:35` | `with check (public.current_app_role() in ('employee','admin'))` | Yes — `current_app_role()` | No |
| `vehicles_update_staff` | `20260625120000_fleet_management.sql:40` | `using/with check (public.current_app_role() in ('employee','admin'))` | Yes — `current_app_role()` (×2) | No |
| `vehicles_select_anon` | `20260603155136_booking_integrity_data.sql:140` | `using (is_active = true)` | No | No |
| `vehicles_select_authenticated` | `20260625120000_fleet_management.sql:28` (redefines `...155136:145`) | `using (true)` | No | No |
| `reservations_select_authenticated` | `20260603155136_booking_integrity_data.sql:155` | `using (true)` | No | No |
| `reservations_insert_authenticated` | `20260603155136_booking_integrity_data.sql:160` | `with check (true)` | No | No |
| `reservations_update_authenticated` | `20260603155136_booking_integrity_data.sql:165` | `using/with check (true)` | No | No |
| `reservations_delete_authenticated` | `20260603155136_booking_integrity_data.sql:171` | `using (true)` | No | No |

**Net:** 1 policy directly flagged; 5 more (`profiles_insert/update/delete`, `vehicles_insert_staff`, `vehicles_update_staff`) carry the same latent per-row cost via `current_app_role()`; 6 are clean.

### The flagged policy

`supabase/migrations/20260604153139_employee_admin_roles.sql:69-72`:

```sql
create policy profiles_select_authenticated
  on profiles for select
  to authenticated
  using (user_id = auth.uid() or current_app_role() = 'admin');
```

### The helper that hides the rest of the cost

`supabase/migrations/20260604153139_employee_admin_roles.sql:47-55`:

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

This exists to break an **RLS recursion trap**: an inline `select … from profiles` inside a `profiles` policy would re-trigger `profiles` RLS and recurse infinitely. `SECURITY DEFINER` bypasses RLS, breaking the loop. (Rationale: `...:42-46` and the archived F-02 plan, see [Historical Context](#historical-context-from-prior-changes).) Note it is `stable` — necessary but **not sufficient** for one-time evaluation in a policy clause (see below).

### Recommended fix

A single forward migration (project convention: `supabase/migrations/YYYYMMDDHHmmss_short_description.sql`, RLS always enabled with per-operation/per-role policies — `CLAUDE.md` §Key conventions). Use `ALTER POLICY` to rewrite the predicates in place rather than drop/recreate:

```sql
-- Flagged policy: wrap BOTH the direct auth.uid() and the helper.
alter policy profiles_select_authenticated on profiles
  using ((select auth.uid()) = user_id or (select public.current_app_role()) = 'admin');

-- Latent cost: wrap current_app_role() in the remaining role-gated policies.
alter policy profiles_insert_authenticated on profiles
  with check ((select public.current_app_role()) = 'admin');
alter policy profiles_update_authenticated on profiles
  using ((select public.current_app_role()) = 'admin')
  with check ((select public.current_app_role()) = 'admin');
alter policy profiles_delete_authenticated on profiles
  using ((select public.current_app_role()) = 'admin');
alter policy vehicles_insert_staff on vehicles
  with check ((select public.current_app_role()) in ('employee', 'admin'));
alter policy vehicles_update_staff on vehicles
  using ((select public.current_app_role()) in ('employee', 'admin'))
  with check ((select public.current_app_role()) in ('employee', 'admin'));
```

- **No generated-types regen needed.** RLS policy bodies do not change the `Database` type contract (`src/db/database.types.ts`), so the post-migration `gen types` step that other migrations require does not apply here.
- **App code is unaffected.** The access boundary lives in middleware / `requireRole` / `current_app_role` semantics; this change only alters *how often* Postgres evaluates an unchanged predicate, not the predicate's result.
- **Verification:** `supabase db reset` (or apply the migration), then re-run the linter / `explain analyze` on a `select … from profiles` to confirm the auth calls appear as an InitPlan rather than a per-row filter.

## Code References

- `supabase/migrations/20260604153139_employee_admin_roles.sql:69-72` — `profiles_select_authenticated`, the directly flagged policy
- `supabase/migrations/20260604153139_employee_admin_roles.sql:47-55` — `current_app_role()` SECURITY DEFINER helper (calls `auth.uid()` at :54)
- `supabase/migrations/20260604153139_employee_admin_roles.sql:75-89` — `profiles_insert/update/delete` policies (gate via `current_app_role()`)
- `supabase/migrations/20260625120000_fleet_management.sql:35-44` — `vehicles_insert_staff` / `vehicles_update_staff` (gate via `current_app_role()`)
- `supabase/migrations/20260603155136_booking_integrity_data.sql:140-171` — vehicles/reservations policies (clean: `is_active = true` / `true`)
- `CLAUDE.md` §Key conventions — migration naming + "Always enable RLS … per-operation, per-role policies"

## Architecture Insights

- **The linter detects syntax, not semantics.** `auth_rls_initplan` flags *literal* `auth.*()` / `current_setting()` tokens in policy text. It cannot recurse into `current_app_role()`, so it under-reports: the same per-row cost lives in 5 unflagged policies. Fixing only the one flagged policy silences the warning but leaves the pattern half-applied. Recommend the thorough fix.
- **`STABLE` ≠ evaluated once.** A `STABLE` function with constant args is *safe* to evaluate once per query, but Postgres does not automatically hoist it; in a seq-scan filter it is generally called per row. The `(select …)` wrapper is what forces a one-time **InitPlan** (a scalar subquery the planner runs once and caches). This is why the docs wrap `is_admin()` as `(select is_admin())` even though it is a function, not raw `auth.uid()`.
- **Why impact is low *here* specifically:** the cost is `rows_scanned × auth_eval`. The only flagged table, `profiles`, holds one row per staff member (tens, not millions). `vehicles` is fleet-sized. The high-row table, `reservations`, deliberately uses `using (true)` with **no** auth call in its policies (`20260603155136_booking_integrity_data.sql:155-171`) — role enforcement for reservations happens in SECURITY DEFINER RPCs (`decide_reservation`, `list_pending_reservations`, `list_reservations_for_calendar`) rather than per-row RLS, so it never pays this cost. The fix is therefore hygiene + future-proofing, not a hot-path rescue.
- **Forward-looking:** upcoming slices add policies over potentially larger tables (S-05/S-06 issue/return protocols, S-07 overdue dashboard, S-08 employee management). Establishing `(select public.current_app_role())` as the canonical role-check idiom now — ideally captured as a lesson — prevents re-introducing the un-wrapped pattern.

## Historical Context (from prior changes)

- `context/archive/2026-06-04-employee-admin-roles/plan.md:34` — documents the **RLS recursion trap** and the decision to read the role through `current_app_role()` (SECURITY DEFINER) instead of an inline self-select. This is why the helper exists and why wrapping it (not removing it) is the right move.
- `context/archive/2026-06-04-employee-admin-roles/plan.md:307-309` — the original **"Performance Considerations"** section weighed only the *per-request* indexed `profiles` PK lookup ("Negligible at v1 single-tenant scale"). It did **not** consider the *per-row* InitPlan re-evaluation that this lint catches — so this finding is a genuine gap in the F-02 design, not a known/accepted trade-off.
- `context/archive/2026-06-04-employee-admin-roles/plan.md:78-89` — the policy definitions as originally planned, all using bare `auth.uid()` / `current_app_role()`.

## Related Research

- `context/archive/2026-06-04-employee-admin-roles/` — F-02 (employee/admin role model) is the origin of the `profiles` table, `current_app_role()`, and the flagged policy.
- `context/changes/fleet-management/` — S-04 added `vehicles_insert_staff` / `vehicles_update_staff`, which inherited the un-wrapped `current_app_role()` pattern.

## External References

- Supabase troubleshooting: "RLS performance and best practices" — *Wrap RLS functions in SELECT for caching*: `is_admin() or auth.uid() = user_id` → `(select is_admin()) OR (select auth.uid()) = user_id` (fetched via Context7, source `apps/docs/content/troubleshooting/rls-performance-and-best-practices-Z5Jjwv.mdx`).
- Supabase RLS guide — SECURITY DEFINER helper used inside a policy is itself wrapped: `using ( (select private.has_good_role()) )` (source `apps/docs/content/guides/database/postgres/row-level-security.mdx`).

## Open Questions

1. **Scope: minimal vs thorough.** Minimal = wrap only `profiles_select_authenticated` (silences the linter). Thorough = also wrap `current_app_role()` in the 5 unflagged role-gated policies. Recommendation: **thorough** — same migration, removes the latent cost, sets the pattern. Decide at `/10x-plan` time.
2. **Capture as a lesson?** Whether to add a `context/foundation/lessons.md` entry: "role checks in RLS policies must be wrapped as `(select public.current_app_role())`" so future slices don't reintroduce the un-wrapped form.
3. **`ALTER POLICY` vs `DROP`+`CREATE`.** `ALTER POLICY … USING/WITH CHECK` rewrites in place and is the cleaner diff; confirm it is acceptable under the project's "additive migration" convention (it is reversible by a symmetric `ALTER`).
