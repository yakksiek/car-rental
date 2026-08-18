# Design Contract — Auth Surface Hardening (S-14)

Source of truth: Claude Design project `Rental car company`
(`352d78a6-84fd-49a2-8b38-2fe289691fc3`), files `password-reset.jsx` (layout + states) and
`shared.jsx` → `STR.PL.auth` / `STR.PL.login` (copy). Pulled 2026-08-12.

This slice **inherits** the S-08 auth-card shell contract
(`context/archive/2026-07-23-employee-account-management/design-contract.md` §3.14) rather than
re-deriving it. Everything §3.14 marked `exact` stays as shipped and is **not** re-litigated here.

---

## Design Alignment Audit

### 1. Freshness — repo vs canonical

| Artifact                                                                                                      | Status                                         | Note                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| ------------------------------------------------------------------------------------------------------------- | ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `context/foundation/design-system.md` catalog rows 19 / 25 (Employees)                                        | `current`                                      | Not touched by S-14.                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `context/foundation/design/screenshots/*`                                                                     | `current` (n/a)                                | Contains **no** auth screens — the reset/invite flow was never promoted to the shipped-surface catalog. S-14 should promote the six auth screens it finalizes (see §6).                                                                                                                                                                                                                                                                     |
| S-08 per-change mockups (`context/archive/2026-07-23-employee-account-management/design-review/reset-r*.jpg`) | `outdated (superseded)`                        | Pre-date the account box, the status heads, and the three new states. Superseded by the `auth-*-{d,m}.png` set below.                                                                                                                                                                                                                                                                                                                       |
| **Mobile set** — `auth-*-m.png` (10 files)                                                                    | **`current` — verified by render, 2026-08-12** | Pulled into `design-review/` via `DesignSync get_file` and decoded (780 × 1688 = 390 × 844 @2×). Freshness **confirmed visually**, not assumed: `auth-invite-m.png` renders `WITAJ WE FLOCIE` (the corrected euphonic `we`), the invite-specific subtitle, and the `USTAWIASZ HASŁO DLA` account box — all three post-date the copy round, so the export is current.                                                                        |
| **Desktop set** — `auth-*-d.png` (11 files)                                                                   | **`current` — in repo 2026-08-13**             | Supplied manually (1320 × 840 @2× = 2640 × 1680). Could not be fetched programmatically: every desktop artboard exceeds `DesignSync get_file`'s 256 KiB cap and returns `truncated: true` (verified on 6 — all exactly 262 144 base64 bytes), decoding to a corrupt PNG. Freshness confirmed by render: `auth-set-d.png` shows the `USTAWIASZ HASŁO DLA` account box, which post-dates the copy round. **Carries the §2a export artifact.** |
| Design project `design-review/auth-{authed,authed-busy,inapp,nolink}-{d,m}.png`                               | `current` (new)                                | The four states this slice creates. `auth-authed-busy-d.png` is a deterministic pending-state artboard (`forceBusy` prop), so R11's spinner can be diffed without timing a click.                                                                                                                                                                                                                                                           |
| `STR.PL.auth` / `STR.PL.login` copy                                                                           | `current`                                      | Verified against live `shared.jsx` 2026-08-12: every existing string matches what ships; `openMail` / `sentResend` deleted to match the app; `login.forgot` already the neutral `Nie pamiętasz hasła?`. The drift and the three copy defects recorded in `research.md` were all **fixed at source**.                                                                                                                                        |

### 2. Quality — gaps in the new designs

| Gap                                                                                            | Resolution                                                                                                                                                                                                                                           |
| ---------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **No mobile artboard for R11's pending state.** `ScreenAuthAuthedBusyD` is desktop-only.       | Accept. The button is full-width at both breakpoints and the pending treatment is `SubmitButton`'s shipped idiom, so the desktop artboard governs both. `deviation(mobile pending state inferred from the desktop artboard + shipped SubmitButton)`. |
| **No error state** on any of R11/R12/R13.                                                      | Correct by construction — none of the three submits a form except R11's sign-out, whose only failure mode is a network error. Reuse `ServerError` if it ever needs one; not specced.                                                                 |
| **No loading state** on any of the three.                                                      | Correct — all are SSR'd Astro pages with no client fetch.                                                                                                                                                                                            |
| **`inAppSub` names a navigation path** (`Konto → „Zmień hasło”`) that must match the real nav. | Verified: `/dashboard/account` → `/dashboard/account/password`, and the shipped back link reads `Wróć do profilu`. Path is accurate.                                                                                                                 |
| **`passPh` / `rule1` say `Co najmniej 10 znaków`** while the enforced minimum is 6.            | Known deliberate divergence — S-08 deviation 7. **Do not** tighten the zod schema. Carried forward unchanged.                                                                                                                                        |
| **`login.remember` (`Nie wylogowuj mnie`)** exists in copy but the app ships no checkbox.      | Deliberate — `SignInForm.tsx:16-18` documents it (sessions persist via Supabase cookies; an inert control would read as broken). Carried forward as a deviation.                                                                                     |

