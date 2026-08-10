# Staff self-service account (My account) — Implementation Plan

## Overview

Give a logged-in employee a self-service **Profil** screen: view their own identity
(name, role, work email), change their own password **in-session** (no email
round-trip), and sign out. This is roadmap slice **S-11** (`staff-account`), the
lowest-risk member of the staff-console cohort (`context/changes/staff-ops-features/frame.md`).

It is a **view + change-password** screen — **not** a full profile editor and **not**
the S-08 admin employee-management screen. It reuses the in-session `updateUser({ password })`
primitive already shipped at `src/pages/api/auth/reset-password.ts:45` and the auth form
atoms (`FormField` / `SubmitButton` / `ServerError` / `PasswordToggle`). It adds **no table
and no RPC** — the identity fields are read from `Astro.locals.user` + the caller's own
(self-readable) `profiles` row.

## Current State Analysis

- **No account/profile route exists.** `src/pages/dashboard/` has `dashboard.astro` (index)
  - `reservations` / `pickups` / `returns` / `calendar` / `vehicles` / `staff` and their
    sub-routes — but no `account` or `profile`. S-11 is greenfield here.
- **The shell account chip is display-only.** `StaffShell.astro:122-134` renders the avatar +
  `displayName` + `roleLabel · Warszawa`, but is **not** a link. Sign-out (`:135-156`) is a
  native `data-signout` form living **only** in the `md+` sidebar — **the mobile floating tab
  bar (`:177-208`) has no account or sign-out affordance at all.** Reaching the profile (and,
  on mobile, signing out) is the gap this slice closes.
- **In-session password change already exists as a primitive.** `reset-password.ts:45` calls
  `supabase.auth.updateUser({ password })` on the current session. It does **not** verify a
  current password (the recovery/invite link is the proof). **No reauth path exists anywhere**
  — `reauthenticate` is unused; the only re-verify primitive is `signInWithPassword`
  (`signin.ts:22`).
