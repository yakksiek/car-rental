# Canonical design — logo-update

Source: Claude Design project `Rental car company`
(`352d78a6-84fd-49a2-8b38-2fe289691fc3`), pulled via `DesignSync` on 2026-08-01.

The new logo is **code-backed** (SVG + a rendered lockup preview), which is a
stronger canonical than a screenshot — exact stroke geometry and colors transcribe
directly. This folder is the canonical reference for the change; the rendered
vision-diff at implement time compares the built `<Brand>` against the lockup below.

## Chosen mark — "motion van"

- **Asset:** `flota-mark.svg` (in this folder) — extracted and committed in the design
  project as `assets/flota-mark.svg`. This is the pick, chosen from a 5-option mark
  preview (`Flota Mark Preview.html`: stack / **motion** / wheel / mono / emblem).
- **Form:** line-art van (stroke, no fill) — three "speed streak" lines + a box-van
  silhouette with a sloped hood + two wheel circles. `stroke-linecap`/`linejoin: round`.
- **Color:** navy ink `#162E4A` (`--flota-ink`) — **monochrome, no crimson** in the mark.
  Saved SVG hardcodes `var(--flota-ink,#162E4A)`; rewire to `currentColor` in-app so
  tone is controlled by the surface.
- **viewBox:** `-6 24 124 60`.

## Lockup spec (from `Flota Mark Preview.html`, "motion" row)

| Context    | Composition                              | Color                        | Container |
| ---------- | ---------------------------------------- | ---------------------------- | --------- |
| lockup     | mark (h≈44px) + "Flota" wordmark (~24px) | ink `#162E4A`                | **none**  |
| reversed   | mark (h≈40px) + "Flota" (~22px)          | white `#fff` on navy surface | **none**  |
| 34px       | mark only                                | ink                          | **none**  |
| 20px (fav) | mark only                                | ink                          | **none**  |

Wordmark = "Flota", Inter, weight 700, letter-spacing ≈ -0.4px (matches the existing
in-app wordmark styling). The mark replaces only the "F" badge; the wordmark stays text.

## The one deliberate deviation — favicon tile

The preview renders the favicon as the **bare** van (no container) even at 20px. A
line-art van that small vanishes in a browser tab, and navy strokes disappear on dark
tab bars. Per product decision (2026-08-01), the favicon/app-icon — and only those —
place the mark **reversed (white) on a rounded crimson `#B43638` tile**. Recorded as
`deviation(favicon legibility)` in `design-contract.md`.
