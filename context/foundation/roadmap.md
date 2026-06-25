---
project: FleetRent
version: 1
status: draft
created: 2026-06-02
updated: 2026-06-25
prd_version: 1
main_goal: speed
top_blocker: capacity
---

# Roadmap: FleetRent

> Derived from `context/foundation/prd.md` (v1) + auto-researched codebase baseline.
> Edit-in-place; archive when superseded.
> Slices below are listed in dependency order. The "At a glance" table is the index.

## Vision recap

Local commercial-vehicle rental operators run their fleet, reservations, and handover protocols on phone, email, and paper — which produces double bookings and traps mileage/fuel/damage data where it can't be searched or compared. FleetRent replaces that paper-and-phone coordination with a single system: a public reservation funnel that blocks conflicts at the source, and digital issue/return handover protocols (photos, signature, automatic comparison) for employees and admins. v1 is single-tenant, Polish-only, with no online payments and no customer accounts — customers interact through the public site and receive protocols by email.

## North star

**S-02 public-reservation-request: a customer browses the fleet, picks a vehicle and dates, and submits a reservation request without an account — and the system blocks overlapping dates before submission.**

> "North star" here means the smallest end-to-end slice whose successful delivery would prove the core product hypothesis — that frictionless, conflict-free public booking is something a real operator will adopt. It's placed as early as its prerequisites (a fleet to browse + the booking-integrity data layer) allow, because every employee-side capability only matters once reservations exist. Tied to the #1 primary Success Criterion ("reserve in under 3 minutes, without creating an account") and the core guardrail (no double bookings).

## At a glance

| ID    | Change ID                    | Outcome (user can …)                                                        | Prerequisites | PRD refs                | Status   |
| ----- | ---------------------------- | --------------------------------------------------------------------------- | ------------- | ----------------------- | -------- |
| F-01  | booking-integrity-data       | (foundation) vehicle + reservation schema and the hotel-style overlap rule  | —             | FR-005, Guardrails      | done     |
| F-02  | employee-admin-roles         | (foundation) employee/admin role model on the existing auth, route-gated    | —             | Access Control          | done     |
| S-01  | public-fleet-catalog         | browse, filter by specs/dates, and view a vehicle detail card               | F-01          | US-01, FR-001/002/003   | done     |
| S-02  | public-reservation-request   | submit a reservation request with no account; overlaps blocked on submit    | F-01, S-01    | US-01, FR-004/005       | done     |
| S-03  | reservation-approval         | view pending requests and accept or reject them                             | F-02, S-02    | US-01, FR-009/010       | proposed |
| S-04  | fleet-management             | add, edit, and remove vehicles (deletion blocked with active reservations)  | F-01, F-02    | FR-011                  | proposed |
| S-05  | issue-protocol               | fill an issue protocol (mileage/fuel/damage/photos/signature), auto-emailed | F-02, S-03    | US-02, FR-006/008, NFR  | proposed |
| S-06  | return-protocol-comparison   | fill a return protocol; system auto-compares deltas; auto-emailed           | S-05          | US-02, FR-007/008, NFR  | proposed |
| S-07  | overdue-returns-dashboard    | see overdue returns flagged automatically on the dashboard                  | F-02, S-02    | FR-012                  | proposed |
| S-08  | employee-account-management  | (admin) add/remove employee accounts; employees self-reset password         | F-02          | FR-013                  | proposed |

## Streams

Navigation aid — groups items that share a Prerequisites chain. Canonical ordering still lives in the dependency graph below; this table is the proposed reading order across parallel tracks.

| Stream | Theme                       | Chain                                | Note                                                                                          |
| ------ | --------------------------- | ------------------------------------ | --------------------------------------------------------------------------------------------- |
| A      | Public booking funnel       | `F-01` → `S-01` → `S-02`             | The must-have path to a first deploy (main_goal `speed`); `S-02` is the north star.           |
| B      | Employee handover lifecycle | `F-02` → `S-03` → `S-05` → `S-06`    | `S-03` needs `S-02` (a reservation) from Stream A before there's anything to approve.          |
| C      | Fleet & account admin       | `S-04` / `S-08`                      | Both branch off `F-02`; independent admin/CRUD work — parallelize to spend the capacity lever. |
| D      | Operations visibility       | `S-07`                               | Overdue dashboard; joins Stream A at `S-02` and needs `F-02`. Read-only, run it anytime after. |

