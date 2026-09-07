# Design contract — fleet page layout parity

Scope: the public vehicle detail page `/fleet/<id>`, the surfaces touched by `plan.md` Phases 1–5. The `/fleet` listing is at parity and is governed by `context/archive/2026-08-02-landing-fleet-restyle/design-contract.md`; it is not re-specified here.

**Amended 2026-09-07 by Phase 7.** Scope now also covers the **mobile shell** of the two public date pickers — the landing hero search (`HeroSearch.tsx`) and the `/fleet` filter bar (`FilterBar.tsx`). Only their shell below 48rem is in scope. Their desktop appearance stays frozen and is still governed by the listing contract above. See Surface 6.

Design source of truth: Claude Design project `Rental car company` (`352d78a6-84fd-49a2-8b38-2fe289691fc3`).

- `customer-desktop-reserve.jsx` → `ScreenDesktopDetail`, `MiniMonth` — the desktop board
- `customer-screens.jsx` → `ScreenDetail` — the mobile board
- `shared.jsx` → `tokens`, `DayCell`, `busyHalves`, `STR.PL`

Rendered canonical board: `design-review/d-detail-mock.png`, produced from that source with the app's own self-hosted variable Inter. Values below are transcribed from the JSX, not measured from a screenshot.

---

## Design Alignment Audit

### 1. Freshness — repo designs vs the live source

| Repo artifact                                                               | Status                    | Note                                                                                                                                                                                                                             |
| --------------------------------------------------------------------------- | ------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `screenshots/03-customer-mobile-vehicle-detail.png`                         | **outdated (superseded)** | Renders a green `AVAILABLE` status pill and English copy. The live `ScreenDetail` draws no status badge; the app removed it deliberately at `0597270`.                                                                           |
| `screenshots/s-02-reservation-flow/desktop-1-vehicle-detail-dates.png`      | **outdated (superseded)** | English copy, an `AVAILABLE` pill, struck-out busy days and a 2-item legend. The live `ScreenDesktopDetail` has no pill, uses diagonal half-cells, and carries a 3-item legend. Superseded by `design-review/d-detail-mock.png`. |
| `screenshots/s-02-reservation-flow/mobile-1-vehicle-detail.png`             | **outdated (superseded)** | Same `AVAILABLE` pill and English copy.                                                                                                                                                                                          |
| `screenshots/s-02-reservation-flow/mobile-2-reservation-form.png`           | **outdated (superseded)** | Single "Unavailable — booked or requested" legend with struck-out days; the live `ScreenReserve` carries a 2-item legend with half swatches.                                                                                     |
| Tablet detail board (834)                                                   | **missing**               | No tablet board exists for this page in the live source. The app stacks below `lg`; treated as unspecified, not divergent.                                                                                                       |
| `design-system.md` S-02 note, "Screenshot-only … no `*-screens.jsx` source" | **incorrect**             | `customer-desktop-reserve.jsx` and `export-shot.html` exist in the live project. Correction is a follow-up, not a blocker.                                                                                                       |

**Consequence for this change**: do not diff the app against any of the four repo PNGs above.

**Resolved 2026-09-06.** Current boards were re-rendered from the live JSX at 2× DPI with the app's own self-hosted variable Inter, and uploaded to the design project under its own review convention:

| Design project path                   | Board                        | Local copy                         |
| ------------------------------------- | ---------------------------- | ---------------------------------- |
| `design-review/vd-desktop.png`        | `ScreenDesktopDetail` (1440) | `design-review/d-detail-mock.png`  |
| `design-review/vd-mobile.png`         | `ScreenDetail` (390 × 844)   | `design-review/m-detail-mock.png`  |
| `design-review/vd-reserve-mobile.png` | `ScreenReserve` (390 × 844)  | `design-review/m-reserve-mock.png` |

The project's `design-review/index.md` now carries a "Vehicle detail & reservation" section naming these three and marking the older `exports/*-vehicle-detail.webp` and `exports/mobile-04-reservation-form.webp` as superseded. The stale `exports/` files were left in place rather than deleted, since other artifacts may reference them by name.

`context/foundation/design-system.md` has been corrected: its claim that these screens have no recoverable JSX was wrong, and it now names the source files and flags the four stale PNGs.

**Still outstanding**: the four stale PNGs under `context/foundation/design/screenshots/` are not replaced by this change. Per that folder's own convention they hold the _shipped_ surface and are re-exported from the app after a slice lands, so refreshing them belongs at archive time, not now.

### 2. Quality audit — gaps in the design itself

| Gap                                                 | Handling                                                                                                                 |
| --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| No tablet (834) board for this page                 | App stacks below `lg`. Unspecified by design; no phase required.                                                         |
| No unselected / initial state of the booking widget | The design board always shows a chosen range. The app's `—` placeholders and disabled CTA are app-designed and retained. |
| No empty or error state for the busy-ranges read    | The app fails soft (greys nothing) per `impl-review-phase-6.md:39-40`. Retained.                                         |
| No disabled CTA state                               | Design CTA is always enabled. The app disables it until a range is picked. Retained as a deviation.                      |
| Eyebrow carries a registration plate                | No schema field. Omitted (D6).                                                                                           |

