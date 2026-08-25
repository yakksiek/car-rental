---
date: 2026-08-21T18:23:46+02:00
researcher: MarcinK
git_commit: c7ca1a76044a6f82b37b6fc8c6fcd1e9f6eca1b2
branch: feature/manual-reservation
repository: fleet-rent-manual-reservation
topic: "Where the manual-reservation button lives, and whether that matches the Claude Design mocks"
tags: [research, codebase, manual-reservation, design-fidelity, staff-shell, entry-point]
status: complete
last_updated: 2026-08-21
last_updated_by: MarcinK
---

# Research: Where the manual-reservation button lives vs. the Claude Design mocks

**Date**: 2026-08-21T18:23:46+02:00
**Researcher**: MarcinK
**Git Commit**: `c7ca1a76044a6f82b37b6fc8c6fcd1e9f6eca1b2`
**Branch**: `feature/manual-reservation`
**Repository**: `fleet-rent-manual-reservation`

## Research Question

> Recently I've added an option to add a manual reservation. Please check where the button for
> manual reservation lives and if it is aligned with the mocks in the Claude Design.

Scope agreed at the start of the session: **the entry point / trigger only** — not a re-audit of
the modal (S-12 and S-12a already carry design contracts and vision-diffs for that). Verification
method: **live `DesignSync` pull**, not repo screenshots.

## Summary

The button lives in exactly one place — `src/pages/dashboard/reservations.astro:52`, right-aligned
in a row of its own at the top of the page's `<main>`, above `<PendingQueue>`. It is the app's
**only** path into the manual-reservation flow.

Against the live design source the verdict splits three ways:

1. **The page is right.** The design's own desktop board for this exact screen —
   `ScreenStaffRequests` in `staff-desktop.jsx`, `StaffShell active="requests"` — does carry the
   trigger. This is worth stating plainly because the S-12 design contract's D4 reads as though the
   reservations page were a scope-driven substitution for a calendar-hosted mockup. It wasn't: the
   design puts the trigger on the Wnioski screen too.
2. **The band is wrong.** The design puts it _inside_ the page header band (`StaffTopbar`, a
   `justify-content: space-between` bar with title/subtitle left and an action cluster right). Our app
   puts it in a **second row underneath** that band, inside `<main>`. Our shell header
   (`src/components/shell/StaffShell.astro:163-169`) is structurally the _same_ band as the design's
   — same `justify-between`, same `px-8 py-[22px]`, same `bg-card` + `border-b` — but it renders only
   its left-hand child. **The design's action slot already exists in our shell and is empty.**
3. **The scope is much narrower.** In the design `QuickAddButton` is an _unconditional_ child of
   `StaffTopbar`, so it rides the header band onto every desktop staff board that renders it. In our
   app the trigger exists on one route and nowhere else.

Two further divergences, both unrecorded: the design's **mobile** trigger is a 40×40 icon-only ink
circle (and its mobile pending-queue board has no trigger at all), while ours keeps the full labelled
pill at every width — where on mobile it renders _above_ the page's own `<h1>`. And the design's pill
is labelled **`Nowe`** with a trailing chevron; ours is labelled **`Nowa rezerwacja`** with no chevron.

The pill's own pixel values, on the other hand, are a **faithful, exact port** — height, radius,
padding, colour, type, gap and icon size all match the source to the unit.

## Detailed Findings

### 1. Where the button lives

**One mount site in the whole repo.**

|            |                                                                            |
| ---------- | -------------------------------------------------------------------------- |
| Component  | `src/components/dashboard/NewReservationButton.tsx:19`                     |
| Mounted at | `src/pages/dashboard/reservations.astro:52`                                |
| Route      | `/dashboard/reservations`                                                  |
| Screen     | "Oczekujące wnioski" — the staff pending-request triage queue (slice S-03) |
| Nav tab    | `active="requests"` → **Wnioski** (`reservations.astro:37`)                |

DOM position:

