# Design Contract — Staff-Panel Discovery

Source of truth: Claude Design project `Rental car company`
(`352d78a6-84fd-49a2-8b38-2fe289691fc3`), pulled live via `DesignSync` on 2026-09-06.
Files read: `recruiter-guide.jsx`, `shared.jsx` (`InfoButton`, `LangToggle`, `STR`, `FlotaMark`),
`info-pages.jsx` (`InfoHeader`, `InfoHeaderMobile`, `InfoFooter`), `customer-desktop.jsx`
(`LandingNav`, `ScreenTabletHome`, `ScreenMobileHome`), `export-shot.html`,
`design-review/index.md`.

Every line below is marked `exact` (transcribed from the design JSX) or `deviation(reason)`.

**Phase 1 is COMPLETE (2026-09-06). Geometry and copy are both binding.** The design source has
been corrected and pushed, and the canonical screenshots exist — see §1.5 for what shipped. §7's
strings are no longer a proposal: they are live in `shared.jsx` under `STR.{EN,PL}.guide`, and
Phase 3 copies them into `src/lib/i18n/orientation.ts` rather than the other way round.

---

## 1. Design Alignment Audit

### 1.1 Freshness — repo designs vs the live source

| Artifact                                                       | Status                    | Note                                                                                                                                                                                      |
| -------------------------------------------------------------- | ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `screenshots/07-customer-desktop-landing.png` (catalog row 07) | **outdated (superseded)** | Committed 2026-07-31. `LandingNav.astro` was last rewritten 2026-09-05 by `english-localization`, which added `LangToggle` and `ActionMenu` to all three clusters. The PNG shows neither. |
| `screenshots/26-customer-mobile-landing.png` (catalog row 26)  | **outdated (superseded)** | Same date, same cause — the mobile cluster in the PNG predates both controls.                                                                                                             |
| Catalog rows 27 / 28 / 29 (Cennik, FAQ, O nas — desktop)       | **missing**               | `design-system.md` lists all three, but `context/foundation/design/screenshots/` stops at `26`. No file was ever committed. These are the rows that would show the footer.                |
| Design project `design-review/index.md`                        | **missing (this slice)**  | Indexes overdue returns, employee states, auth, error pages and the calendar glimpse. Carries **no row** for the welcome overlay, the landing header, or the footer.                      |
| Design project `export-shot.html`                              | **missing (this slice)**  | Loads eighteen JSX files; `recruiter-guide.jsx` is not among them, and its three screens have no `SCREENS` entry. The overlay is unrenderable by the project's own harness.               |
| `recruiter-guide.jsx` overlay geometry                         | **current**               | Self-consistent and complete for three widths. Pulled 2026-09-06.                                                                                                                         |
| `design-review/guide-{d-pl,d-en,t-pl,m-pl}.png`                | **current (new)**         | Created 2026-09-06 from the corrected source at 2× with the app's own variable Inter. Did not exist before this change.                                                                   |
| `design-review/landing-header-pl.png`                          | **current (new)**         | The landing desktop pill with `InfoButton` beside `LangToggle`. Supersedes catalog row 07 for the header cluster.                                                                         |
| `design-review/footer-pill-pl.png`                             | **current (new)**         | The full `InfoFooter` including the copyright-bar staff pill. First canonical export of this surface.                                                                                     |
| `design-review/info-header-pl.png`                             | **current (new)**         | `InfoHeader` after the pill removal — the state the eight non-landing pages must match.                                                                                                   |
| `info-pages.jsx` `InfoFooter` staff pill                       | **current**               | Ahead of the app — the app still renders a column text link.                                                                                                                              |
| `shared.jsx` `InfoButton`                                      | **current**               | Ahead of the app — the app has no such control.                                                                                                                                           |

Consequence at audit time: **no canonical screenshot existed for any of the three surfaces this
change touches**, in the repo or in the design project. Phase 1 created them — the four
`current (new)` rows above — and registered the overlay in the project's own export harness so a
future session can re-render it. The two `outdated` and three `missing` catalog rows are
pre-existing and stay out of scope; they are recorded here so a later reader does not mistake them
for current.

