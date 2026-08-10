# Staff global search (header ⌘K omnisearch) Implementation Plan

## Overview

Give staff a **⌘K global search** in the console header: type a query, get grouped live results
(**Rezerwacje / Zwroty / Pojazdy**) in a dropdown, jump straight to a result, or press Enter for a full
results page with filter chips. Desktop = a persistent inline header field + dropdown; mobile = a
full-screen search reached from the tab bar. This is roadmap slice **S-13** (`staff-global-search`), the
invasive member of the staff-console cohort (`context/changes/staff-ops-features/frame.md`) — sequenced
**last** so S-11 (owns the "Profil" nav entry) and S-12 (stays off the nav) land rebase-free.

Net-new plumbing: one role-gated `search_staff` SECURITY DEFINER RPC (reservations table SELECT is
revoked), a `StaffShell` header restructure touching all 10 staff pages, a global ⌘K listener, and a
`/dashboard/search` results page. Everything else reuses shipped primitives (row parts, `format.ts`, the
GET-endpoint gate, radix, cmdk).

## Current State Analysis

- **Reservations SELECT is revoked** (`supabase/migrations/20260630120000_reservations_revoke_select_grant.sql:32`; the old `using(true)` select policy dropped) → search over reservations **must** go through a new definer RPC. Existing reservation RPCs are pending-only / calendar-window / single-token — none does arbitrary text search.
- **Vehicles are directly queryable** by staff (`vehicles_select_authenticated using(true)`, S-04) — `listFleet` matches on `name, make, model, plate, category`; no new DB work for vehicles.
- **Returns (Zwroty) are RPC-only** (`protocols` + kin carry `revoke all` + RLS-on + zero policies). No all-returns search RPC exists (`list_returns_today` is a today/overdue worklist). A return match **mirrors that worklist's join**: a `confirmed` reservation that has a **`type='issue'` protocol** (the rental actually started), with its returned/due state derived from whether a **`type='return'` protocol exists** (present → returned; absent → still due). Gating on a `type='return'` context _alone_ would surface only _completed_ returns and miss the actionable due ones the design's "Na dziś" pill expects.
- **No customer entity** — "Klienci" would be a derived aggregate. **Owner decision: omit the Klienci group** (search is 3 groups); a name/email still matches within Rezerwacje.
- **No FTS/trigram infra** — `ilike '%q%'` over the text columns is the only option; fine for the small single-tenant dataset. Optional `pg_trgm` GIN indexes make the leading-wildcard ILIKE indexable.
- **The shell has no header action slot.** `StaffShell.astro:161-170` desktop header renders `showHeader && <header … md:flex>` with only a left title block (no right-side area, no named slot). **10 pages render `StaffShell`; 5 pass `showHeader={false}` and hand-roll their own desktop headers** (`dashboard`, `staff`, `vehicles/new`, `vehicles/[id]/edit`, `protocols/[id]`). Mobile has **no** shell header — only the icon-only floating tab bar (`:177-208`).
- **No cmdk / command / dialog primitive** in `src/components/ui/`, but radix-ui's umbrella exports `Dialog` + `Popover`. **Owner decision: add the `cmdk` package** for the command list + keyboard nav.
- **No global-hotkey precedent** — the ⌘K listener is net-new. `<ClientRouter>` (view-transitions) is app-wide (`Layout.astro:28`), so the listener + focus must bind on `astro:page-load` with an idempotency guard. Note the `StaffShell.astro:211-229` signout binder guards **per DOM element** (`dataset.bound`); a document-level listener instead needs a **module-scoped singleton** guard (see Critical Implementation Details).
- **No per-reservation staff detail route.** Deep-links are surface-specific — a reservation result → the calendar-focus link (`/dashboard/calendar?view=week&date=&vehicle=`, built at `PendingQueue.tsx:271-273`); a return → `/dashboard/returns/<reservationId>`; a vehicle → `/dashboard/vehicles/<id>/edit`.
- **React rows can't use `VehicleSilhouette`** (it's Astro) — the app's React lists use a lucide `<Truck>` in a tinted box; result rows follow suit. Reuse `Badge` tint tokens, `formatPln`/`estimatedTotal`/`rentalDays`, and the `ReservationStatusCard` status→PL map.

## Desired End State