### 3. Alignment checklist — canonical surface to plan phase

| Canonical surface                                | Plan phase | Status                                       |
| ------------------------------------------------ | ---------- | -------------------------------------------- |
| Booking widget calendar, width and frame         | Phase 1    | covered                                      |
| Booking widget busy-day treatment and legend     | Phase 2    | covered                                      |
| Hero header and image card                       | Phase 3    | covered                                      |
| Spec tiles                                       | Phase 4    | covered                                      |
| What's-included row                              | Phase 5    | covered                                      |
| Widget price header, date fields, breakdown, CTA | none       | **deliberate — see deviations D-07 to D-11** |
| Breadcrumb                                       | none       | **deliberate — D-06**                        |

No plan phase contradicts the design. Every canonical surface either maps to a phase or to a recorded deviation.

**Verdict: PASS** — 5 surfaces specified, 4 repo designs superseded, 14 deviations recorded.

---

## Token map

| Design value (`shared.jsx`)          | App token                                 | Mark                                                                                                           |
| ------------------------------------ | ----------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| `tokens.card` `#FFFFFF`              | `--flota-card` / `bg-card`                | exact                                                                                                          |
| `tokens.bg` `#F1F3F6`                | `--flota-bg` / `bg-background`            | exact                                                                                                          |
| `tokens.ink` `#0F172A`               | `--flota-ink` / `text-foreground`         | exact                                                                                                          |
| `tokens.ink2` `#334155`              | `--flota-ink-2`                           | exact                                                                                                          |
| `tokens.muted` `#94A3B8`             | `--flota-muted` / `text-muted-foreground` | exact                                                                                                          |
| `tokens.hair` `rgba(15,23,42,0.08)`  | `--flota-hair`                            | exact                                                                                                          |
| `tokens.hair2` `rgba(15,23,42,0.05)` | `--flota-hair-2`                          | exact                                                                                                          |
| `tokens.accent` `#B43638`            | `--flota-accent` / `bg-primary`           | exact                                                                                                          |
| `tokens.accentSoft` `#FBE4E1`        | `--flota-accent-soft` / `bg-accent`       | exact                                                                                                          |
| `tokens.green` `#1B9E5A`             | `--flota-success`                         | exact                                                                                                          |
| `tokens.greenSoft` `#E3F5EC`         | `--flota-success-soft`                    | exact — no Tailwind colour mapping exists today; reference as an arbitrary value or add `--color-success-soft` |
| `DayCell` busy fill `#D7DCE3`        | `--flota-busy`                            | exact                                                                                                          |
| `DayCell` divider `#A9B2BE`          | `--flota-busy-divider`                    | exact                                                                                                          |
| `tokens.shadow1`                     | `--shadow-card`                           | exact                                                                                                          |
| `tokens.shadow2`                     | `--shadow-pop`                            | deviation(D-12)                                                                                                |

---

## Surface 1 — Booking widget calendar (Phase 1)

Source: `MiniMonth` and the calendar block of `ScreenDesktopDetail`.

| Element               | Value                                                                                               | Mark                                                                                                            |
| --------------------- | --------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| Calendar frame        | 1px `--flota-hair-2` border, radius 16px, padding 16px, margin-top 16px                             | exact                                                                                                           |
| Frame width           | fills the widget's inner content box, side gap 0 (436.88px at the 1440 column)                      | exact                                                                                                           |
| Month grid            | `repeat(7, 1fr)`, gap 4px                                                                           | exact                                                                                                           |
| Day cell              | 54.13 × 32px at the 1440 column; height fixed at 32px, width from the 7-column division             | exact                                                                                                           |
| Day cell radius       | 9px at range endpoints, 0px for in-range days                                                       | exact                                                                                                           |
| Day number            | 12.5px, weight 500; weight 700 when selected                                                        | exact                                                                                                           |
| Caption               | `Marzec 2026` form, sentence case, 13.5px, weight 700, letter-spacing -0.2px, left-aligned          | exact                                                                                                           |
| Nav buttons           | two 26 × 26px squares, radius 8px, 1px `--flota-hair` border, 6px gap, grouped right of the caption | exact                                                                                                           |
| Weekday header        | 10.5px, weight 600, muted, padding-bottom 4px                                                       | exact                                                                                                           |
| Weekday abbreviations | design `Pn Wt Śr Cz Pt So Nd`                                                                       | **deviation(D-01)** — ship `pon wto śro czw pią sob nie`; hand-transcribed on purpose, see `calendar.tsx:12-24` |
| Outside-month days    | design renders none                                                                                 | **deviation(D-02)** — app renders them muted; owner elected to keep                                             |
| Today marker          | design has none                                                                                     | **deviation(D-03)** — app paints `bg-accent`, the same pink as in-range days; owner elected to keep             |
| Range endpoint        | `bg-primary`, white text                                                                            | exact                                                                                                           |
| In-range day          | `bg-accent` fill, `--flota-accent-dark` text                                                        | exact                                                                                                           |
| Legend width          | matches the frame, uncapped                                                                         | exact                                                                                                           |

---

## Surface 2 — Busy-day treatment and legend (Phase 2)

Source: `DayCell` and `busyHalves` in `shared.jsx`; `MiniMonth` legend.

