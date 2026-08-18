# Global search — Pulpit-only, dropdown-only Implementation Plan

## Overview

Narrow the shipped S-13 global search to what the updated design specifies: search is
reached from **Pulpit only** (desktop and mobile), and it resolves **entirely in the
dropdown** — there is no dedicated results screen and no results URL. The user types,
the grouped list grows, they scroll it, and clicking or pressing `↵` on a row jumps
straight to that item.

Two decisions, landing together. Both are already applied in the design
(`design-request.md`, status APPLIED); this plan brings the app to them.

## Current State Analysis

S-13 is fully implemented and committed on `feature/staff-global-search` (7 commits,
nothing pushed). What exists today:

- `search_staff` RPC (`supabase/migrations/20260810130000_staff_search.sql`) + `GET /api/search`.
- An **always-on** `StaffShell` desktop top bar carrying `<GlobalSearch>` on all 10 staff pages.
- A magnifier in the mobile floating tab bar (`StaffShell.astro:265-275`) that dispatches
  `flota:search-open`.
- The ⌘K listener inside the island (`useGlobalSearchHotkey.ts`).
- `/dashboard/search` — the full results page with filter chips (`search.astro` + `SearchResults.tsx`).

Findings from this session's research that shape the work:

- **The desktop panel already scrolls.** `GlobalSearch.tsx:266` is
  `max-h-[460px] overflow-y-auto`. The design's "make the results list scroll, not clip"
  item needs no code change.
- **The real clipping risk is the RPC.** `search_staff` caps each group at `limit 8`
  (lines 151, 185, 210). That cap was only ever safe _because_ the results page was the
  escape hatch — the migration's own comment says so: "The dropdown shows a handful and
  links out to the full results page, which can widen this later." Delete the page without
  touching the cap and match #9 becomes unreachable.
- **⌘K has no handler once the island is unmounted.** `useGlobalSearchHotkey` dispatches to
  a module-scoped `activeHandlers` that only a mounted island registers. Hoisting the
  listener into `Layout.astro` (the original scope item 6) moves _where it is installed_
  but not _what it opens_.
- **The desktop dropdown is anchored to the field.** It is a radix `Popover` with the field
  as `PopoverAnchor` (`GlobalSearch.tsx:209`). On a page that renders no field there is no
  anchor and no input to focus. Below `md` this does not apply — the overlay portals into
  `<body>` with its own input.
- **The design now draws a `VehicleRow`.** `SEARCH_DATA.vehicles` was `[]` when S-13 was
  planned, which is the entire justification for deviation **D9**. It is populated now.
- **Header order mismatch.** The design's `StaffTopbar` right group is
  field(520) → calendar(38×38) → QuickAdd, gap 12. Our shell renders `header-action`
  _before_ `<GlobalSearch>`, so the dashboard draws calendar → field.
- `header-title` (the slot added for D13) and `SearchResults.tsx` are used **only** by
  `search.astro` — verified by grep. `pluralPl` is also used by `landing/TrustCard.astro`,
  so it stays.

## Desired End State

A logged-in employee opens Pulpit and sees a 520px search field at desktop widths, or a
44×44 magnifier beside their avatar on mobile. Typing shows grouped, scrolling results;
Enter opens the highlighted row. From any other staff page, ⌘K takes them to Pulpit with
search already open. `/dashboard/search` no longer exists, and nothing anywhere offers
"Zobacz wszystkie wyniki".

Verify by: visiting each of the 10 staff pages (field present only on `/dashboard`);
pressing ⌘K from `/dashboard/returns` at desktop width; requesting `/dashboard/search`
(404); and searching a token matching more than 8 vehicles (all of them listed, panel
scrolls).

### Key Discoveries

- `supabase/migrations/20260810130000_staff_search.sql:151,185,210` — the three `limit 8` clauses.
- `tests/integration/staff-search.test.ts:84` — a nine-vehicle fixture whose only purpose is
  proving the per-group cap at `:357`.
- `src/components/search/GlobalSearch.tsx:139-149` — `openSearch` already branches on
  `matchMedia("(min-width: 768px)")`; the desktop branch is where the navigation fallback belongs.
- `src/components/shell/StaffShell.astro:222-228` — D10's density comment and its arithmetic,
  which the magnifier's removal invalidates.
- `src/lib/access.ts:43-46` — the `/dashboard/search` route entry.
- Lessons: definer-RPC grant hygiene (revoke before grant), design fidelity at exact values
  with a vision-diff gate.

## What We're NOT Doing

- **Not reverting the Phase 2 shell restructure.** The always-on top bar and the five
  migrated page headers (dashboard, staff, vehicles/new, vehicles/[id]/edit, protocols/[id])
  stay. Its original justification — carrying the search field on every page — goes away
  with this change, but it is now what gives every staff page a consistent title/action bar.
  Reverting would re-fragment five headers for no gain. `showHeader` keeps governing only
  the left slot.
- **Not adding a search affordance to any other screen**, and not putting one back in the
  mobile tab bar. An icon inherits its scope from its container, so a magnifier in a section
  header reads as "search this section" — on Flota it would sit directly above the
  `Marka, model…` filter.
- **Not moving the filter chips into the dropdown.** `Wszystko / Rezerwacje / Zwroty /
Pojazdy` belonged to the deleted page. Group headers plus scrolling replace them.
- **Not drawing a truncation state.** No "showing 8 of 40", no per-group "and N more".
- **Not touching the scoped filters** on Flota and Zespół, and not adding scoped search to
  the worklists (Zwroty/Wnioski/Wydania), whose data is deliberately truncated to
  today+overdue and would give false negatives.
- **Not adding an E2E spec.** Test depth for this change is minimal by decision — see
  Testing Strategy for what that leaves unverified.
- **Not hoisting the ⌘K listener into `Layout.astro`.** The island stays mounted on every
  page, so the hook keeps working where it is. The original scope item collapses.

## Implementation Approach

Order is driven by one constraint: **the escape hatch must not be removed while the cap
still bites.** So the RPC widens first (Phase 1), the page goes second (Phase 2), and the
entry points narrow third (Phase 3). Phase 4 closes the design contract.

The mount narrowing and the ⌘K routing ship in the same phase deliberately. Introducing
"the field is absent here" without "and here is what ⌘K does instead" leaves the tree in a
state where the shortcut opens an unanchored popover at desktop widths.

The island stays mounted on all 10 pages; only the **field** becomes conditional. That
keeps ⌘K instant below `md` (the overlay needs no anchor) and gives the desktop branch a
place to live.

## Critical Implementation Details

**Timing & lifecycle — the auto-open round-trip.** `/dashboard?search=1` must open the
dropdown _after_ the island hydrates, and the parameter must not survive in the URL (a
refresh or a shared link would re-open search unbidden). Strip it with
`history.replaceState` in the same effect that opens, not on a later interaction.

**State sequencing — focus after the popover's open frame.** The existing `openSearch`
already defers focus to `requestAnimationFrame` because radix's autofocus handling races a
synchronous `focus()`. Auto-open on mount inherits that constraint.

## Phase 1: Widen the per-group result cap

