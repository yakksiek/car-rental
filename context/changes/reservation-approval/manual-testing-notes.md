# Reservation Approval (S-03) — Manual Testing Notes

> Running log of manual-verification observations against the implemented slice.
> Purpose: capture layout/UI problems here so we can **clear context** and pick up
> the fixes later with a clean window. Implementation is committed on branch
> `feature/reservation-approval` (worktree `car-rental-reservation-approval`).
>
> Environment: `npm run dev` on http://localhost:4321 (workerd reads `.dev.vars` →
> local Supabase). Login: `employee@fleetrent.test` / `Fl33tRent-Employee_2026!`.
> Reset pending queue: `npx supabase db reset` (restores `R-0003`, `R-0004`).

## Status summary (2026-06-18)

**Functionality: all confirmed working** (sections 0–8) — access gating, queue
(mobile + desktop master-detail), accept, reject (incl. `Inny` + note), already-
handled re-sync, confirm/reject emails, `/r/<token>` status, calendar render +
colors + bar-click decide/read-only + nav refetch, and the 403/400/redirect
boundaries. **No behavioural bugs found.**

**Remaining = layout/UI only**, captured below. Suggested triage:
- **Shell (one body of work):** L1 + L2 + L4 + L6 — shared staff nav (bottom bar on
  mobile / sidebar on desktop) + account chip + centered list header.
- **Calendar:** L8 (day-resolution default, drop hour grid) + L9 (hide `+ New`) +
  L10 (today-column marker).
- **Detail polish:** L5 (dates-held mini-timeline → link to calendar) + L7 (desktop
  detail header: left-aligned + prominent total + vehicle/pickup 2-up).
- **Defer to S-07:** L3 (dispatch dashboard: greeting, today-stats, schedule).
- **Decisions needed:** (a) build the shell in S-03 or defer to a shell slice;
  (b) L5/L7/L8-status-label = S-03 polish vs defer; (c) L8 supersedes plan 7.5's
  "14:00→10:00 bars" — confirm day-resolution bars are acceptable.

## ✅ Fix log — layout follow-up session (2026-06-18)

Worked the backlog in three committed phases (branch `feature/reservation-approval`);
`npm run build` + `npm run lint` clean after each. Re-test with the dev server.

- **Phase 1 — shell (L1, L2, L4, L6):** new `src/components/shell/StaffShell.astro`
  (+ `NavIcon.astro`, `src/lib/staff-identity.ts`). One responsive nav: left
  sidebar + user chip at md+, floating dark tab bar below md, wrapping the three
  staff pages. Dropped the `← Pulpit` text links and the in-queue count header
  (now the shell topbar on desktop + a centered mobile header). Added the
  initials avatar / account chip. **Re-test:** nav between Pulpit/Wnioski/Kalendarz
  on mobile + desktop; active states; pending badge; signout from the chip.
- **Phase 2 — calendar (L8, L9, L10):** `initialView="month"`,
  `weekViewGranularity="daily"` (7 day columns, no hour grid), a custom
  `headerComponent` (prev/Dziś/next + Miesiąc/Tydzień switch) that omits `+ New`
  and the Dzień/Rok views. Today's column marked via `#day-number-today` (crimson
  pill) in `global.css`. **Re-test:** week view shows day columns (no scroll);
  no `+ New`; today highlighted; bar-click decide/read-only still works.
- **Phase 3 — detail polish (L7, partial L5):** desktop `RequestDetail` header is
  now left-aligned (reference + PENDING + big name) with a prominent right total
  and Vehicle/Pickup 2-up; mobile centered header preserved. Dates-held card shows
  a mini timeline of the held window + links to `/dashboard/calendar`.

- **Phase 4 — dashboard "Wymaga decyzji" mini-list (in-scope L3):** new
  `src/components/dashboard/NeedDecisionPanel.tsx` replaces the Pulpit pending
  launcher card with the design's "Need a decision" panel — pending requests as
  quick-action cards with inline Odrzuć/Zatwierdź + "Otwórz →" to the full queue,
  reusing the shared decision mechanism (`useReservationDecision` + ReasonSheet +
  ResultOverlay). **Re-test:** decide from the dashboard (accept/reject/reason/
  already-handled re-sync), overflow "Zobacz wszystkie", empty state.

