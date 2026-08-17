# Export request — global-search PNGs after the dropdown-only rewrite

Send the block below to Claude in the Design app for project `Rental car company`
(`352d78a6-84fd-49a2-8b38-2fe289691fc3`). Rendering to PNG can't be driven through
`DesignSync` (it reads and writes files only), so this one has to be asked for.

---

Please re-export the global-search screenshots. `search-flow.jsx` and `staff-desktop.jsx`
changed substantially, so **every existing PNG in `exports/global-search/` is stale** — two
of them render a screen that no longer exists.

## First, delete all 8 current files

```
exports/global-search/desktop-01-resting.png
exports/global-search/desktop-02-live-results.png
exports/global-search/desktop-03-no-results.png
exports/global-search/desktop-04-results-page.png     ← screen deleted
exports/global-search/mobile-01-resting.png
exports/global-search/mobile-02-live-results.png
exports/global-search/mobile-03-no-results.png
exports/global-search/mobile-04-results-page.png      ← screen deleted
```

## Set the language to Polish before rendering — this is not optional

`useSX()` and `useLang()` both branch on `window.__flotaLang === 'PL'`. Polish is the
canonical UI copy for this product (English is reference only), so an English export is
unusable — the strings are exactly what these shots exist to verify. Confirm the render
shows `Szukaj rezerwacji, pojazdu, rejestracji…` and `Szybkie przejścia` before saving.

## Desktop — 1440×900, into `exports/global-search/`

| Screen                                       | Filename                               | What it must show                                                                                                                                                        |
| -------------------------------------------- | -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `ScreenSearchResting`                        | `desktop-01-resting.png`               | Focused empty field: ink border, `0 0 0 4px rgba(15,23,42,0.06)` ring, `⌘` `K` chips. Panel = **Szybkie przejścia** only (no recent-searches block, no divider).         |
| `ScreenSearchLive`                           | `desktop-02-live-results.png`          | Field shows `Krzysztof` with the accent caret and the 22×22 clear-X **instead of** the chips. Panel scrolled to top: Rezerwacje · 2, first row active with its `↵` chip. |
| `ScreenSearchLive`, panel scrolled to bottom | `desktop-03-live-results-scrolled.png` | The **Pojazdy** group in full — it's the one row type that has never been on record. If the panel turns out not to overflow its 460px cap, skip this file and tell me.   |
| `ScreenSearchNoResults`                      | `desktop-04-no-results.png`            | Field focused showing `Krzsztof xz` + clear-X; the centered empty state; footer showing the keyboard hints (it no longer switches to a "see all" line in any phase).     |
| `ScreenStaffDash`                            | `desktop-05-pulpit-entry.png`          | The resting Pulpit — the **only** desktop staff screen with a search field. Note the right-group order: field (520) → calendar (38×38) → QuickAdd.                       |
| `ScreenStaffRequests` _(lower priority)_     | `desktop-06-no-search.png`             | A staff topbar with **no** field — the baseline for the nine screens that lose it.                                                                                       |

## Mobile — 390×844, into `exports/global-search/`

| Screen                        | Filename                     | What it must show                                                                                                                              |
| ----------------------------- | ---------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `ScreenWorkerDash`            | `mobile-01-pulpit-entry.png` | The `44×44 / r99` magnifier sitting `gap: 10` left of the avatar — the sole mobile entry point. The `TabBar` must show **no** search icon.     |
| `ScreenSearchMobileResting`   | `mobile-02-resting.png`      | Quick-jumps only, `34×34` icon tiles. No recent-searches block.                                                                                |
| `ScreenSearchMobileLive`      | `mobile-03-live-results.png` | All three groups including **Pojazdy**. The list simply ends — there is no longer a full-width "Zobacz wszystkie wyniki" button at the bottom. |
| `ScreenSearchMobileNoResults` | `mobile-04-no-results.png`   | `60×60` icon + the empty-state copy.                                                                                                           |

## Two things that should NOT appear anywhere

If either shows up, the render is stale — re-pull the file before exporting:

- **`Ostatnie wyszukiwania`** — removed from both resting states.
- **`Zobacz wszystkie wyniki`** — removed from the desktop panel footer and the mobile
  results list. There is no results page and no results URL any more.
