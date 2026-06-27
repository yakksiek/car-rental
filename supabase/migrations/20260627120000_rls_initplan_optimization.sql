-- RLS InitPlan optimization — wrap per-row auth evaluations in scalar subqueries.
--
-- Supabase's `auth_rls_initplan` advisor flags RLS policies that call auth.<fn>()
-- (or current_setting()) directly in a USING/WITH CHECK clause: such calls are
-- re-evaluated once per scanned row. Wrapping a call in a scalar subquery —
-- (select auth.uid()) — lets the planner hoist it to a one-time InitPlan,
-- evaluated once per statement instead of once per row.
--
-- The same applies to our role helper current_app_role(): although it is STABLE,
-- STABLE is necessary but NOT sufficient for one-time evaluation — only the
-- (select ...) wrapper forces the InitPlan. The advisor only matches literal
-- auth.*()/current_setting() tokens, so it flags just profiles_select_authenticated
-- (the one policy with a direct auth.uid()); the other five role-gated policies
-- carry the identical per-row cost through current_app_role() and are fixed here
-- too. See context/changes/rls-auth-initplan/research.md.
--
-- This is a pure performance change: every predicate's result is unchanged, only
-- how often Postgres evaluates it. ALTER POLICY rewrites each predicate in place,
-- preserving policy name/role/command. Reversible by symmetric ALTER POLICY.
-- No clean policy (vehicles_select_*, reservations_*) is touched — they carry no
-- auth call.

-- ---------------------------------------------------------------------------
-- profiles (20260604153139_employee_admin_roles.sql)
-- ---------------------------------------------------------------------------

alter policy profiles_select_authenticated on profiles
  using (user_id = (select auth.uid()) or (select public.current_app_role()) = 'admin');

alter policy profiles_insert_authenticated on profiles
  with check ((select public.current_app_role()) = 'admin');

alter policy profiles_update_authenticated on profiles
  using ((select public.current_app_role()) = 'admin')
  with check ((select public.current_app_role()) = 'admin');

alter policy profiles_delete_authenticated on profiles
  using ((select public.current_app_role()) = 'admin');

-- ---------------------------------------------------------------------------
-- vehicles (20260625120000_fleet_management.sql)
-- ---------------------------------------------------------------------------

alter policy vehicles_insert_staff on vehicles
  with check ((select public.current_app_role()) in ('employee', 'admin'));

alter policy vehicles_update_staff on vehicles
  using ((select public.current_app_role()) in ('employee', 'admin'))
  with check ((select public.current_app_role()) in ('employee', 'admin'));
