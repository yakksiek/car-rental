# Return Protocol (S-06) — Design Contract

> **Phase 1 deliverable.** The textual layout + canonical Polish copy contract for the return-protocol UI.
> **Phases 5–6 build from this text — do not re-open the mockups.** (Per `lessons.md`: distil the design once,
> at plan time.)
>
> **Reference source** (do NOT open during implement): the corrected screens live in the Claude Design project
> "Rental car company" — canvas `Flota Rental.html`, sections **`return-mobile`** (artboards R1–R10) and
> **`return-desktop`** (R1–R10); component source `return-protocol.jsx` + `return-flow.jsx`. The repo
> screenshot `context/foundation/design/screenshots/14-staff-mobile-return-protocol.png` is **superseded**
> (pre-correction) — ignore it.
>
> **Build target**: the Astro app reuses the shipped S-05 protocol components. Build against the **live tokens
> in `src/styles/global.css`** — never import from `context/foundation/design/`. The design-project names below
> (`Rt*`, `Pp*`) are the _reference_ structure; the app equivalents are named in §8.

---

## 1. Tokens (design → app mapping)

Build with the app's semantic Tailwind tokens (`src/styles/global.css`); the raw hexes below are the design
source, for intent only.

| Role                                        | Design hex                     | App token                      |
| ------------------------------------------- | ------------------------------ | ------------------------------ |
| Page background                             | `#F1F3F6`                      | `background`                   |
| Card                                        | `#FFFFFF`                      | `card`                         |
| Ink / text                                  | `#0F172A` / `#334155` (`ink2`) | `foreground`                   |
| Muted text                                  | `#94A3B8`                      | `muted-foreground`             |
| Hairline                                    | `rgba(15,23,42,.08)` / `.05`   | `border`                       |
| Primary / crimson                           | `#B43638`                      | `primary` (also `destructive`) |
| Success (delivered / returned)              | `#1B9E5A` on `#E3F5EC`         | `success`                      |
| **Warning (adverse deltas, soft warnings)** | `#B6790E` on `#FBF1DA`         | `warning`                      |
| Bad chip (fuel down / new damage)           | `#B43638` on `#FBE4E1`         | `destructive` / `redSoft`      |
| Neutral chip                                | `#334155` on `#EEF1F5`         | `muted` / `secondary`          |

Type: Inter (UI), JetBrains Mono (numbers/plates/deltas), Instrument Serif (brand mark only). Radii: cards
14–18px, inputs/buttons 10–13px, delta chips ~7px. Shadows: soft navy (`shadow1` for cards). **No dark theme.**

---

## 2. Screen inventory (what to build)

**Mobile** (390×844) — one scrolling form, bottom tab bar:

| Ref | Screen                                   | App surface                        |
| --- | ---------------------------------------- | ---------------------------------- |
| R1  | Returns queue · dispatch                 | `/dashboard/returns` (mobile)      |
| R2  | Return form · **start (empty)**          | `ReturnProtocolForm` initial state |
| R3  | Photos · capture in progress             | form, uploads state                |
| R4  | Return form · **filled** (live deltas)   | `ReturnProtocolForm`               |
| R5  | Odometer below pickup · **soft warning** | form, warn state                   |
| R6  | Add damage · existing/new                | damage editor (bottom sheet)       |
| R7  | Signature · full screen                  | signature modal                    |
| R8  | Sent · delta summary + PDF               | success overlay                    |
| R9  | Protocol · read-only view                | return view                        |
| R10 | Returns queue · empty                    | `/dashboard/returns` empty         |

**Desktop** (1320×760–900) — two-column form, centred modals:

| Ref | Screen                           | App surface                    |
| --- | -------------------------------- | ------------------------------ |
| R1  | Returns queue                    | `/dashboard/returns` (desktop) |
| R2  | Return form (two-column)         | `ReturnProtocolForm`           |
| R3  | Add damage (modal)               | damage editor modal            |
| R4  | Signature (modal)                | signature modal                |
| R5  | Sent (modal)                     | success modal                  |
| R6  | Read-only view                   | return view                    |
| R7  | Send failed · resend             | email-failed modal             |
| R8  | PDF failed                       | pdf-failed modal               |
| R9  | Return already exists (conflict) | conflict screen                |
| R10 | Returns queue · empty            | empty                          |

---

## 3. Shared building blocks

**Context strip** (top of every form/view): `R-2401 · Anna Nowak · Ford Transit · WX 5519M · Zwrot 10:00`
(reference · customer · make model · plate · **Zwrot** HH:MM).

**Comparison summary** ("Porównanie wydanie → zwrot") — a card with three rows, each label + a mono delta chip:

