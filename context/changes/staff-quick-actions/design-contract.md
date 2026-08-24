# Design Contract — Staff quick-action menu (S-12b)

> Plan: `plan.md` · Change log: `change.md` · Research: `research.md`
> Design source: Claude Design project `Rental car company` (`352d78a6-84fd-49a2-8b38-2fe289691fc3`)
> — `manual-reservation.jsx` (`QuickAddButton`, `QuickMenuList`, `MR_MENU`),
> `quick-actions-variants.jsx` (absorb rows + boards), `staff-desktop.jsx` (`StaffTopbar`).
> All values below are transcribed from that JSX, pulled live 2026-08-24. **Polish copy is canonical.**

---

## Design Alignment Audit

### 1. Freshness — repo designs vs canonical

| Artifact                                                           | Status                    | Note                                                                                                                                                                                                      |
| ------------------------------------------------------------------ | ------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `design-review/desktop-01-quick-action-menu.png`                   | **current**               | Re-rendered 2026-08-24. Verified by inspection: 2 rows, no `NOWE` badge, chevron rotated up, 38×38 calendar button left of the pill. Supersedes the archived 4-item export.                               |
| `design-review/mobile-01-quick-action-sheet.png`                   | **current**               | Re-rendered 2026-08-24 from `MrM_Menu`.                                                                                                                                                                   |
| `design-review/mobile-flota-absorb-{closed,sheet}.png`             | **current**               | The two shipped absorb states for Flota.                                                                                                                                                                  |
| `design-review/mobile-zespol-absorb-{closed,sheet}.png`            | **current**               | The two shipped absorb states for Zespół.                                                                                                                                                                 |
| `design-review/desktop-{fleet-mgmt,overdue}-with-quickadd.png`     | **current**               | Desktop pill in the shell band.                                                                                                                                                                           |
| `design-review/variant-qa-v0…v6-*.png`                             | **current, historical**   | The decision record for the collision rule. `v6` boards are the _rejected_ option — see `change.md`. Do not plan against them.                                                                            |
| `context/archive/2026-08-10-manual-reservation/` quick-action PNGs | **outdated (superseded)** | 4-item menu + crimson `NOWE` badge. `MR_MENU` now has 2 items and no badge field. Superseded by `design-review/desktop-01`.                                                                               |
| `design/screenshots/21-staff-desktop-requests.jpg`                 | **outdated (superseded)** | Predates the trigger entirely — English copy, `[Szukaj…][calendar]` cluster, no pill.                                                                                                                     |
| `design/screenshots/20-staff-desktop-dashboard.jpg`                | **outdated (superseded)** | Calendar icon alone, no pill.                                                                                                                                                                             |
| `design/screenshots/09-staff-mobile-dashboard.png`                 | **not a design source**   | Stale export of the _shipped app_, not a design render — different data, English copy, a filter button where the project has a spacer. `design-system.md` row 09 misattributes it to `staff-screens.jsx`. |
| `design/screenshots/10-staff-mobile-pending-queue.png`             | **not a design source**   | Same defect as row 09.                                                                                                                                                                                    |
| `design-system.md` row for `manual-reservation.jsx`                | **missing**               | The index runs rows 01–29 with no row for this file, so `CLAUDE.md`'s mandatory index does not point at this mockup.                                                                                      |

**Index corrections owed** (recorded, not blocking): add a `manual-reservation.jsx` row; re-label rows
09/10 as shipped-app exports rather than design sources.

### 2. Quality — gaps in the canonical designs themselves

| Gap                                                                                                                                         | Resolution                                                                       |
| ------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| No **empty-fleet** state drawn for the menu                                                                                                 | `deviation(empty-state)` — disabled row + hint (D3 below)                        |
| No **loading** state drawn for the reservation row                                                                                          | `deviation(async-affordance)` — spinner per the project's async-button rule (D4) |
| No **hover / focus-visible** state defined on the pill or rows (the source declares hover only as an inline `onMouseEnter` background swap) | `deviation(a11y)` — adopt the shared `Button` states (D5)                        |
| No **error** state for a failed fetch                                                                                                       | `deviation(error-state)` — retryable message (D6)                                |
| Desktop popover has **no `promoted` branch**                                                                                                | Not a gap — deliberate. Preserved verbatim (E12).                                |

### 3. Alignment — every canonical surface has a phase, and vice-versa

