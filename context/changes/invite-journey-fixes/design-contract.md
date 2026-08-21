# Design Contract — invite-journey-fixes

> Plan: `context/changes/invite-journey-fixes/plan.md`
> Research: `context/changes/invite-journey-fixes/research.md` (Part 3 sources this contract)
> **Inherits by reference** — `context/archive/2026-08-11-auth-surface-hardening/design-contract.md`
> §5 (token map), §7 (shared elements — exact values), §9 (Polish copy conventions), §10 entry 14
> (the no-artboard precedent). That file is archived and read-only; nothing here amends it.
> Inheriting by reference rather than re-deriving is the same move S-14 §1-9 made against S-08 §3.14.

---

## Design Alignment Audit

### 1. Freshness — repo vs canonical

| Design asset                                                              | Surface it governs                     | Status                             |
| ------------------------------------------------------------------------- | -------------------------------------- | ---------------------------------- |
| `context/foundation/design/screenshots/19-admin-desktop-employees.png`    | Roster · admin · desktop (catalog 19)  | **current**                        |
| `context/foundation/design/screenshots/25-admin-mobile-employees.jpg`     | Roster · admin · mobile (catalog 25)   | **current**                        |
| `…/2026-08-11-auth-surface-hardening/design-review/auth-authed-{d,m}.png` | R11 `link-conflict.astro`              | **current** (S-14, 2026-08-11)     |
| `…/design-review/auth-authed-busy-d.png`                                  | R11 sign-out pending state             | **current**                        |
| `…/design-review/auth-inapp-{d,m}.png`                                    | R12 `reset-password.astro`, no token   | **current**                        |
| `…/design-review/auth-nolink-{d,m}.png`                                   | R13 `reset-password.astro`, no session | **current**                        |
| `…/design-review/auth-expired-{d,m}.png`                                  | R5 "Link wygasł"                       | **current**                        |
| `…/design-review/auth-set-{d,m}.png` · `auth-invite-{d,m}.png`            | R3/R9 and R6/R10 set-password forms    | **current**                        |
| `…/design-review/auth-success-{d,m}.png`                                  | R4 success card                        | **current**                        |
| — none —                                                                  | R14 "Konto jest nieaktywne"            | **missing** — inherited, see below |
| — none —                                                                  | Roster provisioning-failure banner     | **missing** — new, see §2          |

**No repo design is superseded by this change**; every asset above is still the canonical baseline.

> **Correction, recorded 2026-08-21 during the phase-1 vision-diff (row 1.11), and REVISED the same
> day after reading the design source.** The healthy roster is provably pixel-identical to before this
> change (`git diff 798f24a..HEAD -- StaffList.tsx` touches copy and the `addEmployee` branch only;
> **zero** JSX or `className` changes), so row 1.11's assertion holds either way.
>
> The first version of this note said catalog 19 was stale _against the shipped app_ — that the app
> had diverged from its artboard. **That was wrong, and the direction matters.** Reading
> `employee-states.jsx` in the design project shows `EsShell` rendering exactly what the app ships:
> filter pills with counts in a white card, avatar stack pinned right. The **design** is current; it
> is the repo's `19-admin-desktop-employees.png` that is a **stale export** of an older iteration
> showing three count tiles. So the gap is a pull that never happened, not a divergence — same class
> of miss as the un-pulled banner artboard below. Refreshing the repo's copy belongs to whoever next
> changes the roster's design.

> **Second correction, 2026-08-21 — the banner artboard EXISTS.** §1 lists "Roster provisioning-failure
> banner" as **missing — new**, and §2 says "the roster mockups carry no banner state". Both are true
> of the two files in `context/foundation/design/screenshots/`, and both are **false of the design
> project**: `DesignSync list_files` on `Rental car company` returns
> `design-review/emp-error.png`, which `design-review/index.md` labels **"Mutation error banner"**,
> alongside nine other S-08 employee-state artboards (`emp-add`, `emp-add-dup`, `emp-remove`,
> `emp-lastadmin`, `emp-self`, `emp-empty`, `emp-nores`, `emp-loading`, `am-team`). The freshness
> audit looked only at the repo, not at the source of truth `design-system.md` names — so it recorded
> a gap that is really an **un-pulled asset**.
>
> **Consequences.** §10 entry 1's `deviation(no artboard — copy-only)` rests on a false premise: there
> IS an artboard for this element. The deviation is still copy-only — we add strings to a designed
> element and change no dimension — but the correct framing is "copy variant against an existing
> artboard we had not pulled", and phase 7's banner work should diff against `emp-error.png` rather
> than against the shipped element alone. Pull it into `design-review/` before phase 7 rewrites the copy.

> **Third correction, 2026-08-21 — catalog 19 encodes the row-action defect phase 8 removes.**
> Spotted by the owner while reviewing the rendered roster. Catalog 19's fifth row is
> `Karolina Mazur | EMPLOYEE | ● INVITED | zaproszenie · 2 dni temu | [Reset password] [×]` — an
> **invited, password-less** person offered `Reset password`. The shipped app reproduces it faithfully
> (`Łukasz Piątek`, ZAPROSZONY, `Resetuj hasło`), because the app was ported from this artboard.
>
> That action sends `resetPasswordForEmail`, i.e. a **recovery** link and recovery copy, to someone
> who has never had a password — the option-2b journey downgrade. Phase 8 makes the two row actions
> mutually exclusive (an invite action while `password_set_at` is null, `Resetuj hasło` only once it
> is set), which therefore **diverges from a canonical design** rather than merely from current
> behaviour. The invite action later split into two labels — see §9.2's reversal and §12.2b.
>
> **Recorded as `deviation(the artboard encodes a journey defect)`** so a later fidelity pass does not
> re-flag it and "restore" the button. If the phase-8 artboard is minted, it must show the new rule —
> porting catalog 19 faithfully would rebuild the defect.

Two gaps are pre-existing rather than introduced here:

- **R14 has no artboard.** `auth-followups` shipped it as a no-artboard card and amended S-14's
  contract in place. This change does not alter what R14 renders — phase 5 only re-sources the data
  behind it — so the gap is inherited, not widened.
- **The auth surface has never been in the design catalog.** `design-system.md` rows 01–29 are app
  screens only: no auth row, and no auth screenshot under `context/foundation/design/screenshots/`.
  The 21 auth artboards live only at `…/2026-08-11-auth-surface-hardening/design-review/` and were
  not pruned at archive. S-14 left a standing to-do to promote them (`design-contract.md:164-167`)
  that was never done. **This change inherits that to-do and does not discharge it** — promoting 21
  artboards into the foundation catalog is out of scope here (see plan → "What We're NOT Doing").

### 2. Quality — gaps in the canonical designs

No new artboards were produced for this change, and none were requested: phase group A adds a copy
variant to an already-shipped element, and phase group B is explicitly a no-visual-delta re-sourcing.
The gaps that follow from that:

