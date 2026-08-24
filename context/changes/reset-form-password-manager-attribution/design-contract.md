# Design Contract — Set-Password Username Anchor

> Plan: `plan.md` · Research: `research.md` · Change: `change.md`
> Design source: Claude Design project `Rental car company` (`352d78a6-84fd-49a2-8b38-2fe289691fc3`),
> file `password-reset.jsx`, pulled via `DesignSync get_file` on **2026-08-24** (research §5.1).

## Design Alignment Audit

**Scope note.** This change adds two `display:none` inputs. `display:none` generates **no layout box**,
so the rendered delta is zero _by construction_ rather than by measurement. That makes the usual
exact-values contract mostly a statement of what stays untouched — which is still worth writing, because
the failure mode this contract guards against is a later change that makes the input visible or moves it.

### 1. Freshness — repo assets vs canonical

| Asset                                                                                      | Surface                       | Status                    | Note                                                                                                                                                                                                                              |
| ------------------------------------------------------------------------------------------ | ----------------------------- | ------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `password-reset.jsx` (design project)                                                      | R3/R9, R6/R10                 | **current**               | Pulled 2026-08-24, same day as research. Authoritative.                                                                                                                                                                           |
| `…/2026-08-18-invite-journey-fixes/design-review/rendered/auth-R3-recovery-form-{d,m}.png` | R3/R9                         | **current**               | Rendered app captures, 2026-08-18 (6 days). The correct zero-delta baseline.                                                                                                                                                      |
| `…/2026-08-18-invite-journey-fixes/design-review/rendered/auth-R6-invite-form-{d,m}.png`   | R6/R10                        | **current**               | Same.                                                                                                                                                                                                                             |
| `…/2026-07-23-employee-account-management/design-review/reset-r3-set-password-desktop.jpg` | R3/R9                         | **outdated (superseded)** | Pre-S-14 design export; superseded by the 2026-08-18 rendered set.                                                                                                                                                                |
| `…/reset-r6-invite-accept-desktop.jpg`                                                     | R6/R10                        | **outdated (superseded)** | Same.                                                                                                                                                                                                                             |
| _(none)_                                                                                   | `/dashboard/account/password` | **missing**               | No mockup has ever existed (D6, `no-mockup`) and no rendered baseline exists in any archive.                                                                                                                                      |
| `design-system.md` catalog                                                                 | all auth screens              | **missing**               | The auth flow has never been catalogued — named at `…/2026-08-11-auth-surface-hardening/design-review/index.md:59-60` as the reason S-08's mockups went stale unnoticed. **Explicitly declined in this slice** (see §10 entry 3). |

**No new canonical screenshots were captured for this change, and the gate is satisfied without them.**
Justification: the rendered delta is provably zero (no layout box), the two affected surfaces have
current rendered baselines from six days ago, and route (d) — the only variant that _would_ have needed
a re-baseline against live artboards — was declined at plan time.

### 2. Quality gaps in the canonical design

1. **The design has no `autocomplete` attribute anywhere.** It is a static prototype using
   `defaultValue`, with no `<form>` elements at all. On the question this change answers the design is
   **silent** — which is a weaker warrant than "the design supports it", and §10 entry 1 records it as
   such rather than dressing silence up as endorsement.
2. **`acctBox()` is a `<div>`** — no `<input>`, no `<label>`, no `readonly`. The project has exactly one
   identity-display idiom and it is a non-interactive chip. Route (d) would have had no source to port.
3. **Pre-existing, not caused by this change**: the design draws a two-row `AuthRule` strength checklist
   (`Co najmniej 10 znaków` / `Cyfra lub symbol`) between the confirm field and the CTA. The app has
   never shipped it. S-14 deviation 7 registered the _policy_ deviation (minimum stays 6) but **not the
   omission of the element**, and `invite-journey-fixes/design-contract.md:1191` asserts "Zero delta" for
   this surface — an assertion it cannot currently satisfy. Expect it at any vision-diff of R3/R6; it is
   **not** damage from this change.
4. **No R14 artboard exists.** The design has nine modes and "inactive account" is not one — consistent
   with the archive's record. Relevant here only via §10 entry 2.

### 3. Alignment — plan vs canonical

| Canonical surface             | Plan phase | Verdict                                                                                           |
| ----------------------------- | ---------- | ------------------------------------------------------------------------------------------------- |
| R3/R9 set-password (recovery) | Phase 1    | aligned — zero rendered delta                                                                     |
| R6/R10 invite-accept          | Phase 1    | aligned — zero rendered delta (same component, copy differs)                                      |
| `/dashboard/account/password` | Phase 2    | aligned under D6 (`no-mockup`) — zero rendered delta                                              |
| R11 link-conflict, R12 in-app | _none_     | correctly untouched — `AccountBox` is not modified, so its two non-form call sites are unaffected |

