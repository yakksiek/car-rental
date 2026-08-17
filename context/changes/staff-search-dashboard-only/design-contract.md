# Design Contract — staff-search-dashboard-only

Scope: **only the surfaces this change touches.** The full S-13 contract stays at
`context/changes/staff-global-search/design-contract.md`; Phase 4 reconciles it with this
document. Where a line here contradicts that one, this document wins.

Source of truth, pulled via DesignSync from project `352d78a6-84fd-49a2-8b38-2fe289691fc3`
this session: **`search-flow.jsx`** (rewritten dropdown-only), **`staff-desktop.jsx`**
(`StaffTopbar` right group), **`staff-screens.jsx`** (`ScreenWorkerDash` mobile entry).
Values transcribed exactly; each line `exact` or `deviation(reason)`. Polish copy canonical.

---

## Design Alignment Audit

### Freshness audit (repo vs canonical)

| Artifact                                            | Status                    | Note                                                                                                                                           |
| --------------------------------------------------- | ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `search-flow.jsx`                                   | **current**               | Pulled this session. Results page + mobile page deleted; `ScreenSearchLiveScrolled` added; `VehicleRow` drawn for the first time.              |
| `staff-desktop.jsx`                                 | **current**               | `StaffTopbar({title, sub, search, searchQuery, searchFocused})`; only `ScreenStaffDash` passes `search`.                                       |
| `staff-screens.jsx`                                 | **current**               | `ScreenWorkerDash` carries the 44×44 magnifier; its `TabBar` has no search entry.                                                              |
| `staff-global-search/design-review/*.png` (8 files) | **outdated (superseded)** | Dated 2026-08-10. Two render `ScreenSearchResultsPage` / `ScreenSearchMobilePage`, which no longer exist. Prune at Phase 4.                    |
| `exports/global-search/` in the design project      | **ambiguous**             | Holds two overlapping sets — three request-named files plus an `s1-*` set of 10. Neither verified. Superseded by the rewritten export request. |
| `design-system.md` screenshot catalog rows 09 / 20  | **outdated (superseded)** | Staff shell shots predate the S-13 restructure and this narrowing. Re-export at archive.                                                       |

### New-design quality audit (gaps in the canonical source)

- **No ⌘K-from-another-screen state is drawn.** `useSX()` carries the copy for one —
  `tip: 'Wskazówka'` / `tipBody: 'Naciśnij'` / `tipBody2: 'z dowolnego ekranu, aby wyszukać.'` —
  but no screen renders it. Our navigate-to-Pulpit behavior therefore has no canonical shot
  (recorded as **N3** below).
- **No loading or error state** in any phase. Pre-existing; `useSearch` handles both by
  showing the empty state, unchanged by this plan.
- **Desktop and mobile are both covered** for resting / results / results-scrolled /
  no-results, plus both entry points. Copy is canonical Polish via `useSX()`.

### Alignment checklist (plan vs canonical)

| Canonical surface                                                         | Plan phase       | Aligned?                          |
| ------------------------------------------------------------------------- | ---------------- | --------------------------------- |
| `ScreenStaffDash` topbar — the only desktop screen with a field           | Phase 3 (§B)     | ✓                                 |
| `ScreenStaffRequests` — a staff topbar with no field                      | Phase 3 (§B)     | ✓                                 |
| `ScreenWorkerDash` — 44×44 magnifier left of the avatar, no TabBar search | Phase 3 (§A)     | ✓                                 |
| `SearchPanel` results — scrolls under a 460 cap, no "see all"             | Phase 2 (§D)     | ✓ already scrolls; footer changes |
| `SearchPanel` footer — hints in every phase                               | Phase 2 (§D)     | ✓                                 |
| `VehicleRow` — drawn for the first time                                   | Phase 4 (§C)     | ✓ (D9 shrinks)                    |
| `ScreenSearchMobileLive` — list simply ends                               | Phase 2 (§D)     | ✓                                 |
| Results page / mobile results page                                        | — (deleted)      | ✓ no phase should build them      |
| UI phases carry a vision-diff criterion                                   | Phase 3, Phase 4 | ✓                                 |

### Verdict

**BLOCKED (by agreement) — canonical screenshots not yet captured.** 9 surfaces aligned;
3 repo design artifacts superseded; 4 deviations carried or added (N1–N3 plus the amended
D9/D16); 2 pre-existing deltas recorded below without a phase. Exact values are transcribed
from the code-backed JSX, so **implementation is not blocked** — only the rendered
vision-diff gate is. Per your instruction the export request is rewritten as the final
planning step; you run it, then we audit the returned PNGs into
`context/changes/staff-search-dashboard-only/design-review/`.

