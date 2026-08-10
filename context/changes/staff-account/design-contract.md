# Design Contract — S-11 staff-account (Profil)

Source of truth: **`staff-profile.jsx`** (`ScreenStaffProfileMobile` / `ScreenStaffProfileDesktop`),
live in Claude Design `Rental car company` (`352d78a6-84fd-49a2-8b38-2fe289691fc3`), pulled via
DesignSync. Values below are transcribed **exactly** from that code-backed source (the higher-fidelity
reference per `context/foundation/lessons.md` → "Port the design spec … at exact fidelity"). Every line
is marked `exact` or `deviation(reason)`.

---

## Design Alignment Audit

### Freshness audit (repo vs canonical)

| Artifact                                                    | Status        | Note                                                                                                                                                  |
| ----------------------------------------------------------- | ------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| `staff-profile.jsx` (design source)                         | **current**   | Live, pulled this session; the exact-values source below.                                                                                             |
| `staff-profile` screenshot in repo                          | **missing**   | New mockup — not in the `design-system.md` catalog (rows 01–29). No PNG in-repo. → the one outstanding input for the downstream rendered vision-diff. |
| `StaffShell` shell design (rows 09/20, `staff-desktop.jsx`) | **current**   | We only **append** to it (chip→link, mobile Profil tab); no shell restyle.                                                                            |
| Change-password sub-page                                    | **no mockup** | Net-new surface; follows the shipped `reset-password.astro` + auth-atom idiom — see deviation D6.                                                     |

### New-design quality audit (gaps in the provided mockup)

- The mockup shows only the **populated default** state (no empty/error). Our only error surface is the
  password flow, handled by the auth atoms (`ServerError` / field errors) — not a gap for the view page.
- Mobile + desktop are both provided for the profile view. No tablet-specific frame; `StaffShell`'s
  `md`/`lg` responsive rules cover it.
- The mobile mockup renders `TabBar … active="team"` — a **mockup artifact** (it reuses the return
  tab-set). Our mobile **Profil** tab is the active one instead (D5).
- The change-password screen has **no mockup** (D6).

### Alignment checklist (plan vs canonical)

| Canonical surface                               | Plan phase                   | Aligned?                                                                |
| ----------------------------------------------- | ---------------------------- | ----------------------------------------------------------------------- |
| Profile view — mobile + desktop                 | Phase 2                      | ✓ (trims = D1–D4)                                                       |
| Profil reachability (chip→link, mobile tab)     | Phase 1                      | ✓ (D5 — added for reachability; the design reaches Profil via the chip) |
| Change-password sub-page + form                 | Phase 3                      | ✓ (D6 — no mockup; reuse auth idiom)                                    |
| UI phases carry a vision-diff success criterion | Phase 2 (2.7), Phase 3 (3.9) | ✓                                                                       |

### Verdict

**PASS (paper audit)** — 3 surfaces aligned; 0 repo designs superseded; **6 deviations recorded**
(D1–D6). One outstanding input for `/10x-implement`: drop the canonical **staff-profile mockup PNG(s)**
(mobile + desktop) into `context/changes/staff-account/design-review/` so the rendered vision-diff has a
baseline. The exact-values contract below is transcribed from the code-backed source, so planning is not
blocked on the PNG.

---

## Token map (design `tokens.*` → app token)

| Design token                      | Hex / value                       | App token (utility)                                                         |
| --------------------------------- | --------------------------------- | --------------------------------------------------------------------------- |
| `tokens.bg`                       | `#F1F3F6`                         | `--background` (`bg-background`)                                            |
| `tokens.card`                     | `#FFFFFF`                         | `--card` (`bg-card`)                                                        |
| `tokens.ink`                      | `#0F172A`                         | `--foreground` (`text-foreground`)                                          |
| `tokens.ink2`                     | `#334155`                         | `--flota-ink-2` (`text-[var(--flota-ink-2)]`) — SpRow icon stroke           |
| `tokens.muted`                    | `#94A3B8`                         | `--muted-foreground` (`text-muted-foreground`)                              |
| `tokens.hair2`                    | `rgba(15,23,42,0.05)`             | `--flota-hair-2` (`border-[var(--flota-hair-2)]`) — internal row separators |
| `tokens.accent` (avatar bg)       | `#B43638`                         | **`--primary`** (`bg-primary`) — NOT our `--accent` (soft tint)             |
| `tokens.accentInk`                | `#FFFFFF`                         | `--primary-foreground`                                                      |
| `tokens.red` (danger)             | `#B43638`                         | `--destructive` (`text-destructive`)                                        |
| `tokens.redSoft` (danger icon bg) | `#FBE4E1`                         | `--flota-danger-soft` (`bg-[var(--flota-danger-soft)]`)                     |
| `tokens.greySoft` (role badge bg) | `#EEF1F5`                         | `--flota-neutral-soft` (`bg-secondary` / `bg-[var(--flota-neutral-soft)]`)  |
| `tokens.grey` (role badge text)   | `#64748B`                         | `--flota-neutral` (`text-[var(--flota-neutral)]`)                           |
| `tokens.shadow1`                  | `0 1px 2px …, 0 2px 6px …`        | `--shadow-card` (`shadow-card`)                                             |
| `tokens.font`                     | Inter                             | `font-sans`                                                                 |
| avatar shadow                     | `0 4px 14px rgba(180,54,56,0.30)` | arbitrary: `shadow-[0_4px_14px_rgba(180,54,56,0.30)]`                       |

