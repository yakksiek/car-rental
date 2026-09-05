-- English localization — Phase 6: expose the stored locale on the five read
-- paths that compose an outbound artifact.
--
-- Phase 1 (20260902120000_locale_dimension.sql) added the COLUMNS and opened the
-- five WRITE paths. It could not open the read paths in the same migration
-- without changing five function return types for code that did not exist yet,
-- so `email/templates.ts` and `media/protocol-pdf.ts` both pinned an
-- `ARTIFACT_LOCALE = "pl"` constant and said so in a comment: "neither is on the
-- RPC return shapes these callers read yet. Wiring that is Phase 6." This is that
-- wiring.
--
-- Locale comes from the RESERVATION (or, for an already-rendered document, from
-- the PROTOCOL), never from the employee's session — which is what makes an
-- employee working an English cockpit still mail a Polish customer in Polish.
-- Each function below reads the value it is the authority for:
--
--   decide_reservation           r.locale  -> the confirm/reject email
--   create_confirmed_reservation r.locale  -> the manual booking's confirmation
--   list_dispatch_today          r.locale  -> the issue PDF + the protocol stamp
--   get_return_baseline          r.locale  -> the return PDF + the protocol stamp
--   get_protocol                 p.locale  -> the (re)send of an ISSUED document
--
-- The last one is deliberately the PROTOCOL's own column, not the reservation's:
-- an issued PDF is never regenerated, so the mail that carries it must be written
-- in the language of the bytes it attaches, whatever the reservation says today.
--
-- All five are DROP + CREATE rather than `create or replace`: adding an OUT
-- column changes the return type, which CREATE OR REPLACE refuses. Every body is
-- verbatim from its current definition except for the one added column (and, in
-- the two tagged-union functions, one extra `null::text` per non-success arm).
-- A drop discards the ACL, so each carries the standing RPC lesson —
-- `revoke execute ... from public, anon` FIRST, then the grant, per function.
--
-- Rollback is symmetric: drop these five and re-create them from the definitions
-- named above, re-stating both the revoke and the grant on each.
--
-- See context/changes/english-localization/plan.md (Phase 6 §1, §2, §5).

-- ---------------------------------------------------------------------------
-- §1 decide_reservation — the employee approve/reject transition
-- ---------------------------------------------------------------------------
--
-- Body verbatim from 20260617120000_reservation_approval.sql:60-152 plus
-- `r.locale` on the success arm (and the matching `null::text` on each of the
-- five non-success arms, which must keep the same column count).
--
-- `DecisionEmailPayload` (src/types.ts) is `Omit<…Returns[number], "result">`, so
-- the new column reaches BOTH senders — this route's reject mail and the shared
-- `notifyReservationConfirmed` — the moment the types are regenerated.
drop function public.decide_reservation(uuid, text, text, text);