No plan phase contradicts the design. No canonical surface lacks a phase. No surface required a product
decision.

---

## Token map

**None.** This change introduces no color, radius, spacing, or type value. `class="hidden"` is Tailwind's
`display:none` utility, already in use across the codebase (`SiteHeader.astro:70`, `:84`,
`ProcessSteps.astro:47`, `FilterBar.tsx:121`, `:136`).

## Screen inventory

| Mockup ref                                 | App surface                                  | Component                                  |
| ------------------------------------------ | -------------------------------------------- | ------------------------------------------ |
| `password-reset.jsx` mode `set` / `invite` | `/auth/reset-password` (`branch === "form"`) | `ResetPasswordForm` + slotted `AccountBox` |
| _(no mockup — D6)_                         | `/dashboard/account/password`                | `ChangePasswordForm`                       |

## Per-surface spec

### `/auth/reset-password` — R3/R9 + R6/R10

| Element                    | Value                                                                                                                                    | Status                                                                                              |
| -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| Card vertical rhythm       | `gap-[18px]` on the `<form>` (`ResetPasswordForm.tsx:56`)                                                                                | `exact` — unchanged                                                                                 |
| `AccountBox` position      | between subtitle and password group                                                                                                      | `exact` — unchanged (S-14 §8.4)                                                                     |
| `AccountBox` element table | every row per S-14 §7.2                                                                                                                  | `exact` — unchanged; the component is not modified                                                  |
| Password group             | `flex flex-col gap-3.5`, two `FormField`s at `h-[50px]`                                                                                  | `exact` — unchanged                                                                                 |
| **Username anchor**        | `display:none` — no box, no baseline contribution, no effect on the flex gap chain                                                       | `deviation(machine-facing markup; design source is silent)` — §10 entry 1                           |
| Anchor position            | first child of the slot, before `AccountBox` and before both password fields                                                             | `exact` to the engine requirement (Firefox searches only fields preceding the first password field) |
| Verbatim Polish copy       | unchanged — `Ustaw hasło` / `Ustaw nowe hasło`, `Ustawiasz hasło dla`, `Nowe hasło`, `Potwierdź hasło`, `Aktywuj konto` / `Zapisz hasło` | `exact`                                                                                             |
| New copy strings           | **none**                                                                                                                                 | `exact`                                                                                             |

### `/dashboard/account/password` — D6, no mockup

| Element                                 | Value                                                                         | Status                                                                                            |
| --------------------------------------- | ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| Card + rhythm                           | auth card's verbatim (`gap-[18px]`, `md:w-[440px]`, `md:px-10 md:py-9`)       | `exact` — unchanged (D6)                                                                          |
| Password group                          | three `FormField`s, `flex flex-col gap-3.5`                                   | `exact` — unchanged                                                                               |
| **Username anchor**                     | `display:none`, first child of the `<form>`, above the `Obecne hasło` field   | `deviation(machine-facing markup; no mockup exists for this surface at all — D6)` — §10 entry 1   |
| `children` slot on `ChangePasswordForm` | new prop; renders no markup of its own                                        | `deviation(structural — mirrors ResetPasswordForm.tsx:77 rather than inventing a second pattern)` |
| Verbatim Polish copy                    | unchanged — `Zmień hasło`, `Obecne hasło`, `Nowe hasło`, `Powtórz nowe hasło` | `exact`                                                                                           |

## Field list — the anchor, per attribute

Every attribute is load-bearing; none is decorative. Sources in research §2.4.

| Attribute      | Value                                            | Why                                                                                                                 |
| -------------- | ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------- |
| `type`         | `text`                                           | `type="hidden"` is rejected by Chrome, Firefox **and** WebKit. Non-negotiable.                                      |
| `id`           | `username`                                       | Feeds the name-based heuristics third-party managers use.                                                           |
| `name`         | **omitted**                                      | Never submitted → closes the tampering vector, and makes a manager overwrite harmless. Django's shipping choice.    |
| `value`        | the address; input not rendered if empty         | Chrome's `kSaving` mode drops empty-valued fields — an empty value defeats the fix silently.                        |
| `autocomplete` | `username`                                       | Honoured at top priority by both engines, ahead of positional heuristics. Sufficient alone.                         |
| `readonly`     | present                                          | Stops a manager overwriting the address (`IsElementEditable`). `disabled` would not be submitted and is wrong here. |
| `class`        | `hidden`                                         | Tailwind `display:none`. Chrome's autocomplete path applies no visibility filter; zero a11y surface.                |
| position       | before the first password field, same form owner | Firefox searches only preceding fields and will never find one placed after.                                        |

## §10 — Deviations register

