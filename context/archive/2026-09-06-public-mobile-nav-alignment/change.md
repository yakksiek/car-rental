---
change_id: public-mobile-nav-alignment
title: Landing page mobile menu is a dropdown while other public screens open a full-screen overlay
status: archived
created: 2026-09-06
updated: 2026-09-06
archived_at: 2026-09-06T17:22:59Z
---

## Notes

Public screens only. The staff panel has its own navigation and is out of scope.

On mobile, the shared public header (`SiteHeader.astro` → `MobileNav.tsx`) opens a full-screen
navigation overlay. The landing page uses a forked header (`LandingNav.astro`) whose mobile menu is a
small `<details>` dropdown. The two do not match. This change researches the split and what aligning
the landing page with the rest of the public screens would take.

Worktree: `.claude/worktrees/fix-mobile-header-nav` on branch `worktree-fix-mobile-header-nav`.

## Decisions

- **2026-09-06 — Option A chosen.** Reuse the shared `MobileNav` overlay on the landing page instead of
  building the design's `PublicDock` (Option B stays a possible follow-up slice). See `research.md` §5.
- **Overlay tone on the landing: dark.** The landing mounts `MobileNav` with `tone="dark"`, which
  darkens both the hamburger trigger and the opened overlay to sit on the dark hero. The other eight
  public pages keep the light overlay. Tone follows the header it opens from, like `ActionMenu` and
  `LangToggle`. There is no mockup for the opened state on either tone; both stay
  `deviation(overlay-undesigned)`.
