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

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Widen the per-group result cap

#### Automated

- [x] 1.1 Migration applies cleanly against local Supabase — 56eb8ac
- [x] 1.2 Type checking passes: `npx astro check` — 56eb8ac
- [x] 1.3 Linting passes: `npm run lint` — 56eb8ac
- [x] 1.4 Integration suite passes: `npm run test:integration` — 56eb8ac

#### Manual

- [ ] 1.5 A query matching more than 8 vehicles returns them all from `GET /api/search`

### Phase 2: Delete the full results page

#### Automated

- [x] 2.1 Type checking passes: `npx astro check` — f3e7860
- [x] 2.2 Linting passes: `npm run lint` — f3e7860
- [x] 2.3 Production build succeeds: `npm run build` — f3e7860
- [x] 2.4 Unit tests pass: `npm test` — f3e7860

#### Manual

- [ ] 2.5 `/dashboard/search` returns 404
- [ ] 2.6 The dropdown footer shows the keyboard hints in all three phases
- [ ] 2.7 The mobile results list ends with the last Pojazdy row — no button below it

### Phase 3: Pulpit-only entry points + ⌘K routing

#### Automated

- [x] 3.1 Type checking passes: `npx astro check`
- [x] 3.2 Linting passes: `npm run lint`
- [x] 3.3 Production build succeeds: `npm run build`

#### Manual

- [ ] 3.4 The 520px field appears on `/dashboard` only; the other 9 staff pages show no field
- [ ] 3.5 On `/dashboard` the field sits to the LEFT of the calendar button
- [ ] 3.6 ⌘K from `/dashboard/returns` at desktop width lands on Pulpit with the dropdown open and a clean URL
- [ ] 3.7 ⌘K below `md` opens the full-screen overlay in place on a non-Pulpit page
- [ ] 3.8 The mobile hero shows the magnifier left of the avatar and it opens the overlay
- [ ] 3.9 The mobile tab bar has no magnifier, and the pill does not overflow at a 360px viewport

### Phase 4: Vehicle row fidelity + design contract

#### Automated

- [ ] 4.1 Type checking passes: `npx astro check`
- [ ] 4.2 Linting passes: `npm run lint`
- [ ] 4.3 Unit tests pass: `npm test`

#### Manual

- [ ] 4.4 The Pojazdy row reads `Mercedes-Benz ● WX 5519M` under the vehicle name
- [ ] 4.5 Every deviation in `design-contract.md` describes something still true of the app
- [ ] 4.6 Canonical PNGs landed in `design-review/`; rendered vision-diff empty apart from recorded deviations