### Overview

Raise `search_staff`'s three per-group caps from 8 to 25, so the dropdown can be the only
surface without silently hiding matches.

### Changes Required:

#### 1. New migration

**File**: `supabase/migrations/20260817120000_search_staff_widen_cap.sql`

**Intent**: `create or replace` `public.search_staff` with `limit 25` on all three branches,
and rewrite the header's CAP comment, which currently justifies 8 by pointing at the results
page that no longer exists. Nothing else about the function changes — same signature, same
role gate, same ILIKE escaping, same ordering.

**Contract**: `public.search_staff(p_query text)` keeps its exact `returns table (…)` shape —
the client's `groupSearchRows` depends on it and no regenerated types are needed.
`create or replace` preserves the existing ACL, so the revoke/grant pair is re-stated at the
bottom for idempotence rather than necessity (lessons: never rely on a bare grant to restrict).

#### 2. Cap assertion

**File**: `tests/integration/staff-search.test.ts`

**Intent**: The existing test proves the cap with a nine-vehicle fixture; at 25 that fixture
no longer reaches the cap. Repoint the assertion at what the fixture can now prove — that all
nine come back — and rename the test accordingly, so a green suite does not imply a verified
upper bound.

**Contract**: `expect(vehicles).toHaveLength(9)`; the fixture at `:84` is unchanged. The
`:26` header comment claiming "the per-group cap holds" is reworded.

### Success Criteria:

#### Automated Verification:

- Migration applies cleanly against local Supabase
- Type checking passes: `npx astro check`
- Linting passes: `npm run lint`
- Integration suite passes: `npm run test:integration`

#### Manual Verification:

- A query matching more than 8 vehicles returns them all from `GET /api/search`

**Implementation Note**: all worktrees share one local Supabase (`config.toml project_id`).
Do **not** `db reset` — a sibling's reset already drops migrations. Apply this file via psql
plus `notify pgrst, 'reload schema'`, and check `supabase_migrations.schema_migrations` first.

---

## Phase 2: Delete the full results page

### Overview

Remove `/dashboard/search` and every route into it. After this phase the dropdown is the
only search surface.

### Changes Required:

#### 1. The page and its island

**File**: `src/pages/dashboard/search.astro` (delete), `src/components/search/SearchResults.tsx` (delete)

**Intent**: Both exist solely for the results page. Verified: no other importer.

**Contract**: `resultCountLabel` is exported from `SearchResults.tsx` and imported nowhere else.

#### 2. Route gating

**File**: `src/lib/access.ts`

**Intent**: Drop the `/dashboard/search` entry. The path falls back to the `/dashboard`
prefix, which is what a 404 under the staff area should resolve against anyway.

**Contract**: `ROUTE_ROLES` loses one row; `resolveRequiredRole("/dashboard/search")` returns
`"employee"` via the `/dashboard` prefix instead of an explicit rule.

#### 3. Shell state and slot

**File**: `src/components/shell/StaffShell.astro`

**Intent**: Remove `"search"` from the `active` union and the comment explaining it, and
remove the `header-title` slot — it was added for D13 (the results page's eyebrow-above-
headline block) and nothing else uses it. The left slot returns to the plain
title/subtitle pair under `showHeader`.

**Contract**: `Props["active"]` drops `"search"`; the `<slot name="header-title">` wrapper
disappears, leaving its default content as the only branch.

#### 4. Dropdown links out

**File**: `src/components/search/GlobalSearch.tsx`

**Intent**: Remove every route to the deleted page — `resultsHref`, the `onListKeyDown`
no-results Enter fallback, the mobile full-width "Zobacz wszystkie wyniki" anchor, and
`PanelFooter`'s `seeAll` branch. The footer then shows the keyboard hints in **every** phase,
which is what the design draws. Drop the now-dead `COPY.seeAll` and `RESULT_FORMS`; keep the
`pluralPl` import only if something still uses it (it does not — `landing/TrustCard.astro`
imports it separately).

**Contract**: `PanelFooter` loses its `seeAll` prop and takes none; `onKeyDown={onListKeyDown}`
comes off both `<Command>` elements; the mobile results branch renders `<ResultGroups>` alone,
so its fragment wrapper collapses.

#### 5. Dead row prop

**File**: `src/components/search/SearchRows.tsx`

**Intent**: The three rows accept a `className` override that only the results page passed
(`PAGE_ROW`). Remove it so the row shell has one shape.

**Contract**: `ReservationRow` / `ReturnRow` / `VehicleRow` drop `className` from their props;
`cn(ROW_SHELL, className)` becomes `ROW_SHELL`.

### Success Criteria:

#### Automated Verification:

- Type checking passes: `npx astro check`
- Linting passes: `npm run lint`
- Production build succeeds: `npm run build`
- Unit tests pass: `npm test`

#### Manual Verification:

- `/dashboard/search` returns 404
- The dropdown footer shows `↑ ↓ nawigacja · ↵ otwórz` / `esc zamknij` in the resting,
  results and no-results phases alike
- The mobile results list ends with the last Pojazdy row — no button below it

---

## Phase 3: Pulpit-only entry points + ⌘K routing

### Overview

The field renders only on `/dashboard`; the mobile magnifier moves from the tab bar to the
dashboard hero; ⌘K keeps working everywhere by routing back to Pulpit at desktop widths.

### Changes Required:

#### 1. Conditional field, unconditional island

**File**: `src/components/shell/StaffShell.astro`

**Intent**: Add a `search` prop (default `false`) that governs whether the desktop field is
rendered. `<GlobalSearch>` stays mounted on every page regardless — it owns the ⌘K listener
and the mobile overlay, both of which must work off-Pulpit. Also reorder the right group so
the field precedes `header-action`, matching the design's field → calendar → QuickAdd order.

**Contract**: `Props` gains `search?: boolean`; `<GlobalSearch>` gains a `field={search}`
prop; the right-hand `<div>` renders `<GlobalSearch>` then `<slot name="header-action" />`.

#### 2. Field suppression and the desktop fallback

**File**: `src/components/search/GlobalSearch.tsx`

**Intent**: A new `field` prop (default `true`). When false the component renders no desktop
field and no `Popover` — only the mobile overlay and the hotkey. `openSearch`'s desktop
branch then has nowhere to open, so it navigates to Pulpit with search requested instead.
Below `md` behavior is unchanged: the overlay opens in place on any page.

**Contract**: `GlobalSearchProps` gains `field?: boolean` and `autoOpen?: boolean`. With
`field === false`, the desktop branch of `openSearch` performs
`window.location.href = "/dashboard?search=1"`. The `Command` wrapper still renders (it owns
the hotkey registration) but its `Popover` subtree does not.

#### 3. Auto-open on arrival

**File**: `src/pages/dashboard.astro`, `src/components/search/GlobalSearch.tsx`

**Intent**: Pulpit reads `?search=1` server-side and passes `autoOpen` to the island, which
opens the matching surface for the current width on mount and strips the parameter from the
URL so a refresh or a copied link does not re-trigger it.

