# Design Contract — Overdue Returns (S-07)

> **Canonical screenshots present** (`design-review/*.jpg`, 8 states). **Copy note:**
> the artboards were exported with the **EN** toggle — they are **layout/spacing
> reference only**; the **Polish strings in this contract are canonical** (user
> decision 2026-07-23). Exact values pulled from shipped code are `exact`; values
> read off the JPGs are `provisional(screenshot)` — resolve to single px/token values
> at `/10x-implement` (pull JSX via `DesignSync` if the "Rental car company" project
> still has it; missing source = invention).

## Design Alignment Audit

### 1. Canonical screenshots — capture status: ✅ CAPTURED (EN-reference)

| State                           | File                                        | Notes                                                                       |
| ------------------------------- | ------------------------------------------- | --------------------------------------------------------------------------- |
| Desktop · has overdue           | `returns-desktop-has-overdue.jpg`           | filter bar + rows (O1)                                                      |
| Desktop · overdue filter active | `returns-desktop-overdue-filter-active.jpg` | `Overdue` segment crimson-filled, `Overdue · 2` header, 2 overdue rows (O2) |
| Desktop · no overdue (healthy)  | `returns-desktop-no-overdue.jpg`            | overdue filter active, `Overdue · 0`, green-check empty (O3)                |
| Desktop · empty worklist        | `returns-desktop-empty.jpg`                 | whole list empty — **filter bar hidden**, down-arrow card (O4)              |
| Mobile · has overdue            | `returns-mobile-has-overdue.jpg`            | 4-pill scroll, `Wszystkie` selected (O5)                                    |
| Mobile · overdue filter active  | `returns-mobile-overdue-filter-active.jpg`  | `Po terminie` selected crimson (O6)                                         |
| Mobile · no overdue (healthy)   | `returns-mobile-no-overdue.jpg`             | green-check empty-overdue (O7)                                              |
| Mobile · empty (whole list)     | `returns-mobile-empty.jpg`                  | down-arrow empty (O8)                                                       |

**Gaps (missing artboards):** **`Na dziś` and `Zwrócono` selected-pill states**;
inactive-Returns mobile tab with the overdue **dot**; desktop sidebar with Returns
**not** active showing the danger pill. These are `provisional` below. (Desktop
overdue-filter-active _with rows_ (O2) and desktop empty-worklist (O4) now captured.)

### 2. Freshness audit — repo designs vs canonical

| Repo design                                           | Classification       | Action                                                                                                |
| ----------------------------------------------------- | -------------------- | ----------------------------------------------------------------------------------------------------- |
| `design-system.md` row 18 (`18-…overdue-returns.png`) | **superseded**       | dedicated page + penalty/extend — not the direction. Update catalog row to "fold into Zwroty (S-07)". |
| `design-system.md` row 24 (`24-…overdue-returns.jpg`) | **superseded**       | same, mobile. Update catalog row.                                                                     |
| Shipped Zwroty (`ReturnQueue`/`StaffShell`)           | **current baseline** | preserve header, rows, mobile tab bar; the **stat area is restructured** (see §B).                    |
| `pendingCount` badge (Wnioski)                        | **current**          | mirror for the sidebar pill / inactive-tab dot.                                                       |

### 3. Quality audit — the new designs (scope resolutions, 2026-07-23)

The EN artboards include elements outside FR-012; resolved with the user:

- **`Call` action** — **KEEP** as a plain `tel:` link (design-brief §4). Requires
  `customer_phone` added to `list_returns_today` (data-layer change). No logging.
- **Header search bar + calendar icon** — **CUT** (out of scope, new logic).
- **Trend sparkline** — **CUT** (no data source; out of flag-only S-07).
- **Sidebar nav labels/set** (EN, 4 items, `Dispatch`, missing `Wydania`/`Flota`) —
  **reference-only**; the app keeps its 6 Polish nav items, only the badge is added.

### 4. Alignment checklist — plan phases ↔ surfaces

| Canonical surface                                                                   | Phase | Aligned?           |
| ----------------------------------------------------------------------------------- | ----- | ------------------ |
| Zwroty nav badge (desktop pill · mobile dot/count)                                  | 1     | ✅                 |
| `customer_phone` for the Call link                                                  | 1     | ✅ (added to plan) |
| Filter bar (desktop unified · mobile 4-pill scroll) + selected states + live header | 2     | ✅                 |
| Empty-overdue + whole-list-empty states                                             | 2     | ✅                 |
| Overdue-row restyle: `PO TERMINIE` eyebrow + `⚠ N dni po terminie` pill             | 3     | ✅                 |
| Call `tel:` button (overdue rows)                                                   | 3     | ✅ (added to plan) |
| Overdue-first ordering                                                              | 3     | ✅ (added to plan) |

