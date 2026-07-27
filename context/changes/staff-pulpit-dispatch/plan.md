# Staff Pulpit → Dispatch Cockpit Implementation Plan

## Overview

Rebuild the `/dashboard` staff pulpit from a thin "Wymaga decyzji + two link cards"
page into the full **dispatch cockpit** the design specifies — KPI stat cards (desktop)
/ filter chips (mobile), a grouped Today's Schedule (Wydania/Zwroty), and the
Need-a-decision rail — for both desktop and mobile. It wires **already-existing** data
(`listDispatchToday`, `listReturnsToday`) into **new lightweight UI**, reuses
`NeedDecisionPanel` and the `ReturnQueue` filter pattern, and adds **no backend or
schema changes**.

## Current State Analysis

- `src/pages/dashboard.astro` renders a `max-w-2xl` single column: `NeedDecisionPanel`
  (pending queue) + two link cards ("Kalendarz", "Zarządzanie flotą"). On desktop the
  right half is empty; there are no KPI cards and no schedule.
- The reduction was deliberate at S-03: `NeedDecisionPanel.tsx:19-25` explicitly defers
  "greeting, Pickups/Returns/Overdue tiles, Today's Schedule" to S-05/S-06/S-07 — all
  now **done**, so the data exists but was never surfaced here.
- The data + components to build the cockpit already exist:
  - `listDispatchToday` (`src/lib/services/protocols.ts:123`) → `DispatchRow[]`;
    `protocol_id` null ⇒ awaiting handover, set ⇒ issued. `listReturnsToday` (`:361`) →
    `DispatchReturnRow[]`; `return_protocol_id` null ⇒ open. `countOverdueReturns`
    (`:385`). `listPendingReservations` (`src/lib/services/reservations.ts:132`).
  - `PickupQueue.tsx` / `ReturnQueue.tsx` render these rows on the full queue pages;
    `ReturnQueue` already ships a **FilterBar** (desktop segments + mobile pills, live
    counts, tone fills, `?filter` URL sync via `src/lib/returns-filter.ts`).
  - `returns.astro` already uses a **`max-w-[1440px]`** desktop layout + a hand-rolled
    Polish date eyebrow/label (workerd's trimmed ICU can't do Polish server-side).
  - `NeedDecisionPanel.tsx` is the Need-a-decision content, working at both breakpoints.
- Reservations are **date-only** (`booking_integrity_data.sql:94-95`); the only times
  are the fixed rule constants `pickup_date + 14:00` / `return_date + 10:00` (`:105`).
  There is no per-reservation clock time to render.

### Key Discoveries:

- Schedule completion state is free: `DispatchRow.protocol_id` /
  `DispatchReturnRow.return_protocol_id` truthiness (`PickupQueue.tsx:57`,
  `ReturnQueue.tsx:19-33`).
- The dashboard schedule row is **lighter** than the queue rows (no plates/delivery
  badges/resend) → a **new compact component**, not a reuse of `PickupQueue`/`ReturnQueue`
  rows, but sharing the same `DispatchRow`/`DispatchReturnRow` data and route targets.
- `ReturnQueue`'s FilterBar + `returns-filter.ts` (`captionOf`, `overdueDaysLabel`,
  `sortReturnsByUrgency`) are the adaptable basis for the mobile chips and the overdue
  "Po terminie" treatment.
- Polish date formatting is duplicated in `returns.astro:44-68` and `dashboard.astro:23-39`
  → extract once.
- `lessons.md`: exact-value design contract + vision-diff gate (Step 6, mandatory);
  container-query for panels sized by a column, not the viewport; SSR Polish dates via
  lookup tables; buttons keep the default cursor.

## Desired End State

`/dashboard` is the dispatch cockpit for a logged-in employee:

- **Desktop:** a greeting header (calendar button; no search), a row of 4 clickable KPI
  stat cards (Wydania / Zwroty / Wnioski **day totals**, Po terminie overdue count as a
  filled-crimson "PILNE" card), and a two-column body — grouped Today's Schedule
  (Wydania then Zwroty, each with an "N z M zakończone" progress header and compact
  status rows) on the left, `NeedDecisionPanel` on the right.
- **Mobile:** a date-eyebrow + "Pulpit" + avatar header, a single-select filter-chip row
  (Wszystko / Wydania / Zwroty / Wnioski with day-total badges, `?section` URL sync),
  and the corresponding sections; the two link cards are gone.
