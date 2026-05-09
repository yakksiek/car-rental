---
date: "2026-05-08T12:59:43Z"
researcher: Claude
git_commit: 7da500b2b01f36b3431795e975f125fd74c93957
branch: master
repository: 10x-astro-starter
topic: "Redesign index page with simple cosmic aesthetic inspired by 10xDevs.pl"
tags: [research, codebase, redesign, homepage, cosmic-ui, tailwind, astro]
status: complete
last_updated: "2026-05-08"
last_updated_by: Claude
---

# Research: Redesign index page with simple cosmic aesthetic

**Date**: 2026-05-08T12:59:43Z
**Researcher**: Claude
**Git Commit**: 7da500b2b01f36b3431795e975f125fd74c93957
**Branch**: master
**Repository**: 10x-astro-starter

## Research Question

Redesign `src/pages/index.astro` — the current design is a tech-stack showcase that feels cluttered. The goal is a simple, impactful landing page with a "cosmic" vibe inspired by [10xDevs.pl](https://10xdevs.pl).

## Summary

The current homepage (`Welcome.astro`) is a tech-stack listing with version badges — functional but not a proper landing page. The project already uses a dark gradient + glassmorphism design system consistently across all pages, which is a solid foundation for a cosmic redesign. 10xDevs.pl achieves its cosmic feel through a deep navy/black (#0a0e27) background, scattered SVG ellipse decorations, purple gradient accents, bold typography, and generous whitespace. The redesign should simplify the homepage to a hero-first layout with cosmic ambient elements (star field, glowing orbs), a strong heading, and clear CTAs — leveraging the existing Tailwind 4 + tw-animate-css stack without adding heavy dependencies.

## Detailed Findings

### Current Homepage Architecture

**File chain**: `src/pages/index.astro` → `Layout.astro` + `Welcome.astro`

- `index.astro` (`src/pages/index.astro:1-8`) is a thin wrapper rendering `<Welcome />` inside `<Layout>`
- `Welcome.astro` (`src/components/Welcome.astro:1-108`) contains all the visual content:
  - Full-screen gradient background: `from-indigo-900 via-purple-900 to-blue-900`
  - `Topbar.astro` for auth-aware navigation
  - A glassmorphic card (`max-w-4xl`, `backdrop-blur-xl`, `bg-white/10`) with:
    - Hero heading: "Witaj w 10xDevs Astro Starter!" (text-6xl, gradient text)
    - Three category sections (Core, Styling, Code Analysis) each listing libraries with `LibBadge` components
    - Closing tagline
- `Layout.astro` (`src/layouts/Layout.astro:1-50`) provides the HTML shell, viewport meta, favicon, title, and config error banners

**Problem**: The page is an internal developer reference, not a user-facing landing page. It lists library versions — useful for devs but not for onboarding visitors.

### 10xDevs.pl Design Analysis (Inspiration Source)

The 10xDevs.pl landing page achieves a "cosmic" aesthetic through these techniques:

| Element                | Implementation                                                                                           |
| ---------------------- | -------------------------------------------------------------------------------------------------------- |
| **Background**         | Deep space navy/black (~#0a0e27), much darker than current indigo-900                                    |
| **Cosmic decorations** | SVG ellipses with blur/opacity scattered via absolute positioning — visual metaphor for stars/nebulae    |
| **Color accents**      | Purple/violet gradients on decorative borders and interactive elements                                   |
| **Typography**         | Bold modern sans-serif, substantial size hierarchy (48-56px h1, 36-40px h2), generous line-height (1.6+) |
| **Whitespace**         | Abundant vertical padding (60-120px between sections), creating a sense of expansiveness                 |
| **Cards/sections**     | Subtle borders (`border: 1px solid rgba(255,255,255,0.1)`), dark backgrounds                             |
| **CTAs**               | Purple/violet buttons, likely hover effects with scale/color shift                                       |
| **Hero**               | Large heading + countdown + CTA, high contrast white on dark                                             |
| **Narrative framing**  | Modules as "missions" / "orbits" — journey metaphor                                                      |

**Key takeaway**: The cosmic feel comes from (1) very dark background, (2) scattered ambient light elements, (3) purple-dominant accents, (4) lots of breathing room, and (5) confident, bold typography. It is _not_ achieved through heavy 3D effects or particle.js-style libraries.

### Available Design System & Components

**Tailwind 4 setup** (configured in `src/styles/global.css` via `@theme inline`):

- OKLCH color tokens for light/dark mode (semantic: `--background`, `--foreground`, `--primary`, etc.)
- Custom radius scale (`--radius: 0.625rem`)
- `tw-animate-css` for animation utilities (already installed)
- No custom fonts — uses system sans-serif stack

**shadcn/ui components** available in `src/components/ui/`:

- `button.tsx` — CVA-based with variants: default, destructive, outline, secondary, ghost, link; sizes: default, sm, lg, icon
- `LibBadge.astro` — custom library version badge (monospace, blue/purple pills)

**Reusable patterns across the app**:

- Glassmorphism: `backdrop-blur-xl bg-white/10 border border-white/10 rounded-2xl`
- Gradient text: `bg-gradient-to-r from-blue-200 via-purple-200 to-pink-200 text-transparent bg-clip-text`
- Page backgrounds: `from-indigo-900 via-purple-900 to-blue-900`
- Link styling: `text-purple-300 hover:text-purple-100 hover:underline transition-colors`
- Form inputs: `bg-white/10 border-white/20 rounded-lg focus:ring-purple-400`

**Icons**: lucide-react (already a dependency)

### Page & Navigation Structure

| Route                 | File                            | Auth Required | Design Pattern                       |
| --------------------- | ------------------------------- | ------------- | ------------------------------------ |
| `/`                   | `index.astro` → `Welcome.astro` | No            | Gradient bg + Topbar + wide card     |
| `/dashboard`          | `dashboard.astro`               | Yes           | Gradient bg + centered card          |
| `/auth/signin`        | `auth/signin.astro`             | No            | Gradient bg + narrow card (max-w-sm) |
| `/auth/signup`        | `auth/signup.astro`             | No            | Gradient bg + narrow card (max-w-sm) |
| `/auth/confirm-email` | `auth/confirm-email.astro`      | No            | Gradient bg + narrow card            |

**Topbar** (`src/components/Topbar.astro`): Glassmorphic bar with conditional auth state — shows user email + dashboard link + sign out (authenticated) or "Not signed in" + sign in/sign up links (unauthenticated). Uses `text-purple-300` for links. Only appears on the homepage currently.

**Middleware** (`src/middleware.ts`): Protects `/dashboard`, attaches `context.locals.user`. No impact on homepage redesign.

### Font Situation

No custom fonts are loaded anywhere — Layout.astro has no font imports, global.css has no @font-face rules. The entire app uses Tailwind's default system font stack. For a cosmic redesign, adding a modern sans-serif like Inter or Space Grotesk (space-themed name is a bonus) would significantly elevate the typography.

## Code References

- `src/pages/index.astro:1-8` — Homepage entry point (thin Layout + Welcome wrapper)
- `src/components/Welcome.astro:1-108` — Current homepage content (tech-stack showcase)
- `src/components/Topbar.astro` — Auth-aware navigation bar
- `src/components/ui/LibBadge.astro` — Library version badge component
- `src/components/ui/button.tsx` — shadcn Button (CVA variants)
- `src/layouts/Layout.astro:1-50` — HTML shell, global CSS import, Banner rendering
- `src/styles/global.css` — Tailwind 4 theme tokens (OKLCH), base resets, tw-animate-css
- `src/lib/utils.ts` — `cn()` helper (clsx + tailwind-merge)
- `src/middleware.ts` — Auth middleware, protected routes list
- `src/pages/dashboard.astro` — Protected page (design reference)
- `src/pages/auth/signin.astro` — Sign-in page (design reference)

## Architecture Insights

### What to keep

1. **Gradient + glassmorphism pattern** — used consistently across all pages. The redesign should evolve this, not replace it.
2. **Topbar component** — auth-aware navigation should remain on the homepage, possibly restyled.
3. **Layout.astro** — no changes needed; it's a clean shell.
4. **Tailwind 4 OKLCH tokens** — the semantic color system is ready for dark-mode if needed later.

### What to change

1. **Replace Welcome.astro content** — swap tech-stack listing for a hero-first landing page.
2. **Deepen the background** — shift from `indigo-900/purple-900/blue-900` toward a darker, more space-like palette (closer to 10xDevs.pl's ~#0a0e27).
3. **Add cosmic ambient elements** — CSS-only star field (radial-gradient dots or pseudo-elements), glowing orbs via positioned blurred divs, subtle CSS animations.
4. **Add a custom font** — Space Grotesk or Inter via Google Fonts / Fontsource for a modern, slightly futuristic feel.
5. **Simplify content** — hero heading, one-line subtitle, two CTAs (sign in / sign up or explore), minimal supporting content.
6. **Enhance Topbar** — possibly add a subtle logo or project name, maintain glassmorphism.

### Design direction: "Cosmic minimalism"

- Very dark background with subtle depth (layered gradients)
- 2-3 glowing orbs (blurred, semi-transparent purple/blue circles) positioned absolutely as cosmic decoration
- CSS-only star field using `background-image: radial-gradient()` with multiple positions
- Bold, confident hero text with gradient coloring
- Maximum two sections visible above the fold: hero + CTA
- Optional: subtle `@keyframes` float animation on orbs using tw-animate-css or custom CSS

### Technical approach

- **No new JS dependencies** — all cosmic effects achievable with CSS (gradients, pseudo-elements, blur filters, animations)
- **Astro component** — the homepage is static content; no React island needed
- **Responsive** — mobile-first, orbs hidden or scaled on small screens
- **Performance** — CSS-only effects are GPU-accelerated and add zero bundle weight

## Historical Context (from prior changes)

No prior changes found in `context/changes/` or `context/archive/` related to homepage design or UI redesign.

## Related Research

No related research artifacts found.

## Open Questions

1. **Content language**: Current homepage is in Polish ("Witaj w 10xDevs Astro Starter!"). Should the redesign stay in Polish or switch to English?
2. **Content scope**: Should the redesigned homepage mention the tech stack at all (e.g., small footer badges), or go fully minimal with just a hero + CTAs?
3. **Topbar redesign**: Should the Topbar get a visual refresh as part of this change, or remain as-is?
4. **Custom font**: Is adding a web font (Space Grotesk, Inter) acceptable, or should we stick with system fonts for performance?
5. **Animation intensity**: Should cosmic elements be static, have subtle CSS animations, or more dynamic effects?
