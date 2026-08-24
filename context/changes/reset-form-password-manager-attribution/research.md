---
date: 2026-08-24T15:18:39+02:00 (CEST)
researcher: MarcinK
git_commit: bbf24a2337a128c6f87b29af1f057a14c3df9914
branch: feature/invite-journey-fixes
repository: fleet-rent-staff-account
topic: "Set-password form has no username field — Chrome offers to overwrite the admin's saved password"
tags: [research, codebase, auth, password-manager, autocomplete, accessibility, design-contract, e2e]
status: complete
last_updated: 2026-08-24
last_updated_by: MarcinK
---

# Research: The set-password form has no username field, so Chrome offers to overwrite the admin's saved password

**Date**: 2026-08-24T15:18:39+02:00 (CEST)
**Researcher**: MarcinK
**Git Commit**: `bbf24a2337a128c6f87b29af1f057a14c3df9914`
**Branch**: `feature/invite-journey-fixes`
**Repository**: `fleet-rent-staff-account` (`github.com/yakksiek/car-rental`)

> HEAD is pushed to `origin/main` and `origin/feature/invite-journey-fixes`, so permalinks resolve
> against `https://github.com/yakksiek/car-rental/blob/bbf24a2/<path>#L<line>`. References below are
> `path:line` for local navigation; the commit above pins them.

## Research Question

Research `reset-form-password-manager-attribution`: the invite/recovery set-password form carries no
`autocomplete="username"` field, so Chrome attributes the newly typed password to whichever
credential it already holds for the origin — the admin's — and offers to _update_ it rather than
_save_ a new one. Establish whether the diagnosis is correct, what the fix actually is, where it can
live, how wide the blast radius runs, what the design source says, and which layer can prove what.

## Summary

**The diagnosis in `change.md` is correct and is provable line-by-line in current Chromium source.**
It is not a heuristic guess: `GetMatchForUpdating()` ends in an explicit, unconditional fallback —
_"Ultimate fallback: The submitted form had no username but a password. Assume that it corresponds to
an existing credential."_ — returning `credentials.front()`. A non-null return means
`PendingCredentialsState::UPDATE`, which is the "Update password?" bubble aimed at the stored
credential. Accepting it overwrites the admin's password with the hire's.

**One stated constraint in `change.md` is wrong, and it is the one that would have steered the fix.**
§"Open decisions" entry 2 says _"Not `display: none`. Chrome skips username fields hidden that way in
some heuristics."_ That is true of Chrome's **fallback** heuristics and false of the **autocomplete**
path, which is the path an explicit `autocomplete="username"` takes and which applies no visibility
filter at all. `display:none` is what 1Password documents, what Chromium's own form-styles doc shows,
and what Django ships in its admin. Both `display:none` and `sr-only` work for Chrome and Firefox;
they differ on accessibility surface and on which engines they reach. §2.3 lays out the trade.

**A second correction: the widely-repeated `type="hidden"` form of this fix does not work in any
engine.** Chrome never extracts hidden inputs (`GetAutofillFormControlType()` returns `nullopt` for
`kInputHidden`), Firefox's type whitelist rejects it, WebKit requires `isTextField()`. The shape that
works is a real `type="text"` input hidden with CSS.

**The fix can live entirely in `.astro`, and this was verified by running it, not by reading about
it.** Astro slots content into a React island as an opaque HTML string inside `<astro-slot>` via
`dangerouslySetInnerHTML`, wrapped in `memo(StaticHtml, () => true)` — a component that can never
re-render. A probe importing the real `@astrojs/react` server and client modules and hydrating in
headless Chromium confirmed: node identity survives hydration, `input.form` resolves to the
React-rendered `<form>`, a `setPassword` re-render leaves the slot untouched, and the submitted
`FormData` carries the field. The address never becomes a client-side JS value.

**`ResetPasswordForm` is the only affected surface in the app.** `ChangePasswordForm` has the same
structural gap but is benign for two independent reasons. `AccountBox` has exactly three call sites
and only one is inside a form — which rules out the component-level fix on blast radius alone,
before any design argument is needed.

**The verification story has no middle layer.** There is no DOM unit-test infrastructure, and
Playwright does not run in CI. The honest map is: ESLint catches a misspelled token; a local-only
E2E spec can assert the input's presence, value and position; the symptom itself is manual.

---

## Detailed Findings

### 1. The defect — verified in Chromium source, not inferred

#### 1.1 The chain, end to end

All quotes from `chromium/main`, read 2026-08-24.

1. `components/password_manager/core/browser/form_parsing/form_data_parser.cc` — the parser finds no
   username field, so `username_value` is `u""`.
2. `password_manager_util.cc` → `IsEligibleForEmptyUsernameMatching()`, whose own comment names our
   case: _"This returns true if the username is empty, which typically happens when: 1. The browser
   failed to detect the username field on the page."_
3. `password_manager_util.cc` → `GetMatchForUpdating()`, final branch:
   ```cpp
   // Ultimate fallback: The submitted form had no username but a password.
   // Assume that it corresponds to an existing credential.
   if (IsEligibleForEmptyUsernameMatching(submitted_form) &&
       !username_updated_in_bubble && !credentials.empty()) {
     return credentials.front();
   }
   return nullptr;
   ```
   The fallback is **blind** — it compares nothing. It returns the _first_ stored credential for the
   origin.
4. `password_save_manager_impl.cc` → `ComputePendingCredentialsState()`: a non-null match whose
   `password_value` differs from the submitted one returns `PendingCredentialsState::UPDATE`.

`password_manager_util.h` documents the switch in one sentence: _"Returned value is nullptr if
`|submitted_form|` looks like a new credential for the site to be saved."_ nullptr → save prompt;
non-null → update prompt.

**So: no parseable username → blind fallback to the admin's credential → UPDATE bubble.** Exactly the
reported symptom, and exactly why it only appears after someone has signed in on that profile.

