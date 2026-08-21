# Design Contract — S-12a manual-reservation-date-picker (Termin: availability-aware picker)

Source of truth: **`manual-reservation.jsx`** (`ManualResFlow` form step, `MrCalendarPopover`, `mrDateBtn`,
`MrAvailability`; boards `MrD_Pick` / `MrM_Pick`, `MrD_FormOk` / `MrM_FormOk`, `MrD_FormConflict` /
`MrM_FormConflict`) plus **`shared.jsx`** (`busyHalves`, `DayCell`), live in Claude Design
`352d78a6-84fd-49a2-8b38-2fe289691fc3`, pulled via DesignSync **2026-08-20**. Values transcribed **exactly**;
each line `exact` or `deviation(reason)`.

This contract covers **only the `Termin` block and its calendar**. Header, Pojazd, Klient, footer and the done
panel remain governed by `context/changes/manual-reservation/design-contract.md`, except for the three
corrections listed under "Corrections to the S-12 contract" below.

---

## Design Alignment Audit

### Freshness audit (repo vs canonical)

| Artifact                                                   | Status                    | Note                                                                                                                                                                                           |
| ---------------------------------------------------------- | ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `manual-reservation.jsx` (design source)                   | **current**               | Pulled 2026-08-20. Contains `MrCalendarPopover` + `MrD_Pick` / `MrM_Pick`; the `Termin` fields are `mrDateBtn` buttons.                                                                        |
| `shared.jsx` (`busyHalves`, `DayCell`)                     | **current**               | Pulled 2026-08-20. The availability model and half-cell geometry below are transcribed from it.                                                                                                |
| S-12 `design-review/*.png` (10 shots)                      | **outdated (superseded)** | `desktop-03-form-available.png` shows two **empty native date inputs**; the source now draws icon+date+chevron buttons. The source changed after these were exported. Stale for `Termin` only. |
| `exports/manual-reservation/*.png` in the Design project   | **outdated (superseded)** | Same 10 shots, same reason.                                                                                                                                                                    |
| S-12 `design-contract.md` Surface 2 "Termin"               | **outdated (superseded)** | Records `<input type="date">` as `exact`. Wrong against the current source — same class of error as the three lines corrected in S-12 Phase 7.                                                 |
| `MrD_Pick` / `MrM_Pick` boards                             | **missing screenshots**   | The boards exist in the source but were never exported. Required for the vision-diff gate.                                                                                                     |
| S-12 `design-review/*-05-created.png` (done panel)         | **current**               | The done step is untouched by this slice.                                                                                                                                                      |
| `cell-pickup-only` / `cell-return-only` (`global.css:234`) | **current, divergent**    | Geometry matches the source exactly; the fill does not (`--muted` `#EEF1F5` vs source `#D7DCE3`, and no divider line). See D14 and the follow-up.                                              |

**Roadmap/change-note correction.** `change.md` and roadmap S-12a both record a "design blocker — the source
draws native date inputs, so the calendar is a deliberate departure that must land in the Design project
first." That is **void**: the source already draws the calendar. No mock edit is required; the correction is
to this repo's contract, not to the design.

### New-design quality audit (gaps in the canonical source)

- **Nav arrows are inert.** `MrCalendarPopover`'s prev/next are `<span>`s with no handler — a static artboard
  affordance. Our port needs working month navigation → **D12**.
- **No past-date treatment.** The source's mock dates are all future, so no disabled-past state is drawn.
  The app must disable past days → **D13**.
- **The available hint cites a reservation reference** (`kolejna rez. R-2402`) that the PII-safe RPC does not
  return → **D10**.
- **The conflict state's clashing-booking card** needs the colliding customer's name, initials, dates,
  reference and status — none of it in the payload → **D2** (inherited from S-12, unchanged).
- **One legend swatch covers two visually distinct cells.** "Dzień odbioru / zwrotu — wciąż dostępny" is drawn
  with a single lower-right half-swatch, while `DayCell` renders upper-left for AM-busy and lower-right for
  PM-busy → accepted verbatim, **D15**.
