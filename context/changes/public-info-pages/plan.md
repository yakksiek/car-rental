# Public Info Pages (O nas / FAQ / Cennik) + Shell Redesign — Implementation Plan

## Overview

Add three public informational pages — **O nas** (`/about`), **FAQ** (`/faq`), **Cennik** (`/pricing`) — ported at exact fidelity from the code-backed Claude Design source (`info-pages.jsx`), and redesign the shared public shell (`SiteHeader` / `SiteFooter` / `MobileNav`) to the design's `InfoHeader` / `InfoFooter` (5-link pill nav + phone + `Zarezerwuj` CTA, 3-column contact footer, animated mobile phone-reveal). The pages are static Astro over the shell with a **narrow live-data seam**: Cennik's rate table and About's fleet-count stat come from the catalog; everything else is static marketing copy.

This plan is written to be executed **autonomously, end-to-end, with no mid-implementation questions**. Assets, decisions, the token map, and the deviations register are resolved in-repo (`design-contract.md`); the **exact per-element values and verbatim Polish copy are fetched live from Claude Design at implement time** (see **Design source** below).

## Design source (fetched live at implement)

The code-backed source is **not** stored in the repo — pull it at the start of each phase with `DesignSync get_file` from project `Rental car company` (`352d78a6-84fd-49a2-8b38-2fe289691fc3`):

| File                   | What to extract                                                                                                                                                                                                                                                                | Used by |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------- |
| `info-pages.jsx`       | `InfoHeader` / `InfoHeaderMobile` / `InfoFooter` (shell); `AboutBody` / `FaqBody` / `PricingBody`; constants `RENT_TIERS`, `PRICE_ROWS`, `INCLUDED`, `FAQS` (all 10 Q&A), `STATS`, `FLEET_ITEMS`, `VALUES`; atoms `Eyebrow`/`Hero`/`Section`/`H2`; `INKD=#141B2D`, `WRAP=1180` | P1–P4   |
| `customer-desktop.jsx` | `ScreenMobileHome` → the `phoneOpen` mobile phone-reveal button (widths + transition timings)                                                                                                                                                                                  | P1      |
| `shared.jsx`           | `tokens` (design→app token values), `Icon.plus`/`chevD`/`arrowRight` SVG paths, `FlotaMark`                                                                                                                                                                                    | P1      |

Do **not** import any of this as app code (`design-system.md` / CLAUDE.md rule) — re-author in our idioms, porting the exact values. `design-contract.md` holds the token map, all deviations, and the load-bearing values transcribed at plan time as the **offline fallback** for styling; the **verbatim copy** (notably FAQ answers Q2–Q10, which are not legible in the JPG mockups) comes from the live `FAQS` pull. If the run lacks claude.ai design scope, pull the source in an authenticated session (or ask the user) before building — the JPG mockups alone do not carry that copy.

## Current State Analysis

- **Shell**: `Layout.astro` is title-only; each page composes its own `SiteHeader` + `SiteFooter`. Current `SiteHeader.astro:24` nav = `[Start, Flota]`; `MobileNav.tsx:21` mirrors it (with a Home/Truck icon ternary at `:97`); `SiteFooter.astro:23` is a hardcoded single-column nav (`Start / Flota / Strefa pracownika`). `active` union `"home" | "fleet"` is declared in `SiteHeader.astro:19`, `MobileNav.tsx:18`, `LandingNav.astro:18`. `LandingNav` is a landing-only fork and stays untouched.
- **Content-page pattern**: `fleet/index.astro:107` — `<Layout><SiteHeader/><main class="max-w-app mx-auto px-5 pb-16 sm:px-8">…</main><SiteFooter/></Layout>`. No prose/typography system, no `@tailwindcss/typography`, no reusable `Section`/`Container`.
- **Pricing data**: `src/lib/services/vehicles.ts:38` `listVehicles(client, filters)` (public, `is_active=true`, PII-safe) and `:106` `getCategoryCounts(client)` (`{ total, byCategory }`). Rate fields on `Vehicle` (`src/types.ts`): `daily_rate`, `monthly_rate`, `deposit`, `per_extra_km_rate` (all `numeric(10,2)` → **strings at runtime**, `src/types.ts:11-14`), nullable `km_limit`. Formatter `formatPln(string|number)` at `src/lib/format.ts:33`; `categoryLabelPl` at `:154` (Furgon / Bus osobowy / Autolaweta / Chłodnia / Skrzyniowy).
- **Assets**: `src/assets/hero-airfield.jpg` already in repo (imported at `index.astro:19` via `astro:assets`). Brand mark = `src/components/brand/Brand.astro`.
- **Tokens**: `src/styles/global.css` — full crimson/navy/grey token set. No token for the design's dark-navy `#141B2D`.

