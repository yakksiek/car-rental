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

| Artifact                                            | Status                    | Note                                                                                                                                                           |
| --------------------------------------------------- | ------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `search-flow.jsx`                                   | **current**               | Pulled this session. Results page + mobile page deleted; `ScreenSearchLiveScrolled` added; `VehicleRow` drawn for the first time.                              |
| `staff-desktop.jsx`                                 | **current**               | `StaffTopbar({title, sub, search, searchQuery, searchFocused})`; only `ScreenStaffDash` passes `search`.                                                       |
| `staff-screens.jsx`                                 | **current**               | `ScreenWorkerDash` carries the 44×44 magnifier; its `TabBar` has no search entry.                                                                              |
| `staff-global-search/design-review/*.png` (8 files) | **pruned 2026-08-17**     | Dated 2026-08-10. Two rendered `ScreenSearchResultsPage` / `ScreenSearchMobilePage`, which no longer exist. Deleted rather than re-exported — see the verdict. |
| `exports/global-search/` in the design project      | **ambiguous**             | Holds two overlapping sets — three request-named files plus an `s1-*` set of 10. Neither verified. Superseded by the rewritten export request.                 |
| `design-system.md` screenshot catalog rows 09 / 20  | **outdated (superseded)** | Staff shell shots predate the S-13 restructure and this narrowing. Re-export at archive.                                                                       |

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

| Canonical surface                                               | Plan phase       | Aligned?                          |
| --------------------------------------------------------------- | ---------------- | --------------------------------- |
| `ScreenStaffDash` topbar — the only desktop screen with a field | Phase 3 (§B)     | ✓                                 |
| `ScreenStaffRequests` — a staff topbar with no field            | Phase 3 (§B)     | ✓                                 |
| `ScreenWorkerDash` — 44×44 magnifier, no TabBar search          | Phase 3 (§A)     | ✓ (re-pulled 2026-08-26 — §A)     |
| `SearchPanel` results — scrolls under a 460 cap, no "see all"   | Phase 2 (§D)     | ✓ already scrolls; footer changes |
| `SearchPanel` footer — hints in every phase                     | Phase 2 (§D)     | ✓                                 |
| `VehicleRow` — drawn for the first time                         | Phase 4 (§C)     | ✓ (D9 shrinks)                    |
| `ScreenSearchMobileLive` — list simply ends                     | Phase 2 (§D)     | ✓                                 |
| Results page / mobile results page                              | — (deleted)      | ✓ no phase should build them      |
| UI phases carry a vision-diff criterion                         | Phase 3, Phase 4 | ✓                                 |

### Verdict

**PASS — implemented; the rendered vision-diff gate was skipped by decision.** 9 surfaces
aligned; 3 repo design artifacts superseded; 5 deviations carried or added (N1–N3 plus the
amended D9/D16, and D19 from Phase 5); 2 pre-existing deltas recorded below without a phase.

> **Amended 2026-08-26 at the `main` (S-11 + S-12b) merge.** The design was re-pulled for the
> two surfaces the merge touches. Net: **three deviations retired** — §A's hero cluster and
> S-12b's **D8** (the design now draws the mobile quick-add itself), §B's order and **N1** (the
> desktop cluster is now field → calendar → QuickAdd exactly, for the first time), and this
> contract's **D10** (tab-bar density → main's scroll solution; search adds no tab). One
> deviation added — **N4**, ⌘K off on `/dashboard/account/password`. One new pre-existing delta
> recorded — item 3, Pulpit's greeting wrapping between 768 and ~1150. Note that this
> contract's D10 and S-12b's D10 are **different rules that share a number**; neither has been
> folded into the other.

Exact values were transcribed from the code-backed JSX, so implementation was never blocked —
only the gate was, and on 2026-08-17 the owner closed it unrun (Progress row 4.6). Full
reasoning in `change.md`; the short version is that diffing a render of the app against a
render of the same source re-verifies the transcription rather than the design, and the gate
would have passed this change's one real defect (D19 — the mock renders no active mobile row
either). The `v2-` export request is retained, marked not-run. The 8 superseded S-13 PNGs were
pruned rather than replaced.

---

## Surfaces

### A. Mobile entry — dashboard hero magnifier (`ScreenWorkerDash`)

Right-hand group is `flex items-center gap-[10px]` → **[magnifier, quick-add, avatar]**, in
that order.

> **Re-pulled 2026-08-26** (`staff-screens.jsx`, `ScreenWorkerDash`). The cluster was
> `[magnifier, avatar]` when this contract was written; the design now draws
> `<QuickAddButton mode="mobile" />` between them. Three items at **44 / 40 / 44**, gap **10**.
> See the D8 note under Deviations — this retires the S-12b divergence rather than creating
> one here.