A staffer presses **⌘K** (or clicks the header field / mobile search icon), types, and sees grouped live
results — **Rezerwacje**, **Zwroty**, **Pojazdy** — each row jumping to its surface (reservation →
calendar focus; return → return flow; vehicle → edit). Enter (or "Zobacz wszystkie wyniki") opens
`/dashboard/search?q=` with filter chips. Before typing, the dropdown shows **quick-jumps** (Oczekujące /
Przeterminowane / Dzisiejsze zwroty with live counts). No-results shows the guided empty state. Desktop is
an inline header field + dropdown on **every** staff page; mobile is a full-screen search from the tab bar.

**Verification:** `search_staff` returns role-gated grouped matches (integration-tested); the header field
appears on all 10 desktop pages and the ⌘K shortcut works across view-transition navigations; the dropdown,
results page, and mobile full-screen match the design contract on a vision-diff.

### Key Discoveries:

- Reservations SELECT revoked → new definer RPC required — `20260630120000_reservations_revoke_select_grant.sql:32`.
- Definer-RPC house style + role gate + revoke/grant — `list_pending_reservations` / `count_overdue_returns`; `current_app_role()` at `20260604153139_employee_admin_roles.sql:47-55`.
- 10 pages render StaffShell; 5 are `showHeader={false}` with custom headers (blast radius) — Agent A table.
- No cmdk; radix Dialog/Popover available; ⌘K net-new; bind on `astro:page-load` (`Layout.astro:28`, `StaffShell.astro:211-229`).
- Deep-link targets — calendar focus `PendingQueue.tsx:271-273`; return `/dashboard/returns/<reservationId>`; vehicle `/dashboard/vehicles/<id>/edit`. No per-reservation detail route; no customer page.
- Reuse: `Badge` tint idiom, `formatPln`/`estimatedTotal`, `<Truck>` thumbnail, GET-gate `reservations/calendar.ts`, page shape `reservations.astro`/`returns.astro` (`?q=` read).

## What We're NOT Doing

- **No Klienci (customers) group** — omitted (owner decision); a name/email match still surfaces in Rezerwacje. No customer aggregate, no customer deep-link.
- **No recent-searches** ("Ostatnie wyszukiwania") — the resting state shows quick-jumps only (no localStorage caching of searched customer names on shared terminals).
- **No FTS/tsvector** — plain `ilike` (+ optional `pg_trgm` GIN indexes). No search index subsystem.
- **No per-type vehicle silhouette in rows** — React rows use the `<Truck>` stand-in (consistent with every other React list).
- **No derived "Zakończona/Zwrócony" status on reservation rows** — reservation pills show the base status (Oczekuje/Potwierdzone/…); the Zwroty group carries the return state.
- **No calendar shortcut button** next to the field (the mockup's topbar has one — out of scope; that's not search).
- **Not touching S-12's `source` column** — S-12 is a sibling branch not yet merged; the search RPC must not reference `source`.
- **No nav tab for search** — search is reached from the box/⌘K, not a nav item (an `active="search"` state highlights nothing in the nav).
- **No search on the 2 full-screen protocol flows** — `pickups/[reservationId].astro` and `returns/[reservationId].astro` deliberately don't render `StaffShell` (focused task screens), so the header field + ⌘K are absent there. Accepted — "all staff pages" means the **10 `StaffShell` pages**. (If truly-global search is later wanted, hoist the ⌘K listener to `Layout.astro`.)

## Implementation Approach

