# Design Contract — Fleet-Browse Restyle (`/fleet`)

Canonical source: Claude Design `Rental car company`
(`352d78a6-84fd-49a2-8b38-2fe289691fc3`), file `customer-desktop.jsx` →
`ScreenDesktopFleet` / `ScreenTabletFleet` / `ScreenMobileFleet`, shared blocks
`FleetCardBig`, `FilterBtn`, `FleetTypeScroll`, `DesktopHeader`. Tokens are the live
`src/styles/global.css`. Every spec line is marked `exact` (transcribed verbatim
from the mock) or `deviation(reason)` (deliberate divergence — snapped to a token, or
a kept/added affordance the mock omits).

---

## Design Alignment Audit

### 1. Freshness — repo designs vs canonical

| Repo artifact                                                                | Represents                        | Status                                                                             |
| ---------------------------------------------------------------------------- | --------------------------------- | ---------------------------------------------------------------------------------- |
| `context/foundation/design/screenshots/08-customer-desktop-fleet-browse.png` | pre-redesign desktop fleet browse | **OUTDATED (superseded)** by `ScreenDesktopFleet`                                  |
| `context/foundation/design/screenshots/02-customer-mobile-fleet.png`         | old `ScreenFleet` (light, TabBar) | **OUTDATED (superseded)** by `ScreenMobileFleet`                                   |
| tablet (834) fleet browse                                                    | `ScreenTabletFleet`               | **MISSING** — never captured                                                       |
| `design-system.md` catalog row 08 (`customer-desktop.jsx`)                   | fleet browse desktop              | current pointer OK; screenshot stale                                               |
| `design-system.md` catalog row 02 (`customer-screens.jsx` → `ScreenFleet`)   | mobile fleet listing              | **MIS-POINTED** — restyled mobile is `ScreenMobileFleet` in `customer-desktop.jsx` |

**Action at archive:** re-export rows 08 + 02 from the restyled screens and add a
tablet row; fix the row-02 source pointer. Canonical shots for THIS change live in
`design-review/` (see gate).

### 2. New-design quality gaps (mock is happy-path)

The mock does **not** draw: empty-results, loading/skeleton, the active-filter chip
row / applied-filter summary, the filter **dropdown panels** (only triggers), a
standalone result count, or the mobile hamburger menu panel. Per the plan's
feature-parity decision (**keep all working affordances, restyle on-brand**), each is
designed by us and recorded as a `deviation` below; the mobile menu panel is
out-of-scope (header/`MobileNav`).

### 3. Alignment checklist (plan ↔ canonical)

| Canonical surface                          | App surface            | Plan phase               |
| ------------------------------------------ | ---------------------- | ------------------------ |
| `ScreenDesktopFleet` type-pills            | category pill bar      | Phase 1                  |
| filter card + `FilterBtn`                  | `FilterBar.tsx`        | Phase 2                  |
| `FleetCardBig`                             | `VehicleCard.astro`    | Phase 3                  |
| desktop/tablet grid                        | results grid           | Phase 3                  |
| `ScreenMobileFleet` dark `FleetTypeScroll` | mobile scroller island | Phase 4                  |
| `DesktopHeader active="fleet"`             | shared `SiteHeader`    | verify-only (no phase)   |
| empty / chips / count (mock-silent)        | kept + restyled        | Phases 2, 5 (deviations) |

Every canonical surface maps to a phase; every phase maps to a canonical surface or
a recorded deviation. **No unmapped surface.**

---

## Token map (design hex → app token)