- Every element is a link to an already-built route (KPI cards → list pages; schedule
  rows → pending: `/dashboard/{pickups|returns}/[id]`, done: `/dashboard/protocols/[id]`).

Verify: sign in as `employee@fleetrent.test`, open `/dashboard` at 1440px and 390px, and
confirm both match the canonical mockups (`design-review/`) and every element navigates.

## What We're NOT Doing

- **No** nav/shell changes — `StaffShell` sidebar + mobile bar already match the design
  (verified against the live capture). The design's mobile **Profile** tab is **not**
  added (deferred).
- **No** search backend and **no** search field (deferred; header shows only the
  calendar button on desktop, no search icon on mobile).
- **No** new backend, RPC, migration, or type changes.
- **No** new automated tests (per decision) — pure count/grouping/filter helpers are
  extracted for clarity but ship untested; verification is the vision-diff gate.
- **No** change to the full queue pages (`/dashboard/pickups`, `/dashboard/returns`) or
  `NeedDecisionPanel`'s behavior.

## Implementation Approach

`dashboard.astro` fetches the four data sources, computes **remaining** counts + the
Polish date strings, sets `showHeader={false}` on `StaffShell`, and renders its own
greeting (desktop) / hero (mobile) headers plus one React island, `DispatchBoard`
(`client:load`, lightweight — no heavy deps, like `ReturnQueue`). `DispatchBoard` owns
both breakpoints and the mobile chip state, so the compact schedule row has a **single
source of truth** (no Astro/React duplication). `NeedDecisionPanel` nests inside it.

## Critical Implementation Details

