# Export request — global search after the Pulpit-only / dropdown-only rewrite

> ## NOT RUN — closed by owner decision, 2026-08-17
>
> The change shipped without the rendered vision-diff gate: its values came from the
> code-backed JSX rather than from screenshots, and the gate would have passed **D19**, the
> one real defect found. Reasoning in `change.md`; summary in `design-review/README.md`.
>
> **This request is still accurate** and can be run later if the gate is wanted. It is kept
> for that reason, not because anything is pending. The stale 2026-08-10 PNGs it was written
> to replace were deleted rather than re-exported, so nothing in the repo is waiting on it.

Send the block below to Claude in the Design app for project `Rental car company`
(`352d78a6-84fd-49a2-8b38-2fe289691fc3`). Rendering to PNG cannot be driven through
`DesignSync` (it reads and writes files only), so this one has to be asked for.

Save the returned PNGs into `context/changes/staff-search-dashboard-only/design-review/`.
They are the canonical set for this change's vision-diff gate.

> Supersedes the previous version of this file, which predated `ScreenSearchLiveScrolled`
> and named files that no longer match what is in `exports/global-search/`.

---

Please re-export the global-search screenshots. `search-flow.jsx` was rewritten
(Pulpit-only, dropdown-only) and `staff-desktop.jsx` / `staff-screens.jsx` moved the entry
points, so **everything currently in `exports/global-search/` is stale or ambiguous**.

## First, delete every file in `exports/global-search/`

The folder currently holds two overlapping sets and I can't tell which is newer:

```
desktop-01-resting.png
desktop-02-live-results.png
desktop-03-live-results-scrolled.png
s1-desktop-01.png … s1-desktop-06.png
s1-mobile-01.png … s1-mobile-04.png
```

Delete all of them and render the set below with the `v2-` prefix, so there is exactly one
unambiguous set afterwards.

## Set the language to Polish before rendering — this is not optional

`useSX()` and `useLang()` both branch on `window.__flotaLang === 'PL'`. Polish is the
canonical UI copy for this product (English is reference only), so an English export is
unusable — the strings are much of what these shots exist to verify. Confirm the render
shows `Szukaj rezerwacji, pojazdu, rejestracji…` and `Szybkie przejścia` before saving.

## Desktop — 1440×900, into `exports/global-search/`

| Screen                     | Filename                          | What it must show                                                                                                                                                                                                                                                 |
| -------------------------- | --------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ScreenStaffDash`          | `v2-desktop-01-pulpit-entry.png`  | The resting Pulpit — the **only** desktop staff screen with a field. Right-group order must read **field (520) → calendar (38×38) → QuickAdd**.                                                                                                                   |
| `ScreenStaffRequests`      | `v2-desktop-02-no-field.png`      | A staff topbar with **no** field — the baseline for the nine screens that lose it.                                                                                                                                                                                |
| `ScreenSearchResting`      | `v2-desktop-03-resting.png`       | Focused empty field: ink border, `0 0 0 4px rgba(15,23,42,0.06)` ring, `⌘` `K` chips. Panel = **Szybkie przejścia** only — no recent-searches block, no divider.                                                                                                  |
| `ScreenSearchLive`         | `v2-desktop-04-live-results.png`  | Field shows `Krzysztof` with the accent caret and the 22×22 clear-X **instead of** the chips. Panel at the top of its scroll: Rezerwacje · 2, first row active with its `↵` chip.                                                                                 |
| `ScreenSearchLiveScrolled` | `v2-desktop-05-live-scrolled.png` | The same panel scrolled to the bottom, showing the **Pojazdy** group in full. This is the priority shot — the vehicle row has never been on record and we are building to it. If the panel turns out not to overflow its 460px cap, say so rather than faking it. |
| `ScreenSearchNoResults`    | `v2-desktop-06-no-results.png`    | Field focused showing `Krzsztof xz` + clear-X; the centered empty state; footer showing the keyboard hints.                                                                                                                                                       |

## Mobile — 390×844, into `exports/global-search/`

| Screen                        | Filename                        | What it must show                                                                                                                                 |
| ----------------------------- | ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ScreenWorkerDash`            | `v2-mobile-01-pulpit-entry.png` | The `44×44 / r99` magnifier sitting `gap: 10` to the left of the avatar — the sole mobile entry point. The `TabBar` must show **no** search icon. |
| `ScreenSearchMobileResting`   | `v2-mobile-02-resting.png`      | Quick-jumps only, `34×34` icon tiles. No recent-searches block.                                                                                   |
| `ScreenSearchMobileLive`      | `v2-mobile-03-live-results.png` | All three groups **including Pojazdy**. The list simply ends — no full-width "Zobacz wszystkie wyniki" button at the bottom.                      |
| `ScreenSearchMobileNoResults` | `v2-mobile-04-no-results.png`   | `60×60` icon + the empty-state copy.                                                                                                              |

## Four things that must NOT appear anywhere

If any of these shows up, the render is stale — re-pull the file before exporting:

- **`Ostatnie wyszukiwania`** — removed from both resting states.
- **`Klienci`** as a group — removed along with `CustomerRow`.
- **`Zobacz wszystkie wyniki`** — removed from the desktop footer and the mobile list. There
  is no results page and no results URL any more.
- **A search icon in the mobile `TabBar`**, or a field on any staff screen other than Pulpit.

## One thing that must appear

The **Pojazdy** group with real vehicle rows, in both `v2-desktop-05` and `v2-mobile-03`.
`SEARCH_DATA.vehicles` is populated now; if a render still shows an empty group, the file
did not reload.