### 1.2 Quality — gaps in the design itself

| #   | Gap                                                                                                                                                                               | Severity | Disposition                                                                                                                                                                                       |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Overlay lead reads "Everything here is a static design: no sign-in needed" — describes the prototype, and the app's cockpit is behind sign-in                                     | Blocking | **RESOLVED 2026-09-06** — re-authored and pushed. §7 is now the live text.                                                                                                                        |
| 2   | Overlay is English-only; no `STR.EN` / `STR.PL` entries exist for any of its strings                                                                                              | Blocking | **RESOLVED 2026-09-06** — `STR.{EN,PL}.guide` added; the board renders from `useLang()`.                                                                                                          |
| 3   | `InfoButton` hardcodes `aria-label="About this project"` in English — the same gap `LangToggle` had                                                                               | Blocking | **RESOLVED 2026-09-06** — reads `t.guide.aboutProject`.                                                                                                                                           |
| 4   | Overlay is marked "MOCK ONLY (no behaviour)": no open, close, focus or keyboard spec                                                                                              | Medium   | We author it. Radix dialog supplies focus trap, Escape and scroll lock; recorded as `deviation(no behaviour in source)`.                                                                          |
| 5   | Card 01's button ("Customer site") has nowhere to go — the visitor is already on the customer site                                                                                | Medium   | Becomes the dismiss action, relabelled. Owner decision, §7.                                                                                                                                       |
| 6   | No hover, focus-visible or pressed state for any of the three buttons, the pill, or the skip link                                                                                 | Medium   | We author them from the neighbouring controls' treatments. `deviation(no states in source)`.                                                                                                      |
| 7   | Overlay has no loading, error or reduced-motion variant                                                                                                                           | Low      | Not needed — it renders from server-resolved state with no async work.                                                                                                                            |
| 8   | `InfoFooter` pill is `role="button"` with `tabIndex={0}` for a control that navigates                                                                                             | Medium   | Ships as an `<a>`. §6, recorded deviation.                                                                                                                                                        |
| 9   | Design draws `InfoButton` in all five public header clusters; the app ships it on the landing only                                                                                | Medium   | **RESOLVED 2026-09-06** — removed from `InfoHeader` and `InfoHeaderMobile`.                                                                                                                       |
| 10  | Overlay's three frames are desktop / tablet / mobile only — no state for a signed-in visitor                                                                                      | Low      | Correct by construction: a signed-in visitor never sees it.                                                                                                                                       |
| 11  | **Found during export.** `customer-desktop.jsx` `LandingNav` hardcodes `'Browse the fleet'` and translates only one nav item, so the landing pill renders English labels under PL | Low      | Out of scope — the APP is already correct (`src/lib/i18n/nav.ts` translates all five). Recorded so a future reader does not "fix" the app to match the board. Visible in `landing-header-pl.png`. |
| 12  | `export-shot.html` links STATIC Inter from the Google CDN while the app self-hosts the VARIABLE face                                                                              | Medium   | Pre-existing and project-wide. Worked around here by exporting through a local harness using the app's own `.woff2`; the caveat is now written into `design-review/index.md`.                     |

### 1.3 Alignment — plan vs design

| Canonical surface                     | Plan phase | Verdict                                                                            |
| ------------------------------------- | ---------- | ---------------------------------------------------------------------------------- |
| Overlay — desktop (780px modal)       | Phase 3    | Aligned                                                                            |
| Overlay — tablet (660px modal)        | Phase 3    | Aligned                                                                            |
| Overlay — mobile (bottom sheet)       | Phase 3    | Aligned                                                                            |
| `InfoButton` — landing desktop pill   | Phase 4    | Aligned                                                                            |
| `InfoButton` — landing tablet band    | Phase 4    | Aligned                                                                            |
| `InfoButton` — landing mobile bar     | Phase 4    | Aligned                                                                            |
| `InfoButton` — `InfoHeader` (8 pages) | —          | **Deviation** — design removes it in Phase 1; owner scoped the pill to the landing |
| `InfoButton` — `InfoHeaderMobile`     | —          | **Deviation** — as above                                                           |
| `InfoFooter` staff pill               | Phase 5    | Aligned, with the element deviation in §6                                          |
| Landing collapse threshold            | Phase 4    | Aligned — re-derived by measurement, not transcribed                               |

