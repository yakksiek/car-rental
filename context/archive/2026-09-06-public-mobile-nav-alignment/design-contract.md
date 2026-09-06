# Design Contract — Public Mobile Nav Alignment

Surface in scope: the **opened** mobile navigation menu on the public site, in two tones.
Out of scope: the closed headers themselves, the desktop pill, the tablet band, the staff panel.

## Design Alignment Audit

### 1. Canonical designs captured

The design project had **no opened-menu board in either tone** — mobile navigation there is the
floating `PublicDock` pill, so an opened hamburger was never drawn. Rather than build against
nothing, the board was authored into the design project during planning and rendered locally.

| Asset                          | Path                                                                              | Provenance                                                                          |
| ------------------------------ | --------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| Board source                   | `nav-overlay.jsx` in Claude Design project `352d78a6-84fd-49a2-8b38-2fe289691fc3` | Authored 2026-09-06, pushed with `DesignSync write_files`                           |
| Dark mockup (PL)               | `design-review/mock-landing-390-menu-open-pl.png`                                 | Rendered from that board, 390×844 @2×                                               |
| Dark mockup (EN)               | `design-review/mock-landing-390-menu-open-en.png`                                 | as above                                                                            |
| Light mockup (PL)              | `design-review/mock-info-390-menu-open-pl.png`                                    | as above                                                                            |
| Light mockup (EN)              | `design-review/mock-info-390-menu-open-en.png`                                    | as above                                                                            |
| App render, `/fleet` menu open | `design-review/app-fleet-390-menu-open.png`                                       | Captured from the running app at `074cb5f`, the light baseline that must not change |
| App render, landing dropdown   | `design-review/app-landing-390-menu-open.png`                                     | Captured at `074cb5f`, the state this change deletes                                |

**Render method.** The two boards need only `shared.jsx`, so they were rendered through a
purpose-built harness rather than the project's `export-shot.html` (which loads 18 files through
Babel-in-browser and registers no nav board). JSX was transformed with esbuild and loaded as one
scope, reproducing the design's cross-file globals. Fonts were the **app's own self-hosted variable
Inter** (`latin` + `latin-ext`), never the Google CDN, whose static instances snap the 540/650/750
weights this design uses. The capture asserts `document.fonts.check("650 13px Inter")` before
shooting, so a silent fallback fails the run instead of producing a plausible PNG. Zero page errors
on all four boards.

### 2. Freshness audit — repo designs vs canonical

| Repo design                                                                  | Verdict        | Note                                                                                                                                                                   |
| ---------------------------------------------------------------------------- | -------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `design-system.md` rows 07 / 26 (landing desktop + mobile)                   | **current**    | Closed-header states, untouched by this change                                                                                                                         |
| `design-system.md` rows 27–29 (Cennik / FAQ / O nas)                         | **current**    | Closed-header states                                                                                                                                                   |
| `design-system.md` line 97–101 ("`LandingNav` keeps its own immersive fork") | **superseded** | Phase 2 rewrites it: the fork is desktop and tablet only from now on                                                                                                   |
| `screenshots/26-customer-mobile-landing.png`                                 | **outdated**   | Shows the July hamburger over the hero and predates `LangToggle`/`ActionMenu`. Not re-exported here; it documents the closed landing, which this change does not alter |
| No repo screenshot of any opened menu                                        | **missing**    | Closed by the four boards above                                                                                                                                        |

### 3. Quality audit — gaps in the new boards

| Gap                                                                      | Resolution                                                                                                                        |
| ------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------- |
| No focus-visible state drawn for the trigger or close chip               | Authored from the app's existing dark pattern (`ActionMenu`, `LangToggle`): `ring-2 ring-white/40`. `deviation(focus-undesigned)` |
| No pressed/hover state drawn for the links                               | App keeps its existing `hover:text-primary`. `deviation(hover-undesigned)`                                                        |
| No 360px board                                                           | The layout is a centred column with no horizontal constraint; 360 is verified by measurement in Phase 2, not by a board           |
| No open/close motion drawn                                               | None added. The overlay appears and disappears, as it does today                                                                  |
| Board glyphs come from the design's own `Icon` set; the app ships lucide | Structural diff only — glyph interiors are not compared. `deviation(icon-library)`                                                |

### 4. Alignment audit — plan vs canonical

