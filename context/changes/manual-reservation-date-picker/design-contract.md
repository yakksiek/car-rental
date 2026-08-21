# Design Contract — S-12a manual-reservation-date-picker (Termin: availability-aware picker)

Source of truth: **`manual-reservation.jsx`** (`ManualResFlow` form step, `MrCalendarPopover`, `mrDateBtn`,
`MrAvailability`; boards `MrD_Pick` / `MrM_Pick`, `MrD_FormOk` / `MrM_FormOk`, `MrD_FormConflict` /
`MrM_FormConflict`) plus **`shared.jsx`** (`busyHalves`, `DayCell`), live in Claude Design
`352d78a6-84fd-49a2-8b38-2fe289691fc3`, pulled via DesignSync **2026-08-20**, **re-pulled 2026-08-21** after
the source was revised for Phase 6 (one `Termin` field, no available-state subtitle, mobile picker as its own
sheet). Values transcribed **exactly**; each line `exact` or `deviation(reason)`.

This contract covers **only the `Termin` block and its calendar**. Header, Pojazd, Klient, footer and the done
panel remain governed by `context/changes/manual-reservation/design-contract.md`, except for the three
corrections listed under "Corrections to the S-12 contract" below.

---

## Design Alignment Audit

### Freshness audit (repo vs canonical)

| Artifact                                                   | Status                    | Note                                                                                                                                                                                           |
| ---------------------------------------------------------- | ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `manual-reservation.jsx` (design source)                   | **current**               | Re-pulled 2026-08-21 (Phase 6 revision). Contains `MrCalendarPopover` + `MrD_Pick` / `MrM_Pick`; the `Termin` block is **one** `mrDateBtn` button.                                             |
| `shared.jsx` (`busyHalves`, `DayCell`)                     | **current**               | Pulled 2026-08-20, unchanged by the Phase 6 revision. The availability model and half-cell geometry below are transcribed from it.                                                             |
| S-12 `design-review/*.png` (10 shots)                      | **outdated (superseded)** | `desktop-03-form-available.png` shows two **empty native date inputs**; the source now draws icon+date+chevron buttons. The source changed after these were exported. Stale for `Termin` only. |
| `exports/manual-reservation/*.png` in the Design project   | **outdated (superseded)** | Same 10 shots, same reason.                                                                                                                                                                    |
| S-12 `design-contract.md` Surface 2 "Termin"               | **outdated (superseded)** | Records `<input type="date">` as `exact`. Wrong against the current source — same class of error as the three lines corrected in S-12 Phase 7.                                                 |
| `MrD_Pick` / `MrM_Pick` boards                             | **current**               | Landed 2026-08-21, re-rendered the same day from the Phase 6 source. See provenance below.                                                                                                     |
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
- ~~**The available hint cites a reservation reference** (`kolejna rez. R-2402`) that the PII-safe RPC does not
  return.~~ **Resolved at source (Phase 6):** the revised `MrAvailability` drops the subtitle entirely, so the
  available state is status only and there is nothing left to approximate → **D10**, restated.
- **The conflict state's clashing-booking card** needs the colliding customer's name, initials, dates,
  reference and status — none of it in the payload → **D2** (inherited from S-12, unchanged).
- **One legend swatch covers two visually distinct cells.** "Dzień odbioru / zwrotu — wciąż dostępny" is drawn
  with a single lower-right half-swatch, while `DayCell` renders upper-left for AM-busy and lower-right for
  PM-busy → accepted verbatim, **D15**.
- **Range-selection semantics are hand-rolled** (`pickDay` anchors on the first click and closes the range on
  the second, in either direction) rather than a library range picker → **D11**.
- Desktop and mobile are both provided for the picker-open and form states. Copy is canonical Polish.

### Alignment checklist (plan vs canonical)

| Canonical surface                                     | Plan phase                    | Aligned?                   |
| ----------------------------------------------------- | ----------------------------- | -------------------------- |
| `Termin` date buttons (`mrDateBtn`, resting + active) | Phase 4                       | ✓ (`exact`)                |
| `MrCalendarPopover` — card, tail, grid, cells         | Phase 4                       | ✓ (D11, D12, D13, D14)     |
| Calendar legend (3 items)                             | Phase 4                       | ✓ (D15)                    |
| Calendar footer (range summary + Zastosuj)            | Phase 4                       | ✓ (`exact`)                |
| `MrAvailability` available state (status only)        | Phase 3, revised Phase 6      | ✓ (D10 — subtitle dropped) |
| `Termin` single field + mobile picker sheet           | Phase 6                       | ✓ (D18)                    |
| `MrAvailability` conflict / invalid / checking / idle | unchanged                     | ✓ (S-12 contract governs)  |
| UI phases carry a vision-diff success criterion       | Phase 4 (4.10), Phase 5 (5.3) | ✓                          |