| Element                         | Value                                                                                   | Mark                                                                                                                                                            |
| ------------------------------- | --------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Interior busy day               | solid `--flota-busy` `#D7DCE3`, full cell                                               | exact                                                                                                                                                           |
| Changeover day, morning taken   | upper-left triangle `--flota-busy`, 135deg split — `cell-busy-am`                       | exact                                                                                                                                                           |
| Changeover day, afternoon taken | lower-right triangle `--flota-busy` — `cell-busy-pm`                                    | exact                                                                                                                                                           |
| Divider                         | 1.2px `--flota-busy-divider` band along the split, constant at any cell size            | exact                                                                                                                                                           |
| Busy day number                 | muted at 0.75 opacity                                                                   | exact                                                                                                                                                           |
| Legend swatch                   | 12 × 12px, radius 4px                                                                   | exact                                                                                                                                                           |
| Legend half swatch              | `--flota-busy` clipped to the lower-right triangle, **no divider** — `legend-busy-half` | exact                                                                                                                                                           |
| Legend type                     | 11px, muted                                                                             | exact                                                                                                                                                           |
| Legend separator                | 1px `--flota-hair-2` top border, 12px padding-top, 14px margin-top                      | exact                                                                                                                                                           |
| Legend item set                 | design: `Wybrane` / `Dzień odbioru / zwrotu — wciąż dostępny` / `W pełni zajęte`        | **deviation(D-04)** — ship the app's `niedostępny` / `tylko odbiór` / `tylko zwrot`; the app has no selected-colour swatch and splits the half-day by direction |
| Legend visibility               | design shows it always                                                                  | **deviation(D-05)** — app shows it only when the vehicle has busy days; unconditional display would render an unexplained legend on most vehicles               |

---

## Surface 3 — Hero (Phase 3)

Source: `ScreenDesktopDetail` header block (desktop), `ScreenDetail` hero (mobile).

| Element                 | Value                                                                                                                 | Mark                                                                                                                              |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| Breadcrumb              | `Flota › Furgony › Mercedes-Benz Sprinter`, 12.5px weight 540 muted, last crumb ink weight 650, padding `22px 48px 0` | **deviation(D-06)** — not built; the app ships a round back button instead                                                        |
| Page grid, desktop      | `1.45fr 0.85fr`, gap 32px                                                                                             | **deviation(D-13)** — app ships `1.5fr 1fr` gap 40px; pre-existing, out of this change's scope                                    |
| Eyebrow                 | `{year} · {type}`, 12px, weight 650, letter-spacing 0.3px, uppercase, muted                                           | exact                                                                                                                             |
| Eyebrow placement, ≥ lg | left-aligned, outside the media card                                                                                  | exact                                                                                                                             |
| Eyebrow placement, < lg | centred inside the card                                                                                               | exact (mobile board)                                                                                                              |
| `h1`, ≥ lg              | 48px, weight 700, letter-spacing -1.6px, line-height 1, left                                                          | exact                                                                                                                             |
| `h1`, < lg              | centred inside the card, current sizes retained                                                                       | exact (mobile board)                                                                                                              |
| Model subtitle          | 18px `--flota-ink-2`, margin-top 6px                                                                                  | **deviation(D-07)** — not built; schema has no trim field                                                                         |
| Image card              | radius 24px, padding `40px 32px`, `shadow-card`, margin `24px 0`, min-height 320px                                    | exact                                                                                                                             |
| Media                   | design draws a 560px silhouette                                                                                       | **deviation(D-08)** — app renders real photography through `VehicleGallery`, with the silhouette as fallback; established at S-01 |

---

## Surface 4 — Spec tiles (Phase 4)

Source: `ScreenDesktopDetail` spec grid.

| Element         | Value                                                                                           | Mark                                                              |
| --------------- | ----------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| Section heading | `SPECYFIKACJA`, 13px, weight 700, letter-spacing 0.4px, uppercase, muted, margin `8px 4px 14px` | exact                                                             |
| Grid            | `repeat(3, 1fr)`, gap 12px at `sm` and above; 2 columns below                                   | exact (2-col mobile is an app extension the design does not draw) |
| Tile            | `bg-card`, radius 16px, padding 18px, `shadow-card`                                             | exact                                                             |
| Icon            | 15px, `--flota-muted`, inline with the label, 8px gap                                           | exact                                                             |
| Icon container  | design has none                                                                                 | exact — the app's 32px container is removed in Phase 4            |
| Label           | 10.5px, weight 650, letter-spacing 0.2px, uppercase, muted                                      | exact                                                             |
| Value           | 16px, weight 650, letter-spacing -0.3px, margin-top 8px                                         | exact                                                             |
| Tile height     | approximately 78px                                                                              | exact                                                             |
| Field order     | seats, transmission, fuel, payload, cargo, km limit                                             | exact                                                             |
| Km limit value  | design `300 km / doba`                                                                          | **deviation(D-09)** — app ships `300 km`; unit copy retained      |

Verbatim Polish labels, unchanged: `Miejsca`, `Skrzynia`, `Paliwo`, `Ładowność`, `Ładunek (D×S×W)`, `Limit km`.

---

## Surface 5 — What's-included row (Phase 5)