One mitigation already in the code, worth knowing: `!username_updated_in_bubble` — typing a username
into the save bubble by hand disables the blind fallback.

#### 1.2 Chrome already tells you about this

`components/autofill/content/renderer/page_passwords_analyser.cc` emits a DevTools console warning
whose inline comment names password-reset forms specifically:

> _"There is no formal requirement to have associated username fields for every password field, but
> providing one ensures that the Password Manager associates the correct account name with the
> password (for example in password reset forms)."_
> → `LinkDocumentation("Password forms should have (optionally hidden) username fields for
accessibility:")`

"**optionally hidden**" is Chrome's own endorsement of the hidden-field pattern. See §6.4 for why this
warning might matter to the verification story.

#### 1.3 The gap is a birth defect, not a regression

`ResetPasswordForm.tsx` and `ForgotPasswordForm.tsx` were created in the **same commit** — `7f1489a`
(2026-07-23, `employee-account-management` p3, "self-service reset & PKCE callback"). Forgot got
`autoComplete="username"` (`ForgotPasswordForm.tsx:54`); Reset never did. This confirms `change.md`'s
claim that the defect predates `invite-journey-fixes` by a month and was simply never exercised by
hand until the 2026-08-24 production walk-through.

Related: `git log -S'autoComplete="username"'` returns exactly two commits — `7f1489a` (Forgot) and
`a318421` (SignIn). The attribute has never been on the reset form.

---

### 2. The fix — exact markup, and two corrections to `change.md`

#### 2.1 `type="hidden"` does not work — in any engine

This is the single most commonly repeated wrong version of the fix. The ambiguity traces to web.dev's
phrase _"a hidden input element"_, which the Chromium doc it links to disambiguates as CSS-hidden.

| Engine    | `type="hidden"` behaviour                                                                                                                              | Source                                                               |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------- |
| Chrome    | Never reaches the password manager. `GetAutofillFormControlType()` returns `nullopt` for `kInputHidden`; extraction filters on `IsAutofillableElement` | `form_autofill_util.cc`                                              |
| Firefox   | Rejected by a type whitelist **before** `autocomplete` is consulted: `["text","email","url","tel","number","search"]`                                  | `LoginManager.shared.sys.mjs`, `inputTypeIsCompatibleWithUsername()` |
| WebKit    | Rejected — `inputElement->isTextField() \|\| inputElement->isEmailField()`                                                                             | `AutofillElements.cpp`                                               |
| Bitwarden | Excluded by selector; `hidden` heads the ignored-input-types list                                                                                      | `collect-autofill-content.service.ts`                                |

The HTML Standard explains why it is spec-legal but engine-ignored: on `input type=hidden` the
`autocomplete` attribute wears the **autofill anchor mantle** rather than the expectation mantle —
it describes the meaning of a value the page already holds, not a request to be treated as a fillable
control.

#### 2.2 `change.md`'s "not `display: none`" constraint is not supported

`change.md` §"Open decisions" entry 2 states the fix _"must be visually hidden but rendered
(off-screen / `sr-only`)"_. The source says otherwise for the path we would actually be taking:

- **Chrome applies no visibility filter on the autocomplete path.** `ProcessFields()` keeps every
  `IsTextInputElement()` field and only _annotates_ focusability
  (`if (field.is_focusable()) processed_field.interactability = Interactability::kPossible;`).
  `ParseUsingAutocomplete()` then iterates all processed fields with **no interactability check** —
  `autocomplete="username"` on a `display:none` text input is honoured outright. Visibility becomes a
  bar only in the fallback `FindUsernameFieldBaseHeuristics()`, which is where `change.md`'s claim is
  true. (`form_data_parser.cc`)
