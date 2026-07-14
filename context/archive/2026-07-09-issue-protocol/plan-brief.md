# S-05 Issue Protocol — Plan Brief

> Full plan: `context/changes/issue-protocol/plan.md`
> Research: `context/changes/issue-protocol/research.md`
> Design audit: `context/changes/issue-protocol/design-audit.md`

## What & Why

At vehicle pickup an employee records the odometer, fuel level, structured damage items, six baseline photos and
the customer's signature — on a phone at the vehicle or on the depot desktop. On submit the protocol commits and a
client-generated PDF is emailed to the customer. The customer has no account and no portal: **email is their only
channel, and that PDF is their only copy of the evidence**, possibly needed in a dispute months later.

## Starting Point

The email seam already exists (`src/lib/email/index.ts:37-39` literally reserves S-05 for "select a real adapter
from configuration"). Everything else is greenfield: no storage buckets, no `vehicles.plate`, no "issued" state, no
surface anywhere that lists confirmed reservations, and no mocking primitives in the test suite. The archive
records a confirmed PII leak on `reservations` caused by Supabase's implicit default grant plus a `using(true)`
policy — `protocols` carries customer PII _and_ damage photos, so that lesson has to be applied prospectively.

## Desired End State

An employee opens `/dashboard/pickups`, sees today's confirmed reservations — un-issued ones offering `Wydaj`,
issued ones carrying a delivery badge — taps one, fills the form, and the customer receives a PDF by email. If the
email or the PDF fails, the protocol still commits and the failure is visible on the dispatch row with a working
resend action. A wrong-role or anonymous caller reads nothing.

## Key Decisions Made

| Decision          | Choice                                                                   | Why                                                                                                                                                     | Source      |
| ----------------- | ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------- |
| "Issued" state    | Existence of a `protocols` row                                           | No enum change → the `EXCLUDE` predicate is untouched → no-double-booking cannot regress                                                                | Research    |
| Email failure     | Commit, then best-effort; record in `email_deliveries`                   | The vehicle physically changed hands; rolling back on a 503 is strictly worse. Silent → visible → recoverable                                           | Research    |
| Customer delivery | Client-generated PDF attachment, never a signed URL                      | Disputes surface months later, when a link is dead — the customer's evidence must not depend on the operator's goodwill                                 | Research    |
| PDF font          | `@pdf-lib/fontkit` + embedded TTF, from commit one                       | 8 of 9 Polish diacritics are outside WinAnsi and make `drawText` **throw**. A `StandardFonts` prototype passes every test and dies on the first _Wąsik_ | Research    |
| Form library      | `react-hook-form` + `useFieldArray` (first adopter)                      | `lessons.md` predates `VehicleForm` — the rule existed and the form skipped it. Dynamic damage rows are the real argument                               | Research    |
| Upload path       | Browser → Supabase directly, under `storage.objects` RLS                 | Zero Worker CPU against a 10ms cap; no bytes transit the Worker. Trust boundary moves to storage RLS                                                    | Plan        |
| PDF → email       | Upload PDF to storage, then a finalize route stores `pdf_path` and sends | The PDF must exist before Resend fetches its signed URL — so the commit and the send are two calls, not one                                             | Plan        |
| Storage ids       | `protocol_id` and `damage_id` minted on the client                       | Objects are keyed by those ids and must be uploaded before `create_protocol` records their paths                                                        | Plan-review |
| Entry point       | New `/dashboard/pickups` page                                            | S-06 and S-07 reuse the surface; the design already draws it                                                                                            | Plan        |
| `vehicles.plate`  | Nullable → backfill → tighten, one migration                             | Atomic; prod and local converge. Ten identical Ford Transits need a differentiator                                                                      | Plan        |
| Odometer check    | Compare to last protocol, **soft warning**                               | Catches the real typo (48712 → 4871) without stranding an employee over a swapped cluster                                                               | Plan        |
| HEIC              | Sniff, then lazily `import('heic2any')`                                  | Chrome/Firefox cannot draw HEIC to canvas — compression yields a _blank image_, not an error                                                            | Plan        |
| Risk #3 tests     | Inside S-05, as Phase 7                                                  | The adapter seam and the tests that need it land together; the swallow never ships untested                                                             | Plan        |
| Sender domain     | **Blocks the slice**                                                     | Diverges from `roadmap.md:172` (non-blocking). A slice whose only exercised path is `console.log` hasn't proven the thing it exists to do               | Plan        |

## Scope

**In scope:** `vehicles.plate` (plus the two seed files and the overlap test that insert vehicles); `protocols` +
`protocol_photos` + `protocol_damages` + `protocol_damage_photos` +
`email_deliveries`; the first storage bucket and its RLS; a Resend `fetch` adapter behind the existing seam; the
protocol form on both viewports; the client media pipeline (compress, HEIC, PDF); `/dashboard/pickups`; a
view-protocol screen with PDF download; delivery badge + resend; test-plan Phase 4. All four design-audit punch-list
items (desktop failure states, damage delete, badge + view screen, drop `W toku`).

**Out of scope:** any `reservation_status` enum change; signed URLs to the customer; draft/`W toku` protocol state;
damage severity or cost fields; offline support; send-to-device signature handoff; a service-role client; tracking
the anonymous creation email; migrating `VehicleForm` to RHF; S-06's return protocol.

## Architecture / Approach

Server-first: data → service → API → pure helpers → UI. Photos, the signature and the PDF go **browser → Supabase
directly**, never through the Worker, so the 10 ms CPU cap and the body limits are never in play; `storage.objects`
RLS becomes the trust boundary for those bytes. Every table access goes through a self-gating `SECURITY DEFINER`
RPC — there is no service-role client in this repo and this slice does not add one. The protocol commits _before_
the email is attempted; the outcome lands in an append-only `email_deliveries` table and surfaces as a dashboard
badge with a resend action.

## Phases at a Glance

| Phase                  | What it delivers                                        | Key risk                                                                  |
| ---------------------- | ------------------------------------------------------- | ------------------------------------------------------------------------- |
| 1. Data layer          | 5 tables, storage bucket + RLS, 4 RPCs, grants closed   | Repeating the `reservations` PII leak on a table holding PII _and_ photos |
| 2. Service + adapter   | Shared zod schema, Resend adapter, `sendTracked`        | The dead `catch` blocks go live the moment a real provider lands          |
| 3. API routes          | `POST /api/protocols`, PDF-finalize route, resend route | `/api` is outside middleware's gate — every route must self-gate          |
| 4. Media pipeline      | compress · HEIC · PDF, as pure functions                | pdf-lib throws on 8 of 9 Polish diacritics; HEIC silently yields blanks   |
| 5. Form island         | RHF form, both viewports, all states                    | Submit ordering — a stranded employee at the vehicle                      |
| 6. Dispatch + recovery | `/dashboard/pickups`, protocol view, badge, resend      | Without it, dismissing the overlay strands the protocol forever           |
| 7. Tests + send gate   | Risk #3 contract tests, `CLAUDE.md` fixes, real send    | A slice that only ever exercised `console.log`                            |

**Prerequisites:** F-02 and S-03 are `done`. **A verified Polish sender domain (SPF + DKIM) must be provisioned
before the slice can merge** — this is the user's deliberate call against the roadmap's non-blocking stance.
Local Supabase (`npx supabase start`, Docker) for the integration suite.

**Estimated effort:** ~4–6 sessions across 7 phases. Phases 1–4 are server/pure and independently verifiable;
5–6 carry the field-usability risk and need a real phone.

## Open Risks & Assumptions

- **The emailed PDF is client-authored, not server-attested.** The `protocols` row is the authoritative record and
  the server can always regenerate. Acceptable for trusted staff; revisit if a customer or counsel challenges provenance.
- **Mobile memory is the unverified bit.** 8 × 2 MB photos + a PDF copy ≈ 35–50 MB peak; iOS Safari's per-tab
  ceiling is undocumented. Client-side compression is what keeps this safe — it is not an optimization.
- **The `SET NOT NULL` on `vehicles.plate` will abort** if production gained a vehicle since the seed. Check
  `select count(*) from vehicles where plate is null` against prod before applying.
- **One silent-failure path stays live, knowingly**: the anonymous reservation-creation email keeps its swallow,
  because tracking it would require granting the public internet a write primitive on an audit log. That path has a
  second channel (the on-screen `/r/<token>` redirect).
- **EU data residency deferred.** Resend stores logs and recipients in the US — GDPR-lawful via DPA + SCCs, a
  posture concern rather than a blocker. Brevo is a documented one-file swap if procurement ever demands EU borders.
- **Two form conventions coexist** until `VehicleForm` migrates to RHF. Accepted; not a prerequisite.

## Success Criteria (Summary)

- An employee standing at a vehicle can file a complete protocol on a phone, and the customer receives a PDF that
  renders `ą ć ę ł ń ó ś ź ż` correctly.
- When the email or the PDF fails, the handover still commits, the employee sees why, and the dispatch row carries
  a badge with a resend action that works — no protocol is ever silently stranded.
- A role-null authenticated user, and an anonymous one, can read nothing from any protocol table or storage object.