## Baseline

What's already in place in the codebase as of `2026-06-02` (auto-researched + user-confirmed).
Foundations below assume these are present and do NOT re-scaffold them.

- **Frontend:** present — Astro 6 + React 19 + Tailwind 4 with shadcn/ui scaffold in `src/components/ui/` (per `tech-stack.md`). shadcn primitives are Tailwind-based and editable; custom design layouts compose on top at `/10x-plan` time.
- **Backend / API:** partial — Astro API-route pattern is established but only auth routes exist (`src/pages/api/auth/*`); no domain endpoints, no `src/lib/services/`.
- **Data:** absent — Supabase client wired (`src/lib/supabase.ts`) but zero schema: no `supabase/migrations/`, no domain tables, no domain types in `src/types.ts`, no seed.
- **Auth:** partial — Supabase email/password auth fully wired (`signin`/`signup`/`signout` routes + `src/middleware.ts` with `PROTECTED_ROUTES`), but **no role model** (employee vs admin).
- **Deploy / infra:** partial — Cloudflare adapter + `wrangler.jsonc` + CI (`.github/workflows/ci.yml` runs lint + build); deploy-on-merge not wired (manual `wrangler deploy`).
- **Observability:** partial — Cloudflare `observability.enabled` flag is on; no app-level logging/error-tracking/metrics instrumentation.

> Domain-critical absences folded into the slices that need them (progressive disclosure, not separate foundations): **transactional email** (absent — set up in `S-05`, used by `S-05`/`S-06` for FR-008) and **file/object storage for photos** (absent — set up in `S-05`, reused by `S-06` for FR-006/007).

## Foundations

### F-01: Booking-integrity data layer

- **Outcome:** (foundation) the vehicle and reservation data model exists with RLS, the hotel-style availability/overlap rule (return by 10:00, pickup from 14:00; same-day turnover allowed) is implemented and unit-verifiable, and a minimal seed lets the public catalog render. Not user-visible on its own.
- **Change ID:** booking-integrity-data
- **PRD refs:** FR-005, Guardrails (no double bookings — "the core data integrity guarantee"), Business Logic (Availability enforcement)
- **Unlocks:** S-01 (catalog has vehicles to show), S-02 (north star — overlap rule blocks conflicts), S-04 (real fleet CRUD replaces the seed), S-07 (overdue is computed from reservation dates)
- **Prerequisites:** —
- **Parallel with:** F-02
- **Blockers:** —
- **Unknowns:** —
- **Risk:** Sequenced first because the no-double-booking guarantee is the load-bearing integrity rule and the data model is absent — getting the schema + overlap check right here prevents rework across every booking slice. The same-day buffer is subtle: an off-by-one in the overlap window either loses same-day revenue or admits a conflict. Scope is capped to vehicles + reservations + the rule; protocol and employee-role schema are added later (S-05/S-06, F-02), not here.
- **Status:** done

### F-02: Employee/admin role model

- **Outcome:** (foundation) an employee/admin role is attached to the existing Supabase auth and enforced at the route/middleware level, so authed slices can gate behavior by role without each re-implementing access checks. No user-facing feature.
- **Change ID:** employee-admin-roles
- **PRD refs:** Access Control (two authenticated roles: employee, admin), Guardrails (customer personal data not accessible to unauthorized users)
- **Unlocks:** S-03 (employee approval), S-04 (employee fleet management), S-05/S-06 (employee protocols), S-07 (employee dashboard), S-08 (admin employee management)
- **Prerequisites:** —
- **Parallel with:** F-01, S-01, S-02
- **Blockers:** —
- **Unknowns:** —
- **Risk:** Auth is already wired (baseline: partial) but role-less — this adds only the role layer, it does NOT re-scaffold auth. Sequenced early because every employee/admin slice gates on it. Under-scoping the role gate would leak customer personal data (the second guardrail), so the access boundary is the thing to get right; the feature surface stays with the consuming slices.
- **Status:** done

