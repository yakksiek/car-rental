# Design Contract — Staff Pulpit → Dispatch Cockpit

Exact-value spec for `/dashboard` (desktop + mobile). Every line is `exact` or
`deviation(reason)`. **Values transcribed from the live Claude Design JSX**
(`staff-desktop.jsx` → `ScreenStaffDash`/`DashStat`/`StaffTopbar`; `staff-screens.jsx`
→ `ScreenWorkerDash`/`Section`/`ActionRow`; pulled via DesignSync 2026-07-26) — the
vision-diff gate at implement time **verifies** these values, it no longer tunes them.
**Build against the live tokens in `src/styles/global.css`; never import from
`context/foundation/design/`. Polish copy is canonical.**

Canonical mockups: `design-review/target-staff-desktop-dashboard.jpg` (desktop **v4,
2026-07-26** — group-header times removed at source, band tint `#E6EAF0`),
`design-review/target-staff-mobile-dashboard.jpg` (mobile).

---

## Design Alignment Audit

### Freshness — repo designs vs canonical

| Repo design                                                                     | Role                      | Status                    | Action                                                                                                                                                                       |
| ------------------------------------------------------------------------------- | ------------------------- | ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `screenshots/09-staff-mobile-dashboard.png` (`design-system.md` catalog row 09) | Staff · mobile dashboard  | **outdated (superseded)** | Superseded by `design-review/target-staff-mobile-dashboard.jpg`. On ship: re-export the shipped surface to `context/foundation/design/screenshots/` + update catalog row 09. |
| `screenshots/20-staff-desktop-dashboard.jpg` (catalog row 20)                   | Staff · desktop dashboard | **outdated (superseded)** | Superseded by `design-review/target-staff-desktop-dashboard.jpg`. Update catalog row 20 on ship.                                                                             |
| Live JSX `staff-desktop.jsx` / `staff-screens.jsx` (Claude Design `352d78a6-…`) | Screen source             | **current**               | Source of the exact values below (`staff-desktop.jsx` pulled 2026-07-26; `staff-screens.jsx` re-pulled 2026-07-27 — §G tinted section panels + sampled done row).            |
| `src/styles/global.css` tokens                                                  | Design tokens             | **current**               | Reused as-is.                                                                                                                                                                |

### New-design quality gaps

- **Empty / quiet-day state** not shown in the mockups → defined here from the existing
  queue copy (`Brak wydań na dziś` etc.).
- **Loading state**: N/A — SSR page, one server-side `Promise.all`; no client fetch.
- **Breakpoints**: desktop (v3) + mobile provided ✓. No tablet mockup — the `md`–`lg`
  icon-rail sidebar is `StaffShell`'s existing behavior; the body uses the desktop
  layout from `lg`. Acceptable.
- **Mobile done-row state** now sampled for PICKUPS (2026-07-27 pull): the row dims to
  `opacity-60` and keeps its CTA. A done RETURN row is still unsampled (deviation 6).
- **Desktop overdue-open return** not sampled → adapted from the mobile danger CTA
  (deviation 9).
- **Copy**: mockups mix EN lang-keys with PL → **PL is canonical** (mapped below).

### Alignment — plan vs canonical

| Canonical surface                                                            | Plan phase | Status   |
| ---------------------------------------------------------------------------- | ---------- | -------- |
| Desktop: greeting header, 4 KPI cards, two-column schedule / need-a-decision | Phase 2    | mapped ✓ |
| Mobile: eyebrow+title+avatar header, filter chips, sections                  | Phase 3    | mapped ✓ |

Every canonical element maps to a phase; no phase contradicts the design; all
divergences are recorded as deviations below.

### Verdict

**Design Alignment Audit: PASS — 2 surfaces, 2 repo designs superseded, source JSX
pulled (exact values), 11 deviations recorded.**

---

## Token map (design → app)