| Mock value                                                                 | App token / class                                              | Mark                                                                                   |
| -------------------------------------------------------------------------- | -------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| `#B43638` (primary CTA "Zastosuj", icon tint)                              | `--flota-accent` / `--primary` / `bg-primary`                  | **exact**                                                                              |
| `#141B2D` (card "Rezerwuj" CTA)                                            | `--flota-ink-deep` (`#141b2d`)                                 | **exact**                                                                              |
| `#141922` (active pill, "Filtry" chip)                                     | `--flota-ink-deep`                                             | deviation(snap; ΔB minor, unify dark inks)                                             |
| `#0A0A0F` (mobile scroller container)                                      | `bg-[#0A0A0F]` arbitrary                                       | deviation(landing-local dark, no token — matches landing's arbitrary dark canvas)      |
| `#F4F5F7` (page bg)                                                        | `--background` (`#f1f3f6`)                                     | deviation(snap; ΔRGB ~3)                                                               |
| `#EEF0F4` (filter card bg)                                                 | `--flota-neutral-soft` (`#eef1f5`) → `bg-secondary`/`bg-muted` | deviation(snap; ΔRGB ~1)                                                               |
| `#FBE4E1` (filter-icon chip bg)                                            | `--flota-accent-soft` (`#fbe4e1`) / `bg-accent`                | **exact**                                                                              |
| `rgba(15,23,42,0.05)` (spec-grid hairline)                                 | `--flota-hair-2`                                               | **exact**                                                                              |
| `rgba(15,23,42,0.08)` (pill border)                                        | `--flota-hair`                                                 | **exact**                                                                              |
| `0 1px 2px rgba(15,23,42,.04), 0 2px 6px rgba(15,23,42,.05)` (card shadow) | `--flota-shadow-1` / `shadow-card`                             | **exact**                                                                              |
| `#99A2B2` (eyebrow, price suffix, spec icons)                              | `--flota-muted` (`#94a3b8`) / `text-muted-foreground`          | deviation(snap; ΔRGB ~6)                                                               |
| `#5B6474` (card subtitle)                                                  | `--flota-ink-2` (`#334155`)                                    | deviation(snap; mock is lighter — snap for token consistency, re-check at vision-diff) |
| `#8A93A3` / `#9AA3B2` (muted filter labels)                                | `--flota-muted` / `text-muted-foreground`                      | deviation(snap)                                                                        |
| Inter                                                                      | `--flota-font-sans`                                            | **exact**                                                                              |
| weights 540 / 600 / 650 / 700                                              | `--flota-fw-medium/semibold/bold/heavy`                        | **exact**                                                                              |
| `rounded-[12px]` (card image)                                              | `--flota-radius-md` / `rounded-md`                             | **exact**                                                                              |
| `rounded-full` (pills, CTAs)                                               | `--flota-radius-pill` / `rounded-full`                         | **exact**                                                                              |
| `rounded-[22px]` (card)                                                    | `rounded-[22px]` arbitrary                                     | deviation(no token; matches landing `LandingVehicleCard`)                              |
| `rounded-[18px]` (filter card)                                             | `rounded-[18px]` arbitrary                                     | deviation(no token; between lg/xl)                                                     |

---

## Screen inventory (mockup ref → app surface)

| #   | Mock component                            | App surface (file)                                      |
| --- | ----------------------------------------- | ------------------------------------------------------- |
| S0  | page frame (`ScreenDesktopFleet`)         | `src/pages/fleet/index.astro` `<main>`                  |
| S1  | type-pill bar                             | `fleet/index.astro:122-166`                             |
| S2  | filter card (`FilterBtn`×3 + Zastosuj)    | `src/components/vehicle/FilterBar.tsx`                  |
| S3  | active-filter chips + count (mock-silent) | `fleet/index.astro:112-118,174-215`                     |
| S4  | `FleetCardBig`                            | `src/components/vehicle/VehicleCard.astro`              |
| S5  | results grid                              | `fleet/index.astro:230`                                 |
| S6  | `FleetTypeScroll` (dark, mobile)          | new island `src/components/vehicle/FleetTypeScroll.tsx` |
| S7  | mobile filter card                        | `FilterBar.tsx` (mobile variant)                        |
| S8  | empty / loading (mock-silent)             | `fleet/index.astro:218-228`                             |
| S9  | `DesktopHeader active="fleet"`            | shared `SiteHeader.astro` (verify-only)                 |

---

## Per-surface specs

### S0 — Page shell

- Page bg `--background` — deviation(snap from `#F4F5F7`).
- Container `max-w-app mx-auto`; desktop gutter `px-12` (mock `48px`) / mobile `px-5` (mock `20px`) — exact.
- Type-pill row top padding `pt-10` (mock `40px`), bottom `pb-[22px]` — exact.

### S1 — Category type-pills (desktop / tablet)

- Row: `flex flex-wrap gap-3` (mock `gap:12`) — exact.
- Pill: `h-[52px] rounded-full pl-4 pr-[22px]`, label `text-[14.5px] font-semibold` — exact.
- Active: `bg-[var(--flota-ink-deep)] text-white` — deviation(snap `#141922`).
- Inactive: `bg-card` + `border border-[var(--flota-hair)]` — exact.
- Label: `{categoryLabelPl} · {count}`; leads with `Wszystkie · {total}` — exact.
- `<CategoryIcon>` glyph reused, unchanged — exact.
- Each pill is an `<a href={tabHref}>` (instant filter) — exact (preserve current behavior).

### S2 — Filter card (desktop)

- Card: `bg-secondary rounded-[18px] p-3 pl-5 gap-3.5 flex items-center`; border `--flota-hair-2` — deviation(snap `#EEF0F4`; `rounded-[18px]` arbitrary).
- "Filtry" chip: `size-9 rounded-full bg-[var(--flota-ink-deep)]` + white filter icon + label `text-[12px] font-heavy` — deviation(snap `#141922`).
- `FilterBtn` (×3 — Termin / Ładowność / Sortowanie): `h-[52px] rounded-full bg-card`; leading `size-9 rounded-full bg-accent` + crimson icon; field label `text-[10px] font-heavy uppercase text-muted-foreground`; value `text-[14px] font-bold`; trailing chevron-down — exact (colors snapped per token map).
- "Zastosuj": `ml-auto h-[46px] rounded-full bg-primary text-white text-[14px] font-bold` (desktop, inline) — exact.
- **Tablet arrangement:** the "Filtry" chip + 3 triggers wrap on the first row; **"Zastosuj" drops to a full-width second row** `h-[50px] rounded-[14px]` — exact (verified against `fleet-tablet.jpg`; was undocumented).
- **Sort field label:** ship **"Sortowanie"** (noun, consistent with Termin / Ładowność) across all breakpoints — deviation(the mock is internally inconsistent: desktop+tablet render the eyebrow `SORTUJ`, mobile renders `Sortowanie`; we standardize on the noun form).
- Panels (date Popover+Calendar, payload/sort Select) kept as shipped shadcn — deviation(mock draws no panel; keep functional).
- Sort options stay `Cena: rosnąco` / `Cena: malejąco` — deviation(mock placeholder values are `Polecane` on desktop/tablet and `domyślne` on mobile; keep the app's real options).
- Island stays non-persisted (re-reads `initial` per nav) — exact (preserve).

### S3 — Active-filter chips + result count (mock-silent → deviation, kept)

- Result heading "{count} pojazdów gotowych do wynajmu." retained, restyled to new type scale — deviation(mock drops the count).
- Chip: pill tag `rounded-full bg-card border border-[var(--flota-hair)]` with remove affordance — deviation(designed on-brand).
- "Wyczyść wszystko": subdued text link `text-muted-foreground` — deviation(kept; behavior unchanged).

### S4 — Vehicle card (`FleetCardBig`)

- Container: `bg-card rounded-[22px] p-[22px] shadow-card`, single `<a>` → `/fleet/{id}/{slug}` (dates appended when set) — exact (radius arbitrary per token map).
- Eyebrow `{year} · {categoryLabelPl}`: `text-[11px] font-heavy uppercase text-muted-foreground` — exact.
- Title (make): `text-[21px] font-heavy tracking-[-0.5px] text-[var(--flota-ink)]` — exact.
- Subtitle `{model} · {production_year}`: `text-[14px] text-[var(--flota-ink-2)]` — deviation(snap `#5B6474`).
- Image frame: `aspect-[16/9] rounded-md my-4`; photo via `<VehicleSilhouette>` when present, else the mock's diagonal gradient placeholder `[background:linear-gradient(-111deg,…)]` — exact (silhouette/photo swap kept).
- Spec grid: `grid grid-cols-4 gap-2 py-[15px] border-y border-[var(--flota-hair-2)]`; `<SpecIcon>` icons `text-muted-foreground`; values `text-[12.5px] font-semibold text-[var(--flota-ink)]` (seats / transmission / fuel / payload) — exact.
- Price: `{formatPln(daily_rate)} zł` `text-[24px] font-heavy` + "/dzień" `text-[14px] font-medium text-muted-foreground` — exact.
- Price sub: `{monthly} zł/mies. · kaucja {deposit} zł` `text-[12px] font-medium` — exact.
- CTA "Rezerwuj" + arrow: `h-[44px] rounded-full bg-[var(--flota-ink-deep)] text-white text-[14px] font-bold` — deviation(pill CTA, not the 14px `--flota-radius-button`; matches landing card).
- `stack` (vertical footer) engages by container width in 2-/1-col grids (Tailwind `@container` + `@min-[Npx]:`) — exact (container-query, per lesson).

### S5 — Results grid

- `grid gap-[22px] grid-cols-1 sm:grid-cols-2 lg:grid-cols-3` — exact (tablet gap `20`, mobile gap `16` reconciled to `gap-[22px]` single step — deviation(minor, one gap value)).

### S6 — Mobile type-pill scroller (`FleetTypeScroll`, dark)

- Container: `flex gap-[2px] p-[5px] rounded-full bg-[#0A0A0F] overflow-x-auto` — exact (arbitrary bg per token map).
- Active pill: `bg-white` + `{categoryLabelPl} · {count}` `text-[13.5px] font-bold text-[#0A0A0F]` — exact.
- Inactive pill: `size-10` icon-only, `text-white/72`, `<CategoryIcon>` glyph — exact.
- Animate width `transition-[flex] duration-[.32s]` — exact.
- Selecting navigates to the category href (params preserved) — exact (instant filter).
- Shown `< sm`; desktop/tablet pill bar `hidden` `< sm` — exact.
- No-JS fallback: underlying `<a>` anchors remain navigable — deviation(added for progressive enhancement).

### S7 — Mobile filter card

- Card: `bg-secondary rounded-[18px] p-3.5`; section label "Filtry" `text-[11px] font-heavy uppercase text-muted-foreground` (text label, **not** a chip on mobile) — deviation(snap `#8A93A3`).
- Rows (×3), `h-[50px] rounded-[13px] bg-card`:
  - **Termin** row: calendar icon + **left-aligned** placeholder "Wybierz daty" + trailing chevron, **no field label** — exact.
  - **Ładowność** / **Sortowanie** rows: field label + **right-aligned** value ("dowolna" / "domyślne") + trailing chevron — exact.
- "Zastosuj": full-width `h-[50px] rounded-[13px] bg-primary` — exact.

### S8 — Empty / loading (mock-silent → deviation, on-brand)

- Empty-results + date-error: centered on-brand card in the results region, Polish copy retained, behavior unchanged — deviation(designed on-brand; verified at vision-diff).
- Loading: lightweight on-brand treatment if warranted — deviation(designed on-brand).

### S9 — Header (verify-only)

- Reuse shared `SiteHeader active="fleet"` (public-info-pages shell). Verify against
  the mock's `DesktopHeader` (Flota mark on `--flota-ink-deep` tile, pill nav, phone
  - dark CTA); record any diff as deviation. No rebuild. — deviation(reuse).
- **Mock renders English placeholders** in the header — nav item `Fleet`, CTA
  `Browse the fleet` (the prototype's EN/PL toggle defaults to EN). Ship the shipped
  **Polish** shell: nav `Flota`, CTA `Przeglądaj flotę` — deviation(keep Polish; same
  call `landing-redesign` made for `LandingNav`).
- **Responsive header (reference):** tablet collapses the phone to an icon-only
  button (no number); mobile shows a phone chip + hamburger and no CTA. Handled by the
  existing `SiteHeader`/`MobileNav` — no work here.

---

## Verbatim Polish copy (canonical)

- Category labels (= `categoryLabelPl`): **Wszystkie · Furgon · Bus osobowy · Autolaweta · Chłodnia · Skrzyniowy**
- Result count: **„{count} pojazdów gotowych do wynajmu.”**
- Filter card: **Filtry · Termin · Wybierz daty · Ładowność · dowolna · Sortowanie · Zastosuj**
  (ship the field label **„Sortowanie”** everywhere — the mock's desktop/tablet
  `SORTUJ` eyebrow is an internal inconsistency we don't follow)
- Sort placeholder in the mock: **„Polecane”** (desktop/tablet) / **„domyślne”** (mobile) — placeholder only
- Sort options (kept, real): **Cena: rosnąco · Cena: malejąco**
- Active filters: **Aktywne filtry: · Wyczyść wszystko**
- Card: eyebrow **„{rok} · {typ}”** · price suffixes **„/dzień” · „zł/mies.” · „kaucja … zł”** · CTA **„Rezerwuj”**
- Empty state: retain existing Polish copy (`fleet/index.astro:220-228`)

---

## Gate verdict

**PASS — 9 surfaces aligned, 2 repo designs superseded, 14 deviations recorded.**

Canonical screenshots captured and verified (2026-08-02):

- `design-review/fleet-desktop.jpg` — `ScreenDesktopFleet`
- `design-review/fleet-tablet.jpg` — `ScreenTabletFleet`
- `design-review/fleet-mobile.jpg` — `ScreenMobileFleet`
- (`landing-*-reference.jpg` — out-of-scope reference only; landing already ships.)

A plan-time vision audit compared every S0–S9 surface against the shots: all present
and on-spec, **no structural mismatches**. Two copy corrections (`SORTUJ`→ship
`Sortowanie`; mock's English header placeholders → keep Polish shell) and four
documentation gaps (tablet full-width `Zastosuj`, mobile Termin-row shape,
per-breakpoint sort placeholder, responsive header) were folded into the specs above.

**Deviations register (14):** page-bg snap (#F4F5F7→`--background`) · filter-card-bg
snap (#EEF0F4→`--flota-neutral-soft`) · pill/chip ink snap (#141922→`--flota-ink-deep`)
· mobile scroller `#0A0A0F` arbitrary (no token) · muted snaps (#99A2B2/#8A93A3→
`--flota-muted`) · subtitle snap (#5B6474→`--flota-ink-2`) · `rounded-[22px]` /
`rounded-[18px]` arbitrary · card CTA pill (not `--flota-radius-button`) · grid gap
reconciled to `gap-[22px]` · **kept-but-mock-silent:** result count, active-filter
chips + „Wyczyść wszystko", empty/loading states, functional filter panels, real sort
options · ship `Sortowanie` label · keep Polish header shell.

The **rendered** vision-diff (app vs these shots at all three breakpoints) remains the
downstream gate in `/10x-implement` Phase 5 / `/10x-impl-review`.
