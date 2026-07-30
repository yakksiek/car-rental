# Landing Redesign — Design Contract

> Exact-values contract for the customer desktop + mobile home restyle. Each spec line
> is marked `exact` (transcribed verbatim from the design source) or `deviation(reason)`
> (a deliberate divergence, recorded so the fidelity gate converges instead of re-flagging).
>
> **Design source (pull via `DesignSync`, do NOT copy into the repo):** Claude Design
> project `Rental car company` (`352d78a6-84fd-49a2-8b38-2fe289691fc3`), file
> `customer-desktop.jsx` → `ScreenDesktopHome` (1440px) and `ScreenMobileHome` (390px,
> section "11m · Customer · Landing page · MOBILE"). Handover mirror on disk:
> `~/Downloads/flota-handover/flota-landing.html` (desktop structure SoT).
>
> **Canonical screenshots (in-repo, this change):**
> `design-review/desktop-landing-1440.png`, `design-review/mobile-landing-part1-hero-search-trust.jpg`,
> `design-review/mobile-landing-part2-process-popular.jpg`.

---

## Design Alignment Audit

### Freshness — repo designs vs canonical

| Repo design artifact                                                                 | Status                    | Note                                                                                                                                                                                                         |
| ------------------------------------------------------------------------------------ | ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `design-system.md` row 07 "Landing page · Customer desktop" (`customer-desktop.jsx`) | **current**               | Restyled `ScreenDesktopHome` is the new canonical; screenshot 07 (`07-customer-desktop-landing.png`) is **superseded** by `desktop-landing-1440.png`.                                                        |
| `screenshots/07-customer-desktop-landing.png`                                        | **outdated (superseded)** | Pre-restyle desktop home. Re-export to `design/screenshots/` at archive from the shipped surface.                                                                                                            |
| `screenshots/01-customer-mobile-home.png`                                            | **not applicable**        | That is the _logged-in_ mobile home ("Dzień dobry, Jakub", `customer-screens.jsx → ScreenHome`) — a different, deferred v2 surface. The new public mobile landing is `ScreenMobileHome`, not catalogued yet. |
| `design/tokens.css` / `src/styles/global.css`                                        | **current**               | No token change. Frame hypothesis 2 confirmed every mock hex is within a few RGB of an existing token.                                                                                                       |

### New-design gaps (quality audit of the provided canonicals)

- **States:** the canonicals show only the **default/populated** state. Empty state (zero
  vehicles → no Popular strip, count reads `0`) and the search island's error state are
  **not** in the mock — handled from existing component behavior + recorded as
  `deviation(no-mock)`.
- **Breakpoints:** desktop 1440px and mobile 390px are both canonical. The **tablet /
  in-between range (641–1279px)** has no mock — reflow rules are derived (`deviation(no-mock)`),
  verified by responsive judgment, not a pixel diff.
- **Copy:** desktop and mobile use **intentionally different** per-breakpoint strings
  (subcopy, bullet 1, stepper titles, footer tagline). Both transcribed below as `exact`
  for their breakpoint.
- **Interaction:** the category selector's documented "hover → filter Popular" is **not**
  built this slice (click-to-route only) — `deviation(scope)`.

### Alignment checklist (plan ↔ canonical)

| Canonical surface                                  | Plan phase                   | Vision-diff target |
| -------------------------------------------------- | ---------------------------- | ------------------ |
| Landing nav (desktop pill / mobile logo+hamburger) | Phase 1                      | both canonicals    |
| Dark hero (photo/wordmark/van/copy/bullets)        | Phase 2                      | both canonicals    |
| Search pill + trust card + sheet transition        | Phase 2                      | both canonicals    |
| "Proces wynajmu" stepper                           | Phase 3                      | both canonicals    |
| "Wybierz typ pojazdu." category selector           | Phase 3                      | both canonicals    |
| "Popularne" strip (forked card)                    | Phase 3                      | both canonicals    |
| Footer                                             | Phase 3 (reuse `SiteFooter`) | both canonicals    |

**Verdict:** PASS — 7 surfaces aligned, 1 repo design superseded (`07-…-landing.png`),
deviations recorded below. Canonicals captured. No surface without a phase; no phase
without a design.

---

## Token map (design hex → app token)

All colors resolve to **existing** tokens (`src/styles/global.css`) — **no `global.css` edit**.

