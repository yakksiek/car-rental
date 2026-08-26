# Design Contract — S-13 staff-global-search

Source of truth: **`search-flow.jsx`** (`SearchField`, `SearchPanel` [empty/results/results-scrolled/
noresults], the three result rows, and the mobile `MobileSearchShell` / `ScreenSearchMobile*`),
**`staff-desktop.jsx`** (`StaffTopbar`) and **`staff-screens.jsx`** (`ScreenWorkerDash`), live in Claude Design
`352d78a6-84fd-49a2-8b38-2fe289691fc3`, pulled via DesignSync. Values transcribed **exactly**; each line
`exact` or `deviation(reason)`. We ship **3 groups** (Rezerwacje / Zwroty / Pojazdy) and **quick-jumps only**.

> **Amended 2026-08-17 by `staff-search-dashboard-only`.** Search is now **Pulpit-only** and
> **dropdown-only**: there is no `/dashboard/search`, no results URL and no "Zobacz wszystkie wyniki". The
> design was rewritten to match first (`../staff-search-dashboard-only/design-request.md`, status APPLIED), so
> this contract follows the design rather than diverging from it. The narrower per-surface contract for that
> change lives at `../staff-search-dashboard-only/design-contract.md`; where the two overlap they agree, and
> its `N1`–`N3` are recorded here as `D6`, `D17` and `D18`.

---

## Design Alignment Audit

### Freshness audit (repo vs canonical)

| Artifact                                          | Status                    | Note                                                                                                                                                                                                                                    |
| ------------------------------------------------- | ------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `search-flow.jsx` (design source)                 | **current**               | Rewritten dropdown-only. `ScreenSearchResultsPage` / `ScreenSearchMobilePage` deleted with `ResultSection` / `SectionLabel` and the `showEnter` footer branch; `ScreenSearchLiveScrolled` added; `VehicleRow` drawn for the first time. |
| `staff-desktop.jsx` (`StaffTopbar`)               | **current**               | `StaffTopbar({title, sub, search, searchQuery, searchFocused})`; only `ScreenStaffDash` passes `search`.                                                                                                                                |
| `staff-screens.jsx` (`ScreenWorkerDash`)          | **current**               | Carries the 44×44 hero magnifier left of the avatar; its `TabBar` has no search entry.                                                                                                                                                  |
| `design-review/*.png` (8 files, dated 2026-08-10) | **pruned 2026-08-17**     | Two of them rendered the deleted results page. Deleted rather than re-exported — the `v2-` request in `../staff-search-dashboard-only/design-export-request.md` is retained but not run. See the verdict.                               |
| `design-system.md` screenshot catalog rows 09/20  | **outdated (superseded)** | Staff-shell shots predate both the S-13 restructure and this narrowing. Re-export at archive.                                                                                                                                           |

### New-design quality audit (gaps in the canonical source)

- **No ⌘K-from-another-screen state is drawn.** `useSX()` carries the copy for one — `Wskazówka` / `Naciśnij`
  / `z dowolnego ekranu, aby wyszukać.` — but no screen renders it (see **D17**).
- **No loading or error state** in any phase. Pre-existing; `useSearch` handles both by showing the empty
  state.
- Desktop and mobile are covered for resting / results / results-scrolled / no-results, plus both entry
  points. Copy is canonical Polish via `useSX()`.

### Alignment checklist (design vs app)

| Canonical surface                                               | App surface                          | Aligned?           |
| --------------------------------------------------------------- | ------------------------------------ | ------------------ |
| `ScreenStaffDash` topbar — the only desktop screen with a field | `/dashboard` header                  | ✓                  |
| `ScreenStaffRequests` — a staff topbar with no field            | the other 9 staff pages              | ✓ (D18)            |
| `ScreenWorkerDash` — 44×44 magnifier, no TabBar search          | `/dashboard` mobile hero             | ✓                  |
| `SearchField`                                                   | desktop header field                 | ✓ (D11)            |
| `SearchPanel` resting / results / results-scrolled / no-results | the dropdown                         | ✓ (D3, D4, D5, D7) |
| `VehicleRow` — drawn for the first time                         | the Pojazdy row                      | ✓ (D9 shrinks)     |
| `MobileSearchShell` + `ScreenSearchMobile*`                     | the mobile full-screen search        | ✓ (D12)            |
| Results page / mobile results page                              | — (deleted from both design and app) | ✓                  |

