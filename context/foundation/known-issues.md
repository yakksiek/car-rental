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
