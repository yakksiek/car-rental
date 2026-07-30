---
change_id: landing-redesign
title: Implement the restyled customer landing page (desktop home)
status: implemented
created: 2026-07-28
updated: 2026-07-30
---

## Notes

Port the restyled landing-page mock (`customer-desktop.jsx` → `ScreenDesktopHome`,
screen 07) from the Claude Design project onto the shipped `src/pages/index.astro`.
Scope confirmed at frame time: **home page only** (not fleet browse); the mock is the
**full spec** (its net-new elements are in scope, subject to the dispositions below).

Framing worked out in `frame.md` — the headline is that this is **not one homogeneous
restyle**. It splits into a shippable-now visual port over existing data + tokens, and
five net-new elements each needing an asset, content, or a product decision. Dispositions
captured at frame time:

- **Hero imagery** — **delivered** in `~/Downloads/flota-handover/images/` (hero JPEG +
  van-cutout RGBA, both 1376×768). Optimize the 644KB hero at build (`astro:assets`
  `<Picture>` → AVIF/WebP). FLOTA wordmark is free (text).
- **Typography** — handover adds Space Grotesk + Playfair Display (serif swap from
  Instrument Serif); add via Astro Fonts API, landing-scoped first.
- **Mobile** — mock is desktop-fixed 1440px; responsive layout must be designed +
  vision-diffed (README prose is the starting spec).
- **Source of truth** — packaged handover bundle `~/Downloads/flota-handover/`
  (`flota-landing.html` = structure SoT, `flota-landing-reference.png` = visual target),
  consistent with the Claude Design `customer-desktop.jsx` mock.
- **Trust card** — hardcode the mock's figures ("4.9 / 5 · 1 280 opinii", "83 pojazdy")
  as **placeholder-to-replace** for now.
- **Nav** — render only live destinations (Start + Flota + real phone); drop Cennik /
  Dla firm / Pomoc and the PL·EN toggle until they exist. Fork a landing-local `LandingNav`
  — do NOT edit the shared `SiteHeader` (it backs 5 public pages).

See `frame.md` for the full dimension map, evidence table, and hand-off to /10x-plan.
