-- Reservation Approval (S-03) — surface the vehicle plate in the pending queue
--
-- The approval screens (design 08/09/14) show the registration plate under the
-- vehicle name — the fleet's only practical differentiator (see vehicles.plate,
-- added in 20260710120000_issue_protocol). This RPC predates that column
-- (2026-06-17 < 2026-07-10), so it never selected it; every other staff read
-- (protocols, overdue returns) already returns v.plate as vehicle_plate. This
-- brings the pending queue in line.
--
-- The OUT columns change, so CREATE OR REPLACE can't alter the signature —
-- drop and recreate. Additive column; role gate, definer hygiene, and grant
-- are re-stated verbatim from 20260617121000_list_pending_reservations.

drop function if exists public.list_pending_reservations();

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
  vehicle_plate text,
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
    r.vehicle_id, v.make, v.model, v.plate, v.production_year, v.daily_rate, v.deposit
  from public.reservations r
  join public.vehicles v on v.id = r.vehicle_id
  where r.status = 'pending'
    and public.current_app_role() in ('employee', 'admin')
  order by r.created_at desc;
$$;

grant execute on function public.list_pending_reservations() to authenticated;
