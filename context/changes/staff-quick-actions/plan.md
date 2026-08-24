# Staff quick-action menu (S-12b) Implementation Plan

## Overview

Replace S-12's single page-owned "Nowa rezerwacja" pill with the design's `QuickAddButton` — an ink
`＋ Nowe ⌄` pill in the staff shell's header band opening a 278px popover on desktop, and a 40×40 ink
circle opening a bottom sheet on mobile. Manual reservation becomes one row of a two-row menu; on the
two mobile boards that own their own create action (Flota, Zespół) that action is **absorbed** as the
promoted first row, so each screen keeps exactly one `＋`.

This un-defers **D4** from the S-12 design contract
(`context/archive/2026-08-10-manual-reservation/design-contract.md:84-85`), which cut the quick-action
menu as out of scope.

## Current State Analysis

- **The desktop slot already exists and is empty.** `StaffShell.astro:163` is a unit-for-unit match to
  the design's `StaffTopbar` container (`px-8 py-[22px]`, `bg-card`, `border-b`, `justify-between`) but
  renders a single child. The design's `QuickAddButton` is an _unconditional_ last child of that band's
  right cluster.
- **10 pages render `StaffShell`; 5 pass `showHeader={false}`** (`dashboard`, `staff`, `vehicles/new`,
  `vehicles/[id]/edit`, `protocols/[id]`) and draw their own headers. Two more staff routes
  (`pickups/[reservationId]`, `returns/[reservationId]`) don't render `StaffShell` at all.
- **Those five split into two kinds.** `dashboard.astro:70-84` and `StaffList.tsx:549-551` hand-roll a
  _generic title band_. `VehicleForm.tsx:429` and `ProtocolForm.tsx:359` draw a _task header_ carrying
  back / close / Cancel+Zapisz over unsaved form state — not a title band, and not a place for a create
  action.
- **Mobile has no shell header at all.** `StaffShell.astro:163` is `hidden … md:flex`; below `md` there
  are 8 hand-rolled per-page headers in three shapes: centered (`calendar.astro:64`, `pickups.astro:44`,
  `PendingQueue.tsx:636`), left-aligned with eyebrow (`returns.astro:64`, `dashboard.astro:91`), and
  island-owned with a 48px FAB (`FleetList.tsx:292`, `StaffList.tsx:591`).
- **The trigger's only mount is `reservations.astro:52`**, in a `mb-4 flex justify-end` row inside
  `<main>` — a second right-edge below the band's. `NewReservationButton.tsx:19` is its sole component
  and `ManualReservationModal.tsx:243` its sole consumer.
- **There is no `GET /api/vehicles`** — `src/pages/api/vehicles.ts` exports only `POST`. The GET
  precedent (`api/reservations/calendar.ts:26`) checks role only, returning **403 for anon** rather than
  a 401/403 split.
- **`listFleet` has no projection** (`vehicles.ts:373` `select("*")` — all 23 columns, 4906 B measured on
  7 active vehicles) and serves two callers with opposite needs.
- **`vehicles.astro` renders its title twice at md+** — the shell band shows "Zarządzanie flotą" while
  `FleetList.tsx:275` renders its own `<h1>`.
- **`protocols/[id].astro:118-126` never passes `pendingCount`**, so the Wnioski nav badge silently reads
  0 on that one route (`known-issues.md`).

## Desired End State

A staffer on any of the 7 staff pages with a normal title header sees an ink `＋ Nowe ⌄` pill in the
header band (desktop) or a 40×40 ink `＋` circle in the page header's right slot (mobile). Clicking it
opens the quick-action menu — a popover on desktop, a bottom sheet titled **SZYBKA AKCJA** on mobile —
offering **Nowa rezerwacja** and **Dodaj pojazd**. On Flota and Zespół the mobile sheet leads with that
page's own action (**Dodaj pojazd** / **Dodaj pracownika**) as the crimson primary row, so those screens
show one `＋` rather than two. Picking **Nowa rezerwacja** fetches the bookable fleet on demand and opens
the existing manual-reservation modal.

**Verification:** the pill renders on all 7 desktop routes and is absent from the 5 task screens; the
endpoint refuses anon (401) and role-null (403) and serves employee (200) with exactly 7 columns; the
menu, popover, sheet, and both absorb boards match `design-contract.md` on a rendered vision-diff.

### Key Discoveries:

- The design's `QuickMenuList({ onPick, promoted })` already implements absorb: prepend `promoted` as
  `primary: true`, then `MR_MENU` filtered by key and demoted. `MR_MENU` is never mutated.
- **The desktop popover branch calls `<QuickMenuList onPick={pick} />` with no `promoted`** — desktop
  cannot absorb even by accident. Deliberate; preserve it.