**Deferred (decisions stand):** L3 dispatch *dashboard chrome* → S-07 — greeting/
Dispatch hero, Pickups/Returns/Overdue tiles, and Today's Schedule need pickup
(S-05) / return (S-06) / overdue (S-07) data that doesn't exist yet. Only the
"Need a decision" mini-list was in S-03 scope and is now built (Phase 4).

**L5 calendar focus — done (Phase 5):** "Zobacz w kalendarzu" now deep-links to
`/dashboard/calendar?view=week&date=<pickup>&vehicle=<id>`; the page anchors the
SSR data window on that date, opens in week view on the booking, and tints the
vehicle's row. **Re-test:** click it from a request whose dates are off the
default month — the calendar should land on the booking instead of today.
Remaining L5 follow-up: showing the vehicle's *other* confirmed blocks (green) in
the detail's mini-timeline still needs `getVehicleBusyRanges` wired to the client
island; the mini-timeline shows the held block only.

## 📐 Design source — pull live, not screenshots (DesignSync)

This Claude Code build has the **`DesignSync`** tool + `/design-sync` skill (Claude
Design update shipped 2026-06-17). The design lives in the user's Claude Design
**project "Rental car company"**:

- **URL:** https://claude.ai/design/p/352d78a6-84fd-49a2-8b38-2fe289691fc3
- **projectId:** `352d78a6-84fd-49a2-8b38-2fe289691fc3` (type: PROJECT_TYPE_PROJECT)
- (separate empty design-system project "Design System": `61f81b9f-b217-48df-bfe3-baa5a1596390`)

**How to read it** (no screenshots): `DesignSync get_file --project 352d78a6-… --path <file>`.
Relevant files → backlog mapping:
- `staff-screens.jsx` → Worker dashboard (07), Pending queue (08), Request detail
  (09), **TabBar bottom nav** → L1, L4, L5
- `staff-desktop.jsx` → desktop **sidebar shell** + master-detail (13/14) → L6, L7
- `desktop-screens.jsx` → **calendar timeline (16)** → L8, L10
- `admin-mobile.jsx` → mobile admin / calendar (22) → L8
- `tokens.css` / `Design tokens.html` → tokens (compare to `src/styles/global.css`)
- `Flota Rental.html` → composed prototype

**Note:** the repo's `context/foundation/design/*.jsx` is a *static export snapshot*;
the live project is newer (uploads dated 2026-06-18). Prefer pulling the live file
via `get_file` for the layout follow-up. Alternative: from claude.ai/design use
**Export → Send to Claude Code** to get a structured handoff bundle.

## 🔧 Layout / UI problems to fix (follow-up backlog)

> The actionable list for the next session. Each item: where, what's wrong, expected.
> Reference files: `src/components/dashboard/PendingQueue.tsx`,
> `ReservationDecision.tsx`, `ReservationCalendar.tsx`,
> `src/pages/dashboard/{reservations,calendar}.astro`, tokens in `src/styles/global.css`.

### L1 — No persistent app navigation (floating bottom tab bar) [mobile shell]
- **Observed:** our app navigates only via the two launcher cards on `/dashboard`
  ("Oczekujące wnioski", "Kalendarz"). To move between the queue and the calendar
  you must go back to `/dashboard`.
- **Mock:** an always-visible floating **bottom tab bar** (pill, dark) with
  `Dash` / `Kalendarz` (calendar) / `Fleet` (truck) / `Profil` (person) icons —
  the primary nav on every staff screen. Source: `staff-screens.jsx` `TabBar`
  (screens 09/10/11); screenshot ref the user shared 2026-06-18.
- **Expected (S-03 scope):** a shared staff bottom-nav (mobile) / sidebar (desktop)
  with at least **Dash + Kalendarz** tabs. `Fleet` = S-04, `Profil`/account = S-08,
  so those tabs may render disabled/omitted until those slices land.
- **3-page mobile model (confirmed by user):** Dashboard (screen 07) → Pending
  requests list (screen 08) → Request detail (screen 09). The bottom tab bar is the
  primary way to move between Dash/Kalendarz; the per-page back affordance is only
  for list→detail.
- **Coupling:** once the bottom nav exists, the **`← Pulpit` text back-link on the
  pending list is redundant and should be removed** (see L4). The back arrow stays
  meaningful only for detail→list on mobile.
