# Design Contract — S-12 manual-reservation (Nowa rezerwacja)

Source of truth: **`manual-reservation.jsx`** (`ManualResFlow` — confirm→form→done — with `MrAvailability`,
`QuickAddButton`; static boards `MrD_FormOk/FormConflict/Done`, `MrM_*`), live in Claude Design
`352d78a6-84fd-49a2-8b38-2fe289691fc3`, pulled via DesignSync. Values transcribed **exactly**; each line
`exact` or `deviation(reason)`. We ship the **form → done** flow only (no calendar-cell confirm, no quick-menu).

---

## Design Alignment Audit

### Freshness audit (repo vs canonical)

| Artifact                                 | Status      | Note                                                                                                             |
| ---------------------------------------- | ----------- | ---------------------------------------------------------------------------------------------------------------- |
| `manual-reservation.jsx` (design source) | **current** | Pulled this session; the exact-values source below.                                                              |
| `manual-reservation` screenshot in repo  | **missing** | New mockup — not in the `design-system.md` catalog. → outstanding input for the downstream rendered vision-diff. |
| `ReservationDecision.tsx` overlay idiom  | **current** | Reused as the modal shell (see D6).                                                                              |
| Calendar designs (rows 16/22)            | **current** | Phase 4 only adds a chip to the read-only detail — no restyle.                                                   |

### New-design quality audit (gaps in the provided mockup)

- The **"available"** state carries a "Pojazd wolny do … · kolejna rez. …" hint and the **"conflict"** state a
  clashing-booking card — both need data our boolean availability check doesn't return → handled as **D2**.
- A **"Pojazd w serwisie"** (maintenance) availability state exists in the mockup with no backing in our model
  (there is no maintenance status; only active vehicles are selectable) → **D3**.
- Mobile + desktop are both provided for form / conflict / done. Copy is canonical Polish.
- The **confirm** step and the **quick-action menu** are drawn but out of scope → **D4**.

### Alignment checklist (plan vs canonical)

| Canonical surface                                               | Plan phase                   | Aligned?                                  |
| --------------------------------------------------------------- | ---------------------------- | ----------------------------------------- |
| Modal form (vehicle / dates / availability / customer / footer) | Phase 3                      | ✓ (D1, D2, D3, D5, D6)                    |
| Done panel (reference + Ręczna + summary)                       | Phase 3                      | ✓                                         |
| Entry trigger                                                   | Phase 3                      | ✓ (D4 — single button, no menu)           |
| Ręczna surfaced where confirmed bookings live (calendar)        | Phase 4                      | ✓ (D7 — chip in detail, no new bar color) |
| UI phases carry a vision-diff success criterion                 | Phase 3 (3.8), Phase 4 (4.4) | ✓                                         |

### Verdict

**PASS (paper audit)** — 4 surfaces aligned; 0 repo designs superseded; **7 deviations recorded (D1–D7)**.
Outstanding input for `/10x-implement`: drop the canonical **manual-reservation mockup PNGs** (desktop +
mobile: form-ok, form-conflict, done) into `context/changes/manual-reservation/design-review/`. The
exact-values contract below is transcribed from the code-backed source, so planning is not blocked.

---

## Token map (design `tokens.*` → app token)