**Contract**: `dashboard.astro` passes `search` and `autoOpen={Astro.url.searchParams.get("search") === "1"}`
through `StaffShell` to the island. The island's mount effect calls the existing `openSearch`
and `history.replaceState` with the parameter removed — see Critical Implementation Details
for the ordering constraint.

#### 4. Mobile entry moves to the hero

**File**: `src/pages/dashboard.astro`

**Intent**: Add the design's magnifier button to the `md:hidden` hero, left of the initials
avatar, carrying `data-search-trigger` so the shell's existing binder wires it to
`flota:search-open`. The hero's comment ("Search is deferred, so the right slot carries only
the avatar") is now wrong and goes.

**Contract**: exact values from `staff-screens.jsx` `ScreenWorkerDash` — `44×44`,
`rounded-full` (design `borderRadius: 99`), `bg-card`, `1px solid var(--flota-hair)`,
`shadow-card` (design `tokens.shadow1`), search icon `19px` in `--foreground`, wrapped with
the avatar in a `gap-2.5` (design `gap: 10`) flex row. `aria-label="Szukaj"`.

#### 5. Tab-bar magnifier out

**File**: `src/components/shell/StaffShell.astro`

**Intent**: Remove the magnifier `<button>` from the floating tab bar. Keep the
`bindSearchTrigger` script — the dashboard hero button now uses it — but update its comment,
which currently says the trigger lives in the tab bar. Re-measure D10: with the magnifier
gone the admin pill carries 7 entries, which fits the 360px floor at the _original_ sizing
(40·7 + 4·6 + 12 = 316px).

**Contract**: the `<button data-search-trigger>` block and the `active === "search"` highlight
condition disappear. **Keep the `size-9`/`gap-0.5`/`p-1` tightening below `sm`.** It is no
longer strictly required today, but S-11's "Profil" tab takes the pill to 8 entries, which at
the original sizing is exactly 360px — the floor with zero margin. Retiring the tightening
now would hand that problem to whoever merges S-11. D10 is reworded rather than deleted; flag
this if you would rather restore full sizing and let S-11 re-solve it.

### Success Criteria:

#### Automated Verification:

- Type checking passes: `npx astro check`
- Linting passes: `npm run lint`
- Production build succeeds: `npm run build`

#### Manual Verification:

- The 520px field appears on `/dashboard` only; the other 9 staff pages show no field
- On `/dashboard` the field sits to the LEFT of the calendar button
- ⌘K from `/dashboard/returns` at desktop width lands on Pulpit with the dropdown open and a
  clean URL (no `?search=1` left behind)
- ⌘K below `md` opens the full-screen overlay in place on a non-Pulpit page
- The mobile hero shows the magnifier left of the avatar and it opens the overlay
- The mobile tab bar has no magnifier, and the pill does not overflow at a 360px viewport

**Implementation Note**: pause here for manual confirmation before Phase 4 — this phase owns
every behavior a user can notice.

---

## Phase 4: Vehicle row fidelity + design contract

### Overview

Bring the Pojazdy row onto the design that now exists for it, then rewrite the design contract
and the S-13 documents to match the narrowed feature.

### Changes Required:

#### 1. Vehicle result row

**File**: `src/components/search/SearchRows.tsx`

**Intent**: The design draws a vehicle row for the first time, so `VehicleRow`'s spec line
adopts it: make only (the model is already carried by `name` — seed data reads
`Mercedes Sprinter 315 CDI` / `Mercedes-Benz` / `Sprinter`), separated from the plate by a
round dot rather than a `·` character. Keep the `Wycofany` pill; the design has no retired
state, and that becomes the whole of D9.

**Contract**: exact values from `search-flow.jsx` `VehicleRow` — name `13.5px`/`600`
highlighted; spec line `gap-[7px]`, make `12px` `--muted-foreground`, separator
`3×3 rounded-full bg-[var(--flota-hair)]`, plate `font-mono 11.5px 600` in `--flota-ink-2`,
still wrapped in `<Highlight>`; trailing chevron `16px`.

#### 2. Design contract

**File**: `context/changes/staff-global-search/design-contract.md`

**Intent**: Bring the contract to the current design. This is the document the implement- and
review-stage vision diffs run against, so a stale line here re-flags forever.

**Contract**: **D1** and **D2** become `exact` — the design dropped Klienci and
`Ostatnie wyszukiwania` too, so app and mock now agree. **D9** shrinks to the `Wycofany` pill.
**D13** and **D14** delete with the results page. **D16** is reworded: the design now draws
the active Zwroty/Pojazdy row with the `↵` chip _beside_ the chevron, while we swap them
(owner-reported, `f00ffec`) — a live deviation now, not an undrawn case. **D10** is
re-measured at 7 entries with the S-11 headroom rationale. New deviation for ⌘K navigating to
Pulpit off-Pulpit (the design has no such state). **Surface 3** deletes; **Surface 4** loses
its "see all" button; the screen inventory drops `ScreenSearchResultsPage` /
`ScreenSearchMobilePage` and gains `ScreenSearchLiveScrolled`; the freshness table and verdict
are rewritten.

#### 3. S-13 documents

**File**: `context/changes/staff-global-search/plan.md`, `context/changes/staff-global-search/change.md`

**Intent**: Record the narrowing where a reader of S-13 will find it — the plan's
"What We're NOT Doing" gains the results page and the per-screen entry points; `change.md`'s
Notes lose the "Enter → a full results page" description.

**Contract**: additive edits only; Progress rows and their SHAs are untouched.

#### 4. Canonical screenshots

**File**: `context/changes/staff-search-dashboard-only/design-review/` (new), plus pruning
`context/changes/staff-global-search/design-review/` (8 stale PNGs, two of them rendering
deleted screens)

**Intent**: The export request was rewritten at plan time
(`design-export-request.md` — 6 desktop + 4 mobile, `v2-` prefix, Polish enforced) and is
yours to run in the Design app. This step lands the returned PNGs, audits them against the
"must / must not appear" lists in that request, and runs the rendered vision-diff for every
surface in `design-contract.md`.

**Contract**: the diff compares the real app at 1440×900 and 390×844 against the canonical
PNGs, and must come back empty apart from the recorded deviations (D9, D16, D10, N1–N3) and
the two pre-existing deltas listed under "Known deltas" in the contract.

### Success Criteria:

#### Automated Verification:

- Type checking passes: `npx astro check`
- Linting passes: `npm run lint`
- Unit tests pass: `npm test`

#### Manual Verification:

- The Pojazdy row reads `Mercedes-Benz ● WX 5519M` under the vehicle name
- Every deviation in `design-contract.md` describes something still true of the app
- Canonical PNGs landed in `design-review/`; rendered vision-diff empty apart from recorded deviations

---

## Phase 5: Mobile active-row contrast

### Overview

On the mobile overlay the highlighted row is invisible — it paints the exact color it sits on,
leaving only a `rgba(15,23,42,0.08)` hairline. Owner-reported after the Phase 3 walkthrough.