- **Scope note:** this is a cross-cutting **app-shell** component not built in S-03
  (Phase 4 deliberately shipped a minimal link launcher). Triage: build a small
  shared `StaffNav` now, or defer to a dedicated shell slice. **Decision needed.**
- **Files:** new shared nav component; mount in `Layout.astro` or a staff layout;
  `src/pages/dashboard/{index,reservations,calendar}.astro`.

### L4 — Pending-requests header doesn't match prototype (screen 08)
- **Observed (ours):** top-left `← Pulpit` text link, then a large **left-aligned**
  heading "Oczekujące wnioski", then the count `2 oczekuje na decyzję`.
- **Mock (screen 08):** **centered** title "Oczekujące wnioski" with a **circular
  white back button** on the left and a circular **filter** button on the right;
  count below.
- **Expected:** restructure the header to the centered-title pattern.
  - **Filter button: OMIT** — not needed now (user). (Matches plan's "no filter
    chips" scope.)
  - **Back affordance:** drop the `← Pulpit` text link; rely on the bottom nav (L1).
    Keep a back control only where it means list→detail. So this is **coupled to
    L1** — finalize header once the nav decision is made.
- **Files:** `src/pages/dashboard/reservations.astro` (header markup),
  `src/components/dashboard/PendingQueue.tsx` (count header block).

### L5 — Detail "Daty zarezerwowane" is text-only; mock has a mini-timeline that links to the calendar
- **Observed (ours):** the detail's `DATY ZAREZERWOWANE` card shows the amber dot +
  label + note text only — **no visualization**. (Phase 4 intentionally dropped the
  prototype's hardcoded timeline.)
- **Mock (screen 09):** a **mini timeline bar** — the held block labelled
  `R-2402` (amber) plus any confirmed blocks (green) on the same vehicle, with a
  date axis (`01 kwi … 14 kwi`).
- **Wanted (user):** render the mini timeline, and **clicking it opens the full
  `/dashboard/calendar`** (ideally focused on that vehicle/date window).
- **Data note:** the queue RPC (`list_pending_reservations`) doesn't return the
  vehicle's other bookings. **`get_vehicle_busy_ranges` already exists** (per-vehicle
  pending+confirmed date bounds) and is a good source for the mini-timeline without
  new SQL; alternatively `list_reservations_for_calendar` filtered by vehicle.
- **Scope:** genuine enhancement (visualization + cross-link). Triage S-03 polish vs
  defer. **Decision needed.**
- **Files:** `src/components/dashboard/PendingQueue.tsx` (RequestDetail dates-held
  card; also used by desktop), maybe `ReservationDecision.tsx`; data via
  `getVehicleBusyRanges` (`src/lib/services/reservations.ts`).

### L2 — No account chip / avatar with initials [shell]
- **Observed:** `/dashboard` ("Pulpit") shows email + role text + a "Wyloguj"
  button, but **no round avatar with initials**.
- **Mock:** round crimson avatar with initials (e.g. `PB`) top-right of the
  dashboard hero; the Phase 5 desktop contract also specifies a sidebar user chip
  (avatar + name + `Staff · Warszawa`).
- **Expected:** an account chip (initials avatar + name/role) in the staff shell.
- **Scope note:** shell element; pairs with L1. Likely the same follow-up.
- **Files:** shared nav/shell component; `src/pages/dashboard.astro`.

### L3 — Dashboard content differs from prototype Staff dashboard (mobile 07 / desktop 13·20)
- **Observed:** `/dashboard` ("Pulpit") is a minimal launcher — email/role + two
  link cards ("Oczekujące wnioski" + count badge, "Kalendarz"). No greeting, no
  stats, no schedule, no decision mini-list.
- **Mock (mobile 07):** date `WT · 24 MARCA`, **"Dispatch"** hero +
  `Dyspozytor: Piotr · 12 pojazdów`, three stat tiles (Pickups/Returns/Pending),
  "PICKUPS TODAY" list.
- **Mock (desktop 13·20):** sidebar shell (see L6) + greeting "Good morning, Piotr"
  / depot subtitle, **4 stat tiles** (Pickups Today / Returns Today / **Need a
  decision = Pending** / Overdue), a **TODAY'S SCHEDULE** timeline (pickups/returns
  + Start), and a **NEED A DECISION** column = compact pending cards with inline
  Reject/Approve + an `Open →` link to the queue.
