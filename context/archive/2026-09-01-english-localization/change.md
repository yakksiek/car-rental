---
change_id: english-localization
title: English localization — a full second locale across app, artifacts, and grammar
status: archived
created: 2026-09-01
updated: 2026-09-05
archived_at: 2026-09-05T10:45:27Z
---

## Notes

Un-parks PRD Non-Goal §"No multi-language support. Polish only in v1. English deferred to a later
phase." (`context/foundation/prd.md:154`) and the landing-redesign's explicitly-cut PL·EN toggle
(`context/archive/2026-07-28-landing-redesign/plan.md:78`).

Driver is the **portfolio/recruiter** reader, not the rental customer — which is what makes the
whole-app scope (staff cockpit included) correct. Requirement as stated by the user: "Everything,
literally everything should be english when the english is switched on."

Framed in `frame.md` — 6 dimensions investigated, 7 product decisions settled 2026-09-01.

Implementation review 2026-09-05: 8 warnings, 2 observations, no critical. All ten findings were
carried into the plan as Phases 9–13 (`reviews/impl-review.md`) and all five are now complete and
SHA-stamped.

Phase 12's vision-diff found one real defect the earlier gates had passed over since Phase 3: the
brand mark was sized on the wrong axis (`h-10` where the design's `<FlotaMark size={40} />` means
40px WIDE), drawing the van 2.07× too large on `SiteHeader`, `SiteFooter` and the mobile drawer.
Fixed against the pulled `info-pages.jsx`; the re-run came back empty.

One row is deliberately unticked: **11.4** (CI green on a pushed branch, with the i18n sweep visible
in the job log). The sweep itself is verified locally in both modes and proven to exit 1 on a hit —
only the CI-log sighting is outstanding.