| Design token                 | Hex / value           | App token (utility)                                                |
| ---------------------------- | --------------------- | ------------------------------------------------------------------ |
| `tokens.bg`                  | `#F1F3F6`             | `--background` (`bg-background`)                                   |
| `tokens.card`                | `#FFFFFF`             | `--card` (`bg-card`)                                               |
| `tokens.ink`                 | `#0F172A`             | `--foreground`                                                     |
| `tokens.ink2`                | `#334155`             | `--flota-ink-2` (`text-[var(--flota-ink-2)]`)                      |
| `tokens.muted`               | `#94A3B8`             | `--muted-foreground`                                               |
| `tokens.hair`                | `rgba(15,23,42,0.08)` | `--flota-hair` (input/close borders)                               |
| `tokens.hair2`               | `rgba(15,23,42,0.05)` | `--flota-hair-2` (section dividers)                                |
| `tokens.accent`              | `#B43638`             | `--primary` (CTA bg, Ręczna badge text)                            |
| `tokens.accentSoft`          | `#FBE4E1`             | `--accent` / `--flota-accent-soft` (`bg-accent`) (Ręczna badge bg) |
| `tokens.green` / `greenSoft` | `#1B9E5A` / `#E3F5EC` | `--success` / `--flota-success-soft`                               |
| `tokens.amber` / `amberSoft` | `#B6790E` / `#FBF1DA` | `--warning` / `--flota-warning-soft`                               |
| `tokens.red` / `redSoft`     | `#B43638` / `#FBE4E1` | `--destructive` / `--flota-danger-soft`                            |
| `tokens.greySoft`            | `#EEF1F5`             | `--flota-neutral-soft` (`bg-secondary`)                            |
| `tokens.shadow1`             | soft 1                | `shadow-card`                                                      |
| `tokens.shadow3`             | soft 3                | `shadow-overlay`                                                   |
| `tokens.mono`                | JetBrains Mono        | `font-mono`                                                        |
| `tokens.font`                | Inter                 | `font-sans`                                                        |

## Screen inventory

| Mockup board                            | App surface                                | Device           |
| --------------------------------------- | ------------------------------------------ | ---------------- |
| `MrD_FormOk` / `MrM_FormOk`             | modal — form, available state              | desktop / mobile |
| `MrD_FormConflict` / `MrM_FormConflict` | modal — form, conflict state               | desktop / mobile |
| `MrD_Done` / `MrM_Done`                 | modal — done panel                         | desktop / mobile |
| `MrD_Menu` / `MrM_Menu`                 | (out of scope — single trigger button, D4) | —                |
| `MrD_Confirm`                           | (out of scope — calendar-cell confirm, D4) | —                |

---

## Deviations (recorded — the vision-diff must NOT re-flag these)

- **D1 `deviation(schema+outcome)`** — required fields are **name + email + phone** (the mockup enables create with a name only). Email drives the confirmation; both are DB `NOT NULL`.
- **D2 `deviation(no-data)`** — conflict = a plain **"Termin zajęty"** message (no clashing-booking PII card); available = **"Termin wolny"** without the "next free" hint. The boolean check + atomic EXCLUDE are the authority.
- **D3 `deviation(no-data)`** — no **"Pojazd w serwisie"** availability state (no maintenance status in the model; only active vehicles are selectable).
- **D4 `deviation(scope)`** — no calendar-cell confirm step and no quick-action menu; the entry point is a **single "Nowa rezerwacja" button** that opens the modal directly. (Menu extras Nowy klient / Dodaj pojazd / Szybkie wydanie are out of scope.)
- **D5 `deviation(scope)`** — no company / VAT / notes fields on the staff form (columns stay null).
- **D6 `deviation(reuse-overlay)`** — the modal reuses `ReservationDecision.tsx`'s overlay shell (`fixed inset-0 z-[60] … bg-card shadow-overlay`, mobile `rounded-t-[28px]` sheet with drag-handle, scrim `rgba(20,18,22,0.55)`), overriding its `md:max-w-md` to **`md:max-w-[560px]`** to match the mockup's 560px desktop width.
- **D7 `deviation(added-min)`** — "Ręczna" surfaces as a chip in the calendar's read-only confirmed detail; the calendar keeps its 2-color bars + 2-item legend (no new color).

---

## Surface 1 — Modal shell