- **Scope split:**
  - **S-07 (defer):** greeting/depot, Pickups/Returns/Overdue tiles, Today's
    Schedule. Per the design catalog screen 09/13 map to **S-03 / S-07**.
  - **S-03-relevant:** the **NEED A DECISION** panel — a count + a small pending
    mini-list with inline accept/reject + `Open →`. The Phase 5 contract explicitly
    said "if a count + mini-list is cheap, mirror this; otherwise a plain link
    suffices." We shipped the **plain link + count** (allowed). **Optional upgrade:**
    turn the "Oczekujące wnioski" card into the mini-list panel.
- **Disposition (proposed):** keep the launcher; do **not** build the dispatch
  dashboard here (S-07). Optionally upgrade the pending card to a "Need a decision"
  mini-list if we want closer parity. Shell (sidebar/greeting bar) = L6.

### L6 — No desktop app shell (left sidebar + top bar + user chip) [shell, desktop face of L1/L2]
- **Observed (ours, ≥768px):** the page is just the master-detail body. Top-left
  shows the reused mobile header (`← Pulpit` link + big "Oczekujące wnioski" +
  amber count). **No sidebar, no top bar.**
- **Mock (screen 21):** persistent **left sidebar (~250px)** — `Flota/STAFF` logo,
  `OPERACJE` label, nav items **Dispatch / Pending requests (active dark pill +
  count badge) / Calendar / Overdue**, and a bottom **user chip** (PB avatar,
  "Piotr Bednarz", "Staff · Warszawa"). Plus a **top bar**: title "Oczekujące
  wnioski" + subtitle "… oczekuje na decyzję", with a `Szukaj…` search + calendar
  icon on the right (search/calendar are chrome — **omit/inert** per plan).
- **Expected:** the desktop form of the shared staff shell. This is the **same work
  as L1 (mobile bottom nav) + L2 (account chip)** — one responsive `StaffNav`/shell:
  sidebar at `md+`, bottom tab bar below. Active item = Pending requests.
- **Scope:** matches the **Phase 5 design contract** (which described this shell),
  but the Phase 5 implementation only built the master-detail body, not the shell.
  Genuine gap. Fold into the L1/L2 shell decision.
- **Files:** shared shell component + a staff layout wrapping `dashboard/*`.

### L7 — Desktop detail-panel header/treatment differs from screen 21
- **Observed (ours):** the detail panel reuses the **mobile** layout — a *centered*
  "WNIOSEK R-0004 / Złożono · …" header (with an empty back-button slot), then
  vehicle card, dates card, dates-held, customer, pricing **stacked vertically**;
  total only appears low in the pricing card.
- **Mock (screen 21):** detail header is **left-aligned** — reference + amber
  `PENDING` badge, **large customer name**, "Submitted · …" — with a **prominent
  right-aligned total** (`2380 zł` over `7 dni · + kaucja 2500 zł`) at the top.
  Vehicle card and Pickup→Return card sit **side-by-side (2-up)**.
- **Gaps:**
  - a) Drop the centered/empty-back header on desktop; use the left-aligned
    reference + PENDING badge + big customer name.
  - b) Add the **prominent right-aligned total** in the detail header.
  - c) Lay Vehicle + Pickup→Return **2-up** at `md+` (stacked on mobile).
- **Scope:** desktop polish over the existing `RequestDetail`; arguably S-03.
  Smaller than L6. Triage.
- **Files:** `src/components/dashboard/PendingQueue.tsx` (`RequestDetail`),
  `src/pages/dashboard/reservations.astro`.
- **Note:** licence/plate correctly omitted (no schema field) — matches plan, not a gap.

### L8 — Calendar renders an HOUR time-grid, not a day-resolution resource timeline ⚠️ (significant)
- **Observed:** in `Tydzień`/`Dzień` the columns are **hours** (12 AM…11 AM). Our
  events are timed `pickup 14:00 → return 10:00`, so a booking sits at the **2 PM**
  column — **off-screen** in the default 12 AM–11 AM viewport — and multi-day
  bookings don't render as horizontal day-spanning bars. Result: the calendar
  looks **empty** even though events load (confirmed via the GET RPC returning rows).