---

## Surfaces

### A. Mobile entry — dashboard hero magnifier (`ScreenWorkerDash`)

Right-hand group is `flex items-center gap-[10px]` → **[magnifier, avatar]**, in that order.

| Element       | Exact value                         | App token                           |
| ------------- | ----------------------------------- | ----------------------------------- |
| Button box    | `44×44`, `borderRadius: 99`         | `size-11 rounded-full`              |
| Background    | `tokens.card`                       | `bg-card`                           |
| Border        | `1px solid tokens.hair`             | `border border-[var(--flota-hair)]` |
| Shadow        | `tokens.shadow1`                    | `shadow-card`                       |
| Padding       | `0`                                 | `p-0`                               |
| Icon          | `Icon.search s={19} c={tokens.ink}` | `size-[19px] text-foreground`       |
| Gap to avatar | `10`                                | `gap-2.5`                           |

`exact`. The avatar beside it is unchanged and already correct (`size-11`, `rounded-full`,
`bg-primary`, `text-[16px] font-medium tracking-[0.4px]`, `shadow-accent`). Hero wrapper,
eyebrow and `Pulpit` headline are unchanged and already correct.

### B. Desktop topbar right group (`StaffTopbar`)

Order is **field → calendar → QuickAdd**, `gap: 12`.

| Element         | Exact value                                                                                       | App token                            |
| --------------- | ------------------------------------------------------------------------------------------------- | ------------------------------------ |
| Group gap       | `12`                                                                                              | `gap-3`                              |
| Field           | `width 520`, `height 44`                                                                          | `w-[520px] max-w-full h-11` (D11)    |
| Calendar button | `38×38`, `borderRadius 10`, `1px solid tokens.hair`, `bg tokens.card`, icon `16` in `tokens.ink2` | already correct in `dashboard.astro` |
| Bar padding     | `22px 32px`                                                                                       | `px-8 py-[22px]` — already correct   |

`exact`. Two corrections against today's build: the field currently renders **after**
`header-action` (so Pulpit draws calendar → field), and the group gap is `gap-4` (16) rather
than 12. Both fixed in Phase 3 §1. QuickAdd belongs to S-12 (sibling branch) — not ours.

Only `ScreenStaffDash` passes `search`. Every other staff screen renders the bar with no
field — `ScreenStaffRequests` is the canonical example. `exact`.

### C. Vehicle result row (`VehicleRow`)

Drawn in the design for the first time. Within the standard `RowShell`
(`gap 12`, `padding 9px 12px`, `margin 0 6px`, `borderRadius 11`, active → `bg tokens.bg` +
`inset 0 0 0 1px tokens.hair`):

| Element     | Exact value                                                             | App token                                                              |
| ----------- | ----------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| Thumb       | `58×40`, `borderRadius 10`, `bg tokens.bg`                              | `h-10 w-[58px] rounded-[10px] bg-background` (D3 icon)                 |
| Name        | `13.5px / 600`, `letterSpacing -0.1`, `tokens.ink`, in `<Highlight>`    | `text-[13.5px] font-[600] text-foreground`                             |
| Spec line   | `flex items-center gap-7px`, `marginTop 2`, `nowrap`, `overflow hidden` | `mt-0.5 flex items-center gap-[7px] overflow-hidden whitespace-nowrap` |
| — make      | `12px`, `tokens.muted`                                                  | `text-[12px] text-muted-foreground`                                    |
| — separator | `3×3`, `borderRadius 99`, `bg tokens.hair`, `flexShrink 0`              | `size-[3px] shrink-0 rounded-full bg-[var(--flota-hair)]`              |
| — plate     | `mono 11.5px / 600`, `tokens.ink2`                                      | `font-mono text-[11.5px] font-[600] text-[var(--flota-ink-2)]`         |
| Trailing    | `Icon.chevR s={16} c={tokens.muted}`                                    | `size-4 text-muted-foreground`                                         |

`exact` except the retired-vehicle pill — see **D9** below. **The model is not rendered.**

### D. Dropdown panel — footer and scroll

**Footer, every phase** (`padding 10px 16px`, `borderTop 1px tokens.hair2`, `bg tokens.bg`):
left `gap 6`, `fontSize 11.5`, muted — `⌘`-style `Kbd` ↑ ↓ then `nawigacja` (with `marginRight 6`),
then `Kbd` ↵ then `otwórz`; right `Kbd` `esc` then `zamknij`. There is **no** results-phase
variant. `exact`.

`Kbd`: `minWidth 18`, `height 20`, `padding 0 5px`, `borderRadius 5`, `bg tokens.card`,
`1px solid tokens.hair`, `boxShadow 0 1px 0 rgba(15,23,42,0.05)`, `11px / 650`, `tokens.ink2`.
`exact`.