- **Firefox performs no element-visibility check at all** — confirmed both in `_getFormFields` and by
  two long-open bugs complaining about precisely that ([1247245](https://bugzilla.mozilla.org/show_bug.cgi?id=1247245),
  [1783962](https://bugzilla.mozilla.org/show_bug.cgi?id=1783962)).
- `display:none` is the shape **1Password documents verbatim**, the shape **Chromium's form-styles
  doc** shows, and the shape **Django ships** in
  `django/contrib/admin/templates/registration/password_reset_confirm.html` (ticket #31978, closed
  fixed 2020-11-29).

The constraint is not harmful — `sr-only` also works for Chrome and Firefox — but it is stated as a
fact and it is not one. The plan should not inherit it unexamined.

#### 2.3 `display:none` vs `sr-only` — the real trade

Both are viable. They differ on three axes, and this is a genuine planning decision:

|                                                                               | `display:none`                                                        | `sr-only` (`clip-path:inset(50%)`, 1px)                                                 |
| ----------------------------------------------------------------------------- | --------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| Chrome, autocomplete path                                                     | parsed                                                                | parsed                                                                                  |
| Chrome, **fallback** heuristics (if the autocomplete stage is ever discarded) | not found                                                             | found (rendered + focusable)                                                            |
| Firefox                                                                       | parsed                                                                | parsed                                                                                  |
| WebKit / Safari                                                               | not reachable (focus-order walk skips non-renderable)                 | probably reachable — **unverified**                                                     |
| Bitwarden                                                                     | not viewable                                                          | **also not viewable** — its visibility service names `clip-path: inset(50%)` explicitly |
| a11y surface                                                                  | **none** — not in the tree, not focusable, not in tab order           | real: needs `tabindex="-1"`, and `aria-hidden` if used                                  |
| axe                                                                           | never gathered (`excludeHidden: true` by default on the `label` rule) | `aria-hidden-focus` applies if `aria-hidden` is set                                     |
| In-repo precedent                                                             | none                                                                  | `ReservationForm.tsx:514-527` honeypot; `MobileNav.tsx:90-91` pairing                   |

Two notes that sharpen this:

- **Chrome's autocomplete stage is discardable.** `ParseUsingAutocomplete` tolerates ≤1 `username`
  and ≤2 `new-password`; _"if any assumption is violated, the autocomplete attribute is ignored"_ and
  Chrome falls back to positional heuristics — where `display:none` is invisible. Our form would have
  exactly 1 and 2, so the assumptions hold. `sr-only` is nevertheless the belt-and-braces choice.
- **`sr-only`'s exact value is the one Bitwarden rejects.** The built CSS in `dist/client/_astro/`
  is `.sr-only{clip-path:inset(50%);…width:1px;height:1px;…position:absolute;overflow:hidden}` —
  and Bitwarden's `dom-element-visibility.service.ts` marks an element non-viewable for
  `clip-path: inset(50%)` **and** for a bounding box under 10px in either dimension. So `sr-only`
  buys nothing for Bitwarden either; the only axis it wins on is Chrome's fallback path and possibly
  Safari.

#### 2.4 The rest of the attribute set, each justified

| Attribute                                                  | Why                                                                                                                                                                                                                                                                                                                                                                                                                           |
| ---------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `type="text"` (not `hidden`)                               | §2.1. `type="email"` also works — Chromium's own doc sample uses it. `text` is what 1Password and Django ship.                                                                                                                                                                                                                                                                                                                |
| `autocomplete="username"`                                  | Honoured at top priority in both engines, ahead of positional heuristics. Chrome: `ParseUsingAutocomplete` runs before base heuristics. Firefox: `getAutocompleteInfo()?.fieldName == "username"` is checked first and `break`s the search loop. **Sufficient on its own** — `name="username"` is not required.                                                                                                               |
| `id="username"`, **no `name`**                             | `id` still feeds the name-based heuristics third-party managers use (Chromium: _"Save both id and name attributes… If there is only one of them, it will be saved to `\|name\|`"_). Omitting `name` means the value is **never submitted** — which closes the tampering vector (§7) and makes a LastPass overwrite harmless. Django's shipping choice.                                                                        |
| non-empty `value`                                          | Chrome's `ProcessFields()` in `Mode::kSaving` drops empty-valued fields (`consider_only_non_empty`). **An empty value defeats the fix silently.** See §8 for the one edge case in our code.                                                                                                                                                                                                                                   |
| `readonly` (not `disabled`)                                | `disabled` controls are not submitted (MDN, 2026-04-24). More importantly `readonly` is what stops a manager overwriting the invite address: Chrome `IsUsernameAmendable` → `IsElementEditable = IsEnabled() && !IsReadOnly()`; Firefox, verbatim — _"Don't modify the username field because the user wouldn't be able to change it either."_ Harmless to parsing (Chromium consults readonly only in `IsLikelyPassword()`). |
| position: **before** both password inputs, same form owner | **Non-negotiable for Firefox**: `for (let i = pwFields[0].index - 1; i >= 0; i--)` — it searches only fields _preceding_ the first password field and will never find one placed after. Chrome's autocomplete path is order-agnostic but its fallback is not. Form grouping is by **form owner**, so `form="<id>"` works if the field must sit outside the `<form>` subtree.                                                  |

#### 2.5 Side effects — checked, and they are benign

- **No new first-render autofill.** `password_form_fill_data.cc`: `no_fill_on_page_load =
data.wait_for_username || data.password_element_renderer_id.is_null();`. A set-password page has
  only `new-password` fields, so there is no current-password element and nothing is filled on load.
  Firefox likewise does not autofill `new-password` (bug 1119063, fixed in FF 67).
- **Autofill _of_ the new field is blocked by `readonly`** in both engines (§2.4).
- **A helpful Firefox side effect**: with a readonly, pre-filled username, Firefox takes the _"only
  fill in the password if we find a matching login"_ branch — it will not push the admin's stored
  password onto the page.
- **Password Checkup improves rather than degrades.** Leak detection is keyed on the `{username,
password}` pair, so today's mis-attribution stores a wrong pair; the fix stores the right one.
- **One web.dev caution that applies directly**: _"the form for changing the user's password should
  be cleared or hidden from the page after the new password is set up… If the form stays filled out
  on the page after the password change has occurred, the browser may not be able to record the
  update."_ Our success path is a redirect to the R4 card (`reset-password.ts:173` → `?done=1`), so
  this is already satisfied — worth stating so nobody "fixes" it into an in-place swap later.

---

### 3. Where the fix can live

#### 3.1 The slot mechanism — VERIFIED by execution, not inference

`reset-password.astro:171-173` slots `<AccountBox/>` into `<ResetPasswordForm client:load>`, and
`ResetPasswordForm.tsx:77` places `{children}` as a direct child of the `<form>` opened at `:53`.
The question is whether an `<input>` in that slot survives hydration and is submitted. It does:

- **Server**: `@astrojs/react/dist/server.js` sets `newProps.children =
React.createElement(StaticHtml, { hydrate: true, value: newChildren })` where `newChildren` is the
  already-rendered Astro HTML **string**. `static-html.js` renders that as an `<astro-slot>` element
  with `suppressHydrationWarning: true` and `dangerouslySetInnerHTML`, exported as
  **`memo(StaticHtml, () => true)`** — `arePropsEqual` is hard-coded `true`, so the component **can
  never re-render**.
- **Client**: `astro-island.js` reads the live `<astro-slot>`'s `innerHTML` and passes it back;
  `@astrojs/react/dist/client.js` → `getChildren()` takes the `StaticHtml` branch because
  `experimentalReactChildren` is off — `astro.config.mjs:12` is a bare `react()`, and the
  `data-react-children` attribute is only written when that flag is set. React does not descend into
  a node carrying `dangerouslySetInnerHTML`, so the DOM subtree is adopted, not rebuilt.

**That matters concretely**: the experimental path would copy DOM attributes into React props, turning
a `value=""` attribute into a controlled-input warning. This project is not on it.

A probe importing the real modules and hydrating in headless Chromium (built outside the repo;
nothing tracked was touched) measured:

```
afterHydrate: nodeIdentityPreserved: true, formOwnerIsForm: "f",
              entries: [["username","anna@…"],["password",""],["confirm",""]]
afterTyping:  nodeIdentityPreserved: true, slotStillThere: true
submitted:    [["username","anna@…"],["password","sekret123"],["confirm","sekret123"]]
logs:         (no React warnings, no errors)
```

`memo(…, () => true)` is the structural guarantee that no amount of `setPassword` re-rendering can
clobber the field. **The address never enters client JS as a value** — it exists only as HTML text
React copies as an opaque string.

#### 3.2 The submission path is not a native POST — and the field still travels

`Layout.astro:28` mounts `<ClientRouter />` for every page including the auth shell.
`ClientRouter.astro` installs a document-level `submit` listener that intercepts same-origin POSTs
with `new FormData(form, submitter)`. That is exactly what the probe measured, so the field travels on
both the router path and a plain native submit. It also bails on `ev.defaultPrevented`, which
correctly honours `handleSubmit`'s validation bail-out at `ResetPasswordForm.tsx:36-50`.

#### 3.3 The four injection sites, costed

`AccountBox.astro` has **three** call sites (R3/R9 and R6/R10 are the same JSX; only copy differs):

| #   | Site                                                 | Inside a `<form>`?                              | Subject of the email  |
| --- | ---------------------------------------------------- | ----------------------------------------------- | --------------------- |
| 1   | `reset-password.astro:172` — slotted into the island | **yes** (`ResetPasswordForm.tsx:77`)            | the link's **target** |
| 2   | `reset-password.astro:149` — R12 in-app              | no (followed by an `<a>`)                       | the **session**       |
| 3   | `link-conflict.astro:57` — R11                       | no (`SignOutButton`'s form is a sibling island) | the **session**       |

**(a) Inside `AccountBox.astro`** — touches all 3 sites. Sites 2 and 3 get inert dead markup: a
control with no form owner. Not harmful, but on R11/R12 the address is the _session's_, not the
target's, so a `username` field there is semantically wrong if it ever became live. Requires a §7.2
note saying the shared component now emits a form control on surfaces that have no form.
_Blast radius rules this out on its own._

**(b) A sibling element slotted alongside AccountBox in `reset-password.astro:171-173`** — touches
exactly the affected surface. Both nodes land in the same default-slot string → same `<astro-slot>`
→ same `<form>`, and naturally **before** the password fields, which is what Firefox requires.
Email stays out of client JS. Appearance unchanged. Lightest contract footprint: a line under the
R3/R9 + R6/R10 section, with AccountBox's `exact` table untouched.

**(c) A new `targetEmail` prop rendered by React** — touches 1 surface but changes the island's
contract and contradicts the rationale written at `ResetPasswordForm.tsx:15-18` and
`reset-password.astro:166-170` (the slot was chosen _specifically_ so no React copy of the identity
exists). Island props are serialized into an attribute and become a JS value inside the island.
**Trap, verified**: `value` without `readOnly` or `onChange` produces React's _"You provided a `value`
prop to a form field without an `onChange` handler"_ warning at both SSR and hydration; `readOnly`
silences it.

**(d) Promote AccountBox's address to a visible readonly field** — see §5.3.

#### 3.4 `FormField.tsx` is not the vehicle

`FormFieldProps` (`FormField.tsx:5-18`) has no `readOnly`, no `tabIndex`, no `aria-*`, no `className`,
no `ref`, and no rest spread. Beyond the missing passthroughs the markup is wrong for the job: `:38`
wraps everything in `<label className="block">`, `:39-41` renders a visible label, `:42-47` a
`h-[50px]` bordered row, `icon` is **required**, and `onChange` is required. It has 8 call sites, so
any passthrough added there touches the live sign-in and change-password fields too.

There is also a live coupling: `e2e/auth.setup.ts:39` and `e2e/e2e-rules.md:87` both record that
`FormField` nests the password toggle _inside_ its `<label>`, forcing role-scoped Playwright
selectors. Slipping a second `<input>` into that same label is exactly the structure those notes warn
about.

---

### 4. Blast radius — `ResetPasswordForm` is the only affected surface

The app has 12 real `<form>` elements. Exactly two contain `type="password"` inputs.

| Surface                                                               | Verdict                                                                                                                  |
| --------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `ResetPasswordForm.tsx:53` (both modes)                               | **AFFECTED — the only one**                                                                                              |
| `ChangePasswordForm.tsx:49`                                           | **BENIGN** — two independent reasons, below                                                                              |
| `SignInForm.tsx:55`                                                   | benign — has the `username` anchor (`:82`)                                                                               |
| `ForgotPasswordForm.tsx:30`                                           | benign — no password field, so no save/update prompt is possible                                                         |
| `StaffList.tsx:327` (add modal)                                       | flagged, **not the same defect** — cross-subject email, but no password field, so no credential save/update can fire     |
| `StaffList.tsx:473` (remove-confirm)                                  | flagged, lesser — no `<form>`, no password field; a wrong autofill fails safe by leaving the destructive button disabled |
| `ReservationForm.tsx`                                                 | not applicable — no `<form>` at all, no password, anonymous visitor                                                      |
| signout forms ×4, `VehicleForm`, `ProtocolForm`, `ReturnProtocolForm` | not applicable                                                                                                           |

**Why `ChangePasswordForm` is benign — the second reason matters more than the first.** `change.md`
gives one: it carries `autoComplete="current-password"` (`:67`), which anchors Chrome to the right
credential. The stronger one is that the actor _is_ the account holder — the route is behind the
`/dashboard` gate and `change-password.ts:84-87` **reauthenticates using `user.email` read
server-side**, so the form never sends an email at all. Subject and stored credential coincide, so an
"update password?" prompt is the _correct_ prompt.

`autoComplete="off"` on the StaffList email fields (`:370`, `:482`) is worth one caveat: Chrome has
ignored `off` for username-shaped fields since ~Chrome 34, so those may still be autofilled with the
admin's own address. That is a footgun, not this bug — no password field means no credential write.

**Server-side containment is structural.** `reset-password.ts:117-120` feeds zod an object built from
two explicit `form.get()` calls against a plain (non-strict) `z.object` at `:48-53`; unknown fields
never reach the schema. Same shape at `change-password.ts:72-76`. Confirms `change.md`'s claim — an
added input **cannot** reach or upset the handler. (With `name` omitted per §2.4 it is not even
submitted.)

---

### 5. Design source and contract

#### 5.1 Pulled fresh, 2026-08-24

`DesignSync get_file` on `password-reset.jsx` from `Rental car company`
(`352d78a6-84fd-49a2-8b38-2fe289691fc3`), read in this session:

- **`acctBox()` is a `<div>`.** No `<input>`, no `<label>`, no `readonly`, no `name` — the address is
  a text node in a nested div with ellipsis truncation.
- **No auth screen anywhere in the project renders a readonly or disabled input.** The two field
  primitives in the auth family (`AuthPassField` here, `LoginField` in `staff-login.jsx`) accept no
  `readOnly` or `disabled` prop. The project has **exactly one identity-display idiom and it is a
  non-interactive chip.**
- **The design has no `autocomplete` attribute anywhere.** It is a static prototype using
  `defaultValue`. On this question it is **silent** — there is nothing to diverge from. That is a
  weaker claim than "the design supports it" and the contract should say so rather than dress silence
  up as endorsement.
- **But the design's own ordering is already correct for a username field**: `acctBox` sits
  immediately before the `AuthPassField` pair, which is exactly where Firefox requires it. Route (d)
  changes the element's _nature_, not its _position_.

Screen order, set/invite mode: eyebrow (invite only) → title → subtitle → `acctBox` (mb 18) →
`Nowe hasło` → `Potwierdź hasło` → 2-row rule checklist → CTA → secure row.

#### 5.2 Two divergences found while pulling, neither caused by this change

1. **The app does not ship the strength checklist the design draws.** `AuthRule ok` × 2
   (`Co najmniej 10 znaków` / `Cyfra lub symbol`) sits between the confirm field and the CTA in the
   source; `ResetPasswordForm.tsx` has no equivalent. S-14 deviation 7 registered the _policy_
   deviation (minimum stays 6) but **not the omission of the element**. This matters because
   `invite-journey-fixes` `design-contract.md:1191` asserts **"Zero delta"** for this surface — an
   assertion it currently cannot satisfy. Expect it at the gate; do not rediscover it as new.
2. **§7.2 margin drift.** S-14 §7.2 specifies an 18px bottom margin on the R3/R9 and R6/R10 account
   box, but the shipped component carries no `class` at `reset-password.astro:172` and relies on
   `ResetPasswordForm.tsx:56`'s `gap-[18px]` — as the comment at `:74-76` explains.

Also confirmed: **no R14 artboard exists** — the design has nine modes and "inactive account" is not
one, consistent with the archive's record.

#### 5.3 The two routes, side by side

|                       | (a)/(b) hidden input                                      | (d) promoted visible field                                                                                                                                                  |
| --------------------- | --------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Contract weight       | one §10 entry + one placement line                        | §10 entry + §7.2 supersession + a per-consumer split + §8.4 rewrite + a readonly visual state with **no source anywhere in the project**                                    |
| Rendered delta        | none                                                      | none-to-substantial depending on sub-variant                                                                                                                                |
| Vision-diff           | no re-baseline                                            | **re-baseline required** — and the baselines are live artboards, so it means design-project writes plus re-export; desktop boards cannot be pulled (256 KiB `get_file` cap) |
| Design-source backing | silent                                                    | position endorsed, control type unprecedented                                                                                                                               |
| New Polish copy       | none                                                      | possibly one string → owner's copy gate                                                                                                                                     |
| Component churn       | none                                                      | `AccountBox.astro` grows a variant; `FormField` may need `readOnly`                                                                                                         |
| Precedent             | S-14 entry 14 (`no artboard`, non-visual)                 | S-11 **D6** (`no-mockup` — borrow the idiom wholesale and name it)                                                                                                          |
| Failure mode invited  | a duplicated address whose invisible copy silently drifts | a form control the design language has no word for                                                                                                                          |
| Extra lint cost       | none                                                      | `astro/jsx-a11y/label-has-associated-control` is `error`, so `AccountBox.astro:38`'s label `<div>` must become a real `<label for>`                                         |

The version of (d) worth planning, if it is chosen, is the **geometry-preserving** one: keep
`acctBox`'s exact geometry and swap only the address text node for an `<input readonly>` styled to be
visually identical. Then zero dimensions are invented and the register's closing formula ("no new
component, no new token, no new glyph, no new spacing decision") still holds. The full `FormField`
promotion — label above, 50px bordered row, Mail icon — displaces the 34px initials avatar and shifts
the card's vertical rhythm.

One argument for (d) that only the browser research surfaces: **it is the only variant WebKit can
reach.** A rendered, labelled, readonly input needs no ARIA, passes axe on its own label, is reachable
by every engine, and tells the user which account they are setting a password for. Caveat: Adrian
Roselli, _"Avoid Read-only Controls"_ (2024-11-21) — readonly inputs have no default styling and are
announced inconsistently (TalkBack says "disabled").

#### 5.4 The question was never asked before

A repo-wide sweep of `context/` for `username|autocomplete|password manager|readonly|sr-only|
1Password|keychain` returns **zero hits in any archive**. S-08 fixed the field list at two
(`2026-07-23-employee-account-management/design-contract.md:376`), and S-14 and
`invite-journey-fixes` both inherited it by reference. **There is no prior decision to overturn.**

#### 5.5 What AccountBox is for — the fuller argument

`AccountBox.astro:9-12` compresses `2026-08-11-auth-surface-hardening/research.md:393-397`:

> **Cheap mitigation for the irreducible branch.** When no session exists, the token _is_ the
> credential and must be honoured — server-side, "Anna clicked her own link" and "Anna clicked
> Bartek's link" are identical requests. Nothing can separate them… printing the target email there
> is a one-line mitigation that lets the human catch what the server cannot.

Two consequences: the box's job is **human disclosure, not data entry** — so route (b) adds a second,
invisible copy of the same address, a duplication the contract will have to explain; and the box is
load-bearing enough that a later slice architected around keeping it
(`invite-journey-fixes/plan-brief.md:50`).

#### 5.6 Open §12 follow-ups — none collide

12.5 (modal body-scroll), 12.6 (`am-team` board), 12.7 (roster banner), 12.8 (`/dashboard/vehicles`)
are all roster/fleet items. **One inherited item does touch auth**: `invite-journey-fixes`
`design-contract.md:1162-1172` records that S-14 entry 14 has gone stale and that _"a future slice
that promotes the auth artboards into `design-system.md` should carry the correction forward."_ This
is the next auth-surface slice, so it is the natural place to discharge that — or to explicitly
decline it. Related: the auth screens **have never been in the `design-system.md` catalog**, which
`2026-08-11-auth-surface-hardening/design-review/index.md:59-60` names as the reason S-08's mockups
went stale unnoticed.

---

### 6. Verification — what each layer can and cannot prove

#### 6.1 There is no DOM unit layer, and CLAUDE.md says otherwise

`vitest.config.ts:35-37` — the `unit` project is `include: ["src/**/*.test.ts"]`, `environment:
"node"`, **no `setupFiles`**. No `.tsx` in the glob, no jsdom or happy-dom, no `@testing-library/*` in
`package.json`. Zero `.test.tsx` files exist. No unit or component test touches
`ResetPasswordForm`, `ChangePasswordForm`, `FormField` or `AccountBox`.

**`CLAUDE.md:14` is stale**: it describes the unit project as _"jsdom, pure functions and
components"_. `context/foundation/test-plan.md:91` is the accurate record. A planner reading CLAUDE.md
would plan a unit test that cannot be written without adding 3 deps and widening the include glob —
which is its own decision, and must be stated rather than smuggled. (Note `lint-staged` runs
`vitest related --project unit`, so a new `.tsx` test would silently not run pre-commit either.)

#### 6.2 Playwright is not in CI

`.github/workflows/ci.yml` runs `astro sync` + lint + `npm run test` (unit) + build, plus a second
integration job. There is **no `test:e2e` step**; `context/foundation/test-plan.md:94` confirms
_"Local only — not a CI gate yet."_

#### 6.3 The honest layer map

| Layer                                                       | What it can prove                                                                                                      | Where it runs  |
| ----------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- | -------------- |
| ESLint `astro/jsx-a11y/autocomplete-valid` (error)          | only that the token is not misspelled                                                                                  | CI             |
| E2E spec                                                    | the input exists, carries `autocomplete="username"`, holds the link target's address, and precedes the password fields | **local only** |
| Manual, Chrome with a saved admin credential for the origin | the actual symptom — _save_, not _update the admin password_                                                           | human          |

Integration tests build their own request bodies (`tests/integration/reset-password.test.ts` passes
explicit `formBody` objects), so **none would change and none would catch a regression** in the new
markup.

**The e2e-rules collision must be resolved in the plan, not at implementation time.**
`e2e/e2e-rules.md:9-11` mandates role-based locators and forbids CSS selectors and DOM structure — but
a `display:none` input has no role, no accessible name, and is not in the a11y tree at all, so
`getByRole` cannot see it. `:15` further says to assert the business outcome rather than
implementation details, and "an input carries `autocomplete=username`" is implementation detail by
that rule's own wording. The plan should either justify the `getByTestId` escape hatch at `:10`, or
reach for `page.locator(...)` and say plainly why the rule is being set aside here. `:86-88` is the
shape to imitate — it records a specific locator quirk and the rule it forces.

**A cheap hook exists**: `e2e/fixtures/staff.ts:133-140` (`recoveryCallbackLink`) and `:158-177`
(`inviteCallbackLink`) mint links via `generateLink` with **no mail at all**, landing directly on the
rendered form and burning none of the 2-emails/hour quota. Both are idempotent, so the form re-renders
on every open.

#### 6.4 One lead worth a spike — UNVERIFIED

Chrome's own console warning (§1.2) is emitted by `page_passwords_analyser.cc` into the DevTools
console, which is **inside the page's tooling surface rather than browser chrome**. Playwright can
capture console messages. If that warning is reachable without DevTools being open, it would give the
change a genuine automated assertion for the _actual_ condition rather than a proxy.

**This is speculative.** `PagePasswordsAnalyser` appears to be DevTools-triggered, in which case a
headless Playwright run would never see it. Worth one short spike; worth nothing if asserted without
one. Do not plan around it until it is proven.

#### 6.5 No a11y gate exists at all

`@axe-core/playwright` is absent; `axe-core@4.11.4` is present only transitively via
`eslint-plugin-jsx-a11y`. `context/foundation/test-plan.md:95` records the layer as _"none yet — not
prioritized in this rollout"_.

Crucially, **`astro/jsx-a11y/no-aria-hidden-on-focusable` is not among the enabled rules**, and
`control-has-associated-label` is `off` with `input` in its ignore list. So `aria-hidden="true"` on a
still-focusable input would **pass every gate in this repo silently**. If the `sr-only` route is
chosen, `tabindex="-1"` is mandatory and nothing automated will remind anyone.

The precise axe rule, for the record: `aria-hidden-focus` has `excludeHidden: false` and selector
`[aria-hidden="true"]`, but its pass condition is **tabbable, not focusable** —
`tabIndex !== null ? isFocusable && tabIndex >= 0 : isFocusable`. So `tabindex="-1"` + `aria-hidden`
passes; `aria-hidden` alone on a readonly input **fails** (readonly inputs are still tabbable, and
`sr-only`'s 1px box misses axe's `(width===0 || height===0) && pointer-events:none` escape hatch).
`display:none` sidesteps the whole question — axe never gathers it.

Counter-note for a strict reviewer: MDN's `aria-hidden` page states flatly _"Do not use
`aria-hidden="true"` on focusable elements"_ with no tabindex carve-out. axe and W3C _Using ARIA_
(4th rule) both permit it. MDN's phrasing does not.

#### 6.6 The manual-gate shape to imitate

Three precedents, in increasing weight:

- **Shape A** — paired `#### Automated Verification:` / `#### Manual Verification:` blocks inside a
  plan phase, closed by an `**Implementation Note**` that pauses for a human.
  `2026-08-11-auth-surface-hardening/plan.md:311-337`. The closest existing criterion is `:652-654`
  — the end-to-end invite walkthrough, i.e. **exactly the walk during which this bug was found**. So
  the new manual gate is a _thickening of an existing criterion_, not a new ritual.
- **Shape B** — a plan clause naming the boundary in prose and handing the remainder over:
  `invite-journey-fixes/plan.md:1576-1577` — _"…readable without scrolling — **checked by hand at
  1280px, which the automated spec deliberately does not cover**"_.
- **Shape C** — the design-contract paragraph `change.md` already points at,
  `invite-journey-fixes/design-contract.md:1049-1056`. Three moving parts: name what the layer _does_
  gate with the clause that has teeth; name what it **cannot** gate and why; name which layer picks up
  the remainder — **and prove both halves bite by deliberately reintroducing the defect.**

For this change the reintroduction proof is available and cheap: deleting the input must turn the new
spec red.

**One caution from the same archive**: `2026-08-11-auth-surface-hardening/plan.md:830` records a
manual criterion that turned out **unsatisfiable as written**. So the manual step must name its
preconditions — **Chrome specifically, on a profile with a saved credential for the origin** — since
the symptom does not reproduce in Playwright's Chromium with a blank profile.

---

### 7. The "do nothing" counter-position, steelmanned

_"This is a Chrome-side heuristic misfire. It needs an admin with a saved credential for the origin,
opening someone else's invite link in their own profile, then clicking Update on a bubble that names
the credential being changed. The remedy is a non-semantic input that exists solely to feed a browser
feature, and it puts another person's email into whatever vault the visitor happens to run."_

The one genuinely sourced security objection is PortSwigger's: _"if the username is provided in a
hidden field, an attacker might be able to edit this value in the request to target arbitrary
users."_ **Real, and it is an argument about server-side trust, not about the field's existence.**
Django's answer — omit `name`, so it is never submitted — closes it completely, and our handler reads
only two named fields anyway.

Where the counter-position fails:

1. **No leak on this page.** The email is _already rendered as plain text_. A hidden field carrying
   the same string discloses nothing new.
2. **Asymmetric harm.** Doing nothing yields a silent corruption of a credential the admin owns — a
   lockout with no visible cause. Doing the fix yields, at worst, a declinable save prompt for
   someone else's address.
3. **No source advises against it.** Every primary source points the other way: Chrome's own DevTools
   warning, two Chromium design docs, web.dev, and 1Password's vendor doc, which names
   update-attribution as the whole point. Django — a security-conservative framework — ships it.

**Verdict: the counter-position is weak.** Its durable contribution is a constraint, not a veto:
_never trust the field server-side; the invite/reset token remains the authority on which account is
being changed._

---

## Code References

- `src/components/auth/ResetPasswordForm.tsx:53` — the affected `<form>`; `:77` the slot; `:90`,`:112` the two `new-password` fields; `:36-50` `handleSubmit`
- `src/pages/auth/reset-password.astro:172` — `AccountBox` slotted into the island (the one in-form call site); `:149` R12; `:85-86` `linkEmail` / `linkFullName`; `:71` the branch decision
- `src/pages/auth/link-conflict.astro:57` — R11 `AccountBox`, not in a form
- `src/components/auth/AccountBox.astro:28-41` — the chip; `:38` label `<div>`; `:39` address text node
- `src/components/auth/FormField.tsx:5-18` — props with no `readOnly`/`tabIndex`/`aria-*`; `:38` the wrapping `<label>`; `:51` `name={name ?? id}`
- `src/pages/api/auth/reset-password.ts:48-53` — zod schema; `:117-120` the two explicit `form.get()` calls; `:173` the success redirect
- `src/pages/api/auth/change-password.ts:84-87` — reauth using server-side `user.email`
- `src/components/account/ChangePasswordForm.tsx:67` — `current-password`, the anchor that makes it benign
- `src/components/auth/ForgotPasswordForm.tsx:54`, `src/components/auth/SignInForm.tsx:82` — the only two `username` anchors in the app
- `src/components/reservation/ReservationForm.tsx:514-527` — in-repo precedent: `sr-only` + `aria-hidden` + `tabIndex={-1}` + a real `<label>`
- `src/components/MobileNav.tsx:90-91` — in-repo precedent for the focusable/hidden pairing
- `src/layouts/Layout.astro:28` — `<ClientRouter />`, which intercepts the form POST
- `astro.config.mjs:12` — bare `react()`, i.e. `experimentalReactChildren` off
- `node_modules/@astrojs/react/dist/static-html.js` — `astro-slot` + `dangerouslySetInnerHTML` + `memo(…, () => true)`
- `vitest.config.ts:35-37` — the `unit` project: `*.test.ts`, `environment: "node"`
- `CLAUDE.md:14` — **stale**: claims jsdom + components
- `e2e/fixtures/staff.ts:133-140`, `:158-177` — `generateLink` link minters, no mail
- `e2e/e2e-rules.md:9-11`, `:86-88` — locator mandate and the `FormField` label quirk
- `dist/client/_astro/Layout.*.css` — `.sr-only{clip-path:inset(50%);…}`, already generated

## Architecture Insights

- **Astro slots into React islands are a genuine architectural seam, not a convenience.** The
  `memo(StaticHtml, () => true)` + `dangerouslySetInnerHTML` combination makes slotted content
  provably immune to island re-renders, which turns "keep server-only data out of client JS" from an
  intention into a structural guarantee. `reset-password.astro:166-170` already reasons this way for
  `AccountBox`; the same seam is what makes injection site (b) the cheap one.
- **Blast radius, not aesthetics, is what disqualifies the component-level fix.** `AccountBox` looks
  like the natural home for an identity-carrying input right up until you count its call sites and
  notice two of them name a _different subject_ and sit outside any form.
- **The repo's gate coverage is thinner than its documentation implies** in two independent places —
  `CLAUDE.md:14` on the unit project, and the absence of any a11y or e2e gate in CI. Both matter to
  this change specifically because the fix is markup that no existing layer inspects.
- **The design source is silent on machine-facing markup by construction.** It is a static prototype
  with no forms and no `autocomplete`. Any fix in this family will be a deviation against silence
  rather than against a drawn decision — which is a weaker warrant than usual and should be recorded
  as such.

## Historical Context (from prior changes)

- `context/archive/2026-07-23-employee-account-management/design-contract.md:376` — S-08 fixed the
  R3/R9 field list at **two** password fields. S-14 and `invite-journey-fixes` inherited it by
  reference. The username question was never raised.
- `context/archive/2026-08-11-auth-surface-hardening/design-contract.md:203-218` — §7.2, the
  `AccountBox` element table, every row `exact`; `:283-290` §8.4 fixes its position between subtitle
  and password fields; `:391-399` entry 14, the rule that **every state must state its box decision
  explicitly** because leaving it unstated caused a re-review.
- `context/archive/2026-08-11-auth-surface-hardening/research.md:393-397` — why `AccountBox` exists:
  the one mitigation available on the irreducible branch.
- `context/archive/2026-08-10-staff-account/design-contract.md:93`,`:162-174` — **D6**, the precedent
  for contracting a surface with no mockup: name the deviation kind, name the borrowed idiom,
  enumerate the field list **with its `autocomplete` value per field**. D6 added a third field to a
  two-field idiom in four bullets.
- `context/archive/2026-08-18-invite-journey-fixes/design-contract.md:806-1173` — §10, the deviations
  register; entry 3 (`:905-974`) is the closest structural model; `:1049-1056` is the
  "what the layer can and cannot prove" paragraph `change.md` points at; `:1162-1172` the inherited
  entry-14 staleness this slice could discharge.
- `context/archive/2026-08-11-auth-surface-hardening/design-review/index.md:44-49`,`:59-60` — desktop
  artboards cannot be pulled (256 KiB cap), and the auth flow has never been in the
  `design-system.md` catalog.

## Related Research

- `context/archive/2026-08-11-auth-surface-hardening/research.md` — the set-password surface's
  security model and the irreducible-branch argument
- `context/archive/2026-08-18-invite-journey-fixes/research.md` — the token-lookup rework that
  produced today's `resolveLinkTarget` / `linkEmail` plumbing
- `context/foundation/lessons.md` — "End every UI-touching plan with a Design Alignment Audit gate";
  "Port the design spec — not the code — at exact fidelity, with a vision-diff gate"

## Open Questions

1. **`display:none` or `sr-only`?** §2.3 gives the trade. `display:none` is vendor-documented, has
   zero a11y surface and needs no ARIA; `sr-only` additionally survives Chrome's fallback heuristics
   and _may_ reach Safari. Neither helps Bitwarden. `change.md`'s stated constraint against
   `display:none` is not supported by the source and should be re-decided rather than inherited.
2. **Injection site (b) or (d)?** (b) is one line in `reset-password.astro` with no rendered delta and
   no re-baseline. (d) is the only variant WebKit can reach and the only one that also improves the
   human-facing disclosure, but it costs a §7.2 supersession, a per-consumer split, a readonly visual
   state with no source, and a vision re-baseline against **live artboards** that requires design-project
   writes and hand-supplied desktop shots.
3. **Is `ChangePasswordForm` in scope?** It is genuinely benign (§4) — but `change.md` is right that
   an _unstated_ omission here is the shape that produced phase 11 last time. It needs an explicit
   in-scope/declined answer, and D6 is the clause that governs that surface. Note it also has **no
   E2E coverage at all**, so bringing it in means writing the first test that ever renders it.
4. **Does Chrome's console warning survive a headless Playwright run?** §6.4. One short spike decides
   whether the change gets a real automated assertion or only a proxy.
5. **Discharge the inherited entry-14 staleness, or decline it?** §5.6. This is the next auth-surface
   slice, so it is the natural place — and the auth artboards' absence from `design-system.md` is the
   related, larger gap.
6. **Safari/iCloud Keychain's save-attribution is genuinely unknown.** `AutofillElements.cpp` governs
   _filling_; the code deciding which Keychain item a saved password updates is closed-source. ~120
   WebKit bugs reviewed, none on hidden username fields in change-password forms. Apple's Password
   AutoFill doc shows a change-password example with no username field and never mentions hidden
   inputs. If Safari coverage is judged essential, route (d) is the only answer.
7. **Should `CLAUDE.md:14` be corrected as part of this change or separately?** It is wrong today and
   would mislead the next planner regardless of what this slice decides.