| Design value                                    | App token / utility                                                         | exact / deviation                                                               |
| ----------------------------------------------- | --------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| `#B43638` accent                                | `--primary` / `text-primary` `bg-primary`                                   | **exact**                                                                       |
| `#8E2628` accent pressed                        | `--flota-accent-dark`                                                       | **exact**                                                                       |
| `#F3E3E3` red-tint chip                         | `--flota-accent-soft` `#FBE4E1` / `bg-accent`                               | deviation(token is pinker; use token, no global edit)                           |
| `#F4F5F7` / `#F1F3F7` paper                     | `--flota-bg` `#F1F3F6` / `bg-background`                                    | deviation(~1–2 RGB; use token)                                                  |
| `#FFFFFF` card                                  | `--flota-card` / `bg-card`                                                  | **exact**                                                                       |
| `#141922` / `#0E1524` body ink                  | `--flota-ink` `#0F172A` / `text-foreground`                                 | deviation(~small; use token)                                                    |
| `#141B2D` INK_D dark buttons                    | `bg-foreground text-background`                                             | deviation(mock bluer; use foreground — matches existing HeroSearch dark button) |
| `#5B6474` ink-2                                 | `--flota-ink-2` `#334155` / `text-[var(--flota-ink-2)]`                     | deviation(mock lighter; use token — existing pattern)                           |
| `#99A2B2` / `#9AA3B2` muted                     | `--flota-muted` `#94A3B8` / `text-muted-foreground`                         | deviation(~small; use token)                                                    |
| `#E7EAF0` / `#E4E8EF` line                      | `--flota-border` `#E3E7EC` / `border-border` `border-[var(--flota-hair-2)]` | deviation(~small; use token)                                                    |
| `#16A34A` green "Dostępny"                      | `--flota-success` `#1B9E5A` / `text-success bg-success`                     | deviation(mock brighter; use token)                                             |
| `#E7F7EE` green bg                              | `--flota-success-soft` `#E3F5EC`                                            | deviation(~small; use token)                                                    |
| **`#080B12`** hero canvas (desktop)             | **landing-local** — arbitrary `bg-[#080B12]`                                | **exact** (dark palette, no token exists)                                       |
| **`#0A0D14`** hero canvas (mobile)              | **landing-local** — arbitrary `bg-[#0A0D14]`                                | **exact**                                                                       |
| `rgba(255,255,255,.95/.92/.8/.72/.6)` hero text | `text-white/95` … `text-white/60`                                           | **exact**                                                                       |
| hero scrims (see hero rows)                     | arbitrary `[background:linear-gradient(...)]`                               | **exact**                                                                       |

### Fonts (reuse existing families — no new webfonts, no `astro.config`/`Layout` change)

| Design role (mock font)                                            | App font                              | exact / deviation                                       |
| ------------------------------------------------------------------ | ------------------------------------- | ------------------------------------------------------- |
| FLOTA wordmark (Space Grotesk 700)                                 | **Inter 700** (`font-sans font-bold`) | deviation(reuse existing fonts; no Space Grotesk)       |
| Hero H1 "Pojazdy użytkowe." (Space Grotesk 700)                    | **Instrument Serif** (`font-serif`)   | deviation(reuse fonts + keep shipped serif H1 identity) |
| Big stat numbers (Space Grotesk 700)                               | **Inter 700**                         | deviation(reuse fonts)                                  |
| Section headings — Proces / Wybierz / Popularne (Playfair Display) | **Instrument Serif** (`font-serif`)   | deviation(reuse fonts; no Playfair)                     |
| All UI / body / labels / buttons (Inter)                           | **Inter** (`font-sans`)               | **exact**                                               |

### Radii

