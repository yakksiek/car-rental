-- Return Protocol (S-06) — Phase 4: expose `type` + `baseline_protocol_id` on
-- get_protocol.
--
-- The S-05 get_protocol (20260710120000:465-566) is type-agnostic — it serves a
-- return row unchanged — but it never SELECTed the discriminator or the baseline
-- link, because at S-05 time neither column existed. S-06 needs both:
--   * the type-aware resend path (Phase 4) reads `type` to pick the email
--     template (protocol_issued vs protocol_returned) and follows
--     `baseline_protocol_id` to load the issue baseline for the comparison deltas;
--   * the return view screen (Phase 6) reads `type` to render the comparison
--     block and follows `baseline_protocol_id` with a second get_protocol call.
-- The per-damage jsonb also gains `baseline_damage_id` (the persisted existing/new
-- decision) so the new-damage count comes from the source of truth, not a
-- re-derivation.
--
-- Adding two OUT columns changes the function's return type, which
-- CREATE OR REPLACE refuses ("cannot change return type of existing function"),
-- so this is a DROP + CREATE. Nothing in SQL depends on get_protocol (it is
-- called only from app code via the service), so the drop is safe; the grants are
-- re-established after (a drop discards them). Purely additive for the app: the
-- service destructures by name and spreads the rest, so existing issue call sites
-- are unaffected and the two new fields flow into ProtocolView via Omit.
--
-- Additive over S-05 (20260710120000_issue_protocol.sql) + return_protocol
-- (20260716120000). See context/changes/return-protocol-comparison/plan.md (Phase 4).

drop function public.get_protocol(uuid);

create function public.get_protocol(p_id uuid)
returns table (
  id uuid,
  reservation_id uuid,
  type public.protocol_type,
  baseline_protocol_id uuid,
  odometer_km int,
  fuel_eighths smallint,
  signed_at timestamptz,
  signature text,
  customer_ack boolean,
  pdf_path text,
  created_at timestamptz,
  reference text,
  customer_name text,
  customer_email text,
  pickup_date date,
  return_date date,
  vehicle_make text,
  vehicle_model text,
  vehicle_plate text,
  photos jsonb,
  damages jsonb,
  delivery_status text,
  delivery_created_at timestamptz
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
    p.id,
    p.reservation_id,
    p.type,
    p.baseline_protocol_id,
    p.odometer_km,
    p.fuel_eighths,
    p.signed_at,
    p.signature,
    p.customer_ack,
    p.pdf_path,
    p.created_at,
    r.reference,
    r.customer_name,
    r.customer_email,
    r.pickup_date,
    r.return_date,
    v.make,
    v.model,
    v.plate,
    coalesce(ph.photos, '[]'::jsonb),
    coalesce(dm.damages, '[]'::jsonb),
    d.status,
    d.created_at
  from public.protocols p
  join public.reservations r on r.id = p.reservation_id
  join public.vehicles v on v.id = r.vehicle_id
  left join lateral (
    select jsonb_agg(jsonb_build_object('slot', pp.slot, 'path', pp.path) order by pp.slot) as photos
    from public.protocol_photos pp
    where pp.protocol_id = p.id
  ) ph on true
  left join lateral (
    select jsonb_agg(
      jsonb_build_object(
        'id', pd.id,
        'type', pd.type,
        'location', pd.location,
        'size', pd.size,
        -- The PERSISTED existing/new decision (S-06): non-null => carried over
        -- from that baseline item, null => new (always null on issue rows). The
        -- return email + view read this to count new damage from the source of
        -- truth rather than re-deriving it. Added alongside the type/baseline
        -- columns above; see plan Phase 4.
        'baseline_damage_id', pd.baseline_damage_id,
        'photos', coalesce(dp.paths, '[]'::jsonb)
      )
    ) as damages
    from public.protocol_damages pd
    left join lateral (
      select jsonb_agg(pdp.path) as paths
      from public.protocol_damage_photos pdp
      where pdp.damage_id = pd.id
    ) dp on true
    where pd.protocol_id = p.id
  ) dm on true
  left join lateral (
    select ed.status, ed.created_at
    from public.email_deliveries ed
    where ed.entity_type = 'protocol' and ed.entity_id = p.id
    order by ed.created_at desc
    limit 1
  ) d on true
  where p.id = p_id;
end;
$$;

-- A drop discards grants, so re-establish the S-05 posture: EXECUTE revoked from
-- public+anon (a grant alone restricts nothing — lessons.md), granted only to
-- authenticated. The in-function role gate stays the real authority.
revoke execute on function public.get_protocol(uuid) from public, anon;
grant execute on function public.get_protocol(uuid) to authenticated;
