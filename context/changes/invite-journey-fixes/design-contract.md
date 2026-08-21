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
> mutually exclusive (`Wyślij zaproszenie` while `password_set_at` is null, `Resetuj hasło` only once
> it is set), which therefore **diverges from a canonical design** rather than merely from current
> behaviour.
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

**Tone assignment for the new states:** all three use `kind: "error"` (`AlertTriangle`, destructive).
The "repaired but mail not sent" case is a partial success, but it needs the admin to act, and the
success tone ships a `ShieldCheck` with no retry affordance — so error is the honest tone.

**Retry affordance:** the two provisioning-failure strings keep `retry` wired to
`addEmployee(values)`. The mail-failure string carries **no** retry — its remedy is the row's own
`Resetuj hasło` action, which the copy names.

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

| Key                   | String                                                                                                     | Phase |
| --------------------- | ---------------------------------------------------------------------------------------------------------- | ----- |
| `provisionFailed`     | `Nie udało się utworzyć konta dla {email}. Spróbuj ponownie.`                                              | 7     |
| `repairedMailFailed`  | `Konto zostało odnowione, ale zaproszenie nie zostało wysłane. Użyj „Wyślij zaproszenie” przy tej osobie.` | 8     |
| `statusCreated`       | `DODANY`                                                                                                   | 8     |
| `statusCreatedMobile` | `Dodany`                                                                                                   | 8     |
| `tabCreated`          | `Dodany`                                                                                                   | 8     |
| `chipCreated`         | `Dodani`                                                                                                   | 8     |
| `sendInvite` (row)    | `Wyślij zaproszenie`                                                                                       | 8     |
| add-modal CTA         | `Dodaj`                                                                                                    | 8     |
| `emptyHint`           | `Dodaj pierwszą osobę — zaproszenie wyślesz w kolejnym kroku.`                                             | 8     |

**Why this Polish:**

- **`provisionFailed` interpolates the address** because a failed provisioning is invisible
  everywhere else — the orphan drives no roster row (`list_staff` INNER-joins), so the banner is the
  only place in the product where that address exists. It is also one sentence rather than two, which
  is what lets it survive a 390px row.
- **`DODANY` closes a loop with the admin's own verb.** They click `Dodaj pracownika`; the person
  becomes `DODANY`. "Utworzony" is a system word for a system event. Desktop badge and tab take the
  singular (`Aktywny` / `Zaproszony` precedent); the mobile chip takes the plural (`Aktywni` /
  `Zaproszeni` precedent) — the block already splits those two forms and the third state follows.
- **One row-action label for both password-less states.** An earlier draft used `Wyślij zaproszenie`
  for a first send and `Wyślij ponownie` for a resend. Rejected: `repairedMailFailed` must **name**
  the button, and after a repair the target may be in either state, so two labels make that string
  unnameable. The badge already distinguishes the two cases.
- **The add-modal CTA drops to `Dodaj`** because the modal is already titled `Dodaj pracownika`, and
  because `Wyślij zaproszenie` now describes step **2** — leaving it on step 1 would promise an email
  that no longer goes out. `emptyHint` loses the same promise for the same reason.

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
- **`Zaproszenie zostało wysłane` leads**, because that is the fact the admin cannot see anywhere
  else and the one that changes what they do next. The old banner's failure was implying nothing had
  happened while mail was already in the hire's inbox.
- **`„…”` low-open quotes** for a named UI control, matching `reset-password.astro:130`
  (`Otwórz Konto → „Zmień hasło” — …`). `„Ponów”` and `„Resetuj hasło”` are quoted verbatim from
  `COPY.retry` (`:69`) and `COPY.reset` (`:38`), so the copy names controls the admin can actually
  see on screen.
- **`—` em dash, not a hyphen**, matching `removeBodyTail` and `footerRest`.
- **`…` not `...`** — no ellipsis occurs in these three, but the rule binds any variant added later.

**Knowingly accepted imprecision**, recorded rather than fixed:

- `provisionRolledBack` does not tell the admin that a hire who already opened the delivered mail
  will find a dead link. It is true but it is a third clause, and the banner is a single flex row
  beside a button. The admin's action is unchanged either way — re-add the person. If support calls
  reveal this matters, it belongs in the add-modal's subtitle, not the banner.
- `provisionOrphaned` says `naprawić` ("repair") of an account the admin never saw created, because
  the orphan does not appear on the roster (`list_staff` INNER-joins). The word is accurate about
  what the button does; the invisibility is the surviving consequence the plan deliberately does not
  fix (see plan → "What We're NOT Doing").

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
and placement are all transcribed verbatim in §8.1 above. **This deviation adds three strings and
zero dimensions.** No new component, no new token, no new glyph, no new spacing decision.