```
<StaffShell active="requests" title="Oczekujące wnioski" subtitle="N oczekuje na decyzję">
  <header … md:flex>                                    StaffShell.astro:163  ← the shell's title band
    <div>title + subtitle</div>                         StaffShell.astro:165-167
  </header>                                             (no second child)
  <main class="mx-auto w-full max-w-7xl px-4 py-6 md:px-8">   reservations.astro:45
    <div class="mb-4 flex justify-end">                 reservations.astro:51  ← the button's own row
      <NewReservationButton client:load vehicles={fleet} />  reservations.astro:52
    </div>
    <PendingQueue client:load … />                      reservations.astro:59
  </main>
</StaffShell>
```

`ManualReservationModal` (`src/components/dashboard/ManualReservationModal.tsx:243`) has exactly one
importer — `NewReservationButton.tsx:6` — so this button is the sole door into the flow.

**Gating.** Route role gate `{ prefix: "/dashboard/reservations", role: "employee" }`
(`src/lib/access.ts:33`), enforced in `src/middleware.ts:42-54`; `admin` ⊇ `employee` via `ROLE_RANK`
(`access.ts:18-21`), so both roles see it. Plus a local early return: `if (vehicles.length === 0)
return null` (`NewReservationButton.tsx:24-26`) — an unconfigured Supabase or a fleet with no active
vehicles hides the button entirely (`src/lib/services/vehicles.ts:369-379`).