- **The `profiles` table has no phone and no email.** Columns: `user_id`, `role`, `created_at`,
  `updated_at`, `full_name` (nullable), `deactivated_at`. Email lives on `auth.users` (surfaced
  via `Astro.locals.user`). **The mockup's Telefon row therefore has no backing field** and is a
  trim, alongside Powiadomienia (no notification system, PRD non-goal) and Oddział (no branch
  field; the chip's `· Warszawa` at `StaffShell.astro:132` is a hardcoded literal, not data).
- **`profiles` UPDATE is admin-only** (`profiles_update_authenticated` — `using/with check
current_app_role() = 'admin'`), so a plain employee cannot self-edit `full_name` via the table.
  Confirms the frame: identity is **view-only** here; editing would need a new definer RPC and is
  out of scope.
- **`staffIdentity(email, role)`** (`src/lib/staff-identity.ts`) humanizes the email local-part
  and does **not** read `full_name` (its "no name field yet" comment is now stale — `full_name`
  landed in migration `20260723194602`). The shell chip uses it. The profile page will prefer the
  real `full_name` when present (see Phase 2).
- **Reuse map for the form:** `ResetPasswordForm.tsx` = plain `useState` (small form), native
  `<form method="POST" action=...>`, composes `FormField` + `PasswordToggle` + `ServerError` +
  `SubmitButton` (explicit `pending` prop — `useFormStatus` can't see a URL POST). Success/error
  is rendered by the **host Astro page** via `?done=1` / `?error=` query-param branching. The
  new change-password form forks this pattern with one extra field.

## Desired End State

An employee signed into the staff console can:

1. Click the sidebar account chip (desktop) or the Profil tab (mobile) and land on
   `/dashboard/account`, rendered inside `StaffShell` with `active="me"`, showing their name,
   role badge, and work email — matching `staff-profile.jsx` (minus the recorded trims).
2. Open **Zmień hasło** → `/dashboard/account/password`, enter current + new + confirm, and on
   success see a confirmation; a wrong current password is rejected with a clear message and no
   change.
3. **Wyloguj się** from the Profil screen — the first sign-out affordance reachable on mobile.

**Verification:** the three routes render under `StaffShell active="me"`; `astro check` + lint +
build are green; an integration test proves `/api/auth/change-password` rejects a wrong current
password and updates on a correct one; and the rendered screens pass a vision-diff against
`staff-profile.jsx` (minus deviations) per the design contract.

### Key Discoveries:

- Shell chip is display-only and mobile has no account/sign-out affordance — `StaffShell.astro:121-156`, `:177-208`.
- In-session password change primitive — `src/pages/api/auth/reset-password.ts:45`; no reauth exists (`signin.ts:22` is the only `signInWithPassword`).
- `profiles` has no phone/email; UPDATE is admin-only — `supabase/migrations/20260604153139_employee_admin_roles.sql` (+ `20260723194602` added `full_name`); RLS confirmed self-SELECT allowed (`user_id = auth.uid()`).
- Design reaches Profil via the account chip, not an Operacje nav row; `active="me"` highlights nothing in the main nav — shell source `staff-desktop.jsx`.
- Every `/api` route is outside middleware's gate and must self-gate (lesson); redirect-shaped auth form endpoints are the sibling pattern (`reset-password.ts`).

## What We're NOT Doing

- **No profile editing.** `full_name`, email, role are read-only. No self-edit RPC (RLS blocks the direct update; editing is out of scope).
- **No new table and no new RPC.** Identity is read from `Astro.locals.user` + the self-readable `profiles` row.
- **No Telefon row** (no `phone` field), **no Powiadomienia toggle** (no notification system — PRD non-goal), **no Praca/Oddział card** (no branch field). All three are recorded design deviations.
- **Not touching `staffIdentity`** or the shell chip's `· Warszawa` literal beyond making the chip a link. (Aligning the chip to prefer `full_name` is a noted follow-up, not this slice.)
- **Not restructuring the mobile/desktop shell header** and **not adding the header search / quick-add** — those are S-13 / S-12. This slice's shell edit is confined to the `active` union, the chip anchor, the mobile tab-bar append, and one `NavIcon` glyph.
- **Not removing the existing desktop sidebar sign-out button** — it stays; the Profil page adds a second sign-out path (and the only mobile one).

## Implementation Approach

Three thin phases, smallest-shared-surface first:

1. **Shell entry point** — the one shared-surface edit S-11 owns, isolated as a single reviewable diff so S-12 (stays off the nav) and S-13 (rebases its header restructure over this) coordinate cleanly.
2. **Account view page** — pure Astro (no island needed; the only interactive bits are a link and a native sign-out form).
3. **In-session password change** — a StaffShell sub-page + a small forked form island + a self-gated endpoint that reauths before updating.

Then the terminal **Design Alignment Audit** produces `design-contract.md` with exact values
transcribed from `staff-profile.jsx`.

## Critical Implementation Details

- **Reauth ordering (Phase 3).** The endpoint must verify the current password **before**
  updating: `signInWithPassword({ email, password: current })` first; on error → redirect with a
  "wrong current password" message and make **no** change; only on success call
  `updateUser({ password: newPassword })`. `signInWithPassword` on the SSR client re-issues a
  fresh session for the **same** user (harmless — the session continues); a wrong password errors
  without disturbing the session. Read `email` from `context.locals.user` server-side — the form
  never sends it.
- **API self-gate order (lesson: /api routes are outside middleware).** In
  `change-password.ts`, gate in this order before any work: (a) same-origin CSRF (`origin !==
context.url.origin`), (b) require `context.locals.user` **and** `context.locals.supabase`,
  (c) require role `isRoleSufficient(context.locals.role, "employee")` — a deactivated user resolves to
  `role = null` and must be rejected (403), parity with the S-12/S-13 endpoints — then (d) zod parse
  (new ≥ 6, confirm-match, current non-empty), then (e) reauth, then (f) update.
  Redirect-shaped responses (matching the sibling `reset-password.ts`), not JSON — this is a
  native-form page flow, not a fetch client.
- **Mobile sign-out wiring.** The Profil page's **Wyloguj się** is a native `<form ...
action="/api/auth/signout" data-signout>`. Keep the `data-signout` attribute so StaffShell's
  existing `astro:page-load` binder (`:216-228`) wires its pending state automatically — no new
  script.
- **Mobile tab-bar density (cross-slice — awareness only).** This slice adds **one** mobile tab (Profil) —
  the pill has room. But S-13 (`staff-global-search`, merges after this) adds a **second** mobile tab (a
  search icon), which can push an admin's icon-only pill to ~9 entries. Keep this Profil tab lean (icon-only,
  no label) and don't otherwise grow the mobile bar — the combined-density check + any fallback is owned by
  S-13 (see that plan's Critical Implementation Details → "Mobile tab-bar density"). No action needed here
  beyond awareness.

## Phase 1: StaffShell entry point (shared surface, S-11-owned)

### Overview

Make the profile reachable and add the `active="me"` state — the single shared-surface edit this
slice owns. Desktop: the account chip becomes a link. Mobile: a Profil tab is appended to the
floating bar (closing the no-sign-out-on-mobile gap). No behavior change to the existing nav items.

### Changes Required:

#### 1. Shell active-state union + account-chip link + mobile Profil tab

**File**: `src/components/shell/StaffShell.astro`

**Intent**: Add `"me"` as a new `active` value; wrap the existing account chip
(`:122-134` — the chip itself; `:121` is the shared `mt-auto` wrapper that also holds the desktop
sign-out form `:135-155`, so scope the `<a>` to the chip only) in an
`<a href="/dashboard/account">` that carries `aria-current="page"` and an
active-ring/background when `active === "me"`; append one Profil `<a>` to the mobile floating tab
bar (`:180-207`) pointing at `/dashboard/account`, active-styled like the other tabs. Leave the
Operacje sidebar nav list and the desktop sign-out button unchanged.

**Contract**: `Props["active"]` union gains `"me"` (`:18`). The chip container becomes an anchor
(same visual box; add hover/active affordance). The mobile tab bar renders its existing
`NAV.map(...)` **plus** one appended Profil anchor (not added to `NAV`, so it does **not** appear
in the desktop Operacje sidebar — matching the design). Polish label/aria: **Profil**.

#### 2. Single-person glyph for the mobile Profil tab

**File**: `src/components/shell/NavIcon.astro`

**Intent**: Add a `user` (single-person) glyph to the `IconName` set so the mobile Profil tab has
a distinct icon from the admin `users` (Zespół) glyph.

**Contract**: `NavIcon` gains a `"user"` case; `StaffShell`'s local `IconName` type and the mobile
Profil anchor reference it. Stroke-style consistent with the existing 1.7-weight line glyphs.

### Success Criteria:

#### Automated Verification:

- Type checking passes: `npx astro check`
- Linting passes: `npm run lint`
- Build passes: `npm run build`

#### Manual Verification:

- Desktop: the sidebar account chip is now a link and navigates to `/dashboard/account`; it shows an active state when on that route.
- Mobile (below `md`): a Profil tab appears in the floating bar and navigates to `/dashboard/account`; it highlights when active.
- No visual/behavioral regression to the existing nav items, badges, or the desktop sign-out button.

**Implementation Note**: After automated verification passes, pause for manual confirmation before Phase 2. (Cross-route navigation from the chip/tab is fully verifiable once Phase 2's page exists.)

---

## Phase 2: Account view page (`/dashboard/account`)

### Overview

Build the read-only Profil screen inside `StaffShell active="me"`, matching `staff-profile.jsx`
minus the recorded trims. Pure Astro — no React island.

### Changes Required:

#### 1. Account page

**File**: `src/pages/dashboard/account.astro` (new)

**Intent**: Render the Profil screen. Read `{ user, role, supabase }` from `Astro.locals`; load
the caller's own `profiles` row for `full_name` (self-SELECT is RLS-allowed); load
`pendingCount`/`overdueCount` for nav-badge parity (same as every staff page). Compose:
an **identity block** (avatar initials, `full_name ?? staffIdentity(email).displayName`, role
badge via `roleLabel(role)`), a **Kontakt** card with a single **E-mail służbowy** row
(`user.email`), and a **Konto** card with **Zmień hasło** (an `<a>` to `/dashboard/account/password`
styled as an action row) and **Wyloguj się** (a native `data-signout` sign-out form styled as a
danger row). Render a mobile "Profil" heading in-content (the shell has no mobile title bar) and
pass `title="Profil"`, `subtitle="Twoje konto pracownika"` for the desktop header.

**Contract**: Route `/dashboard/account` (gated employee+ by the existing `/dashboard` prefix in
`ROUTE_ROLES`). Own-profile read: `supabase.from("profiles").select("full_name, role,
created_at").eq("user_id", user.id).maybeSingle()` (tolerant — a missing row degrades to no `full_name`
i.e. the `staffIdentity(email)` fallback, rather than `.single()` throwing a 500). `StaffShell active="me" title="Profil"
subtitle="Twoje konto pracownika" user={user} role={role} pendingCount={…} overdueCount={…}`.
Card structure and copy per `design-contract.md` (SpIdentity / SpCard / SpRow analogues).
Verbatim Polish: **Profil**, **Twoje konto pracownika**, **Kontakt**, **E-mail służbowy**,
**Konto**, **Zmień hasło**, **Wyloguj się**, role badge **Pracownik** / **Administrator**.

### Success Criteria:

#### Automated Verification:

- Type checking passes: `npx astro check`
- Linting passes: `npm run lint`
- Build passes: `npm run build`

#### Manual Verification:

- `/dashboard/account` renders under `StaffShell active="me"` at desktop + mobile, matching the design contract (identity + Kontakt(email) + Konto), with the Telefon/Powiadomienia/Oddział trims absent.
- Name shows `full_name` when set, else the humanized email; email + role are correct for the signed-in user.
- **Zmień hasło** navigates to `/dashboard/account/password`; **Wyloguj się** signs out (and shows pending feedback) — verified on mobile too.
- Rendered vision-diff against `staff-profile.jsx` is clean apart from recorded deviations.

**Implementation Note**: After automated verification passes, pause for manual confirmation before Phase 3.

---

## Phase 3: In-session password change (`/dashboard/account/password` + endpoint)

### Overview

A dedicated sub-page hosting a forked change-password form, backed by a self-gated endpoint that
verifies the current password before updating. Mirrors the shipped reset-password page idiom
(native form → redirect → `?done`/`?error` branch).

### Changes Required:

#### 1. Change-password form island

**File**: `src/components/account/ChangePasswordForm.tsx` (new)

**Intent**: Fork `ResetPasswordForm.tsx` into a three-field form — **current**, **new**, **confirm**
— reusing `FormField` / `PasswordToggle` / `ServerError` / `SubmitButton`. Plain `useState` (small
form — RHF is reserved for 8+ field forms per lessons). Client-validate: current non-empty, new ≥ 6,
new === confirm; on success set `submitting` and let the native POST proceed. Accept a
`serverError?: string | null` prop.

**Contract**: Native `<form method="POST" action="/api/auth/change-password" noValidate>` with
three `FormField`s (`autoComplete`: `current-password`, `new-password`, `new-password`). Drives
`SubmitButton pending={submitting}` with `pendingText="Zapisywanie…"`. Verbatim Polish labels:
**Obecne hasło**, **Nowe hasło**, **Powtórz nowe hasło**; submit **Zmień hasło**.

#### 2. Password sub-page

**File**: `src/pages/dashboard/account/password.astro` (new)

**Intent**: Host the form inside `StaffShell active="me"`. Parse `?done=1` / `?error=` in
frontmatter (mirroring `reset-password.astro:10-13`). On `done`, render a success panel
("Hasło zaktualizowane") with a **Wróć do profilu** link to `/dashboard/account`; otherwise render
`<ChangePasswordForm serverError={error} client:load />`. A back-link to `/dashboard/account`.

**Contract**: Route `/dashboard/account/password` (coexists with `account.astro`, like
`vehicles.astro` + `vehicles/new.astro`; gated employee+ by `/dashboard`). `StaffShell active="me"
title="Zmień hasło" subtitle="Ustaw nowe hasło do konta"`. Three-way is unnecessary (session is
guaranteed by middleware) — only `done` vs form.

#### 3. Change-password endpoint

**File**: `src/pages/api/auth/change-password.ts` (new)

**Intent**: Self-gated endpoint. In order: same-origin CSRF check; require `locals.user` +
`locals.supabase` (+ a `user.email`); require role `isRoleSufficient(locals.role, "employee")` → `403`
(rejects a deactivated `role = null` user; parity with S-12/S-13); zod parse (current, new ≥ 6,
confirm-match); **reauth** via
`signInWithPassword({ email, password: current })` — on error redirect
`?error=<wrong-current-password>`; then `updateUser({ password: new })` — on error redirect
`?error=<msg>`; on success redirect `/dashboard/account/password?done=1`.

**Contract**: `POST` `APIRoute`. Redirect-shaped (matches `reset-password.ts`), never JSON. zod
schema: `{ current: string.min(1), password: string.min(6, "Hasło musi mieć co najmniej 6 znaków"),
confirm: string }.refine(password === confirm, path: ["confirm"])`. Reauth-before-update ordering
is load-bearing (see Critical Implementation Details). Polish error copy: **Nieprawidłowe obecne
hasło**, **Hasła nie są takie same**.

### Success Criteria:

#### Automated Verification:

- Type checking passes: `npx astro check`
- Linting passes: `npm run lint`
- Build passes: `npm run build`
- Integration test passes (`npm run test:integration`): against local Supabase, `POST /api/auth/change-password` with a **wrong** current password returns the error redirect and leaves the password unchanged (a subsequent sign-in with the old password still works); with the **correct** current password it updates (sign-in with the new password works, old fails).

#### Manual Verification:

- Happy path: current + new + confirm → success panel → **Wróć do profilu** returns to `/dashboard/account`; signing out and back in with the new password works.
- Wrong current password → **Nieprawidłowe obecne hasło**, no change, session intact.
- Mismatch / too-short new password → the correct field error, form repopulates, no server call side effects.
- Submit button shows the spinner + **Zapisywanie…** pending state through the redirect.
- Rendered vision-diff of the sub-page against the design contract is clean apart from recorded deviations.

**Implementation Note**: After automated verification passes, pause for manual confirmation. This is the final build phase before the Design Alignment Audit closes planning-fidelity.

---

## Testing Strategy

### Unit Tests:

- The change-password form's client validation mirrors `ResetPasswordForm`; if that form carries unit tests, add the analogous current-non-empty / min-6 / confirm-match cases. Otherwise no new pure helper is introduced (identity display reuses `staffIdentity`).

### Integration Tests:

- `/api/auth/change-password` against local Supabase: wrong-current rejected + unchanged; correct-current updates; CSRF (cross-origin) rejected; unauthenticated rejected; a non-staff / deactivated (`role = null`) caller rejected (403). This is the meaningful automated coverage for the slice's one piece of net-new server logic.

### Manual Testing Steps:

1. As an employee, open the account chip (desktop) and the Profil tab (mobile) → land on `/dashboard/account`; confirm identity + trims.
2. Change password with a wrong current password → clear error, no change.
3. Change password correctly → success; re-login with the new password.
4. Sign out from the Profil screen on mobile (the new affordance).
5. Vision-diff both screens against `staff-profile.jsx`.

## Performance Considerations

Negligible — one extra self-SELECT on `profiles` per account-page load (indexed PK), and two
GoTrue calls (reauth + update) per password change. No new bundle weight beyond a small
three-field island reusing existing atoms.

## Migration Notes

None — no schema change, no data migration, no RPC.

## References

- Frame brief: `context/changes/staff-ops-features/frame.md`
- Roadmap slice: `context/foundation/roadmap.md` → S-11
- Design source: `staff-profile.jsx` (live in Claude Design `352d78a6-…`, pulled via DesignSync); contract at `context/changes/staff-account/design-contract.md`
- Reuse: `src/components/auth/ResetPasswordForm.tsx`, `SubmitButton.tsx`, `FormField.tsx`, `ServerError.tsx`, `PasswordToggle.tsx`; `src/pages/api/auth/reset-password.ts:45`; `src/pages/auth/reset-password.astro`
- Shell: `src/components/shell/StaffShell.astro:18` (active union), `:121-156` (chip + signout), `:177-208` (mobile tab bar); `src/components/shell/NavIcon.astro`
- Data: `supabase/migrations/20260604153139_employee_admin_roles.sql` (profiles + RLS), `20260723194602_employee_account_management.sql` (`full_name`)

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: StaffShell entry point (shared surface, S-11-owned)

#### Automated

- [x] 1.1 Type checking passes: `npx astro check` — 346bb3c
- [x] 1.2 Linting passes: `npm run lint` — 346bb3c
- [x] 1.3 Build passes: `npm run build` — 346bb3c

#### Manual

- [x] 1.4 Desktop account chip is a link to `/dashboard/account` with an active state — 4a3eaaa
- [x] 1.5 Mobile Profil tab appears in the floating bar and navigates/highlights — 4a3eaaa
- [x] 1.6 No regression to existing nav items, badges, or the desktop sign-out button — 4a3eaaa

### Phase 2: Account view page (`/dashboard/account`)

#### Automated

- [x] 2.1 Type checking passes: `npx astro check` — 3a7aa37
- [x] 2.2 Linting passes: `npm run lint` — 3a7aa37
- [x] 2.3 Build passes: `npm run build` — 3a7aa37

#### Manual

- [x] 2.4 Page renders under `StaffShell active="me"` (desktop + mobile) per the design contract, trims absent — 4a3eaaa
- [x] 2.5 Name = `full_name` else humanized email; email + role correct — 4a3eaaa
- [x] 2.6 Zmień hasło navigates to the sub-route; Wyloguj się signs out (with pending feedback), incl. mobile — 4a3eaaa
- [x] 2.7 Vision-diff against `staff-profile.jsx` clean apart from recorded deviations — 4a3eaaa

### Phase 3: In-session password change (`/dashboard/account/password` + endpoint)

#### Automated

- [x] 3.1 Type checking passes: `npx astro check` — 8d0c54c
- [x] 3.2 Linting passes: `npm run lint` — 8d0c54c
- [x] 3.3 Build passes: `npm run build` — 8d0c54c
- [x] 3.4 Integration test: wrong-current rejected + unchanged; correct-current updates (`npm run test:integration`) — 8d0c54c

#### Manual

- [x] 3.5 Happy path: change succeeds, success panel, re-login with new password works — 4a3eaaa
- [x] 3.6 Wrong current password → Nieprawidłowe obecne hasło, no change, session intact — 4a3eaaa
- [x] 3.7 Mismatch / too-short → correct field error, no side effects — 4a3eaaa
- [x] 3.8 Submit shows spinner + Zapisywanie… through the redirect — 4a3eaaa
- [x] 3.9 Vision-diff of the sub-page against the contract clean apart from recorded deviations — 4a3eaaa