- **Range-selection semantics are hand-rolled** (`pickDay` branches on which field is open) rather than a
  library range picker → **D11**.
- Desktop and mobile are both provided for the picker-open and form states. Copy is canonical Polish.

### Alignment checklist (plan vs canonical)

| Canonical surface                                     | Plan phase                    | Aligned?                    |
| ----------------------------------------------------- | ----------------------------- | --------------------------- |
| `Termin` date buttons (`mrDateBtn`, resting + active) | Phase 4                       | ✓ (`exact`)                 |
| `MrCalendarPopover` — card, tail, grid, cells         | Phase 4                       | ✓ (D11, D12, D13, D14)      |
| Calendar legend (3 items)                             | Phase 4                       | ✓ (D15)                     |
| Calendar footer (range summary + Zastosuj)            | Phase 4                       | ✓ (`exact`)                 |
| `MrAvailability` available state, with next-free hint | Phase 3                       | ✓ (D10 — reference dropped) |
| `MrAvailability` conflict / invalid / checking / idle | unchanged                     | ✓ (S-12 contract governs)   |
| UI phases carry a vision-diff success criterion       | Phase 4 (4.10), Phase 5 (5.3) | ✓                           |

### Verdict

**PASS — closed 2026-08-21.** Freshness and quality audits are complete, every canonical surface maps to a
plan phase, and 9 deviations (D10–D17 plus the inherited D2) are recorded. The six boards landed in
`design-review/` (see provenance below) and the rendered vision-diff ran to an empty punch-list.

**Vision-diff punch-list (S-12a Phase 5, app vs the six boards) — 2 findings, both fixed:**

1. **Legend half-swatch drew a divider line.** `DayCell` draws the 1.2px `#A9B2BE` divider on `half` cells
   **only**; the legend swatch is a plain `#D7DCE3` fill clipped to `polygon(100% 0, 100% 100%, 0 100%)` with
   no divider. The port had reused the day-cell utility for the swatch. Fixed with a separate
   `legend-busy-half` utility.
2. **Neighbouring months' days were rendered.** The source builds its grid from the current month only —
   `cells.push(null)` for the lead-in and no trailing days — while shadcn's `Calendar` defaults to
   `showOutsideDays`, so August 31 and October 1–4 appeared as greyed numbers. Fixed with
   `showOutsideDays={false}`.

Everything else matches, including the values this document records `exact`: `mrDateBtn` (40 / 10 / 13 / 600,
active ink border + `0 0 0 4px rgba(15,23,42,0.06)`), the tail (12×12, `top:-6`, 24% / 74%), the card
(radius 16, padding 16), grid gap 4, cell height 34 with radius 9 on endpoints and 0 between, the
`#D7DCE3` / `#A9B2BE` half-cell treatment and its orientation, the three legend items, the footer summary and
**Zastosuj**, and the desktop scrim's `flex-start` + `padding-top: 56` over `padding: 32`.

---

## Screenshots — landed 2026-08-21

**Provenance (read this before trusting them).** These are **not** exports from the Design app's own export
pipeline. They were produced by rendering the canonical source itself: `manual-reservation.jsx` and
`shared.jsx` were pulled with DesignSync `get_file`, served alongside the project's own `export-shot.html`
harness (whose `SCREENS` map already registers `mr-d-pick` / `mr-m-pick` / `mr-d-ok` / `mr-m-ok` /
`mr-d-conflict` / `mr-m-conflict`), and captured through `window.__renderScreen(id)` at `deviceScaleFactor: 2`
with React 18 + Babel standalone, exactly as the harness does. Page errors: none.

**Fonts are the app's own files, not the CDN's.** The harness's `<link>` to Google Fonts was replaced with
`@font-face` rules over the very `.woff2` files Astro's `experimental.fonts` downloads for the app
(`.astro/fonts/font-inter-400-700-normal-*.woff2`), with the same per-subset `unicode-range` split, so the two
sides of the diff are byte-identical on typography. This is **not** cosmetic: the app ships Inter as a
**variable** face over `400 700`, while `css2?family=Inter:wght@400;500;600;700` serves **static** instances —
against which the source's `fontWeight: 540 / 650 / 750` snap up to 600 / 700 / 700. Rendering the boards the
CDN way skewed 1–3.4% of the pixels on every board, across the whole modal. Capture asserts
`document.fonts.check("650 13px Inter")`.