| Row label          | Value format         | Chip tone                      |
| ------------------ | -------------------- | ------------------------------ |
| `Przejechano`      | `+1 228 km` (signed) | **neutral** (always)           |
| `Zmiana paliwa`    | `−4/8` (signed)      | **bad** if `< 0`, else neutral |
| `Nowe uszkodzenia` | `+1`                 | **bad** if `> 0`               |

**One dark variant everywhere** (ink `background`, light text, `#FB9B9B` for bad values), placed at the **bottom**
of the form: the bottom of the desktop right column (below photos + signature) and, on mobile, **just above the
submit bar** — the last card in the single-column scroll. Sent modals reuse the same dark summary.

> **Decision (2026-07-20):** supersedes the original mockup, which showed a _light_ summary at the _top_ of the
> mobile form. The condition cards already surface live per-field deltas as you fill, so the full summary now
> sits at the bottom as a final pre-submit review, matching desktop. Applies to mobile + desktop.

**Condition card** (odometer, fuel) — each shows the current value as an **editable input**, then a footer:
row 1 `Przy wydaniu <baseline>` (read-only reference, mono), row 2 `<delta label> <chip>`. Odometer delta
label `Przejechano` (neutral); fuel delta label `Zmiana paliwa` (bad if negative). Empty state → delta chip
shows `—`; unset fuel shows `—/8` muted.

**Baseline damage reference** — a bordered list titled **`Uszkodzenia z protokołu wydania`**; each issue-damage
row read-only (`<type> — <location> (<size>)`) with a grey `Istniejące` tag. Read-only, never editable.

**Current damage row** — `<type> — <location> (<size>)` + `N zdjęć`, and a right-aligned **segmented override**
`[ Istniejące | Nowe ]` (selected `Istniejące` = ink, selected `Nowe` = crimson). Read-only surfaces show a
static tag instead (grey `Istniejące` / red `Nowe`).

**Photo grid** — 6 slots labelled `Przód · Tył · Lewy bok · Prawy bok · Wnętrze · Deska rozdz.`; per-tile state
`done | uploading | failed | empty`; count badge `N/6` (green only at `6/6`). Desktop adds a drag/drop zone
above the grid (`Przeciągnij zdjęcia tutaj lub kliknij, aby wgrać`).