- **Desktop**: centered; panel `width: 560px`, `max-height: 90%`, `bg-card`, `rounded-[20px]`, `shadow-overlay`, flex column, `overflow-hidden`. Scrim reused from the overlay idiom (D6). `exact` width; `deviation(reuse-overlay)` scrim/radius alignment.
- **Mobile**: bottom sheet; `border-top-radius 26px` (reuse `rounded-t-[28px]`, D6), `max-height 94%`, `shadow [0_-10px_40px_rgba(0,0,0,0.22)]`, drag-handle bar.

**Header** — padding desktop `22px 24px 16px` / mobile `18px 18px 14px`, `border-bottom: 1px var(--flota-hair-2)`. `exact`.

- Title **Nowa rezerwacja** `font-size:19` (desktop) / `18` (mobile), `weight:700`, `letter-spacing:-0.4`. `exact`.
- **Ręczna** badge: `font-size:9.5 / weight:700 / letter-spacing:0.4 / uppercase`, `bg-accent`, `text-[var(--primary)]`, `padding:3px 8px`, `rounded-full`. `exact`.
- Subtitle **Wynajem dodawany przez pracownika** `font-size:12.5`, `text-muted-foreground`, `margin-top:3`. `exact`.
- Close button `34×34`, `rounded-[10px]`, `border 1px var(--flota-hair)`, `bg-card`, close icon 16 `text-[var(--flota-ink-2)]`. `exact`.

## Surface 2 — Form body

Padding desktop `20px 24px 8px` / mobile `16px 18px 8px`, flex column `gap:18`. Section label (`mrLabel`):
`font-size:11 / weight:700 / letter-spacing:0.4 / uppercase`, `text-muted-foreground`, `margin-bottom:8`. `exact`.

