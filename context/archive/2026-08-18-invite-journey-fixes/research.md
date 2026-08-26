---
date: 2026-08-18T15:04:01+02:00 (CEST)
researcher: MarcinK
git_commit: 26f154be209e923b33d626dfd18bafb1470a83ab
branch: feature/invite-journey-fixes
repository: fleet-rent-staff-account
topic: "Invite journey fixes — provisioning rollback and link-conflict continue flow"
tags: [research, codebase, auth, provisioning, staff, link-conflict, design-contract, e2e]
status: complete
last_updated: 2026-08-20
last_updated_by: MarcinK
last_updated_note: "Reproduced both bugs by hand; §1.5(a) confirmed by probe (GoTrue stamps last_sign_in_at on the verifyOtp exchange); added Part 5 — a third measured instance of the same timing error, the option-C fork, and the deletion inventory C would owe"
---

# Research: Invite journey fixes — provisioning rollback and link-conflict continue flow

**Date**: 2026-08-18T15:04:01+02:00 (CEST)
**Researcher**: MarcinK
**Git Commit**: `26f154be209e923b33d626dfd18bafb1470a83ab`
**Branch**: `feature/invite-journey-fixes`
**Repository**: `fleet-rent-staff-account` (`github.com/yakksiek/car-rental`)

> Local refs only — this branch is not pushed, so GitHub permalinks would 404. All references are
> `path:line` against the commit above.

## Research Question

Research the `invite-journey-fixes` change: two bugs in the invited-hire journey — (1) a failed
`profiles` insert leaving an invited hire permanently role-less, and (2) `/auth/link-conflict`
misreading the reader's own half-finished link session as someone else's. Cover both, evaluate all
three of Bug 1's remediation options and recommend one, and pre-source the design contract, the
test-layer reachability, and the prior decisions this change must not reopen.

## Summary

**Both bugs are real. Three of the write-up's supporting claims are not.**

The write-up at `change.md` (copied from the archived `review-fixes.md`) is accurate about the
mechanisms and about every user-visible symptom. It is wrong about three inferences that were made
from control flow without reading what the code does:

1. **"An admin can't repair the half-created account."** False. `staff.ts:162-183` _is_ a repair
   path, written deliberately as one, shipped in `00863c8` on 2026-07-23 — **26 days before the
   write-up**. Re-adding the orphan's address unbans, upserts the profile, sends an activation mail
   and returns `reactivated`/HTTP 200. It did not go stale; it was never accurate.
2. **Option 2 ("insert the profile first")** is not implementable as written.
   `profiles.user_id` is simultaneously the primary key and a foreign key to `auth.users(id)`
   (`20260604153139_employee_admin_roles.sql:26`), so a profile cannot exist before the auth user.
   Its stated benefit fails too: `list_staff` INNER-joins `auth.users`, so a profile with no auth
   user would be invisible on the roster exactly like today's orphan.
3. **The fix predicate for Bug 2** — `readSessionOrigin(...) === "link"` **"or equivalently"** the
   presence of `LINK_ORIGIN_COOKIE` — is not an equivalence. Two reachable states pull the two apart
   in opposite directions. The correct predicate is the **conjunction**.

What survives, and what the change is actually about:

- **Bug 1 is a legibility defect, not a repair defect.** The orphan is invisible on the roster
  (`list_staff` selects `from public.profiles`, so an auth user with no profile drives no row), and
  the admin's error banner reads `Nie udało się zapisać zmiany. Sprawdź połączenie i spróbuj
