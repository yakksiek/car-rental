# Public Mobile Nav Alignment — Plan Brief

> Full plan: `context/changes/public-mobile-nav-alignment/plan.md`
> Research: `context/changes/public-mobile-nav-alignment/research.md`

## What & Why

On phones, the landing page opens its navigation as a small dark dropdown. Every other public page opens a full-screen overlay. The two menus differ in size, colour, close behaviour, scroll locking, and accessibility. This plan makes the landing page use the shared overlay, in a dark tone that fits its hero, so all nine public pages behave the same.

## Starting Point

`LandingNav.astro` is a deliberate July fork of the public header with a native `<details>` dropdown. The other eight public pages render `SiteHeader.astro`, which mounts the `MobileNav.tsx` React island. The header's other two controls, `ActionMenu` and `LangToggle`, already take a `tone="dark"` prop for the landing. `MobileNav` is the only header control without one, which is why the fork survived.

## Desired End State

Tapping the hamburger on the landing page opens the same full-screen menu as on `/fleet`: five icon-and-label links, a close button, Escape to close, body scroll locked. On the landing it is dark (`#0A0D14`) with white links and a crimson active item. On the other pages nothing changes. One Playwright spec at phone width proves the menu opens and navigates on both the landing and `/fleet`.

## Key Decisions Made

| Decision             | Choice                                                                | Why (1 sentence)                                                                                       | Source          |
| -------------------- | --------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ | --------------- |
| Target               | Option A: reuse the app's overlay, not the design's `PublicDock`      | Direct fix for the reported inconsistency; the dock is a larger, all-pages change                      | Research + user |
| Tone on the landing  | Dark trigger and dark overlay; other pages stay light                 | The landing header sits on a dark hero, and tone already follows the header for the other two controls | User            |
| Active item on dark  | Crimson `text-primary`, same as light                                 | One rule for both overlays; 3.3:1 passes WCAG AA for the 30px bold text                                | Plan            |
| Brand lockup on open | Dark row copies the landing bar's inset and mark size                 | Same principle the light row applies to `SiteHeader`; otherwise the brand jumps                        | Plan            |
| Dialog semantics     | Overlay gets `role="dialog"`, `aria-modal`, name "Menu"               | It is a modal with scroll lock; also gives the e2e a role locator                                      | Plan            |
| Mockup               | Draft a dark-overlay board in the Claude Design project before coding | The design never drew an opened menu; the user wants a real mockup-vs-render gate                      | User            |
| E2E viewport         | Per-file `test.use({ viewport })`, no new Playwright project          | Smallest change; matches the per-file anonymous opt-out idiom                                          | Plan            |

## Scope

**In scope:**

- `tone` prop on `MobileNav.tsx` (trigger, overlay surface, header row, brand tone, link colours)
- `role="dialog"` on the overlay
- `LandingNav.astro` mounts the island and drops its `<details>` block
- Comment rewrites in `LandingNav.astro`; note in `context/foundation/design-system.md`
- Design contract with the audit, the drafted mockup, and recorded deviations
- One e2e spec at 390×844 for `/` and `/fleet`

**Out of scope:**

- The design's `PublicDock` bottom pill; removing the hamburger from `SiteHeader`
- Any change to the light overlay's look, the landing desktop pill, or the tablet band
- A dark `ActionMenu` panel; a phone row in the overlay; a mobile Playwright project; the design's `InfoButton`

## Architecture / Approach

Extend, swap, prove. `MobileNav` gains a `tone` prop following the exact shape `ActionMenu` and `LangToggle` use: optional, default light, one boolean, class swaps through `cn()`. Because the default is light, the eight `SiteHeader` pages cannot change. `LandingNav` then mounts the island with `tone="dark"` in place of its dropdown. The overlay stays rendered inline at `z-[60]` inside the landing header's `z-40` wrapper, which is safe because nothing else on the page sits above `z-40`. The e2e addresses the overlay by its new dialog role.

## Phases at a Glance

| Phase                             | What it delivers                                                                       | Key risk                                                                         |
| --------------------------------- | -------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| 1. `MobileNav` learns a dark tone | The prop, dark classes, dialog semantics; no page changes appearance                   | A light-column edit slips in and `/fleet` changes                                |
| 2. Landing swap                   | Landing uses the overlay; comments and design index updated; vision-diff vs the mockup | Brand lockup jumps on open if the dark row's metrics are off                     |
| 3. Phone-width e2e                | One spec proving open, navigate, Escape on `/` and `/fleet`                            | Interacting before hydration; footer "Pricing" link colliding with the overlay's |

**Prerequisites:** the drafted mockup in `design-review/` (produced by the Design Alignment Audit at planning time); a dev server on port 4321 from this worktree for the e2e.
**Estimated effort:** one session across three phases.

## Open Risks & Assumptions

- Assumes "make it dark" means dark on the landing only. If the user meant dark everywhere, Phase 1's default flips and `SiteHeader` needs a `tone` too.
- The dark row's brand values are read from `LandingNav.astro:200` at implementation time; the plan's table is a transcription and the file wins.
- The dev server can serve a stale island after the new import; the production build is the truth.

## Success Criteria (Summary)

- A phone visitor sees one menu design across the whole public site, dark on the landing, light elsewhere.
- `/fleet`'s menu after the change is pixel-identical to the render captured before it.
- The e2e opens the menu, reaches `/pricing`, and closes with Escape on both pages.