Every canonical surface has a phase, and every phase has a design. The two removals are recorded
deviations that Phase 1 resolves in the design source itself, so nothing stays permanently divergent.

### 1.4 Gate verdict

**PASS** — 10 surfaces audited, 4 repo designs superseded or missing, 10 deviations recorded,
4 blocking defects fixed and verified by render.

Phase 1 ran on 2026-09-06 and its condition is discharged. The design source was corrected first —
capturing screenshots any earlier would have enshrined copy already known to be false — and the
canonical boards were then exported from the corrected source. **Phases 2–6 are unblocked.**

### 1.5 Phase 1 execution record (2026-09-06)

| File written to the design project | Change                                                                                                                                                                                                                                          |
| ---------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `shared.jsx`                       | Added `STR.EN.guide` and `STR.PL.guide` (14 keys each, Polish canonical). `InfoButton` now reads `t.guide.aboutProject` for both `aria-label` and `title` instead of hardcoded English.                                                         |
| `recruiter-guide.jsx`              | Every string comes from `useLang()`. Lead re-authored. Card 01's button became a dismiss action. `StaffPill` and its `.fw-pill*` CSS removed — deviation 10. The header comment records all three copy defects and points behaviour at the app. |
| `info-pages.jsx`                   | `<InfoButton />` removed from `InfoHeader` and `InfoHeaderMobile`, with a comment recording why the design gave the control up rather than the app growing a site-wide one.                                                                     |
| `export-shot.html`                 | Loads `recruiter-guide.jsx` after `customer-desktop.jsx` and registers `guide-d` / `guide-t` / `guide-m`. Carries the static-vs-variable Inter caveat.                                                                                          |
| `design-review/index.md`           | New section indexing the three overlay boards, naming the copy's canonical location, and repeating the font caveat.                                                                                                                             |

Verification before each push: an `esbuild` parse of every edited file; a local render harness
serving the app's own **variable** Inter with per-subset `@font-face` rules (Polish lives in
`latin-ext`) and a `document.fonts.check` assertion at capture time; and a full render of
`InfoHeader`, `InfoFooter`, `ScreenPricingDesktop`, `ScreenFaqDesktop` and `ScreenAboutDesktop`
with zero page errors — which is what proves `info-pages.jsx` survived a whole-file rewrite intact.

Captured boards, all 2× and Polish unless the name says otherwise: `guide-d-pl.png`,
`guide-d-en.png`, `guide-t-pl.png`, `guide-m-pl.png`, `landing-header-pl.png`,
`footer-pill-pl.png`, `info-header-pl.png`.

---

## 2. Token map

| Design value                               | App token / class                | Mark                                                                        |
| ------------------------------------------ | -------------------------------- | --------------------------------------------------------------------------- |
| `tokens.ink` `#0F172A` (modal fill)        | `--foreground` → `bg-foreground` | exact                                                                       |
| `tokens.accent` `#B43638`                  | `--primary` → `bg-primary`       | exact                                                                       |
| `tokens.serif` Instrument Serif            | `--font-serif`                   | exact                                                                       |
| `tokens.mono` JetBrains Mono               | `--font-mono`                    | exact                                                                       |
| `tokens.hair` `rgba(15,23,42,0.08)`        | `--flota-hair`                   | exact                                                                       |
| `tokens.card` `#FFFFFF`                    | `--card` → `bg-card`             | exact                                                                       |
| `#EEF1F5` (copyright rule)                 | `--flota-neutral-soft`           | exact — same value                                                          |
| `rgba(6,14,28,.58)` (scrim)                | none                             | `deviation(no scrim token)` — arbitrary value, overlay-local                |
| `#F0A3A3` (kicker, staff index)            | none                             | `deviation(no token)` — a tint of `--primary` on a dark surface             |
| `#B4BDCD` (lead)                           | none                             | `deviation(no token)` — dark-surface body text                              |
| `#8B96AA` (public index, skip link)        | none                             | `deviation(no token)`                                                       |
| `#A5AFC0` / `#D5DBE6` (card subs)          | none                             | `deviation(no token)`                                                       |
| `#E5EAF3` (secondary button label)         | none                             | `deviation(no token)`                                                       |
| radius `24px` (modal)                      | none                             | `deviation(off-scale)` — the scale is 8/12/16/20/28; write `rounded-[24px]` |
| radius `18px` (cards)                      | none                             | `deviation(off-scale)` — write `rounded-[18px]`                             |
| `#D8DEE8` (footer pill border)             | `--flota-border` is `#E3E7EC`    | `deviation(1-digit drift)` — keep the design's value, footer-local          |
| `#141922` (footer pill label + arrow dot)  | `--flota-ink-deep` is `#141B2D`  | `deviation(1-digit drift)` — matches the footer's own existing values       |
| `#5B6474` (lock glyph), `#99A2B2` (© text) | none                             | exact — both already shipped in `SiteFooter.astro`                          |