## Screen inventory

| Mockup component            | App surface                                   | Device         |
| --------------------------- | --------------------------------------------- | -------------- |
| `ScreenStaffProfileMobile`  | `/dashboard/account` (below `md`)             | 390-ish mobile |
| `ScreenStaffProfileDesktop` | `/dashboard/account` (`md`+, in `StaffShell`) | desktop        |
| `SpIdentity`                | identity block                                | both           |
| `SpCard` / `SpRow`          | Kontakt & Konto cards                         | both           |
| (no mockup)                 | `/dashboard/account/password`                 | both — D6      |

---

## Deviations (recorded — the vision-diff must NOT re-flag these)

- **D1 `deviation(no-data)`** — **Telefon** row removed from the Kontakt card. `profiles` has no `phone`.
- **D2 `deviation(non-goal)`** — **Powiadomienia** row removed from the Konto card. No notification system (PRD non-goal).
- **D3 `deviation(no-data)`** — **Praca / Oddział** card removed entirely, and the `SpIdentity` branch text ("Oddział Mokotów") removed. No branch field in the model.
- **D4 `deviation(no-data)`** — the shell chip's `· Warszawa` literal (`StaffShell.astro:132`) is left as-is (not introduced anywhere new; not driven by data).
- **D5 `deviation(added: reachability)`** — Phase 1 adds a chip→link (desktop) and a **Profil** tab (mobile). Not drawn in `staff-profile.jsx`, but the design reaches Profil via the account chip; mobile has no such affordance today.
- **D6 `deviation(no-mockup)`** — `/dashboard/account/password` has no mockup; it follows the shipped `reset-password.astro` layout + auth atoms (`FormField` / `SubmitButton` / `ServerError` / `PasswordToggle`).

---

## Surface 1 — Profile view, DESKTOP (`ScreenStaffProfileDesktop`)

