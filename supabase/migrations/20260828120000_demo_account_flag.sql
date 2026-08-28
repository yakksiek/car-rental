-- Demo account gate — Phase 1: the account marker
--
-- This deployment doubles as a portfolio, so a published demo admin account has
-- to exist for recruiters. The three staff mutations that either send mail from
-- a domain we own (POST /api/staff, [id]/reset-password) or can lock the owner
-- out of their own deployment ([id]/deactivate) must refuse that account.
--
-- The marker sits on the ACCOUNT, not on the deployment: the owner's real admin
-- account keeps working normally in the same environment, so no secret has to be
-- flipped to do real staff work.
--
-- Additive and non-breaking: every existing row is a real account, so the column
-- defaults to false and no behaviour changes on apply. Rollback is a single
-- `alter table public.profiles drop column is_demo` — nothing outside this slice
-- depends on it.
--
-- No RLS or grant work: profiles_select_authenticated
-- (20260604153139_employee_admin_roles.sql) is already
-- `using (user_id = auth.uid() or current_app_role() = 'admin')`, and middleware
-- reads only the caller's OWN row, so the new column is covered as-is.

alter table public.profiles
  add column is_demo boolean not null default false;

comment on column public.profiles.is_demo is
  'Marks a published, publicly-credentialed demo account. It only ever DENIES outward-reaching or lockout-capable staff mutations — it grants nothing — so the false default is the safe one and every existing account is unaffected. Read by src/middleware.ts onto App.Locals.isDemo and enforced by isDemoAccount() in src/lib/access.ts.';
