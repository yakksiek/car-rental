# Overdue Returns Dashboard (S-07) Implementation Plan

## Overview

S-07 closes FR-012's **packaging** gap. The overdue _detection_ is already shipped
by S-06's Zwroty worklist: `list_returns_today` returns every open due-or-overdue
rental with no lower date bound (`return_protocol.sql:379-381`), and `ReturnQueue`
already classifies `overdue`/`due`/`returned`, paints the red `Po terminie` badge +
left accent, and computes the three counts (`ReturnQueue.tsx:44-49,331-333`). This
slice makes that existing overdue **navigable, filterable, and legible** — and
nothing else. It is **flag-only, read-only**: no new tables, no writes, no penalty
columns, no extend-rental, no contact tracking (all deferred per `frame.md`).

Three additions, each mapping 1:1 to `design-rebuild-brief.md §3`:

1. An overdue **count badge** on the "Zwroty" nav item (mirrors the `pendingCount`
   badge on "Wnioski"), sourced from a new lightweight count RPC.
2. The three top-row **stat cards become filter toggles** over the worklist.
3. A **days-overdue label** (`2 dni po terminie`) on overdue rows.

## Current State Analysis

- **Overdue is already detected and painted.** `list_returns_today`
  (`return_protocol.sql:314-387`) is role-gated (`employee`/`admin`), INNER-joins
  the issue protocol (a return requires an issue baseline), LEFT-joins the return
  protocol, and filters `status='confirmed' AND return_date <= current_date AND
(return_protocol_id IS NULL OR filed-today)`. `ReturnQueue.captionOf`
  (`ReturnQueue.tsx:44-49`) then splits each row: `returned` if
  `return_protocol_id` is set, else `overdue` if `return_date < today`, else `due`.
- **The nav badge pattern is `pendingCount`, threaded per page.** Every staff page
  that renders `StaffShell` computes `listPendingReservations(...).length` and
  passes it as `pendingCount` (`StaffShell.astro:34,76-85` sidebar count pill;
  `:148-150` mobile-tab warning **dot**, no number — hidden at 0 via
  `(n.badge ?? 0) > 0`). 8 pages pass it; `protocols/[id].astro:108` passes neither
  (badge defaults 0); the two full-page detail routes
  (`pickups/[reservationId]`, `returns/[reservationId]`) render no `StaffShell`.
- **The stat cards are static.** `StatCard`/`StatPill` (`ReturnQueue.tsx:90-166`)
  have no `onClick`, no selected state, no filter state anywhere. `ReturnQueue` is a
  `client:load` island that already holds all rows and the three live counts, so
  filtering is pure client state — no refetch.
- **Reservations/protocols are RLS-locked.** The role grants carry no table SELECT
  (`Dxtm` only); every read crosses the boundary through a `SECURITY DEFINER` RPC
  that self-gates on `current_app_role()` (`list_pending_reservations.sql:1-9`). So
  an overdue count cannot be a direct `client.from(...).select(count)` — it must be
  a definer RPC.
- **No count-only RPC precedent.** Every count in the app fetches rows and calls
  `.length` (pending, dispatch, category counts). A scalar `returns integer` RPC
  would be the codebase's first — but it is the correct shape here (one integer, no
  PII, called on ~8 pages).
- **Helpers exist.** `formatDuration(n)` is plural-aware (`1 dzień` / `N dni`,
  `format.ts:76-78`); `rentalDays(a, b)` gives the whole-day calendar span
  (`format.ts:60-62`); `today` (server UTC calendar date) is already threaded into
  `ReturnQueue`.

## Desired End State

A staff member, from **any** dashboard page, sees a danger count badge on "Zwroty"
whenever vehicles are overdue. Opening Zwroty (via that badge when overdue exists)
lands on the overdue-filtered worklist. The three stat cards toggle the list to
`Na dziś` / `Po terminie` / `Zwrócono`; the active card is visibly selected and the
list header reflects it; clicking the active card clears back to `Wszystkie`. Each
overdue row carries a `N dni po terminie` label. When nothing is overdue, the badge
is hidden and the overdue filter shows a reassuring `Wszystkie pojazdy wróciły na
czas.` state. No money columns, no extend, no writes.

**Verification:** the badge count equals `ReturnQueue`'s on-page overdue count on
every page; an integration test proves the count RPC returns only strictly-overdue,
still-open, issued, confirmed rentals and 0 for a non-staff caller; the rendered UI
matches the canonical screenshots at both breakpoints (vision-diff at implement).