Source: `ScreenDesktopDetail` "what's included" block.

| Element           | Value                                                                               | Mark                                                                                                                                      |
| ----------------- | ----------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| Row               | `repeat(3, 1fr)`, gap 12px, margin-top 16px                                         | exact                                                                                                                                     |
| Item              | no background, no border, no shadow; flex, 12px gap, align start, padding `4px 2px` | exact                                                                                                                                     |
| Icon container    | 34 × 34px, radius 10px, `--flota-success-soft`                                      | exact                                                                                                                                     |
| Icon              | 16px, `--flota-success`                                                             | exact                                                                                                                                     |
| Payment icon      | check                                                                               | exact                                                                                                                                     |
| Insurance icon    | design uses a key                                                                   | **deviation(D-10)** — ship `shield`; already in the icon set and reads as insurance directly. Adding a key glyph would make this `exact`. |
| Availability icon | clock                                                                               | exact                                                                                                                                     |
| Title             | 13.5px, weight 650, letter-spacing -0.1px, ink                                      | exact                                                                                                                                     |
| Note              | 12px, weight 400, muted, margin-top 2px, line-height 1.4                            | exact                                                                                                                                     |
| Row height        | approximately 43px                                                                  | exact                                                                                                                                     |

Verbatim Polish copy, unchanged from the app:

- `Płatność przy odbiorze` / `Gotówką lub kartą w dniu odbioru` — design reads `Gotówka lub karta na miejscu`, **deviation(D-11)**, app copy retained
- `Pełne ubezpieczenie` / `OC + AC w każdym pojeździe` — exact
- `Odbiór 24/7` / `Warszawa · Mokotów` — exact

---

## Surface 6 — Mobile shell for the two public date pickers (Phase 7)

Source: **there is none.** This is the one surface in this contract with no board
behind it, which is why `plan.md` §1 made the decision a gate rather than a
transcription. Checked against the live source 2026-09-07:

- `customer-screens.jsx` → `ScreenHome` draws no date control at all on mobile.
- `customer-screens.jsx` → `ScreenFleet` draws the date control as a 30px `Pill`
  reading `24 – 27 Mar`. What opens when it is tapped is **not drawn**.
- The bottom sheet is a **staff** pattern (`manual-reservation.jsx`). Lifting it
  onto a public surface is invention, not a port.

### Decision (recorded before any code, per `plan.md` Phase 7 §1)

**Option (a) — bottom sheet.** Chosen 2026-09-07. Below 48rem both public
pickers swap the popover for a full-width bottom sheet. Reasons: it is the only
option that clears the 44px touch minimum, it is the shell the rest of the app
already uses for a mobile overlay, and it removes the card-overlap defect by
construction rather than by a second fix.

Option (b) — a popover widened to `ScreenReserve`'s metrics — was rejected: its
34px cell is under the touch minimum, so it would have shipped a knowing
accessibility deviation to avoid a cosmetic one.

Because no board exists, every shell line below is **`deviation(D-15)`**. Within
that deviation the values are not invented: each is ported verbatim from a named
in-repo precedent, and the precedent is cited per line.

| Element         | Value                                                                                                                                 | Mark                                                          |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| Breakpoint      | `!useMediaQuery("(min-width: 48rem)")` — the boundary the staff modal already branches on, `ManualReservationModal.tsx:364`           | **deviation(D-15)**                                           |
| Desktop branch  | ≥ 48rem renders today's `PopoverContent` unchanged: surface 250px, root 248px, grid 224px, cell 32 × 32, aspect 1/1, radius 12px      | exact — frozen against the listing contract                   |
| Layer           | `fixed inset-0 z-[70] flex items-end`, portalled to `document.body` — `QuickAddButton.tsx:175-197`                                    | **deviation(D-15)**                                           |
| Scrim           | `rgba(20,18,22,0.5)` + `backdrop-blur-[6px]`; a tap on it closes the sheet — `QuickAddButton.tsx:181`                                 | **deviation(D-15)**                                           |
| Card            | `bg-card`, full width, `rounded-t-[26px]`, padding `16px` sides / `16px` top / `26px` bottom, `shadow-[0_-10px_40px_rgba(0,0,0,0.2)]` | **deviation(D-15)**                                           |
| Grab handle     | 40 × 4px, fully rounded, `--flota-hair`, centred, 12px bottom margin — `QuickAddButton.tsx:189`                                       | **deviation(D-15)**                                           |
| Eyebrow         | the field's own label (`Daty` / `Dates`), 12px weight 700, letter-spacing 0.4px, uppercase, muted, padding `0 6px 6px`                | **deviation(D-15)**                                           |
| Grid            | the shared `Calendar`, root `w-full`, padding 0 — the grid fills the card rather than sizing itself                                   | **deviation(D-15)**                                           |
| Day cell        | square, `(viewport − 32px) ÷ 7`; **51.1px at 390**, ≥ 44px at any viewport ≥ 364px                                                    | **deviation(D-15)** — clears the 44px touch minimum           |
| Day number      | 14px, radius 12px — the shared calendar's own values, unchanged; only the cell grows                                                  | **deviation(D-15)**                                           |
| Weekday header  | 12.8px weight 400 muted — the shared calendar's own value, unchanged                                                                  | **deviation(D-15)**                                           |
| Caption and nav | scale with `--cell-size`, so the two month arrows become 44px tap targets                                                             | **deviation(D-15)**                                           |
| Confirm row     | full width, height 50px, radius 13px, `--foreground` ground, white 15px weight 650, `Gotowe` / `Done`                                 | **deviation(D-15)** — height/radius/type from `FilterBar.tsx` |
| Dismissal       | scrim tap, `Escape`, or the confirm row; body scroll locked while open — `MobileNav.tsx:47-62`                                        | **deviation(D-15)**                                           |