### Verdict

**PASS — closed 2026-08-21; re-closed the same day after the Phase 6 source revision.** Freshness and quality
audits are complete, every canonical surface maps to a plan phase, and 9 deviations (D10–D15, D17, D18 plus
the inherited D2 — D16 retired) are recorded. The six boards were re-rendered from the revised source into
`design-review/` (see provenance below) and the rendered vision-diff ran to an empty punch-list both times.

**Vision-diff punch-list (S-12a Phase 5, app vs the six boards) — 2 findings, both fixed:**

1. **Legend half-swatch drew a divider line.** `DayCell` draws the 1.2px `#A9B2BE` divider on `half` cells
   **only**; the legend swatch is a plain `#D7DCE3` fill clipped to `polygon(100% 0, 100% 100%, 0 100%)` with
   no divider. The port had reused the day-cell utility for the swatch. Fixed with a separate
   `legend-busy-half` utility.
2. **Neighbouring months' days were rendered.** The source builds its grid from the current month only —
   `cells.push(null)` for the lead-in and no trailing days — while shadcn's `Calendar` defaults to
   `showOutsideDays`, so August 31 and October 1–4 appeared as greyed numbers. Fixed with
   `showOutsideDays={false}`.

**Vision-diff punch-list (S-12a Phase 6, app vs the six re-rendered boards) — empty.** Driven at 1320×900 and
390×844 against a seeded vehicle: one full-width trigger (h 40 / r 10 / 13px / 600, active
`rgb(15,23,42)` + `0 0 0 4px rgba(15,23,42,0.06)`), the tail centred on the card to the pixel, the day count
at 12px / 600 muted, the available panel a single centred **Termin wolny** line with no date clause anywhere,
and the mobile picker an `absolute inset-0 z-[70]` layer (`rgba(20,18,22,0.5)`, `items-end`) whose panel is
`rounded-t-[26px]` / `px-4 pt-3.5 pb-[22px]` over a 40×4 handle, carrying no card chrome inside. The only
differences from the boards are the fixture data (vehicle, month, prices) and the vehicle-thumbnail glyph
already recorded in the S-12 contract (house lucide `Truck` for the source's `Silhouette`).

Everything else matches, including the values this document records `exact`: `mrDateBtn` (40 / 10 / 13 / 600,
active ink border + `0 0 0 4px rgba(15,23,42,0.06)`), the tail (12×12, `top:-6`, centred), the card
(radius 16, padding 16), grid gap 4, cell height 34 with radius 9 on endpoints and 0 between, the
`#D7DCE3` / `#A9B2BE` half-cell treatment and its orientation, the three legend items, the footer summary and
**Zastosuj**, and the desktop scrim's `flex-start` + `padding-top: 56` over `padding: 32`.

---

## Screenshots — landed 2026-08-21, re-rendered the same day (Phase 6)

**Provenance (read this before trusting them).** These are **not** exports from the Design app's own export
pipeline. They were produced by rendering the canonical source itself: `manual-reservation.jsx` and
`shared.jsx` were pulled with DesignSync `get_file`, served alongside the project's own `export-shot.html`
harness (whose `SCREENS` map already registers `mr-d-pick` / `mr-m-pick` / `mr-d-ok` / `mr-m-ok` /
`mr-d-conflict` / `mr-m-conflict`), and captured through `window.__renderScreen(id)` at `deviceScaleFactor: 2`
with React 18 + Babel standalone, exactly as the harness does. Page errors: none.

**All six were re-rendered on 2026-08-21** through the same harness after the Phase 6 source revision. The
first set drew the two-field surface with the "Pojazd wolny do …" subtitle — exactly the staleness that opened
this slice, now avoided by re-rendering in the same phase that changed the source. Board dimensions are
unchanged, so the desktop picker board simply has more room below the (now shorter) modal. Page errors: none;
the font assertion held.

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

| Board              | Filename                        | What the current render shows                |
| ------------------ | ------------------------------- | -------------------------------------------- |
| `MrD_Pick`         | `desktop-01-picker-open.png`    | One trigger, centred tail, in-flow card      |
| `MrM_Pick`         | `mobile-01-picker-open.png`     | Picker as its own sheet layer over the form  |
| `MrD_FormOk`       | `desktop-02-form-available.png` | One `Termin` field; panel is status only     |
| `MrM_FormOk`       | `mobile-02-form-available.png`  | One `Termin` field; panel is status only     |
| `MrD_FormConflict` | `desktop-03-form-conflict.png`  | One `Termin` field; conflict panel unchanged |
| `MrM_FormConflict` | `mobile-03-form-conflict.png`   | One `Termin` field; conflict panel unchanged |

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

- **D10 `deviation(no-data)` — restated in Phase 6; the whole subtitle is dropped, not just its reference
  clause.** The available state ships as the **Termin wolny** title alone. The source's original hint was
  `Pojazd wolny do {d MMM} · kolejna rez. {reference}`; `get_vehicle_busy_ranges` returns date bounds only, so
  the reference clause was never portable. Shipping the remainder proved worse than dropping it, on two counts
  found by driving the built slice: without the reference the date reads as a claim about the range being
  booked ("Pojazd wolny do 1 paź" for a booking five weeks out), and it is **silent exactly when a warning
  would matter** — a booking starting ON the chosen return day is a legal 10:00/14:00 changeover, so it never
  counts as "next", and `22 → 25 sie` reported "Brak innych rezerwacji w tym okresie." while a reservation
  started that afternoon. The revised source drops the subtitle for the same reasons, so this is now
  `deviation(no-data)` only in that the app cannot offer the reference-bearing version either. It retires both
  S-12's invented "Można utworzyć rezerwację." and this slice's own "Pojazd wolny do {d MMM}" /
  "Brak innych rezerwacji w tym okresie."
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
- **~~D16~~ `retired` (Phase 6)** — the two-field surface's empty state showed **"—"** per field. Superseded by
  **D18**: with one field, `"— – —"` reads as broken rather than empty.
- **D18 `deviation(undrawn-state)`** — the single `Termin` button with no dates yet reads **"Wybierz termin"**
  and hides the day count; every source board carries a range, so neither state is drawn. The same rule covers
  the half-made range a veto leaves behind (`onSelect` resets to the just-clicked day and clears the return),
  which shows that one date alone, still with no count — the source cannot produce it, because its `pickDay`
  sets both ends on the first click.
- **D17 `deviation(reuse)`** — the `onSelect` veto's three hints
  (`Wybrany dzień odbioru…` / `Wybrany dzień zwrotu…` / `Wybrany termin…`) render in the calendar footer's
  left slot, replacing the range summary while a hint is up. The static source has no veto state and so draws
  no placement for one; the summary is meaningless at that moment because the range has just been reset to the
  clicked day.

- **D2 `deviation(no-data)`** _(inherited from S-12, unchanged)_ — conflict is a plain "Termin zajęty"
  message; no clashing-booking card.

- **D19 `deviation(undrawn-state)` — the calendar says when it has no answer to draw.** The source's grid is
  always backed by its own `MR_BOOKINGS` literal, so it never has a loading or a failed read to draw and the
  boards show none. Ours does: `busyRanges: []` reads identically as "no bookings", "still loading" and "the
  read failed", and the grid drew the first of those for all three — an all-free month over a failed read,
  which an employee reads availability off to a customer on the phone. Both undrawn states are therefore
  ours to define:
  - **loading** — the grid is `inert` at `opacity 0.5`. No message: the availability panel above it already
    reads **Sprawdzanie dostępności…**, and the state is transient.
  - **error** — the grid is `inert` at `opacity 0.5` **and** the picker carries a notice above it, in the
    panel's own warning treatment (`rounded-[13px]`, `bg-[var(--flota-warning-soft)]`, `AlertTriangle`
    `size 18`, `font-size:12.5 / weight:600`, `text-warning`, `margin-bottom:12`) reading
    **"Nie udało się sprawdzić dostępności."** — the panel's `avError` string verbatim, not a second wording.
    It is repeated inside the picker because on mobile the picker is its own `absolute inset-0 z-[70]` layer
    and **covers the panel outright**, so the grid would otherwise be the only thing on screen.
  - The **trigger stays enabled** in both states. Gating it (`disabled={busy || rangesState !== "ready"}`) was
    considered and rejected: it makes the common path pay for the rare failure, and a dead button with no
    explanation is worse than a picker that opens and says why it is empty.
  - A **"Spróbuj ponownie"** action (`font-size:12.5 / weight:700`, `text-warning`, underlined,
    `margin-top:4`) — also undrawn — appears in **both** error surfaces: the picker's notice and the
    availability panel's error branch. A failed read otherwise strands the vehicle, because the read is keyed
    on `vehicleId`, so re-selecting the same one is a no-op and the only way out is switching vehicle and
    back. **Both placements are required, not belt-and-braces**: the panel's error branch only renders once a
    complete range is picked (`resolveAvailability` returns `idle` while either date is empty), and after a
    failed read the grid is inert — so no range can be picked, and a panel-only retry is unreachable in
    exactly the state that needs it. Driven 2026-08-21: with the route forced to 500 the picker showed the
    message with the grid inert and **zero** retry affordances before this was added. The action is absent
    from the panel's `invalid` state, which no re-read can fix.