ponownie.` — it blames the network for a failure that has already sent mail. The repair mechanism
  exists; nothing tells the admin it is needed, or that the button in front of them performs it.
- **Bug 2 is exactly as described, and one navigation from done** — but the fix's predicate,
  its role gate, and the "demote SignOutButton" line all need tightening before it is planned.
- **Option 3 (transactional RPC/trigger) should be closed out on evidence, not deferred.** A single
  RPC is structurally impossible; the trigger variant has zero precedent in 24 migrations and
  directly reverses a stated fail-closed invariant.

**Two latent defects were found en route that are worse than the bug being fixed** (§1.5). The first
is **confirmed by probe** (2026-08-20): GoTrue stamps `last_sign_in_at` on the `verifyOtp` link
exchange, so a hire who merely _clicks_ their invite is read by `staff.ts:180` as already having a
password. The repair path then sends them nothing and lists them as **AKTYWNY** — a password-less
account wearing a healthy label, which is strictly worse than the visibly-broken orphan. It is not
orphan-specific and must ship in the same slice.

**Both bugs share one root, and there is a third instance (Part 5, added 2026-08-20).** An
irreversible act happens before the thing it commits to is done — the mail is sent before the
profile lands, and the token is spent when the form _renders_ rather than when the password is
_submitted_. The third: **clicking the invite link alone grants a working employee session**, measured
against the running app. That points at **option C — defer the exchange to submit-time**, which
would dissolve Bug 2 rather than paper it with a continue card. Part 5 carries C's evaluation, its
costs, and the **deletion inventory** it would owe. The scope fork is recorded in `change.md`.

---

## Detailed Findings

# Part 1 — Bug 1: the orphaned invited hire

## 1.1 Confirmed exactly as written

| Claim                                               | Evidence                                                                |
| --------------------------------------------------- | ----------------------------------------------------------------------- |
| Invite sent first, insert second, no rollback       | `src/lib/services/staff.ts:192-205`                                     |
| Orphan's role resolves `null` forever               | `src/middleware.ts:36` — `maybeSingle()` → `null` → `&&` short-circuits |
| Their live link renders "Konto jest nieaktywne"     | `src/pages/auth/reset-password.astro:104-119`                           |
| Every `/dashboard` route answers a bare `Forbidden` | `src/middleware.ts:57-59`                                               |
| They never appear on the roster                     | `20260723194602_employee_account_management.sql:54-55`                  |
| Re-adding the address hits the `existing` branch    | `src/lib/services/staff.ts:149`                                         |

One addition the write-up does not mention: **sign-in itself succeeds.** Nothing in
`src/pages/api/auth/signin.ts` gates on role, so once the orphan has a password they can
authenticate and then hit 403 on every surface — the worst version of the experience.

## 1.2 Refuted: the repair path already exists and works

Line by line, when an admin re-adds an orphan's address:

| Line               | What happens                                                                        |
| ------------------ | ----------------------------------------------------------------------------------- |
| `staff.ts:147`     | `findAuthUserByEmail` → **found** (it reads GoTrue, not `profiles`)                 |
| `staff.ts:149`     | enters the `existing` branch                                                        |
| `staff.ts:150-154` | `.maybeSingle()` → `profile = null`, **no error** (zero rows is not an error)       |
| `staff.ts:159`     | `if (profile && ...)` short-circuits false → **not** `duplicate_active`             |
| `staff.ts:164`     | `updateUserById({ ban_duration: "none" })` — harmless no-op                         |
| `staff.ts:168-173` | **`.upsert(...)` — no conflicting row, so a plain INSERT. The orphan is repaired.** |
| `staff.ts:181-183` | `wasActive === false` → `resetPasswordForEmail` — a **recovery** mail               |
| `staff.ts:184-187` | returns `{ status: "reactivated" }` → `api/staff.ts:70-71` → HTTP 200               |

`git show 00863c8 -- src/lib/services/staff.ts` shows the arm present in the service's very first
commit, comment included: _"Deactivated, or an auth user with no profile row (e.g. a partial invite):
reactivate/repair."_

**What still goes wrong on that path** (the residue that _is_ worth fixing):

- The hire receives the **recovery** template — `Reset hasła — Flota`, `supabase/templates/recovery.html`,
  `&type=recovery` — so `callback.ts:98` computes `invite = false`, `callback.ts:116` stamps the marker
  `recovery`, and `ResetPasswordForm` renders `Ustaw nowe hasło` / `Zapisz hasło` instead of
  `Witaj we Flocie` / `Ustaw hasło` / `Aktywuj konto`. **A brand-new hire finishes through reset copy
  and never sees the invite welcome** — the same end-state Bug 2 produces, arriving by a second route.
- **The repair arm is untested.** Both integration tests that reach it
  (`tests/integration/staff.test.ts:82-115`, `:117-135`) start from a _deactivated profile that
  exists_. **No test covers `profile === null`** — the actual orphan shape.

## 1.3 The real defect: nothing makes the failure legible

`src/pages/api/staff.ts:66` has **no `try`/`catch`**. The PostgrestError thrown at `staff.ts:204`
propagates out of the `APIRoute` and the Cloudflare adapter answers a generic **500** (there is no
`src/pages/500.astro`). In the island, `src/components/staff/StaffList.tsx:491` routes every
non-`201`/`200`/`409` status to the same banner as a network failure:

> `Nie udało się zapisać zmiany. Sprawdź połączenie i spróbuj ponownie.`

The add modal also stays open — `setAddOpen(false)` runs only on the success arm (`:485`) —
reinforcing "nothing happened", while mail is already in the hire's inbox.

**One accidental mitigation**: the banner ships a **`Ponów`** button (`StaffList.tsx:69`, rendered at
`:643-655`) wired to `addEmployee(values)` with the same payload. Clicking it re-POSTs, takes the
`existing` branch, and repairs the orphan. The repair is real, unlabelled, and gone the moment the
admin dismisses the banner or reloads.

**What can actually make the insert fail**, ranked (RLS is _not_ on the list — `service_role` has
`rolbypassrls = t` and all four `profiles` policies target `{authenticated}` only):

1. **PostgREST schema-cache staleness (PGRST204).** `full_name` / `deactivated_at` arrive in a later
   migration (`20260723194602:22-23`); a stale cache 400s the insert. Same family as the PGRST202
   symptom already recorded for shared-worktree resets.
2. Schema drift — migration not applied in prod.
3. Transient failure between the two awaits. `:192` is GoTrue, `:200` is PostgREST — two services.
   The Worker-death variant produces no 500 body and no log.
4. PK violation from a concurrent double-submit (narrow — the loser usually dies on GoTrue's
   `email_exists` 422 at `:196` instead, which orphans nothing but shows the same 500 banner).

## 1.4 Option evaluation and recommendation

Two of the three options in `change.md` are closed by evidence rather than by preference.

**Option 2 as written is impossible.** `profiles.user_id uuid primary key references auth.users (id)
on delete cascade` (`20260604153139:26`, live-verified as `profiles_user_id_fkey`). And the roster
benefit it claims does not exist: `list_staff` is `from public.profiles p join auth.users u`
(`20260723194602:54-55`) — an INNER join, driven from `profiles`, so _neither_ orphan shape appears.

**Option 3 is not constructible in its RPC form and is contra-invariant in its trigger form.**
The invite is an HTTP call to a separate service; Postgres cannot call out either — the only
`create extension` in the entire migration tree is `btree_gist`
(`20260603155136_booking_integrity_data.sql:9`). No `pg_net`, no `http`. There is **no trigger on
`auth.users` anywhere in 24 migrations** and no `handle_new_user` function. The commented-out
`[auth.hook.before_user_created]` (`config.toml:293-295`) runs _before_ creation and can only
**reject** — it cannot insert a profile, because the row it would reference does not exist yet.
And a trigger would fire for the seed, every e2e fixture, and every future account type,
auto-granting `role = 'employee'` — directly reversing `20260604153139:22-24`:

> _"roles are only ever granted deliberately (seed / S-08 / prod first-admin runbook), **never
> auto-created with a privileged default**."_

That makes Option 3 a security-posture change wearing a bug-fix costume. It should be argued as one
or dropped.

**What remains is a four-way field**, two of which the write-up did not list:

|                           | **1 — compensating `deleteUser`**                                                                                                             | **2a — `generateLink` + own mail**                                                  | **2b — `createUser` + `resetPasswordForEmail`**                                    | **4 — make the failure legible**                         |
| ------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- | -------------------------------------------------------- |
| Feasibility               | High — the pattern is already written 3× in `e2e/fixtures/staff.ts`                                                                           | Medium — API present and used in-repo; invite mail moves to the Resend seam         | High — reuses `staff.ts:182` verbatim                                              | High — no new provider calls                             |
| Ordering fixed?           | No                                                                                                                                            | **Yes** — nothing irreversible is sent before the profile commits                   | Yes                                                                                | No                                                       |
| Hire's outcome on failure | Mail already delivered; link → `callback.ts:93` → **"Link wygasł"** with a CTA that silently never sends (forgot-password is non-enumerating) | **No mail was ever sent**                                                           | No mail sent                                                                       | Unchanged; but the admin now knows                       |
| Admin's outcome           | Orphan usually vanishes; retry takes the clean net-new path with correct invite copy                                                          | Error + retry, nothing delivered                                                    | Error + retry                                                                      | Explicit "invite sent, profile failed — retry to repair" |
| Migration                 | No                                                                                                                                            | No                                                                                  | No                                                                                 | Only if `list_staff` is widened                          |
| Test reachability         | Unit (fake client) + integration via a wrapped client                                                                                         | Same + assert no mail in Mailpit                                                    | Same                                                                               | Unit + integration                                       |
| Risk                      | Delete can itself fail → back to today's state but with a _live_ link into a 403 wall                                                         | Largest surface: new template, prod-only Resend send gate, `EMAIL_FROM` format trap | **Copy regression on the common path** — every new hire gets `Reset hasła — Flota` | Doesn't prevent the orphan, only surfaces it             |

**Recommendation — sequence it, and reject 2b outright.**

1. **Now: Option 4 + Option 1 together.** Catch the insert failure in `staff.ts`, attempt a
   compensating `deleteUser`, and return a _distinguishable_ result the API route maps to its own
   status and the island renders as its own message — not the network banner. This is the house
   pattern the codebase has already converged on elsewhere: the protocol-delivery flow has the
   identical two-systems shape and solves it by **making the fragile second step non-fatal,
   recording the outcome, surfacing it, and giving the operator an explicit repair action**
   (`src/lib/services/email-delivery.ts:57-77`; `src/pages/api/return-protocols/[id]/pdf.ts:18-21`
   — _"Returns 200 regardless of the email outcome, carrying the delivery status"_; resend routes as
   the repair action). Bug 1 already _has_ the repair action; what it lacks is the record and the
   surfacing.
2. **Then: Option 2a as the real fix.** `generateLink({ type: "invite" })` provisions the user and
   sends nothing — proven in-repo and depended on by five call sites, with the fixture at
   `e2e/fixtures/staff.ts:119-138` serving as a working prototype of the exact sequence
   (generateLink → insert → compensating delete on failure). Reordering to
   provision → insert → _then_ communicate is the only change that removes the defect instead of
   cleaning up after it. Its cost is honest and bounded: the invite mail moves onto the existing
   Resend seam and `supabase/templates/invite.html` is re-authored as an app template. It also takes
   the hosted 2-emails/hour cap off the admin's path. 2a still wants the compensating delete for the
   residual window between `generateLink` and the insert.
3. **Reject 2b.** It looks free — one line already in `staff.ts` — but it silently downgrades every
   new hire's first contact from the invite journey to a password-reset journey.
   `staff.ts:174-183` already documents accepting that compromise for _reactivation_, where the person
   has an account. Extending it to first-time hires trades a rare failure for a permanent regression
   on the common path.

Whether to also widen `list_staff` to a `LEFT JOIN` from `auth.users` so orphans surface as a
repairable roster row is a product call worth putting in the plan: it fixes the _surviving_
consequence directly, costs one `create or replace` (which preserves grants — unlike `drop`+`create`,
per `20260731212650:3-6`) plus a types regen, but it also puts a half-created account in front of the
admin as a new visual state that needs its own design decision.

## 1.5 Two latent defects found en route — (a) is CONFIRMED and must ship in the same slice

**(a) The repair path marks a password-less hire as `AKTYWNY` and sends them nothing.
CONFIRMED by probe against local Supabase, 2026-08-20.**

`staff.ts:180` derives `wasActive` from `last_sign_in_at`, using it as a proxy for "already has a
working password". **GoTrue stamps that field on the `verifyOtp` link exchange, not only on a
password sign-in** — so the proxy is wrong for exactly the population this change is about.

Probe (two orphans minted the same day, identical shape, one variable):

| account                       | clicked the invite link? | `last_sign_in_at`                                | `staff.ts:180`        |
| ----------------------------- | ------------------------ | ------------------------------------------------ | --------------------- |
| `nowy+fail@fleetrent.test`    | no                       | `null`                                           | `wasActive === false` |
| `orphan-repro-1787230971075@` | **yes**                  | **`2026-08-20T13:05:38Z`** (invited `13:02:51Z`) | `wasActive === true`  |

The clicked account has **no password** — it never reached the form, because
`reset-password.astro:104` refused it at the role gate. So the only event that could have minted a
session is the `verifyOtp` exchange at `callback.ts:88-91`. The stamp is the exchange.

Consequences on the repair path, for a hire who clicked before the admin re-added them:

1. `staff.ts:181` **skips `resetPasswordForEmail`** — they are sent nothing at all.
2. `buildMember(..., "active", ...)` puts them on the roster as **AKTYWNY**.

They have no password, no mail, and cannot sign in, and the roster now reports them healthy. **This
is a worse end state than the orphan**, which at least stayed visibly broken. The admin's only
remaining tool is the roster's "Resetuj hasło", if they think to use it.

Note the inversion: the outcome depends on whether the hire clicked _before_ the admin repaired.
Wait, and you get a recovery mail and a ZAPROSZONY label (recoverable). Click promptly, and you get
silence and a green label. **The diligent hire is punished.**

**This is wider than Bug 1.** `wasActive` guards the _general_ reactivation branch: anyone invited →
clicked → never set a password → deactivated → re-added hits it with no orphan involved.
`tests/integration/staff.test.ts:82` does not catch it because `createActiveEmployee` mints its user
with `createUser`, which never stamps `last_sign_in_at`.

**Implication for the plan**: `staff.ts:180-183` must key off _password-set_, not `last_sign_in_at`,
and it ships in the same slice — Bug 1's own repair path is what produces this. The same conflation
sits in `deriveStatus` (`staff.ts:69-71`), which drives the roster's ACTIVE/INVITED badge from the
same field; whether that is corrected too is a scope decision for the plan.

**(b) The activation mail can be silently swallowed.** `staff.ts:182`:

```ts
await admin.auth.resetPasswordForEmail(email, { redirectTo }).catch(() => undefined);
```

`supabase-js` returns `{ error }` rather than throwing, and the result is **not destructured at all** —
so the `.catch()` is dead code and the error is discarded either way. On hosted Supabase, where
`email_sent = 2` per hour _is_ enforced, a repair after the orphaning invite already burned the quota
returns `reactivated` / HTTP 200 / a green roster row with **no mail ever sent** and no signal.

## 1.6 Sibling: `deactivateStaff` has the same shape and a worse failure

`staff.ts:251-262` — RPC first (sets `deactivated_at`), GoTrue ban second (`:257`). If the ban throws,
the profile is already deactivated and nothing rolls back. Less severe (the DB side is the
authoritative gate) but **not self-healing and worse to retry**: the route 500s, `StaffList.tsx:519`
shows the error banner with **no retry button**, the row is not removed optimistically, and a manual
retry hits `deactivate_staff` again which returns `not_found` because `target_deactivated is not null`
(`20260723194602:96-98`) → **404 forever**. The ban can never be applied through the UI and the auth
user keeps a valid refresh token indefinitely. Out of scope here; worth recording.

`resetStaffPassword` is a single call — not a member of the family.

---

# Part 2 — Bug 2: `/auth/link-conflict` misreads a half-finished link session

## 2.1 The fix predicate must be a conjunction, not an "or equivalently"

`change.md:52-53` and `review-fixes.md:89-91` both offer
`readSessionOrigin(...) === "link"` **or equivalently** the presence of `LINK_ORIGIN_COOKIE`.
Two reachable states break the equivalence in opposite directions:

- **Origin without marker** (`> 1h after the exchange`): the marker has a hard `maxAge: 3600`;
  the session does not — `amr` survives refresh verbatim and the `otp` mark **never clears**
  (`auth-session.ts:11-13`, `:26-27`). A continue card here points at a page that renders
  **`Link wygasł`**, not the form.
- **Marker without origin**: `/api/auth/signout` never deletes `LINK_ORIGIN_COOKIE`
  (`src/pages/api/auth/signout.ts:5-16`), so open link → abandon → sign out → sign in with a password
  → click the link again leaves a `password` session carrying a live marker. A continue card here
  lands on **`Zmień hasło w ustawieniach`**.

The only predicate that guarantees the destination renders the form is the **AND** — the same
conjunction `api/auth/reset-password.ts:83` and `:90` already enforce, and which `auth-session.ts:26-29`
explains: the `amr` claim proves provenance but never freshness; the marker supplies the freshness.
**Add `requireRole(Astro.locals, "employee")` as a third conjunct** (see row 4 below) and the card's
promise becomes exact: _shown iff `/auth/reset-password` will render the form._

## 2.2 What the page can and cannot know

Three constraints from `callback.ts:42-44` being the handler's **first statement**:

1. **The token is never touched** — no `verifyOtp`, so nothing on the page can resolve the link's
   target identity.
2. **The query string is dropped** — the redirect is a bare path, so the page cannot even tell an
   invite link from a recovery link. Only the _session's_ stamped marker is available.
3. **No link is required at all** — a signed-in user hitting bare `/auth/callback` lands here.

The page also **cannot know whether the token is spent** — spent-ness is only observable by attempting
the exchange. So no branch can distinguish "sign out and the link will work" from "sign out and you're
stranded", and the retained card's copy must be true under both. `AccountBox.astro:9-12` already
records the sibling limit: _"server-side, 'Anna clicked her own link' and 'Anna clicked Bartek's link'
are identical requests."_

## 2.3 Complete state table

Every row renders the identical R11 card today. "Marker expired" ≡ "absent" — the browser simply stops
sending it.

| #   | Origin     | Marker     | Role     | How it is reached                                                             | Correct today?               | Fix should show                                                                                                  |
| --- | ---------- | ---------- | -------- | ----------------------------------------------------------------------------- | ---------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| 1   | `link`     | `invite`   | employee | **The production bug** — hire opens invite, abandons form, reopens link       | **No**                       | **Continue card** → `/auth/reset-password` (invite form)                                                         |
| 2   | `link`     | `recovery` | employee | Staffer abandons a _reset_ form, reopens link                                 | **No** — same two falsehoods | **Continue card** (recovery form). Copy mode-neutral, or read the marker                                         |
| 3   | `link`     | absent     | employee | > 1h after the exchange; session refreshed and alive                          | **No**                       | **Open question** — continue card would bounce to `Link wygasł`. Recommend keeping R11 or authoring a third card |
| 4   | `link`     | any        | `null`   | Deactivated staffer, **or Bug 1's orphan**                                    | **No**                       | Must **not** get the continue card — it would misdirect one click into `Konto jest nieaktywne`                   |
| 5   | `password` | absent     | employee | Shared rental-desk workstation — colleague signed in                          | **Yes**                      | **Unchanged R11**                                                                                                |
| 6   | `password` | absent     | employee | Signed-in staffer clicking their own recovery link                            | **Yes**                      | **Unchanged R11** (though "inne konto" is already mildly false here)                                             |
| 7   | `password` | present    | employee | Abandon → sign out → sign in → reopen link (signout doesn't clear the marker) | copy false-ish               | **Must not** get the continue card — the AND predicate excludes it                                               |
| 8   | `unknown`  | any        | any      | Fail-closed residue                                                           | vacuously fine               | **Unchanged R11**                                                                                                |

Row 7 has a one-line strictly-narrowing fix available: add
`context.cookies.delete(LINK_ORIGIN_COOKIE, { path: "/" })` to `src/pages/api/auth/signout.ts`. The
marker can only ever deny, never grant (`auth-session.ts:28-29`), so deleting it early is safe.

## 2.4 Cookie lifecycle — and why there is no replay risk

`LINK_ORIGIN_COOKIE` has exactly one writer (`callback.ts:116`) and one deleter
(`api/auth/reset-password.ts:134`). After a successful set, three things happen in order (`:134-136`):
marker deleted → `PW_SET_DONE_COOKIE` set → `signOut({ scope: "global" })`. So the session is gone
too; reopening the spent link finds no `locals.user`, falls through to `verifyOtp`, fails, and lands on
`Link wygasł`. **The continue card is unreachable after a successful set.**

Note the loop row 3 sits in, which the fix does not close and the plan should acknowledge: `Link wygasł`'s
CTA is `/auth/forgot-password`, whose form mints a link that — opened in this still-signed-in browser —
bounces straight back to `/auth/link-conflict`. `auth-session.ts:50-55` already anticipated exactly this
shape. The honest exit is sign-out first, which is what the retained R11 card says, so leaving row 3 on
R11 is defensible; leaving it there with _false_ copy is not.

## 2.5 Security judgement: no regression, and the demotion is not free

**No new capability.** The change touches only what the page _renders_. It adds no `verifyOtp`, no
`setSession`, no cookie write — the page stays a pure read + render, so `callback.ts:31-44`'s
anti-fixation invariant and the `amr`-accumulation constraint at `auth-session.ts:149-156` are both
untouched. The card is a plain `<a href="/auth/reset-password">`: whoever holds the session can already
type that URL, and the POST route re-derives all five gates independently without trusting anything the
page rendered. This is a **discoverability affordance over an already-reachable URL**, not a grant.

One pre-existing residual worth naming in the plan (not created by this fix): an abandoned link session
is a live set-password capability sitting in the browser for the marker's full hour. Finishing the flow
is what clears it — which argues _for_ the fix.

**"Demote `SignOutButton`, one page, no new component" is understated.** `SignOutButton.tsx` takes
**no props**, and `SubmitButton.tsx:26` hard-codes the ink-primary class string with no `variant` or
`class` prop — so the sign-out button and a primary CTA are currently visually indistinguishable. A
demoted secondary requires either new props on those components (touching every auth form) or a second
markup path. Its copy is hardcoded too (`Wyloguj się` at `:27`, `Wylogowywanie…` at `:25`), and the
contract asks for copy that does not promise the link will work again.

**Calling `readSessionOrigin` in `.astro` frontmatter** has one precedent to copy verbatim —
`reset-password.astro:63`: `const origin = user && supabase ? await readSessionOrigin(supabase) : "unknown";`
Both halves of the guard matter: `supabase` is `null` when unconfigured, and the `user &&` half satisfies
the module's hard contract (`getSession()` does not verify the signature, so it may only be read where
`locals.user` is already populated). Past `link-conflict.astro:25` the user is guaranteed non-null.

---

# Part 3 — Design contract and Polish copy

**There is only one contract, and it lives in an archived folder.**
`context/archive/2026-08-17-auth-followups/` has **no** `design-contract.md` — when that slice added its
own no-artboard card, it amended the S-14 contract in place
(`context/archive/2026-08-11-auth-surface-hardening/design-contract.md`, 437 lines, §9 rows + §10 entry
14). This change's `change.md:14-15` forbids that route ("archived and read-only"). **Resolution: write
`context/changes/invite-journey-fixes/design-contract.md` inheriting S-14 §7 by reference** — exactly how
S-14 §1-9 inherits S-08 §3.14 rather than re-deriving it.

**The auth surface has never been in the design catalog.** `context/foundation/design-system.md` rows
01–29 are app screens only — no auth row, and no auth screenshot in
`context/foundation/design/screenshots/`. The 21 auth artboards live _only_ at
`context/archive/2026-08-11-auth-surface-hardening/design-review/` (mobile 390×844@2×, desktop
1320×840@2×) and were not pruned at archive. S-14 left a standing to-do to promote them
(`design-contract.md:164-167`) that was never done — this change inherits it.

**The new card has no artboard, but its sibling R11 does** (`auth-authed-{d,m}.png`). That is the
diff baseline for everything the card inherits: shell, status head, title/subtitle metrics, account box,
button.

**Entry 14 is the shape to mirror** — it teaches six moves: (1) title states what the card is +
`deviation(reason)` inline; (2) name the defect + plan/evidence refs; (3) assert **"every dimension is
inherited-exact, not invented"** citing §7.1/§7.3/§7.5 per dimension; (4) state the account-box decision
**explicitly** (it was amended at impl-review F8 precisely because it hadn't been); (5) justify the
Polish (collocation, register); (6) name the paths where the copy is inexact and record them as
knowingly accepted.

**A direct link between the two bugs**: entry 14 already names Bug 1's population as one of two
knowingly-accepted false readings of "Konto jest nieaktywne" — _"a hire whose profiles insert failed
after the invite was already sent, who has no profiles row permanently (impl-review F6)"_. If Bug 1's
fix changes that population, entry 14's accepted-deviation note goes stale and should be revisited.

**Canonical per-element values** (one value each, never a range):

| Element            | Class string                                                                                                                                                                                   |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| State-card wrapper | `flex flex-col gap-[18px]`                                                                                                                                                                     |
| Heading (h1)       | `text-foreground text-[28px] leading-[1.05] font-bold tracking-[-0.8px]`                                                                                                                       |
| Subtitle (p)       | `text-muted-foreground mt-2 text-sm leading-[1.45]`                                                                                                                                            |
| Status head tile   | `mb-5 flex size-14 items-center justify-center rounded-[16px]` + tone                                                                                                                          |
| Primary CTA link   | `bg-foreground text-background hover:bg-foreground/90 inline-flex h-[52px] w-full items-center justify-center gap-2 rounded-[13px] text-[15px] font-[650] tracking-[-0.1px] transition-colors` |
| Account box margin | `mb-[18px]` (R11) · `mb-5` (R12) · none inside a form                                                                                                                                          |

`StatusHead` accepts `tone: "ink" | "green" | "red"` and `icon: "info" | "settings" | "user" | "mail" |
"shieldCheck" | "alert"` — **that is the whole glyph set**; a new "continue" glyph means a new SVG arm
plus a contract note. `AuthPrimaryLink` always appends `→`; `AuthBackLink` takes only `class` and its
copy/destination are fixed.

**Two dimensions the new card cannot inherit and must invent-and-mark:** the spacing between a primary
CTA and a secondary _action button_ (no shipped card pairs those — the only precedent is CTA +
`AuthBackLink` as direct flex children of `gap-[18px]`), and the sign-out demotion itself.

**Copy conventions the new strings must observe** (all verified with zero exceptions across 15 surfaces):
sentence case; **headings never end with a period, subtitles always do**; subtitles are two sentences
(state-of-the-world, then imperative); headings are declarative statements of state, buttons are bare
2nd-person imperatives; **gender-neutral throughout** (the contract's §9 closing line makes this a
standing rule); `Twoje` appears only in two placeholders and in no heading or subtitle, `Ci`/`Tobie`
appear nowhere; `…` not `...`; the 60-minute validity has exactly two shipped phrasings
(`Linki resetujące są ważne 60 minut.` / `Wygasa po 60 minutach.`) — reuse one verbatim rather than
coining a third. The impersonal register (`Nie można…`) is in-style for stating a system fact.

**No new token is required** — every color the card needs already has a semantic name in
`src/styles/global.css`. One trap: `@theme inline` remaps the radius scale, so `rounded-xl` renders
**20px**, not 12px; the contract's §7.2 line "radius 12 → `rounded-xl`" should not be copied forward
unchecked.

---

# Part 4 — Test-layer reachability

**Playwright runs in no gate.** Pre-commit is `lint-staged` + `astro check`; pre-push runs the
integration suite (and **skips silently, exit 0**, if Supabase is unreachable); CI runs lint + unit +
build, plus a separate integration job. There is no e2e workflow. Two consequences:

- Editing `link-conflict.astro` **alone runs no test whatsoever** — `vitest related` is bound to
  `*.{ts,tsx}`, so an `.astro` change gets `eslint --fix` and `astro check` and nothing else.
- Editing `staff.ts` runs `vitest related --project unit`, which resolves only within `src/**/*.test.ts`
  — and **no unit test imports that module**, so it is also effectively lint-only at commit time.

**This is the strongest practical argument for extracting Bug 2's branch decision into a pure function**
in `src/lib/auth-session.ts` (e.g. `resolveLinkConflictKind({ sessionOrigin, marker, role })` →
`"continue" | "conflict"`), beside `readLinkOrigin`. It lands in the `unit` project — the one that
actually gates CI — and matches the shape `readLinkOrigin` / `resolveAuthError` already use for
page-level decisions. The e2e spec is still required: _"extracting a correct helper does not prove the
widget calls it"_ (`e2e/seed.spec.ts:27-28`).

**No `.astro` renders under Vitest.** `AstroContainer` / `astro/container` has zero hits in the repo.
`tests/integration/pages-authz.test.ts` drives `middleware.ts` with a synthetic context and renders
nothing.

**Bug 2's e2e sequence is supported by existing fixtures with zero extension.** `inviteCallbackLink`
(`e2e/fixtures/staff.ts:119-138`) returns a reusable absolute link and already inserts the profile row
(so the hire has `role: "employee"` and does not fall into the `Konto jest nieaktywne` branch). Its own
docblock states Bug 2's mechanism verbatim: _"SINGLE USE: the token is consumed by the callback's
`verifyOtp` exchange — i.e. the moment it lands on the set-password form, NOT when a password is
submitted."_ The spec must open its own `browser.newContext({ storageState: { cookies: [], origins: [] } })`
— never `test.use` at file level, and **never click sign-out** (`/api/auth/signout` runs at supabase-js's
default _global_ scope and would kill the shared `employee` storage state for every later spec).

**Bug 1's failure path is integration-testable** in `tests/integration/staff.test.ts`, because
`createEmployee` takes its client as a **parameter** (`staff.ts:136-139`). The recommended mechanism is a
partial double that fails only `.from("profiles").insert` while leaving the GoTrue hop **real**, so the
orphan is a real `auth.users` row and the assertion is real: after the call, `listUsers()` must find no
user for that address. ~15 lines; precedent for doubles at this altitude exists at
`tests/helpers/context.ts:119-139` and `src/lib/auth-session.test.ts:27-37`. **Avoid** the
`queryDb`-DDL route — its contract is catalog-introspection only, and on a stack shared by four
worktrees a crashed test leaves a live constraint that breaks siblings.

**Operational constraints, refined:**

- **The `:4321` pin is real but narrower than stated.** Both email templates build their link from
  `{{ .SiteURL }}`, never `{{ .RedirectTo }}` (`invite.html:10`, `recovery.html:8`), and the live
  container confirms `GOTRUE_SITE_URL=http://localhost:4321`. So **Mailpit-derived** links are
  hard-pinned regardless of `E2E_BASE_URL` — that governs `e2e/staff-auth.spec.ts`. But
  `inviteCallbackLink` / `recoveryCallbackLink` assemble the URL from `BASE_URL` themselves, so they
  _do_ honour `E2E_BASE_URL`; in practice a Bug-2 spec still runs on 4321 because `webServer.command`
  is `npm run dev`.
