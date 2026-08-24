# Set-Password Username Anchor Implementation Plan

## Overview

Both password-setting forms in this app submit a new password with **no parseable username**, so
Chrome cannot attribute it to an account and falls back — blindly — to the first credential it holds
for the origin. On the invite/recovery form that credential belongs to the **admin who sent the
invite**, so Chrome offers to _update the admin's password_ with the hire's. Accepting it silently
corrupts a credential nothing server-side ever changed.

The fix is one `autocomplete="username"` anchor per form: a nameless, `readonly`, CSS-hidden text
input carrying the address that form is actually setting a password for. Zero rendered delta, zero
bytes on the wire, contained entirely to markup.

## Current State Analysis

`ResetPasswordForm.tsx` sets `autoComplete="new-password"` on both fields (`:90`, `:112`) — correct —
but the form contains no username field. The target address IS on screen, rendered by `AccountBox` as
a **text node** (`AccountBox.astro:39`), which no password manager can read.

The chain is verified in Chromium source, not inferred from the symptom (research §1.1):

1. `form_data_parser.cc` finds no username field → `username_value` is `u""`.
2. `password_manager_util.cc` → `GetMatchForUpdating()` ends in an unconditional fallback —
   _"Ultimate fallback: The submitted form had no username but a password. Assume that it corresponds
   to an existing credential."_ — returning `credentials.front()`. It compares **nothing**.
3. `password_save_manager_impl.cc` → a non-null match whose password differs returns
   `PendingCredentialsState::UPDATE` — the "Update password?" bubble.

The gap is a birth defect, not a regression: `ResetPasswordForm.tsx` and `ForgotPasswordForm.tsx`
were created in the same commit (`7f1489a`, 2026-07-23); Forgot got `autoComplete="username"`
(`ForgotPasswordForm.tsx:54`), Reset never did.

**`ChangePasswordForm.tsx` has the same structural gap.** It is _narrower_, not benign:
`autoComplete="current-password"` (`:67`) anchors Chrome only when the typed current password matches
a stored credential. On a shared workstation where the admin has two accounts saved for the origin but
never saved the one they are currently signed in as, the same blind `credentials.front()` fallback
fires and updates the wrong one.

## Desired End State

Each password-setting form carries exactly one `autocomplete="username"` input, positioned before its
first password field, holding the address whose password that form sets — the **link's target** on
`/auth/reset-password`, the **session's own** address on `/dashboard/account/password`.

Verified by: opening either form in Chrome on a profile that already holds a credential for the
origin, setting a password, and seeing the bubble offer to **save a new credential naming the correct
address** rather than to update an unrelated one.

### Key Discoveries:

- **The Astro-slot seam is a structural guarantee, not a convenience** (research §3.1, verified by
  executing the real modules in headless Chromium). `@astrojs/react` renders slotted content as an
  `<astro-slot>` with `dangerouslySetInnerHTML`, exported as `memo(StaticHtml, () => true)` — a
  component that can _never_ re-render. A slotted `<input>` keeps its node identity through hydration,
  resolves `input.form` to the React-rendered `<form>`, and survives every `setPassword` re-render.
  The address never becomes a client-side JS value.
- **`AccountBox` is disqualified on blast radius, not aesthetics.** Three call sites
  (`reset-password.astro:172`, `:149`, `link-conflict.astro:57`); only the first is inside a form, and
  the other two name a _different subject_ — the session, not the link target.
- **`change.md`'s "not `display:none`" constraint is not supported** (research §2.2). Chrome's
  autocomplete path (`ParseUsingAutocomplete`) applies **no** visibility filter; the visibility bar
  exists only in the fallback heuristics, which our 1-username/2-new-password shape never reaches.
- **Server-side containment is structural.** `reset-password.ts:117-120` and `change-password.ts:72-76`
  build their zod input from explicit `form.get()` calls against non-strict `z.object`s. An added
  input cannot reach or upset either handler — and with `name` omitted it is not submitted at all.