1. **A machine-facing form control on a surface whose design draws none.**
   `deviation(design source is silent — machine-facing markup)`. `password-reset.jsx` is a static
   prototype with no `<form>` and no `autocomplete` anywhere, so this is a deviation **against silence**,
   not against a drawn decision — a weaker warrant than usual, recorded as such. The control renders no
   box and changes no pixel. Precedent for contracting a non-visual addition: S-14 §10 entry 14
   (`no artboard`, non-visual). The reader-facing identity disclosure remains `AccountBox`'s job
   (`AccountBox.astro:9-12`); this input is a second, invisible copy of the same address, and the risk
   that copy carries is **silent drift** — if a future change alters what `AccountBox` displays without
   altering the anchor, the two disagree with no visible symptom. Both read the same variable at both
   call sites today (`linkEmail` / `user.email`), which is what keeps them in step; a future change must
   preserve that single-source property.

2. **Inherited — S-14 §10 entry 14 is stale in two ways. Both are corrected here.**
   `invite-journey-fixes/design-contract.md:1162-1172` records the first and asks a future auth slice to
   carry the correction forward. This is that slice.
   - **Already recorded, restated:** entry 14 names one of R14's accepted false readings as _"a hire whose
     profiles insert failed after the invite was already sent, who has no profiles row permanently."_
     `invite-journey-fixes` Phase 1's compensating `deleteUser` makes that population **rare rather than
     permanent**, and Phase 4's token-lookup RPC changes when the refusal is reached.
   - **Not previously recorded anywhere — found while planning this change:** entry 14 justifies R14
     carrying **no account box** with _"this branch runs after the `!user` gate, so `user.email` is always
     available."_ **That is now false.** R14 is reached only via the token path
     (`auth-session.ts:216-218` requires a `pendingToken`), and `callback.ts:50-52` redirects any
     session-holder to `/auth/link-conflict` while minting no session itself (`:23-26`). So `user` is
     `null` on that branch and the only address available is the link target's.
     **The decision still stands — R14 correctly shows no account box — but its stated reason does not.**
     The correct reason: naming an account on a refusal the reader can only act on by contacting an admin
     would turn it into a per-address account-state readout, which is the argument entry 14 already makes
     in its next sentence and which does not depend on where the address comes from.

   Both archived folders are read-only, so this entry is the current statement.

3. **Declined here: promoting the auth screens into `design-system.md`.**
   The original entry-14 note anticipated that a slice "promoting the auth artboards into
   `design-system.md`" would carry its correction forward. This slice carries the correction (entry 2)
   but does **not** perform the promotion — it is out of scope for a two-input markup fix, and desktop
   artboards cannot be pulled through `DesignSync get_file`'s 256 KiB cap. The catalog gap that
   `…/2026-08-11-auth-surface-hardening/design-review/index.md:59-60` names as the root cause of silent
   mockup staleness therefore **remains open** after this change. Recorded so the next reader is not left
   waiting on a discharge that already happened.

4. **Declined here: route (d), promoting `AccountBox`'s address to a visible readonly field.**
   It is the only variant WebKit could reach — but Safari's save-attribution logic is closed-source, so
   that benefit is **unverified**, and Apple's own Password AutoFill doc shows a change-password example
   with no username field and never mentions hidden inputs. Cost would have been a §7.2 supersession, a
   per-consumer split (2 of `AccountBox`'s 3 call sites name a different subject), an §8.4 rewrite, a
   readonly visual state with **no source anywhere in the design project**, and a vision re-baseline
   against live artboards. Declined on cost against an unverified benefit, not on principle.

5. **Declined here: the `sr-only` variant.** It would additionally survive Chrome's fallback heuristics
   and _might_ reach Safari, but requires `tabindex="-1"`, and **nothing in this repo would catch its
   absence**: `@axe-core/playwright` is absent, and `astro/jsx-a11y/no-aria-hidden-on-focusable` is not
   among the enabled rules. `display:none` has zero accessibility surface and so cannot create a defect
   the project has no gate for. It also buys nothing for Bitwarden, whose visibility service rejects
   `clip-path: inset(50%)` — the exact value this project's `.sr-only` compiles to — explicitly.

## §11 — Vision-diff gate

| Surface                          | Baseline                                                                                   | Assertion                                                                                |
| -------------------------------- | ------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------- |
| `/auth/reset-password`, recovery | `…/2026-08-18-invite-journey-fixes/design-review/rendered/auth-R3-recovery-form-{d,m}.png` | **Zero** delta — a `display:none` input generates no layout box                          |
| `/auth/reset-password`, invite   | `…/rendered/auth-R6-invite-form-{d,m}.png`                                                 | **Zero** delta                                                                           |
| `/dashboard/account/password`    | _(none exists)_                                                                            | **Zero** delta against the pre-change render; capture before editing if a diff is wanted |

**Caveat carried forward, not introduced here**: a vision-diff of R3/R6 against the _design source_
(rather than these rendered baselines) will surface the missing password-strength checklist — see audit
gap 3. That is a pre-existing S-14 divergence, not damage from this change.