- **The roster mockups carry no banner state.** Catalog 19 and 25 show the healthy roster only —
  five rows, three count tiles, and the info footer. The mutation banner is an in-repo element
  (`StaffList.tsx:621-656`, contract §3.12) with two shipped variants (`error`, `success`) and no
  artboard of its own. Phase 1's three new strings are therefore **copy-only deviations against a
  designed element**, not new layout. Recorded as such in §10.
- **No artboard distinguishes the two rollback outcomes.** Whether the compensating `deleteUser`
  succeeded changes only the sentence, not the element — so one variant serves both.
- **Mobile is covered by inheritance.** The banner sits inside the shared
  `mx-auto w-full max-w-[1024px] px-4 py-6 md:px-6` content column, so it reflows at the same
  breakpoint as every other roster element; no separate mobile spec is owed.

### 3. Alignment — every canonical surface has a phase, every phase has a design

| Surface                                   | Phase | Design reference                                               | Verdict                                        |
| ----------------------------------------- | ----- | -------------------------------------------------------------- | ---------------------------------------------- |
| Roster mutation banner (3 new strings)    | 1, 3  | catalog 19 / 25 + in-repo §3.12 element                        | `deviation(no artboard — copy-only)`           |
| Roster ACTIVE/INVITED badge               | 3     | catalog 19 / 25                                                | `exact` — element unchanged, input fixed       |
| `link-conflict.astro` (R11)               | 5     | `auth-authed-{d,m}.png`                                        | `exact` — comment-only edit, zero render delta |
| `reset-password.astro` R14 branch         | 5     | — (inherited no-artboard card)                                 | `exact` — re-sourced, zero render delta        |
| `reset-password.astro` R12/R13/R5/R4      | 5     | `auth-inapp` / `auth-nolink` / `auth-expired` / `auth-success` | `exact` — zero render delta                    |
| `reset-password.astro` form + account box | 5     | `auth-set-{d,m}.png` · `auth-invite-{d,m}.png`                 | `exact` — zero render delta                    |

**No plan phase contradicts a canonical design, and no canonical surface lacks a phase.** Phase group
B touches six auth surfaces without changing any of them: the token-lookup RPC exists precisely so
that R14 and the account box keep the inputs they render from. That is the alignment claim phase 5's
vision-diff gate must falsify or confirm.

### 4. Verdict

**Design Alignment Audit: PASS — 6 surfaces, 0 repo designs superseded, 1 deviation recorded.**

Two inherited gaps are recorded and knowingly carried: R14's missing artboard, and the auth set's
absence from the foundation catalog.

---

## 5. Token map

**Inherits S-14 §5 verbatim. No new token is required** — every colour the banner needs already has a
semantic name in `src/styles/global.css` and is already used by the shipped element.

One trap carried forward from S-14 §7.2, do not copy that line unchecked: `@theme inline` remaps the
radius scale, so **`rounded-xl` renders 20px, not 12px**. The banner uses `rounded-lg`, which is
unaffected — but any new element added during implementation must be checked against the remap
rather than against Tailwind's stock scale.

## 6. Screen inventory

| Mockup reference                               | App surface                                               | Phase |
| ---------------------------------------------- | --------------------------------------------------------- | ----- |
| `19-admin-desktop-employees.png`               | `/dashboard/staff` → `src/components/staff/StaffList.tsx` | 1, 3  |
| `25-admin-mobile-employees.jpg`                | same, below `lg`                                          | 1, 3  |
| `design-review/boards-after/emp-roster.png`    | same — third badge + one-action-per-state rows (desktop)  | 8     |
| `design-review/boards-after/emp-tablet.png`    | same, tablet card list                                    | 8     |
| `design-review/boards-after/emp-add.png`       | add modal — `Dodaj` CTA + rewritten subtitle              | 8     |
| `auth-authed-{d,m}.png`                        | `src/pages/auth/link-conflict.astro`                      | 5     |
| `auth-inapp-{d,m}.png`                         | `src/pages/auth/reset-password.astro` (R12)               | 5     |
| `auth-nolink-{d,m}.png`                        | `src/pages/auth/reset-password.astro` (R13)               | 5     |
| `auth-expired-{d,m}.png`                       | `src/pages/auth/reset-password.astro` (R5)                | 5     |
| `auth-success-{d,m}.png`                       | `src/pages/auth/reset-password.astro` (R4)                | 5     |
| `auth-set-{d,m}.png` · `auth-invite-{d,m}.png` | `src/pages/auth/reset-password.astro` (form)              | 5     |

## 7. Shared elements

**Inherits S-14 §7 by reference** — §7.1 status head, §7.2 account box, §7.3 primary action, §7.4
pending state, §7.5 the S-08 values that must not be re-derived. This change adds no new shared
element and changes none of them.

Constraints that bind if implementation is tempted to add one: `StatusHead` accepts
`tone: "ink" | "green" | "red"` and `icon: "info" | "settings" | "user" | "mail" | "shieldCheck" | "alert"`
— **that is the whole glyph set**, and a new glyph means a new SVG arm plus a contract note.
`AuthPrimaryLink` always appends `→`. `AuthBackLink` takes only `class`; its copy and destination are
fixed. `SignOutButton` takes **no props**, and `SubmitButton:26` hard-codes the ink-primary class
string with no `variant` — so a visually-secondary auth button does not exist today. None of these
should need touching; if a phase finds itself needing one, that is a signal to stop and re-audit.

## 8. Per-surface layout — exact values

### 8.1 Roster mutation banner — `StaffList.tsx:621-656` (§3.12)

**Every value below is inherited-exact from the shipped element, not invented.** Phase 1 adds copy
to this element and changes no dimension.

| Element           | Exact value                                                                                            |
| ----------------- | ------------------------------------------------------------------------------------------------------ |
| Wrapper           | `mb-5 flex items-center justify-between gap-3 rounded-lg border px-5 py-3.5`                           |
| Wrapper (error)   | `border-destructive/30 bg-[var(--flota-danger-soft)]`                                                  |
| Wrapper (success) | `border-success/30 bg-[var(--flota-success-soft)]`                                                     |
| Message           | `flex items-center gap-2.5 text-sm font-[540]` + `text-destructive` (error) / `text-success` (success) |
| Icon (error)      | `AlertTriangle`, `size-4 shrink-0`                                                                     |
| Icon (success)    | `ShieldCheck`, `size-4 shrink-0`                                                                       |
| Retry button      | `variant="outline"` + `bg-card h-9 shrink-0 px-4 text-[13px] font-[650]`                               |
| Placement         | Inside `mx-auto w-full max-w-[1024px] px-4 py-6 md:px-6`, above the filter card                        |

**Tone assignment for the new states:** both use `kind: "error"` (`AlertTriangle`, destructive).
The "repaired but mail not sent" case is a partial success, but it needs the admin to act, and the
success tone ships a `ShieldCheck` with no retry affordance — so error is the honest tone.
(Phase 1 shipped three states here; phase 7 collapsed the two provisioning arms into one — §9.2.)

