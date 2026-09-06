---
change_id: staff-panel-discovery
title: Staff-panel discovery on the portfolio site — orientation overlay, header info button, footer staff pill
status: archived
created: 2026-09-06
updated: 2026-09-06
archived_at: 2026-09-06T18:10:14Z
---

## Notes

Opened by `/10x-frame` on 2026-09-06. The owner's ask: this deployment is a portfolio, the
staff cockpit is the half worth showing, and the only route into it is a footer link visitors
never find. Mockups exist in the Claude Design project (`recruiter-guide.jsx` welcome overlay,
`InfoButton` in every public header, the staff pill in `InfoFooter`).

The framing step lives in `frame.md`. Read it before `/10x-plan`.

Planned by `/10x-plan` on 2026-09-06. Six phases in `plan.md`, summarised in `plan-brief.md`.
Owner decisions during planning narrowed the frame's scope: the overlay and the info pill are
**landing-page only** (the frame had proposed every public page), the info pill **opens the
overlay** rather than navigating, and the Claude Design source is **aligned in Phase 1 before any
code is written**.

**Phase 1 is a gate** — the design mock currently contradicts the app, is English-only, and is not
registered in the design project's own export harness, so no canonical screenshot exists for any of
the three surfaces.

**Phase 1 executed 2026-09-06 — the design gate is discharged.** Five files written to the Claude
Design project (`shared.jsx`, `recruiter-guide.jsx`, `info-pages.jsx`, `export-shot.html`,
`design-review/index.md`) and seven canonical PNGs captured into `design-review/`. The overlay copy
now lives in the design as `STR.{EN,PL}.guide` and is the source Phase 3 copies from. Phases 2–6
are unblocked; implementation starts at Phase 2.

**Phases 2–6 implemented 2026-09-06** (`6b43c4c`, `c13aa25`, `4573152`, `ddaad99`, `c5b6bcf`,
epilogue `5c9f498`). Two gates were closed AFTER their phase commit, so the record here supersedes
what those two messages say:

- **Fidelity (6.5).** The Phase 6 message says the overlay's confirmation vision-diff stalled and
  that 6.5 rested on measurements. It was re-run and completed: all four findings CLOSED with
  deltas ≤ 0.1px, no new differences, and a verdict of MATCH at desktop, tablet and mobile. With
  the landing header and footer already MATCH, the fidelity sweep is clean across all three
  surfaces apart from the eight recorded deviations.
- **E2E (6.2).** The suite was first run on `:4322`, because a sibling worktree held `:4321`. That
  is a false green for the three email-link specs: GoTrue pins emailed links to `:4321` regardless
  of `E2E_BASE_URL`, so `staff-auth.spec.ts`'s reset and invite-accept and `staff-admin.spec.ts:76`
  followed their link into the sibling's server. Re-run on `:4321` with Playwright owning this
  worktree's dev server: 33/33, so those three did exercise this tree.

One known-stale line in this plan, left as-is rather than edited: Testing Strategy step 7 says
"disable JavaScript and load `/` — no overlay appears at all", which contradicts the plan's own
Implementation Approach ("that markup is present and visible but never hydrates … the form is what
keeps them working"). The Implementation Approach is what shipped, and it was verified with
JavaScript off: the overlay renders, its native form dismisses it and 303s back, and the footer
pill navigates. Step 7 is not a Progress row, so it gated nothing.
