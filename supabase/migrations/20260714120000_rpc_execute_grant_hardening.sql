-- RPC EXECUTE-grant hardening (rpc-execute-grant-hardening).
--
-- lessons.md -> "Revoke EXECUTE before granting it": `grant execute ... to
-- authenticated` on a SECURITY DEFINER RPC restricts nothing. Postgres grants
-- EXECUTE to PUBLIC by default, and Supabase's default privileges add an explicit
-- `anon` grant on top, so a definer RPC is anon-callable at the grant layer.
-- Verified against pg_proc.proacl on 2026-07-10 during S-05.
--
-- S-05 fixed its own five RPCs in-slice. This closes the four PRE-EXISTING staff
-- RPCs. Verified NOT exploitable today -- each staff RPC refuses at its in-function
-- current_app_role() gate -- so this hardens the grant layer beneath the gate
-- (defense in depth).
--
-- WHY NO SCHEMA-LEVEL DEFAULT: we tried `alter default privileges in schema public
-- revoke execute on functions from public, anon, authenticated` to make FUTURE
-- functions start closed. Spike-verified 2026-07-14 that it is a NO-OP in this
-- Supabase environment: a freshly-created function still receives the built-in
-- PUBLIC execute grant (proacl `{=X/...}`), so anon can call it. Reproduced three
-- ways (combined revoke, in-session re-run, PUBLIC-alone revoke). Supabase's
-- managed Postgres does not honor default-privilege suppression of the
-- function-execute-to-PUBLIC default -- which is why Supabase's own guidance, and
-- lessons.md, mandate a PER-FUNCTION `revoke execute ... from public, anon` on
-- every new RPC. That per-function revoke is the durable control; there is no
-- reliable "start closed" default to lean on here.
--
-- DELIBERATELY UNTOUCHED: the four intentionally-public RPCs
--   available_vehicles, get_vehicle_busy_ranges, get_reservation_status,
--   create_reservation_request
-- each carry an explicit `grant execute ... to anon` and must stay anon-callable
-- for the public booking funnel. service_role is also left intact.

-- 1) Close the four pre-existing staff RPCs at the grant layer. Keep the
--    `authenticated` grant -- staff call them as authenticated and the in-function
--    current_app_role() gate handles role; only public + anon are revoked.
revoke execute on function public.decide_reservation(uuid, text, text, text) from public, anon;
revoke execute on function public.set_vehicle_active(uuid, boolean) from public, anon;
revoke execute on function public.list_pending_reservations() from public, anon;
revoke execute on function public.list_reservations_for_calendar(date, date) from public, anon;

-- 2) current_app_role() is invoked from 16 RLS policy clauses and had no explicit
--    grant (it ran on the default PUBLIC grant). Make it explicit per the
--    lessons.md carve-out, so a future re-create can't strand the policies that
--    depend on it.
grant execute on function public.current_app_role() to authenticated;
