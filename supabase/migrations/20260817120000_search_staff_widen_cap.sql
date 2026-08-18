-- Staff global search — widen the per-group cap from 8 to 25.
--
-- WHY NOW: the original cap (20260810130000_staff_search.sql) was justified by an
-- escape hatch that no longer exists. Its comment read "the dropdown shows a handful
-- and links out to the full results page" — but `/dashboard/search` is being deleted
-- (change `staff-search-dashboard-only`), so the dropdown becomes the ONLY search
-- surface. At `limit 8`, match #9 would be unreachable with no way to ask for it:
-- exactly the silent-truncation failure the dropdown-only decision was made to avoid.
--
-- WHY 25 AND NOT UNBOUNDED: this is a SECURITY DEFINER function reachable on every
-- debounced keystroke, so an unbounded scan is a standing perf risk on a table the
-- caller cannot otherwise read. 25 per group (75 rows worst case) is comfortably
-- above any realistic single-token match in a single-tenant fleet, and the panel
-- scrolls (`maxHeight 460`, `overflowY auto`) so every row it returns is reachable.
-- The design specifies no truncation state and no visible per-group cap, which this
-- honours in practice rather than by contract.
--
-- Nothing else about the function changes: same signature, same `returns table`
-- shape (so no type regeneration and no client change — `groupSearchRows` is
-- untouched), same role gate, same 2-character floor, same ILIKE escaping, same
-- ordering per group.
--
-- SHAPE STABILITY, NOT RENDERING: `vehicle_model` and `vehicle_category` are no
-- longer read by any row component (the vehicle row draws the make and the plate;
-- category was never drawn). They are kept because freezing the `returns table`
-- shape is what lets this migration skip type regeneration — not because anything
-- renders them.
--
-- Reversible by a `create or replace` back to `limit 8`.

-- `create or replace` preserves the existing ACL, so the revoke/grant pair at the
-- bottom is re-stated for idempotence rather than necessity. Restating it is the
-- rule regardless (lessons.md): a bare grant never restricts a definer RPC, so the
-- revoke from public+anon always leads.
create or replace function public.search_staff(p_query text)
returns table (
  kind text,
  id uuid,
  reference text,
  customer_name text,
  vehicle_id uuid,
  vehicle_name text,
  vehicle_make text,
  vehicle_model text,
  vehicle_plate text,
  vehicle_category text,
  pickup_date date,
  return_date date,
  status text,
  daily_rate numeric
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_role public.app_role;
  v_query text;
  v_pattern text;
begin
  v_role := public.current_app_role();
  if v_role is null or v_role not in ('employee', 'admin') then
    return;
  end if;

  v_query := btrim(coalesce(p_query, ''));
  -- Mirrors the endpoint's zod guard; a 1-char query would match nearly every row.
  if length(v_query) < 2 then
    return;
  end if;

  v_pattern := '%' || replace(replace(replace(v_query, '\', '\\'), '%', '\%'), '_', '\_') || '%';

  -- Rezerwacje — any reservation whose customer, reference, or vehicle plate matches.
  return query
  select
    'reservation'::text,
    r.id,
    r.reference,
    r.customer_name,
    v.id,
    v.name,
    v.make,
    v.model,
    v.plate,
    v.category::text,
    r.pickup_date,
    r.return_date,
    r.status::text,
    v.daily_rate
  from public.reservations r
  join public.vehicles v on v.id = r.vehicle_id
  where r.customer_name ilike v_pattern
     or r.customer_email ilike v_pattern
     or r.customer_phone ilike v_pattern
     or r.reference ilike v_pattern
     or v.plate ilike v_pattern
  order by r.created_at desc
  limit 25;

  -- Zwroty — issued (`type='issue'` present) confirmed rentals, returned or still due.
  return query
  select
    'return'::text,
    r.id,
    r.reference,
    r.customer_name,
    v.id,
    v.name,
    v.make,
    v.model,
    v.plate,
    v.category::text,
    r.pickup_date,
    r.return_date,
    case when rp.id is null then 'due' else 'returned' end,
    v.daily_rate
  from public.reservations r
  join public.vehicles v on v.id = r.vehicle_id
  join public.protocols ip
    on ip.reservation_id = r.id and ip.type = 'issue'
  left join public.protocols rp
    on rp.reservation_id = r.id and rp.type = 'return'
  where r.status = 'confirmed'
    and (
      r.customer_name ilike v_pattern
      or r.customer_email ilike v_pattern
      or r.customer_phone ilike v_pattern
      or r.reference ilike v_pattern
      or v.plate ilike v_pattern
    )
  order by r.return_date desc
  limit 25;

  -- Pojazdy — the fleet by name / make / model / plate.
  return query
  select
    'vehicle'::text,
    v.id,
    null::text,
    null::text,
    v.id,
    v.name,
    v.make,
    v.model,
    v.plate,
    v.category::text,
    null::date,
    null::date,
    case when v.is_active then 'active' else 'inactive' end,
    v.daily_rate
  from public.vehicles v
  where v.name ilike v_pattern
     or v.make ilike v_pattern
     or v.model ilike v_pattern
     or v.plate ilike v_pattern
  order by v.name
  limit 25;
end;
$$;

revoke execute on function public.search_staff(text) from public, anon;
grant execute on function public.search_staff(text) to authenticated;