| Element                                                | Value                                                                      | exact / deviation                                                           |
| ------------------------------------------------------ | -------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| Nav pill, menu capsule, category pills, chips          | `999px` → `rounded-full`                                                   | **exact**                                                                   |
| Search pill container                                  | `22px` → `rounded-[22px]`                                                  | **exact**                                                                   |
| Search "Szukaj" button                                 | `15px` → `rounded-[15px]`                                                  | deviation(our `--radius-button` is 14px; match mock at 15px)                |
| Popular card (desktop)                                 | `18px` → `rounded-[18px]`                                                  | **exact**                                                                   |
| Popular card (mobile)                                  | `20px` → `rounded-xl` (`--flota-radius-xl` 20)                             | **exact**                                                                   |
| Trust card                                             | `22px` → `rounded-[22px]`                                                  | **exact**                                                                   |
| Proces card (desktop / mobile)                         | `28px` / `24px` → `rounded-[28px]` / `rounded-[24px]`                      | **exact**                                                                   |
| Body sheet top corners (desktop / mobile)              | `40px` / `28px` → `rounded-t-[40px]` / `rounded-t-[28px]`                  | **exact**                                                                   |
| F-logo tile (nav/footer)                               | `11px` → `rounded-[11px]`                                                  | **exact** (SiteHeader/SiteFooter use 10px; landing uses 11 — landing-local) |
| Trust tile                                             | `12px` → `rounded-md` (12)                                                 | **exact**                                                                   |
| Category-pill container / mobile CTA / hero mobile CTA | `999` / `16` / `16` → `rounded-full` / `rounded-[16px]` / `rounded-[16px]` | **exact**                                                                   |

---

## Surface specs

Positions are the design's absolute-layout intent; **re-author as flow/grid + Tailwind
responsive utilities**, not absolute pixels (the mock is a fixed-canvas prototype). Keep
the _values_ (sizes, gaps, colors→tokens, copy) exact; adapt the _layout mechanism_.

### S0 · Page shell

- **Container:** `max-w-app` (1400px) is the app cap, but the restyled hero is **full-bleed**
  (edge-to-edge dark). Body sheet content is padded `64px` desktop / `16px` mobile. `exact`
- **Order (desktop):** full-bleed dark hero (headline+bullets+search left, trust card right,
  floating nav on top) → light sheet (Proces → Kategorie+Popularne → footer). `exact`
- **Order (mobile):** dark hero (nav, eyebrow, headline, bullets, "Zarezerwuj online" CTA) →
  light sheet (search card → trust card → Proces → Kategorie → Popularne → footer). `exact`
  — note: **search island is inside the dark hero on desktop, inside the light sheet on
  mobile**; "Zarezerwuj online" CTA is **mobile-only**. `deviation(cross-breakpoint reflow)`

### S1 · LandingNav (fork — new `LandingNav.astro`, landing-only; do NOT edit `SiteHeader`)

**Desktop (≥xl):** floating white pill. `absolute` top `28px`, side inset `32px`, over the hero.
padding `11px 22px 11px 14px`; `rounded-full`; shadow `0 12px 34px -10px rgba(0,0,0,.25)`. `exact`

- Left: F-logo tile `38px` `rounded-[11px]` `bg-primary` white "F" (Inter 700, 19px) + "Flota"
  20px `font-bold` tracking-tight `text-[#0E1524]`. `exact`
- Center: menu capsule `bg-[#F1F3F7]` `rounded-full` padding `5px 6px`; items padding `9px 18px`
  `rounded-full`, 14.5px. **Ship only `Start` (active, white pill + shadow) and `Flota`
  (`text-[#5A6373]` 500).** `deviation(drop Cennik / Dla firm / Pomoc — no routes exist)`
- Right: phone `+48 22 100 20 30` (accent phone icon 15px + `text-[#0E1524]` 14.5 bold);
  CTA "**Przeglądaj flotę**" → `/fleet`, `bg-foreground text-background` `rounded-full`
  padding `13px 22px` 14.5 semibold. `exact` (copy Polish) ·
  `deviation(drop "PL · EN" toggle — no i18n)` · `deviation(mock CTA reads English "Browse the fleet" → Polish "Przeglądaj flotę")`

**Mobile (<xl):** over the photo, `top 16 / inset 16`. `exact`

- Left: F-logo `34px` `rounded-[10px]` `bg-primary` "F" (17px) + "Flota" 19px `font-bold` **white**. `exact`
- Right: hamburger button `40px` `rounded-[12px]` `bg-white/15` `backdrop-blur-[6px]`, 3-line
  icon (`M4 7h16M4 12h16M4 17h16`) white, 18px. `exact`
  - **Behavior:** landing-local dropdown built **inside `LandingNav`** (dark trigger + Start +
    Flota + phone). Do **NOT** edit the shared `MobileNav.tsx` — only `SiteHeader` consumes it,
    so restyling it regresses the mobile menu on `/fleet` + the other 4 public pages, and reusing
    it unmodified fails this spec (it renders a light `bg-card` overlay + `rounded-full` trigger,
    Start/Flota only, no phone). `deviation(no-mock for open state)`