- **The divider is positional, not structural**: `borderTop` fires on `i === 1` only, so Zespół's 3-row
  sheet has one divider after row 1, not two.
- **`useMediaQuery` cannot drive this.** Its server snapshot returns `false` and its docstring
  (`useMediaQuery.ts:12-15`) restricts callers to components that mount after hydration — true of the
  modal, false of a trigger that mounts on page load. Resolved structurally: see Critical Implementation
  Details.
- The modal reads exactly 7 vehicle fields — `id` (`:328`, `:485`), `make`/`model`/`name` (`:87`),
  `plate` (`:466`, `:486`), `daily_rate` (`:344`, `:466`, `:631`), `deposit` (`:636`).
- The bottom-sheet idiom already exists in-repo: `ManualReservationModal.tsx:679-681`
  (`rounded-t-[26px]`, `bg-[rgba(20,18,22,0.5)]`, `backdrop-blur-sm`).
- `radix-ui` `Popover` is already wrapped at `src/components/ui/popover.tsx`.
- The design uses **matched full-bleed padding** for header and body (`'22px 32px'` / `'18px 32px 12px'`
  in `QavFleetDesktop`; `'22px 28px 16px'` / `'20px 28px'` in `MrDeskChrome`) — no centered column
  anywhere. Our pages' `mx-auto max-w-*` bodies are a pre-existing deviation, out of scope here.

## What We're NOT Doing

- **No quick-add on the 5 task screens** — `vehicles/new`, `vehicles/[id]/edit`, `protocols/[id]`,
  `pickups/[reservationId]`, `returns/[reservationId]`. Their headers carry back / close / submit over
  unsaved state; a create action there is both a design mismatch and a data-loss path. Consequently
  **no unsaved-work confirm dialog is needed anywhere in this change.**
- **No calendar icon button** in the shell action slot. The design's cluster is
  `[38×38 calendar][pill]`, but S-13 explicitly ruled it out of scope; not reversing a sibling
  change's decision here.
- **No un-capping of page bodies.** The `mx-auto max-w-*` columns diverge from the design's full-bleed
  boards, but relayouting 7 pages is far beyond this change.
- **No calendar-cell entry point.** The design's second entry point stays disabled
  (`ReservationCalendar.tsx:325-326`); still deferred, as under D4.
- **Not narrowing `listFleet`** — `/dashboard/vehicles` genuinely renders the full row. Only a new
  picker-scoped read is added. The broader survey (`count_pending_reservations`, the nine-page
  `.length` waste) stays with `context/changes/service-read-projections/`.
- **No RLS policy change** on `vehicles`. `vehicles_select_authenticated using (true)` is
  `context/changes/vehicles-read-policy-gate/`'s to fix; this change owes only the endpoint gate and
  its test triple.
- **No `MR_MENU` mutation** and no third menu row.
- **No S-13 work** — no `SearchField`, no ⌘K, no `active="search"`.

## Implementation Approach

Backend first so the lazy-fetch path exists before anything calls it. Then the menu components, landed
mounted on the one page that already has a trigger — a shippable increment that replaces
`NewReservationButton` without touching shared surfaces. Then the invasive `StaffShell` restructure
isolated in its own phase so the shared-surface diff is reviewable and S-13 rebases cleanly under it.
Then the mobile rollout across 7 per-page headers. Finally the verification gate.

The pill is a React island mounted in the Astro shell; the mobile circle is a separate island mounted in
each page's own mobile header.

## Critical Implementation Details

- **Two mounts, not one breakpoint branch.** Desktop and mobile must be _separate island mounts in
  different DOM locations_ — the pill inside `StaffShell`'s band (already `hidden … md:flex`), the circle
  inside each page's mobile header (already `md:hidden`). Do **not** branch on `useMediaQuery` inside one
  component: its server snapshot is `false`, so SSR would paint the mobile branch on every staff page and
  swap it on hydrate. Because the two containers are already mutually exclusive at the CSS level, only
  one is ever visible and nothing double-mounts an open menu. Pass `mode` explicitly from each mount site.

- **`showHeader` becomes the pill's gate.** After Phase 3, `showHeader` means exactly _"this page has a
  normal title header"_ — which is also _"this page gets the quick-add"_. The 3 remaining
  `showHeader={false}` pages are precisely the task screens that must not have it. Keep these coupled;
  do not add a second opt-out prop.

- **Centered mobile headers need absolute placement.** `calendar.astro:64`, `pickups.astro:44`, and
  `PendingQueue.tsx:636` centre their title. Adding a right-hand circle to a centered row must use the
  absolutely-positioned pattern `PendingQueue.tsx:639-645` already uses for its back button, so the
  title stays optically centred rather than being pushed left by a flex sibling.

