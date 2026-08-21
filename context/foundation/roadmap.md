---
project: FleetRent
version: 1
status: draft
created: 2026-06-02
updated: 2026-08-21
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

| ID   | Change ID                   | Outcome (user can …)                                                                                                                       | Prerequisites    | PRD refs                             | Status  |
| ---- | --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ | ---------------- | ------------------------------------ | ------- |
| F-01 | booking-integrity-data      | (foundation) vehicle + reservation schema and the hotel-style overlap rule                                                                 | —                | FR-005, Guardrails                   | done    |
| F-02 | employee-admin-roles        | (foundation) employee/admin role model on the existing auth, route-gated                                                                   | —                | Access Control                       | done    |
| S-01 | public-fleet-catalog        | browse, filter by specs/dates, and view a vehicle detail card                                                                              | F-01             | US-01, FR-001/002/003                | done    |
| S-02 | public-reservation-request  | submit a reservation request with no account; overlaps blocked on submit                                                                   | F-01, S-01       | US-01, FR-004/005                    | done    |
| S-03 | reservation-approval        | view pending requests and accept or reject them                                                                                            | F-02, S-02       | US-01, FR-009/010                    | done    |
| S-04 | fleet-management            | add, edit, and remove vehicles (deletion blocked with active reservations)                                                                 | F-01, F-02       | FR-011                               | done    |
| S-05 | issue-protocol              | fill an issue protocol (mileage/fuel/damage/photos/signature), auto-emailed                                                                | F-02, S-03       | US-02, FR-006/008, NFR               | done    |
| S-06 | return-protocol-comparison  | fill a return protocol; system auto-compares deltas; auto-emailed                                                                          | S-05             | US-02, FR-007/008, NFR               | done    |
| S-07 | overdue-returns-dashboard   | see overdue returns flagged automatically on the dashboard                                                                                 | F-02, S-02       | FR-012                               | done    |
| S-08 | employee-account-management | (admin) add/remove employee accounts; employees self-reset password                                                                        | F-02             | FR-013                               | done    |
| S-09 | public-info-pages           | read About-us & FAQ, and a live (dynamic) pricing page from the public site                                                                | F-01, S-01       | FR-003 reuse; post-v1                | done    |
| S-10 | landing-fleet-restyle       | browse a restyled, responsive landing + fleet; hover/tap a vehicle type to preview its Popularne models and open that pre-filtered catalog | S-01             | FR-001/002/003 reuse; US-01; post-v1 | backlog |
| S-11 | staff-account               | (employee) view your own profile and change your own password while signed in                                                              | F-02             | net-new; extends F-02                | backlog |
| S-12 | manual-reservation          | (staff) create a confirmed booking by hand for a phone-in customer; overlap-checked, customer emailed                                      | F-02, S-02, S-03 | FR-004/005/009 reuse                 | done    |
| S-13 | staff-global-search         | (staff) search reservations / returns / vehicles / customers from a header ⌘K box                                                          | F-02, S-02, S-04 | net-new                              | backlog |

## Streams

Navigation aid — groups items that share a Prerequisites chain. Canonical ordering still lives in the dependency graph below; this table is the proposed reading order across parallel tracks.

| Stream | Theme                       | Chain                             | Note                                                                                                                                                                                                                                                                                                                                                                                                               |
| ------ | --------------------------- | --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| A      | Public booking funnel       | `F-01` → `S-01` → `S-02`          | The must-have path to a first deploy (main_goal `speed`); `S-02` is the north star.                                                                                                                                                                                                                                                                                                                                |
| B      | Employee handover lifecycle | `F-02` → `S-03` → `S-05` → `S-06` | `S-03` needs `S-02` (a reservation) from Stream A before there's anything to approve.                                                                                                                                                                                                                                                                                                                              |
| C      | Fleet & account admin       | `S-04` / `S-08`                   | Both branch off `F-02`; independent admin/CRUD work — parallelize to spend the capacity lever.                                                                                                                                                                                                                                                                                                                     |
| D      | Operations visibility       | `S-07`                            | Overdue dashboard; joins Stream A at `S-02` and needs `F-02`. Read-only, run it anytime after.                                                                                                                                                                                                                                                                                                                     |
| E      | Public content pages        | `S-09`                            | Informational pages over the existing public shell; About/FAQ static, Cennik reads live pricing (F-01, read-only). No auth. Independent — schedule anytime.                                                                                                                                                                                                                                                        |
| F      | Public UI polish            | `S-10`                            | Restyle + responsiveness for the landing & fleet pages, plus the landing type-explorer→Popularne interaction. Chains off `S-01` (needs the `/fleet?category=` deep-link + `listVehicles`); builds on the shipped `landing-redesign` hero. Standalone — schedule anytime.                                                                                                                                           |
| G      | Staff console               | `S-11` / `S-12` / `S-13`          | Three staff-facing features, all branching off `F-02` (every prereq done). Parallel with light coordination on the one shared surface — the `StaffShell` nav registry. **Sequence `S-13` (global search) last**: it's the invasive shell change (adds a persistent header search where none exists today), so `S-11`/`S-12` land rebase-free first. Framing cohort: `context/changes/staff-ops-features/frame.md`. |

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
>
> **Update 2026-07-09** (from `/10x-research issue-protocol`): both absences are smaller than they look. A provider-agnostic email seam already exists (`src/lib/email/index.ts` — `EmailAdapter` + `devLogAdapter`, with an explicit S-05 TODO to select a real adapter), so S-05 adds an adapter, not a subsystem. Supabase Storage is enabled in `supabase/config.toml` but **defines no buckets** — S-05 creates the first one. Also corrected: the **test runner is configured** (Vitest, two projects, 17 test files) despite `CLAUDE.md` claiming otherwise, and CI targets `main`, not `master`.

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
- **Status:** done