| Canonical surface                                            | Plan phase  | Status                                                                    |
| ------------------------------------------------------------ | ----------- | ------------------------------------------------------------------------- |
| Desktop pill, closed (`StaffTopbar` right cluster)           | Phase 2 + 3 | aligned                                                                   |
| Desktop popover, open (`desktop-01`)                         | Phase 2     | aligned                                                                   |
| Mobile circle, closed                                        | Phase 2 + 4 | aligned                                                                   |
| Mobile sheet, open (`mobile-01`)                             | Phase 2     | aligned                                                                   |
| Flota mobile absorb — closed + sheet                         | Phase 4     | aligned                                                                   |
| Zespół mobile absorb — closed + sheet                        | Phase 4     | aligned                                                                   |
| Desktop board with pill (`ScreenFleetMgmt`, `ScreenOverdue`) | Phase 3     | aligned                                                                   |
| Calendar-cell confirm (`MrD_Confirm`)                        | —           | **out of scope**, still deferred under D4                                 |
| Mobile Pulpit (`ScreenWorkerDash`)                           | Phase 4     | **divergence recorded** — the design omits the affordance; we add it (D8) |

**Verdict: PASS** — 6 surfaces built, 4 repo designs superseded, 2 misattributed, 1 index row missing,
8 deviations recorded.

---

## Token map

| Design token        | Value                 | App token                                           |
| ------------------- | --------------------- | --------------------------------------------------- |
| `tokens.ink`        | `#0F172A`             | `--flota-ink` → `bg-foreground` / `text-foreground` |
| `tokens.ink2`       | `#334155`             | `--flota-ink-2`                                     |
| `tokens.muted`      | `#94A3B8`             | `--flota-muted` → `text-muted-foreground`           |
| `tokens.card`       | `#FFFFFF`             | `--flota-card` → `bg-card`                          |
| `tokens.bg`         | `#F1F3F6`             | `--flota-bg` → `bg-background`                      |
| `tokens.hair`       | `rgba(15,23,42,0.08)` | `--flota-hair`                                      |
| `tokens.hair2`      | `rgba(15,23,42,0.05)` | `--flota-hair-2`                                    |
| `tokens.accent`     | `#B43638`             | `--flota-accent` → `text-primary`                   |
| `tokens.accentSoft` | `#FBE4E1`             | `--flota-accent-soft`                               |
| `tokens.greySoft`   | `#EEF1F5`             | `--flota-neutral-soft`                              |
| `tokens.shadow1`    | soft navy 2-layer     | `shadow-card`                                       |
| `tokens.shadow3`    | soft navy 2-layer     | `shadow-overlay`                                    |

Radius note: `global.css:165-173` overrides the scale — `rounded-md` = 12px, `rounded-sm` = 8px. Where
the design gives a radius with no token equivalent (10, 11, 16, 26), use the arbitrary value.

---

## Verbatim Polish copy (canonical)

| String                                                                    | Where                     | Source                                    |
| ------------------------------------------------------------------------- | ------------------------- | ----------------------------------------- |
| `Nowe`                                                                    | desktop pill label        | `manual-reservation.jsx` `QuickAddButton` |
| `Szybka akcja` → rendered **`SZYBKA AKCJA`** (`textTransform: uppercase`) | mobile sheet eyebrow      | same                                      |
| `Nowa rezerwacja`                                                         | menu row 1 label          | `MR_MENU`                                 |
| `Dodaj wynajem ręcznie`                                                   | menu row 1 desc           | `MR_MENU`                                 |
| `Dodaj pojazd`                                                            | menu row 2 label          | `MR_MENU`                                 |
| `Nowy pojazd do floty`                                                    | menu row 2 desc           | `MR_MENU`                                 |
| `Dodaj pracownika`                                                        | Zespół promoted row label | `QAV_EMPLOYEE`                            |
| `Zaproś do zespołu`                                                       | Zespół promoted row desc  | `QAV_EMPLOYEE`                            |

Store the eyebrow as sentence-case `Szybka akcja` and uppercase via CSS, exactly as the source does.

---

## Surface 1 — Desktop pill (`QuickAddButton mode="desktop"`, closed)