There is **no dark theme** in `global.css`, so every dark-surface colour above is authored as an
arbitrary value on a light-themed page. That is the same posture the landing hero already takes.

---

## 3. Overlay — shell and scrim

| Property              | Value                                      | Mark                                                                                                                                 |
| --------------------- | ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------ |
| scrim fill            | `rgba(6, 14, 28, 0.58)`                    | exact                                                                                                                                |
| scrim blur            | `backdrop-filter: blur(7px)`               | exact                                                                                                                                |
| modal fill            | `#0F172A` (`--foreground`)                 | exact                                                                                                                                |
| modal text            | `#FFFFFF`                                  | exact                                                                                                                                |
| modal shadow          | `0 30px 90px rgba(0, 0, 0, 0.5)`           | exact                                                                                                                                |
| modal font smoothing  | `-webkit-font-smoothing: antialiased`      | exact — Tailwind's `antialiased`. Unported until 2026-09-06; without it every glyph in the modal renders ~20% heavier than the board |
| modal query container | `container-type: inline-size`              | exact                                                                                                                                |
| modal stack gap       | `26px` desktop and tablet · `18px` mobile  | exact                                                                                                                                |
| desktop width         | `780px`, centred                           | exact                                                                                                                                |
| desktop radius        | `24px`                                     | exact                                                                                                                                |
| desktop padding       | `36px 40px 34px`                           | exact                                                                                                                                |
| tablet width          | `660px`, centred                           | exact                                                                                                                                |
| tablet radius         | `24px`                                     | exact                                                                                                                                |
| tablet padding        | `32px 34px 30px`                           | exact                                                                                                                                |
| mobile position       | bottom sheet — `left:0; right:0; bottom:0` | exact                                                                                                                                |
| mobile radius         | `24px 24px 0 0`                            | exact                                                                                                                                |
| mobile padding        | `18px 18px 24px`                           | exact                                                                                                                                |
| dialog role           | `role="dialog"` + `aria-label`             | exact — `aria-modal`, focus trap and Escape come from the Radix primitive, `deviation(no behaviour in source)`                       |
| scroll lock           | body locked while open                     | `deviation(no behaviour in source)` — supplied by the primitive                                                                      |

## 4. Overlay — content