| Element    | Exact value                         | App token                           |
| ---------- | ----------------------------------- | ----------------------------------- |
| Button box | `44×44`, `borderRadius: 99`         | `size-11 rounded-full`              |
| Background | `tokens.card`                       | `bg-card`                           |
| Border     | `1px solid tokens.hair`             | `border border-[var(--flota-hair)]` |
| Shadow     | `tokens.shadow1`                    | `shadow-card`                       |
| Padding    | `0`                                 | `p-0`                               |
| Icon       | `Icon.search s={19} c={tokens.ink}` | `size-[19px] text-foreground`       |
| Gap (each) | `10`                                | `gap-2.5`                           |

`exact`. The avatar at the end of the cluster is unchanged and already correct (`size-11`,
`rounded-full`, `bg-primary`, `text-[16px] font-medium tracking-[0.4px]`, `shadow-accent`), as
are the hero wrapper, eyebrow and `Pulpit` headline. The quick-add circle between them is
S-12b's shipped `<QuickAddButton mode="mobile" />` at its own `40×40`, unchanged by this
change.

**Fit at the 360px floor** — measured, not computed: cluster `148px`
(44 + 10 + 40 + 10 + 44), leaving `106px` of the `Pulpit` h1's 40px type on one line inside a
360px viewport with no header overflow. `exact`.

### B. Desktop topbar right group (`StaffTopbar`)

Order is **field → calendar → QuickAdd**, `gap: 12`.

| Element         | Exact value                                                                                       | App token                            |
| --------------- | ------------------------------------------------------------------------------------------------- | ------------------------------------ |
| Group gap       | `12`                                                                                              | `gap-3`                              |
| Field           | `width 520`, `height 44`                                                                          | `w-[520px] max-w-full h-11` (D11)    |
| Calendar button | `38×38`, `borderRadius 10`, `1px solid tokens.hair`, `bg tokens.card`, icon `16` in `tokens.ink2` | already correct in `dashboard.astro` |
| Bar padding     | `22px 32px`                                                                                       | `px-8 py-[22px]` — already correct   |

`exact` — and, since the S-12b merge (2026-08-26), **shipped exactly** for the first time.
Both original corrections landed (the field used to render _after_ `header-action`, so Pulpit
drew calendar → field; the group gap was `gap-4`/16 rather than 12), and QuickAdd — which
belonged to the S-12 sibling branch when this line was written — is now the cluster's
unconditional last child. `StaffShell` renders the three in the design's own order:

```astro
<GlobalSearch client:load {...searchProps} />
{/* field, Pulpit only */}
<slot name="header-actions" />
{/* the page's control — Pulpit's calendar */}
<QuickAddButton client:load mode="desktop" promoted={promotedAction} />
```

