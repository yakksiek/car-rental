# S-06 Return Protocol — UI follow-ups (post-Phase-6 polish)

> Punch-list of layout / design-fidelity misalignments to fix in a later pass. Each item
> is **self-contained — the specific values are already transcribed here, so implement
> directly from this file** without re-opening the Claude Design PNGs for these items.
> For anything ambiguous, or for the closing fidelity check, load the persisted mockups
> (`design-review/` + `design-contract.md`) into a **subagent** and diff the rendered
> surface against them — per `lessons.md` #2 (_port the spec at exact fidelity, with a
> vision-diff gate_). Transcribe exact values; never paraphrase into ranges.
>
> **Resume:** open this file and work the unchecked boxes (or `/10x-implement
return-protocol-comparison phase 6`). Phase-6 code is implemented and green
> (lint / build / unit); these are visual refinements and are **uncommitted** — the working
> tree persists across a context clear, so nothing is lost by not committing first.

## Implemented 2026-07-20 (design-followups pass — uncommitted, lint+build green)

The bulk of this punch-list is now done. Grouped by outcome; individual boxes below are left
as-written for the trail (do not re-implement what this block marks done).

**Done — queue (`ReturnQueue.tsx`, `returns.astro`, `NavIcon.astro`):** nav glyph → plain
down-arrow · mobile 2-pill stats (due + overdue, no `Zwrócono`) / desktop 3 `StatCard`s ·
customer-first rows on BOTH breakpoints · reference on a mono 3rd line (mobile) / inline in the
muted line (desktop) · plate inline as plain mono (Plate pill removed) · mobile hairline between
info + action · action row badge-left/button-right (mobile) / one right-aligned line (desktop) ·
desktop = ONE `rounded-[18px]` card, rows split by `divide-y` (mobile keeps separate cards, ring
outline so it never fights the divider) · header date eyebrow `ŚR · 16 LIPCA` (lookup tables, not
`Intl` — workerd ICU).

**Done — return form (`ReturnProtocolForm.tsx`, `FuelBar.tsx`):** context strip inverted to
vehicle-first + `Truck` silhouette + plate chip · condition metrics are cohesive grey cards
(`bg-background` r14) with a 2-row labelled footer (`Przy wydaniu` / `Przejechano` · `Zmiana
paliwa`) · uppercase letter-spaced labels (`FuelBar` got an opt-in `uppercaseLabel` prop so the
issue form is untouched) · comparison summary header → 11px uppercase label, sub-line dropped ·
baseline `Istniejące` tag uppercase · `Dodaj uszkodzenie` full-width on mobile / header button on
desktop · desktop submit label `Zakończ i wyślij` (mobile keeps `Potwierdź zwrot i wyślij`) ·
Section 1 sub → `Wartości porównane automatycznie z protokołem wydania.`

**Done — return view (`ProtocolView.tsx`):** card radii 18→16 · comparison summary header →
uppercase label, sub dropped · baseline `Istniejące` tag uppercase.

**Decisions taken 2026-07-20 (user):**

- **Return view = RESTRUCTURED to the R6 mockup** — two-column (condition+damage left / photos+
  signature+summary right, mobile interleaves via `order-*` + `display:contents`), form-style
  header (back ‹ / title+context / close ×), a distinct delivery+actions row. Issue view is
  untouched (branch on `isReturn`).
- **Header icon buttons = RESPONSIVE** — circular + soft shadow, no border on mobile; rounded-
  square + border on desktop. Applied to the return form header + the return view's new header.
