<!-- IMPL-REVIEW-REPORT -->

# Implementation Review: Global search — Pulpit-only, dropdown-only

- **Plan**: `context/changes/staff-search-dashboard-only/plan.md`
- **Scope**: Phases 1–8 of 8 (full plan)
- **Date**: 2026-08-17
- **Verdict**: NEEDS ATTENTION
- **Findings**: 0 critical, 4 warnings, 5 observations
- **Queued as**: Phases 9, 10, 11 (all nine findings; owner chose record-as-plan-phases over inline triage)

## Verdicts

| Dimension           | Verdict |
| ------------------- | ------- |
| Plan Adherence      | WARNING |
| Scope Discipline    | PASS    |
| Safety & Quality    | WARNING |
| Architecture        | PASS    |
| Pattern Consistency | WARNING |
| Success Criteria    | WARNING |

24 of 26 numbered "Changes Required" items are exact matches. All seven
"What We're NOT Doing" guardrails hold. Every automated gate is green.

## Automated verification (re-run at review time)

| Gate                       | Result                                                         |
| -------------------------- | -------------------------------------------------------------- |
| `npx astro check`          | 0 errors, 0 warnings (5 pre-existing hints)                    |
| `npm run lint`             | 0 errors (2 pre-existing warnings in `ReturnProtocolForm.tsx`) |
| `npm run build`            | ✓ Complete                                                     |
| `npm test`                 | 337 passed (28 files)                                          |
| `npm run test:integration` | 211 passed (19 files) — also confirms the P1 migration is live |

## What passed

- **The migration** is byte-identical to `20260810130000_staff_search.sql` apart from
  `create` → `create or replace` and the three `limit 8` → `limit 25`. Role gate, 2-char
  floor, ILIKE escape chain (escape char first, then `%` and `_`),
  `stable / security definer / set search_path = ''`, the 14-column return shape and all
  three `order by` clauses unchanged. Revoke-before-grant restated per the project lesson.
- **Phase 3 auto-open** strips `?search=1` and opens in the same effect, preserves
  `history.state` for ClientRouter, and cannot re-fire (deps are a server prop and a
  `useCallback` keyed on `[field]`).
- **Phase 6** `searchProps` is literally one `const` spread at both call sites — drift is
  structurally impossible.
- **Phase 7** `pristine` is character-identical to all four `useState` initialisers, so no
  permanently-dirty form; `photos` compares joined strings, not array references.
- **Phase 8** hook gating is correct across every swap ordering; the disabled branch
  registers no cleanup and the enabled branch's cleanup is identity-guarded.
- **`NavIcon.astro`** — the one file in the diff appearing in no phase — is a comment-only
  repair pointing at the hero instead of the deleted tab-bar magnifier. In scope.
- **No dead code**: `/dashboard/search`, `SearchResults`, `resultCountLabel`, `seeAll`,
  `RESULT_FORMS`, `header-title`, `active="search"` all return zero hits across
  `src/`, `tests/`, `e2e/`. `pluralPl` correctly survives for `landing/TrustCard.astro`.

## Findings

### F1 — The `finally` re-arms the beforeunload guard on the success path

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality / Plan Adherence
- **Location**: `src/components/fleet/VehicleForm.tsx:437-439`
- **Detail**: Phase 7 calls the `submitting` disarm "load-bearing" and states
  "`setSubmitting(false)` in the `finally` re-arms it after a failed submit"; the code
  comment at `:335-337` repeats it. Both assume the `finally` runs only on failure. The
  success branch `return`s from inside the `try` (`:423-425`), and `try { return } finally {}`
  always runs the `finally` — so `submitting` flips false synchronously right after
  `location.assign()`, `dirty` is still true, and the effect at `:338` re-attaches
  `beforeunload` mid-redirect. The common case survives because no listener is attached at
  `assign()` time, so the browser's prompt-to-unload check passes before React re-attaches —
  manual step 7.6 passed by ordering, not by construction. Not covered: a second navigation
  during the redirect (back button, another click) prompts on a form already saved.
  The `finally` is **pre-existing** (arrived with the form at `14db20a`), so Phase 7 built on
  a premise about it that was never true. Resetting pending on success also contradicts
  CLAUDE.md's async-button rule ("Keep the pending state through a success redirect; reset
  only on error") — the button reverts from the spinner mid-redirect, re-opening a
  duplicate-POST window. `ReservationForm.tsx:292-294` has the same shape.
- **Fix A ⭐ Recommended**: Move `setSubmitting(false)` out of the `finally` into the two
  non-2xx branches and the `catch`.
  - Strength: Makes the plan's stated contract literally true and brings the file into line
    with the CLAUDE.md rule it currently breaks, closing the button-revert and duplicate-POST
    window in the same edit.
  - Tradeoff: Three call sites instead of one; `ReservationForm.tsx` keeps the old shape
    unless fixed too.
  - Confidence: HIGH — the control flow is unambiguous and the rule is written down.
  - Blind spot: Haven't checked whether any test asserts the button re-enables after success.
