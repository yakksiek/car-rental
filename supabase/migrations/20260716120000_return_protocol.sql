-- Return Protocol (S-06) — Phase 2: discriminator, baseline links, storage
-- return/ prefix, and the three RPCs (baseline lookup, worklist, create-return).
--
-- S-06 rides on the shipped S-05 (issue-protocol) spine. One reservation must be
-- able to hold BOTH an issue and a return protocol, so the single-column
-- `unique (reservation_id)` is swapped for `unique (reservation_id, type)` and a
-- `type` discriminator is added. Return rows link back to their issue baseline
-- (`baseline_protocol_id`) and each carried-over damage links to its baseline
-- damage (`protocol_damages.baseline_damage_id`).
--
-- "Returned" is NOT a reservation_status value — it is the existence of a
-- `type='return'` protocols row, mirroring how "issued" is a `type='issue'` row.
-- reservation_status and the reservations_no_overlap EXCLUDE constraint
-- (20260603155136:124-129) are deliberately UNTOUCHED.
--
-- Access stays RPC-only: the protocol tables keep `revoke all` + RLS-on +
-- zero policies (20260710120000:155-165); the new columns inherit that posture.
--
-- Additive over S-05 (20260710120000_issue_protocol.sql) +
-- rpc-execute-grant-hardening (20260714120000). See
-- context/changes/return-protocol-comparison/plan.md (Phase 2).

-- ---------------------------------------------------------------------------
-- §1 protocols — the type discriminator + baseline linkage
-- ---------------------------------------------------------------------------
--
-- Mirrors the DB<->TS enum contract: `ProtocolKind = 'issue' | 'return'`
-- (src/types.ts, Phase 3) mirrors this enum.
--
-- Backfill-then-tighten: add `type` with `default 'issue'` so the column lands
-- non-null on the seven live prod rows (each an issue protocol), then drop the
-- default so every future insert must NAME its type. Today no reservation holds
-- two protocols, so swapping to the composite unique cannot conflict on apply.
--
-- PRE-FLIGHT FOR PROD (memory: db push != seed; prod ref fmgbyfpilgzvhkziigsj):
--   select reservation_id, count(*) from protocols group by 1 having count(*) > 1;
-- must return no rows before applying.
create type protocol_type as enum ('issue', 'return');

alter table protocols add column type protocol_type not null default 'issue';
alter table protocols alter column type drop default;

-- Swap the invariant: one issue AND one return per reservation, never two of a
-- kind. The composite unique is what makes a double-submit a clean `conflict`
-- tag per protocol type rather than a race.
alter table protocols drop constraint protocols_reservation_id_key;
alter table protocols add constraint protocols_reservation_id_type_key
  unique (reservation_id, type);

-- A return row points at the issue row it was compared against. The check pins
-- the linkage to the type: an issue row never has a baseline, a return row
-- always does. The self-FK is deferred-free — the issue row always pre-exists a
-- return (create_return_protocol asserts it).
alter table protocols add column baseline_protocol_id uuid references protocols (id);
alter table protocols add constraint protocols_baseline_link_check
  check (
    (type = 'issue' and baseline_protocol_id is null)
    or (type = 'return' and baseline_protocol_id is not null)
  );

-- The manual damage override is PERSISTED, not re-derived at read time. Auto-tag
-- only suggests a baseline match on the client; the value the employee confirms
-- is stored here: non-null => carried over from that baseline item (existing),
-- null => new. Always null on issue rows (they have no baseline to diff against).
alter table protocol_damages add column baseline_damage_id uuid references protocol_damages (id);

