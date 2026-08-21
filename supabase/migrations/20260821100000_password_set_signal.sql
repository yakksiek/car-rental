-- Invite journey fixes — Phase 2: an OWNED password-set signal
--
-- Today "does this person have a working password?" is answered by
-- auth.users.last_sign_in_at (services/staff.ts deriveStatus + wasActive). That
-- proxy is corrupted: GoTrue stamps last_sign_in_at on the invite LINK EXCHANGE
-- (verifyOtp), so a hire who merely clicked their link — and never chose a
-- password — reads as ACTIVE, is listed AKTYWNY, and is sent no activation mail
-- when an admin re-adds them. Probed against local GoTrue v2.188.1, 2026-08-20.
--
-- auth.users.encrypted_password is NOT a usable substitute: the same exchange
-- writes a random 60-char bcrypt hash there (verified with extensions.crypt — it
-- is not bcrypt of the empty string), so it is corrupted by exactly the same
-- event. There is no GoTrue-side password-set signal; the signal has to be one
-- we own and write ourselves.
--
-- Additive and reversible: drop the column + the RPC and recreate list_staff
-- without the OUT column — re-stating BOTH the revoke and the grant — to undo.

-- ---------------------------------------------------------------------------
-- 1. The column
-- ---------------------------------------------------------------------------

-- null = no password has ever been set through one of our own two set-password
-- routes (api/auth/reset-password.ts, api/auth/change-password.ts).
alter table public.profiles add column password_set_at timestamptz;

comment on column public.profiles.password_set_at is
  'When this person last set a password through one of our own routes. NULL = never. The roster reads it for ACTIVE vs INVITED. Never write it from a link exchange — that is the corrupted proxy this column replaces.';

-- ---------------------------------------------------------------------------
-- 2. Behaviour-neutral backfill
-- ---------------------------------------------------------------------------

-- Source it from last_sign_in_at so EVERY existing row derives exactly the
-- status it derives today: no live account changes label on deploy, and nobody
-- is mailed. This KNOWINGLY inherits today's error for the small population who
-- clicked their invite link but never set a password — they stay mislabelled
-- AKTYWNY until they actually set one, at which point the stamp becomes true.
-- Correcting them here would need a signal that does not exist (see header).
update public.profiles p
   set password_set_at = u.last_sign_in_at
  from auth.users u
 where u.id = p.user_id
   and u.last_sign_in_at is not null;

-- ---------------------------------------------------------------------------
-- 3. mark_password_set() — the only writer
-- ---------------------------------------------------------------------------

-- profiles UPDATE is admin-only (20260604153139_employee_admin_roles.sql:80-84),
-- so an employee cannot stamp their own row directly; this definer RPC is the seam.
--
-- It takes NO target parameter, deliberately: one would let any authenticated
-- caller stamp anyone. The row is chosen by auth.uid() alone, wrapped as a scalar
-- subquery so it is evaluated once per statement rather than once per row
-- (lessons.md -> "Wrap auth calls and role helpers in (select …)"). A caller with
-- no profiles row updates zero rows — a silent no-op, not an error.
create function public.mark_password_set()
returns void
language sql
security definer
set search_path = ''
as $$
  update public.profiles
     set password_set_at = now()
   where user_id = (select auth.uid());
$$;

-- ---------------------------------------------------------------------------
-- 4. list_staff() — carry the new column
-- ---------------------------------------------------------------------------

-- The OUT columns change, so `create or replace` cannot alter the signature —
-- drop and recreate (same shape as 20260728120000_list_pending_reservations_add_plate).
-- A DROP resets the ACL to Supabase's default (EXECUTE to PUBLIC + anon), so BOTH
-- the revoke and the grant are re-stated below. Re-stating only the grant is
-- exactly the regression 20260731212650_list_pending_reservations_revoke_anon was
-- written to fix forward. Role gate and definer hygiene are verbatim from
-- 20260723194602_employee_account_management.
drop function if exists public.list_staff();

create function public.list_staff()
returns table (
  user_id uuid,
  full_name text,
  email text,
  role public.app_role,
  deactivated_at timestamptz,
  invited_at timestamptz,
  last_sign_in_at timestamptz,
  password_set_at timestamptz,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select p.user_id, p.full_name, u.email::text, p.role,
         p.deactivated_at, u.invited_at, u.last_sign_in_at, p.password_set_at, p.created_at
  from public.profiles p
  join auth.users u on u.id = p.user_id
  where (select public.current_app_role()) = 'admin'
    and p.deactivated_at is null
  order by p.created_at;
$$;

-- ---------------------------------------------------------------------------
-- EXECUTE grants — revoke BEFORE grant, per function, every time
-- (lessons.md -> "Revoke EXECUTE before granting it": a grant alone is a no-op
-- against Postgres' default PUBLIC grant plus Supabase's default anon grant).
-- tests/integration/rpc-execute-grants.test.ts pins both of these.
-- ---------------------------------------------------------------------------
revoke execute on function public.list_staff() from public, anon;
revoke execute on function public.mark_password_set() from public, anon;
grant execute on function public.list_staff() to authenticated;
grant execute on function public.mark_password_set() to authenticated;
