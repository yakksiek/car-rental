<!-- DESIGN-AUDIT -->

# Design-fidelity audit — landing + fleet (pre–Phase 6)

- **Date**: 2026-08-02
- **Canonical source**: live Claude Design `customer-desktop.jsx` (JSX = source of truth; screenshots secondary)
- **Method**: 4 parallel component-cluster comparisons (fleet controls · cards · landing hero/nav/trust · landing sections), each transcribing exact values from the design fn and diffing against the app. Widths: desktop 1440 · tablet 834 · mobile 390. App breakpoints `sm`=640 `lg`=1024 `xl`=1280.
- **Legend**: 🔴 high (visible / broken) · 🟡 med · ⚪ low (sub-pixel / imperceptible) · **[D]** needs your decision · **[dev]** intended deviation (excluded)

---

## 1 · Your four reported issues — confirmed, with exact fixes

### 1a — Landing has no tablet layout 🔴 (responsive-gap)

The whole tablet band (768–1279) renders the mobile stack; `index.astro` only splits at `xl:`. The design has a distinct `ScreenTabletHome` (834). Deltas to build:

- **Hero** → 2-col grid `1.25fr / 0.95fr`, gap 36, `align-end`, 452px photo stage: heading (`62px/lh62/-2.4` + 11px accent-circle dot) + bullets LEFT, white search card (radius 22, p-14, shadow `0 22px 50px -18px`, 3 fields + full-width 54px `Szukaj`) RIGHT.
- **Nav** → glass pill (`rgba(255,255,255,0.12)`, blur, Start/Flota/Cennik/FAQ) + glass phone/book toggle over the hero (app shows the mobile hamburger below `lg`).
- **Trust bar** → 3-across white bar (`1fr 1fr 1fr`, radius 20, cells `10px 18px` split by `#EEF1F5`), not the stacked card.
- **Popularne** → 3-col at tablet (app is `sm:grid-cols-2` → 2-col at 834).
- **Process / TypeSelector** → design has tablet treatments too; app falls to mobile. (Exact 834 values for these two weren't in the supplied JSX — port from `ScreenTabletHome`.)

### 1b — Hero trust card uses old icon tiles 🔴 (BUG)

- `TrustRow` hardcodes `showTiles = false` → **no boxed tiles**; instead one large faint glyph behind each row: `absolute right-8 top-1 opacity-0.09`, `<Bg s={76} c=accent>` — star / truck / phone. App renders solid 38px `bg-background rounded-md` tiles (`TrustCard.astro:29,42,67,82`). **Fix**: drop tiles → single 76px accent glyph @0.09 top-right behind title/sub.
- Bundle two related trust fixes: **desktop card has no row dividers** (design desktop = flex col `gap:2`; only _mobile_ uses `#EEF1F5` dividers) — app has `border-b` everywhere (`:28,:41`); and **desktop width 340 → 300** (`index.astro:193`).

### 2a — Fleet filter "not done correctly"

- **(i) Delete the result heading** 🔴 — `"{count} pojazdów gotowych do wynajmu."` (`fleet/index.astro:123-128`); design has none at any breakpoint. Move ~40px top padding onto the pill bar + mobile scroller. _(Note: design-contract S3 explicitly KEEPS it — your delete directive overrides the contract; I'll update S3.)_
- **(ii) The "two broken pills" = SelectTrigger height collapse** 🔴 — Ładowność/Sortowanie are shadcn `<SelectTrigger>` (Termin is a plain `<button>`). `select.tsx:32`'s `data-[size=default]:h-9` (36px) is an attribute-selector (specificity 0,2,0) that **beats** `fieldShell`'s `h-[52px]` (0,1,0); tailwind-merge can't dedupe across the differing modifier, so both survive → the two pills render **36px** not 52px, the 36px pink chip fills the whole height (zero vertical padding), text cramps. `py-2` + `justify-between` also leak in. **Fix**: add `data-[size=default]:h-[50px] sm:data-[size=default]:h-[52px]` to `fieldShell` (drops the default via same-modifier merge) + `py-0`; or `!h-[50px] sm:!h-[52px]` on the two triggers.
- **(iii) Card footer stacks on laptops** 🔴 _(separate — cards not filter)_ — footer side-by-side gated at `@min-[400px]:` (`VehicleCard.astro:101,111`); 3-col cards only hit 400px at vw≳1340, so 1280–1339 shows full-width stacked `Rezerwuj`. **Fix**: lower to `@min-[360px]:`.

### 2b — Mobile type-pill scroller animation janky 🟡 (BUG)

`FleetTypeScroll.tsx:132,141` uses `transition-all` morphing `w-10↔flex-1` + `pr-4 pl-3` + `ml-2↔ml-0` + `max-w`. Design transitions **only** `flex .32s, background .25s, color .2s` (label conditionally rendered, padding/gap constant). **Fix**: mirror `HeaderContactToggle.tsx` — fixed icon holder, animate only `flex`/`max-width`, drop `transition-all`, drop animated padding/margin.

---

## 2 · Additional discrepancies found (worth fixing)

### Fleet — filter card & pills

| #   | Issue                                                                                                             | App                                                | Design                                           | Sev                                               |
| --- | ----------------------------------------------------------------------------------------------------------------- | -------------------------------------------------- | ------------------------------------------------ | ------------------------------------------------- |
| F1  | **Mobile Termin icon** is a 36px transparent circle → label pushed ~17px right                                    | `size-9` wrapper + `size-[18px]` (`FilterBar:125`) | bare `<Icon.calendar s=16>` inline               | 🟡                                                |
| F2  | **Mobile row chevrons point down** (every row)                                                                    | `ChevronDown` + Select's built-in ⌄                | right chevron `M9 6l6 6-6 6` (17px)              | 🟡 **[D]** (⌄ is conventional for real dropdowns) |
| F3  | **Mobile Ładowność/Sortowanie labels muted grey**                                                                 | `text-muted-foreground`                            | dark `#141922` (only icon'd Termin row is muted) | 🟡                                                |
| F4  | Mobile row padding / label size                                                                                   | `px-3.5`(14) `text-[14px]`                         | `padding 0 16px`, `14.5px`                       | ⚪                                                |
| F5  | Filter card right pad + gaps + missing pill shadow + tracking (`Filtry` 0.4, label 0.5, field gap 11, chip gap 9) | see agent notes                                    | design values                                    | ⚪ (batch)                                        |
| F6  | **Tablet fields stretch full-width** (`sm:flex-1`) instead of hugging + wrapping                                  | `sm:flex-1`                                        | `flexShrink:0` wrap                              | 🟡 (part of 1a tablet pass)                       |
| F7  | Desktop pill-bar icon gap + tracking                                                                              | `gap-2.5` no tracking                              | `gap:12`, `-0.1px`                               | ⚪                                                |
| F8  | Zastosuj desktop size/pad                                                                                         | `text-[15px] lg:px-7`                              | `14px`, `px-26`                                  | ⚪                                                |
| F9  | Scroller nits: active `pr-4 pl-3`→`px-14`, dim the `·` @0.4, inactive `/70`→`/72`, `flex-1`→`1 1 auto`            | —                                                  | —                                                | ⚪ (fold into 2b)                                 |

### Fleet — VehicleCard (`FleetCardBig`) — mostly matching; micro-nits only ⚪

Batch one pass: eyebrow `tracking-[0.4px]`, title `leading-[1.1]`, subtitle `mt-[3px]`, spec icon `size-[15px]`, spec value `tracking-[-0.1px]`, price `tracking-[-0.7px]`, drop `/dzień` `ml-1`, row-mode footer `@min:gap-0`. (Colors #0f172a vs #141922 = **[dev]**.)

### Landing — hero / nav (beyond 1a/1b)

| #   | Issue                                                     | App                                           | Design                                     | Sev                                       |
| --- | --------------------------------------------------------- | --------------------------------------------- | ------------------------------------------ | ----------------------------------------- |
| H1  | **Mobile heading dot** is a text "."                      | `<span>.</span>` (`index.astro:115`)          | 9px accent circle                          | 🟡                                        |
| H2  | Mobile wordmark top                                       | `top-[70px]`                                  | `top:86`                                   | ⚪                                        |
| H3  | Mobile sheet overlap / content pad                        | `-mt-8`, `pb-[56px]`                          | `-16`, `34`                                | ⚪                                        |
| H4  | Nav active-pill shadow / logo mark sizes / dark-btn token | `0 1px 2px/.08`, marks 38/34, `bg-foreground` | `0 2px 6px/.15`, 42/38, `--flota-ink-deep` | ⚪ (batch; ink-deep token already exists) |

### Landing — ProcessSteps & TypeSelector (sections)

| #   | Issue                                                              | App                                                     | Design                                                | Sev |
| --- | ------------------------------------------------------------------ | ------------------------------------------------------- | ----------------------------------------------------- | --- |
| P1  | **Desktop step title/desc use mobile ramp** + loose                | title `16px tracking-tight`, desc `13.5/21`, gap `mt-2` | title `16.5/lh21` no tracking, desc `13/20`, gap `16` | 🟡  |
| P2  | Lane pills too big/light + no shadow                               | `14px/500`, no shadow                                   | `12.5/600`, `0 2px 6px/.08`                           | 🟡  |
| T1  | **Mobile inactive type-pills are transparent** (grey show-through) | no bg (`TypeSelector:64`)                               | `#fff`                                                | 🟡  |
| T2  | **Mobile type-pills wrap** instead of horizontal scroll            | `flex-wrap` (`:55`)                                     | nowrap `shrink-0` scroll                              | 🟡  |
| T3  | Mobile active pill missing crimson glow + weights (650/550)        | desktop-only shadow, 600/500                            | `0 4px 12px -3px/.35`, 650/550                        | ⚪  |
| T4  | Desktop transporter icon not enlarged + gap                        | all `size-[18px]`, `gap-2`                              | transporter `20`, `gap:9`                             | ⚪  |

### Landing — Popularne card (`LandingVehicleCard`) — shipped-landing surface, many diffs 🟡 **[D scope]**

Real per the design JSX (`PopularCard`/`MobilePopularCard`): **subtitle color** `#334155`→`#99A2B2` (dark→grey, visible); **image radius swapped** (app 12mob/14desk → design 14mob/12desk); **desktop spec dividers** should be vertical inter-column rules + one bottom hairline (app uses `border-y` grid both states); **spec value** `500`→`600`, `11px`→`12px`; **CTA** `bg-foreground`→`ink-deep`, `text-xs`→`13.5/14px`, height 36→~40/44; **price mobile** 22→24; **"od"** 15→12px; **row align** desktop `items-end`→`items-center`. Not in your reported set — include only if we're polishing the whole landing.

---

## 3 · Decisions for you

1. **Footer threshold (2a-iii)** — include the `@min-[400px]→@min-[360px]` fix in Phase 6? _(recommend yes — it's the "cramped card" you saw.)_
2. **Landing Popularne card (§2 last block)** — in scope, or leave the shipped card as-is? _(it's real drift but wasn't in your 4 issues.)_
3. **Mobile row chevron direction (F2)** — match design's `›` or keep `⌄` (conventional for a real Select)? _(recommend keep `⌄`.)_
4. **Filter default-value color on desktop** — design is internally inconsistent (desktop shows `dowolna`/`Polecane` **dark**; mobile mutes them). App mutes throughout. Match design-desktop (dark) or keep muted? _(recommend keep muted — cleaner.)_
5. **Icon glyph choices** — app uses lucide `Package`(Ładowność)/`ArrowUpDown`(Sortuj)/`SlidersHorizontal`(Filtry); design uses weight/funnel glyphs. Keep the lucide mapping? _(recommend keep.)_
6. **TypeSelector "see-all" CTA** — app `Cała flota` dark; design `Wszystkie` crimson (`0 4px 14px -2px/.35`). The rename came from the dropped hover-preview. Keep dark rename or restore crimson? _(recommend keep — record as deviation.)_

---

## 4 · Deliberately excluded (checked → intended / non-issues)

- **Serif display headings** (`font-serif` on h1 / section h2) — established `landing-redesign` brand face; every design screenshot renders these serif. (Agent inferred sans from `tokens.font`; false positive.)
- **Sitewide token snaps** — `--flota-ink` `#0f172a`≈`#141922`, `--flota-ink-2` `#334155` vs `#5B6474`, `--border` `#e3e7ec`≈`#E7EAF0`, muted `#94a3b8`≈`#99A2B2`. Prior-slice token layer; imperceptible.
- **Fleet grid gap uniform 22** (contract S5) · **mobile gutter 20 vs 18** (contract mis-records 18 as "exact"; 2px) · **placeholder gradient** (real-photo/silhouette swap) · **HeroSearch DATY calendar icon** (functional control vs static mock) · **uniform pill glyph sizes** · **subtitle = year only** (data model has no trim field).
