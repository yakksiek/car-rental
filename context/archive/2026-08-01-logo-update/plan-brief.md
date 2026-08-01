# Logo Update — Plan Brief

> Full plan: `context/changes/logo-update/plan.md`
> Design contract: `context/changes/logo-update/design-contract.md`
> Canonical design: `context/changes/logo-update/design-review/`

## What & Why

Replace Flota's brand mark — today a crimson square badge with the letter **"F"** — with the committed **"motion van"** line-art mark across every surface, delivered through a new reusable `<Brand>` component so the mark stops being copy-pasted in ~11 places. The "Flota" wordmark stays as text; the van replaces only the "F".

## Starting Point

The mark is **not a component** — an "F"-on-crimson-square + "Flota" lockup is duplicated inline across 9 files / ~11 spots, each with its own size/tone/font variations. The only image asset is `public/favicon.png` (crimson "F"). No `<Brand>` component, no apple-touch-icon, no theme-color exist today.

## Desired End State

Every surface shows the **navy motion-van mark** (line-art, no container) that recolors by context — ink on light, white on dark — beside the "Flota" wordmark. The favicon/app-icon shows a legible tiled version. Any future logo change becomes a one-file edit.

## Key Decisions Made

| Decision        | Choice                                                 | Why                                                              | Source |
| --------------- | ------------------------------------------------------ | ---------------------------------------------------------------- | ------ |
| Scope of "logo" | New image mark on core surfaces + favicon              | User wants a real mark, not a recolor; hero/OG/manifest excluded | Plan   |
| Which mark      | "motion van" `flota-mark.svg` (navy, monochrome)       | It's the committed asset in the design project                   | Design |
| Container       | **None** on all lockups (badge removed)                | The chosen direction is containerless; mark recolors by tone     | Design |
| Structure       | Extract one `<Brand>` component (Astro + React twin)   | Kills the ~11× duplication; future changes are one-file          | Plan   |
| Wordmark        | Stays as styled "Flota" text                           | Van replaces only the "F"; wordmark already correct in-app       | Design |
| Favicon         | White van on a rounded **crimson tile** (favicon only) | Bare line-art van vanishes at 16–20px / on dark tabs             | Plan   |
| Out of scope    | Hero "FLOTA" wordmark, OG/manifest, FleetRent rename   | Keep the change focused on the mark                              | Plan   |

## Scope

**In scope:** the ~11 core mark spots (header/nav/footer/auth/shell); a reusable `<Brand>` component; favicon.svg + apple-touch-icon + 32px PNG + theme-color.

**Out of scope:** gradient hero "FLOTA" wordmark; OG/social image + web manifest; "FleetRent" name in emails/PDFs; any dark app theme.

## Architecture / Approach

One shared van-SVG geometry (rewired to `currentColor`) feeds a `Brand.astro` and a `Brand.tsx` twin (for the `MobileNav` island), both with `variant` (lockup|mark), `tone` (ink|inverse), `size` props and **no badge container**. Surfaces consume `<Brand>`; the favicon is a separately-authored tiled asset.

## Phases at a Glance

| Phase                           | What it delivers                             | Key risk                                                          |
| ------------------------------- | -------------------------------------------- | ----------------------------------------------------------------- |
| 1. Brand component + asset      | `<Brand>` (Astro + React) + van mark in repo | Two renderers drifting → keep one shared geometry source          |
| 2. Swap ~11 core spots          | Every surface renders the van, tone-correct  | Missing a mobile/dark/serif variant; layout shift where badge was |
| 3. Favicon / apple-touch / meta | Tiled favicon + apple-touch + theme-color    | PNG rasterization needs a tool (rsvg/sharp/cairosvg)              |

**Prerequisites:** the mark asset is in hand (`design-review/flota-mark.svg`); a raster tool for Phase 3 PNGs.
**Estimated effort:** ~1 session across 3 phases (mostly mechanical once `<Brand>` exists).

## Open Risks & Assumptions

- Assumes `MobileNav` overlay + auth desktop cards are light backgrounds (tone `ink`) — verify at implement.
- Favicon tile color is crimson `#B43638` (brand equity + contrast); swap to navy if preferred at implement.
- Ink-token deviation: app uses `#0F172A` via `currentColor` rather than the design's `#162E4A` (1-shade navy diff) — recorded in the contract.

## Success Criteria (Summary)

- Every core surface shows the containerless van mark at the right tone, mobile + desktop, with no layout shift.
- Favicon/app-icon legible at 16–20px on light and dark tab bars.
- `npm run build`, `npm run lint`, `npx astro check` green; rendered vision-diff matches the lockup (only recorded deviations).
