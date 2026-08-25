# Design Contract — S-12 manual-reservation (Nowa rezerwacja)

Source of truth: **`manual-reservation.jsx`** (`ManualResFlow` — confirm→form→done — with `MrAvailability`,
`QuickAddButton`; static boards `MrD_FormOk/FormConflict/Done`, `MrM_*`), live in Claude Design
`352d78a6-84fd-49a2-8b38-2fe289691fc3`, pulled via DesignSync. Values transcribed **exactly**; each line
`exact` or `deviation(reason)`. We ship the **form → done** flow only (no calendar-cell confirm, no quick-menu).

---

## Design Alignment Audit

### Freshness audit (repo vs canonical)

| Artifact                                 | Status      | Note                                                                                                                                                                                          |
| ---------------------------------------- | ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `manual-reservation.jsx` (design source) | **current** | Pulled this session; the exact-values source below.                                                                                                                                           |
| `manual-reservation` screenshot in repo  | **current** | 10 canonical PNGs landed in `design-review/` (desktop + mobile × menu / confirm / form-available / form-conflict / created). Mirrored at `exports/manual-reservation/` in the Design project. |
| `ReservationDecision.tsx` overlay idiom  | **current** | Reused as the modal shell (see D6).                                                                                                                                                           |
| Calendar designs (rows 16/22)            | **current** | Phase 4 only adds a chip to the read-only detail — no restyle.                                                                                                                                |

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

**PASS (paper audit)** — 4 surfaces aligned; 0 repo designs superseded; **9 deviations recorded (D1–D9)**
plus the inline `deviation(undrawn-state)` / `deviation(busy-guard)` lines below.

**Revised 2026-08-11 (S-12 Phase 7)** after the implementation review re-pulled `manual-reservation.jsx`
via DesignSync. Three contract lines were wrong and the code was right — the modal is a more faithful port
than this document was a record of it. Corrected: **D6** (mobile top radius is 26px `exact`, and the modal
has no drag handle), **D8** (the native-`<select>` overlay is the source's own affordance, not a
substitution to be undone), **D9** (the invalid-range copy must cover `ret == pick`). Two `exact` values
the code got wrong were fixed instead — the `12`/`8` radii, see the note under Surface 2. Every value in
`ManualReservationModal.tsx` now maps to an `exact` line or a recorded `deviation(reason)` here.

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
- **D6 `deviation(reuse-overlay)`** — the modal reuses `ReservationDecision.tsx`'s overlay shell (`fixed inset-0 z-[60] … bg-card shadow-overlay`, scrim `rgba(20,18,22,0.55)`), overriding its `md:max-w-md` to **`md:w-[560px]`** to match the mockup's 560px desktop width. The mobile top radius is **`exact` 26px** (`rounded-t-[26px]`) and there is **no drag handle** — corrected 2026-08-11 against the design source: `ManualResFlow`'s shell is `borderTopLeftRadius/borderTopRightRadius: 26` with children header → scroll body → footer. The only drag handle in `manual-reservation.jsx` (`{width:40, height:4, borderRadius:99}`) belongs to the **quick-action sheet**, which D4 puts out of scope. The earlier "reuse `rounded-t-[28px]` sheet with drag-handle" line described a surface that does not exist.
- **D7 `deviation(added-min)`** — "Ręczna" surfaces as a chip in the calendar's read-only confirmed detail; the calendar keeps its 2-color bars + 2-item legend (no new color).
- **D8 `deviation(native-select)`** — the vehicle picker is a **transparent native `<select>` laid over the card** (`position:absolute; inset:0; opacity:0`, `aria-label="Pojazd"`, whole card as hit target), **not** `ui/select.tsx`. Corrected 2026-08-11: this overlay is the design source's own affordance, so the styling is an exact port, and it keeps the native mobile picker plus keyboard/screen-reader behaviour for free. The earlier "Select via `ui/select.tsx`" line was a plan-time substitution the source does not support.
- **D9 `deviation(same-day-rejected)`** — the invalid-range copy ships as **"Data zwrotu musi być późniejsza niż data odbioru."** (`validateDateRange`, `catalog-filters.ts:29`) rather than the source's "Data zwrotu jest wcześniejsza niż odbiór." The source's guard is `new Date(ret) < new Date(pick)`, so a **same-day** range is valid there; our stack rejects it because `reserved_period` is `tsrange(pickup + 14:00, return + 10:00)` and inverts when `ret == pick` (hardened in both create RPCs by migration `20260810140000`). For the equal-dates case the source's wording is literally false, so the copy must cover it.