## Slices

### S-01: Public fleet catalog

- **Outcome:** A visitor can browse vehicles by category, filter by specs and available dates, and open a vehicle detail card with technical specs, cargo dimensions, photos, and pricing.
- **Change ID:** public-fleet-catalog
- **PRD refs:** US-01, FR-001, FR-002, FR-003
- **Prerequisites:** F-01
- **Parallel with:** F-02, S-04, S-08
- **Blockers:** —
- **Unknowns:**
  - Date-availability filtering must read the same overlap rule the server enforces — agreement is a design point, not a blocker. Owner: TBD. Block: no.
- **Risk:** First public surface and low-risk, but it can only render once F-01's seed exists. Keep category handling graceful for a small fleet (PRD note on FR-001).
- **Status:** done

### S-02: Public reservation request (north star)

- **Outcome:** A visitor can submit a reservation request (name, email, phone, vehicle, dates) without an account, and overlapping dates on an already-booked vehicle are blocked before submission; the request lands for employee approval.
- **Change ID:** public-reservation-request
- **PRD refs:** US-01, FR-004, FR-005
- **Prerequisites:** F-01, S-01
- **Parallel with:** F-02, S-04, S-08
- **Blockers:** —
- **Unknowns:** —
- **Risk:** This is the validation milestone — the overlap block must fire before submission, not as a post-hoc rejection, per the success criterion. The client-side date picker must agree with the server-side overlap rule or customers see phantom availability and a confusing late rejection.
- **Status:** done

### S-02a: Changeover-day half-availability (calendar refinement)

- **Outcome:** On the per-vehicle booking calendar, a booked range's **changeover days** are shown half-available instead of fully greyed — the booking's pickup day stays selectable as a new **return**, and its return day stays selectable as a new **pickup** — so back-to-back rentals (return 10:00, next pickup 14:00) can be booked from the UI, matching what the half-open `EXCLUDE` window already permits.
- **Change ID:** changeover-day-availability
- **PRD refs:** FR-014 (refinement; advances the parked nice-to-have)
- **Prerequisites:** S-02
- **Parallel with:** S-03, S-04, S-07, S-08
- **Blockers:** —
- **Unknowns:**
  - Half-cell affordance + a11y: react-day-picker can't natively mark a day "valid only as range end," so selection rules ride a custom `onSelect` veto + custom modifiers; the half-grey cell needs a legend and keyboard/SR semantics. Owner: user. Block: no.
- **Risk:** Refinement of S-02 Phase 6 (which shipped per-vehicle greying, conservatively inclusive of both changeover days). The model is correct but interaction-heavy and ships without a UI test runner — mitigate by extracting the per-day half-state computation (`busyRanges → dayStates`) as a pure, Vitest-tested helper; that's where the edge cases live (adjacent bookings sharing a day, single-day gaps). Win: the calendar then matches `available_vehicles` + the `EXCLUDE` constraint exactly, closing the calendar↔catalog asymmetry noted in the S-02 Phase-6 review.
- **Status:** proposed

### S-03: Reservation approval

- **Outcome:** A logged-in employee can view all pending reservation requests and accept or reject each one; accepting confirms the booking against the overlap rule.
- **Change ID:** reservation-approval
- **PRD refs:** US-01, FR-009, FR-010
- **Prerequisites:** F-02, S-02
- **Parallel with:** S-04, S-07, S-08
- **Blockers:** —
- **Unknowns:** —
- **Risk:** Turns a request into a confirmed booking. Sequenced after S-02 because there's nothing to approve until requests exist; the accept action is where the confirmed-reservation state that downstream protocols depend on is created.
- **Status:** proposed

### S-04: Fleet management

- **Outcome:** A logged-in employee can add and edit vehicles in the fleet, and remove a vehicle — with removal blocked when active reservations exist (employee must cancel them first).
- **Change ID:** fleet-management
- **PRD refs:** FR-011
- **Prerequisites:** F-01, F-02
- **Parallel with:** S-01, S-02, S-03, S-07, S-08
- **Blockers:** —
- **Unknowns:** —
- **Risk:** Replaces F-01's seed with real CRUD; the deletion guard protects integrity (no orphaned active reservations). Fully independent of the booking and protocol chains — a prime candidate to interleave given the solo capacity constraint.
- **Status:** proposed

