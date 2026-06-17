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
| S-02 flow set | `context/foundation/design/screenshots/s-02-reservation-flow/*.png` | High-fidelity reservation-funnel pass (mobile + desktop). Screenshot-only — see catalog below. |
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
| 20 | Worker dashboard | Staff · desktop | S-03 / S-07 | — (jpg export only) |
| 21 | Pending requests | Staff · desktop | S-03 | — (jpg export only) |
| 22 | Calendar · agenda | Admin · mobile | S-03 / S-07 | — (jpg export only) |
| 23 | Fleet management | Admin · mobile | **S-04** | — (jpg export only) |
| 24 | Overdue returns | Admin · mobile | S-07 | — (jpg export only) |
| 25 | Employees | Admin · mobile | S-08 | — (jpg export only) |

Screenshot filenames are numbered to match this table, e.g.
`screenshots/04-customer-mobile-reservation-form.png`.
Rows 20–25 are later `.jpg` exports (no recoverable JSX source); the **Admin · mobile**
set (22–25) is the "full back-office on a phone" pass — screen **23** is the S-04 fleet
management mobile design.

### S-02 reservation flow — high-fidelity pass

A dedicated, higher-fidelity design pass for the **S-02 public-reservation-request**
slice (the roadmap north star). Lives in its own subfolder so it stays a coherent
mobile→desktop set without renumbering the flat catalog above. These **refine** mobile
rows 04–06 and **add the desktop reservation flow** (no desktop reservation screens exist
in the flat catalog). **Screenshot-only** — exported as a Claude Design bundle whose
component code isn't recoverable as JSX, so there is no `*-screens.jsx` source for these.

Folder: `screenshots/s-02-reservation-flow/`

| File | Screen | Device |
| --- | --- | --- |
| `mobile-1-vehicle-detail.png` | Vehicle detail → "Check availability" | Customer · mobile (390×844) |
| `mobile-2-reservation-form.png` | Reservation form + date-range picker (see date-picker note below) | Customer · mobile |
| `mobile-3-request-summary.png` | Review request (booking + customer details) | Customer · mobile |
| `mobile-4-request-received.png` | Request received confirmation | Customer · mobile |
| `desktop-1-vehicle-detail-dates.png` | Vehicle detail + booking widget (pickup/return date range, estimated total) | Customer · desktop (1440w) |
| `desktop-2-your-details.png` | Your details (3-step: Dates → Your details → Confirm; B2B company/VAT optional; terms) | Customer · desktop |
| `desktop-3-request-received.png` | Request received confirmation | Customer · desktop |

> **Date picker — the per-vehicle booking calendar greys out booked dates.** `mobile-2` and
> `desktop-1` render individual dates struck-out with a *"booked or requested"* legend, and the
> shipped app now does this on the **per-vehicle** booking widget (`BookingWidget.tsx`): the
> range calendar (`src/components/ui/calendar.tsx`, `mode="range"`) disables past dates **and**
> the vehicle's taken dates — both **pending and confirmed** — Booking.com style, so a visitor
> never picks an unavailable range.
>
> *(History: S-02 originally shipped a plain past-dates-only picker — the "no greying" divergence.
> The product owner reversed that call in **Phase 6: Availability Transparency**, which is what the
> per-vehicle greying above reflects. The catalog hero/filter calendars — `HeroSearch.tsx` (screen
> 07), `FilterBar.tsx` (screen 08) — are unaffected: they search across the fleet via
> `available_vehicles`, not per-vehicle, so they stay past-dates-only.)*
>
> No-double-booking is enforced at three points (greying is UX sugar, not the authority):
> 1. **Catalog** — the `available_vehicles` RPC excludes vehicles that overlap the chosen range,
>    so a vehicle reached from the filtered catalog is known-free for those dates.
> 2. **Per-vehicle calendar (S-02, Phase 6)** — `get_vehicle_busy_ranges` (PII-safe definer RPC)
>    is SSR'd in and greys the taken dates; a greyed range can't be selected. A pre-submit
>    `available_vehicles` re-check still runs before the request is created.
> 3. **Backstop** — the DB `EXCLUDE` constraint (migration `20260603155136`) is the atomic guard.
>
> Roadmap S-02 *"blocks overlapping dates before submission"* = greyed unavailable dates + the
> pre-submit re-check + the constraint. Copy stays Polish-canonical (e.g. *kaucja* = deposit).

## Notes for implementation

- **Polish-first copy.** Prototype screens render Polish UI strings (the export has an EN/PL toggle; v1 ships Polish per PRD). Treat PL as canonical, EN as reference.
- **Vehicle imagery** uses geometric silhouettes in the prototype — swap for real product photography in production.
- **Screens are prototype JSX, not components.** Use them for layout/spacing/structure intent; rebuild as Astro/React + shadcn against the live tokens. Do not import from `design/`.

## Follow-ups

- [x] **Wire web fonts.** Done — self-hosted via Astro's Fonts API (`fonts` in `astro.config.mjs` + `<Font>` in `Layout.astro`). Inter / Instrument Serif / JetBrains Mono, `latin` + `latin-ext` subsets (Polish diacritics), exposed as `--font-inter` / `--font-instrument-serif` / `--font-jetbrains-mono` and consumed by the `--flota-font-*` tokens.
- [ ] Decide whether `info` state should differ from `danger` (both alias crimson today — see note in `tokens.css`).