### S2 · Dark hero

**Desktop:** section `bg-[#080B12]`, height `880px` (full-bleed, full viewport width). `exact`

- **Photo:** `~/Downloads/flota-handover/images/generated-1784921984332.png` → `src/assets/`,
  `astro:assets <Picture>` AVIF+WebP, `object-cover object-center`, eager, `fetchpriority="high"`. `exact`
- **Top scrim:** height 300, `linear-gradient(180deg, rgba(10,10,18,.6) 0%, rgba(10,10,18,0) 100%)`. `exact`
- **Bottom scrim:** top 420 height 460, `linear-gradient(180deg, rgba(10,10,18,0) 0%, rgba(10,10,18,.95) 100%)`. `exact`
- **FLOTA wordmark (z-3):** centered, top ~172; **Inter 700**, `258px`, `tracking-[-10px]`,
  normal line-height, `opacity-[0.7]`, gradient-clip text
  `[background-image:linear-gradient(0deg,#FFFFFF_0%,#FFFFFF_40%,rgba(238,242,255,0)_82%)]`
  (white solid at the glyphs' base, fading UP to transparent — note the `0deg`/stop order;
  `bg-clip-text text-transparent`). `deviation(mock font Space Grotesk → Inter)` else `exact`
- **Van cutout (z-4):** `van-cutout.png` → `src/assets/`, same crop/position as photo,
  `object-cover object-center`, `pointer-events-none`. Keep the photo→wordmark→van z-order. `exact`
- **Content block (z-5):** left `64px`, top `414px`, width `560px`, vertical gap `20px`. `exact`
  - **H1:** "Pojazdy" / ("użytkowe" + accent "."), **Instrument Serif** `font-serif`,
    `56px`/`56px` line, `tracking-[-2px]`, `text-white`; the "." is `text-primary`.
    `deviation(mock font → Instrument Serif per decision)` · copy `exact`
  - **Subcopy (desktop):** "**Nowe samochody dla Twojej firmy. Dostępne od ręki!**" 15.5/24,
    `text-white/80`, `max-w-[440px]`. `exact`
  - **Bullets (desktop, 3):** accent `7px` dot + `text-white/95` 15.5 medium — `exact`:
    1. "Darmowe podstawienie i odbiór na terenie miasta"
    2. "Bezpłatne odwołanie rezerwacji"
    3. "Wynajem średnioterminowy już od 1 miesiąca"

**Mobile:** section `bg-[#0A0D14]`, width 100%. `exact`

- **Photo stage:** height `336px`, `object-cover object-[center_46%]`; top scrim 130 `rgba(8,11,18,.55)→0`;
  bottom fade 120 `rgba(10,13,20,0)→#0A0D14 94%`. `exact`
- **FLOTA wordmark:** Inter 700 `122px` `tracking-[-5px]` `opacity-[.85]` gradient(0/48%/96%), z-2,
  under the van cutout (z-3). `deviation(font)` else `exact`
- **Content (below the photo stage, still on dark):** padding `2px 22px 34px`, gap 18. `exact`
  - **Eyebrow (live count):** "**{vehicles.length} POJAZDÓW DOSTĘPNYCH DZIŚ**" 11px, `font-bold`,
    `tracking-[1.4px]`, `text-white/60`. **Mobile-only** (desktop hero has no eyebrow). `exact`
    (mock literal "47" → live `{vehicles.length}`) · `deviation(data: mock 47 → real count)` ·
    `deviation(fixed genitive form kept — the phrase needs full Polish agreement only at N=1..4
(POJAZD/POJAZDY + DOSTĘPNY/DOSTĘPNE); live count is ≥5 today so genitive ships; revisit if
fleet < 5. The noun-only pluralPl helper covers the trust card, NOT this phrase.)`
  - **H1:** "Pojazdy" / "użytkowe" + `9px` accent dot, **Instrument Serif**, `46px`,
    `tracking-[-1.8px]`, `text-white`. `deviation(font)` else `exact`
  - **Subcopy (mobile):** "**Wynajem długoterminowy i na dobę, w pełni online, z fakturą VAT.**"
    15/23 `text-white/72`. `exact` (intentionally ≠ desktop)
  - **Bullets (mobile, 3):** `22px` circle `bg-white/10` `border-white/14` + accent check svg +
    `text-white/92` 14 medium — `exact`:
    1. "Darmowe podstawienie i odbiór w mieście" (≠ desktop "na terenie miasta")
    2. "Bezpłatne odwołanie rezerwacji"
    3. "Wynajem średnioterminowy już od 1 miesiąca"
  - **CTA (mobile-only):** "**Zarezerwuj online**" → `/fleet`, full-width `h-14` (56px)
    `bg-primary text-primary-foreground` `rounded-[16px]` 16px bold + arrow,
    shadow `0 14px 30px -10px rgba(180,54,56,.55)`. `exact` · `deviation(mobile-only element)`