- **Comparison summary in the view = DARK** ink card (reverted my session's light change), matching
  design-contract §3 + R6 + the form/sent modals. Only `SummaryRow` went dark; `DeltaChip`
  (condition footers) stays light.
- **Return submit CTA = CRIMSON** (`bg-primary`), matching the mockup + the already-crimson queue
  accept button. Kept validate-on-submit (NOT disable-when-empty).

**Already correct (struck, not re-done):** `FuelBar` already has `E`/`F` markers · `SignaturePad`
already renders the compact signed-state row (`Podpisał(a) <name> · o <HH:MM>` + `Zmień`).

**Still open / deferred:** per-type vehicle silhouette (data-blocked — RPC lacks vehicle category) ·
§3 baseline-damage thumbnails (data-blocked — baseline photos not loaded in v1) · `FormSection`
(`PpSection`) radius pin (gated on a `DesignSync` pull, affects shipped issue forms) · current-
damage classification static-tag-vs-segmented reconcile (kept the editor toggle) · MODAL-state
screens (screenshots pending).

---

## Fixed this session — CODE bugs (not design; uncommitted)

- **Photo upload broken on GPU-less Chrome (both forms).** `compressImage` decoded via `createImageBitmap`,
  which throws `"The ImageBitmap could not be allocated"` when Chrome has no working GPU (HW accel off /
  blocklisted / VM / driver fault); every fallback also used `createImageBitmap`, so photo upload was
  impossible and the empty `catch {}` hid it. **Fix:** `src/lib/media/compress.ts` — added a
  `createImageBitmap`-free fallback (`<img>` + `image.decode()` → `ctx.drawImage`), and surfaced the error via
  `console.error` in `src/components/hooks/useProtocolMedia.ts`. Reproduced + verified fixed by driving real
  Chromium (no-GPU headless: fail → 200 after fix). Latent S-05 bug; fixes issue + return forms. Needs a commit.
- **Correction to a design item:** the §2 "photo drop-zone shows on mobile" note was WRONG — `PhotoDropZone`
  is already `hidden sm:flex` (desktop-only). That checkbox can be struck.

## Design source map (if a detail is missing below)

- **Distilled text:** `design-contract.md` (this folder) — covers mobile + desktop for all four surfaces.
- **Live mockups** via the `DesignSync` MCP tool (`get_file`, returns JSX text — cheap), project
  `352d78a6-84fd-49a2-8b38-2fe289691fc3` (canvas `Flota Rental.html`):
  - `return-protocol.jsx` — desktop queue `RtQueueRow` / `ScreenReturnsQueue`, mobile form `RtMobileBody`, read-only `ScreenReturnView`
  - `return-flow.jsx` — **mobile queue card `RtQueueCardM`** (NOT yet pulled — fetch for exact paddings/radii/tokens)
  - `staff-desktop.jsx` — `StaffShell` nav + `StatCard`; `shared.jsx` — tokens + all `t.ret.*` Polish strings
  - Caveat: the claude.ai connector must be re-authorized after a context clear, and is unavailable in headless/cron runs.
- **Reference screenshots:** drop PNGs in `design-review/` and name them per the section (the text notes stand alone regardless).

---

## Surface: Returns queue — MOBILE (`RtQueueCardM`)

Ref: user-pasted mockup 2026-07-20 → `design-review/return-mobile-queue.png` (drop PNG here).
Impl: `src/components/dashboard/ReturnQueue.tsx` (+ header in `src/pages/dashboard/returns.astro`).

The mobile queue has a **distinct card layout** in the design (info section → hairline divider →
action row). The app's mobile view was adapted responsively from the desktop row, so it differs:

- [ ] **Stats: 3 cards → 2 pills (mobile only).** Mockup = two compact rounded-full pills inline —
      `↓ 2 Na dziś` + `⚠ 1 Po terminie` — and **no `Zwrócono` pill** on mobile. Mine renders 3
      full `StatCard`s. Keep the 3 `StatCard`s at `sm+`; render the 2 pills below `sm`.
- [ ] **Row: customer-first.** Bold primary = **customer name**; muted secondary = `brand model · plate`.
      Mine leads with the vehicle (bold) + a plate chip. NOTE: the desktop `RtQueueRow` is also
      customer-first, so apply to **both** breakpoints (this is the vehicle-vs-customer decision —
      it diverges from the shipped `PickupQueue`, which is vehicle-first).
- [ ] **Reference on a 3rd line (mobile).** _Decision 2026-07-20: keep the reference_ (reverses the
      original "drop it" note). The mockup currently omits it; a message was sent to Claude Design to
      add it as a third **muted, mono** line under `brand model · plate`. Impl target — three lines:
      customer name (bold) / `brand model · plate` (muted) / reference e.g. `R-2401` (muted mono).
      Desktop `RtQueueRow` already carries the id inline, so this only changes the mobile card.
- [ ] **Plate inline, not a chip.** Mockup renders the plate as plain text in the muted line
      (`· WX 5519M`); mine uses the `Plate` pill component.
- [ ] **Hairline divider** between the info block and the action row (mockup has one; mine doesn't).
- [ ] **Action row = badge left + button right**, one row (`justify-between`): overdue →
      `Po terminie` badge left + `Przyjmij zwrot` right; returned → `Dostarczono` / `E-mail niewysłany`
      badge left + resend icon + `Otwórz protokół` right; due → button right only. Mine stacks the
      badge over the button, right-aligned.
- [ ] **Header date eyebrow.** Mockup shows `ŚR · 16 LIPCA` (weekday abbrev · day month, uppercase)
      above the "Zwroty" title, instead of my subtitle "Pojazdy do zwrotu na dziś". → `returns.astro`
      header (format `new Date()` as `pl-PL` weekday+day+month; the desktop topbar subtitle can stay).
- [ ] **Per-type vehicle silhouette** vs my generic `Truck` icon. **Data-blocked:** needs
      `list_returns_today` (+ `DispatchReturnRow`) to return the vehicle `category`/type. Defer unless
      the RPC is extended.
- [ ] **Nav glyph = plain down-arrow** (confirmed by the mobile tab bar `↓ Returns` in the mockup);
      mine adds a baseline bar. → `src/components/shell/NavIcon.astro` `return` glyph
      (`M12 5v14M6 13l6 6 6-6`).

**Already fixed this session (not follow-ups — recorded for the trail):** crimson `Przyjmij zwrot`

- chevron · vehicle icon added · overdue moved to a right-side badge + red-soft tint/border · stats
  made responsive (no clip) · rows stack on mobile · time column intentionally omitted (fixed 10:00).

---

## Surface: Returns queue — DESKTOP (`RtQueueRow` / `ScreenReturnsQueue`)

Ref: user-pasted mockup 2026-07-20 → `design-review/return-desktop-queue.png` (drop PNG here).
Impl: `src/components/dashboard/ReturnQueue.tsx`.

- [ ] **One card, hairline-separated rows** (the big one). Mockup: all rows live inside ONE `rounded-[18px]`
      white card, separated by internal hairline dividers, with no per-row radius or gap. Mine renders each
      row as its own `rounded-2xl` `<li>` with gaps between. → wrap the list in one card; separate rows with
      `border-b border-border` (last row none). **This also resolves the "radius too big" perception on
      desktop** — only the outer container is rounded. **Responsive:** mobile keeps SEPARATE cards
      (`RtQueueCardM`), so this is desktop-only (`sm+` = unified list, `<sm` = cards).
- [ ] **Customer-first + reference in the muted line.** Mockup row: **bold customer**, muted
      `brand model · reference · plate` (desktop DOES keep the ref, e.g. `DAF LF · R-2377 · WX 1102D`). Mine:
      vehicle bold + plate chip, `customer · reference` muted. (Same customer-first decision as the mobile card.)
- [ ] **Right cluster on ONE line (desktop).** Mockup: the `Po terminie` badge sits **side-by-side** with
      `Przyjmij zwrot` on one horizontal line (right-aligned); likewise returned rows put the delivery badge +
      resend + `Otwórz protokół` on one line. Mine stacks them in a **column** (`flex shrink-0 flex-col
  items-end`) — a regression introduced when overdue moved to a right badge. → make the right block
      `sm:flex-row sm:items-center` (badge left of the button). File: `ReturnQueue.tsx` right block (~176).
      (Mobile `RtQueueCardM` uses badge-left / button-right on its own divided action row — separate item.)
- [ ] **Per-type silhouette** vs generic `Truck` — data-blocked (needs the vehicle category in `list_returns_today`).
- [x] Done this session: crimson `Przyjmij zwrot` + chevron · overdue red-soft tint + red left border + right
      `Po terminie` badge · 3× `StatCard` stats.

## Global: white-section border-radius reads too large

User obs 2026-07-20 (reference: the shipped requests detail screen). Design-contract §1: **cards 14–18px**,
inputs/buttons 10–13px, chips ~7px — with **18 reserved for the outer list container**, most cards 14–16.
Several app sections sit at the top of the range (or stack many rounded cards), reading as too round:

- [ ] Reduce white-section radii toward the mockup: `ProtocolView` `Section` / header / comparison cards are
      `rounded-[18px]` → target `16` (the mockup `RtSummary` is 16). StatCard `14` and condition boxes `14`
      are already right.
- [ ] Desktop queue: per-row rounding disappears with the one-card restructure (above).
- [ ] Pin the exact `PpSection` radius: pull `pickup-protocol.jsx` (or `protocol-parts.jsx`) via `DesignSync`
      before changing section radii, so the number matches the shipped issue-protocol surfaces too.
- Files: `ReturnQueue.tsx`, `ProtocolView.tsx`, `ReturnProtocolForm.tsx`, `src/components/protocol/FormSection.tsx`.

## Surface: Return view — read-only (`ScreenReturnView`)

Ref: user-pasted R6 desktop mockup 2026-07-20 → `design-review/return-view-desktop.png`.
Impl: `src/components/protocol/ProtocolView.tsx` (return mode) + `src/pages/dashboard/protocols/[id].astro`.
Fixed this session: Section 1 now shows `Przy wydaniu` baseline + per-card delta; summary switched to light (see the ⚠ below).

- [ ] **Two-column layout (desktop).** Mockup: two columns like the form — left Condition + Damage, right
      Photos + Signature + summary. Mine is **single-column** (`max-w-3xl`, stacked). Diverges from the shipped
      **issue** view (also single-column) — decision (same family as the StaffShell/standalone call).
- [ ] **Header = form-style.** Mockup: back ‹ / `Protokół zwrotu` + `R-2401 · Anna Nowak · Ford Transit ·
  WX 5519M · Zwrot 10:00` / close × (circular buttons). Mine uses the issue-view pattern: a text back-link
      (`Wróć do zwrotów`) + a header card with title + badge + buttons.
- [ ] **Delivery + actions as a distinct row.** Mockup: `✓ Dostarczono` + `<email> · <time>` on the left;
      `Wyślij ponownie` + `Pobierz PDF` on the right — a row under the header. Mine folds these into the header card.
- [ ] **⚠ Comparison summary is DARK on desktop (R6) — conflicts with my session change.** I switched
      ProtocolView's summary to the **light** card this session, citing the fetched mobile `ScreenReturnView`
      (which used light). But R6 desktop shows the **dark** ink summary (`PORÓWNANIE WYDANIE → ZWROT`). Reconcile:
      dark everywhere (form + view), or responsive (light mobile / dark desktop)? **Reconsider / possibly revert
      my light change** in `ProtocolView.tsx`.
- [ ] **Inherits the form items** for the read-only sections: 2-row condition footer (`AT PICKUP` /
      `DISTANCE DRIVEN` / `FUEL CHANGE`) + grey cards + uppercase labels (§1); baseline thumbnails + uppercase
      `EXISTING` tag (§3, thumbnails data-blocked); compact `Podpisano przez <name> · <time>` signature — mine
      renders the signature image instead (§4).
- [ ] Read-only signature `Change`/`Zmień` button — mockup shows it, but it's odd on a filed/read-only protocol
      (likely a reused component). Mine has none. Probably leave as-is.

Confirmed matching: `Pobierz PDF` / `Wyślij ponownie` labels · `Dostarczono` badge · section titles/subs ·
comparison rows (`Przejechano` / `Zmiana paliwa` / `Nowe uszkodzenia`). This is the last surface — punch-list complete.

## Surface: Return form — MOBILE, Section 1 (Condition)

Ref: user-pasted mockup 2026-07-20 (R2 · start/empty) → `design-review/return-mobile-form-s1.png` (drop PNG here).
Impl: `src/components/protocol/ReturnProtocolForm.tsx`. **Audit is code-vs-mockup** (form island not rendered —
needs auth + a live baseline). This is Phase-5 form work.

- [ ] **Header icon buttons are circular, not rounded-squares.** Mockup: back (‹) + close (×) are **circles**
      (`rounded-full`, white, subtle shadow, no border). Mine (ReturnProtocolForm ~446–465): `size-10
  rounded-[11px] border` rounded-squares. → `rounded-full` + shadow instead of the border. (The return
      VIEW header uses circular back + download buttons in the mockup too, but mine uses a text back-link —
      tracked separately under the view surface.)
- [ ] **Context strip — invert + add silhouette.** Mockup: vehicle silhouette + **bold `Ford Transit`** +
      `WX 5519M` plate chip / muted `R-2401 · Anna Nowak · Zwrot 10:00`. Mine (ReturnProtocolForm.tsx
      ~471–478): no icon, **bold** `R-2401 · Anna Nowak` / muted `Ford Transit · WX 5519M · Zwrot 10:00`.
      → make it **vehicle-first** with a silhouette + plate chip; muted line = `ref · customer · Zwrot HH:MM`.
      (The form header is vehicle-first — opposite of the queue card, which is customer-first. Intentional.)
- [ ] **Condition card: 2-row footer with a delta LABEL (contract deviation).** The mockup **and**
      design-contract §3 specify: row 1 `Przy wydaniu <base>` (mono), row 2 **`Przejechano`** + chip
      (odometer) / **`Zmiana paliwa`** + chip (fuel). Mine (ReturnProtocolForm.tsx ~522–531, ~554–560)
      collapses to ONE row (`Przy wydaniu <base>` + unlabeled chip). Add the labeled delta row per card.
      (The bottom dark summary already has these labels; the mockup shows them in both places.)
- [ ] **Condition metric = cohesive grey card.** Mockup wraps label + input + footer in one `bg-background`
      rounded box (radius 14, padding 14, hairline border; border→`warning` on the odometer soft-warn).
      Mine puts the label + footer outside a small bordered input box (no card wrapper).
- [ ] **Uppercase labels.** Mockup: `ODOMETER / AT PICKUP / DISTANCE DRIVEN / FUEL LEVEL / FUEL CHANGE`
      (uppercase, letter-spaced). Mine: `Przy wydaniu` is sentence-case; distance/fuel-change labels absent (see above).
- [ ] **`E` / `F` markers** under the fuel bar (mockup has them; shared `FuelBar` in `src/components/protocol/FuelBar.tsx` likely lacks them). Minor.
- [ ] **Section 1 sub — wrong string.** Mockup uses `Wartości porównane automatycznie z protokołem wydania.`;
      mine (ReturnProtocolForm.tsx ~493) uses `Licznik, paliwo i istniejące uszkodzenia. Zdjęcia można zrobić
  telefonem lub wgrać tutaj.` **Contract conflict:** contract §9 lists the longer string for mobile, but the
      actual mockup uses the comparison sub — decide which wins.
- [ ] **Submit button — crimson + disabled-when-empty.** Mockup: crimson CTA (`chrome.cta`), greyed/disabled
      in the empty state. Mine (ReturnProtocolForm.tsx ~757–778): dark `bg-foreground`, disabled only while
      submitting/uploading (not on empty). Same crimson-vs-`bg-foreground` **decision** as the queue accept
      button — reconcile with the shipped issue form (`ProtocolForm.tsx`) if consistency is wanted.

## Surface: Return form — MOBILE, Sections 2–4 + comparison summary

Ref: user-pasted full empty-form mockup 2026-07-20 (R2) → `design-review/return-mobile-form-full.png` (drop PNG here).
Impl: `src/components/protocol/ReturnProtocolForm.tsx`.

- [x] ~~§2 photo drop-zone is desktop-only.~~ **WRONG — already correct.** `PhotoDropZone` is `hidden sm:flex`
      (desktop-only) in `src/components/protocol/PhotoSlot.tsx`. No change needed. (Audit error — I hadn't
      checked the class when I first wrote this.)
- [ ] **§3 "Dodaj uszkodzenie" = full-width button** below the header, above the baseline panel (mockup).
      Mine puts it in the Section `aside` (header top-right, ~577–599). → full-width outline button on mobile.
      (Filled `RtMobileBody` had it in the header; the empty-state `ScreenReturnStart` lives in the un-fetched
      `return-flow.jsx` and shows full-width — confirm there before implementing.)
- [ ] **§3 baseline rows: thumbnail.** Mockup shows a dark camera thumbnail per `Uszkodzenia z protokołu
  wydania` row; mine (~602–618) is text + `Istniejące` tag only. **Data-blocked:** baseline photos aren't
      loaded in v1 (plan decision) — add a placeholder icon box to match, or accept the difference.
- [ ] **§3 `Istniejące` tag uppercase.** Mockup tag = uppercase (`EXISTING`); mine is sentence-case. Same
      uppercase-label theme as the condition labels.
- [ ] **Comparison summary header = uppercase label, no sub-line.** Mockup: 11px UPPERCASE label
      `PORÓWNANIE WYDANIE → ZWROT`, then only the empty hint `Wprowadź bieżące wartości…` (or the rows). Mine
      uses a 15px **bold heading + a sub-line** `Wartości porównane automatycznie…` — in BOTH the form
      (dark, ReturnProtocolForm ~649–653) AND the return view (light, `ProtocolView.tsx`, added this session).
      → drop the sub, make the header the small uppercase label, in both places.

Confirmed matching (empty form): header **title/copy** `Protokół zwrotu` (button _shape_ differs — see the
header item in §1) · §4 ack checkbox + `Klient potwierdza…` + full-screen signer field · empty-hint copy ·
numbered section badges · Polish section titles/subs.

### Filled / soft-warn state (R5) — additional

Ref: user-pasted filled mockup 2026-07-20 (R5, odometer below pickup) → `design-review/return-mobile-form-filled.png`.

- [ ] **§4 signature signed-state.** Mockup: a compact row — green check + `Podpisano przez <name>` + `o <HH:MM>` + a `Zmień` button. Verify my signed state matches (it may render the signature image instead of the
      compact confirmation). File: `src/components/protocol/SignaturePad.tsx`.
- [ ] **§3 current-damage classification — reconcile the two design versions.** This screenshot: a **static
      `Nowe`/`Istniejące` tag** on the row (toggle in the editor). Contract §3 + fetched `RtDamageRow` (form):
      an **inline segmented `[ Istniejące | Nowe ]`** on the row. Decide which; my impl keeps the toggle in
      `DamageEditor.tsx` (matches this screenshot). Current-damage row also shows a thumbnail + `N zdjęć` count.

Confirmed by the filled state: soft-warn keeps submit **enabled** + amber card border + negative distance ·
crimson **enabled** submit · fuel bar filled + `−4/8` bad chip · dark summary rows (`Przejechano +1 228 km` /
`Zmiana paliwa −4/8` / `Nowe uszkodzenia +1`) · photos 6/6 with check badges · no drop-zone on mobile.

## Surface: Return form — DESKTOP (two-column)

Ref: user-pasted desktop mockup 2026-07-20 → `design-review/return-desktop-form.png`.
Impl: `src/components/protocol/ReturnProtocolForm.tsx` (+ page `src/pages/dashboard/returns/[reservationId].astro`).

- [x] **StaffShell wrapper — DECIDED (2026-07-20): keep STANDALONE, do NOT wrap.** The desktop form stays
      standalone (own back/title/close header, no sidebar), matching the shipped **issue** form. Rationale:
      (1) consistency with the issue form; (2) capture is a focus flow — no sidebar ⇒ no accidental nav away
      mid-entry (lost photos/signature); (3) the form header already provides back/close; (4) wrapping would
      double the header + force re-touching shipped S-05. The mockup shows StaffShell, but the app deliberately
      diverges for BOTH protocol forms. **No change.**
- [x] **Desktop footer `Wstecz` — DECIDED (2026-07-20): NOT needed.** Our form header has a back arrow (‹) +
      close (×), so a footer back button is redundant. Footer stays as the single primary submit. Intentional
      divergence from mockup/contract §4 (our header differs from the mockup's). **No change.**
- [ ] **Desktop submit label = `Zakończ i wyślij`.** Mockup desktop CTA is `Zakończ i wyślij` (contract §4);
      mobile is `Potwierdź zwrot i wyślij`. Mine uses the mobile label on **both** breakpoints → swap by breakpoint.

Confirmed matching (desktop): numbered section **cards** in a 2-col grid (`lg:grid-cols-[1.35fr_1fr]`) — left =
Condition + Damage, right = Photos (with drop-zone) + Signature + dark summary · this updated mockup uses the
numbered cards (mine matches — better than the old `DeskReturnBody`) · §1 sub = comparison sub (mine still shows
the longer string — see §1) · 2-row condition footers · dark summary uppercase label + 3 rows · `+ Add damage`
in the section header on desktop (mobile wants it full-width) · photos 6/6 + drop-zone shown.

## Surface: Return form — MODAL states (screenshots pending)

_Awaiting: sent / email-failed / pdf-failed / conflict / full-screen signature modals._