- **Mock (screens 16 / 22):** a **resource timeline at day resolution** — each
  reservation is a continuous **bar across the days** it covers, per vehicle row.
  No hour grid.
- **Likely fix:** emit **all-day** events from `reservationsToEvents`
  (`src/lib/calendar/map.ts`) so bookings render as day-spanning bars, and/or use a
  day/timeline resource view rather than the hour time-grid week/day views.
- **⚠️ Design tension to resolve:** the plan's success criterion **7.5 explicitly
  says "bars at 14:00→10:00"** and the mapper unit tests assert the 14:00/10:00
  times. Switching to all-day bars contradicts that wording (the 14:00/10:00 detail
  would live only in the request detail, like the mock). **Decision needed:**
  day-resolution all-day bars (matches mock 16/22) vs. timed bars (matches plan
  7.5 literal). Recommend all-day bars + keep the precise times in the detail.
- **Also:** default view opened as **Dzień** despite `initialView="week"` — verify
  whether the lib ignores it in resource mode; pick a sensible default (month/
  timeline) once the above is decided.
- **Immediate workaround for testing:** use **Miesiąc** (month) view — day grid
  shows the bars now.
- **UPDATE (2026-06-18): Miesiąc (month) view renders the intended timeline
  perfectly** — vehicles as rows, days as columns (10–21 cze), bookings as
  day-spanning bars, **colors correct** (amber pending / green confirmed). So the
  data + color mapping are right; the problem is isolated to the **Week/Day views**,
  which use an hour grid (single day "Mon 15" + 12 AM…11 AM).
- **User decision (2026-06-18):** **no hourly granularity** — minimum rental is one
  day. **Week view should show all 7 days as columns** (no hours, no horizontal
  scroll, esp. desktop), like the month timeline. So: make **month the default
  view** and/or reconfigure week to a day-resolution timeline; consider dropping the
  Dzień/hour view entirely. This supersedes the "timed 14:00→10:00 bars" intent of
  plan 7.5 — the 14:00/10:00 detail lives in the request detail, not the calendar bar.
- **Files:** `ReservationCalendar.tsx` (`initialView="month"`, restrict/relabel
  views, maybe `allDay` events), `src/lib/calendar/map.ts`, `map.test.ts`.

### L10 — Today's column not visually distinguished (month view)
- **Observed:** in Miesiąc view the **18 cze (today)** column header looks like any
  other day — no highlight/marker. (The week/day hour-grid did show a red current-
  time line, but month view has none.)
- **Mock (screen 16/22):** today's column is highlighted (tinted column + bold/red
  date header, vertical marker line).
- **Expected:** distinguish today's column in the day-resolution timeline.
- **Files:** `ReservationCalendar.tsx` (lib option / `classesOverride`), tokens.

### L9 — Calendar shows a `+ New` create button (should be omitted)
- **Observed:** top-right of the calendar has a crimson **`+ New`** button.
- **Spec:** the plan's scope (S-03) **omits** the empty-slot/manual-create
  affordance ("`+` button is omitted", `disableCellClick`). The `+ New` from the
  library's default header should be hidden.
- **Fix:** hide the create button (a header/toolbar option or `classesOverride`/
  custom `headerComponent`), alongside the already-set `hideExportButton`.
- **Files:** `src/components/dashboard/ReservationCalendar.tsx`.

## Other observations (non-layout: behaviour, copy, data)

- **Section 2 logic: ✅ works correctly** (queue list, `Sprawdź` → detail, back nav).
- Prototype screenshots use the EN copy toggle (`Reject`/`Approve`/`Dash`); our app
  is PL-canonical (`Odrzuć`/`Zatwierdź`) — expected, not a bug.