| Property                       | Value                                                      | Mark                       |
| ------------------------------ | ---------------------------------------------------------- | -------------------------- |
| height                         | `38px`                                                     | `exact`                    |
| padding                        | `0 14px 0 12px`                                            | `exact`                    |
| border-radius                  | `10px`                                                     | `exact`                    |
| border                         | none                                                       | `exact`                    |
| background                     | `tokens.ink` → `bg-foreground`                             | `exact`                    |
| color                          | `#fff`                                                     | `exact`                    |
| font-size / weight             | `13px` / `650`                                             | `exact`                    |
| display / gap                  | `inline-flex`, `align-items: center`, `gap: 7px`           | `exact`                    |
| leading icon                   | plus, `15px`, `#fff`, `strokeWidth 1.7`                    | `exact`                    |
| label                          | `Nowe`                                                     | `exact`                    |
| trailing chevron               | chevron-down `13px` @ `rgba(255,255,255,0.7)`              | `exact`                    |
| chevron open state             | `transform: rotate(180deg)`, `transition: transform .15s`  | `exact`                    |
| box-shadow                     | none                                                       | `exact`                    |
| positioning                    | wrapped in `position: relative` — **not** fixed, not a FAB | `exact`                    |
| hover / active / focus-visible | **not defined in source**                                  | `deviation(a11y)` → **D5** |

**D5 `deviation(a11y)`** — the source defines no interactive states, and S-12's raw `<button>`
(`NewReservationButton.tsx:30`) shipped with no focus ring, hover, active, or transition. Use the shared
`Button` primitive (`src/components/ui/button.tsx`) so `focus-visible` is present. Buttons keep the
**default cursor** per the standing project decision — do not add `cursor-pointer`.

### Placement in the band

| Property                                     | Value                                                    | Mark                                                                                    |
| -------------------------------------------- | -------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| host                                         | `StaffTopbar` right cluster — last child, unconditional  | `exact`                                                                                 |
| cluster gap                                  | `12px`                                                   | `exact`                                                                                 |
| band padding                                 | `22px 32px` → `px-8 py-[22px]`                           | `exact` (already matches `StaffShell.astro:163`)                                        |
| band title                                   | `21px` / `700`, `letterSpacing: -0.5`, `lineHeight: 1.1` | `exact` — app currently uses `tracking-tight` with no line-height; corrected in Phase 3 |
| band subtitle                                | `13px`, `tokens.muted`, `marginTop: 3px`                 | `exact`                                                                                 |
| 38×38 calendar icon button, left of the pill | present in source                                        | `deviation(scope)` → **D7**                                                             |

**D7 `deviation(scope)`** — the design's cluster is `[38×38 calendar][pill]`. Only Pulpit has such a
button today; adding it console-wide is explicitly out of scope in `staff-global-search/plan.md`. Not
reversing a sibling change's decision here. Pulpit keeps its existing button, which lands in the same
slot at the same `gap: 12`.

---

## Surface 2 — Desktop popover (open)

| Property      | Value                                        | Mark              |
| ------------- | -------------------------------------------- | ----------------- |
| position      | `absolute`, `top: 44px`, `right: 0`          | `exact`           |
| width         | `278px`                                      | `exact`           |
| background    | `tokens.card` → `bg-card`                    | `exact`           |
| border-radius | `16px`                                       | `exact`           |
| box-shadow    | `tokens.shadow3` → `shadow-overlay`          | `exact`           |
| padding       | `8px`                                        | `exact`           |
| z-index       | `41` (click-catcher `40`)                    | `exact`           |
| click-catcher | `position: fixed`, `inset: 0`                | `exact`           |
| rows          | canonical `MR_MENU` only — **no `promoted`** | `exact` → **E12** |

**E12 (exact, load-bearing)** — the source's desktop branch calls `<QuickMenuList onPick={pick} />`
with no `promoted` argument, so desktop can never absorb a page action. Preserve this: `QuickAddButton`
in `mode="desktop"` ignores `promoted` entirely. This is what makes the crimson primary row _stable_ on
desktop while it varies by screen on mobile (see D9).

Implementation note: `radix-ui` `Popover` (`src/components/ui/popover.tsx`) portals its content, so the
source's absolute `top: 44 / right: 0` maps to `align="end"` + a `sideOffset` yielding a 44px top offset
from the trigger's top edge. Override the wrapper's default `w-72` (288px) and `p-4` to `278px` / `8px`.

---

## Surface 3 — Mobile circle (`QuickAddButton mode="mobile"`, closed)

| Property        | Value                                      | Mark                               |
| --------------- | ------------------------------------------ | ---------------------------------- |
| size            | `40 × 40`                                  | `exact`                            |
| border-radius   | `99px` → `rounded-full`                    | `exact`                            |
| background      | `tokens.ink` → `bg-foreground`             | `exact`                            |
| box-shadow      | `0 2px 6px rgba(10,10,15,0.14)`            | `exact`                            |
| icon            | plus, `19px`, `#fff`, icon-only (no label) | `exact`                            |
| accessible name | `aria-label` required — source has none    | `deviation(a11y)` → part of **D5** |