## Desired End State

Visiting `/about`, `/faq`, `/pricing` renders three pixel-faithful pages inside a redesigned shell shared across the whole public site. The nav (desktop pill + mobile hamburger + footer) links all five destinations. Cennik shows live per-category "od" rates; About shows the live fleet count; the FAQ is a native single-open accordion with the exact ghost-number treatment. All existing public pages (fleet, detail, reserve, `/r`) inherit the new shell without regressions. Verify: `npm run build` + `astro check` clean; the live rate table matches `MIN(daily_rate)`/`MIN(monthly_rate)` per category; rendered vision-diff against the `design-review/` JPGs is empty except recorded deviations.

### Key Discoveries

- The design source is code-backed and **complete** — all 10 FAQ answers, contact block, and per-element values are in the live `info-pages.jsx` (see **Design source**). Port, don't invent.
- Cennik's pricing model (length-discount ladder, fleet-wide "od", curated types) does **not** map to our per-vehicle schema → **hybrid**: only the rate table + fleet count are live; the rest is static marketing copy (all recorded deviations in `design-contract.md`).
- Both interactions (FAQ accordion, mobile phone-reveal) are achievable **CSS-only** → info pages stay static Astro, no React islands.
- Money columns deserialize as **strings** — the live table must route every value through `formatPln`, never `.toFixed()`.

## What We're NOT Doing

- No pricing data-model changes (no length-tier table, no global-settings table, no net/gross flag) — the discount ladder and global values stay static copy.
- No `/kontakt` page, no rental-term landing pages — footer links wire to `/about#kontakt` and `/pricing`.
- No `LandingNav` change (landing keeps its immersive fork); no new webfonts; no dark-theme work.
- No React islands for these pages; no per-vehicle rows on Cennik (per-category `od` only).
- No authoring of new copy — design copy is canonical; the user's fact-check is a separate, non-blocking launch gate.

## Implementation Approach

Shell first (P1) so all pages — new and existing — share the redesigned `SiteHeader`/`SiteFooter`/`MobileNav`; its vision-diff doubles as the regression gate for existing pages. Then the three pages in ascending data-complexity: O nas (P2, one live count), FAQ (P3, CSS accordion), Cennik (P4, the live per-category table via a new pure reducer). P5 wires cross-links, syncs the roadmap/design-system catalog, ships the mock-update brief, and runs the full vision-diff.

## Critical Implementation Details

- **Money-as-string**: `getCategoryPricing` must compare rates numerically (`Number(v)`) but hand the winning **raw** value (or the number) to `formatPln` — never call `.toFixed()`/assume `number` (`src/types.ts:11-14`).
- **CSS-only single-open FAQ**: use `<details name="faq">` (shared `name` = exclusive accordion, modern browsers). Ghost-number color + toggle rotate animate via `details[open]` selectors; optional open/close height animation via `::details-content` + `interpolate-size: allow-keywords` (progressive, degrades to instant).
- **Shared-shell width**: header/footer outer padding is `px-[48px]` (mobile `18–22px`), and **both** inner rows (header _and_ footer) cap at `max-w-[1180px] mx-auto` — the `48px` padding is the gutter floor below ~1276px. This holds the header logo, page body, and footer columns on one shared content edge at every viewport (the design canvas is ~1276px, where `48px` padding and the `1180` cap coincide). Do not force `max-w-app` on the shell. Existing pages keep their own `<main>` cap — unchanged.
- **Icons**: port the exact `II.*`/`Icon.*` SVG paths from the source into one shared inline-SVG set; do not substitute lucide (geometry differs).