### 2a. Export artifact — secure-row footer wrap — **FIXED AT SOURCE 2026-08-13**

**Symptom (was).** On every mockup carrying the footer secure row
(`🛡 Połączenie szyfrowane · tylko personel`), the exported PNG broke after `tylko` and dropped
`personel` to a second line — with 120–170 px of free space still on line 1. Not a reachable layout
state; the live mock always rendered one line.

**Cause (confirmed by fix).** `Icon.base` in `shared.jsx` set explicit `width`/`height` but **no
`flexShrink: 0`**. The row is `display: flex` holding that SVG plus a bare `<span>`, both at the
default `flex-shrink: 1`. When the width attribute is not honoured at measure time the SVG claims its
default 300 px intrinsic basis, and **both items then shrink proportionally**:
`360 ÷ (300 + 6 + 236) = 0.66`, so the 236 px text is allotted ~156 px and wraps — matching the
~170 px measured. The icon still paints at 14 px, which is why the free space looked impossible.

**Fix applied** (`shared.jsx`, this session):

```js
style: { flexShrink: 0, ...props.style },   // was: style: props.style,
```

Project-wide: every icon in every flex row is now unshrinkable; caller styles still win (spread
last). Verified by re-export of `auth-inapp-d.png` — footer renders on one line.

**RESOLVED — all 21 mockups re-exported and verified 2026-08-13.** Every `AuthCard` mode that
carries a secure row has been opened and confirmed to render it on **one line**:

| Mode                                    | Verified on              | Was                            |
| --------------------------------------- | ------------------------ | ------------------------------ |
| `inApp`                                 | `auth-inapp-d.png`       | broken → fixed                 |
| `set`                                   | `auth-set-d.png`         | broken → fixed                 |
| `invite`                                | `auth-invite-m.png`      | broken → fixed                 |
| `authed` (+ pending)                    | `auth-authed-busy-d.png` | broken → fixed                 |
| `forgot`                                | `auth-forgot-d.png`      | already clean at desktop width |
| sign-in (own footer, `staff-login.jsx`) | `auth-signin-d.png`      | already clean at desktop width |

The 6 files not individually opened are the opposite breakpoint of a mode already verified above, and
all 6 were re-exported with changed bytes. `auth-forgot-d.png` was byte-size-identical before and
after, which is consistent with the _forgot_ layout never wrapping at the 440 px desktop card — its
mobile twin `auth-forgot-m.png` did change (−3 KB), so that mode was affected at mobile width only.

**Correction to the earlier estimate:** the "13 affected files" figure over-predicted. Presence of a
secure row was necessary but not sufficient — the four modes observed wrapping all also carry an
account box, so the trigger was narrower than first reported.

**Standing rulings:**

1. **Do not port the wrap.** The shipped footer lives in `AuthShell.astro`
   (`flex items-center justify-center gap-1.5 text-[12.5px]`) and fits on one line in the 360 px
   content column at both breakpoints. It stays one line.
2. **Every other wrap in these mockups is legitimate and must be reproduced** — checked:
   `Nie ma tu nic do / ustawienia` misses fitting by ~4 px, and `Wybierz silne hasło, którego nie
używasz nigdzie / indziej.` has ~40 px left. Both are real.

### 3. Alignment — every canonical surface has a phase, every phase has a design

