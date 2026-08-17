# Known Issues

Durable notes on quirks that are expected, diagnosed, and consciously not fixed (or fixed
elsewhere). Keep entries short: symptom → cause → scope → decision.

## Dev-only: wrong layout on view-transition navigation (Tailwind v4 + Astro ClientRouter)

- **Symptom:** In `npm run dev`, a page reached via a client-side view transition (`navigate()`
  from `astro:transitions/client` — e.g. the vehicle detail "Zarezerwuj" button → `/reserve`)
  can render with a broken/narrow layout: some Tailwind utilities (`lg:justify-between`,
  `lg:grid-cols-[7fr_3fr]`, `max-w-app`, …) don't apply. A hard refresh fixes it.
- **Cause:** In dev, `@tailwindcss/vite` v4 inlines all of Tailwind into each page's `<head>` as
  `<style data-vite-dev-id=".../src/styles/global.css">`. Astro's `<ClientRouter />` de-dupes
  those style blocks by their `data-vite-dev-id` across navigations and keeps the one already in
  the DOM — it never swaps the **contents**. So the first full-loaded route's inlined CSS blob is
  reused for the whole SPA session; any utility missing from that initial blob stays missing after
  client-side nav until a hard reload (which makes Vite serve a freshly compiled blob).
- **Scope:** Dev-only. The production build emits a **single shared external CSS file**
  (`dist/client/_astro/Layout.*.css`) containing every class, linked by all pages, so client-side
  navigation cannot lose rules. Verified 2026-06-13: broken under `npm run dev`, correct under
  `npm run preview`.
- **Decision:** Accepted as a dev-only quirk — **no code change**. Production is unaffected, and the
  layout is correct on any full page load. It is not caused by any single feature; it affects any
  route reachable only via in-app view-transition navigation.
- **If it ever needs fixing:** add an `astro:after-swap` listener that re-syncs any incoming
  `<style data-vite-dev-id>` the current DOM lacks, or bump `@tailwindcss/vite` / `astro` (this
  class of "Tailwind missing after view transition in dev" has had upstream fixes). To verify a fix,
  reproduce in `npm run dev` (not `preview`).

## Queued: repo-wide RPC EXECUTE-grant hardening (`rpc-execute-grant-hardening`)

- **Symptom:** `grant execute … to authenticated` on a `SECURITY DEFINER` RPC restricts nothing —
  Postgres grants EXECUTE to `PUBLIC` by default and Supabase's default privileges add an explicit
  `anon` grant, so every RPC is anon-callable at the grant layer. Found 2026-07-10 during S-05 Phase 1.
- **Cause:** Default function grants, not the app. See `lessons.md` → "Revoke EXECUTE before granting it".
- **Scope:** Repo-wide, but **verified NOT exploitable** — every pre-existing staff RPC
  (`decide_reservation`, `set_vehicle_active`, `list_pending_reservations`,
  `list_reservations_for_calendar`) refuses at its in-function `current_app_role()` gate (no leak, no
  state change). S-05's own five RPCs were fixed in-slice with explicit `revoke … from public, anon`.
  This is defense-in-depth for the older RPCs and future ones, not an open hole.
- **Decision:** Deferred to its own change (agreed 2026-07-10, run after S-05 shipped — now done). Fix:
  (a) `alter default privileges in schema public revoke execute on functions from public, anon,
authenticated;` so new functions start closed; (b) explicit `revoke execute … from public, anon` on
  the four staff RPCs above; (c) an integration test pinning anon-uncallability. **Carve-outs:** the
  four intentionally-public RPCs (`available_vehicles`, `get_vehicle_busy_ranges`,
  `get_reservation_status`, `create_reservation_request`) keep their explicit `anon` grant; the
  `current_app_role()` policy helper keeps its `authenticated` grant.
- **To action:** `/10x-new rpc-execute-grant-hardening`. Full context in the archived S-05 change log
  (`context/archive/2026-07-09-issue-protocol/change.md`, Phase 1 note).

## Single-locale by construction: `pl-PL` + `Europe/Warsaw` hardcoded app-wide

- **Symptom:** The app assumes one locale/timezone everywhere — `Intl.DateTimeFormat("pl-PL")` /
  `toLocaleString("pl-PL")` for numbers/dates, a pinned `Europe/Warsaw` zone for the signature
  timestamp (`ProtocolView.tsx`), Polish month/weekday lookup tables in `returns.astro` (workerd-ICU
  workaround), and Polish UI copy in every component. Correct for one Polish company; a wall the
  moment there's a non-PL deployment.
- **Cause:** No i18n layer — display locale, company timezone, currency, and copy strings are inline
  literals scattered across components. Surfaced 2026-07-22 while fixing a signature-timestamp SSR
  hydration mismatch (server UTC vs client-local), fixed by pinning the zone inline.