**Root cause, confirmed against the design source.** `search-flow.jsx`'s `RowShell` is shared by
both surfaces and defines `background: active ? tokens.bg : 'transparent'` +
`inset 0 0 0 1px tokens.hair`. That reads on **desktop**, where `SearchPanel`'s container is
`tokens.card`. But `MobileSearchShell`'s body is itself `background: tokens.bg`, so the active
background is a no-op there. The mock never exposed it because **no mobile screen passes
`active`** — `ScreenSearchLive` sets `active={i === 0}`, `ScreenSearchMobileLive` sets it on
nothing. We render it for real because cmdk always keeps a row selected. Our tree reproduces the
design exactly (`GlobalSearch.tsx` overlay is `bg-background`; `ROW_SHELL` is
`data-[selected=true]:bg-background`), so this is a design gap inherited faithfully, not a
porting error.

Affects every row in the overlay — the quick-jumps in the resting state as well as the three
result groups.

### Changes Required:

#### 1. A mobile-only active treatment

**File**: `src/components/search/SearchRows.tsx`

**Intent**: Invert figure and ground below `md`: the active row becomes `bg-card` against the
overlay's `bg-background`, keeping the same hairline inset ring. Do **not** change the overlay
body to `bg-card` instead — the mock _draws_ that body as `tokens.bg` across all three mobile
screens, so changing it contradicts a drawn value and would light up the vision diff, whereas
defining a mobile active state fills a gap the design left empty.

**Contract**: `ROW_SHELL` keeps `data-[selected=true]:bg-background` at `md+` and resolves to
`bg-card` below it (`max-md:data-[selected=true]:bg-card`, or split the shell into a shared base
plus a per-surface active class if the variant stacking reads badly). The
`inset_0_0_0_1px_var(--flota-hair)` ring is unchanged on both. No change to the desktop panel,
whose `bg-card` container already gives the drawn treatment its contrast.

#### 2. Record the deviation

**File**: `context/changes/staff-global-search/design-contract.md`

**Intent**: The design has no mobile active row, so this is a new `deviation(no-design-state)` —
**D19** — and Surface 4's line gains the active treatment. Note the shared-`RowShell` collision
in the deviation text so a future reader does not "fix" it back to the design's literal value.

**Contract**: **D19 `deviation(no-design-state)`** — below `md` the active row is `bg-card`, not
the design's `tokens.bg`, which is the overlay's own ground. Surfaces 2 and 4 cross-reference it.

### Success Criteria:

#### Automated Verification:

- Type checking passes: `npx astro check`
- Linting passes: `npm run lint`
- Production build succeeds: `npm run build`

#### Manual Verification:

- At 390×844 the highlighted row is clearly distinct from its neighbours, in both the resting
  (quick-jump) and results phases
- The desktop dropdown's active row is unchanged

---

## Phase 6: Don't draw an empty top bar

### Overview

`/dashboard/protocols/{id}` renders a ~45px empty band at `md+`. Owner-reported after the
Phase 5 walkthrough; introduced by Phase 3.