-- ---------------------------------------------------------------------------
-- §2 create_protocol — re-assert type='issue' now the default is gone
-- ---------------------------------------------------------------------------
--
-- Dropping the `type` default (§1) means the shipped S-05 insert — which omitted
-- `type` and relied on the default — would now hit a NOT NULL violation. Recreate
-- create_protocol to name `type = 'issue'` explicitly. CREATE OR REPLACE
-- preserves the S-05 grants (revoke public,anon + grant authenticated), so no
-- re-grant is needed. Only two lines change vs 20260710120000:283-370:
--   * the insert now lists `type` and inserts 'issue';
--   * the conflict lookup is scoped to `type = 'issue'` — a reservation can now
--     hold a return row too, so an unscoped `where reservation_id = ...` could
--     match more than one row and return the wrong existing id.
-- Everything else is verbatim from S-05.
create or replace function public.create_protocol(
  p_id uuid,
  p_reservation_id uuid,
  p_odometer_km int,
  p_fuel_eighths smallint,
  p_signed_at timestamptz,
  p_customer_ack boolean,
  p_signature text,
  p_photos jsonb,
  p_damages jsonb
)
returns table (
  result text,
  protocol_id uuid
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_role public.app_role;
  v_status public.reservation_status;
  v_existing uuid;
begin
  v_role := public.current_app_role();
  if v_role is null or v_role not in ('employee', 'admin') then
    return query select 'unauthorized'::text, null::uuid;
    return;
  end if;

  -- Lock and re-read the reservation status inside the transaction. A second
  -- concurrent call blocks here until the first commits.
  select r.status into v_status
  from public.reservations r
  where r.id = p_reservation_id
  for update;

  if not found then
    return query select 'not_found'::text, null::uuid;
    return;
  end if;

  if v_status <> 'confirmed' then
    return query select 'not_confirmed'::text, null::uuid;
    return;
  end if;

  begin
    insert into public.protocols (
      id, reservation_id, type, odometer_km, fuel_eighths,
      signed_at, signature, customer_ack, created_by
    )
    values (
      p_id, p_reservation_id, 'issue', p_odometer_km, p_fuel_eighths,
      p_signed_at, p_signature, p_customer_ack, auth.uid()
    );
  exception when unique_violation then
    -- Either (reservation_id, 'issue') (a second submit) or id (a replayed
    -- request). Both mean: an issue protocol for this reservation already exists.
    select pr.id into v_existing
    from public.protocols pr
    where pr.reservation_id = p_reservation_id and pr.type = 'issue';

    return query select 'conflict'::text, v_existing;
    return;
  end;

  insert into public.protocol_photos (protocol_id, slot, path)
  select p_id, (e ->> 'slot')::public.protocol_photo_slot, e ->> 'path'
  from jsonb_array_elements(coalesce(p_photos, '[]'::jsonb)) e;

  insert into public.protocol_damages (id, protocol_id, type, location, size)
  select
    (e ->> 'id')::uuid,
    p_id,
    (e ->> 'type')::public.protocol_damage_type,
    e ->> 'location',
    nullif(e ->> 'size', '')
  from jsonb_array_elements(coalesce(p_damages, '[]'::jsonb)) e;

  insert into public.protocol_damage_photos (damage_id, path)
  select (e ->> 'id')::uuid, ph
  from jsonb_array_elements(coalesce(p_damages, '[]'::jsonb)) e,
       lateral jsonb_array_elements_text(coalesce(e -> 'photos', '[]'::jsonb)) ph;

  return query select 'ok'::text, p_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- §3 Storage RLS — cover the return/ prefix
-- ---------------------------------------------------------------------------
--
-- Objects are keyed `<kind>/<protocol_id>/...` with kind in {issue, return}
-- (folder-per-protocol, S-05 §4). Extend the three storage.objects policies so a
-- return/-prefixed object is governed exactly like an issue/ one. Drop + recreate
-- (the predicate must be re-stated in full anyway); reversible by re-scoping back
-- to `= 'issue'`. Still NO DELETE policy — append-only durability preserved.
--
-- The scalar-subquery caller check `(select public.current_app_role())` is kept
-- for one-time InitPlan (lessons.md). The SQL predicate below is the unavoidable
-- second copy of the prefix set (the TypeScript side shares one module in
-- Phase 3); Phase 7 pins the two together with an integration test.
drop policy protocols_objects_select_staff on storage.objects;
create policy protocols_objects_select_staff on storage.objects
  for select to authenticated
  using (
    bucket_id = 'protocols'
    and (storage.foldername(name))[1] in ('issue', 'return')
    and (select public.current_app_role()) in ('employee', 'admin')
  );

drop policy protocols_objects_insert_staff on storage.objects;
create policy protocols_objects_insert_staff on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'protocols'
    and (storage.foldername(name))[1] in ('issue', 'return')
    and (select public.current_app_role()) in ('employee', 'admin')
  );

