-- Public Reservation Request (S-02) — Phase 1: Status columns + reservation RPCs
--
-- Lets the public create and track a reservation WITHOUT reservations ever
-- being anon-readable: the write and the status read both cross the RLS
-- boundary through SECURITY DEFINER RPCs, mirroring available_vehicles (S-01).
-- Additive over F-01 (20260603155136) — reservations RLS is UNCHANGED (anon
-- stays denied by default). See context/changes/public-reservation-request/plan.md (Phase 1).

-- ---------------------------------------------------------------------------
-- reservations: reference / access_token / terms columns
-- ---------------------------------------------------------------------------

-- reference: short human code (R-XXXX) shown to the customer and used by staff
--   to talk about a request. Always minted by create_reservation_request (never
--   client-supplied); nullable at the column level only because pre-S-02 rows
--   exist — the seed backfills them.
-- access_token: unguessable bearer secret for the /r/<token> status link. The
--   token holder is the customer; no other reservation is reachable without
--   its own token.
-- terms_accepted_at: when the customer accepted the rental terms on submit.
alter table reservations
  add column reference text,
  add column access_token uuid not null default gen_random_uuid(),
  add column terms_accepted_at timestamptz;

alter table reservations
  add constraint reservations_reference_unique unique (reference);

-- Reference source: a plain bigint sequence, base36-encoded. Starts at 36^3
-- (= 46656, base36 "1000") so every generated code is at least 4 chars and the
-- R-XXXX shape holds from the first request. Seed backfill uses zero-padded
-- numeric codes (R-0001…) that base36_encode can never emit (no leading zeros),
-- so backfilled and generated references cannot clash.
create sequence reservation_reference_seq start with 46656;

-- Pure base36 encoder for the reference codes. IMMUTABLE, no table access.
create function public.base36_encode(p_value bigint)
returns text
language plpgsql
immutable
set search_path = ''
as $$
declare
  digits constant text := '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  v bigint := p_value;
  result text := '';
begin
  if v <= 0 then
    return '0';
  end if;
  while v > 0 loop
    result := substr(digits, (v % 36)::int + 1, 1) || result;
    v := v / 36;
  end loop;
  return result;
end;
$$;

-- ---------------------------------------------------------------------------
-- create_reservation_request — the public write, atomic under the EXCLUDE
-- ---------------------------------------------------------------------------

-- The north-star guarantee lives here: the function ATTEMPTS the insert and
-- maps the EXCLUDE constraint's exclusion_violation (23P01) to a typed
-- 'conflict' result — never check-then-insert, which would reintroduce the
-- race the constraint eliminates (first insert wins, atomically).
--
-- Definer hygiene (mirrors available_vehicles / current_app_role):
--   * security definer + set search_path = '' + every name schema-qualified.
--   * status is hard-coded 'pending'; reference/access_token are generated
--     server-side — none of them accept client input.
--   * returns ONLY the new row's result tag + reference + access_token; no
--     other reservation's data is reachable.
--
-- Result tags: 'created' (with reference + token), 'unavailable' (unknown or
-- inactive vehicle), 'conflict' (overlapping pending/confirmed reservation).
-- Anything else (e.g. the dates-ordered CHECK) propagates as a genuine error —
-- the zod boundary in front of this RPC rejects malformed input first.
create function public.create_reservation_request(
  p_vehicle_id uuid,
  p_pickup date,
  p_return date,
  p_customer_name text,
  p_customer_email text,
  p_customer_phone text,
  p_terms_accepted boolean
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
        pickup_date, return_date, status, reference, terms_accepted_at
      ) values (
        p_vehicle_id, p_customer_name, p_customer_email, p_customer_phone,
        p_pickup, p_return, 'pending', v_reference,
        case when p_terms_accepted then now() end
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

grant execute on function public.create_reservation_request(uuid, date, date, text, text, text, boolean)
  to anon, authenticated;

-- ---------------------------------------------------------------------------
-- get_reservation_status — the tokenized status read
-- ---------------------------------------------------------------------------

-- One row of DISPLAY fields for the matching token only (the token holder is
-- the customer — their own name is theirs to see). Zero rows on an unknown
-- token; the /r/<token> page 404s on that. No email/phone exposure.
create function public.get_reservation_status(p_token uuid)
returns table (
  reference text,
  status public.reservation_status,
  pickup_date date,
  return_date date,
  customer_name text,
  created_at timestamptz,
  vehicle_make text,
  vehicle_model text,
  vehicle_production_year int,
  vehicle_category public.vehicle_category,
  vehicle_daily_rate numeric,
  vehicle_deposit numeric
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    r.reference, r.status, r.pickup_date, r.return_date, r.customer_name,
    r.created_at,
    v.make, v.model, v.production_year, v.category, v.daily_rate, v.deposit
  from public.reservations r
  join public.vehicles v on v.id = r.vehicle_id
  where r.access_token = p_token;
$$;

grant execute on function public.get_reservation_status(uuid) to anon, authenticated;