---

## Surface 1 — Modal shell

- **Desktop**: centered; panel `width: 560px` (`md:w-[560px]`), `max-height: 94%`, `bg-card`, `rounded-[20px]` (`md:rounded-[20px]`), `shadow-overlay`, flex column, `overflow-hidden`. Scrim reused from the overlay idiom (D6). `exact` — 560 and 20 verified against the source; the height was recorded as `90%` in error and corrected to the source's `94%` in S-12a Phase 4, so both breakpoints now share one `max-h-[94%]` and the `md:max-h-[90%]` override is gone. **While a `Termin` field's picker is open the scrim top-aligns** (`align-items: flex-start`, `padding-top: 56`) so the grown modal does not overflow — see the S-12a contract.
- **Mobile**: bottom sheet; `border-top-radius 26px` → `rounded-t-[26px]` **`exact`**, `max-height 94%`, `shadow-overlay`. **No drag-handle bar** (D6).
- **The page behind the scrim does not scroll**: `document.body { overflow: hidden }` for as long as the modal is mounted, restored on unmount. `deviation(undrawn-state)` — a static artboard cannot draw scroll behaviour, so the source says nothing about it. Reuses the house idiom from `MobileNav.tsx:65`. Added in S-12a Phase 6 after the leak was measured: with the document left scrollable, a wheel over the scrim moved the dashboard behind by 114px, and once the modal's own body reached its end the scroll chained straight through to the page. Present since S-12; the in-flow calendar only made the modal tall enough to hit the chain point on the first gesture. The modal's **own** body keeps scrolling internally — that is what pins the footer.
- **The whole form while a create is in flight**: `disabled`. `deviation(busy-guard)` — the source draws no disabled state for any of these. It covers the **close button** (`disabled` + `opacity 0.4`; 0.4 is the source's own disabled opacity, see `mrBtnPrimary` below), reused so the modal cannot be dismissed mid-POST and orphan a committed booking — **and, widened in S-12a Phase 1 (F11), the vehicle `<select>`, the `Termin` field and the three `Klient` inputs**. The `<select>` and the three `Klient` inputs keep their normal look (`disabled` only, no opacity change) — the pending signal is already carried by the submit button's spinner; the `Termin` field, which S-12a Phase 4 turns into an `mrDateBtn` button and Phase 6 collapses from two to one, takes `disabled` + `opacity 0.4` like the other buttons on the surface (per the S-12a contract). Freezing them is what makes the state read at `setCreated` identical to the state POSTed, so the done panel cannot print dates that were never booked. From S-12a Phase 4 the same freeze also unmounts the picker — the desktop popover and, from Phase 6, the mobile sheet layer — because a `disabled` trigger does not close an already-open one.

**Header** — padding desktop `22px 24px 16px` / mobile `18px 18px 14px`, `border-bottom: 1px var(--flota-hair-2)`. `exact`.

- Title **Nowa rezerwacja** `font-size:19` (desktop) / `18` (mobile), `weight:700`, `letter-spacing:-0.4`. `exact`.
- **Ręczna** badge: `font-size:9.5` (header — the done panel's is `10`) `/ weight:700 / letter-spacing:0.4 / uppercase`, `bg-accent`, `text-[var(--primary)]`, `padding:3px 8px`, `rounded-full`. `exact` — both sizes verified against the source.
- Subtitle **Wynajem dodawany przez pracownika** `font-size:12.5`, `text-muted-foreground`, `margin-top:3`. `exact`.
- Close button `34×34`, `rounded-[10px]`, `border 1px var(--flota-hair)`, `bg-card`, close icon 16 `text-[var(--flota-ink-2)]`. `exact`.

## Surface 2 — Form body

Padding desktop `20px 24px 8px` / mobile `16px 18px 8px`, flex column `gap:18`. Section label (`mrLabel`):
`font-size:11 / weight:700 / letter-spacing:0.4 / uppercase`, `text-muted-foreground`, `margin-bottom:8`. `exact`.

**Pojazd** — vehicle card: `bg-background`, `rounded-[13px]`, `padding:10px 12px`, flex `gap:12`; silhouette tile
`64×42` `rounded-[9px]` `bg-card` `shadow-card` — the glyph inside is the house lucide `Truck`
(`size-6`, `strokeWidth 1.5`), `deviation(icon-set)`: the source draws a bespoke van line-art the app has
no equivalent for, and every other vehicle affordance in the console already uses this icon; brand/model `font-size:14 / weight:650 / -0.2`; plate (mono) +
`… zł/doba` `font-size:11.5` muted; a `30×30` `rounded-[8px]` (`rounded-sm`) chevron affordance. The picker is
the source's own **transparent native `<select>` over the whole card** (`deviation(native-select)`, D8).
Options = **active fleet only** (D3). `exact` values.

**Termin** — **SUPERSEDED by `context/changes/manual-reservation-date-picker/design-contract.md`
(S-12a).** The grid (`2 cols gap:10`), the `mrFieldCap` captions **Odbiór** / **Zwrot**, the note **Odbiór od
14:00 · zwrot do 10:00** (`font-size:11.5` muted `margin-top:8`) and the availability panel's `margin-top:10`
all carry over unchanged and stay `exact`.

What is **withdrawn** is the `<input type="date">` line, which recorded a native date input as `exact`. It was
wrong against the source — a DesignSync pull on 2026-08-20 found `manual-reservation.jsx` draws `mrDateBtn`
**buttons** (calendar icon + `d MMM yyyy` label + chevron) expanding an availability-aware `MrCalendarPopover`,
and had done since after the S-12 screenshots were exported. Same class of error as the three lines Phase 7
corrected. The S-12a contract carries the buttons-plus-popover spec, and the 10 S-12 `design-review/*.png` are
stale for this block only.

**MrAvailability** — box `rounded-[13px]`, padding `13px 15px` (desktop) / `12px 13px` (mobile), flex `gap:11`
items-start. States:

- **idle** — `bg-secondary`, calendar icon 18 muted, `font-size:12.5 / weight:540` muted: "Wybierz pojazd i termin, aby sprawdzić dostępność." `exact`.
- **checking** — `bg-secondary`, `17×17` spinner (`border:2px var(--flota-hair)`, top `var(--flota-ink-2)`, spin .7s), `font-size:12.5 / weight:600` ink2: "Sprawdzanie dostępności…" `exact`.
- **invalid** — `bg-[var(--flota-warning-soft)]`, warning icon warning, `font-size:12.5 / weight:600` warning: **"Data zwrotu musi być późniejsza niż data odbioru."** `deviation(same-day-rejected)` (D9) — the source's "Data zwrotu jest wcześniejsza niż odbiór." is false for `ret == pick`, which our stack rejects. Styling `exact`.
- **error** — the check itself failed. Shares the `invalid` warning treatment (same box, icon and type): "Nie udało się sprawdzić dostępności." `deviation(undrawn-state)` — the source has no failed-check state; the app can fail the GET, so it needs one, and reusing the warning look keeps "we cannot confirm this yet" as one visual idea.
- **conflict** — `bg-[var(--flota-danger-soft)]`, warning icon destructive, title **Termin zajęty** `font-size:13 / weight:700` destructive + "Ten pojazd ma już rezerwację w wybranych dniach." `font-size:12` destructive `opacity:0.85`. `deviation(D2)`: clashing-booking card omitted.
- **available** — `bg-[var(--flota-success-soft)]`, check icon success, title **Termin wolny** `font-size:13 / weight:700` success. **There is no subtext** — see the S-12a contract's **D10**, which is authoritative for this state. S-12 shipped an invented "Można utworzyć rezerwację."; S-12a Phase 6 dropped the subtitle outright rather than replacing it, so the box is single-line and centers like `checking`. (Earlier revisions of this line quoted "Pojazd wolny do {d MMM}" / "Brak innych rezerwacji w tym okresie." as the replacement — that copy is retired; do not reintroduce it.)

**Klient** — name input (`mrInputFull`: `width:100% / height:42 / rounded-[11px] / border 1px var(--flota-hair) /
px-3.25 / font-size:13.5`), placeholder **Imię i nazwisko / firma**; grid `2 cols gap:8`: **Telefon** + **E-mail**
inputs. All three **required** (`deviation(D1)`). `exact` styling.

**Footer** — padding desktop `14px 24px 20px` / mobile `12px 18px 18px`, `border-top: 1px var(--flota-hair-2)`,
flex `gap:12`. Left: **{days} dni × {daily} zł** (`font-size:11 / weight:600 / letter-spacing:0.3 / uppercase`
muted — the `0.3` is `exact`, → `tracking-[0.3px]`) + total (`font-size:18 / weight:750 / -0.5` ink,
`tabular-nums`) + **+ {deposit} kaucji** (`font-size:11.5` muted). `exact`, and **the deposit carries no
`zł`** — the total immediately before it already does. Rendered with `formatPlnAmount` (not `formatPln`)
and `whitespace-nowrap`; with the currency repeated, "kaucji" orphaned onto a third line at 390px and
overflowed the mobile sheet's footer — caught by the Phase 8 vision-diff.
Button **Utwórz rezerwację** (`mrBtnPrimary`: `height:46 / rounded-[12px] / bg-primary / text-white / font-size:14
/ weight:650`, check icon; `disabled → opacity:0.4`, enabled shadow `0_8px_22px_rgba(180,54,56,0.24)`). Math via
`format.ts` (`rentalDays`, `estimatedTotal`, `formatPln`, `formatDailyRate`). `exact`.
**While the panel reads `conflict`** the source also swaps the background to `tokens.muted`
(`--muted-foreground`, `#94A3B8`) **on top of** the `opacity 0.4`, so a blocked range greys the action out
rather than dimming a crimson one. `exact` — recorded in error as `bg-primary`-throughout and corrected in
S-12a Phase 4.

> **Radius `12` is `rounded-md`, not `rounded-xl`.** This project overrides the Tailwind radius scale
> (`global.css:71` → `:162`): `rounded-xl` renders **20px**, `rounded-md` **12px**, `rounded-sm` **8px**.
> So `mrBtnPrimary` / `mrBtnGhost` (12) → `rounded-md` and the chevron (8) → `rounded-sm`. Corrected
> 2026-08-11 (three buttons + the chevron had shipped 8px too round).

**Pending state** — while the create is in flight the submit button is `disabled` and swaps its check icon +
label for a spinner + **Tworzenie…** (house async-button rule, `CLAUDE.md`). `deviation(undrawn-state)` — the
source draws no in-flight state.

**Create-failure banner** — above the footer, in the scroll body: `rounded-[13px]`,
`bg-[var(--flota-danger-soft)]`, padding `13px` / `12px`, `font-size:12.5 / weight:600` destructive. One of
three strings, by outcome. `deviation(undrawn-state)` — the source has no create-failure state (it always
succeeds); a 409 or a 500 must say something.

## Surface 3 — Done panel

Desktop `width:440`, `rounded-[20px]` (`md:rounded-[20px]`) / mobile `rounded-[22px]` — both `exact`;
`padding:28`, `text-align:center`. Check circle `62×62` `rounded-full`
`bg-[var(--flota-success-soft)]`, check icon 30 success. Title **Rezerwacja utworzona** `font-size:21 / weight:700
/ -0.5`. Subtitle **Termin zablokowany w kalendarzu. Klient dostanie potwierdzenie e-mailem.** `font-size:13.5`
ink2. Summary card `bg-background rounded-[14px] p-4 text-left`: reference (mono `font-size:13 / weight:700`) +
**Ręczna** badge; customer name `font-size:14 / weight:650`; vehicle `font-size:12.5` muted; dates `font-size:13
/ weight:650` ink2 `tabular-nums`. The **Ręczna** badge here is `font-size:10` (the header's is `9.5`) — `exact`.
Buttons **Zobacz w kalendarzu** (`mrBtnGhost`) / **Gotowe** (`mrBtnPrimary`), both `height:46 /
rounded-[12px]` → `rounded-md` (see the radius note under Surface 2). `exact`.

## Surface 4 — Trigger + Ręczna calendar chip

- **Trigger** (`dashboard/reservations.astro`, above `<PendingQueue>`): an ink pill button, `height:38 /
rounded-[10px] / bg-foreground / text-white / font-size:13 / weight:650`, plus icon, label **Nowa
  rezerwacja** — opens the modal directly (D4; no menu). Right-aligned in the page `<main>` header row.
- **Calendar chip** (Phase 4, read-only confirmed detail): `Badge` with `text-success bg-[var(--flota-success-soft)]`,
  label **Ręczna**, shown only when `source === 'manual'`. `deviation(D7)`.

---

## Verbatim Polish copy (canonical)

**Ported from the source, verbatim:**

`Nowa rezerwacja` · `Ręczna` · `Wynajem dodawany przez pracownika` · `Pojazd` · `Termin` · `Odbiór` · `Zwrot` ·
`Odbiór od 14:00 · zwrot do 10:00` · `Klient` · `Imię i nazwisko / firma` · `Telefon` · `E-mail` ·
`Wybierz pojazd i termin, aby sprawdzić dostępność.` · `Sprawdzanie dostępności…` · `Termin wolny` ·
`Termin zajęty` · `Ten pojazd ma już rezerwację w wybranych dniach.` · `Utwórz rezerwację` ·
`{n} dni × {rate} zł` · `+ {deposit} kaucji` · `Rezerwacja utworzona` ·
`Termin zablokowany w kalendarzu. Klient dostanie potwierdzenie e-mailem.` · `Zobacz w kalendarzu` · `Gotowe`.

**Diverges from the source** — `deviation(same-day-rejected)`, D9:

- invalid range → `Data zwrotu musi być późniejsza niż data odbioru.` (the source has
  `Data zwrotu jest wcześniejsza niż odbiór.`, which is false for `ret == pick`).

**Not in the source** — `deviation(undrawn-state)`. These cover states the mockup never draws; all are
new canonical Polish, so they are as binding as the ported strings:

- availability check failed → `Nie udało się sprawdzić dostępności.`
- create failed, generic (incl. 500) → `Nie udało się utworzyć rezerwacji. Spróbuj ponownie.`
- create lost the race (409 `conflict`) → `Termin został właśnie zajęty. Wybierz inny termin.`
- create found the vehicle gone (409 `unavailable`) → `Ten pojazd nie jest już dostępny.`
- submit button, in flight → `Tworzenie…`
- close button, `aria-label` → `Zamknij`

Vehicle option label (native `<select>`, D8) → `{make} {model} · {plate}`.