### 5. Verdict

**PASS (conditional)** — 8 surfaces captured, 2 repo designs superseded, scope
reconciled (Call in as `tel:`; search + sparkline out; mobile = 4 pills). Deviations
recorded below. **Conditions before/at implement:** EN copy is reference-only (use
the Polish strings here); resolve the `provisional` values (ideally via `DesignSync`
JSX); the rendered vision-diff at `/10x-implement` compares **layout/spacing** against
these shots and **copy** against this contract.

---

## Token map (design → app token)

| Design                   | App token                                         | Used for                                                    |
| ------------------------ | ------------------------------------------------- | ----------------------------------------------------------- |
| Crimson `#B43638`        | `text-primary` / `bg-primary`                     | overdue accents, selected `Po terminie`, CTAs, danger badge |
| Crimson soft `#FBE4E1`   | `bg-[var(--flota-danger-soft)]`                   | overdue row tint, days pill, badge                          |
| Navy ink `#0F172A`       | `text-foreground` / `bg-foreground`               | text; **selected `Wszystkie` pill fill**                    |
| Success `#1B9E5A` / soft | `text-success` / `bg-[var(--flota-success-soft)]` | `Zwrócono`; empty-overdue check                             |
| Neutral soft             | `bg-[var(--flota-neutral-soft)]`                  | `Na dziś`; count badges                                     |
| Cool grey `#F1F3F6`      | `bg-background`                                   | app bg                                                      |
| White card               | `bg-card` + `shadow-card`                         | filter bar, rows, pills                                     |
| Muted                    | `text-muted-foreground`                           | captions, eyebrows                                          |
| Hairline `#E3E7EC`       | `border-border` / `divide-border`                 | dividers                                                    |

## Surface A — "Zwroty" nav badge (`StaffShell.astro`)

- **Sidebar (md+) count pill** — `exact` (mirror Wnioski `:76-85`): `ml-auto flex
h-[18px] min-w-[18px] items-center justify-center rounded-full px-1.5 text-[10.5px]
font-bold`; danger `text-primary bg-[var(--flota-danger-soft)]` (Returns inactive) /
  `text-background bg-white/20` (Returns active). Shown only when `overdueCount > 0`.
- **Mobile tab — inactive** — `exact` (mirror Wnioski dot `:148-150`): danger dot
  `absolute top-1 right-1.5 size-2 rounded-full ring-2 ring-[#0A0A0F]`, fill
  `bg-primary`. Shown when `overdueCount > 0` and tab not active.
- **Mobile tab — active/expanded** — `deviation(design)`: a crimson count pill after
  the label (`bg-primary text-primary-foreground`, `h-[18px] min-w-[18px] rounded-full
px-1.5 text-[10.5px] font-bold`). Returns-only; **Wnioski unchanged** (it shows no
  count when active). `provisional(screenshot)` sizing.
- **Nav href** — `deviation(deep-link)`: `/dashboard/returns` →
  `/dashboard/returns?filter=overdue` when `overdueCount > 0`.
- **Copy** (canonical): nav label `Zwroty`. (Mockup `Returns` = reference.)

## Surface B — Stat area → filter bar (`ReturnQueue.tsx`)

**Replaces** the shipped 3-`StatCard` grid (`:159-163`) and 2-`StatPill` mobile block
(`:155-158`).

### Desktop (≥ sm) — unified filter bar

- Container: white bar `rounded-[18px] bg-card shadow-card` with `flex items-center`
  padding `p-3`. `provisional(screenshot)`.
- **Leading total chip:** big `N` `text-[28px] font-bold tabular-nums` + `dziś`
  `text-[12px] text-muted-foreground`, in a light inset chip. `N` = total rows.
  Non-interactive summary (clear = re-click active segment). `provisional(screenshot)`.
- Vertical divider `h-8 w-px bg-border`. `provisional`.
- **Three segments** (buttons): `Na dziś` (neutral) · `Po terminie` (danger) ·
  `Zwrócono` (success). Each: label `text-[14px] font-[650]` + count badge
  `rounded-full px-2 text-[12px]`. Counts stay live (from all rows).
- **Selected segment:** solid fill in its tone — `Po terminie` →
  `bg-primary text-primary-foreground rounded-full px-4 py-1.5` (`exact` intent from
  O3). `Na dziś`/`Zwrócono` selected → `provisional(inferred)` (tone-solid: navy /
  success). **No sparkline, no search.**

### Mobile (< sm) — 4-pill horizontal scroll

- Row: `flex gap-2 overflow-x-auto` (hidden scrollbar), 4 pills in order:
  **`Wszystkie N` · `Na dziś N` · `Po terminie N` · `Zwrócono N`**.