### Verdict

**PASS (paper audit)** — app and design agree on every surface. **D1**, **D2**, **D13** and **D14** are
retired; **D6**, **D9**, **D10** and **D16** are amended; **D17**, **D18** and **D19** are new.

**The rendered vision-diff gate was skipped by owner decision (2026-08-17)** rather than run against a `v2-`
export. Reasoning in `../staff-search-dashboard-only/change.md`: every value here was transcribed from the
code-backed JSX, so the diff would have re-verified the transcription rather than the design — and it would
have passed **D19**, since the mock renders no active mobile row on either side. The 8 stale PNGs that used
to sit in this folder were pruned in the same pass; two of them rendered `ScreenSearchResultsPage`, which
exists in neither the app nor the design. `design-system.md` catalog rows 09/20 are stale for unrelated
reasons and are still slated for re-export at archive.

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

| Mockup screen                                                    | App surface                         | Device  |
| ---------------------------------------------------------------- | ----------------------------------- | ------- |
| `StaffTopbar` with `search`                                      | `/dashboard` header (the ONLY one)  | desktop |
| `SearchField`                                                    | header search field                 | desktop |
| `SearchPanel` empty                                              | dropdown — resting (quick-jumps)    | desktop |
| `SearchPanel` results                                            | dropdown — grouped results          | desktop |
| `ScreenSearchLiveScrolled`                                       | dropdown scrolled under the 460 cap | desktop |
| `SearchPanel` noresults                                          | dropdown — no results               | desktop |
| `ScreenWorkerDash` hero magnifier                                | `/dashboard` mobile entry           | mobile  |
| `MobileSearchShell` + `ScreenSearchMobileResting/Live/NoResults` | mobile full-screen search           | mobile  |
| `CustomerRow` / `BigCustomerCard`                                | (deleted from the design too — D1)  | —       |

---

## Deviations (recorded — the vision-diff must NOT re-flag these)

- **D1** ~~Klienci group omitted~~ → **retired, now `exact`.** The design dropped `CustomerRow` / `Avatar` /
  the `customers` key as well, so app and mock agree: there is no Klienci group in either.
- **D2** ~~recent searches omitted~~ → **retired, now `exact`.** The design dropped `Ostatnie wyszukiwania`,
  its divider and the `recent` key from both resting states.