### S-03: Reservation approval

- **Outcome:** A logged-in employee can view all pending reservation requests and accept or reject each one; accepting confirms the booking against the overlap rule.
- **Change ID:** reservation-approval
- **PRD refs:** US-01, FR-009, FR-010
- **Prerequisites:** F-02, S-02
- **Parallel with:** S-04, S-07, S-08
- **Blockers:** —
- **Unknowns:** —
- **Risk:** Turns a request into a confirmed booking. Sequenced after S-02 because there's nothing to approve until requests exist; the accept action is where the confirmed-reservation state that downstream protocols depend on is created.
- **Status:** done

### S-04: Fleet management

- **Outcome:** A logged-in employee can add and edit vehicles in the fleet, and remove a vehicle — with removal blocked when active reservations exist (employee must cancel them first).
- **Change ID:** fleet-management
- **PRD refs:** FR-011
- **Prerequisites:** F-01, F-02
- **Parallel with:** S-01, S-02, S-03, S-07, S-08
- **Blockers:** —
- **Unknowns:** —
- **Risk:** Replaces F-01's seed with real CRUD; the deletion guard protects integrity (no orphaned active reservations). Fully independent of the booking and protocol chains — a prime candidate to interleave given the solo capacity constraint.
- **Status:** done

### S-05: Issue protocol