**No other entry point exists.** Verified exhaustively: not in the shell nav
(`StaffShell.astro:38-56` is six or seven plain `href` links, no create action), not in the pulpit
cockpit (`src/pages/dashboard.astro:77-83`'s only header affordance is a calendar link), not on the
calendar — where cell clicks are _deliberately_ disabled (`ReservationCalendar.tsx:325-326`
`disableDragAndDrop` / `disableCellClick`, and the library's own `+ New` button is stripped by a
custom `headerComponent`, `ReservationCalendar.tsx:26`) — and there is no FAB anywhere in `src/`.

### 2. What the live design actually draws

Pulled fresh from Claude Design project `Rental car company`
(`352d78a6-84fd-49a2-8b38-2fe289691fc3`). The trigger is defined in `manual-reservation.jsx` as
`QuickAddButton` and _mounted_ by `staff-desktop.jsx`.

**Where it is mounted — verbatim from `staff-desktop.jsx`:**

```jsx
function StaffTopbar({ title, sub, search = false, searchQuery = '', searchFocused = false }) {
  …
  <div style={{
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '22px 32px', borderBottom: `1px solid ${tokens.hair2}`, background: tokens.card,
  }}>
    <div>
      <div style={{ fontSize: 21, fontWeight: 700, color: tokens.ink, letterSpacing: -0.5, lineHeight: 1.1 }}>{title}</div>
      {sub && <div style={{ fontSize: 13, color: tokens.muted, marginTop: 3 }}>{sub}</div>}
    </div>
    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      {search && <SearchField query={searchQuery} focused={searchFocused} width={520} sx={sx} />}
      <div style={{ width: 38, height: 38, borderRadius: 10, border: `1px solid ${tokens.hair}`, … }}>
        <Icon.calendar s={16} c={tokens.ink2} />
      </div>
      <QuickAddButton mode="desktop" onNew={() => mr.open({ step: 'form' })} />
    </div>
  </div>
```

Three things follow from this:

- `QuickAddButton` is **unconditional** — the last child of the right cluster, with no guard and no
  prop to suppress it. Only `SearchField` is gated (`{search && …}`, default `false`).
- `StaffTopbar` **is the title/subtitle band**, not a separate toolbar. It is the design's counterpart
  to our `StaffShell.astro:163-169` `<header>`.
- The right cluster always ends `[38×38 calendar icon button] [Nowe pill]`.

**The Wnioski board renders it.** `ScreenStaffRequests` is `StaffShell active="requests"` + a 380px
master list + a detail pane, and its first child is:

```jsx
<StaffTopbar title={t.pending} sub={`4 ${t.needsDecision.toLowerCase()}`} />
```

`t.pending` → `Oczekujące`, `t.needsDecision` → `Wymaga decyzji`, so it renders
`[Oczekujące / 4 wymaga decyzji] … [calendar icon] [+ Nowe ▾]` with no search field.

**Verbatim trigger spec — desktop pill (`QuickAddButton`, `mode="desktop"`):**

```
height: 38
padding: '0 14px 0 12px'
borderRadius: 10
border: none
background: tokens.ink          // #0F172A
color: '#fff'
fontSize: 13
fontWeight: 650
display: 'inline-flex', alignItems: 'center', gap: 7
```

- leading icon `<Icon.plus s={15} c="#fff" />`, `strokeWidth 1.7`
- label, verbatim: **`Nowe`**
- trailing `<Icon.chevD s={13} c="rgba(255,255,255,0.7)" />`, `transform: open ? 'rotate(180deg)' : 'none'`, `transition: 'transform .15s'`
- no `boxShadow`, no letter-spacing declared, no hover/active state defined
- wrapped in `<div style={{ position: 'relative' }}>` — **not** `position: fixed`, not a FAB

It opens a popover: `position absolute, top 44, right 0, width 278, borderRadius 16, boxShadow
tokens.shadow3, padding 8, zIndex 41`, over a `position fixed, inset 0, zIndex 40` click-catcher.

**Verbatim trigger spec — mobile (`QuickAddButton`, `mode="mobile"`):**

```
width: 40, height: 40, borderRadius: 99
background: tokens.ink
boxShadow: '0 2px 6px rgba(10,10,15,0.14)'
icon: <Icon.plus s={19} c="#fff" />   // icon-only, no label
```

Inline in `AdminHeader`'s `right` slot, baseline-aligned with the `Kalendarz` `<h1>`. It opens a
bottom sheet (`borderTopRadius 26`, `padding '16px 16px 26px'`, 40×4 grabber, eyebrow **`SZYBKA
AKCJA`** at 12/700 uppercase `tokens.muted`).

**The menu behind it (`MR_MENU`) now has two items, not four:**

```js
const MR_MENU = [
  { key: "res", icon: Icon.calendar, label: "Nowa rezerwacja", desc: "Dodaj wynajem ręcznie", primary: true },
  { key: "vehicle", icon: Icon.truck, label: "Dodaj pojazd", desc: "Nowy pojazd do floty" },
];
```

**Second and third entry points in the design.** `desktop-screens.jsx` `ScreenCalendar` wires every
day cell in every vehicle row: `onClick={() => openCell(row.v, i)} title="Dodaj rezerwację"` (L249),
`openCell` → `setFlow({ step: 'confirm', … })` (L138), producing the **"Dodać rezerwację ręczną?"**
confirm card. And `admin-mobile.jsx`'s month view carries a small `Dodaj` button (h30, r8, hairline
border) in the day-agenda header that skips the confirm and lands on a date-prefilled form.

### 3. Alignment verdict