- **D3 `deviation(platform)`** — result rows use a lucide `<Truck>` in a tinted box, not `Silhouette` (VehicleSilhouette is Astro-only; matches every other React list).
- **D4 `deviation(no-data)`** — reservation rows show the **base** reservation status pill (Oczekuje / Potwierdzone / Odrzucone / Anulowane); no derived "Zakończona". Zwroty rows show returned/due.
- **D5 `deviation(impl)`** — the command list + `↑↓`/Enter keyboard nav are powered by **cmdk** (meets the design's keyboard behavior).
- **D6 `deviation(scope)`** — the design's topbar right group is field → calendar → **QuickAdd**; we render field → calendar and no QuickAdd. It belongs to S-12 (`manual-reservation`, a sibling branch), not to search. (`staff-search-dashboard-only` **N1**.)
- **D7 `deviation(reuse)`** — the desktop dropdown renders in a radix `Popover` anchored under the header field; the mobile full-screen uses the app's overlay idiom.
- **D8 `deviation(no-route)`** — reservation results deep-link to the **calendar focus** URL (no per-reservation detail route); returns → `/dashboard/returns/<reservationId>`; vehicles → `/dashboard/vehicles/<id>/edit`.
- **D9 `deviation(no-design-state)`** — **shrunk.** The design now draws `VehicleRow`, and ours matches it (thumb, name, make ● plate, chevron). The only addition is the neutral **`Wycofany`** pill on an inactive vehicle, for which the design has no equivalent because its demo fleet has no retired vehicle.
- **D10 `deviation(density)`** — **re-measured.** The mobile floating tab bar tightens below `sm` to `size-9` icons / `gap-0.5` / `p-1` (from `size-10` / `gap-1` / `p-1.5`, restored at `sm+`). With the magnifier removed from the pill the admin case is back to **7** entries, which the original sizing already fits at the 360px floor (40·7 + 4·6 + 12 = **316px**), so the tightening is no longer strictly required. It is **kept as headroom**: S-11's "Profil" tab takes the pill to 8, i.e. exactly **360px** at the original sizing — the floor with zero margin.
- **D11 `deviation(responsive)`** — the desktop field is `w-[520px] max-w-full` inside a shrinkable slot rather than a hard 520px. It measures exactly 520px at the canonical desktop width; between `md` and `lg` a long page title would otherwise push it past the viewport. No visual change at the mockup's breakpoint.
- **D12 `deviation(platform)`** — the mobile full-screen view is rendered through a React portal into `<body>`. The island is mounted inside StaffShell's `hidden … md:flex` top bar (the only place the desktop field can live), so rendering the overlay in place would make it `display:none` at exactly the widths it exists for.
- **D13** ~~results-page `header-title` slot~~ → **deleted with the results page.**
- **D14** ~~blank-`?q=` results-page state~~ → **deleted with the results page.**
- **D15 `deviation(no-data)`** — the Zwroty row's mono id is the **reservation** reference (`R-0012`), not the mockup's separate return-protocol number (`RET-1204`): return protocols carry no human-facing reference of their own in this schema.
- **D16 `deviation(affordance)`** — **now a live deviation from a drawn state.** The Zwroty and Pojazdy rows swap their trailing chevron for the `↵` chip while active. The design draws the active row with the chip **beside** the retained chevron; leaving an inert arrow on the highlighted row contradicts the footer's own "↵ otwórz" hint (owner-reported, `f00ffec`). Previously justified as "the mockup never draws this case" — it does now, so this is deliberate divergence rather than an undrawn gap.
- **D17 `deviation(no-design-state)`** — at `md+` on a page with no field, ⌘K navigates to `/dashboard?search=1` and the dropdown opens on arrival (the parameter is stripped so a refresh cannot re-trigger it). The design has no drawn state for this, though `useSX()` carries unrendered copy asserting ⌘K works "z dowolnego ekranu". (`staff-search-dashboard-only` **N3**.)
- **D18 `deviation(platform)`** — the `<GlobalSearch>` island stays mounted on all 10 staff pages while the field renders on one. The design has no notion of mounting; this is what keeps ⌘K and the mobile overlay alive off-Pulpit, and it is why the overlay works in place below `md` on every page. (`staff-search-dashboard-only` **N2**.)
- **D19 `deviation(no-design-state)`** — below `md` the active row's background is **`bg-card`**, not the design's `tokens.bg`. `search-flow.jsx` gives `RowShell` a single active treatment tuned against the desktop `SearchPanel`, whose container is `tokens.card`; `MobileSearchShell`'s body is itself `tokens.bg`, so there the drawn value paints the color already underneath it and only the `rgba(15,23,42,0.08)` ring remains. The mock never exposed the collision because **no mobile screen passes `active`** (`ScreenSearchLive` sets `active={i === 0}`; `ScreenSearchMobileLive` sets it on nothing) — we render it for real, since cmdk always keeps a row selected. Figure and ground therefore swap below `md`; the inset ring is unchanged on both surfaces, and the desktop panel keeps the drawn value exactly. **Do not "correct" this back to `tokens.bg`** — and do not fix it by making the overlay body `tokens.card` instead, which would contradict a value the mock draws across all three mobile screens. Owner-reported, 2026-08-17.

---

## Surface 1 — Desktop header field (`SearchField`), Pulpit only

`width:520`, `height:44`, `rounded-[12px]`, `bg-card`, border `1.5px` (`--foreground` when focused, else
`--flota-hair`), focus ring `shadow-[0_0_0_4px_rgba(15,23,42,0.06)]`, `px-3`. Search icon `17`
(`--flota-ink-2` focused / `--muted-foreground`). Placeholder **Szukaj rezerwacji, pojazdu, rejestracji…**
`font-size:14`, muted. Right: when empty → `⌘` `K` Kbd chips (`Kbd`: `min-w-[18px] h-5 rounded-[5px] border
1px var(--flota-hair) bg-card font-size:11 weight:650`); when query → a `22×22 rounded-[7px] bg-background`
clear-X. `exact`.

**Placement** — the topbar's right group is `gap:12`, ordered **field → calendar (38×38, `rounded-[10px]`,
`1px var(--flota-hair)`, `bg-card`, icon `16` in `--flota-ink-2`) → QuickAdd (D6)**. Bar padding `22px 32px`.
Only `ScreenStaffDash` passes `search`; every other staff screen renders the bar with no field
(`ScreenStaffRequests` is the canonical example). `exact`.