**Retry affordance — restated for phase 9. This paragraph previously said the opposite; the
reasoning changed, so the record changes with it rather than accumulating both.** The banner no
longer carries a retry for the add flow at all, because it no longer carries the add flow's failures:
phase 9 moved every one of them into the modal (§8.4, §10 entry 3), whose submit button is the single
retry with the typed values still in the fields. What remains here is exactly one add-flow banner —
the mail-failure string — and it carries **no** retry, unchanged and for its original reason: its
remedy is the row's own action, which the copy names. The row actions (invite, reset, remove) keep
`mutationError` + `Ponów`; they have no form to report into.

~~the provisioning-failure string keeps `retry` wired to `addEmployee(values)` on **both** API codes
— the codes stay distinct for logs, the banner does not.~~ **Superseded.** Both codes still resolve
to one sentence — that half stands and moved to §9.4 — but the sentence is rendered in the modal.

**Wrapping at 390px — accepted. Measured, not estimated** (rendered `/dashboard/staff`, 390×844,
banner forced, `getComputedStyle` + `getBoundingClientRect`, 2026-08-21). **The two `provisionFailed`
rows are now historical**: phase 9 retired the address-interpolating banner form (§9.4), so the only
rows that still describe a shipped element are `mutationError` and the mail-failure string. They are
kept because they are what the phase-7 decision was taken against:

| String                                                  | Chars | Lines at 390px |
| ------------------------------------------------------- | ----- | -------------- |
| `mutationError` (shipped network banner)                | 68    | 3              |
| `provisionFailed` — typical address (`anna.kowalska@…`) | 80    | 4              |
| `provisionFailed` — 70-char address                     | 125   | 5              |
| `provisionRolledBack` (phase-1 string it replaces)      | 108   | 5              |

At 390px the banner is 358px wide and the message column is **227px** — `px-5` padding plus the
`Ponów` button's `shrink-0` 77px and the `gap-3` take the rest — so this element wraps to 4 lines at
that width regardless of the address, and did so before phase 7. Line height 20px; the wrapper grows
in height and its `items-center` keeps the button vertically centred against the taller message.
Verified at both address lengths: no horizontal overflow on the banner or the document, and the
button keeps its full 77px.

Accepted rather than fixed, and the contract's claim was the measured one: against the string it
replaced, `provisionFailed` was **one line shorter** for a realistic address and **tied at worst** for
a pathological one. No `truncate` — the address was the payload, and a failed provisioning drives no
roster row, so a clipped address would have left it nowhere in the product.

**Phase 9 closed that argument by moving the message rather than shortening it.** Inside the modal the
address is on screen in the field the admin just typed it into, so the banner is no longer "the only
place in the product where that address exists" — and the clause that bought disclosure at four lines
buys nothing at 400px. See §9.4.

### 8.2 Auth surfaces — parity spec

Phases 5 and 6 change where these surfaces get their data, never what they render. The spec is
therefore a **parity assertion**, and every dimension is inherited-exact from S-14 §7 and §8:

- R11 `link-conflict.astro` — wrapper `flex flex-col gap-[18px]`; account box `mb-[18px]`; heading
  `text-foreground text-[28px] leading-[1.05] font-bold tracking-[-0.8px]`; subtitle
  `text-muted-foreground mt-2 text-sm leading-[1.45]`. **Phase 5 edits only the header comment.**
- R12 account box margin `mb-5`; R3/R9 and R6/R10 account box has no margin (it sits inside the form).
- R14 — wrapper, heading, and subtitle metrics as above; `StatusHead tone="ink" icon="user"`; a
  single `AuthPrimaryLink href="/auth/signin"` and deliberately **no** `AuthBackLink`
  (`reset-password.astro:113-117` records why: two controls with the same destination are noise).

### 8.3 Roster third state + one-action-per-state rows — phase 8

**Ported from the design source, not eyeballed.** `EmpStatusBadge` in
`desktop-screens.jsx` gained a third tone additively, and `EsRow` / `EtRow` made the row actions
mutually exclusive (§12.2 — the edit is applied and read back). Colours were confirmed by sampling
the rendered board at 2× rather than by matching a name: the DODANY badge is **`#64748B` on
`#EEF1F5`**, which are `--flota-neutral` / `--flota-neutral-soft` in both `tokens.css` and
`src/styles/global.css`. For comparison the two shipped tones sampled `#1B9E5A` on `#E3F5EC`
(success) and `#B6790E` on `#FBF1DA` (warning) — i.e. the same soft/solid pairing, so the third
state introduces **no new colour concept and no new token**.

| Element                       | Exact value                                                                                                                                                                  |
| ----------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Badge (all three)             | shipped `Badge` base + `gap-1.5`; **no dimension changes**                                                                                                                   |
| Badge — DODANY                | `text-[var(--flota-neutral)] bg-[var(--flota-neutral-soft)]`                                                                                                                 |
| Badge dot — DODANY            | `size-1.5 rounded-full bg-[var(--flota-neutral)]`                                                                                                                            |
| Mobile status line — DODANY   | dot `size-1.5 rounded-full bg-[var(--flota-neutral)]`; label `font-[540] text-[var(--flota-neutral)]`                                                                        |
| Filter pill                   | a fifth entry in the existing `tabs` array — **no new element**. Order: Wszyscy · Aktywny · Zaproszony · Dodany · Administrator                                              |
| Row action `lg+`              | inherited-exact from the shipped reset button: `variant="outline"` + `h-9 gap-1.5 px-3 text-[13px] font-[650]`, icon `size-3.5`                                              |
| Row action `< lg`             | inherited-exact from the shipped reset icon button: `variant="outline" size="icon"` + `text-foreground size-11 rounded-xl`, icon `size-4`, `aria-label="Wyślij zaproszenie"` |
| Row action — pending          | `size-3.5` (`lg+`) / `size-4` (`< lg`) `animate-spin rounded-full border-2 border-current border-t-transparent`, label swaps to `Wysyłanie…`                                 |
| Add-modal CTA                 | unchanged geometry (`h-12 flex-1 gap-2`, `bg-primary`); glyph `Plus`, label `Dodaj`, pending label `Dodawanie…`                                                              |
| `formatLastActive` for DODANY | `—` (em dash). The design's own note on the row: "no activity to report — an em dash, not a fabricated timestamp"                                                            |

**Which control each state gets.** An invite action while `password_set_at` is null (covering BOTH
password-less badges); `Resetuj hasło` only once it is set. Exactly one action per row; the ✕ is
unchanged and unconditional. The invite action carries the state's own label — `Wyślij zaproszenie`
on DODANY, `Wyślij ponownie zaproszenie` on ZAPROSZONY (§9.2).

**The resend label widens the actions column — measured, and accepted.** Rendered at 1280×900 with
all three states on screen, `getBoundingClientRect` on the real table:

|                           | `Wyślij zaproszenie`   | `Wyślij ponownie zaproszenie`                              |
| ------------------------- | ---------------------- | ---------------------------------------------------------- |
| Button width              | 165px                  | **230px**                                                  |
| Actions column            | 299px                  | **328px** (+29)                                            |
| Name column               | absorbs the difference | no truncation (`0` cells with `scrollWidth > clientWidth`) |
| Document / table overflow | none                   | **none**                                                   |

