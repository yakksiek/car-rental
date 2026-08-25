# Set-Password Username Anchor — Plan Brief

> Full plan: `context/changes/reset-form-password-manager-attribution/plan.md`
> Research: `context/changes/reset-form-password-manager-attribution/research.md`
> Design contract: `context/changes/reset-form-password-manager-attribution/design-contract.md`

## What & Why

The invite/recovery set-password form submits a new password with no parseable username, so Chrome
cannot attribute it to an account and blind-falls-back to the first credential it holds for the origin —
the **admin's**. It then offers to _update the admin's password_ with the hire's. Accepting it silently
corrupts a credential nothing server-side ever changed, producing a failed sign-in with no visible cause.
The fix is one `autocomplete="username"` anchor per password form.

## Starting Point

`ResetPasswordForm.tsx` already sets `autoComplete="new-password"` on both fields — the missing piece is
the username anchor. The target address is on screen, but as a **text node** (`AccountBox.astro:39`), which
no password manager can read. The gap is a birth defect: `ResetPasswordForm` and `ForgotPasswordForm` were
created in the same commit (`7f1489a`) and only Forgot got the anchor. `ChangePasswordForm` has the same
structural gap.

## Desired End State

Each password-setting form carries one hidden, nameless, readonly `autocomplete="username"` input holding
the address that form actually sets a password for — the link's target on `/auth/reset-password`, the
session's own address on `/dashboard/account/password`. Chrome offers to **save a new credential naming the
correct account** instead of updating an unrelated one. No pixel changes.

## Key Decisions Made

| Decision                   | Choice                                        | Why                                                                                                                                                                                                                                    | Source               |
| -------------------------- | --------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------- |
| Is the fix wanted at all?  | Yes                                           | Harm is asymmetric: doing nothing risks silent credential corruption; the fix risks a declinable save prompt. Every primary source — Chrome's own DevTools warning, web.dev, 1Password, Django — points the same way.                  | Research §7          |
| Injection route            | Slotted sibling in `reset-password.astro`     | Zero rendered delta, no design-contract supersession, no vision re-baseline. `AccountBox` is disqualified on blast radius: 3 call sites, only 1 in a form, 2 naming a different subject.                                               | Plan                 |
| Hiding technique           | `display:none` (Tailwind `hidden`)            | Chrome's autocomplete path applies **no** visibility filter, so the `change.md` constraint against it was unfounded. Zero a11y surface, so it cannot create a defect this repo has no gate for.                                        | Research §2.2 / Plan |
| Element type               | `type="text"`, **not** `type="hidden"`        | The widely-repeated `type="hidden"` version works in **no engine** — rejected by Chrome, Firefox and WebKit alike.                                                                                                                     | Research §2.1        |
| `name` attribute           | Omitted                                       | Never submitted → closes the tampering vector; both handlers read explicit `form.get()`s anyway.                                                                                                                                       | Research §2.4        |
| `ChangePasswordForm` scope | **In scope**                                  | Not merely consistency: `current-password` anchors Chrome only when the typed password matches a stored credential. With two accounts saved for the origin and the signed-in one absent from the vault, the same blind fallback fires. | Plan                 |
| Verification depth         | Manual gate only, no E2E spec                 | The symptom is browser chrome, outside any page. Stated as a real coverage gap rather than proxied by a criterion no layer can fail.                                                                                                   | Plan                 |
| Housekeeping riders        | `CLAUDE.md:14` + inherited entry-14 discharge | Both concern layers this change depends on; the design-system catalog promotion is explicitly declined.                                                                                                                                | Plan                 |

## Scope

**In scope:** the username anchor on `/auth/reset-password` (both modes) and `/dashboard/account/password`;
a `children` slot on `ChangePasswordForm`; correcting `CLAUDE.md:14` and `ResetPasswordForm.tsx:22-24`;
discharging the inherited S-14 entry-14 staleness.

**Out of scope:** any E2E spec; route (d) (promoting `AccountBox`'s address to a visible field); the
`sr-only` variant; promoting auth screens into `design-system.md`; the missing password-strength checklist
(a pre-existing S-14 divergence); any change to `AccountBox.astro` or `FormField.tsx`.

## Architecture / Approach

One shape applied twice, riding a seam that already exists:

```
reset-password.astro ──slot──► ResetPasswordForm  {children} at :77, above the password group
password.astro       ──slot──► ChangePasswordForm {children} — NEW, above the `current` field

  <input type="text" id="username" value={address} autocomplete="username" readonly class="hidden" />
```

Astro renders slotted content into a React island as an opaque HTML string inside `<astro-slot>`, exported
as `memo(StaticHtml, () => true)` — a component that can never re-render. Verified by execution (research
§3.1): node identity survives hydration, `input.form` resolves to the React-rendered `<form>`, and no
`setPassword` re-render can clobber it. The address never becomes a client-side JS value.

## Phases at a Glance

| Phase                     | What it delivers                                                            | Key risk                                                                                                                  |
| ------------------------- | --------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| 1. Set-password anchor    | The reported defect closed, both modes                                      | Manual gate needs a Chrome profile already holding a credential for the origin — it does not reproduce on a blank profile |
| 2. Change-password anchor | Same gap closed in-session; `ChangePasswordForm` gains a slot               | First structural change to a component with **no test coverage of any kind**                                              |
| 3. Documentation truth-up | `CLAUDE.md:14`, a stale component comment, the inherited entry-14 discharge | None material — doc-only                                                                                                  |

**Prerequisites:** local Supabase up; dev server on `:4321` (GoTrue's allow-list pins emailed link hosts
there); a Chrome profile with a saved credential for the origin; a throwaway account for link-minting —
**never** `employee@` or `admin@fleetrent.test`, which would rotate the password `e2e/auth.setup.ts` and the
integration suite sign in with.

**Estimated effort:** ~1 session. The code is roughly six lines across three files; the manual gates and the
contract work are the bulk.

## Open Risks & Assumptions

- **No automated layer can see this fix.** Deleting either input leaves every gate green — the input has no
  `name` so it never reaches an integration test, there is no DOM unit layer, and Playwright is not in CI.
  This is an accepted decision, not an oversight.
- **Safari/iCloud Keychain is not covered and its behavior is genuinely unknown** (closed-source save
  attribution). `display:none` is not reachable by WebKit. Accepted: the reported symptom is Chrome, and
  route (d) — the only WebKit-reachable variant — buys an unverified benefit at high cost.
- **Silent drift between the two copies of the address.** `AccountBox` and the anchor both render the same
  variable today; a future change that alters one without the other would disagree with no visible symptom.
- **A pre-existing R3/R6 divergence will surface at any vision-diff** — the app has never shipped the
  password-strength checklist the design draws. Not damage from this change; recorded so it is not
  rediscovered as new.

## Success Criteria (Summary)

- An admin who invites a hire, signs out, and opens the invite link on their own Chrome profile sees an
  offer to **save** the hire's credential — never to update their own.
- Both cards render pixel-identically to before, at desktop and mobile.
- No existing test changes, and the integration suite stays green unchanged — itself the evidence that the
  added markup reaches neither API handler.
