-- Issue Protocol (S-05) — Phase 1: schema, storage bucket, grants, RPCs
--
-- At pickup an employee records odometer, fuel, structured damage items, six
-- baseline photos and the customer's signature. This migration lands the
-- authoritative record (the emailed PDF is a *rendering*; these tables are the
-- truth), the project's first storage bucket, and the five SECURITY DEFINER RPCs
-- that are the only way in.
--
-- "Issued" is NOT a reservation_status value — it is the existence of a
-- `protocols` row. The reservations_no_overlap EXCLUDE predicate
-- (`status in ('pending','confirmed')`, 20260603155136:124-129) is therefore
-- untouched, a rented-out vehicle keeps holding its slot, and the
-- no-double-booking guarantee cannot regress.
--
-- Additive over F-01 (20260603155136) + F-02 (20260604153139) + S-03 (20260617120000).
-- See context/changes/issue-protocol/plan.md (Phase 1).

-- ---------------------------------------------------------------------------
-- §1 vehicles.plate — the fleet's only practical differentiator
-- ---------------------------------------------------------------------------
--
-- The fleet will hold many identical models (ten Ford Transits); make + model +
-- year cannot tell them apart on the dispatch list, the calendar, or the PDF.
--
-- Landed nullable -> backfilled -> tightened, all in one migration so prod and
-- local converge atomically. The UPDATE is a no-op on a fresh `db reset` (the
-- table is empty; seed.sql runs *after* migrations and supplies plate itself)
-- but is exactly what converges the seven rows already live in production.
--
-- PRE-FLIGHT FOR PROD: if a vehicle has been added since the seed, the
-- `set not null` below will abort. Check first:
--   select count(*) from vehicles where plate is null;

alter table vehicles add column plate text;

update vehicles set plate = v.plate
from (values
  ('11111111-1111-1111-1111-111111111111'::uuid, 'WX 5519M'),
  ('22222222-2222-2222-2222-222222222222'::uuid, 'WX 7284K'),
  ('33333333-3333-3333-3333-333333333333'::uuid, 'WX 3102P'),
  ('44444444-4444-4444-4444-444444444444'::uuid, 'WX 8867L'),
  ('55555555-5555-5555-5555-555555555555'::uuid, 'WX 4415R'),
  ('66666666-6666-6666-6666-666666666666'::uuid, 'WX 9038S'),
  ('77777777-7777-7777-7777-777777777777'::uuid, 'WX 2276D')
) as v(id, plate)
where vehicles.id = v.id;

alter table vehicles alter column plate set not null;
alter table vehicles add constraint vehicles_plate_unique unique (plate);

-- ---------------------------------------------------------------------------
-- §2 protocol tables
-- ---------------------------------------------------------------------------

create type protocol_photo_slot as enum (
  'front',
  'rear',
  'left',
  'right',
  'interior',
  'dashboard'
);

-- No severity (it duplicates type + size) and no cost (a PRD non-goal, and a
-- złoty figure on a document the customer signs is a number we can't stand
-- behind). The `existing | new` tag is DERIVED at return time by diffing
-- against this issue baseline — never stored at pickup.
create type protocol_damage_type as enum (
  'scratch',
  'dent',
  'crack',
  'missing'
);

-- `unique (reservation_id)` is the invariant that makes a double submit a clean
-- `conflict` tag rather than a race: a protocol is binary, and there is no draft
-- state (a half-signed legal document must not persist).
--
-- `id` is client-minted (crypto.randomUUID) because storage objects are keyed by
-- it and the bytes must already sit at their final key by the time this row
-- records the path. `signature` and `pdf_path` hold storage object paths, not URLs.
create table protocols (
  id uuid primary key,
  reservation_id uuid not null unique references reservations (id),
  odometer_km int not null check (odometer_km >= 0),
  fuel_eighths smallint not null check (fuel_eighths between 0 and 8),
  signed_at timestamptz not null,
  signature text not null,
  customer_ack boolean not null,
  pdf_path text,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users (id)
);

