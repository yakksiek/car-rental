# Design Contract — S-13 staff-global-search

Source of truth: **`search-flow.jsx`** (`SearchField`, `SearchPanel` [empty/results/noresults], result rows,
`ScreenSearchResultsPage`, and the mobile `MobileSearchShell` / `ScreenSearchMobile*`), live in Claude Design
`352d78a6-84fd-49a2-8b38-2fe289691fc3`, pulled via DesignSync. Values transcribed **exactly**; each line
`exact` or `deviation(reason)`. We ship **3 groups** (Rezerwacje / Zwroty / Pojazdy — **no Klienci**) and
**quick-jumps only** (no recent searches).

---

## Design Alignment Audit

### Freshness audit (repo vs canonical)

| Artifact                                | Status           | Note                                                                                                                                    |
| --------------------------------------- | ---------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `search-flow.jsx` (design source)       | **current**      | Pulled this session; the exact-values source below.                                                                                     |
| `search-flow` screenshots in repo       | **missing**      | New mockup — not in the `design-system.md` catalog. → outstanding input for the rendered vision-diff.                                   |
| `StaffShell` shell designs (rows 09/20) | **restructured** | Phase 2 adds a persistent header search bar — the shipped shell screenshots will be superseded once implemented (re-export at archive). |

### New-design quality audit (gaps in the provided mockup)

- The **Pojazdy** group label appears in copy but the demo renders **no vehicle row** (empty `SEARCH_DATA.vehicles`) → the vehicle-result row is ours (D3/D9).
- The **Klienci** group (CustomerRow / BigCustomerCard) is drawn but **omitted** by owner decision (D1).
- The resting state's **"Ostatnie wyszukiwania"** (recent) is drawn but **omitted** (D2).
- Mobile + desktop provided for all states (resting / results / no-results / results-page). Copy canonical Polish (`useSX`).

### Alignment checklist (plan vs canonical)

| Canonical surface                         | Plan phase                              | Aligned?               |
| ----------------------------------------- | --------------------------------------- | ---------------------- |
| Desktop header field                      | Phase 2                                 | ✓                      |
| Dropdown — resting / results / no-results | Phase 2 (container) + Phase 3 (content) | ✓ (D1, D2, D3, D4, D9) |
| Mobile full-screen search                 | Phase 2 (entry) + Phase 3 (results)     | ✓                      |
| Full results page + chips                 | Phase 4                                 | ✓                      |
| Shell restructure                         | Phase 2                                 | ✓                      |
| UI phases carry a vision-diff criterion   | Phase 3 (3.8), Phase 4 (4.7)            | ✓                      |

### Verdict

**PASS (paper audit)** — surfaces aligned; StaffShell shell screenshots will be superseded by the restructure
(re-export at archive); **9 deviations recorded (D1–D9)**. Outstanding input for `/10x-implement`: drop the
canonical **search-flow mockup PNGs** (desktop resting/results/no-results/results-page + the mobile set) into
`context/changes/staff-global-search/design-review/`. The exact-values contract below is transcribed from the
code-backed source, so planning is not blocked.

---

## Token map (design `tokens.*` → app token)

Same base map as the cohort (`bg→--background`, `card→--card`, `ink→--foreground`, `ink2→--flota-ink-2`,
`muted→--muted-foreground`, `hair→--flota-hair`, `hair2→--flota-hair-2`, `accent→--primary`,
`shadow1→shadow-card`, `mono→font-mono`, `font→font-sans`). Search-specific:

| Design token                 | Hex / value            | App token                                                                            |
| ---------------------------- | ---------------------- | ------------------------------------------------------------------------------------ |
| `tokens.amber` / `amberSoft` | `#B6790E` / `#FBF1DA`  | `--warning` / `--flota-warning-soft` (pending / due pills, quick-jump)               |
| `tokens.green` / `greenSoft` | `#1B9E5A` / `#E3F5EC`  | `--success` / `--flota-success-soft` (returned pill)                                 |
| `tokens.red` / `redSoft`     | `#B43638` / `#FBE4E1`  | `--destructive` / `--flota-danger-soft` (overdue quick-jump)                         |
| `tokens.greySoft` / `grey`   | `#EEF1F5` / `#64748B`  | `--flota-neutral-soft` / `--flota-neutral` (done pill, count badge)                  |
| `tokens.blue` / `blueSoft`   | (active tone)          | no token — reuse `--flota-neutral`/`bg-secondary` for "active" (D4 mostly avoids it) |
| highlight `<mark>`           | `rgba(180,54,56,0.14)` | arbitrary: `bg-[rgba(180,54,56,0.14)] rounded-[3px]`                                 |

