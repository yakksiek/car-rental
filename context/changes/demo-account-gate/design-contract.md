# Design Contract — demo-account-gate

Surface touched: **`/auth/signin`** (one surface). Phases 1, 2 and 4 touch no UI beyond disabling three existing controls in `StaffList`, which reuse their own components' disabled states and add no new visual element.

Canonical source: Claude Design project `Rental car company` (`352d78a6-84fd-49a2-8b38-2fe289691fc3`), file `staff-login.jsx`, screens `ScreenStaffLoginMobile` / `ScreenStaffLoginDesktop` + the shared `LoginForm`. Copy from `shared.jsx` `STR.PL.login`.

---

## Design Alignment Audit

### 1. Freshness — repo vs canonical

| Artifact            | Repo state                                                                | Canonical state                                                                            | Verdict     |
| ------------------- | ------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ | ----------- |
| Sign-in screenshot  | **absent** — no `screenshots/*signin*` or `*login*` file exists           | `design-review/auth-signin-d.png`, `design-review/auth-signin-m.png`                       | **missing** |
| Sign-in catalog row | **absent** — `design-system.md` catalog rows 01–29 contain no auth screen | 22 auth PNGs in `design-review/`, indexed under "Password reset & invite (S-08 · Phase 3)" | **missing** |
| `staff-login.jsx`   | not in repo (by design — JSX removed 2026-06-18)                          | present, pulled 2026-08-28                                                                 | current     |
| Live tokens         | `src/styles/global.css`                                                   | `tokens.css`                                                                               | current     |

**Finding beyond this slice:** the entire auth surface — sign-in, forgot, sent, set, expired, invite, already-authed, in-app, no-link, success, across desktop and mobile — is canonically designed and has **zero** representation in `context/foundation/design-system.md`. `signin.astro:8` cites `staff-login.jsx` as its source, but a reader of the catalog alone would conclude the screen was never designed. This is a pre-existing catalog gap, not caused by this change; it is recorded here rather than fixed, because widening the catalog is not this slice's job. Worth its own change.

### 2. Quality — gaps in the canonical design itself

| Gap                                                                                                      | Impact on this slice                                                                                                                                                               |
| -------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **No demo card exists in any mockup.** The card is net-new.                                              | Blocking for "port exact values" — resolved by deriving every value from an existing canonical element on the same screen (see §4) and authoring the mockup before Phase 3 builds. |
| No sign-in **error** state (`auth-signin-*` has no error variant), though the app renders `ServerError`. | None — this slice does not touch the error path. Recorded for a future auth-design pass.                                                                                           |
| Canonical `LoginForm` includes a **"remember me"** checkbox the app omits.                               | None — pre-existing, deliberate, and already documented in `SignInForm.tsx`. Re-recorded below as a standing deviation.                                                            |

### 3. Alignment — plan vs canonical

- Every canonical surface this plan touches (`/auth/signin`, both breakpoints) has a plan phase that builds it — Phase 3. ✅
- No plan phase contradicts the canonical design; the demo card is additive and sits above the existing `<h1>`. ✅
- Phase 3's Success Criteria include the rendered vision-diff at both breakpoints. ✅
- **One unresolved item:** the demo card has no canonical mockup. Recorded as `deviation` and gated — see the Verdict.

---

## Token map

Design literal (`staff-login.jsx` / `tokens.css`) → app token (`src/styles/global.css`).

| Design          | Value                 | App token                                 | Mark  |
| --------------- | --------------------- | ----------------------------------------- | ----- |
| `tokens.ink`    | `#0f172a`             | `--flota-ink` / `text-foreground`         | exact |
| `tokens.ink2`   | `#334155`             | `--flota-ink-2`                           | exact |
| `tokens.muted`  | `#94a3b8`             | `--flota-muted` / `text-muted-foreground` | exact |
| `tokens.bg`     | `#f1f3f6`             | `--flota-bg` / `bg-background`            | exact |
| `tokens.card`   | `#ffffff`             | `--flota-card` / `bg-card`                | exact |
| `tokens.hair`   | `#e3e7ec`             | `--flota-border` / `border-border`        | exact |
| `tokens.hair2`  | `rgba(15,23,42,0.05)` | `--flota-hair-2` / `border-border/60`     | exact |
| `tokens.accent` | `#b43638`             | `--flota-accent` / `text-primary`         | exact |
| `tokens.green`  | `#1b9e5a`             | `--flota-success` / `text-success`        | exact |
| `tokens.mono`   | JetBrains Mono        | `font-mono`                               | exact |
| radius 12       | `12px`                | `--radius-md`                             | exact |

