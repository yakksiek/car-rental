-- Invite journey fixes — Phase 4: resolve a link's target WITHOUT spending it
--
-- `/auth/callback` used to call `verifyOtp` on the GET, which consumed the token
-- as the set-password form RENDERED. That is Bug 2: a hire who opens their link
-- and closes the tab has already spent it, and reopening answers "Link wygasł".
-- It also minted a full employee session before any password existed.
--
-- Deferring the exchange to the POST fixes both, but `verifyOtp` was enforcing
-- FOUR guarantees at once and only one of them was written down
-- (lessons.md -> "Moving a call moves only the guarantee you named"):
--
--   (a) identity        — who the link is for            → this function
--   (b) type-pairing    — hash AND type must match       → this function, clause 1
--   (c) expiry          — the otp window                 → this function, clause 2
--   (d) deactivation    — via the session it minted,     → this function, clause 3
--                         which ran middleware.ts:36
--
-- (a)–(d) all land here, and the function returns NO ROW unless every clause
-- holds. Fail-closed is the whole contract; none of the clauses below is
-- defensive padding. It is LOOKUP-ONLY: it must never delete, update, or
-- otherwise spend the token — that stays `verifyOtp`'s job, at submit time.
--
-- COUPLING, recorded in context/foundation/known-issues.md: `auth.one_time_tokens`
-- is a GoTrue-INTERNAL table with no stability contract. We now depend on its
-- `token_hash`, `token_type` and `user_id` columns. Probed against GoTrue
-- v2.188.1 on 2026-08-20/21: the `hashed_token` the admin generateLink API
-- returns is byte-identical to `token_hash`, an invite's `token_type` is
-- `confirmation_token` (shared with signup, exactly as `verifyOtp` treats them)
-- and a recovery's is `recovery_token`. A GoTrue upgrade that changes any of
-- this breaks the ROLE GATE, not the flow — the function fails closed, so the
-- symptom is a refused link, never an open one.

create function public.resolve_link_token(p_token_hash text, p_type text)
returns table (
  user_id uuid,
  email text,
  full_name text,
  role public.app_role
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  -- Mirrors `supabase/config.toml:238` (`otp_expiry = 3600`). The duplication is
  -- deliberate and unavoidable: auth.one_time_tokens has NO expiry column, and
  -- GoTrue deletes a token on USE rather than on expiry — verified 2026-08-20,
  -- the local table held a row three days old against otp_expiry = 3600. Keep
  -- this in step with config.toml, or a dead link renders the form and is only
  -- refused at the POST, after the hire has chosen and submitted a password.
  otp_expiry_seconds constant int := 3600;
  expected_type auth.one_time_token_type;
begin
  -- CLAUSE 1 — hash AND type must both match.
  -- `?type` is caller-supplied. Today `verifyOtp` resolves the token by hash AND
  -- type, and that pairing is the ONLY reason the value can be trusted at all;
  -- the app's LINK_TYPES set validates membership in a closed SET, never the
  -- PAIRING. Matching on hash alone would let `&type=invite` on a genuine
  -- recovery link greet a password reset with "Witaj we Flocie" — the
  -- auth-followups F3 defect, restored. An unmapped type yields NULL here and
  -- the function returns nothing.
  expected_type := (
    case p_type
      when 'invite' then 'confirmation_token'
      when 'signup' then 'confirmation_token'
      when 'recovery' then 'recovery_token'
    end
  )::auth.one_time_token_type;

  if expected_type is null then
    return;
  end if;

  return query
  select
    t.user_id,
    u.email::text,
    p.full_name,
    -- CLAUSE 3 — the role must be deactivation-aware.
    -- `profiles.role` stays 'employee' after deactivate_staff runs, and
    -- current_app_role() (20260604153139:54) reads it with NO deactivation
    -- check. The only place the null-ing happens is middleware.ts:36, which
    -- never runs for a session-less path. Returning p.role verbatim would hand a
    -- deactivated staffer 'employee' and show them the set-password form — the
    -- exact defect R14 was shipped to close. Mirror middleware, not the helper.
    -- A LEFT JOIN with no profile row (the orphan shape) also yields null.
    case when p.deactivated_at is null then p.role end
  from auth.one_time_tokens t
  join auth.users u on u.id = t.user_id
  left join public.profiles p on p.user_id = t.user_id
  where t.token_hash = p_token_hash
    and t.token_type = expected_type
    -- CLAUSE 2 — expired tokens must yield no row.
    -- GoTrue measures the window from the users column it stamped when it minted
    -- the token, not from one_time_tokens (probed 2026-08-21: confirmation_sent_at
    -- for invite/signup, recovery_sent_at for recovery, each within ~8ms of the
    -- token row's created_at). A null sent_at makes the comparison NULL, so that
    -- also fails closed.
    and (
      case p_type
        when 'recovery' then u.recovery_sent_at
        when 'invite' then u.confirmation_sent_at
        when 'signup' then u.confirmation_sent_at
      end
    ) > (now() - make_interval(secs => otp_expiry_seconds));
end;
$$;

-- ---------------------------------------------------------------------------
-- EXECUTE grants — lessons.md carve-out (a): this RPC is INTENTIONALLY PUBLIC.
-- ---------------------------------------------------------------------------
--
-- `/auth/callback` is the app's one deliberately unauthenticated route, so the
-- caller is `anon`. `authenticated` is granted too because the same lookup runs
-- on the set-password POST, where a signed-in colleague may still hold a session
-- (the R11 conflict guard needs the link's target to compare against it).
--
-- Safe for the same reason the design is safe at all: the caller must ALREADY
-- hold a valid token_hash, the function returns nothing without one, and it is
-- lookup-only. Enumeration resistance comes from the hash's entropy, not from
-- the grant — and the three clauses above mean a guessed hash still yields no
-- row unless the type, the expiry window and the deactivation check all pass.
-- Rate-limiting a guessing loop is out of scope for this change.
--
-- Deliberately NOT routed through createAdminClient(): that is documented
-- service-role-only for admin-gated /api/staff* routes (src/lib/supabase.ts:43-45),
-- there is no gate to put in front of /auth/callback, and it returns null when
-- the OPTIONAL SUPABASE_SERVICE_ROLE_KEY is unset — which would silently kill
-- the entire invite and recovery journey on a missing secret, with a symptom
-- ("Link wygasł" for everyone) that reads as an expiry bug rather than a config one.
revoke execute on function public.resolve_link_token(text, text) from public, anon;
grant execute on function public.resolve_link_token(text, text) to anon, authenticated;