**Results scroll**: `maxHeight 460`, `overflowY auto`. `exact` — already satisfied at
`GlobalSearch.tsx:266`, no change needed.

**Mobile results body**: `padding 4px 0 24px`, the three groups, and **nothing after the last
row**. `exact`.

---

## Deviations

Amended from the S-13 contract:

- **D1** `Klienci` omitted → now **`exact`**. The design dropped `CustomerRow` / `Avatar` /
  `customers` too; app and mock agree.
- **D2** recent searches omitted → now **`exact`**. The design dropped
  `Ostatnie wyszukiwania`, its divider and the `recent` key.
- **D9** → shrinks to `deviation(no-design-state)`: the row now matches the design (§C); the
  only addition is the **`Wycofany`** neutral pill on an inactive vehicle, for which the
  design has no equivalent because its demo fleet has no retired vehicle.
- **D16** → reworded as a **live** `deviation(affordance)`. The design draws the active
  Zwroty/Pojazdy row with the `↵` chip **beside** the retained chevron; we swap chevron for
  chip (owner-reported, `f00ffec`). Previously justified as "the mockup never draws this
  case" — it does now, so this is a deliberate divergence from a drawn state.
- **D10** → re-measured. With the magnifier gone the admin pill carries **7** entries, which
  fits the 360px floor at the original sizing (40·7 + 4·6 + 12 = **316px**). The `sm`-down
  tightening is **kept** as headroom: S-11's "Profil" tab takes it to 8, i.e. exactly **360px**
  — the floor with zero margin.
- **D13**, **D14** → **deleted** with the results page.

New:

- **N1** `deviation(scope)` — QuickAddButton is not rendered beside the field. It belongs to
  S-12 (`manual-reservation`, sibling branch), not this change.
- **N2** `deviation(platform)` — the island stays mounted on all 10 staff pages while the
  field renders on one. The design has no notion of mounting; this is what keeps ⌘K and the
  mobile overlay alive off-Pulpit.
- **N3** `deviation(no-design-state)` — at `md+` on a page with no field, ⌘K navigates to
  `/dashboard?search=1` and the dropdown opens on arrival. The design has no drawn state for
  this, though `useSX()` carries unrendered copy asserting ⌘K works "z dowolnego ekranu".

---

## Known deltas — pre-existing, NOT addressed by this change

Found during this audit. Neither is introduced by this plan and neither has a phase, so the
rendered vision-diff **will** flag them. Recorded here so that flag reads as known, not new.

1. **Quick-jump count badge.** Design: `minWidth 20`, `height 20`, `borderRadius 99`,
   `padding 0 6px`, `11px / 700`, **tinted to match its tile** (amber-on-amberSoft,
   red-on-redSoft, ink2-on-greySoft). Ours: `h-[22px] min-w-[22px] rounded-[6px] px-1.5
text-[11px] font-[650] bg-secondary text-[var(--flota-neutral)]` — square-ish and uniformly
   neutral. Mobile equivalents differ likewise (`22`/`0 7px`/`12px`).
2. **Quick-jump row weight and icons.** Design labels are `550`, ours are `600`; the design's
   pending icon is `Icon.list`, ours is `Clock`.

Both are cheap to fold into Phase 4 if you want them fixed — say so and I will add them.

---

## Copy delta (canonical Polish)

**Removed** with the results page: `Zobacz wszystkie wyniki` · `Wyniki dla` · `Wszystko` ·
`{n} wynik/wyniki/wyników` · `Zacznij pisać, aby wyszukać` ·
`Szukaj po numerze rezerwacji, nazwisku klienta lub rejestracji pojazdu.` · `Wróć`.

**Unchanged and canonical**: `Szukaj rezerwacji, pojazdu, rejestracji…` · `Szybkie przejścia` ·
`Oczekujące rezerwacje` · `Przeterminowane` · `Dzisiejsze zwroty` · `Rezerwacje` · `Zwroty` ·
`Pojazdy` · `Brak wyników dla` ·
`Sprawdź pisownię lub szukaj po numerze rezerwacji, nazwisku lub rejestracji.` · `Anuluj` ·
`nawigacja` · `otwórz` · `zamknij` · `Oczekuje` · `Potwierdzone` · `Zwrócono` · `Na dziś`.

**Present in the design, still unrendered**: `Wskazówka` / `Naciśnij` /
`z dowolnego ekranu, aby wyszukać.` (see N3).

**New**: `aria-label="Szukaj"` on the dashboard hero magnifier — matches the label already
used by the tab-bar button being removed.