---

## Surface — `Termin` block

Section label **Termin** (`mrLabel`: `font-size:11 / weight:700 / letter-spacing:0.4 / uppercase`,
`text-muted-foreground`, `margin-bottom:8`) — unchanged from S-12. `exact`.

### The date field

**One field**, full width; wrapper `position: relative`. The picker sets both ends of the range, so the
two-field grid the source drew until 2026-08-21 only restated what the calendar already carries — and invited
the reading that each trigger opened a different calendar. `exact` to the revised source.

There are **no `mrFieldCap` captions**: **Odbiór** / **Zwrot** went with the second field, and the **Termin**
section label above already names the block. (`mrFieldCap` survives in the source as an unused style atom.)

Button `mrDateBtn` — `width:100% / height:40 / border-radius:10 / border 1px var(--flota-hair) / bg-card /
padding:0 10px / display:flex / align-items:center / gap:8 / font-size:13 / weight:600 / color ink /
box-sizing:border-box`. `exact`.

Contents, in order. `exact`:

1. Calendar icon `size 14` — `text-muted-foreground`, `--foreground` while the picker is open.
2. The range label, `flex:1, text-align:left`, formatted `{mrFmt} – {mrFmtFull}` → **"1 kwi – 2 kwi 2026"**.
   The first date's year is elided because the pair reads as one span; the source elides it unconditionally,
   including across a year boundary ("30 gru – 2 sty 2027"), and so do we.