**Signature** — an ack checkbox (`Klient potwierdza stan pojazdu i warunki najmu.`) + a signature field that
opens a **full-screen** signature modal (reuse S-05's).

---

## 4. Return form — layout

### Mobile (single scrolling form; no wizard, no step rail)

Header (`PkHeader`): back · **`Protokół zwrotu`** · close. Then, in order:

1. **Section 1 — `Stan techniczny`** (sub `Licznik, paliwo i istniejące uszkodzenia…`): the two condition cards
   (odometer input + fuel bar), each with baseline reference + live delta (§3).
2. **Section 2 — `Zdjęcia pojazdu`**: the 6-slot photo grid + `N/6` badge.
3. **Section 3 — `Uszkodzenia`** (sub `Zapisz każdy ślad osobno — zwrot porówna się z tą listą.`): the baseline
   reference list, then the current-damage rows with override. Empty state → muted `Nie dodano nowych
uszkodzeń.` A `Dodaj uszkodzenie` button opens the damage editor (bottom sheet).
4. **Section 4 — `Podpis`** (sub `Klient potwierdza powyższy stan i składa podpis.`): ack checkbox + signature
   field.
5. **Comparison summary** — the **dark** card (§3), last in the scroll, directly above the submit bar. In the
   **empty/start** state, replace its rows with a muted banner: `Wprowadź bieżące wartości, aby zobaczyć porównanie`.

Sticky submit bar: **`Potwierdź zwrot i wyślij`**.

### Desktop (two-column, `~1.35fr / 1fr`)

`StaffShell` (active nav = **Zwroty**) + topbar title `Protokół zwrotu` + the context sub-line.

- **Left column**: `Stan techniczny` heading + sub (`Wartości porównane automatycznie z protokołem wydania.`);
  the two condition cards side by side; then `Uszkodzenia` heading + `Dodaj uszkodzenie` button; baseline
  reference; current-damage rows with override.
- **Right column**: photos (drag-zone + grid, `6 / 6`), signature field, and the **dark** comparison summary.
- Footer (right-aligned): `Wstecz` + primary **`Zakończ i wyślij`**.

### Form states (build all)

- **Start / empty (R2)**: baseline shown; odometer input empty (placeholder `Wpisz odczyt`); fuel unset
  (`—/8`); deltas `—`; 0/6 photos; no current damage (`Nie dodano nowych uszkodzeń.`); unsigned; submit
  **disabled**.
- **Uploads (R3)**: photo grid mixed (e.g. 3 done / 1 uploading / 1 failed / 1 empty); submit **disabled** while
  any upload is in-flight.
- **Filled (R4)**: all entered; deltas live.
- **Soft warning (R5)**: odometer entered **below** baseline → the odometer card border turns `warning` and
  shows `Licznik niższy niż przy wydaniu — sprawdź odczyt.`; the km delta reads negative; **submit stays
  ENABLED** (soft warnings never block — this is a hard requirement, not a nicety).

---

## 5. Delta / comparison block — rules

- **Deltas only. No money anywhere** — no `zł`, no refuel cost, no km-limit charge. (Product Non-Goal.)
- **Adverse = flagged; km = neutral.** `Zmiana paliwa` flags `bad` when fuel dropped; `Nowe uszkodzenia` flags
  `bad` when > 0; `Przejechano` is always neutral (a below-baseline reading shows a negative number + the amber
  odometer warning, but the km chip itself stays neutral).
- **Baseline is read-only reference; current is entered fresh** (FR-007) — never pre-fill an editable current
  field with the baseline value.
- **Damage tag** `Istniejące | Nowe` is auto-suggested from the baseline and **manually overridable** per row
  (hint copy: `Wykryto automatycznie z protokołu wydania — zmień w razie potrzeby.`).

---

## 6. Returns dispatch worklist (`/dashboard/returns`)

Nav: add a **`Zwroty`** tab (down-arrow icon) to the staff shell / mobile tab bar. Topbar/header title
**`Zwroty`**, sub `Pojazdy do zwrotu na dziś`.

**Stats** (desktop cards / mobile chips): `Na dziś` (neutral), `Po terminie` (red), `Zwrócono` (green).

**Row** = time + state caption · vehicle silhouette · customer · `make model` · `reference` · `plate` · then a
badge/action by state:

- **Open (due today)** → primary **`Przyjmij zwrot`** button.
- **Overdue** → row gets a `redSoft` background + red left-border; a `Po terminie` badge; still shows
  `Przyjmij zwrot`. (Overdue rows stay on the list until processed — matches the plan's "due-or-overdue" rule.)
- **Returned** (filed today) → a delivery badge (`Dostarczono` / `E-mail niewysłany`) + a resend icon-button +
  `Otwórz protokół`.

**Empty (R10)**: `Brak zwrotów na dziś` · `Gdy wynajęty pojazd będzie do zwrotu, pojawi się tutaj.`

> Keep distinct from S-07: this list is where returns are **processed**; S-07's dashboard _flags_ overdue.

---

## 7. Return protocol view (read-only) & terminal states

**View (R9 mobile / R6 desktop)** — header `Protokół zwrotu`; a delivery badge (`Dostarczono`) + recipient +
timestamp + resend; the comparison summary; then read-only Sections 1–4 (condition, photos `6/6`, baseline +
current damage with static tags, signature); a **`Pobierz PDF`** download.

**Sent (R8 mobile / R5 desktop)** — `Protokół wysłany` · `Wysłano do <email>` ·
`Protokół zwrotu wysłany do klienta i zapisany jako PDF.` · comparison summary · `Gotowe` · `Pobierz PDF`.
Desktop adds badges `Protokół zapisany` + `Dostarczono`.

**Email failed (R7 desktop)** — `Nie udało się wysłać e-maila` · badges `Protokół zapisany` +
`E-mail niewysłany` · `Nie wysłano do <email>` · primary `Wyślij ponownie` · `Pobierz PDF` · `Później`.
**PDF failed (R8 desktop)** — `Nie udało się wygenerować PDF` · badge `Błąd PDF` · primary `Spróbuj ponownie` ·
`Później`.
**Conflict (R9 desktop)** — `Protokół już istnieje` ·
`Dla tej rezerwacji istnieje już protokół zwrotu — każdy zwrot może mieć tylko jeden.` · `Wróć do pulpitu` +
`Otwórz protokół`.

---

## 8. App-component mapping (Phases 5–6)

| Design part                                         | App target (Phase)                                                          |
| --------------------------------------------------- | --------------------------------------------------------------------------- |
| `RtMobileBody` / `DeskReturnBody` (form shells)     | `src/components/protocol/ReturnProtocolForm.tsx` (P5)                       |
| `RtConditionRow` (baseline ref + live delta inputs) | condition section of the return form (P5)                                   |
| `RtSummary` (comparison)                            | delta display, computed via `computeReturnDeltas` (`protocol-delta.ts`, P3) |
| `RtDamageRow` override + `RtDamageEditor`           | baseline-linked `DamageEditor` extension (P5)                               |
| `RtBaselineDamage`                                  | read-only baseline panel (P5)                                               |
| photo grid / signature / overlays                   | reuse S-05 leaves `PhotoSlot`, `SignaturePad`, `Overlays` (P5)              |
| `RtQueueRow` / `RtQueueCardM` + stats + empty       | `/dashboard/returns` + `ReturnQueue` (P6)                                   |
| view screens                                        | `ProtocolView` + comparison block (P6)                                      |
| `Zwroty` nav tab                                    | `StaffShell.astro` NAV + `access.ts` (P6)                                   |

Delta tones map to tokens: neutral→`muted`/`secondary`, bad→`destructive`, warn→`warning`. The comparison must
be driven by the pure `computeReturnDeltas` helper (P3) so the UI and the PDF render identical numbers.

---

## 9. Canonical Polish copy (verbatim — do not paraphrase)

**Titles / actions**
`Protokół zwrotu` (form + view title) · `Zwroty` (nav + queue title) · `Przyjmij zwrot` (dispatch action) ·
`Potwierdź zwrot i wyślij` (mobile submit) · `Zakończ i wyślij` (desktop submit) · `Wstecz` (back) ·
`Otwórz protokół` · `Pobierz PDF` · `Wyślij ponownie` / `Później` · `Gotowe` · `Wróć do pulpitu`.

**Comparison**
Heading `Porównanie wydanie → zwrot` · sub `Wartości porównane automatycznie z protokołem wydania.` ·
`Przy wydaniu` / `Przy zwrocie` · `Przejechano` · `Zmiana paliwa` · `Nowe uszkodzenia` ·
empty banner `Wprowadź bieżące wartości, aby zobaczyć porównanie`.

**Sections**
`Stan techniczny` (sub `Licznik, paliwo i istniejące uszkodzenia. Zdjęcia można zrobić telefonem lub wgrać
tutaj.`) · `Zdjęcia pojazdu` · `Uszkodzenia` (sub `Zapisz każdy ślad osobno — zwrot porówna się z tą listą.`) ·
`Podpis` (sub `Klient potwierdza powyższy stan i składa podpis.`).

**Condition / fields**
`Licznik` · `km` · `Poziom paliwa` · `pełny` / `pusty` · placeholder `Wpisz odczyt` ·
soft-warn `Licznik niższy niż przy wydaniu — sprawdź odczyt.`

**Photos** — `Przód · Tył · Lewy bok · Prawy bok · Wnętrze · Deska rozdz.` · `Wgrywanie…` · `Błąd wgrywania` ·
`Ponów` · drag-zone `Przeciągnij zdjęcia tutaj lub kliknij, aby wgrać`.

**Damage** — reference heading `Uszkodzenia z protokołu wydania` · empty `Nie dodano nowych uszkodzeń.` ·
`Dodaj uszkodzenie` · tags `Istniejące` / `Nowe` · classification label `Klasyfikacja` · hint
`Wykryto automatycznie z protokołu wydania — zmień w razie potrzeby.` · types `Rysa · Wgniecenie · Pęknięcie ·
Brak części` · `N zdjęcie/zdjęć`.

**Signature / ack** — `Klient potwierdza stan pojazdu i warunki najmu.`

**Dispatch** — sub `Pojazdy do zwrotu na dziś` · stats `Na dziś` / `Po terminie` / `Zwrócono` · row states
`Zwrot` (due) / `Po terminie` (overdue) / `Zwrócono` (returned) · badges `Dostarczono` / `E-mail niewysłany` /
`Błąd PDF` · empty `Brak zwrotów na dziś` + `Gdy wynajęty pojazd będzie do zwrotu, pojawi się tutaj.`

**Terminal states** — `Protokół wysłany` · `Wysłano do` · `Protokół zwrotu wysłany do klienta i zapisany jako
PDF.` · `Protokół zapisany` · `Nie udało się wysłać e-maila` · `Nie wysłano do` ·
`Nie udało się wygenerować PDF` · `Spróbuj ponownie` · conflict
`Dla tej rezerwacji istnieje już protokół zwrotu — każdy zwrot może mieć tylko jeden.`

---

## 10. Invariants (must hold in implementation)

1. **No money** on any return surface.
2. **Single scrolling form (mobile) / two-column (desktop)** — never a wizard.
3. **Baseline read-only; current entered fresh**; deltas computed live from the pure helper.
4. **Structured damage** with `Istniejące | Nowe` auto-tag **+ manual override**.
5. **Soft warnings never block** — the odometer-below-baseline state keeps submit enabled.
6. **Adverse deltas** (fuel down, new damage) flagged with `warning`/`destructive`; km driven neutral.
7. **Copy is Polish-canonical** — use the strings in §9 verbatim.
8. Build against **live `src/styles/global.css` tokens**; reuse S-05 leaves (§8).