### Key Discoveries:

- Detection is done — the work is packaging. `frame.md` (STRONG, file:line).
- Badge count **must equal** the page's overdue count → the count RPC must mirror
  `list_returns_today`'s joins/filters (INNER issue protocol, `status='confirmed'`),
  restricted to the strict-overdue-open subset. A looser count would make the badge
  disagree with the list.
- Overdue predicate is **strict `<`**, not `<=`: `return_protocol_id IS NULL AND
return_date < current_date` (the RPC's own `<= current_date` includes due-today,
  which is **not** overdue) — `ReturnQueue.tsx:48`.
- Newer RPCs **revoke then grant** (`return_protocol.sql:386-387`, the 2026-07-14
  hardening lesson); `list_pending_reservations` (grant-only) predates it — do not
  copy that shortcut.
- Mobile nav badge precedent is a **dot** (no number); danger tint = brand crimson
  (`bg-primary` / `--flota-danger-soft`), already used by `OverdueBadge`.

## What We're NOT Doing

- **No penalty/late-fee** (`STAWKA KARY` / `NALICZONE`) — v1 PRD Non-Goal → v2.
- **No extend-rental** — a separate future write slice (new RPC, EXCLUDE-conflict
  handling, email); explicitly out of this change.
- **No last-contact _tracking_** (`OSTATNI KONTAKT`) — no storage, no timestamp, no
  logging. The `Call` action **is** in scope but only as a plain `tel:` link
  (design-brief §4; user decision 2026-07-23) — it opens the dialer, records nothing.
- **No header search bar, no trend sparkline** — both appear in the EN artboards but
  are cut (out of FR-012; the sparkline has no data source). See `design-contract.md §3`.
- **No reservation writes, no new tables.** Two additive, read-only DB changes only:
  the new count function, and one extra column (`customer_phone`) on the existing
  `list_returns_today` RPC to feed the Call link.
- **No vehicle photos / per-type silhouettes** — the RPC returns no photo; the
  generic `VehicleIcon` stays.
- **Not touching** the two `[reservationId]` full-page routes (no `StaffShell`), and
  **not** changing the Wnioski badge or the other 5 nav items (labels stay Polish).

## Implementation Approach

Three additive phases, backend-out. Phase 1 lands the count RPC + service and the
nav badge (the only cross-cutting change — it touches every staff page). Phase 2 is
self-contained inside the `ReturnQueue` island (filters + empty states). Phase 3 is
a small per-row label. Each phase is independently shippable and testable; the badge
and the filters share no state, so they can land in either order after Phase 1's
service exists.

## Critical Implementation Details

- **Badge/list count parity.** `count_overdue_returns()` must count exactly the rows
  `ReturnQueue` classifies as `overdue` — i.e. the strict-overdue-open subset of what
  `list_returns_today` returns. Mirror that RPC's `reservations ⋈ issue-protocol`
  joins and `status='confirmed'`; add `return_protocol_id IS NULL AND return_date <
current_date`. If the two ever diverge (e.g. the count drops the issue-protocol
  join), the badge will show a different number than the page — a visible bug.
- **Filter seeding without a hydration flash.** `ReturnQueue` is `client:load`, so a
  lazy `useState` initializer that reads `window.location` would differ from the
  SSR'd HTML (no `window` on the server) → React hydration mismatch or a flash of the
  unfiltered list. Instead, parse `?filter` **server-side** in `returns.astro`
  (`Astro.url.searchParams`), validate it against the four states
  (`due`/`overdue`/`returned`/null), and pass a typed `initialFilter` prop. On client
  toggle, update state and `history.replaceState` the `?filter` param (no navigation).
- **Adding `customer_phone` changes the RPC's return type → drop + recreate.**
  Postgres refuses `CREATE OR REPLACE FUNCTION` when the `RETURNS TABLE(...)` column
  set changes ("cannot change return type of existing function"). The new migration
  must `DROP FUNCTION public.list_returns_today();` then re-`CREATE` it with the extra
  `customer_phone text` column, and **re-apply** `revoke execute … from public, anon;
grant execute … to authenticated;` (drop discards the grants). `DispatchReturnRow`
  re-derives the column automatically after type regen.
