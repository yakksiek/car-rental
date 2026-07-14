<!-- PLAN-REVIEW-REPORT -->

# Plan Review: S-05 Issue Protocol

- **Plan**: `context/changes/issue-protocol/plan.md`
- **Mode**: Deep
- **Date**: 2026-07-10
- **Verdict**: REVISE → **SOUND** after triage (all 10 findings fixed)
- **Findings**: 6 critical, 2 warnings, 2 observations

## Verdicts

| Dimension             | Verdict (at review) | After fixes |
| --------------------- | ------------------- | ----------- |
| End-State Alignment   | FAIL                | PASS        |
| Lean Execution        | PASS                | PASS        |
| Architectural Fitness | WARNING             | PASS        |
| Blind Spots           | FAIL                | PASS        |
| Plan Completeness     | WARNING             | PASS        |

## Grounding

18/18 paths ✓, 4/4 symbols ✓, brief↔plan ✓. `docs/reference/contract-surfaces.md` exists; its two surfaces (role/access
layer, public catalog layer) are not touched by this plan — check skipped.

Verified against code: `EmailContent`/`EmailMessage` have no attachment field (`src/lib/email/index.ts:11-20`);
`type EmailAdapter` is unexported (`:22`) and `adapter` is a module-local `const` (`:39`); `ci.yml:5-7` targets `main`
(so the plan's Phase 7 §3 correction is right); `CLAUDE.md:14` still claims no test runner (likewise); `seed.sql:22`
and `seed.prod.sql:11` insert vehicles with a column list omitting `plate`; `tests/integration/reservations-overlap.test.ts:56`
inserts a vehicle directly; no migration touches `storage.*`; the single-scalar-update convention is a POST action
sub-route (`src/pages/api/vehicles/[id]/active.ts`), not PATCH.

## Findings

### F1 — The email is sent before the PDF exists

- **Severity**: ❌ CRITICAL
- **Impact**: 🔬 HIGH — architectural stakes; think carefully before deciding
- **Dimension**: End-State Alignment
- **Location**: Phase 3 §1 vs. Phase 5 §3
- **Detail**: Phase 3's POST minted a signed URL for `issue/<id>/protocol.pdf` and called `sendTracked`, but Phase 5
  built and uploaded that PDF only at steps 4–5, after the POST. Resend fetches `path` server-side at send time, so
  every send would attach nothing while `email_deliveries` recorded `sent`.
- **Fix A ⭐ Recommended**: Move the send out of POST into a PDF-finalize step.
  - Strength: Preserves the plan's decision that PDF failure must not block the commit.
  - Tradeoff: Two round-trips; overlay variant keys off the finalize response.
  - Confidence: HIGH — resolves F3 in the same edit.
  - Blind spot: Phase 5's overlay wording needed rewording.
- **Fix B**: Build+upload the PDF before POST; POST becomes the only write.
  - Strength: One round-trip, no finalize route, no `pdf` overlay.
  - Tradeoff: A pdf-lib throw strands the employee at the vehicle.
  - Confidence: MEDIUM — trades a correctness bug for a usability one.
- **Decision**: FIXED via Fix A. Phase 3 §1 now commits only; new Phase 3 §2 `POST /api/protocols/[id]/pdf` stores
  `pdf_path` then sends; Phase 5 §3 rewritten as a 7-step order (0–6) with the send at step 6.

### F2 — Storage keys need a protocol_id that doesn't exist yet

- **Severity**: ❌ CRITICAL
- **Impact**: 🔬 HIGH — architectural stakes; think carefully before deciding
- **Dimension**: Architectural Fitness
- **Location**: Phase 1 §4 vs. Phase 5 §3
- **Detail**: Objects keyed `issue/<protocol_id>/…` and `damage-<damage_id>-<n>.jpg`, but photos and signature upload
  before `create_protocol` runs — and the RPC takes those paths as arguments. Both ids were generated inside the RPC.
- **Fix A ⭐ Recommended**: Client mints the UUIDs; `create_protocol` accepts `p_id` and per-damage ids.
  - Strength: Everything lands at its final key before commit; `useFieldArray` needs stable damage ids anyway.
  - Tradeoff: Client-supplied primary key; `unique (reservation_id)` still backstops races.
  - Confidence: HIGH — standard pattern for direct-to-storage uploads.
  - Blind spot: Storage RLS scopes only to the `issue/` prefix, so any employee can write any protocol's folder.
- **Fix B**: Key objects by `reservation_id`.
  - Strength: No RPC signature change.
  - Tradeoff: Breaks folder-per-protocol for S-06; damage photos still have no id.
  - Confidence: MEDIUM — solves photos/signature only.
- **Decision**: FIXED via Fix A. Phase 1 §4 documents the client-minted ids and the bounded trust consequence;
  `create_protocol` gained `p_id`; `protocolInputSchema` gained `protocolId` and per-damage `id` + `photos`;
  Phase 5 §3 gained step 0.

### F3 — Nothing can write `pdf_path`

- **Severity**: ❌ CRITICAL
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Plan Completeness
- **Location**: Phase 5 §3 step (5); Phase 1 §5; Phase 3
- **Detail**: Phase 5 said "upload the PDF and PATCH its path". No such route existed (Phase 3 defined two, neither an
  update), no such RPC existed (Phase 1 defined four, none an update), and `protocols` sits behind `revoke all` + RLS
  with no policies, so a direct client `.update()` is impossible by construction.
- **Fix**: Add `set_protocol_pdf(p_id, p_path)` RPC and a `POST /api/protocols/[id]/pdf` route following the
  `vehicles/[id]/active.ts` shape (the repo's single-scalar-update convention is a POST action sub-route, not PATCH).
- **Decision**: FIXED via F1 Fix A — the finalize route is the missing writer. Phase 1 §5 now lists five RPCs.

### F4 — The delivery badge can never render on a dispatch row

- **Severity**: ❌ CRITICAL
- **Impact**: 🔬 HIGH — architectural stakes; think carefully before deciding
- **Dimension**: End-State Alignment
- **Location**: Phase 6 §2 vs. Phase 1 §5
- **Detail**: `list_pickups_today()` returned confirmed reservations with **no** protocol row. A protocol whose email
  failed has one, so it was already excluded — the badge could never appear, and every row that _was_ on screen had no
  delivery row, so `absent or failed → bad` would paint them all red. Criteria 6.4 and 6.9 could not both pass. This
  killed the recovery surface the Desired End State promises and the whole justification for `email_deliveries`.
- **Fix A ⭐ Recommended**: Widen the RPC to return today's confirmed reservations _with_ their protocol state; the UI
  splits pending (`Wydaj`) from issued (badge + `Wyślij ponownie`).
  - Strength: One RPC, one round-trip; moves the lateral join where the perf note assumed it lived; gives the protocol
    view screen its only discoverable link.
  - Tradeoff: Rewrite criterion 6.4; rename the RPC.
  - Confidence: HIGH — resend route, badge and view screen already existed; only the query was wrong.
  - Blind spot: "Today" now needs a definition for issued rows (filed today vs. pickup due today).
- **Fix B**: Add a separate `list_issued_today()` and a second dashboard section.
  - Strength: Both RPCs stay single-purpose.
  - Tradeoff: Two round-trips; a surface the design never drew.
  - Confidence: MEDIUM.
- **Decision**: FIXED via Fix A. RPC renamed `list_dispatch_today`; service renamed `listDispatchToday`; Phase 6 §1/§2,
  criteria 6.4/6.6, Testing Strategy, Performance note and the plan's Desired End State all updated.

### F5 — The `plate` migration breaks `db reset` and the integration suite

- **Severity**: ❌ CRITICAL
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Blind Spots
- **Location**: Phase 1 §1; Migration Notes
- **Detail**: `config.toml` runs migrations before `seed.sql`. On a fresh reset the in-migration `UPDATE` matches zero
  rows (empty table), then `seed.sql:22` inserts seven vehicles omitting `plate` → NOT NULL violation. Criteria 1.1 and
  1.9 fail on the first run. Three unmentioned files must change: `seed.sql:22`, `seed.prod.sql:11`, and
  `tests/integration/reservations-overlap.test.ts:56` — the last takes the whole integration suite down.
- **Fix**: Add plates to both seed column lists and the test insert; keep the in-migration UPDATE (a no-op locally, but
  it is what converges prod).
- **Decision**: FIXED. Phase 1 §1 now names all three files and explains the ordering; new criterion + Progress step
  1.9 ("pre-existing integration suite still passes with `plate` NOT NULL").

### F6 — An attachment cannot reach the adapter without changing the seam

- **Severity**: ❌ CRITICAL
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Blind Spots
- **Location**: Phase 2 §2 and §3
- **Detail**: Phase 2 §2 required `attachments: [{path, filename}]`; Phase 2 §3 said the adapter sees only
  `{to, subject, html, text}` and `sendEmail`'s signature does not change. The adapter's only argument is the
  `EmailMessage`, so the attachment had no way through. Mutually exclusive as written.
- **Fix**: Add optional `attachments?: {path, filename}[]` to `EmailMessage` (not `EmailContent` — templates are pure
  and must not know about storage). Optionality is what "callers never change" was really protecting.
- **Decision**: FIXED. Phase 2 §3 now specifies the field, its placement, and why; §2 forwards `message.attachments`.

### F7 — The email fake has no seam to be injected through

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Blind Spots
- **Location**: Phase 7 §1; Phase 2 §3
- **Detail**: Phase 7 promised capturing and throwing adapters "injected via the config-selection seam". That seam
  selects between two hard-coded production adapters via a module-level `const` read from `astro:env/server`. It cannot
  yield a test double, and the harness has zero mocking primitives. Two of the three risk #3 assertions need the fake.
- **Fix A ⭐ Recommended**: Export `setEmailAdapter(next)` alongside the config default, built in Phase 2.
  - Strength: Phase 2 already exports the `EmailAdapter` type for this reason; it stopped one line short.
  - Tradeoff: A test-only mutator in production code; reset in `afterEach`.
  - Confidence: HIGH — integration tests run serially, so a mutable module binding is safe.
- **Fix B**: Stub `globalThis.fetch` and let the real `resendAdapter` run.
  - Strength: Exercises the real adapter, including its non-2xx throw.
  - Tradeoff: Needs `RESEND_API_KEY` in `.env.test`; couples every email test to Resend's wire format.
  - Confidence: MEDIUM.
- **Decision**: FIXED via Fix A. Phase 2 §3 exports the setter (`const` → `let`); Phase 7 §1 installs the fakes through it.

### F8 — Storage bucket + `storage.objects` policies from a plain migration is unverified

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Architectural Fitness
- **Location**: Phase 1 §4
- **Detail**: No migration among the 14 touches `storage.*`; every `[storage.buckets.*]` block in `config.toml:109-118`
  is commented out. Only a table's owner may `create policy` on it; `storage.objects` is owned by
  `supabase_storage_admin` while the migration runs as `postgres`. It usually works (membership + inheritance) but is
  unverified — and per the plan's own reasoning these policies _are_ the trust boundary for every photo byte, because
  uploads go browser → Supabase directly.
- **Fix**: Front-load it as a spike — bucket insert + one policy + `npx supabase db reset` — before the tables, grants
  and RPCs land on top. Name the fallbacks (`alter table storage.objects owner to postgres`, or config.toml/storage API
  bucket creation). Move the employee/anon upload check to the front of Phase 1.
- **Decision**: FIXED. Phase 1 Overview says "Do §4 first"; §4 carries the ownership explanation and both fallbacks;
  Progress 1.10 reordered to the front of the Manual block and marked **do this first**.

### F9 — The conflict screen has no protocol id to link to

- **Severity**: 💭 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phase 5 design contract; Phase 3 §1
- **Detail**: The conflict screen renders `Otwórz protokół` → `/dashboard/protocols/[id]`, but the 409 carried only the
  tag `conflict`; `create_protocol` returned no id on that path, so the client could not build the href.
- **Fix**: Have `create_protocol`'s `conflict` tag return the existing `protocol_id`, surfaced in the 409 body.
- **Decision**: FIXED via the F2 edit. Phase 1 §5 and Phase 3 §1 both state it; criterion/Progress 3.5 now asserts it.

### F10 — Two small factual slips

- **Severity**: 💭 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phase 1 success criteria + Testing Strategy; Phase 4 §1
- **Detail**: (a) Phase 1 creates five tables but the RLS criterion and Testing Strategy said "all four", omitting
  `protocol_damage_photos` — the table holding damage-evidence paths, i.e. exactly the one worth asserting given the
  `reservations` PII leak this phase exists to not repeat. (b) Phase 4 §1 specified `canvas.toBlob('image/jpeg', 0.8)`;
  `OffscreenCanvas` has no `toBlob` — it exposes `convertToBlob({type, quality})`, returning a Promise.
- **Fix**: Say "five new tables", add `protocol_damage_photos` to criterion 1.5 and the Testing Strategy bullet;
  correct the API name.
- **Decision**: FIXED. (a) landed with the F5 edit; (b) Phase 4 §1 now uses `convertToBlob` and calls out the trap.

## Follow-through

Renames and edits rippled through: `list_pickups_today` → `list_dispatch_today` (RPC, service, type alias, criteria,
Testing Strategy, Performance note); Phase 3 went from two routes to three, renumbering §2–§4 and Progress 3.5–3.8;
Phase 1 Progress went to 1.12. `plan-brief.md` re-synced (key-decisions table, Desired End State, phases table, scope).
Post-edit consistency check: one `## Progress`, 7 phase headings in body and 7 in Progress, every success-criteria
bullet has a matching checkbox, no stray checkboxes in phase blocks, no stale identifiers.
