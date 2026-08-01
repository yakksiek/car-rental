# Logo Update Implementation Plan

## Overview

Replace the current brand mark — a crimson `bg-primary` rounded-square badge with the letter **"F"** — with the committed **"motion van"** line-art mark (`assets/flota-mark.svg` from the Claude Design project) across every core surface. The swap is delivered through a new **reusable, containerless `<Brand>` component** (Astro + a React twin for the one island that needs it), and the favicon/app-icon is refreshed to a tiled version of the new mark. The **"Flota" wordmark stays as styled text**; the van replaces only the "F".

## Current State Analysis

- The brand mark is **not a component** — an "F"-on-crimson-square + "Flota" text lockup is **copy-pasted inline across 9 files / ~11 spots**, each with per-surface variations (size; `font-serif` vs sans; white-on-dark vs dark-on-light; mobile vs desktop). Full map in `## Key Discoveries`.
- The only brand image asset is `public/favicon.png` (32×32 crimson "F"), wired at `src/layouts/Layout.astro:21`.
- The new mark is monochrome **navy line-art** (`#162E4A`, `--flota-ink`), **no square container** — it recolors by context (ink on light, white on dark). Chosen from a 5-option preview and saved as `assets/flota-mark.svg` in the design project. Canonical spec in `design-review/index.md` + `design-contract.md`.
- No central SEO/head component exists; `Layout.astro` is the sole `<head>` owner. No `og:image`, manifest, `apple-touch-icon`, or `theme-color` today (all out of scope except apple-touch-icon + theme-color, which ride along with the favicon).

## Desired End State

Every user-facing surface renders the navy motion-van mark (containerless, tone-correct) beside the "Flota" wordmark; the browser tab and iOS home-screen show a legible tiled version of the mark. A future logo change is a **one-file edit** (`<Brand>` + the SVG source), because the mark is no longer duplicated. Verify by: loading each surface at mobile + desktop widths in light and dark contexts and seeing the van mark (not the "F" badge); confirming the favicon in a browser tab and the apple-touch icon; and `npm run build` + `npm run lint` + `npx astro check` all passing.

### Key Discoveries:

- **The ~11 spots to change** (from codebase research):
  - `src/components/SiteHeader.astro:34-39`
  - `src/components/LandingNav.astro:35-40` (desktop pill) and `:91-96` (mobile bar, dark → inverse)
  - `src/components/MobileNav.tsx:67-70` (React island — needs the React twin)
  - `src/components/SiteFooter.astro:13-19`
  - `src/pages/auth/signin.astro:86-91` (mobile band, dark → inverse) and `:104-109` (desktop card)
  - `src/components/auth/AuthShell.astro:39-44` (mobile band, dark → inverse) and `:57-62` (desktop card)
  - `src/components/shell/StaffShell.astro:68-73`
- **Mark asset:** `design-review/flota-mark.svg` — line-art van, `viewBox="-6 24 124 60"`, strokes with round caps; hardcodes `var(--flota-ink,#162E4A)` → rewire to `currentColor`.
- **Tone mapping + exact per-surface sizes:** `design-contract.md` → "Per-surface spec".
- **Wordmark stays text:** "Flota", Inter 700, tracking `-0.4px` — already how the app renders it; `<Brand>` reuses it, doesn't restyle it.
- **Lessons that apply:** design-system-first + port-exact-values + Design-Alignment-Audit gate (this plan) + rendered vision-diff (implement). The Latin-1/PDF encoding lesson does **not** apply (no text-into-font-bytes here). Button-cursor / RLS / locale lessons are unrelated.

## What We're NOT Doing

- **Not** touching the gradient hero **"FLOTA"** wordmark in `src/pages/index.astro:85-93` (a 122px gradient-clipped type centerpiece, not the mark).
- **Not** creating an OG/social-share image or a web app manifest (net-new infra; `site:` is unset — its own change if wanted).
- **Not** renaming **"FleetRent"** → anything in `src/lib/email/templates.ts`, `src/lib/email/resend.ts`, or `src/lib/media/protocol-pdf.ts` ("Flota" is the visible brand; "FleetRent" is the internal/email name).
- **Not** adding a dark _app theme_ — only the mark's per-context tone (the app has no dark theme).
- **Not** migrating `VehicleForm` or other unrelated refactors.

