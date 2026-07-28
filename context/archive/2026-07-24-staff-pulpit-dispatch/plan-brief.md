# Staff Pulpit → Dispatch Cockpit — Plan Brief

> Full plan: `context/changes/staff-pulpit-dispatch/plan.md`
> Design audit: `context/changes/staff-pulpit-dispatch/design-audit.md`
> Design contract: `context/changes/staff-pulpit-dispatch/design-contract.md`

## What & Why

The `/dashboard` staff pulpit shipped as a deliberate thin slice at S-03 — a
"Wymaga decyzji + two link cards" page with pickups/returns/overdue deferred to
S-05/S-06/S-07. Those are all done now, so the data exists but was never surfaced.
This rebuilds the pulpit into the full **dispatch cockpit** the design specifies, for
desktop and mobile.

## Starting Point

`dashboard.astro` renders a `max-w-2xl` single column (`NeedDecisionPanel` + two link
cards); on desktop the right half is empty. The nav already matches the design (verified
against a live capture). The dispatch/returns data (`listDispatchToday`,
`listReturnsToday`), the row components (`PickupQueue`/`ReturnQueue`), and a full filter-
bar pattern (`ReturnQueue` + `returns-filter.ts`) all already exist.

## Desired End State

A logged-in employee opens `/dashboard` and sees a dispatch cockpit: a greeting header, a
row of KPI stat cards (desktop) / filter chips (mobile), a grouped Today's Schedule
(Wydania then Zwroty, with "N z M zakończone" progress and compact status rows), and the
Need-a-decision rail. Every element links to an already-built route.

## Key Decisions Made

| Decision             | Choice                                 | Why (1 sentence)                                                                            | Source |
| -------------------- | -------------------------------------- | ------------------------------------------------------------------------------------------- | ------ |
| Scope                | Pulpit body only                       | Nav + roles already match; keep blast radius small                                          | Audit  |
| Per-row time         | Drop clock times                       | Data is date-only; matches the newer desktop v3                                             | Plan   |
| Done rows            | Whole row links                        | Every row actionable + discoverable (pending → handover, done → protocol view)              | Plan   |
| Counts               | Day totals                             | Badge = rows the view shows (matches ReturnQueue + mockups); progress lives in the schedule | Plan   |
| Mobile chips         | Single-select filter + `?section` sync | Consistent with the existing returns filter                                                 | Plan   |
| Tests                | None (pure helpers only)               | Dispatch data already e2e-covered; vision-diff is the gate                                  | Plan   |
| Architecture         | One `DispatchBoard` island             | Single source of truth for the compact row across breakpoints                               | Plan   |
| Search / Profile tab | Deferred                               | No search backend; Profile needs no data yet                                                | Audit  |

## Scope

**In scope:** desktop greeting header, 4 KPI stat cards, two-column schedule /
need-a-decision, mobile eyebrow+title+avatar header, functional filter chips, mobile
sections, removal of the two link cards, shared date helper, pure board helpers,
`design-contract.md`.

**Out of scope:** any `StaffShell` nav change, the mobile Profile tab, a real search
backend/field, backend/RPC/schema/type changes, new automated tests, changes to the
queue pages or `NeedDecisionPanel` behavior.

## Architecture / Approach

`dashboard.astro` fetches four data sources in one `Promise.all`, computes remaining
counts + grouping + Polish date strings, sets `StaffShell showHeader={false}`, and renders
its own headers + one lightweight React island `DispatchBoard` (`client:load`) that owns
both breakpoints and the mobile chip state. `NeedDecisionPanel` nests inside it; the
compact schedule row is a single shared component. No new data layer.

## Phases at a Glance

| Phase                       | What it delivers                                                     | Key risk                                                           |
| --------------------------- | -------------------------------------------------------------------- | ------------------------------------------------------------------ |
| 1. Shared helpers           | `pl-date.ts` (dedupe) + pure `dispatch-board.ts` logic; no UI change | Regressing the returns-page date after extraction                  |
| 2. Desktop cockpit          | Data wiring + greeting header + KPI cards + two-column layout        | Design fidelity of the stat cards + grid ratio (vision-diff tunes) |
| 3. Mobile cockpit + cleanup | Mobile header + chips + sections; remove link cards                  | Chip filter/`?section` hydration correctness                       |

**Prerequisites:** local Supabase running + a seeded employee (`employee@fleetrent.test`);
canonical mockups in `design-review/`.
**Estimated effort:** ~2-3 sessions across 3 phases; no backend work.

## Open Risks & Assumptions

- ~~Stat-card spacing / grid ratio seeded from the mockup~~ **Resolved 2026-07-26:** the
  source JSX was pulled from the live Claude Design project (`staff-desktop.jsx`,
  `staff-screens.jsx`), so the contract now carries exact values (grid `1.5fr/1fr`,
  cards `rounded-[18px] min-h-[148px]`, number 46px, watermark 128px @ 6%). The
  vision-diff now verifies rather than tunes.
- The greeting is static "Dzień dobry" (not time-based) to dodge a workerd UTC-vs-Warsaw
  hour hazard — a recorded deviation.
- Deviations vs the mockups (dropped times, omitted search, static depot subtitle, generic
  vehicle glyph, unified "Protokół" CTA) are recorded in `design-contract.md`.

## Success Criteria (Summary)

- Desktop + mobile `/dashboard` match the canonical mockups (vision-diff empty minus
  recorded deviations).
- Every KPI card, chip, and schedule row navigates to the correct existing route.
- No nav/shell regression and no change to the queue pages.