- **The "2 emails/hour" cap is not enforced locally.** `config.toml:195` declares `email_sent = 2`
  but requires `[auth.email.smtp]`, which is commented out — the live container reads
  `GOTRUE_RATE_LIMIT_EMAIL_SENT=360000`. (It _is_ enforced on hosted Supabase, which is where that
  note came from.) The ceiling that can actually bite locally is
  `GOTRUE_RATE_LIMIT_VERIFY=30` per 5 min — one per invite-link open.
- **Four worktrees share one Docker stack** (`project_id = "10x-astro-starter"`), confirmed against
  `docker ps` and `git worktree list`. A `db reset` in any sibling reapplies only that worktree's
  migrations. `config.toml` changes need `supabase stop && supabase start`, never `db reset`.

**Regression exposure.** Bug 1: `tests/integration/staff.test.ts:49,:72,:82,:117,:146` and
`e2e/staff-admin.spec.ts:29` all route through `createEmployee`. Bug 2: `e2e/auth-hardening.spec.ts:53,
:76,:107,:171` — in particular `:66-67`, which asserts the conflict card names `employee@fleetrent.test`
and **not** the link recipient. A new continue branch must not swallow the genuine-conflict case.

---

# Part 5 — The fork: defer the token exchange (option C)

Added 2026-08-20, after reproducing both bugs by hand. This part exists because **the continue card
(Part 2) and option C are competing fixes for the same defect** — if C ships, the card is deleted
work. The scope decision is recorded in `change.md` → "Scope fork (2026-08-20)".