`src/components/ui/calendar.tsx` is **not** edited. Every value above is set
caller-side, so the Phase 1 guarantee — the shared calendar's other three
consumers cannot regress by construction — still holds.

### Corrections to `plan.md` Phase 7

Both were found by measuring rather than by reading, and both are paperwork, not
build, defects.

1. **The measured table's tap target is wrong.** It reports a 248px calendar with
   a 30.6 / 30.8px day cell. Those two numbers come from different moments: the
   popover animates in with `zoom-in-95`, and `getBoundingClientRect()` returns
   the **transformed** box, so a measurement taken before the animation settles
   reports 95% of every dimension (32 × 0.95 = 30.4). Settled, both pickers are
   250px surface / 248px root / 224px grid / **32px** day cell at every viewport,
   which is exactly the Phase 6 fingerprint. The phase's premise is unaffected:
   32px is still under the 44px minimum.
2. **§3's stacking premise does not reproduce.** It states the `Szukaj` CTA
   "paints **over** the open popover". It does not. `PopoverContent` is a Radix
   portal at `z-50` and paints over `Szukaj` and over the card's own rows —
   verified with `elementFromPoint` at four points of the surface, at 390 and at
   1440, where every hit is inside the calendar. The translucent overlap that
   reads as the CTA showing through is the `fade-in-0` animation mid-flight. The
   real defect is the reverse of the one written down: the picker **covers** the
   card's own controls, which on a 390 phone leaves a 250px overlay sitting on
   top of `ODDZIAŁ`, `Szukaj` and the stat cards. Option (a) removes it by
   construction, so §3 needs no separate fix — but it is recorded here so a later
   audit does not go hunting for a z-index bug that was never there.

---

## Surfaces not being changed — recorded deviations

| Element                | Design                                                               | App                                                                         | Mark                                              |
| ---------------------- | -------------------------------------------------------------------- | --------------------------------------------------------------------------- | ------------------------------------------------- |
| Widget card            | radius 22px, `shadow2`, sticky top 24px                              | radius 16px, `shadow-card`, sticky top 32px                                 | **deviation(D-12)** — out of scope this change    |
| Daily price            | 30px weight 700 + `/dzień` 15px                                      | 24px weight 700 + `/doba` 14px                                              | **deviation(D-12)**                               |
| Availability strip     | `Dostępny w Twoim terminie` on `greenSoft`                           | not built                                                                   | **deviation(D-14)** — recorded decision D4 stands |
| `Odbiór i zwrot` label | 11.5px weight 600, margin `18px 0 8px`                               | not rendered                                                                | **deviation(D-12)**                               |
| Date fields            | radius 12px, `--flota-hair` border, calendar icon in the value       | radius 20px, `--flota-hair-2` border, no icon                               | **deviation(D-12)**                               |
| Estimate label         | `Szac. koszt` 14px weight 700, value 22px                            | `Szacunkowa cena` 14px weight 600, value 20px                               | **deviation(D-12)**                               |
| CTA                    | 52px, weight 700, `Zarezerwuj ten pojazd`, crimson shadow            | 48px, weight 600, `Zarezerwuj`, no shadow, disabled until a range is picked | **deviation(D-12)**                               |
| Reassurance            | `Bez zakładania konta · Bezpłatne anulowanie do 24h przed odbiorem.` | `Bez konta · darmowa anulacja do 24h przed odbiorem`                        | **deviation(D-11)**                               |

D-12 groups the widget chrome the owner scoped out of this change. It is a candidate for a follow-up slice; recording it here stops a future audit re-discovering it as new.

---

## Deviation register