Three conditions coincide on exactly that page: it sets `showHeader={false}` (its
`ProtocolView` island draws its own title, so the shell's would duplicate it), it passes no
`header-action`, and since Phase 3 it renders no search field. Both slots of the always-on
bar are empty, leaving `px-8 py-[22px]` of nothing above a `border-b`. Until Phase 3 the
520px field filled the right slot on every page — which is precisely what made an always-on
bar safe in S-13.

### Changes Required:

#### 1. Render the bar only when it has content

**File**: `src/components/shell/StaffShell.astro`

**Intent**: Gate the `<header>` on there being something to put in it. **The island cannot be
gated with it** — `<GlobalSearch>` lives inside that header and owns the ⌘K listener and the
mobile overlay, so hiding the header would unmount it and kill both on that page. It is
therefore rendered in the else-branch too, from a single shared props object so the two call
sites cannot drift.

**Contract**: `Astro.slots.has("header-action")` feeds a `showBar = showHeader || search ||
hasHeaderAction` flag. When `showBar` the tree is unchanged. When not, only
`<GlobalSearch client:load {...searchProps} />` renders in the content column — no `<header>`,
no border, no padding. `field` is necessarily `false` in that branch (a page passing `search`
satisfies `showBar`), so nothing visible is emitted: the cmdk root is `display: contents` and
its only child is an `sr-only` label.

**Not doing**: giving `protocols/[id]` a title instead. Its island already renders one in the
card header — that is why `showHeader={false}` is there, and the plan's "What We're NOT Doing"
keeps `showHeader` governing the left slot alone.

### Success Criteria:

#### Automated Verification:

- Type checking passes: `npx astro check`
- Linting passes: `npm run lint`
- Production build succeeds: `npm run build`

#### Manual Verification:

- `/dashboard/protocols/{id}` at `md+` has no empty band above the protocol card
- The other 9 staff pages' bars are unchanged
- ⌘K and the mobile overlay still work on `/dashboard/protocols/{id}`

---

## Phase 7: Don't let ⌘K discard a part-filled form

### Overview

Phase 3's desktop fallback is `window.location.assign("/dashboard?search=1")` — a **full
navigation**. Two of the nine fieldless pages carry the ~18-field `VehicleForm` island
(`vehicles/new.astro:31`, `vehicles/[id]/edit.astro:44`), and `grep -rn "beforeunload" src`
returns nothing, so pressing ⌘K mid-form silently discards everything typed. Owner-reported;
introduced by Phase 3.

Blast radius is desktop-only (below `md` the overlay opens in place and nothing navigates) and
limited to those two pages — but it lands on exactly the power user who knows the shortcut.

### Changes Required:

#### 1. Guard the form while it is dirty

**File**: `src/components/fleet/VehicleForm.tsx`

**Intent**: Register a `beforeunload` handler whenever the form differs from the values it
opened with, so a full navigation asks for confirmation instead of dropping the work. Dirtiness
is a **comparison against a pristine snapshot**, not a flag each of the ~18 field handlers
would have to remember to set.

**Contract**: a `pristine` memo captures `initialStrings(vehicle)` plus the three
separately-held values (`category`, `transmission`, `photos`) exactly as the `useState`
initialisers do. `dirty` is a field-by-field comparison against it. The effect is armed on
`dirty && !submitting` and removes its listener on cleanup. **Disarming on `submitting` is
load-bearing**: the success path is `window.location.assign("/dashboard/vehicles")`, which
would otherwise prompt the user on a save that worked. `setSubmitting(false)` in the `finally`
re-arms it after a failed submit.

**Known limit, stated rather than papered over**: `<ClientRouter>` is app-wide, so an in-app
link click is a DOM swap that never unloads the document and therefore never fires this
handler. The guard covers full-document navigations — ⌘K's `location.assign`, a reload, a
closed tab, an external link. Catching in-app navigation needs a separate
`astro:before-preparation` guard and is a UX decision of its own, not part of this fix.

**Not doing**: removing the ⌘K navigation. Making the shortcut open an unanchored command
palette at `md+` would delete the failure mode rather than warn about it, and would drop a
full page reload from every ⌘K on nine pages — but it is a desktop surface the design does not
draw, so it is its own decision.

### Success Criteria:

#### Automated Verification:

- Type checking passes: `npx astro check`
- Linting passes: `npm run lint`
- Production build succeeds: `npm run build`
- Unit tests pass: `npm test`

#### Manual Verification:

- Half-fill `/dashboard/vehicles/new`, press ⌘K at desktop width → the browser asks before leaving
- A successful save still redirects to `/dashboard/vehicles` with no prompt
- Opening `/dashboard/vehicles/{id}/edit` and changing nothing → ⌘K leaves without a prompt

---

## Phase 8: No ⌘K on the two form sub-screens

### Overview

Owner decision after Phase 7: rather than warn before abandoning a form, don't offer the
shortcut that abandons it. Search is a **navigation** affordance, and on a focused sub-screen
whose whole job is data entry, a shortcut that leaves the page is a footgun regardless of the
guard in front of it.

The line is "reached from the menu" vs "reached from inside a screen". Seven of the ten shell
pages are nav destinations (`Pulpit / Wnioski / Wydania / Zwroty / Kalendarz / Flota / Zespół`)
and keep ⌘K. Three are sub-screens; the two that carry `VehicleForm` lose it.
`protocols/[id]` **keeps** it — it is a read-only view (two `useState`s, no form), so there is
nothing to abandon.

Not derived from the URL, though the nav hrefs would allow it: "has a form" is a property of
the page, not of its path, and a future sub-screen with a form would silently inherit the
wrong answer.

### Changes Required:

#### 1. An opt-out prop, threaded to the hook

**File**: `src/components/shell/StaffShell.astro`, `src/components/search/GlobalSearch.tsx`,
`src/components/hooks/useGlobalSearchHotkey.ts`

**Intent**: `StaffShell` gains `searchHotkey?: boolean` (default `true`), passed to the island
as `hotkey`, which passes `enabled` to `useGlobalSearchHotkey`. The hook must still be
**called** unconditionally — rules of hooks — so the flag gates registration inside it, not the
call site.

**Contract**: with `enabled: false` the hook does not write `activeHandlers`, so the
module-scoped document listener finds no handler and returns early; ⌘K falls through to the
browser's own binding. The singleton install and the `astro:page-load` re-arm are unchanged, so
a page that _does_ want the shortcut still gets it after a view transition. The island still
mounts (it owns the mobile overlay), and the `flota:search-open` listener is unaffected.

#### 2. Opt the two form pages out

**File**: `src/pages/dashboard/vehicles/new.astro`, `src/pages/dashboard/vehicles/[id]/edit.astro`

**Intent**: both render `<VehicleForm client:load>` inside `StaffShell`; both pass
`searchHotkey={false}`.

**Contract**: `<StaffShell active="fleet" … searchHotkey={false}>`. Neither page renders a
search field or a mobile magnifier already, so after this they offer no route into search at
all — which is the intent: get to Pulpit first, or finish the form.

#### 3. Keep Phase 7's guard

Phase 7 is **not** reverted. Its trigger is gone, but a `beforeunload` on a dirty ~18-field
form still covers a reload, a closed tab and an external link. It is now belt-and-braces
rather than the primary fix, and the plan says so instead of leaving a reader to wonder why
both exist.

### Success Criteria:

#### Automated Verification:

- Type checking passes: `npx astro check`
- Linting passes: `npm run lint`
- Production build succeeds: `npm run build`
- Unit tests pass: `npm test`

#### Manual Verification:

- ⌘K on `/dashboard/vehicles/new` and `/dashboard/vehicles/{id}/edit` does nothing in the app
- ⌘K still works on all seven nav pages and on `/dashboard/protocols/{id}`
- ⌘K still works after navigating _away_ from a form page to a nav page (the singleton re-arms)

---

## Phase 9: Don't re-arm the unload guard on a successful save

### Overview

Phase 7 declared the `submitting` disarm "load-bearing" on the reading that
`setSubmitting(false)` in the `finally` "re-arms it after a failure". That reading is
wrong: the success branch `return`s from **inside** the `try` (`VehicleForm.tsx:423-425`),
and `try { return } finally {}` always runs the `finally`. So `submitting` flips back to
false synchronously right after `location.assign("/dashboard/vehicles")`, `dirty` is still
true, and the effect at `:338` re-attaches `beforeunload` while the redirect is in flight.

Found by `/10x-impl-review` 2026-08-17 (F1). The common case still works — no listener is
attached at `assign()` time, so the browser's prompt-to-unload check passes before React
re-attaches — which is why manual step 7.6 was green. It passes by ordering, not by
construction. What it does not cover: a second navigation during the redirect (back
button, another click) prompts on a form that was already saved.

The `finally` is **pre-existing** — it arrived with the form at `14db20a`, so Phase 7 built
on a premise about it that was never true. Resetting pending on success also breaks
CLAUDE.md's async-button rule verbatim ("Keep the pending state through a success redirect;
reset only on error"): the button reverts from the spinner to `Zapisz zmiany` mid-redirect,
which re-opens a duplicate-POST window.

### Changes Required:

#### 1. Reset the pending flag only on the paths that stay on the page

**File**: `src/components/fleet/VehicleForm.tsx`

**Intent**: Take `setSubmitting(false)` out of the `finally` and call it on each path that
returns the user to the form — the 400-with-field-errors branch, the generic-error branch,
and the `catch`. The success branch leaves `submitting` true through the redirect, which is
both what the effect's guard needs and what CLAUDE.md asks for. Rewrite the comment at
`:335-337` so it describes what the code does rather than what the `finally` was assumed to do.

**Contract**: `handleSubmit` loses its `finally` block; `setSubmitting(false)` appears in the
`res.status === 400 && body.errors` branch, after `setSubmitError(body.error ?? COPY.genericError)`,
and in the `catch`. The success branch (`:423-425`) is unchanged and never resets. The effect
at `:338-353` is untouched — its `!dirty || submitting` guard now holds for the whole
navigation.

**Not doing**: the same fix on `ReservationForm.tsx:292-294`, which has the identical shape.
It has no `beforeunload` guard riding on it, so it is a CLAUDE.md-conformance cleanup on its
own schedule, not part of this defect. Flag it if you would rather land both together.

### Success Criteria:

#### Automated Verification:

- Type checking passes: `npx astro check`
- Linting passes: `npm run lint`
- Production build succeeds: `npm run build`
- Unit tests pass: `npm test`

#### Manual Verification:

- Half-fill `/dashboard/vehicles/new`, then reload → the browser still asks before leaving
- A successful save redirects to `/dashboard/vehicles` with no prompt, and the submit button
  stays in its `Zapisywanie…` spinner state for the whole redirect
- A save that fails validation (400) re-enables the button and leaves the guard armed
- Save successfully, then press Back before the new page paints → no prompt

---

## Phase 10: Close the design contract's `exact` lines

### Overview

Three `exact` lines in `design-contract.md` describe something the app does not do. Two are
real pixels (F2, F4 from the 2026-08-17 impl review); the third is the bookkeeping around the
skipped vision-diff gate (F3), which belongs here because F2 and F4 are the evidence it turns on.

The gate's stated rationale was that a diff would "re-verify the transcription, not the
design", since every value came from code-backed JSX. That only follows if the app matches the
transcription — and on these two surfaces it doesn't. The other two legs of the rationale
(the gate would have missed D19; the change is mostly removal) still stand, so the decision to
skip is kept — the claim that no longer holds is removed from the record.

### Changes Required:

#### 1. Mobile results body padding

**File**: `src/components/search/GlobalSearch.tsx`

**Intent**: The mobile `Command.List` is `py-1.5` (6px top and bottom) where the contract says
`padding 4px 0 24px`. The class itself did not change in this slice, but the render did:
until Phase 2 the bottom gap was supplied by the deleted "Zobacz wszystkie wyniki" button
(`mx-4 mt-3 mb-2` plus its own `h-12`). The last Pojazdy row now sits 6px from the viewport edge.

**Contract**: the mobile `Command.List` at `:361` becomes
`min-h-0 flex-1 overflow-y-auto pt-1 pb-6`. The **desktop** list at `:315` keeps `py-1.5` —
the contract gives no desktop body padding, so that value is not in scope.

#### 2. One `Kbd`, at its exact values

**File**: `src/components/search/GlobalSearch.tsx`, `src/components/search/SearchRows.tsx`

**Intent**: `Kbd` (`GlobalSearch.tsx:383`) and `EnterChip` (`SearchRows.tsx:112`) are the same
chip written twice, differing only by `font-sans` and `EnterChip`'s
`group-data-[selected=true]:flex` visibility. Both diverge from the contract's single `exact`
`Kbd` block in the same three ways, so every fix currently has to be made twice. Fold them
into one exported component and correct the three values there.

**Contract**: `Kbd` moves to a module both files import (`SearchRows.tsx` is the natural home —
`GlobalSearch.tsx` already imports from it). Its class gains `px-[5px]` (was `px-1` = 4px;
contract says `padding 0 5px`), `text-[var(--flota-ink-2)]` (was `text-muted-foreground`;
contract says `tokens.ink2`) and `shadow-[0_1px_0_rgba(15,23,42,0.05)]` (was absent).
`h-5 min-w-[18px] rounded-[5px] border border-[var(--flota-hair)] bg-card text-[11px] font-[650]`
are already correct and stay. `EnterChip` wraps `Kbd` and keeps only the visibility class.
Also: the `PanelFooter` hint spans (`:541`, `:549`) go from `text-[11px]` to `text-[11.5px]` —
Surface D gives `fontSize 11.5` as `exact`.

#### 3. Make the record match

**File**: `context/changes/staff-search-dashboard-only/plan.md`,
`context/changes/staff-search-dashboard-only/change.md`,
`context/changes/staff-search-dashboard-only/design-contract.md`

**Intent**: Restate Progress row 4.6 so it no longer rests on the falsified claim, and stop
the plan counting a not-run row as done. Fix the one stale line reference in the contract.

**Contract**: row 4.6's note drops the "diffing a render of the app against a render of that
same source re-verifies the transcription, not the design" sentence and cites this review
instead; the row is written `- [~]` (closed, not done) with a one-line legend added to the
Progress convention note, so the completion arithmetic stops reading 52/52. `change.md`'s
"All 52 Progress rows are green" becomes an accurate count, and its second bullet loses the
same claim. `design-contract.md:136` updates its `GlobalSearch.tsx:266` citation to `:315`.

**Not doing**: running the gate. The owner decision stands on its remaining two legs; this
step removes a justification, not the decision.

### Success Criteria:

#### Automated Verification:

- Type checking passes: `npx astro check`
- Linting passes: `npm run lint`
- Production build succeeds: `npm run build`
- Unit tests pass: `npm test`

#### Manual Verification:

- At 390×844 the last Pojazdy row clears the viewport edge by 24px, and the resting
  quick-jump list is unchanged
- The `⌘`/`K` chips in the field, the footer's `↑ ↓ ↵ esc` chips and the active row's `↵`
  chip are visually identical to each other, and each carries the 1px bottom shadow
- The dropdown footer hints read at 11.5px in both the resting and results phases
- `plan.md`'s Progress count and `change.md`'s summary agree, and neither claims 4.6 was run

---

## Phase 11: Clean up what the deletion left behind

### Overview

Five small items from the 2026-08-17 impl review (F5–F9). None is a defect a user can reach;
all are cases where a type, a comment or a test says something the code no longer does. Grouped
into one phase because each is a few lines and they share no risk.

### Changes Required:

#### 1. The row type still accepts a dead prop

**File**: `src/components/search/SearchRows.tsx`

**Intent**: Phase 2 #5 said the rows "drop `className` from their props". The runtime half
landed — `:149`, `:181`, `:210` are all `className={ROW_SHELL}` — but `RowAnchorProps` still
spreads in `className` from the anchor props, and `{...anchor}` comes **before**
`className={ROW_SHELL}`, so an override type-checks and is silently discarded.

**Contract**: `RowAnchorProps` (`:138`) becomes
`Omit<React.ComponentPropsWithRef<"a">, "children" | "className">`.

#### 2. The inert re-arm

**File**: `src/components/hooks/useGlobalSearchHotkey.ts`

**Intent**: The `astro:page-load` re-arm at `:111` cannot do what its comment claims. `install()`
early-returns on `installed`, which is never reset, so it could not reinstall anything even if
the event fired; and `install` is one module-level function reference, so `addEventListener`
dedupes it — the outgoing island's `removeEventListener` at `:117` removes the registration the
incoming island just added. After the first client-side navigation nothing is registered at all.
The hook's behaviour is correct regardless (the `document` keydown listener survives every
swap); only the dead code and the two comments that misdescribe it need to go.

