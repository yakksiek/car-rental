# Homepage Cosmic Redesign — Plan Brief

> Full plan: `context/changes/redesign/plan.md`
> Research: `context/changes/redesign/research.md`

## What & Why

Replace the current tech-stack showcase homepage with a simple, impactful landing page featuring a cosmic/space aesthetic inspired by 10xDevs.pl. The current Welcome.astro lists library versions with badges — useful for developers but not a proper landing page for visitors.

## Starting Point

The homepage is a thin wrapper (`index.astro` → `Layout` + `Welcome.astro`) where Welcome.astro imports package.json files to extract version numbers and displays them in categorized LibBadge lists. The project already has a consistent dark gradient + glassmorphism design system across all pages (auth, dashboard) which serves as a solid foundation.

## Desired End State

A clean cosmic landing page with a deep space background, static glowing orbs, and star-like CSS dots. A bold hero section with an English heading, subtitle, and two CTA buttons (Sign In / Sign Up) leads into 2-3 glassmorphic feature cards highlighting the starter's key capabilities (Auth, Stack, DX). Zero new dependencies — all effects are CSS-only.

## Key Decisions Made

| Decision           | Choice                             | Why (1 sentence)                                          | Source |
| ------------------ | ---------------------------------- | --------------------------------------------------------- | ------ |
| Content language   | English                            | Broadest reach, fits the starter template positioning     | Plan   |
| Homepage content   | Hero + 3 feature cards             | Communicates value proposition beyond just aesthetics     | Plan   |
| Cosmic effects     | Subtle and static                  | Clean, performant, no motion-sensitivity concerns         | Plan   |
| Typography         | System fonts (no custom)           | Zero added weight, no external dependencies               | Plan   |
| Topbar             | Keep as-is                         | Already fits the dark theme, reduces scope                | Plan   |
| CTA implementation | Plain `<a>` tags, not React Button | Static links need no hydration; follows Astro conventions | Plan   |
| Icons in cards     | Inline SVG                         | Avoids React hydration for static content                 | Plan   |

## Scope

**In scope:**

- Complete rewrite of `Welcome.astro` (cosmic background, hero, CTAs, feature cards)
- Static cosmic decorations (glowing orbs, star dots) via CSS
- Responsive design down to mobile

**Out of scope:**

- Layout.astro, auth pages, dashboard changes
- Topbar redesign
- CSS animations or keyframe effects
- Custom web fonts
- New npm dependencies

## Architecture / Approach

Single-component rewrite: `Welcome.astro` is the only file that changes. The page structure (`index.astro` → Layout + Welcome`) stays intact. Cosmic decorations use absolutely-positioned blurred divs for orbs and CSS `radial-gradient` background-image for stars. Feature cards reuse the existing glassmorphism pattern. No React islands — the entire homepage is a pure Astro component.

## Phases at a Glance

| Phase                      | What it delivers                                              | Key risk                                                |
| -------------------------- | ------------------------------------------------------------- | ------------------------------------------------------- |
| 1. Cosmic hero section     | Deep space background, cosmic orbs/stars, hero heading + CTAs | Visual balance of orb placement and background darkness |
| 2. Feature cards + cleanup | 3 glassmorphic cards (Auth, Stack, DX) below hero             | Card layout on mobile, consistency with hero aesthetic  |

**Prerequisites:** None — all design system pieces are already in place
**Estimated effort:** ~1 session across 2 phases

## Open Risks & Assumptions

- CSS `filter: blur()` on large orbs may render differently across browsers — test Chrome, Firefox, Safari
- Star-dot density via `radial-gradient` needs visual tuning — too many looks noisy, too few looks empty
- Feature card copy is provisional — may need refinement after visual review

## Success Criteria (Summary)

- Homepage at `/` shows a cosmic-themed landing page with hero + CTAs + feature cards
- All auth links (Sign In, Sign Up) work correctly from the homepage
- Page is responsive and looks good on mobile, tablet, and desktop