| Element               | Property                                                                                                                                                                                                                                                                                            | Mark                                                                                                                                                                                                                                                                                                                           |
| --------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| head row              | flex, `space-between`, centre-aligned                                                                                                                                                                                                                                                               | exact                                                                                                                                                                                                                                                                                                                          |
| brand lockup          | mark at `32px` width, white; wordmark `19px`, weight `700`, letter-spacing `-0.4px`, gap `9px`                                                                                                                                                                                                      | exact — mark sized by **width**, its viewBox is 124×60                                                                                                                                                                                                                                                                         |
| close button          | `40×40`, radius `999px`, border `1px rgba(255,255,255,0.14)`, fill `rgba(255,255,255,0.04)`, white glyph `15×15` stroke `2.2`                                                                                                                                                                       | exact                                                                                                                                                                                                                                                                                                                          |
| kicker                | mono, `11.5px`, weight `600`, letter-spacing `2px`, uppercase, colour `#F0A3A3`, gap `10px`                                                                                                                                                                                                         | exact                                                                                                                                                                                                                                                                                                                          |
| kicker dot            | `8×8`, radius `99px`, fill `--primary`                                                                                                                                                                                                                                                              | exact                                                                                                                                                                                                                                                                                                                          |
| heading               | serif, weight `400`, `clamp(30px, 6cqw, 44px)`, letter-spacing `-0.02em`, line-height `1.05`, margin-top `12px`, `text-wrap: balance`                                                                                                                                                               | exact — `cqw` resolves against the modal, so 44px at 780, 39.6px at 660, 30px at mobile                                                                                                                                                                                                                                        |
| lead                  | `16px`, line-height `1.5`, colour `#B4BDCD`, margin-top `12px`, max-width `600px`, `text-wrap: pretty`                                                                                                                                                                                              | exact                                                                                                                                                                                                                                                                                                                          |
| lead emphasis         | colour `#FFFFFF`, weight `650`                                                                                                                                                                                                                                                                      | exact                                                                                                                                                                                                                                                                                                                          |
| card grid             | `grid-template-columns: 1fr 1.35fr`, gap `16px`                                                                                                                                                                                                                                                     | exact                                                                                                                                                                                                                                                                                                                          |
| card                  | radius `18px`, padding `22px`, flex column, gap `18px`, `min-width: 0`                                                                                                                                                                                                                              | exact                                                                                                                                                                                                                                                                                                                          |
| card — public         | fill `rgba(255,255,255,0.04)`, border `1px rgba(255,255,255,0.10)`                                                                                                                                                                                                                                  | exact                                                                                                                                                                                                                                                                                                                          |
| card — staff          | fill `rgba(180,54,56,0.10)`, border `1px rgba(180,54,56,0.55)`                                                                                                                                                                                                                                      | exact                                                                                                                                                                                                                                                                                                                          |
| card index            | mono, `12.5px`, weight `600`, letter-spacing `1.5px`, margin-bottom `8px`; `#8B96AA` public, `#F0A3A3` staff                                                                                                                                                                                        | exact                                                                                                                                                                                                                                                                                                                          |
| card title            | `21px`, weight `700`, letter-spacing `-0.4px`, line-height `1.15`                                                                                                                                                                                                                                   | exact                                                                                                                                                                                                                                                                                                                          |
| card sub              | `15px`, line-height `1.5`, margin-top `6px`; `#A5AFC0` public, `#D5DBE6` staff                                                                                                                                                                                                                      | exact                                                                                                                                                                                                                                                                                                                          |
| card actions          | `margin-top: auto`, flex                                                                                                                                                                                                                                                                            | exact                                                                                                                                                                                                                                                                                                                          |
| button                | inline-flex, gap `9px`, height `46px`, padding `0 16px 0 18px`, radius `999px`, `15px`, weight `650`, letter-spacing `-0.2px`, `white-space: nowrap`                                                                                                                                                | exact                                                                                                                                                                                                                                                                                                                          |
| button — primary      | fill `--primary`, `#fff`, border `1px --primary`                                                                                                                                                                                                                                                    | exact                                                                                                                                                                                                                                                                                                                          |
| button — secondary    | fill `rgba(255,255,255,0.06)`, `#E5EAF3`, border `1px rgba(255,255,255,0.16)`                                                                                                                                                                                                                       | exact                                                                                                                                                                                                                                                                                                                          |
| button arrow          | `15×15`, stroke `2.4`, path `M5 12h14M13 6l6 6-6 6`                                                                                                                                                                                                                                                 | exact                                                                                                                                                                                                                                                                                                                          |
| card-02 locator line  | flex, wrap, gap `8px`, `13px`, line-height `1.4`, colour `#C6A0A2`; sits below the card's actions, so the card's `gap:18px` separates them                                                                                                                                                          | exact — restored 2026-09-06, supersedes the Phase 1 removal                                                                                                                                                                                                                                                                    |
| inline staff pill     | a NON-INTERACTIVE replica of the footer pill: `<span>`, no role, no tabIndex, both glyphs `aria-hidden`. Geometry is section 6's exactly — 36px, `0 8px 0 14px`, radius `999px`, border `1px #D8DEE8`, fill `#FFFFFF`, gap `8px`, 14px lock, 12.5px/700 label, 22px ink dot with a 12px white arrow | exact — the label is the FOOTER's own (`login.zone` in the design, `footer.staffZone` in the app, passed as a prop). Not the card's title: in Polish both read `Strefa pracownika`, but in English the footer says `Employee zone` and the card says `Staff area`, and a replica that misnames the control defeats its purpose |
| skip link             | `align-self: flex-start`, `14.5px`, `#8B96AA`, underlined, `text-underline-offset: 3px`                                                                                                                                                                                                             | exact                                                                                                                                                                                                                                                                                                                          |
| hover / focus-visible | authored from the neighbouring controls' treatments                                                                                                                                                                                                                                                 | `deviation(no states in source)`                                                                                                                                                                                                                                                                                               |