drop policy protocols_objects_update_staff on storage.objects;
create policy protocols_objects_update_staff on storage.objects
  for update to authenticated
  using (
    bucket_id = 'protocols'
    and (storage.foldername(name))[1] in ('issue', 'return')
    and (select public.current_app_role()) in ('employee', 'admin')
  )
  with check (
    bucket_id = 'protocols'
    and (storage.foldername(name))[1] in ('issue', 'return')
    and (select public.current_app_role()) in ('employee', 'admin')
  );

-- ---------------------------------------------------------------------------
-- §4 RPCs — the return additions
-- ---------------------------------------------------------------------------
--
-- Same definer hygiene as S-05: security definer + set search_path = '' + every
-- name schema-qualified + self-gate on current_app_role() failing closed on a
-- null role. Reads are `stable`; the write is plpgsql. EXECUTE is revoked from
-- public+anon before granting to authenticated, per function (lessons.md — a
-- grant alone restricts nothing).

-- get_return_baseline — load the issue baseline for the return screen. The one
-- lookup S-05 never exposed. Returns the issue protocol (odometer, fuel, its
-- damages as jsonb) plus reservation + vehicle reference fields, and the existing
-- return row id if one was already filed. An empty result IS the not-found
-- signal (no issue protocol => no rows => the service maps to null => 404),
-- mirroring get_protocol's read idiom.
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
  return_protocol_id uuid
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
    rp.id
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

-- list_returns_today — the returns worklist. Due-or-overdue, still-open returns,
-- plus today's just-filed returns kept on the list for email recovery.
--
-- The issue protocol is an INNER join (a return requires an issue baseline, so a
-- reservation with no issue protocol never appears). The return protocol is a
-- LEFT join, never filtered on: a return whose email failed is exactly the row
-- the employee needs to find. Filter: confirmed AND return_date <= today AND
-- (no return yet OR the return was filed today) — so overdue-open rows stay until
-- processed, a just-filed return stays today for resend, and older-filed returns
-- drop off. Columns mirror list_dispatch_today plus the baseline summary.
create function public.list_returns_today()
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
  return_protocol_id uuid,
  pdf_path text,
  delivery_status text,
  delivery_created_at timestamptz,
  baseline_protocol_id uuid,
  baseline_odometer_km int,
  baseline_fuel_eighths smallint
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
    rp.id,
    rp.pdf_path,
    d.status,
    d.created_at,
    ip.id,
    ip.odometer_km,
    ip.fuel_eighths
  from public.reservations r
  join public.vehicles v on v.id = r.vehicle_id
  join public.protocols ip
    on ip.reservation_id = r.id and ip.type = 'issue'
  left join public.protocols rp
    on rp.reservation_id = r.id and rp.type = 'return'
  left join lateral (
    select ed.status, ed.created_at
    from public.email_deliveries ed
    where ed.entity_type = 'protocol' and ed.entity_id = rp.id
    order by ed.created_at desc
    limit 1
  ) d on true
  where r.status = 'confirmed'
    and r.return_date <= current_date
    and (rp.id is null or rp.created_at::date = current_date)
  order by r.reference;
end;
$$;

revoke execute on function public.list_returns_today() from public, anon;
grant execute on function public.list_returns_today() to authenticated;