## Surface 2 — Dropdown panel (`SearchPanel`)

`width:520`, `rounded-[16px]`, `bg-card`, border `1px var(--flota-hair)`, shadow
`[0_4px_12px_rgba(15,23,42,0.08),0_24px_60px_rgba(15,23,42,0.16)]`, `overflow-hidden`; anchored under the
field (radix Popover, D7). `exact`.

**GroupHeader** — `padding:12px 16px 6px`, icon `13` muted + label `font-size:11 / weight:700 /
letter-spacing:0.5 / uppercase` muted + `· {count}`. `exact`.

**RowShell** — `flex gap:12`, `padding:9px 12px`, `margin:0 6px`, `rounded-[11px]`; active → `bg-background` +
`inset 0 0 0 1px var(--flota-hair)`. `exact` on this surface — the mobile overlay needs a different active
background for the same reason it needs no anchor: see **D19**.

**Rows** (reuse `<Truck>` thumb D3, `Badge` tint pills, `formatPln`, mono ref, query `<mark>`):

- **ReservationRow** — VThumb `58×40 rounded-[10px] bg-background`; line 1 = mono id `12` + status `Pill`; name `13.5 weight:600` (highlighted); vehicle+dates `12` muted; total `14 weight:700`; active → `↵` chip. `exact` (D4 status).
- **ReturnRow** — VThumb; mono id + return `Pill` (returned/due); name; vehicle+plate+when `12` muted; chevron. `exact` (D15 id, D16 active affordance).
- **VehicleRow** — VThumb; name `13.5 weight:600` (highlighted); spec line `flex gap:7 marginTop:2 nowrap overflow-hidden` = make `12` muted + a `3×3 rounded-full var(--flota-hair)` dot + plate `mono 11.5 weight:650` in `--flota-ink-2` (highlighted); chevron `16` → edit. **The model is not rendered** — the name carries it. `exact` (D9 pill, D16 active affordance).
- **Pill** — `h:22 px-2 rounded-[6px]`, dot + label `11 weight:650`. Tones → tokens: pending `--warning`/`--flota-warning-soft`, returned `--success`/`--flota-success-soft`, due `--warning`, done `--flota-neutral`/`--flota-neutral-soft`. `exact`.