| Design (JSX token)                 | App token                                                               |
| ---------------------------------- | ----------------------------------------------------------------------- |
| `accent` / `red` crimson `#B43638` | `--primary` → `bg-primary` / `text-primary` / `text-primary-foreground` |
| `redSoft`                          | `var(--flota-danger-soft)`                                              |
| `green` / `greenSoft`              | `bg-success` / `text-success` · `var(--flota-success-soft)`             |
| `amber` / `amberSoft`              | `text-warning` / `bg-warning` · `var(--flota-warning-soft)`             |
| `ink` `#0F172A`                    | `text-foreground` / `bg-foreground` (+ `text-background` on fills)      |
| `ink2`                             | `var(--flota-ink-2)`                                                    |
| `bg` `#F1F3F6`                     | `bg-background`                                                         |
| `card` white                       | `bg-card`                                                               |
| `hair` / `hair2` `#E3E7EC`         | `border-border`                                                         |
| `greySoft`                         | `var(--flota-neutral-soft)`                                             |
| `muted`                            | `text-muted-foreground`                                                 |
| `shadow1`                          | `shadow-card`                                                           |
| `mono`                             | `font-mono`                                                             |

## Screen inventory

| Mockup                                                                                     | App surface                                                                           |
| ------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------- |
| `design-review/target-staff-desktop-dashboard.jpg` + `staff-desktop.jsx` `ScreenStaffDash` | `/dashboard` desktop — `dashboard.astro` + `DispatchBoard` desktop branch             |
| `design-review/target-staff-mobile-dashboard.jpg` + `staff-screens.jsx` `ScreenWorkerDash` | `/dashboard` mobile — `dashboard.astro` mobile header + `DispatchBoard` mobile branch |

---

## §A · Desktop greeting header (`dashboard.astro`, `md:` up; `StaffShell showHeader={false}`)

- Band: `bg-card border-b border-border px-8 py-[22px] flex items-center justify-between` (JSX `padding: '22px 32px'`) — `exact`
- Greeting: `Dzień dobry, {imię}` · `text-[21px] font-bold tracking-[-0.5px] leading-[1.1] text-foreground` — `deviation(static greeting — not time-based; workerd UTC↔Europe/Warsaw hazard)`
- Subtitle: `Oto Twój dzień w oddziale Warszawa` · `mt-[3px] text-[13px] text-muted-foreground` — `deviation(depot name static "Warszawa"; no branch data model)`
- Calendar button → `/dashboard/calendar` · `size-[38px] rounded-[10px] border border-border bg-card flex items-center justify-center`, `Calendar` glyph `size-4 text-[var(--flota-ink-2)]` — `exact`
- Search field (JSX: 220×38, radius 10, `bg-background`, icon 15) · **omitted** — `deviation(search deferred — no backend)`
- Content area below: `p-8` (JSX `padding: 32`) — `exact`

## §B · Desktop KPI stat cards (`StatCards` = design `DashStat`, top of content)