### Container-query collapse — `@container (max-width: 520px)`

| Element   | Change                      | Mark  |
| --------- | --------------------------- | ----- |
| card grid | one column, gap `12px`      | exact |
| button    | `flex: 1`, height `44px`    | exact |
| lead      | `14.5px`, margin-top `10px` | exact |
| heading   | margin-top `10px`           | exact |
| card      | padding `16px`, gap `14px`  | exact |
| card sub  | `14.5px`                    | exact |
| skip link | hidden                      | exact |
| locator   | `12.5px`                    | exact |

The query resolves against the **modal**, not the viewport — the modal declares
`container-type: inline-size`. This matches the project's embeddable-panels rule, so use
`@min-[…]` / `@max-[…]` container variants, never `md:` or `lg:`.

## 5. `InfoButton` — landing header pill

| Property            | Value (light)                                                                              | Value (dark)                 | Mark                                                                                                                                                                       |
| ------------------- | ------------------------------------------------------------------------------------------ | ---------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| size                | `38×38`, padding `0`                                                                       | same                         | exact — matches `LangToggle`'s 38px height so the pair reads as one group                                                                                                  |
| radius              | `999px`                                                                                    | same                         | exact                                                                                                                                                                      |
| border              | `1px --flota-hair`                                                                         | `1px rgba(255,255,255,0.22)` | exact                                                                                                                                                                      |
| fill                | `--card`                                                                                   | `rgba(255,255,255,0.14)`     | exact                                                                                                                                                                      |
| backdrop            | none                                                                                       | `blur(6px)`                  | exact                                                                                                                                                                      |
| glyph               | `16×16`, stroke `1.8`: `circle r=9`, `path M12 11v5.5`, filled `circle cx=12 cy=7.6 r=0.9` | same, white stroke           | exact                                                                                                                                                                      |
| `aria-label`        | Polish canonical, English alongside                                                        | same                         | `deviation(source hardcodes English in both halves)` — Phase 1 fixes the source                                                                                            |
| order in cluster    | immediately before `LangToggle`                                                            | same                         | exact                                                                                                                                                                      |
| gap to `LangToggle` | `16px` in the design's `LandingNav`                                                        | `8px` tablet, `10px` mobile  | `deviation(app cluster gap is 20px desktop / 8px tablet / 8px mobile)` — keep the app's existing gaps rather than introduce a fourth spacing value into a measured cluster |
| hover / focus       | authored from `LangToggle`'s own treatment                                                 | same                         | `deviation(no states in source)`                                                                                                                                           |
| presence            | landing clusters only                                                                      | —                            | `deviation(owner scoped to landing; design's two info-page headers are corrected in Phase 1)`                                                                              |

## 6. Footer staff pill

