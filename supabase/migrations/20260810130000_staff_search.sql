-- Staff global search (S-13) — Phase 1: the `search_staff` cross-entity RPC.
--
-- The ⌘K omnisearch needs one role-gated read across three entities. Two of them
-- are unreachable from the client by design:
--
--   * `public.reservations` — direct SELECT was REVOKED from anon+authenticated
--     (20260630120000_reservations_revoke_select_grant.sql) after the confirmed PII
--     leak, and the `using(true)` select policy dropped with it. Every reservation
--     read now crosses the RLS boundary through a SECURITY DEFINER RPC, and none of
--     the existing ones does arbitrary text search (pending-only / calendar-window /
--     single-token).
--   * `public.protocols` — `revoke all` + RLS-on + zero policies (S-05/S-06), so the
--     "Zwroty" leg has to be computed inside a definer function too.
--
-- `public.vehicles` IS directly queryable by staff, but folding it in here keeps the
-- client to ONE round-trip and one shape for all three groups.
--
-- Definer hygiene (lessons.md, 2026-07-14 rpc-execute-grant-hardening): REVOKE
-- EXECUTE from public+anon BEFORE granting to authenticated — a grant alone
-- restricts nothing against the built-in PUBLIC default grant. The role gate also
-- lives IN the function body (`current_app_role()`), so a non-staff caller gets zero
-- rows rather than merely an unreadable table. Defense in depth, not either/or.
--
-- Additive and reversible: one new function + trigram indexes. No table, column,
-- policy, or grant on an existing object changes. Deliberately does NOT reference
-- `reservations.source` (S-12, a sibling branch not yet merged).

-- ---------------------------------------------------------------------------
-- §1 pg_trgm — make the leading-wildcard ILIKE indexable
-- ---------------------------------------------------------------------------
--
-- `ilike '%q%'` cannot use a btree index (the leading wildcard defeats prefix
-- matching), so without trigram support every keystroke is a seq scan. That is
-- fine at today's single-tenant size, but the indexes are cheap now and remove the
-- only reason this design would ever need an FTS/tsvector subsystem later.
--
-- Installed into `extensions` (alongside pg_net / pgcrypto / uuid-ossp), NOT into
-- `public` like the legacy `btree_gist` (20260603155136_booking_integrity_data.sql:9):
-- anything in `public` is exposed through PostgREST and lands in the generated
-- `database.types.ts`, so a public install would add pg_trgm's `show_trgm` /
-- `show_limit` to the app's own API surface for no reason. The opclass is therefore
-- schema-qualified below.
create extension if not exists pg_trgm with schema extensions;

-- One GIN index per searched text column — exactly the columns the ILIKE branches
-- below touch, and nothing else.
create index if not exists reservations_customer_name_trgm_idx on public.reservations using gin (customer_name extensions.gin_trgm_ops);
create index if not exists reservations_customer_email_trgm_idx on public.reservations using gin (customer_email extensions.gin_trgm_ops);
create index if not exists reservations_customer_phone_trgm_idx on public.reservations using gin (customer_phone extensions.gin_trgm_ops);
create index if not exists reservations_reference_trgm_idx on public.reservations using gin (reference extensions.gin_trgm_ops);
create index if not exists vehicles_name_trgm_idx on public.vehicles using gin (name extensions.gin_trgm_ops);
create index if not exists vehicles_make_trgm_idx on public.vehicles using gin (make extensions.gin_trgm_ops);
create index if not exists vehicles_model_trgm_idx on public.vehicles using gin (model extensions.gin_trgm_ops);
create index if not exists vehicles_plate_trgm_idx on public.vehicles using gin (plate extensions.gin_trgm_ops);

-- ---------------------------------------------------------------------------
-- §2 search_staff — the tagged, grouped, capped result set
-- ---------------------------------------------------------------------------
--
-- ONE union-shaped output row serves all three groups: `kind` tags the row and the
-- irrelevant columns are null (a vehicle row carries no dates or customer; a
-- reservation row carries no category). The client groups on `kind`.
--
-- `status` is per-kind by design, which is why it is plain `text` and not the
-- `reservation_status` enum:
--   * reservation → the base reservation status (`pending` / `confirmed` / …)
--   * return      → `returned` when a return protocol exists, else `due`
--   * vehicle     → `active` / `inactive`
--
-- The RETURNS TABLE is a superset of the plan's contract by two columns —
-- `vehicle_name` and `vehicle_category` — which the design contract's VehicleRow
-- (D9: name + make/model + plate + category) cannot be rendered without.
--
-- THE RETURNS ("Zwroty") BRANCH mirrors `list_returns_today`'s join shape, NOT its
-- date window: INNER-join the `type='issue'` protocol (the rental actually started —
-- a never-issued reservation has nothing to return) and LEFT-join the `type='return'`
-- protocol to derive returned-vs-due. Gating on the presence of a return protocol
-- instead would surface only COMPLETED returns and miss every actionable due one.
--
-- ESCAPING: `%` and `_` are ILIKE metacharacters, so a query containing them would
-- silently widen the match (`%` alone would match everything). They are escaped —
-- along with the escape character itself — before the wildcards are wrapped on.
--
-- CAP: 8 rows per group. The dropdown shows a handful and links out to the full
-- results page, which can widen this later.
create function public.search_staff(p_query text)
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
  limit 8;

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
  limit 8;

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
  limit 8;
end;
$$;

revoke execute on function public.search_staff(text) from public, anon;
grant execute on function public.search_staff(text) to authenticated;
