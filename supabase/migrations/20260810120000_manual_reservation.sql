-- Manual reservation (S-12) — Phase 1: origin marker + the confirmed-insert RPC
--
-- Lets an employee create a CONFIRMED booking by hand for a phone-in customer.
-- Neither existing write path can do this: create_reservation_request
-- (20260613090000) hardcodes status='pending', and decide_reservation
-- (20260617120000) only transitions a row that is already pending. So this adds
-- a third definer write path that INSERTS a confirmed row directly.
--
-- The atomicity story differs from decide_reservation: that one flips a pending
-- row which ALREADY holds its slot in the reservations_no_overlap EXCLUDE set,
-- so it needs no overlap check. This one inserts into that set, so it must map
-- exclusion_violation (23P01) to a typed 'conflict' — attempt-then-map, never
-- check-then-insert (the live availability GET in front of it is advisory UX;
-- this constraint is the TOCTOU-safe authority).
--
-- Additive over F-02 (roles), S-02 (reservation model + reference minting) and
-- S-03 (approval + calendar). No backfill: `source` defaults to 'public', so
-- every existing row and the whole public funnel stay 'public'.
-- See context/changes/manual-reservation/plan.md (Phase 1).

-- ---------------------------------------------------------------------------
-- reservations: the origin marker
-- ---------------------------------------------------------------------------

-- Orthogonal to `status`: a booking's origin (who entered it) is independent of
-- its lifecycle state. 'public' = the website funnel, 'manual' = staff-entered.
create type public.reservation_source as enum ('public', 'manual');

alter table reservations
  add column source public.reservation_source not null default 'public';

-- ---------------------------------------------------------------------------
-- create_confirmed_reservation — the staff confirmed-insert write
-- ---------------------------------------------------------------------------