- Row: `flex gap-4` (JSX `gap: 16`), each card `flex-1` — `exact`
- Each card is an `<a>`. Targets: Wydania → `/dashboard/pickups`; Zwroty → `/dashboard/returns`; Wnioski → `/dashboard/reservations`; Po terminie → `/dashboard/returns?filter=overdue` — `exact` (whole-card click; JSX tiles are static)
- Numbers = **day totals** — the row count of the view each card opens — `exact` (decision Q3 revised 2026-07-26: remaining-only reverted to day totals, matching the mockups and the `ReturnQueue` badge convention; "what's left" lives only in the schedule's progress label)
- Card box: `relative overflow-hidden min-h-[148px] rounded-[18px] pt-[18px] px-5 pb-4 shadow-card flex flex-col justify-between` — `exact`
- Cards 1–3 (`bg-card`), top accent bar: `absolute top-0 inset-x-0 h-1 opacity-90` — Wydania `bg-foreground`, Zwroty `bg-success`, Wnioski `bg-warning` — `exact`
- Watermark glyph: `absolute -right-5 -bottom-[26px] size-32 opacity-[0.06] pointer-events-none`, tone color — Wydania `Key`, Zwroty `ArrowRight`, Wnioski `List` — `exact`
- Number: `text-[46px] font-[750] tracking-[-2px] leading-none tabular-nums`, tone color (Wydania `text-foreground`, Zwroty `text-success`, Wnioski `text-warning`) — `exact`
- Label: `mt-[7px] text-[14.5px] font-[650] tracking-[-0.2px] text-foreground` — `Wydania` / `Zwroty` / `Wnioski` — `exact`
- Sub-label: `mt-[3px] text-[10.5px] font-bold uppercase tracking-[0.5px] text-muted-foreground` — `DZIŚ` / `DZIŚ` / `OCZEKUJĄCE` — `exact`
- Card 4 (Po terminie, urgent): `bg-primary` **no top bar**, `shadow-[0_10px_26px_var(--flota-danger-soft)]`; number + label white; sub-label `text-white/70`; watermark `TriangleAlert size-32 text-white opacity-[0.18]` — `exact`
  - `PILNE` pill (next to sub-label, row `gap-2`): `inline-flex items-center gap-[5px] h-5 px-[9px] rounded-full bg-white/15 text-white text-[9.5px] font-bold uppercase tracking-[0.4px]` + `size-[5px] rounded-full bg-white` dot — `exact`

## §C · Today's Schedule (`DispatchSchedule`; desktop left column — one unified card)

- Column title above card: `HARMONOGRAM NA DZIŚ` · `mb-3 text-[13px] font-bold uppercase tracking-[0.4px] text-muted-foreground` — `exact`
- Card: `rounded-[18px] bg-card shadow-card overflow-hidden` — **one card for both groups**, rows divided by hairlines (NOT per-row cards) — `exact`
- Group header band: `flex items-center justify-between bg-[#E6EAF0] px-5 pt-3 pb-2.5 border-b border-border` (+ `border-t` on the second group; the `#E6EAF0` band tint is a deliberate one-off in the JSX — darker than `bg-background` so the band reads inside the white card) — `exact`
  - Left: `flex items-center gap-2` — `size-[7px] rounded-full` dot (Wydania `bg-foreground`, Zwroty `bg-success`) + `text-[11.5px] font-bold uppercase tracking-[0.4px] text-[var(--flota-ink-2)]` label `WYDANIA` / `ZWROTY` — `exact` (design updated 2026-07-26: depot hours removed at source)
  - Right: `text-[11.5px] font-[650] text-muted-foreground` = `{done} z {total} zakończone` — `exact`
- Row (`<a>`): `flex items-center gap-4 px-5 py-3.5 border-b border-border last:border-b-0 hover:bg-background transition-colors`; done rows are NOT dimmed and sink below a `ZAKOŃCZONE` divider — `deviation(14 — see register)` (whole-row link is `deviation(interaction — decision Q2; JSX rows are static with a button)`)
  - Status circle: `size-6 rounded-full shrink-0` — open: `border-[1.5px] border-border`; done: `bg-success flex items-center justify-center` + `Check size-[13px] text-white` — `exact`
  - Vehicle box: `w-[70px] h-11 rounded-[9px] bg-background flex items-center justify-center shrink-0` + `Truck size-5 text-muted-foreground` — `deviation(generic glyph — RPC returns no vehicle type/photo; JSX draws a per-type Silhouette w=62)`
  - Text: name `text-[14px] font-[650] tracking-[-0.2px] text-foreground truncate`; sub `mt-0.5 text-[12px] text-muted-foreground truncate` = `{make} {model} · ` + `font-mono` `{reference}` — `exact`
  - Open CTA: `Protokół` + `ChevronRight size-[13px] text-[var(--flota-ink-2)]` in `h-[34px] px-3.5 rounded-[9px] border border-border bg-card text-[12.5px] font-[650] text-foreground inline-flex items-center gap-1.5` — `exact` (both groups use `Protokół` on desktop, per v3)
  - Done: the quieter `Protokół` + `ChevronRight size-[13px]` in `h-[34px] px-3.5 rounded-[9px] border border-border bg-background` (same shape as the open CTA, `bg-background` instead of `bg-card`) — `deviation(14 — see register)`
  - Link target — open pickup → `/dashboard/pickups/{reservation_id}`; open return → `/dashboard/returns/{reservation_id}`; done → `/dashboard/protocols/{protocol_id | return_protocol_id}` — `exact` (decision Q2)
  - Overdue-open return: CTA slot shows the mobile danger chip `Po terminie` (`h-8 px-3 rounded-[10px] bg-[var(--flota-danger-soft)] text-primary text-[12px] font-[650]`), still linking to the return flow — `deviation(desktop overdue not sampled; adapted from mobile ActionRow danger CTA)`

## §D · Need-a-decision rail (desktop right column; reuse `NeedDecisionPanel`)

- Grid: `lg:grid-cols-[1.5fr_1fr] gap-5 mt-6` (JSX `'1.5fr 1fr', gap: 20, marginTop: 24`) — `exact`
- Column header: `WYMAGA DECYZJI` `text-[13px] font-bold uppercase tracking-[0.4px] text-muted-foreground` + right `Otwórz →` `text-[12px] font-[650] text-primary`, `mb-3` — `exact` (matches NeedDecisionPanel's existing header)
- Cards (JSX): `rounded-[16px] p-4 shadow-card`, gap 12; id `font-mono text-[11px]`; name `text-[14.5px] font-[650]`; buttons `h-9 rounded-[10px]`, reject `flex-1` red-text outline, approve `flex-[1.6] bg-foreground text-white` — `deviation(NeedDecisionPanel reused as-is: h-10 buttons, its own date/price line; kept for one decision mechanism)`

## §E · Mobile header (`dashboard.astro`, `md:hidden`)

- Layout: `flex items-start justify-between` — `exact`
- Eyebrow: `text-[12px] font-semibold uppercase tracking-[0.3px] text-muted-foreground` = `PT · 25 LIPCA` (via `pl-date`) — `exact`
- Title: `mt-1 text-[40px] leading-none font-bold tracking-[-1px] text-foreground` = `Pulpit` — `exact`
- Avatar: `size-11 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-[16px] font-medium tracking-[0.4px] shadow-accent` initials (via `staffIdentity`; JSX shadow `0 4px 14px rgba(180,54,56,0.30)` ≈ `shadow-accent`) — `exact`
- Search icon-button (JSX: `size-11 rounded-full bg-card border border-border shadow-card`, icon 19) · **omitted** — `deviation(search deferred)`
- Email subtitle line · **removed** — `exact` (mockup has no subtitle)

## §F · Mobile filter chips (`DispatchBoard` mobile branch; JSX KPI row)

- Row: `flex flex-wrap gap-2 mt-4` — `exact`
- Chip: `inline-flex items-center gap-[7px] h-[38px] px-3.5 rounded-full text-[13px] font-[650] whitespace-nowrap` — unselected: `bg-card text-foreground border border-border`; selected: tone fill + white text — `exact`
- **Per-chip selected fills** (JSX): `Wszystko` → `bg-foreground`; `Wydania` → `bg-primary`; `Zwroty` → `bg-foreground`; `Wnioski` → `bg-warning` — `exact`
- Count badge: `min-w-[19px] h-[19px] rounded-full px-[5px] flex items-center justify-center text-[10.5px] font-bold` — selected: `bg-white/24 text-white`; unselected: `bg-[var(--flota-neutral-soft)] text-muted-foreground` — `exact`
- Badge values = **day totals** — `exact` (decision Q3 revised 2026-07-26; JSX All 7 = 3+2+2, same semantics)
- Single-select; `wszystko` default; selection mirrors to `?section` via `history.replaceState`; `initialSection` parsed server-side (no hydration flash; mirrors `ReturnQueue.tsx:443-452` / `returns.astro:34`) — `deviation(interaction — chips are functional filters, decision Q4; JSX chips are static)`

## §G · Mobile sections (`DispatchBoard` mobile branch; JSX `Section` + `ActionRow`)

**Re-pulled 2026-07-27** — the source moved each section into a tinted panel and
sampled the done row; values below are from that pull.

- Visible sections per active chip: `wszystko` → all three; else only the matching one — decision Q4
- **Section panel** (JSX `Section`): `mb-4 rounded-[18px] px-2 pt-2.5 pb-1` (JSX `margin: '0 16px 16px'`, `padding: '10px 8px 4px'`) + a tint — Wydania `bg-[#E4E6EA]`, Zwroty `bg-[#E2EAE3]`, Wnioski `bg-[#EFE9DD]`. The three tints are deliberate JSX one-offs, like the desktop band's `#E6EAF0` — `exact`. The JSX `0 16px` side margin IS the page gutter, already supplied by `main`'s `px-4`, so the panel adds none.
- **Section header, inside the panel**: `mx-1.5 mb-2.5 px-1.5 flex items-center gap-2 text-[13px] font-extrabold tracking-[0.4px] uppercase text-foreground` (JSX `margin: '0 6px 10px'`, `padding: '0 6px'`, `fontWeight: 800`, `color: ink`) + leading icon `size-3.5` (`Key` / `ArrowDown` / `Bell`) = `WYDANIA · {total}` / `ZWROTY · {total}` / `WNIOSKI · {total}` — `exact`. Rows wrapper `px-1` (JSX `padding: '0 4px'`) — `exact`.
  - Wnioski header carries a right-aligned `Otwórz →` link — `deviation(kept from NeedDecisionPanel's own header, which the panel suppresses here; the JSX band has no action)`
- Row card (`ActionRow`): `flex items-center gap-3 rounded-[16px] bg-card shadow-card px-3.5 py-3 mb-2` (JSX `padding: '12px 14px'`, `marginBottom: 8`, `gap: 12`) — `exact`
  - Leading slot: JSX has no time column any more — a `size-[30px]` status circle, `border-2 border-border` when open, `bg-success` + `Check size-[14px]` when done — `exact` (the time column and its divider are gone at source; our earlier circle adaptation is now canon, closing deviation 1)
  - Text: name `text-[14px] font-[650] tracking-[-0.2px] leading-[1.15] text-foreground`; sub `mt-0.5 text-[12px] text-muted-foreground truncate` = `{make} {model} · {reference}` — `exact` (JSX sub shows plate; ours shows mono reference — `deviation(consistency with desktop row + queue pages)`)
  - CTA button: `h-8 px-3 rounded-[10px] text-[12px] font-[650] shrink-0` — pickups: `Protokół` `bg-foreground text-background`; returns open: `Zwrot` `bg-background text-foreground border border-border`; returns overdue: `Po terminie` `bg-[var(--flota-danger-soft)] text-primary` — `exact`
  - Whole row is the link (same targets as §C) — `deviation(interaction — decision Q2)`
  - **Done row**: no dim; the row sinks below a `ZAKOŃCZONE` divider and keeps a real affordance — the **ghost `Protokół`** (`h-8 px-3 rounded-[10px] bg-background text-foreground border border-border`) opening the FILED protocol. Diverges from the JSX (`opacity: done ? 0.6 : 1`, interleaved order, `ctaStyle="primary"`) — `deviation(14 — see register)`
- Wnioski section = `NeedDecisionPanel` with `showHeader={false}` inside the amber panel (JSX pending card: `rounded-[16px] p-3.5 mb-2.5`, buttons `h-[38px] rounded-[10px]`, approve `flex-2`) — `deviation(NeedDecisionPanel reused as-is)`
- Empty states: Wydania `Brak wydań na dziś`; Zwroty `Brak zwrotów na dziś`; Wnioski = NeedDecisionPanel's own `Brak oczekujących wniosków` — `exact` (copy from queue pages; not sampled in mockup)

---

## Verbatim Polish copy

- Title: `Pulpit`
- Greeting / subtitle: `Dzień dobry, {imię}` · `Oto Twój dzień w oddziale Warszawa`
- KPI labels: `Wydania` · `Zwroty` · `Wnioski` · `Po terminie`
- KPI sub-labels: `DZIŚ` · `DZIŚ` · `OCZEKUJĄCE` · `DZIŚ`; pill `PILNE`
- Schedule column title: `HARMONOGRAM NA DZIŚ`
- Group / section headers: `WYDANIA` · `ZWROTY` · `WNIOSKI`
- Progress: `{n} z {m} zakończone`
- Row CTAs: `Protokół` (desktop both groups; mobile pickups) · `Zwrot` (mobile open return) · `Po terminie` (overdue return) · done: `Zakończone`
- Overdue detail: `{n} dni po terminie` (via `overdueDaysLabel`, where surfaced)
- Chips: `Wszystko` · `Wydania` · `Zwroty` · `Wnioski`
- Need-a-decision (existing): `Wymaga decyzji` · `Otwórz`
- Empty: `Brak wydań na dziś` · `Brak zwrotów na dziś` · `Brak oczekujących wniosków`

## Deviations register

1. ~~**Mobile per-row clock times dropped** (decision Q1)~~ — **CLOSED 2026-07-27**: the
   source itself dropped the `ActionRow` time column and divider in favour of a status
   circle, so our adaptation is now canon at both breakpoints.
2. **Search omitted** (deferred; no backend) — desktop 220×38 field + mobile 44px icon
   button both cut.
3. **Greeting static** `Dzień dobry` (not time-based) — workerd TZ hazard.
4. **Depot subtitle static** `Warszawa` (no branch model).
5. **Generic vehicle glyph** (`Truck`) in the 70×44 box — RPC returns no type/photo.
6. **Done-RETURN row CTA extrapolated** — the 2026-07-27 pull samples a done PICKUP
   (dim to `opacity-60`, keep `Protokół`), which we now follow exactly; the JSX returns
   fixture carries no `status`, so a done return keeps `Zwrot` by extrapolation.
7. **Copy PL canonical** (mockups mix EN lang-keys).
8. **`NeedDecisionPanel` reused near-as-is** — minor deltas vs JSX cards (h-10 vs
   h-9/h-[38px] buttons, its own date/price layout); kept for the one shared decision
   mechanism. One layout fix applied 2026-07-27: the estimated total moved off the
   customer-name row onto the right of the date/vehicle meta line — beside the name it
   read as a price ON the person, and a long Polish surname crowded the figure.
9. **Desktop overdue-open return adapted from mobile** (`Po terminie` danger chip in the
   CTA slot) — not sampled in the desktop mockup.
10. **Mobile Profile tab not added** (nav unchanged; deferred).
11. **Day-total counts** (decision Q3, revised 2026-07-26) — KPI numbers + chip badges are
    the row count of the view each opens, matching the mockups; the earlier remaining-only
    call was reverted. Whole-card/row/chip links and functional chips remain interaction
    additions over the static JSX (decisions Q2/Q4).
12. **Done rows sink to the bottom of their group under a `ZAKOŃCZONE` divider, and are
    NOT dimmed** (product decision 2026-07-27) — the source interleaves finished work in
    RPC order and de-emphasises it with `opacity` (mobile `0.6`, desktop `0.55`). An
    opacity treatment reads as DISABLED, but these rows are live links to the filed
    protocol, so the dim is dropped and position carries the meaning instead: open rows
    first, then a `text-[10.5px] font-bold uppercase tracking-[0.4px] text-muted-foreground`
    `ZAKOŃCZONE` label + hairline, then the finished block. The done row keeps an ACTION,
    not a status: a ghost `Protokół` opening the filed protocol at both breakpoints. A
    `Zakończone` status label there wasted the slot — the row already links to the
    protocol, and the filled check circle plus the divider state the outcome. Ghost
    rather than filled, so finished work does not compete with open work now the dim is
    gone. Ordering lives in `scheduleGroups`, so both breakpoints and any future
    consumer inherit it.
13. **Mobile `WNIOSKI` section header not stacked** — `NeedDecisionPanel` is reused as-is
    (deviation 8) and carries its own `Wymaga decyzji` + `Otwórz →` header, so §G's
    section header is not rendered a second time above it.
14. **Schedule row drops its CTA below at a narrow column** — under a **500px card
    width** the row becomes `flex-wrap` and the affordance (`Protokół` / `Zakończone` /
    `Po terminie`) moves to its own right-aligned line, so the customer name stops
    colliding with it between `lg` and ~1157px viewport. Driven by `@container` +
    `@min-[500px]:` on the card, NOT a viewport breakpoint — the panel is sized by the
    `1.5fr` column (embeddable-panels lesson + the plan's container-width guardrail).
    At the design's canonical 1440px width the row renders exactly as §C specifies.
