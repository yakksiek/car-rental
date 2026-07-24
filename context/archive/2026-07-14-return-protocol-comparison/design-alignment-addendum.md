# Claude Design — implement the 3 missing return-flow screens (S-06)

> Paste into the "Rental car company" Claude Design project. The canvas `Flota Rental.html`
> (section "Return protocol · mobile flow") references three artboards — **R2 `ScreenReturnStart`,
> R3 `ScreenReturnUploads`, R5 `ScreenReturnWarn`** — whose components are **not defined yet**, so they
> render blank. Implement them in `return-flow.jsx`, reusing the existing return parts. **Deltas only — no
> money.** Export each to `window`. (`return-flow.jsx` already loads after `return-protocol.jsx`, so
> `RtMobileBody`, `RtConditionRow`, `RtPhotos`, `RtBaselineDamage`, `RtSummary`, `PkHeader`, `RtSubmitBar`,
> `PpPhotoSlot`, `PpSignatureField`, `t.ret.*` are all available.)

## 1. `ScreenReturnStart` — R2 · Return form · start (empty)

The form the moment it opens from the dispatch, **before anything is entered** — the true "start":

- Same `PkHeader` + single scrolling form shape as `ScreenReturnProtocol`.
- **Section 1 (Stan techniczny):** odometer input **empty** (placeholder `t.ret.currentPh`); fuel **unset** (no
  bars filled). The **"Przy wydaniu" baseline reference is shown** read-only, but each delta chip renders a
  muted placeholder (`—`) because nothing is entered yet.
- **No comparison card at the top yet** — instead a muted hint. Add copy `t.ret.enterToCompare` =
  EN `"Enter current values to see the comparison"` / PL `"Wprowadź bieżące wartości, aby zobaczyć porównanie"`.
- **Section 2 (Zdjęcia):** 0/6 — all `PpPhotoSlot` `state="empty"`.
- **Section 3 (Uszkodzenia):** the baseline reference list (`RtBaselineDamage`) is shown; **no current-damage
  rows yet** — just the "Dodaj uszkodzenie" button.
- **Section 4 (Podpis):** ack unchecked; `PpSignatureField` in its unsigned state.
- Submit bar present.
- **Hint:** give `RtConditionRow` / `RtMobileBody` / `RtPhotos` an `empty` (or `mode="start"`) prop so
  odo=`""`, fuel unset, deltas render `—`, photos empty, and the current-damage list is empty.

## 2. `ScreenReturnUploads` — R3 · Photos · capture in progress

Mirror the pickup `ScreenPickupUploads`:

- The return form with the **photos section in mixed states** — e.g. 3 `done`, 1 `uploading` (with %),
  1 `failed` (retry), 1 `empty` — reusing `PpPhotoSlot`'s existing states.
- Odometer/fuel may already be filled (deltas live). **Submit disabled** while an upload is in flight (as the
  pickup uploads screen does).

## 3. `ScreenReturnWarn` — R5 · Odometer below pickup · soft warning

Demonstrate the plan's **"soft warnings, never block"** rule:

- The form with the odometer entered **below** the baseline (baseline 48 712 → enter e.g. ~47 900), so
  `RtConditionRow`'s amber `odoBelow` warning appears (`t.ret.odoBelowWarn`) and the km delta reads
  **negative**.
- **Submit stays ENABLED** — the warning must not block submission. This is the entire point of the screen.
- **Hint:** pass a below-baseline current odometer into `RtConditionRow` (e.g. a `currentOdo` prop or an
  initial-value override) rather than the default `RET_CUR.odo`.

## After adding

- `Object.assign(window, { ScreenReturnStart, ScreenReturnUploads, ScreenReturnWarn });`
- Add `enterToCompare` to both `STR.EN.ret` and `STR.PL.ret` in `shared.jsx`.
- No new artboards needed — the canvas slots (R2/R3/R5) already point at these names; they'll fill in once
  defined.