One thing this does **not** reproduce: `Sidebar` lives outside `shared.jsx`, so the desktop boards' dimmed
backdrop is a flat grey stub. The modal — the only thing under diff — is untouched.

Files in `context/changes/manual-reservation-date-picker/design-review/`:

| Board              | Filename                        | Why                                |
| ------------------ | ------------------------------- | ---------------------------------- |
| `MrD_Pick`         | `desktop-01-picker-open.png`    | New — never exported               |
| `MrM_Pick`         | `mobile-01-picker-open.png`     | New — never exported               |
| `MrD_FormOk`       | `desktop-02-form-available.png` | Re-export — `Termin` block changed |
| `MrM_FormOk`       | `mobile-02-form-available.png`  | Re-export — `Termin` block changed |
| `MrD_FormConflict` | `desktop-03-form-conflict.png`  | Re-export — `Termin` block changed |
| `MrM_FormConflict` | `mobile-03-form-conflict.png`   | Re-export — `Termin` block changed |

The done-panel shots (`*-05-created.png`) in the S-12 folder stay valid and are not needed again.

---

## Token map (design → app token)

| Design value         | Hex / value           | App token (utility)                                       |
| -------------------- | --------------------- | --------------------------------------------------------- |
| `tokens.card`        | `#FFFFFF`             | `--card` (`bg-card`)                                      |
| `tokens.ink`         | `#0F172A`             | `--foreground`                                            |
| `tokens.ink2`        | `#334155`             | `--flota-ink-2`                                           |
| `tokens.muted`       | `#94A3B8`             | `--muted-foreground`                                      |
| `tokens.hair`        | `rgba(15,23,42,0.08)` | `--flota-hair` (button + nav borders)                     |
| `tokens.hair2`       | `rgba(15,23,42,0.05)` | `--flota-hair-2` (popover border, legend/footer rules)    |
| `tokens.accent`      | `#B43638`             | `--primary` (selected day, in-range text, Wybrane swatch) |
| `tokens.accentSoft`  | `#FBE4E1`             | `--accent` (`bg-accent`) (in-range day fill)              |
| `tokens.shadow3`     | soft 3                | `shadow-overlay`                                          |
| `DayCell` `busyFill` | **`#D7DCE3`**         | **new** `--flota-busy` (`cell-busy-*`)                    |
| `DayCell` `divider`  | **`#A9B2BE`**         | **new** `--flota-busy-divider`                            |

> **Why two new tokens.** The shipped `cell-pickup-only` / `cell-return-only` fill with `var(--muted)` =
> `#EEF1F5` and draw no divider. The source's `#D7DCE3` + `#A9B2BE` divider is materially darker. The new
> tokens keep this surface `exact` without restyling the public `BookingWidget` inside a staff slice.
> **Follow-up (not this slice):** reconcile `BookingWidget`'s busy fill to the same treatment.

## Screen inventory

| Mockup board                            | App surface                               | Device           |
| --------------------------------------- | ----------------------------------------- | ---------------- |
| `MrD_Pick` / `MrM_Pick`                 | modal — `Termin` with the calendar open   | desktop / mobile |
| `MrD_FormOk` / `MrM_FormOk`             | modal — `Termin` resting, panel available | desktop / mobile |
| `MrD_FormConflict` / `MrM_FormConflict` | modal — `Termin` resting, panel conflict  | desktop / mobile |

---

## Deviations (recorded — the vision-diff must NOT re-flag these)

- **D10 `deviation(no-data)`** — the available hint ships as **"Pojazd wolny do {d MMM}"**, dropping the
  source's `· kolejna rez. {reference}` clause. `get_vehicle_busy_ranges` returns date bounds only. When no
  later range exists the source's own fallback **"Brak innych rezerwacji w tym okresie."** is used verbatim —
  this _retires_ S-12's invented "Można utworzyć rezerwację."
