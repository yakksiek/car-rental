-- Employee Account Management (S-08) — Phase 1: staff columns + read/deactivate RPCs
--
-- Extends F-02's role layer (20260604153139_employee_admin_roles.sql) with the
-- two profile columns the admin roster needs — a listable display name and a
-- soft-deactivate marker — plus the two admin-gated SECURITY DEFINER RPCs that
-- back the roster read and the guarded soft-remove. Additive: no changes to
-- existing tables' RLS; reversible by dropping the RPCs + columns.
--
-- Removal is a SOFT deactivate (deactivated_at), never a hard delete: the
-- protocols.created_by -> auth.users FK (20260710120000_issue_protocol.sql:92,
-- ON DELETE NO ACTION) makes the DB reject deleting anyone who has filled a
-- protocol. See context/changes/employee-account-management/plan.md (Phase 1).

-- ---------------------------------------------------------------------------
-- profiles — listable name + soft-deactivate marker
-- ---------------------------------------------------------------------------

-- full_name is nullable: the invite flow always sets it (raw_user_meta_data ->
-- profiles insert), the seed backfills existing rows. deactivated_at null =
-- active; a non-null value hides the row from list_staff() and (via middleware)
-- resolves the user's role to null so they are denied every gated route.
alter table public.profiles add column full_name text;
alter table public.profiles add column deactivated_at timestamptz;

-- ---------------------------------------------------------------------------
-- list_staff() — admin-gated roster read (mirrors list_pending_reservations)
-- ---------------------------------------------------------------------------

-- Joins profiles to auth.users so the roster carries email + invite/last-sign-in
-- timestamps (which live on auth.users, not profiles). SECURITY DEFINER to read
-- auth.users and bypass profiles RLS; the in-function role gate is the real
-- boundary. Yields rows ONLY for an admin caller and ONLY for non-deactivated
-- profiles — a non-admin (or the service-role client, whose auth.uid() is null)
-- gets zero rows. The role predicate is wrapped as a scalar subquery so it is
-- evaluated once per statement, not once per row (lessons.md: initplan).
create function public.list_staff()
returns table (
  user_id uuid,
  full_name text,
  email text,
  role public.app_role,
  deactivated_at timestamptz,
  invited_at timestamptz,
  last_sign_in_at timestamptz,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select p.user_id, p.full_name, u.email::text, p.role,
         p.deactivated_at, u.invited_at, u.last_sign_in_at, p.created_at
  from public.profiles p
  join auth.users u on u.id = p.user_id
  where (select public.current_app_role()) = 'admin'
    and p.deactivated_at is null
  order by p.created_at;
$$;

-- ---------------------------------------------------------------------------
-- deactivate_staff(target) — guarded soft-remove
-- ---------------------------------------------------------------------------

-- Authoritative home for the self / last-admin guards: it runs as the caller
-- (current_app_role() = 'admin' gate) so a direct API call can never strand the
-- org with zero admins. Returns a text result tag the service maps to HTTP.
-- Reactivation is NOT handled here — the service clears deactivated_at on re-add.
create function public.deactivate_staff(target uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_role public.app_role;
  target_deactivated timestamptz;
  active_admins int;
begin
  -- `is distinct from` (not `<>`): a null role — a user with no profile — must
  -- resolve to 'unauthorized'. `null <> 'admin'` is NULL, which PL/pgSQL's `if`
  -- treats as false, so a bare `<>` would let a role-less caller through.
  if (select public.current_app_role()) is distinct from 'admin' then
    return 'unauthorized';
  end if;

  if target = (select auth.uid()) then
    return 'self';
  end if;

  select role, deactivated_at
    into target_role, target_deactivated
  from public.profiles
  where user_id = target;

  if not found or target_deactivated is not null then
    return 'not_found';
  end if;

  -- target is admin + active, so it is counted below; count <= 1 means it is the
  -- only remaining active admin.
  if target_role = 'admin' then
    select count(*) into active_admins
    from public.profiles
    where role = 'admin' and deactivated_at is null;
    if active_admins <= 1 then
      return 'last_admin';
    end if;
  end if;

  update public.profiles set deactivated_at = now() where user_id = target;
  return 'ok';
end;
$$;

-- ---------------------------------------------------------------------------
-- EXECUTE grants — revoke-before-grant (lessons.md: a grant alone never
-- restricts an RPC; the default PUBLIC execute grant must be revoked first).
-- ---------------------------------------------------------------------------
revoke execute on function public.list_staff() from public, anon;
revoke execute on function public.deactivate_staff(uuid) from public, anon;
grant execute on function public.list_staff() to authenticated;
grant execute on function public.deactivate_staff(uuid) to authenticated;