### S3 · Search island (restyle existing `HeroSearch.tsx`)

Three fields **TYP / DATY / ODDZIAŁ** + "Szukaj". Keep the existing island's logic
(Typ + date range → `/fleet`; Oddział static "Warszawa · Mokotów"; `validateDateRange`).
Field label 10px `font-bold` `tracking-[0.8px]` `text-[#9AA3B2]`; value `14.5px` (desktop) /
`15px` (mobile) `font-bold` `text-[#0E1524]`. `exact`

- **Desktop:** white pill **inside the dark hero** (bottom-left of content block), `rounded-[22px]`
  padding `7px`, shadow `0 18px 40px -12px rgba(0,0,0,.4)`; fields inline (flex-row), 2nd/3rd
  with `border-l border-[#E4E8EF]`; "Szukaj" `bg-foreground text-background` `rounded-[15px]`
  padding `15px 24px` 14.5 bold + search icon. `exact`
- **Mobile:** white card **in the light sheet** (margin `0 16px`, z-8), `rounded-[22px]`
  padding `12px`, shadow `0 18px 40px -14px rgba(0,0,0,.30)`; fields **stacked**, each
  `border-b border-[#EEF1F5]`; "Szukaj" full-width `h-[52px]` `bg-foreground` `rounded-[15px]`
  15.5 bold. `exact`
- Existing responsive (`flex-col` → `sm:flex-row`) is restyled to match; **cross-breakpoint
  placement (hero vs sheet) is handled at the page level**, island stays one component. `exact`

### S4 · Trust card

White card, three rows (`TrustRow`: 38px tile `rounded-md` `bg-[#F1F3F7]` accent icon +
title 17px bold `text-[#0E1524]` + sub 12.5 `text-[#5A6373]`). `exact`

- Row 1: "**4.9 / 5**" / "**1 280 opinii klientów**" (star) — **hardcoded placeholder**.
  `deviation(invented data — flagged placeholder)`
- Row 2: "**{vehicles.length} pojazdy**" / "**we flocie, gotowe od ręki**" (truck) — **live count**
  (`{vehicles.length}`, currently 7). `exact` label · `deviation(data: mock 83 → live count)`
  — Polish plural: use a helper so `1 pojazd / 2–4 pojazdy / 5+ pojazdów` reads correctly.
- Row 3: "**Rezerwacja**" / "**online lub telefonicznie**" (laptop + phone tiles). `exact`
- **Desktop:** floating, `rounded-[22px]` padding `10px 16px`, shadow `0 18px 40px -12px rgba(0,0,0,.35)`,
  bottom-aligned with the search pill (right side of hero). `exact`
- **Mobile:** in the light sheet under the search card, `margin 16`, `border-[#E7EAF0]`
  `rounded-[20px]` padding `6px 14px`, rows split by `border-[#EEF1F5]` hairlines. `exact`

### S5 · Body sheet transition

Light sheet rises over the hero: `margin-top -40px` desktop / `-16px` mobile, `bg-background`,
`rounded-t-[40px]` / `rounded-t-[28px]`, shadow `0 -20px 48px rgba(0,0,0,.14)` (desktop). `exact`

### S6 · "Proces wynajmu" stepper