## Implementation Approach

Component-first: build and eyeball `<Brand>` in isolation (Phase 1), then do the mechanical ~11-spot swap against it (Phase 2), then the favicon/meta refresh (Phase 3). The mark is **inlined** as SVG (not an `<img>`) so `currentColor` drives tone and there's no extra request; the van path data lives in **one shared source** consumed by both the Astro and React renderers to avoid re-duplicating it.

## Critical Implementation Details

- **currentColor, not hardcoded ink.** The saved SVG uses `var(--flota-ink,#162E4A)`. Rewire the stroke to `currentColor` so a surface sets color via `text-foreground` (ink) or `text-white` (inverse). Do **not** reintroduce a fixed fill — that breaks the reversed (dark-surface) contexts.
- **One path source for two renderers.** `Brand.astro` and `Brand.tsx` must render the _same_ geometry. Keep the van's inner SVG markup in a single shared module (e.g. a `?raw` import of the SVG, or a small exported string/paths constant) rather than pasting the paths into both — otherwise the two drift.
- **Favicon is a raster-generation step.** `favicon.svg` is authored by hand (tile + white van), but `apple-touch-icon.png` (180) and the 32px PNG fallback must be **rasterized** from it (e.g. `rsvg-convert`, `sharp`, or `cairosvg`) — they can't be hand-written. Treat missing rasterizer as a blocker to flag, not a silent skip.

## Phase 1: Brand component + mark asset

### Overview

Bring the mark into the repo and build the reusable `<Brand>` component in both Astro and React, with no consumers wired yet — verifiable in isolation.

### Changes Required:

#### 1. Mark asset (shared source)

**File**: `src/components/brand/flota-mark.svg` (new) — and/or a shared raw import

**Intent**: Land the committed van mark in the repo as the single geometry source, rewired to `currentColor` so tone is caller-controlled.

**Contract**: SVG `viewBox="-6 24 124 60"`, all strokes `stroke="currentColor"` (remove `var(--flota-ink,#162E4A)`), `fill="none"`, round caps/joins preserved. Consumed by both renderers below via a single import path.

#### 2. `Brand.astro`

**File**: `src/components/brand/Brand.astro` (new)

**Intent**: The canonical brand lockup for all Astro surfaces — mark + optional "Flota" wordmark, containerless, tone- and size-driven.

**Contract**: Props — `variant?: "lockup" | "mark"` (default `lockup`), `tone?: "ink" | "inverse"` (default `ink`), `size?: number` (mark height px, default matches header ~34). Renders the inline van SVG at `size` height with `class={cn("...", tone === "inverse" ? "text-white" : "text-foreground")}`; when `variant="lockup"`, appends `<span>Flota</span>` (Inter 700, `tracking-tight`, sized proportionally). No background/badge element. Merge classes with `cn()`.

#### 3. `Brand.tsx` (React twin)

**File**: `src/components/brand/Brand.tsx` (new)

**Intent**: Same lockup for the one React island (`MobileNav.tsx`) so the mark isn't re-inlined in JSX.

**Contract**: Same prop API and visual output as `Brand.astro`, rendering the same shared van geometry. Client-safe (no Astro-only imports).

### Success Criteria:

#### Automated Verification:

- Type check passes: `npx astro check`
- Lint passes: `npm run lint`
- Build passes: `npm run build`
- Unit test: `Brand.tsx` renders both variants (`lockup` shows "Flota"; `mark` does not) and applies `text-white` for `tone="inverse"` — `npm test`

#### Manual Verification:

- Rendering `<Brand>` at `ink` and `inverse` tones on light and dark backgrounds shows a legible van (+ "Flota" for lockup) with no square container.
- Mark visually matches `design-review/flota-mark.svg` (stroke weights, proportions).

**Implementation Note**: After automated verification passes, pause for manual confirmation before Phase 2.

---

## Phase 2: Swap the ~11 core spots to `<Brand>`

### Overview