### S-05: Issue protocol

- **Outcome:** A logged-in employee can fill an issue protocol at pickup — mileage, fuel level, damage notes, photos, and a digital signature — on a phone or tablet, and the completed protocol is auto-emailed to the customer.
- **Change ID:** issue-protocol
- **PRD refs:** US-02, FR-006, FR-008, NFR (mobile-usable protocol forms)
- **Prerequisites:** F-02, S-03
- **Parallel with:** S-04, S-07, S-08
- **Blockers:** —
- **Unknowns:**
  - Transactional email provider + verified sender domain not yet chosen (email is absent in baseline). Owner: user. Block: no.
- **Risk:** The heaviest slice — it stands up file storage (photos) and transactional email for the first time, and carries the main field-usability risk: on-device photo capture and touch signature must work at the vehicle (NFR). Sequenced after an accepted reservation exists (S-03) so a real protocol has something to attach to.
- **Status:** proposed

### S-06: Return protocol with comparison

- **Outcome:** A logged-in employee can fill a return protocol — the issue baseline shown as reference, all current values entered fresh — and the system auto-computes and displays deltas (km driven, fuel change, new damage); the protocol is auto-emailed to the customer.
- **Change ID:** return-protocol-comparison
- **PRD refs:** US-02, FR-007, FR-008, NFR (mobile-usable protocol forms)
- **Prerequisites:** S-05
- **Parallel with:** S-07, S-08
- **Blockers:** —
- **Unknowns:** —
- **Risk:** The delta computation is the differentiating value over paper protocols. Sequenced immediately after S-05 because it reuses the same storage and email setup and consumes the issue baseline; building it before S-05 would mean nothing to compare against.
- **Status:** proposed

### S-07: Overdue returns dashboard

- **Outcome:** A logged-in employee sees vehicles past their expected return date flagged automatically on their dashboard.
- **Change ID:** overdue-returns-dashboard
- **PRD refs:** FR-012
- **Prerequisites:** F-02, S-02
- **Parallel with:** S-03, S-04, S-05, S-08
- **Blockers:** —
- **Unknowns:** —
- **Risk:** Read-only over reservation data (flag only — no late-fee calculation in v1), so low-risk and highly parallelizable. Sequenced after reservations exist (S-02); does not depend on the protocol chain.
- **Status:** proposed

### S-08: Employee account management

- **Outcome:** An admin can add and remove employee accounts; employees can self-service reset their own password via email.
- **Change ID:** employee-account-management
- **PRD refs:** FR-013
- **Prerequisites:** F-02
- **Parallel with:** S-01, S-02, S-03, S-04, S-05, S-06, S-07
- **Blockers:** —
- **Unknowns:** —
- **Risk:** Admin-only and fully independent once roles exist — the most freely schedulable slice, which is why it's parked toward the end of the must-have path under the speed goal but can be picked up anytime after F-02 to fill capacity gaps.
- **Status:** proposed

## Backlog Handoff

| Roadmap ID | Change ID                    | Suggested issue title                                      | Ready for `/10x-plan` | Notes |
| ---------- | ---------------------------- | --------------------------------------------------------- | --------------------- | ----- |
| F-01       | booking-integrity-data       | Vehicle/reservation data model + hotel-style overlap rule | yes                   | Run `/10x-plan booking-integrity-data` |
| F-02       | employee-admin-roles         | Employee/admin role model on existing auth                | yes                   | Parallel with F-01 |
| S-01       | public-fleet-catalog         | Public fleet catalog: browse, filter, detail card         | no                    | Needs F-01 |
| S-02       | public-reservation-request   | Public reservation request with no double-booking         | no                    | North star; needs F-01, S-01 |
| S-02a      | changeover-day-availability   | Half-available changeover days on the booking calendar    | no                    | Needs S-02; refines FR-014; run `/10x-new changeover-day-availability` |
| S-03       | reservation-approval         | Employee accept/reject pending reservations               | no                    | Needs F-02, S-02 |
| S-04       | fleet-management             | Fleet CRUD with deletion guard                            | no                    | Needs F-01, F-02; parallelizable |
| S-05       | issue-protocol               | Issue handover protocol + photos/signature + email        | no                    | Needs F-02, S-03; sets up storage + email |
| S-06       | return-protocol-comparison   | Return protocol with auto-comparison + email              | no                    | Needs S-05 |
| S-07       | overdue-returns-dashboard    | Overdue returns flag on employee dashboard                | no                    | Needs F-02, S-02; parallelizable |
| S-08       | employee-account-management  | Admin employee accounts + self-service password reset     | no                    | Needs F-02; parallelizable |