| Id   | Subject                                | Reason                                                                                                                                                                                                                                                                        |
| ---- | -------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D-01 | Weekday abbreviations                  | Hand-transcribed three-letter forms kept; owner decision                                                                                                                                                                                                                      |
| D-02 | Outside-month days rendered            | Owner decision                                                                                                                                                                                                                                                                |
| D-03 | Today highlight kept                   | Owner decision; note it shares `bg-accent` with in-range days                                                                                                                                                                                                                 |
| D-04 | Legend item set                        | App splits the half-day by direction and has no selected swatch                                                                                                                                                                                                               |
| D-05 | Legend shown only when busy days exist | Avoids an unexplained legend on most vehicles                                                                                                                                                                                                                                 |
| D-06 | No breadcrumb                          | Round back button ships instead                                                                                                                                                                                                                                               |
| D-07 | No model subtitle                      | Schema has no trim field                                                                                                                                                                                                                                                      |
| D-08 | Real photography, not a silhouette     | Established at S-01                                                                                                                                                                                                                                                           |
| D-09 | `300 km` not `300 km / doba`           | Unit copy retained                                                                                                                                                                                                                                                            |
| D-10 | `shield` for insurance, not a key      | Existing glyph; semantically apt                                                                                                                                                                                                                                              |
| D-11 | App copy retained over design copy     | Owner decision; `/doba` split documented at `fleet.ts:79-83`                                                                                                                                                                                                                  |
| D-12 | Widget chrome unchanged                | Scoped out of this change                                                                                                                                                                                                                                                     |
| D-13 | Column ratio `1.5fr 1fr` gap 40        | Pre-existing; out of scope                                                                                                                                                                                                                                                    |
| D-14 | No availability strip                  | Recorded decision D4 stands                                                                                                                                                                                                                                                   |
| D-15 | Public mobile date picker is a sheet   | No board exists for either public picker at mobile; the bottom sheet is a staff pattern lifted across. Chosen over a widened popover because `ScreenReserve`'s 34px cell is under the 44px touch minimum. Values ported from in-repo precedents, cited per line in Surface 6. |

---

## Sign-off — built vs agreed (2026-09-06)

Every line above resolves. Values below were measured in the browser off
`getComputedStyle`, not read off a screenshot, on the Sprinter detail page with
two forward-dated bookings seeded and then removed.

### Surface 1 — Booking widget calendar (`f658d7c`)

| Contract line                                                     | Built                                             | Resolution                                                                        |
| ----------------------------------------------------------------- | ------------------------------------------------- | --------------------------------------------------------------------------------- |
| Frame: 1px `--flota-hair-2`, radius 16, padding 16, margin-top 16 | `1px rgba(15,23,42,0.05)`, 16px, 16px, 16px       | exact                                                                             |
| Frame width fills the inner content box, side gap 0               | frame / field row / CTA all `x=893.59 w=470.41`   | exact                                                                             |
| Month grid `repeat(7,1fr)`, gap 4px                               | 7 equal columns, column gap 4px, row gap 4px      | exact                                                                             |
| Day cell 54.13 × 32px                                             | **58.92 × 32px**, `aspect-ratio: auto`            | height exact; width follows the 7-column division of a column widened by **D-13** |
| Day cell radius 9 / 0 in-range                                    | 9px endpoints, 0px middle                         | exact                                                                             |
| Day number 12.5px w500, w700 selected                             | 12.5px/500, 700 at endpoints                      | exact                                                                             |
| Caption sentence case 13.5px w700 ls -0.2 left                    | `Wrzesień 2026`, 13.5px/700, -0.2px, `flex-start` | exact                                                                             |
| Nav: two 26px squares, radius 8, 1px `--flota-hair`, gap 6, right | 26 × 26, 8px, 1px, 6px, `flex-end`                | exact                                                                             |
| Weekday 10.5px w600 muted padding-bottom 4                        | 10.5px/600, muted, 4px                            | exact                                                                             |
| Range endpoint `bg-primary`, white                                | `rgb(180,54,56)` on white text                    | exact                                                                             |
| In-range `bg-accent` fill, `--flota-accent-dark` text             | `rgb(251,228,225)` fill, `rgb(142,38,40)` text    | exact **to this contract** — see note below                                       |
| Legend width matches the frame, uncapped                          | cap removed; legend now sits inside the frame     | exact                                                                             |

> **Note on the in-range text colour.** This contract specifies
> `--flota-accent-dark` `#8E2628`, and that is what shipped. The design source
> disagrees with the contract here: `MiniMonth` passes
> `rangeText={tokens.accent}` `#B43638`, i.e. `--flota-accent`. The one-shade
> difference was raised at the Phase 1 gate and the contract's value was kept.
> Recorded so a later audit does not re-discover it as drift.

### Surface 2 — Busy days and legend (`281b76b`)

| Contract line                                       | Built                                                                    | Resolution          |
| --------------------------------------------------- | ------------------------------------------------------------------------ | ------------------- |
| Interior busy solid `--flota-busy`                  | `rgb(215,220,227)` = `#D7DCE3`, element opacity 1                        | exact               |
| Changeover AM / PM diagonals                        | `cell-busy-am` / `cell-busy-pm`, correct orientation per direction       | exact               |
| Divider 1.2px `--flota-busy-divider`                | `rgb(169,178,190)` band, clips cleanly to the 9px corner (checked at 8×) | exact               |
| Busy day number muted at 0.75                       | `text-muted-foreground/75` — colour alpha, so the fill stays solid       | exact               |
| Legend swatch 12 × 12, radius 4                     | 12px × 12px, 4px                                                         | exact               |
| Legend half swatch `legend-busy-half`, no divider   | white ground, lower-right clip, 1px `--flota-hair` border, no divider    | exact               |
| Legend type 11px muted                              | 11px, `rgb(148,163,184)`                                                 | exact               |
| Legend separator 1px `--flota-hair-2`, pt 12, mt 14 | 1px `rgba(15,23,42,0.05)`, 12px, 14px                                    | exact               |
| Legend item set                                     | app's three by direction                                                 | **deviation(D-04)** |
| Legend visibility                                   | only when `availability.size > 0`                                        | **deviation(D-05)** |