## 5.1 A third instance of the same timing error — MEASURED

Both bugs are the same shape: an irreversible act happens before the thing it commits to is done.
Bug 1 sends the mail before the profile lands; Bug 2 spends the token when the form _renders_.
There is a third, and it is the sharpest.

Probe, 2026-08-20, curl against the local dev server. A **fully provisioned** invited hire (auth
user + `profiles` row, role `employee`), minted with `generateLink`, **password never set**. One
cookie jar throughout:

| Request                                       | Result                                                       |
| --------------------------------------------- | ------------------------------------------------------------ |
| `GET /auth/callback?token_hash=…&type=invite` | 302 → `/auth/reset-password?mode=invite`, 200                |
| `GET /dashboard`                              | **200** — `<title>Pulpit — Flota</title>`, renders `Wyloguj` |
| `GET /dashboard/reservations`                 | **200**                                                      |
| `GET /dashboard/staff`                        | 403 — admin-only, role gate working correctly                |

**Clicking the invite link alone grants a working employee session.** The role gate is doing its
job; the _sequencing_ is wrong — `verifyOtp` issues a full session on a **GET**, before the account
has been completed. Nothing forces the password set; `reset-password.astro` renders the form but the
user is free to navigate away and simply use the app.

Not an attacker escalation — the holder of the invite mail is the legitimate recipient. But access
is granted before the account exists in any meaningful sense, and this is the **same population as
Bug 2**: the hire who closes the tab leaves a live staff session behind, on an account the roster
still labels ZAPROSZONY. Combined with §1.5(a), **the roster misreports in both directions** —
AKTYWNY for someone who cannot sign in, ZAPROSZONY for someone already inside.

