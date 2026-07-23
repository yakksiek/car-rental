# Return Protocol with Comparison (S-06) — Plan Brief

> Full plan: `context/changes/return-protocol-comparison/plan.md`

## What & Why

At vehicle return an employee fills a **return protocol** — the issue baseline shown as read-only
reference, all current values (odometer, fuel, damage, photos, signature) entered fresh — and the system
auto-computes and displays **deltas**: km driven, fuel change, and a per-item `existing | new` damage diff.
The completed protocol is emailed to the customer as a PDF. The delta computation is the differentiating
value over the paper protocols this replaces (PRD US-02, FR-007, FR-008).

## Starting Point

S-05 (issue-protocol) shipped the whole spine: the `protocols` tables, the storage bucket, the Resend email
adapter + `sendTracked`, the media/PDF pipeline (pdf-lib + fontkit for Polish diacritics), the RHF form
leaves, and the `/dashboard/pickups` dispatch pattern. But `protocols` is **issue-only** — `unique
(reservation_id)` forbids a second protocol per reservation — no RPC maps `reservation_id → issue protocol`,
and the storage layer is hardcoded to the `issue/` prefix. No design asset exists for the comparison surface
beyond one mobile screenshot.

## Desired End State

An employee opens `/dashboard/returns`, sees vehicles due or overdue to return that were issued in the
system, taps one, and the return form opens with the issue baseline as reference. They enter current values;
a live comparison shows km driven, fuel change, and new damage with adverse deltas flagged. On submit the
return commits and the customer receives a diacritic-correct PDF with a comparison section. Email/PDF
failures never lose the return — the row carries a badge with a working resend. `reservation_status` and the
no-overlap constraint are untouched.

## Key Decisions Made

| Decision          | Choice                                                                   | Why (1 sentence)                                                                               | Source |
| ----------------- | ------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------- | ------ |
| Schema shape      | `type` column on `protocols` + `unique(reservation_id, type)` + self-FK  | One table lets all RPCs/PDF/form reuse with a `type` param; matches the S-05 design intent     | Plan   |
| Reuse strategy    | Hybrid — share leaves + pipeline, new return shell/schema/PDF section    | Shares the hard, tested parts (pdf-lib, HEIC, RHF) without refactoring the working issue flow  | Plan   |
| Damage diff       | Fresh entry + auto-tag `existing\|new` + manual per-item override        | Honors "enter fresh" and gives a reliable diff without trusting fuzzy free-text matching       | Plan   |
| Cost              | Deltas only, no monetary computation                                     | Matches FR-007 (comparison) and the v1 Non-Goal ("no automatic late-fee calculation")          | Plan   |
| Worklist          | Due-or-overdue, still open (`return_date ≤ today`, issued, not returned) | An overdue van stays on the list until processed — you can't file a return for a vanished row  | Plan   |
| Precondition      | Require an existing issue protocol                                       | The baseline is the whole point — no baseline, no comparison                                   | Plan   |
| Validation        | Soft warnings, never block                                               | Matches S-05 — catches the typo without stranding an employee at the vehicle                   | Plan   |
| Completion        | Return-protocol row existence; `reservation_status` untouched            | Mirrors "issued = row existence"; leaves the no-overlap `EXCLUDE` constraint safe              | Plan   |
| Design            | Connect to Claude Design, correct mockups, then align UI — a gate        | No comparison-surface design exists; the stale return JSX predates structured damage           | Plan   |
| Design gate scope | Gates only UI phases (5–6); backend/logic (2–4) runs in parallel         | The delta logic and data layer are design-independent — keep momentum while design is reviewed | Plan   |
| Seed              | Baseline issue protocol (numeric + damages, no storage objects)          | Makes the worklist and deltas demoable after `db reset` without dangling storage bytes         | Plan   |

## Scope

**In scope:** `protocols.type` discriminator + `baseline_protocol_id` + `protocol_damages.baseline_damage_id`;
`return/`-prefix storage RLS; three RPCs (`get_return_baseline`, `list_returns_today`,
`create_return_protocol`); the pure `protocol-delta.ts` helper; return schema; generalized storage path
helpers; return PDF comparison section + `protocolReturnedEmail`; `/api/return-protocols*` routes;
`ReturnProtocolForm` + baseline-linked `DamageEditor`; `/dashboard/returns` + queue + return view + nav tab;
a seeded baseline; full test suites + production real-send.

