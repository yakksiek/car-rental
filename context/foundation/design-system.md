---
project: FleetRent (Flota)
version: 1
status: active
created: 2026-06-03
source: Claude Design export
---

# Design System — Flota

Canonical design reference for the FleetRent UI, exported from Claude Design.
**Read this first when planning any user-facing slice** — then open only the
screenshot(s) and source file(s) for the slice you're building. Don't load the
whole `design/` folder into context; this index exists so you don't have to.

## What's where

| Artifact | Path | Role |
| --- | --- | --- |
| **Live tokens** | `src/styles/global.css` | ✅ applied — the source of truth that ships. Tailwind 4 `@theme` + shadcn vars. |
| Token source | `context/foundation/design/tokens.css` | Reference copy of the export (3-layer: primitives → shadcn → `@theme`). |
| Screenshots | `context/foundation/design/screenshots/*.png` | Rendered screens — the cheap visual reference. **Prefer these.** |
| Screen source (JSX) | `context/foundation/design/*-screens*.jsx`, `shared.jsx` | Static React prototype. Reference for exact spacing/structure only — **not** app code; do not import. |

> The Claude Design *canvas chrome* (design-canvas / tweaks-panel / device frames)
> was removed after rendering — it was tooling, not design. `Flota Rental.html`
> remains but no longer renders standalone (it referenced that chrome); the
> screenshots are the canonical visual record.

## Tokens at a glance

Full definitions live in `src/styles/global.css`. Highlights:

- **Brand:** crimson `--primary` `#B43638` (pressed `#8E2628`, soft tint `#FBE4E1`). `--accent` is the soft crimson tint (not a neutral grey — intentional).
- **Neutrals:** cool grey app bg `#F1F3F6`, white cards, navy ink `#0F172A`, hairline borders `#E3E7EC`.
- **Status:** success `#1B9E5A`, warning `#B6790E`, danger shares brand crimson. Exposed as `bg-success` / `bg-warning` utilities.
- **Type:** Inter (sans), Instrument Serif (serif), JetBrains Mono (mono). Weights include intentional in-betweens (540 medium, 650 bold).
- **Radius:** 12px base (`--radius`), scale sm 8 / md 12 / lg 16 / xl 20 / 2xl 28.
- **Shadows:** soft navy-tinted — `shadow-card`, `shadow-pop`, `shadow-overlay`, `shadow-accent`.
- **No dark theme** is designed yet; `.dark` in `global.css` is the inherited shadcn neutral fallback.

## Screen catalog → roadmap slices

Screens map to `context/foundation/roadmap.md` items. When planning a slice, open the matching screenshot(s).

| # | Screen | Role / device | Slice | Source file |
| --- | --- | --- | --- | --- |
| 01 | Home | Customer · mobile | S-01 | `customer-screens.jsx` |
| 02 | Fleet listing | Customer · mobile | S-01 | `customer-screens.jsx` |
| 03 | Vehicle detail | Customer · mobile | S-01 | `customer-screens.jsx` |
| 04 | Reservation form | Customer · mobile | S-02 | `customer-screens.jsx` |
| 05 | Request summary | Customer · mobile | S-02 | `customer-screens.jsx` |
| 06 | Request received | Customer · mobile | S-02 | `customer-screens.jsx` |
| 07 | Landing page | Customer · desktop | S-01 | `customer-desktop.jsx` |
| 08 | Fleet browse | Customer · desktop | S-01 | `customer-desktop.jsx` |
| 09 | Worker dashboard | Staff · mobile | S-03 / S-07 | `staff-screens.jsx` |
| 10 | Pending requests | Staff · mobile | S-03 | `staff-screens.jsx` |
| 11 | Request detail | Staff · mobile | S-03 | `staff-screens.jsx` |
| 12 | Pickup protocol (condition) | Staff · mobile | S-05 | `staff-screens.jsx` |
| 13 | Pickup protocol (signature & email) | Staff · mobile | S-05 | `staff-screens.jsx` |
| 14 | Return protocol (comparison) | Staff · mobile | S-06 | `staff-screens.jsx` |
| 15 | My reservations | Customer · mobile | **v2 — deferred** (needs accounts; PRD §Non-Goals) | `customer-screens.jsx` |
| 16 | Calendar timeline | Admin · desktop | S-03 / S-07 | `desktop-screens.jsx` |
| 17 | Fleet management | Admin · desktop | S-04 | `desktop-screens.jsx` |
| 18 | Overdue returns | Admin · desktop | S-07 | `desktop-screens.jsx` |
| 19 | Employees | Admin · desktop | S-08 | `desktop-screens.jsx` |

Screenshot filenames are numbered to match this table, e.g.
`screenshots/04-customer-mobile-reservation-form.png`.

## Notes for implementation

- **Polish-first copy.** Prototype screens render Polish UI strings (the export has an EN/PL toggle; v1 ships Polish per PRD). Treat PL as canonical, EN as reference.
- **Vehicle imagery** uses geometric silhouettes in the prototype — swap for real product photography in production.
- **Screens are prototype JSX, not components.** Use them for layout/spacing/structure intent; rebuild as Astro/React + shadcn against the live tokens. Do not import from `design/`.

## Follow-ups

- [ ] **Wire web fonts.** Tokens reference Inter / Instrument Serif / JetBrains Mono but the app doesn't load them yet — currently falls back to system fonts. Add via `@fontsource/*` (recommended for Astro/Cloudflare) or a `<link>` in `Layout.astro` before S-01.
- [ ] Decide whether `info` state should differ from `danger` (both alias crimson today — see note in `tokens.css`).