create table protocol_photos (
  id uuid primary key default gen_random_uuid(),
  protocol_id uuid not null references protocols (id) on delete cascade,
  slot protocol_photo_slot not null,
  path text not null,
  unique (protocol_id, slot)
);

create table protocol_damages (
  id uuid primary key,
  protocol_id uuid not null references protocols (id) on delete cascade,
  type protocol_damage_type not null,
  location text not null,
  size text
);

create index protocol_damages_protocol_id_idx on protocol_damages (protocol_id);

create table protocol_damage_photos (
  id uuid primary key default gen_random_uuid(),
  damage_id uuid not null references protocol_damages (id) on delete cascade,
  path text not null
);

create index protocol_damage_photos_damage_id_idx on protocol_damage_photos (damage_id);

-- Append-only. A failed protocol email is currently invisible (console.error
-- only) and email is the customer's ONLY channel. Append-only gives retry
-- history for free; two columns on `protocols` would give none, and no place to
-- hang the reservation-decision email.
create table email_deliveries (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null,
  entity_id uuid not null,
  template text not null,
  recipient text not null,
  status text not null check (status in ('sent', 'failed')),
  error text,
  created_at timestamptz not null default now()
);

create index email_deliveries_entity_idx
  on email_deliveries (entity_type, entity_id, created_at desc);

-- ---------------------------------------------------------------------------
-- §3 Grants and RLS — the load-bearing part
-- ---------------------------------------------------------------------------
--
-- Prospectively applies the `reservations` PII-leak lesson
-- (context/archive/2026-06-27-testing-data-layer-integrity/finding-rls-pii-leak.md):
-- Supabase applies an implicit default ALL grant to anon/authenticated on every
-- new `public` table, and combined with a `using(true)` policy any authenticated
-- caller — including a role-null user with no profiles row — could read all
-- customer PII. Closing that leak needed BOTH a revoke and a policy drop.
--
-- `protocols` carries customer PII *and* damage photos, so all four verbs close
-- from the start and NO policy is ever written: a future re-grant cannot
-- silently re-open a hole through a policy that does not exist. Every access
-- flows through the definer RPCs below, which run as table owner.

revoke all on protocols from anon, authenticated;
revoke all on protocol_photos from anon, authenticated;
revoke all on protocol_damages from anon, authenticated;
revoke all on protocol_damage_photos from anon, authenticated;
revoke all on email_deliveries from anon, authenticated;

alter table protocols enable row level security;
alter table protocol_photos enable row level security;
alter table protocol_damages enable row level security;
alter table protocol_damage_photos enable row level security;
alter table email_deliveries enable row level security;

-- ---------------------------------------------------------------------------
-- §4 Storage bucket + storage.objects RLS  [SPIKE — verified before §1-§3, §5]
-- ---------------------------------------------------------------------------
--
-- Uploads go browser -> Supabase directly (the Worker's 10 ms CPU cap means no
-- image byte may transit it), so these policies ARE the trust boundary for every
-- photo byte. Nothing in this repo had ever created a bucket or a
-- storage.objects policy, so this section was written and `db reset`-verified
-- first, before anything landed on top of it.
--
-- Ownership: only a table's owner may `create policy` on it, and storage.objects
-- is owned by supabase_storage_admin while this migration runs as postgres.
-- Verified 2026-07-10: postgres is a member of that role and inherits its
-- rights, so a plain migration suffices — no `alter table ... owner to` and no
-- config.toml bucket block needed.
--
-- Objects are keyed `issue/<protocol_id>/...` — folder-per-protocol makes S-06
-- reuse and cleanup trivial. Two bounded trust consequences, worth stating: the
-- policies scope only to the `issue/` prefix, so any employee may write under
-- any protocol's folder, and a client-supplied primary key means a caller may
-- choose its own protocol_id. Both are acceptable for trusted staff; the
-- `unique (reservation_id)` constraint, not the id, is what makes a double
-- submit a `conflict`.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'protocols',
  'protocols',
  false,
  10485760, -- 10 MiB; compressed photos land ~200-400 KB, a PDF ~1-3 MB
  array['image/jpeg', 'image/png', 'application/pdf']
)
on conflict (id) do nothing;