- **Locale / SSR.** Compute the date eyebrow/label server-side with Polish lookup tables
  (never `Intl` — workerd's trimmed ICU); `today` is the server UTC date, matching the
  returns overdue split. The greeting is a **static "Dzień dobry, {imię}"** (not
  time-based) to avoid a UTC-vs-`Europe/Warsaw` hour hazard — recorded as a deviation.
- **Chip URL sync + hydration.** Mirror the active chip into `?section` via
  `history.replaceState` (no navigation, back button untouched) exactly as
  `ReturnQueue.tsx:443-452`; parse `?section` **server-side** in `dashboard.astro` and
  pass it as `initialSection` so a deep-link renders pre-filtered with no hydration flash
  (mirror `returns.astro:34`).
- **Counts semantics (decision revised 2026-07-26 → day totals).** KPI cards and chip
  badges show **day totals** — the row count of the view they open (pickups: all of
  today's dispatch rows; returns: all due-or-overdue rows; wnioski: all pending; po
  terminie: the overdue subset; `wszystko` = pickups + returns + wnioski). This matches
  the `ReturnQueue` filter convention (badge = rows shown) and the mockups. Progress
  ("what's left") lives only in the schedule: "N z M zakończone" + greyed done rows.
- **Review mode (loop).** Phases run back-to-back without per-phase manual pauses: each
  phase gates only on its automated checks; all Manual Verification items are batched
  into one final review after Phase 3 (vision-diff vs canonical mockups + navigation
  sweep). The design source is being updated in Claude Design during implementation —
  **before the final review, re-pull the JSX via DesignSync and refresh the
  `design-review/` canonicals**, then diff against those.
- **Container width, not viewport.** The desktop two-column grid is page-level
  (`dashboard.astro` owns the width like `returns.astro`), so page `lg:` breakpoints are
  safe. Guardrail: if any nested panel (`DispatchSchedule` row, a stat card) gains an
  _internal_ responsive split, drive it with `@container`/`@min-[Npx]:`, not `md:`/`lg:`.

## Phase 1: Shared helpers (no UI change)

### Overview

Extract the duplicated Polish date formatting and add the pure count/grouping/filter
logic the board will consume. No visual change.

### Changes Required:

#### 1. Polish date helper

**File**: `src/lib/pl-date.ts` (new)

**Intent**: Move the weekday/month lookup-table formatting (currently hand-rolled in
`returns.astro:44-68` and `dashboard.astro:24-39`) into one reusable module, so both
pages — and the new dashboard header — share it.

**Contract**: Export functions returning the two existing shapes: an uppercase eyebrow
`PT · 25 LIPCA` and a title-case short label `Pt, 25 lip`, plus the weekday/month arrays.
Keyed on a passed-in `Date` using `getUTCDay`/`getUTCDate`/`getUTCMonth` (unchanged
semantics). Update `returns.astro` to import from here (behavior identical).

#### 2. Dispatch board logic

**File**: `src/lib/dispatch-board.ts` (new)

**Intent**: Pure, typed derivation the board renders from — remaining counts, the
Wydania/Zwroty grouping with progress, and the chip-filter predicate.

**Contract**: Given `DispatchRow[]`, `DispatchReturnRow[]`, `PendingReservation[]`,
`overdueCount`, and `today`, expose: `dayCounts` (`{ pickups, returns, wnioski,
overdue, all }` — **day totals**: row counts of each view, `all = pickups + returns +
wnioski`, `overdue` = the passed-in overdue count); a
`scheduleGroups` builder returning `{ pickups, returns }` each with `rows`, `doneCount`,
`total`, and a `progressLabel` = `"{done} z {total} zakończone"`; and a `SectionKey`
type (`"wszystko" | "wydania" | "zwroty" | "wnioski"`) with a predicate for which
sections are visible for a given key. Reuse `captionOf` from `returns-filter.ts` for the
returns open/overdue split.

### Success Criteria:

#### Automated Verification:

- Lint passes: `npm run lint`
- Build passes: `npm run build`

#### Manual Verification:

- `/dashboard/returns` still renders the correct date eyebrow + desktop filter-bar date
  after the helper extraction (no visual regression).

---

## Phase 2: Desktop cockpit

### Overview

Wire the dispatch/returns data into `dashboard.astro` and build the desktop greeting
header, KPI stat cards, and two-column schedule / need-a-decision layout via
`DispatchBoard`.

### Changes Required:

#### 1. Data + shell wiring

**File**: `src/pages/dashboard.astro`

**Intent**: Fetch everything the cockpit needs, compute derived values, and hand them to
the board; suppress the shell's default title bar and render the desktop greeting header.

**Contract**: Extend the existing `Promise.all` to also call `listDispatchToday` and
`listReturnsToday` (mirror `pickups.astro:21-25`). Compute `dayCounts`,
`scheduleGroups`, the date strings (via `pl-date`), `today` (UTC), `initialSection` (from
`Astro.url.searchParams.get("section")`), and `displayName`/`initials` (via
`staffIdentity`). Set `StaffShell` `showHeader={false}`; use a `max-w-[1440px]` main like
`returns.astro:81`. Render a desktop-only greeting header: `Dzień dobry, {imię}` + static
subtitle `Oto Twój dzień w oddziale Warszawa` + a calendar icon-button linking to
`/dashboard/calendar` (no search field). Mount `<DispatchBoard client:load … />`.

#### 2. Dispatch board island

**File**: `src/components/dashboard/DispatchBoard.tsx` (new)

**Intent**: The one island that renders both breakpoints; this phase implements the
desktop branch and nests `NeedDecisionPanel`.

**Contract**: Props: `{ pickups, returns, pending, counts, groups, today, initialSection }`.
Desktop (`lg:` — page-level): the KPI `StatCards` row, then a two-column grid
`lg:grid-cols-[1.5fr_1fr] gap-5 mt-6` — left `DispatchSchedule`, right
`NeedDecisionPanel` (imported directly, not as a separate island). Exact per the design
JSX (`ScreenStaffDash`); see design-contract §D.

#### 3. KPI stat cards

**File**: `src/components/dashboard/StatCards.tsx` (new, or a sub-component of DispatchBoard)

**Intent**: The four clickable desktop KPI cards.

**Contract**: Four `<a>` cards in a `flex gap-4` row (each `flex-1`): Wydania →
`/dashboard/pickups`, Zwroty → `/dashboard/returns`, Wnioski → `/dashboard/reservations`,
Po terminie → `/dashboard/returns?filter=overdue`. Numbers are the **day totals**.
Card box (from the design `DashStat`): `min-h-[148px] rounded-[18px] pt-[18px] px-5 pb-4
shadow-card overflow-hidden`. Cards 1-3: white, a `h-1 opacity-90` top accent bar
(foreground / `success` / `warning`), number `text-[46px] font-[750] tracking-[-2px]
tabular-nums` in the tone color, label `text-[14.5px] font-[650]`, sub-label
`text-[10.5px]` uppercase (`DZIŚ` / `DZIŚ` / `OCZEKUJĄCE`), watermark glyph `size-32
opacity-[0.06]` at `-right-5 -bottom-[26px]` (Key / ArrowRight / List). Card 4
(Po terminie): filled `bg-primary`, no top bar, `shadow-[0_10px_26px_var(--flota-danger-soft)]`,
white number/label, `PILNE` pill (`h-5 bg-white/15` + white dot), `TriangleAlert size-32
opacity-[0.18]` watermark. Full exact values: design-contract §B.

#### 4. Compact schedule

**File**: `src/components/dashboard/DispatchSchedule.tsx` (new, or a sub-component)

**Intent**: The grouped Today's Schedule shared by both breakpoints.

**Contract**: On desktop, **one unified card** (`rounded-[18px] bg-card shadow-card
overflow-hidden`, per the design JSX — not per-row cards), under a `HARMONOGRAM NA DZIŚ`
column title. Two groups — Wydania (from `DispatchRow[]`) then Zwroty (from
`DispatchReturnRow[]`) — each opened by a tinted header band (`bg-[#E6EAF0] px-5 pt-3
pb-2.5` + hairlines; the tint is a deliberate JSX one-off, darker than `bg-background`):
a `size-[7px]` tone dot (foreground / `success`), the uppercase label (`WYDANIA` /
`ZWROTY`, no times — per the updated design), and the `progressLabel`
("N z M zakończone") right-aligned. Each item is a
whole-row `<a>` (`px-5 py-3.5`, hairline-divided, done rows `opacity-55`): status circle
(`size-6` ring when open, filled `success` + check when done), the 70×44 generic vehicle
glyph box (RPC returns no photo — like `ReturnQueue`'s `VehicleIcon`), name
(`text-[14px] font-[650]`), a muted `{make model} · {reference}` line, and a right
affordance — open: an outline `Protokół ›` button (`h-[34px]`); done: `Zakończone`
(green text); overdue-open return: the `Po terminie` danger chip. Link target: open
pickup → `/dashboard/pickups/{reservation_id}`, open return →
`/dashboard/returns/{reservation_id}`, done →
`/dashboard/protocols/{protocol_id | return_protocol_id}` (reuse
`overdueDaysLabel`/`captionOf` for the overdue split). Mobile reuses the same row
content in separate cards (`rounded-[16px] mb-2`, CTA `h-8`: `Protokół` filled /
`Zwrot` ghost / `Po terminie` danger). Full exact values: design-contract §C/§G.

### Success Criteria:

#### Automated Verification:

- Type-check + lint pass: `npm run lint`
- Build passes: `npm run build`
- `dashboard.astro` imports `listDispatchToday` + `listReturnsToday` (grep)

#### Manual Verification:

- Desktop `/dashboard` (1440px, signed in as employee) shows the greeting header, the 4
  KPI cards (open counts; Po terminie filled-crimson + PILNE), and the two-column
  schedule / need-a-decision — matching `design-review/target-staff-desktop-dashboard.jpg`.
- KPI cards navigate to their routes; schedule rows navigate (open → handover, done →
  protocol view); the empty right half is gone.
- No regression to the sidebar or to `/dashboard/pickups`, `/dashboard/returns`.
- Matches `design-contract.md` (vision-diff gate at implement time).

---

## Phase 3: Mobile cockpit + cleanup

### Overview

Add the mobile header, functional filter chips, and sections to `DispatchBoard`; remove
the two link cards and the stale mobile hero.

### Changes Required:

#### 1. Mobile header

**File**: `src/pages/dashboard.astro`

**Intent**: Replace the current mobile hero with the design's eyebrow + title + avatar.

**Contract**: Mobile-only header (`md:hidden`): date eyebrow (`PT · 25 LIPCA` via
`pl-date`), `Pulpit` title, and the crimson initials avatar (via `staffIdentity`). Drop
the email subtitle line and the two link cards (`dashboard.astro:73-93`). No search icon
(deferred).

#### 2. Board mobile branch

**File**: `src/components/dashboard/DispatchBoard.tsx`

**Intent**: The mobile chips + filtered sections.

**Contract**: Mobile (`< lg`, `lg:hidden`): a single-select chip row (Wszystko / Wydania
/ Zwroty / Wnioski) adapting `ReturnQueue`'s `MobilePill` — white card unselected,
**per-chip tone fill** selected (Wszystko/Zwroty → foreground, Wydania → primary,
Wnioski → warning; contract §F), a day-total badge each. Selecting a chip
mirrors to `?section` via `history.replaceState` and shows only that section; `wszystko`
(default, seeded from `initialSection`) shows all three: Wydania `DispatchSchedule` group,
Zwroty group, and Wnioski = `NeedDecisionPanel`. Each visible section leads with an
uppercase count header (e.g. `WYDANIA · {total}`, with its icon per contract §G). Empty-state per section reuses the
existing copy tone ("Brak wydań na dziś" / "Brak zwrotów na dziś" / NeedDecisionPanel's
own empty state).

### Success Criteria:

#### Automated Verification:

- Type-check + lint pass: `npm run lint`
- Build passes: `npm run build`

#### Manual Verification:

- Mobile `/dashboard` (390px) shows the eyebrow + "Pulpit" + avatar, the 4 chips, and the
  Wydania/Zwroty/Wnioski sections — matching `design-review/target-staff-mobile-dashboard.jpg`.
- Chips single-select and filter the visible sections; `Wszystko` shows all; a
  `?section=wydania` deep-link renders pre-filtered with no hydration flash.
- The two link cards are gone; overdue-open returns show "Po terminie"; a quiet day shows
  the per-section empty states.
- No sign-out/nav regression; the mobile bottom bar (StaffShell) is unchanged.
- Matches `design-contract.md` (vision-diff gate at implement time).

---

## Testing Strategy

Per decision, **no new automated tests**. The count/grouping/filter logic lives in pure,
typed helpers (`lib/dispatch-board.ts`) for clarity; correctness is verified by the
implement-phase **vision-diff gate** against the canonical mockups, plus typecheck/lint/
build. The dispatch/returns data path is already exercised by the existing pickups/returns
e2e.

### Manual Testing Steps:

1. Sign in as `employee@fleetrent.test`; open `/dashboard` at 1440px → cockpit matches
   the desktop mockup; every KPI card + schedule row navigates.
2. Resize to 390px → mobile header + chips + sections match the mobile mockup; chips
   filter; `?section` deep-link works.
3. Quiet-day check: with no open pickups/returns/pending, each section shows its empty
   state and KPI/chip counts read 0.

## Performance Considerations

`DispatchBoard` is `client:load` but dependency-light (no pdf-lib/heic2any), matching the
`ReturnQueue` precedent. Data is fetched once server-side in `dashboard.astro` via a
single `Promise.all`; no client fetching.

## Migration Notes

None — no schema, data, or type changes.

## References

- Design audit: `context/changes/staff-pulpit-dispatch/design-audit.md`
- Design contract: `context/changes/staff-pulpit-dispatch/design-contract.md`
- Canonical mockups: `context/changes/staff-pulpit-dispatch/design-review/`
- Data-fetch + layout precedent: `src/pages/dashboard/returns.astro`, `pickups.astro`
- Filter pattern: `src/components/dashboard/ReturnQueue.tsx`, `src/lib/returns-filter.ts`
- Reuse: `src/components/dashboard/NeedDecisionPanel.tsx`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Shared helpers (no UI change)

#### Automated

- [x] 1.1 Lint passes (`npm run lint`) — 1150e19
- [x] 1.2 Build passes (`npm run build`) — 1150e19

#### Manual

- [ ] 1.3 `/dashboard/returns` date eyebrow + filter-bar date unchanged after the helper extraction

### Phase 2: Desktop cockpit

#### Automated

- [x] 2.1 Type-check + lint pass (`npm run lint`) — 490800e
- [x] 2.2 Build passes (`npm run build`) — 490800e
- [x] 2.3 `dashboard.astro` imports `listDispatchToday` + `listReturnsToday` — 490800e

#### Manual

- [ ] 2.4 Desktop `/dashboard` shows greeting + 4 KPI cards + two-column schedule/need-a-decision, matching the desktop mockup
- [ ] 2.5 KPI cards + schedule rows navigate correctly (open → handover, done → protocol view); empty right half gone
- [ ] 2.6 No regression to sidebar or the pickups/returns pages; matches `design-contract.md`

### Phase 3: Mobile cockpit + cleanup

#### Automated

- [x] 3.1 Type-check + lint pass (`npm run lint`) — 7ed9a21
- [x] 3.2 Build passes (`npm run build`) — 7ed9a21

#### Manual

- [ ] 3.3 Mobile `/dashboard` shows eyebrow + "Pulpit" + avatar, chips, and Wydania/Zwroty/Wnioski sections, matching the mobile mockup
- [ ] 3.4 Chips single-select + filter; `Wszystko` shows all; `?section` deep-link renders pre-filtered with no flash
- [ ] 3.5 Link cards removed; overdue returns show "Po terminie"; quiet-day empty states render
- [ ] 3.6 No sign-out/nav regression; matches `design-contract.md`