Eyebrow "**JAK TO DZIAŁA**" 11–11.5px `font-bold` `tracking-[1.2px]` `text-muted-foreground`;
heading "**Proces wynajmu pojazdu**" + accent "." **Instrument Serif**, ~38px desktop / ~27px
mobile, tracking optically tuned; subtitle "**Online albo telefonicznie — wybór należy
do Ciebie.**" 15/14 `text-[#5B6474]`. `deviation(heading font + size/tracking optically re-tuned
for Instrument Serif — Playfair source is 36/42/36px @ −0.5; finalized at the vision-diff)` else `exact`

- **Desktop:** white card `rounded-[28px]` `border-border`, padding `64px` outer. **Branching**
  layout: hint "**Ty wybierasz, jak zaczynasz:**" (12.5 `text-muted-foreground`), two lane pills
  — "**Online — bez telefonu**" (laptop) and "**Telefonicznie**" (phone), white `rounded-full`
  `border-[#E7EAF0]` — that **converge** into circle 1 via two 2px `#99A2B2` connector paths;
  then a single horizontal track (three 2px `#E7EAF0` connectors) across circles 1–4. Circles
  `60px` `bg-primary` white number 26px bold. `exact`
  - Step titles/desc (desktop) `exact`:
    1. **Rezerwacja** — "Rezerwujesz online lub telefonicznie, a potwierdzenie terminu wysyłamy e-mailem."
    2. **Podpisanie dokumentów i płatność** — "Sprawdzamy dokumenty, pobieramy płatność z kaucją, a umowę podpisujesz na tablecie."
    3. **Oględziny i wydanie pojazdu** — "Wspólnie oglądamy pojazd i odbierasz auto z protokołem wydania na e-mailu."
    4. **Zwrot pojazdu i kaucja** — "Po oględzinach podpisujesz protokół zwrotu, a kaucja wraca do Ciebie."
- **Mobile:** white card `rounded-[24px]` padding `26px 22px`. **Vertical timeline** — circles
  `44px` accent, connected by 2px `#E7EAF0` verticals; title 16px bold + desc 13.5/21. **Shorter
  titles** `exact`: 1. **Rezerwacja** — (same desc as desktop) 2. **Dokumenty i płatność** 3. **Oględziny i wydanie** 4. **Zwrot i kaucja** (last, no trailing connector)
  - No branching lanes on mobile (the two-lane converge is desktop-only; mobile folds the
    choice into step 1's copy). `deviation(no-mock branch on mobile — per source)`

### S7 · "Wybierz typ pojazdu." category selector (click-to-route)

Heading "**Wybierz typ pojazdu**" + accent "." **Instrument Serif** ~44px desktop / ~28px mobile.
`deviation(font + size/tracking optically re-tuned for Instrument Serif; finalized at vision-diff)` else `exact`

- **Pills (5), each links to `/fleet?category=<cat>`:** Furgon (active, `bg-primary` white) ·
  Bus osobowy · Autolaweta · Chłodnia · Skrzyniowy. Inactive `text-[#5B6474]` 500. `exact`
  - **Icons:** custom inline SVGs from the source (`LX.bus`, `LX.flatbed` = the autolaweta
    car-on-flatbed, `LX.snow`, `LX.box`) + `Icon.truck` for Furgon. Transcribe the 4 custom SVG
    paths into a **landing-local icon set** (e.g. `src/components/landing/`). Do **NOT** edit the
    shared `SpecIcon`/`VehicleSilhouette` — they back `/fleet` + 6 surfaces, and `VehicleSilhouette`
    emits large full-vehicle silhouettes keyed by category, not small pill glyphs. `exact`
  - **Desktop:** pills wrapped in a white `rounded-full` `border-[#E7EAF0]` container padding
    `7px 8px`; each pill `rounded-full` padding `12px 20px 12px 18px` 14.5px; active pill shadow
    `0 4px 12px -2px rgba(180,54,56,.30)`. Followed by "**Cała flota**" `bg-foreground`
    `rounded-full` link → `/fleet` (top-right of the heading row). `exact`
  - **Mobile:** pills `flex-wrap gap-2`, `rounded-full` `border-[#E7EAF0]` padding `11px 16px 11px 13px` 14px. `exact`
- **Hover-preview hint** ("Najedź, aby podejrzeć modele poniżej · kliknij, aby otworzyć ekran
  kategorii") — **dropped** (no hover-filter this slice). `deviation(scope: click-to-route only)`

### S8 · "Popularne" strip (fork — new `LandingVehicleCard.astro`; do NOT edit `VehicleCard.astro`)

Header: "**Popularne**" **Instrument Serif** ~38px desktop / ~26px mobile + "**Furgony**" chip
(`bg-accent`/`#F3E3E3`, truck icon, accent text) + "**Wszystkie**" → `/fleet`
(accent pill desktop / accent link mobile). `deviation(heading font + optical size)` else `exact`

- **"Furgony" chip:** the mock chip is a static "Furgony" label, but the Data below is the top-3
  of **any** category — so the chip can misdescribe the shown cards. Derive the chip label from the
  actual result set, OR filter the Popular query to `cargo_van`. `deviation(static label decoupled from data — flagged)`
- **Data:** SSR top-3 active vehicles via existing `listVehicles(...).slice(0,3)`. `exact`
- **Card (`LandingVehicleCard`):** white `border-[#E7EAF0]`, `rounded-[18px]` desktop /
  `rounded-xl` (20) mobile, padding `18` (desktop) / `16` (mobile). Mark the card `@container`
  and drive any internal split with `@min-[Npx]:`, not viewport `md:`/`lg:` — it renders inside a
  multi-up grid (see the "embeddable panels" lesson). `exact`
  - **Image:** gradient placeholder block, height 150, `rounded-[12px]`/`[14px]`; "**Dostępny**"
    pill top-left (`6px` `bg-success` dot + success label; mobile uppercase "DOSTĘPNY"). Swap
    for `VehicleSilhouette`/real photo where available. `deviation(placeholder gradient → silhouette/photo)`
  - **Title/sub:** brand 18px (desktop) / 19px (mobile) bold `text-foreground`; sub (`model · year`)
    `13px` `text-[var(--flota-ink-2)]` (source `#5B6474` = ink-2, **not** muted-foreground). `exact`
  - **Spec row:** 4 specs (seats / transmission / fuel / payload) with `SpecIcon`, dividers.
    Reuse `formatPayloadKg`, `transmissionLabelPl`, `fuelLabelPl`. `exact`
  - **Price + CTA:** "**od {daily} zł**" + "/dzień" (mobile drops "od"); "**Rezerwuj**"
    `bg-foreground text-background` `rounded-[11px]`/`[12px]` + arrow. Whole card links to the
    vehicle detail route (as existing `VehicleCard`). `exact` · `deviation(mobile drops "od" prefix — per source)`
  - **No monthly/deposit line** (unlike shared `VehicleCard`) — that's why it's forked. `exact`

### S9 · Footer (reuse existing `SiteFooter.astro` — already matches)

F-logo + "Flota" + tagline + Start / Flota / Strefa pracownika + "© 2026 Flota. Wszystkie
prawa zastrzeżone." `exact`

- Tagline: desktop "Wynajem pojazdów użytkowych · Warszawa" — matches current `SiteFooter`. `exact`
- Mobile mock shows "Wynajem pojazdów · Warszawa" (drops "użytkowych"). `deviation(keep the
fuller `SiteFooter` tagline at all breakpoints — reuse, don't fork the footer for one word)`

---

## Deviations register (summary)

1. Fonts: Space Grotesk → Inter 700 (wordmark/H1/numbers); Playfair → Instrument Serif (headings); H1 kept serif. `reuse existing fonts`
2. Nav: drop Cennik / Dla firm / Pomoc + PL·EN; CTA "Browse the fleet" → "Przeglądaj flotę". `no routes / no i18n`
3. Trust card ratings "4.9 / 5 · 1 280 opinii" hardcoded placeholder; "83 pojazdy" → live `{vehicles.length}` (currently 7). `invented data / wire live`
4. Hero eyebrow "47" → live `{vehicles.length}`. `wire live`
5. Category selector: click-to-route only; hover-preview hint dropped. `scope`
6. Popular card: forked `LandingVehicleCard`, gradient image = placeholder for silhouette/photo; mobile drops "od". `no regressions on /fleet`
7. Colors snap to nearest existing token (no `global.css` edit); dark hero palette is landing-local arbitrary hex. `frame disposition`
8. States with no mock (empty fleet, search error, nav-open, tablet range) derived from existing behavior + responsive judgment. `no-mock`
9. "Furgony" Popular chip is a static/derived label decoupled from the top-3 (any-category) data. `static label ≠ data`
10. Hero eyebrow keeps the fixed genitive Polish form (full N=1..4 agreement out of scope; count ≥5 today). `Polish agreement`
11. Section-heading sizes/tracking are optically re-tuned for Instrument Serif (Playfair source differs metrically); finalized at the vision-diff. `serif optical`
12. Mobile menu = landing-local dropdown inside `LandingNav`; category icons = landing-local set. Shared `MobileNav`/`SpecIcon`/`VehicleSilhouette` untouched. `no shared edit`