-- Definer hygiene mirrors the sibling RPCs (security definer + set search_path
-- = '' + every name schema-qualified):
--   * role gate: current_app_role() must be employee/admin, else 'unauthorized'
--     (a null role — authenticated user with no profile — fails closed).
--   * vehicle must exist and be active, else 'unavailable' (RLS is bypassed
--     here, so is_active is re-checked explicitly).
--   * reference is minted server-side from the shared sequence; up to 3 attempts
--     because a unique_violation can only mean a reference clash. The
--     exclusion_violation path is terminal — the range is genuinely taken.
--   * status/source are hard-coded 'confirmed'/'manual'; neither accepts client
--     input.
--
-- RETURNS the result tag + the new row's id (the email_deliveries entityId) +
-- EXACTLY the 11 columns decide_reservation returns. That shape match is load-
-- bearing: it lets the endpoint reuse the confirmed-email path unchanged
-- (src/types.ts -> DecisionEmailPayload).
create function public.create_confirmed_reservation(
  p_vehicle_id uuid,
  p_pickup date,
  p_return date,
  p_customer_name text,
  p_customer_email text,
  p_customer_phone text
)
returns table (
  result text,
  id uuid,
  customer_name text,
  customer_email text,
  reference text,
  access_token uuid,
  pickup_date date,
  return_date date,
  vehicle_make text,
  vehicle_model text,
  vehicle_production_year int,
  vehicle_daily_rate numeric,
  vehicle_deposit numeric
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_role public.app_role;
  v_reference text;
  v_id uuid;
begin
  -- Role gate: staff only. Kept alongside the EXECUTE revoke below — defense in
  -- depth, not either/or (lessons.md -> "Revoke EXECUTE before granting it").
  v_role := public.current_app_role();
  if v_role is null or v_role not in ('employee', 'admin') then
    return query
      select 'unauthorized'::text, null::uuid, null::text, null::text, null::text, null::uuid,
             null::date, null::date, null::text, null::text, null::int, null::numeric, null::numeric;
    return;
  end if;

  if not exists (
    select 1 from public.vehicles v
    where v.id = p_vehicle_id and v.is_active
  ) then
    return query
      select 'unavailable'::text, null::uuid, null::text, null::text, null::text, null::uuid,
             null::date, null::date, null::text, null::text, null::int, null::numeric, null::numeric;
    return;
  end if;

  for attempt in 1..3 loop
    v_reference := 'R-' || public.base36_encode(nextval('public.reservation_reference_seq'));
    begin
      insert into public.reservations (
        vehicle_id, customer_name, customer_email, customer_phone,
        pickup_date, return_date, status, source, reference
      ) values (
        p_vehicle_id, p_customer_name, p_customer_email, p_customer_phone,
        p_pickup, p_return, 'confirmed', 'manual', v_reference
      )
      returning reservations.id into v_id;

      -- Success: the result tag + the id + the email payload, read back from the
      -- committed row joined to its vehicle (qualified refs only, so no
      -- ambiguity with the OUT column names).
      return query
        select
          'created'::text, r.id,
          r.customer_name, r.customer_email, r.reference, r.access_token,
          r.pickup_date, r.return_date,
          v.make, v.model, v.production_year, v.daily_rate, v.deposit
        from public.reservations r
        join public.vehicles v on v.id = r.vehicle_id
        where r.id = v_id;
      return;
    exception
      when exclusion_violation then
        -- 23P01 from reservations_no_overlap: the slot is already taken by a
        -- pending or confirmed booking.
        return query
          select 'conflict'::text, null::uuid, null::text, null::text, null::text, null::uuid,
                 null::date, null::date, null::text, null::text, null::int, null::numeric, null::numeric;
        return;
      when unique_violation then
        if attempt = 3 then
          raise;
        end if;
    end;
  end loop;
end;
$$;

-- Revoke FIRST, then grant: `grant ... to authenticated` alone restricts nothing
-- against the built-in PUBLIC grant + Supabase's default anon grant
-- (lessons.md -> "Revoke EXECUTE before granting it").
revoke execute on function public.create_confirmed_reservation(uuid, date, date, text, text, text)
  from public, anon;
grant execute on function public.create_confirmed_reservation(uuid, date, date, text, text, text)
  to authenticated;

-- ---------------------------------------------------------------------------
-- list_reservations_for_calendar — recreate carrying `source`
-- ---------------------------------------------------------------------------

-- A RETURNS-shape change requires drop + recreate (`create or replace` cannot
-- alter the OUT columns). Body is otherwise identical to 20260617122000.
--
-- CRITICAL: the DROP also drops the function's ACL, so the recreated function
-- re-receives the built-in PUBLIC grant (+ Supabase's anon default). The revoke
-- that closed that hole lives in a SEPARATE migration
-- (20260714120000_rpc_execute_grant_hardening.sql:38), NOT in 20260617122000 —
-- so it must be re-issued HERE or anon silently regains execute on the calendar
-- read. Guarded by tests/integration/rpc-execute-grants.test.ts.
drop function public.list_reservations_for_calendar(date, date);

create function public.list_reservations_for_calendar(p_start date, p_end date)
returns table (
  id uuid,
  reference text,
  status public.reservation_status,
  source public.reservation_source,
  customer_name text,
  vehicle_id uuid,
  vehicle_make text,
  vehicle_model text,
  pickup_date date,
  return_date date
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    r.id, r.reference, r.status, r.source, r.customer_name,
    r.vehicle_id, v.make, v.model, r.pickup_date, r.return_date
  from public.reservations r
  join public.vehicles v on v.id = r.vehicle_id
  where r.status in ('pending', 'confirmed')
    and r.pickup_date <= p_end
    and r.return_date >= p_start
    and public.current_app_role() in ('employee', 'admin')
  order by r.pickup_date;
$$;

revoke execute on function public.list_reservations_for_calendar(date, date) from public, anon;
grant execute on function public.list_reservations_for_calendar(date, date) to authenticated;
