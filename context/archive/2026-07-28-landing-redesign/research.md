---
date: 2026-07-30T00:00:00Z
researcher: MarcinK
git_commit: 8d86e0a2a675c42f29d9a98d625aaea9391829af
branch: main
repository: car-rental
topic: "Is the landing-redesign design-contract too big? What content is load-bearing vs filler?"
tags: [research, design-contract, design-fidelity, workflow, process]
status: complete
last_updated: 2026-07-30
last_updated_by: MarcinK
---

# Research: Is the design-contract too big? What's load-bearing vs filler?

**Date**: 2026-07-30 · **Researcher**: MarcinK · **Commit**: 8d86e0a · **Branch**: main · **Repo**: car-rental

## Research Question

The `landing-redesign/design-contract.md` (320 lines) feels like it's getting big — do we need ~70%
of it? Should it be mostly _deviations_ from the design rather than _describing each section part_?
Look at the contract and related places and suggest what to keep, cut, or restructure.

## Summary

**Don't cut it to "just deviations" — the repo's own history says that's the failure mode.** But your
instinct is half-right: a real slice of the contract _is_ low-value, just not the slice you'd guess.
The cut line isn't "deviations vs sections" — it's **non-recoverable decisions vs re-derivable
geometry, and consumed-downstream vs write-once**.

Three independent findings converge:

1. **Precedent (empirical):** a formal `design-contract.md` is the _established norm_ — 5 exist, this is
   the 6th. The **one** loose/ranges contract (S-06) is the **only** one that drifted → it spawned a
   307-line `design-followups.md` punch-list. Every exact-value contract since (S-07, S-08,
   staff-pulpit) shipped with a clean impl-review and **no** followup list. Heavy-but-exact paid off.