- **The fetch must not re-run per open.** The menu can be opened repeatedly on one page; the fleet fetch
  should happen at most once per page view and be reused. An in-flight open must not fire a second
  request.

## Phase 1: Fleet picker endpoint

### Overview

The on-demand read behind the "Nowa rezerwacja" row: a 7-column projection, a self-gating GET endpoint,
and the authorization triple that pins it.

### Changes Required:

#### 1. Picker projection

**File**: `src/lib/services/vehicles.ts`

**Intent**: Add a picker-scoped read alongside `listFleet`, returning only what the manual-reservation
modal renders. `listFleet` is untouched — `/dashboard/vehicles` genuinely needs the full row.

**Contract**: `listFleetForPicker(client: CatalogClient | null): Promise<PickerVehicle[]>` — selects
`id, name, make, model, plate, daily_rate, deposit`, filters `is_active = true`, orders by `name`
ascending, and degrades a `null` client to `[]` (matching `listFleet`'s contract). In-repo precedent for
a narrow projection: `getCategoryCounts` (`vehicles.ts:119`).

#### 2. Picker vehicle type

**File**: `src/types.ts`

**Intent**: Name the projection so the endpoint, the hook, and the modal all agree on it at the type
level — narrowing the modal's prop is what stops the projection silently widening later.

**Contract**: `export type PickerVehicle = Pick<Vehicle, "id" | "name" | "make" | "model" | "plate" | "daily_rate" | "deposit">;`

#### 3. `GET /api/vehicles`

**File**: `src/pages/api/vehicles.ts`

**Intent**: Serve the picker projection to staff. Add `GET` beside the existing `POST`; the file's
existing `json()` helper and `MSG` map are reused.

**Contract**: `GET` gates in order — (a) `!context.locals.user` → **401**, (b)
`!requireRole(context.locals, "employee")` → **403**, (c) → **200** `{ vehicles: PickerVehicle[] }`. No
Origin check (read, not mutation). Note this deliberately **diverges from `api/reservations/calendar.ts:26`**,
which collapses both cases into 403; the lessons register's ordering (auth → role) is followed here
because `vehicles-read-policy-gate` records that this handler is the only barrier — the table's read
policy is `using (true)`, so it fails _open_ rather than closed.

#### 4. Authorization triple

**File**: `tests/integration/vehicles-api.test.ts` (new, or extend `api-authz.test.ts`)

**Intent**: Pin all three outcomes explicitly. A test asserting only "employee gets 200" passes with the
hole open — which is how the `reservations` PII leak survived.

**Contract**: three cases against `GET /api/vehicles` — anon → 401; authenticated user with **no
`profiles` row** (role `null`) → 403; employee → 200 with a body whose vehicle objects have exactly the
7 projected keys. The role-null fixture is the load-bearing one; the local DB already carries such users
(`vehicles-read-policy-gate/change.md`).

### Success Criteria:

#### Automated Verification:

- Type checking passes: `npx astro sync && npx tsc --noEmit`
- Linting passes: `npm run lint`
- Unit tests pass: `npm test`
- Integration tests pass: `npm run test:integration`
- The triple asserts 401 / 403 / 200 distinctly, and the 200 body carries exactly 7 keys per vehicle

#### Manual Verification:

- `curl` against a running dev server returns 401 signed-out and 200 signed-in as staff
- The 200 payload is visibly smaller than `listFleet`'s (no `photos` array)

**Implementation Note**: After completing this phase and all automated verification passes, pause here
for manual confirmation from the human before proceeding.

---

## Phase 2: Quick-action menu components

### Overview

The menu itself — row list with absorb semantics, the desktop pill/popover and mobile circle/sheet, and
the lazy fetch that bridges a menu pick to the existing modal. Lands mounted on `reservations.astro`,
replacing `NewReservationButton`.

### Changes Required:

#### 1. Menu model + merge

**File**: `src/components/dashboard/quick-actions.ts` (new)

**Intent**: Hold the canonical two-row menu and the pure absorb merge, separate from any component so it
is unit-testable in isolation. This is the logic three mount sites depend on.

**Contract**: `QuickActionItem = { key: string; icon: LucideIcon; label: string; desc: string }`;
`QUICK_ACTIONS: QuickActionItem[]` carries the two canonical rows with verbatim Polish copy (see
`design-contract.md`). `buildQuickActions(promoted?: QuickActionItem): (QuickActionItem & { primary: boolean })[]`
— with `promoted`, returns it first as `primary: true` followed by `QUICK_ACTIONS` filtered by
`key !== promoted.key` and all `primary: false`; without it, returns `QUICK_ACTIONS` with its canonical
`primary` flags. The source array is never mutated.

#### 2. Menu row list

**File**: `src/components/dashboard/QuickActionMenu.tsx` (new)

**Intent**: Render the resolved rows at the design's exact geometry, shared by the popover and the sheet.

**Contract**: `({ items, onPick, disabledKeys? }) => JSX` — one `<button>` per item; the divider,
tile colours, and type scale come from `design-contract.md`. `disabledKeys` renders a row non-interactive
with its hint (used for the empty-fleet case). The divider is applied at **index 1 only**, matching the
source's positional rule — not between every pair.

#### 3. Trigger island

**File**: `src/components/dashboard/QuickAddButton.tsx` (new)

**Intent**: The trigger plus its disclosure surface. One component, two explicitly-selected modes — never
a runtime breakpoint check (see Critical Implementation Details).

**Contract**: `({ mode: "desktop" | "mobile", promoted?: QuickActionItem })`. `desktop` renders the ink
pill and, on open, the popover (reusing `src/components/ui/popover.tsx`) — and **ignores `promoted`
entirely**, matching the source where the desktop branch passes no `promoted`. `mobile` renders the 40×40
ink circle and, on open, the bottom sheet with the `SZYBKA AKCJA` eyebrow. Picking `res` triggers the
fetch-then-open path (#4); picking any other key navigates to that row's href.

#### 4. Lazy fleet fetch

**File**: `src/components/hooks/useFleetPicker.ts` (new)

**Intent**: Fetch the bookable fleet only when manual reservation is actually chosen, then hand it to the
modal. Nothing is fetched on page load.

**Contract**: `useFleetPicker()` → `{ vehicles: PickerVehicle[] | null; state: "idle" | "loading" | "ready" | "error"; load: () => void }`.
`load()` is idempotent — a second call while in-flight or after success does not re-request (see Critical
Implementation Details). On `error`, surface a retryable message rather than opening an empty modal.

#### 5. Pending state on the trigger

**File**: `src/components/dashboard/QuickAddButton.tsx`

**Intent**: The row that triggers a fetch is an async action, so it must show progress per the project's
async-button rule.

**Contract**: while `state === "loading"`, the "Nowa rezerwacja" row is disabled and swaps its icon for
the `animate-spin` ring used by `src/components/auth/SubmitButton.tsx`. The state resets on error and is
superseded by the modal on success.

#### 6. Empty-fleet handling

**File**: `src/components/dashboard/QuickAddButton.tsx`

**Intent**: With no bookable vehicles the reservation row must not open a modal whose picker has no
options — but the affordance itself must stay, because "Dodaj pojazd" is what fixes an empty fleet.

**Contract**: a `200` with an empty array renders the "Nowa rezerwacja" row disabled with a short hint;
the pill/circle and the "Dodaj pojazd" row render normally. This replaces
`NewReservationButton.tsx:24-26`'s whole-component `return null`, which would otherwise erase the
affordance console-wide. Recorded as `deviation(empty-state)` — the design draws no disabled row.

#### 7. Mount on the reservations page

**File**: `src/pages/dashboard/reservations.astro`

**Intent**: Replace the page-owned trigger with the new island, and drop the now-unneeded SSR fleet fetch.

**Contract**: the `mb-4 flex justify-end` row (`:51-53`) and the `NewReservationButton` import are
removed, along with `listFleet` from the `Promise.all` at `:20-24` and its import — the fleet is now
fetched lazily. A `mode="mobile"` `QuickAddButton` is mounted in `PendingQueue`'s mobile header in Phase 4;
the desktop pill arrives with the shell in Phase 3. **This phase mounts the mobile circle only on this
page** so the component is exercised end-to-end before the shared-surface work begins.

#### 8. Retire the old trigger

**File**: `src/components/dashboard/NewReservationButton.tsx` (delete)

**Intent**: Its only importer is gone and its behaviour is now the menu's `res` row.

**Contract**: file deleted; confirm no remaining importers. `ManualReservationModal`'s `vehicles` prop
narrows from `Vehicle[]` to `PickerVehicle[]`.

#### 9. Unit tests

**File**: `src/components/dashboard/quick-actions.test.ts` (new)

**Intent**: Cover the merge — the logic with the most branches and the most call sites.

**Contract**: asserts (a) no `promoted` → the 2 canonical rows with `res` primary; (b) `promoted` with a
**new** key (`employee`) → 3 rows, promoted first and primary, both canonical rows demoted; (c) `promoted`
with a **colliding** key (`vehicle`) → 2 rows, no duplicate, promoted first; (d) `QUICK_ACTIONS` is not
mutated by any call.

### Success Criteria:

#### Automated Verification:

- Type checking passes: `npx astro sync && npx tsc --noEmit`
- Linting passes: `npm run lint`
- Unit tests pass, including the 4 merge cases: `npm test`
- No remaining importers of `NewReservationButton`: `grep -r NewReservationButton src/` returns nothing

#### Manual Verification:

- On `/dashboard/reservations` at mobile width, the circle opens the sheet; "Nowa rezerwacja" shows a
  spinner, then the modal opens with the vehicle picker populated
- Opening and closing the sheet repeatedly issues exactly one `/api/vehicles` request (Network tab)
- With every vehicle deactivated, the sheet still opens and "Dodaj pojazd" still works

**Implementation Note**: Pause for manual confirmation before proceeding.

---

## Phase 3: `StaffShell` header restructure (desktop)

### Overview

The invasive shared-surface phase. Give the shell band a right action slot, migrate the two pages that
hand-roll a generic band onto it, mount the pill, and close the two adjacent header defects.

### Changes Required:

#### 1. Shell action slot + pill mount

**File**: `src/components/shell/StaffShell.astro`

**Intent**: Fill the empty right half of the `justify-between` band the design already draws, and mount
the pill there so it rides onto every page with a normal header.

**Contract**: the `showHeader && <header>` block (`:161-170`) gains a right-hand cluster holding a named
`<slot name="header-actions" />` followed by a `mode="desktop"` `QuickAddButton` island, at the design's
`gap: 12`. The band's title adopts the design's exact `letterSpacing: -0.5` / `lineHeight: 1.1` (today
`tracking-tight`, no line-height). `showHeader` now means _"has a normal header, and therefore the
quick-add"_ — no second opt-out prop.

#### 2. Migrate the Pulpit band

**File**: `src/pages/dashboard.astro`

**Intent**: Its hand-rolled band (`:70-84`) reproduces the shell's band exactly, then adds a calendar
button — so it can move onto the shell's slots wholesale.

**Contract**: drop `showHeader={false}` and the entire `<header>` element; pass the greeting as `title`
(`Dzień dobry, {firstName}`) and `subtitle` (`Oto Twój dzień w oddziale Warszawa`); move the calendar
`<a>` (`:77-83`) into `slot="header-actions"` unchanged. Verify the page renders **one** band, not two.

#### 3. Migrate the Zespół band

**File**: `src/pages/dashboard/staff.astro`, `src/components/staff/StaffList.tsx`

**Intent**: `StaffList` owns a full band (`:549-551`) whose content is capped at `max-w-[1024px]`. The
title moves to the shell's left slot; the list's own controls stay with the list.

**Contract**: `staff.astro` drops `showHeader={false}` and passes `subtitle={staffCountLabel(total, adminCount)}`
— which requires the count, already computed at `:20`. `StaffList` drops its `<header>` band, its
`<h1>`, and both eyebrow variants (`:554-563`); the search input and the desktop "Dodaj pracownika"
button move into a page action row inside the list's own `max-w-[1024px]` column, per the design's v5
two-band rule (shell band = quick-add; page row = page action). The mobile FAB is handled in Phase 4.
**Accepted consequence**: staff's title moves from the 1024px column out to flush `px-8`, matching the
other six — the body-centering deviation that causes the offset is pre-existing and out of scope.

#### 4. Fix the Flota duplicate title

**File**: `src/pages/dashboard/vehicles.astro`, `src/components/fleet/FleetList.tsx`

**Intent**: The shell band and `FleetList.tsx:275` both render the page title at md+. The new right-slot
pill sits directly above the duplicate, making it more visible.

**Contract**: `FleetList`'s eyebrow + `<h1>` (`:271-278`) are hidden at md+ (the shell band carries them)
and retained below md, where there is no shell header. Its desktop "Dodaj pojazd" button stays as the
page action — coexisting with the pill in a separate band, per v5. `vehicles.astro` keeps its existing
`title`/`subtitle`.

#### 5. Fix the Wnioski badge on the protocol route

**File**: `src/pages/dashboard/protocols/[id].astro`

**Intent**: Close the badge-reads-0 defect on the one staff page that never passes `pendingCount`.

**Contract**: fetch the pending count alongside the existing `countOverdueReturns` (`:34`) and pass
`pendingCount` to `StaffShell` (`:120-126`). `known-issues.md` confirms this is a correct standalone fix
that does not block the `count_pending_reservations` RPC later. This page keeps `showHeader={false}` and
gets **no** pill.

### Success Criteria:

#### Automated Verification:

- Type checking passes: `npx astro sync && npx tsc --noEmit`
- Linting passes: `npm run lint`
- Unit tests pass: `npm test`
- Integration tests pass: `npm run test:integration`
- Page authorization tests still pass: `tests/integration/pages-authz.test.ts`

#### Manual Verification:

- The pill renders at md+ on all 7 routes: `/dashboard`, `/dashboard/reservations`, `/dashboard/pickups`,
  `/dashboard/returns`, `/dashboard/calendar`, `/dashboard/vehicles`, `/dashboard/staff`
- The pill is **absent** on all 5 task routes: `/dashboard/vehicles/new`, `/dashboard/vehicles/<id>/edit`,
  `/dashboard/protocols/<id>`, `/dashboard/pickups/<id>`, `/dashboard/returns/<id>`
- Each of the 7 renders exactly **one** header band — verified on Pulpit and Zespół specifically
- `/dashboard/vehicles` shows its title once at md+, and still shows it below md
- The Wnioski badge shows a non-zero count on `/dashboard/protocols/<id>` with pending requests
- Pulpit's calendar button still works and sits left of the pill at `gap: 12`

**Implementation Note**: Pause for manual confirmation before proceeding.

---

## Phase 4: Mobile right-slot rollout

### Overview

The 40×40 circle across the 7 mobile headers — 5 plain, and 2 where the page's own create action is
absorbed as the promoted row so the screen keeps a single `＋`.

### Changes Required:

#### 1. Centered headers

**File**: `src/pages/dashboard/calendar.astro`, `src/pages/dashboard/pickups.astro`,
`src/components/dashboard/PendingQueue.tsx`

**Intent**: Add the circle without pushing the centred title off-centre.

**Contract**: each header keeps its centred title block and gains an absolutely-positioned right-hand
`QuickAddButton mode="mobile"`, mirroring the pattern `PendingQueue.tsx:639-645` already uses for its
back button (`absolute top-1/2 -translate-y-1/2`, right edge). `PendingQueue`'s circle replaces the
temporary Phase 2 mount.

#### 2. Left-aligned headers

**File**: `src/pages/dashboard/returns.astro`, `src/pages/dashboard.astro`

**Intent**: These are already `flex justify-between` (or become so), so the circle is a plain sibling.

**Contract**: `returns.astro:64`'s header becomes a two-slot row with the eyebrow+title left and the
circle right. `dashboard.astro:91` gains the circle into its existing right slot, **left of** the 44px
initials avatar, at the design's `gap: 10`. This is the change's tightest row — its fit at 360px is a
success criterion below.

#### 3. Absorb — Flota

**File**: `src/components/fleet/FleetList.tsx`

**Intent**: Replace the page's own 48px mobile FAB with the quick-add circle carrying "Dodaj pojazd" as
the promoted first row, so the screen has one `＋` and manual reservation stays reachable.

**Contract**: the `size-12` FAB (`:290-297`) is replaced by `QuickAddButton mode="mobile"` with
`promoted = { key: "vehicle", label: "Dodaj pojazd", desc: "Nowy pojazd do floty", icon: Truck }` →
a 2-row sheet (no duplicate, since `vehicle` collides with a canonical key). The desktop `md:inline-flex`
button (`:281-288`) is untouched. Size goes **48 → 40** per the settled reconciliation; the shadow
becomes the design's `0 2px 6px rgba(10,10,15,0.14)` and the glyph 19px.

#### 4. Absorb — Zespół

**File**: `src/components/staff/StaffList.tsx`

**Intent**: Same treatment; here the promoted key is new, so the sheet is 3 rows.

**Contract**: the `size-12` FAB (`:589-597`) is replaced by `QuickAddButton mode="mobile"` with
`promoted = { key: "employee", label: "Dodaj pracownika", desc: "Zaproś do zespołu", icon: UserPlus }`
→ a 3-row sheet with **one** divider after row 1. Because the promoted action opens a dialog rather than
navigating, its `onPick` calls the existing `setAddOpen(true)`. Size 48 → 40 as above.

#### 5. Density check

**File**: n/a — verification step

**Intent**: Confirm no mobile header overflows at the smallest supported width before shipping.

**Contract**: all 7 mobile headers measured at **360px**. The design refused a third circle on its own
Pulpit board because `Dyspozytornia` is a 273px unbreakable word; our title is `Pulpit`, so the
constraint does not transfer — but Pulpit's title + circle + avatar row must be measured, not assumed.
If any row clips, record the fallback as a `deviation(reason)` rather than shipping an overflow.

### Success Criteria:

#### Automated Verification:

- Type checking passes: `npx astro sync && npx tsc --noEmit`
- Linting passes: `npm run lint`
- Unit tests pass: `npm test`

#### Manual Verification:

- At 360px and 390px, all 7 mobile headers render without clipping or horizontal scroll — Pulpit measured
  explicitly (title + circle + avatar)
- Flota and Zespół each show exactly **one** `＋`; their sheets lead with the page action in the crimson
  tile, with the canonical rows below in grey
- The Zespół sheet has 3 rows and exactly one divider; the Flota sheet has 2 rows and no duplicate
- Zespół's promoted row opens the existing add-employee dialog; Flota's navigates to
  `/dashboard/vehicles/new`
- Every centred header's title remains optically centred with the circle present

**Implementation Note**: Pause for manual confirmation before proceeding.

---

## Phase 5: Verification gate

### Overview

One browser test over the genuinely new runtime path, and the rendered vision-diff that closes the
fidelity loop against the canonical boards.

### Changes Required:

#### 1. E2E — pick to created

**File**: `e2e/quick-actions.spec.ts` (new)

**Intent**: Prove the lazy-fetch path works in a real browser — the one path unit and integration tests
cannot reach.

**Contract**: follows `/10x-e2e` and `e2e/e2e-rules.md`. Signs in as staff, waits for island hydration
(`waitForIslands()` — interactions with a `client:*` island are lost pre-hydration), opens the quick-add,
picks **Nowa rezerwacja**, waits on the `/api/vehicles` response rather than a timeout, and asserts the
modal opens with a populated picker. Role-based locators only; unique ids with a timestamp suffix; own
cleanup.

#### 2. Rendered vision-diff

**File**: `context/changes/staff-quick-actions/design-review/` (renders added alongside the canonical boards)

**Intent**: The gate the lessons register requires — compare the _rendered app_ to the _mockup_, not to a
baseline of our own render.

**Contract**: render the desktop pill (closed + popover open) and the mobile circle (closed + sheet open)
at the boards' breakpoints, plus both absorb boards, and diff each against its canonical PNG in
`design-review/`. Iterate to an empty punch-list minus the deviations recorded in `design-contract.md`.

### Success Criteria:

#### Automated Verification:

- E2E passes: `npm run test:e2e`
- Full unit + integration suites pass: `npm test && npm run test:integration`
- Production build succeeds: `npm run build`

#### Manual Verification:

- Vision-diff punch-list is empty except for the contract's recorded deviations
- Both absorb boards match their canonical renders (row order, tile colours, divider position)
- The desktop popover never shows a promoted row on any page

---

## Testing Strategy

### Unit Tests:

- `buildQuickActions` — no-promoted, new-key promoted, colliding-key promoted, source-array immutability
- Edge case: promoted key matching the primary canonical row (`res`) — the reservation row must not
  appear twice

### Integration Tests:

- `GET /api/vehicles` — anon 401 / role-null 403 / employee 200, with the 200 body's key set asserted

### Manual Testing Steps:

1. Sign in as employee; confirm the pill on all 7 desktop routes and its absence on all 5 task routes
2. Open the popover on `/dashboard/calendar`; confirm 2 rows, `Nowa rezerwacja` crimson and first
3. Pick `Nowa rezerwacja`; confirm the spinner, then the modal with a populated picker
4. Re-open the menu; confirm no second `/api/vehicles` request
5. At 360px, walk all 7 mobile headers; confirm no clipping and one `＋` per screen
6. On Flota mobile, confirm the sheet leads with `Dodaj pojazd` in crimson and offers `Nowa rezerwacja`
7. On Zespół mobile, confirm 3 rows, one divider, and that the promoted row opens the add dialog
8. Deactivate every vehicle; confirm the menu still opens with `Nowa rezerwacja` disabled and
   `Dodaj pojazd` working
9. Sign out; `curl` the endpoint and confirm 401

## Performance Considerations

The lazy-fetch design means **no** added SSR cost and **no** added island props on any of the 7 pages —
`reservations.astro` actually loses a fetch. The one request that does fire ships 7 columns rather than
23 (measured 1183 B vs 4906 B on 7 active vehicles), and fires at most once per page view. This is why
this change no longer multiplies `listFleet`'s over-fetch across the console, and why it can land before
`service-read-projections` rather than after.

## Migration Notes

No data migration. `NewReservationButton.tsx` is deleted and `ManualReservationModal`'s `vehicles` prop
narrows to `PickerVehicle[]`. Phase 3 changes shared surfaces (`StaffShell.astro`) that S-13 also plans
to touch — S-13's plan must be refreshed against the delivered shape, and its `plan.md:60` note calling
S-12 an unmerged sibling branch is stale (S-12 and S-12a archived 2026-08-21).

## References

- Research: `context/changes/staff-quick-actions/research.md`
- Change log and settled decisions: `context/changes/staff-quick-actions/change.md`
- Design contract: `context/changes/staff-quick-actions/design-contract.md`
- Design source: `manual-reservation.jsx` (`QuickAddButton`, `QuickMenuList`, `MR_MENU`),
  `quick-actions-variants.jsx` (absorb boards), `staff-desktop.jsx` (`StaffTopbar`) — Claude Design
  project `352d78a6-84fd-49a2-8b38-2fe289691fc3`
- Superseded contract: `context/archive/2026-08-10-manual-reservation/design-contract.md:84-85` (D4)
- Sibling changes: `context/changes/service-read-projections/`,
  `context/changes/vehicles-read-policy-gate/`, `context/changes/staff-global-search/`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Fleet picker endpoint

#### Automated

- [x] 1.1 Type checking passes: `npx astro sync && npx tsc --noEmit` — a75a2ab
- [x] 1.2 Linting passes: `npm run lint` — a75a2ab
- [x] 1.3 Unit tests pass: `npm test` — a75a2ab
- [x] 1.4 Integration tests pass: `npm run test:integration` — a75a2ab
- [x] 1.5 The triple asserts 401 / 403 / 200 distinctly, and the 200 body carries exactly 7 keys per vehicle — a75a2ab

#### Manual

- [x] 1.6 `curl` returns 401 signed-out and 200 signed-in as staff — a75a2ab
- [x] 1.7 The 200 payload is visibly smaller than `listFleet`'s (no `photos` array) — a75a2ab

### Phase 2: Quick-action menu components

#### Automated

- [x] 2.1 Type checking passes: `npx astro sync && npx tsc --noEmit` — cc1ad29
- [x] 2.2 Linting passes: `npm run lint` — cc1ad29
- [x] 2.3 Unit tests pass, including the 4 merge cases: `npm test` — cc1ad29
- [x] 2.4 No remaining importers of `NewReservationButton` — cc1ad29

#### Manual

- [x] 2.5 Circle opens the sheet; "Nowa rezerwacja" spins, then the modal opens with a populated picker — cc1ad29
- [x] 2.6 Repeated opens issue exactly one `/api/vehicles` request — cc1ad29
- [x] 2.7 With every vehicle deactivated, the sheet still opens and "Dodaj pojazd" still works — cc1ad29

### Phase 3: `StaffShell` header restructure (desktop)

#### Automated

- [x] 3.1 Type checking passes: `npx astro sync && npx tsc --noEmit` — 80c1c92
- [x] 3.2 Linting passes: `npm run lint` — 80c1c92
- [x] 3.3 Unit tests pass: `npm test` — 80c1c92
- [x] 3.4 Integration tests pass: `npm run test:integration` — 80c1c92
- [x] 3.5 Page authorization tests still pass — 80c1c92

#### Manual

- [x] 3.6 The pill renders at md+ on all 7 routes — 80c1c92
- [x] 3.7 The pill is absent on all 5 task routes — 80c1c92
- [x] 3.8 Each of the 7 renders exactly one header band — Pulpit and Zespół verified specifically — 80c1c92
- [x] 3.9 `/dashboard/vehicles` shows its title once at md+, and still shows it below md — 80c1c92
- [x] 3.10 The Wnioski badge shows a non-zero count on `/dashboard/protocols/<id>` — 80c1c92
- [x] 3.11 Pulpit's calendar button still works and sits left of the pill at `gap: 12` — 80c1c92

### Phase 4: Mobile right-slot rollout

#### Automated

- [x] 4.1 Type checking passes: `npx astro sync && npx tsc --noEmit`
- [x] 4.2 Linting passes: `npm run lint`
- [x] 4.3 Unit tests pass: `npm test`

#### Manual

- [x] 4.4 At 360px and 390px, all 7 mobile headers render without clipping — Pulpit measured explicitly
- [x] 4.5 Flota and Zespół each show exactly one `＋`, with the page action in the crimson tile
- [x] 4.6 Zespół's sheet has 3 rows and one divider; Flota's has 2 rows and no duplicate
- [x] 4.7 Zespół's promoted row opens the add-employee dialog; Flota's navigates to `/dashboard/vehicles/new`
- [x] 4.8 Every centred header's title remains optically centred with the circle present

### Phase 5: Verification gate

#### Automated

- [ ] 5.1 E2E passes: `npm run test:e2e`
- [ ] 5.2 Full unit + integration suites pass
- [ ] 5.3 Production build succeeds: `npm run build`

#### Manual

- [ ] 5.4 Vision-diff punch-list is empty except the contract's recorded deviations
- [ ] 5.5 Both absorb boards match their canonical renders
- [ ] 5.6 The desktop popover never shows a promoted row on any page