- **`ChangePasswordForm` has no slot today.** `password.astro:73` renders
  `<ChangePasswordForm serverError={error} client:load />` with no children; the component's `Props`
  (`:11-13`) is `{ serverError }` only. Phase 2 must add the seam that `ResetPasswordForm` already has.
- **There is no automated layer that can see this fix.** No DOM unit infrastructure exists
  (`vitest.config.ts:35-37` is `*.test.ts` + `environment: "node"`), Playwright is not in CI, and a
  nameless input is never submitted so no integration test can observe it.

## What We're NOT Doing

- **No E2E spec.** Decided at plan time. See "Verification honesty" below — this is a real coverage
  gap, stated rather than papered over.
- **No promotion of `AccountBox`'s address to a visible field** (research route (d)). It is the only
  variant WebKit could reach, but Safari's save-attribution is closed-source so that benefit is
  unverified, and the cost is a §7.2 supersession, a per-consumer split, an §8.4 rewrite, a readonly
  visual state with no source anywhere in the design project, and a vision re-baseline against **live**
  artboards.
- **No `sr-only` variant.** `display:none` cannot create an accessibility defect; `sr-only` requires
  `tabindex="-1"` and **nothing in this repo would catch its absence** (no axe gate;
  `astro/jsx-a11y/no-aria-hidden-on-focusable` is not enabled).
- **No auth-screen promotion into `design-system.md`.** Declined explicitly; the catalog gap that
  `2026-08-11-auth-surface-hardening/design-review/index.md:59-60` names as the reason S-08's mockups
  went stale remains open after this slice.
- **No fix for the missing password-strength checklist.** The design draws a two-row `AuthRule`
  checklist between the confirm field and the CTA; the app has never shipped it (research §5.2). It
  is a **pre-existing** divergence that will surface at any vision-diff of this surface. Recorded so
  it is not rediscovered as new damage from this change.
- **No `ResetPasswordForm.tsx` edit.** Under route (b) the input is slotted from the `.astro` page; the
  island's own file is untouched.

## Implementation Approach

One shape, applied twice, using the seam each page already has (or, for phase 2, the seam
`ResetPasswordForm` already proves):

```
<input type="text" id="username" value={<address>} autocomplete="username" readonly class="hidden" />
```

Slotted from the `.astro` page — where the address already lives server-side — as a **sibling before**
the form's password fields. No `name`, so it is never submitted. No React prop, so the address stays
out of client JS.

Phase 1 fixes the reported defect. Phase 2 closes the same gap on the in-session form. Phase 3 corrects
two pieces of documentation that are wrong today and would mislead the next reader about exactly the
layers this change depends on.

## Critical Implementation Details

**Never `type="hidden"`.** This is the single most commonly repeated wrong version of this fix and it
does nothing in **any** engine: Chrome's `GetAutofillFormControlType()` returns `nullopt` for
`kInputHidden`, Firefox's type whitelist rejects it before `autocomplete` is even consulted, and WebKit
requires `isTextField()`. It must be a real `type="text"` input hidden with CSS. If a reviewer or a
later refactor "simplifies" it to `type="hidden"`, the fix silently stops working with no visible
symptom.

**An empty value defeats the fix silently.** Chrome's `ProcessFields()` in `Mode::kSaving` drops
empty-valued fields (`consider_only_non_empty`). Both call sites type their address as `string` via a
`?? ""` fallback (`reset-password.astro:85`; `Astro.locals.user` is `User | null`), so the input must
be **conditionally rendered on a non-empty address**, not rendered with a possibly-empty value. Neither
branch can actually produce an empty address today — `resolve_link_token` returns `u.email::text` and
the `form` branch requires a non-null target; `/dashboard` is middleware-gated — but the guard costs
one expression and removes a failure mode that has no symptom.