## 5.2 What C is

`/auth/callback` validates the link's shape and stamps a short-lived httpOnly cookie carrying
`token_hash` + `type`, but does **not** call `verifyOtp`. The set-password POST then does
`verifyOtp` + `updateUser({ password })` as one operation.

Consequences: the token is spent exactly when the task completes, so **reopening the link is
idempotent and Bug 2 stops existing**; no session is minted until a password exists, so §5.1 closes
too; and the S-14 critical property (an ordinary password session must not set a password without
reauth) holds trivially, because setting a password requires an unspent token from an email.

## 5.3 Deletion inventory — what C obsoletes

Enumerated from call sites, 2026-08-20. **Verdicts are for the C slice, not this change.** Leaving
any of this half-present is worse than either design, so the C plan must carry a verified-dead check
per row.

| Symbol / block                                 | Defined                                  | Call sites today                                                                                       | Verdict under C                                                                                                                            |
| ---------------------------------------------- | ---------------------------------------- | ------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `readSessionOrigin`                            | `auth-session.ts:126-163`                | `reset-password.astro:63`, `api/auth/reset-password.ts:83`                                             | **DELETE** — both gates disappear; authority comes from the token, not a session's provenance                                              |
| `readAmr`, `decodeBase64Url`                   | `auth-session.ts:82-116`                 | private to `readSessionOrigin`                                                                         | **DELETE** — the app's only JWT-claim read goes with it                                                                                    |
| `SessionOrigin` type                           | `auth-session.ts:33`                     | as above                                                                                               | **DELETE**                                                                                                                                 |
| `readSessionOrigin` tests                      | `auth-session.test.ts:48-116` (11 tests) | —                                                                                                      | **DELETE**                                                                                                                                 |
| `LINK_ORIGIN_COOKIE` (as a _freshness marker_) | `auth-session.ts:39`                     | set `callback.ts:116`; read `reset-password.astro:73`, `api/auth/reset-password.ts:90`; deleted `:134` | **REPURPOSE, not delete** — becomes the cookie carrying `token_hash` + `type`. Its freshness role is subsumed by GoTrue's own token expiry |
| `readLinkOrigin`, `LinkOrigin`                 | `auth-session.ts:36,77-79`               | `reset-password.astro:73`, `api/auth/reset-password.ts:52,55,90`                                       | **KEEP** — `type` still selects invite-vs-recovery copy; likely folded into the new cookie's parse                                         |
| `LINK_COOKIE_OPTIONS`, `linkCookieOptions`     | `auth-session.ts:60-74`                  | `callback.ts:116`, `api/auth/reset-password.ts:135`                                                    | **KEEP** — same attributes are needed for the token cookie                                                                                 |
| `PW_SET_DONE_COOKIE`                           | `auth-session.ts:42`                     | set `api/auth/reset-password.ts:135`; consumed `reset-password.astro:57-60`                            | **KEEP** — the success screen still needs its one-shot marker after the global sign-out                                                    |
| `verifyOtp` / `exchangeCodeForSession` block   | `callback.ts:81-105`                     | —                                                                                                      | **REWRITE** — no exchange on GET                                                                                                           |
| Anti-fixation refusal                          | `callback.ts:42-44`                      | redirects to `/auth/link-conflict`                                                                     | **RE-DECIDE** — see §5.5; the fixation risk largely evaporates when GET mints no session                                                   |
| `link-conflict.astro` (whole page)             | 48 lines                                 | reached only from `callback.ts:43`                                                                     | **RE-DECIDE** — shrinks sharply; may survive in reduced form for the shared-workstation case                                               |
| Page gates 4 (origin) + 5 (marker)             | `reset-password.astro:120,137`           | —                                                                                                      | **COLLAPSE** into "is there a pending, unspent token cookie"                                                                               |
| Route gates (d) + (e)                          | `api/auth/reset-password.ts:83,90`       | —                                                                                                      | **COLLAPSE** likewise                                                                                                                      |
| `tests/helpers/link-session.ts`                | 82 lines                                 | `reset-password.test.ts`, `auth-callback.test.ts`                                                      | **REWRITE** — it fabricates an `amr: [{method:"otp"}]` session, a shape C never produces                                                   |
| `tests/integration/reset-password.test.ts`     | 291 lines, ~12 tests                     | —                                                                                                      | **REWRITE** — built on origin+marker                                                                                                       |
| `e2e/auth-hardening.spec.ts:53,76,107,171`     | 4 tests                                  | —                                                                                                      | **REWRITE** — `:76`/`:107` ("refused, not consumed") become trivially true and should assert idempotent reopen instead                     |