**Where the fill is painted.** `plan.md` left this open and required a decision.
The fills are applied by `BookingDayCell` (the day **button**), not through
`modifiersClassNames` (the **gridcell**). The gridcell is square and unclipped,
so a gradient laid there escapes the 9px radius; the button carries the radius
and `overflow-hidden`, which is the shape the design's `DayCell` draws, and it
is the target `global.css` documents for `cell-busy-*`. Confirmed the selected
range wins: a range start on a half-busy day paints `bg-primary` and the
gradient is gone.

### Surface 3 — Hero (`9f0c596`)

| Contract line                                                                   | Built                                           | Resolution          |
| ------------------------------------------------------------------------------- | ----------------------------------------------- | ------------------- |
| Eyebrow 12px w650 ls 0.3 uppercase muted                                        | 12px/650, 0.3px, uppercase, muted               | exact               |
| Eyebrow ≥ lg left, outside the card                                             | left, outside                                   | exact               |
| Eyebrow < lg centred inside the card                                            | centred inside                                  | exact               |
| `h1` ≥ lg 48px w700 ls -1.6 lh 1 left                                           | 48px/700, -1.6px, line-height 48px, left        | exact               |
| `h1` < lg centred, current sizes                                                | centred, `text-4xl sm:text-5xl` retained        | exact               |
| Image card radius 24, padding 40/32, `shadow-card`, margin 24/0, min-height 320 | 24px, `40px 32px`, shadow set, 24px/24px, 320px | exact               |
| Media                                                                           | real photography through `VehicleGallery`       | **deviation(D-08)** |

Both boards come out of one tree: the `<header>` carries the card chrome below
`lg` and sheds it at `lg`, while the media child picks it up. Measured `h1`
count is 1 at every width — a per-breakpoint duplicate would have put a second
`<h1>` in the DOM.

### Surface 4 — Spec tiles (`45c4eaf`)

| Contract line                                          | Built                                                 | Resolution          |
| ------------------------------------------------------ | ----------------------------------------------------- | ------------------- |
| Heading 13px w700 ls 0.4 uppercase muted margin 8/4/14 | 13px/700, 0.4px, uppercase, muted, `8px 4px 14px 4px` | exact               |
| Grid `repeat(3,1fr)` gap 12 at `sm`+, 2 below          | 3 cols at 1440, 2 at 390, gap 12px                    | exact               |
| Tile `bg-card` radius 16 padding 18 `shadow-card`      | white, 16px, 18px, shadow set                         | exact               |
| Icon 15px `--flota-muted` inline with the label, gap 8 | 15 × 15, `rgb(148,163,184)`, inline (not above), 8px  | exact               |
| Icon container: none                                   | 32px container removed                                | exact               |
| Label 10.5px w650 ls 0.2 uppercase muted               | 10.5px/650, 0.2px, uppercase, muted                   | exact               |
| Value 16px w650 ls -0.3 margin-top 8                   | 16px/650, -0.3px, 8px                                 | exact               |
| Tile height ≈ 78px                                     | **79px** (was 116.5px)                                | exact               |
| Field order, six pairs                                 | unchanged; em-dash fallbacks intact                   | exact               |
| Km limit `300 km`                                      | unchanged                                             | **deviation(D-09)** |

Both text lines carry `leading-[normal]`. The design sets no line-height on
either; inheriting the app's 1.5 was the entire 5.8px between an 83.8px tile and
the contract's 78.

### Surface 5 — What's-included row (`ccecace`)

| Contract line                                                     | Built                                                                             | Resolution          |
| ----------------------------------------------------------------- | --------------------------------------------------------------------------------- | ------------------- |
| Row `repeat(3,1fr)` gap 12 margin-top 16                          | 3 cols, 12px, 16px                                                                | exact               |
| Item: no bg/border/shadow, flex, gap 12, align start, padding 4/2 | transparent, border 0, shadow none, radius 0, flex, 12px, `flex-start`, `4px 2px` | exact               |
| Icon container 34 × 34 radius 10 `--flota-success-soft`           | 34 × 34, 10px, `rgb(227,245,236)` = `#E3F5EC`                                     | exact               |
| Icon 16px `--flota-success`                                       | 16px, `rgb(27,158,90)` = `#1B9E5A`                                                | exact               |
| Payment icon check                                                | check                                                                             | exact               |
| Availability icon clock                                           | clock                                                                             | exact               |
| Insurance icon                                                    | `shield`                                                                          | **deviation(D-10)** |
| Title 13.5px w650 ls -0.1 ink                                     | 13.5px/650, -0.1px, ink, `leading-[normal]`                                       | exact               |
| Note 12px w400 muted margin-top 2 lh 1.4                          | 12px/400, muted, 2px, 16.8px                                                      | exact               |
| Row height ≈ 43px                                                 | **42.8px** (was 87px)                                                             | exact               |

Three distinct path geometries confirmed, not one glyph repeated. At 390 the
three items stack in one column, each 42.8px, every note on one line.

### Regression — the three untouched calendar consumers

`ui/calendar.tsx` was never opened, so none of these can change by
construction. Confirmed anyway, reading layout widths off computed style:

