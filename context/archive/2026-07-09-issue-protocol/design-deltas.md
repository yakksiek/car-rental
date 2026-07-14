# S-05 Issue Protocol — design deltas (implementation → mocks)

Hand-off note for the Claude Design project `352d78a6-84fd-49a2-8b38-2fe289691fc3`
(`protocol-parts.jsx`, `pickup-protocol.jsx`, `staff-protocol-desktop.jsx`, `shared.jsx`).

During S-05 implementation the built form diverged from the distilled design
contract in a handful of **deliberate** ways — each was a UX or correctness call
made with the user during manual testing, not an accident. The mocks should be
updated to match so S-06 (return protocol), which reuses this pipeline, starts
from the real shape.

Everything below is a change to the **pickup / issue** screens only. Copy is
Polish and canonical.

---

## 1. Signature — full-screen modal, not an inline pad

**Was:** an inline signature canvas living in Section 4 (`Podpis`), ~140–150px
tall, with a `Wyczyść` link and the "Podpisał(a) …" line beneath it.

**Now:** Section 4 shows a single **signature field**, and the canvas lives in a
dedicated modal:

- **Empty state** — a dashed field button: pen icon, `Poproś klienta o podpis`,
  sub `Otwórz pełny ekran podpisu`. Tapping it opens the modal.
- **Modal** — full-screen sheet on mobile, centred ~600×540 card on desktop
  (same shell family as the damage editor / overlays). Header
  `Podpis klienta` + ✕; instruction `Poproś klienta, aby podpisał się w polu
poniżej.`; a large canvas filling the sheet; footer `Wyczyść` (secondary) +
  `Zatwierdź podpis` (primary, enabled only once there is ink). The page behind
  is scroll-locked while open. Confirm shows `Zapisywanie…` until the upload
  lands, then closes.
- **Signed state** — the field collapses to `✓ Podpisał(a) {name} · o {HH:MM}`
  with a `Zmień` button that reopens the modal.

**Why:** on a phone the customer (not a trained employee) signs; a first stroke
landing a few px above an inline pad scrolled the page. The modal gives a real
signing surface and removes the scroll trap. It also eliminated a clear-vs-upload
race that only appeared on slower Android devices.

## 2. Photo tiles allow the gallery, not only the camera

**Was:** mobile photo capture forced the rear camera (`capture="environment"`).

**Now:** tapping a photo tile (and the damage-photo `+`) opens the native chooser
with **both** `Zrób zdjęcie` and `Biblioteka zdjęć` / `Wybierz plik`. The tile
visuals are unchanged; only the source options widened. (`accept="image/*"`,
still deliberately without `image/heic`.)

**Why:** the employee has often already photographed the vehicle; forcing the
live camera blocked using those shots.

## 3. Desktop layout — two independent-height columns

**Was:** the four sections in a 2-column grid that shared row heights, so the
short Section 1 (`Stan techniczny`) left a large empty gap beneath it before
Section 3 (`Uszkodzenia`) began, because the tall photos section set the row.

**Now:** the two desktop columns pack independently — **left** = §1
`Stan techniczny` + §3 `Uszkodzenia`; **right** = §2 `Zdjęcia pojazdu` + §4
`Podpis`. The shorter column simply ends earlier; no interior void. Mobile is
unchanged: one scrolling column in numeric order 1‑2‑3‑4. (Column widths stay
left `1.35fr` / right `1fr`.)

## 4. Section 1 — odometer box height and error alignment

- The odometer input **box grows** so its bottom sits on the fuel bar's `E`/`F`
  line (the taller fuel column sets the height); the big number is vertically
  centred inside it. Nothing in the odometer column aligns to the fuel value
  readout.
- Both field errors are **pinned to the bottom of the row and aligned
  horizontally**, each with the same ⚠ icon + text treatment
  (`Podaj stan licznika.` / `Wybierz poziom paliwa.`).

## 5. Result overlays — recipient copy corrected

The mock showed `Wysłano do <email>` on every non-`sent` variant. That is
semantically wrong on the failure paths, so:

| Variant | Recipient line                                                                                    |
| ------- | ------------------------------------------------------------------------------------------------- |
| `sent`  | none (badges already say `Dostarczono`)                                                           |
| `email` | `Nie wysłano do <email>` — a send was attempted and failed; matches the `E-mail niewysłany` badge |
| `pdf`   | **none** — the PDF failed before any send, so no recipient is named                               |

## 6. Result overlays — "Pobierz PDF" action

The `sent` and `email` overlays gained a secondary **`Pobierz PDF`** button
(between the primary action and the ghost secondary) that downloads the
just-generated PDF from memory. The `pdf` variant has no such button (no PDF was
produced). Note this is an in-session download only; the durable "open it later"
link lives on the S-06 view-protocol screen.

---

### Unchanged from the contract (for reference)

Numbered section badges, the four-section order, the eight-segment fuel bar, the
6-slot photo grid with the drag/drop zone, the damage editor as a bottom sheet /
centred modal with the `Usuń` action, the sticky submit bar
(`Potwierdź wydanie i wyślij` → `Wysyłanie…`), the conflict screen, and the empty
screen all match the contract. Damage-row photo counts use the full Polish plural
set (`1 zdjęcie` / `2 zdjęcia` / `5 zdjęć`).