## 5.4 What must NOT be deleted — the trap in this cleanup

- **`shouldSecureCookies`** (`src/lib/secure-cookies.ts:38`) is imported by `auth-session.ts:5`
  **and** by `middleware.ts:4,11`, `api/auth/signin.ts:8,47`, `api/auth/signout.ts:3,10`. It is the
  one shared rule deciding the `secure` attribute for the **session** cookies. Deleting the
  link-session module wholesale takes it with them and silently weakens every auth cookie in the
  app. Its own tests are `src/lib/secure-cookies.test.ts`.
- **`src/lib/access.ts`** (`requireRole`, `ROUTE_ROLES`, `isRoleSufficient`) is untouched by C — it
  gates every `/dashboard` route and every API handler.
- **`auth-session.test.ts:118-129`** (the `readLinkOrigin` cases) survives with its subject.
- The **`LINK_TYPES` closed set** (`callback.ts:25-29`) survives and stays load-bearing: `type` is
  still caller-supplied and must be validated against a closed set before reaching GoTrue.

Suggested verified-dead check for the plan, per deleted symbol: `grep -rn "<symbol>" src tests e2e`
returns nothing, then `npm run lint && npx astro check && npm test && npm run test:integration`.
Note that `astro check` and lint alone will **not** catch a dead export — nothing errors on an
unused public symbol — so the grep is the actual gate, not the type-checker.