| Canonical surface          | Plan phase                                 | Status                                                                           |
| -------------------------- | ------------------------------------------ | -------------------------------------------------------------------------------- |
| Dark overlay (landing)     | Phase 1 builds the tone, Phase 2 mounts it | aligned                                                                          |
| Light overlay (info/fleet) | Phase 1 must leave it byte-identical       | aligned, guarded by a Phase 1 manual check against `app-fleet-390-menu-open.png` |
| Closed headers             | no phase                                   | out of scope by design; unchanged                                                |

No plan phase contradicts a board. No board lacks a phase.

## Token map

| Design value              | App token              | Where                                                                                         |
| ------------------------- | ---------------------- | --------------------------------------------------------------------------------------------- |
| `#0A0D14`                 | literal `bg-[#0A0D14]` | Dark overlay surface. Already used by `index.astro:57` for the hero, so no new token is added |
| `tokens.card` `#FFFFFF`   | `bg-card`              | Light overlay surface                                                                         |
| `tokens.ink` `#0F172A`    | `text-foreground`      | Light overlay link, inactive                                                                  |
| `#FFFFFF`                 | `text-white`           | Dark overlay link, inactive                                                                   |
| `tokens.accent` `#B43638` | `text-primary`         | Active link, **both** tones                                                                   |
| `tokens.bg` `#F1F3F6`     | `bg-background`        | Light chip fill                                                                               |
| `rgba(255,255,255,0.15)`  | `bg-white/15`          | Dark chip fill                                                                                |
| `blur(6px)`               | `backdrop-blur-[6px]`  | Dark chip                                                                                     |

## Per-element spec

Values in the light column are **measured from the running app at `074cb5f`**, not transcribed, and
must not change. Values in the dark column are the board's, and are chosen to mirror the landing
bar so the brand lockup does not move when the menu opens.

### Overlay container

| Element    | Light                                                           | Dark      | Verdict                                                                                                                   |
| ---------- | --------------------------------------------------------------- | --------- | ------------------------------------------------------------------------------------------------------------------------- |
| Position   | `fixed inset-0`                                                 | same      | `exact`                                                                                                                   |
| z-index    | `60`                                                            | same      | `exact`                                                                                                                   |
| Layout     | `flex flex-col`                                                 | same      | `exact`                                                                                                                   |
| Surface    | `#FFFFFF` (`bg-card`)                                           | `#0A0D14` | `exact`                                                                                                                   |
| Semantics  | `role="dialog"`, `aria-modal="true"`, `aria-label` = `nav.menu` | same      | `deviation(a11y-undesigned)` — the board draws no semantics; added because it is a modal and the e2e addresses it by role |
| Focus trap | none                                                            | none      | `deviation(no focus trap; Escape + close button only)`                                                                    |

### Header row

| Element            | Light (measured)                                     | Dark                                                                  | Verdict                                                                                   |
| ------------------ | ---------------------------------------------------- | --------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| Row padding        | `14px 18px`                                          | `16px`                                                                | `exact` — each mirrors its own bar                                                        |
| Row height         | 68px                                                 | 72px                                                                  | `exact` — consequence of the padding, not set directly                                    |
| Brand mark box     | 34 × 16.4px, `x = 18`                                | 37.2 × 18px, `x = 16`                                                 | `exact` — light is `markClass="w-[34px]"`, dark is the landing's `markClass="h-[18px]"`   |
| Brand gap          | 6px (`gap-1.5`)                                      | 10px (`Brand` default `gap-2.5`)                                      | `exact` — each mirrors its own bar; the 10px is what `LandingNav.astro:200` renders today |
| Wordmark           | 18px, bold, `tracking-[-0.4px]`, `#0F172A`           | 19px, bold, `tracking-tight` = `-0.475px`, `#FFFFFF`                  | `exact` — corrected at implementation, see the as-built note below                        |
| Brand tone         | ink                                                  | `inverse`                                                             | `exact`                                                                                   |
| Close chip         | 40 × 40, `rounded-[12px]`, `#F1F3F6`, ink glyph 18px | 40 × 40, `rounded-[12px]`, `white/15` + `blur(6px)`, white glyph 18px | `exact`                                                                                   |
| Close `aria-label` | `nav.closeMenu` — "Close menu" / "Zamknij menu"      | same                                                                  | `exact`                                                                                   |

