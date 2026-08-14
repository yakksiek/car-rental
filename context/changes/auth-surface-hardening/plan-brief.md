# Auth Surface Hardening (S-14) — Plan Brief

> Full plan: `context/changes/auth-surface-hardening/plan.md`
> Research: `context/changes/auth-surface-hardening/research.md`

## What & Why

`/api/auth/reset-password` sets a password for **any** authenticated session — its guard checks only
that a session exists, never that it came from a recovery or invite link. Reproduced twice: ordinary
sign-in → one POST → password changed, old one dead, no link involved. That bypasses the
reauthenticate-before-update gate S-11 built one route over. This slice makes session **origin** a
provable precondition, revokes every session on success, and stops the auth surfaces echoing
arbitrary text from `?error=`.

## Starting Point

Two routes set a password. `/api/auth/change-password` (S-11) gates CSRF → session → role → zod →
reauth → update → revoke. `/api/auth/reset-password` (S-08) gates CSRF → _"a session exists"_ →
update, with no role check, no proof of identity, and no revocation. Structurally, only two things
survive the `/auth/callback` redirect — the Supabase cookies and `?mode=invite` — so today there is no
state a gate could read. No test in the repo would fail if the gate were removed entirely.

## Desired End State

A password can be set through the recovery route only by a caller holding **all three** of: a session
whose JWT records a link exchange, a fresh unspent marker stamped by `/auth/callback`, and a staff
role. On success every session is revoked and the user signs in fresh. `/auth/callback` refuses to
install a session over an existing one. Every auth surface renders only Polish the app itself
authored. The set-password page tells the truth in all four of its states instead of telling a cold
visitor their link expired.

## Key Decisions Made

| Decision           | Choice                                                  | Why (1 sentence)                                                                                                                                            | Source          |
| ------------------ | ------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------- |
| Gate mechanism     | Marker cookie **AND** `amr === "otp"`                   | A bare cookie is user-forgeable via devtools and `amr` never clears — but in an AND a cookie can only deny, never grant, so the pair is sound without HMAC. | Plan            |
| Post-set behaviour | `signOut({ scope: "global" })`, sign in fresh           | Fixes R1 and the never-clearing `amr` residue in one line, and matches OWASP; both e2e specs already sign in afterwards, so they stay green.                | Plan            |
| Ride-alongs        | R2 (role check), R3 (callback refusal), cookie `Secure` | R2's only blocker resolved clean — invited hires already have a role at accept time (`staff.ts:200-202`).                                                   | Research + Plan |
| Refused-link copy  | R5 "Link wygasł" for a spent marker                     | The link's usable window really is over and the CTA is already correct — no new screen.                                                                     | Plan            |
| `?error=` fix      | Short codes in the URL, resolved server-side            | No Polish sentence ever travels in a URL, so even a guessed code can only produce the app's own message.                                                    | Plan            |
| Test layer         | Integration (new harness) **+** one new e2e             | `lessons.md:97-102` requires the negative case be asserted deterministically; the harness can currently only mint the session type the gate must reject.    | Plan            |
| Copy scope         | Full refresh from the design project                    | Verified against live `shared.jsx`: every existing string already matches what ships, so a full refresh costs almost nothing and closes both divergences.   | Plan            |
| Phasing            | 5 phases, each demoable on :4321                        | Owner requirement — every stage must be manually verifiable in the live local app.                                                                          | Plan            |

## Scope

**In scope:** the session-origin gate (F1); revocation on reset (R1); role check (R2); callback
session-fixation refusal (R3); `?error=` code whitelist across three sinks (F6); the R11/R12/R13
screens and their Polish copy; the `setFor` account box; status heads + CTA alignment on the state
cards; `?done=1` forgery; `/auth` → `/auth/signin`; cookie `Secure`; the integration harness for
link-minted sessions.

**Out of scope:** flipping `secure_password_change`; adding `/auth/*` to `ROUTE_ROLES`; a custom 404
page; changing `httpOnly: false`; explicit CSRF on signin/signout/signup; rate limiting the
password-update path; CSP / `X-Frame-Options`; tightening the zod schema to the design's "10 znaków"
hint. The last five are recorded in `known-issues.md` rather than silently dropped.

## Architecture / Approach

Two signals guarding different dimensions, required together:

```
/auth/callback ──verifyOtp──► session (amr = otp)  +  stamp one-shot marker cookie
                                     │
                                     ▼
POST /api/auth/reset-password:  CSRF → session → role → amr==="otp" → marker present
                                     │
                                     ▼
                   updateUser → delete marker → set done-cookie → signOut(global)
```

`amr` is unforgeable (inside the GoTrue-signed JWT) but permanent; the marker is forgeable but fresh
and one-shot. The claim read lives in a single helper (`src/lib/auth-session.ts`) because it is the
app's first token-claim read — F-02 had explicitly chosen the `profiles` lookup over JWT claims.
Because success now ends in a global sign-out, the success screen keys on a short-lived done-cookie
rather than "has a session", which also closes the `?done=1` forgery.

## Phases at a Glance

| Phase                     | What it delivers                                               | Key risk                                                                                   |
| ------------------------- | -------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| 1. Gate + four-state page | F1/R1/R2 closed; R12/R13/R5 render correctly; new test harness | Deleting the marker on a _failed_ submit would bounce a user to "Link wygasł" after a typo |
| 2. Callback refusal       | R3 closed; R11 screen + sign-out island                        | Must not consume the token, or the link dies for the legitimate user                       |
| 3. Error-code whitelist   | F6 closed; GoTrue English gone                                 | Breaks 3 existing redirect-URL assertions by construction                                  |
| 4. Copy + chrome          | Design-aligned copy, `setFor` box, status heads                | `e2e/staff-auth.spec.ts:88` asserts `Witaj w Flocie` verbatim                              |
| 5. `Secure` + full suite  | Cookie posture; everything green together                      | A blanket `secure: true` breaks local `http://localhost`                                   |

**Prerequisites:** local Supabase running (`supabase stop && supabase start` — config reloads only
there); dev server on **port 4321** (`additional_redirect_urls` allow-lists only that port, so the
invite/recovery e2e specs silently drive the wrong server anywhere else); `.env.test` + `.dev.vars`
present.
**Estimated effort:** ~4–5 sessions across 5 phases; Phase 1 is the largest (gate + page + harness).

## Open Risks & Assumptions

- **The invite path is the trap.** A wrong gate locks new employees out of setting their first
  password. Mitigated by the verified `staff.ts:200-202` profile insert and by asserting the invite
  case explicitly at both the integration and e2e layers.
- **Port 4321 is load-bearing and invisible in the specs.** A run on any other port drives whatever
  else is serving 4321 — which is exactly how these specs once looked broken.
- The two e2e specs also fail at `963990d` (pre-S-11), so a red run there is not a regression.
- The `amr` claim's granularity is in flux upstream (#45210 asks for `amr: ["recovery"]`). The design
  deliberately treats it as the defence-in-depth half so the gate is easy to retire if GoTrue ships a
  scoped session.
- Adding status heads to the shipped R2/R4/R5 cards is layout work beyond a pure copy refresh —
  included for visual coherence with the three new screens, and flagged as the one judgement call in
  Phase 4 worth vetoing if unwanted.

## Success Criteria (Summary)

- The `review-fixes.md` reproduction no longer changes the password, and an integration test asserts
  the password is **unchanged** — not merely that the response was refused
- A new hire can still accept an invite and set their first password, and a staffer can still reset
  a forgotten one, both proven end to end in a browser on :4321
- No crafted link can render text of the attacker's choosing on any auth surface
