-- Demo account gate — Phase 2: the DB-layer half of the gate
--
-- WHY THIS EXISTS. Phase 2 put the demo refusal in the three route handlers
-- (`isDemoAccount` in src/lib/access.ts). That closes the browser door and
-- nothing else. `profiles.is_demo` never enters the JWT — it is a column the APP
-- reads onto `App.Locals`, so `current_app_role()` and every RLS policy see the
-- demo account as a plain admin, which it is.
--
-- The demo account's credentials are PUBLISHED, and the publishable anon key is
-- serialized into the page HTML on the two protocol screens
-- (`dashboard/pickups/[reservationId].astro:108` hands `supabaseKey` to a
-- `client:only` island). So a visitor holding nothing but what we deliberately
-- publish can sign in with supabase-js and talk to PostgREST directly, with no
-- Astro route in the path. Probed 2026-08-28 against local Supabase, all four
-- succeeded as the demo account against a stand-in for the owner's admin row:
--
--   A. update profiles set deactivated_at = now()  -> the lockout, no RPC needed
--   B. update profiles set role = 'employee'       -> demote the owner
--   C. delete from profiles                        -> strip the owner's role
--   D. rpc deactivate_staff(target)                -> 'ok'
--
-- A/B/C are why guarding only the RPC would have been cosmetic: they are easier
-- and strictly worse. Both layers are therefore closed here, and they are
-- genuinely different doors — `deactivate_staff` is SECURITY DEFINER, so it runs
-- as the owner and RLS never applies to it; an RLS-only fix would leave D open.
--
-- SAFE BY CONSTRUCTION for every non-demo caller. No app code writes `profiles`
-- through the caller's own authenticated client: `services/staff.ts` writes with
-- the SERVICE-ROLE client (RLS bypassed) and `mark_password_set()` is a definer
-- RPC (likewise). These three write policies are reached ONLY by a direct
-- PostgREST call, which is exactly the surface being closed. Verified by grep at
-- write time: the sole non-service `from("profiles")` call sites are
-- `middleware.ts:32` and `dashboard/account.astro:26`, both SELECT.
--
-- Rollback is symmetric and in place: re-run the three ALTER POLICY statements
-- without the `current_is_demo` clause, and `create or replace` the RPC without
-- its demo arm. Nothing outside this slice reads `current_is_demo()`.

-- ---------------------------------------------------------------------------
-- 1. current_is_demo() — the policy-callable half of `App.Locals.isDemo`
-- ---------------------------------------------------------------------------
--
-- Shape is `current_app_role()`'s, deliberately: same STABLE SECURITY DEFINER,
-- same `search_path = ''`, same ACL. A caller with no profiles row coalesces to
-- FALSE, which is the fail-closed answer here — the flag only ever DENIES, so
-- "unknown" must not deny a real admin out of their own deployment.
create or replace function public.current_is_demo()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select p.is_demo from public.profiles p where p.user_id = (select auth.uid())), false);
$$;

-- Per-function revoke BEFORE the grant: a grant alone restricts nothing against
-- Postgres' default PUBLIC execute grant (lessons.md → "Revoke EXECUTE before
-- granting it"). `authenticated` needs it explicitly because the policies below
-- call it and a policy helper executes as the QUERYING role.
revoke execute on function public.current_is_demo() from public, anon;
grant execute on function public.current_is_demo() to authenticated, service_role;

comment on function public.current_is_demo() is
  'True when the calling user is the published demo account (profiles.is_demo). The policy-callable twin of App.Locals.isDemo, which cannot be read from SQL because the flag is not a JWT claim. Only ever DENIES — a caller with no profiles row is false, so an unknown caller is never locked out.';

-- ---------------------------------------------------------------------------
-- 2. profiles writes — exclude the demo account
-- ---------------------------------------------------------------------------
--
-- ALTER POLICY in place rather than drop/recreate, so the change is reversible
-- by a symmetric ALTER and no window exists where the table is unprotected.
-- Every clause stays wrapped in `(select …)` so it is evaluated once per
-- statement rather than once per scanned row (lessons.md → "Wrap auth calls and
-- role helpers in (select …)"), including the new one.
--
-- SELECT is deliberately untouched. "No read-side restrictions" is a decision of
-- this slice, not an oversight: the seed data is fictional and the roster is the
-- thing a recruiter came to look at.
alter policy profiles_insert_authenticated on public.profiles
  with check (
    (select public.current_app_role()) = 'admin'
    and not (select public.current_is_demo())
  );

alter policy profiles_update_authenticated on public.profiles
  using (
    (select public.current_app_role()) = 'admin'
    and not (select public.current_is_demo())
  )
  with check (
    (select public.current_app_role()) = 'admin'
    and not (select public.current_is_demo())
  );

alter policy profiles_delete_authenticated on public.profiles
  using (
    (select public.current_app_role()) = 'admin'
    and not (select public.current_is_demo())
  );

-- ---------------------------------------------------------------------------
-- 3. deactivate_staff() — the definer path RLS cannot see
-- ---------------------------------------------------------------------------
--
-- Verbatim re-statement of the shipped function (20260723194602) with ONE new
-- arm. `create or replace` keeps the signature and therefore the ACL, unlike the
-- DROP in 20260821100000 which had to re-state both grants.
--
-- The demo arm sits AFTER the admin check and BEFORE `self`, mirroring the route
-- handler's ladder: a non-admin still reads as 'unauthorized', and a demo caller
-- is told it is the demo marker refusing them rather than any of the four other
-- reasons. The `self` / `last_admin` guards are untouched — they answer a
-- different question and still apply to every real admin.
create or replace function public.deactivate_staff(target uuid)
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

  -- The published demo account. RLS cannot reach this function (SECURITY DEFINER
  -- runs as the owner), so without this arm the route guard is bypassable by any
  -- visitor holding the published credentials — which is the very lockout the
  -- self/last_admin guards below do NOT cover: neither stops a demo admin from
  -- removing a DIFFERENT admin, i.e. the owner.
  if (select public.current_is_demo()) then
    return 'demo';
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

-- Re-stated defensively. `create or replace` preserves the ACL, so this is a
-- no-op today — but the rule is per-function, every time, and a future edit that
-- reaches for DROP would silently reopen the PUBLIC execute grant.
revoke execute on function public.deactivate_staff(uuid) from public, anon;
grant execute on function public.deactivate_staff(uuid) to authenticated, service_role;

comment on function public.deactivate_staff(uuid) is
  'Soft-remove a staffer. Returns ok | demo | self | last_admin | not_found | unauthorized. Admin-only; the demo arm refuses the published demo account, because SECURITY DEFINER bypasses the RLS that closes the same hole on direct table writes.';