**Why the two rows differ, and why that is correct.** The brand sits at `x = 18`, centre `y = 34` in
the light row, which is exactly where `SiteHeader`'s mobile bar puts it; and at `x = 16`, centre
`y = 36` in the dark row, which is exactly where the landing bar puts it (measured: the landing
cluster is `inset-x-4 top-4`, 358 × 40 at 16,16). Sharing one set of numbers would move the brand on
one of the two headers at the moment of opening.

### Link list

Identical in both tones except colour.

| Element              | Value                                                          | Verdict                                                                              |
| -------------------- | -------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| Container            | `flex flex-1 flex-col items-center justify-center`, gap `32px` | `exact`                                                                              |
| Font                 | `30px / 700`, `letter-spacing -0.75px`                         | `exact`                                                                              |
| Icon                 | `28 × 28`, `gap 12px` before the label                         | `exact`                                                                              |
| Inactive colour      | light `#0F172A` · dark `#FFFFFF`                               | `exact`                                                                              |
| Active colour        | `#B43638` in **both** tones                                    | `exact` — decided 2026-09-06; 3.3:1 on `#0A0D14`, which clears WCAG AA for 30px bold |
| Order                | Home · Fleet · Pricing · FAQ · About                           | `exact`                                                                              |
| Copy (PL)            | Start · Flota · Cennik · FAQ · O nas                           | `exact`, from `src/lib/i18n/nav.ts`                                                  |
| Copy (EN)            | Home · Fleet · Pricing · FAQ · About                           | `exact`                                                                              |
| Trigger `aria-label` | `nav.menu` — "Menu" in both locales                            | `exact`                                                                              |

### Trigger (closed state)

| Element | Light                       | Dark                                               | Verdict                                                                                                            |
| ------- | --------------------------- | -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| Box     | `size-10`, `rounded-[12px]` | same                                               | `exact`                                                                                                            |
| Fill    | `bg-background`, ink glyph  | `bg-white/15` + `backdrop-blur-[6px]`, white glyph | `exact`                                                                                                            |
| Hover   | none today                  | `hover:bg-white/25`                                | `deviation(hover-undesigned)` — matches the dark family's one step up, as `ActionMenu` and `LangToggle` already do |
| Focus   | none today                  | `ring-2 ring-white/40 ring-offset-transparent`     | `deviation(focus-undesigned)`                                                                                      |

## Deviations register

1. `deviation(overlay-drafted, not designed)` — the design navigates mobile through `PublicDock`
   and has no opened menu. Both boards were authored for this change. Inherited from the standing
   `deviation(overlay-undesigned)` and `deviation(no PublicDock in app; hamburger retains mobile nav)`.
2. `deviation(a11y-undesigned)` — dialog role, modal flag and accessible name added; no board draws them.
3. `deviation(no focus trap)` — Escape and the close button only. Not designed, not built here.
4. `deviation(focus-undesigned)` / `deviation(hover-undesigned)` — authored from the app's existing dark control family.
5. `deviation(icon-library)` — boards use the design's `Icon` set, the app ships lucide. Structure is compared, glyph interiors are not.
6. `deviation(two header-row metrics)` — the two tones do not share row padding, mark size or brand gap, on purpose. See the note under Header row.
7. `deviation(color-mix vs flat rgba)` — the dark chip renders `#33363C`, the board `#2F3137`: an
   effective 16.7% against 15%. The authored class is the contract's own `bg-white/15`; Tailwind v4
   resolves that through `color-mix(in oklab, …)` while the board was rendered with flat
   `rgba(255,255,255,.15)`. **Not corrected.** A literal rgba here would make this chip differ from
   `LangToggle` and `ActionMenu`, which sit beside it in the same bar and use the same token. Chip
   size, radius, corner curve, glyph size and glyph centre are pixel-identical.
8. `deviation(wordmark ink 1px)` — the wordmark's rendered ink sits one CSS px higher than the
   board's; the brand mark beside it is identical. **Not corrected**, because the dark row mounts
   `Brand` with the landing bar's own props, and the closed-versus-open measurement is 0.00px on
   every dimension. Chasing the board's pixel would move the brand at the moment the menu opens,
   which is precisely what deviation 6 exists to prevent. Glyph shapes, ink width, ink height, font
   size and weight all match.

