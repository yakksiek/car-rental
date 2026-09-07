---
change_id: fleet-page-layout-parity
title: Public fleet page layout does not match the design mockup
status: archived
created: 2026-09-06
updated: 2026-09-07
archived_at: 2026-09-07T13:05:00Z
---

## Notes

Fix the fleet page view inconsistencies between the mockup and the implemented layout.

Assumed scope: the public customer fleet page at `/fleet` (`src/pages/fleet/index.astro`) and,
if the same drift shows there, the vehicle detail page (`src/pages/fleet/[id]/[...slug].astro`).
The staff fleet management screens under `/dashboard` are a separate surface and are out of
scope unless stated otherwise.

Design source of truth: the live Claude Design project `Rental car company`
(`352d78a6-84fd-49a2-8b38-2fe289691fc3`), pulled with `DesignSync get_file`. Repo screenshots
are for the glance only: `context/foundation/design/screenshots/02-customer-mobile-fleet.png` and
`08-customer-desktop-fleet-browse.png`. Read `context/foundation/design-system.md` and the
per-slice design workflow in `context/foundation/lessons.md` before changing anything.

Worktree: `.claude/worktrees/fix-fleet-page-layout-parity` on branch
`worktree-fix-fleet-page-layout-parity`.