- **Fix B**: Add a `navigating` ref set before `location.assign()` and include it in the
  effect's guard.
  - Strength: Narrowest change; leaves the pre-existing `finally` and the `ReservationForm`
    parallel untouched.
  - Tradeoff: Fixes only the beforeunload symptom — the button still re-enables mid-redirect.
  - Confidence: MEDIUM — correct for the guard, leaves the root in place.
  - Blind spot: A ref write doesn't re-render; the ref must be set before `setSubmitting`.
- **Decision**: QUEUED — Phase 9 (Fix A)

### F2 — Mobile results list lost its 24px bottom gap

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality (design fidelity)
- **Location**: `src/components/search/GlobalSearch.tsx:361`
- **Detail**: Both contracts specify the mobile results body as `padding 4px 0 24px`, marked
  `exact` (`staff-search-dashboard-only/design-contract.md:138`). Shipped is `py-1.5` — 6px
  top and bottom. The class didn't change in this branch but the render did: until Phase 2
  the bottom gap came from the "Zobacz wszystkie wyniki" button that sat after the groups
  with `mx-4 mt-3 mb-2` plus its own `h-12`. Deleting it left the last Pojazdy row 6px from
  the viewport edge. Manual step 2.7 ("no button below it") is true; step 4.5 ("every
  deviation describes something still true of the app") is not, for this line.
- **Fix**: `pt-1 pb-6` on the mobile `Command.List`; leave the desktop list at `py-1.5` (the
  contract gives no desktop body padding).
- **Decision**: QUEUED — Phase 10

### F3 — The vision-diff gate was skipped on a rationale the code contradicts

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Success Criteria
- **Location**: `context/changes/staff-search-dashboard-only/plan.md:816`
- **Detail**: Progress row 4.6 is struck through and marked "NOT RUN, closed by owner
  decision". Two of the three legs of the reasoning in `change.md` hold: the gate would
  genuinely have missed D19 (no mobile mock passes `active`, so both sides render no active
  row), and most of the change is removal. The third leg — that the diff would "re-verify the
  transcription, not the design" because every value came from code-backed JSX — only follows
  if the app matches the transcription. **F2 and F4 falsify it**: they are precisely the class
  of drift a rendered diff catches and a static read of the contract did not, and manual step
  4.5 signed off over both. Bookkeeping: row 4.6 is written `- [x]` while saying NOT RUN, so
  the completion arithmetic reads 52/52 and `change.md` claims "All 52 Progress rows are
  green" — one row is green-by-closure, not by completion.
- **Fix A ⭐ Recommended**: Fix F2 and F4, then leave the gate closed — but restate row 4.6's
  rationale to drop the "diff would only re-verify the transcription" claim, and mark the row
  as closed rather than done.
  - Strength: Keeps the owner's decision (the rest of the reasoning supports it) while
    removing the one justification the evidence contradicts; the completion count then tells
    the truth to the next reader.
  - Tradeoff: Cumulative metric drift stays unverified — already named and accepted.
  - Confidence: HIGH — F2 and F4 are confirmed against the contract text.
  - Blind spot: Whether other `exact` lines beyond the three reviewed surfaces also diverge.
- **Fix B**: Run the gate as specified — drive `design-export-request.md`, land the PNGs, diff
  at 1440×900 and 390×844.
  - Strength: Closes the question outright; gives the archive a canonical baseline.
  - Tradeoff: Manual export step; mostly re-verification of transcribed values.
  - Confidence: MEDIUM — depends on whether the two known deltas suggest more are hiding.
  - Blind spot: Haven't estimated the export effort.
- **Decision**: QUEUED — Phase 10 (Fix A)

### F4 — `Kbd` deltas against an `exact` contract block, duplicated in two files

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency / design fidelity
- **Location**: `src/components/search/GlobalSearch.tsx:383`, `src/components/search/SearchRows.tsx:112`
- **Detail**: `design-contract.md:131-133` gives `Kbd` as `exact`: `minWidth 18`, `height 20`,
  `padding 0 5px`, `borderRadius 5`, `bg tokens.card`, `1px solid tokens.hair`,
  `boxShadow 0 1px 0 rgba(15,23,42,0.05)`, `11px / 650`, `tokens.ink2`. Three diverge:
  `px-1` (4px, contract says 5px); `text-muted-foreground` (contract says `--flota-ink-2`);
  no shadow at all. Pre-existing from S-13, but Phase 4 rewrote this contract and restated all
  three as `exact`, so the amending document now disagrees with the code it governs.
  `EnterChip` is a verbatim copy differing only by `font-sans` and its visibility class, so
  each delta must be fixed twice. Separately the footer hints are `text-[11px]` where Surface
  D gives `fontSize 11.5` as `exact`.
- **Fix**: Export `Kbd` from a shared module, have `EnterChip` wrap it, set
  `px-[5px] text-[var(--flota-ink-2)] shadow-[0_1px_0_rgba(15,23,42,0.05)]` once; bump the
  footer spans to `text-[11.5px]`.
- **Decision**: QUEUED — Phase 10

### F5 — `RowAnchorProps` still accepts a `className` that is now swallowed

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Adherence
- **Location**: `src/components/search/SearchRows.tsx:138`
- **Detail**: Phase 2 #5's Contract says the three rows "drop `className` from their props".
  The runtime half landed (`:149`, `:181`, `:210` are all `className={ROW_SHELL}`); the type
  half didn't. `RowAnchorProps` is still `Omit<React.ComponentPropsWithRef<"a">, "children">`,
  which includes `className`. `{...anchor}` spreads before `className={ROW_SHELL}`, so a
  caller passing an override type-checks and is silently ignored.
- **Fix**: `Omit<React.ComponentPropsWithRef<"a">, "children" | "className">`.
- **Decision**: QUEUED — Phase 11

### F6 — The defensive `astro:page-load` re-arm cannot fire

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: `src/components/hooks/useGlobalSearchHotkey.ts:109-117`
- **Detail**: The registration/clearing logic is **correct** — every swap ordering was traced
  and the identity guard at `:114` plus the no-cleanup disabled branch make handler clobbering
  impossible; steps 8.5–8.7 hold by construction. But the comment at `:109-110` describes
  something the code can't do: `install()` early-returns on `installed`, never reset, so it
  could not reinstall anything even if the event fired; and `install` is a single module-level
  reference, so `addEventListener` dedupes it — the outgoing island's `removeEventListener` at
  `:117` removes the registration the incoming island just added at `:111`. After the first
  client-side navigation no re-arm is registered at all. Harmless (the document keydown
  listener survives every swap), but inert. Related: the header comment at `:10-13` justifies
  the design on "Astro does not reliably run React cleanup for a swapped-away island" —
  astro-island registers `astro:after-swap` → `unmount()`, wired to `root.unmount()` by
  `@astrojs/react`, so cleanup does run in this version. Code stays correct; the reason is stale.
- **Fix**: Delete the re-arm, or register it once at module scope inside `install()` rather
  than per island — and reword the two comments.
- **Decision**: QUEUED — Phase 11

### F7 — No length bound on the search query

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: `src/pages/api/search.ts:17-19`
- **Detail**: `q: z.string().trim().min(MIN_QUERY_LENGTH)` has no `.max()`. The deleted page
  used `.max(100)` (`search.astro:30`). The endpoint was always unbounded, so this branch
  didn't introduce it — but with the page gone the repo no longer has a length-bounded search
  entry anywhere, and an arbitrarily long ILIKE pattern reaches the definer RPC.
- **Fix**: Add `.max(100)` to the endpoint schema, matching the retired page.
- **Decision**: QUEUED — Phase 11

### F8 — Comments and payload left behind by the deletion

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: `src/pages/dashboard/protocols/[id].astro:38-39` (+3 more)
- **Detail**: Live code is clean. Four stale artifacts remain:
  `protocols/[id].astro:38-39` ("the always-on top bar renders search-only here") describes
  pre-Phase-3 behaviour, on the exact page Phase 6 exists for — `NavIcon.astro` got the same
  class of repair; `search-format.ts:12-13` ("these rows are server-rendered on the results
  page") — both call sites are now client-only; `types.ts:318,320`
  (`SearchResultVehicle.model` / `.category`) are rendered by nothing, dead payload per
  keystroke (the shape is deliberately frozen, so not a bug);
  `design-contract.md:136` cites `GlobalSearch.tsx:266`, which moved to `:315`.
- **Fix**: Reword the three comments; note in the new migration that `vehicle_category` is now
  carried for shape stability only.
- **Decision**: QUEUED — Phase 11

### F9 — The new cap's value is untested

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Success Criteria
- **Location**: `tests/integration/staff-search.test.ts:361-369`
- **Detail**: `expect(vehicles).toHaveLength(9)` against a 9-row fixture proves only "> 8",
  never 25. The plan names this under "Known gaps this depth leaves" and the test comments are
  explicit, so this is a documented decision, not drift. Recorded only because a
  `create or replace` back to `limit 10` would pass green today.
- **Fix**: Assert the value directly against
  `pg_get_functiondef('public.search_staff'::regproc)` — no extra fixture rows needed.
- **Decision**: QUEUED — Phase 11