| Dimension                  | Design (live source)                                                                      | App                                                                                                                                 | Aligned?                                               |
| -------------------------- | ----------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| **Host page**              | `ScreenStaffRequests` (Wnioski) carries it, among others                                  | `/dashboard/reservations` (Wnioski)                                                                                                 | **✅ yes**                                             |
| **Band**                   | inside `StaffTopbar`, right cluster of the `space-between` title bar                      | a separate `mb-4 flex justify-end` row _below_ the header, inside `<main>`                                                          | **❌ no**                                              |
| **Reach**                  | unconditional child of `StaffTopbar` → every desktop staff board that renders it          | one route only                                                                                                                      | **❌ no**                                              |
| **Neighbour**              | sits beside a 38×38 r10 hairline calendar icon button, `gap: 12`                          | alone in its row                                                                                                                    | **❌ no** (the icon button doesn't exist in our shell) |
| **Pill geometry + colour** | h38 · r10 · `tokens.ink` · `#fff` · 13 / 650 · gap 7 · pad `0 14px 0 12px` · plus icon 15 | `h-[38px] rounded-[10px] bg-foreground text-white text-[13px] font-[650] gap-[7px] pr-3.5 pl-3`, `<Plus className="size-[15px]" />` | **✅ exact**                                           |
| **Label**                  | `Nowe`                                                                                    | `Nowa rezerwacja`                                                                                                                   | **⚠️ diverges** (defensible — see below)               |
| **Trailing chevron**       | `chevD` 13px @ 70% white, rotates on open                                                 | none                                                                                                                                | **✅ justified by D4** (no menu → nothing to disclose) |
| **Mobile treatment**       | 40×40 icon-only ink circle; mobile pending-queue board has **no** trigger                 | same full labelled pill at every width                                                                                              | **❌ no**                                              |
| **Calendar-cell entry**    | every day cell is a trigger                                                               | cell clicks explicitly disabled                                                                                                     | **❌ no** — but recorded as out of scope (D4)          |

**On the label.** The design's pill says `Nowe` because it opens a _menu_, and `Nowa rezerwacja` is
the menu's first item. D4 collapses menu-plus-item into one button, so taking the item's label onto
the pill is the right call — a pill labelled `Nowe` that opens a modal directly would be worse. But
the collapse is not recorded anywhere as a deviation: the S-12 contract lists `Nowa rezerwacja` under
"Ported from the source, verbatim", which is true of the menu item and the modal title but not of
the trigger it is actually applied to.

**On the band.** This is the substantive finding. Our shell header at `StaffShell.astro:163`:

```
class="border-border bg-card hidden items-center justify-between border-b px-8 py-[22px] md:flex"
```

is a unit-for-unit match to the design's `StaffTopbar` container (`padding: '22px 32px'` = `py-[22px]
px-8`; `background: tokens.card`; `borderBottom: 1px`; `display flex`, `alignItems center`,
`justifyContent space-between`). It carries `justify-between` — the two-slot shape — while rendering
a single child. The button was placed in a new row below it instead, so the page shows **two stacked
right-edges** where the design shows one band.

The mechanical reason is that `StaffShell.astro` exposes no named slot for header actions and the
trigger is a React island; the recorded reason is the frame constraint (see §4).

**On mobile.** Our shell header is `hidden … md:flex`, and `PendingQueue` renders its own centred
mobile header with the `<h1>Oczekujące wnioski</h1>` (`PendingQueue.tsx:646-651`). Because the button
row is `<main>`'s first child and `PendingQueue` its second, **the pill renders above the page's own
title** on mobile — right-aligned over a centred `<h1>`. The design does the opposite twice over: its
mobile trigger is icon-only, and its mobile pending-queue board (`staff-screens.jsx`
`ScreenPendingQueue`) has no manual-reservation affordance at all — its header is
`[back btn] [title] [36px spacer]`.

Worth noting the codebase already implements the design's responsive pattern elsewhere:
`src/components/fleet/FleetList.tsx:280-297` does "dark button at md+, dark circular FAB below md"
for **Dodaj pojazd** — the very item that sits next to Nowa rezerwacja in the design's menu.

### 4. What the design contract does and does not cover

The S-12 contract's **D4** (`context/archive/2026-08-10-manual-reservation/design-contract.md:84-85`)
reads:

> **D4 `deviation(scope)`** — no calendar-cell confirm step and no quick-action menu; the entry point
> is a **single "Nowa rezerwacja" button** that opens the modal directly.

That covers the _menu_ and the _calendar-cell path_. It does not cover the **host band**, the
**label swap**, or the **mobile treatment**. Those are the live divergences and none of them is
recorded.

Surface 4 of the same contract (`design-contract.md:197-201`) does describe the placement:

> **Trigger** (`dashboard/reservations.astro`, above `<PendingQueue>`): an ink pill button,
> `height:38 / rounded-[10px] / bg-foreground / text-white / font-size:13 / weight:650`, plus icon,
> label **Nowa rezerwacja** — opens the modal directly (D4; no menu). Right-aligned in the page
> `<main>` header row.

Two problems with that line, both process-level:

- **It carries no `exact` / `deviation(reason)` tag** — the only spec line in the document that
  doesn't. The lessons register requires every line to be marked
  (`context/foundation/lessons.md`, "Port the design spec … Mark each spec line `exact` vs
  `deviation(reason)`"), precisely so a later fidelity gate converges instead of re-litigating. Its
  values happen to be right; its placement clause was never classified.
- **It was never verified against the source.** The S-12 impl-review's "Design-source verification"
  table (`reviews/impl-review.md:39-50`) checks nine modal elements; the trigger is not among them.
  And the Phase 8 vision-diff was deliberately scoped down — `plan.md:799`: "4 of the 10 are out of
  scope by D4 — the quick-action menu (desktop-01/mobile-01) and the calendar-cell confirm
  (desktop-02/mobile-02) were never shipped." **The trigger's own boards were the ones excluded from
  the diff**, so nothing ever compared the shipped button to the drawn one.

Across both slices, **zero review findings touch the trigger.** All 12 S-12 findings (F1–F12) and all
S-12a findings concern the modal, the RPC, or the endpoints; every "trigger" hit in the S-12a reviews
means the `Termin` date-field button inside the modal.

### 5. The recorded reason for the placement — and its current standing

The decision is recorded consistently in six documents. The canonical statement
(`context/archive/2026-08-10-manual-reservation/change.md:33-34`):

> **Entry point on the reservations page, NOT the nav** — avoids a nav-registry clash with S-11
> (which owns the "Profil" nav entry). S-12 stays off the shell nav.

The chain is: `context/changes/staff-ops-features/frame.md:41` identifies `StaffShell.astro`'s `NAV`
registry as the one shared surface across the S-11/S-12/S-13 cohort →
`context/changes/staff-account/change.md:26-27` claims it for S-11 → S-12's `change.md` records
staying off it → `plan.md:51-53` picks the page-owned `<main>` as the nav-free host.

**Two observations about that reasoning.**

First, the constraint was about the **nav registry** — the sidebar/tab-bar link list. It was applied
to the **header band**, which is a different shared surface and which S-11 never claimed. The design
never proposed a nav entry either; it proposes a header-band action. So the constraint that produced
the current placement and the affordance the design actually asks for were never in conflict.

Second, the constraint is still unrealized. S-11 is `status: planned` /
`archived_at: null` (`context/changes/staff-account/change.md:5`), backlog in
`context/foundation/roadmap.md:44`, and `StaffShell.astro:18`'s `active` union still reads
`"dash" | "requests" | "pickups" | "returns" | "cal" | "fleet" | "staff"` — no `"me"`, no Profil entry.

### 6. Stale artifacts worth knowing about

- **The archived quick-action PNGs are stale.** `desktop-01-quick-action-menu.png` shows a **4-item**
  menu (Nowa rezerwacja / Szybkie wydanie / Nowy klient / Dodaj pojazd) and a crimson **`NOWE`** badge
  on the primary row. The live `MR_MENU` has **2 items** and no badge field at all. Same class of
  drift S-12a found in the `Termin` fields — repo screenshots are a cache, the JSX is the source.
- **`manual-reservation.jsx` is absent from the design-system index.**
  `context/foundation/design-system.md`'s screen inventory runs rows 01–29 with no row for it. Since
  `CLAUDE.md` directs you to read that index first for any UI slice, a future change touching this
  surface would not be pointed at the mockup by the index.
- **The canonical row-21 export predates the trigger.**
  `context/foundation/design/screenshots/21-staff-desktop-requests.jpg` is the catalogued mockup for
  this very page. Its header band shows `[Szukaj… field] [calendar icon]` and English copy ("Pending
  requests" / "4 need a decision") — an older pass, no `Nowe` pill. Row 20
  (`20-staff-desktop-dashboard.jpg`, Polish copy, newer) shows the calendar icon alone. Neither
  reflects the live `StaffTopbar`.

### 7. The open change that would close the gap

`context/changes/staff-global-search/` (S-13, `status: planned`) plans exactly the missing slot —
`plan.md:73-82`:

> Make `StaffShell`'s desktop top bar **always render** with two slots: a left **title/subtitle**
> block (rendered only when `showHeader`) and a right **action slot** holding the search island
> (plus an optional page action).

`/dashboard/reservations` renders `StaffShell` with `showHeader` defaulting true, so it is not among
the five `showHeader={false}` pages S-13 enumerates (`plan.md:76`). S-13 therefore builds a
right-aligned action slot in the band **directly above** the button's current row — two right-aligned
controls in adjacent bands — without mentioning `NewReservationButton`, `reservations.astro`, or
"Nowa rezerwacja" anywhere in the folder. And S-13's plan predates the merge: `plan.md:60` still
reads "**Not touching S-12's `source` column** — S-12 is a sibling branch not yet merged", while
both S-12 and S-12a archived on 2026-08-21.

Note that the design's own topbar puts the search field and the `Nowe` pill in the same cluster
(`{search && <SearchField … width={520} />}` then `<QuickAddButton …>`, `gap: 12`), so the two
features co-exist by design — this is a coordination opportunity, not a conflict.

## Code References

- `src/components/dashboard/NewReservationButton.tsx:19` — the trigger island
- `src/components/dashboard/NewReservationButton.tsx:30-39` — the button element and its full className
- `src/components/dashboard/NewReservationButton.tsx:24-26` — empty-fleet early return
- `src/pages/dashboard/reservations.astro:51-53` — the `mb-4 flex justify-end` row that hosts it
- `src/components/shell/StaffShell.astro:163-169` — the shell header band with `justify-between` and one child
- `src/components/dashboard/PendingQueue.tsx:646-651` — the mobile `<h1>` the pill renders above
- `src/components/dashboard/ReservationCalendar.tsx:325-326` — `disableCellClick` / `disableDragAndDrop`
- `src/components/fleet/FleetList.tsx:280-297` — the app's existing "labelled at md+, FAB below md" pattern
- `src/lib/access.ts:33` — the `/dashboard/reservations` employee gate
- `src/styles/global.css:165-173` — the radius-scale override (`rounded-md` = 12px, `rounded-sm` = 8px)

## Architecture Insights

- **The app resolves header actions per-page; the design resolves them in the shell.** Every staff
  page that needs a header action either opts out of the shell header and redraws it
  (`dashboard.astro:77-83`) or adds a row inside `<main>` (`reservations.astro:51`). The design has
  one `StaffTopbar` that owns both title and actions. The two approaches produce the same pixels only
  when a page happens to redraw the band faithfully.
- **`justify-between` with one child is a reliable smell.** It marks a container built for two slots
  and filled with one — here, the exact slot the design fills with this button.
- **The trigger is the one part of the modal work that no gate ever checked.** Its contract line is
  untagged, its boards were excluded from the vision-diff, and no review finding mentions it. That is
  a coherent explanation for why its geometry is perfect and its placement drifted: the geometry was
  transcribed from the source at plan time; the placement was decided from a frame constraint and
  never re-checked against the source.
- **Raw `<button>` instead of the shared `Button`.** `NewReservationButton.tsx:30` is a bare
  `<button>`, so it has no `focus-visible` ring, no hover, no active and no transition —
  `src/components/ui/button.tsx:8` provides all four. The analogous "Dodaj pojazd" trigger
  (`FleetList.tsx:281-297`) does use the shared `Button`. The design defines no hover/active state
  either, so this is a divergence from the codebase rather than from the mock — but the missing focus
  ring is an accessibility regression against our own primitive.

## Historical Context (from prior changes)

- `context/archive/2026-08-10-manual-reservation/change.md:33-37` — the entry-point decision and the
  two deferrals (quick-action extras; calendar-cell path)
- `context/archive/2026-08-10-manual-reservation/design-contract.md:84-85` — D4
- `context/archive/2026-08-10-manual-reservation/design-contract.md:197-201` — Surface 4, the untagged
  trigger line
- `context/archive/2026-08-10-manual-reservation/plan.md:79-80, :799` — out-of-scope statement and the
  scoped vision-diff that excluded the trigger's boards
- `context/archive/2026-08-18-manual-reservation-date-picker/plan.md:97-98` — S-12a re-affirming D4
- `context/changes/staff-ops-features/frame.md:41, :65-66` — the shared-surface analysis and the
  quick-action-extras trim
- `context/changes/staff-account/change.md:26-27` — S-11's claim on the nav registry
- `context/changes/staff-global-search/plan.md:73-82, :92-100` — the planned two-slot header and the
  open mobile tab-bar density obligation
- `context/foundation/roadmap.md:297-300` — S-12's Unknowns block, where both deferrals still sit

**Neither deferral was ever promoted to an open item.** No entry in the roadmap's `## Parked` list
(`roadmap.md:419-431`), none in `context/foundation/known-issues.md`, no change folder, no
`follow-ups/`. They survive only as prose inside a done slice's Unknowns block. Contrast S-12a's D14
(BookingWidget busy-fill reconciliation), which _was_ promoted to `roadmap.md:334-337` — so the
process can carry a follow-up forward; these two simply weren't.

## Related Research

- `context/archive/2026-08-18-manual-reservation-date-picker/design-contract.md` — the S-12a contract
  that supersedes S-12's `Termin` block, and the precedent for "the live JSX moved, the contract went
  stale"
- `context/archive/2026-08-10-manual-reservation/reviews/impl-review.md:39-50` — the design-source
  verification table that omits the trigger

## Open Questions

1. **Should the trigger move into the shell header band?** That is what the design draws, and the
   band already exists with the slot empty. It is also what S-13 is about to build. Doing it under
   S-13 costs one extra prop; doing it separately means touching `StaffShell` twice.
2. **If it moves, does it become global?** The design's `QuickAddButton` is unconditional in
   `StaffTopbar` — present on every board. The app would have to decide whether a manual reservation
   is reachable from Pulpit / Wydania / Zwroty / Kalendarz / Flota, which is a product call, not a
   fidelity one.
3. **What is the mobile treatment?** The design says 40×40 icon-only ink circle, and _no_ trigger on
   the mobile pending queue. The app currently shows the full pill on mobile, above the page `<h1>`.
   The house pattern for this already exists in `FleetList.tsx:280-297`.
4. **`Nowe` vs `Nowa rezerwacja`** — keep the current label (recommended, since there is no menu to
   disclose) but record it as a deviation, or follow the source?
5. **Does the calendar-cell entry point come back?** It is the design's second entry point, currently
   disabled in code by an explicit flag (`ReservationCalendar.tsx:326`) and untracked in any backlog.
6. **Should `manual-reservation.jsx` get a row in `design-system.md`?** Without one, the index that
   `CLAUDE.md` makes mandatory reading does not point at this mockup.

## Method Notes / Confidence

- Codebase findings: verified directly, all `file:line` checked in this session.
- Design findings: pulled live via `DesignSync` from `352d78a6-84fd-49a2-8b38-2fe289691fc3`. The
  `StaffTopbar` / `StaffShell` JSX quoted in §2 is verbatim from the `staff-desktop.jsx` payload.
- **One correction made during the session**: the first pass reported that `StaffShell` renders
  `StaffTopbar`, making the trigger present on all six sidebar destinations. It does not —
  `StaffShell` renders `{children}`, and each board renders its own `StaffTopbar`. `staff-desktop.jsx`
  defines three staff desktop boards (`ScreenStaffDash`, `ScreenStaffRequests`, `ScreenStaffPickup`);
  all three render `StaffTopbar`, and `QuickAddButton` is unconditional within it. The defensible
  claim is that the trigger belongs to the topbar band rather than to any one page — which is what
  matters here, since our Wnioski page renders that band.
- **Not verified**: the `Flota Rental.html` `data-dc-slot` mapping (which board fills which artboard)
  — DesignSync disconnected before it could be re-opened. This does not affect any finding above.
- No rendered vision-diff was run; the session's agreed method was a live source pull, not a browser
  render. A rendered diff would be the right gate if any of the open questions turns into a change.