---

## Phase 1: Shell redesign & navigation

### Overview

Rebuild the shared shell to `InfoHeader`/`InfoFooter`/mobile, add the two new nav destinations across all sites, and add the mobile phone-reveal. Existing pages inherit it.

### Changes Required:

#### 1. New dark-navy token

**File**: `src/styles/global.css`
**Intent**: Add the one color the design introduces that has no token, used by every dark surface across the three pages.
**Contract**: Add `--flota-ink-deep: #141B2D;` to the primitives block; expose as needed (`text`/`bg` via arbitrary `bg-[var(--flota-ink-deep)]` is acceptable, or add a `--color-ink-deep` theme entry). If the FAQ uses the `::details-content` enhancement, add the small base-layer CSS (`interpolate-size: allow-keywords` on `:root`, `details::details-content { transition… }`).

#### 2. Shared icon set

**File**: `src/components/icons/InfoIcons.astro` (or `.tsx` if reused in the island)
**Intent**: House the exact SVG paths the pages need so both Astro and the mobile island share one source.
**Contract**: Export/emit the `II.*` glyphs used (shield, gauge, spark, calendar, invoice, headset, van, bus, container, lift, crew, city, phone, mail, pin, clock, check) + `plus`, `chevD`, `arrowRight` — exact paths pulled from the live `info-pages.jsx` (`II.*`) and `shared.jsx` (`Icon.*`), 24-grid, `stroke-width 1.7`. Props: size, color, stroke-width.

#### 3. Header

**File**: `src/components/SiteHeader.astro`
**Intent**: Replace the 2-link pill header with the `InfoHeader` design; widen `active`.
**Contract**: `active?: "home" | "fleet" | "pricing" | "faq" | "about"`. Nav array gains `pricing`→`/pricing`→`Cennik`, `faq`→`/faq`→`FAQ`, `about`→`/about`→`O nas`; `fleet` label stays `Flota`. Layout, pill styling, phone block, and `Zarezerwuj` CTA (→`/fleet`) per `design-contract.md` §Shell. Reuse `Brand`.

#### 4. Mobile header + overlay

**File**: `src/components/MobileNav.tsx`
**Intent**: Match `InfoHeaderMobile` (phone-reveal + hamburger) and list all 5 links in the overlay.
**Contract**: Widen `active` union to match §3. Overlay lists 5 items (text + a lucide icon each — replace the Home/Truck ternary with an explicit id→icon map). Add the **phone-reveal** control (port the `phoneOpen` button from the live `customer-desktop.jsx` `ScreenMobileHome`; CSS-driven width/opacity transitions; `aria-label="Pokaż numer telefonu"`; revealed number is a `tel:+48221002030` link). Keep Escape-close, scroll-lock, `aria-label="Menu"`/`"Zamknij menu"`.

#### 5. Footer

**File**: `src/components/SiteFooter.astro`
**Intent**: Replace the single-column footer with the 3-column contact footer.
**Contract**: Brand + tagline; columns WYNAJEM (4 items → `/pricing`), INFORMACJE (`O nas`/`Cennik`/`FAQ`→routes, `Kontakt`→`/about#kontakt`), KONTAKT (tel/mailto/address/`Czynne 24/7`); bottom `© 2026 Flota. Wszelkie prawa zastrzeżone.` Inner row `max-w-[1180px]`. Copy + wiring per `design-contract.md` §Shell (incl. the recorded removal of `Strefa pracownika`).

### Success Criteria:

#### Automated Verification:

- Lint passes: `npm run lint`
- Types/Astro check passes: `npx astro check`
- Production build succeeds: `npm run build`
- No `@/` local imports introduced (ESLint `no-restricted-imports` green)