**Size reconciliation (settled).** Flota and Zespół ship this control at **48×48** (`size-12` +
`Plus size-5`) today (`FleetList.tsx:292`, `StaffList.tsx:591`). Under absorb they become this same
control, so they move **48 → 40** with the design's shadow (replacing `shadow-accent` on Flota) and a
19px glyph. One size console-wide; marked `exact`, with the change from shipped noted here so the
vision-diff does not re-flag it.

---

## Surface 4 — Mobile bottom sheet (open)

| Property         | Value                                                                                 | Mark    |
| ---------------- | ------------------------------------------------------------------------------------- | ------- |
| scrim            | `inset: 0`, `z-index: 70`, `rgba(20,18,22,0.5)`, `backdrop-filter: blur(6px)`         | `exact` |
| scrim layout     | `flex`, `align-items: flex-end`                                                       | `exact` |
| sheet width      | `100%`                                                                                | `exact` |
| sheet background | `tokens.card` → `bg-card`                                                             | `exact` |
| top radii        | `26px` both corners → `rounded-t-[26px]`                                              | `exact` |
| sheet padding    | `16px 16px 26px`                                                                      | `exact` |
| sheet shadow     | `0 -10px 40px rgba(0,0,0,0.2)`                                                        | `exact` |
| grabber          | `40 × 4`, `radius 99`, `tokens.hair`, `margin: 0 auto 12px`                           | `exact` |
| eyebrow          | `12px` / `700`, `tokens.muted`, `letterSpacing: 0.4`, uppercase, `padding: 0 6px 6px` | `exact` |
| eyebrow copy     | `Szybka akcja` (rendered uppercase)                                                   | `exact` |

In-repo precedent for this exact idiom: `ManualReservationModal.tsx:679-681`. Note its shadow is
`rgba(0,0,0,0.22)`; this sheet's is **`0.2`** — port the value, don't reuse by eye.

---

## Surface 5 — Menu rows (`QuickMenuList`, shared by popover + sheet)

| Property                      | Value                                                                                                             | Mark              |
| ----------------------------- | ----------------------------------------------------------------------------------------------------------------- | ----------------- |
| row layout                    | `flex`, `align-items: center`, `gap: 12px`                                                                        | `exact`           |
| row padding                   | `11px 12px`                                                                                                       | `exact`           |
| row radius                    | `12px`                                                                                                            | `exact`           |
| row background                | `transparent`; hover → `tokens.bg` (`bg-background`)                                                              | `exact`           |
| text-align                    | `left`                                                                                                            | `exact`           |
| **divider**                   | `borderTop: 1px solid tokens.hair2` **at index 1 only**, plus `marginTop: 4px` and `paddingTop: 13px` on that row | `exact` → **E13** |
| icon tile                     | `38 × 38`, `radius 11`, `flex-shrink 0`, centred                                                                  | `exact`           |
| tile background — primary     | `tokens.accentSoft` (`#FBE4E1`)                                                                                   | `exact`           |
| tile background — non-primary | `tokens.greySoft` (`#EEF1F5`)                                                                                     | `exact`           |
| tile icon                     | `18px`; `tokens.accent` when primary, `tokens.ink2` otherwise                                                     | `exact`           |
| label                         | `13.5px` / `650`, `tokens.ink`, `letterSpacing: -0.1`                                                             | `exact`           |
| description                   | `11.5px`, `tokens.muted`, `marginTop: 1px`                                                                        | `exact`           |

**E13 (exact, easy to get wrong)** — the divider rule is **positional, not structural**: it fires on
`i === 1` only. A 3-row Zespół sheet therefore has **one** divider (after row 1), not two. Do not
generalize this to "between every pair".

### Row set and order

| Context                                                                      | Rows (in order)                                       | Primary            |
| ---------------------------------------------------------------------------- | ----------------------------------------------------- | ------------------ |
| Desktop, every page                                                          | `Nowa rezerwacja`, `Dodaj pojazd`                     | `Nowa rezerwacja`  |
| Mobile — no page create action (Pulpit, Wnioski, Wydania, Zwroty, Kalendarz) | `Nowa rezerwacja`, `Dodaj pojazd`                     | `Nowa rezerwacja`  |
| Mobile — Flota                                                               | `Dodaj pojazd`, `Nowa rezerwacja`                     | `Dodaj pojazd`     |
| Mobile — Zespół                                                              | `Dodaj pracownika`, `Nowa rezerwacja`, `Dodaj pojazd` | `Dodaj pracownika` |