| Surface                                | Mockup                   | Plan phase                        | Status                                                                     |
| -------------------------------------- | ------------------------ | --------------------------------- | -------------------------------------------------------------------------- |
| R11 · already signed in                | `auth-authed-{d,m}.png`  | Phase 2                           | aligned                                                                    |
| R11 · signing-out pending              | `auth-authed-busy-d.png` | Phase 2                           | aligned                                                                    |
| R12 · use account settings             | `auth-inapp-{d,m}.png`   | Phase 1                           | aligned                                                                    |
| R13 · nothing to set here              | `auth-nolink-{d,m}.png`  | Phase 1                           | aligned                                                                    |
| R5 · link expired (re-purposed)        | `auth-expired-{d,m}.png` | Phase 1 (logic), Phase 4 (chrome) | aligned                                                                    |
| R4 · password updated                  | `auth-success-{d,m}.png` | Phase 4 (chrome)                  | aligned                                                                    |
| R2 · check your email                  | `auth-sent-{d,m}.png`    | Phase 4 (chrome)                  | aligned                                                                    |
| R3/R9 · set new password + account box | `auth-set-{d,m}.png`     | Phase 4 (`setFor`)                | aligned                                                                    |
| R6/R10 · invite accept + account box   | `auth-invite-{d,m}.png`  | Phase 4 (copy + `setFor`)         | aligned                                                                    |
| Sign in (`forgot` link copy)           | `auth-signin-{d,m}.png`  | Phase 4                           | aligned                                                                    |
| 404 / 500                              | `exports/error-pages/*`  | **none**                          | out of scope by decision — its own change (see plan §What We're NOT Doing) |

No plan phase contradicts a design; no in-scope design lacks a phase.

### 4. Verdict

**PASS — 10 surfaces aligned · 21/21 canonical mockups in repo and clean · 1 repo design set
superseded · 11 deviations recorded · 0 open artifacts.**

All 21 PNGs are in `design-review/`, freshness verified by render rather than assumed. Nine were
opened and checked directly against the transcribed specs, producing three corrections now folded in:
the icon-glyph mapping (§7.1), the secure-row export artifact (§2a — fixed at source in `shared.jsx`
and re-exported), and the sign-in forgot-link colour (§10.11).

Planning is complete with no caveats carried into implementation.

---

## 5. Token map (design hex → app token)

| Design (`shared.jsx` `tokens`) | Hex                           | App token                              | Tailwind utility                    |
| ------------------------------ | ----------------------------- | -------------------------------------- | ----------------------------------- |
| `ink`                          | `#0F172A`                     | `--flota-ink` → `--foreground`         | `text-foreground` / `bg-foreground` |
| `ink2`                         | `#334155`                     | `--flota-ink-2`                        | `text-[var(--flota-ink-2)]`         |
| `muted`                        | `#94A3B8`                     | `--flota-muted` → `--muted-foreground` | `text-muted-foreground`             |
| `bg`                           | `#F1F3F6`                     | `--flota-bg` → `--background`          | `bg-background`                     |
| `card`                         | `#FFFFFF`                     | `--flota-card` → `--card`              | `bg-card`                           |
| `hair`                         | `rgba(15,23,42,0.08)`         | `--flota-hair`                         | `border-[var(--flota-hair)]`        |
| `greySoft`                     | `#EEF1F5`                     | `--flota-neutral-soft` → `--secondary` | `bg-secondary`                      |
| `green`                        | `#1B9E5A`                     | `--flota-success` → `--success`        | `text-success`                      |
| `greenSoft`                    | `#E3F5EC`                     | `--flota-success-soft`                 | `bg-[var(--flota-success-soft)]`    |
| `red`                          | `#B43638`                     | `--flota-danger` → `--destructive`     | `text-destructive`                  |
| `redSoft`                      | `#FBE4E1`                     | `--flota-danger-soft`                  | `bg-[var(--flota-danger-soft)]`     |
| `accent`                       | `#B43638`                     | `--flota-accent` → `--primary`         | `text-primary` (invite eyebrow)     |
| `mono`                         | JetBrains Mono                | `--flota-font-mono`                    | `font-mono`                         |
| `shadow1`                      | `0 1px 2px …, 0 2px 6px …`    | `--shadow-card`                        | `shadow-card`                       |
| `shadow3`                      | `0 4px 12px …, 0 24px 60px …` | `--shadow-overlay`                     | `shadow-overlay`                    |

All colors map to existing tokens. **No new token is required by this slice.**

---

## 6. Screen inventory (mockup → app surface)

| Mockup ref (design project) | App surface                                           | State key |
| --------------------------- | ----------------------------------------------------- | --------- |
| `ScreenAuthAuthedD` / `…M`  | `src/pages/auth/link-conflict.astro`                  | R11       |
| `ScreenAuthAuthedBusyD`     | same, sign-out island in flight                       | R11-busy  |
| `ScreenAuthInAppD` / `…M`   | `src/pages/auth/reset-password.astro` (origin ≠ link) | R12       |
| `ScreenAuthNoLinkD` / `…M`  | `src/pages/auth/reset-password.astro` (no session)    | R13       |
| `ScreenAuthExpiredD` / `…M` | `src/pages/auth/reset-password.astro` (marker absent) | R5        |
| `ScreenAuthSuccessD` / `…M` | `src/pages/auth/reset-password.astro` (done cookie)   | R4        |
| `ScreenAuthSentD` / `…M`    | `src/pages/auth/forgot-password.astro` (`?sent=1`)    | R2        |
| `ScreenAuthSetD` / `…M`     | `ResetPasswordForm` mode `recovery`                   | R3/R9     |
| `ScreenAuthInviteD` / `…M`  | `ResetPasswordForm` mode `invite`                     | R6/R10    |

**Promote at archive**: the six finalized auth screens (`signin`, `forgot`, `sent`, `set`, `invite`,
`success`, plus the three new ones) belong in `context/foundation/design/screenshots/` with catalog
rows in `design-system.md` — the auth flow has never been in that catalog, which is why S-08's
mockups went stale unnoticed.

---

## 7. Shared elements — exact values

### 7.1 Status head (new — `src/components/auth/StatusHead.astro`)

From `password-reset.jsx` `statusHead()`.

| Property      | Value      | Utility                            | Mark  |
| ------------- | ---------- | ---------------------------------- | ----- |
| Size          | 56 × 56 px | `size-14`                          | exact |
| Radius        | 16 px      | `rounded-[16px]`                   | exact |
| Bottom margin | 20 px      | `mb-5`                             | exact |
| Icon size     | 27 px      | `size-[27px]`                      | exact |
| Layout        | centered   | `flex items-center justify-center` | exact |

Tone map (background / foreground), and which state uses which:

| Tone    | Background                       | Foreground                  | Used by                                    | lucide icon                        |
| ------- | -------------------------------- | --------------------------- | ------------------------------------------ | ---------------------------------- |
| `ink`   | `bg-secondary`                   | `text-[var(--flota-ink-2)]` | R2 sent, R11 authed, R12 inApp, R13 noLink | `Mail`, `User`, `Settings`, `Info` |
| `green` | `bg-[var(--flota-success-soft)]` | `text-success`              | R4 success                                 | `ShieldCheck`                      |
| `red`   | `bg-[var(--flota-danger-soft)]`  | `text-destructive`          | R5 expired                                 | `TriangleAlert`                    |

`deviation(icon glyphs approximated)` — the lucide names above are a **mapping**, not a
transcription. The design uses its own `Icon.*` set, and the R12 glyph rendered in
`auth-inapp-m.png` is a crosshair-like mark, **not** a cog — so lucide `Settings` is an
approximation. Confirm each glyph against its mockup at the vision-diff gate and substitute the
closest lucide equivalent; do not treat these five names as exact.

Alignment: the tile is **left-aligned** with the title, not centered (verified in
`auth-inapp-m.png`) — no auto margins.

`deviation(scope)` — the design gives R2/R4/R5 a status head and the shipped cards have none.
Adopted on **all six** state cards rather than only the three new ones, so the surface stays
coherent; this is layout beyond a pure copy refresh and is the one judgement call in Phase 4.

### 7.2 Account box (new — `src/components/auth/AccountBox.astro`)

From `password-reset.jsx` `acctBox()`. One component, three consumers (R3/R9 + R6/R10 `setFor`;
R11 + R12 `authedAs`).

| Element       | Value                                                             | Utility                                                                                                    | Mark  |
| ------------- | ----------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- | ----- |
| Container     | gap 10, padding 12×14, radius 12, bg `#F1F3F6`, 1px `hair` border | `flex items-center gap-2.5 rounded-xl border border-[var(--flota-hair)] bg-background px-3.5 py-3 min-w-0` | exact |
| Avatar tile   | 34 × 34, radius 9, white, `shadow1`                               | `size-[34px] shrink-0 rounded-[9px] bg-card shadow-card flex items-center justify-center`                  | exact |
| Initials      | 12.5 px, weight 700, ink                                          | `text-[12.5px] font-bold text-foreground`                                                                  | exact |
| Label         | 10.5 px, weight 650, tracking 0.4, uppercase, muted, mb 2         | `mb-0.5 text-[10.5px] font-[650] tracking-[0.4px] uppercase text-muted-foreground`                         | exact |
| Email         | 13.5 px, mono, ink, single-line ellipsis                          | `truncate font-mono text-[13.5px] text-foreground`                                                         | exact |
| Bottom margin | 18 px on R3/R9, R6/R10, R11 · 20 px on R12                        | `mb-[18px]` / `mb-5`                                                                                       | exact |

Initials are derived from the profile's `full_name` when present, else the email's local part —
the design shows `PB`, `AK`, `KW`, i.e. two letters, uppercase.

### 7.3 Primary action

Already approved in S-08 §3.14 and shipped as `SubmitButton.tsx:26`; the design's `primaryBtn` is
byte-identical in intent.

`bg-foreground text-background h-[52px] w-full rounded-[13px] text-[15px] font-[650] gap-2` +
trailing icon. Marked **exact**.

`deviation(fix)` — the shipped R4/R5 CTAs in `reset-password.astro:26,41` use
`bg-primary … h-12 rounded-xl text-sm font-semibold` (crimson, 48 px, 12 px radius, 14 px, 600),
which diverges from S-08's own approved spec above. Corrected in Phase 4.

### 7.4 Pending state (R11 sign-out)

Design: 17 px ring, `2px solid rgba(255,255,255,0.35)` with `#fff` top, 0.7 s linear spin, container
opacity 0.92, gap 10.

`deviation(reuse shipped)` — ship `SubmitButton`'s existing ring
(`size-4 border-2 border-background/30 border-t-background animate-spin`) at the default Tailwind
spin duration. Rationale: `SubmitButton` is the approved primary action (§7.3) and its ring is
already used on every other auth form; a bespoke 17 px / 0.7 s ring on one button would be the
outlier. Diff target is `auth-authed-busy-d.png`.

### 7.5 Inherited, unchanged (S-08 §3.14 — do not re-derive)

Desktop card `md:w-[440px] md:rounded-[20px] md:px-10 md:py-9` over the scrim
`bg-[rgba(15,23,42,0.55)]`; mobile ink band `px-6 pt-14 pb-7` with the truck SVG and the `Logowanie`
back link; title `text-[28px] leading-[1.05] font-bold tracking-[-0.8px]`; subtitle
`text-muted-foreground mt-2 text-sm leading-[1.45]`; back-to-sign-in link
`text-muted-foreground text-sm inline-flex items-center gap-1.5` with a `‹` glyph; footer secure row
in the `AuthShell` slot. All `exact`.

`deviation(inherited)` — the design's H1 is 30 px on desktop / 28 px compact and its subtitle is
`9px` top margin at `1.5` line-height; the app ships 28 px and `mt-2` / `1.45` at both breakpoints.
S-08 marked the shipped values `exact`; changing them now would reflow five shipped screens for no
functional gain.

---

## 8. Per-surface layout

### 8.1 R11 — `link-conflict.astro` (`auth-authed-{d,m}.png`)

`AuthShell` → StatusHead `ink` / `User` → title `authedTitle` → subtitle `authedSub` → AccountBox
(`authedAs`, `locals.user.email`, `mb-[18px]`) → `SignOutButton` island → shell footer.

No back link (the design shows none — the sign-out button is the only action). Signed-out visitors
are redirected to `/auth/signin` before render.

### 8.2 R12 — `reset-password.astro`, origin ≠ link (`auth-inapp-{d,m}.png`)

StatusHead `ink` / `Settings` → title `inAppTitle` → subtitle `inAppSub` → AccountBox (`authedAs`,
`locals.user.email`, `mb-5`) → primary link-button `inAppCta` → `/dashboard/account/password`.

No back link (design shows none).

### 8.3 R13 — `reset-password.astro`, no session (`auth-nolink-{d,m}.png`)

StatusHead `ink` / `Info` → title `noLinkTitle` → subtitle `noLinkSub` → primary link-button
`noLinkCta` → `/auth/forgot-password` → **back link** `Powrót do logowania` → `/auth/signin`.

No account box (there is no account to name).

### 8.4 R3/R9 and R6/R10 — account box insertion

AccountBox (`setFor`, target email, `mb-[18px]`) sits **between the subtitle and the password
fields**, per `password-reset.jsx`. Invite mode keeps the crimson eyebrow above the title:
`text-primary text-[11px] font-bold tracking-wide uppercase mb-1.5` (shipped
`ResetPasswordForm.tsx:57`; design specifies 11.5 px / 700 / 0.6 tracking —
`deviation(inherited from shipped)`).

---

## 9. Verbatim Polish copy

**Canonical. Port exactly — including the Polish typographic quotes `„…”` in `inAppSub`, which are
not ASCII `"`.**

| Key                                          | Polish                                                                                                                                     | Surface       | Mark                                                                                                                                                                                                  |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ | ------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `authedTitle`                                | `Ta przeglądarka jest już zalogowana`                                                                                                      | R11           | exact (new)                                                                                                                                                                                           |
| `authedSub`                                  | `Ten link otworzył się w przeglądarce, gdzie zalogowane jest inne konto. Najpierw wyloguj się, a potem otwórz link ponownie z wiadomości.` | R11           | exact (new)                                                                                                                                                                                           |
| `authedAs`                                   | `Zalogowano jako`                                                                                                                          | R11, R12      | exact (new)                                                                                                                                                                                           |
| `signOut`                                    | `Wyloguj się`                                                                                                                              | R11           | exact (new)                                                                                                                                                                                           |
| `signingOut`                                 | `Wylogowywanie…`                                                                                                                           | R11 pending   | exact (new) — note the ellipsis character `…`, not `...`                                                                                                                                              |
| `inAppTitle`                                 | `Zmień hasło w ustawieniach`                                                                                                               | R12           | exact (new)                                                                                                                                                                                           |
| `inAppSub`                                   | `Ta sesja jest aktywna, więc nie ma tu linku do resetu. Otwórz Konto → „Zmień hasło” — najpierw potwierdzisz obecne hasło.`                | R12           | exact (new)                                                                                                                                                                                           |
| `inAppCta`                                   | `Przejdź do ustawień konta`                                                                                                                | R12           | exact (new)                                                                                                                                                                                           |
| `noLinkTitle`                                | `Nie ma tu nic do ustawienia`                                                                                                              | R13           | exact (new)                                                                                                                                                                                           |
| `noLinkSub`                                  | `Aby ustawić hasło, potrzebujesz linku do resetu. Poproś o niego, a wyślemy go e-mailem.`                                                  | R13           | exact (new)                                                                                                                                                                                           |
| `noLinkCta`                                  | `Poproś o link do resetu`                                                                                                                  | R13           | exact (new)                                                                                                                                                                                           |
| `setFor`                                     | `Ustawiasz hasło dla`                                                                                                                      | R3/R9, R6/R10 | exact (new)                                                                                                                                                                                           |
| `inviteKick`                                 | `Witaj we Flocie`                                                                                                                          | R6/R10        | **exact (changed)** — supersedes shipped `Witaj w Flocie`; euphonic `we`. Breaks `e2e/staff-auth.spec.ts:88`.                                                                                         |
| `inviteSub`                                  | `Masz zaproszenie do zespołu dyspozytorni. Utwórz hasło, aby aktywować konto.`                                                             | R6/R10        | **exact (changed)** — the app currently reuses the recovery subtitle for both modes.                                                                                                                  |
| `login.forgot`                               | `Nie pamiętasz hasła?`                                                                                                                     | sign-in       | **exact (changed)** — supersedes shipped `Zapomniałeś hasła?` (masculine).                                                                                                                            |
| `backToLogin`                                | `Powrót do logowania`                                                                                                                      | R13, R14      | exact (matches shipped) — **also the R14 CTA** as of impl-review F8; the card first shipped `Wróć do logowania`, a second phrasing for one idea, unnoticed because the string sat outside this table. |
| `inactiveTitle`                              | `Konto jest nieaktywne`                                                                                                                    | R14           | exact (new) — `deviation(no artboard)`, see §10.14                                                                                                                                                    |
| `inactiveSub`                                | `Nie można ustawić hasła do nieaktywnego konta. Jeśli to pomyłka, skontaktuj się z administratorem.`                                       | R14           | exact (new) — `deviation(no artboard)`, see §10.14                                                                                                                                                    |
| `expiredTitle` / `expiredSub` / `expiredCta` | `Link wygasł` / `Linki resetujące są ważne 60 minut. Poproś o nowy, aby kontynuować.` / `Poproś o nowy link`                               | R5            | exact (unchanged — re-purposed, not reworded)                                                                                                                                                         |
| `successTitle` / `successSub` / `successCta` | `Hasło zaktualizowane` / `Możesz teraz zalogować się nowym hasłem.` / `Przejdź do logowania`                                               | R4            | exact (unchanged)                                                                                                                                                                                     |

Every other `STR.PL.auth` / `STR.PL.login` string already matches what ships — verified against live
`shared.jsx` 2026-08-12. **The entire PL auth block is gender-neutral; keep it that way for any new
copy.**

New copy introduced by S-14 with **no** design mockup (error-code messages, Phase 3): these are
alert-line strings, not screen copy, and extend the shipped `MSG` idiom at
`change-password.ts:30-34`. `deviation(no mockup — inline alert strings, existing pattern)`.

---

## 10. Deviations register

1. **Status heads retrofitted to R2/R4/R5** — layout beyond a copy refresh, adopted so the three new
   cards aren't visual outliers (§7.1).
2. **R4/R5 CTA corrected to the ink `SubmitButton` idiom** — the shipped crimson buttons diverge from
   S-08's own approved §3.14 spec (§7.3).
3. **R11 pending ring reuses `SubmitButton`'s** rather than the design's 17 px / 0.7 s ring (§7.4).
4. **Shell metrics inherited from S-08** — 28 px H1 at both breakpoints, `mt-2` / `1.45` subtitle,
   shipped back-link styling, footer in the `AuthShell` slot (§7.5).
5. **Mobile R11 pending state inferred** from the desktop artboard (§2).
6. **Invite eyebrow keeps shipped 11 px / `tracking-wide`** rather than the design's 11.5 px / 0.6
   (§8.4).
7. **Password checklist stays illustrative** — enforced minimum remains 6, not the "10 znaków" hint.
   Carried forward from S-08 deviation 7.
8. **`Nie wylogowuj mnie` checkbox stays omitted** — sessions persist via Supabase cookies
   (`SignInForm.tsx:16-18`).
9. **`httpOnly: false` on the Supabase auth cookies retained** — knowing product trade
   (`storage.ts:15-19`); recorded, not fixed.
10. **404 / 500 pages out of scope** despite existing designs — their own change.
11. **R5 gains the `Powrót do logowania` back link.** Both `auth-expired-d.png` and `auth-expired-m.png`
    render one under the CTA; the shipped card had none, and §8 never gave R5 a per-surface entry
    because the plan scoped Phase 4's R5 work to the status head and the CTA. Added during the
    vision-diff gate — it is the same `AuthBackLink` R2 and R13 already use, and both R5 branches
    (`reset-password.astro` marker-absent and `forgot-password.astro` `?expired=1`) now carry it.
12. **Desktop state cards keep the secure-row footer the mockups omit.** `auth-expired-d.png` (and its
    siblings) end the card at the back link, but `AuthShell` renders the footer on every auth surface —
    §7.5 marks that shell `exact` and inherited from S-08. Adopting the mockup here would strip the
    footer from six shipped screens for no functional gain. Verified one line at both breakpoints per
    §2a (18.8 px measured at 390 and 1320). Recorded so the next diff stops re-flagging it.
13. **Sign-in "forgot password" link keeps its shipped muted styling.** `auth-signin-d.png` renders
    `Nie pamiętasz hasła?` in **crimson** (`tokens.accent`, weight 600); the app ships
    `text-muted-foreground hover:text-foreground text-[13px]`. Phase 4 changes the **string only** —
    a secondary action shouldn't compete with the primary CTA, and S-08 §3.14 already reconciled this
    shell to shipped values. Recorded here so the vision-diff stops re-flagging it. Cheap to adopt
    later if the product owner prefers the crimson.
14. **`Konto jest nieaktywne` — a sixth state card on `reset-password.astro`, with no artboard.**
    `deviation(no artboard — refusal state discovered in impl-review)`. The set-password page mirrored
    four of the route's five gates but not the role check, so a **deactivated** staffer reached the
    full form and got an unstyled `Forbidden` on submit. Added in `auth-followups` Phase 1 (plan:
    `context/changes/auth-followups/plan.md` §"Phase 1"; evidence: `reviews/impl-review.md` F1).
    No mockup exists — the state was discovered after the design session closed — so **every
    dimension is inherited-exact, not invented**: status head `tone="ink"` / `icon="user"` per §7.1
    (the same pair R11 uses — the refusal is about _who the account is_, which is what that glyph
    already means on this surface), title/subtitle metrics per §7.5, and CTA per §7.3
    `AuthPrimaryLink`. Only the **state** is new. New verbatim Polish copy, gender-neutral per §9:
    - title — `Konto jest nieaktywne`
    - subtitle — `Nie można ustawić hasła do nieaktywnego konta. Jeśli to pomyłka, skontaktuj się z administratorem.`
    - CTA — `backToLogin` (§9) → `/auth/signin`

    **No account box**, though unlike R13 there is an account to name: this branch runs after the
    `!user` gate, so `user.email` is always available. Naming the account here would print an
    address next to "to konto jest nieaktywne" — turning a refusal the reader can only act on by
    contacting an admin into a per-address account-state readout. The three states that DO carry
    the box either name the session standing in the way (§8.1, §8.2) or the account being written
    to (§8.4); this card does neither. Recorded because §8.1–§8.3 each state their box decision
    explicitly and this state, having no artboard, would otherwise leave it unstated
    (impl-review F8).

    The subtitle was re-authored by the owner at the Phase 1 gate; the plan's draft read as a
    translation. Three things were wrong with it: `hasło **dla** konta` (the Polish collocation is
    `hasło **do** konta` — the main tell), an opening clause that merely restated the title, and a
    trailing conditional where Polish fronts it. The impersonal `Nie można…` is in-style here — cf.
    the shipped `Linki resetujące są ważne 60 minut.` — even though the neighbouring cards address
    the reader directly.

    **No `AuthBackLink`** (owner decision at the Phase 1 gate, refining the plan's contract): this
    card's CTA already targets `/auth/signin`, so a back link would be a second control to the same
    place under a near-identical label. That matches R4 success and the `dashboard/account/password`
    success card, both of which omit it for exactly that reason; R5 and R13 keep theirs because
    their CTA goes to `/auth/forgot-password` instead.

    The copy asserts deactivation rather than hedging. Owner decision (`auth-followups/change.md`,
    2026-08-17): the reader already controls the mailbox that received the link, so the
    account-state disclosure is narrow, and a real ex-employee is otherwise left with no
    explanation. It is exact for the reachable path. Two other paths land here with `role = null`
    and would read it as false: the new-hire race (`services/staff.ts:192-202` invites before
    inserting the profiles row), a window two sequential awaits wide that no click fits inside;
    and — not a window at all — a hire whose profiles insert failed after the invite was already
    sent, who has no profiles row permanently (impl-review F6, rollback queued at
    `auth-followups/follow-ups/review-fixes.md`). Both knowingly accepted rather than
    genericising the copy for cases this surface cannot distinguish.

---

## 11. Vision-diff gate (for `/10x-implement` and `/10x-impl-review`)

Render each surface at **390 px** (mobile) and **1320 px** (desktop — the artboard width, not 1440)
and diff against its mockup. All 21 mockups are in `design-review/` and ready.

| Surface     | Desktop mockup           | Mobile mockup        |
| ----------- | ------------------------ | -------------------- |
| R11         | `auth-authed-d.png`      | `auth-authed-m.png`  |
| R11 pending | `auth-authed-busy-d.png` | — (inferred)         |
| R12         | `auth-inapp-d.png`       | `auth-inapp-m.png`   |
| R13         | `auth-nolink-d.png`      | `auth-nolink-m.png`  |
| R5          | `auth-expired-d.png`     | `auth-expired-m.png` |
| R4          | `auth-success-d.png`     | `auth-success-m.png` |
| R2          | `auth-sent-d.png`        | `auth-sent-m.png`    |
| R3/R9       | `auth-set-d.png`         | `auth-set-m.png`     |
| R6/R10      | `auth-invite-d.png`      | `auth-invite-m.png`  |
| Sign in     | `auth-signin-d.png`      | `auth-signin-m.png`  |

Iterate to an empty punch-list, minus the thirteen deviations in §10 **and the pre-registered export
artifact in §2a**.

The secure-row export artifact is **fixed at source and fully re-exported** (§2a) — no false
positives to pre-register. The footer is one line in every mockup and must be one line in the app.