create function public.decide_reservation(
  p_id uuid,
  p_decision text,
  p_reason text default null,
  p_note text default null
)
returns table (
  result text,
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
  vehicle_deposit numeric,
  locale text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_role public.app_role;
  v_status public.reservation_status;
begin
  -- Role gate: only employees/admins may decide. A null role (no profile) fails
  -- closed, matching the access boundary's posture.
  v_role := public.current_app_role();
  if v_role is null or v_role not in ('employee', 'admin') then
    return query
      select 'unauthorized'::text, null::text, null::text, null::text, null::uuid,
             null::date, null::date, null::text, null::text, null::int, null::numeric, null::numeric,
             null::text;
    return;
  end if;

  -- Lock and re-read the current status inside the transaction.
  select r.status into v_status
  from public.reservations r
  where r.id = p_id
  for update;

  if not found then
    return query
      select 'not_found'::text, null::text, null::text, null::text, null::uuid,
             null::date, null::date, null::text, null::text, null::int, null::numeric, null::numeric,
             null::text;
    return;
  end if;

  if v_status <> 'pending' then
    return query
      select 'already_decided'::text, null::text, null::text, null::text, null::uuid,
             null::date, null::date, null::text, null::text, null::int, null::numeric, null::numeric,
             null::text;
    return;
  end if;

  if p_decision = 'confirm' then
    update public.reservations
      set status = 'confirmed'
      where id = p_id;
  elsif p_decision = 'reject' then
    if p_reason is null
       or p_reason not in ('dates_unavailable', 'no_category', 'vehicle_withdrawn', 'other') then
      return query
        select 'invalid_reason'::text, null::text, null::text, null::text, null::uuid,
               null::date, null::date, null::text, null::text, null::int, null::numeric, null::numeric,
               null::text;
      return;
    end if;
    update public.reservations
      set status = 'rejected', rejection_reason = p_reason, rejection_note = p_note
      where id = p_id;
  else
    -- An unknown decision verb is a caller bug, not a domain outcome.
    return query
      select 'invalid_reason'::text, null::text, null::text, null::text, null::uuid,
             null::date, null::date, null::text, null::text, null::int, null::numeric, null::numeric,
             null::text;
    return;
  end if;

  -- Success: the new status + the email payload (qualified refs only, so no
  -- ambiguity with the OUT column names). `r.locale` is the CUSTOMER's language,
  -- captured at submission — never the deciding employee's session locale.
  return query
    select
      (case when p_decision = 'confirm' then 'confirmed' else 'rejected' end)::text,
      r.customer_name, r.customer_email, r.reference, r.access_token,
      r.pickup_date, r.return_date,
      v.make, v.model, v.production_year, v.daily_rate, v.deposit,
      r.locale
    from public.reservations r
    join public.vehicles v on v.id = r.vehicle_id
    where r.id = p_id;
end;
$$;

revoke execute on function public.decide_reservation(uuid, text, text, text) from public, anon;
grant execute on function public.decide_reservation(uuid, text, text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- §2 create_confirmed_reservation — the staff manual-booking sibling
-- ---------------------------------------------------------------------------
--
-- Body verbatim from 20260902120000_locale_dimension.sql:255-357 plus `r.locale`
-- on the success arm. It must gain the column in lockstep with §1: the two RPCs
-- deliberately return the SAME payload shape, which is the only reason
-- `notifyReservationConfirmed` can serve both callers (S-12), and `Omit<…>` would
-- silently stop matching if only one grew.
--
-- It reads the column back rather than echoing `p_locale`, so the payload always
-- reports what the row actually holds after the RPC's own normalisation.
drop function public.create_confirmed_reservation(uuid, date, date, text, text, text, text);

create function public.create_confirmed_reservation(
  p_vehicle_id uuid,
  p_pickup date,
  p_return date,
  p_customer_name text,
  p_customer_email text,
  p_customer_phone text,
  p_locale text default 'en'
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
  vehicle_deposit numeric,
  locale text
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
             null::date, null::date, null::text, null::text, null::int, null::numeric, null::numeric,
             null::text;
    return;
  end if;

  -- Date-order guard (20260810140000): a same-day range makes reserved_period's
  -- lower bound exceed its upper and raises a data_exception no arm below catches.
  if p_return <= p_pickup then
    return query
      select 'unavailable'::text, null::uuid, null::text, null::text, null::text, null::uuid,
             null::date, null::date, null::text, null::text, null::int, null::numeric, null::numeric,
             null::text;
    return;
  end if;

  if not exists (
    select 1 from public.vehicles v
    where v.id = p_vehicle_id and v.is_active
  ) then
    return query
      select 'unavailable'::text, null::uuid, null::text, null::text, null::text, null::uuid,
             null::date, null::date, null::text, null::text, null::int, null::numeric, null::numeric,
             null::text;
    return;
  end if;

  for attempt in 1..3 loop
    v_reference := 'R-' || public.base36_encode(nextval('public.reservation_reference_seq'));
    begin
      insert into public.reservations (
        vehicle_id, customer_name, customer_email, customer_phone,
        pickup_date, return_date, status, source, reference, locale
      ) values (
        p_vehicle_id, p_customer_name, p_customer_email, p_customer_phone,
        p_pickup, p_return, 'confirmed', 'manual', v_reference,
        case when p_locale in ('en', 'pl') then p_locale else 'en' end
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
          v.make, v.model, v.production_year, v.daily_rate, v.deposit,
          r.locale
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
                 null::date, null::date, null::text, null::text, null::int, null::numeric, null::numeric,
                 null::text;
        return;
      when unique_violation then
        if attempt = 3 then
          raise;
        end if;
    end;
  end loop;
end;
$$;

revoke execute on function public.create_confirmed_reservation(uuid, date, date, text, text, text, text)
  from public, anon;
grant execute on function public.create_confirmed_reservation(uuid, date, date, text, text, text, text)
  to authenticated;

-- ---------------------------------------------------------------------------
-- §3 list_dispatch_today — the issue-protocol screen's fixed context
-- ---------------------------------------------------------------------------
--
-- Body verbatim from 20260710120000_issue_protocol.sql:390-458 plus `r.locale`.
--
-- The issue PDF is built in the BROWSER (the Worker has a 10 ms CPU cap), so the
-- language it renders in has to travel to the island as data. This column is that
-- value: the page serialises it into `ProtocolContext.documentLocale`, the island
-- renders the PDF from it AND passes it back as `create_protocol`'s `p_locale`,
-- so the stamp on the row and the language of the stored bytes are the same
-- value by construction rather than by agreement between two lookups.
drop function public.list_dispatch_today();

create function public.list_dispatch_today()
returns table (
  reservation_id uuid,
  reference text,
  customer_name text,
  customer_email text,
  pickup_date date,
  return_date date,
  vehicle_id uuid,
  vehicle_make text,
  vehicle_model text,
  vehicle_plate text,
  protocol_id uuid,
  pdf_path text,
  delivery_status text,
  delivery_created_at timestamptz,
  last_odometer_km int,
  locale text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_role public.app_role;
begin
  v_role := public.current_app_role();
  if v_role is null or v_role not in ('employee', 'admin') then
    return;
  end if;

  return query
  select
    r.id,
    r.reference,
    r.customer_name,
    r.customer_email,
    r.pickup_date,
    r.return_date,
    v.id,
    v.make,
    v.model,
    v.plate,
    p.id,
    p.pdf_path,
    d.status,
    d.created_at,
    lo.last_odometer_km,
    r.locale
  from public.reservations r
  join public.vehicles v on v.id = r.vehicle_id
  left join public.protocols p on p.reservation_id = r.id
  left join lateral (
    select ed.status, ed.created_at
    from public.email_deliveries ed
    where ed.entity_type = 'protocol' and ed.entity_id = p.id
    order by ed.created_at desc
    limit 1
  ) d on true
  left join lateral (
    select pr.odometer_km as last_odometer_km
    from public.protocols pr
    join public.reservations rr on rr.id = pr.reservation_id
    where rr.vehicle_id = v.id
    order by pr.created_at desc
    limit 1
  ) lo on true
  where r.status = 'confirmed'
    and r.pickup_date = current_date
  order by r.reference;
end;
$$;

revoke execute on function public.list_dispatch_today() from public, anon;
grant execute on function public.list_dispatch_today() to authenticated;

-- ---------------------------------------------------------------------------
-- §4 get_return_baseline — the return-protocol screen's fixed context
-- ---------------------------------------------------------------------------
--
-- Body verbatim from 20260716120000_return_protocol.sql:232-300 plus `r.locale`.
-- Same role as §3 for the return document: it feeds
-- `ReturnProtocolContext.documentLocale`, which drives both the rendered PDF and
-- `create_return_protocol`'s `p_locale`.
--
-- The RESERVATION's locale, not the issue protocol's: the two agree today (the
-- issue was stamped from the same column), and if they ever diverge the customer's
-- language is the authority for a document that has not been rendered yet.
drop function public.get_return_baseline(uuid);

create function public.get_return_baseline(p_reservation_id uuid)
returns table (
  baseline_protocol_id uuid,
  reservation_id uuid,
  baseline_odometer_km int,
  baseline_fuel_eighths smallint,
  baseline_damages jsonb,
  reference text,
  customer_name text,
  customer_email text,
  pickup_date date,
  return_date date,
  vehicle_make text,
  vehicle_model text,
  vehicle_plate text,
  return_protocol_id uuid,
  locale text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_role public.app_role;
begin
  v_role := public.current_app_role();
  if v_role is null or v_role not in ('employee', 'admin') then
    return;
  end if;

  return query
  select
    ip.id,
    r.id,
    ip.odometer_km,
    ip.fuel_eighths,
    coalesce(dm.damages, '[]'::jsonb),
    r.reference,
    r.customer_name,
    r.customer_email,
    r.pickup_date,
    r.return_date,
    v.make,
    v.model,
    v.plate,
    rp.id,
    r.locale
  from public.protocols ip
  join public.reservations r on r.id = ip.reservation_id
  join public.vehicles v on v.id = r.vehicle_id
  left join public.protocols rp
    on rp.reservation_id = r.id and rp.type = 'return'
  left join lateral (
    select jsonb_agg(
      jsonb_build_object(
        'id', pd.id,
        'type', pd.type,
        'location', pd.location,
        'size', pd.size
      )
      order by pd.location
    ) as damages
    from public.protocol_damages pd
    where pd.protocol_id = ip.id
  ) dm on true
  where ip.reservation_id = p_reservation_id
    and ip.type = 'issue';
end;
$$;

revoke execute on function public.get_return_baseline(uuid) from public, anon;
grant execute on function public.get_return_baseline(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- §5 get_protocol — one committed protocol, for the view screen and every resend
-- ---------------------------------------------------------------------------
--
-- Body verbatim from 20260717120000_get_protocol_return_fields.sql:29-137 plus
-- `p.locale`.
--
-- *** This one is the PROTOCOL's own column, not the reservation's. *** It is
-- what `resendProtocolEmail` writes the covering mail in, and that mail attaches
-- bytes that were rendered once and are never regenerated (plan: "No regeneration
-- of issued PDFs"). Reading `r.locale` here would let a mail in one language
-- arrive carrying a PDF in another the moment the two ever diverge.
drop function public.get_protocol(uuid);

create function public.get_protocol(p_id uuid)
returns table (
  id uuid,
  reservation_id uuid,
  type public.protocol_type,
  baseline_protocol_id uuid,
  odometer_km int,
  fuel_eighths smallint,
  signed_at timestamptz,
  signature text,
  customer_ack boolean,
  pdf_path text,
  created_at timestamptz,
  reference text,
  customer_name text,
  customer_email text,
  pickup_date date,
  return_date date,
  vehicle_make text,
  vehicle_model text,
  vehicle_plate text,
  photos jsonb,
  damages jsonb,
  delivery_status text,
  delivery_created_at timestamptz,
  locale text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_role public.app_role;
begin
  v_role := public.current_app_role();
  if v_role is null or v_role not in ('employee', 'admin') then
    return;
  end if;

  return query
  select
    p.id,
    p.reservation_id,
    p.type,
    p.baseline_protocol_id,
    p.odometer_km,
    p.fuel_eighths,
    p.signed_at,
    p.signature,
    p.customer_ack,
    p.pdf_path,
    p.created_at,
    r.reference,
    r.customer_name,
    r.customer_email,
    r.pickup_date,
    r.return_date,
    v.make,
    v.model,
    v.plate,
    coalesce(ph.photos, '[]'::jsonb),
    coalesce(dm.damages, '[]'::jsonb),
    d.status,
    d.created_at,
    p.locale
  from public.protocols p
  join public.reservations r on r.id = p.reservation_id
  join public.vehicles v on v.id = r.vehicle_id
  left join lateral (
    select jsonb_agg(jsonb_build_object('slot', pp.slot, 'path', pp.path) order by pp.slot) as photos
    from public.protocol_photos pp
    where pp.protocol_id = p.id
  ) ph on true
  left join lateral (
    select jsonb_agg(
      jsonb_build_object(
        'id', pd.id,
        'type', pd.type,
        'location', pd.location,
        'size', pd.size,
        -- The PERSISTED existing/new decision (S-06): non-null => carried over
        -- from that baseline item, null => new (always null on issue rows).
        'baseline_damage_id', pd.baseline_damage_id,
        'photos', coalesce(dp.paths, '[]'::jsonb)
      )
    ) as damages
    from public.protocol_damages pd
    left join lateral (
      select jsonb_agg(pdp.path) as paths
      from public.protocol_damage_photos pdp
      where pdp.damage_id = pd.id
    ) dp on true
    where pd.protocol_id = p.id
  ) dm on true
  left join lateral (
    select ed.status, ed.created_at
    from public.email_deliveries ed
    where ed.entity_type = 'protocol' and ed.entity_id = p.id
    order by ed.created_at desc
    limit 1
  ) d on true
  where p.id = p_id;
end;
$$;

revoke execute on function public.get_protocol(uuid) from public, anon;
grant execute on function public.get_protocol(uuid) to authenticated;
