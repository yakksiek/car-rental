# Design-fidelity audit — Staff pulpit (Dispatch dashboard)

Scope: the `/dashboard` pulpit, **mobile + desktop**. First screen of a broader
staff-section fidelity pass.

## Sources

- **Target designs (NEW, supersede old screenshots 20 & 09):**
  - Desktop → `design-targets/target-staff-desktop-dashboard.jpg` — **v3 (updated by user
    2026-07-24)**: grouped schedule, Polish copy, every item clickable to an
    implemented route, **sidebar now matches the built employee (non-admin) nav**.
  - Mobile → `design-targets/target-staff-mobile-dashboard.jpg` — **updated 2026-07-24**:
    dark bottom bar now matches the built nav (+ a new Profile tab).
  - _User to fold these into `context/foundation/design/screenshots/` as the new canonical._
- **Current build:** `src/pages/dashboard.astro`, `src/components/shell/StaffShell.astro`,
  `src/components/dashboard/NeedDecisionPanel.tsx`
- **Reference (already-built dispatch list):** `src/pages/dashboard/pickups.astro`,
  `src/components/dashboard/PickupQueue.tsx`, `ReturnQueue.tsx`
- **Data layer:** `src/lib/services/protocols.ts`, `src/lib/services/reservations.ts`
- **Method:** code-vs-design structural audit. NOT yet pixel-confirmed against a live render.

## Headline

The shipped pulpit is a thin **"pending queue + two link cards"** page. Both new
designs are a full **dispatch cockpit**: KPI row → Today's Schedule → Need a
decision. Entire sections are **absent**, not just mis-styled.

This is a **re-composition of components that already exist**, over data that's
already fetched elsewhere — low risk, no new backend:

- `listDispatchToday` (`protocols.ts:123`), `listReturnsToday` (`:361`),
  `countOverdueReturns` (`:385`), `listPendingReservations` (`reservations.ts:132`) —
  all exist. `pickups.astro:21-25` already fetches the first, third, and fourth.
- **Completion state is free:** `DispatchRow.protocol_id` null ⇒ awaiting ("Protokół"
  button); set ⇒ done ("Zakończone" + green check). The "1 z 3 zakończone" counters
  derive from the same field.
- `PickupQueue` (Wydania rows), `ReturnQueue` (Zwroty rows), and `NeedDecisionPanel`
  (Need-a-decision cards, both breakpoints) already render the pieces the design shows.
- Smoking gun: `NeedDecisionPanel.tsx:19-25` deferred exactly these sections pending
  S-05/S-06/S-07 — now **done**.

## Desktop discrepancies (`dashboard.astro` + `StaffShell` header vs target v2)

| #   | Design                                                                                                                                                                                                                                                                                         | Current build                                                              | Gap                                                                                                                              |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| D1  | Greeting header: "Good morning, Piotr" + depot subtitle + `Szukaj…` + calendar button                                                                                                                                                                                                          | Bare `Pulpit` title bar (`StaffShell.astro:163`)                           | Missing greeting, depot line, search, calendar button                                                                            |
| D2  | 4 KPI stat cards (Pickups / Returns / Need a decision / Overdue); colored top-border + faint watermark icon; **Overdue = filled crimson danger + "PILNE" pill**; **each card clickable**                                                                                                       | None                                                                       | Entire KPI row absent                                                                                                            |
| D3  | Left column **Today's Schedule**, grouped: **"WYDANIA · OD 9:00" (1 z 3 zakończone)** and **"ZWROTY · DO 16:00" (0 z 2 zakończone)**; each row = status circle · vehicle thumbnail · name · vehicle·R-id · **"Protokół →"** (or green check + **"Zakończone"** when done); whole row clickable | None                                                                       | Entire column absent — data + row components already exist (`listDispatchToday`/`listReturnsToday`, `PickupQueue`/`ReturnQueue`) |
| D4  | Two-column layout: Schedule (left) + Need a decision (right rail, "Open →")                                                                                                                                                                                                                    | Single centered column `max-w-2xl` (`dashboard.astro:51`)                  | Desktop renders the mobile-width layout; no 2-col                                                                                |
| D5  | Need a decision cards: R-id · PENDING · name · dates·vehicle · Reject/Approve                                                                                                                                                                                                                  | `NeedDecisionPanel` already implements this — stacked in the narrow column | Placement only; component reusable                                                                                               |
| D6  | Sidebar nav (v3): **Pulpit / Wnioski / Wydania / Zwroty / Kalendarz / Flota** — Polish, employee (non-admin)                                                                                                                                                                                   | Same (`StaffShell` NAV, non-admin)                                         | ✅ Resolved — desktop sidebar now matches the build; no nav change                                                               |

## Mobile discrepancies (`dashboard.astro` mobile hero + `StaffShell` tab bar vs target)

