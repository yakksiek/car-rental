---
change: public-info-pages
role: design-contract
created: 2026-08-01
source: Claude Design project `Rental car company` (352d78a6-84fd-49a2-8b38-2fe289691fc3), file `info-pages.jsx` + `customer-desktop.jsx` (phone-reveal), pulled 2026-08-01
canonical_screens: context/changes/public-info-pages/design-review/
canonical_source: fetched live at implement — Claude Design project 352d78a6-84fd-49a2-8b38-2fe289691fc3 → info-pages.jsx, customer-desktop.jsx, shared.jsx (NOT stored in repo; see plan.md §Design source)
---

# Design Contract — Public info pages (O nas / FAQ / Cennik) + shell redesign

**Fidelity rule (from `context/foundation/lessons.md`): port the exact values below; never tune by eye, never widen a value into a range.** The code-backed source is **fetched live at implement** (`DesignSync get_file`, see `plan.md` §Design source) and carries the exhaustive per-element values (every px/weight/color) + verbatim copy; this contract carries the token map, the deviations register, and the load-bearing values transcribed at plan time. When a value here and the live source disagree, the live source wins (it is the verbatim export) — but the live file is mutable, so if it has drifted from this contract, reconcile with the user rather than silently following the change.

---

## Design Alignment Audit

### Freshness audit — repo designs vs canonical

| Asset (repo)                                                     | State                                       | Note                                                                             |
| ---------------------------------------------------------------- | ------------------------------------------- | -------------------------------------------------------------------------------- |
| `design-system.md` catalog rows 01–26                            | **current** but **missing these 3 screens** | Cennik / FAQ / O nas are net-new; not in the catalog. Add rows 27–29 at Phase 5. |
| `src/components/SiteHeader.astro` (Start/Flota pill nav)         | **superseded**                              | Redesigned to `InfoHeader` (5-link pill + phone + Zarezerwuj CTA).               |
| `src/components/SiteFooter.astro` (single-column)                | **superseded**                              | Redesigned to `InfoFooter` (3-column contact footer).                            |
| `src/components/MobileNav.tsx` (2-item, Home/Truck icon ternary) | **superseded**                              | Redesigned to `InfoHeaderMobile` (phone-reveal + hamburger → 5-item overlay).    |
| `LandingNav.astro` (landing-only fork)                           | **current**                                 | Landing keeps its own immersive nav; out of scope.                               |
| `src/assets/hero-airfield.jpg`                                   | **current**                                 | Reused by About narrative (already shipped by landing-redesign).                 |

### New-design gaps (quality audit of the canonical mockups)

| Gap                                                                                            | Resolution                                                                                                                                                                                                                                                                             |
| ---------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Mobile nav **overlay** (hamburger open) state not shown                                        | Extend existing `MobileNav` overlay to list all 5 links. `deviation(overlay-undesigned)` — text list, sensible lucide icon per item.                                                                                                                                                   |
| No **loading / error / empty** state for the live Cennik rate table or About fleet count       | Spec'd here: null/misconfigured Supabase → static chrome renders, table shows the empty fallback row; count falls back to a static "—". `deviation(states-undesigned)`.                                                                                                                |
| Cennik rate-table rows = curated marketing "types", **not our 5 categories**                   | Build renders our 5 categories live (`od` MIN/category). A **Claude Design mock-update brief** (`design-review/cennik-mock-update-brief.md`) is produced so the mock is re-exported to match — until then the vision-diff treats the table rows as `deviation(live-data-by-decision)`. |
| Business-fact copy (kaucja 1 500, 300 km, 0,50 zł, wiek 21, contact details) is the designer's | Ported verbatim as canonical; user fact-checks before launch (non-blocking for build).                                                                                                                                                                                                 |
| Phone-reveal interaction absent from the info mockups' mobile header (static there)            | Ported from the landing source (`customer-desktop.jsx` → `ScreenMobileHome` `phoneOpen` button), colors adapted to the white header. `deviation(ported-from-landing)`.                                                                                                                 |

### Alignment checklist (surface ↔ phase)

