# Design change request — global search: drop the dedicated results page

> **Status: APPLIED.** Items 1–12 landed in `search-flow.jsx`. The `[OPTIONAL]` block and
> a follow-up field-state fix were then written **directly** via `DesignSync`
> (`finalize_plan` → `write_files`) — no pasting needed, see [[designsync-direct-write]].
> Kept as the record of _what_ changed and why.
>
> Follow-up edits pushed after the first round:
>
> - `staff-desktop.jsx` — `StaffTopbar({ …, searchQuery = '', searchFocused = false })`
>   forwarded to `SearchField`. Item 11 had made the scaffold reuse `StaffTopbar`, which
>   hardcoded `query="" focused={false}` — so all three desktop states drew an empty,
>   unfocused field above a populated panel. Not a spec problem (`SearchField` still
>   carries every focused/query value), but it would have false-flagged our correct
>   render at the vision-diff gate.
> - `search-flow.jsx` — `SearchTopbarScaffold({ query, phase, focused })` forwards both;
>   all three `ScreenSearch*` states pass `focused`.
> - `[OPTIONAL]` applied: `Ostatnie wyszukiwania` + divider + `recent` key removed from
>   both resting states (retires `D2`); `CustomerRow`, `Avatar`, `customers` key removed
>   (retires `D1`).

---

Paste-text form of the original request (superseded by the direct write):

---

Please update `search-flow.jsx` in this project. Only that file.

**The decision.** Global search becomes a **Pulpit-only, dropdown-only** feature. There is
no dedicated results screen and no results URL. Everything happens in the dropdown
(desktop) and the full-screen search view (mobile): the user types, the grouped list
grows, they **scroll** it, and clicking — or pressing `↵` on — a row jumps straight to
that item. "See all results" ceases to exist as a destination.

**Context — two sibling changes already in this project.** Don't re-do them; they're the
world this edit lands in.

- `staff-desktop.jsx` — `StaffTopbar({ title, sub, search = false })`. Only
  `ScreenStaffDash` passes `search`. No other staff screen has a search affordance.
- `staff-screens.jsx` — `ScreenWorkerDash` keeps its `44×44 / borderRadius 99 /
background tokens.card / 1px solid tokens.hair / boxShadow tokens.shadow1` button with
  `Icon.search s={19} c={tokens.ink}`, `gap: 10` to the left of the avatar. That is the
  sole mobile entry point, and its `TabBar` has no search entry.

## Remove

1. **`ScreenSearchResultsPage`** — the entire desktop results page.
2. **`ScreenSearchMobilePage`** — the entire mobile results page.
3. **`ResultSection`** and **`SectionLabel`** — helpers used only by those two screens.
4. **The `showEnter` branch of `PanelFooter`** — the accent line
   `Zobacz wszystkie wyniki "{q}" · {n}` with its `Icon.arrowRight`. The footer now shows
   the keyboard hints in **every** phase: `↑ ↓ nawigacja · ↵ otwórz` on the left,
   `esc zamknij` on the right. Drop the `showEnter` / `query` / `total` props, and the
   call site in `SearchPanel`'s `results` phase that passes them.
5. **In `ScreenSearchMobileLive`** — the full-width ink button
   `Zobacz wszystkie wyniki · {n}` (`height 48`, `borderRadius 12`) and its
   `padding: '4px 16px 24px'` wrapper. The mobile results list simply ends.
6. **From `Object.assign(window, …)`** — `ScreenSearchResultsPage`, `ScreenSearchMobilePage`.
7. **Now-dead copy in `useSX`** — `seeAll`, `enterHint`, `resultsFor`, `resultCount`,
   `everything`.
8. _Optional:_ `BigCustomerCard`, already unreferenced.

## Change