**Pojazd** — vehicle card: `bg-background`, `rounded-[13px]`, `padding:10px 12px`, flex `gap:12`; silhouette tile
`64×42` `rounded-[9px]` `bg-card` `shadow-card`; brand/model `font-size:14 / weight:650 / -0.2`; plate (mono) +
`… zł/doba` `font-size:11.5` muted; a `30×30` `rounded-[8px]` chevron affordance. Select via `ui/select.tsx`
(replaces the mockup's native `<select>` overlay). Options = **active fleet only** (D3). `exact` values; component substitution noted.

**Termin** — grid `2 cols gap:10`; per field: caption (`mrFieldCap`: `font-size:10.5 / weight:600 / uppercase /
muted / margin-bottom:5`) **Odbiór** / **Zwrot** + `<input type="date">` (`height:40 / rounded-[10px] /
border 1px var(--flota-hair) / bg-card / px-2.5 / font-size:13`), `min` = today. Note **Odbiór od 14:00 · zwrot
do 10:00** `font-size:11.5` muted `margin-top:8`. Availability panel `margin-top:10`. `exact`.

**MrAvailability** — box `rounded-[13px]`, padding `13px 15px` (desktop) / `12px 13px` (mobile), flex `gap:11`
items-start. States:

- **idle** — `bg-secondary`, calendar icon 18 muted, `font-size:12.5 / weight:540` muted: "Wybierz pojazd i termin, aby sprawdzić dostępność." `exact`.
- **checking** — `bg-secondary`, `17×17` spinner (`border:2px var(--flota-hair)`, top `var(--flota-ink-2)`, spin .7s), `font-size:12.5 / weight:600` ink2: "Sprawdzanie dostępności…" `exact`.
- **invalid** — `bg-[var(--flota-warning-soft)]`, warning icon warning, `font-size:12.5 / weight:600` warning: "Data zwrotu jest wcześniejsza niż odbiór." `exact`.
- **conflict** — `bg-[var(--flota-danger-soft)]`, warning icon destructive, title **Termin zajęty** `font-size:13 / weight:700` destructive + "Ten pojazd ma już rezerwację w wybranych dniach." `font-size:12` destructive `opacity:0.85`. `deviation(D2)`: clashing-booking card omitted.
- **available** — `bg-[var(--flota-success-soft)]`, check icon success, title **Termin wolny** `font-size:13 / weight:700` success + subtext `font-size:12` success `opacity:0.85`. `deviation(D2)`: "next free" hint replaced with a generic line (e.g. "Można utworzyć rezerwację.").

**Klient** — name input (`mrInputFull`: `width:100% / height:42 / rounded-[11px] / border 1px var(--flota-hair) /
px-3.25 / font-size:13.5`), placeholder **Imię i nazwisko / firma**; grid `2 cols gap:8`: **Telefon** + **E-mail**
inputs. All three **required** (`deviation(D1)`). `exact` styling.

**Footer** — padding desktop `14px 24px 20px` / mobile `12px 18px 18px`, `border-top: 1px var(--flota-hair-2)`,
flex `gap:12`. Left: **{days} dni × {daily} zł** (`font-size:11 / weight:600 / uppercase` muted) + total
(`font-size:18 / weight:750 / -0.5` ink, `tabular-nums`) + **+ {deposit} kaucji** (`font-size:11.5` muted).
Button **Utwórz rezerwację** (`mrBtnPrimary`: `height:46 / rounded-[12px] / bg-primary / text-white / font-size:14
/ weight:650`, check icon; `disabled → opacity:0.4`, enabled shadow `0_8px_22px_rgba(180,54,56,0.24)`). Math via
`format.ts` (`rentalDays`, `estimatedTotal`, `formatPln`, `formatDailyRate`). Pending spinner on submit. `exact`.

## Surface 3 — Done panel

Desktop `width:440`, `rounded-[20px]`, `padding:28`, `text-align:center`. Check circle `62×62` `rounded-full`
`bg-[var(--flota-success-soft)]`, check icon 30 success. Title **Rezerwacja utworzona** `font-size:21 / weight:700
/ -0.5`. Subtitle **Termin zablokowany w kalendarzu. Klient dostanie potwierdzenie e-mailem.** `font-size:13.5`
ink2. Summary card `bg-background rounded-[14px] p-4 text-left`: reference (mono `font-size:13 / weight:700`) +
**Ręczna** badge; customer name `font-size:14 / weight:650`; vehicle `font-size:12.5` muted; dates `font-size:13
/ weight:650` ink2 `tabular-nums`. Buttons **Zobacz w kalendarzu** (ghost → `/dashboard/calendar`) / **Gotowe**
(primary → close). `exact`.

## Surface 4 — Trigger + Ręczna calendar chip

- **Trigger** (`dashboard/reservations.astro`, above `<PendingQueue>`): an ink pill button, `height:38 /
rounded-[10px] / bg-foreground / text-white / font-size:13 / weight:650`, plus icon, label **Nowa
  rezerwacja** — opens the modal directly (D4; no menu). Right-aligned in the page `<main>` header row.
- **Calendar chip** (Phase 4, read-only confirmed detail): `Badge` with `text-success bg-[var(--flota-success-soft)]`,
  label **Ręczna**, shown only when `source === 'manual'`. `deviation(D7)`.

---

## Verbatim Polish copy (canonical)

`Nowa rezerwacja` · `Ręczna` · `Wynajem dodawany przez pracownika` · `Pojazd` · `Termin` · `Odbiór` · `Zwrot` ·
`Odbiór od 14:00 · zwrot do 10:00` · `Klient` · `Imię i nazwisko / firma` · `Telefon` · `E-mail` ·
`Wybierz pojazd i termin, aby sprawdzić dostępność.` · `Sprawdzanie dostępności…` ·
`Data zwrotu jest wcześniejsza niż odbiór.` · `Termin wolny` · `Termin zajęty` ·
`Ten pojazd ma już rezerwację w wybranych dniach.` · `Utwórz rezerwację` · `{n} dni × {rate} zł` ·
`+ {deposit} kaucji` · `Rezerwacja utworzona` ·
`Termin zablokowany w kalendarzu. Klient dostanie potwierdzenie e-mailem.` · `Zobacz w kalendarzu` · `Gotowe`.