- **Calendar status tags vs mock — scope, not a bug.** Mock admin calendar shows
  `ACTIVE / APPROVED / PENDING / COMPLETED / OVERDUE`; S-03 deliberately renders only
  **pending (amber) + confirmed (green)** with a two-item legend (plan: "no future-
  state legend; only pending + confirmed"). `ACTIVE`=S-05 pickup, `COMPLETED`=S-06
  return, `OVERDUE`=S-07 — out of scope here. Our colors verified correct in month
  view. **Optional polish:** show the status label *inside* the bar (mock does:
  "Name / PENDING"); ours shows the customer name only.
- **Calendar data + colour mapping: ✅ verified** in Miesiąc view (mix of pending/
  confirmed renders with correct amber/green).

---

## Test progress log

### 0. Setup / sanity — ✅ CONFIRMED (2026-06-18)
- Catalogue renders (local DB), signed-out redirect to `/auth/signin`, employee login works.

### 1. Access gating — ✅ CONFIRMED (2026-06-18)
- [x] `/dashboard` entry cards + pending-count badge
- [x] `/dashboard/reservations` + `/dashboard/calendar` load for employee

### 2. Queue — mobile (<768px) — ✅ LOGIC CONFIRMED (2026-06-18); layout gaps L1–L3
- [x] Queue lists pending (ref, customer, vehicle, range, total, PENDING)
- [x] `Sprawdź` → detail: 14:00/10:00, customer name/email/phone, pricing + Kaucja; no licence/plate
- [x] Back returns to queue
- Layout gaps logged: **L1** (no bottom-tab nav + 3-page model + redundant back link),
  **L2** (no account chip/avatar), **L3** (dashboard vs prototype screen 07 — mostly
  S-07 scope), **L4** (pending-list header not centered; omit filter; back link
  coupled to L1), **L5** (dates-held mini-timeline missing + should link to calendar).

### 3. Accept flow — ✅ CONFIRMED (2026-06-18)
- [x] Zatwierdź → overlay "Rezerwacja potwierdzona" → card leaves queue
- [x] Terminal: confirmation email (ref, dates, total, /r/<token>)
- [x] /r/<token> shows Confirmed (verified R-0003)

### 4. Reject flow — ✅ CONFIRMED (2026-06-18)
- [x] Odrzuć → reason sheet (4 options); Inny reveals note
- [x] Potwierdź odrzucenie → overlay "Wniosek odrzucony" → card leaves queue
- [x] Terminal: rejection email referencing reason; /r/<token> shows Rejected
- Verified R-0004: reason `other` + note "Pojazd uległ awarii." persisted; page shows Rejected.

### 5. Already-handled re-sync — ✅ CONFIRMED (2026-06-18)
- [x] Two tabs; decide in A; deciding same in B → friendly "już rozpatrzony" + stale card drops (409, no overwrite)

### 6. Desktop layout (≥768px) — ✅ LOGIC CONFIRMED (2026-06-18); layout gaps L6–L7
- [x] Master-detail side by side; card select loads right panel (dark ring)
- [~] After decision, detail advances to next pending (or empty state) — not re-verified this round
- [~] Reason sheet / result overlay are centered modals — not re-verified this round
- [x] Empty state present in code
- Layout gaps logged: **L6** (no desktop app shell — sidebar + top bar + user chip;
  desktop face of L1/L2), **L7** (detail header treatment: left-aligned header +
  prominent right-aligned total + vehicle/pickup 2-up).

### 7. Calendar (`/dashboard/calendar`) — ✅ LOGIC CONFIRMED (2026-06-18); layout gaps L8–L10
- [x] Vehicles as rows; pending+confirmed bars render — **in Miesiąc (month) view**
      (added June test data R-0610..R-0615; July seed needs forward nav)
- [x] Colors correct (amber pending / green confirmed) — verified in month view
- [x] Pending bar click → decide flow (accept recolors green; reject removes); email logged — ✅ confirmed
- [x] Confirmed bar click → read-only (Zamknij only) — ✅ confirmed
- [x] Week/month nav refetches + re-plots — ✅ confirmed
- [x] Legend shows only Oczekujące (amber) + Potwierdzone (green)
- [~] No drag/resize; empty-cell click does nothing — drag/cell-click disabled, but `+ New` button present (L9)
- Layout gaps: **L8** (week/day = hour grid, not day timeline; month is correct →
  make day-resolution the default), **L9** (`+ New` button should be hidden),
  **L10** (today's column not distinguished). Status tags = scope (see observations).
- **Note:** the accept/reject decision mechanism itself is already proven (sections
  3–5 + endpoint tests); section 7 just needs the bar-click wiring confirmed.

### 8. Negative / boundary — ✅ CONFIRMED (verified via curl during implementation)
- [x] Signed-out `/dashboard/calendar` → redirect (middleware gate; same as section 0/1)
- [x] `GET /api/reservations/calendar` signed-out → 403; bad dates → 400