- **Copy is canonical Polish; the artboards are EN reference.** Every user-facing
  string comes from `design-contract.md` (`Zwroty`, `Na dziś`/`Po terminie`/`Zwrócono`,
  `Wszystkie zwroty · N`, `N dni po terminie`, `Zadzwoń`, `Przyjmij zwrot`,
  `Brak zwrotów po terminie` / `Wszystkie pojazdy wróciły na czas.`), never the EN
  labels in the screenshots.

## Phase 1: Backend (count RPC + phone column) + nav badge

### Overview

Add a lightweight count RPC and the `customer_phone` column the Call link needs, then
surface the count as a danger badge on the "Zwroty" nav item across every staff page —
mirroring the `pendingCount` plumbing.

### Changes Required:

#### 1. Count-only definer RPC

**File**: `supabase/migrations/20260723120000_count_overdue_returns.sql` (new)

**Intent**: Give every staff page a cheap, PII-free way to read the number of open
overdue rentals, gated to staff, agreeing exactly with the worklist's overdue count.

**Contract**: `public.count_overdue_returns() returns integer`, `language sql stable
security definer set search_path = ''`. Body counts the strict-overdue-open subset,
mirroring `list_returns_today`'s joins so the badge equals the page count; a
non-staff caller gets `0` via the inline role predicate. Follow the revoke→grant
hygiene (the 2026-07-14 lesson), not `list_pending_reservations`' grant-only form.

```sql
create function public.count_overdue_returns()
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select count(*)::int
  from public.reservations r
  join public.protocols ip
    on ip.reservation_id = r.id and ip.type = 'issue'
  left join public.protocols rp
    on rp.reservation_id = r.id and rp.type = 'return'
  where r.status = 'confirmed'
    and rp.id is null                 -- still open
    and r.return_date < current_date  -- strictly overdue (not due-today)
    and public.current_app_role() in ('employee', 'admin');
$$;

revoke execute on function public.count_overdue_returns() from public, anon;
grant execute on function public.count_overdue_returns() to authenticated;
```

#### 2. Add `customer_phone` to `list_returns_today` (for the Call link)

**File**: same migration `…_count_overdue_returns.sql` (or a sibling) (new)

**Intent**: Expose the customer's phone on returns rows so the overdue Call button can
be a `tel:` link. Read-only, additive; no logging, no new table.

**Contract**: `DROP FUNCTION public.list_returns_today();` then re-`CREATE` it
identical to `return_protocol.sql:314-384` **plus** a `customer_phone text` output
column selecting `r.customer_phone` (the `reservations` table already has it — it
feeds `list_pending_reservations`). Re-apply `revoke execute … from public, anon;
grant execute … to authenticated;` (the drop discards grants). Return-type change
forces drop+recreate — `CREATE OR REPLACE` errors. `DispatchReturnRow` re-derives the
field after regen.

#### 3. Regenerate DB types

**File**: `src/db/database.types.ts` (generated)

**Intent**: Make the new RPC + the added column visible to TypeScript.

**Contract**: Run `npx supabase gen types typescript --local >
src/db/database.types.ts` (there is no npm script; the file is hand-generated).
`Database["public"]["Functions"]["count_overdue_returns"]` must appear and
`list_returns_today`'s `Returns` must gain `customer_phone`. Then `npx astro sync` so
`astro:env` virtual types re-resolve.

#### 4. `countOverdueReturns` service

**File**: `src/lib/services/protocols.ts`

**Intent**: Wrap the RPC in the house service shape so pages call a typed helper.

**Contract**: `countOverdueReturns(client: ProtocolClient | null):
Promise<number>` — a `null` client degrades to `0` (matches `listReturnsToday`'s
null-client → `[]`), `client.rpc("count_overdue_returns")`, an unexpected DB error
rethrows. The RPC returns a bare integer, so return `data ?? 0`.

#### 5. `StaffShell` — danger badge on "Zwroty"

**File**: `src/components/shell/StaffShell.astro`

**Intent**: Render the overdue count as a danger badge on the "Zwroty" nav entry,
mirroring the `pendingCount` badge on "Wnioski"; deep-link to the overdue filter.

**Contract** (see `design-contract.md §A`): Add prop `overdueCount?: number` (default
`0`). Attach `badge: overdueCount` to the `returns` NAV entry; set its `href` to
`/dashboard/returns${overdueCount > 0 ? "?filter=overdue" : ""}`.