Backend first (the RPC + endpoint), then the invasive shell restructure isolated in its own phase (so the
shared-surface diff is reviewable and S-11's `active`-union edit rebases cleanly under it), then the live
dropdown behavior, then the full results page. cmdk powers the command list + keyboard nav; the persistent
header field is a React island mounted in the (Astro) shell.

## Critical Implementation Details

- **Shell restructure reconciliation (migrate, don't stack).** Make `StaffShell`'s desktop top bar **always
  render** with two slots: a left **title/subtitle** block (rendered only when `showHeader`) and a right
  **action slot** holding the search island (plus an optional page action). The 5 `showHeader={false}` pages
  (dashboard, staff, vehicles/new, vehicles/[id]/edit, protocols/[id]) must **migrate their hand-rolled headers
  onto these slots and drop their own `border-b` bands** — do NOT stack the search bar above a second full-bleed
  band. Concretely: `dashboard.astro:70-84` hand-rolls the _identical_ `border-b px-8 py-[22px] md:flex` band
  and already owns the right slot with a calendar action button (`:77-83`) — move its title into the shell's
  left slot and its calendar button into the shell's action slot. `staff.astro:37` delegates its header into
  the `StaffList` **island**, so hoist that header (or pass title/action through the shell) rather than leaving
  it island-owned. Verify each of the 5 renders **one** header band, not two.
- **⌘K + view-transitions.** The global `keydown` listener (⌘K / Ctrl+K to open+focus, `/` optional, Esc to
  close) and focus management must bind via `document.addEventListener("astro:page-load", …)` with an
  idempotency guard — a top-level/`DOMContentLoaded` binding runs once and dies after the first SPA swap. The
  guard must be a **module-scoped singleton flag** (or `removeEventListener` before re-adding), **not** the
  per-DOM-element `dataset.bound` pattern the signout binder (`StaffShell.astro:211-229`) uses — a
  `document`-level listener has no element to tag, so a dataset guard would stack a **duplicate** handler on
  every `astro:page-load`.
- **`active` union coordination.** Add `"search"` to `StaffShell`'s `active` union for the results page.
  S-11 also appends `"me"`; both are append-only edits — since S-13 merges last, it rebases over S-11's `"me"`.
- **Mobile tab-bar density (cross-slice — MUST handle here).** After S-11 (adds a Profil tab) and S-13 (adds
  this search icon) have both merged, the icon-only floating tab bar (`StaffShell.astro:177-208`) carries up
  to **9** entries for an admin: dash, requests, pickups, returns, cal, fleet, Zespół (admin), Profil, search.
  Before wiring the search icon, **measure the pill at the smallest supported width (360px)** — it must not
  overflow the viewport or clip. If it does, apply the first workable fallback in this order and record it as a
  `deviation(reason)`: (a) tighten the pill's per-icon size/gap; (b) drop the desktop-centric **Kalendarz**
  icon from the _mobile_ bar (still reachable from the dashboard); (c) move the search entry to a mobile top
  affordance instead of a tab. Do **not** ship an overflowing pill. S-11 alone (one added tab) is fine — this
  only manifests once both slices are merged, i.e. here.
- **cmdk inline, not modal.** Use cmdk's inline `<Command>` (input + grouped list) inside the header
  Popover (desktop) and the mobile full-screen view — not `Command.Dialog` (we chose an inline field, not a
  centered palette). cmdk owns the roving `↑↓` focus + Enter selection; we wire ⌘K-open and Enter→results-page.
- **Search endpoint gate.** `GET /api/search?q=` gates auth + `isRoleSufficient(locals.role,"employee")` (no
  Origin check — read), zod-validates `q` (trim, min length ~2), calls `search_staff` via `locals.supabase`.
  Debounce (~200ms) + request cancellation in the client hook (no debounce util exists — hand-roll).

## Phase 1: Search backend — `search_staff` RPC + endpoint

### Overview

The role-gated cross-entity search: one definer RPC returning tagged rows for reservations / returns /
vehicles, a service wrapper, and a GET endpoint.

### Changes Required:

#### 1. Migration — `search_staff` RPC (+ optional trigram indexes)

**File**: `supabase/migrations/20260810130000_staff_search.sql` (new)

**Intent**: A `security definer` RPC that role-gates and `ilike`-searches across the three entities,
returning a tagged, ranked, capped result set. Optionally add `pg_trgm` GIN indexes so the leading-wildcard
ILIKE is indexable.

**Contract**: `public.search_staff(p_query text)` → `returns table (kind text, id uuid, reference text,
customer_name text, vehicle_id uuid, vehicle_make text, vehicle_model text, vehicle_plate text,
pickup_date date, return_date date, status text, daily_rate numeric)` (a union-shaped row; `kind ∈
'reservation'|'return'|'vehicle'`, with vehicle rows leaving reservation fields null and vice-versa).
`language sql stable security definer set search_path = ''`; inline gate `… where public.current_app_role()
in ('employee','admin')`; each branch `ilike '%'||p_query||'%'` over: reservations
(`customer_name/email/phone, reference`, + joined `vehicles.plate`), returns (same ILIKE fields, over
`status='confirmed'` rows that **have a `type='issue'` protocol** — mirroring `list_returns_today`'s
INNER-issue / LEFT-return join — with returned/due derived from whether a `type='return'` protocol exists;
do **not** restrict to rows that already have a return protocol, which would drop the due ones), vehicles
(`name/make/model/plate`).
Cap each group (e.g. LIMIT 8 in the RPC; the results page can widen later). `revoke execute … from public,
anon;` then `grant execute … to authenticated;`. Optional: `create extension if not exists pg_trgm;` + GIN
`gin_trgm_ops` indexes on the searched text columns.

#### 2. Regenerated types + service wrapper

**File**: `src/db/database.types.ts` (regen) + `src/lib/services/search.ts` (new) + `src/types.ts`

**Intent**: Type the RPC and wrap it in a `searchStaff(client, query)` service returning a typed grouped
result; add the `SearchResult` DTO shapes.

**Contract**: `npx supabase gen types …`. `searchStaff(client: SearchClient | null, query: string):
Promise<SearchResults>` where `SearchResults = { reservations: […], returns: […], vehicles: […] }` (grouped
from the tagged rows; `[]`/empty for a null client or blank query). New types in `src/types.ts`:
`SearchResultReservation`, `SearchResultReturn`, `SearchResultVehicle`, `SearchResults`.

#### 3. Search GET endpoint

**File**: `src/pages/api/search.ts` (new)

**Intent**: The client-reachable live-search endpoint.

**Contract**: `GET APIRoute`. Gate: auth (`!locals.user` → 401), role (`!isRoleSufficient(locals.role,
"employee")` → 403); **no Origin check** (read). Zod-validate `q` (trimmed, min ~2 chars) → `200 {reservations:[],
returns:[], vehicles:[]}` for too-short/blank, else `searchStaff(locals.supabase, q)` → `200` grouped JSON.
Reuse the local `json()` helper.

### Success Criteria:

#### Automated Verification:

- Migration applies cleanly against local Supabase: `npx supabase db reset`
- Type checking passes: `npx astro check`
- Linting passes: `npm run lint`
- Integration test passes (`npm run test:integration`): `search_staff` as staff returns matching reservations (by name / reference / plate), returns, and vehicles; a non-staff caller gets zero rows; `GET /api/search?q=` returns grouped JSON for staff and 403 for anon; a &lt;2-char `q` returns empty groups.

#### Manual Verification:

- Hand-running `search_staff('krzy')` returns sensible grouped rows.

**Implementation Note**: After automated verification passes, pause for manual confirmation before Phase 2.

---

## Phase 2: StaffShell restructure + search entry (shared surface)

### Overview

The invasive shell change: a persistent desktop header search field on **every** staff page, a mobile
tab-bar search icon opening a full-screen search, the `active="search"` state, the global ⌘K listener, and
the `GlobalSearch` island scaffold (field + open/close; dropdown container empty until Phase 3). Isolated so
the shared-surface diff is one reviewable change.

### Changes Required:

#### 1. Add the cmdk dependency

**File**: `package.json`

**Intent**: Add `cmdk` for the command list + keyboard nav.

**Contract**: `npm install cmdk`. No shadcn `command.tsx` wrapper exists — the island uses cmdk directly, styled to the tokens.

#### 2. StaffShell header + mobile restructure

**File**: `src/components/shell/StaffShell.astro` + `src/components/shell/NavIcon.astro`

**Intent**: Always render the desktop top bar with a left title slot (`showHeader`-gated) and a right action
slot (search island + optional page action). **Migrate the 5 `showHeader={false}` pages' custom headers onto
these slots and remove their hand-rolled `border-b` bands** (see Critical Implementation Details → "Shell
restructure reconciliation") — no doubled bands, no right-slot competition. Add a **search** icon to the mobile
floating tab bar that opens the full-screen search. Add `"search"` to the `active` union. Mount `<GlobalSearch
client:load user={…} role={…} pendingCount={…} overdueCount={…} />` in the header (and the mobile trigger).

**Contract**: `Props["active"]` gains `"search"`. Desktop `<header>` becomes always-on with a right-aligned
slot holding `<GlobalSearch>`; left title/subtitle render only when `showHeader`. Mobile tab bar (`:177-208`)
gains a magnifier entry (a new `NavIcon` `"search"` glyph) that opens the island's mobile full-screen view.
The GlobalSearch island receives the nav counts already threaded to the shell (for quick-jumps).

#### 3. GlobalSearch island scaffold + ⌘K

**File**: `src/components/search/GlobalSearch.tsx` (new) + `src/components/hooks/useGlobalSearchHotkey.ts` (new)

**Intent**: The React island: the desktop inline field (cmdk `Command` + input) inside a radix `Popover`, the
mobile full-screen view, open/close/focus state, and the global ⌘K/Ctrl+K + Esc handling bound on
`astro:page-load`. Dropdown body is a placeholder in this phase.

**Contract**: `GlobalSearch({ user, role, pendingCount, overdueCount })`. Desktop: a 520px field
(placeholder **Szukaj rezerwacji, pojazdu, rejestracji…**, ⌘K kbd hint / clear-X) opening a Popover
dropdown. Mobile: a full-screen overlay (search field + **Anuluj**). `useGlobalSearchHotkey` registers a
document `keydown` (⌘/Ctrl+K → open+focus; Esc → close) via `astro:page-load` + an idempotency guard. cmdk
`Command` provides the list/keyboard scaffold.

### Success Criteria:

#### Automated Verification:

- Type checking passes: `npx astro check`
- Linting passes: `npm run lint`
- Build passes: `npm run build`
- `cmdk` resolves and the island bundles (build green).

#### Manual Verification:

- The desktop header search field appears on **all 10** staff pages; the 5 former `showHeader={false}` pages render their title/action via the shell's slots with **one** header band (no doubled `border-b`, no right-slot competition).
- ⌘K (and Ctrl+K) opens/focuses the field from any staff page, including after a view-transition navigation; Esc closes; the mobile tab-bar search icon opens the full-screen view.
- No regression to existing nav items/badges, the desktop sign-out, or S-11's Profil chip (if merged).
- The mobile floating tab bar does **not** overflow or clip at **360px** with the search icon added alongside S-11's Profil tab (and, for an admin, the Zespół tab) — apply the density fallback if needed (see Critical Implementation Details → "Mobile tab-bar density").

**Implementation Note**: This is the coordination-critical phase (the shared StaffShell restructure). After automated verification passes, pause for manual confirmation before Phase 3.

---

## Phase 3: Live dropdown results + keyboard nav + deep-links

### Overview

Fill the dropdown: debounced live fetch, grouped results, the resting quick-jumps state, the no-results
state, cmdk keyboard selection, and deep-link navigation. Serves the desktop dropdown and the mobile
full-screen results.

### Changes Required:

#### 1. Search hook + result rendering

**File**: `src/components/search/GlobalSearch.tsx` (extend) + `src/components/hooks/useSearch.ts` (new) + result-row subcomponents

**Intent**: `useSearch` debounces (~200ms, with cancellation) a `GET /api/search?q=` and returns
`{ results, loading }`. Render three phases: **resting** (quick-jumps: Oczekujące rezerwacje / Przeterminowane /
Dzisiejsze zwroty with live counts → their filtered views), **results** (cmdk groups **Rezerwacje** /
**Zwroty** / **Pojazdy** with reused rows + a "Zobacz wszystkie wyniki … · {n}" footer → the results page),
**no-results** (guided empty state). Rows reuse `Badge` tint tokens, `formatPln(estimatedTotal(...))`, the
`<Truck>` thumbnail, mono reference, and the status→PL label map, with query highlighting.

**Contract**: Deep-links on select: reservation → `/dashboard/calendar?view=week&date=<pickup_date>&vehicle=<vehicle_id>`;
return → `/dashboard/returns/<reservationId>`; vehicle → `/dashboard/vehicles/<id>/edit`; Enter / footer →
`/dashboard/search?q=<query>`. Quick-jump targets: `/dashboard/reservations`, `/dashboard/returns?filter=overdue`,
`/dashboard/returns?filter=due`. cmdk owns `↑↓`/Enter; row `onSelect` navigates. Verbatim Polish per the contract.

### Success Criteria:

#### Automated Verification:

- Type checking passes: `npx astro check`
- Linting passes: `npm run lint`
- Build passes: `npm run build`
- Unit test passes (`npm test`): the debounce/cancellation logic (or the results-grouping mapper) as a pure/unit-testable unit.

#### Manual Verification:

- Typing shows grouped live results (Rezerwacje / Zwroty / Pojazdy) with highlighted matches; `↑↓` moves the active row, Enter opens it, the footer/Enter opens the results page.
- Selecting a result deep-links correctly (reservation → calendar focus; return → return flow; vehicle → edit).
- The resting state shows the three quick-jumps with correct live counts → their filtered views.
- The no-results state renders the guided message; behavior matches on the mobile full-screen view.
- Vision-diff of the dropdown (resting / results / no-results, desktop + mobile) against the contract is clean apart from recorded deviations.

**Implementation Note**: After automated verification passes, pause for manual confirmation before Phase 4.

---

## Phase 4: Full results page (`/dashboard/search`)

### Overview

The Enter-target: a full results page with filter chips and sectioned lists (desktop + mobile).

### Changes Required:

#### 1. Results page + island

**File**: `src/pages/dashboard/search.astro` (new) + `src/components/search/SearchResults.tsx` (new)

**Intent**: A `StaffShell active="search"` page that SSRs the `?q=` query (validated) and the initial
grouped results, then hydrates an island rendering the header ("Wyniki dla '{q}' · {n} wyników"), filter
chips (**Wszystko / Rezerwacje / Zwroty / Pojazdy** with counts), and sectioned card lists. Mobile: back
button + horizontal chips + sectioned cards.

**Contract**: Route `/dashboard/search` (gated by `/dashboard` in `ROUTE_ROLES`; add an explicit
documentation entry). Frontmatter: `const { user, role, supabase } = Astro.locals;` + `const q =
Astro.url.searchParams.get("q")`; load `searchStaff(supabase, q)` + `listPendingReservations` +
`countOverdueReturns` (nav badges) via `Promise.all`; guard with `Astro.response.status` (no top-level
`return`). `<StaffShell active="search" title=… user role pendingCount overdueCount>` + `<SearchResults
client:load q={q} initial={results} />`. Chips filter client-side over the initial groups. Rows reuse the
Phase-3 row parts. Verbatim Polish per the contract.

### Success Criteria:

#### Automated Verification:

- Type checking passes: `npx astro check`
- Linting passes: `npm run lint`
- Build passes: `npm run build`

#### Manual Verification:

- `/dashboard/search?q=krzy` renders the header count, filter chips (with per-group counts), and sectioned results; a deep-link (paste URL) renders without a hydration flash.
- Chips filter the visible groups; rows deep-link like the dropdown; Enter from the dropdown lands here.
- Mobile results page (back button + scrollable chips + card sections) matches the contract.
- Vision-diff of the results page (desktop + mobile) against the contract is clean apart from recorded deviations.

**Implementation Note**: Final build phase before the Design Alignment Audit closes planning-fidelity.

---

## Testing Strategy

### Unit Tests:

- The `useSearch` debounce/cancellation (or the tagged-rows → grouped-results mapper) as a pure unit.
- The status→PL label mapping for result rows (reuse existing).

### Integration Tests:

- `search_staff`: matches reservations (name/reference/plate), returns (issued reservations — `type='issue'` protocol present — surfaced in both due and returned states), vehicles (name/make/model/plate); role-gated (non-staff → empty); cap respected.
- `GET /api/search`: grouped JSON for staff; 403 anon; empty for &lt;2-char q.

### Manual Testing Steps:

1. ⌘K from several pages (incl. after a view-transition nav) → field focuses; type → grouped results.
2. Select each result type → correct deep-link.
3. Resting quick-jumps counts + targets; no-results state.
4. Enter → `/dashboard/search?q=`; chips filter; mobile full-screen + results page.
5. Vision-diff dropdown/results/mobile against the contract.

## Performance Considerations

`ilike '%q%'` over small single-tenant tables is fine; optional `pg_trgm` GIN indexes make it indexable if
the dataset grows. Client debounce (~200ms) + request cancellation avoids a fetch per keystroke. The
GlobalSearch island loads on every staff page (small bundle; cmdk is tiny).

## Migration Notes

Additive — a new RPC + optional indexes; no schema change to existing tables, no data migration. Independent
of S-12 (must not reference its unmerged `source` column).

**Cohort coordination (types regen).** S-12 and S-13 both regenerate `src/db/database.types.ts` on sibling
branches that merge separately. The **second slice to merge** must reset the local DB with **both** migrations
applied and re-run `supabase gen types` — regenerate against the **combined** schema; **never text-merge the
generated file** (a stale regen would drop the other slice's RPC / `source` additions).

## References

- Frame brief: `context/changes/staff-ops-features/frame.md`
- Roadmap slice: `context/foundation/roadmap.md` → S-13
- Design source: `search-flow.jsx` (live in Claude Design `352d78a6-…`); contract at `context/changes/staff-global-search/design-contract.md`
- Backend: reservations SELECT revoke `20260630120000_reservations_revoke_select_grant.sql:32`; RPC style `list_pending_reservations` / `count_overdue_returns`; `current_app_role()` `20260604153139_employee_admin_roles.sql:47-55`
- Shell: `src/components/shell/StaffShell.astro:18` (active union), `:161-170` (desktop header), `:177-208` (mobile tab bar), `:211-229` (astro:page-load bind); `Layout.astro:28` (ClientRouter)
- Deep-links: `src/components/dashboard/PendingQueue.tsx:271-273` (calendar focus); `/dashboard/returns/[reservationId]`; `/dashboard/vehicles/[id]/edit`
- Reuse: GET-gate `src/pages/api/reservations/calendar.ts`; rows `PendingQueue.tsx` / `src/components/fleet/FleetList.tsx` (its `Thumbnail`/`StatusBadge`/`Rate`/`specLine`/`editHref` parts) / `ReturnQueue.tsx`; `src/lib/format.ts`; status map `src/components/reservation/ReservationStatusCard.astro:32-37`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Search backend — search_staff RPC + endpoint

#### Automated

- [x] 1.1 Migration applies cleanly against local Supabase — 7ecbc37
- [x] 1.2 Type checking passes: `npx astro check` — 7ecbc37
- [x] 1.3 Linting passes: `npm run lint` — 7ecbc37
- [x] 1.4 Integration: search_staff matches reservations/returns/vehicles; role-gated; GET /api/search grouped JSON + 403 anon + empty for short q — 7ecbc37

#### Manual

- [ ] 1.5 Hand-run `search_staff('krzy')` returns sensible grouped rows

### Phase 2: StaffShell restructure + search entry (shared surface)

#### Automated

- [x] 2.1 Type checking passes: `npx astro check` — 7e3b1df
- [x] 2.2 Linting passes: `npm run lint` — 7e3b1df
- [x] 2.3 Build passes: `npm run build` — 7e3b1df
- [x] 2.4 cmdk resolves and the island bundles (build green) — 7e3b1df

#### Manual

- [ ] 2.5 Desktop search field on all 10 staff pages; the 5 custom-header pages migrated onto the shell slots (single header band, no right-slot clash)
- [ ] 2.6 ⌘K/Ctrl+K opens/focuses from any page incl. post-view-transition; Esc closes; mobile tab-bar icon opens full-screen
- [ ] 2.7 No regression to nav items/badges, sign-out, or S-11's Profil chip
- [ ] 2.8 Mobile tab bar does not overflow/clip at 360px with Profil + search (+ admin Zespół); density fallback applied if needed

### Phase 3: Live dropdown results + keyboard nav + deep-links

#### Automated

- [x] 3.1 Type checking passes: `npx astro check`
- [x] 3.2 Linting passes: `npm run lint`
- [x] 3.3 Build passes: `npm run build`
- [x] 3.4 Unit: debounce/cancellation (or results-grouping mapper)

#### Manual

- [ ] 3.5 Grouped live results with highlighting; ↑↓ + Enter select
- [ ] 3.6 Each result type deep-links correctly (reservation→calendar focus; return→return flow; vehicle→edit)
- [ ] 3.7 Resting quick-jumps counts + targets; no-results state; mobile full-screen parity
- [ ] 3.8 Vision-diff dropdown (resting/results/no-results, desktop+mobile) clean apart from deviations

### Phase 4: Full results page (/dashboard/search)

#### Automated

- [ ] 4.1 Type checking passes: `npx astro check`
- [ ] 4.2 Linting passes: `npm run lint`
- [ ] 4.3 Build passes: `npm run build`

#### Manual

- [ ] 4.4 /dashboard/search?q= renders count + chips + sectioned results; deep-linked URL renders without hydration flash
- [ ] 4.5 Chips filter groups; rows deep-link; Enter from the dropdown lands here
- [ ] 4.6 Mobile results page (back + scrollable chips + card sections) matches the contract
- [ ] 4.7 Vision-diff results page (desktop + mobile) clean apart from deviations