**Vision-diff gate: PASS.** Both locales diffed against their boards at 390×844 @2×. Every text
label's bounding box is pixel-identical in x and y, which pins font size, weight, letter-spacing,
label gap, vertical rhythm and centring. Surface, link order, Polish copy, active colour `#B43638`
and inactive `#FFFFFF` all confirmed numerically. The only non-zero regions in the whole-image diff
are the header (deviations 7 and 8) and the five icon ink zones (deviation 5, icon-library).
Punch-list empty of actionable items.

## As built — measured 2026-09-06

Measured from the running app after Phase 2, with `getComputedStyle` and
`getBoundingClientRect` rather than by eye. Every row of the per-element spec above was
confirmed against the render; only the differences are listed here.

| Spec row                     | Contract said       | Measured   | Resolution                                                                                                                                                                                                                                                                                                                                                                                               |
| ---------------------------- | ------------------- | ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Header row · Wordmark (dark) | `tracking-[-0.4px]` | `-0.475px` | Contract row corrected, not the code. The dark row mounts `Brand` with the landing bar's own props (`LandingNav.astro`: `markClass="h-[18px]" wordmarkClass="text-[19px]"`, no tracking override), so it inherits `Brand`'s `tracking-tight` — `-0.025em` at 19px. Matching the bar is the point of the row; the plan says to take the landing's actual props over this table where they differ. `exact` |

**Light tone is byte-identical.** The `/fleet` overlay at 390×844 @2× was diffed against
`design-review/app-fleet-390-menu-open.png` (the pre-change baseline) twice — after Phase 1
and again after Phase 2. **Zero differing pixels** both times, no bounding box of difference
at all. The eight `SiteHeader` pages are untouched, as required.

**Dark tone, measured.** Overlay `fixed` at `0,0,390,844`, `z-index 60`, surface
`rgb(10,13,20)` = `#0A0D14` at full opacity, `role="dialog"` `aria-modal="true"`
`aria-label="Menu"`. Header row padding `16px`, height `72px`. Brand mark `37.2 × 18` at
`x = 16`, centre `y = 36`, gap `10px`, wordmark `19px / 700 / #FFFFFF`. Close chip `40 × 40`,
radius `12px`, `white/15` + `blur(6px)`, label "Close menu" / "Zamknij menu". Link list gap
`32px`, items `30px / 700 / -0.75px`, icons `28 × 28`, `12px` before the label; active `Home`
/ `Start` in `rgb(180,54,56)` = `#B43638`, the other four `#FFFFFF`. Body scroll locked while
open and restored on close. Escape closes. Zero page errors.

**Brand lockup does not move.** Closed-bar versus opened-overlay brand geometry on the
landing at 390px: mark x, mark centre y, mark width, mark height, wordmark x, wordmark width
and wordmark centre y all differ by **0.00px**. This is what the two-header-row deviation
below buys.

**Verified at 360px and in both locales.** All four combinations — 390/en, 390/pl, 360/en,
360/pl — report the same full-viewport `fixed` `z-60` `#0A0D14` overlay with the row and list
metrics above. This closes the "no 360px board" gap in the quality audit by measurement, as
that audit said it would. Polish copy renders Start · Flota · Cennik · FAQ · O nas, matching
`src/lib/i18n/nav.ts`.

**All five links navigate.** Opening the overlay and tapping each of Home, Fleet, Pricing,
FAQ and About lands on `/`, `/fleet`, `/pricing`, `/faq`, `/about` respectively, with zero
leftover `[role="dialog"]` nodes and `body` scroll restored on each.

## Notes on the design source

While rendering, the design's `shared.jsx` was found to have a duplicate `emailAddr` key in its
Polish string table (the second wins, both read "Adres e-mail" / "E-mail"). Unrelated to this
change and not fixed here; recorded so it is not rediscovered as a mystery.

## Gate

**Design Alignment Audit: PASS** — 2 surfaces (dark overlay, light overlay), 1 repo design
superseded (`design-system.md`'s "immersive fork" line, rewritten in Phase 2), 6 deviations recorded.

**Rendered vision-diff gate: PASS** — closed at implementation, 2026-09-06. Two further deviations
found and recorded (7, 8), both renderer artefacts of the board rather than divergences in the code;
neither is corrected, for the reasons given. Light tone proven byte-identical by pixel diff. See
"As built" above.