Flota yields 2 rows because the promoted key `vehicle` collides with a canonical row and is
de-duplicated; Zespół yields 3 because `employee` is a new key. Both come from one code path.

**D9 `deviation(context-primary)`** — the crimson `accentSoft` tile marks _the most likely action_, not
a fixed one, so on mobile it moves between rows by screen while on desktop it never moves. This is the
source's own semantics (`primary: true` is a per-context flag), not an inconsistency. Recorded so the
vision-diff does not re-flag it. Rejected alternatives: pinning crimson to `Nowa rezerwacja` (would make
the loudest row not the first one); dropping crimson from the menu (consistent, but discards the accent
for no gain).

---

## Deviations register

| ID      | Mark                          | Scope              | Rationale                                                                                                                                                                                                                                                                               |
| ------- | ----------------------------- | ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **D3**  | `deviation(empty-state)`      | Menu               | No bookable vehicles → `Nowa rezerwacja` renders disabled with a hint. The design draws no empty state, and S-12's whole-component `return null` would erase the affordance console-wide — taking `Dodaj pojazd`, the action that fixes an empty fleet, with it.                        |
| **D4**  | `deviation(async-affordance)` | Reservation row    | The row triggers a fetch, so it shows a pending state (`animate-spin` ring, per the project's async-button rule). The design's menu is synchronous and draws none.                                                                                                                      |
| **D5**  | `deviation(a11y)`             | Pill, circle, rows | Source defines no hover/active/focus-visible and no accessible name for the icon-only circle. Use the shared `Button` primitive and an `aria-label`. Default cursor retained per project decision.                                                                                      |
| **D6**  | `deviation(error-state)`      | Reservation row    | A failed fetch surfaces a retryable message rather than opening an empty modal. Not drawn.                                                                                                                                                                                              |
| **D7**  | `deviation(scope)`            | Band cluster       | The 38×38 calendar icon button is not added console-wide — out of scope per `staff-global-search/plan.md`.                                                                                                                                                                              |
| **D8**  | `deviation(reach)`            | Mobile Pulpit      | The design omits the affordance on `ScreenWorkerDash` because `Dyspozytornia` (273px, unbreakable, at `fontSize: 40`) already clips its avatar at 390px. Our title is `Pulpit`, so the constraint does not transfer; we add the circle, with the 360px fit as a hard success criterion. |
| **D9**  | `deviation(context-primary)`  | Menu tiles         | The crimson primary tile moves between rows by screen on mobile. Source semantics; see above.                                                                                                                                                                                           |
| **D10** | `deviation(scope)`            | Task screens       | No quick-add on `vehicles/new`, `vehicles/[id]/edit`, `protocols/[id]`, `pickups/[reservationId]`, `returns/[reservationId]`. Their headers own back/close/submit over unsaved state. The design likewise gives protocol/detail flows a `close` right slot, never a create action.      |

**Carried forward from S-12, still in force:** D4 of
`context/archive/2026-08-10-manual-reservation/design-contract.md:84-85` covered _both_ the quick-action
menu and the calendar-cell confirm. This change **closes the menu half**; the calendar-cell path
(`ReservationCalendar.tsx:325-326`) stays deferred.

**Corrected from S-12:** that contract's Surface 4 line (`:197-201`) is the only spec line in the
document carrying no `exact` / `deviation` mark, and it described a placement — page `<main>` row,
label `Nowa rezerwacja` — that this change supersedes. The pill's geometry it recorded was accurate and
is preserved above; its placement clause is now void.

---

## Vision-diff gate (Phase 5)

Render and diff each against its canonical PNG in `design-review/`:

| Render                        | Canonical board                           | Breakpoint |
| ----------------------------- | ----------------------------------------- | ---------- |
| Desktop pill, closed          | `desktop-overdue-with-quickadd.png`       | ≥ md       |
| Desktop popover, open         | `desktop-01-quick-action-menu.png`        | ≥ md       |
| Mobile circle, closed         | `mobile-pending-queue-with-quickadd.png`  | 390px      |
| Mobile sheet, open            | `mobile-01-quick-action-sheet.png`        | 390px      |
| Flota absorb, closed + sheet  | `mobile-flota-absorb-{closed,sheet}.png`  | 390px      |
| Zespół absorb, closed + sheet | `mobile-zespol-absorb-{closed,sheet}.png` | 390px      |

Iterate to an empty punch-list minus D3–D10. Render mockups with the app's own self-hosted **variable**
Inter — the CDN's static instances snap the 540/650/750 weights this system depends on and will skew
every board.