| Property        | Value                                                                                               | Mark                                                                                                                                                                                                                             |
| --------------- | --------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| container       | copyright bar becomes a wrapping flex row, `space-between`, gap `14px`, centre-aligned              | exact                                                                                                                                                                                                                            |
| bar rule        | `margin-top 26px`, `padding-top 18px`, `border-top 1px #EEF1F5`                                     | exact — unchanged from the shipped footer                                                                                                                                                                                        |
| © text          | `12px`, `#99A2B2`                                                                                   | exact — unchanged                                                                                                                                                                                                                |
| pill element    | `<a href="/auth/signin">`                                                                           | `deviation(anchor navigates; the source's role="button" + tabIndex would mis-announce it, and an anchor keeps the accessible name equal to the visible label)`                                                                   |
| pill height     | `36px`                                                                                              | exact                                                                                                                                                                                                                            |
| pill padding    | `0 8px 0 14px`                                                                                      | exact                                                                                                                                                                                                                            |
| pill radius     | `999px`                                                                                             | exact                                                                                                                                                                                                                            |
| pill border     | `1px #D8DEE8`                                                                                       | exact                                                                                                                                                                                                                            |
| pill fill       | `#FFFFFF`                                                                                           | exact                                                                                                                                                                                                                            |
| pill gap        | `8px`                                                                                               | exact                                                                                                                                                                                                                            |
| lock glyph      | `14×14`, stroke `#5B6474` width `2`: `rect x=4 y=11 w=16 h=10 rx=2`, `path M8 11V8a4 4 0 0 1 8 0v3` | exact                                                                                                                                                                                                                            |
| label           | `12.5px`, weight `700`, `#141922`, letter-spacing `-0.1px`                                          | exact                                                                                                                                                                                                                            |
| arrow dot       | `22×22`, radius `999px`, fill `#141922`                                                             | exact                                                                                                                                                                                                                            |
| arrow glyph     | `12×12`, stroke `#fff` width `2.4`, path `M5 12h14M13 6l6 6-6 6`                                    | exact                                                                                                                                                                                                                            |
| accessible name | the visible label, `Strefa pracownika` / `Employee zone`                                            | `deviation(source uses a longer aria-label "Strefa pracownika — zaloguj się"; keeping the visible label as the name preserves the existing e2e assertion and follows the a11y rule that a visible label is the accessible name)` |
| removed         | the `staffZone` row leaves the Information column                                                   | exact — the source's footer has four Information rows, not five                                                                                                                                                                  |
| hover / focus   | authored from the footer's existing link treatment                                                  | `deviation(no states in source)`                                                                                                                                                                                                 |

---

## 7. Verbatim copy — **LIVE in the design source since 2026-09-06**

Polish is canonical. These are written into `shared.jsx` as `STR.PL.guide` / `STR.EN.guide`, and
`recruiter-guide.jsx` renders from them. **Phase 3 copies this table into
`src/lib/i18n/orientation.ts`** — the design is the source of record for these strings, not the
other way round. Rendered proof: `design-review/guide-d-pl.png` and `guide-d-en.png`.

| Key           | PL (canonical)                                                                                                        | EN                                                                                                       |
| ------------- | --------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| `kicker`      | `Zacznij tutaj · portfolio`                                                                                           | `Start here · portfolio`                                                                                 |
| `heading`     | `Flota to dwa produkty w jednym.`                                                                                     | `Flota is two products in one.`                                                                          |
| `leadBefore`  | `Publiczna strona wynajmu dla klientów i `                                                                            | `A public rental site for customers and the `                                                            |
| `leadStrong`  | `Strefa pracownika`                                                                                                   | `Staff area`                                                                                             |
| `leadAfter`   | ` — panel obsługi i administracji, który za nią stoi. Dane logowania do wersji demo znajdziesz na stronie logowania.` | ` — the operations and admin app behind it. Demo sign-in credentials are published on the sign-in page.` |
| `publicTitle` | `Strona publiczna`                                                                                                    | `Public site`                                                                                            |
| `publicBody`  | `Przeglądaj flotę i złóż rezerwację — bez zakładania konta.`                                                          | `Browse the fleet and request a reservation — no account needed.`                                        |
| `publicCta`   | `Przeglądaj stronę`                                                                                                   | `Explore the site`                                                                                       |
| `staffTitle`  | `Strefa pracownika`                                                                                                   | `Staff area`                                                                                             |
| `staffBody`   | `Panel obsługi i administracji za logowaniem. Na stronie logowania czeka gotowe konto demo.`                          | `The operations and admin app behind sign-in. A ready demo account is waiting on the sign-in page.`      |
| `staffCta`    | `Przejdź do strefy pracownika`                                                                                        | `Go to the staff area`                                                                                   |
| `skip`        | `Pomiń i przeglądaj stronę`                                                                                           | `Skip and explore the site`                                                                              |
| `close`       | `Zamknij`                                                                                                             | `Close`                                                                                                  |
| `dialogLabel` | `O tym projekcie`                                                                                                     | `About this project`                                                                                     |
| `locator`     | `Znajdziesz ją też na dole każdej strony:`                                                                            | `You'll also find it at the bottom of every page:`                                                       |

