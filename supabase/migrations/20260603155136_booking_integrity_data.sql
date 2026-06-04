-- Booking-Integrity Data Layer (F-01)
--
-- Establishes the foundational vehicles + reservations data model, the
-- no-double-booking integrity constraint, and the RLS posture in one logical
-- contract. See context/changes/booking-integrity-data/plan.md (Phase 1).

-- Equality operator class for a scalar (vehicle_id WITH =) inside a GiST index,
-- required by the EXCLUDE constraint below. Must exist before the constraint.
create extension if not exists btree_gist;

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------

create type vehicle_category as enum (
  'cargo_van',
  'passenger_van',
  'car_transporter',
  'refrigerated_truck',
  'flatbed_truck'
);

create type reservation_status as enum (
  'pending',
  'confirmed',
  'rejected',
  'cancelled'
);

-- ---------------------------------------------------------------------------
-- updated_at maintenance
-- ---------------------------------------------------------------------------

create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- vehicles
-- ---------------------------------------------------------------------------

create table vehicles (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category vehicle_category not null,
  -- technical specs (FR-003)
  make text,
  model text,
  production_year int,
  fuel_type text,
  payload_capacity_kg numeric(10, 2),
  -- cargo dimensions (FR-003)
  cargo_length_cm numeric(10, 2),
  cargo_width_cm numeric(10, 2),
  cargo_height_cm numeric(10, 2),
  photos text[] not null default '{}',
  -- pricing (FR-003): money columns are numeric(10,2); supabase-js deserializes
  -- numeric as string -> the DTO/formatter layer owns parsing (see src/types.ts)
  daily_rate numeric(10, 2) not null,
  monthly_rate numeric(10, 2) not null,
  deposit numeric(10, 2) not null,
  per_extra_km_rate numeric(10, 2) not null,
  km_limit int,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index vehicles_category_idx on vehicles (category);
create index vehicles_is_active_idx on vehicles (is_active);

create trigger vehicles_set_updated_at
  before update on vehicles
  for each row
  execute function set_updated_at();

-- ---------------------------------------------------------------------------
-- reservations
-- ---------------------------------------------------------------------------

create table reservations (
  id uuid primary key default gen_random_uuid(),
  -- on delete restrict: a vehicle with reservations cannot be hard-deleted
  vehicle_id uuid not null references vehicles (id) on delete restrict,
  customer_name text not null,
  customer_email text not null,
  customer_phone text not null,
  pickup_date date not null,
  return_date date not null,
  status reservation_status not null default 'pending',
  -- Hotel-style booking window as a naive-local tsrange. Stored as bare
  -- wall-clock timestamps (timestamp without time zone) so the generated
  -- expression stays IMMUTABLE: `timestamp AT TIME ZONE 'Europe/Warsaw'` is
  -- STABLE and Postgres forbids it in a generated column. Every booking on a
  -- vehicle shares the same implied local zone, so the zone cancels out of any
  -- overlap comparison. Half-open [pickup 14:00, return 10:00) gives the exact
  -- same-day turnover buffer (return D 10:00 is adjacent to pickup D 14:00).
  reserved_period tsrange generated always as (
    tsrange(pickup_date + time '14:00', return_date + time '10:00', '[)')
  ) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint reservations_dates_ordered check (return_date >= pickup_date)
);

create index reservations_vehicle_id_idx on reservations (vehicle_id);
create index reservations_status_idx on reservations (status);

create trigger reservations_set_updated_at
  before update on reservations
  for each row
  execute function set_updated_at();

-- No-double-booking guarantee: two reservations on the same vehicle whose
-- windows overlap cannot both be in a blocking status (pending OR confirmed).
-- The GiST index makes this atomic at write time (first insert wins, the second
-- gets 23P01). The partial WHERE lets rejected/cancelled rows coexist freely.
alter table reservations
  add constraint reservations_no_overlap
  exclude using gist (
    vehicle_id with =,
    reserved_period with &&
  ) where (status in ('pending', 'confirmed'));

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

alter table vehicles enable row level security;
alter table reservations enable row level security;

-- vehicles: the catalog is public, but only active vehicles are visible.
-- Read-only for everyone; no public write surface (CRUD is S-04 / F-02).
create policy vehicles_select_anon
  on vehicles for select
  to anon
  using (is_active = true);

create policy vehicles_select_authenticated
  on vehicles for select
  to authenticated
  using (is_active = true);

-- reservations: contain customer PII -> authenticated-only, per operation.
-- No anon policy => anon is denied by default. The public reservation funnel
-- (anon INSERT) is S-02 and is intentionally NOT opened here.
-- Roles are not yet modeled (employee/admin split is F-02); these gate on the
-- authenticated role and leave room for F-02 to refine.
create policy reservations_select_authenticated
  on reservations for select
  to authenticated
  using (true);

create policy reservations_insert_authenticated
  on reservations for insert
  to authenticated
  with check (true);

create policy reservations_update_authenticated
  on reservations for update
  to authenticated
  using (true)
  with check (true);

create policy reservations_delete_authenticated
  on reservations for delete
  to authenticated
  using (true);
