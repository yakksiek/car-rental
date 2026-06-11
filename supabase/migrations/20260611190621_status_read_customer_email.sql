-- ---------------------------------------------------------------------------
-- S-02 design parity: the status page shows a "Potwierdzenie wysłaliśmy na
-- <email>" pill (design desktop-3-request-received), so the tokenized status
-- read must expose the customer's email. The token holder IS the customer —
-- their own email is theirs to see, same rationale as customer_name. No other
-- reservation is reachable without its token; phone stays unexposed.
--
-- A return-type change requires drop + recreate. Same definer hygiene as the
-- original (20260611171737): empty search_path, schema-qualified names,
-- execute granted to anon + authenticated.
-- ---------------------------------------------------------------------------

drop function public.get_reservation_status(uuid);

create function public.get_reservation_status(p_token uuid)
returns table (
  reference text,
  status public.reservation_status,
  pickup_date date,
  return_date date,
  customer_name text,
  customer_email text,
  created_at timestamptz,
  vehicle_make text,
  vehicle_model text,
  vehicle_production_year int,
  vehicle_category public.vehicle_category,
  vehicle_daily_rate numeric,
  vehicle_deposit numeric
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    r.reference, r.status, r.pickup_date, r.return_date, r.customer_name,
    r.customer_email, r.created_at,
    v.make, v.model, v.production_year, v.category, v.daily_rate, v.deposit
  from public.reservations r
  join public.vehicles v on v.id = r.vehicle_id
  where r.access_token = p_token;
$$;

grant execute on function public.get_reservation_status(uuid) to anon, authenticated;