2. **Consumption (what's actually read):** only two downstream instructions read the contract —
   `/10x-implement` (take each element's exact value; an unmarked range = STOP) and `/10x-impl-review`
   (static text-compare of shipped values vs the contract). **Nothing downstream re-pulls DesignSync.**
   So the exact-value text + the `exact`/`deviation` tags are genuinely load-bearing. The **audit
   header block, freshness table, and screen inventory are write-once — no downstream step re-reads them.**
3. **Reconciliation:** the fidelity lesson blames **ranges/prose + abandoning the source**, _not_
   "too much geometry." A leaner contract that _references_ the pinned DesignSync node for bulk exact
   geometry is defensible in theory — but risky _here_ because nothing downstream re-pulls DesignSync
   and screens have been renamed/lost before, so it would gut the two static text gates.

**Net recommendation:** keep the exact-value + deviation shape (it works), but trim the _write-once
bloat_ and _prose narration_, and — more importantly — **complete the decisions** (the verification
pass found the contract was under-specified on decisions, not over-specified on geometry).

## Detailed Findings

### 1. How the contract is consumed downstream (load-bearing map)

- `/10x-implement` (`.claude/skills/10x-implement/SKILL.md:72`): reads the **per-element exact values**
  (spacing, radius, font size/weight, letter-spacing, color-as-token, grid ratio, breakpoint) and the
  `deviation` marks; an unmarked range is a **STOP**. No mention of copy, token map, or the audit header.
- `/10x-impl-review` (`.claude/skills/10x-impl-review/SKILL.md:99`): **static text compare** of shipped
  CSS/markup values against the contract's numbers; a code range is tolerated **only** where the
  contract marks it a `deviation`. Explicitly **does not** render.
- The **rendered vision-diff** (defined only in `lessons.md:21`, owned by implement) compares the render
  to the **mockup PNG**; the contract's role there is narrow — it supplies the **deviation exclusion
  list** so the diff "converges instead of re-flagging" (`lessons.md:19`).
- **Nothing downstream re-pulls DesignSync** — `DesignSync`/`get_file` appears once in the whole
  `.claude` tree, at **plan time only** (`10x-plan/SKILL.md:674`). Downstream relies on the written
  contract + the in-repo screenshots.

**Load-bearing:** per-element exact values + `exact`/`deviation` tags (3 gates), the **deviations
register** (most-consumed element), **verbatim Polish copy** (verified by the mockup image).
**Write-once, never re-read downstream:** the Design Alignment Audit header, freshness table, screen
inventory. **Contextual:** token map, component-reuse notes.

### 2. Prior-contract precedent (did heavy contracts pay off?)

| Slice            | Contract                 | Shape                                         | Outcome                                    |
| ---------------- | ------------------------ | --------------------------------------------- | ------------------------------------------ |
| S-05             | none (inline in plan)    | ad-hoc                                        | 3 side files (prompt/audit/deltas)         |
| S-06             | 286 ln, **ranges/prose** | "distill once, don't re-open"                 | **DRIFTED → 307-ln `design-followups.md`** |
| S-07             | 205 ln, exact-value      | audit + exact/deviation tags                  | clean impl-review, no followups            |
| S-08             | 603 ln, exhaustive       | per-element tables                            | gaps driven to zero                        |
| staff-pulpit     | 232 ln, mature           | values from live JSX, big deviations register | vision-diff "verifies, no longer tunes"    |
| landing-redesign | 320 ln                   | exact-value template                          | (this change)                              |

S-06 (`context/archive/2026-07-14-return-protocol-comparison/design-contract.md:37-38` "cards 14–18px")
is the cautionary tale the fidelity lesson (`lessons.md:15`) was written from. The exact-value shape
that replaced it demonstrably stopped the drift.

### 3. Mandate vs a leaner, source-referencing contract

- The lesson (`lessons.md:15,18`) blames **imprecision** ("ranges/prose … read as implementer license")
  and **source abandonment**, not geometry volume. A _pinned node reference_ is exact and keeps the
  source in the loop — it satisfies the _intent_ but relaxes the skill's literal "an exact value per
  element" (`10x-plan/SKILL.md:680`).
- **Risks of going reference-only here:** source drift (live JSX is mutable), renamed/lost screens
  (already happened — `design-system.md:87`), loss of plan-time reviewability (the audit is a _paper_
  audit), and — decisive — **downstream never re-pulls DesignSync**, so a "see node X" contract leaves
  `/10x-impl-review`'s static compare with nothing to compare and `/10x-implement` with no written value.
- Mitigation if ever adopted: it's load-bearing on the frozen in-repo screenshot + the mandatory
  vision-diff staying non-negotiable, and it should be a **project pin in `design-system.md`**, not an
  edit to the generic skill (`lessons.md:87`).

## Recommended contract structure (lean but not lossy)

Rule: **decisions get transcribed; exact screenshot-covered ports may be referenced; write-once bloat
gets trimmed.**

- **KEEP verbatim** (non-recoverable / thrice-consumed): token map, font map, **deviations register**,
  **verbatim Polish copy**, re-authoring/reflow/z-order/fork decisions, and the per-element exact values
  **with** `exact`/`deviation` tags (the two static gates read these as text; nothing re-pulls the source).
- **TRIM** (low-risk bulk, ~25–35%): move the Design Alignment Audit header / freshness table / screen
  inventory to the _bottom_ (or the plan) — no downstream step reads them; cut prose that narrates what
  the screenshot shows; stop restating identical cross-breakpoint values (note only where they differ);
  don't re-explain values already in `global.css`.
- **Don't** reduce to "just deviations" (reverts toward S-06) and **don't** go reference-only for geometry
  (breaks the static gates here).

## The bigger lever: the contract was _under-decided_, not _over-described_

The adversarial verification pass (4 agents) found **13 issues — and the geometry transcription was the
_least_ of them**: the desktop-exact check found only 3 small value slips; every other finding was a
**decision gap**. That is the strongest evidence for your intuition inverted: prose/geometry is cheap
insurance; the load-bearing, error-prone content is the decisions. All 13 are now folded into `plan.md`
/ `design-contract.md`:

- **Shared-component traps (would regress `/fleet` in an uninterrupted run):** plan said "reuse
  `MobileNav`" and "extend `SpecIcon`/`VehicleSilhouette`" — all three are **shared**. → forked to
  landing-local dropdown + landing-local icon map.
- **Missing deviations:** "Furgony" chip decoupled from top-3 (any-category) data; hero eyebrow's Polish
  **adjective** agreement (noun-only `pluralPl` doesn't cover it → fixed genitive recorded as deviation).
- **Ranges marked exact** (`14.5–15px`, `16–18`, `11–11.5px`, `max-w ~440`, `rounded-2xl?`) → resolved.
- **Transcription slips:** FLOTA wordmark gradient was inverted (0deg white-at-base, opacity 0.7); Popular
  card sub color was `muted` but source is ink-2 `#5B6474`/13px; serif heading sizes re-marked
  `deviation(optical re-tuning)`.
- **Container-query gap:** `LandingVehicleCard` marked `@container` (embeddable-panels lesson) + tablet
  reflow / in-between-width check added.

## Code / Doc References

- `.claude/skills/10x-implement/SKILL.md:72`, `.claude/skills/10x-impl-review/SKILL.md:99`,
  `.claude/skills/10x-plan/SKILL.md:668-684` — contract producer + consumers.
- `context/foundation/lessons.md:15-21` (fidelity), `:84-88` (audit gate + project-pin rule).
- `context/foundation/design-system.md:20,22,24,87` — tokens SoT, screenshots-preferred, pull-on-demand,
  lost-JSX precedent.
- `context/archive/2026-07-14-return-protocol-comparison/{design-contract.md,design-followups.md}` — the
  drift cautionary tale; `.../2026-07-23-overdue-returns-dashboard/reviews/impl-review.md:8` — exact-value
  contract shipped clean; `.../2026-07-24-staff-pulpit-dispatch/design-contract.md:3-7` — mature shape.

## Architecture Insights

- Two fidelity gates exist and are complementary: a **static text compare** (implement + impl-review, reads
  the contract's numbers) and a **rendered pixel diff** (against the mockup PNG, uses the deviation list).
  The contract must feed both — which is why it can't collapse to deviations-only.
- The design source being _live + code-backed + named_ is what makes the vision-diff cheap, but it is
  **plan-time infrastructure only**; downstream durability rests on the in-repo screenshots + written text.

## Open Questions

- Do you want the **structural trim** applied now (move the audit header/freshness/inventory to the bottom,
  cut prose, de-dupe cross-breakpoint values)? It's ~25–35% smaller with zero fidelity loss — but it's a
  bigger edit than the correctness fixes already applied, so I left it for your call.
- Should the "leaner-contract-with-node-references" policy be pinned in `design-system.md` for _future_
  slices (not this one)? Recommended only if the frozen-screenshot + vision-diff gates stay mandatory.