## 5.5 What C does not solve

- **The role refusal moves after the exchange.** The link carries only `token_hash` + `type` — no
  identity (`invite.html:10`, `recovery.html:8`) — so with no exchange on GET there is no
  `locals.user` and no role to check. R14 ("Konto jest nieaktywne", built by `auth-followups`
  Phase 1) cannot run before the form; it moves to post-exchange, where the token is already spent.
  Mitigating: that population is _meant_ to be stopped and has nothing to resume, so stranding them
  costs little. Still a real trade against a screen shipped three days earlier.
- **Conflict handling shrinks but does not vanish.** `verifyOtp` at POST still mints a session that
  replaces a signed-in colleague's on a shared workstation. A rule is still needed — but it is no
  longer a _dead end_, because the token is unspent, which is the whole of Bug 2.
- **The token becomes a cookie-borne credential.** httpOnly, short-lived, single-use — strictly less
  powerful than the session it replaces (§5.1 measures what that session can do today), but it is a
  credential at rest and needs the same care.
- **The `?code=` PKCE arm needs a keep-or-drop decision** (`callback.ts:82-86`). Our own templates
  never mint it.

---

## Code References

**Bug 1**

- `src/lib/services/staff.ts:192-205` — invite-then-insert, the defect itself
- `src/lib/services/staff.ts:149-188` — the `existing` branch, i.e. the repair path that already works
- `src/lib/services/staff.ts:180-183` — `wasActive` derivation + the swallowed `resetPasswordForEmail`
- `src/lib/services/staff.ts:251-262` — `deactivateStaff`, the same shape with a worse failure
- `src/pages/api/staff.ts:66` — no try/catch; the throw becomes a bare 500
- `src/components/staff/StaffList.tsx:68-69,481-497,643-655` — the misleading banner and the accidental `Ponów` repair
- `supabase/migrations/20260604153139_employee_admin_roles.sql:22-31` — the FK, and the fail-closed invariant
- `supabase/migrations/20260723194602_employee_account_management.sql:36-59` — `list_staff`, the INNER join that hides orphans
- `src/middleware.ts:30-39,57-59` — role resolution and the bare `Forbidden`

**Bug 2**