**Position is non-negotiable for Firefox.** `LoginManager` searches only fields _preceding_ the first
password field (`for (let i = pwFields[0].index - 1; i >= 0; i--)`) and will never find one placed
after. On `ChangePasswordForm` the first password field is `current` (`:57-78`), so the slot must sit
above the whole `flex flex-col gap-3.5` group, not between fields.

**`readonly`, never `disabled`.** `disabled` controls are not submitted, but more importantly
`readonly` is what stops a password manager overwriting the address: Chrome's `IsUsernameAmendable` →
`IsElementEditable = IsEnabled() && !IsReadOnly()`; Firefox states the same rule verbatim. It is
harmless to parsing.

**Do not convert either success path to an in-place swap.** web.dev is explicit that the form must be
cleared or hidden after the password is set, or the browser may fail to record the update. Both routes
already redirect (`reset-password.ts:173` → `?done=1`; `change-password.ts` → `?done=1`), so this holds
today — stated here so nobody "improves" it into an in-place success message later.

---

## Phase 1: Set-password form — the username anchor

### Overview

Close the reported defect: give `/auth/reset-password`'s form (both invite and recovery modes) an
`autocomplete="username"` anchor carrying the **link target's** address.

### Changes Required:

#### 1. The slotted anchor

**File**: `src/pages/auth/reset-password.astro`

**Intent**: Add the username anchor as a sibling immediately before `AccountBox` inside the
`<ResetPasswordForm>` slot, so Chrome and Firefox can attribute the submitted password to the link's
target rather than blind-falling-back to whichever credential the browser already holds for the origin.
Guard it on a non-empty `linkEmail`.

**Contract**: A single `<input>` inside the existing slot at `:171-173`, before `<AccountBox>`:
`type="text"`, `id="username"`, **no `name`**, `value={linkEmail}`, `autocomplete="username"`,
`readonly`, `class="hidden"`. Rendered only when `linkEmail` is non-empty. The island's props are
unchanged; `ResetPasswordForm.tsx` is not touched. `{children}` at `ResetPasswordForm.tsx:77` already
places the whole slot above the password group, satisfying Firefox's ordering requirement.

Both nodes land in the same default-slot string → the same `<astro-slot>` → the same `<form>` owner.

**Comment the two non-obvious constraints in place** — that `type="hidden"` would break it, and that
the missing `name` is deliberate (never submitted, closing the tampering vector PortSwigger raises).
Both are invisible from the markup and both are the kind of thing a later "cleanup" removes.

### Success Criteria:

#### Automated Verification:

- Lint passes, including `astro/jsx-a11y/autocomplete-valid`: `npm run lint`
- Type + Astro checks pass: `npx astro check`
- Production build succeeds: `npm run build`
- Integration suite still green (proves the added input reaches neither handler): `npm run test:integration`

#### Manual Verification:

- **DOM check** (`npm run dev`, port 4321): on the rendered form the input exists, precedes both
  password fields, carries `autocomplete="username"`, holds the link target's address, and has no
  `name` attribute.
- **The actual symptom, invite mode** — Chrome, on a profile that already holds a saved credential for
  the origin: open a **throwaway** hire's invite link and set a password. Chrome offers to **save a new
  credential** naming the hire's address — _not_ to update the admin's.
- **The actual symptom, recovery mode** — same check via a recovery link.
- **Rendered delta is zero**: the R3/R6 card is pixel-unchanged (no stray input, no layout shift), at
  desktop and mobile.

**Preconditions the manual gate depends on** (each of these has burned this project before):

- **Never complete a reset or invite on `employee@` or `admin@fleetrent.test`.** It rotates the
  password `e2e/auth.setup.ts` and the integration suite sign in with. Use a throwaway address.
- **Mint the link with `generateLink`, not a real email** — mirrors `e2e/fixtures/staff.ts:133-140`
  (`recoveryCallbackLink`) and `:158-177` (`inviteCallbackLink`). It sends no mail, so it costs none of
  the two-emails-per-hour local cap and none of production's 60s-per-user throttle.