-- Per lessons.md the caller check is a scalar subquery `(select
-- public.current_app_role())` so the planner hoists it to a one-time InitPlan
-- rather than re-evaluating per object row. A null role fails closed; anon is
-- granted nothing.
--
-- THERE IS DELIBERATELY NO DELETE POLICY. This slice exists so the customer holds
-- durable evidence for a dispute months later; a staff-deletable damage photo is
-- exactly what an operator would be tempted to remove once that dispute arrives.
-- So the signed record is append-only at the storage layer too, and no role can
-- delete through the app. Two consequences, both accepted (decided 2026-07-10):
--   * photos from an abandoned form session become orphaned bytes, removable only
--     by a service-role job — nothing references them and nothing breaks;
--   * a failed photo upload still retries fine, because re-uploading to the same
--     key is an upsert (UPDATE), which the policy above allows.
-- Note also that Supabase blocks direct SQL `delete from storage.objects` via a
-- `storage.protect_delete()` trigger — deletion must go through the Storage API.

create policy protocols_objects_select_staff on storage.objects
  for select to authenticated
  using (
    bucket_id = 'protocols'
    and (storage.foldername(name))[1] = 'issue'
    and (select public.current_app_role()) in ('employee', 'admin')
  );

create policy protocols_objects_insert_staff on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'protocols'
    and (storage.foldername(name))[1] = 'issue'
    and (select public.current_app_role()) in ('employee', 'admin')
  );

create policy protocols_objects_update_staff on storage.objects
  for update to authenticated
  using (
    bucket_id = 'protocols'
    and (storage.foldername(name))[1] = 'issue'
    and (select public.current_app_role()) in ('employee', 'admin')
  )
  with check (
    bucket_id = 'protocols'
    and (storage.foldername(name))[1] = 'issue'
    and (select public.current_app_role()) in ('employee', 'admin')
  );

-- ---------------------------------------------------------------------------
-- §5 RPCs — the only way in
-- ---------------------------------------------------------------------------
--
-- Definer hygiene mirrors S-02/S-03: security definer + set search_path = '' +
-- every name schema-qualified. Each self-gates on current_app_role() and fails
-- closed on a null role. Reads are `stable`; writes are plpgsql. Result tags map
-- to HTTP codes at the route.
--
-- EXECUTE must be REVOKED, not merely granted narrowly. Postgres grants EXECUTE
-- on a new function to PUBLIC by default, and Supabase's default privileges add
-- an explicit grant to `anon` on top — so `grant execute ... to authenticated`
-- alone is decorative and leaves anon able to call every RPC. Verified against
-- pg_proc.proacl on 2026-07-10. This is the same default-grant shape as the
-- `reservations` PII leak (which needed a revoke, not just a policy change), so
-- each function below is revoked from public+anon before being granted to
-- `authenticated`. The in-RPC role gate is the authority regardless; this is
-- defense in depth, and it is what makes the RPC surface anon-unreachable.
--
-- NOTE: the pre-existing S-02/S-03 RPCs (decide_reservation,
-- list_pending_reservations, ...) carry the same anon EXECUTE grant. Their
-- in-RPC role gates hold, so nothing leaks; retrofitting them repo-wide is
-- deliberately out of this slice's scope.