- **Sidebar (md+)**: count pill for `returns` when `> 0`, danger tint (`text-primary
bg-[var(--flota-danger-soft)]` inactive / `text-background bg-white/20` active) —
  same shape as the Wnioski pill.
- **Mobile tab, inactive**: danger **dot** (`bg-primary`, same geometry as the Wnioski
  `bg-warning` dot at `:148-150`) when `> 0`.
- **Mobile tab, active/expanded**: a crimson **count pill** (`bg-primary
text-primary-foreground`) after the label when `> 0` — `deviation(design)`, the
  canonical mockups show the number on the active tab. **Returns-only**; leave the
  Wnioski active-tab behavior unchanged.
- All hidden at 0. Add `returns` to the badge conditions without altering the existing
  `requests` (Wnioski) rendering.

#### 6. Thread `overdueCount` through every staff page

**Files**: `src/pages/dashboard.astro`, `src/pages/dashboard/calendar.astro`,
`src/pages/dashboard/pickups.astro`, `src/pages/dashboard/reservations.astro`,
`src/pages/dashboard/returns.astro`, `src/pages/dashboard/vehicles.astro`,
`src/pages/dashboard/vehicles/new.astro`,
`src/pages/dashboard/vehicles/[id]/edit.astro`,
`src/pages/dashboard/protocols/[id].astro`

**Intent**: Compute the overdue count on each page (parallel with the existing
pending fetch) and pass it into `StaffShell`, so the badge is consistent app-wide.

**Contract**: On each page, call `countOverdueReturns(supabase)` — fold it into the
existing `Promise.all` where one exists (`pickups`, `returns`, `vehicles`), else add
an `await` — and pass `overdueCount={...}` to `StaffShell`. Add the count to
`protocols/[id].astro` too (it currently passes neither badge) for full consistency.
On `returns.astro`, prefer the on-page overdue count already derivable, but calling
the RPC keeps one source of truth and avoids recomputing here.

### Success Criteria:

#### Automated Verification:

- Migration applies cleanly: `npx supabase db reset` (or `supabase migration up`)
- DB types regenerated: `count_overdue_returns` present and `list_returns_today`'s
  `Returns` has `customer_phone`: `grep -E "count_overdue_returns|customer_phone" src/db/database.types.ts`
- Type-check/build passes: `npx astro sync && npm run build`
- Linting passes: `npm run lint`
- Integration test passes: `npm run test:integration` — `count_overdue_returns`
  returns the correct count for a staff caller (strictly-overdue + open + issued +
  confirmed only), excludes due-today / returned / never-issued / non-confirmed, and
  returns `0` for a non-staff (null-role) caller; `list_returns_today` still returns
  its rows (now with `customer_phone`) and its grants survived the drop+recreate

#### Manual Verification:

- Sidebar "Zwroty" shows a danger count pill equal to the overdue count; hidden at 0
- Mobile tab shows a danger dot when inactive+overdue, and a crimson count when
  active+overdue; hidden at 0
- The badge count equals `ReturnQueue`'s on-page `Po terminie` count
- Clicking "Zwroty" with overdue > 0 lands on `/dashboard/returns?filter=overdue`
- No regression to the existing "Wnioski" `pendingCount` badge

**Implementation Note**: After automated verification passes, pause for human
confirmation of the manual checks before Phase 2.

---

## Phase 2: Filter bar

### Overview

Replace the shipped stat area with the canonical filter bar (`design-contract.md §B`):
a unified desktop bar (leading `N dziś` total + three toggle segments) and a mobile
4-pill horizontal scroll (`Wszystkie`/`Na dziś`/`Po terminie`/`Zwrócono`). Filtering
is client state seeded from a server-parsed `?filter`, with a live list header and the
positive empty-overdue state. All inside the `ReturnQueue` island.

### Changes Required:

#### 1. Server-parse the initial filter

**File**: `src/pages/dashboard/returns.astro`

**Intent**: Read `?filter` server-side and hand `ReturnQueue` a typed initial value,
avoiding a client-only read that would cause a hydration mismatch/flash.

**Contract**: Parse `Astro.url.searchParams.get("filter")`, validate against
`"due" | "overdue" | "returned"` (anything else → `null`), pass as
`initialFilter={...}` to `<ReturnQueue>`.

#### 2. Filter state + URL sync in `ReturnQueue`

**File**: `src/components/dashboard/ReturnQueue.tsx`

**Intent**: Hold the active filter as client state seeded from `initialFilter`, and
keep the URL in sync on toggle so reloads/deep-links are stable.

