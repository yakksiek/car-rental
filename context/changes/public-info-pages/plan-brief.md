# Public Info Pages (O nas / FAQ / Cennik) + Shell Redesign — Plan Brief

> Full plan: `context/changes/public-info-pages/plan.md`
> Design contract: `context/changes/public-info-pages/design-contract.md`
> Canonical source (fetched live at implement): Claude Design `352d78a6-…` → `info-pages.jsx` (see plan.md §Design source)

## What & Why

Three public info pages — **O nas** (`/about`), **FAQ** (`/faq`), **Cennik** (`/pricing`) — ported at exact fidelity from the code-backed Claude Design source, plus a redesign of the shared public shell (header/footer/mobile nav) to match. Gives the site the informational surface (roadmap **S-09**) it lacks: who we are, how renting works, and what it costs — with the price table driven live from the catalog so it can't drift.

## Starting Point

The public shell is minimal (`SiteHeader` = Start/Flota, single-column `SiteFooter`), and `/about`, `/faq`, `/pricing` don't exist. Pricing already lives per-vehicle in the catalog (`listVehicles`, `getCategoryCounts`, `formatPln`); the hero photo and Brand mark are already in the repo.

## Desired End State

A visitor browses three faithful pages inside a redesigned shell (5-link pill nav + phone + `Zarezerwuj` CTA, 3-column contact footer, animated mobile phone-reveal). Cennik shows live per-category "od" rates; About shows the live fleet count; FAQ is a native single-open accordion with the design's faded ghost numbers. Existing pages inherit the new shell with no regressions.

## Key Decisions Made

| Decision        | Choice                                                                 | Why                                                                              | Source         |
| --------------- | ---------------------------------------------------------------------- | -------------------------------------------------------------------------------- | -------------- |
| Cennik pricing  | **Hybrid** — live rate table, static marketing chrome                  | Its length-discount ladder / "from" prices don't exist in our per-vehicle schema | Plan (Q1)      |
| Rate-table rows | Our **5 categories**, `od` MIN daily/monthly                           | Truthful to the catalog; matches the "Ceny netto, od" framing                    | Plan (Q1)      |
| Live vs static  | Rate table + About fleet count live; **everything else static copy**   | Fixes the two numbers that visibly drift; keeps scope tight                      | Plan (Q2)      |
| Shell           | **Full redesign** to `InfoHeader`/`InfoFooter` (+ mobile phone-reveal) | Pages must render in a shell that matches their designs                          | Plan (Q shell) |
| FAQ toggle      | **Native `<details>`** (CSS-only, single-open, ghost numbers)          | No island; matches project idiom; user preference                                | Plan (Q4)      |
| Content         | Port design copy **verbatim**; user fact-checks                        | The source already has all 10 FAQ answers + contact block                        | Plan (Q3)      |
| Mock sync       | Ship a **Claude Design update brief** for the Cennik table             | Keep mock ↔ build in sync so the vision-diff converges                           | User ask       |

## Scope

**In scope:** `/about`, `/faq`, `/pricing`; redesigned `SiteHeader`/`SiteFooter`/`MobileNav`; new `--flota-ink-deep` token; shared icon set; `getCategoryPricing` read path; live About fleet count; mock-update brief; foundation-doc sync.

**Out of scope:** pricing data-model changes (length tiers / globals stay static copy); `/kontakt` + rental-term pages (links wire to `/about#kontakt` and `/pricing`); `LandingNav`; React islands; new fonts; dark theme.

## Architecture / Approach

Static Astro pages over a shared, redesigned shell, with a **narrow live-data seam**: `getCategoryPricing()` (a pure reducer over `listVehicles`) feeds Cennik's table; `getCategoryCounts().total` feeds About's count. Both interactions (accordion, phone-reveal) are **CSS-only**, so no client JS ships. Colors resolve to `global.css` tokens (one new `--flota-ink-deep`); exact values and verbatim Polish copy are **fetched live from Claude Design at implement** (`info-pages.jsx`) rather than stored in the repo.

## Phases at a Glance

| Phase             | Delivers                                                | Key risk                                                                          |
| ----------------- | ------------------------------------------------------- | --------------------------------------------------------------------------------- |
| 1. Shell redesign | New header/footer/mobile-nav across the site            | Regression on existing pages (fleet/detail/reserve/`/r`) — guarded by vision-diff |
| 2. O nas          | Static About + live fleet count                         | Live-count fallback when Supabase unset                                           |
| 3. FAQ            | Native CSS accordion + ghost numbers                    | Single-open + open/close animation without JS                                     |
| 4. Cennik         | Static chrome + live per-category rate table            | Money-as-string handling; empty-category/empty-fleet states                       |
| 5. Finalize       | Cross-links, catalog sync, mock brief, full vision-diff | Mock still shows curated types until re-exported                                  |

**Prerequisites:** none unmet — all assets, copy, specs, tokens in hand. **Estimated effort:** ~1–2 autonomous sessions across 5 phases (P1 + P4 are the heaviest).

## Open Risks & Assumptions

- Design business-facts (kaucja 1 500, 300 km / 0,50 zł, wiek 21, contact details) are the designer's — **user fact-checks before launch** (non-blocking for build).
- **Design source is fetched live, not stored in-repo** (user decision). The exact values + copy that only exist in the design (notably FAQ answers Q2–Q10, absent from the JPG mockups) depend on `DesignSync` reaching the mutable Claude Design project at implement — pull it in an authenticated session and reconcile if the mock has drifted from `design-contract.md`.
- Native `<details name>` single-open needs a modern browser (2024+); older browsers get non-exclusive open (graceful).
- Cennik vision-diff shows a table-rows deviation until the mock is re-exported per the brief (expected, recorded).

## Success Criteria (Summary)

- `/about`, `/faq`, `/pricing` render faithfully at desktop + mobile; rendered vision-diff empty except the 17 recorded deviations.
- Cennik table = live `MIN(daily)/MIN(monthly)` per active category; About count = live active-vehicle total.
- No regressions on existing pages under the new shell; build + lint + `astro check` + unit tests green.