**Contract**: the `document.addEventListener("astro:page-load", install)` at `:111` and its
`removeEventListener` at `:117` are removed; the `:109-110` comment goes with them. The header
comment at `:10-13` drops the "Astro does not reliably run React cleanup for a swapped-away
island" claim — astro-island registers `astro:after-swap` → `unmount()`, which `@astrojs/react`
wires to `root.unmount()`, so cleanup does run — and states the actual reason the listener is a
module-scoped singleton: it must outlive the island that registers it. The `:87-93` comment on
the `!enabled` branch is reworded the same way; **the `activeHandlers = null` clearing itself
stays** — it is what stops a form page inheriting the previous page's registration.

#### 3. Bound the query length

**File**: `src/pages/api/search.ts`

**Intent**: The deleted results page parsed `q` with
`z.string().trim().min(MIN_QUERY_LENGTH).max(100)`; the endpoint has never had a `.max()`. With
the page gone the repo has no length-bounded search entry, so an arbitrarily long ILIKE pattern
reaches the definer RPC.

**Contract**: `querySchema` (`:17-19`) becomes
`z.object({ q: z.string().trim().min(MIN_QUERY_LENGTH).max(100) })`. The existing 400 branch
already covers the failure, so no new response shape.

#### 4. Comments and payload the deletion outdated

**File**: `src/pages/dashboard/protocols/[id].astro`, `src/lib/search-format.ts`,
`supabase/migrations/20260817120000_search_staff_widen_cap.sql`

