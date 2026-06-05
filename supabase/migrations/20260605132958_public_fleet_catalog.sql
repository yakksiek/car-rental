-- Public Fleet Catalog (S-01) — Phase 1: Spec columns + availability RPC
--
-- Extends F-01's vehicles with the two display specs the catalog/detail screens
-- need (seats, transmission), and adds the PII-safe availability RPC that lets
-- the public (anon) compute date-range availability WITHOUT reading reservations.
-- Additive over F-01 (20260603155136) / F-02 (20260604153139) — no changes to
-- existing tables' RLS. See context/changes/public-fleet-catalog/plan.md (Phase 1).

-- ---------------------------------------------------------------------------
-- Enums + spec columns
-- ---------------------------------------------------------------------------

create type transmission_type as enum ('manual', 'automatic');

-- Both nullable: trucks may omit a meaningful seat count, and the column is
-- additive over existing rows. The seed backfills realistic values per vehicle.
alter table vehicles
  add column seats int,
  add column transmission transmission_type;

-- ---------------------------------------------------------------------------
-- Availability RPC (PII-safe, anon-executable)
-- ---------------------------------------------------------------------------

-- anon cannot read reservations (no anon policy — F-01), so the public catalog
-- cannot compute date-range availability client-side. This SECURITY DEFINER
-- function runs the overlap check inside Postgres and returns ONLY vehicle rows
-- (no reservations columns, no PII). It mirrors the current_app_role() style
-- exactly: schema-qualified names + empty search_path so it is injection-safe.
--
-- Load-bearing details:
--   * SECURITY DEFINER bypasses RLS, so the body MUST re-apply `is_active` itself
--     — otherwise it would leak the inactive rows the public RLS hides.
--   * The status filter (pending|confirmed) and the half-open window
--     [pickup 14:00, return 10:00) match the reservations_no_overlap EXCLUDE
--     constraint byte-for-byte, so the three enforcement points cannot drift.
create function public.available_vehicles(p_pickup date, p_return date)
returns setof public.vehicles
language sql
stable
security definer
set search_path = ''
as $$
  select v.*
  from public.vehicles v
  where v.is_active
    and not exists (
      select 1
      from public.reservations r
      where r.vehicle_id = v.id
        and r.status in ('pending', 'confirmed')
        and r.reserved_period && tsrange(p_pickup + time '14:00', p_return + time '10:00', '[)')
    );
$$;

grant execute on function public.available_vehicles(date, date) to anon, authenticated;
