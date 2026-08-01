# Design Contract — logo-update

> Canonical source: `design-review/` (mark SVG + lockup spec, pulled from Claude Design
> project `352d78a6-…` on 2026-08-01). Every line is `exact` or `deviation(reason)`.
> The rendered vision-diff (implement/impl-review) compares the built `<Brand>` against
> the lockup in `design-review/index.md`.

## Design Alignment Audit

### Freshness (repo designs vs canonical)

| Repo design                                                      | State                                | Action                                                       |
| ---------------------------------------------------------------- | ------------------------------------ | ------------------------------------------------------------ |
| Shipped screenshots showing the crimson "F" badge (header/shell) | outdated (superseded by this change) | Re-export catalogued shots after ship; not blocking.         |
| `design-system.md` — has **no** logo/brand-mark row              | missing                              | Add a "Brand" row post-ship (follow-up, not in this change). |
| `assets/flota-mark.svg` (design project)                         | current                              | Port into repo (Phase 1).                                    |

### New-design quality (gaps in the provided design)

- **States covered:** light (ink) + dark (reversed/white) + large (lockup) + small (34/20px). Good.
- **Gap — favicon legibility:** preview shows a bare van at 20px; unreadable in tabs. Resolved as the tile deviation below (Phase 3).
- **Gap — no in-situ full-screen mockup** of the new mark on each surface (the preview is a lockup board; screens still show the old badge). Mitigated: per-surface tone/size table below + implement-time vision-diff against the lockup.
- **Copy:** wordmark = **"Flota"** (verbatim, unchanged).

### Alignment (every surface has a phase; every phase has a design) — PASS

All core surfaces (below) map to Phase 2; favicon to Phase 3. No phase contradicts the design. Out-of-scope surfaces (hero wordmark, OG/manifest, FleetRent name) carry no phase by design.

## Token / value map

| Design value           | App token / value                                               | Line status                                                                                                                 |
| ---------------------- | --------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| mark ink `#162E4A`     | `currentColor` driven by `text-foreground` (navy ink `#0F172A`) | `deviation(use app ink token #0F172A via currentColor, not the design's #162E4A — 1-shade navy diff, keeps one ink source)` |
| reversed `#fff`        | `currentColor` driven by `text-white`                           | `exact`                                                                                                                     |
| favicon tile `#B43638` | `--primary` `#B43638`                                           | `exact`                                                                                                                     |
| theme-color            | `#B43638` (`--primary`)                                         | `exact`                                                                                                                     |
| wordmark "Flota"       | Inter 700, tracking `-0.4px`                                    | `exact` (matches current in-app wordmark)                                                                                   |

## Per-surface spec (Phase 2)

Mark height preserves each surface's current badge size; `<Brand variant="lockup">` unless noted.

| File / spot                               | tone      | mark height | line status                                       |
| ----------------------------------------- | --------- | ----------- | ------------------------------------------------- |
| `SiteHeader.astro`                        | `ink`     | ~34px       | `exact`                                           |
| `LandingNav.astro` desktop pill           | `ink`     | 38px        | `exact`                                           |
| `LandingNav.astro` mobile bar (dark)      | `inverse` | 34px        | `exact`                                           |
| `MobileNav.tsx` overlay                   | `ink`     | ~34px       | `exact` (verify overlay bg is light at implement) |
| `SiteFooter.astro`                        | `ink`     | ~30px       | `exact`                                           |
| `auth/signin.astro` mobile band (dark)    | `inverse` | 42px        | `exact`                                           |
| `auth/signin.astro` desktop card          | `ink`     | 40px        | `exact`                                           |
| `auth/AuthShell.astro` mobile band (dark) | `inverse` | 42px        | `exact`                                           |
| `auth/AuthShell.astro` desktop card       | `ink`     | 40px        | `exact`                                           |
| `shell/StaffShell.astro` sidebar top      | `ink`     | ~36px       | `exact`                                           |

- Container: **none** on all of the above (the crimson square badge is removed). `exact`.
- `font-serif` on some current monograms is irrelevant post-swap (the van is an SVG, not a letter). `exact`.
- Footer tagline `Wynajem pojazdów użytkowych · Warszawa` and `© {year} Flota …`: **unchanged**. `exact`.

## Favicon / app-icon spec (Phase 3)

- `public/favicon.svg`: white (`#fff`) van mark centered on a rounded crimson `#B43638` tile. `deviation(favicon legibility — tile only here; lockups stay containerless)`.
- `apple-touch-icon.png` 180×180, `favicon-32x32.png` (PNG fallback), optional `icon-192/512`. `exact`.
- `<meta name="theme-color" content="#B43638">`. `exact`.
- Old `public/favicon.png` (crimson "F") retired. `exact`.

## Out of scope (recorded, not deviations)

Hero gradient "FLOTA" wordmark (`index.astro`), OG/social image + web manifest, "FleetRent" name in email templates + PDF footer.

**Verdict: PASS — 10 core surfaces + favicon aligned, 2 repo designs superseded, 2 deviations recorded (favicon tile, ink-token).**