**Intent**: Three comments describe a world before Phase 3. `protocols/[id].astro:38-39` says
"the always-on top bar renders search-only here" — on the one page Phase 6 exists for, which
now renders no bar at all. `search-format.ts:12-13` says "these rows are server-rendered on the
results page"; both call sites are client-only now. And the original migration justified two
extra RPC columns by a `VehicleRow` that rendered make **and** model **and** category — Phase 4
dropped the model and category was never rendered, so `SearchResultVehicle.model` /
`.category` (`src/types.ts:318,320`) are dead payload on every keystroke.

**Contract**: the two comments are reworded to the dropdown. The **types and the RPC shape are
deliberately unchanged** — freezing them is what let Phase 1 skip type regeneration — so this is
a one-line note in the new migration's header recording that `vehicle_model` and
`vehicle_category` are carried for shape stability only, not for rendering.

#### 5. Pin the cap value in the test

**File**: `tests/integration/staff-search.test.ts`

**Intent**: `expect(vehicles).toHaveLength(9)` against a nine-row fixture proves "> 8", never 25. The plan already records this under "Known gaps this depth leaves" and the test comments are
honest about it, so this closes the gap rather than correcting a claim — a
`create or replace` back to `limit 10` passes green today.

**Contract**: a new assertion reads the shipped cap directly rather than seeding 26 rows —
query `pg_get_functiondef('public.search_staff'::regproc)` and assert it contains `limit 25`
(and no `limit 8`). The existing nine-row test and its fixture are unchanged. Update the `:26`
header comment: the upper bound is now pinned, just not exercised end-to-end.

### Success Criteria:

#### Automated Verification:

- Type checking passes: `npx astro check`
- Linting passes: `npm run lint`
- Production build succeeds: `npm run build`
- Unit tests pass: `npm test`
- Integration suite passes: `npm run test:integration`
- The new cap assertion fails if the migration is reverted to `limit 8` (verify by temporarily
  editing the expected value, not the migration)

#### Manual Verification:

- ⌘K still works on the seven nav pages and on `/dashboard/protocols/{id}`, and still does
  nothing on the two form sub-screens, after a full load **and** after a view transition
- `GET /api/search?q=<101 chars>` returns 400; a 100-char query still searches
- No comment in `src/` describes the results page or a search field on `protocols/[id]`

---

## Testing Strategy

Depth is **minimal by decision** — the suite is repaired, not extended.

### Unit Tests:

- `src/lib/search-format.test.ts` and `src/lib/services/search.test.ts` should pass unchanged;
  neither touches the cap or the results page.

### Integration Tests:

- `tests/integration/staff-search.test.ts` — the cap assertion is repointed (Phase 1).

### Manual Testing Steps:

1. Visit all 10 staff pages; confirm the field only on `/dashboard`.
2. From `/dashboard/returns`, press ⌘K at desktop width → Pulpit, dropdown open, URL clean.
3. Narrow to below `md`, press ⌘K on a non-Pulpit page → overlay opens in place.
4. On mobile Pulpit, tap the hero magnifier → overlay opens; confirm no tab-bar magnifier.
5. Request `/dashboard/search` → 404.
6. Search a token matching >8 vehicles → all listed, panel scrolls, no truncation notice.
7. At a 360px viewport, confirm the tab-bar pill does not overflow.

### Known gaps this depth leaves:

- The new cap's **upper bound (25) is unverified** — the fixture only reaches 9.
- Nothing automated proves the field is absent from the 9 pages, that ⌘K routes correctly, or
  that the route is gone. All three are manual steps above.

## Performance Considerations

Raising the cap triples the worst-case row count per keystroke (24 → 75 rows). The ILIKE
branches are trigram-indexed (`pg_trgm` GIN indexes, migration §1) and the client debounces at
~200ms with abort-on-supersede (`useSearch.ts`), so the added cost is payload, not scan time.

Keeping the island mounted on all 10 pages means every staff page ships cmdk plus the row
components even where no field renders. Accepted: it is what keeps ⌘K instant below `md` and
is a smaller cost than a navigation on every shortcut press.

## Migration Notes

One forward migration, no data change, no type regeneration (the `returns table` shape is
unchanged). Reversible by a `create or replace` back to `limit 8`. Nothing is deployed, so
`/dashboard/search` has no live traffic and needs no redirect.

## References

- Change identity and decisions: `context/changes/staff-search-dashboard-only/change.md`
- **Exact values for every surface this plan touches**: `context/changes/staff-search-dashboard-only/design-contract.md`
- Screenshot export request (yours to run): `context/changes/staff-search-dashboard-only/design-export-request.md`
- Applied design change: `context/changes/staff-search-dashboard-only/design-request.md`
- Design contract being amended: `context/changes/staff-global-search/design-contract.md`
- Design source (pull via DesignSync, project `352d78a6-84fd-49a2-8b38-2fe289691fc3`):
  `search-flow.jsx`, `staff-desktop.jsx` (`StaffTopbar`), `staff-screens.jsx` (`ScreenWorkerDash`)

## Progress

> Convention: `- [ ]` pending, `- [x]` done, `- [~]` **closed without being run** (an owner
> decision recorded inline; it does NOT count toward the done total). Append ` — <commit sha>`
> when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Widen the per-group result cap

#### Automated

- [x] 1.1 Migration applies cleanly against local Supabase — 56eb8ac
- [x] 1.2 Type checking passes: `npx astro check` — 56eb8ac
- [x] 1.3 Linting passes: `npm run lint` — 56eb8ac
- [x] 1.4 Integration suite passes: `npm run test:integration` — 56eb8ac

#### Manual

- [x] 1.5 A query matching more than 8 vehicles returns them all from `GET /api/search` — 56eb8ac

### Phase 2: Delete the full results page

#### Automated

- [x] 2.1 Type checking passes: `npx astro check` — f3e7860
- [x] 2.2 Linting passes: `npm run lint` — f3e7860
- [x] 2.3 Production build succeeds: `npm run build` — f3e7860
- [x] 2.4 Unit tests pass: `npm test` — f3e7860

#### Manual

- [x] 2.5 `/dashboard/search` returns 404 — f3e7860
- [x] 2.6 The dropdown footer shows the keyboard hints in all three phases — f3e7860
- [x] 2.7 The mobile results list ends with the last Pojazdy row — no button below it — f3e7860

### Phase 3: Pulpit-only entry points + ⌘K routing

#### Automated

- [x] 3.1 Type checking passes: `npx astro check` — 2b74c2c
- [x] 3.2 Linting passes: `npm run lint` — 2b74c2c
- [x] 3.3 Production build succeeds: `npm run build` — 2b74c2c

#### Manual

- [x] 3.4 The 520px field appears on `/dashboard` only; the other 9 staff pages show no field — 2b74c2c
- [x] 3.5 On `/dashboard` the field sits to the LEFT of the calendar button — 2b74c2c
- [x] 3.6 ⌘K from `/dashboard/returns` at desktop width lands on Pulpit with the dropdown open and a clean URL — 2b74c2c
- [x] 3.7 ⌘K below `md` opens the full-screen overlay in place on a non-Pulpit page — 2b74c2c
- [x] 3.8 The mobile hero shows the magnifier left of the avatar and it opens the overlay — 2b74c2c
- [x] 3.9 The mobile tab bar has no magnifier, and the pill does not overflow at a 360px viewport — 2b74c2c