| #   | Design                                                                                                               | Current build                                                                                                                              | Gap                                                                                    |
| --- | -------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------- |
| M1  | Header: "WT · 24 MARCA" · **Dispatch** · search icon · PB avatar                                                     | dateLabel · **Pulpit** · user email · initials                                                                                             | Title (Dispatch vs Pulpit — Decision N2), missing search icon, subtitle is a raw email |
| M2  | **Filter chips (NEW):** All 7 / Pickups today 3 / Returns today 2 / Pending requests 2 (segmented, filters the list) | None                                                                                                                                       | Entire control absent — new interaction                                                |
| M3  | **Pickups today** section: time · name · vehicle·plate · "Protokół"                                                  | None                                                                                                                                       | Absent — `listDispatchToday`                                                           |
| M4  | **Returns today** section: time · name · vehicle · "Zwrot" / "Po terminie" danger                                    | None                                                                                                                                       | Absent — `listReturnsToday` + overdue flag                                             |
| M5  | Pending requests: name · price zł · vehicle·dates · Reject/Approve                                                   | `NeedDecisionPanel` renders ≈ this                                                                                                         | Matches; minor                                                                         |
| M6  | (no equivalent)                                                                                                      | Two link cards "Kalendarz" + "Zarządzanie flotą" (`dashboard.astro:73-93`)                                                                 | Design has none (nav handles nav) → likely remove                                      |
| M7  | Bottom nav (updated): **dark** pill, home / Wnioski•badge / Wydania / Zwroty / Kalendarz / Flota / **Profile**       | **Dark** pill, same 6 operational icons; **no Profile, and no mobile sign-out** (`StaffShell.astro:179`; sign-out is desktop-sidebar-only) | ✅ Bar now matches build. Residual: **Profile** tab — Decision N5                      |

## Navigation map — every item is clickable to an already-built route (per user's update)

| Design element                       | Destination (exists)                                                        |
| ------------------------------------ | --------------------------------------------------------------------------- |
| Stat card · Pickups                  | `/dashboard/pickups`                                                        |
| Stat card · Returns                  | `/dashboard/returns`                                                        |
| Stat card · Need a decision          | `/dashboard/reservations`                                                   |
| Stat card · Overdue (PILNE)          | `/dashboard/returns?filter=overdue` (S-07 deep-link, `StaffShell`)          |
| Schedule row — awaiting → "Protokół" | `/dashboard/pickups/[reservationId]` · `/dashboard/returns/[reservationId]` |
| Schedule row — done → "Zakończone"   | `/dashboard/protocols/[id]` (view)                                          |
| Need a decision — "Open →"           | `/dashboard/reservations`                                                   |
| Need a decision — Approve/Reject     | inline (`NeedDecisionPanel`, existing)                                      |
| Header calendar button               | `/dashboard/calendar`                                                       |
| Header `Szukaj…` search              | **no backend** — Decision N4                                                |

## Cross-cutting note — copy language

The desktop v2 schedule is now **Polish** ("WYDANIA", "ZWROTY", "Zakończone",
"Protokół"), matching the Polish-only app — good. Remaining English in the mockups
("Dispatch", "Pickups", "Need a decision", "Overdue", "Open") is placeholder → map to
existing Polish (Dispatch→Pulpit, Pickups→Wydania, Returns→Zwroty, Need a
decision→Wymaga decyzji, Overdue→Po terminie, Open→Otwórz).

## Decisions needed (change the plan — user's call)

- **N1 — Nav / IA.** ✅ **Resolved 2026-07-24 (both breakpoints):** the v3 desktop
  sidebar and the updated mobile dark bottom bar now match the built employee nav
  (Pulpit / Wnioski / Wydania / Zwroty / Kalendarz / Flota) — no nav change, employees
  keep Flota. Only open nav item is the new **Profile** tab → Decision N5.
- **N5 — Profile tab (mobile).** The mobile bar adds a **Profile/person** tab, but no
  employee profile page exists and the built mobile shell has **no sign-out** at all
  (sign-out lives only in the desktop sidebar). Options: **(a)** drop the Profile icon to
  match the build exactly; **(b)** add a minimal account entry (sign-out + change
  password) — a small, self-contained add that also closes the mobile sign-out gap.
  **Rec: (b) as a fast-follow** (or (a) to keep this slice tight).
- **N2 — Title.** Design says "Dispatch"; app says "Pulpit". **Rec: keep "Pulpit"**
  (Polish-only). _Reinforced by the v2 schedule now being Polish._
- **N3 — Mobile chips.** Build as **functional filters** (All / Pickups / Returns /
  Pending) or static counters? **Rec: functional** (matches intent; cheap client state).
- **N4 — Desktop search.** No search backend. **Rec: defer** the search field; keep the
  calendar button as a link to `/dashboard/calendar`.

## Recommended scope — first slice (pulpit body only)

- **Desktop:** greeting header, 4 clickable KPI stat cards (incl. filled-danger
  Overdue), two-column: grouped Today's Schedule (Wydania/Zwroty + progress counters +
  completion state) left, Need a decision right; drop `max-w-2xl`.
- **Mobile:** header (search icon, keep "Pulpit"), functional filter chips, Pickups
  today, Returns today, Pending requests; remove the two link cards.
- **Reuse** `NeedDecisionPanel`, `PickupQueue`/`ReturnQueue` row rendering; **add** KPI
  `StatCards`, `FilterChips`, and the grouped schedule composition; **wire**
  `listDispatchToday` + `listReturnsToday` into `dashboard.astro` (mirror `pickups.astro`).
- **Defer:** global nav restyle/IA + role re-scope (N1), real search, Profile tab.

## Next

**Decisions locked 2026-07-24:** N3 chips = functional filters · N4 `Szukaj…` search
deferred · N5 Profile tab **deferred** (icon stays, inert this slice).

Then: **capture live current-state screenshots** (pulpit desktop + mobile) next to the
targets → scaffold change `staff-pulpit-dispatch` via `/10x-new` → `/10x-plan`.