-- create_return_protocol — the guarded return commit. Mirrors create_protocol
-- (§2) plus the baseline precondition and per-damage baseline linkage.
--
-- p_id and each p_damages[].id are CLIENT-MINTED so the storage paths carried in
-- p_signature / p_photos / p_damages[].photos already resolve. Ordering:
-- `select ... for update` the reservation, assert an issue baseline exists and
-- matches p_baseline_protocol_id, then insert the type='return' row. The
-- composite unique (reservation_id, 'return') is the BACKSTOP — two employees
-- tapping simultaneously produce one return and one clean `conflict` tag. Does
-- NOT touch reservation_status. Result tags: unauthorized | not_found |
-- no_baseline | conflict | ok.
create function public.create_return_protocol(
  p_id uuid,
  p_reservation_id uuid,
  p_baseline_protocol_id uuid,
  p_odometer_km int,
  p_fuel_eighths smallint,
  p_signed_at timestamptz,
  p_customer_ack boolean,
  p_signature text,
  p_photos jsonb,
  p_damages jsonb
)
returns table (
  result text,
  protocol_id uuid
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_role public.app_role;
  v_issue_id uuid;
  v_existing uuid;
begin
  v_role := public.current_app_role();
  if v_role is null or v_role not in ('employee', 'admin') then
    return query select 'unauthorized'::text, null::uuid;
    return;
  end if;

  -- Lock the reservation for the duration of the transaction (concurrency guard;
  -- status is not re-asserted — a return is filed against an already-issued,
  -- confirmed reservation and reservation_status never changes here).
  perform 1
  from public.reservations r
  where r.id = p_reservation_id
  for update;

  if not found then
    return query select 'not_found'::text, null::uuid;
    return;
  end if;

  -- Precondition: an issue protocol must exist, and the client-submitted baseline
  -- id must be that issue protocol's id.
  select ip.id into v_issue_id
  from public.protocols ip
  where ip.reservation_id = p_reservation_id and ip.type = 'issue';

  if not found or v_issue_id is distinct from p_baseline_protocol_id then
    return query select 'no_baseline'::text, null::uuid;
    return;
  end if;

  begin
    insert into public.protocols (
      id, reservation_id, type, baseline_protocol_id,
      odometer_km, fuel_eighths, signed_at, signature, customer_ack, created_by
    )
    values (
      p_id, p_reservation_id, 'return', p_baseline_protocol_id,
      p_odometer_km, p_fuel_eighths, p_signed_at, p_signature, p_customer_ack, auth.uid()
    );
  exception when unique_violation then
    -- Either (reservation_id, 'return') (a second submit) or id (a replay). Both
    -- mean: a return protocol for this reservation already exists.
    select pr.id into v_existing
    from public.protocols pr
    where pr.reservation_id = p_reservation_id and pr.type = 'return';

    return query select 'conflict'::text, v_existing;
    return;
  end;

  insert into public.protocol_photos (protocol_id, slot, path)
  select p_id, (e ->> 'slot')::public.protocol_photo_slot, e ->> 'path'
  from jsonb_array_elements(coalesce(p_photos, '[]'::jsonb)) e;

  -- baseline_damage_id: non-null => carried over from that baseline item
  -- (existing), null/absent => new. The value the employee confirmed on the
  -- client is persisted verbatim; the auto-tag only pre-selected it.
  insert into public.protocol_damages (id, protocol_id, type, location, size, baseline_damage_id)
  select
    (e ->> 'id')::uuid,
    p_id,
    (e ->> 'type')::public.protocol_damage_type,
    e ->> 'location',
    nullif(e ->> 'size', ''),
    nullif(e ->> 'baseline_damage_id', '')::uuid
  from jsonb_array_elements(coalesce(p_damages, '[]'::jsonb)) e;

  insert into public.protocol_damage_photos (damage_id, path)
  select (e ->> 'id')::uuid, ph
  from jsonb_array_elements(coalesce(p_damages, '[]'::jsonb)) e,
       lateral jsonb_array_elements_text(coalesce(e -> 'photos', '[]'::jsonb)) ph;

  return query select 'ok'::text, p_id;
end;
$$;

revoke execute on function public.create_return_protocol(
  uuid, uuid, uuid, int, smallint, timestamptz, boolean, text, jsonb, jsonb
) from public, anon;
grant execute on function public.create_return_protocol(
  uuid, uuid, uuid, int, smallint, timestamptz, boolean, text, jsonb, jsonb
) to authenticated;