**Contract**: New prop `initialFilter?: Caption | null`. `useState<Caption | null>`
seeded from it. A `setFilter(next)` that toggles (clicking the active caption →
`null` = `Wszystkie`) and calls `history.replaceState` to set/remove `?filter` (no
navigation). Derive the visible rows from the active filter; `null` = all.

#### 3. Rebuild the stat area as a filter bar

**File**: `src/components/dashboard/ReturnQueue.tsx`

**Intent**: Replace `Stats`/`StatCard`/`StatPill` with the canonical filter bar —
toggle controls with tone-specific selected states. Cut the search field and
sparkline (out of scope).

**Contract** (see `design-contract.md §B` for exact values):

- **Desktop (≥ sm)**: one white `shadow-card` bar — a leading `N dziś` total chip, a
  divider, then three segment buttons `Na dziś`(neutral) · `Po terminie`(danger) ·
  `Zwrócono`(success), each with a live count. Selected segment fills its tone
  (`Po terminie` → `bg-primary text-primary-foreground`).
- **Mobile (< sm)**: a `flex gap-2 overflow-x-auto` row of **four** pills
  `Wszystkie N` · `Na dziś N` · `Po terminie N` · `Zwrócono N`. Selected `Wszystkie` →
  `bg-foreground text-background` (navy); selected `Po terminie` → `bg-primary
text-primary-foreground` (crimson); `Na dziś`/`Zwrócono` selected use their tone
  (`provisional` — confirm at implement).
- Render as `<button aria-pressed>`; counts computed from **all** rows (stay live).

#### 4. Live list header + empty states

**File**: `src/components/dashboard/ReturnQueue.tsx`

**Intent**: Reflect the active filter above the list and handle the filtered-empty
cases — chiefly the reassuring overdue-clear state.

**Contract**: A header line `{Filtr} · {N}` — `Wszystkie zwroty · N` (default) /
`Na dziś · N` / `Po terminie · N` / `Zwrócono · N`. Empty states:

- `overdue` filter, 0 overdue → positive card (green-soft `Check` chip): heading
  **`Brak zwrotów po terminie`**, sub **`Wszystkie pojazdy wróciły na czas.`**
  (canonical; screenshots `returns-*-no-overdue.jpg`).
- `due` / `returned` filter, 0 matches → a neutral line `Brak pozycji dla tego filtra.`
- No rows at all (`filter = null`, list empty) → the existing `Brak zwrotów na dziś`
  card, unchanged (`returns-mobile-empty.jpg`).

### Success Criteria:

#### Automated Verification:

- Unit test passes: `npm test` — a pure filter helper selects the correct caption
  subset; toggling the active caption returns `null` (all); `initialFilter`
  round-trips
- Type-check/build passes: `npx astro sync && npm run build`
- Linting passes: `npm run lint`

#### Manual Verification:

- Clicking a segment/pill filters the list; the active one shows its tone-specific
  selected state; the header reflects the filter
- Clicking the active one clears back to `Wszystkie`
- Counts stay live regardless of which filter is active
- `/dashboard/returns?filter=overdue` renders pre-filtered with the control selected
  and no hydration flash; toggling updates the URL without a navigation
- Overdue filter with 0 overdue shows `Brak zwrotów po terminie` /
  `Wszystkie pojazdy wróciły na czas.`
- Desktop shows the unified bar (total + 3 segments, no search/sparkline); mobile
  shows 4 horizontally-scrollable pills
- Matches the design contract; vision-diff (layout) vs the canonical screenshots and
  copy vs the contract (deferred to `/10x-implement`)

**Implementation Note**: Pause for human confirmation of the manual checks (incl. the
vision-diff) before Phase 3.

---

## Phase 3: Overdue-row restyle (days-overdue + Call + ordering)

### Overview

Restyle overdue rows per `design-contract.md §C`: a `PO TERMINIE` eyebrow + a
`⚠ N dni po terminie` indicator (superseding the plain `Po terminie` badge), a `Call`
`tel:` link, and an overdue-first sort.

### Changes Required:

#### 1. Days-overdue indicator (supersedes the `Po terminie` badge)

**File**: `src/components/dashboard/ReturnQueue.tsx`

**Intent**: Show, on overdue rows only, how many whole days past the return date the
rental is, in plural-aware Polish — as the canonical eyebrow + red-soft indicator.

