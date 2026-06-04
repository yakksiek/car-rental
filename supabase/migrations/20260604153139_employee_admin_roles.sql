-- Employee/Admin Role Model (F-02) — Phase 1: Role Schema & RLS
--
-- Adds the role layer on top of the existing (role-less) Supabase auth: a role
-- enum, a profiles table mapping auth.users -> app_role, a recursion-safe role
-- reader, the profiles RLS posture, and the updated_at trigger. Additive over
-- F-01 (20260603155136_booking_integrity_data.sql) — no changes to existing
-- tables or their RLS. See context/changes/employee-admin-roles/plan.md (Phase 1).

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------

-- admin is a strict superset of employee (PRD §Access Control). One role per user.
create type app_role as enum ('employee', 'admin');

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------

-- Maps an auth.users row to exactly one app role. No email/name here — those
-- live in auth.users (and richer staff fields arrive with S-08). A user with no
-- profiles row resolves to role = null and is denied (fail-closed): roles are
-- only ever granted deliberately (seed / S-08 / prod first-admin runbook), never
-- auto-created with a privileged default.
create table profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  role app_role not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Reuse F-01's set_updated_at() trigger function (do not redefine it).
create trigger profiles_set_updated_at
  before update on profiles
  for each row
  execute function set_updated_at();

-- ---------------------------------------------------------------------------
-- Recursion-safe role reader
-- ---------------------------------------------------------------------------

-- Returns the caller's role, or null when they have no profile. SECURITY DEFINER
-- so it bypasses RLS: an "is the caller an admin?" check inside a profiles policy
-- that selected from profiles directly would re-trigger profiles RLS and recurse
-- infinitely. Reading the role through this function breaks that loop. This is
-- the load-bearing reason the function exists (not just ergonomics).
create function public.current_app_role()
returns app_role
language sql
stable
security definer
set search_path = ''
as $$
  select role from public.profiles where user_id = auth.uid();
$$;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

alter table profiles enable row level security;

-- Every admin check routes through current_app_role(), never an inline profiles
-- self-select, to avoid RLS recursion. No anon policy => anon is denied by
-- default. The dev seed and prod bootstrap write as the table owner / service
-- context and bypass RLS, so "no profile => no access" stays the safe default.

-- SELECT: a caller reads their own row; an admin reads every row.
create policy profiles_select_authenticated
  on profiles for select
  to authenticated
  using (user_id = auth.uid() or current_app_role() = 'admin');

-- INSERT / UPDATE / DELETE: admin-only (staff management; admin user-creation is S-08).
create policy profiles_insert_authenticated
  on profiles for insert
  to authenticated
  with check (current_app_role() = 'admin');

create policy profiles_update_authenticated
  on profiles for update
  to authenticated
  using (current_app_role() = 'admin')
  with check (current_app_role() = 'admin');

create policy profiles_delete_authenticated
  on profiles for delete
  to authenticated
  using (current_app_role() = 'admin');