## Screen inventory

| Mockup screen                                                    | App surface                      | Device  |
| ---------------------------------------------------------------- | -------------------------------- | ------- |
| `SearchField`                                                    | header search field              | desktop |
| `SearchPanel` empty                                              | dropdown — resting (quick-jumps) | desktop |
| `SearchPanel` results                                            | dropdown — grouped results       | desktop |
| `SearchPanel` noresults                                          | dropdown — no results            | desktop |
| `ScreenSearchResultsPage`                                        | `/dashboard/search`              | desktop |
| `MobileSearchShell` + `ScreenSearchMobileResting/Live/NoResults` | mobile full-screen search        | mobile  |
| `ScreenSearchMobilePage`                                         | `/dashboard/search`              | mobile  |
| `CustomerRow` / `BigCustomerCard`                                | (omitted — Klienci, D1)          | —       |

---

## Deviations (recorded — the vision-diff must NOT re-flag these)

- **D1 `deviation(scope/no-data)`** — **Klienci** group omitted (no customer entity/page; owner decision). CustomerRow / BigCustomerCard not built.
- **D2 `deviation(scope/privacy)`** — **recent searches** omitted; resting state = **quick-jumps only** (no localStorage caching of customer-name queries on shared terminals). The recent/jumps divider is gone.
- **D3 `deviation(platform)`** — result rows use a lucide `<Truck>` in a tinted box, not `Silhouette` (VehicleSilhouette is Astro-only; matches every other React list).
- **D4 `deviation(no-data)`** — reservation rows show the **base** reservation status pill (Oczekuje / Potwierdzone / Odrzucone / Anulowane); no derived "Zakończona". Zwroty rows show returned/due.
- **D5 `deviation(impl)`** — the command list + `↑↓`/Enter keyboard nav are powered by **cmdk** (meets the design's keyboard behavior).
- **D6 `deviation(scope)`** — no calendar shortcut button beside the desktop field (the mockup topbar has one — not search).
- **D7 `deviation(reuse)`** — the desktop dropdown renders in a radix `Popover` anchored under the persistent header field; the mobile full-screen uses the app's overlay idiom.
- **D8 `deviation(no-route)`** — reservation results deep-link to the **calendar focus** URL (no per-reservation detail route); returns → `/dashboard/returns/<reservationId>`; vehicles → `/dashboard/vehicles/<id>/edit`.
- **D9 `deviation(no-mockup-row)`** — the **vehicle** result row is authored from the reservation-row idiom + `src/components/fleet/FleetList.tsx` parts (`Thumbnail`/`StatusBadge`/`Rate`/`specLine`/`editHref`; the mockup renders no vehicle row — empty demo data): Truck thumb + name + make/model + plate (mono) + category, chevron → edit.
- **D10 `deviation(density)`** — the mobile floating tab bar tightens below `sm` to `size-9` icons / `gap-0.5` / `p-1` (from `size-10` / `gap-1` / `p-1.5`, restored at `sm+`). Required by the plan's mobile-tab-bar density gate: with the search magnifier the admin pill carries 8 entries today and 9 once S-11's "Profil" tab merges — at the old sizing that is 404px, which overflows the 360px floor. Measured after the change: **310px** at 360px with 8 entries (348px projected at 9). Fallback (a) from the plan's ordered list; the Kalendarz tab is untouched.
- **D11 `deviation(responsive)`** — the desktop field is `w-[520px] max-w-full` inside a shrinkable slot rather than a hard 520px. It measures exactly 520px at the canonical desktop width; between `md` and `lg` a long page title would otherwise push it past the viewport. No visual change at the mockup's breakpoint.
- **D12 `deviation(platform)`** — the mobile full-screen view is rendered through a React portal into `<body>`. The island is mounted inside StaffShell's `hidden … md:flex` top bar (the only place the desktop field can live), so rendering the overlay in place would make it `display:none` at exactly the widths it exists for.
- **D13 `deviation(reuse)`** — the results page's topbar search field is the shell's own 520px field, not a second 420px one. Since the shell's top bar is always on (Phase 2), a page-local field would be a duplicate; the results page composes only the topbar's left block, through a new `header-title` slot.
- **D14 `deviation(no-mockup-state)`** — `/dashboard/search` with a blank `?q=` (reachable only by hand-editing the URL) shows **Zacznij pisać, aby wyszukać** / **Szukaj po numerze rezerwacji, nazwisku klienta lub rejestracji pojazdu.** and returns HTTP 400. The mockup has no such state, and the no-results copy would render as `Brak wyników dla „”`.
- **D15 `deviation(no-data)`** — the Zwroty row's mono id is the **reservation** reference (`R-0012`), not the mockup's separate return-protocol number (`RET-1204`): return protocols carry no human-facing reference of their own in this schema.
- **D16 `deviation(affordance)`** — in the **dropdown**, the Zwroty and Pojazdy rows swap their trailing chevron for the `↵` chip while active, instead of keeping the chevron the mockup draws in every state. The mockup only ever shows an active _reservation_ row, so the case never appears in it; leaving an inert arrow on the highlighted row contradicts the footer's own "↵ otwórz" hint (owner-reported, 2026-08-10). The results page has no selection, so its chevrons are unchanged.

---

## Surface 1 — Desktop header field (`SearchField`)

`width:520`, `height:44`, `rounded-[12px]`, `bg-card`, border `1.5px` (`--foreground` when focused, else
`--flota-hair`), focus ring `shadow-[0_0_0_4px_rgba(15,23,42,0.06)]`, `px-3`. Search icon `17`
(`--flota-ink-2` focused / `--muted-foreground`). Placeholder **Szukaj rezerwacji, pojazdu, rejestracji…**
`font-size:14`, muted. Right: when empty → `⌘` `K` Kbd chips (`Kbd`: `min-w-[18px] h-5 rounded-[5px] border
1px var(--flota-hair) bg-card font-size:11 weight:650`); when query → a `22×22 rounded-[7px] bg-background`
clear-X. `exact`.

## Surface 2 — Dropdown panel (`SearchPanel`)

`width:520`, `rounded-[16px]`, `bg-card`, border `1px var(--flota-hair)`, shadow
`[0_4px_12px_rgba(15,23,42,0.08),0_24px_60px_rgba(15,23,42,0.16)]`, `overflow-hidden`; anchored under the
field (radix Popover, D7). `exact`.

**GroupHeader** — `padding:12px 16px 6px`, icon `13` muted + label `font-size:11 / weight:700 /
letter-spacing:0.5 / uppercase` muted + `· {count}`. `exact`.

**RowShell** — `flex gap:12`, `padding:9px 12px`, `margin:0 6px`, `rounded-[11px]`; active → `bg-background` +
`inset 0 0 0 1px var(--flota-hair)`. `exact`.

**Rows** (reuse `<Truck>` thumb D3, `Badge` tint pills, `formatPln`, mono ref, query `<mark>`):

- **ReservationRow** — VThumb `58×40 rounded-[10px] bg-background`; line 1 = mono id `12` + status `Pill`; name `13.5 weight:600` (highlighted); vehicle+dates `12` muted; total `14 weight:700`; active → `↵` chip. `exact` (D4 status).
- **ReturnRow** — VThumb; mono id + return `Pill` (returned/due); name; vehicle+plate+when `12` muted; chevron. `exact`.
- **VehicleRow** — VThumb + name `13.5 weight:600` (highlighted) + make/model `12` muted + plate (mono) + chevron → edit. `deviation(D9)`.
- **Pill** — `h:22 px-2 rounded-[6px]`, dot + label `11 weight:650`. Tones → tokens: pending `--warning`/`--flota-warning-soft`, returned `--success`/`--flota-success-soft`, due `--warning`, done `--flota-neutral`/`--flota-neutral-soft`. `exact`.

**Resting (empty)** — **quick-jumps only** (D2): GroupHeader **Szybkie przejścia** + 3 rows — **Oczekujące
rezerwacje** (icon tile `32×32 rounded-[9px]` warning-soft, count pill) → `/dashboard/reservations`;
**Przeterminowane** (danger-soft) → `/dashboard/returns?filter=overdue`; **Dzisiejsze zwroty**
(neutral-soft) → `/dashboard/returns?filter=due`. Counts from the shell's `pendingCount` / `overdueCount` +
a today-returns count. Footer (esc only). `exact` minus D2.

**Results** — `max-height:460`, groups **Rezerwacje** / **Zwroty** / **Pojazdy** (each GroupHeader + rows) +
footer with **Zobacz wszystkie wyniki "{q}" · {resultCount}** (`--primary`, arrow) → `/dashboard/search?q=`. `exact`.

**No-results** — centered: `52×52 rounded-[14px] bg-background` search icon; **Brak wyników dla "{q}"**
`15 weight:700`; sub **Sprawdź pisownię lub szukaj po numerze rezerwacji, nazwisku lub rejestracji.** `12.5`
muted (max-w ~340). Footer (esc). `exact`.

**PanelFooter** — `padding:10px 16px`, `border-top:1px var(--flota-hair-2)`, `bg-background`. Results → the
"Zobacz wszystkie…" accent line; else → `↑ ↓ nawigacja · ↵ otwórz` Kbd hints; right → `esc zamknij`. `exact`.

## Surface 3 — Full results page (`/dashboard/search`)

Topbar (`padding:20px 32px`, border-bottom hair2, bg card): left **Wyniki dla** `13` muted + **"{q}" ·
{resultCount}** `22 weight:700`; right `SearchField width:420`. Content `max-width:920`, `padding:20px 32px
40px`. Filter chips: `h:34 px-3.5 rounded-full`, active `bg-foreground text-white`, inactive `bg-card border
var(--flota-hair)`, `font-size:13 weight:600` + count — **Wszystko / Rezerwacje / Zwroty / Pojazdy**.
`ResultSection`: icon `15` + label `14 weight:700` + count badge (`bg-secondary text-[var(--flota-neutral)]`);
card list `rounded-[16px] shadow-card`, rows separated by `1px var(--flota-hair-2)`. `exact` (chips: Klienci
chip omitted, D1).

## Surface 4 — Mobile (`MobileSearchShell` + results page)

**Search view** — top band `padding:52px 16px 12px`, bg card, border-bottom hair2: field `h:44 rounded-[12px]
bg-background border 1.5px var(--foreground)` (search icon + placeholder/query + clear-X) + **Anuluj**
(`--primary`, `14.5 weight:650`). Body scrolls: resting (quick-jumps, `34×34` icon tiles), results (groups +
a full-width **Zobacz wszystkie wyniki · {n}** ink button `h:48 rounded-[12px]`), no-results (`60×60` icon +
text). `exact` minus D2.

**Results page** (`ScreenSearchMobilePage`) — top band: back button `40×40 rounded-[11px] border` + **Wyniki
dla** + **"{q}" · {n}**; horizontal scrollable chips (`h:32 rounded-full`). Body: `SectionLabel` (icon + label
`13 weight:700` + count badge) then each row in its own card `rounded-[14px] shadow-card mx-4 mb-2`. `exact`.

---

## Verbatim Polish copy (canonical)

`Szukaj rezerwacji, pojazdu, rejestracji…` · `Szybkie przejścia` · `Oczekujące rezerwacje` · `Przeterminowane` ·
`Dzisiejsze zwroty` · `Rezerwacje` · `Zwroty` · `Pojazdy` · `Wszystko` · `Zobacz wszystkie wyniki` ·
`Wyniki dla` · `{n} wynik/wyniki/wyników` · `Brak wyników dla` ·
`Sprawdź pisownię lub szukaj po numerze rezerwacji, nazwisku lub rejestracji.` · `Anuluj` ·
(kbd hints) `nawigacja` · `otwórz` · `zamknij` · (status pills) `Oczekuje` · `Potwierdzone` · `Zwrócono` · `Na dziś`.

> Omitted copy (deviations): `Ostatnie wyszukiwania` (D2), `Klienci` (D1).