- **Scope:** App-wide, but a **latent limitation, not a live bug** — single-tenant, single-locale is
  the current product reality (one Polish rental company; staff-only tool).
- **Decision:** Accepted for now (YAGNI) — no i18n built ahead of need; the hydration fix keeps the
  inline `Europe/Warsaw`. Do NOT switch timestamps to viewer-local: it reintroduces the hydration
  mismatch AND is semantically wrong (a signature is a company-anchored event — Warsaw is where/when
  it happened, regardless of who views it).
- **If it ever needs fixing (tiered):** (1) centralize `LOCALE` / `TIMEZONE` / `CURRENCY` into one
  config module + `formatDate/Number/Currency` helpers, route the scattered `pl-PL`/`Europe/Warsaw`
  calls through it (cheap); (2) per-tenant/env config for multi-company; (3) full copy i18n (message
  catalogs + lib) — large, only when a non-PL deployment is real. Note **timezone ≠ locale**
  (company-anchored events stay `Europe/Warsaw` even multi-locale) and **workerd ships a trimmed ICU**
  (why `returns.astro` hand-rolls month names — server-side multi-locale formatting will hit this).
  See `lessons.md` → "Locale/timezone/currency are single-locale".

## Seed vehicles use random `picsum.photos` placeholders (read as non-vehicle stock photos)

- **Symptom:** Vehicle cards (landing "Popularne", `/fleet`, vehicle detail) render real photos that
  are **not vehicles** — clouds, a beach, a rocky coast. Most visible on the landing's top-3 featured
  cards, where the design intends a clean gradient/silhouette placeholder.
- **Cause:** `supabase/seed.sql` seeds every vehicle's `photos` array with
  `https://picsum.photos/seed/<name>-N/960/600` — Lorem Picsum, which returns a **random** image per
  seed string, never vehicle imagery. All 6 active seeded vehicles (Sprinter, Master, Crafter, Daily,
  TGL, Scania) use these. The card code is correct: `photos[0]` → `<img>`, else the on-brand
  `VehicleSilhouette` — so with no photos it already falls back to the designed placeholder.
- **Scope:** **Seed data only** (confirmed 2026-08-07, change `landing-design-resync` Phase 4). Not a
  component/CSS bug. Production data is separate and unverified here.