- **Outcome:** A logged-in employee can fill an issue protocol at pickup — mileage, fuel level, damage notes, photos, and a digital signature — on a phone or tablet, and the completed protocol is auto-emailed to the customer.
- **Change ID:** issue-protocol
- **PRD refs:** US-02, FR-006, FR-008, NFR (mobile-usable protocol forms)
- **Prerequisites:** F-02, S-03
- **Parallel with:** S-04, S-07, S-08
- **Blockers:** verified sender domain (see Unknowns).
- **Unknowns:**
  - ~~Transactional email provider not yet chosen.~~ **Resolved 2026-07-09 → Resend** (raw `fetch`, no SDK; SMTP is impossible on `workerd`). Brevo documented as a one-file swap if EU data residency becomes a hard requirement. See `context/changes/issue-protocol/research.md`.
  - **Verified sender domain still required.** A Polish business domain with SPF + DKIM (2 records, DMARC optional) must be owned and verified before real mail sends. Owner: user. **Block: yes** — revised 2026-07-09 (user's call, superseding the earlier `Block: no`). The `devLogAdapter` fallback keeps the code path compiling, but a slice whose only exercised path is `console.log` has not proven the thing it exists to do. Definition of done = one real protocol emailed to a real inbox, with `ą ć ę ł ń ó ś ź ż` rendering correctly in the PDF.
- **Risk:** Stands up file storage (photos) and transactional email for the first time, and carries the main field-usability risk: on-device photo capture and touch signature must work at the vehicle (NFR). Sequenced after an accepted reservation exists (S-03) so a real protocol has something to attach to.
  **Research 2026-07-09 materially reduced the estimate**: the email work is a ~15-line adapter into a seam that already exists (`src/lib/email/index.ts:37-39`), and `infrastructure.md`'s 3 MB bundle risk is measured false (Worker uploads at `gzip: 554.76 KiB`; client islands are separate static assets). Two risks _grew_: a new `protocols` table carries customer PII + damage photos and must close its default grants from the start (the `reservations` leak), and **pdf-lib throws on 8 of 9 Polish diacritics** unless fontkit + an embedded TTF are wired.
  Scope grew deliberately in two places: an `email_deliveries` table (a failed protocol email is currently invisible — `console.error` only — and email is the customer's _only_ channel), and a client-generated PDF attachment replacing signed URLs (durability for dispute evidence; deletes the bearer-link risk).
- **Status:** done

### S-06: Return protocol with comparison

- **Outcome:** A logged-in employee can fill a return protocol — the issue baseline shown as reference, all current values entered fresh — and the system auto-computes and displays deltas (km driven, fuel change, new damage); the protocol is auto-emailed to the customer.
- **Change ID:** return-protocol-comparison
- **PRD refs:** US-02, FR-007, FR-008, NFR (mobile-usable protocol forms)
- **Prerequisites:** S-05
- **Parallel with:** S-07, S-08
- **Blockers:** —
- **Unknowns:** —
- **Risk:** The delta computation is the differentiating value over paper protocols. Sequenced immediately after S-05 because it reuses the same storage and email setup and consumes the issue baseline; building it before S-05 would mean nothing to compare against.
- **Status:** done

### S-07: Overdue returns dashboard

- **Outcome:** A logged-in employee sees vehicles past their expected return date flagged automatically on their dashboard.
- **Change ID:** overdue-returns-dashboard
- **PRD refs:** FR-012
- **Prerequisites:** F-02, S-02
- **Parallel with:** S-03, S-04, S-05, S-08
- **Blockers:** —
- **Unknowns:** —
- **Risk:** Read-only over reservation data (flag only — no late-fee calculation in v1), so low-risk and highly parallelizable. Sequenced after reservations exist (S-02); does not depend on the protocol chain.
- **Status:** done

### S-08: Employee account management

- **Outcome:** An admin can add and remove employee accounts; employees can self-service reset their own password via email.
- **Change ID:** employee-account-management
- **PRD refs:** FR-013
- **Prerequisites:** F-02
- **Parallel with:** S-01, S-02, S-03, S-04, S-05, S-06, S-07
- **Blockers:** —
- **Unknowns:** —
- **Risk:** Admin-only and fully independent once roles exist — the most freely schedulable slice, which is why it's parked toward the end of the must-have path under the speed goal but can be picked up anytime after F-02 to fill capacity gaps.
- **Status:** done

### S-09: Public informational pages (About / FAQ / Pricing)

- **Outcome:** A visitor can open three public content pages from the site nav — **O nas** (`/about`), **FAQ** (`/faq`), and **Cennik** (`/pricing`) — each rendered in the existing public shell (`Layout` + `SiteHeader` + `SiteFooter`) over the live tokens/fonts. O nas and FAQ are static content; **Cennik renders prices dynamically from the fleet data** (a live pricing table/grid per the user-supplied mockup) so the rates shown never drift from the catalog. `SiteHeader` and `SiteFooter` nav gain links to the three pages.
- **Change ID:** public-info-pages
- **PRD refs:** — (net-new; not in PRD v1). Cennik reuses **FR-003** pricing data (daily/monthly rate, deposit, km limit, per-extra-km); supports the public funnel (US-01) and the ≤2 s page-load NFR; adds no new FR.
- **Prerequisites:** **F-01** (vehicle/pricing data, done) for the live Cennik prices; **S-01** (`/fleet`, done) for cross-links. The public shell already exists — no scaffolding.
- **Parallel with:** — (every prior slice is done; fully standalone)
- **Blockers:** the user provides **mockups for all three pages at the start of `/10x-plan`**; O nas / FAQ copy must be supplied before launch (see Unknowns — soft; placeholders unblock the build).
- **Unknowns:**
  - **Cennik pricing model.** Resolved → **dynamic** (pull from fleet data; static-terms option dropped). Open at plan time: the exact shape from the mockup (per-vehicle table? per-category tiers? plan cards?) and how it maps onto our stored rate fields (daily/monthly rate, deposit, km limit, per-extra-km). The mockup's pricing model must be **reconciled with our business logic** — if it shows something we don't store (weekly tiers, package deals, promo prices), that's a data-model gap to flag, not silently invent. Needs a read path (a pricing service over `listVehicles`, or a Supabase view/RPC). Owner: user. Block: no — resolve at `/10x-plan`.
  - **Content source (O nas / FAQ).** Copy likely arrives with the mockups; if they're layout-only, the real Polish copy (About narrative, FAQ Q&A set) is a content task that gates launch, not the build. Owner: user. Block: soft.
  - **Routes/labels.** Defaulted to English slugs + Polish labels (matching `/fleet` = "Flota"): `/about` = O nas, `/faq` = FAQ, `/pricing` = Cennik. Block: no.
  - **FAQ accordion.** No `Accordion` primitive exists in `src/components/ui/` yet — the FAQ either adds one (`npx shadcn@latest add accordion`, then rewrite `@/` imports per CLAUDE.md) or uses native `<details>/<summary>`. Design call against the mockup at plan time. Block: no.
- **Risk:** Still among the lowest-risk items — mostly static Astro over the existing shell. Two things lift it above pure-static: (1) **Cennik has a live read path** into pricing, so its numbers must match the catalog exactly — reuse the vehicle pricing already surfaced on `/fleet` as the single source rather than re-deriving, and reconcile the mockup's pricing model with our stored rate fields (a mismatch is a data-model decision, not styling); (2) the design comes from **user-supplied mockups delivered at the start of `/10x-plan`** (these three screens are absent from the Claude Design project / `design-system.md` catalog), so the Design Alignment Audit runs against those mockups — porting exact values per `context/foundation/lessons.md` and checking each against our business logic and tokens before build, flagging any deviation.
- **Status:** done

### S-10: Landing & fleet restyle + type-explorer → Popularne

- **Outcome:** The public **landing** (`/`) and **fleet** (`/fleet`) pages are restyled and made fully responsive (mobile / tablet / desktop) against the Claude Design mockups, and the landing's **"Wybierz typ pojazdu"** section becomes an interactive **type explorer**. On desktop, **hovering** a vehicle-type pill previews that type's models in the **Popularne** strip below — swapping the three cards, the type badge (_Furgony → Busy osobowe → …_), and the "Wszystkie" link target; on mobile there is no hover, so **tapping** a pill selects it. From the section a visitor reaches the catalog two ways: **Cała flota** (by the section heading) opens the **full** catalog (`/fleet`), and **Wszystkie** (by the Popularne strip) opens the catalog **pre-filtered to the active type** (`/fleet?category=<type>`). On desktop, **clicking** a type pill itself also opens that pre-filtered category screen (hover previews, click navigates).
- **Change ID:** landing-fleet-restyle
- **PRD refs:** — (net-new UI polish; reuses **FR-001 / FR-002 / FR-003** browse/filter data and the **US-01** funnel; adds no new FR)
- **Prerequisites:** **S-01** (fleet catalog — `listVehicles` / `getCategoryCounts` and the `/fleet?category=` deep-link the pre-filter buttons target, done) and the shipped **`landing-redesign`** (the hero / `ProcessSteps` / `TrustCard` this builds on — archived 2026-07-28). The public shell already exists — no scaffolding.
- **Parallel with:** — (every prior slice is done; fully standalone)
- **Blockers:** none hard — the mockups already live in Claude Design (`customer-desktop.jsx`) and are delivered **up front** (per the user's instruction) so the business logic is reconciled before build (see Unknowns). The 5 mockup types map **1:1** onto our existing `VehicleCategory` values (`cargo_van`=Furgon, `passenger_van`=Bus osobowy, `car_transporter`=Autolaweta, `refrigerated_truck`=Chłodnia, `flatbed_truck`=Skrzyniowy) — no data-model gap.
- **Unknowns:**
  - **Empty / thin categories.** The mockup's Popularne always renders exactly 3 cards per type from fake data; the real fleet has categories with 0, 1, or 2 vehicles. Rule to set at plan: show only the vehicles that exist (1–3), and **hide-or-disable a type pill whose category is empty** so a hover/tap never lands on an empty strip. Owner: user. Block: no — resolve at `/10x-plan`.
  - **What "Popularne" means.** There is no popularity / booking-count signal in the schema, so "Popularne" is really "a few models of this type." Decide the selection: first N of the type by the catalog's default order (`listVehicles`), or an explicit curation field. Owner: user. Block: no.
  - **Fleet type-filter mechanism.** The mockup implies **instant** client-side type switching (React `setType`), but the shipped `/fleet` filters by a **URL param** via SSR anchor tabs — which is exactly what makes the landing's "Wszystkie" / pill-click **deep-links** (`/fleet?category=<type>`) land correctly. Reconcile: keep `category` in the URL (deep-linkable, no-JS) while restyling the pill bar, vs. moving to an instant client swap. Owner: design/plan call. Block: no.
  - **Fleet "Filtry" apply model.** The mockup shows a **deferred** filter bar (dates / payload / sort applied on a **Zastosuj** button), distinct from the instant type pills; the shipped `FilterBar` commits changes straight to the URL. Keep auto-apply or adopt the deferred "Zastosuj" model. Owner: user. Block: no.
  - **Data delivery for the swap.** For the hover/tap swap to be instant (no spinner), SSR the top-N per category into the type-explorer island once, vs. fetching per selection. Plan-time architecture call. Block: no.
- **Risk:** The current `TypeSelector` is a **static** click-to-route Astro component — the `landing-redesign` slice explicitly **deferred** the hover-preview ("no hover-preview this slice — click-to-route only, deviation(scope)"); S-10 finishes that. It becomes a **React island** that forks behavior by input: **desktop hover = preview** (swap the Popularne cards + badge + the "Wszystkie" target), **desktop click = navigate** (`/fleet?category=<type>`), **mobile tap = select** (swap; no hover). The interaction-heavy parts are that hover/tap fork, keeping the pill and "Wszystkie" targets as **real anchors** (SEO + no-JS fallback + view-transitions), and swapping the Popularne strip without a flash. Extract the per-category "top-N" grouping as a **pure, Vitest-tested helper** — the empty/thin-category edges live there, and no UI test runner ships on the public pages. The **fleet restyle** is mostly visual (lower risk), but the type-pill-bar reconciliation touches the **deep-link contract** the landing's pre-filter buttons depend on — get the URL/`category` behavior right or those links break. Built over existing tokens + data (no `global.css` edit expected) and the shipped fonts; **Polish copy is canonical**, ported verbatim from the mockup ("Wybierz typ pojazdu.", "Popularne", "Wszystkie", "Cała flota", the badges _Furgony / Busy osobowe / Autolawety / Chłodnie / Skrzyniowe_, and the hint _"Najedź, aby podejrzeć modele poniżej · kliknij, aby otworzyć ekran kategorii"_). Design Alignment Audit runs against `customer-desktop.jsx` (`ScreenDesktopHome` / `DesktopTypeExplorer`, `ScreenDesktopFleet` / `ScreenTabletFleet` / `ScreenMobileFleet`, `ScreenMobileHome`) per `context/foundation/lessons.md`.
- **Status:** backlog

### S-11: Staff self-service account (My account)

- **Outcome:** A logged-in employee opens their own **Profil** screen (desktop + mobile), sees their
  contact and work details, **changes their own password while signed in** (no email round-trip), and can
  log out. Read-only identity display + password change — not a full profile editor.
- **Change ID:** staff-account
- **PRD refs:** — (net-new; extends **F-02** auth/role, done). Adds no new FR.
- **Prerequisites:** **F-02** (roles/auth, done). The in-session `updateUser` primitive already exists.
- **Parallel with:** S-12, S-13 (light coordination on the `StaffShell` nav registry).
- **Blockers:** none — mockup exists (`staff-profile.jsx`, live in Claude Design).
- **Unknowns:**
  - The mockup's **Powiadomienia** (notifications) toggle maps to **no** v1 system (PRD non-goal) — drop or
    render disabled. Owner: user. Block: no.
  - The **Oddział** (branch) field is not in the data model — drop or hardcode. Block: no.
  - Inline edit of `full_name` is **RLS-blocked for non-admins** (`profiles_update_authenticated` requires
    admin) — needs a self-row policy/RPC **only if** editing (vs display) is in scope. Block: no.
  - Whether "Zmień hasło" must **confirm the current password** (Supabase `updateUser` does not) — a net-new
    verification if wanted. Block: no.
- **Risk:** Lowest-risk of the cohort. Reuses the in-session `updateUser({ password })` already at
  `src/pages/api/auth/reset-password.ts:45` and the `ResetPasswordForm` atoms; the screen is mostly display
  over `App.Locals.user`. The only shell edit is making the existing account chip (`StaffShell.astro:121-134`)
  a link and/or adding the pre-declared "Profil" nav entry (`StaffShell.astro:14-15`). Design Alignment Audit
  runs against `staff-profile.jsx`; Polish copy canonical (Profil, Kontakt, Praca, Konto, Zmień hasło, Wyloguj się).
- **Status:** backlog

### S-12: Manual reservation (staff-created confirmed booking)

- **Outcome:** A logged-in employee creates a **confirmed** reservation by hand for a phone-in customer —
  pick vehicle + dates/times, enter customer name/phone/email, with a **live availability check** — and the
  slot is blocked in the calendar and the customer is emailed a confirmation. The booking is tagged
  **"Ręczna"** (manual).
- **Change ID:** manual-reservation
- **PRD refs:** reuses **FR-004** (reservation), **FR-005** (overlap), **FR-009** (confirmed state); adds no new FR.
- **Prerequisites:** **F-02** (roles), **S-02** (reservation model + overlap rule), **S-03** (the confirmed
  state) — all done.
- **Parallel with:** S-11, S-13.
- **Blockers:** none — mockup exists (`manual-reservation.jsx`, live in Claude Design).
- **Unknowns:**
  - **New `create_confirmed_reservation` definer RPC required** — `create_reservation_request` hardcodes
    `status='pending'` (`…reservation_b2b_fields.sql:71-78`) and `decide_reservation` only transitions existing
    rows. The new RPC gates on `current_app_role() IN ('employee','admin')`, inserts `status='confirmed'`, and
    mints the reference via the existing sequence; the `EXCLUDE` constraint protects it atomically. Block: no.
  - **Two entry points** in the mockup — a header quick-add menu **and** a calendar-cell click → confirm. The
    calendar-cell path touches `/dashboard/calendar`; it can be a follow-up. Block: no.
  - The quick-action menu also lists **Nowy klient / Dodaj pojazd / Szybkie wydanie** — out of this slice;
    "Nowy klient" implies a customer database v1 lacks. Block: no.
- **Risk:** Reuses the overlap `EXCLUDE` + `isVehicleAvailable` pre-check and the confirmed-email template, and
  can fork `ReservationForm`. Net-new surface is one RPC + a staff form/modal + an entry-point button. The
  "Odbiór od 14:00 · zwrot do 10:00" window and deposit/rate math match the existing model. Design Alignment
  Audit against `manual-reservation.jsx`; Polish copy canonical (Nowa rezerwacja, Ręczna, Utwórz rezerwację,
  Termin wolny/zajęty, kaucja).
- **Status:** done

### S-12a: Availability-aware date picker in the manual reservation modal (refinement)

- **Outcome:** In the staff manual-reservation modal the two blind `<input type="date">` fields are replaced
  by the same range calendar the public booking widget already gives customers — the selected vehicle's taken
  days greyed, changeover days half-available — so an employee on the phone with a customer sees availability
  **while** picking instead of being told "Termin zajęty" after the fact.
- **Change ID:** manual-reservation-date-picker
- **PRD refs:** reuses **FR-004** (reservation), **FR-005** (overlap), **FR-014** (calendar availability); adds no new FR.
- **Prerequisites:** **S-12** (the modal), **S-02a** (the half-availability day model) — S-02a done, S-12 implemented.
- **Parallel with:** S-11, S-13.
- **Status:** **done** — 6 phases shipped 2026-08-21 (`847ad96`, `1097951`, `571df4a`, `4b57ea7`, `daf47a6`,
  `83721c1`, `f8ade37`), each with its vision-diff closed. Phases 1–5 delivered the picker; **Phase 6 reopened
  the slice the same day** after driving the result, for three surface changes already made in the design
  source: the next-free date hint is retired (it read as a claim about the range being booked once D10 dropped
  its `· kolejna rez.` anchor, and went silent on the legal same-day 10:00/14:00 changeover), the two `Termin`
  fields collapse to one now that the picker sets both ends, and the mobile picker becomes a sheet over the
  form instead of an in-flow block. Phase 6 also fixed a page-scroll leak inherited from S-12 — the modal never
  locked `document.body`, so the dashboard scrolled behind the scrim.
- **Blockers:** ~~the design source needs updating first~~ ~~the six boards must be exported~~ **none — both
  resolved.** A DesignSync pull found `manual-reservation.jsx` already draws the calendar (`MrCalendarPopover` +
  `MrD_Pick`/`MrM_Pick`; the `Termin` fields are `mrDateBtn` buttons, not native date inputs). The source was
  updated after S-12's screenshots were exported, so the stale artifact was the **S-12 contract**, which recorded
  the native inputs `exact`. Corrected in `context/changes/manual-reservation-date-picker/design-contract.md`.
  The six boards then landed in the change's `design-review/` by rendering the canonical source through the
  design project's own `export-shot.html` harness (provenance in that contract), and the gate ran to an empty
  punch-list after two real fixes.
- **Follow-up (not this slice):** the public `BookingWidget` still fills busy half-days with the lighter
  `--muted` (`#EEF1F5`) and draws no divider, while the staff picker uses the design source's `--flota-busy`
  (`#D7DCE3`) + `--flota-busy-divider` (`#A9B2BE`). Recorded as **D14**; reconciling the two treatments is a
  separate change.
- **Unknowns:**
  - **No client-reachable busy-ranges endpoint.** The public path fetches server-side per vehicle page
    (`fleet/[id]/[...slug].astro`) because the vehicle is fixed by the URL; the modal switches vehicle
    client-side, so it needs `GET /api/vehicles/[id]/busy-ranges`, staff-gated, mirroring `api/availability.ts`.
    `get_vehicle_busy_ranges(uuid)` is already granted to `anon, authenticated` → no migration. Block: no.
  - Whether the debounced `/api/availability` boolean survives alongside the calendar or `checkRangeBookable`
    becomes the pre-submit gate. The `EXCLUDE` constraint is the authority either way. Block: no.
  - The source's own **D2** affordances — the "Pojazd wolny do … · kolejna rez. …" hint and the
    clashing-booking card — become computable from busy ranges once the endpoint exists. In or out? Block: no.
- **Risk:** Mostly assembly. `dayAvailabilityMap` / `checkRangeBookable` (`src/lib/availability.ts:116,157`)
  are pure and unit-tested, `ui/calendar` + react-day-picker v10 are already dependencies, and
  `BookingWidget.tsx:217-260` is a working reference including the half-day turnaround modifiers (return
  10:00 / pickup 14:00). Net-new is one staff-gated GET route plus the modal surface swap. The real cost is
  design: it corrects a contract line recorded `exact` against a source that had already moved on, so it needs
  its own Design Alignment Audit and vision-diff gate, and the mobile sheet has to absorb a calendar without
  losing the footer (the source's collapsed date buttons handle that at rest).
- **Status:** planned — `context/changes/manual-reservation-date-picker/plan.md` (5 phases). Absorbs S-12's
  unimplemented Phase 9 (F11/F12).

### S-13: Staff global search

- **Outcome:** A logged-in employee searches across **reservations, returns, vehicles, and customers** from a
  **header ⌘K search box** — grouped live results in a dropdown, a resting state (recent searches +
  quick-jumps), a no-results state, and **Enter → a full results page** with filter chips. Desktop dropdown +
  mobile full-screen.
- **Change ID:** staff-global-search
- **PRD refs:** — (net-new operational aid). Adds no new FR.
- **Prerequisites:** **F-02** (roles), **S-02/S-03** (reservations to search), **S-04** (vehicles),
  **S-05/S-06** (returns) — all done.
- **Parallel with:** S-11, S-12 — **but this is the invasive `StaffShell` change; sequence it last.**
- **Blockers:** none — mockup exists (`search-flow.jsx`, live in Claude Design).
- **Unknowns:**
  - **New role-gated search RPC(s) required** — reservation table SELECT is revoked and existing RPCs are
    pending-only/calendar-only; search over reservations (name/phone/reference/plate/dates) needs a new definer
    RPC. Vehicle search can reuse `listFleet`. Block: no.
  - The **Klienci** group must be **derived from denormalized reservation fields** (no customer entity);
    **Zwroty** = return protocols (S-06). Block: no.
  - **Shell restructure** — the staff header has no action slot today and several pages set `showHeader={false}`
    and draw their own headers; a persistent global search bar is a structural `StaffShell` change touching all
    staff pages (search was deliberately deferred — `dashboard.astro:67,88`). Block: no (but it's why this
    sequences last).
  - **⌘K** global shortcut + a full results page/route are net-new. Block: no.
- **Risk:** Highest-surface of the cohort (new RPC + shell restructure + a results route), and the one
  shared-surface conflict point with S-11/S-12's nav edits — so land those first and let search rebase over a
  settled shell. Client-side search patterns to mirror exist (`StaffList`/`FleetList`). Design Alignment Audit
  against `search-flow.jsx`; Polish copy canonical (Szukaj rezerwacji, pojazdu, rejestracji…, Rezerwacje,
  Zwroty, Klienci, Pojazdy, Zobacz wszystkie wyniki).
- **Status:** backlog

## Backlog Handoff

| Roadmap ID | Change ID                   | Suggested issue title                                            | Ready for `/10x-plan` | Notes                                                                                                                                                                                                                                                                                                                                                                |
| ---------- | --------------------------- | ---------------------------------------------------------------- | --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| F-01       | booking-integrity-data      | Vehicle/reservation data model + hotel-style overlap rule        | yes                   | Run `/10x-plan booking-integrity-data`                                                                                                                                                                                                                                                                                                                               |
| F-02       | employee-admin-roles        | Employee/admin role model on existing auth                       | yes                   | Parallel with F-01                                                                                                                                                                                                                                                                                                                                                   |
| S-01       | public-fleet-catalog        | Public fleet catalog: browse, filter, detail card                | no                    | Needs F-01                                                                                                                                                                                                                                                                                                                                                           |
| S-02       | public-reservation-request  | Public reservation request with no double-booking                | no                    | North star; needs F-01, S-01                                                                                                                                                                                                                                                                                                                                         |
| S-02a      | changeover-day-availability | Half-available changeover days on the booking calendar           | no                    | Needs S-02; refines FR-014; run `/10x-new changeover-day-availability`                                                                                                                                                                                                                                                                                               |
| S-03       | reservation-approval        | Employee accept/reject pending reservations                      | no                    | Needs F-02, S-02                                                                                                                                                                                                                                                                                                                                                     |
| S-04       | fleet-management            | Fleet CRUD with deletion guard                                   | no                    | Needs F-01, F-02; parallelizable                                                                                                                                                                                                                                                                                                                                     |
| S-05       | issue-protocol              | Issue handover protocol + photos/signature + email               | planned               | Plan reviewed (SOUND), 7 phases. Blocked on verified sender domain; then `/10x-implement issue-protocol`                                                                                                                                                                                                                                                             |
| S-06       | return-protocol-comparison  | Return protocol with auto-comparison + email                     | no                    | Needs S-05                                                                                                                                                                                                                                                                                                                                                           |
| S-07       | overdue-returns-dashboard   | Overdue returns flag on employee dashboard                       | no                    | Needs F-02, S-02; parallelizable                                                                                                                                                                                                                                                                                                                                     |
| S-08       | employee-account-management | Admin employee accounts + self-service password reset            | no                    | Needs F-02; parallelizable                                                                                                                                                                                                                                                                                                                                           |
| S-09       | public-info-pages           | Public About/FAQ pages + dynamic pricing (Cennik)                | yes                   | Net-new (post-v1). About/FAQ static; Cennik reads live fleet pricing (F-01). Mockups supplied at plan start — reconcile Cennik's pricing model vs. our rate fields. Run `/10x-new public-info-pages` → `/10x-plan public-info-pages`.                                                                                                                                |
| S-10       | landing-fleet-restyle       | Restyle + responsive landing & fleet + type-explorer → Popularne | yes                   | Net-new UI polish (post-v1). Mockups live in Claude Design `customer-desktop.jsx` (`ScreenDesktopHome`/`DesktopTypeExplorer`, `ScreenDesktop/Tablet/MobileFleet`, `ScreenMobileHome`). Reconcile empty/thin categories, "Popularne" ordering, and the fleet URL-vs-instant filter at plan. Run `/10x-new landing-fleet-restyle` → `/10x-plan landing-fleet-restyle`. |
| S-11       | staff-account               | Staff self-service account + in-session password change          | yes                   | Net-new (post-v1); extends F-02 (done). Mockup `staff-profile.jsx` (live). Trim the notifications/branch rows (no v1 backing). Parallel; run `/10x-new staff-account` → `/10x-plan staff-account`. Frame: `context/changes/staff-ops-features/frame.md`.                                                                                                             |
| S-12       | manual-reservation          | Staff-created confirmed reservation (phone-in)                   | yes                   | Needs S-02/S-03 (done). Mockup `manual-reservation.jsx` (live). New `create_confirmed_reservation` definer RPC; reuses overlap rule + confirmed-email. Parallel; run `/10x-new manual-reservation`. Frame: `context/changes/staff-ops-features/frame.md`.                                                                                                            |
| S-13       | staff-global-search         | Header ⌘K omnisearch (reservations/returns/vehicles/customers)   | yes                   | Needs S-02/S-03/S-04/S-05/S-06 (done). Mockup `search-flow.jsx` (live). New role-gated search RPC + `StaffShell` restructure — **sequence last**. Run `/10x-new staff-global-search`. Frame: `context/changes/staff-ops-features/frame.md`.                                                                                                                          |

## Open Roadmap Questions

1. ~~**Which transactional email provider and sender domain for protocol delivery (FR-008)?**~~ **Resolved 2026-07-09 → Resend.** Decided during `/10x-research issue-protocol`; see that change's `research.md` §5 for the scored comparison. `workerd` has no raw TCP, so SMTP is impossible and every candidate had to be a `fetch()`-callable HTTP API — which also retires the "Node deps in the email path" pre-mortem, since the adapter ships no SDK. Brevo is the documented one-file swap if EU data residency becomes a hard requirement (Resend stores logs/recipients in the US). **Residual:** the verified Polish sender domain (SPF + DKIM) is still to be provisioned — as of 2026-07-09 this **blocks S-05** (and therefore S-06), though it remains scoped to those slices rather than roadmap-wide.

(No open roadmap questions remain.)

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
- **S-03: A logged-in employee can view all pending reservation requests and accept or reject each one; accepting confirms the booking against the overlap rule.** — Archived 2026-06-26 → `context/archive/2026-06-17-reservation-approval/`. Lesson: —.
- **S-04: A logged-in employee can add and edit vehicles in the fleet, and remove a vehicle — with removal blocked when active reservations exist (employee must cancel them first).** — Archived 2026-07-09 → `context/archive/2026-06-17-fleet-management/`. Lesson: —.
- **S-02a: On the per-vehicle booking calendar, a booked range's changeover days are shown half-available instead of fully greyed — the booking's pickup day stays selectable as a new return, and its return day as a new pickup — so back-to-back rentals can be booked from the UI, matching the half-open EXCLUDE window.** — Archived 2026-07-09 → `context/archive/2026-06-16-changeover-day-availability/`. Lesson: —.
- **S-05: A logged-in employee can fill an issue protocol at pickup — mileage, fuel level, damage notes, photos, and a digital signature — on a phone or tablet, and the completed protocol is auto-emailed to the customer.** — Archived 2026-07-14 → `context/archive/2026-07-09-issue-protocol/`. Lesson: —.
- **S-06: A logged-in employee can fill a return protocol — the issue baseline shown as reference, all current values entered fresh — and the system auto-computes and displays deltas (km driven, fuel change, new damage); the protocol is auto-emailed to the customer.** — Archived 2026-07-23 → `context/archive/2026-07-14-return-protocol-comparison/`. Lesson: —.
- **S-07: see overdue returns flagged automatically on the dashboard** — Archived 2026-07-23 → `context/archive/2026-07-23-overdue-returns-dashboard/`. Lesson: —.
- **S-08: An admin can add and remove employee accounts; employees can self-service reset their own password via email.** — Archived 2026-07-24 → `context/archive/2026-07-23-employee-account-management/`. Lesson: —.
- **S-09: A visitor can open three public content pages from the site nav — O nas (`/about`), FAQ (`/faq`), and Cennik (`/pricing`) — each rendered in the existing public shell over the live tokens/fonts. O nas and FAQ are static content; Cennik renders prices dynamically from the fleet data so the rates shown never drift from the catalog. SiteHeader and SiteFooter nav gain links to the three pages.** — Archived 2026-08-02 → `context/archive/2026-08-01-public-info-pages/`. Lesson: —.
- **S-12: A logged-in employee creates a **confirmed** reservation by hand for a phone-in customer — pick vehicle + dates/times, enter customer name/phone/email, with a **live availability check** — and the slot is blocked in the calendar and the customer is emailed a confirmation. The booking is tagged **"Ręczna"** (manual).** — Archived 2026-08-21 → `context/archive/2026-08-10-manual-reservation/`. Lesson: —.
