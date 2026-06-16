-- Public Reservation Request (S-02) — Phase 6 follow-up (impl-review F3).
--
-- Bound get_vehicle_busy_ranges to current + future ranges. The original
-- (20260613170000) returned every pending/confirmed reservation for the vehicle
-- for all time. Past ranges are harmless to the calendar (it already disables
-- past dates), but the result set grows unbounded with history and is
-- serialized into the SSR HTML on every detail-page load. A `return_date >=
-- current_date` floor keeps the payload to the dates the calendar can actually
-- show, without changing behavior for any visible day.
--
-- `create or replace` keeps the existing anon/authenticated grants. Definer
-- hygiene unchanged: schema-qualified names + empty search_path (`current_date`
-- is a built-in keyword, not schema-resolved, so it is safe under search_path = '').

create or replace function public.get_vehicle_busy_ranges(p_vehicle_id uuid)
returns table (pickup_date date, return_date date)
language sql
stable
security definer
set search_path = ''
as $$
  select r.pickup_date, r.return_date
  from public.reservations r
  where r.vehicle_id = p_vehicle_id
    and r.status in ('pending', 'confirmed')
    and r.return_date >= current_date;
$$;
