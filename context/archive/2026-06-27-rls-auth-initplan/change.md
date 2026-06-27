---
change_id: rls-auth-initplan
title: Wrap auth.uid()/current_app_role() in (select …) to fix RLS InitPlan re-evaluation
status: archived
created: 2026-06-27
updated: 2026-06-27
archived_at: 2026-06-27T10:28:24Z
---

## Notes

Seeded from a Supabase database linter finding (`auth_rls_initplan`, lint 0003):

> Table `public.profiles` has a row level security policy `profiles_select_authenticated` that re-evaluates `current_setting()` or `auth.<function>()` for each row. This produces suboptimal query performance at scale. Resolve the issue by replacing `auth.<function>()` with `(select auth.<function>())`.

- **Flagged directly:** one policy — `profiles_select_authenticated` (`supabase/migrations/20260604153139_employee_admin_roles.sql:69`). It is the only policy in the schema with a **direct** `auth.uid()` call.
- **Same latent cost, not flagged:** every other role-gated policy routes through the `current_app_role()` SECURITY DEFINER helper, which the linter cannot see into but which is also re-evaluated per row unless wrapped in `(select …)`.
- **Fix:** a forward migration that `alter policy … using/with check` to wrap `auth.uid()` and `current_app_role()` in scalar subqueries, so Postgres hoists them to a one-time InitPlan.
- See `context/changes/rls-auth-initplan/research.md` for the full policy inventory and decision points.