## Open Roadmap Questions

1. **Which transactional email provider and sender domain for protocol delivery (FR-008)?** Email is absent in the baseline and is shared by S-05 and S-06. Owner: user. Block: S-05, S-06 — not roadmap-wide, and not blocking until those slices are planned (a default in-stack option exists; this is a pick at plan time, not a research blocker).

(PRD `## Open Questions` were all resolved — none carried forward.)

## Parked

- **FR-014: real-time availability shown to visitors while picking dates (nice-to-have).** Why parked: explicitly nice-to-have, and main_goal `speed` parks non-essentials; the core guarantee (no double bookings) is still enforced at submission via FR-005, so this is an enhancement to defer. **Update:** S-02 Phase 6 advanced this — the per-vehicle booking calendar now greys booked dates. The remaining half-day changeover refinement is promoted to slice **S-02a** (no longer parked).
- **No online payment processing.** Why parked: PRD §Non-Goals — payment at pickup; keeps financial complexity out of v1.
- **No customer accounts or portal.** Why parked: PRD §Non-Goals — customers interact via the public site and receive protocols by email; deferred to v2.
- **No notifications beyond protocol delivery.** Why parked: PRD §Non-Goals — only the auto-emailed protocol after issue/return.
- **No multi-language support (Polish only).** Why parked: PRD §Non-Goals — English deferred.
- **No revenue reporting or statistics.** Why parked: PRD §Non-Goals — no income/utilization/performance dashboards.
- **No native mobile app (responsive web only).** Why parked: PRD §Non-Goals — employees use phone/tablet browsers.
- **No accounting / ERP integration.** Why parked: PRD §Non-Goals.
- **No customer reviews or ratings.** Why parked: PRD §Non-Goals.
- **No vehicle maintenance or service management.** Why parked: PRD §Non-Goals.
- **No multi-tenancy (single-company deployment).** Why parked: PRD §Non-Goals — not a SaaS platform.
- **No automatic late-fee calculation.** Why parked: PRD §Non-Goals — overdue is flagged; employee handles charges manually.
- **Audit trail for fleet changes.** Why parked: PRD §Open Questions (resolved) — deferred to v2; deletion guard reduces the risk.

## Done

- **F-01: (foundation) the vehicle and reservation data model exists with RLS, the hotel-style availability/overlap rule (return by 10:00, pickup from 14:00; same-day turnover allowed) is implemented and unit-verifiable, and a minimal seed lets the public catalog render. Not user-visible on its own.** — Archived 2026-06-07 → `context/archive/2026-06-03-booking-integrity-data/`. Lesson: —.
- **F-02: (foundation) an employee/admin role is attached to the existing Supabase auth and enforced at the route/middleware level, so authed slices can gate behavior by role without each re-implementing access checks. No user-facing feature.** — Archived 2026-06-07 → `context/archive/2026-06-04-employee-admin-roles/`. Lesson: —.
- **S-01: A visitor can browse vehicles by category, filter by specs and available dates, and open a vehicle detail card with technical specs, cargo dimensions, photos, and pricing.** — Archived 2026-06-25 → `context/archive/2026-06-05-public-fleet-catalog/`. Lesson: —.
- **S-02: A visitor can submit a reservation request (name, email, phone, vehicle, dates) without an account, and overlapping dates on an already-booked vehicle are blocked before submission; the request lands for employee approval.** — Archived 2026-06-25 → `context/archive/2026-06-07-public-reservation-request/`. Lesson: —.