-- create_protocol — the guarded handover commit.
--
-- p_id and each p_damages[].id are CLIENT-MINTED (see §4) so the storage paths
-- already carried in p_signature / p_photos / p_damages[].photos resolve; an id
-- generated in here would arrive after the bytes were already uploaded.
--
-- Ordering matters: take `select ... for update` on the reservation, assert it
-- is still 'confirmed', then insert. The unique(reservation_id) constraint is
-- the BACKSTOP, not the check — two employees tapping simultaneously must
-- produce one protocol and one clean `conflict` tag, not a race and a 500. The
-- conflict tag carries the existing protocol's id so the conflict screen can
-- link to it.
create function public.create_protocol(
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
      id, reservation_id, odometer_km, fuel_eighths,
      signed_at, signature, customer_ack, created_by
    )
    values (
      p_id, p_reservation_id, p_odometer_km, p_fuel_eighths,
      p_signed_at, p_signature, p_customer_ack, auth.uid()
    );
  exception when unique_violation then
    -- Either reservation_id (a second submit) or id (a replayed request).
    -- Both mean: a protocol for this reservation already exists.
    select pr.id into v_existing
    from public.protocols pr
    where pr.reservation_id = p_reservation_id;

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

revoke execute on function public.create_protocol(
  uuid, uuid, int, smallint, timestamptz, boolean, text, jsonb, jsonb
) from public, anon;
grant execute on function public.create_protocol(
  uuid, uuid, int, smallint, timestamptz, boolean, text, jsonb, jsonb
) to authenticated;

-- list_dispatch_today — today's confirmed reservations WITH their protocol state.
--
-- The `left join protocols` is kept, never filtered: a protocol whose email
-- failed is exactly the row the employee needs to find, and filtering on
-- `p.id is null` would make email_deliveries unreachable and the recovery action
-- undeliverable. protocol_id null => still to be issued.
--
-- The newest delivery row folds in via a `lateral` join rather than an N+1
-- round-trip. last_odometer_km is the newest reading across ANY protocol for that
-- vehicle — the SOFT-warning baseline (a swapped cluster must not strand an
-- employee, so it is never a hard block).
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
  last_odometer_km int
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
    lo.last_odometer_km
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

-- get_protocol — the full protocol for the read-only view screen, with photos,
-- damages (each carrying its own photo paths) and the newest delivery row folded
-- in via a lateral join. One round-trip.
create function public.get_protocol(p_id uuid)
returns table (
  id uuid,
  reservation_id uuid,
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
  delivery_created_at timestamptz
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
    d.created_at
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

-- set_protocol_pdf — stores where the client-generated PDF landed.
--
-- A separate call because the PDF is built client-side AFTER the protocol
-- commits: create_protocol cannot know the path. Idempotent — re-running
-- overwrites pdf_path with the same value.
create function public.set_protocol_pdf(p_id uuid, p_path text)
returns table (result text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_role public.app_role;
begin
  v_role := public.current_app_role();
  if v_role is null or v_role not in ('employee', 'admin') then
    return query select 'unauthorized'::text;
    return;
  end if;

  update public.protocols set pdf_path = p_path where id = p_id;

  if not found then
    return query select 'not_found'::text;
    return;
  end if;

  return query select 'ok'::text;
end;
$$;

revoke execute on function public.set_protocol_pdf(uuid, text) from public, anon;
grant execute on function public.set_protocol_pdf(uuid, text) to authenticated;

-- record_email_delivery — append-only outcome log. Makes the failure visible
-- instead of silent. Only the two STAFF-AUTHENTICATED sends are tracked
-- (protocol + reservation decision); the anonymous reservation-creation email
-- keeps its swallow, because tracking it would need `grant execute ... to anon`
-- on an audit-log write.
create function public.record_email_delivery(
  p_entity_type text,
  p_entity_id uuid,
  p_template text,
  p_recipient text,
  p_status text,
  p_error text default null
)
returns void
language plpgsql
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

  insert into public.email_deliveries (
    entity_type, entity_id, template, recipient, status, error
  )
  values (p_entity_type, p_entity_id, p_template, p_recipient, p_status, p_error);
end;
$$;

revoke execute on function public.record_email_delivery(text, uuid, text, text, text, text) from public, anon;
grant execute on function public.record_email_delivery(text, uuid, text, text, text, text) to authenticated;