- Pill: `rounded-full px-4 py-2 text-[13px] font-[650]` + inner count badge
  `rounded-full px-1.5 text-[11px]`. Unselected `bg-card shadow-card text-foreground`.
- **Selected:** `Wszystkie` → `bg-foreground text-background` (navy, `exact` from O5);
  `Po terminie` → `bg-primary text-primary-foreground` (crimson, `exact` from O6);
  `Na dziś` / `Zwrócono` selected → `provisional(inferred)` (navy / success).

### List header (both) — `exact` copy

`{Filtr} · {N}` above the list: default **`Wszystkie zwroty · N`**; filtered
**`Na dziś · N`** / **`Po terminie · N`** / **`Zwrócono · N`**. Style
`text-[14px] font-[650]` + muted count. `provisional(screenshot)` for exact spacing.

### Interaction — `exact` (decided)

Click a segment/pill → filter; click the active one → clear to `Wszystkie` (seeded
from `?filter`, synced via `history.replaceState`). Desktop 3 segments, mobile 4 pills.

## Surface C — Overdue row + days-overdue + Call (`ReturnQueue.tsx`)

- **Row treatment** — `exact` (`:196-210`): overdue-open row has 3px red left accent
  (`border-l-primary border-l-[3px]`) + desktop red-soft tint
  (`sm:bg-[var(--flota-danger-soft)]`); mobile card white.
- **Days-overdue** — supersedes the plain `Po terminie` badge:
  - Eyebrow **`PO TERMINIE`** — `text-[11px] font-bold uppercase tracking-[0.08em]
text-muted-foreground`. `provisional(screenshot)`.
  - Indicator **`⚠ {formatDuration(n)} po terminie`** → `1 dzień po terminie` /
    `N dni po terminie`, with a `TriangleAlert size-3.5`. Mobile: red-soft pill
    `bg-[var(--flota-danger-soft)] text-primary rounded-[8px] px-2.5 py-1 text-[13px]
font-bold`. Desktop: plain `text-primary text-[13px] font-bold`, right cluster.
    `provisional(screenshot)`; `formatDuration` copy is `exact`.
- **Call button** — `Zadzwoń`, outline (`variant="outline" bg-card`), `Phone` icon,
  `h-9 rounded-[10px] text-[12.5px] font-[650]`, wired `<a href={`tel:${row.customer_phone}`}>`.
  **Overdue rows only** (absent on plain due rows per O1). `provisional(screenshot)`.
  (Mockup `Call` = reference; copy canonical `Zadzwoń`.)
- **Accept-return button** — `exact`, unchanged: `Przyjmij zwrot`, crimson primary,
  `rounded-[10px]` + `ChevronRight`. (Mockup `Accept return` = reference.)
- **Ordering** — `deviation(design)`: sort overdue → due → returned (client-side;
  the RPC orders by `reference`). Within a group, keep `reference` order.

## Surface D — Empty & returned states (`ReturnQueue.tsx`)

- **Overdue filter, 0 overdue** (O3/O7) — positive card: green-soft check chip
  (`bg-[var(--flota-success-soft)]` square, `Check text-success`), heading
  **`Brak zwrotów po terminie`**, sub **`Wszystkie pojazdy wróciły na czas.`**
  Card shell = shipped empty card (`:320-328`). Copy `exact`; layout
  `provisional(screenshot)`. (Mockup `Nothing overdue` / `Every rented vehicle is back
on time. Nice work.` = reference.)
- **`Na dziś` / `Zwrócono` filter, 0 matches** — `provisional`: neutral line
  `Brak pozycji dla tego filtra.`
- **Whole list empty** (O4 desktop / O8 mobile) — `exact`, unchanged: down-arrow chip,
  `Brak zwrotów na dziś` / `Gdy wynajęty pojazd będzie do zwrotu, pojawi się tutaj.`
  **The filter bar is hidden entirely** in this state (0 rows → the shipped
  `states.length === 0` early return renders only the empty card, before `Stats`).
- **Returned rows** — `exact`, unchanged: `Dostarczono` badge / `Wyślij ponownie` /
  `Otwórz protokół`. (Mockup `Delivered` / `Email not sent` / `Resend` / `Open
protocol` = reference.)

## Constraints

- Copy is `pl-PL`, canonical — the Polish strings above win over the EN artboards.
- Reuse tokens/components (nav badge, `OverdueBadge`→days pill, `Button`, empty card).
- Exact values, not ranges — every `provisional` line resolves to one value at
  implement (prefer `DesignSync` JSX; else the shipped-code value + design scale).
- Mobile-first; mobile filter row scrolls horizontally; overdue badge = count when the
  tab is active, dot when inactive.
