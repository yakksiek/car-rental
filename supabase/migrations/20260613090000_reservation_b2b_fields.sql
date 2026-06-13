-- Public Reservation Request (S-02) — Phase 5 (Design Alignment), item 4:
-- optional B2B fields on the reservation form (desktop-2 "your details").
--
-- Adds company / VAT-NIP / notes to reservations and threads them through
-- create_reservation_request as OPTIONAL (default-null) parameters. They are
-- captured at submit but unused downstream for now: company/VAT are stored for
-- later invoicing, notes are surfaced to staff in S-03. Additive over Phase 1
-- (20260611171737) — reservations RLS is UNCHANGED (anon stays denied); the
-- write still crosses the boundary only through this definer RPC.

-- ---------------------------------------------------------------------------
-- reservations: optional B2B columns
-- ---------------------------------------------------------------------------

-- All nullable with no default: a private customer leaves them empty, an
-- existing seed row stays null. No backfill needed.
alter table reservations
  add column company text,
  add column vat_id text,
  add column notes text;

-- ---------------------------------------------------------------------------
-- create_reservation_request — recreate with the optional B2B params
-- ---------------------------------------------------------------------------

-- A signature change (three new params) requires drop + recreate rather than
-- `create or replace`, which would otherwise leave the 7-arg overload in place
-- and make PostgREST ambiguous. The new params carry `default null` so the
-- existing 7-arg call shape still resolves to this single function. Same
-- definer hygiene and atomic conflict handling as the original (20260611171737):
-- empty search_path, schema-qualified names, exclusion_violation -> 'conflict'.
drop function public.create_reservation_request(uuid, date, date, text, text, text, boolean);

create function public.create_reservation_request(
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

grant execute on function public.create_reservation_request(
  uuid, date, date, text, text, text, boolean, text, text, text
) to anon, authenticated;