**Contract**: `daysOverdue = rentalDays(row.return_date, today)` (the existing
calendar-day span, `today − return_date`; reuse it). Replace `OverdueBadge` with: an
eyebrow **`PO TERMINIE`** (uppercase, muted) + **`⚠ {formatDuration(daysOverdue)} po
terminie`** (`1 dzień po terminie` / `N dni po terminie`) — mobile as a red-soft pill,
desktop as red text (`design-contract.md §C`). Only when `caption === "overdue"` (so
`daysOverdue ≥ 1`).

#### 2. Call `tel:` link on overdue rows

**File**: `src/components/dashboard/ReturnQueue.tsx`

**Intent**: Let staff phone an overdue customer directly; no logging.

**Contract**: An outline `Button` (`asChild` → `<a href={`tel:${row.customer_phone}`}>`),
`Phone` icon + copy **`Zadzwoń`**, on **overdue rows only** (absent on plain due rows).
Uses the `customer_phone` added to the RPC in Phase 1. Guard an absent phone (render
nothing if null).

#### 3. Overdue-first ordering

**File**: `src/components/dashboard/ReturnQueue.tsx`

**Intent**: Group the worklist overdue → due → returned, as the mockups show (the RPC
orders by `reference`).

**Contract**: Client-side stable sort by caption rank (`overdue` < `due` <
`returned`), preserving the RPC's `reference` order within each group. Applied to the
rendered list (independent of the active filter).

### Success Criteria:

#### Automated Verification:

- Unit test passes: `npm test` — the indicator reads `1 dzień po terminie` for a
  1-day-overdue row and `N dni po terminie` for N>1; absent for due/returned; the
  caption-rank sort orders overdue → due → returned
- Type-check/build passes: `npx astro sync && npm run build`
- Linting passes: `npm run lint`

#### Manual Verification:

- Overdue rows show the `PO TERMINIE` eyebrow + `N dni po terminie` indicator and a
  `Zadzwoń` link; due/returned rows show neither
- `Zadzwoń` opens the dialer with the customer's number
- Rows are grouped overdue → due → returned
- Copy correct and plural-aware at the 1-day boundary
- Placement/size matches the design contract; vision-diff vs the canonical
  screenshots (deferred to `/10x-implement`)

**Implementation Note**: Pause for human confirmation before closing the change.

---

## Testing Strategy

### Unit Tests:

- Filter helper: caption subset selection; toggle-to-`null`; `initialFilter` parse
  validates the three captions and rejects junk.
- Days-overdue indicator: `1 dzień po terminie` at the boundary, `N dni po terminie`
  above; absent for non-overdue captions. (`rentalDays`/`formatDuration` already
  have unit coverage — add the composition/label case.)
- Caption-rank sort: overdue → due → returned, stable within group.

### Integration Tests:

- `count_overdue_returns` against local Supabase (serial `integration` project):
  seed a mix of confirmed reservations — strictly-overdue+open+issued (counts),
  due-today (excluded), returned (excluded), never-issued-past-due (excluded),
  non-confirmed (excluded) — and assert the count. Assert the count equals the
  overdue subset of `list_returns_today` for the same fixture (parity). Assert a
  non-staff / null-role caller receives `0`.
- `list_returns_today` after the drop+recreate: still returns rows, now including
  `customer_phone`; grants survived (an `authenticated` staff caller gets rows, and
  the `revoke from public, anon` is back in place).

### Manual Testing Steps:

1. With overdue rentals present, confirm the danger badge on "Zwroty" (pill on
   desktop sidebar, dot/count on mobile tab) on several pages; confirm it equals the
   page's overdue count.
2. Click "Zwroty" → lands on `?filter=overdue`, list pre-filtered, control selected.
3. Toggle each segment/pill; verify tone-specific selected state, header, live counts,
   and click-active-to-clear; on mobile, the 4-pill row scrolls horizontally.
4. Mark/seed all overdue as returned → badge disappears; overdue filter shows the
   `Wszystkie pojazdy wróciły na czas.` state.
5. Verify the `PO TERMINIE` eyebrow + `N dni po terminie` indicator and the `Zadzwoń`
   link on overdue rows at both breakpoints; confirm the dialer opens.

## Performance Considerations

Each staff page gains one extra RPC round-trip (`count_overdue_returns`), folded into
the existing `Promise.all` where present — a single scalar `count(*)` over already
INNER/LEFT-joined protocol tables, negligible next to the existing full-row pending
fetch. No client-side cost beyond the already-hydrated island; filtering and sorting
are in-memory over rows already present.

