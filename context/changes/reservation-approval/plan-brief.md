# Reservation Approval (S-03) — Plan Brief

> Full plan: `context/changes/reservation-approval/plan.md`

## What & Why

Give employees the decision step that turns a customer's pending reservation request into a confirmed or rejected booking, and notify the customer. This is the hinge of the employee handover lifecycle — nothing downstream (issue protocols, S-05) can happen until a reservation is accepted.

## Starting Point

S-02 shipped the public funnel and deliberately left the rails for this slice: the status enum (`pending`/`confirmed`/`rejected`/`cancelled`), the read-only stepper with `confirmed`/`rejected` branches, the customer `/r/<token>` status page, and a dev-log email seam with a "S-03 adds the confirm/reject templates" hook. What's missing: any authenticated write path (no decision RPC), an employee approval screen (dashboard is a placeholder), and the confirm/reject email templates. Authenticated RLS on `reservations` is currently wide open (`using(true)` for all ops).

## Desired End State

An employee opens `/dashboard/reservations`, sees the pending queue, and accepts or rejects each request — from the card or a detail view — with rejections capturing a canned reason. A result overlay confirms the action, the request leaves the queue, the customer's `/r/<token>` page reflects the new status, and a Polish confirm/reject email is composed (delivered for real once S-05 wires a provider).

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| --- | --- | --- | --- |
| Accept overlap re-check | Not needed | Pending already participates in the EXCLUDE constraint, so confirming can't conflict | Research |
| Write mechanism | Guarded `SECURITY DEFINER` RPC + tighten RLS | Matches S-02's all-writes-via-RPC pattern and closes the over-permissive blanket UPDATE policy | Plan |
| Concurrency | Pending-guard in the RPC + friendly "already handled" re-sync | Safe under two employees deciding the same request; no silent overwrite | Plan |
| Reject reason | 4 canned reasons (+ `Inny` free text), stored | Matches the design, gives a light audit trail, can tailor the email | Plan |
| Cancellation | Out of scope | Roadmap outcome is accept/reject pending only | Plan |
| Email | Reuse dev-log seam, add 2 templates, best-effort send | Ships and verifies now without blocking on the S-05 provider decision | Plan |
| UI scope | Core flow: queue + detail + reason sheet + full result overlay | Gives real decision context, faithful to the drawn design | Plan |
| Queue scope | Pending only | Tightest scope; "inbox zero" model | Plan |
| Desktop layout | Master-detail (list + detail side-by-side) | Desktop designs provided 2026-06-17; differs from mobile's queue→detail navigation | Plan |

## Scope

**In scope:** decision RPC + reason columns + RLS tightening; list-pending + decide service; `PATCH /api/reservations/[id]`; confirm/reject email templates; mobile approval UI (queue → detail → reason sheet → result overlay).

**Out of scope:** cancelling confirmed bookings; real email delivery / provider wiring (S-05); alternative-date proposals; license/plate/location fields; general reservations admin / undo; English copy.

## Architecture / Approach

Bottom-up, mirroring S-02. The write crosses RLS only through `decide_reservation(...)` (role check → `select … for update` pending-guard → atomic status flip → returns the customer/vehicle payload for the email). The service wraps the queue read and the decide write; `PATCH /api/reservations/[id]` validates + role-gates + maps results (already-decided → 409). Email is two new pure templates sent best-effort from the endpoint. The UI is a single `client:load` island over the SSR-loaded pending list, managing queue/detail/sheet/overlay state.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Data layer | Reason columns, `decide_reservation` RPC, RLS tightening, regen types | Getting the pending-guard + RLS drop right |
| 2. Service + API | list-pending, decide service, `PATCH /api/reservations/[id]` | Correct status-code mapping incl. already-decided |
| 3. Emails | Confirm/reject Polish templates + best-effort send | Copy register; never fail the request on send |
| 4. Mobile UI | Queue → detail → reason sheet → result overlay, wired | Faithful rebuild against live tokens, not prototype JSX |
| 5. Desktop layout | Responsive desktop master-detail (list + detail) | Master-detail differs from mobile; reuse same logic |

**Prerequisites:** F-02 (done) and S-02 (shipped in code, despite stale roadmap status). Desktop designs are in hand (`21-staff-desktop-requests.jpg`, `20-staff-desktop-dashboard.jpg`) and distilled into the Phase 5 contract.
**Estimated effort:** ~3–4 sessions across 5 phases (Phases 1–3 are small and back-end; Phase 4 is the bulk; Phase 5 is layout-only).

## Open Risks & Assumptions

- **No real email until S-05.** Confirm/reject emails are composed to the dev log, not delivered. Must be communicated.
- **Desktop is master-detail, not the mobile flow.** Phase 5 builds list + detail side-by-side at `md`+; the components must be structured (in Phase 4) so the same island state drives both breakpoints.
- **Parallel-worktree caution (if building alongside S-04):** shared-merge surfaces are `src/lib/access.ts`, `src/pages/dashboard.astro`, `src/types.ts`, and the generated `src/db/database.types.ts` (regenerate after both migrations apply).

## Success Criteria (Summary)

- An employee can accept/reject a pending request and the customer's `/r/<token>` page reflects it; rejections store a reason.
- A second decision on the same request is safely blocked with a friendly re-sync (no overwrite).
- Confirm/reject emails are composed in Polish via the dev-log seam; the request never fails on a send error.