**Resting (empty)** — quick-jumps only: GroupHeader **Szybkie przejścia** + 3 rows — **Oczekujące
rezerwacje** (icon tile `32×32 rounded-[9px]` warning-soft, count pill) → `/dashboard/reservations`;
**Przeterminowane** (danger-soft) → `/dashboard/returns?filter=overdue`; **Dzisiejsze zwroty**
(neutral-soft) → `/dashboard/returns?filter=due`. Counts from the shell's `pendingCount` / `overdueCount` +
a today-returns count. `exact`.

**Results** — `max-height:460`, `overflow-y:auto` (`ScreenSearchLiveScrolled`), groups **Rezerwacje** /
**Zwroty** / **Pojazdy**, each GroupHeader + rows. The list simply ends after the last row: **no truncation
notice, no per-group "and N more", and nothing to link out to.** The RPC's per-group cap is 25 so the panel
can carry the whole result set. `exact`.

**No-results** — centered: `52×52 rounded-[14px] bg-background` search icon; **Brak wyników dla "{q}"**
`15 weight:700`; sub **Sprawdź pisownię lub szukaj po numerze rezerwacji, nazwisku lub rejestracji.** `12.5`
muted (max-w ~340). `exact`.

**PanelFooter** — `padding:10px 16px`, `border-top:1px var(--flota-hair-2)`, `bg-background`. The keyboard
hints in **every** phase — left `↑ ↓ nawigacja · ↵ otwórz`, right `esc zamknij`. There is no results-phase
variant. `exact`.

## Surface 3 — Mobile entry (`ScreenWorkerDash` hero)

The hero's right-hand group is `flex items-center gap:10` → **[magnifier, avatar]**, in that order. Magnifier:
`44×44`, `borderRadius:99`, `bg tokens.card`, `1px solid tokens.hair`, `tokens.shadow1`, `padding:0`, icon
`Icon.search s={19}` in `tokens.ink`, `aria-label="Szukaj"`. The avatar is unchanged (`size-11`,
`rounded-full`, `bg-primary`, `16px / medium / letter-spacing 0.4`, `shadow-accent`). This is the **only**
mobile entry point — the floating tab bar deliberately carries no magnifier. `exact`.

## Surface 4 — Mobile full-screen search (`MobileSearchShell`)

Top band `padding:52px 16px 12px`, bg card, border-bottom hair2: field `h:44 rounded-[12px] bg-background
border 1.5px var(--foreground)` (search icon + placeholder/query + clear-X) + **Anuluj** (`--primary`,
`14.5 weight:650`). Body scrolls, `padding:4px 0 24px`: resting (quick-jumps, `34×34` icon tiles), results
(the three groups, and **nothing after the last row**), no-results (`60×60` icon + text). `exact` — the body
stays `tokens.bg` as drawn; the row that sits on it takes the **D19** active background.

---

## Verbatim Polish copy (canonical)

`Szukaj rezerwacji, pojazdu, rejestracji…` · `Szybkie przejścia` · `Oczekujące rezerwacje` · `Przeterminowane` ·
`Dzisiejsze zwroty` · `Rezerwacje` · `Zwroty` · `Pojazdy` · `Brak wyników dla` ·
`Sprawdź pisownię lub szukaj po numerze rezerwacji, nazwisku lub rejestracji.` · `Anuluj` ·
(kbd hints) `nawigacja` · `otwórz` · `zamknij` · (status pills) `Oczekuje` · `Potwierdzone` · `Zwrócono` · `Na dziś` ·
(aria) `Szukaj` · `Wyczyść`.

> **Retired with the results page**: `Zobacz wszystkie wyniki` · `Wyniki dla` · `Wszystko` ·
> `{n} wynik/wyniki/wyników` · `Zacznij pisać, aby wyszukać` ·
> `Szukaj po numerze rezerwacji, nazwisku klienta lub rejestracji pojazdu.` · `Wróć`.
>
> **Present in the design, still unrendered**: `Wskazówka` / `Naciśnij` / `z dowolnego ekranu, aby wyszukać.`
> (see D17).