3. The day count `{mrDayLabel}` → **"1 dzień"** / **"{n} dni"**, `font-size:12 / weight:600`, muted.
4. Chevron-down `size 13` muted.

**Active** (the picker is open) — `border-color: var(--foreground)` and
`box-shadow: 0 0 0 4px rgba(15,23,42,0.06)`. `exact`.

**No range yet** — **"Wybierz termin"**, day count hidden. `deviation(undrawn-state)` (D18).

**Disabled while a create is in flight** — `disabled` + `opacity 0.4`, inherited from the S-12
`deviation(busy-guard)` as widened in Phase 1.

Note **Odbiór od 14:00 · zwrot do 10:00** `font-size:11.5` muted `margin-top:8`; availability panel
`margin-top:10`. Unchanged from S-12. `exact`.

### Calendar — two variants

The grid, legend and footer below are identical in both; only the shell around them differs, exactly as the
source's `MrCalendarPopover({ variant })` does. `exact`.

**`popover` — desktop.** Opens **in flow** beneath the field (`position: relative; margin-top: 12`), so the
modal body grows and the footer stays pinned. **Not** absolutely positioned. `exact`.

**`sheet` — mobile.** Drops the card chrome entirely (no background, border, radius, padding or shadow) and
no tail, because the sheet that wraps it owns the surface — a card inside a card otherwise. `exact`.

Arrow tail — `12×12`, `top:-6`, `left: calc(50% - 6px)` — centred under the single trigger, where the
two-field version pointed at `24%` / `74%`. `bg-card`, `border-left` + `border-top` `1px var(--flota-hair-2)`,
`rotate(45deg)`, `z-index:1`. `exact`. **Popover variant only** — the mobile sheet has no tail.

Card — `bg-card`, `border 1px var(--flota-hair-2)`, `border-radius:16`, `padding:16`, `shadow-overlay`
(`tokens.shadow3`). `exact`.

**Header row** — flex, space-between, center, `margin-bottom:12`.

- Caption `{Miesiąc} {rok}` from `PL_MON_FULL` — e.g. **Kwiecień 2026** — `font-size:13.5 / weight:700 /
letter-spacing:-0.2`, ink. **Not uppercased** (unlike `BookingWidget`, which upper-cases its caption).
  `exact`.