| Surface                         | Fingerprint                                                                                         | vs baseline |
| ------------------------------- | --------------------------------------------------------------------------------------------------- | ----------- |
| Listing date popover            | grid 224px · cell 32 × 32 · aspect 1/1 · radius 12px · `pon` 12.8px/400 · row gap 8px · 5 outside   | identical   |
| Landing hero search             | identical on every field                                                                            | identical   |
| Staff manual-reservation picker | grid 478px · cell 64.86 × 34 · aspect auto · radius 9px · `Pn` 10.5px/600 · row gap 4px · 5 outside | identical   |

> **Correction to `plan.md`'s baseline table.** It records **6 rows** for all
> three. September 2026 with a Monday start is **5** rows, and the same table's
> "5 outside days" only fits a 5-row month. The row count in that table is
> wrong; every other field matches exactly. The row count is a property of the
> displayed month, not of the component, so it does not belong in a fingerprint.

### Verdict

**PASS.** 5 surfaces built, every contract line `exact` or a recorded
`deviation`. No new deviation ids were needed: D-01 … D-14 stand as written, and
the two divergences found during implementation (the in-range text colour, the
baseline row count) are corrections to the paperwork, not to the build.

---

## Sign-off — Surface 6, mobile shell (2026-09-07)

Measured in the browser off `getComputedStyle` and `getBoundingClientRect`, on a
restarted dev server, after the popover's `zoom-in-95` / `fade-in-0` animation
was waited out — see correction 1 above for why that wait is load-bearing.

### The sheet, below 48rem

| Contract line                                         | Built                                                          | Resolution          |
| ----------------------------------------------------- | -------------------------------------------------------------- | ------------------- |
| Sheet shell replaces the popover                      | `shell: "sheet"` on both pickers at 320 / 360 / 390 / 767      | **deviation(D-15)** |
| Layer `fixed inset-0 z-[70]`, portalled, scrim + blur | as ported; nothing paints over the card                        | **deviation(D-15)** |
| Card full width, `rounded-t-[26px]`, 16/16/26 padding | 390px wide at 390, grid root 358px, root padding 0             | **deviation(D-15)** |
| Day cell ≥ 44px at 390                                | **51.16 × 51.16px**, aspect 1/1                                | **deviation(D-15)** |
| Day number 14px, radius 12px — shared calendar's own  | 14px, 12px                                                     | **deviation(D-15)** |
| Weekday 12.8px/400 — shared calendar's own            | 12.8px/400, row gap 8px, 5 outside days                        | **deviation(D-15)** |
| No horizontal overflow                                | `scrollWidth === innerWidth` at 320 / 360 / 390 / 767          | **deviation(D-15)** |
| Dismissal: scrim tap, `Escape`, confirm row           | all three close; `body.overflow` returns to `visible` on close | **deviation(D-15)** |

### The popover, at and above 48rem — must be unchanged

| Surface             | Before (pre-change)                                                         | After     |
| ------------------- | --------------------------------------------------------------------------- | --------- |
| Landing hero search | surface 250 · root 248 · grid 224 · cell 32 × 32 · aspect 1/1 · radius 12px | identical |
| `/fleet` filter bar | identical on every field                                                    | identical |

Checked at 768 (the first pixel of the desktop branch) and at 1440. Weekday
12.8px/400, row gap 8px and 5 outside days match on both. The breakpoint is
exact: 767 renders the sheet, 768 renders the popover.

### Regression — the two surfaces this phase must not touch

| Surface                         | Fingerprint                                                                     | vs baseline |
| ------------------------------- | ------------------------------------------------------------------------------- | ----------- |
| Booking widget `/fleet/<id>`    | grid 436.41 · cell 58.92 × 32 · aspect auto · radius 9px (390: 276 · 36 × 32)   | identical   |
| Staff manual-reservation picker | grid 478 · cell 64.84 × 34 · aspect auto · radius 9px · `Mo` 10.5px/600 · gap 4 | identical   |

`ui/calendar.tsx` was not opened, so neither could change by construction.

### Two things worth recording

**Below 364px the cell drops under 44px.** The grid divides the card's inner
width by 7, so a 320px viewport yields **41.16px**. This is a knowing
accessibility deviation on a viewport size that is effectively extinct (the
smallest current iPhone is 375px, common Android is 360px, where the cell is
46.86px). The alternative — pinning `--cell-size` to 44px — was rejected because
`min-width` on a flex item cannot shrink, so it would overflow the card
horizontally below 364px rather than degrade. A cell that is slightly small
beats a grid that runs off the screen.

**`max-w-md` is the one value not ported from a precedent.** The mobile branch
runs to 767px, and a full-width card put a 105px day cell on screen there. The
card is capped at 28rem and centred above that, which leaves every phone width
untouched (390 never reaches the cap) and brings 767 to a 448px card with a
59.44px cell. It is a Tailwind scale step rather than a magic number.

### Verdict

**PASS.** Surface 6 built. Every line resolves to `deviation(D-15)` — expected,
since the surface has no board — or to `exact` for the frozen desktop branch. One
new deviation id was needed (D-15); D-01 … D-14 stand unchanged. The two
divergences found while measuring (the mid-animation tap target, the reversed
stacking premise) are corrections to `plan.md`, not to the build.