### Phase 4: Vehicle row fidelity + design contract

#### Automated

- [x] 4.1 Type checking passes: `npx astro check` — 885a187
- [x] 4.2 Linting passes: `npm run lint` — 885a187
- [x] 4.3 Unit tests pass: `npm test` — 885a187

#### Manual

- [x] 4.4 The Pojazdy row reads `Mercedes-Benz ● WX 5519M` under the vehicle name — 885a187
- [x] 4.5 Every deviation in `design-contract.md` describes something still true of the app — 885a187
- [~] 4.6 ~~Canonical PNGs landed in `design-review/`; rendered vision-diff empty apart from recorded deviations~~ — **NOT RUN, closed by owner decision 2026-08-17.** The decision stands on two legs: the gate would have missed this change's only real defect (D19, which no mobile mock screen exposes), and nearly all of the change is removal. A third leg — "the values came from the code-backed JSX, so a diff would re-verify the transcription rather than the design" — was **withdrawn on 2026-08-17**: `reviews/impl-review.md` F2/F4 found two `exact` contract lines the app did not meet, so the app did not match the transcription and a diff would have had something to say. Fixed in Phase 10; the gate is still not run. Rationale in `change.md`; the 8 superseded S-13 PNGs were pruned instead.

### Phase 5: Mobile active-row contrast

#### Automated

- [x] 5.1 Type checking passes: `npx astro check` — 89f8350
- [x] 5.2 Linting passes: `npm run lint` — 89f8350
- [x] 5.3 Production build succeeds: `npm run build` — 89f8350

#### Manual

- [x] 5.4 At 390×844 the highlighted row is clearly distinct from its neighbours, resting and results alike — 89f8350
- [x] 5.5 The desktop dropdown's active row is unchanged — 89f8350

### Phase 6: Don't draw an empty top bar

#### Automated

- [x] 6.1 Type checking passes: `npx astro check` — 1f6cd9b
- [x] 6.2 Linting passes: `npm run lint` — 1f6cd9b
- [x] 6.3 Production build succeeds: `npm run build` — 1f6cd9b

#### Manual

- [x] 6.4 `/dashboard/protocols/{id}` at `md+` has no empty band above the protocol card — 1f6cd9b
- [x] 6.5 The other 9 staff pages' bars are unchanged — 1f6cd9b
- [x] 6.6 ⌘K and the mobile overlay still work on `/dashboard/protocols/{id}` — 1f6cd9b

### Phase 7: Don't let ⌘K discard a part-filled form

#### Automated

- [x] 7.1 Type checking passes: `npx astro check` — f0fd51a
- [x] 7.2 Linting passes: `npm run lint` — f0fd51a
- [x] 7.3 Production build succeeds: `npm run build` — f0fd51a
- [x] 7.4 Unit tests pass: `npm test` — f0fd51a

#### Manual

- [x] 7.5 Half-fill `/dashboard/vehicles/new`, then reload → the browser asks before leaving. (Restated: Phase 8 removed ⌘K from this page, so the original ⌘K trigger no longer exists. Reload is the same code path — a full-document navigation.) — f0fd51a
- [x] 7.6 A successful save still redirects to `/dashboard/vehicles` with no prompt — f0fd51a
- [x] 7.7 Opening `/dashboard/vehicles/{id}/edit` and changing nothing, then reloading → no prompt — f0fd51a

### Phase 8: No ⌘K on the two form sub-screens

#### Automated

- [x] 8.1 Type checking passes: `npx astro check` — 29d9fbf
- [x] 8.2 Linting passes: `npm run lint` — 29d9fbf
- [x] 8.3 Production build succeeds: `npm run build` — 29d9fbf
- [x] 8.4 Unit tests pass: `npm test` — 29d9fbf

#### Manual

- [x] 8.5 ⌘K on `/dashboard/vehicles/new` and `/dashboard/vehicles/{id}/edit` does nothing in the app — 29d9fbf
- [x] 8.6 ⌘K still works on the seven nav pages and on `/dashboard/protocols/{id}` — 29d9fbf
- [x] 8.7 ⌘K still works after navigating _away_ from a form page to a nav page (the singleton re-arms) — 29d9fbf

### Phase 9: Don't re-arm the unload guard on a successful save

> Queued from `reviews/impl-review.md` F1 (2026-08-17).

#### Automated

- [x] 9.1 Type checking passes: `npx astro check` — 1559bef
- [x] 9.2 Linting passes: `npm run lint` — 1559bef
- [x] 9.3 Production build succeeds: `npm run build` — 1559bef
- [x] 9.4 Unit tests pass: `npm test` — 1559bef

#### Manual

- [x] 9.5 Half-fill `/dashboard/vehicles/new`, then reload → the browser still asks before leaving — 1559bef
- [x] 9.6 A successful save redirects with no prompt, and the button stays in `Zapisywanie…` for the whole redirect — 1559bef
- [x] 9.7 A save that fails validation (400) re-enables the button and leaves the guard armed — 1559bef
- [x] 9.8 Save successfully, then press Back before the new page paints → no prompt — 1559bef

### Phase 10: Close the design contract's `exact` lines

> Queued from `reviews/impl-review.md` F2, F3, F4 (2026-08-17).

#### Automated

- [x] 10.1 Type checking passes: `npx astro check` — da3779b
- [x] 10.2 Linting passes: `npm run lint` — da3779b
- [x] 10.3 Production build succeeds: `npm run build` — da3779b
- [x] 10.4 Unit tests pass: `npm test` — da3779b

#### Manual

- [x] 10.5 At 390×844 the last Pojazdy row clears the viewport edge by 24px; the resting quick-jump list is unchanged — da3779b
- [x] 10.6 The field, footer and active-row chips are visually identical and each carries the 1px bottom shadow — da3779b
- [x] 10.7 The dropdown footer hints read at 11.5px in the resting and results phases alike — da3779b
- [x] 10.8 `plan.md`'s Progress count and `change.md`'s summary agree, and neither claims 4.6 was run — da3779b

### Phase 11: Clean up what the deletion left behind

> Queued from `reviews/impl-review.md` F5–F9 (2026-08-17).

#### Automated

- [x] 11.1 Type checking passes: `npx astro check`
- [x] 11.2 Linting passes: `npm run lint`
- [x] 11.3 Production build succeeds: `npm run build`
- [x] 11.4 Unit tests pass: `npm test`
- [x] 11.5 Integration suite passes: `npm run test:integration`
- [x] 11.6 The new cap assertion fails if the expected value is changed (proves it reads the shipped cap)

#### Manual

- [x] 11.7 ⌘K works on the seven nav pages and `/dashboard/protocols/{id}`, and does nothing on the two form sub-screens — after a full load and after a view transition
- [x] 11.8 `GET /api/search?q=<101 chars>` returns 400; a 100-char query still searches
- [x] 11.9 No comment in `src/` describes the results page or a search field on `protocols/[id]`