- Nav buttons `26×26`, `border-radius:8`, `border 1px var(--flota-hair)`, flex-centered; chevron `size 13`
  `--flota-ink-2`; the next button is the back glyph mirrored (`scaleX(-1)`). The pair sits in a flex row with
  **`gap: 6`** (`gap-1.5`), transcribed from the source's own
  `<div style={{ display: 'flex', gap: 6 }}>` around the two buttons. `exact` styling,
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
  `exact`. **The opacity is the LABEL's, not the cell's** — the source puts it on the day `<span>`
  (`opacity: full ? 0.75 : 1`) while the container keeps `background: '#D7DCE3'` at full strength. Ship it as
  `text-muted-foreground/75`; an `opacity-75` on the button fades the fill with it and renders ≈`#E1E5EA`.
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

### Mobile picker layer

On mobile the picker is **its own layer above the form sheet**, not an inline block inside a scrolling body:
in flow it moved under the thumb as the body reflowed, and a tap beside the grid could dismiss it mid-range.

Layer — `position: absolute; inset: 0`, `z-index: 70` over the form sheet's `60` (the source's own `80` over
`70`), `background: rgba(20,18,22,0.5)`, `backdrop-blur-sm`, `display:flex; align-items: flex-end`. `exact`.

Panel — `width:100%`, `bg-card`, `border-top-radius: 26` (`rounded-t-[26px]`), `padding: 14px 16px 22px`,
`box-shadow: 0 -10px 40px rgba(0,0,0,0.22)`. `exact`.

Grab handle — `40×4`, `border-radius: 99` (`rounded-full`), `background var(--flota-hair)`,
`margin: 0 auto 14px`. `exact`. (The **form** sheet still has none — S-12's D6.)

**No outside-click dismiss.** The layer stops the scrim's click, so only **Zastosuj** closes it and a stray tap
beside the grid cannot discard a half-made range. `exact` — the source stops propagation for the same reason.
A consequence worth recording: the layer covers the footer, so on mobile a create cannot even be _started_
while the picker is open.

**Not rendered while a create is in flight**, on the same terms as the desktop popover — Phase 1's freeze
(S-12 `deviation(busy-guard)`).

### Desktop modal anchoring while the picker is open

The scrim switches from centered to `align-items: flex-start; padding-top: 56` while a field is open, so the
grown modal does not overflow. `exact`.

---

## Surface — `MrAvailability`, available state

Box, icon and title (**Termin wolny**, `font-size:13 / weight:700 / letter-spacing:-0.1`, success) unchanged
from the S-12 contract.

**There is no subtitle** — see D10. The box is therefore single-line and takes `align-items: center`, like the
`checking` state and unlike the two-line `conflict` state, which keeps `flex-start` + its `padding-top: 1`.
`exact`.

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
4. **Surface 1 `deviation(busy-guard)`** — widened from the close button to the whole form (Phase 1, F11), and
   de-pluralized in Phase 6: one `Termin` field, and the freeze now also unmounts the mobile picker layer.

---

## Verbatim Polish copy (canonical)

**New in this slice:** `Kwiecień 2026` (caption pattern) · `Pn` · `Wt` · `Śr` · `Cz` · `Pt` · `So` · `Nd` ·
`Wybrane` · `Dzień odbioru / zwrotu — wciąż dostępny` · `W pełni zajęte` · `Zastosuj` · `1 dzień` / `{n} dni` ·
`Wybierz termin` (D18).

**Retired in Phase 6, with the available-state subtitle (D10):** ~~`Pojazd wolny do {d MMM}`~~ ·
~~`Brak innych rezerwacji w tym okresie.`~~

**Retired in Phase 6, with the second field:** the `mrFieldCap` captions ~~`Odbiór`~~ / ~~`Zwrot`~~ — the words
survive on this surface only inside `Odbiór od 14:00 · zwrot do 10:00`.

**Unchanged, governed by the S-12 contract:** `Termin` · `Odbiór od 14:00 · zwrot do 10:00` ·
`Termin wolny` · `Termin zajęty` · `Ten pojazd ma już rezerwację w wybranych dniach.` ·
`Sprawdzanie dostępności…` · `Wybierz pojazd i termin, aby sprawdzić dostępność.` ·
`Nie udało się sprawdzić dostępności.` · `Data zwrotu musi być późniejsza niż data odbioru.`

**Reused from `BookingWidget` (the veto hints):** `Wybrany dzień odbioru jest niedostępny. Wybierz inny termin.` ·
`Wybrany dzień zwrotu jest niedostępny. Wybierz inny termin.` ·
`Wybrany termin jest niedostępny. Wybierz inne daty.` — `deviation(reuse)`: the static source has no veto
state, and these three are already shipped and translated.