**Out of scope:** monetary/charge computation; any `reservation_status` change; editable pre-fill; standalone
return without a baseline; hard blocks on impossible values; new bucket/provider/service-role client; signed
URLs to the customer; refactoring the issue flow; S-07's overdue dashboard flag.

## Architecture / Approach

Server-first: data → pure logic → service → API → UI. One `protocols` table with a `type` discriminator;
return rows carry `baseline_protocol_id`. The delta computation is a pure, unit-tested helper consumed by
both the form and the PDF. Photos/signature/PDF go browser → Supabase directly under `storage.objects` RLS
(only the `issue/` → `return/` prefix changes); access is RPC-only (RLS-on + zero policies + revoke-all,
each RPC self-gating with revoke-then-grant). The return commits before the email; the outcome lands in the
append-only `email_deliveries` and surfaces as a resendable badge.

## Phases at a Glance

| Phase                            | What it delivers                                          | Key risk                                                              |
| -------------------------------- | --------------------------------------------------------- | --------------------------------------------------------------------- |
| 1. Design alignment (gate)       | Corrected Claude Design mockups + textual design contract | No comparison-surface design exists; stale JSX predates the schema    |
| 2. Data layer                    | `type`/baseline schema, `return/` RLS, 3 RPCs, seed       | Altering a live unique constraint; repeating the `issue/`-only prefix |
| 3. Delta helper + schema + svc   | Pure `protocol-delta.ts`, return schema, service fns      | Fuzzy free-text damage matching miscategorizing existing vs new       |
| 4. PDF + email + API             | Return PDF comparison, return template, 3 routes          | pdf-lib throws on 8/9 Polish diacritics; `/api` must self-gate        |
| 5. Return form island (gated)    | `ReturnProtocolForm`, baseline panel, deltas, submit      | Submit ordering — a stranded employee at the vehicle                  |
| 6. Dispatch + view + nav (gated) | `/dashboard/returns`, return view, "Zwroty" tab           | Overdue rows must stay visible or a return strands                    |
| 7. Tests + send verification     | RLS/API/email contracts, worklist fold, real send         | A slice whose only exercised send path is `console.log`               |

**Prerequisites:** S-05 is `done` (archived). Local Supabase (`npx supabase start`, Docker) for integration.
A verified sender domain for the production real-send (memory: hosted-attachment sends 422 on localhost).
**Phase 1 needs the claude.ai connector authorized interactively** to reach Claude Design.

**Estimated effort:** ~4–5 sessions across 7 phases. Phases 2–4 are backend/pure and independently
verifiable, and run in parallel with the Phase 1 design review; Phases 5–6 carry the field-usability risk
and need a real phone + the finalized design.

## Open Risks & Assumptions

- **The comparison-surface design is unbuilt.** Phase 1 must correct the stale mockups and add a desktop
  screen + delta block before UI work — the plan gates only the UI phases on this, so backend/logic proceeds.
- **Free-text damage matching is heuristic.** Auto-tag suggests; the persisted `existing | new` decision is
  the employee's (the manual override), so a fuzzy match never silently miscategorizes.
- **The unique-constraint swap touches a live table.** Safe today (no reservation has two protocols); check
  prod counts before applying.
- **Real send is production-only.** Hosted-attachment sends 422 on localhost signed URLs, so the
  definition-of-done send is a production exercise against the verified domain.
- **Mobile memory unverified**, as in S-05 — client-side compression is the safeguard.

## Success Criteria (Summary)

- An employee at a vehicle files a return on a phone against the issue baseline, and the customer receives a
  PDF whose comparison section renders `ą ć ę ł ń ó ś ź ż` correctly.
- The deltas (km driven, fuel change, new damage) are computed and displayed, with adverse ones flagged; the
  employee handles any charges manually (no auto-cost).
- Email/PDF failures never strand a return — the row carries a badge with a working resend; a role-null or
  anonymous user reads nothing from any protocol table or return storage object.