- `src/pages/auth/link-conflict.astro:8-19,31-47` — the page, its two-case header comment, and the card
- `src/pages/auth/callback.ts:42-44,87-98,116` — the refusal, the exchange, the marker stamp
- `src/lib/auth-session.ts:26-29,50-55,126-163` — the AND rationale, the >1h window, `readSessionOrigin`
- `src/pages/auth/reset-password.astro:57-73,104-119` — the six-way branch and the R14 precedent card
- `src/pages/api/auth/reset-password.ts:83,90,134-136` — the same conjunction, and the success teardown
- `src/pages/api/auth/signout.ts:5-16` — never clears the marker (row 7)

**Design / tests**

- `context/archive/2026-08-11-auth-surface-hardening/design-contract.md:364-393` — entry 14
- `context/archive/2026-08-11-auth-surface-hardening/design-review/` — the 21 auth artboards
- `e2e/fixtures/staff.ts:107-138` — `inviteCallbackLink` + the generateLink prototype of the 2a fix
- `e2e/auth-hardening.spec.ts:53-130` — the "refused, not consumed" pattern and the anon-context idiom
- `tests/integration/staff.test.ts:49-198` — existing provisioning coverage (no partial-failure case)

## Architecture Insights

- **Two-systems mutations are a family with a house pattern already chosen.** `createEmployee` and
  `deactivateStaff` both write to GoTrue and Postgres with no rollback. The protocol-delivery flow has
  the same shape and solved it by making the fragile second step non-fatal, recording the outcome,
  surfacing it, and shipping an explicit repair action. That is cheaper than transactionality and is
  already proven in this codebase.
- **Provenance and freshness are separate signals and must be ANDed.** `amr` proves _how_ a session was
  minted but never expires; the marker cookie expires but is unsigned. Every gate that grants
  set-password rights already requires both. Any new surface that reasons about link sessions inherits
  that conjunction — the write-up's "or equivalently" is the first place it was nearly lost.
- **A refusal screen must be able to state something true for every state that reaches it.** R11 was
  correct for the two cases it was designed for and false for a third nobody enumerated. The lesson
  generalizes: refusal pages need a state table, not a use case.
- **Roles are granted deliberately, never by default.** That invariant (`20260604153139:22-24`) is what
  makes a trigger-based provisioning fix a posture change rather than a bug fix — and it is also why the
  orphan fails closed rather than dangerously.
- **The gates do not cover the files this change touches.** An `.astro`-only edit runs no test; `staff.ts`
  has no unit coverage; Playwright is in no gate. Any behaviour this change wants _enforced_ has to be
  expressed as a pure function in the unit project or as an integration test.

## Historical Context (from prior changes)

- `context/archive/2026-08-11-auth-surface-hardening/` (S-14) — established the anti-fixation refusal at
  `callback.ts:42`, the marker cookie, `readSessionOrigin`, and the R11 card. Its `change.md` records the
  same `:4321` validation constraint this change inherits, and its research asked the open question about
  `amr` that `auth-session.ts` answers.
- `context/archive/2026-08-17-auth-followups/` — added the role-gate card (`Konto jest nieaktywne`) as a
  no-artboard state, amending S-14's contract in place. Its `change.md` carries the owner decision to
  state deactivation explicitly rather than hedging — the precedent for how this change should decide its
  own copy's directness.
- `context/archive/2026-08-17-auth-followups/follow-ups/review-fixes.md` — the source write-up for both
  bugs. Accurate on mechanism and symptoms; the three inferences corrected in this document all originate
  here and were copied into `change.md` verbatim.
- `context/archive/2026-07-23-employee-account-management/` — shipped `createEmployee`, `list_staff`, and
  the repair branch on 2026-07-23. Also the only home of the `supabase gen types` command, which is in no
  npm script and not in `CLAUDE.md`.
- `context/archive/2026-07-14-rpc-execute-grant-hardening/` — why any new RPC needs a per-function
  `revoke execute … from public, anon` _before_ the grant, and why the schema-level shortcut is a no-op
  here.

## Related Research

- `context/archive/2026-08-11-auth-surface-hardening/research.md` — the auth-surface research this
  builds on, including the `:4321` allow-list finding.
- `context/foundation/lessons.md` — "A typed, accepted API parameter is not evidence that it is
  enforced" governs the probes below; "Revoke EXECUTE before granting it" binds only if Bug 1's fix
  takes an RPC; the two design lessons and the Design Alignment Audit gate bind Bug 2.

## Open Questions

**Blocking — settle before planning:**

1. ~~**Does GoTrue stamp `last_sign_in_at` on the `verifyOtp` exchange?**~~ **SETTLED 2026-08-20 — yes.**
   Probed against local Supabase; see §1.5(a) for the evidence and consequences. `staff.ts:180-183` must
   key off password-set instead, in this slice. No longer blocking; it is now scope.
2. ~~**The scope fork — continue card, or option C?**~~ **SETTLED 2026-08-20 (owner).** Both bugs stay
   in this change as two phase groups: **A** = Bug 1, **B** = option C. The **continue card is
   dropped** — C makes the state it explains unreachable. Part 2 is retained as the record of the
   rejected option and as the fallback contract if B is abandoned. Hard rule: A must not depend on B.
   See `change.md` → "Scope decision (2026-08-20)".
3. **Which Bug 1 option ships, and in what order?** The recommendation is Option 4 + 1 now, 2a next,
   2b rejected, 3 closed — but the 2a slice's real cost is moving the invite mail to Resend, which is a
   product decision about scope, not a technical one.

**Product/design decisions for the plan:**

4. **Row 3 (link origin, marker expired)** has no honest screen today and none of the three candidate
   cards fits. Keep R11, or author a third?
5. **Should `list_staff` widen to a LEFT JOIN** so orphans surface as a repairable roster row? It fixes
   the surviving consequence directly but adds a new visual state needing its own design decision.
6. **Sign-out demotion**: new `variant` prop on `SubmitButton` (touches every auth form) or a bespoke
   secondary control on this one page?
7. ~~**Should the continue card's copy be mode-specific**~~ **MOOT** — card dropped. (`invite` vs `recovery`)? The marker can
   distinguish them; the link's own kind is unavailable.
8. **Does the retained R11 card's copy get reworded too?** "inne konto" is already mildly false for row 6.
   That would touch `design-contract.md` §9 `authedSub`, currently marked `exact (new)`.

**Worth probing but not blocking:**

8. What GoTrue error `verifyOtp` returns for an invite token whose user was deleted — matters only if
   Option 1's copy is branched. `tests/integration/auth-callback.test.ts` is the natural home.
9. Whether `generateLink({type:"invite"})` truly sends nothing under this project's custom
   `[auth.email.template.invite]` — the repo asserts it in a comment; assert it against Mailpit before
   betting the invite journey on it.