- **D11 `deviation(rdp-range)`** — selection uses `react-day-picker` `mode="range"` with the
  `checkRangeBookable` veto, not the source's hand-rolled `pickDay` (which branches on the open field and
  bumps the return date by one). The open field still drives which caption shows the active treatment. The
  library idiom is the house pattern (`BookingWidget.tsx:217`) and gives keyboard + SR behaviour for free.
- **D12 `deviation(static-source)`** — the month nav arrows are working buttons. The source draws inert
  `<span>`s because the artboards are static.
- **D13 `deviation(undrawn-state)`** — past days are `disabled`. The source draws no past-date state; the app
  cannot let an employee book backwards (`validateDateRange` rejects it anyway).
- **D14 `deviation(added-token)`** — the busy fill and divider ship as new `--flota-busy` /
  `--flota-busy-divider` utilities rather than reusing `cell-pickup-only` / `cell-return-only`. Values are
  `exact` to the source; the divergence is that the **public** calendar keeps the lighter `--muted` fill until
  the follow-up lands.
- **D15 `deviation(source-verbatim)`** — the legend ships the source's three items, so one half-swatch stands
  for both the AM-busy (upper-left) and PM-busy (lower-right) cell treatments. Chosen over `BookingWidget`'s
  two-swatch legend to keep the canonical Polish copy.
- **D16 `deviation(undrawn-state)`** — a `Termin` button with no date yet shows **"—"**. Every source board
  carries both dates, so the empty state is not drawn; the em-dash reuses the public `BookingWidget`'s own
  empty-field placeholder rather than inventing copy.
- **D17 `deviation(reuse)`** — the `onSelect` veto's three hints
  (`Wybrany dzień odbioru…` / `Wybrany dzień zwrotu…` / `Wybrany termin…`) render in the calendar footer's
  left slot, replacing the range summary while a hint is up. The static source has no veto state and so draws
  no placement for one; the summary is meaningless at that moment because the range has just been reset to the
  clicked day.

- **D2 `deviation(no-data)`** _(inherited from S-12, unchanged)_ — conflict is a plain "Termin zajęty"
  message; no clashing-booking card.

---

## Surface — `Termin` block

Section label **Termin** (`mrLabel`: `font-size:11 / weight:700 / letter-spacing:0.4 / uppercase`,
`text-muted-foreground`, `margin-bottom:8`) — unchanged from S-12. `exact`.

### Date fields

Grid `2 cols`, `gap:10` (`gap-2.5`); wrapper `position: relative`. `exact`.

Per field, caption `mrFieldCap` — `font-size:10.5 / weight:600 / letter-spacing:0.3 / uppercase`, muted,
`margin-bottom:5`, `display:block` — reading **Odbiór** / **Zwrot**. `exact`.

Button `mrDateBtn` — `width:100% / height:40 / border-radius:10 / border 1px var(--flota-hair) / bg-card /
padding:0 10px / display:flex / align-items:center / gap:8 / font-size:13 / weight:600 / color ink /
box-sizing:border-box`. `exact`.

Contents, in order — calendar icon `size 14` (`text-muted-foreground`, `--foreground` when active); the date
label `flex:1, text-align:left`, formatted `d MMM yyyy` (`mrFmtFull` → **"1 kwi 2026"**); chevron-down
`size 13` muted. `exact`.