- **Run on `:4321`.** GoTrue's allow-list pins the emailed link's host there.
- The symptom **does not reproduce on a blank profile** — a saved credential for the origin is what
  arms the fallback. Chrome specifically; this is not a cross-browser check.

**Implementation Note**: After completing this phase and all automated verification passes, pause here
for manual confirmation from the human that the manual testing was successful before proceeding to the
next phase.

---

## Phase 2: Change-password form — the same anchor

### Overview

Close the same gap on `/dashboard/account/password`. The form has no slot today, so this phase adds
the seam `ResetPasswordForm` already has, then uses it.

### Changes Required:

#### 1. The slot seam

**File**: `src/components/account/ChangePasswordForm.tsx`

**Intent**: Give the component a children slot so the page can inject server-rendered markup into the
form, mirroring `ResetPasswordForm`'s existing arrangement rather than inventing a second pattern.

**Contract**: `Props` (`:11-13`) gains `children?: ReactNode` (import the type from `react`, matching
`ResetPasswordForm.tsx:1`). `{children}` renders as the **first** child inside the `<form>` opened at
`:49` — above the `flex flex-col gap-3.5` group, so the anchor precedes the `current` password field
as Firefox requires. Carry a short comment explaining the placement constraint, as
`ResetPasswordForm.tsx:74-76` does for its own slot.

#### 2. The slotted anchor

**File**: `src/pages/dashboard/account/password.astro`

**Intent**: Slot the username anchor into the form, carrying the **session's own** address — the
account whose password this form changes.

**Contract**: `<ChangePasswordForm serverError={error} client:load>` at `:73` becomes a container
element with the same input shape as phase 1, differing only in its source: `value={user?.email}`,
guarded on non-empty. `user` is already destructured at `:24`. No API change —
`change-password.ts:72-76` reads three explicit named fields and reauthenticates from server-side
`user.email` (`:84-87`), so the nameless input is inert to it.

### Success Criteria:

#### Automated Verification:

- Lint passes: `npm run lint`
- Type + Astro checks pass: `npx astro check`
- Production build succeeds: `npm run build`
- Integration suite still green: `npm run test:integration`

#### Manual Verification:

- **DOM check**: on `/dashboard/account/password` the input precedes the `Obecne hasło` field, carries
  `autocomplete="username"` and the signed-in user's address, and has no `name`.
- **The narrower symptom** — Chrome, on a profile holding saved credentials for **two** accounts on this
  origin, signed in as the one that is _not_ `credentials.front()` and whose password is not in the
  vault: change the password and confirm the bubble targets the correct account.
- **Rendered delta is zero**: the change-password card is pixel-unchanged at desktop and mobile.
- The existing change-password flow still works end to end (wrong current password still refuses;
  correct one still redirects to `?done=1`).

**Implementation Note**: After completing this phase and all automated verification passes, pause here
for manual confirmation from the human that the manual testing was successful before proceeding to the
next phase.

---

## Phase 3: Documentation truth-up

### Overview

Three statements in the repo are wrong today. Two were found while verifying this change and concern
exactly the layers it depends on; the third is the inherited entry-14 correction this slice was asked
to discharge.

### Changes Required:

#### 1. The stale test-layer description

**File**: `CLAUDE.md`

**Intent**: Line 14 describes the `unit` Vitest project as _"jsdom, pure functions and components"_.
It is neither: `vitest.config.ts:35-37` is `include: ["src/**/*.test.ts"]`, `environment: "node"`, no
`setupFiles`, no `@testing-library/*` in `package.json`, and zero `.test.tsx` files exist. A planner
trusting it would plan a component test that cannot be written without adding three dependencies and
widening the include glob. Correct it to describe what the project actually is.

**Contract**: The Commands section's Vitest sentence. Describe `unit` as node-environment tests over
`src/**/*.test.ts` (pure functions), and say plainly that there is no DOM/component test layer.
`context/foundation/test-plan.md:91` is the accurate existing record to align with.

