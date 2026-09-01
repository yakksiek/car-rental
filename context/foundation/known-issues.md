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

## FIXED (S-12b): "Wnioski" nav badge read 0 on `/dashboard/protocols/[id]`

- **Symptom:** The staff sidebar's **Wnioski** count badge disappears on the protocol detail route
  and only there. Open `/dashboard/reservations` with pending requests → sidebar shows `Wnioski ②`;
  click into any protocol (`/dashboard/protocols/<id>`) → the ② vanishes although both requests are
  still pending; navigate anywhere else → it returns. The **Zwroty** badge beside it stays correct
  throughout, which is what makes the gap visible. Found 2026-08-24 while researching
  `staff-quick-actions`.
- **Cause:** `StaffShell` does not compute the count — every page fetches it and passes it in
  (`StaffShell.astro:21` declares `pendingCount?: number`, `:32` defaults it to `0`, `:40` binds it
  to the nav row, `:99` / `:196` render the badge only when `> 0`). Nine of the ten staff pages pass
  it; `src/pages/dashboard/protocols/[id].astro:118-126` passes `active`, `title`, `user`, `role`,
  `overdueCount` and `showHeader` — but **not `pendingCount`** — so the `= 0` default silences the
  badge. S-07 added `overdueCount` to this route (see its comment at `:32-33`, "this route
  previously passed no nav badge at all") and fixed only the badge that slice cared about.
- **Scope:** One route, cosmetic-but-misleading: the badge reads as _zero pending_ rather than as
  _unknown_, and it is the app's only ambient "work is queued" signal. No data or auth impact.
- **Decision:** **Not fixed ad hoc — deliberately deferred to planning.** The one-line repair (fetch
  `listPendingReservations` and pass `.length`) would add a third duplicated per-page fetch, and
  nine pages already call that RPC **only** to read `.length` off full reservation rows. The better
  shape is a `count_pending_reservations` RPC mirroring the existing `count_overdue_returns`
  (`src/lib/services/protocols.ts:385-395`), which pays back on every staff page. That decision
  belongs to `context/changes/service-read-projections/`, so this is recorded here rather than
  patched in isolation.
- **If it ever needs fixing sooner:** passing `pendingCount={…}` on `protocols/[id].astro` is a
  correct standalone fix and does not block the RPC work later.
- **Fixed 2026-08-24** in `staff-quick-actions` Phase 3, by exactly that standalone route: the page
  now fetches `listPendingReservations` alongside `countOverdueReturns` and passes
  `pendingCount={pending.length}`. Verified rendering `Wnioski 2` on `/dashboard/protocols/<id>`
  with two pending requests. The tenth duplicated `.length` read this adds is deliberate — it keeps
  the badge honest today and is replaced together with the other nine by the
  `count_pending_reservations` RPC in `context/changes/service-read-projections/`.

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

## The auth link journey depends on `auth.one_time_tokens`, a GoTrue-internal table

- **Symptom (if it ever fires):** every invite and recovery link lands on
  `/auth/forgot-password?expired=1` ("Link wygasł") immediately after a GoTrue upgrade, for
  everyone — including links minted seconds earlier.
- **Cause:** `invite-journey-fixes` moved the token exchange off the `/auth/callback` GET and onto
  the set-password POST, so the link becomes idempotent and no session is minted before a password
  exists. To keep the R14 role refusal ("Konto jest nieaktywne") running _before_ the form, the GET
  resolves the link's target through `public.resolve_link_token`, which reads
  `auth.one_time_tokens` — a **GoTrue-internal table with no stability contract**. The app now
  depends on its `token_hash`, `token_type` and `user_id` columns, and on
  `auth.users.confirmation_sent_at` / `recovery_sent_at` for the expiry window (the token table has
  **no** expiry column, and GoTrue deletes a token on _use_, not on expiry).
- **Scope:** Probed against **GoTrue v2.188.1 on 2026-08-20/21**: the `hashed_token` the admin
  `generateLink` API returns is byte-identical to `token_hash`; an invite's `token_type` is
  `confirmation_token` (shared with signup, exactly as `verifyOtp` treats them) and a recovery's is
  `recovery_token`; both `*_sent_at` columns land within ~8ms of the token row's `created_at`. That
  is when the assumption was last true.
- **Decision:** Accepted, because the function **fails closed** — no row means refuse — so a GoTrue
  change that renames or restructures these columns breaks the **role gate**, not the flow: the
  symptom is a refused link, never an open one. `tests/integration/resolve-link-token.test.ts` holds
  every clause against real GoTrue-minted tokens, so an upgrade that moves the ground reds the suite
  before it reaches production. If it does fire, the fix is to re-probe the table and update the
  migration's clauses — not to loosen them.

## A demo visitor can change the published demo password (`demo-account-gate`)

- **Symptom:** Signed in as the demo admin, `supabase.auth.updateUser({ password })` **succeeds**.
  The sign-in card keeps publishing the old password, so the first visitor who changes it locks out
  every later visitor — silently, with nothing surfacing the failure. Probed and confirmed against
  local Supabase 2026-08-28 during `demo-account-gate` Phase 2.
- **Cause:** Two layers, and neither is ours. `[auth.email] secure_password_change = false` in
  `supabase/config.toml` means no reauth is required; more fundamentally the call goes straight to
  GoTrue with no Postgres involved, so neither the `profiles` write policies nor the `demo` arm of
  `deactivate_staff` (`20260828140000_demo_account_write_gate.sql`) is on the path. Gating the app's
  own change-password route would not help either: the credentials are published by design and the
  publishable anon key is serialized into the page HTML on the protocol screens
  (`dashboard/pickups/[reservationId].astro`), so a visitor can call GoTrue directly with `curl`.
- **Scope:** Production only, and only once a prod demo account exists — it does not yet. Local and
  CI are unaffected (`demo@fleetrent.test` is reseeded by `supabase db reset`). Blast radius is the
  demo itself: an attacker gains nothing they did not already have as the published admin, they can
  only deny the demo to others. The three staff mutations stay gated regardless.
- **Decision:** Open, not fixed. The nominal home was `demo-account-gate` Phase 4's nightly reset,
  and **Phase 4 was dropped 2026-08-28**, so it is re-homed here rather than lost.
- **A fix exists and was spike-verified 2026-08-28** — a `BEFORE UPDATE` trigger on `auth.users`
  that reverts `encrypted_password` when the row's profile has `is_demo`, which sits _underneath_
  GoTrue where RLS cannot reach:

  ```sql
  if new.encrypted_password is distinct from old.encrypted_password
     and exists (select 1 from public.profiles p where p.user_id = old.id and p.is_demo) then
    new.encrypted_password := old.encrypted_password;
  end if;
  ```

  Measured: GoTrue reports success, the hijack password does not work, the published one still
  signs in, and a non-demo control user changes password normally. Two costs before adopting it —
  it blocks the **service-role** admin API too (rotation then needs `is_demo` toggled off and back,
  or a `set_config` escape hatch), and it would be this repo's first trigger on the Supabase-owned
  `auth` schema. Provisioning is unaffected provided the account is marked `is_demo` last, which the
  prod runbook already requires for a separate reason.

## Demo visitors mutate live data with no reset path (`demo-account-gate`)

- **Symptom:** Every visitor who signs in with the published demo credentials leaves real rows
  behind — reservations, protocols, decided requests, edited vehicles. Nothing removes them. Over
  months the cockpit fills with strangers' leftovers instead of the designed flow. Added 2026-09-01
  by the `demo-account-gate` impl-review (F6); the risk itself was accepted when Phase 4 was
  dropped 2026-08-28, but lived only inside that plan's dropped-phase block, which archiving would
  have taken out of the durable register.
- **The sharper half, not previously recorded:** it is not confined to the staff cockpit. Verified
  against the catalog 2026-09-01 — `vehicles_update_staff` lets any staff caller (demo included)
  `UPDATE` any vehicle, and `vehicles_select_anon` is `using (is_active = true)`. So a visitor can
  set every vehicle inactive and **empty the public catalog**, the half of the portfolio that does
  not sit behind auth. `set_vehicle_active` is a demo-callable `SECURITY DEFINER` RPC as well, so
  dropping the policy alone would not close it.
- **Scope:** Production only, and live — the demo card renders on
  `fleetrent.marcin-kulbicki.workers.dev/auth/signin` with working credentials. Local and CI are
  unaffected (`supabase db reset` reseeds). The three gated staff mutations and the
  `/api/reservations/manual` mail relay (impl-review F1) stay refused regardless.
- **Decision:** Open, accepted. The nominal fix was `demo-account-gate` Phase 4 (a nightly
  `reset_demo_data()` RPC behind a cron-triggered route), **dropped 2026-08-28** on the grounds that
  a scheduled endpoint truncating business tables is not worth building for rot nobody has observed.
  That trade still holds; this entry exists so the accepted risk is findable when it stops holding.
- **Cheaper mitigations if it bites before Phase 4 is revived:** gate the demo account out of
  `set_vehicle_active` and the `vehicles` write policies (leaving the fleet read-only for demo,
  which protects the public catalog without any scheduled job) — that is the narrow slice of
  impl-review F4 that matters most here. A manual `supabase db reset`-equivalent against prod is
  NOT an option: it would drop the demo account and the owner's admin account with it.

## Queued: return-damage auto-tag matches on typed free text, not a stable id

- **Symptom:** On the return protocol, the existing/new classification suggested for each damage row
  silently stops suggesting anything when the wording of a damage's `location` / `size` changes
  between pickup and return — every pre-existing scratch then defaults to **new**. Reproduces today
  with nothing exotic: the employee types `lewy tylny zderzak` at pickup and `lewy tylny zderzak.`
  (trailing full stop) at return, or rewords it to `tylny lewy zderzak`. Found 2026-09-01 while
  framing `english-localization`.
- **Cause:** `src/lib/protocol-delta.ts:128-133` — `autoTagDamages` finds a baseline row by exact
  equality on `type` + `normalize(location)` + `normalize(size)`, and `normalize` (`:110`) only
  lowercases, collapses internal whitespace and trims. It does **not** strip punctuation or tolerate
  reordering. Both fields are free text an employee types at the counter (`DamageEditor.tsx:255`,
  placeholder `np. lewy tylny zderzak`), so the join key is a human sentence, not an identity.
- **Scope:** Suggestion quality only — **not** a billing or persistence error. The contract is stated
  in both the matcher (`protocol-delta.ts:114-119`) and its wrapper (`return-form.ts:55-61`): _"A
  **suggestion only**: the employee's override on the form is the persisted value."_
  `ReturnProtocolForm.tsx:248,318,338` persists whatever `baselineDamageId` the employee confirms per
  row, so a human sits between a bad suggestion and the customer. The consequence is that correctness
  falls entirely on the employee re-tagging each row by hand — and prefilled defaults do get accepted.
  Downstream of a wrong confirmation: `computeReturnDeltas` (`:80`) → `newDamageCount` /
  `damageAdverse` → the return PDF comparison section (`protocol-pdf.ts:245-252`) and the customer's
  email (`templates.ts:341`).
- **Decision:** Open, queued. Deliberately **excluded from `english-localization`** — it is a
  pre-existing weakness, worth fixing on its own schedule and not gated on a second language.
- **The i18n interaction, for whoever picks this up:** a locale switch makes the failure total rather
  than occasional. Pickup in Polish (`lewy tylny zderzak`) and return in English (`left rear bumper`)
  match on nothing, so _every_ row defaults to `new`. Fixing the join key removes that hazard as a
  side effect, which is why `english-localization` records it but does not own it. See
  `context/changes/english-localization/frame.md` → Cross-System Convention.
- **To action:** `/10x-new return-damage-stable-tagging`. Fix direction: carry the baseline damage's
  `id` on the return draft row rather than re-deriving a match from strings — the baseline list
  already exposes `id` (`AutoTagBaselineDamage`, `protocol-delta.ts:95-100`), so the identity exists
  and is simply not used as the key. Keep the string match only as a fallback for rows with no
  carried id. Add a unit case per failure mode (punctuation, reordering, cross-language) to
  `src/lib/protocol-delta.test.ts`.

## `HeaderContactToggle` phone mode wraps the nav and grows the public header 22px (tablet)

- **Symptom:** On every public page **except the landing page**, at tablet widths, tapping the phone
  segment of the header's contact/booking toggle breaks the header: the active nav pill's label
  **"O nas" wraps onto two lines**, deforming the pill into a lopsided circle, and the header bar
  grows from **86px to 108px** (nav 50px → 72px). At the same time the `Zarezerwuj` CTA collapses to
  a bare, unlabelled calendar icon — which is what reads as the action button "disappearing".
- **Measured (2026-09-01, dev, Playwright sweep at 2px steps):** affected widths are **768–790 and
  840**. In book mode the row has 19px slack at 768; switching to phone mode takes it to **−10px**.
  The toggle itself grows **183px → 227px** (`HeaderContactToggle.tsx` `revealWidth` 112 → 150).
  800–820 survives only because `SiteHeader.astro:57`'s `min-[840px]:px-[18px]` drops nav padding to
  13px below 840 — which is also why exactly **840** fails while 860+ does not.
- **Cause:** `SiteHeader.astro:41` is a `justify-between` flex row with **no `gap`, no `min-w-0`, no
  `truncate`, no `flex-1`**, and the nav links carry **no `whitespace-nowrap`** (the design's
  `info-nav-pill` does). So when the toggle expands, the only thing that can give is the nav text.
- **Why the landing page is immune:** `LandingNav.astro:105-175` renders its own tablet band with a
  **static** toggle — two direct links (`tel:` + `/fleet`), no mode switching, no reveal animation —
  and a **4-item** nav (`:115`, `nav.slice(0, 4)` drops "O nas"). Measured stable at 182px wide and
  49px tall across 768–1023. Confirms this is a `SiteHeader`-only defect.
- **Scope:** Live on the deployed portfolio; reachable by any visitor on a tablet who taps the phone
  icon on `/fleet`, `/pricing`, `/faq`, `/about`, `/reserve`, `/r/[token]`.
- **Decision:** Do **not** patch in place. `english-localization` **Phase 3 deletes
  `HeaderContactToggle` entirely** and replaces it with the design's `ActionMenu` — a fixed **40px**
  icon trigger that opens a popover and never expands in-flow — so the failure mode is removed by
  construction rather than papered over. Phase 3 also moves the header to container queries and adds
  the always-visible `LangToggle`, so the whole row is re-specified at once.
- **If it must be fixed sooner** (independently of i18n): add `whitespace-nowrap` to the nav links and
  `min-w-0` to the flex children in `SiteHeader.astro`, and cap the phone `revealWidth`. That stops
  the wrap but leaves the row over budget at 768 — the real fix is the design's collapse.
- **Evidence:** `context/changes/english-localization/design-review/bug-siteheader-768-phonemode.png`
  (wrapped) and `bug-siteheader-820-phonemode.png` (same state, width that survives).

## Landing header hides the phone number across a 256px band (1024–1279) — and it would fit from 1136

- **Symptom:** On the **landing page only**, the phone number is absent from the header at viewport
  widths **1024–1279px**. There is no phone affordance of any kind in that band: `1264px` — a common
  laptop content width — shows brand + 5-link nav + "Przeglądaj flotę" and nothing else, with a wide
  empty gap where the number belongs. Below 1024 the tablet band carries a phone icon; below 768 the
  mobile row carries it; at 1280+ the desktop pill shows the full number. Only lg–xl is dead.
- **Inconsistent with the rest of the site:** at the _same_ 1264px, every `SiteHeader` page
  (`/fleet`, `/pricing`, `/faq`, `/about`) shows the number — `SiteHeader` reveals it from `lg`
  (1024), `LandingNav` defers it to `xl` (1280). Same viewport, same site, opposite answer, on the
  one page a customer is most likely to be looking for a phone number.
- **Cause:** `LandingNav.astro:74` marks the phone text-block `xl:flex`. The comment at `:18-21`
  justifies this as _"the 5-link nav + logo + CTA fit, but nav + phone + CTA together do not"_ — true
  below ~1136, **not** true up to 1280.
- **Measured (2026-09-01, dev, Playwright, 8px steps):** the pill is `grid-cols-[1fr_auto_1fr]`; it
  spans `left-8 right-8` with `pl-[14px] pr-[22px]`, so the side column is `(vw − 100 − navW) / 2`
  with `navW = 393px` (5 links). The right cluster needs **322px** (CTA 154 + phone 148 + `gap-5`
  20). The column reaches 322px at **vw ≥ 1136**. So the phone genuinely does not fit at 1024–1135,
  but **144px of the suppression (1136–1279) is unnecessary** — the `xl` cutoff is a rounding to the
  nearest Tailwind breakpoint, not the measured one.
- **Do not "just lower it to `lg`".** That reintroduces a real overflow at 1024–1135. The measured
  cutoff is ~1136, which has no Tailwind breakpoint — it needs an arbitrary `min-[1136px]:` or a
  container query, which is what the design uses anyway.
- **Phase 3 makes this worse before it makes it better — plan for it.** `english-localization`
  Phase 3 adds an always-visible `LangToggle` (**75px**, measured) to this same right cluster. With
  its `gap-5`, the cluster grows 322px → **417px**, which the side column only reaches at
  **vw ≥ 1327**. Naively adding the toggle would therefore _widen_ the dead band from 1024–1279 to
  **1024–1326**. `LandingNav`'s desktop pill has no collapse mechanism today; the design's answer for
  `InfoHeader` (collapse phone + CTA into one `ActionMenu`, keep `LangToggle` visible at every width)
  is what resolves it, and Phase 3 must port that collapse to the landing fork rather than only to
  `SiteHeader`.
- **Scope:** Live on the deployed portfolio. Landing page, 1024–1279px.
- **Decision:** Open — owned by `english-localization` Phase 3, because the fix and the regression
  share the same line of code. Not worth a standalone patch first.
- **Evidence:** `context/changes/english-localization/design-review/bug-landing-1264-no-phone.png`,
  `bug-landing-1136-would-fit.png`, `bug-landing-1280-phone-returns.png`.