| Canonical surface                 | Screen file                                | App surface                          | Phase |
| --------------------------------- | ------------------------------------------ | ------------------------------------ | ----- |
| `InfoHeader` / `InfoHeaderMobile` | header of all 3                            | `SiteHeader.astro` + `MobileNav.tsx` | P1    |
| `InfoFooter`                      | footer of all 3                            | `SiteFooter.astro`                   | P1    |
| `ScreenAboutDesktop/Mobile`       | `o nas desktop.jpg` / `o nas mobile.jpg`   | `src/pages/about.astro`              | P2    |
| `ScreenFaqDesktop/Mobile`         | `faq desktop.jpg` / `faq mobile.jpg`       | `src/pages/faq.astro`                | P3    |
| `ScreenPricingDesktop/Mobile`     | `prices desktop.jpg` / `prices mobile.jpg` | `src/pages/pricing.astro`            | P4    |

Every canonical surface maps to a phase; no phase builds a surface without a design. **Verdict: PASS** (see foot of file).

---

## Token map (design inline value → app token)

All from `src/styles/global.css`. Colors are **never** hardcoded in the build except the two new/near-black values flagged below.

| Design value (source)                                                                    | App token / utility                                                       | Line-of-truth                                                  |
| ---------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- | -------------------------------------------------------------- |
| `tokens.bg` `#F1F3F6`                                                                    | `--flota-bg` → `bg-background`                                            | global.css:24                                                  |
| `#F1F3F7` (InfoHeader nav pill track)                                                    | `bg-background`                                                           | `exact` (≈bg; 1-unit) `deviation(nav-track≈bg)`                |
| `tokens.card` `#FFFFFF`                                                                  | `--flota-card` → `bg-card`                                                | global.css:25                                                  |
| `tokens.ink` `#0F172A`                                                                   | `--flota-ink` → `text-foreground`                                         | global.css:26                                                  |
| `tokens.ink2` `#334155`                                                                  | `--flota-ink-2` → `text-[var(--flota-ink-2)]`                             | global.css:27                                                  |
| `tokens.muted` `#94A3B8`                                                                 | `--flota-muted` → `text-muted-foreground`                                 | global.css:28                                                  |
| `tokens.hair` `rgba(15,23,42,0.08)`                                                      | `--flota-hair` → `border-[var(--flota-hair)]`                             | global.css:30                                                  |
| `tokens.hair2` `rgba(15,23,42,0.05)`                                                     | `--flota-hair-2`                                                          | global.css:31                                                  |
| `tokens.accent` `#B43638`                                                                | `--flota-accent` / `--primary` → `text-primary`/`bg-primary`              | global.css:34,86                                               |
| `tokens.accentSoft` `#FBE4E1`                                                            | `--flota-accent-soft` / `--accent` → `bg-accent`                          | global.css:36,92                                               |
| `tokens.accentDark` `#8E2628`                                                            | `--flota-accent-dark`                                                     | global.css:35                                                  |
| `tokens.green` `#1B9E5A`                                                                 | `--flota-success` → `text-[var(--flota-success)]`                         | global.css:40                                                  |
| `tokens.greenSoft` `#E3F5EC`                                                             | `--flota-success-soft`                                                    | global.css:41                                                  |
| `tokens.shadow1`                                                                         | `--flota-shadow-1` → `shadow-card`                                        | global.css:73,208                                              |
| `tokens.font` Inter                                                                      | `--font-sans` → `font-sans`                                               | global.css:52,203                                              |
| **`INKD` `#141B2D`** (dark cards/CTA/featured/info-box/contact)                          | **NEW `--flota-ink-deep: #141B2D`** (add in P1)                           | — `exact`                                                      |
| `#0E1524` / `#141922` (dark wordmark text variants)                                      | `--flota-ink` (`text-foreground`)                                         | `deviation(near-black-normalized; ≤3 units)`                   |
| `#0A0D14` (About photo backing, behind full-cover img)                                   | literal `bg-[#0A0D14]`                                                    | `deviation(photo-backing-literal; barely visible)`             |
| radius 20 (cards) / 16 (FAQ items, stat cards) / 12 (buttons, chips) / 24 (contact card) | `rounded-[20px]` / `rounded-[16px]` / `rounded-[12px]` / `rounded-[24px]` | `exact` (design uses explicit px, not the radius scale)        |
| container `WRAP = 1180`                                                                  | `max-w-[1180px] mx-auto`                                                  | `exact` — **NOTE deviation from the app's `max-w-app` 1400px** |