The name column had the slack, so nothing clips and no row wraps: the table is `w-full` inside the
shared `max-w-[1024px]` content column and simply reapportions. The shorter `Wyślij ponownie` (150px,
_narrower_ than today's label) was the cheaper option and was **not** taken — the full noun was judged
clearer than a bare "again", and the layout cost is a column reapportionment with no visible casualty.
Below `lg` the action is icon-only, so the label lives in `aria-label` and costs no width at all.

**Glyph — `deviation(inherits the app's shipped mapping)`.** The design draws this action with its
own `Icon.message` (a speech bubble). The app renders it with lucide `Send`, because that is the
glyph the shipped `Wyślij zaproszenie` control already used — the add-modal CTA paired
`<Send className="size-4" />` with the same label against the same `Icon.message` in the design.
Phase 8 moves the label from the modal to the row and carries its glyph with it, rather than
introducing a second glyph for one label. Recorded so a later fidelity pass does not re-flag it.

### 8.4 Add-modal form-level error — phase 9

**The submission failed, and it belongs to no field.** The modal's two shipped error slots are
field-level (`StaffList.tsx:340`, `:363`) and can only attach to an input; a provisioning failure or
a dropped connection attaches to neither. Before phase 9 those arms had nowhere to go but the roster
banner — which the modal's own overlay paints over (§10 entry 3).

**Type ramp, colour, glyph and gap are the field-level idiom verbatim.** Three properties differ, and
all three are consequences of one measured fact: this string **wraps**, where a field error never
does. Rendered `/dashboard/staff` with the modal open and `POST /api/staff` stubbed, `getComputedStyle`

- `getBoundingClientRect` + `Range.getClientRects`, 2026-08-21:

| Element                | Exact value                                                        |
| ---------------------- | ------------------------------------------------------------------ |
| Wrapper                | `text-destructive mt-5 flex items-start gap-1.5 text-[13px]`       |
| Glyph                  | `AlertTriangle`, `mt-0.5 size-3.5 shrink-0`                        |
| `role`                 | `alert`                                                            |
| Placement              | Between the field group and the action row, inside `<form>`        |
| Clears on              | edit of **either** field (a field error clears only its own field) |
| Submit button while up | stays **enabled** — it is the retry                                |

- **`items-start` + `mt-0.5`, not the idiom's `items-center`.** Measured: the connection string is
  **2 lines at both breakpoints** — 400px content width on desktop, 342px at 390px — so `items-center`
  put the 14px glyph at the line boundary, `iconMid` 19.5px against a first-line centre of 9px. With
  `items-start` + `mt-0.5` both read **9px**: the glyph leads the sentence instead of floating beside
  it. Values are not invented — this is the app's own idiom for a glyph leading wrapping text
  (`ReservationForm.tsx:531` + `:540` `mt-0.5`; `pricing.astro:258` + `:259` `mt-px`). The one-line
  provisioning string measures `iconMid` 9px too, so the same values serve both arms.
- **`shrink-0`** stops the 14px glyph being squeezed by a wrapping message — inherited from the
  banner's own multi-line arm (§8.1), which already carries it for the same reason.
- **`mt-5`** is the modal's own block rhythm, not a new spacing decision: subtitle→fields and
  fields→actions are both `mt-5`, and the measured gaps above and below the slot are **20px / 20px**.
- **`role="alert"`** is the one addition with no field-level precedent, and it is an accessibility
  affordance rather than a dimension. It is warranted here and not there: this message announces a
  **server** outcome after an async submit that moves nothing on screen — the button simply returns to
  idle — so without a live region a screen-reader user gets no notification at all. Deliberately not
  back-fitted onto the two field-level slots; that is a separate a11y pass, not phase 9's scope.

Measured, no overflow at either breakpoint: box 400×39 (desktop) / 342×39 (mobile) for the two-line
connection string, 400×19.5 / 342×19.5 for the one-line provisioning string;
`document.scrollWidth === clientWidth` in all four.

## 9. Verbatim Polish copy

All strings live in `StaffList.tsx`'s `COPY` block beside `mutationError` (`:68`).

### 9.1 Shipped in phases 1 and 3 — superseded, kept as the record

These are what phases 1 and 3 actually shipped and what the phase-1 vision-diff was run against. They
are **superseded by §9.2** and retained so a later reader can tell what changed and why.

| Key                   | String                                                                                                           | Superseded by |
| --------------------- | ---------------------------------------------------------------------------------------------------------------- | ------------- |
| `provisionRolledBack` | `Zaproszenie zostało wysłane, ale konta nie udało się dokończyć. Cofnięto zaproszenie — dodaj osobę ponownie.`   | phase 7       |
| `provisionOrphaned`   | `Zaproszenie zostało wysłane, ale konta nie udało się dokończyć. Użyj „Ponów”, aby je naprawić.`                 | phase 7       |
| `repairedMailFailed`  | `Konto zostało odnowione, ale nie udało się wysłać e-maila aktywacyjnego. Użyj „Resetuj hasło” przy tej osobie.` | phase 8       |

**Why they are superseded** (owner, 2026-08-21): the two provisioning strings describe the failure the
way the _transaction_ experienced it — invite sent, account unfinished — rather than the way the
**admin** did, which is that adding this person failed. Both arms have the identical remedy, so the
distinction bought the reader nothing. `repairedMailFailed` names `„Resetuj hasło”`, which phase 8
removes from that row (§10 entry 2), so it would name a control the admin cannot see.

### 9.2 Phase 7 and 8 — approved 2026-08-21

| Key                              | String                                                                                                     | Phase |
| -------------------------------- | ---------------------------------------------------------------------------------------------------------- | ----- |
| `provisionFailed`                | `Nie udało się utworzyć konta dla {email}. Spróbuj ponownie.` — **superseded by §9.4 (phase 9)**           | 7     |
| `repairedMailFailed`             | `Konto zostało odnowione, ale zaproszenie nie zostało wysłane. Użyj „Wyślij zaproszenie” przy tej osobie.` | 8     |
| `statusCreated`                  | `DODANY`                                                                                                   | 8     |
| `statusCreatedMobile`            | `Dodany`                                                                                                   | 8     |
| `tabCreated`                     | `Dodany`                                                                                                   | 8     |
| `chipCreated`                    | `Dodani`                                                                                                   | 8     |
| `sendInvite` (row, DODANY)       | `Wyślij zaproszenie`                                                                                       | 8     |
| `resendInvite` (row, ZAPROSZONY) | `Wyślij ponownie zaproszenie`                                                                              | 8     |
| add-modal CTA                    | `Dodaj`                                                                                                    | 8     |
| `emptyHint`                      | `Dodaj pierwszą osobę — zaproszenie wyślesz w kolejnym kroku.`                                             | 8     |
| `addSub` (add modal)             | `Konto powstanie od razu. Zaproszenie wyślesz w kolejnym kroku.`                                           | 8     |

**Why this Polish:**

- **`provisionFailed` interpolates the address** because a failed provisioning is invisible
  everywhere else — the orphan drives no roster row (`list_staff` INNER-joins), so the banner is the
  only place in the product where that address exists. It is also **shorter** than the two strings it
  replaces, which is what lets it survive a 390px row — measured in §8.1 rather than asserted. (An
  earlier draft of this bullet said "one sentence rather than two"; the approved string is in fact
  two sentences, and follows the state-of-the-world-then-imperative convention below. What carries
  the 390px claim is its length, not its sentence count.)
- **`DODANY` closes a loop with the admin's own verb.** They click `Dodaj pracownika`; the person
  becomes `DODANY`. "Utworzony" is a system word for a system event. Desktop badge and tab take the
  singular (`Aktywny` / `Zaproszony` precedent); the mobile chip takes the plural (`Aktywni` /
  `Zaproszeni` precedent) — the block already splits those two forms and the third state follows.
- ~~**One row-action label for both password-less states.** An earlier draft used `Wyślij zaproszenie`
  for a first send and `Wyślij ponownie` for a resend. Rejected: `repairedMailFailed` must **name**
  the button, and after a repair the target may be in either state, so two labels make that string
  unnameable. The badge already distinguishes the two cases.~~ **REVERSED at the phase-8 manual gate
  (owner, 2026-08-21)**, on the rendered screen rather than on paper: once the invitation has gone
  out and the badge reads ZAPROSZONY, an action still labelled `Wyślij zaproszenie` reads as though
  nothing had been sent. The row now carries **two** labels — `Wyślij zaproszenie` on DODANY,
  `Wyślij ponownie zaproszenie` on ZAPROSZONY.

  The objection above was real, not wrong, and it is answered rather than ignored: `repairedMailFailed`
  no longer hard-codes a label but **interpolates the one that row renders**, keyed off the member
  the server returns. Both strings are authored together in `src/lib/staff-banner.ts`
  (`inviteActionLabel`, `repairedMailFailedMessage`) so the `unit` project can hold them in agreement
  — `staff-banner.test.ts` asserts, for every status, that the banner names exactly the button
  `inviteActionLabel` produces. Two labels are only safe with that test; do not inline either string
  back into the island.

  The longer wording was chosen over the shorter `Wyślij ponownie` deliberately, with the cost
  measured rather than assumed — see §8.3.

- **`addSub` was caught by the render, not the review.** The add modal's subtitle read
  `Wyślemy link aktywacyjny. Nowa osoba ustawi własne hasło.` — false under two-step, and it sits
  directly above the CTA, so shipping the button change alone would have put a contradiction on
  screen. It surfaced only when the board was rendered and looked at; the code diff did not touch
  that line and nothing flagged it. Same class as `emptyHint`.
- **The add-modal CTA drops to `Dodaj`** because the modal is already titled `Dodaj pracownika`, and
  because `Wyślij zaproszenie` now describes step **2** — leaving it on step 1 would promise an email
  that no longer goes out. `emptyHint` loses the same promise for the same reason.

**`repairedMailFailed` is a phase-8 row, and phase 7 leaves it alone** (owner, 2026-08-21). The plan's
phase 7 §2 says the string "becomes a function of the address in this phase"; this table does not
carry a phase-7 form of it, and the phase-8 string above interpolates nothing. Rather than author an
address form outside the approved set, phase 7 ships `provisionFailed` only and the string keeps its
shipped wording until phase 8 rewrites the control it names. Consequence for the plan's Progress:
manual check **7.8**'s address clause does not apply — only its "still carries no `Ponów`" half does.
The address is a real gap for this string, but it is not the gap phase 8 has to close, and `{email}`
can be added to the phase-8 row here if it is wanted.

### 9.3 Authored during phase-8 implementation — three strings §9.2 does not carry

The approved table above names every string a **reader of the roster** sees. Building the surface
surfaced three the approved set had no row for, each attached to an interaction rather than a state.
They are recorded here rather than invented silently, and they follow §9's own conventions
(impersonal `nie udało się` / `Wysłano`, no participle that has to agree with the hire's gender, the
same shape as the sibling string already shipped beside them).

| Key                    | String                                   | Why it exists                                                                                                                                                                                                      |
| ---------------------- | ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `inviteSent` (banner)  | `Wysłano zaproszenie.`                   | Sibling of the shipped `resetSent` (`Wysłano e-mail do resetu hasła.`). Needed because a **resend** changes nothing on screen — the badge is already ZAPROSZONY — so without it the admin gets no feedback at all. |
| `adding` (add-modal)   | `Dodawanie…`                             | The modal's pending label. It read `Wysyłanie…`, which is false once step 1 sends nothing. Same `…`-suffixed gerund shape.                                                                                         |
| `sending` (row action) | `Wysyłanie…` — **unchanged, re-pointed** | Not a new string: the existing pending label follows the invite action from the modal to the row. One pending label serves both invite labels — the button is mid-send either way.                                 |

A failed send deliberately gets **no new string**: the row action reuses the shipped
`mutationError` + `Ponów` machinery, exactly as `Resetuj hasło` already does for the same class of
failure. Adding a fourth banner for it would be a new mechanism where a shipped one already fits.

**Accepted, recorded rather than fixed:** `DODANY` is a masculine adjective and would need `Dodana`
for a woman. §9's gender-neutrality rule has in practice governed **sentences** — where `osobę` and
`tej osobie` carry the referent — while the shipped badges (`AKTYWNY`, `ZAPROSZONY`) are already
masculine-default. The neutral alternative `BEZ ZAPROSZENIA` was considered and set aside for
badge-shape consistency. The gender question belongs to the badge set as a whole, not to this one
addition, and is logged here rather than solved by making the third badge inconsistent with the two
beside it.

**Why this Polish, against the conventions verified across 15 surfaces (`research.md` Part 3):**

- **Two sentences: state-of-the-world, then imperative.** Matches `mutationError`
  (`Nie udało się zapisać zmiany. Sprawdź połączenie i spróbuj ponownie.`) and `lastAdminBody`
  (`Musi pozostać co najmniej jeden administrator. Najpierw awansuj inną osobę.`).
- **Gender-neutral throughout**, which the S-14 contract's §9 closing line makes a standing rule.
  `osobę` and `tej osobie` carry the referent, so no participle has to agree with the hire's gender —
  the same device `lastAdminBody`'s `inną osobę` already uses.
- **Impersonal `nie udało się`** states a system fact without assigning blame, and is the register
  already shipped in `mutationError` and `dupEmail`.
- ~~**`Zaproszenie zostało wysłane` leads**, because that is the fact the admin cannot see anywhere
  else and the one that changes what they do next.~~ **Superseded by §9.2 (phase 7).** It was the
  right lead while the mail really had gone out; it framed the failure the way the _transaction_
  experienced it rather than the way the **admin** did. Phase 8 removes the premise entirely — no
  mail is sent for an account that failed to create.
- **`„…”` low-open quotes** for a named UI control, matching `reset-password.astro:130`
  (`Otwórz Konto → „Zmień hasło” — …`). `„Ponów”` and `„Resetuj hasło”` are quoted verbatim from
  `COPY.retry` (`:69`) and `COPY.reset` (`:38`), so the copy names controls the admin can actually
  see on screen.
- **`—` em dash, not a hyphen**, matching `removeBodyTail` and `footerRest`.
- **`…` not `...`** — no ellipsis occurs in these three, but the rule binds any variant added later.

**Knowingly accepted imprecision**, recorded rather than fixed — **one, not two, after phase 7**:

- `provisionFailed` does not tell the admin that a hire who already opened the delivered mail will
  find a dead link. This is a **deliberate omission**, not an oversight: it is a third clause on a
  banner that is a single flex row beside a button, and the admin's action is unchanged either way —
  add the person again. **Phase 8 removes it at the root** rather than in the copy: create no longer
  sends mail, so a failed create leaves no delivered invite and no dead link to warn about. Until
  phase 8 lands, this is the surviving imprecision of the phase-7 string.
- ~~`provisionOrphaned` says `naprawić` ("repair") of an account the admin never saw created.~~
  **Gone.** The word `naprawić` is not in the shipped copy any more — phase 7 collapsed both arms to
  `Spróbuj ponownie.`, which describes what the admin does rather than what the button repairs, so
  the imprecision has nothing left to attach to. The underlying invisibility (an orphan drives no
  roster row, `list_staff` INNER-joins) is unchanged and still out of scope — see plan → "What We're
  NOT Doing"; phase 8 lowers its stakes, because no mail is sent for an account that failed.

### 9.4 Phase 9 — approved 2026-08-21

| Key               | String                                                                 | Where               |
| ----------------- | ---------------------------------------------------------------------- | ------------------- |
| `provisionFailed` | `Nie udało się utworzyć konta. Spróbuj ponownie.`                      | modal, form-level   |
| `requestFailed`   | `Nie udało się utworzyć konta. Sprawdź połączenie i spróbuj ponownie.` | modal, form-level   |
| `duplicateEmail`  | `Ten adres e-mail jest już w zespole.` — **unchanged, moved**          | modal, e-mail field |

**Why this Polish:**

- **Both lead with the identical state-of-the-world clause and differ only in the remedy**, which is
  §9's two-sentence convention (`mutationError`, `lastAdminBody`) applied to a pair. A dropped
  connection keeps its `Sprawdź połączenie` because that is the one failure the admin can act on
  directly; a provisioning failure has no such hint to give, so it goes straight to the imperative.
  `staff-banner.test.ts` pins the shared lead, so an edit to one that does not touch the other goes
  red rather than quietly splitting the family.
- **Neither names the address, and this is a reversal of §9.2's reasoning that the move earns.**
  §9.2 interpolated `{email}` into the banner because "a failed provisioning is invisible everywhere
  else — the orphan drives no roster row, so the banner is the only place in the product where that
  address exists." That was true of a banner shown after the modal had closed. It is false inside the
  modal: the address is on screen, in the e-mail field two rows above, in the admin's own typing.
  Repeating it there is redundancy, not disclosure — and the modal is ~400px wide, where the clause
  costs a third line. **`provisionFailed`'s address-interpolating banner form retires with the
  banner it was written for** (owner, 2026-08-21).
- **`Nie udało się utworzyć konta` over `zapisać zmiany`.** The shipped `mutationError` is the ROW
  actions' banner and has to cover invite, reset and remove, so it says "change". In a modal titled
  `Dodaj pracownika` the specific verb is available and truer. `mutationError` itself is unchanged
  and still serves the row actions — phase 9 does not touch it.
- **`duplicateEmail` is not new copy.** The string is `COPY.dupEmail` verbatim, moved from the island
  into `staff-banner.ts` so the routing table owns every arm's string rather than owning three of
  four. Same words, same slot, same behaviour.
- **Impersonal `nie udało się`**, two sentences, `—`/`…` conventions, gender-neutral: all as §9.3.

**No new string for a failed row-action send.** Unchanged from §9.3: the row's invite and reset
actions keep `mutationError` + `Ponów`, because they have no form to report into — the banner is
where the admin is for those.

## 10. Deviations register

### Entry 1 — Roster provisioning-failure banner — `deviation(no artboard — copy-only variant of a shipped element)`

**The defect.** `src/components/staff/StaffList.tsx:491` routes every unexpected response from
`POST /api/staff` to `COPY.mutationError` — `Nie udało się zapisać zmiany. Sprawdź połączenie i
spróbuj ponownie.` — which blames the network for a failure that has already delivered an invite
mail. The add modal also stays open (`setAddOpen(false)` runs only on the success arm at `:485`),
reinforcing "nothing happened". Evidence: `research.md` §1.3; plan phase 1.

**Why it is a deviation.** The canonical roster artboards (catalog 19 and 25) show the healthy
roster only — they carry no banner state at all, error or success. So there is no artboard to diff
against for this state, exactly as there was none for the R14 card that `auth-followups` shipped.

**Every dimension is inherited-exact, not invented.** The banner element itself already ships and is
already governed by contract §3.12: wrapper, tone classes, icon set, message type ramp, retry button
and placement are all transcribed verbatim in §8.1 above. **This deviation adds two strings and
zero dimensions** (three until phase 7 collapsed the provisioning pair — §9.2; **one** after phase 9
moved the provisioning arm off the banner entirely — entry 3 — leaving only the mail-failure string).
No new component, no new token, no new glyph, no new spacing decision. Phase 7 adds no dimension either: the only new
layout fact is that an interpolated address may wrap the message to a second line at 390px, and §8.1
records that as accepted.

**The account-box question does not arise** — this is a banner in the roster's content column, not
an auth card, so the S-14 account-box decision (entry 14's F8 amendment) has no bearing here. Stated
explicitly because entry 14's lesson was precisely that leaving it unstated caused a re-review.

**Polish copy** is specified verbatim in §9 with its justification, and its one remaining accepted
imprecision — the undisclosed dead link, which phase 8 removes at the root — is named there rather
than left to the implementer.

**Vision-diff gate.** Render `/dashboard/staff` with each banner state forced, at both breakpoints,
and diff against catalog 19 / 25 **excluding the banner region** — the assertion is that adding the
banner disturbs nothing else on the screen. The banner region itself is diffed against the shipped
`mutationError` banner, where the only permitted delta is the string.

### Entry 2 — Roster third state + one-action-per-state rows — `deviation(the artboard encodes a journey defect)`

**The defect.** Catalog 19's fifth row shows an **invited, password-less** person offered
`Reset password`, and the shipped app reproduces it faithfully (`Łukasz Piątek`, ZAPROSZONY,
`Resetuj hasło`) because it was ported from that artboard. That control calls
`resetPasswordForEmail` — a **recovery** link with recovery copy — for someone who has never had a
password. It is the option-2b journey downgrade, arriving through the roster instead of through the
service. Evidence: §1's third correction; `research.md` §1.4; plan phase 8.

**Why it is a deviation, and of an unusual kind.** This is not "no artboard". There IS one, it is
current, and phase 8 **deliberately diverges from it**: `Wyślij zaproszenie` while
`password_set_at` is null, `Resetuj hasło` only once it is set. Porting catalog 19 faithfully would
rebuild the defect. Recorded so a later fidelity pass does not "restore" the button.

The third badge state is the ordinary half of the same entry: DODANY exists because create no longer
sends, so "account exists, nothing sent" became a real state the roster had no word for.

**The design source has been brought in line** (§12.2, applied 2026-08-21 and read back):
`EmpStatusBadge` gained a third tone **additively** — `active` and `invited` render byte-identically —
and `EsRow` / `EtRow` carry the mutual exclusion with the reasoning in a comment. So the divergence
is against the repo's stale `19-…png` export, not against the live design. §12.2a — re-exporting the
canonical `emp-*` PNGs — is still open, which is why §11's phase-8 rows diff against
`design-review/boards-after/`.

**Every dimension is inherited-exact, not invented**, and §8.3 transcribes them: the badge is the
shipped `Badge` element with a third tone whose two colours are the palette's existing
`--flota-neutral` / `--flota-neutral-soft` (sampled `#64748B` on `#EEF1F5` off the rendered board,
not matched by name); both row actions reuse the shipped reset button's exact geometry at both
breakpoints; the filter pill is a fifth entry in an existing array. **No new component, no new
token, no new spacing decision.** One glyph deviation is recorded in §8.3 (lucide `Send` for the
design's `Icon.message`, inheriting the mapping the shipped control already used).

**The account-box question does not arise** — this is the roster, not an auth card. Stated
explicitly for the same reason entry 1 states it.

**Polish copy** is §9.2 verbatim, plus the three interaction strings §9.3 records with their
justification.

**Vision-diff gate.** §11's three phase-8 rows: the roster at both breakpoints against
`boards-after/emp-roster.png` and `boards-after/emp-tablet.png`, and the add modal against
`boards-after/emp-add.png`. The assertion for the two shipped badge tones and every unchanged row is
**zero delta** — the third state is additive.

### Entry 3 — Add-modal form-level error — `deviation(no artboard — new state on a shipped surface)`

**The defect.** Every failure of `POST /api/staff` was reported in the wrong place, and one of them
was reported nowhere at all. Measured against the running app (1280×900, `/dashboard/staff`,
`elementFromPoint` hit-test at the banner's centre, 2026-08-21):

| Arm                                     | Modal      | Was the error actually visible?                                     |
| --------------------------------------- | ---------- | ------------------------------------------------------------------- |
| 409 duplicate                           | stays open | **Yes** — inline under the e-mail field, the shipped idiom          |
| `provision_rolled_back` / `_orphaned`   | closed     | Yes, as a banner — but the admin was moved off the form they filled |
| Unhandled 500 / network (`fetch` threw) | stays open | **NO**                                                              |

The last row is the defect. `addEmployee`'s network arm set the banner and left the modal open, so
the banner painted **behind** `ModalShell`'s overlay (`fixed inset-0 z-[60] … bg-[rgba(20,18,22,0.55)]
backdrop-blur-sm`). Hit-testing the banner's centre returned the overlay, not the banner: the admin
submitted, the button returned to idle, and their only feedback was a blurred red smear behind a
dimmed backdrop. **The most common failure — a dropped connection, the one case where the typed
values are still perfectly good — was the one that reported nothing.**

**Why it is a deviation.** A form-level error on the add modal is a new user-facing state with no
artboard: catalog 19/25 carry the healthy roster only, `boards-after/emp-add.png` carries the healthy
modal, and §10 entry 1 already records that there is no banner artboard either. There is nothing to
diff against, exactly as there was none for the R14 card `auth-followups` shipped.

**Every dimension is inherited-exact, and §8.4 transcribes them with their measurements.** Type ramp,
colour, glyph and gap come from the modal's own field-level idiom; `shrink-0` from the banner's
multi-line arm; `mt-5` from the modal's block rhythm. The three properties that differ from the
field-level idiom — `items-start`, the glyph's `mt-0.5`, and `shrink-0` — are consequences of one
**measured** fact (this string wraps to two lines at both breakpoints, where a field error never
does), and each takes its value from an existing app idiom rather than from an eye
(`ReservationForm.tsx:531`+`:540`, `pricing.astro:258`+`:259`). **No new component, no new token, no
new glyph, no new spacing decision.** One non-dimensional addition, `role="alert"`, is justified in
§8.4.

**This reopens a phase-1 decision deliberately.** `StaffList.tsx` recorded the reasoning: _"Close the
modal: the banner's `Ponów` is the single retry surface, and leaving the form open behind it would
offer a competing second one."_ That was sound while the invite mail had already gone out — closing
the modal was the signal that something irreversible **had** happened, against a shipped bug where
the modal stayed open and implied nothing had. Two things changed it: phase 7 collapsed the copy to
`Spróbuj ponownie.`, an instruction to retry issued after the form the admin would retry in had been
taken away; and phase 8 stopped sending any mail on create, so a failed create became fully retryable
in place with nothing delivered. The "competing retry surface" problem did not disappear — it
**inverted**. The old comment is replaced, not left standing beside its opposite.

**Which surface owns which failure — the decision, recorded** (owner, 2026-08-21). Option (a) of the
plan's §3: the two failure arms set **no banner at all**. The modal is the only report and its submit
is the only retry, so exactly one retry control is on screen for one failure. Option (b) — a banner
kept "for the record" without `Ponów` — was rejected: it puts two messages on screen for one failure,
one of them invisible until the admin cancels, and the record it preserves is not a record (the next
mutation clears it). The consequence is accepted openly: if the admin cancels the modal, the failure
leaves no trace. That is the same trace a cancelled form leaves anywhere, and the orphan it might
have named is repairable by re-adding the address — the `existing` branch is the repair path.

**`repairedMailFailed` is out of scope and does not move.** It rides a 200, the row really did land,
its modal really should close, and its remedy is the row's own action rather than a retry. It is the
one add outcome that is still a banner — and nothing about it hides behind an overlay.

**The routing is a tested pure function, not an `if` in an island.** `resolveAddReport` in
`src/lib/staff-banner.ts` maps every arm — HTTP status plus `code`, including the `fetch`-threw case
— onto a target, a slot and a string, and `staff-banner.test.ts` sweeps the whole table for the
invariant that produced this bug: **no arm may report to the banner while the modal stays open.** The
`inModal` / `inBanner` / `silent` constructors make that state unrepresentable as well as tested.
There is deliberately no `both` target: one failure, one message.

**Polish copy** is §9.4 verbatim, with the address reversal argued there.

**Vision-diff gate.** §11's two phase-9 rows: the modal's error state at 1280px and 390px, both arms.
The assertion is that the error slot matches §8.4 exactly and **every other element of the modal is
zero-delta** against `boards-after/emp-add.png` — the slot is additive.

### Inherited — entry 14 of the S-14 contract may go stale

`…/2026-08-11-auth-surface-hardening/design-contract.md` §10 entry 14 names Bug 1's population as one
of two knowingly-accepted false readings of "Konto jest nieaktywne": _"a hire whose profiles insert
failed after the invite was already sent, who has no profiles row permanently (impl-review F6)."_

Phase 1's compensating `deleteUser` makes that population **rare rather than permanent**, and phase
4's token-lookup RPC changes when the refusal is reached. Entry 14's accepted-deviation note is
therefore stale after this change. It cannot be amended in place — that folder is archived and
read-only — so this contract records the supersession here, and a future slice that promotes the auth
artboards into `design-system.md` should carry the correction forward.

## 11. Vision-diff gate (for `/10x-implement` and `/10x-impl-review`)

| Surface                                                | Baseline                                                                                    | Assertion                                                                           |
| ------------------------------------------------------ | ------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| `/dashboard/staff`, banner forced                      | `19-admin-desktop-employees.png` (desktop)                                                  | Only the banner region differs; §8.1 values match exactly                           |
| `/dashboard/staff`, banner forced                      | `25-admin-mobile-employees.jpg` (mobile)                                                    | Same, reflowed at the shared breakpoint                                             |
| `/dashboard/staff`, healthy                            | catalog 19 / 25                                                                             | **Zero** delta — the badge fix changes inputs, not pixels                           |
| `/dashboard/staff`, DODANY row present (desktop)       | `design-review/boards-after/emp-roster.png`                                                 | Third badge + one action per row match §8.3; the four unchanged rows are zero-delta |
| `/dashboard/staff`, DODANY row present (tablet/mobile) | `design-review/boards-after/emp-tablet.png`                                                 | Same rule reflowed; the ✕ and every other element unchanged                         |
| `/dashboard/staff`, add modal                          | `design-review/boards-after/emp-add.png`                                                    | `Dodaj` CTA + `addSubtitle` only; geometry zero-delta                               |
| `/dashboard/staff`, add modal + form error (desktop)   | `design-review/rendered/modal-form-error-{d,provision-d}.png`                               | Error slot matches §8.4 exactly; every other element zero-delta vs `emp-add.png`    |
| `/dashboard/staff`, add modal + form error (mobile)    | `design-review/rendered/modal-form-error-{m,provision-m}.png`                               | Same reflowed at 390px; glyph on the first line, no overflow                        |
| `/auth/link-conflict`                                  | `auth-authed-{d,m}.png`                                                                     | **Zero** delta after phase 5                                                        |
| `/auth/reset-password` × 6 states                      | `auth-inapp` / `auth-nolink` / `auth-expired` / `auth-success` / `auth-set` / `auth-invite` | **Zero** delta after phase 5                                                        |

The zero-delta rows are the load-bearing ones: phase group B's whole claim is that it re-sources six
auth surfaces without changing any of them. A non-zero diff on any of them is a phase-5 defect, not a
design decision to be renegotiated at review time.

---

## 12. Design follow-ups

Captured 2026-08-21 so they survive outside a conversation. None of these blocks phase 7.

### 12.1 Pull the ten un-pulled S-08 artboards

`DesignSync list_files` on `Rental car company` (`352d78a6-84fd-49a2-8b38-2fe289691fc3`) shows ten
employee-state artboards under `design-review/` that were never pulled into the repo: `emp-add`,
`emp-add-dup`, `emp-remove`, `emp-lastadmin`, `emp-self`, `emp-empty`, `emp-nores`, `emp-loading`,
`emp-error` (**the mutation error banner** — see the second correction in §1), and `am-team`.
Phase 7 rewrites the banner copy and should diff against `emp-error.png`; phase 8 renames the
add-modal CTA and should diff against `emp-add.png`. Costs nothing and needs no decisions.

### 12.2 The `employee-states.jsx` edit for phase 8 — **DONE 2026-08-21**

Applied to the design project and read back to confirm. Three files written:
`shared.jsx` (`createdS`, `addConfirm`, `addSub`, `emptyRosterSub` — EN + PL), `desktop-screens.jsx`
(`EmpStatusBadge` gains a third neutral-grey state; **additive**, so `active`/`invited` render
byte-identically and no other board moves), and `employee-states.jsx` (a `created` member, a fifth
filter pill in both layouts, mutually-exclusive row actions in `EsRow` **and** `EtRow`, the `Dodaj`
CTA, plus an avatar-overflow count that was hardcoded `+1`).

Verified before overwriting a shared file: every hunk applied exact-match-or-abort, all three files
parse as JSX, and — the step that actually mattered — the **unpatched** baseline was rendered first
and matched the canonical design, proving the local reconstruction was faithful. Boards at 2× are in
`design-review/boards-{before,after}/`.

### 12.2a Re-export the canonical `emp-*` PNGs — **STILL OPEN**

The JSX changed, so the project's own `design-review/emp-*.png` exports now show the OLD design.
This is the same stale-cache problem §1's corrections describe, freshly created. The boards under
`boards-after/` are **preview renders at my own dimensions**, not the canonical `data-dc-slot`
exports — they are evidence, not replacements. Re-export `emp-add`, `emp-add-dup`, `emp-remove`,
`emp-lastadmin`, `emp-self`, `emp-empty`, `emp-nores`, `emp-loading`, `emp-error` and `am-team` from
`Flota Rental.html` (note: `export-shot.html`'s `SCREENS` map has **no** `emp-*` entries, so either
add them or drive `Flota Rental.html` directly).

### 12.2b Carry the resend label into `employee-states.jsx` — **OPEN**

§12.2's applied edit renders **one** invite label for both password-less states (`EsRow` and `EtRow`
both emit `t.sendInvite`). The phase-8 manual gate reversed that in the app (§9.2), so the design
source is now one step behind on this single point — everything else in §12.2 still matches.

The hunk, when someone picks this up: `shared.jsx` gains `resendInvite` (EN `Resend invite`, PL
`Wyślij ponownie zaproszenie`) beside `sendInvite`; `EsRow` and `EtRow` become three-way —
`active` → `t.resetPassword`, `invited` → `t.resendInvite`, otherwise `t.sendInvite`. Deliberately
NOT applied mid-gate: the design source should follow a confirmed decision, not race it, and
§12.2a's re-export is still outstanding, so both should land in one pass.

Until then the app is the more current of the two on this line, and §8.3 carries the measured
layout consequence.

### 12.3 A lesson worth promoting

Three of the four design findings in this change were **un-pulled or stale repo assets**, not real
divergences: catalog 19's tiles (a stale export of a design that had already moved to the tab bar),
the "missing" banner artboard (it exists), and the reset-on-invited-row defect (live in the design
source, invisible from the repo). The Design Alignment Audit is a _paper_ exercise against the repo's
screenshots, and nothing keeps that cache in sync with the project it came from.

A fourth finding sharpens it. `addSub` — the add modal's subtitle, `Wyślemy link aktywacyjny…` —
is false under two-step and sits directly above the new `Dodaj` button. It was invisible to code
review: the diff never touched that line, and nothing flagged it. It surfaced only when the board was
**rendered and looked at**. Same for `emptyHint`. Candidate for `/10x-lesson`, now two-part:
**freshness-audit against the live design project rather than the repo's copy, and render the board
before believing a copy change is complete — a stale promise one line above your edit is invisible in
a diff.**
