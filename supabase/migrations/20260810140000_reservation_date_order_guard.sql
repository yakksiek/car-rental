-- Manual reservation (S-12) — Phase 6: a date-order guard in BOTH create RPCs.
--
-- `reserved_period` is generated as
--   tsrange(pickup_date + '14:00', return_date + '10:00')
-- (20260603155136_booking_integrity_data.sql:104-105) while the table's
-- `reservations_dates_ordered` CHECK only requires `return_date >= pickup_date`
-- (:109). So a SAME-DAY range (p_return = p_pickup) produces lower > upper —
-- 14:00 > 10:00 — and Postgres raises a `data_exception` ("range lower bound
-- must be less than or equal to range upper bound") that neither RPC's
-- exception block catches. The caller gets a raw error instead of one of the
-- typed result tags the contract promises.
--
-- Unreachable through the HTTP endpoints (the zod schemas require start < end
-- via catalog-filters.ts:135-136), but both RPCs are reachable directly through
-- PostgREST: `create_confirmed_reservation` by any employee, and
-- `create_reservation_request` by ANON — it is the public funnel's write path.
-- Same-day is a shape people genuinely try (the design mockup even treats it as
-- valid), so both should answer `unavailable` rather than error.
--
-- CREATE OR REPLACE, never DROP + CREATE: replace preserves the existing ACL, so
-- the revoke/grant pairs survive. A drop+create would silently re-open the
-- built-in PUBLIC execute grant on both functions — including the anon-facing
-- create_reservation_request (lessons.md -> "Revoke EXECUTE before granting
-- it"). Neither signature changes, so `database.types.ts` needs no regen.
-- See context/changes/manual-reservation/plan.md (Phase 6).

-- ---------------------------------------------------------------------------
-- create_confirmed_reservation — guard after the role gate, before the vehicle
-- lookup (a non-staff caller still learns nothing about the fleet).
-- ---------------------------------------------------------------------------

create or replace function public.create_confirmed_reservation(
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
  -- Role gate: staff only. Kept alongside the EXECUTE revoke — defense in depth,
  -- not either/or (lessons.md -> "Revoke EXECUTE before granting it").
  v_role := public.current_app_role();
  if v_role is null or v_role not in ('employee', 'admin') then
    return query
      select 'unauthorized'::text, null::uuid, null::text, null::text, null::text, null::uuid,
             null::date, null::date, null::text, null::text, null::int, null::numeric, null::numeric;
    return;
  end if;

  -- Date-order guard (see header): a same-day or inverted range would invert
  -- reserved_period and raise, so answer with the typed tag instead.
  if p_return <= p_pickup then
    return query
      select 'unavailable'::text, null::uuid, null::text, null::text, null::text, null::uuid,
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

-- ---------------------------------------------------------------------------
-- create_reservation_request — the anon-reachable public funnel write. Same
-- guard, first thing in the body (this one has no role gate).
-- ---------------------------------------------------------------------------

create or replace function public.create_reservation_request(
  p_vehicle_id uuid,
  p_pickup date,
  p_return date,
  p_customer_name text,
  p_customer_email text,
  p_customer_phone text,
  p_terms_accepted boolean,
  p_company text default null,
  p_vat_id text default null,
  p_notes text default null
)
returns table (result text, reference text, access_token uuid)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_reference text;
  v_token uuid;
begin
  -- Date-order guard (see header). Anon-reachable, so this is the arm that
  -- actually closes a raw-error path for untrusted callers.
  if p_return <= p_pickup then
    return query select 'unavailable'::text, null::text, null::uuid;
    return;
  end if;

  -- Vehicle must exist and be active (RLS is bypassed here, so re-check
  -- is_active explicitly — same care as available_vehicles).
  if not exists (
    select 1 from public.vehicles v
    where v.id = p_vehicle_id and v.is_active
  ) then
    return query select 'unavailable'::text, null::text, null::uuid;
    return;
  end if;

  -- Up to 3 attempts: a unique_violation can only mean a reference clash
  -- (e.g. against a backfilled code), so retry with a fresh one. The
  -- exclusion_violation path is terminal — the range is genuinely taken.
  for attempt in 1..3 loop
    v_reference := 'R-' || public.base36_encode(nextval('public.reservation_reference_seq'));
    begin
      insert into public.reservations (
        vehicle_id, customer_name, customer_email, customer_phone,
        pickup_date, return_date, status, reference, terms_accepted_at,
        company, vat_id, notes
      ) values (
        p_vehicle_id, p_customer_name, p_customer_email, p_customer_phone,
        p_pickup, p_return, 'pending', v_reference,
        case when p_terms_accepted then now() end,
        -- Normalize blank strings to null so empty optionals don't store ''.
        nullif(btrim(p_company), ''), nullif(btrim(p_vat_id), ''), nullif(btrim(p_notes), '')
      )
      returning reservations.access_token into v_token;

      return query select 'created'::text, v_reference, v_token;
      return;
    exception
      when exclusion_violation then
        -- 23P01 from reservations_no_overlap: the vehicle was just taken.
        return query select 'conflict'::text, null::text, null::uuid;
        return;
      when unique_violation then
        if attempt = 3 then
          raise;
        end if;
    end;
  end loop;
end;
$$;
