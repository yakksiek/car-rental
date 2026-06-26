-- Fleet Management (S-04) — Phase 1: write RLS + atomic retire guard
--
-- Opens the vehicle write path to staff (currently the table is read-only: F-01
-- shipped only SELECT policies, so every INSERT/UPDATE/DELETE is denied). Adds:
--   * role-gated INSERT/UPDATE policies (employee/admin via current_app_role()),
--   * a broadened authenticated SELECT so staff also see retired vehicles
--     (v1 has no customer accounts → `authenticated` == staff),
--   * the set_vehicle_active() SECURITY DEFINER RPC that holds the soft-delete
--     guard atomically (retire is blocked while pending/confirmed reservations
--     exist — the same active-status set as reservations_no_overlap).
-- No DELETE policy: hard delete stays denied (reservations.vehicle_id is ON
-- DELETE RESTRICT and rejected/cancelled rows still pin the FK), so "remove" is
-- the RPC's soft-delete. Definer hygiene mirrors S-02/S-03 RPCs (security
-- definer + set search_path = '' + every name schema-qualified).
-- Additive over F-01 (20260603155136) + F-02 (20260604153139).
-- See context/changes/fleet-management/plan.md (Phase 1).

-- ---------------------------------------------------------------------------
-- RLS: broaden staff reads, open staff writes
-- ---------------------------------------------------------------------------

-- Staff (== authenticated in v1) read the full fleet, including retired vehicles,
-- so the management screen can list + restore them. Anon stays restricted to
-- active vehicles by the untouched vehicles_select_anon policy, so the public
-- catalog never leaks retired rows through this broadening.
drop policy vehicles_select_authenticated on vehicles;

create policy vehicles_select_authenticated
  on vehicles for select
  to authenticated
  using (true);

-- INSERT / UPDATE: employee or admin only. A null role (no profile) fails closed.
-- DELETE is intentionally NOT opened — removal is the soft-delete RPC below.
create policy vehicles_insert_staff
  on vehicles for insert
  to authenticated
  with check (public.current_app_role() in ('employee', 'admin'));

create policy vehicles_update_staff
  on vehicles for update
  to authenticated
  using (public.current_app_role() in ('employee', 'admin'))
  with check (public.current_app_role() in ('employee', 'admin'));

-- ---------------------------------------------------------------------------
-- set_vehicle_active — the guarded soft-delete / restore write
-- ---------------------------------------------------------------------------

-- The single atomic retire/restore path. The retire guard (existence + active
-- reservation check) and the is_active flip happen in ONE update statement, so a
-- reservation confirmed between a separate check and write can never slip past:
-- the `not exists (...)` predicate is evaluated against the same row version the
-- update locks. Returns a tag the API maps to HTTP:
--   * 'unauthorized'           -> role gate failed (employee/admin only) -> 403
--   * 'not_found'              -> no such vehicle id                      -> 404
--   * 'has_active_reservations'-> retire blocked by pending/confirmed     -> 409
--   * 'ok'                     -> the flip happened                       -> 200
create function public.set_vehicle_active(p_id uuid, p_active boolean)
returns table (result text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_role public.app_role;
  v_updated int;
  v_exists boolean;
begin
  -- Role gate: only employees/admins may retire/restore. Null role fails closed.
  v_role := public.current_app_role();
  if v_role is null or v_role not in ('employee', 'admin') then
    return query select 'unauthorized'::text;
    return;
  end if;

  if p_active = false then
    -- Atomic retire: flips only when no blocking reservation exists. The active
    -- set ('pending','confirmed') matches reservations_no_overlap exactly.
    update public.vehicles
      set is_active = false
      where id = p_id
        and not exists (
          select 1 from public.reservations
          where vehicle_id = p_id and status in ('pending', 'confirmed')
        );
    get diagnostics v_updated = row_count;

    if v_updated > 0 then
      return query select 'ok'::text;
      return;
    end if;

    -- 0 rows updated -> distinguish a missing vehicle from a blocked one.
    select exists (select 1 from public.vehicles where id = p_id) into v_exists;
    if v_exists then
      return query select 'has_active_reservations'::text;
    else
      return query select 'not_found'::text;
    end if;
    return;
  else
    -- Restore: no guard needed — bringing a vehicle back is always safe.
    update public.vehicles set is_active = true where id = p_id;
    get diagnostics v_updated = row_count;

    if v_updated > 0 then
      return query select 'ok'::text;
    else
      return query select 'not_found'::text;
    end if;
    return;
  end if;
end;
$$;

-- Staff-only: anon never reaches this (no grant); the in-RPC role gate is the
-- authority regardless.
grant execute on function public.set_vehicle_active(uuid, boolean) to authenticated;