Measured on Pulpit at 1280 and 1440: `field@w520 → calendar@w38 → quick-add@w102`, gaps 12.
Below `1150` the field shrinks off its 520 (`max-w-full` inside a `min-w-0` cluster) rather
than pushing the cluster out — 461px at 1150, 366px at 1024, 300px at 768. See known delta 3.

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
`GlobalSearch.tsx:315`, no change needed.

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
- **D10** (this contract's D10 = **tab-bar density**; NOT the same D10 as
  `context/archive/2026-08-21-staff-quick-actions/design-contract.md`, which is "no quick-add on
  task screens" — do not merge the two) → **rewritten 2026-08-26 at the S-12b merge, and the
  `deviation(density)` is retired.**

  What this line used to say: with the magnifier gone the admin pill was back to **7** entries,
  which the original sizing (`size-10` + `gap-1` + `p-1.5`) already fits at the 360px floor
  (40·7 + 4·6 + 12 = **316px**) — so the `sm`-down tightening (`size-9` + `gap-0.5` + `p-1`)
  was **kept as headroom** for S-11's "Profil" tab, which would take the pill to 8 entries =
  exactly **360px**, the floor with zero margin.

  Both halves of that rationale are now spent:
  1. **S-11 has landed.** Profil is the eighth tab, so the headroom is no longer speculative —
     it is being used, and there is nothing left to reserve.
  2. **S-13 appends no ninth tab.** Search is reached from Pulpit's hero magnifier and ⌘K
     only, never from the global nav (an icon inherits its container's scope, so a magnifier in
     the tab bar would promise global search from a screen that cannot serve it). The "ninth"
     the pill was being braced for never comes.

  So the app takes **main's** solution wholesale and drops the `sm`-down tightening entirely:
  keep every item at its full `size-10 shrink-0` hit target, cap the pill at
  `max-w-[calc(100vw-24px)]`, and let it **scroll** rather than shrink — the same idiom as
  `FleetTypeScroll`'s dark pill. `size-9…sm:size-10` → `size-10 shrink-0`,
  `gap-0.5 sm:gap-1` → `gap-1`, `p-1 sm:p-1.5` → `p-1.5`, plus `overflow-x-auto` with
  `[scrollbar-width:none]` / `[&::-webkit-scrollbar]:hidden`.

  One fix on top of main's version: its Profil tab carried no `shrink-0`, which made it the
  pill's **only** shrinkable child — flexbox handed it the entire 24px overflow and it
  collapsed to a 16px hit target at 360px. `shrink-0` added.

  Measured at 360×740 as an admin: 8 items, every one **40×40**, pill `336px` wide sitting at
  `left 12 / right 348` (inside the viewport, no clip), `scrollWidth 360 > clientWidth 336`
  with `overflow-x: auto`, and the last item (Profil) fully reachable by scrolling. `exact` —
  the pill now matches `shared.jsx` `TabBar`'s own sizing at every width.

- **D13**, **D14** → **deleted** with the results page.

Amended from the S-12b contract (`context/archive/2026-08-21-staff-quick-actions/`) — recorded
here because this is the change that lands the merged hero, not there:

- **S-12b D8** (`deviation(reach)`, mobile Pulpit quick-add) → **no longer holds; now
  `exact`.** Its premise was "the design OMITS the affordance on `ScreenWorkerDash` because
  `Dyspozytornia` (273px, unbreakable, at `fontSize: 40`) already clips its avatar at 390px —
  our title is `Pulpit`, so the constraint does not transfer; we add the circle." Re-pulled
  2026-08-26: `ScreenWorkerDash` now draws `<QuickAddButton mode="mobile" />` itself, between
  the magnifier and the avatar. The design no longer omits it, so there is nothing left to
  deviate from — see §A. D8's hard success criterion (the 360px fit) still stands and still
  passes at 148px of cluster.

New:

- **N1** `deviation(scope)` → **retired 2026-08-26.** It read "QuickAddButton is not rendered
  beside the field — it belongs to S-12 (`manual-reservation`, sibling branch), not this
  change." S-12b has merged, so the pill is now the band cluster's unconditional last child and
  §B is shipped exactly. Nothing is out of scope any more.
- **N2** `deviation(platform)` — the island stays mounted on all staff pages while the field
  renders on one. The design has no notion of mounting; this is what keeps ⌘K and the mobile
  overlay alive off-Pulpit. **Still live, and load-bearing.** Post-merge the mount is the
  `showHeader={false}` else-branch of `StaffShell`'s band ternary, so it covers 12 pages, not
  10 (S-11 added `/dashboard/account` and `/dashboard/account/password`). Collapsing that
  ternary to a bare `showHeader && …` would unmount the island on `protocols/[id]`,
  `vehicles/new` and `vehicles/[id]/edit` — killing ⌘K on the first and the mobile overlay on
  all three — and would fail silently: no type error, no failing test.
- **N4** `deviation(no-design-state)` — `/dashboard/account/password` passes
  `searchHotkey={false}` (owner decision, 2026-08-26). It is a form sub-screen reached only
  from inside Profil, so S-13's own rule — "reached from the menu" keeps ⌘K, "reached from
  inside a screen and holds a form" does not — puts it with the two vehicle-form screens. It
  differs from them in keeping a normal shell header (and therefore the quick-add pill),
  because unlike them it draws no header of its own. The design has no drawn state for either
  account screen.
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

3. **Pulpit's greeting wraps to two lines between `768` and ~`1150`.** Found while verifying
   the S-12b merge (2026-08-26), measured as an admin on `/dashboard`:

   | viewport | field | title                              |
   | -------- | ----- | ---------------------------------- |
   | `768`    | `300` | `Dzień dobry, Admin` — **2 lines** |
   | `900`    | `399` | **2 lines**                        |
   | `1024`   | `366` | **2 lines**                        |
   | `1150`   | `461` | 1 line                             |
   | `1229`+  | `520` | 1 line                             |

   The band's right cluster wants `684px` at rest (520 + 12 + 38 + 12 + 102); at `1024` the
   content column is `720px` after `px-8`, so the title is left ~24px and wraps. The field
   already shrinks as far as it can — the cluster is `min-w-0` on both sides and the field is
   `max-w-full`, which is what keeps the calendar and pill at full size instead.

   **Not introduced by the merge, and not a merge regression to undo.** The field alone already
   wrapped the greeting below ~`1115`; main's quick-add pill (102 + 12) widens the affected
   range to ~`1150`. `StaffTopbar` is drawn at desktop width only, so the design has no state
   for this. Deliberately NOT fixed here — the plausible fixes (a `md`/`lg` step-down on the
   field's `520`, or `truncate` on the title) both change values the contract marks `exact`,
   which is a design decision, not a merge one.

   Every other staff page is unaffected: their titles are short (`Pracownicy`, `Kalendarz`,
   `Zwroty`) and only Pulpit passes `search`.

Items 1 and 2 are cheap to fold into Phase 4 if you want them fixed — say so and I will add
them. Item 3 needs an owner decision on which `exact` value gives way.

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
