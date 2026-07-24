# Frame Brief: Overdue returns — dashboard surfacing vs. a new "extend rental" capability

> Framing step before /10x-plan. Captures what is _actually_ at issue, separated
> from what was initially assumed.

## Reported Observation

The overdue-returns capability (roadmap **S-07**, PRD **FR-012**: "Employee can
see overdue returns flagged automatically on their dashboard") needs a home in
the UI. A dedicated "Po terminie" sidebar page was the first instinct; a returns
dashboard ("Zwroty", `/dashboard/returns`) already exists. Three mockups were
provided: two show a dedicated overdue page with `OPÓŹNIENIE` (days late),
`STAWKA KARY` (penalty rate 180 zł/h), `NALICZONE` (accrued +980 zł), and
`Contact` / `Extend booking` / `Mark returned` actions; one shows the current app.

## Initial Framing (preserved)

- **User's stated cause or approach**: Don't build a separate page — fold overdue
  into the existing Zwroty dashboard, add a warning badge to that nav item, make
  the top-row stat cards clickable filters, and enrich overdue cards (days overdue,
  penalty, extend-rent, contact).
- **User's proposed direction**: Integrate-not-separate + make overdue _actionable_
  (extend the rental, show days overdue + penalty, contact the customer).
- **Pre-dispatch narrowing** (Step 1.5): (1) Primary intent → _"make an option to
  extend the rent, which changes the total sum but does NOT add a penalty fee — we
  include penalty in v2."_ (2) Nav surface → _"fold into Zwroty + badge."_
  (3) Penalty → _"keep flag-only."_

## Dimension Map

The proposal decomposes into six layers, each at a different distance from the
current codebase and the v1 scope boundary:

1. **Navigation surface** — dedicated "Po terminie" page vs. fold into Zwroty + nav badge.
2. **Overdue computation & existing coverage** — is overdue _already_ flagged? What's the delta vs FR-012? ← the hidden crux
3. **Clickable stat-card filters** — top-row KPIs become filters.
4. **Extend-rental** — a NEW write path that mutates a reservation's `return_date`. ← the real new feature
5. **Penalty / late-fee** — `STAWKA KARY` / `NALICZONE` money columns. ← initial framing lands here; explicit v1 Non-Goal
6. **Contact / last-contact** — the `OSTATNI KONTAKT` field + a Contact action.

## Hypothesis Investigation

| Hypothesis                                                                  | Evidence                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | Verdict                                                             |
| --------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| **FR-012 is already functionally shipped** (overdue flagged on a dashboard) | `list_returns_today` returns ALL open overdue with no lower date bound (`return_protocol.sql:379-381`, `where return_date <= current_date`); `ReturnQueue.tsx:43-49` classifies overdue and paints a red `Po terminie` badge + accent + count (`:286`, `:209`, `:159-163`). A 3-week-old overdue rental stays listed until processed.                                                                                                                                         | **STRONG** — the _flagging_ itself is done on the Zwroty worklist   |
| Real S-07 delta is UI packaging, not detection                              | Stat cards are static, no filter state exists (`ReturnQueue.tsx:90-145`, no onClick); no overdue nav badge (StaffShell has none, but `pendingCount` badge on "Wnioski" is a precedent — `StaffShell.astro:34,76-85`); nothing on the main Pulpit (`NeedDecisionPanel.tsx:24-25` defers overdue tiles to S-07); no days-overdue label. `StaffShell.astro:13` explicitly reserves "Po terminie S-07" as a deferred tab.                                                         | **STRONG**                                                          |
| Extend-rental is a brand-new write capability                               | No reservation write path mutates dates — the only post-create UPDATEs are `decide_reservation`'s two `set status` lines (`reservation_approval.sql:119-132`); RLS drops direct UPDATE (`:167-168`). Needs a new SECURITY DEFINER RPC; must catch the EXCLUDE `23P01` against the _next_ booking (`booking_integrity_data.sql:124-129`) — this IS the "if possible"; no `picked_up`/`active` status exists, so "in-progress" = has `issue` protocol AND no `return` protocol. | **STRONG** — real feature, real integrity surface                   |
| "Changes the total sum" needs a billing subsystem                           | FALSE — a unit-tested `estimatedTotal(dailyRate, days)` (`format.ts:69`) + `rentalDays` (`:60`) already exist and are reused (`BookingWidget.tsx:160`, `ReservationStatusCard.astro:48`). Total is display-only, never persisted. Extend = recompute over the longer span.                                                                                                                                                                                                    | **WEAK** (de-risked)                                                |
| Penalty columns belong in v1                                                | `STAWKA KARY`/`NALICZONE` have no schema anywhere; **explicit PRD Non-Goal** — `prd.md:137` "Flag only in v1 — no automatic late-fee calculation", `prd.md:161` Non-Goals, roadmap `:251` Parked, S-07 Risk `:199` "flag only".                                                                                                                                                                                                                                               | **NONE** — correctly out (user chose flag-only; penalty → v2)       |
| Last-contact needs tracking                                                 | `OSTATNI KONTAKT` has no data model; nothing tracks manual staff↔customer contact (`email_deliveries` records only automated protocol sends). New storage required.                                                                                                                                                                                                                                                                                                           | **NONE** for v1 — recommend Contact = plain `tel:` link, no logging |

## Narrowing Signals

- User: extend-rent is **in** scope; it recomputes the total; **no** penalty (→ v2).
- User: fold into Zwroty + nav badge (not a dedicated page).
- User: penalties stay **flag-only** — the two money columns drop out.
- Investigation: FR-012's "flag overdue" is already met; the visibility work is small.
- Investigation: extend-rent is the only heavy, integrity-bearing, net-new part.

## Cross-System Convention

Every reservation mutation already flows through a role-gated `SECURITY DEFINER`
RPC that locks the row (`select … for update`), relies on the EXCLUDE constraint
for conflict safety (catch `23P01`, never check-then-write), and — for
`decide_reservation` — sends a customer email. An `extend_reservation` RPC should
mirror that exact hygiene. Nav count badges follow the `pendingCount`-on-Wnioski
pattern. Pricing display reuses `estimatedTotal`. The leading reframe matches
convention on every axis.

## Reframed (or Confirmed) Problem Statement

> **The actual problem to plan around is two separable things, not one "overdue
> dashboard": (1) a small, in-scope _visibility polish_ that closes FR-012's
> dashboard packaging (overdue is already flagged — it just isn't navigable or
> filterable), and (2) a brand-new _extend-rental write capability_ that is the
> real feature, was never in FR-012/S-07's charter, and carries a new RPC,
> EXCLUDE-conflict handling, an "in-progress" invariant, and a confirmation email.**

The original framing ("build an overdue dashboard") is misleading because the
detection/flagging it implies is already done by S-06's Zwroty worklist. Left
un-reframed, a plan would spend effort re-proving flagging and smuggle a mutation
path in under a read-only "dashboard" label — hiding the one part that needs real
integrity and review attention. Penalty columns are correctly dropped (Non-Goal →
v2); Contact is a `tel:` link, not a tracking feature.

## Confidence

**HIGH** on the reframe: FR-012 is already functionally met (STRONG, file:line),
extend-rental is the genuine net-new scope (STRONG), penalty is an explicit
Non-Goal the user chose to defer. **MEDIUM-HIGH** on the extend feature's internal
shape — pricing is de-risked (existing helper, display-only), the residual
plan-time questions are whether extend emails the customer (likely, mirroring
`decide_reservation`) and the exact "extendable" gate, neither a blocker.

## What Changes for /10x-plan

Plan **two slices**, not one — recommended even if built back-to-back:

- **S-07 (this change) — overdue visibility, flag-only:** nav badge on "Zwroty"
  (reuse `pendingCount` pattern), clickable stat-card filters in `ReturnQueue`, a
  days-overdue (`OPÓŹNIENIE`) label. No new tables, no writes, respects the
  Non-Goal. Closes FR-012's packaging gap.
- **New slice (e.g. S-09) — extend-rental:** `extend_reservation` RPC (role-gated,
  `for update`, catch `23P01` → typed `conflict` = the "if possible"), gate on
  in-progress (issue protocol exists, no return yet), recompute total via
  `estimatedTotal`, confirmation email, no penalty (v2). Needs a new FR + PRD/roadmap
  update since it's a scope addition beyond FR-012.

If the user prefers one combined plan, keep the extend capability a clearly
separate phase with its own verification — do not let it ride the read-only work.

## References

- Source: `src/pages/dashboard/returns.astro`, `src/components/dashboard/ReturnQueue.tsx:43-166`,
  `src/components/shell/StaffShell.astro:13,32-39,76-85`,
  `supabase/migrations/20260716120000_return_protocol.sql:314-387`,
  `supabase/migrations/20260603155136_booking_integrity_data.sql:23-129`,
  `supabase/migrations/20260617120000_reservation_approval.sql:60-168`,
  `src/lib/services/reservations.ts`, `src/lib/format.ts:60-71`.
- Scope refs: `prd.md:112,129,137,161`; `roadmap.md:77,199,251`; `lessons.md` (none on late-fee/contact).
- Investigations: 3 parallel Explore agents (current coverage · extend feasibility · penalty/contact data).