Replace the inline "F"-badge markup with `<Brand>` on every core surface, tone-correct per context, preserving each surface's current mark size.

### Changes Required:

#### 1. Public surfaces

**Files**: `src/components/SiteHeader.astro`, `src/components/LandingNav.astro` (2 spots), `src/components/SiteFooter.astro`, `src/components/MobileNav.tsx`

**Intent**: Swap each inline badge+wordmark for `<Brand>` (`.tsx` in `MobileNav`), using `tone="inverse"` on the LandingNav dark mobile bar and `tone="ink"` elsewhere.

**Contract**: Per-surface tone + mark height per `design-contract.md` "Per-surface spec". Leave footer tagline and `© Flota` copyright text untouched (they're wordmark text, not the mark). Preserve each link wrapper/`href` around the mark.

#### 2. Auth surfaces

**Files**: `src/pages/auth/signin.astro` (2 spots), `src/components/auth/AuthShell.astro` (2 spots)

**Intent**: Swap the mobile-band (dark → `inverse`) and desktop-card (`ink`) marks for `<Brand>`; keep the `Strefa pracownika` sub-labels and the `Powrót do flota.pl` link.

**Contract**: Mobile band mark height 42px `inverse`; desktop card 40px `ink`. The current `font-serif` on the "F" is dropped (van is an SVG). Sub-label text unchanged.

#### 3. Staff shell

**File**: `src/components/shell/StaffShell.astro`

**Intent**: Swap the sidebar-top badge+wordmark for `<Brand tone="ink">`; keep the dynamic `{roleLabel}` sub-label.

**Contract**: Mark height ~36px, `ink`. The `Flota` nav item (truck NavIcon → `/dashboard/fleet`) is a nav link, not the brand — do not touch it.

### Success Criteria:

#### Automated Verification:

- Type check passes: `npx astro check`
- Lint passes: `npm run lint`
- Build passes: `npm run build`
- No remaining inline "F" badge: `grep -rn "bg-primary" src --include=*.astro --include=*.tsx` shows none of the old brand-badge blocks (spot-check the 9 files)

#### Manual Verification:

- Each of the ~11 spots renders the van mark, correct tone (mark visible on both the light headers and the dark LandingNav mobile bar / auth mobile bands), at mobile + desktop widths.
- Rendered vision-diff of each surface against `design-review/index.md` lockup passes (per the design-fidelity lesson) — deviations limited to those recorded in `design-contract.md`.
- No layout shift/misalignment where the badge used to sit (header height, footer row, auth cards, staff sidebar).

**Implementation Note**: After automated verification passes, pause for manual confirmation before Phase 3.

---

## Phase 3: Favicon / apple-touch / theme-color

### Overview

Refresh the browser-tab and home-screen icon to the new mark on a legible crimson tile, and add the missing `apple-touch-icon` + `theme-color`.

### Changes Required:

#### 1. Favicon assets

**Files**: `public/favicon.svg` (new), `public/apple-touch-icon.png` (new, 180×180), `public/favicon-32x32.png` (new); remove `public/favicon.png`

**Intent**: Author an SVG favicon (white van centered on a rounded crimson `#B43638` tile) and rasterize the PNG variants from it.

**Contract**: `favicon.svg` = crimson `#B43638` rounded-rect tile + white (`#fff`) van from the shared geometry, centered with padding. PNGs rasterized from it (see Critical Implementation Details). Retire the old crimson-"F" `favicon.png`. Optional cleanup: delete unused `public/template.png`.

#### 2. Head wiring

**File**: `src/layouts/Layout.astro`

**Intent**: Point the icons at the new assets and add `apple-touch-icon` + `theme-color`.

**Contract**: Replace the `:21` favicon link with `rel="icon" type="image/svg+xml" href="/favicon.svg"` + a PNG fallback (`favicon-32x32.png`); add `<link rel="apple-touch-icon" href="/apple-touch-icon.png">` and `<meta name="theme-color" content="#B43638">`. Default `<title>` "Flota — …" unchanged.

### Success Criteria:

#### Automated Verification:

- Build passes and emits the new assets: `npm run build` then confirm `dist/` (or `public/`) contains `favicon.svg`, `apple-touch-icon.png`, `favicon-32x32.png`
- Old asset gone: `test ! -f public/favicon.png`
- Lint passes: `npm run lint`

#### Manual Verification:

- Browser tab shows the new tiled mark (legible on both light and dark tab bars).
- iOS "Add to Home Screen" shows the apple-touch icon; mobile browser chrome picks up `theme-color` crimson.
- Favicon reads clearly at 16–20px (the legibility reason for the tile).

**Implementation Note**: After automated verification passes, pause for final manual confirmation.

---

## Testing Strategy

### Unit Tests:

- `Brand.tsx`: `lockup` renders "Flota" text; `mark` does not; `tone="inverse"` applies `text-white`, `tone="ink"` applies `text-foreground`. (jsdom, `unit` project.)

### Integration Tests:

- None required — this is a presentational swap with no data/API/auth surface. (Existing integration suite must stay green as a regression check.)

### Manual Testing Steps:

1. `npm run dev`; visit `/`, `/fleet`, `/reserve`, `/auth/signin`, `/auth/forgot-password`, and a `/dashboard/*` page.
2. At **mobile** width: open the `MobileNav` overlay and the LandingNav mobile bar (dark) — mark legible and inverse where the background is dark.
3. At **desktop** width: header, footer, auth desktop card, staff sidebar — mark ink, containerless, aligned.
4. Confirm favicon in the tab + `theme-color`; on a phone, Add-to-Home-Screen for apple-touch.
5. Run the rendered vision-diff for each surface against `design-review/index.md`.

## Performance Considerations

Negligible — inline SVG is a few paths; removing the `<img>` favicon flow and badge markup is net-neutral. Inlining the mark twice (Astro + React) is byte-trivial; the React island's bundle grows by one small component only where `MobileNav` already ships.

## Migration Notes

No data migration. Asset migration only: `public/favicon.png` → `favicon.svg` + PNGs. Rollback = restore the old `favicon.png` link and revert the `<Brand>` swaps (pure UI, no state).

## References

- Canonical design: `context/changes/logo-update/design-review/` (mark SVG + lockup spec)
- Design contract (exact values): `context/changes/logo-update/design-contract.md`
- Design system index: `context/foundation/design-system.md`
- Fidelity lessons: `context/foundation/lessons.md` ("Port the design spec …", "End every UI-touching plan with a Design Alignment Audit gate")

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Brand component + mark asset

#### Automated

- [x] 1.1 Type check passes: `npx astro check` — 5cd1317
- [x] 1.2 Lint passes: `npm run lint` — 5cd1317
- [x] 1.3 Build passes: `npm run build` — 5cd1317
- [x] 1.4 Unit test: `Brand.tsx` variants + tone — `npm test` — 5cd1317

#### Manual

- [x] 1.5 `<Brand>` renders legibly at ink/inverse on light+dark, no container — 5cd1317
- [x] 1.6 Mark matches `design-review/flota-mark.svg` — 5cd1317

### Phase 2: Swap the ~11 core spots to `<Brand>`

#### Automated

- [x] 2.1 Type check passes: `npx astro check`
- [x] 2.2 Lint passes: `npm run lint`
- [x] 2.3 Build passes: `npm run build`
- [x] 2.4 No remaining inline brand-badge blocks in the 9 files (grep spot-check)

#### Manual

- [x] 2.5 All ~11 spots render the van, correct tone, mobile + desktop
- [x] 2.6 Rendered vision-diff vs `design-review/index.md` passes (only recorded deviations)
- [x] 2.7 No layout shift where the badge used to sit

### Phase 3: Favicon / apple-touch / theme-color

#### Automated

- [ ] 3.1 Build emits `favicon.svg`, `apple-touch-icon.png`, `favicon-32x32.png`
- [ ] 3.2 Old asset gone: `test ! -f public/favicon.png`
- [ ] 3.3 Lint passes: `npm run lint`

#### Manual

- [ ] 3.4 Tab favicon legible on light + dark tab bars
- [ ] 3.5 apple-touch icon + `theme-color` verified on device
- [ ] 3.6 Favicon reads clearly at 16–20px