Header pill label, added to the existing `nav` namespace rather than `orientation` — it is header
chrome, and the namespace an island imports must stay the smallest one that covers it:

| Key            | PL (canonical)    | EN                   |
| -------------- | ----------------- | -------------------- |
| `aboutProject` | `O tym projekcie` | `About this project` |

The existing `nav.about` key is the "O nas" / "About" nav destination and must not be reused.

Footer label — **unchanged**, `footer.staffZone` keeps `Strefa pracownika` / `Employee zone`. The
frame's decision: the label stays, the overlay carries the invitation.

### Copy defects corrected

| Source string                                                                | Why it cannot ship                                                                             |
| ---------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| "Everything here is a static design: no sign-in needed"                      | False of the app — the cockpit is behind sign-in, with a demo card at the door.                |
| "In the product it opens from the [pill] in the footer of every public page" | Describes the mock's own framing, not a message to a visitor; the pill is visible right there. |
| "Customer site" as a button label                                            | Names a destination for an action that dismisses; the visitor is already there.                |

---

## 8. Deviations register

Carried forward so the fidelity gate converges instead of re-flagging them.

1. `deviation(owner scoped to landing)` — the info pill ships in the three landing clusters only.
   Phase 1 removes it from the design's two info-page headers so the two agree.
2. `deviation(anchor navigates)` — the footer pill is an `<a>`, not `role="button"`.
3. `deviation(accessible name = visible label)` — the footer pill drops the source's longer
   `aria-label`.
4. `deviation(no behaviour in source)` — focus trap, Escape, scroll lock and `aria-modal` come from
   the Radix dialog primitive.
5. `deviation(no states in source)` — hover and focus-visible authored for the overlay's buttons,
   the info pill and the footer pill.
6. `deviation(app cluster gaps retained)` — the info pill uses the landing cluster's existing gaps
   rather than the design's 16px.
7. `deviation(off-scale radii)` — 24px and 18px are written as arbitrary values; the token scale is
   8 / 12 / 16 / 20 / 28.
8. `deviation(no tokens for dark-surface colours)` — the overlay's seven greys and tints are
   arbitrary values, as the landing hero's palette already is.
9. `deviation(landing collapse threshold re-derived)` — the `@min-[1208px]` figure is replaced by a
   measured number, not a transcribed one.
10. ~~`deviation(copy superseded the inline pill)`~~ — **WITHDRAWN 2026-09-06.** Phase 1 deleted
    card 02's inline "Strefa pracownika" pill on the grounds that its sentence pointed at the
    footer instead of linking anywhere. That reasoning only ever covered the sentence. The owner
    asked for the pill back, and it returns UNDERNEATH the CTA rather than in place of it, because
    the two do different jobs: the CTA takes the visitor to the staff area now, and the replica
    teaches them which control to look for in the footer on every visit after this overlay is gone
    for good. `StaffPill` is restored in `shared.jsx` and card 02 renders it from a `locator` line.
    Both the design and the app draw it, so this is no longer a deviation at all.