#### 2. The stale session claim on the reset form

**File**: `src/components/auth/ResetPasswordForm.tsx`

**Intent**: The header comment (`:22-24`) says _"The recovery session is already established (cookie)
by the /auth/callback exchange"_. That has not been true since `invite-journey-fixes`:
`callback.ts:23-26` states nothing irreversible happens there and no session is minted, and `:50-52`
redirects away if one exists. The exchange now happens at POST step (f),
`reset-password.ts:129-133`. Comment-only correction — no behavior change.

**Contract**: The component's header comment block. State that the form renders with **no session**,
and that the token is exchanged by the POST handler as one operation with the password set.

#### 3. The inherited entry-14 discharge

**File**: `context/changes/reset-form-password-manager-attribution/design-contract.md`

**Intent**: `invite-journey-fixes/design-contract.md:1162-1172` records that S-14 §10 entry 14 went
stale and that a future auth slice should carry the correction forward. This is that slice. Discharge
it — and correct a **second** staleness in the same entry that has not been recorded anywhere: entry 14
justifies R14 having no account box with _"this branch runs after the `!user` gate, so `user.email` is
always available."_ That is now false. R14 is reached only via the token path
(`auth-session.ts:216-218` requires a `pendingToken`), and `callback.ts:50-52` sends any session-holder
to `/auth/link-conflict` instead — so `user` is `null` there and the only address available is the
link target's. **The decision still stands; its stated reason does not.**

**Contract**: A `§10 — inherited` entry in this change's design contract, superseding both readings and
noting that the `design-system.md` catalog promotion the original note anticipated is explicitly
**declined** here, so the next reader is not left waiting on it.

### Success Criteria:

#### Automated Verification:

- Formatting passes on the edited markdown: `npm run format`
- Lint + Astro check still pass (the comment edit touches a `.tsx`): `npm run lint && npx astro check`

#### Manual Verification:

- `CLAUDE.md`'s test description matches `vitest.config.ts` when read side by side.
- The design contract's inherited entry reads correctly to someone who has not read the two archived
  contracts it supersedes.

---

## Testing Strategy

### Verification honesty — read this before adding a criterion

This change has **no automated coverage, by design decision**. That is unusual enough to state
explicitly rather than let a reader infer coverage from the presence of a Testing Strategy section:

| Layer                                      | What it can prove here                                                | Where it runs |
| ------------------------------------------ | --------------------------------------------------------------------- | ------------- |
| ESLint `astro/jsx-a11y/autocomplete-valid` | only that the token is not misspelled                                 | CI            |
| `astro check` / build                      | only that the markup compiles                                         | CI            |
| Integration suite                          | **nothing** — the input has no `name`, so it is never submitted       | CI            |
| Unit (Vitest)                              | **nothing** — node environment, no DOM layer exists                   | CI            |
| E2E (Playwright)                           | would prove presence/value/position — **not written** (plan decision) | n/a           |
| Manual, Chrome + a saved credential        | the actual symptom                                                    | human         |

**Deleting either input leaves every gate green.** The failure mode is invisible to CI and reproduces
only on a browser profile that already holds a credential for the origin. A criterion no layer can fail
is worse than no criterion (`invite-journey-fixes` design-contract §10 entry 4), so none is claimed.

If this proves uncomfortable in review, the cheap upgrade is a local-only Playwright spec using the
`generateLink` minters already in `e2e/fixtures/staff.ts` — it would need a stated resolution of the
`e2e/e2e-rules.md:9-11` locator mandate first, because a `display:none` input has no role and is not in
the accessibility tree, so `getByRole` cannot see it.

### Unit Tests:

None. No behavior reaches a pure function; `selectResetPasswordBranch`'s existing tests
(`src/lib/auth-session.test.ts:82`) are unaffected.

### Integration Tests:

