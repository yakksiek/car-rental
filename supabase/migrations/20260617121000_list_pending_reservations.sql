-- Reservation Approval (S-03) — Phase 2: pending-queue read RPC
--
-- The employee queue needs to read `reservations` (PII), which anon/authenticated
-- cannot do directly: the role grants only carry Dxtm (no table SELECT), so every
-- reservations read in this codebase crosses the RLS boundary through a SECURITY
-- DEFINER RPC (get_reservation_status, get_vehicle_busy_ranges). This adds the
-- queue read in the same shape — definer hygiene + an in-RPC role gate so only
-- employees/admins ever receive rows (the API route also gates, defense in depth).
-- Additive; reservations RLS unchanged. See plan.md (Phase 2).

-- Returns every pending request joined to its vehicle's display fields, newest
-- first. The role predicate yields zero rows for a non-staff caller — the gate
-- lives in the query, not just the endpoint.
create function public.list_pending_reservations()
returns table (
  id uuid,
  reference text,
  customer_name text,
  customer_email text,
  customer_phone text,
  company text,
  vat_id text,
  notes text,
  pickup_date date,
  return_date date,
  created_at timestamptz,
  vehicle_id uuid,
  vehicle_make text,
  vehicle_model text,
  vehicle_production_year int,
  vehicle_daily_rate numeric,
  vehicle_deposit numeric
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    r.id, r.reference, r.customer_name, r.customer_email, r.customer_phone,
    r.company, r.vat_id, r.notes, r.pickup_date, r.return_date, r.created_at,
    r.vehicle_id, v.make, v.model, v.production_year, v.daily_rate, v.deposit
  from public.reservations r
  join public.vehicles v on v.id = r.vehicle_id
  where r.status = 'pending'
    and public.current_app_role() in ('employee', 'admin')
  order by r.created_at desc;
$$;

grant execute on function public.list_pending_reservations() to authenticated;