**The account-box question does not arise** — this is a banner in the roster's content column, not
an auth card, so the S-14 account-box decision (entry 14's F8 amendment) has no bearing here. Stated
explicitly because entry 14's lesson was precisely that leaving it unstated caused a re-review.

**Polish copy** is specified verbatim in §9 with its justification, and its two accepted imprecisions
are named there rather than left to the implementer.

**Vision-diff gate.** Render `/dashboard/staff` with each banner state forced, at both breakpoints,
and diff against catalog 19 / 25 **excluding the banner region** — the assertion is that adding the
banner disturbs nothing else on the screen. The banner region itself is diffed against the shipped
`mutationError` banner, where the only permitted delta is the string.

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

| Surface                           | Baseline                                                                                    | Assertion                                                 |
| --------------------------------- | ------------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| `/dashboard/staff`, banner forced | `19-admin-desktop-employees.png` (desktop)                                                  | Only the banner region differs; §8.1 values match exactly |
| `/dashboard/staff`, banner forced | `25-admin-mobile-employees.jpg` (mobile)                                                    | Same, reflowed at the shared breakpoint                   |
| `/dashboard/staff`, healthy       | catalog 19 / 25                                                                             | **Zero** delta — the badge fix changes inputs, not pixels |
| `/auth/link-conflict`             | `auth-authed-{d,m}.png`                                                                     | **Zero** delta after phase 5                              |
| `/auth/reset-password` × 6 states | `auth-inapp` / `auth-nolink` / `auth-expired` / `auth-success` / `auth-set` / `auth-invite` | **Zero** delta after phase 5                              |

The zero-delta rows are the load-bearing ones: phase group B's whole claim is that it re-sources six
auth surfaces without changing any of them. A non-zero diff on any of them is a phase-5 defect, not a
design decision to be renegotiated at review time.

---

## 12. Design follow-ups (not yet done)

Captured 2026-08-21 so they survive outside a conversation. None of these blocks phase 7.

### 12.1 Pull the ten un-pulled S-08 artboards

`DesignSync list_files` on `Rental car company` (`352d78a6-84fd-49a2-8b38-2fe289691fc3`) shows ten
employee-state artboards under `design-review/` that were never pulled into the repo: `emp-add`,
`emp-add-dup`, `emp-remove`, `emp-lastadmin`, `emp-self`, `emp-empty`, `emp-nores`, `emp-loading`,
`emp-error` (**the mutation error banner** — see the second correction in §1), and `am-team`.
Phase 7 rewrites the banner copy and should diff against `emp-error.png`; phase 8 renames the
add-modal CTA and should diff against `emp-add.png`. Costs nothing and needs no decisions.

### 12.2 The `employee-states.jsx` edit for phase 8

The design project is code-backed and writable (`canEdit: true`), so the fix is a source edit, not a
prompt. Read 2026-08-21; four changes, in one file except where noted:

| Edit              | What                                                                                                                                                                              |
| ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `EsRow` + `EtRow` | Gate the actions on status. Both currently render `{t.resetPassword}` unconditionally — including `ES_TEAM[4]`, `status: 'invited'`, which is the defect §10's new entry records. |
| `ES_TEAM`         | Add a member in the created-but-not-invited state                                                                                                                                 |
| Filter pills      | A fifth pill + count, in **both** `EsShell` (desktop) and `ScreenEmpTablet`                                                                                                       |
| `EmpStatusBadge`  | A third variant — **lives in `shared.jsx`**, a global other screens import. This is the only edit with blast radius.                                                              |

The PNGs are **exports**: `design-review/index.md` records them as generated from `Flota Rental.html`
at 2× DPI, with filenames matching each artboard's `data-dc-slot` id. So the loop is edit the JSX →
re-export from the Claude Design app → pull the fresh PNGs into `design-review/`. Copy for the new
state is approved in §9.2.

### 12.3 A lesson worth promoting

Three of the four design findings in this change were **un-pulled or stale repo assets**, not real
divergences: catalog 19's tiles (a stale export of a design that had already moved to the tab bar),
the "missing" banner artboard (it exists), and the reset-on-invited-row defect (live in the design
source, invisible from the repo). The Design Alignment Audit is a _paper_ exercise against the repo's
screenshots, and nothing keeps that cache in sync with the project it came from. Candidate for
`/10x-lesson`: **freshness-audit against the live design project, not the repo's copy of it.**