#### Manual Verification:

- Header/footer render on `/fleet`, `/fleet/[id]`, `/reserve`, `/r/[token]` with no layout regression. **Baseline first**: as the opening P1 step (before touching the shell), capture these four pages at desktop + mobile on `main` into `design-review/regression-baseline/`; the regression check then diffs the post-redesign render against those committed shots, not an implied prior.
- Mobile phone-reveal expands/collapses on tap; number dials; hamburger overlay lists 5 links, closes on Escape.
- Vision-diff of the redesigned header/footer vs `design-review/` matches (recorded deviations aside).

---

## Phase 2: O nas page (`/about`)

### Overview

Build the static About page (hero, stats with live count, narrative + photo, fleet list, values, contact card) over the new shell.

### Changes Required:

#### 1. About page

**File**: `src/pages/about.astro`
**Intent**: Port `ScreenAboutDesktop/Mobile` verbatim; wire the one live datum and the hero photo.
**Contract**: `<Layout title="O nas — Flota"><SiteHeader active="about"/>…<SiteFooter/></Layout>`, content capped at `max-w-[1180px]`. Sections + verbatim copy per `design-contract.md` §O nas and the live `info-pages.jsx` `AboutBody`. Stats band: `pojazdy we flocie` = `getCategoryCounts(Astro.locals.supabase).total` (fallback `—` when null); other three static. Narrative photo: `import heroImg from "../assets/hero-airfield.jpg"` + `astro:assets` (`Picture`/`Image`, cover, `rounded-[22px]`, `alt=""`) mirroring `index.astro`. Give the contact section `id="kontakt"`; `Zarezerwuj pojazd →` and both CTAs → `/fleet`; phone/email as `tel:`/`mailto:`.

### Success Criteria:

#### Automated Verification:

- `npm run lint` · `npx astro check` · `npm run build` all pass
- `/about` responds 200 in `npm run preview` (or dev)

#### Manual Verification:

- Live "pojazdy we flocie" equals the active-vehicle count; falls back to `—` with Supabase unset.
- Rendered vision-diff (desktop + mobile) vs `design-review/o nas *.jpg` matches (deviations aside).

---

## Phase 3: FAQ page (`/faq`)

### Overview

Native single-open accordion with the exact ghost-number treatment, 10 Q&A verbatim, and the CTA banner — CSS-only.

### Changes Required:

#### 1. FAQ page

**File**: `src/pages/faq.astro`
**Intent**: Port `ScreenFaqDesktop/Mobile` as a native `<details>` accordion.
**Contract**: Shell as P2 with `active="faq"`. Ten `<details name="faq">` items, verbatim Q + A from `FAQS`. Ghost number (absolute span, exact size/weight/offset/colors for open vs closed), content offset `188px`/`90px`, toggle circle plus→× (rotate 45°, fill/border swap on `[open]`), answer block — all exact per `design-contract.md` §FAQ. CTA banner `Masz inne pytanie?` with `Zadzwoń` (`tel:`) / `Napisz` (`mailto:`). First item may be `<details open>` to match the resting mockup. Scoped `<style>` for the ghost-number + `[open]` transitions (and optional `::details-content` height animation).

### Success Criteria:

#### Automated Verification:

- `npm run lint` · `npx astro check` · `npm run build` all pass
- `/faq` responds 200

#### Manual Verification:

- Opening one item closes the others (single-open); toggle animates +→×; ghost numbers fade/crimson-highlight correctly at both breakpoints.
- Works with JS disabled (native `<details>`).
- Vision-diff vs `design-review/faq *.jpg` matches (the mockup's one-open resting state; deviations aside).

---

## Phase 4: Cennik page (`/pricing`) — hybrid

### Overview

Static tier cards + benefits + info box; **live** per-category rate table via a new pure reducer.

### Changes Required:

#### 1. Per-category pricing read path

**File**: `src/lib/services/vehicles.ts`
**Intent**: Aggregate active vehicles into per-category "from" rates, reusing the existing public query.
**Contract**: `export async function getCategoryPricing(client): Promise<CategoryPricing[]>` where `CategoryPricing = { category: VehicleCategory; label: string; minDaily: number; minMonthly: number; count: number }`. Implement over `listVehicles(client, {})` (or a direct `is_active` select), reduce per category taking numeric `MIN` of `daily_rate`/`monthly_rate` (parse the string columns for the compare), attach `categoryLabelPl`, drop empty categories, return in canonical category order. `null` client → `[]`. Add unit tests (min logic, empty-category exclusion, null→[], string-rate parsing).

#### 2. Cennik page

**File**: `src/pages/pricing.astro`
**Intent**: Port `ScreenPricingDesktop/Mobile`; make only the rate table live.
**Contract**: Shell with `active="pricing"`. Tier cards (4), "W każdej cenie" (6), "Dobrze wiedzieć" box, CTAs → `/fleet` — **static, verbatim**. Rate table rows = `getCategoryPricing(Astro.locals.supabase)`: `od {formatPln(minDaily)}` / `od {formatPln(minMonthly)}` per category, category→icon map, exact table styling (header band, `2.4fr 1fr 1fr` desktop / stacked mobile). Empty/misconfigured → single fallback row `Cennik chwilowo niedostępny — zadzwoń: +48 22 100 20 30`. All money via `formatPln`.

### Success Criteria:

#### Automated Verification:

- `npm run lint` · `npx astro check` · `npm run build` all pass
- Unit tests for `getCategoryPricing` pass: `npm test`
- Integration test (service against local Supabase) passes if added: `npm run test:integration`
- `/pricing` responds 200

#### Manual Verification:

- Table rows equal `MIN(daily_rate)`/`MIN(monthly_rate)` per active category, `formatPln`-formatted (e.g. `od 219 zł`, `od 4 500 zł`); empty categories hidden; fallback row shows with Supabase unset.
- Vision-diff vs `design-review/prices *.jpg` matches (table-rows deviation expected until the mock is re-exported per the brief).

---

## Phase 5: Finalize — cross-links, catalog sync, vision-diff

### Overview

Wire remaining links, sync foundation docs, ship the mock-update brief, and run the full fidelity gate.

### Changes Required:

#### 1. Cross-link + fact-check pass

**File**: (touches P1–P4 outputs)
**Intent**: Confirm every nav/footer/CTA target resolves; surface the business-fact copy for the user's fact-check.
**Contract**: All internal links resolve (`/about`, `/faq`, `/pricing`, `/about#kontakt`, `tel:`/`mailto:`). Leave a short `design-review/content-factcheck.md` listing the design-sourced claims to verify (kaucja od 1 500, 300 km / 0,50 zł, wiek 21, `kontakt@flota.pl`, `Al. Jerozolimskie 200`, phone) — non-blocking.

#### 2. Foundation-doc sync

**File**: `context/foundation/design-system.md`, `context/foundation/roadmap.md`
**Intent**: Record the three new shipped surfaces and close the slice.
**Contract**: Add catalog rows 27–29 (Cennik / FAQ / O nas → this change, source `info-pages.jsx`); note the shell redesign superseding SiteHeader/SiteFooter/MobileNav. Flip roadmap S-09 `todo`→`done` on completion.

#### 3. Mock-update brief hand-off

**File**: `design-review/cennik-mock-update-brief.md` (already written)
**Intent**: Ensure the Cennik mock is re-exported to our 5 categories so the vision-diff converges.
**Contract**: Reference the brief; after the mock is updated, refresh `prices *.jpg`.

#### 4. Full rendered vision-diff gate

**Intent**: Compare all six rendered surfaces against the canonical JPGs.
**Contract**: Render each page at desktop + mobile, hand screenshot + mockup to a vision subagent, iterate the punch-list to empty minus the 17 recorded deviations in `design-contract.md`.

### Success Criteria:

#### Automated Verification:

- Full build + lint + `astro check` green: `npm run build && npm run lint && npx astro check`
- Unit + integration suites pass: `npm test` (and `npm run test:integration` if the service test was added)
- No broken internal links (grep/build check)

#### Manual Verification:

- Vision-diff across all six surfaces is empty except recorded deviations.
- `roadmap.md` S-09 = done; `design-system.md` rows 27–29 present.
- `content-factcheck.md` handed to the user.

---

## Phase 6: Post-implementation refinements

### Overview

Review-driven refinements to the shipped S-09 surfaces (shell + O nas / FAQ / Cennik), gathered after the initial build. The specific changes are filled in from the user's review feedback, then implemented like any other phase — each staying within the design contract (exact values; recorded deviations preserved).

### Changes Required:

#### 1. Remove the "Dostępny" availability badge from customer vehicle surfaces

**Files**: `src/components/vehicle/VehicleCard.astro`, `src/components/vehicle/LandingVehicleCard.astro`, `src/components/vehicle/VehicleDetail.astro`; delete `src/components/vehicle/StatusPill.astro`.
**Intent**: The badge always renders `available` → "Dostępny" (every listed/detail vehicle is bookable in-context — RLS hides inactive rows and the availability RPC excludes overlapping bookings; no surface ever passes `reserved`/"Zajęty"). It conveys nothing to the customer and clutters the cards.
**Contract**: Remove the `<StatusPill/>` render + its import from the catalogue card, the landing "Popularne" card, and the `/fleet/[id]` detail header (drop the empty wrapper `div` in the detail so no spacer is left). `StatusPill.astro` becomes orphaned (no importers; `ReservationStatusCard` only references it in a comment) → delete it. No behavioural/data change; purely a UI declutter.

### Success Criteria:

#### Automated Verification:

- `npm run lint` · `npx astro check` · `npm run build` all pass
- Existing unit tests still pass: `npm test`

#### Manual Verification:

- Each requested refinement is visibly applied
- Rendered vision-diff of every touched surface still matches the mockups (recorded deviations aside)

---

## Testing Strategy

### Unit Tests:

- `getCategoryPricing`: numeric `MIN` per category over string-typed rates; empty-category exclusion; `null` client → `[]`; canonical ordering.
- (Optional) a `formatPln` round-trip assertion on representative rates.

### Integration Tests:

- `getCategoryPricing` against local Supabase seed — rows match seeded active vehicles, inactive excluded.

### Manual Testing Steps:

1. Load `/about`, `/faq`, `/pricing` at 390px and ≥1440px; compare to `design-review/` JPGs.
2. FAQ: open each item — only one stays open; toggle + ghost-number states animate; works JS-off.
3. Mobile header: tap phone → number expands and dials; hamburger overlay lists 5 links.
4. Cennik: cross-check the table against DB rates; unset Supabase → fallback row; empty category hidden.
5. Regression: `/fleet`, `/fleet/[id]`, `/reserve`, `/r/[token]` still render correctly under the new shell.

## Performance Considerations

All pages SSR with one lightweight catalog read each (About: `getCategoryCounts`; Cennik: `getCategoryPricing` over the small active-vehicle set). No new client JS (CSS-only interactions). Keeps the ≤2 s page-load NFR comfortably.

## Migration Notes

None — no schema/data migration. `--flota-ink-deep` is additive. The shell redesign is behavioral/visual only; existing pages inherit it automatically (the P1 vision-diff is the regression guard).

## References

- Design contract: `context/changes/public-info-pages/design-contract.md`
- Canonical source (fetched live — see **Design source**): Claude Design project `352d78a6-84fd-49a2-8b38-2fe289691fc3` → `info-pages.jsx`, `customer-desktop.jsx`, `shared.jsx`
- Canonical screenshots: `context/changes/public-info-pages/design-review/{o nas,faq,prices} {desktop,mobile}.jpg`
- Mock-update brief: `context/changes/public-info-pages/design-review/cennik-mock-update-brief.md`
- Pricing service: `src/lib/services/vehicles.ts:38,106` · Formatters: `src/lib/format.ts:33,154` · Money-as-string: `src/types.ts:11-14`
- Shell edit sites: `SiteHeader.astro:19,24` · `MobileNav.tsx:18,21,97` · `SiteFooter.astro:23` · content-page pattern `fleet/index.astro:107`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Shell redesign & navigation

#### Automated

- [x] 1.1 Lint passes: `npm run lint` — deff00c
- [x] 1.2 Types/Astro check passes: `npx astro check` — deff00c
- [x] 1.3 Production build succeeds: `npm run build` — deff00c
- [x] 1.4 No `@/` local imports introduced (ESLint green) — deff00c

#### Manual

- [x] 1.5 Header/footer render on fleet/detail/reserve/`/r` with no regression (vision-diff) — deff00c
- [x] 1.6 Mobile phone-reveal expands/dials; hamburger overlay lists 5 links, Escape-closes — 7ce1de1
- [x] 1.7 Vision-diff of redesigned header/footer vs design-review matches (deviations aside) — 7ce1de1

### Phase 2: O nas page (`/about`)

#### Automated

- [x] 2.1 `npm run lint` · `npx astro check` · `npm run build` pass — 97f84ec
- [x] 2.2 `/about` responds 200 — 97f84ec

#### Manual

- [x] 2.3 Live "pojazdy we flocie" = active count; `—` fallback when Supabase unset — 97f84ec
- [x] 2.4 Vision-diff (desktop + mobile) vs `o nas *.jpg` matches (deviations aside) — 7ce1de1

### Phase 3: FAQ page (`/faq`)

#### Automated

- [x] 3.1 `npm run lint` · `npx astro check` · `npm run build` pass — ed85815
- [x] 3.2 `/faq` responds 200 — ed85815

#### Manual

- [x] 3.3 Single-open works; toggle +→× and ghost numbers animate at both breakpoints — 7ce1de1
- [x] 3.4 Works with JS disabled (native `<details>`) — ed85815
- [x] 3.5 Vision-diff vs `faq *.jpg` matches (deviations aside) — 7ce1de1

### Phase 4: Cennik page (`/pricing`) — hybrid

#### Automated

- [x] 4.1 `npm run lint` · `npx astro check` · `npm run build` pass — 3000183
- [x] 4.2 `getCategoryPricing` unit tests pass: `npm test` — 3000183
- [x] 4.3 Integration test passes if added: `npm run test:integration` — 3000183 (no integration test added; DB path verified via live `/pricing`)
- [x] 4.4 `/pricing` responds 200 — 3000183

#### Manual

- [x] 4.5 Table = `MIN(daily/monthly)` per active category via `formatPln`; empties hidden; fallback row when unset — 3000183
- [x] 4.6 Vision-diff vs `prices *.jpg` matches (rate-rows deviation expected pre-mock-update) — 7ce1de1

### Phase 5: Finalize — cross-links, catalog sync, vision-diff

#### Automated

- [x] 5.1 Full build + lint + `astro check` green — 7ce1de1
- [x] 5.2 Unit + integration suites pass — 7ce1de1
- [x] 5.3 No broken internal links — 7ce1de1

#### Manual

- [x] 5.4 Vision-diff across all six surfaces empty except recorded deviations — 7ce1de1
- [x] 5.5 `roadmap.md` S-09 = done; `design-system.md` rows 27–29 added — 7ce1de1
- [x] 5.6 `content-factcheck.md` handed to the user — 7ce1de1

### Phase 6: Post-implementation refinements

#### Automated

- [x] 6.1 `npm run lint` · `npx astro check` · `npm run build` pass; unit tests green
- [x] 6.2 No `StatusPill` importers remain (component deleted)

#### Manual

- [x] 6.3 "Dostępny" badge gone from /fleet cards, landing Popularne cards, and /fleet/[id] detail; cards render cleanly with no leftover gap
