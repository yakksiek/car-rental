# Invite Journey Fixes — Plan Brief

> Full plan: `context/changes/invite-journey-fixes/plan.md`
> Research: `context/changes/invite-journey-fixes/research.md`
> Design contract: `context/changes/invite-journey-fixes/design-contract.md`

## What & Why

Two bugs in the invited-hire journey share one root: **an irreversible act happens before the thing
it commits to is done.** `createEmployee` sends the GoTrue invite before the `profiles` row lands, so
a failed insert leaves a hire with an auth account, no role, and a mail already in their inbox — and
the admin sees a banner blaming the network. `/auth/callback` spends the link token when the
set-password form _renders_ rather than when the password is _submitted_, so a hire who closes the
tab is told a "different account" is signed in (it's their own) and is stranded with a dead link.

## Starting Point

The repair path already exists and works — `staff.ts:162-183` unbans, upserts the profile and
returns `reactivated`, shipped 2026-07-23. What's missing is legibility: `list_staff` INNER-joins
from `profiles` so the orphan drives no roster row, `api/staff.ts:66` has no try/catch so the error
becomes a bare 500, and `StaffList.tsx:491` routes it to the network banner. The banner's `Ponów`
button already performs the repair — unlabelled, and gone the moment the admin reloads.

Two probes run during planning changed the shape of the work. **`encrypted_password` is corrupted by
the same event as `last_sign_in_at`** — the invite exchange writes a 60-char bcrypt hash (and not
bcrypt of the empty string), so there is no GoTrue-side "password set" signal and research's
suggested fix has nothing to key off. And **`auth.one_time_tokens.token_hash` matches the link's hash
verbatim** and joins to `user_id`, so a deferred-exchange design can still resolve who a link is for
without spending it.

## Desired End State

A failed provisioning rolls its own invite back and tells the admin what happened in its own words.
`profiles.password_set_at` becomes the single answer to "does this person have a working password",
so the roster stops reporting AKTYWNY for someone who cannot sign in and ZAPROSZONY for someone
already inside the app. And the invite link becomes idempotent: opening it mints no session, closing
the tab strands nobody, and reopening it renders the form again.

## Key Decisions Made

| Decision            | Choice                                                         | Why (1 sentence)                                                                                                          | Source |
| ------------------- | -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- | ------ |
| Scope shape         | One change, two independent phase groups; A must not need B    | A is a service bugfix, B redesigns a twice-reviewed auth surface — phasing gives the risk isolation a split would.        | Change |
| Bug 2 fix           | Option C (defer the exchange), not the continue card           | C makes the state the card explains unreachable, so the card would be deleted work.                                       | Change |
| Bug 1 remediation   | Option 4 + Option 1 — legibility plus compensating delete      | Matches the house pattern in `email-delivery.ts`; 2a's reorder would pull the invite mail onto the Resend seam.           | Plan   |
| Password-set signal | New `profiles.password_set_at`, written by our two routes      | Probe killed every GoTrue-side signal; both `updateUser({password})` call sites are ours, so an owned column is complete. | Plan   |
| Backfill            | From `last_sign_in_at`                                         | Reproduces today's outcome for every existing row, so the migration mails nobody and moves no label.                      | Plan   |
| Roster badge        | `deriveStatus` moves to the new signal too                     | Otherwise two meanings of "active" survive in one file — the exact conflation the fix exists to remove.                   | Plan   |
| Orphan roster row   | No LEFT JOIN on `list_staff`                                   | With the compensating delete, orphans need a double failure to survive — not worth a new roster state and its copy.       | Plan   |
| Option C identity   | Resolve user/email/role via an RPC over `auth.one_time_tokens` | Keeps both the R14 refusal and the account box, so C ships with no visible regression.                                    | Plan   |
| PKCE `?code=` arm   | Dropped                                                        | Our templates never mint one, and it has no deferred form — keeping it would leave two contradictory timings in one file. | Plan   |
| Conflict handling   | Keep the GET refusal and R11; add a POST-side guard            | Under C the R11 copy becomes literally true, and the shared-workstation hire is stopped before typing a password.         | Plan   |
| Enforcement         | Pure functions + integration; e2e updated but ungated          | The unit project is what CI runs; a Playwright CI job is its own slice.                                                   | Plan   |

## Scope

**In scope:** compensating `deleteUser` + a distinguishable admin-facing error; `profiles.password_set_at`
with backfill, a `mark_password_set()` RPC and a recreated `list_staff`; `wasActive` and
`deriveStatus` re-sourced; the swallowed `resetPasswordForEmail` error; deferred token exchange with
a token-lookup RPC; the deletion sweep; unit + integration coverage for all of it.

**Out of scope:** option 2a (invite mail onto Resend); option 2b (rejected — downgrades every new
hire to reset copy); option 3 (closed on evidence); the `link-conflict` continue card (dropped);
widening `list_staff` to a LEFT JOIN; `deactivateStaff`'s sibling defect (`research.md` §1.6); a
Playwright CI job; promoting the 21 auth artboards into the design catalog.

## Architecture / Approach

Phase group A is ordered so the headline fix carries no migration and lands first, then introduces
the owned signal data-layer-first. Phase group B changes what the GET does, moves the exchange to the
POST, then removes what the old timing existed to compensate for. Behaviour that must be _enforced_
is extracted into `src/lib` pure functions (the unit project gates CI) plus an integration or e2e
assertion that the surface actually calls them — because an `.astro`-only edit currently runs no test
and `staff.ts` has no unit coverage.

## Phases at a Glance

| Phase                           | What it delivers                                                     | Key risk                                                                               |
| ------------------------------- | -------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| 1. Legibility + rollback        | Compensating delete, distinguishable status, its own banner          | The delete can itself fail — the second arm's copy must stay honest                    |
| 2. Password signal (data)       | Column + backfill + `mark_password_set()` + recreated `list_staff`   | The DROP resets `list_staff`'s ACL — revoke **and** grant must be re-stated            |
| 3. Wire the signal              | `wasActive` + `deriveStatus` re-sourced; swallowed mail error fixed  | Fixtures that mint passwords out-of-band read as password-less unless stamped          |
| 4. Deferred exchange — callback | Token-lookup RPC; no `verifyOtp` on GET; `?code=` dropped            | Couples one RPC to a GoTrue-internal table with no stability contract                  |
| 5. Submit-time exchange         | `verifyOtp` + set + stamp as one op; page re-sourced from the lookup | Retryability must survive — a typo must not spend the token                            |
| 6. Deletion sweep               | `readSessionOrigin` family removed; helpers and specs rewritten      | `shouldSecureCookies` is shared with middleware/signin/signout — deleting it is silent |

**Prerequisites:** local Supabase running (`npx supabase start`); apply migrations with
`supabase migration up`, never `db reset` — four worktrees share one Docker stack. Manual auth
testing uses throwaway addresses only, never the seeded `employee@`/`admin@` accounts.
**Estimated effort:** ~4–6 sessions; phase group A (1–3) is roughly a third and merges alone.

## Open Risks & Assumptions

- **`auth.one_time_tokens` is a GoTrue-internal table.** A GoTrue upgrade that changes it breaks the
  role gate. The RPC fails closed, but the coupling should be recorded in `known-issues.md`.
- **The backfill inherits today's error** for the handful of accounts that clicked their invite but
  never set a password — they stay mislabelled AKTYWNY until they set one.
- **The rewritten e2e specs remain ungated.** A regression in the deferred-exchange journey can merge
  green; only the unit and integration layers defend it.
- **Phase group B can be dropped.** If it proves worse than it looks, `research.md` Part 2 still
  carries the continue card's full contract as the fallback.
- **Entry 14 of the S-14 design contract goes stale** if phase group A changes the population that
  sees "Konto jest nieaktywne" — it names Bug 1's orphan as a knowingly-accepted false reading.

## Success Criteria (Summary)

- An admin whose employee-add fails can tell "the invite went out but the account wasn't finished"
  from "your connection dropped" — and has a labelled action that fixes it.
- The roster tells the truth in both directions: no AKTYWNY for someone who cannot sign in, no
  ZAPROSZONY for someone already inside.
- An invited hire can open their link, walk away, and come back to a working set-password form.