## Migration Notes

Two additive, read-only DB changes in one migration: the new `count_overdue_returns`
function, and a drop+recreate of `list_returns_today` to add a `customer_phone`
output column (grants re-applied). No data backfill, no table/RLS changes. Reversible
by dropping the count function and recreating `list_returns_today` without the column.

## References

- Frame brief: `context/changes/overdue-returns-dashboard/frame.md`
- Design rebuild brief: `context/changes/overdue-returns-dashboard/design-rebuild-brief.md`
- Design contract: `context/changes/overdue-returns-dashboard/design-contract.md`
- Canonical screenshots (EN-reference): `context/changes/overdue-returns-dashboard/design-review/*.jpg`
- Overdue detection + returns RPC: `supabase/migrations/20260716120000_return_protocol.sql:304-387`
- Classification/counts: `src/components/dashboard/ReturnQueue.tsx:44-49,331-333`
- Badge pattern: `src/components/shell/StaffShell.astro:34,76-85,148-150`
- RPC/revoke hygiene: `supabase/migrations/20260617121000_list_pending_reservations.sql`,
  `context/foundation/lessons.md` (revoke-before-grant)
- Helpers: `src/lib/format.ts:60-62,76-78`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Backend (count RPC + phone column) + nav badge

#### Automated

- [x] 1.1 Migration applies cleanly (`supabase db reset` / `migration up`) — 3991554
- [x] 1.2 DB types regenerated; `count_overdue_returns` present and `list_returns_today` has `customer_phone` — 3991554
- [x] 1.3 Type-check/build passes (`astro sync && npm run build`) — 3991554
- [x] 1.4 Linting passes (`npm run lint`) — 3991554
- [x] 1.5 Integration test: count correct for staff (overdue+open+issued+confirmed only), excludes due-today/returned/never-issued/non-confirmed, 0 for non-staff; `list_returns_today` still returns rows (with `customer_phone`) and grants survived drop+recreate — 3991554

#### Manual

- [x] 1.6 Sidebar danger count pill equals overdue count; hidden at 0 — 3991554
- [x] 1.7 Mobile tab: dot when inactive+overdue, crimson count when active+overdue; hidden at 0 — 3991554
- [x] 1.8 Badge count equals ReturnQueue's on-page overdue count — 3991554
- [x] 1.9 Clicking "Zwroty" with overdue > 0 lands on `?filter=overdue` — 3991554
- [x] 1.10 No regression to the "Wnioski" pendingCount badge — 3991554

### Phase 2: Filter bar

#### Automated

- [x] 2.1 Unit test: filter subset selection, toggle-to-null, `initialFilter` round-trip
- [x] 2.2 Type-check/build passes (`astro sync && npm run build`)
- [x] 2.3 Linting passes (`npm run lint`)

#### Manual

- [x] 2.4 Clicking a segment/pill filters the list; active shows tone-specific selected state; header reflects filter
- [x] 2.5 Clicking the active one clears to `Wszystkie`
- [x] 2.6 Counts stay live regardless of active filter
- [x] 2.7 `?filter=overdue` deep-link renders pre-filtered, no hydration flash; toggle syncs URL
- [x] 2.8 Overdue filter with 0 overdue shows the positive empty state
- [x] 2.9 Desktop unified bar (total + 3 segments, no search/sparkline); mobile 4 scrollable pills
- [x] 2.10 Matches design contract (layout vs screenshots, copy vs contract); vision-diff (deferred)

### Phase 3: Overdue-row restyle (days-overdue + Call + ordering)

#### Automated

- [ ] 3.1 Unit test: `1 dzień po terminie` / `N dni po terminie`, absent for non-overdue; caption-rank sort overdue→due→returned
- [ ] 3.2 Type-check/build passes (`astro sync && npm run build`)
- [ ] 3.3 Linting passes (`npm run lint`)

#### Manual

- [ ] 3.4 Overdue rows show `PO TERMINIE` eyebrow + `N dni po terminie` + `Zadzwoń`; due/returned show neither
- [ ] 3.5 `Zadzwoń` opens the dialer; copy correct and plural-aware at the 1-day boundary
- [ ] 3.6 Rows grouped overdue → due → returned; placement matches design contract; vision-diff (deferred)