9. **The results list must scroll, not clip.** In `SearchPanel`'s `results` phase the
   wrapper is `{ maxHeight: 460, overflow: 'hidden' }`. With the "see all" escape hatch
   gone, clipping would silently hide matches with no way to reach them. Make it
   `{ maxHeight: 460, overflowY: 'auto' }` and draw the state with **enough rows that it
   actually scrolls** — leave a partially-visible row at the bottom edge so the
   affordance is legible in the mock.

10. **Draw the `Pojazdy` group — it has never been designed.** `SEARCH_DATA.vehicles` is
    `[]`, so the group label appears in copy but no vehicle row exists anywhere in the
    file. Populate it (3–4 vehicles) and render a `VehicleRow` in both `SearchPanel`'s
    `results` phase and `ScreenSearchMobileLive`, consistent with `ReservationRow` /
    `ReturnRow`:
    - `VThumb` at `58×40`, `borderRadius 10`
    - name at `fontSize 13.5 / fontWeight 600`, wrapped in `<Highlight>`
    - make + model on a `fontSize 12` muted line
    - plate in `tokens.mono`
    - trailing `Icon.chevR s={16} c={tokens.muted}`

11. **One drawing of the Pulpit topbar, not two.** `SearchTopbarScaffold` hand-rolls its
    own bar — `justifyContent: 'flex-end'`, no title, and a `44×44 / borderRadius 12`
    calendar button — while `StaffTopbar` in `staff-desktop.jsx` (the real one, now that
    it owns `search`) has title + sub on the left and a `38×38 / borderRadius 10` calendar
    button plus `QuickAddButton` on the right. The same bar is drawn two incompatible
    ways. Reconcile: have `SearchTopbarScaffold` render
    `<StaffTopbar title={t.goodMorning} sub={t.todayOverview} search />` and anchor the
    panel under that field.

12. **Update the file header comment.** It reads _"press Enter → full results page"_ and
    lists `full page` among the states. Both are now wrong. The states are:
    `resting (jumps) · typing (grouped) · no results · ⌘K`.

## Keep unchanged

- `SearchField` at `width={520}` — `height 44`, `borderRadius 12`, `1.5px` border, focus
  ring `0 0 0 4px rgba(15,23,42,0.06)`, `⌘` `K` chips, clear-X. Now used only by the
  Pulpit topbar; the `width={420}` call site disappears with the results page.
- `SearchPanel` shell — `520` wide, `borderRadius 16`, `tokens.card`, `1px tokens.hair`,
  shadow `0 4px 12px rgba(15,23,42,0.08), 0 24px 60px rgba(15,23,42,0.16)`.
- `GroupHeader`, `RowShell`, `ReservationRow`, `ReturnRow`, `Pill`, `Highlight`,
  `EnterChip`, `Kbd`, `VThumb`.
- The **resting** and **no-results** phases, and all three mobile states
  (`MobileSearchShell` + resting / live / no-results), minus the button removed in (5).
- Every Polish copy string that survives the deletions.

## Explicitly do not

- **Do not move the filter chips into the dropdown.** `Wszystko / Rezerwacje / Zwroty /
Pojazdy` belonged to the deleted results page. Group headers plus scrolling replace
  them.
- **Do not draw a truncation state.** There is no "showing 8 of 40" and no per-group cap
  — the panel shows every match for the query and scrolls.
- **Do not add a search affordance to any other screen**, and do not put one back in the
  mobile `TabBar`.

## [OPTIONAL — delete this block if you don't want these]

Two existing gaps between the mock and the shipped product. They are not consequences of
this change; include them only if the product decisions still hold.

- **Drop the `Klienci` group** (`CustomerRow`, and `Avatar` where rows use it). The app
  has no customer entity and no customer page, so the group is omitted in code. A
  customer's name or email still matches inside `Rezerwacje`.
- **Drop `Ostatnie wyszukiwania`** from the resting phase, along with its divider and the
  `recent` key in `useSX`. The app ships quick-jumps only, because caching searched
  customer names in `localStorage` on a shared depot terminal is a privacy problem.
