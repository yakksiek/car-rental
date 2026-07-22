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