## Screen inventory

| Mockup                                                        | App surface                                               | Phase |
| ------------------------------------------------------------- | --------------------------------------------------------- | ----- |
| `design-review/auth-signin-d.png` (`ScreenStaffLoginDesktop`) | `/auth/signin` ≥ `md` — 440px modal over blurred backdrop | 3     |
| `design-review/auth-signin-m.png` (`ScreenStaffLoginMobile`)  | `/auth/signin` < `md` — ink brand band over white sheet   | 3     |

---

## §1 — Existing sign-in surface (unchanged, transcribed for the diff baseline)

These lines are **not** modified by this slice. They are recorded so the vision-diff has an exact baseline and any drift is attributable.

| Element                | Value                                                                                                 | Mark                                                                                                                                   |
| ---------------------- | ----------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| Desktop modal width    | `440px`                                                                                               | exact                                                                                                                                  |
| Desktop modal radius   | `20px`                                                                                                | exact                                                                                                                                  |
| Desktop modal padding  | `36px 40px 30px` → app `md:px-10 md:py-9`                                                             | deviation(uniform 36/40 vs design's 36/40/30 bottom; pre-existing, within 6px, absorbed by `mt-auto` footer)                           |
| Desktop scrim          | `rgba(15,23,42,0.55)`                                                                                 | exact                                                                                                                                  |
| Backdrop blur          | `blur(7px)`, `scale(1.04)`                                                                            | exact                                                                                                                                  |
| Form column gap        | `18px`                                                                                                | exact                                                                                                                                  |
| `<h1>`                 | `28px` / `700` / `-0.8px` tracking / `1.05` line-height                                               | exact (design `compact`)                                                                                                               |
| Subtitle               | `14px` / muted / `8px` top margin / `1.45` line-height                                                | exact                                                                                                                                  |
| Field group gap        | `14px`                                                                                                | exact                                                                                                                                  |
| Field label            | `11.5px` / `650` / `ink2` / `0.2px` tracking / `7px` bottom margin                                    | exact                                                                                                                                  |
| Field input row        | height `50px`, `bg` fill, `1px hair` border, radius `12px`, padding `0 14px`, gap `10px`              | exact                                                                                                                                  |
| Field icon             | `17px`, muted                                                                                         | exact                                                                                                                                  |
| Submit button          | height `52px`, radius `13px`, `ink` fill, `15px` / `650` / `-0.1px` tracking, gap `8px`, arrow `17px` | exact                                                                                                                                  |
| Secure footer          | gap `6px`, `12px`, muted, shield `14px` green                                                         | exact                                                                                                                                  |
| Help footer            | `border-top hair2`, `18px` top padding, `12.5px`                                                      | exact                                                                                                                                  |
| "Remember me" checkbox | **omitted**                                                                                           | deviation(sessions persist via Supabase cookies; an inert control would read as broken — pre-existing, documented in `SignInForm.tsx`) |

---

## §2 — Demo card (new)

Placement: inside `SignInForm`, as the **first** child of the form column, above the `<h1>` block. It therefore inherits the form's `18px` column gap and needs no margin of its own.

Rendered only when both `DEMO_EMAIL` and `DEMO_PASSWORD` are set. When absent, no wrapper element is emitted — the DOM is byte-identical to today's.

| #   | Element              | Exact value                                                                                                           | Mark                                                                                                                                                                        |
| --- | -------------------- | --------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2.1 | Card container       | radius `12px`, `1px` `--flota-border`, fill `--flota-bg`, padding `14px`                                              | deviation(new element — every value inherited from the canonical `LoginField` input row §1, which is the only bordered sub-surface on this screen)                          |
| 2.2 | Card column gap      | `10px`                                                                                                                | deviation(new — matches `LoginField`'s internal `gap: 10`)                                                                                                                  |
| 2.3 | Eyebrow              | `KONTO DEMO` · `font-mono` · `10.5px` · `600` · `0.5px` tracking · uppercase · `--flota-muted`                        | exact (transcribed from the `L.zone` "Strefa pracownika" eyebrow, `staff-login.jsx` desktop brand row)                                                                      |
| 2.4 | Body text            | `13px` · `540` · `--flota-ink-2` · `1.45` line-height                                                                 | exact (weight/color from the canonical "remember me" label; line-height from the subtitle)                                                                                  |
| 2.5 | Credential rows      | `font-mono` · `12.5px` · `600` · `--flota-ink` · `4px` row gap · user-selectable                                      | deviation(new — mono at 12.5/600 matches the help-footer size and the eyebrow weight; mono chosen so a password is unambiguous to read)                                     |
| 2.6 | Credential labels    | `11.5px` · `650` · `--flota-ink-2` · `0.2px` tracking                                                                 | exact (canonical `LoginField` label)                                                                                                                                        |
| 2.7 | Prefill button       | height `38px`, radius `10px`, `1px` `--flota-border`, fill `--flota-card`, `13px` / `650` / `--flota-ink`, full width | deviation(new — a tertiary control has no canonical precedent on this screen; height/radius scaled down from the `52px`/`13px` submit to sit clearly below it in hierarchy) |
| 2.8 | Prefill button hover | fill `--flota-bg`                                                                                                     | deviation(new)                                                                                                                                                              |
| 2.9 | Gated-action note    | `12px` · `--flota-muted` · `1.45` line-height                                                                         | exact (size/color from the canonical secure footer)                                                                                                                         |

### Verbatim copy (Polish — canonical)

| Slot                 | String                                                                                              |
| -------------------- | --------------------------------------------------------------------------------------------------- |
| 2.3 eyebrow          | `KONTO DEMO`                                                                                        |
| 2.4 body             | `To wersja demonstracyjna portfolio. Zaloguj się poniższymi danymi, aby obejrzeć panel pracownika.` |
| 2.6 label — email    | `E-mail`                                                                                            |
| 2.6 label — password | `Hasło`                                                                                             |
| 2.7 button           | `Wypełnij dane demo`                                                                                |
| 2.9 note             | `Akcje wysyłające e-maile i usuwanie kont są w trybie demo wyłączone.`                              |

Line 2.9 is deliberate: it tells the visitor up front why three controls in the roster are disabled, which turns "this app is broken" into "this was thought about". It is the same message class as the API's `Ta akcja jest wyłączona na koncie demo.` but scoped to the sign-in context, so the two strings differ on purpose and neither should be made to reuse the other.

### States

| State               | Behavior                                                                                    | Mark           |
| ------------------- | ------------------------------------------------------------------------------------------- | -------------- |
| Default             | Card visible, fields empty                                                                  | deviation(new) |
| After prefill click | Both fields populated, field errors cleared, focus stays on the button                      | deviation(new) |
| Env unset           | Card absent, no wrapper, no layout shift                                                    | deviation(new) |
| Mobile < `md`       | Card renders identically; the sheet is already `px-6`, so the card spans full content width | deviation(new) |

---

## Verdict

**Design Alignment Audit: BLOCKED (Phase 3 only) — 1 surface, 2 breakpoints, 2 repo designs missing, 14 deviations recorded.**

Phases 1, 2 and 4 are unblocked and touch no UI; they can be implemented immediately.

**Phase 3 is gated on one precondition:** the demo card must be authored into `staff-login.jsx` in the Claude Design project and exported to `design-review/auth-signin-{d,m}.png`, so the rendered vision-diff at 3.6 has something to diff against. Every value it needs is already fixed in §2 above — the authoring is transcription, not design invention, and the project is writable (`canEdit: true`).

Until that export exists, building Phase 3 would mean tuning by eye, which is the exact failure this gate exists to prevent.

**Recommended follow-up (separate change):** add the auth surfaces to the `design-system.md` screen catalog and pull the 22 `design-review/auth-*.png` files into `context/foundation/design/screenshots/`. The largest designed surface in the project is currently invisible to anyone reading the catalog.