**Shell** — `StaffShell active="me"`, header `title="Profil"` `subtitle="Twoje konto pracownika"`
(maps the mockup's `StaffTopbar title="Profil" sub="Twoje konto pracownika"`). `exact`.

> `deviation(scope)`: the mockup's `StaffTopbar` also has a search box, calendar button, and Quick-Add
> button — those are **S-13 / S-12**, omitted here (our `StaffShell` header is title+subtitle only).

**Content frame** — `padding: 32px`, `max-width: 980px`. `exact` → `p-8 max-w-[980px]`.

**Identity card (big)** — `bg-card`, `rounded-[18px]`, `shadow-card`, `margin-bottom: 20px`. `exact`.
`SpIdentity big`: `display:flex; align-items:center; gap:16px; padding:22px`. `exact`.

- Avatar: `72×72`, `rounded-full`, `bg-primary`, `text-primary-foreground`, `font-size:24 / weight:600 / letter-spacing:0.5`, `shadow-[0_4px_14px_rgba(180,54,56,0.30)]`, initials (e.g. "PB"). `exact` (crimson hero avatar — intentionally differs from the shell chip's navy avatar).
- Name: `font-size:22 / weight:700 / letter-spacing:-0.4`, `text-foreground`. `exact`. Value = `full_name ?? staffIdentity(email).displayName`.
- Badge row: `gap:7 / margin-top:5 / flex-wrap`. `exact`.
  - Role badge: `inline-flex / align-center / gap:4`, `height:20`, `padding:0 8px`, `rounded-[6px]`, `bg-[var(--flota-neutral-soft)]`, `text-[var(--flota-neutral)]`, `font-size:10 / weight:700 / uppercase`, leading user icon `10px`. Text = `roleLabel(role)` → **Pracownik** / **Administrator**. `exact`.
  - Branch text after the badge → **removed** (D3).

**Two-column grid** — `grid-template-columns: 1fr 1fr; gap: 20px`. `exact` → `grid grid-cols-2 gap-5`.

- Left column: **Kontakt** card only (the design also stacked a **Praca** card here — removed, D3).
- Right column: **Konto** card.
  > With Praca removed, the left column holds a single card; the 2-col grid is retained (Kontakt | Konto). `deviation(trim, D3)`.

**SpCard** — title: `font-size:11.5 / weight:700 / letter-spacing:0.4 / uppercase`, `text-muted-foreground`,
`margin: 0 4px 8px`. Body: `bg-card`, `rounded-lg` (16px), `shadow-card`, `overflow-hidden`; rows after
the first get `border-top: 1px var(--flota-hair-2)`. `exact`.

**SpRow** — `flex / align-center / gap:13`, `padding:14px 16px`. `exact`.

- Leading icon tile: `36×36`, `rounded-[10px]`, `bg-background` (or `bg-[var(--flota-danger-soft)]` when danger), centered, icon `16px` stroke `text-[var(--flota-ink-2)]` (or `text-destructive` when danger). `exact`.
- Label: `font-size:13.5 / weight:650 / letter-spacing:-0.15`, `text-foreground` (or `text-destructive` when danger). `exact`.
- Value (optional): `font-size:12`, `text-muted-foreground`, `margin-top:2`, truncate. `exact`.
- Trailing chevron-right `15px` `text-muted-foreground` when `action`. `exact`.

**Kontakt card rows:**

- **E-mail służbowy** — icon `message`, value = `user.email`. `exact`.
- ~~Telefon~~ — removed (D1).

**Konto card rows:**

- **Zmień hasło** — icon `key`, `action` (chevron). Rendered as `<a href="/dashboard/account/password">`. `exact`.
- ~~Powiadomienia~~ — removed (D2).
- **Wyloguj się** — icon = logout glyph, `danger` (crimson icon tile + label), `action`. Rendered as a native `<form method="POST" action="/api/auth/signout" data-signout>` submit. `exact` (mockup uses a back/arrow glyph; we use the shell's logout glyph — `deviation(icon)` minor).

---

## Surface 2 — Profile view, MOBILE (`ScreenStaffProfileMobile`)

**Page** — `bg-background`, flex column, `font-sans`.
**Header** — `padding: 54px 18px 12px`, centered; title **Profil** `font-size:17 / weight:650 /
letter-spacing:-0.2`, `text-foreground`. `exact`. (Rendered in-content — `StaffShell` has no mobile title bar.)
**Body** — `flex-col`, `gap:18`, `padding: 6px 18px 110px`, scrollable. `exact`.

- Identity card: `bg-card`, `rounded-lg` (16px), `shadow-card`, containing `SpIdentity` (non-big):
  avatar `60×60` `font-size:20`, padding `18`, name `font-size:18 / weight:700`. `exact`.
- **Kontakt** card: E-mail służbowy only (Telefon removed, D1). `exact`.
- ~~**Praca** card~~ — removed (D3).
- **Konto** card: Zmień hasło, Wyloguj się (Powiadomienia removed, D2). `exact`.
- Bottom padding `110px` clears the floating tab bar. `exact`.

**Mobile tab bar** — the existing `StaffShell` floating bar (`:177-208`) with the appended **Profil** tab
active (D5). The mockup's `active="team"` is a mockup artifact — ignore.

---

## Surface 3 — Change password (`/dashboard/account/password`) — D6, no mockup

Follows the shipped `reset-password.astro` idiom inside `StaffShell active="me"`:

- Header `title="Zmień hasło"` `subtitle="Ustaw nowe hasło do konta"`.
- `ChangePasswordForm` island: three `FormField`s stacked — **Obecne hasło** (`current-password`),
  **Nowe hasło** (`new-password`), **Powtórz nowe hasło** (`new-password`) — each with the Lock icon and a
  `PasswordToggle` end-control; `ServerError` banner above; `SubmitButton` (dark-ink, full width, h-52) with
  label **Zmień hasło** and `pendingText="Zapisywanie…"`.
- `?done=1` success panel: **Hasło zaktualizowane** + a **Wróć do profilu** link to `/dashboard/account`.
- Reuse the atoms' existing spacing/typography verbatim (`deviation(no-mockup)`; the auth card idiom is the reference).

---

## Verbatim Polish copy (canonical)

`Profil` · `Twoje konto pracownika` · `Kontakt` · `E-mail służbowy` · `Konto` · `Zmień hasło` ·
`Wyloguj się` · `Pracownik` · `Administrator` · (sub-page) `Ustaw nowe hasło do konta` · `Obecne hasło` ·
`Nowe hasło` · `Powtórz nowe hasło` · `Hasło zaktualizowane` · `Wróć do profilu` ·
(errors) `Nieprawidłowe obecne hasło` · `Hasła nie są takie same` · `Hasło musi mieć co najmniej 6 znaków`.
