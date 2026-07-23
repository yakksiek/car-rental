-- Overdue Returns Dashboard (S-07) — Phase 1: overdue count RPC + Call phone column.
--
-- S-07 packages the overdue detection S-06 already ships (list_returns_today has
-- no lower date bound). Two additive, read-only DB changes, no new tables, no
-- writes, no RLS changes:
--
--   1. count_overdue_returns() — a cheap, PII-free scalar the shell reads on every
--      staff page to paint the "Zwroty" danger badge. It counts EXACTLY the rows
--      ReturnQueue classifies as `overdue` (strict-overdue + still-open + issued +
--      confirmed), so the badge can never disagree with the on-page count.
--   2. list_returns_today gains a `customer_phone` output column so the overdue
--      row's `Zadzwoń` Call button can be a `tel:` link. A return-type change forces
--      DROP + CREATE (CREATE OR REPLACE errors on a changed RETURNS TABLE), which
--      discards the grants — so revoke/grant is re-applied below.
--
-- Definer hygiene (lessons.md, 2026-07-14 rpc-execute-grant-hardening): every new
-- function revokes EXECUTE from public+anon BEFORE granting to authenticated — a
-- grant alone restricts nothing against the built-in PUBLIC default grant. The
-- role gate lives IN the query (`current_app_role() in (...)`), so a non-staff
-- caller gets zero rows / a 0 count, not just an unreadable table.

-- ---------------------------------------------------------------------------
-- §1 count_overdue_returns — the badge count
-- ---------------------------------------------------------------------------
--
-- Mirrors list_returns_today's `reservations ⋈ issue-protocol` joins and its
-- `status = 'confirmed'` filter, restricted to the strict-overdue-open subset:
--   * INNER join the issue protocol — a return requires an issue baseline, so a
--     never-issued past-due rental never counts (parity with the worklist).
--   * LEFT join the return protocol, then `rp.id is null` — still open.
--   * `return_date < current_date` — STRICTLY overdue. list_returns_today's own
--     `<= current_date` includes due-today, which ReturnQueue paints `due`, NOT
--     `overdue` (ReturnQueue.tsx:48). Using `<` here keeps badge/list parity.
-- A non-staff (null-role) caller matches no rows via the inline role predicate, so
-- count(*) is 0.
create function public.count_overdue_returns()
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select count(*)::int
  from public.reservations r
  join public.protocols ip
    on ip.reservation_id = r.id and ip.type = 'issue'
  left join public.protocols rp
    on rp.reservation_id = r.id and rp.type = 'return'
  where r.status = 'confirmed'
    and rp.id is null                 -- still open
    and r.return_date < current_date  -- strictly overdue (not due-today)
    and public.current_app_role() in ('employee', 'admin');
$$;

revoke execute on function public.count_overdue_returns() from public, anon;
grant execute on function public.count_overdue_returns() to authenticated;

-- ---------------------------------------------------------------------------
-- §2 list_returns_today — add customer_phone for the Call link
-- ---------------------------------------------------------------------------
--
-- Verbatim from 20260716120000_return_protocol.sql:314-384 with ONE addition: a
-- `customer_phone text` output column selecting `r.customer_phone` (the column the
-- reservations table already carries — it feeds list_pending_reservations). No
-- logging, no new storage. Adding an output column changes the RETURNS TABLE
-- signature, so CREATE OR REPLACE is refused ("cannot change return type of
-- existing function") — DROP + CREATE, then re-apply the grants the drop discards.
-- Reversible by dropping the column and recreating without it.
drop function public.list_returns_today();

create function public.list_returns_today()
returns table (
  reservation_id uuid,
  reference text,
  customer_name text,
  customer_email text,
  customer_phone text,
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
    r.customer_phone,
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