**Container deviation (load-bearing):** the info pages use a **1180px** content cap, not the app-wide `max-w-app` (1400px). `deviation(info-pages-use-1180-per-design)`. The **shell** (`InfoHeader`/`InfoFooter`) uses `48px` desktop / `18–22px` mobile outer horizontal padding, and **both** inner rows (header _and_ footer) cap at `max-w-[1180px] mx-auto` — the `48px` padding is the gutter floor below ~1276px. This holds the header logo, page body, and footer columns on one shared content edge at every viewport: the design canvas is ~1276px, where `48px` padding and the `1180` cap coincide, so capping the header's inner row (not just the footer's) preserves that alignment above that width. `deviation(shell-inner-caps-1180)`. Existing pages keep their own `<main>` max — unchanged.

Fonts: **all headings on these pages are Inter (`font-sans`) bold, NOT Instrument Serif.** `deviation(info-pages-all-sans)` — the source uses `tokens.font` for H1/H2 (the fleet page's serif H1 idiom does not apply here).

---

## Icons

Port the **exact inline SVG paths** from the live `info-pages.jsx` (the `II.*` set) and `shared.jsx` (`Icon.*`) — do **not** substitute lucide-react (subtly different geometry = fidelity loss). `Icon.plus` `M12 5v14M5 12h14`, `Icon.arrowRight` `M5 12h14M13 6l6 6-6 6`, `Icon.chevD` `m6 9 6 6 6-6`. All are 24-grid, `strokeWidth 1.7` (nav/UI chevrons use 2). Author them as a small shared inline-SVG icon set (Astro component or a `.astro` partial); reuse across pages. The brand mark stays the existing `src/components/brand/Brand.astro`.

---

## Shell — `SiteHeader` / `SiteFooter` / `MobileNav` (Phase 1)

**Nav model** (id → route → label). `active` union widens to `"home" | "fleet" | "pricing" | "faq" | "about"`.

| id (design "rates"→our "pricing") | route      | label                                                         |
| --------------------------------- | ---------- | ------------------------------------------------------------- |
| home                              | `/`        | `Start` `exact`                                               |
| fleet                             | `/fleet`   | `Flota` — `deviation(pl-label; design shows English "Fleet")` |
| pricing                           | `/pricing` | `Cennik` `exact`                                              |
| faq                               | `/faq`     | `FAQ` `exact`                                                 |
| about                             | `/about`   | `O nas` `exact`                                               |

**Desktop header** (`exact`): outer element `border-bottom 1px --flota-hair-2; bg-card; padding-block 18px; padding-inline 48px (gutter floor)`; **inner row** `max-w-[1180px] mx-auto flex justify-between` (mirrors the footer's inner `1180` cap so the header aligns with body + footer above ~1276px). Left: `Brand` (mark size 40) + "Flota" wordmark (`text-[20px] font-bold tracking-[-0.4px]`). Center: pill track `bg-background rounded-full p-[5px_6px]`, each item `px-[18px] py-[9px] rounded-full text-[14.5px]`; active = `bg-card font-[650] shadow-[0_2px_6px_rgba(14,21,36,0.15)]`, inactive = `text-[#5A6373] font-medium`. Right: phone `II.phone(16, accent)` + `+48 22 100 20 30` (`text-[14.5px] font-bold`), then `Zarezerwuj` pill `bg-[--flota-ink-deep] text-white rounded-full px-[22px] py-[13px] text-[14.5px] font-semibold` → links `/fleet`.

**Mobile header** (`exact` chrome): `flex justify-between; padding 14px 18px; border-bottom; bg-card`. Left: Brand(34) + "Flota" `text-[18px]`. Right: **phone-reveal control** (port the `phoneOpen` button from live `customer-desktop.jsx` `ScreenMobileHome`; closed = `w-40px h-40px rounded-[12px] bg-accent` soft chip w/ crimson icon; open animates `width→auto`, number `max-width 0→160`, `padding .38s cubic-bezier(.4,0,.2,1)`, `opacity .28s`) then hamburger `w-40 h-40 rounded-[12px] bg-background` (`M4 7h16M4 12h16M4 17h16`). Revealed number is a real `tel:+48221002030` link. **CSS-only** (checkbox+label), no island.

**Mobile overlay** (`deviation(overlay-undesigned)`): reuse the existing `MobileNav` full-screen overlay; list all 5 links (text + a sensible lucide icon each: home, truck, receipt/tag, help-circle, info). Keep `aria-label="Menu"` / `"Zamknij menu"`, Escape-close, scroll-lock.

**Footer** (`exact`): `bg-card border-top 1px #E7EAF0; padding 46px 48px 34px` (mobile `30px 22px 26px`); inner `max-w-[1180px] mx-auto flex` (mobile `flex-col`). Brand block (mark 38 + "Flota" + tagline `Wynajem samochodów dostawczych w Warszawie — na dobę, krótko- i długoterminowo.` `text-[13px] text-[#5B6474]`). Columns:

- **WYNAJEM** (`text-[11px] font-bold uppercase tracking-[0.5px] text-[#99A2B2]`): `Na dobę` · `Krótkoterminowy` · `Średnioterminowy` · `Długoterminowy` — all → `/pricing` `deviation(rental-term-links→/pricing)`.
- **INFORMACJE**: `O nas`→`/about` · `Cennik`→`/pricing` · `FAQ`→`/faq` · `Kontakt`→`/about#kontakt` `deviation(no-contact-page; →about contact card)`.
- **KONTAKT**: `+48 22 100 20 30` (`tel:`) · `kontakt@flota.pl` (`mailto:`) · `Al. Jerozolimskie 200, Warszawa` · `Czynne 24/7` (`text-primary font-bold`).
- Bottom bar (`border-top 1px #EEF1F5; text-[12px] text-[#99A2B2]`): `© 2026 Flota. Wszelkie prawa zastrzeżone.`

Note the footer **drops** the current `Strefa pracownika` (`/auth/signin`) link. `deviation(staff-link-removed-from-public-footer)` — staff reach `/auth/signin` directly; confirm acceptable at fact-check.

---

## O nas — `/about` (Phase 2)

Hero: eyebrow `O nas`, H1 `Flota, na której możesz polegać` (`text-[54px]/[34px] font-bold tracking-[-1.8px]/[-1px] leading-[1.02] text-wrap-balance`), lead (verbatim in source, `max-w-[680px]`).

**Stats band** (4; desktop `repeat(4,1fr)`, mobile `1fr 1fr`): `[shield '10+' 'lat na rynku'] [van {LIVE count} 'pojazdy we flocie'] [headset '24/7' 'wsparcie i assistance'] [spark 'do 2 lat' 'maks. wiek auta']`. **`pojazdy we flocie` number is LIVE** = `getCategoryCounts(supabase).total` (active vehicles). Fallback if null/misconfigured: `—`. Other three static. `deviation(fleet-count-live)`. Card: `bg-card rounded-[16px] border 1px --flota-hair-2; icon accent; number text-[46px]/[32px] font-[780] tracking-[-2px]; label text-[13.5px] text-muted font-semibold`.

**Narrative** (desktop 2-col 1fr/1fr, mobile stack text→photo): eyebrow `Nasza historia`, H2 `Rzetelność i elastyczność od pierwszego dnia`, 2 paragraphs (verbatim). Photo = `import` `src/assets/hero-airfield.jpg` via `astro:assets` (`Picture`/`Image`, `objectFit cover`, `rounded-[22px]`, height 340/220, backing `bg-[#0A0D14]`), `alt=""` (decorative). Match `index.astro:3,19` import pattern.

**Nasza flota** (6 items; desktop 2-col, mobile 1-col; hairline dividers): copy verbatim from `FLEET_ITEMS`. **Static copy** — these are marketing category descriptions, not catalog rows.

**Dlaczego Flota** (6 value cells; desktop `repeat(3,1fr)`, mobile 1-col): copy verbatim from `VALUES`.

**Contact card** (`bg-[--flota-ink-deep] rounded-[24px]`, desktop 2-col): eyebrow `Kontakt` → give this section `id="kontakt"` (footer `/about#kontakt` target). H `Porozmawiajmy o Twoim transporcie`, body verbatim, `Zarezerwuj pojazd →` → `/fleet`. Contact rows: `Telefon +48 22 100 20 30` (`tel:`), `E-mail kontakt@flota.pl` (`mailto:`), `Adres Al. Jerozolimskie 200, Warszawa`, `Godziny Czynne 24 / 7` (note the **spaced** slash here vs unspaced in footer — reproduce each verbatim).

---

## FAQ — `/faq` (Phase 3)

Hero: eyebrow `FAQ`, H1 `Najczęściej zadawane pytania`, lead verbatim.

**Accordion** — native `<details name="faq">` (shared `name` = single-open exclusive), **CSS-only**, no island. Ten items, verbatim Q + A from `FAQS` (all 10 answers are in the source — port verbatim). Row structure (`exact`):

- Wrapper `<details>` `position relative; border-top 1px --flota-hair` (except first); `overflow hidden`.
- **Ghost number** absolute span: `left -2px; top 6px(desktop)/4px(mobile); font-size 120px/96px; font-weight 800; letter-spacing -4px; line-height 1; pointer-events none; transition color .3s`. Color **closed** `rgba(15,23,42,0.14)` desktop / `rgba(15,23,42,0.04)` mobile; **open** `rgba(180,54,56,0.85)` desktop / `rgba(180,54,56,0.5)` mobile. Number = `String(i+1).padStart(2,'0')`.
- Content offset `margin-left 188px(desktop)/90px(mobile)`. `<summary>` row: question `text-[24px]/[16.5px] font-bold tracking-[-0.4px]` + toggle circle `w-38/30 h-38/30 rounded-full border 1px`; **closed** `border --flota-hair, transparent bg, plus icon ink`; **open** `border+bg --flota-accent, plus icon white, rotate 45deg` (→ ×). Transition `transform .3s cubic-bezier(.4,0,.2,1)`.
- Answer: `text-[15.5px]/[14px] text-[--flota-ink-2] leading-[1.6] max-w-[640px]`, padded `16px 40px 6px 0` (desktop).
- **Open/close animation** `deviation(css-details-no-maxheight-anim)`: the source animates `max-height` via JS; native `<details>` opens instantly. Optionally enhance with the modern `::details-content` + `interpolate-size: allow-keywords` CSS transition (progressive; degrades to instant on older browsers). Ghost-number color + toggle rotation still animate via `[open]` selectors. First item MAY render open (`<details open>` on #1) to match the mockup's resting state — but with `name=` single-open, that's optional; default all-closed is acceptable `deviation(default-all-closed)`.

**CTA banner** (`bg-[--flota-ink-deep] rounded-[20px]`): `Masz inne pytanie?` + `Nasz zespół pomoże Ci wybrać właściwy pojazd — 24/7.`; buttons `Zadzwoń` (white, phone icon, `tel:`) + `Napisz` (crimson, mail icon, `mailto:`).

---

## Cennik — `/pricing` (Phase 4) — HYBRID

Hero: eyebrow `Cennik`, H1 `Przejrzyste stawki, bez ukrytych kosztów`, lead verbatim.

**Tier cards** (4) — **STATIC marketing copy**, ported verbatim from `RENT_TIERS` (`od 219/199/169/149 zł/doba`, bands, notes, `Popularny` / `Najlepsza cena` tags, 4th card featured `bg-[--flota-ink-deep]`). `deviation(tier-cards-static-marketing)` — recorded: these encode a rental-length discount ladder we do not store.

**Stawki wg typu pojazdu** — **LIVE table**. Sub `Ceny netto, od. Ostateczna wycena zależy od terminu i długości najmu.` Rows = **our 5 categories** (`categoryLabelPl`: Furgon / Bus osobowy / Autolaweta / Chłodnia / Skrzyniowy), each `od {formatPln(MIN daily_rate)}` (DOBA) + `od {formatPln(MIN monthly_rate)}` (MIESIĄC) across that category's **active** vehicles, via new `getCategoryPricing(supabase)`. Hide categories with 0 active vehicles. Empty/misconfigured → single muted fallback row `Cennik chwilowo niedostępny — zadzwoń: +48 22 100 20 30` (`deviation(empty-state-added)`). Row styling `exact` from source (icon chip `bg-background rounded-[10px]`, grid `2.4fr 1fr 1fr` desktop / `1fr auto` stacked mobile, header band `bg-[#E7EAF1]`). Per-category icon: map category→`II` icon (cargo_van→van, passenger_van→bus, car_transporter→lift, refrigerated_truck→container, flatbed_truck→crew) `deviation(category-icon-map)`. **Money values pass through `formatPln` — never `.toFixed()`** (numeric columns deserialize as strings). Add `od ` prefix + ` zł` suffix per source. `deviation(rows-are-live-categories)` until the mock is re-exported (see mock-update brief).

**W każdej cenie** (6 green-check benefits) + **Dobrze wiedzieć** dark box (`Kaucja od 1 500 zł…`, `VAT …netto (+23% VAT)`, `Faktura…`, `Płatność…`) + `Zarezerwuj pojazd →` (`/fleet`) — **STATIC marketing copy**, verbatim. `deviation(globals-static)` — kaucja/km/VAT are single marketing values, not per-vehicle data.

---

## Deviations register (consolidated)

1. `info-pages-use-1180` — 1180px content cap (not `max-w-app` 1400). Reason: design.
2. `info-pages-all-sans` — Inter headings, not Instrument-Serif. Reason: design.
3. `pl-label-fleet` — nav label `Flota` not `Fleet`. Reason: app is Polish-canonical.
4. `new-token-ink-deep` — add `--flota-ink-deep: #141B2D`. Reason: new dark surface color.
5. `near-black-normalized` — `#0E1524`/`#141922` → `--flota-ink`. Reason: ≤3-unit variance.
6. `tier-cards-static-marketing` — Cennik length tiers hardcoded. Reason: no length-discount data (user decision: hybrid).
7. `rows-are-live-categories` — rate table = our 5 categories live, not the mock's curated types. Reason: user decision + mock-update brief.
8. `globals-static` — kaucja/km/VAT static marketing values. Reason: per-vehicle in schema.
9. `fleet-count-live` — About "pojazdy we flocie" = live count. Reason: user decision (anti-drift).
10. `css-details-no-maxheight-anim` — native FAQ open/close (optional `::details-content` enhancement). Reason: native = no island (user decision).
11. `overlay-undesigned` / `states-undesigned` / `staff-link-removed` / `rental-term-links→/pricing` / `Kontakt→/about#kontakt` / `category-icon-map` / `empty-state-added` — undesigned states + link wiring, spec'd above.
12. ~~`shell-inner-caps-1180` — header inner row caps at `max-w-[1180px] mx-auto` (like the footer), not full-bleed.~~ **Superseded (S-09 P8, 2026-08-02):** the shell chrome (SiteHeader + SiteFooter inner rows) now caps at **1800px** (`--container-shell` → `max-w-shell`), per user decision — the nav pill and footer columns use the wider band on large screens while the info-page bodies stay at 1180. `info-pages-use-1180` (deviation #1, page bodies) still holds, so the chrome intentionally sits wider than the 1180 page content on every page. The 48px desktop / 18–22px mobile gutter floor is unchanged.

---

## Verdict

**Design Alignment Audit: PASS** — 6 canonical surfaces captured (3 pages × 2 breakpoints) + code-backed source pulled; 3 repo shell components superseded (SiteHeader/SiteFooter/MobileNav → InfoHeader/InfoFooter/mobile); 3 catalog rows to add (P5); 17 deviations recorded. Rendered vision-diff runs per page in `/10x-implement` + a full pass in P5 (compare against the JPGs in `design-review/`, treating recorded deviations as expected).
