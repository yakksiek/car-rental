-- Public Reservation Request (S-02) — Phase 6: Availability Transparency.
--
-- Adds the PII-safe per-vehicle busy-ranges RPC the booking calendar uses to
-- grey out dates that are already taken (Booking.com style), so a visitor never
-- picks an unavailable range. anon cannot read reservations (no anon policy —
-- F-01), so the public funnel cannot compute per-vehicle availability
-- client-side. This SECURITY DEFINER function runs inside Postgres and returns
-- ONLY the date bounds of blocking reservations — no names, no email, no phone,
-- no reference, no token. Mirrors available_vehicles' definer hygiene exactly:
-- schema-qualified names + empty search_path so it is injection-safe.
--
-- Additive over Phase 1 (20260611171737) — reservations RLS is UNCHANGED (anon
-- stays denied); the read crosses the boundary only through this granted RPC.
-- The greying is UX sugar: the reservations_no_overlap EXCLUDE constraint stays
-- the atomic backstop. See context/changes/public-reservation-request/plan.md
-- (Phase 6).

-- ---------------------------------------------------------------------------
-- Busy-ranges RPC (PII-safe, anon-executable)
-- ---------------------------------------------------------------------------

-- The status filter (pending|confirmed) matches the reservations_no_overlap
-- EXCLUDE constraint and available_vehicles byte-for-byte, so the enforcement
-- points cannot drift. Confirmed dates are a hard block; pending dates are a
-- soft hold (still blocking until the request is resolved). Returns only the
-- [pickup_date, return_date] bounds — the client re-applies the half-open
-- [pickup 14:00, return 10:00) window when building the greyed day set.
create function public.get_vehicle_busy_ranges(p_vehicle_id uuid)
returns table (pickup_date date, return_date date)
language sql
stable
security definer
set search_path = ''
as $$
  select r.pickup_date, r.return_date
  from public.reservations r
  where r.vehicle_id = p_vehicle_id
    and r.status in ('pending', 'confirmed');
$$;

grant execute on function public.get_vehicle_busy_ranges(uuid) to anon, authenticated;