**Active** (this field's picker is open) — `border-color: var(--foreground)` and
`box-shadow: 0 0 0 4px rgba(15,23,42,0.06)`. `exact`.

**Disabled while a create is in flight** — `disabled` + `opacity 0.4`, inherited from the S-12
`deviation(busy-guard)` as widened in Phase 1.

Note **Odbiór od 14:00 · zwrot do 10:00** `font-size:11.5` muted `margin-top:8`; availability panel
`margin-top:10`. Unchanged from S-12. `exact`.

### Calendar popover

Opens **in flow** beneath the fields (`position: relative; margin-top: 12`), so the modal body grows and the
footer stays pinned. **Not** absolutely positioned. `exact`.

Arrow tail — `12×12`, `top:-6`, `left: 24%` when Odbiór is open / `74%` when Zwrot is open, `bg-card`,
`border-left` + `border-top` `1px var(--flota-hair-2)`, `rotate(45deg)`, `z-index:1`. `exact`.

Card — `bg-card`, `border 1px var(--flota-hair-2)`, `border-radius:16`, `padding:16`, `shadow-overlay`
(`tokens.shadow3`). `exact`.

**Header row** — flex, space-between, center, `margin-bottom:12`.

- Caption `{Miesiąc} {rok}` from `PL_MON_FULL` — e.g. **Kwiecień 2026** — `font-size:13.5 / weight:700 /
letter-spacing:-0.2`, ink. **Not uppercased** (unlike `BookingWidget`, which upper-cases its caption).
  `exact`.
- Nav buttons `26×26`, `border-radius:8`, `border 1px var(--flota-hair)`, flex-centered; chevron `size 13`
  `--flota-ink-2`; the next button is the back glyph mirrored (`scaleX(-1)`). `exact` styling,
  `deviation(static-source)` on behaviour (D12).

**Grid** — `grid-template-columns: repeat(7, 1fr)`, `gap:4`. Monday-first (the `pl` date-fns locale already
is). `exact`.

**Weekday headers** — **Pn / Wt / Śr / Cz / Pt / So / Nd**, `text-align:center`, `font-size:10.5 /
weight:600`, muted, `padding-bottom:4`. `exact` — these exact two-letter forms must be produced by a
`formatWeekdayName` formatter; the raw `pl` locale emits "pon.", "wt.", etc.

**Day cells** (`DayCell`, `shared.jsx:1324`) — `height:34` (`[--cell-size:--spacing(8.5)]`),
`overflow:hidden`, centered label, `transition: background .12s`. `exact`.

- Radius: `9` on the two range endpoints, `0` on the days between. `exact`.
- Label `font-size:13`, `weight:500` (`700` when selected). `exact`.
- **Selected** — `background: var(--primary)`, label `#fff`. `exact`.
- **In range** — `background: var(--accent)` (`#FBE4E1`), label `var(--primary)`. `exact`.
- **AM busy** (an existing booking's **return** day — morning taken, still bookable as a pickup) — upper-left
  triangle `polygon(0 0, 100% 0, 0 100%)` filled `--flota-busy`; label ink; clickable. Maps to our
  `pickupOnly`. `exact`.
- **PM busy** (an existing booking's **pickup** day — afternoon taken, still bookable as a return) —
  lower-right triangle `polygon(100% 0, 100% 100%, 0 100%)` filled `--flota-busy`; label ink; clickable.
  Maps to our `returnOnly`. `exact`.
- **Divider on any half cell** — a line from `(100,0)` to `(0,100)`, stroke `--flota-busy-divider`,
  `stroke-width 1.2`, `vector-effect: non-scaling-stroke`, spanning the cell. `exact`.
- **Fully busy** (interior day, or a day that is both a return and a pickup) — solid `--flota-busy`
  background, label `text-muted-foreground` at `opacity 0.75`, `cursor: not-allowed`, not selectable.
  `exact`.
- **Past days** — `disabled`. `deviation(undrawn-state)` (D13).
- Per-day aria: the two half states append the start-only / end-only suffix via `labelDayButton`, as
  `BookingWidget.tsx:265-277` does. `deviation(a11y-added)` — the static source has no aria.

> **The availability model is identical, so nothing is re-derived.** `busyHalves` marks `P → pm`, `R → am`,
> interiors both (`shared.jsx:1311`); `dayAvailabilityMap` computes the same from `pmTaken` (`P <= d < R`) and
> `amTaken` (`P < d <= R`). `blocked` ⇔ `am && pm`, `pickupOnly` ⇔ `am` only, `returnOnly` ⇔ `pm` only.

**Legend** — flex-wrap, `gap: 8px 16px`, `margin-top:14`, `padding-top:12`, `border-top 1px var(--flota-hair-2)`.
Item: inline-flex, `gap:6`, `font-size:11`, muted. Swatch `12×12`, `border-radius:4`. `exact`.

| Label (verbatim)                            | Swatch                                                                          |
| ------------------------------------------- | ------------------------------------------------------------------------------- |
| **Wybrane**                                 | `background: var(--primary)`                                                    |
| **Dzień odbioru / zwrotu — wciąż dostępny** | white, `border 1px var(--flota-hair)`, inner `--flota-busy` clipped lower-right |
| **W pełni zajęte**                          | `background: --flota-busy`                                                      |

`exact` copy and styling; `deviation(source-verbatim)` on the one-swatch-for-two-states reading (D15).

**Footer row** — flex, center, space-between, `gap:10`, `margin-top:14`, `padding-top:12`,
`border-top 1px var(--flota-hair-2)`. `exact`.

- Left: **{d MMM} – {d MMM} · {N dni}** (`mrFmt` → "1 kwi"; `mrDayLabel` → **"1 dzień"** / **"{n} dni"**),
  `font-size:12.5`, `--flota-ink-2`, `weight:600`, `tabular-nums`. `exact`.
- Right: **Zastosuj** — `height:38 / padding:0 18px / border-radius:11 / background var(--foreground) /
color #fff / font-size:13 / weight:650`. Closes the popover. `exact`.

### Desktop modal anchoring while the picker is open

The scrim switches from centered to `align-items: flex-start; padding-top: 56` while a field is open, so the
grown modal does not overflow. `exact`.

---

## Surface — `MrAvailability`, available state

Box, icon and title (**Termin wolny**) unchanged from the S-12 contract. Only the subtitle changes:

- With a later booking: **"Pojazd wolny do {d MMM}"** — `font-size:12`, success, `opacity:0.85`.
  `deviation(no-data)` (D10) — the source's `· kolejna rez. {reference}` clause is dropped.
- With none: **"Brak innych rezerwacji w tym okresie."** — `exact`, verbatim from the source.

---

## Corrections to the S-12 contract (`context/changes/manual-reservation/design-contract.md`)

Found during this audit; applied in Phases 1 and 4.

1. **Surface 2 "Termin"** — the `<input type="date">` spec recorded `exact` is wrong against the current
   source. Superseded by this document.
2. **Surface 1 desktop `max-height`** — the source's desktop form shell is `maxHeight: '94%'`, not `90%`. The
   shipped `md:max-h-[90%]` override should be dropped so both breakpoints are `94%`.
3. **Surface 2 footer submit button** — the source sets `background: tokens.muted` while
   `av.state === 'conflict'`, in addition to the `opacity 0.4` already recorded. The shipped button stays
   `bg-primary` in that state.
4. **Surface 1 `deviation(busy-guard)`** — widened from the close button to the whole form (Phase 1, F11).

---

## Verbatim Polish copy (canonical)

**New in this slice:** `Kwiecień 2026` (caption pattern) · `Pn` · `Wt` · `Śr` · `Cz` · `Pt` · `So` · `Nd` ·
`Wybrane` · `Dzień odbioru / zwrotu — wciąż dostępny` · `W pełni zajęte` · `Zastosuj` · `1 dzień` / `{n} dni` ·
`Pojazd wolny do {d MMM}` · `Brak innych rezerwacji w tym okresie.`

**Unchanged, governed by the S-12 contract:** `Termin` · `Odbiór` · `Zwrot` · `Odbiór od 14:00 · zwrot do 10:00` ·
`Termin wolny` · `Termin zajęty` · `Ten pojazd ma już rezerwację w wybranych dniach.` ·
`Sprawdzanie dostępności…` · `Wybierz pojazd i termin, aby sprawdzić dostępność.` ·
`Nie udało się sprawdzić dostępności.` · `Data zwrotu musi być późniejsza niż data odbioru.`

**Reused from `BookingWidget` (the veto hints):** `Wybrany dzień odbioru jest niedostępny. Wybierz inny termin.` ·
`Wybrany dzień zwrotu jest niedostępny. Wybierz inny termin.` ·
`Wybrany termin jest niedostępny. Wybierz inne daty.` — `deviation(reuse)`: the static source has no veto
state, and these three are already shipped and translated.
