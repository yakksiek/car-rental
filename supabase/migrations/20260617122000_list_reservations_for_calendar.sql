-- Reservation Approval (S-03) — Phase 6: calendar range-read RPC
--
-- The reservation calendar plots pending + confirmed bookings overlapping a
-- visible window. Like every reservations read in this codebase, it crosses the
-- RLS boundary through a role-gated SECURITY DEFINER RPC (the authenticated role
-- has no direct table SELECT). Additive; reservations RLS unchanged. See plan.md (Phase 6).

-- Overlap test on the date span [pickup_date, return_date] vs [p_start, p_end].
-- The in-RPC role predicate yields zero rows for a non-staff caller.
create function public.list_reservations_for_calendar(p_start date, p_end date)
returns table (
  id uuid,
  reference text,
  status public.reservation_status,
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
    r.id, r.reference, r.status, r.customer_name,
    r.vehicle_id, v.make, v.model, r.pickup_date, r.return_date
  from public.reservations r
  join public.vehicles v on v.id = r.vehicle_id
  where r.status in ('pending', 'confirmed')
    and r.pickup_date <= p_end
    and r.return_date >= p_start
    and public.current_app_role() in ('employee', 'admin')
  order by r.pickup_date;
$$;

grant execute on function public.list_reservations_for_calendar(date, date) to authenticated;