- **Decision (owner, 2026-08-07):** Leave the seed as-is and hand off — do **not** clear or swap the
  photos in this presentational change. The real fix is content: supply genuine vehicle photography
  (then `photos[0]` renders correctly), or, if a placeholder is preferred, clear the `photos` arrays
  in `supabase/seed.sql` (lines 33/41/50/59/68/77) so `VehicleSilhouette` renders. Either is a
  one-line-per-row seed edit + local re-seed; **not** a code change (never hard-code the card to force
  the silhouette — real photos are correct when they're actually of the vehicle).
- **To action:** owner decision on real photography vs. placeholder, then a seed-only edit (+ prod
  data cleanup if prod carries the same placeholders).

## Auth session cookies carry a 400-day `Max-Age`

- **Symptom:** `Set-Cookie` on the `sb-<ref>-auth-token*` cookies carries `Max-Age=34560000` — 400
  days, the browser's ceiling. Found 2026-08-17 while adding `Secure` in S-14 Phase 5.
- **Cause:** `@supabase/ssr`'s `DEFAULT_COOKIE_OPTIONS` (`utils/constants.js`) sets
  `maxAge: 400 * 24 * 60 * 60`. Passing `cookieOptions` does **not** reach it: the library merges
  caller options over the defaults and then **re-pins `maxAge` to its own default on every write**
  (`dist/main/cookies.js:202-206`, `:357-361`), so the value is unreachable through the documented
  knob. S-14 passes `cookieOptions` for `secure` only.
- **Scope:** Cookie lifetime is **not** session lifetime — the access token expires in an hour
  (`config.toml` `jwt_expiry = 3600`) and refresh-token rotation is on
  (`enable_refresh_token_rotation = true`, `refresh_token_reuse_interval = 10`), so a stolen cookie is
  bounded by GoTrue's refresh-token validity, not by `Max-Age`. What the 400 days actually buys is a
  long-lived _refresh_ token sitting in the browser profile on a shared rental-desk workstation.
  S-14's `signOut({ scope: "global" })` on a password set (R1) revokes it server-side.
- **Decision:** Accepted, not fixed in S-14 — the cookie is already `Secure`, `SameSite=Lax` and
  server-revocable, and the fix has to fight the library.
- **If it ever needs fixing:** clamp it in **our** `setAll` handler (`src/lib/supabase.ts`), which is
  the last hop before `cookies.set` and the only place the library's re-pin can't override —
  `cookies.set(name, value, { ...options, maxAge: Math.min(options.maxAge ?? MAX, MAX) })`. Verify by
  reading `Set-Cookie` under `npm run preview`, not by reading the option back.

## No rate limit on the password-update path

- **Symptom:** `/api/auth/reset-password` and `/api/auth/change-password` accept unbounded POSTs;
  nothing throttles `updateUser({ password })` at the app or the GoTrue layer.
- **Cause:** `[auth.rate_limit]` in `supabase/config.toml` has buckets for email sends
  (`email_sent = 2`/h), sign-in/sign-up (`sign_in_sign_ups = 30`/5min), OTP verification
  (`token_verifications = 30`/5min) and refresh (`token_refresh = 150`/5min) — **no bucket covers
  `PUT /user`**. Neither route adds one of its own, and no Cloudflare rate-limiting binding is wired
  up.
- **Scope:** Narrower than it sounds, and **not** a credential-guessing oracle. `change-password`'s
  reauth goes through `signInWithPassword`, which _is_ covered by the `sign_in_sign_ups` bucket, so
  password guessing there is throttled. `reset-password` needs a link-minted session **and** the
  one-shot marker **and** a staff role, and spends the marker on success. What is unthrottled is the
  update itself, by a caller who already holds the right session — so the exposure is request volume,
  not authentication bypass.
- **Decision:** Deferred to its own slice (agreed at S-14 planning; explicitly out of scope there).
  Fix: a Cloudflare rate-limiting rule or WAF rule keyed on the two paths, in front of the Worker —
  cheaper and harder to bypass than an in-handler counter, which would need durable state anyway.

## `signin` / `signout` / `signup` rely on Astro's `security.checkOrigin` default for CSRF

- **Symptom:** Those three POST routes carry no in-handler origin check, unlike every auth route S-08
  and S-14 touched (`reset-password.ts:61-64`, `change-password.ts`, `forgot-password.ts:13-16`),
  which all compare `origin` to `context.url.origin` themselves.
- **Cause:** `astro.config.mjs` never sets `security.checkOrigin`, and Astro 6.3.1 defaults it to
  `true` (`node_modules/astro/dist/core/config/schemas/base.js:52`), so an internal middleware 403s
  cross-site form POSTs before ours runs. Two limits are worth knowing:
  `SAFE_METHODS = GET / HEAD / OPTIONS` are exempt (which is exactly why `/auth/callback` needed its
  own guard in S-14 Phase 2 — R3), and a POST is only rejected when its `Content-Type` is form-like
  (`application/x-www-form-urlencoded`, `multipart/form-data`, `text/plain`) **or absent**
  (`node_modules/astro/dist/core/app/middlewares.js`). A cross-site POST declaring
  `application/json` passes the check.
- **Scope:** **Not currently exploitable.** All three routes read `formData()`, so a real attack has
  to send a form-like content type and gets 403'd; the JSON hole is unreachable from a browser
  anyway, since that request preflights and we send no CORS headers. The gap is that the protection
  is a framework default plus a content-type heuristic, not something these routes assert.
- **Decision:** Left as-is in S-14 — adding checks there widens the diff onto routes the slice
  otherwise doesn't touch, for no live exposure. **Re-open immediately** if `security.checkOrigin` is
  ever set to `false`, if the adapter changes, or if any of the three starts accepting a JSON body:
  then copy the explicit four-line check from `reset-password.ts`.

## No CSP or `X-Frame-Options` — compounding `httpOnly: false` on the auth cookies

- **Symptom:** No `Content-Security-Policy`, `X-Frame-Options`, or `Strict-Transport-Security` on any
  response. There is no header-setting middleware and no `public/_headers`.
- **Cause:** Never built. Astro sets none by default and `@astrojs/cloudflare` adds none.
- **Compounding factor — this is why the two are one entry.** The Supabase auth cookies are written
  `httpOnly: false` (`@supabase/ssr`'s default, deliberately kept in S-14 Phase 5) because
  `src/components/protocol/storage.ts:15-19` needs `createBrowserClient` to read the JWT out of
  `document.cookie`: the issue-protocol island uploads photos **straight to Supabase Storage**, since
  the Worker cannot proxy image bytes (10 ms CPU cap, body limits). So any successful XSS reads the
  session token directly rather than merely riding the cookie — and with no CSP, nothing narrows the
  injection surface that would get it there.
- **Scope:** Two independent gaps that multiply. No known injection point today (Astro and React both
  escape by default, and S-14 closed the one place attacker-supplied text reached a styled alert —
  F6, `?error=` is now a closed code whitelist).
- **Decision:** Deferred; own slice. Both were explicitly out of scope for S-14.
- **If it ever needs fixing:** CSP first — it is additive and needs no app redesign (mind Astro's
  inline styles/scripts and the Google Fonts origins). Flipping the cookies to `httpOnly: true` is
  **not** a flag flip: it breaks the direct-to-Storage upload path, so the prerequisite is another
  way to authorize that upload — most likely a short-lived signed upload URL minted server-side in an
  admin-gated route. Do that first, then flip.
