# Canonical screenshots — staff-search-dashboard-only

**Status: not captured, by decision (2026-08-17). This folder is intentionally empty.**

The rendered vision-diff gate (`lessons.md` → "Port the design spec … with a vision-diff
gate", Progress row 4.6) was closed unrun for this change. Full reasoning is in
`../change.md`; in short:

- Every value in `../design-contract.md` was transcribed from the **code-backed JSX** via
  `DesignSync get_file`, not measured off a screenshot. The gate exists to catch the lossy
  _prose distillation_ of a mockup — ranges like "cards 14–18px" that read as implementer
  license. That never happened here, so a diff would have re-verified the transcription
  rather than the design.
- The gate **would have passed this change's one real defect.** D19 — the invisible active
  row in the mobile overlay — is equally invisible in the mock, because no mobile screen
  passes `active`. Both sides render no active row and the diff comes back clean. Reading
  the source found it; comparing renderings could not have.
- Almost all of this change is removal. The genuinely new drawing — the vehicle row's spec
  line, the 44×44 hero magnifier, the topbar right-group reorder — was walked by hand at
  1440×900 and 390×844.

**What this leaves unverified:** cumulative metric drift — a value correct in both files
that renders differently through a cascade collision or an inherited letter-spacing.
Accepted.

`../design-export-request.md` is retained and still accurate if the gate is ever wanted:
run it in the Design app, drop the ten `v2-` PNGs here, and diff against the surfaces in
`../design-contract.md`, expecting only the recorded deviations (D9, D10, D16, D19, N1–N3)
and the two "Known deltas".

The 8 superseded PNGs that used to sit in `../../staff-global-search/design-review/` were
deleted in the same pass — two of them rendered `ScreenSearchResultsPage`, a screen that
exists in neither the app nor the design. Git keeps the blobs; deleting only stops them
being read as current.