None added. Existing `tests/integration/reset-password.test.ts` and the change-password tests build
their own request bodies and must stay green **unchanged** — that is itself the evidence that the added
markup cannot reach either handler.

### Manual Testing Steps:

1. Start the dev server on `:4321` and ensure local Supabase is up.
2. Mint an invite link for a **throwaway** address via `generateLink` (never `employee@` or
   `admin@fleetrent.test`).
3. In Chrome, on a profile that already has a saved credential for the origin, sign in as the admin
   once so a credential exists, then sign out.
4. Open the invite link, set a password, and read the password-manager bubble: it must offer to **save**
   a credential for the hire's address, not to **update** the admin's.
5. Repeat with a recovery link (recovery mode).
6. Signed in on a profile holding two credentials for the origin, change the password at
   `/dashboard/account/password` and confirm the bubble targets the signed-in account.
7. Confirm both cards render pixel-identically to before at desktop and mobile.

## Performance Considerations

None. Two hidden inputs, server-rendered, never submitted, no client JS, no additional network or
layout cost. `display:none` generates no layout box, so there is no paint or reflow contribution.

## Migration Notes

None — no schema, no data, no API contract changes. Fully revertible by deleting the two inputs and the
`children` prop; no state is written anywhere.

## References

- Research: `context/changes/reset-form-password-manager-attribution/research.md`
- Change brief: `context/changes/reset-form-password-manager-attribution/change.md`
- Design contract: `context/changes/reset-form-password-manager-attribution/design-contract.md`
- The seam this fix rides on: `src/components/auth/ResetPasswordForm.tsx:74-77`
- The pattern's only in-app precedent for a `username` anchor: `src/components/auth/ForgotPasswordForm.tsx:54`,
  `src/components/auth/SignInForm.tsx:82`
- Manual-gate shape: `context/archive/2026-08-11-auth-surface-hardening/plan.md:311-337`
- "What the layer can and cannot prove": `context/archive/2026-08-18-invite-journey-fixes/design-contract.md:1049-1056`
- Inherited entry-14 note: `context/archive/2026-08-18-invite-journey-fixes/design-contract.md:1162-1172`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Set-password form — the username anchor

#### Automated

- [x] 1.1 Lint passes, including `astro/jsx-a11y/autocomplete-valid` — 4f2993c
- [x] 1.2 Type + Astro checks pass — 4f2993c
- [x] 1.3 Production build succeeds — 4f2993c
- [x] 1.4 Integration suite still green — 4f2993c

#### Manual

- [x] 1.5 DOM check — input precedes both password fields, correct `autocomplete`/address, no `name` — 4f2993c
- [ ] 1.6 Actual symptom, invite mode — Chrome offers SAVE for the hire, not UPDATE for the admin
- [ ] 1.7 Actual symptom, recovery mode
- [x] 1.8 Rendered delta is zero at desktop and mobile — 4f2993c

### Phase 2: Change-password form — the same anchor

#### Automated

- [x] 2.1 Lint passes — e4c0e2f
- [x] 2.2 Type + Astro checks pass — e4c0e2f
- [x] 2.3 Production build succeeds — e4c0e2f
- [x] 2.4 Integration suite still green — e4c0e2f

#### Manual

- [x] 2.5 DOM check — input precedes `Obecne hasło`, carries the session's address, no `name` — e4c0e2f
- [ ] 2.6 Narrower symptom — two saved credentials, bubble targets the signed-in account
- [x] 2.7 Rendered delta is zero at desktop and mobile — e4c0e2f
- [x] 2.8 Existing change-password flow still works end to end — e4c0e2f

### Phase 3: Documentation truth-up

#### Automated

- [x] 3.1 Formatting passes on the edited markdown
- [x] 3.2 Lint + Astro check still pass

#### Manual

- [x] 3.3 `CLAUDE.md`'s test description matches `vitest.config.ts`
- [x] 3.4 Inherited entry reads correctly without the two archived contracts
