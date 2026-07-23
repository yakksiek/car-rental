# Design Contract — S-08 Employee Account Management

Exact-value design contract for the **Employees admin surface** (`/dashboard/staff`) and the
app's first **self-service password / invite-accept flow**. Built from the **canonical
screenshot set** the user supplied directly into
`context/changes/employee-account-management/design-review/` (2026-07-23). This is a **full
rewrite** — it supersedes the earlier "source inaccessible / DesignSync-blocked" draft. Every
canonical surface now has a finished screenshot; nothing below is invented-because-undrawn.

Per the repo design lesson: values are ported **exact** (px / rem / token / grid), never ranges,
never copied mockup code. Every spec line is marked `exact` (transcribed from a screenshot, or
ported from a shipped idiom that matches it 1:1) or `deviation(reason)`. Two blanket rules apply
and are **not** re-flagged per line:

- **(a) Polish is canonical.** Where a screenshot renders Polish (desktop roster, remove modals,
  empty / no-results / error), the string ships verbatim. Where it renders **English** (add
  modal, mobile chips + "moments ago", all reset screens R1–R10), §5 gives the **Polish to
  ship**, each marked `needs-copy-confirm`.
- **(b) Shell reuse.** The prototype's left sidebar / bottom tab-bar predate the shipped
  `StaffShell`; the shipped shell is authoritative. The slice adds **only** an admin-only
  `Zespół` nav item. `deviation(shell already implemented)` (§3.22).

Canonical screenshots (all in `design-review/`):

| Group                        | Files                                                                                                                                                                |
| ---------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Desktop roster + states      | `employees-desktop-roster.jpg` (canonical), `employees-empty.jpg` (E), `employees-no-results.jpg` (F), `employees-loading.jpg` (G), `employees-error-banner.jpg` (H) |
| Desktop modals               | `employees-add-modal.jpg` (A), `employees-add-duplicate-error.jpg` (A2), `employees-remove-confirm.jpg` (B), `employees-remove-last-admin.jpg` (C)                   |
| Mobile roster                | `employees-mobile-roster.jpg`                                                                                                                                        |
| Reset / activation (desktop) | `reset-r1-forgot-desktop.jpg` … `reset-r6-invite-accept-desktop.jpg`                                                                                                 |
| Reset / activation (mobile)  | `reset-r7-r10-mobile.jpg` (composite: R7 forgot / R8 check-email / R9 set-password / R10 invite-accept)                                                              |

---

## 0. Design Alignment Audit

### 0.1 Freshness table

| Surface                                                                     | Classification                  | Screenshot                                                                    | Notes                                                                                                                                                                                                                                                                                                     |
| --------------------------------------------------------------------------- | ------------------------------- | ----------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Desktop roster (title/eyebrow/search/add)                                   | `current`                       | `employees-desktop-roster.jpg`                                                | Canonical. Title **`Pracownicy`**, eyebrow **`5 OSÓB · 1 ADMINISTRATOR`**.                                                                                                                                                                                                                                |
| Desktop **filter tabs + avatar stack**                                      | `current`                       | `employees-desktop-roster.jpg`                                                | Segmented filter (Wszyscy/Aktywny/Zaproszony/Administrator) + right avatar stack. **Replaces** the old screen-19 stat cards.                                                                                                                                                                              |
| Desktop table row + role/status badges + last-active + row actions          | `current`                       | `employees-desktop-roster.jpg`, `employees-error-banner.jpg`                  |                                                                                                                                                                                                                                                                                                           |
| Add-employee modal (+ duplicate error)                                      | `current`                       | `employees-add-modal.jpg`, `employees-add-duplicate-error.jpg`                | Name + email only, **no role selector**.                                                                                                                                                                                                                                                                  |
| Remove typed-confirm modal                                                  | `current`                       | `employees-remove-confirm.jpg`                                                |                                                                                                                                                                                                                                                                                                           |
| Last-admin refusal                                                          | `current`                       | `employees-remove-last-admin.jpg`                                             |                                                                                                                                                                                                                                                                                                           |
| Empty roster / no-results / loading skeleton / mutation error banner        | `current`                       | `employees-empty.jpg`, `-no-results.jpg`, `-loading.jpg`, `-error-banner.jpg` | All four states now drawn.                                                                                                                                                                                                                                                                                |
| Mobile roster (header/FAB/search/chips/cards/status/actions/footer/tab bar) | `current`                       | `employees-mobile-roster.jpg`                                                 | Title **`Zespół`**, eyebrow **`4 STAFF`**.                                                                                                                                                                                                                                                                |
| Reset flow R1–R6 (desktop) + R7–R10 (mobile) incl. invite-accept variant    | `current`                       | `reset-r1…r6-*.jpg`, `reset-r7-r10-mobile.jpg`                                | Whole Phase-3 surface now drawn.                                                                                                                                                                                                                                                                          |
| Prototype **nav chrome** (sidebar + bottom tab-bar)                         | `deviation(superseded)`         | (both roster shots)                                                           | Prototype sidebar (Dyspozytornia / Kalendarz / Flota / Moje rezerwacje / Zespół) and mobile tab-bar (calendar / truck / **Staff**) are the pre-shell prototype. Shipped `StaffShell` nav (Pulpit · Wnioski · Wydania · Zwroty · Kalendarz · Flota) is authoritative; slice adds only admin-only `Zespół`. |
| Prototype **mobile header truck-outline graphic** (reset R7–R10)            | `deviation(reuse shipped band)` | `reset-r7-r10-mobile.jpg`                                                     | The dark header band + truck line-art already exists in shipped `signin.astro:47-97`. Reuse it.                                                                                                                                                                                                           |

**Verdict:** every surface the slice builds is **current** and has a canonical screenshot. Only
the prototype nav chrome and the mobile header graphic are superseded — both by already-shipped
code (recorded deviations). No blocker; no missing canonical screen.

### 0.2 Alignment checklist (surface ↔ plan phase)

| Canonical surface                                                                                                         | Plan phase / change                        | Success criterion                          |
| ------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------ | ------------------------------------------ |
| Admin-only `Zespół` nav item                                                                                              | **Phase 4** · 4.1 (`StaffShell`/`NavIcon`) | 4.4 (shown for admin, absent for employee) |
| `/dashboard/staff` shell + SSR roster + counts                                                                            | **Phase 4** · 4.2 (`staff.astro`)          | 4.4                                        |
| Desktop roster: filter tabs, avatar stack, table, badges, last-active, row actions                                        | **Phase 4** · 4.3 (`StaffList`)            | 4.5, **4.7 vision-diff**                   |
| Add modal (+ duplicate) · remove typed-confirm · last-admin · empty · no-results · loading · error banner                 | **Phase 4** · 4.3                          | 4.5, 4.6                                   |
| Mobile roster (chips, cards, FAB, status line, tab bar, footer)                                                           | **Phase 4** · 4.3                          | 4.5, **4.7 vision-diff**                   |
| PL relative-time + status labels                                                                                          | **Phase 4** · 4.4 (formatter)              | 4.7                                        |
| Reset flow: forgot (R1/R7), check-email (R2/R8), set-password (R3/R9), success (R4), expired (R5), invite-accept (R6/R10) | **Phase 3** · 3.2–3.4 (pages/routes)       | Phase-3 manual 3.4–3.6                     |

Every canonical surface maps to a plan change; every plan-3/4 UI change maps to a canonical
surface. **Loop-back: none required** — this contract is the exact-value spec Phases 3 & 4 build
to and the vision-diff checks against.

---

## 1. Token map (screenshot hex → app token)

From `src/styles/global.css`. Reuse the same utility spellings `FleetList` uses so the surface
stays token-driven (raw hex only for the two `var(--flota-*-soft)` utilities FleetList already
uses). All rows `exact` — direct hex→token matches against the live theme.

| Screenshot role                                                                                               | Hex                                           | App token / var                                                     | Tailwind utility                                                                                    |
| ------------------------------------------------------------------------------------------------------------- | --------------------------------------------- | ------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| Crimson — ADMINISTRATOR text, admin avatar, avatar-stack PB, danger, `×` glyph, Send-invite btn, danger icons | `#B43638`                                     | `--primary` = `--flota-accent` = `--destructive` = `--flota-danger` | `text-primary` / `bg-primary` / `text-destructive`                                                  |
| Crimson pressed                                                                                               | `#8E2628`                                     | `--flota-accent-dark` / `--accent-foreground`                       | —                                                                                                   |
| Crimson soft — ADMINISTRATOR badge bg, danger-soft icon tile, duplicate-email field tint                      | `#FBE4E1`                                     | `--flota-accent-soft` = `--flota-danger-soft` = `--accent`          | `bg-[var(--flota-danger-soft)]`                                                                     |
| Success green — AKTYWNY text + dot, R4 shield tile                                                            | `#1B9E5A`                                     | `--success` = `--flota-success`                                     | `text-success` / `bg-success`                                                                       |
| Success soft — AKTYWNY badge bg, R4 shield tile bg                                                            | `#E3F5EC`                                     | `--flota-success-soft`                                              | `bg-[var(--flota-success-soft)]`                                                                    |
| Warning amber — ZAPROSZONY text + dot, last-admin shield tile                                                 | `#B6790E`                                     | `--warning` = `--flota-warning`                                     | `text-warning` / `bg-warning`                                                                       |
| Warning soft — ZAPROSZONY badge bg, last-admin shield tile bg                                                 | `#FBF1DA`                                     | `--flota-warning-soft`                                              | `bg-[var(--flota-warning-soft)]`                                                                    |
| Neutral soft — PRACOWNIK badge bg, inactive filter-count chip, +N avatar chip                                 | `#EEF1F5`                                     | `--flota-neutral-soft` = `--muted` = `--secondary`                  | `bg-muted`                                                                                          |
| Muted ink — email, eyebrow, col heads, PRACOWNIK text, relative time, modal subtitles, input labels           | `#94A3B8`                                     | `--muted-foreground` = `--flota-muted`                              | `text-muted-foreground`                                                                             |
| Navy ink — names, titles, employee avatar bg, dark buttons, active filter pill, tab-bar bg                    | `#0F172A`                                     | `--foreground` = `--flota-ink`                                      | `text-foreground` / `bg-foreground`                                                                 |
| App background — page bg, input fills in modals/auth cards                                                    | `#F1F3F6`                                     | `--background` = `--flota-bg`                                       | `bg-background`                                                                                     |
| Card white                                                                                                    | `#FFFFFF`                                     | `--card` = `--flota-card`                                           | `bg-card`                                                                                           |
| Hairline border — card outline, col-head rule, chip borders                                                   | `#E3E7EC`                                     | `--border` = `--flota-border`                                       | `border-border`                                                                                     |
| Row divider (between table rows)                                                                              | `rgba(15,23,42,0.05)`                         | `--flota-hair-2`                                                    | `border-[var(--flota-hair-2)]`                                                                      |
| Card / tab-card / modal radius                                                                                | —                                             | `--radius-2xl` **28px**                                             | `rounded-2xl`                                                                                       |
| Input / chip radius                                                                                           | —                                             | `--radius-xl` **20px** / pill                                       | `rounded-xl` / `rounded-full`                                                                       |
| Auth-card radius (reset flow)                                                                                 | —                                             | `20px` literal (matches `signin.astro:101`)                         | `rounded-[20px]`                                                                                    |
| Card shadow                                                                                                   | —                                             | `--shadow-card` = `--flota-shadow-1`                                | `shadow-card`                                                                                       |
| Modal / auth-card overlay shadow                                                                              | —                                             | `--shadow-overlay` = `--flota-shadow-3`                             | `shadow-overlay`                                                                                    |
| Overlay scrim (modal + reset backdrop)                                                                        | `rgba(20,18,22,0.55)` / `rgba(15,23,42,0.55)` | —                                                                   | `bg-[rgba(20,18,22,0.55)]` (modals) / `bg-[rgba(15,23,42,0.55)]` (auth backdrop, `signin.astro:44`) |

---

## 2. Screen inventory (screenshot → app surface)

| Screenshot                                             | App surface                                                                                                             | File                                                                    |
| ------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| `employees-desktop-roster.jpg`                         | Page + `StaffList` **desktop branch** (`hidden md:block`): header, filter tabs, avatar stack, table, footer note        | `src/pages/dashboard/staff.astro`, `src/components/staff/StaffList.tsx` |
| `employees-mobile-roster.jpg`                          | Same page + `StaffList` **mobile branch** (`md:hidden`): header, FAB, search, filter chips, cards, tab bar, footer note | same                                                                    |
| `employees-add-modal.jpg` / `-add-duplicate-error.jpg` | Add-employee modal                                                                                                      | `StaffList.tsx`                                                         |
| `employees-remove-confirm.jpg`                         | Remove / typed-confirm modal                                                                                            | `StaffList.tsx`                                                         |
| `employees-remove-last-admin.jpg`                      | Last-admin refusal modal                                                                                                | `StaffList.tsx`                                                         |
| `employees-empty.jpg` / `-no-results.jpg`              | Empty roster / no-results states                                                                                        | `StaffList.tsx`                                                         |
| `employees-loading.jpg`                                | Loading skeleton (SSR'd list → optional; see §3.11)                                                                     | `StaffList.tsx`                                                         |
| `employees-error-banner.jpg`                           | Mutation error banner                                                                                                   | `StaffList.tsx`                                                         |
| `reset-r1-forgot-desktop.jpg` / R7                     | Forgot-password page                                                                                                    | `src/pages/auth/forgot-password.astro` + form island                    |
| `reset-r2-check-email-desktop.jpg` / R8                | Check-email neutral confirmation                                                                                        | `forgot-password.astro` (submitted state) or dedicated view             |
| `reset-r3-set-password-desktop.jpg` / R9               | Set-new-password page                                                                                                   | `src/pages/auth/reset-password.astro` + form island                     |
| `reset-r4-success-desktop.jpg`                         | Password-updated success                                                                                                | `reset-password.astro` (success view)                                   |
| `reset-r5-expired-desktop.jpg`                         | Expired / invalid link                                                                                                  | `reset-password.astro` / `forgot-password.astro?error=…`                |
| `reset-r6-invite-accept-desktop.jpg` / R10             | Invite-accept ("Set your password") — **distinct mode** of set-password                                                 | `reset-password.astro?mode=invite` (same island, invite props)          |
| (nav — deviation)                                      | Admin-only `Zespół` nav item                                                                                            | `src/components/shell/StaffShell.astro`, `NavIcon.astro`                |

---

## 3. Per-surface layout (exact value per element)

Shared idiom (mirror FleetList): `const cardClass = "rounded-2xl border border-border bg-card shadow-card"`
(`FleetList.tsx:56`). Page body wrapper (plan 4.2): `<main class="mx-auto w-full max-w-5xl px-4 py-6">`.
Desktop `StaffShell` title bar is **suppressed** (`showHeader={false}`) so the island renders the
single title + search + add row without a duplicate heading — `deviation(shell header suppressed;
mirrors full-page forms — StaffShell.astro:28,138)`.

### 3.1 Desktop page header (`employees-desktop-roster.jpg`)

| Element                             | Spec                                                                                                                                                                                                                                                                                                                                                                                                               | Mark                                                |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------- |
| Header row container                | `flex items-start justify-between gap-4` (mirror FleetList:271)                                                                                                                                                                                                                                                                                                                                                    | exact                                               |
| **Eyebrow**                         | `text-muted-foreground text-xs font-semibold tracking-wide uppercase` — text `5 OSÓB · 1 ADMINISTRATOR` (`{total} OSÓB · {adminCount} ADMINISTRATOR`, PL-pluralized)                                                                                                                                                                                                                                               | exact (screenshot)                                  |
| **Title (H1)**                      | `text-foreground mt-1 text-[28px] leading-none font-bold tracking-tight md:text-[32px]` — text `Pracownicy`                                                                                                                                                                                                                                                                                                        | exact (desktop H1 = **`Pracownicy`**, not `Zespół`) |
| **Search box** (right of title)     | wrapper `relative w-64` (256px); `Search` icon `text-muted-foreground pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2`; input `border-border bg-card text-foreground placeholder:text-muted-foreground focus-visible:ring-ring h-11 w-full rounded-xl border pr-4 pl-10 text-sm outline-none focus-visible:ring-2`; placeholder `Imię lub e-mail…`; filters roster client-side by name+email | exact (mirror FleetList:301-312)                    |
| **"Dodaj pracownika" button** (md+) | `Button className="bg-foreground text-background hover:bg-foreground/90 hidden h-11 px-4 md:inline-flex"`, `<Plus className="size-4" />` + label `Dodaj pracownika`                                                                                                                                                                                                                                                | exact (dark pill, leading `+`)                      |

Header order on the roster: eyebrow+title at left; on the **same top bar** the search box and dark
add button sit at the right (screenshot places search left-of the add button). The filter tabs
(§3.2) are a **separate card below** the header, not part of it.

### 3.2 Desktop filter tabs + avatar stack — REPLACES stat cards (`employees-desktop-roster.jpg`)

`deviation(new element; the old screen-19 stat cards are gone — model as a segmented filter with
counts + a right-aligned avatar stack)`. This is the interactive roster filter (mirrors how
FleetList used category pills, but styled as a segmented control in its own card).

| Element                             | Spec                                                                                                                                                                                                                                                                                                                                                                                                 | Mark                                                                                     |
| ----------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| Container card                      | `cn(cardClass, "mt-5 flex items-center gap-1 px-3 py-2.5")`                                                                                                                                                                                                                                                                                                                                          | exact (white rounded-2xl bar, shadow)                                                    |
| Tab button                          | `flex items-center gap-2 rounded-full px-4 py-2 text-sm font-[540] tracking-tight transition-colors`; **active** `bg-foreground text-background`; **inactive** `text-foreground hover:bg-background`                                                                                                                                                                                                 | exact (active = dark pill)                                                               |
| Tab count badge                     | `flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-xs font-bold`; **on active tab** `bg-white/20 text-background`; **on inactive tab** `bg-muted text-muted-foreground`                                                                                                                                                                                                          | exact (grey count chip; white-translucent on active)                                     |
| Tabs (L→R)                          | `Wszyscy {total}` · `Aktywny {active}` · `Zaproszony {invited}` · `Administrator {admins}` — default active = `Wszyscy`                                                                                                                                                                                                                                                                              | exact (screenshot: `Wszyscy 5 / Aktywny 4 / Zaproszony 1 / Administrator 1`)             |
| Filter behavior                     | selecting a tab filters the table+cards to that predicate (`all` / status active / status invited / role admin)                                                                                                                                                                                                                                                                                      | exact                                                                                    |
| **Avatar stack** (right, `ml-auto`) | `ml-auto flex items-center pr-1`; each avatar `flex size-9 items-center justify-center rounded-full text-[13px] font-bold ring-2 ring-card -ml-2 first:ml-0` (admin crimson `bg-primary text-primary-foreground`, employee navy `bg-foreground text-background`); overflow chip `+{n}` `size-9 rounded-full bg-muted text-muted-foreground text-xs font-bold -ml-2 flex items-center justify-center` | exact (screenshot: `PB`(crimson) `AN` `ML` `TW` navy `+1` grey, overlapping, white ring) |

### 3.3 Desktop table (`hidden md:block`)

Wrapper `cn(cardClass, "mt-5 hidden overflow-hidden md:block")`. `<table class="w-full border-collapse text-left">`.
Columns auto-size (mirror FleetList); actions cell right-aligned.

| Part                       | Spec                                                                                                                                                                                                                                                                                                                         | Mark                                                                                             |
| -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| Head row                   | `text-muted-foreground border-border border-b text-[11px] font-bold tracking-wide uppercase`; `th` `px-5 py-3 font-bold` (mirror FleetList:367-369)                                                                                                                                                                          | exact                                                                                            |
| Columns (L→R)              | `Imię i nazwisko` · `Rola` · `Status` · `Ostatnia aktywność` · actions (`aria-label="Akcje"`, no visible head)                                                                                                                                                                                                               | exact (screenshot heads: IMIĘ I NAZWISKO / ROLA / STATUS / OSTATNIA AKTYWNOŚĆ)                   |
| Body row                   | `border-b border-[var(--flota-hair-2)] last:border-0`; `td` `px-5 py-3.5`                                                                                                                                                                                                                                                    | exact                                                                                            |
| **Avatar**                 | `flex size-9 shrink-0 items-center justify-center rounded-full text-[13px] font-bold`; **admin** `bg-primary text-primary-foreground` (crimson); **employee** `bg-foreground text-background` (navy); initials = first letters of first two `full_name` words, uppercased                                                    | exact (PB crimson; AN/ML/TW/KM navy)                                                             |
| Name + email cell          | `flex items-center gap-3`; name block `min-w-0`; name row `flex items-center gap-1.5` → name `text-foreground truncate text-sm font-[650] tracking-tight` + **`· Ty` suffix** for current user `text-muted-foreground text-sm font-normal`; email `text-muted-foreground mt-0.5 truncate text-xs` (mirror FleetList:378-384) | exact (row 1: `Piotr Bednarz · Ty`)                                                              |
| **Role badge**             | see §3.4                                                                                                                                                                                                                                                                                                                     | exact                                                                                            |
| **Status badge**           | see §3.4 (desktop = pill with dot)                                                                                                                                                                                                                                                                                           | exact                                                                                            |
| **Last-active cell**       | `text-foreground text-sm` (near-ink in the screenshot, not muted); PL relative string (§5)                                                                                                                                                                                                                                   | exact (`przed chwilą` / `12 min temu` / `2 godz. temu` / `wczoraj` / `zaproszenie · 2 dni temu`) |
| **"Resetuj hasło" button** | `Button variant="outline"` `className="h-9 gap-1.5 px-3 text-[13px] font-[650]"`; leading `<KeyRound className="size-3.5" />`; label `Resetuj hasło`. Shown+enabled on **every** row (incl. current admin's own)                                                                                                             | exact (outline white pill, **key** glyph, bold label)                                            |
| **Remove `×`** (enabled)   | `Button variant="outline" size="icon"` `className="text-destructive size-9"`; `<X className="size-4" />`; `aria-label="Usuń pracownika"`                                                                                                                                                                                     | exact (bordered square, crimson `×`)                                                             |
| **Remove `×` (self)**      | same button `disabled` when `member.userId === currentUserId` → `disabled:opacity-50 text-muted-foreground`; not removable                                                                                                                                                                                                   | exact (PB's own `×` greyed)                                                                      |
| Actions cell layout        | `flex items-center justify-end gap-2`                                                                                                                                                                                                                                                                                        | exact                                                                                            |

> **Reset icon note.** In these finals the row's "Resetuj hasło" (and the mobile card key button,
> §3.13) already render a **key** glyph, not the old chat glyph — so `KeyRound` is exact here. The
> chat/message glyph survives only on the add-modal **Send invite** button (§3.6), which is the
> one place the swap-away-from-chat deviation applies.

### 3.4 Badge color mapping (from `badge.tsx` + FleetList `StatusBadge`)

All use shadcn `<Badge>` (base: `rounded-full border border-transparent px-2 py-0.5 text-xs font-medium`,
auto `[&>svg]:size-3`). Add `gap-*` + color classes.

| Badge                                           | Utility classes on `<Badge>`                                                                                                                                 | Leading glyph                     | Label (desktop) | Mark                                              |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------- | --------------- | ------------------------------------------------- |
| **ADMIN role** (danger-soft)                    | `gap-1 bg-[var(--flota-danger-soft)] text-primary`                                                                                                           | `<KeyRound className="size-3" />` | `ADMINISTRATOR` | exact (crimson-soft bg + crimson text + key icon) |
| **EMPLOYEE role** (muted)                       | `gap-1 bg-muted text-muted-foreground` (same token pair as FleetList retired StatusBadge:104)                                                                | `<User className="size-3" />`     | `PRACOWNIK`     | exact (grey bg + grey text + person icon)         |
| **ACTIVE status** (success-soft, desktop pill)  | `gap-1.5 text-success bg-[var(--flota-success-soft)]` (= FleetList active StatusBadge:102) + leading `<span className="size-1.5 rounded-full bg-success" />` | dot                               | `AKTYWNY`       | exact                                             |
| **INVITED status** (warning-soft, desktop pill) | `gap-1.5 text-warning bg-[var(--flota-warning-soft)]` + leading `<span className="size-1.5 rounded-full bg-warning" />`                                      | dot                               | `ZAPROSZONY`    | exact                                             |

Mobile role badge uses the **same** two role badges but with the shorter mobile labels (`ADMIN` /
`EMPLOYEE` in the EN mockup → §5). Mobile status is **not** a badge — it is the inline dot+word
line in §3.13.

### 3.5 Desktop footer note (`employees-desktop-roster.jpg`)

| Element      | Spec                                                                                                                                                                                                             | Mark                                                                        |
| ------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| Container    | `mt-4 flex items-center gap-3 rounded-2xl bg-card border border-border shadow-card px-5 py-4` (white card, matches other cards)                                                                                  | exact (screenshot: white rounded card, not muted inset)                     |
| Leading icon | `<UserRound className="text-muted-foreground size-4 shrink-0" />` in a small grey tile is drawn; simplest = bare `<User className="text-muted-foreground size-5 shrink-0" />`                                    | exact (person glyph left) `deviation(icon tile simplified to a bare glyph)` |
| Copy         | first sentence bold + rest regular: **`Nie możesz usunąć siebie.`** ` Poproś innego administratora o usunięcie Twojego konta.` — `text-sm`; bold span `text-foreground font-[650]`, rest `text-muted-foreground` | exact (verbatim PL)                                                         |

### 3.6 Add-employee modal — A / A2 (`employees-add-modal.jpg`, `-add-duplicate-error.jpg`)

Reuse the `RetireDialog` overlay/panel shell (`FleetList.tsx:139-168`).

| Element                              | Spec                                                                                                                                                                                                                                                                                | Mark                                                                                          |
| ------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| Overlay                              | `fixed inset-0 z-[60] flex items-end justify-center bg-[rgba(20,18,22,0.55)] backdrop-blur-sm md:items-center` (verbatim RetireDialog:140)                                                                                                                                          | exact                                                                                         |
| Panel                                | `bg-card shadow-overlay w-full rounded-t-[28px] p-6 pb-8 md:max-w-md md:rounded-2xl` (RetireDialog:147); mobile grab-handle `bg-border mx-auto mb-4 h-1 w-10 rounded-full md:hidden`                                                                                                | exact                                                                                         |
| Close `×` (top-right)                | `absolute right-4 top-4 flex size-8 items-center justify-center rounded-full bg-muted text-muted-foreground hover:text-foreground`; `<X className="size-4" />`; `aria-label="Zamknij"`                                                                                              | exact (grey circle top-right)                                                                 |
| Title                                | `text-foreground text-xl font-bold tracking-tight` — `Dodaj pracownika`                                                                                                                                                                                                             | exact                                                                                         |
| Subtitle                             | `text-muted-foreground mt-1 text-sm leading-relaxed` — EN `We'll email an activation link. New hires set their own password.` → PL §5                                                                                                                                               | needs-copy-confirm                                                                            |
| Field label                          | `text-muted-foreground text-[11px] font-bold tracking-wide uppercase mb-1.5` (labels `IMIĘ I NAZWISKO`, `ADRES E-MAIL`)                                                                                                                                                             | exact (uppercase muted labels)                                                                |
| Fields                               | Two inputs (plain `useState`, 2 fields — RHF small-form carve-out): name (text) + email (email), each `border-border bg-background h-11 w-full rounded-xl border px-3.5 text-sm text-foreground` (input fill = `bg-background` grey, not white)                                     | exact (screenshot: light-grey filled inputs)                                                  |
| **Duplicate-email error state (A2)** | email input → `border-destructive bg-[var(--flota-danger-soft)]`; below it `mt-1.5 flex items-center gap-1.5 text-destructive text-[13px]` with `<AlertTriangle className="size-3.5" />` + message; **Send-invite button `disabled`**                                               | exact (red border + pink fill + `⚠ This email is already on the team.` + greyed submit)       |
| Actions                              | `mt-5 flex gap-2.5`; `Anuluj` = `Button variant="outline" className="h-12 flex-1"`; submit = `Button className="bg-primary text-primary-foreground h-12 flex-1"` with leading glyph + label `Wyślij zaproszenie`, pending → `animate-spin` ring + `Wysyłanie…` (SubmitButton:26-30) | exact (Cancel outline + crimson **Send invite**)                                              |
| Submit glyph                         | mockup draws a **chat/message bubble**; ship a **send/paper-plane** (`<Send className="size-4" />`) — semantically correct for "send invite"                                                                                                                                        | `deviation(mockup glyph = chat bubble → Send icon; the reset/key actions keep the key glyph)` |
| POST                                 | `POST /api/staff` → 201 created / 200 reactivated (optimistic insert or reload); 409 duplicate → email field error (A2)                                                                                                                                                             | exact (behavior)                                                                              |

### 3.7 Remove / typed-confirm modal — B (`employees-remove-confirm.jpg`)

Same overlay/panel shell as §3.6, **left-aligned** content (icon tile top-left, not centered).

| Element       | Spec                                                                                                                                                                                                                    | Mark                                                         |
| ------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| Icon tile     | `flex size-12 items-center justify-center rounded-2xl bg-[var(--flota-danger-soft)] text-destructive`; `<AlertTriangle className="size-6" />`                                                                           | exact (danger-soft rounded-square, crimson warning triangle) |
| Title         | `text-foreground mt-4 text-xl font-bold tracking-tight` — `Usunąć tego pracownika?`                                                                                                                                     | exact (verbatim PL)                                          |
| Body          | `text-muted-foreground mt-2 text-sm leading-relaxed`; name bold: **`Anna Nowak`**` — Utraci dostęp natychmiast. Zakończone protokoły pozostają w archiwum.` (name span `text-foreground font-[650]`)                    | exact (verbatim PL)                                          |
| Confirm label | `text-muted-foreground mt-4 text-[11px] font-bold tracking-wide uppercase` — `WPISZ E-MAIL, ABY POTWIERDZIĆ`                                                                                                            | exact                                                        |
| Confirm input | `mt-1.5 h-11 w-full rounded-xl border border-border bg-background px-3.5 text-sm font-mono`; placeholder = the target email (`anna.nowak@flota.pl`); confirm button stays `disabled` until typed value === target email | exact (grey filled, monospace email)                         |
| Actions       | `mt-5 flex gap-2.5`; `Anuluj` = `Button variant="outline" className="h-12 flex-1"`; `Usuń` = `Button variant="destructive" className="h-12 flex-1"`; pending spinner                                                    | exact (Cancel outline + crimson **Usuń**)                    |
| Guard errors  | server re-checks typed email (400 on mismatch); `last_admin` → route the **§3.8 last-admin modal** instead                                                                                                              | exact (behavior)                                             |
| POST          | `POST /api/staff/[id]/deactivate` `{ confirmEmail }` → 200 removes row                                                                                                                                                  | exact                                                        |

### 3.8 Last-admin refusal — C (`employees-remove-last-admin.jpg`)

Same overlay/panel shell; left-aligned icon; **single dark full-width button**.

| Element   | Spec                                                                                                                                              | Mark                                     |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------- |
| Icon tile | `flex size-12 items-center justify-center rounded-2xl bg-[var(--flota-warning-soft)] text-warning`; `<ShieldCheck className="size-6" />` (shield) | exact (warning-soft tile, amber shield)  |
| Title     | `text-foreground mt-4 text-xl font-bold tracking-tight leading-snug` — `Nie można usunąć ostatniego administratora` (wraps to 2 lines)            | exact (verbatim PL)                      |
| Body      | `text-muted-foreground mt-2 text-sm leading-relaxed` — `Musi pozostać co najmniej jeden administrator. Najpierw awansuj inną osobę.`              | exact (verbatim PL)                      |
| Action    | single `Button className="bg-foreground text-background hover:bg-foreground/90 mt-5 h-12 w-full"` — `Anuluj`                                      | exact (dark full-width, **not** crimson) |

### 3.9 Empty roster — E (`employees-empty.jpg`)

Header + filter tabs + avatar stack still render (counts reflect zero); the table card is replaced
by a centered empty-state card.

| Element   | Spec                                                                                                                                             | Mark                                      |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------- |
| Card      | `cn(cardClass, "mt-5 flex flex-col items-center justify-center px-6 py-16 text-center")` (mirror FleetList:356-360)                              | exact                                     |
| Icon tile | `flex size-16 items-center justify-center rounded-2xl bg-muted text-muted-foreground`; `<User className="size-7" />` (person)                    | exact (grey rounded-square, person glyph) |
| Title     | `text-foreground mt-4 text-xl font-bold tracking-tight` — `Brak pracowników`                                                                     | exact (verbatim PL)                       |
| Hint      | `text-muted-foreground mt-1.5 text-sm leading-relaxed max-w-xs` — `Dodaj pierwszą osobę — wyślemy jej link aktywacyjny e-mailem.`                | exact (verbatim PL)                       |
| CTA       | `Button className="bg-foreground text-background hover:bg-foreground/90 mt-5 h-11 px-4"` with `<Plus className="size-4" />` + `Dodaj pracownika` | exact (dark pill, centered)               |

### 3.10 No-results — F (`employees-no-results.jpg`)

Same centered card as §3.9, **no CTA button**.

| Element   | Spec                                                                                                                                       | Mark                 |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------ | -------------------- |
| Icon tile | grey rounded-square with `<Search className="size-7 text-muted-foreground" />`                                                             | exact (search glyph) |
| Title     | `text-foreground mt-4 text-xl font-bold tracking-tight` — `Brak wyników`                                                                   | exact (verbatim PL)  |
| Hint      | `text-muted-foreground mt-1.5 text-sm leading-relaxed` — `Żaden pracownik nie pasuje do wyszukiwania. Spróbuj innego imienia lub e-maila.` | exact (verbatim PL)  |

### 3.11 Loading skeleton — G (`employees-loading.jpg`)

Roster is **SSR-loaded** (page passes `staff` to the island), so this skeleton is **not** needed
on first paint. Spec it only if a client-side refetch is added later. `deviation(SSR list; no
first-paint skeleton — spec parked)`.

| Element      | Spec (if built)                                                                                                                                                                                                                                 | Mark                                                                                   |
| ------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| Skeleton row | table body row: avatar `size-9 rounded-full bg-muted animate-pulse` + two stacked bars (`h-3 w-40` name, `h-2.5 w-28` email, `bg-muted rounded animate-pulse`); one bar per remaining column (`h-3 w-16/20/24 bg-muted`) + trailing action bars | exact (5 shimmer rows under the real head; filter tabs + avatar stack render normally) |

### 3.12 Mutation error banner — H (`employees-error-banner.jpg`)

Inline strip **between the header and the filter-tabs card** (above the roster).

| Element      | Spec                                                                                                                                                                                                  | Mark                                                |
| ------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------- |
| Banner       | `mt-5 flex items-center justify-between gap-3 rounded-2xl border border-destructive/30 bg-[var(--flota-danger-soft)] px-5 py-3.5`                                                                     | exact (danger-soft fill, crimson hairline, rounded) |
| Message      | `flex items-center gap-2.5 text-destructive text-sm font-[540]` with leading `<AlertTriangle className="size-4 shrink-0" />` — `Nie udało się zapisać zmiany. Sprawdź połączenie i spróbuj ponownie.` | exact (verbatim PL)                                 |
| Retry button | `Button variant="outline" className="h-9 shrink-0 bg-card px-4 text-[13px] font-[650]"` — `Ponów`                                                                                                     | exact (white outline pill, right-aligned)           |

> Simple success feedback (e.g. after "Resetuj hasło") reuses the same strip in the success
> palette: `text-success ... bg-[var(--flota-success-soft)]` — see §5 #copy.

### 3.13 Mobile roster (`md:hidden`) — `employees-mobile-roster.jpg`

| Part                                  | Spec                                                                                                                                                                                                                                                                                                                                                                                                                          | Mark                                                                                                       |
| ------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| Eyebrow                               | `text-muted-foreground text-xs font-semibold tracking-wide uppercase` — EN `4 STAFF` → PL `{total} OSOBY` (§5)                                                                                                                                                                                                                                                                                                                | needs-copy-confirm                                                                                         |
| Title (H1)                            | `text-foreground mt-1 text-[28px] font-bold tracking-tight` — `Zespół`                                                                                                                                                                                                                                                                                                                                                        | exact (mobile H1 = **`Zespół`**)                                                                           |
| **"+" FAB** (top-right of header)     | `Button className="bg-foreground text-background hover:bg-foreground/90 flex size-12 shrink-0 rounded-full"`, `<Plus className="size-5" />`, `aria-label="Dodaj pracownika"` (mirror FleetList:290-297)                                                                                                                                                                                                                       | exact (dark circular `+`)                                                                                  |
| **Search** (full width, below header) | `relative mt-4`; `Search` icon left; input `h-12 w-full rounded-2xl border border-border bg-card pl-11 pr-4 text-sm shadow-card`; placeholder `Imię lub e-mail…`                                                                                                                                                                                                                                                              | exact (full-width white search, **present on mobile**)                                                     |
| **Filter chips** (below search)       | row `mt-3 flex flex-wrap gap-2`; each chip `inline-flex items-center gap-2 rounded-full border border-border bg-card px-3.5 py-2 text-sm shadow-card`: colored dot `size-1.5 rounded-full` (`bg-success`/`bg-warning`/`bg-primary`) + label `text-foreground font-[540]` + count `text-foreground font-bold`. Tapping filters the list; active chip → `bg-foreground text-background border-transparent` (dot + count invert) | exact (`● Active 3` / `● Invited 1` / `● Admin 1` — **chips, not stat cards**; EN labels → §5)             |
| Cards container                       | `mt-4 flex flex-col gap-3` (mirror FleetList:439)                                                                                                                                                                                                                                                                                                                                                                             | exact                                                                                                      |
| Card                                  | `cn(cardClass, "flex items-center gap-3.5 p-4")`                                                                                                                                                                                                                                                                                                                                                                              | exact                                                                                                      |
| **Avatar**                            | `flex size-14 shrink-0 items-center justify-center rounded-full text-[15px] font-bold`; **admin crimson** `bg-primary text-primary-foreground` / **employee navy** `bg-foreground text-background`                                                                                                                                                                                                                            | exact (PB **crimson on mobile too** — consistent with desktop; resolves the old cross-breakpoint mismatch) |
| Name + role row                       | `flex items-center gap-2 flex-wrap`; name `text-foreground text-[17px] font-bold tracking-tight`; role badge inline after name (§3.4, mobile labels)                                                                                                                                                                                                                                                                          | exact                                                                                                      |
| Email                                 | `text-muted-foreground mt-0.5 truncate text-sm`                                                                                                                                                                                                                                                                                                                                                                               | exact                                                                                                      |
| **Status line** (inline, not a pill)  | `mt-1 flex items-center gap-1.5 text-[13px]`: dot `size-1.5 rounded-full` (`bg-success`/`bg-warning`) + word `text-success`/`text-warning font-[540]` (`Aktywny`/`Zaproszony`) + `<span class="text-muted-foreground">· {relative}</span>`                                                                                                                                                                                    | exact (`● Active · moments ago`, `● Invited · zaproszenie · 2 dni temu`; EN word + `moments ago` → §5)     |
| **Row actions** (right, **stacked**)  | column `ml-auto flex flex-col gap-2`: **key (reset)** button `Button variant="outline" size="icon" className="size-11 rounded-xl text-foreground"` `<KeyRound className="size-4" />` (`aria-label="Resetuj hasło"`) **above** **remove `×`** `Button variant="outline" size="icon" className="size-11 rounded-xl text-destructive"` `<X className="size-4" />` (`aria-label="Usuń pracownika"`)                               | exact (**mobile HAS the reset action** — key over ×, both bordered rounded squares)                        |
| **Self card**                         | key button enabled; **`×` shown but `disabled`** (`disabled:opacity-50 text-muted-foreground`) when `userId === currentUserId`                                                                                                                                                                                                                                                                                                | exact (PB's `×` greyed, **not** omitted)                                                                   |
| Footer note                           | `mt-4 px-2 text-center text-sm text-muted-foreground leading-relaxed` — EN `Employees can also reset their own password from the sign-in screen.` → PL §5 (this is a **different** note from the desktop self-removal note §3.5)                                                                                                                                                                                              | needs-copy-confirm                                                                                         |
| **Bottom tab bar**                    | shipped `StaffShell` floating tab bar (`StaffShell.astro:153-186`): dark `bg-[#0A0A0F]` pill, active item = white pill `bg-white px-3.5 text-[#0A0A0F]` with label. Admin adds the `Staff`/`Zespół` item here (§3.22)                                                                                                                                                                                                         | exact (prototype's calendar/truck/**Staff** row is superseded by the shipped bar — deviation §0.1)         |

### 3.14 Reset / activation flow — shared auth-card shell

All of R1–R10 reuse the **shipped sign-in shell** (`src/pages/auth/signin.astro`), so the reset
screens are new **pages** that drop a different form/body into the same card. `exact` reuse:

| Element                | Spec (from `signin.astro`)                                                                                                                                                                                                                                           | Mark                                                                                           |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| Desktop layout         | centered card over blurred dispatch backdrop + scrim; scrim `bg-[rgba(15,23,42,0.55)]` (`:44`), backdrop `:17-43`                                                                                                                                                    | exact                                                                                          |
| Card                   | `bg-card md:shadow-overlay md:w-[440px] md:rounded-[20px] md:px-10 md:py-9` (`:100-101`)                                                                                                                                                                             | exact                                                                                          |
| Card logo header       | crimson `F` serif tile `bg-primary text-primary-foreground size-10 rounded-xl font-serif` + `Flota` `text-[17px] font-bold` + mono eyebrow `STREFA PRACOWNIKA` `text-muted-foreground font-mono text-[10.5px] font-semibold tracking-[0.5px] uppercase` (`:103-113`) | exact (screenshots show `F` + `Flota` + `STREFA PRACOWNIKA`)                                   |
| Mobile band (R7–R10)   | dark ink band `bg-[var(--flota-ink)] px-6 pt-14 pb-7 text-white` with the **truck-outline SVG** (`:47-66`) + back link + white-on-dark logo (`:85-96`)                                                                                                               | exact (`deviation(reuse shipped band; prototype's back reads "Logowanie")`)                    |
| Title                  | `text-foreground text-[28px] leading-[1.05] font-bold tracking-[-0.8px]` (matches SignInForm h1 `:66`)                                                                                                                                                               | exact                                                                                          |
| Subtitle               | `text-muted-foreground mt-2 text-sm leading-[1.45]` (SignInForm `:67`)                                                                                                                                                                                               | exact                                                                                          |
| Text input             | `FormField` idiom: `h-11`-ish, leading icon (mail/lock), grey fill `bg-background`, `rounded-xl`; password field trailing `PasswordToggle` eye                                                                                                                       | exact (screenshots: icon + grey filled inputs, eye toggle on password)                         |
| Primary submit         | `SubmitButton` dark ink `bg-foreground text-background h-[52px] w-full rounded-[13px] text-[15px] font-[650]` + trailing icon (`SubmitButton.tsx:26`); pending → `animate-spin` ring                                                                                 | exact (dark full-width button with trailing arrow/check)                                       |
| "Back to sign in" link | `text-muted-foreground text-sm inline-flex items-center gap-1.5` with leading `‹` chevron → `/auth/signin`; mobile top-band back reads `Logowanie`                                                                                                                   | exact (glyph); copy → §5                                                                       |
| Footer                 | `flex items-center justify-center gap-1.5 text-xs text-muted-foreground` + `<ShieldCheck className="text-success size-3.5" />` (SignInForm `:118-121`)                                                                                                               | exact (`🛡 Secure connection · staff only` = shipped `Połączenie szyfrowane · tylko personel`) |

### 3.15 R1 / R7 — Forgot password (`reset-r1-forgot-desktop.jpg`)

| Element  | Spec                                                                                       | Mark                                                   |
| -------- | ------------------------------------------------------------------------------------------ | ------------------------------------------------------ |
| Title    | `Reset your password` → PL §5                                                              | needs-copy-confirm                                     |
| Subtitle | `Enter your work email and we'll send a reset link.` → PL §5                               | needs-copy-confirm                                     |
| Field    | label `Work email` → PL; email input with `<Mail>` icon; value/placeholder `imie@flota.pl` | needs-copy-confirm (label); exact (icon)               |
| Submit   | dark `Send reset link →` (trailing `<ArrowRight>`), pending spinner                        | needs-copy-confirm (label)                             |
| Links    | `‹ Back to sign in`; footer `Secure connection · staff only`                               | needs-copy-confirm (back); exact (footer = shipped PL) |
| Behavior | `POST /api/auth/forgot-password` → **always** the neutral R2 state (no existence leak)     | exact                                                  |

### 3.16 R2 / R8 — Check your email (neutral) (`reset-r2-check-email-desktop.jpg`)

| Element    | Spec                                                                                                                                                                | Mark                                 |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------ |
| Icon tile  | `bg-muted text-muted-foreground rounded-2xl size-11` with `<Mail className="size-5" />` (envelope)                                                                  | exact                                |
| Title      | `Check your email` → PL §5                                                                                                                                          | needs-copy-confirm                   |
| Subtitle   | `If an account exists for that address, a reset link is on its way. It expires in 60 minutes.` → PL §5 — **neutral, no existence leak; 60 min = `otp_expiry=3600`** | needs-copy-confirm                   |
| Email chip | `flex items-center gap-2 rounded-xl bg-background px-3 py-2.5`: initials chip `size-7 rounded-lg bg-card text-[11px] font-bold` + email `text-sm font-mono`         | exact (`PB  piotr.bednarz@flota.pl`) |
| Primary    | dark `Open email app →`                                                                                                                                             | needs-copy-confirm                   |
| Secondary  | outline `Resend link` (`Button variant="outline" className="h-[52px] w-full"`)                                                                                      | needs-copy-confirm                   |
| Link       | `‹ Back to sign in`                                                                                                                                                 | needs-copy-confirm                   |

### 3.17 R3 / R9 — Set a new password (`reset-r3-set-password-desktop.jpg`)

| Element                | Spec                                                                                                                                                                                                                              | Mark                                                                                                                                                                                            |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Title                  | `Set a new password` → PL §5                                                                                                                                                                                                      | needs-copy-confirm                                                                                                                                                                              |
| Subtitle               | `Choose a strong password you don't use elsewhere.` → PL §5                                                                                                                                                                       | needs-copy-confirm                                                                                                                                                                              |
| Fields                 | `New password` + `Confirm password`, each `<Lock>` icon + `PasswordToggle` eye, grey fill                                                                                                                                         | needs-copy-confirm (labels); exact (icons + eye)                                                                                                                                                |
| **Strength checklist** | two rows `flex items-center gap-2 text-[13px] font-[540] text-success` each with `<Check className="size-3.5 text-success" />` — `At least 10 characters` / `One number or symbol` → PL §5                                        | **`deviation(illustrative UI hint only; the enforced policy is config-driven — supabase `minimum_password_length = 6` — and is NOT changed to match this "10 chars / number-or-symbol" copy)`** |
| Submit                 | dark `Save password ✓` (trailing `<Check>`)                                                                                                                                                                                       | needs-copy-confirm                                                                                                                                                                              |
| Footer                 | `Secure connection · staff only`                                                                                                                                                                                                  | exact (shipped PL)                                                                                                                                                                              |
| Behavior               | requires the recovery session (from `/auth/callback` PKCE exchange); `POST /api/auth/reset-password` → `updateUser({ password })`; **client validation min length must stay 6** to match the backend, regardless of the "10" hint | exact                                                                                                                                                                                           |

### 3.18 R4 — Password updated (success) (`reset-r4-success-desktop.jpg`)

| Element   | Spec                                                                                                                             | Mark               |
| --------- | -------------------------------------------------------------------------------------------------------------------------------- | ------------------ |
| Icon tile | `bg-[var(--flota-success-soft)] text-success rounded-2xl size-12` with `<ShieldCheck className="size-6" />` (green shield-check) | exact              |
| Title     | `Password updated` → PL §5                                                                                                       | needs-copy-confirm |
| Subtitle  | `You can now sign in with your new password.` → PL §5                                                                            | needs-copy-confirm |
| Action    | dark `Go to sign in →` → `/auth/signin`                                                                                          | needs-copy-confirm |

### 3.19 R5 — Expired / invalid link (`reset-r5-expired-desktop.jpg`)

| Element   | Spec                                                                                                                            | Mark               |
| --------- | ------------------------------------------------------------------------------------------------------------------------------- | ------------------ |
| Icon tile | `bg-[var(--flota-danger-soft)] text-destructive rounded-2xl size-12` with `<AlertTriangle className="size-6" />` (red triangle) | exact              |
| Title     | `This link has expired` → PL §5                                                                                                 | needs-copy-confirm |
| Subtitle  | `Reset links are valid for 60 minutes. Request a fresh one to continue.` → PL §5 (60 min = `otp_expiry=3600`)                   | needs-copy-confirm |
| Action    | dark `Request a new link →` → `/auth/forgot-password`                                                                           | needs-copy-confirm |
| Link      | `‹ Back to sign in`                                                                                                             | needs-copy-confirm |
| Behavior  | reached when `/auth/callback` `exchangeCodeForSession` fails (expired/invalid `?code=`) — redirect here, never a 500            | exact              |

### 3.20 R6 / R10 — Invite accept ("Set your password") — DISTINCT MODE (`reset-r6-invite-accept-desktop.jpg`)

Same page/island as R3 with `mode="invite"`. Differences from R3:

| Element                   | Spec                                                                                                         | Mark                                                              |
| ------------------------- | ------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------- |
| **Eyebrow** (above title) | `text-primary text-[11px] font-bold tracking-wide uppercase mb-1.5` — `WELCOME TO FLOTA` → PL §5             | needs-copy-confirm (crimson eyebrow — **the invite-mode marker**) |
| Title                     | `Set your password` (not "Set a new password") → PL §5                                                       | needs-copy-confirm                                                |
| Subtitle                  | `You've been invited to the dispatch team. Create a password to activate your account.` → PL §5              | needs-copy-confirm                                                |
| Fields + checklist        | identical to R3 (New/Confirm + `At least 10 characters` / `One number or symbol`)                            | exact (checklist deviation per §3.17)                             |
| Submit                    | dark `Activate account ✓` (not "Save password")                                                              | needs-copy-confirm                                                |
| Behavior                  | invite link → `/auth/callback` (PKCE) → this screen in invite mode; on submit the row flips INVITED → ACTIVE | exact                                                             |

### 3.21 R7–R10 mobile (`reset-r7-r10-mobile.jpg`)

Each mobile frame = the shipped auth mobile shell (§3.14 mobile band + white sheet) with the R1/
R2/R3/R6 body respectively. Header band back link reads `‹ Logowanie` (PL, given). Bodies,
buttons, checklist, and footer are identical to their desktop twins. No new values.

### 3.22 Admin nav item (`Zespół`) — deviation (shell already shipped)

`deviation(shell already implemented; only the admin-only "Zespół" item is added)`. In
`StaffShell.astro`: add `active` union value `"staff"` (`:17`); add `NAV` entry
`{ id:"staff", href:"/dashboard/staff", label:"Zespół", icon:"users" }` (`:37-50`), rendered in
both the sidebar loop (`:73`) and tab-bar loop (`:157`) **only when `role === "admin"`**; add a
`users` (person) glyph to `NavIcon.astro` (extend its `glyph` union `:5`). Active styles reuse the
shipped `bg-foreground text-background font-[650]` (sidebar `:81`) and `bg-white px-3.5
text-[#0A0A0F]` (tab bar `:164`). The prototype's other nav labels are **superseded** — do not
port them.

---

## 4. Component / class reuse (exact existing names)

| Reuse                                                                                                       | Source (file:line)                                            | For                                                                         |
| ----------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------- | --------------------------------------------------------------------------- |
| `cardClass` = `"rounded-2xl border border-border bg-card shadow-card"`                                      | `FleetList.tsx:56`                                            | filter-tab card, table wrapper, mobile cards, empty/no-results, footer note |
| Desktop `<table>` head/row/cell classes                                                                     | `FleetList.tsx:365-392`                                       | table structure                                                             |
| `StatusBadge` token pairs (`text-success bg-[var(--flota-success-soft)]`, `text-muted-foreground bg-muted`) | `FleetList.tsx:100-106`                                       | ACTIVE + EMPLOYEE badges                                                    |
| `<Badge>` primitive (pill base, auto `[&>svg]:size-3`)                                                      | `ui/badge.tsx`                                                | all four badges                                                             |
| `RetireDialog` overlay + panel + actions classes                                                            | `FleetList.tsx:139-168`                                       | add / remove / last-admin modals                                            |
| Empty-state block                                                                                           | `FleetList.tsx:356-360`                                       | empty roster + no-results                                                   |
| Inline `banner` strip + optimistic list mutate                                                              | `FleetList.tsx:184,203-256,352-354`                           | error banner + reset/remove/add feedback                                    |
| Dark add button + circular FAB                                                                              | `FleetList.tsx:281-297`                                       | `Dodaj pracownika` + mobile `+` FAB                                         |
| Search input block                                                                                          | `FleetList.tsx:301-312`                                       | desktop + mobile search                                                     |
| `animate-spin` pending ring, driven by explicit `submitting` flag                                           | `SubmitButton.tsx:26-30`                                      | every async button                                                          |
| `SubmitButton` (dark ink, trailing icon, pending)                                                           | `auth/SubmitButton.tsx`                                       | all reset-flow primary buttons                                              |
| `FormField` + `PasswordToggle` + `ServerError`                                                              | `auth/FormField.tsx`, `PasswordToggle.tsx`, `ServerError.tsx` | reset-flow inputs (email / password + eye)                                  |
| Auth-card shell (desktop modal + mobile band + logo + footer)                                               | `pages/auth/signin.astro:15-124`                              | reset-flow pages R1–R10                                                     |
| Auth footer shield line                                                                                     | `SignInForm.tsx:118-121`                                      | reset-flow `· staff only` footer                                            |
| Avatar initials treatment (`rounded-full`, initials chip)                                                   | `StaffShell.astro:113-121`                                    | row/card/stack avatars (size-9 / size-14; admin crimson variant)            |
| `roleLabel(role)` → `Administrator` / `Pracownik`                                                           | `staff-identity.ts`                                           | role badge labels + eyebrow                                                 |
| Shell nav render + active styles                                                                            | `StaffShell.astro:73-109,153-186`                             | admin `Zespół` item                                                         |
| `NavIcon` glyph switch (add `users`)                                                                        | `NavIcon.astro:5,22-53`                                       | nav person glyph                                                            |
| `Button` variants (`outline`, `destructive`, `size="icon"`)                                                 | `ui/button.tsx`                                               | row actions, modal + reset buttons                                          |
| `cn()` for all class merges                                                                                 | `src/lib/utils`                                               | throughout                                                                  |

Icons (lucide-react): `Plus`, `Search`, `X`, `KeyRound` (reset row/card + ADMIN badge), `User` /
`UserRound` (EMPLOYEE badge + empty + footer), `AlertTriangle` (duplicate/error/remove/expired),
`ShieldCheck` (last-admin + R4 + footer), `Send` (add-modal submit — replaces the mockup chat
glyph), `Mail` (R1/R2 + forgot input), `Lock` (password inputs), `ArrowRight` / `Check` (reset
submit trailing). Nav `users` glyph added to `NavIcon.astro`.

---

## 5. Verbatim copy table (every UI string → Polish to ship)

`exact` = the screenshot renders Polish (ships verbatim) or the string is already given/shipped.
`needs-copy-confirm` = best-fidelity Polish the user should approve (screenshot is English).

### 5.1 Roster — desktop (`employees-desktop-roster.jpg`, all PL in mockup)

| #   | String                 | Ship (PL)                                                                                         | Mark                           |
| --- | ---------------------- | ------------------------------------------------------------------------------------------------- | ------------------------------ |
| 1   | eyebrow                | `5 OSÓB · 1 ADMINISTRATOR` (`{n} OSÓB · {a} ADMINISTRATOR`, pluralized)                           | exact                          |
| 2   | title (H1)             | `Pracownicy`                                                                                      | exact                          |
| 3   | search placeholder     | `Imię lub e-mail…`                                                                                | exact                          |
| 4   | add button             | `Dodaj pracownika`                                                                                | exact                          |
| 5   | filter tabs            | `Wszyscy` · `Aktywny` · `Zaproszony` · `Administrator`                                            | exact                          |
| 6   | col heads              | `Imię i nazwisko` · `Rola` · `Status` · `Ostatnia aktywność`                                      | exact                          |
| 7   | self suffix            | `· Ty`                                                                                            | exact                          |
| 8   | role badge (admin)     | `ADMINISTRATOR`                                                                                   | exact                          |
| 9   | role badge (employee)  | `PRACOWNIK`                                                                                       | exact                          |
| 10  | status badge (active)  | `AKTYWNY`                                                                                         | exact                          |
| 11  | status badge (invited) | `ZAPROSZONY`                                                                                      | exact                          |
| 12  | row action             | `Resetuj hasło`                                                                                   | exact                          |
| 13  | remove `×` aria-label  | `Usuń pracownika`                                                                                 | needs-copy-confirm (aria only) |
| 14  | footer note            | `Nie możesz usunąć siebie.` **(bold)** ` Poproś innego administratora o usunięcie Twojego konta.` | exact                          |

### 5.2 Last-active relative strings (PL formatter)

| #   | Case                       | Ship (PL)                    | Mark                               |
| --- | -------------------------- | ---------------------------- | ---------------------------------- |
| 15  | just signed in             | `przed chwilą`               | exact (desktop mockup)             |
| 16  | minutes                    | `{n} min temu`               | exact                              |
| 17  | hours                      | `{n} godz. temu`             | exact                              |
| 18  | ~1 day                     | `wczoraj`                    | exact                              |
| 19  | invited, not yet signed in | `zaproszenie · {n} dni temu` | exact                              |
| 20  | EN `moments ago` (mobile)  | `przed chwilą`               | needs-copy-confirm (aligns to #15) |

### 5.3 Mobile roster (`employees-mobile-roster.jpg`, EN in mockup)

| #   | String (EN)           | Ship (PL)                                                        | Mark               |
| --- | --------------------- | ---------------------------------------------------------------- | ------------------ |
| 21  | eyebrow `4 STAFF`     | `{n} OSOBY` (alt `{n} W ZESPOLE`)                                | needs-copy-confirm |
| 22  | title `Zespół`        | `Zespół`                                                         | exact              |
| 23  | filter chip `Active`  | `Aktywni` (alt `Aktywny`)                                        | needs-copy-confirm |
| 24  | filter chip `Invited` | `Zaproszeni` (alt `Zaproszony`)                                  | needs-copy-confirm |
| 25  | filter chip `Admin`   | `Administratorzy` (alt `Administrator`)                          | needs-copy-confirm |
| 26  | role badge `ADMIN`    | `ADMIN` (alt `ADMINISTRATOR`)                                    | needs-copy-confirm |
| 27  | role badge `EMPLOYEE` | `PRACOWNIK`                                                      | needs-copy-confirm |
| 28  | status `Active`       | `Aktywny`                                                        | needs-copy-confirm |
| 29  | status `Invited`      | `Zaproszony`                                                     | needs-copy-confirm |
| 30  | footer note           | `Pracownicy mogą też zresetować swoje hasło z ekranu logowania.` | needs-copy-confirm |

### 5.4 Add modal — A / A2 (`employees-add-modal.jpg`, EN in mockup)

| #   | String (EN)                                                                  | Ship (PL)                                                          | Mark                      |
| --- | ---------------------------------------------------------------------------- | ------------------------------------------------------------------ | ------------------------- |
| 31  | title `Add employee`                                                         | `Dodaj pracownika`                                                 | exact (matches #4)        |
| 32  | subtitle `We'll email an activation link. New hires set their own password.` | `Wyślemy link aktywacyjny e-mailem. Nowa osoba sama ustawi hasło.` | needs-copy-confirm        |
| 33  | label `FULL NAME`                                                            | `IMIĘ I NAZWISKO`                                                  | needs-copy-confirm        |
| 34  | label `EMAIL ADDRESS`                                                        | `ADRES E-MAIL`                                                     | needs-copy-confirm        |
| 35  | `Cancel`                                                                     | `Anuluj`                                                           | exact (matches FleetList) |
| 36  | `Send invite`                                                                | `Wyślij zaproszenie`                                               | needs-copy-confirm        |
| 37  | duplicate error `This email is already on the team.`                         | `Ten adres e-mail jest już w zespole.`                             | needs-copy-confirm        |
| 38  | pending label                                                                | `Wysyłanie…`                                                       | needs-copy-confirm        |

### 5.5 Remove / last-admin / states — B / C / E / F / H (PL in mockup)

| #   | Purpose                       | Ship (PL)                                                                                           | Mark                         |
| --- | ----------------------------- | --------------------------------------------------------------------------------------------------- | ---------------------------- |
| 39  | remove title                  | `Usunąć tego pracownika?`                                                                           | exact                        |
| 40  | remove body                   | `{full_name}` **(bold)** ` — Utraci dostęp natychmiast. Zakończone protokoły pozostają w archiwum.` | exact                        |
| 41  | remove confirm label          | `WPISZ E-MAIL, ABY POTWIERDZIĆ`                                                                     | exact                        |
| 42  | remove cancel / confirm       | `Anuluj` / `Usuń`                                                                                   | exact                        |
| 43  | last-admin title              | `Nie można usunąć ostatniego administratora`                                                        | exact                        |
| 44  | last-admin body               | `Musi pozostać co najmniej jeden administrator. Najpierw awansuj inną osobę.`                       | exact                        |
| 45  | last-admin action             | `Anuluj`                                                                                            | exact                        |
| 46  | empty title / hint            | `Brak pracowników` / `Dodaj pierwszą osobę — wyślemy jej link aktywacyjny e-mailem.`                | exact                        |
| 47  | no-results title / hint       | `Brak wyników` / `Żaden pracownik nie pasuje do wyszukiwania. Spróbuj innego imienia lub e-maila.`  | exact                        |
| 48  | error banner + retry          | `Nie udało się zapisać zmiany. Sprawdź połączenie i spróbuj ponownie.` / `Ponów`                    | exact                        |
| 49  | reset-password success banner | `Wysłano e-mail do resetu hasła.`                                                                   | needs-copy-confirm           |
| 50  | generic mutation error        | `Coś poszło nie tak. Spróbuj ponownie.`                                                             | exact (matches FleetList:42) |

### 5.6 Reset / activation flow — R1–R10 (EN in mockup)

| #   | String (EN)                                                                                                   | Ship (PL)                                                                                        | Mark                                                                                           |
| --- | ------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------- |
| 51  | R1/R7 title `Reset your password`                                                                             | `Zresetuj hasło`                                                                                 | needs-copy-confirm                                                                             |
| 52  | R1/R7 subtitle `Enter your work email and we'll send a reset link.`                                           | `Podaj służbowy adres e-mail, a wyślemy link do resetu.`                                         | needs-copy-confirm                                                                             |
| 53  | field `Work email`                                                                                            | `E-mail służbowy`                                                                                | needs-copy-confirm (matches SignInForm `E-mail służbowy`)                                      |
| 54  | button `Send reset link`                                                                                      | `Wyślij link resetujący`                                                                         | needs-copy-confirm                                                                             |
| 55  | link `Back to sign in`                                                                                        | `Powrót do logowania`                                                                            | needs-copy-confirm                                                                             |
| 56  | footer `Secure connection · staff only`                                                                       | `Połączenie szyfrowane · tylko personel`                                                         | exact (shipped SignInForm:120)                                                                 |
| 57  | mobile band back `Logowanie`                                                                                  | `Logowanie`                                                                                      | exact                                                                                          |
| 58  | R2/R8 title `Check your email`                                                                                | `Sprawdź skrzynkę`                                                                               | needs-copy-confirm                                                                             |
| 59  | R2/R8 subtitle `If an account exists for that address, a reset link is on its way. It expires in 60 minutes.` | `Jeśli dla tego adresu istnieje konto, link do resetu jest już w drodze. Wygasa po 60 minutach.` | needs-copy-confirm                                                                             |
| 60  | R2/R8 primary `Open email app`                                                                                | `Otwórz aplikację e-mail`                                                                        | needs-copy-confirm                                                                             |
| 61  | R2/R8 secondary `Resend link`                                                                                 | `Wyślij link ponownie`                                                                           | needs-copy-confirm                                                                             |
| 62  | R3/R9 title `Set a new password`                                                                              | `Ustaw nowe hasło`                                                                               | needs-copy-confirm                                                                             |
| 63  | R3/R9 subtitle `Choose a strong password you don't use elsewhere.`                                            | `Wybierz silne hasło, którego nie używasz nigdzie indziej.`                                      | needs-copy-confirm                                                                             |
| 64  | fields `New password` / `Confirm password`                                                                    | `Nowe hasło` / `Potwierdź hasło`                                                                 | needs-copy-confirm                                                                             |
| 65  | checklist `At least 10 characters` / `One number or symbol`                                                   | `Co najmniej 10 znaków` / `Cyfra lub symbol`                                                     | needs-copy-confirm (**illustrative only — see §3.17 deviation; enforced min is 6, unchanged**) |
| 66  | R3/R9 submit `Save password`                                                                                  | `Zapisz hasło`                                                                                   | needs-copy-confirm                                                                             |
| 67  | R4 title `Password updated`                                                                                   | `Hasło zaktualizowane`                                                                           | needs-copy-confirm                                                                             |
| 68  | R4 subtitle `You can now sign in with your new password.`                                                     | `Możesz teraz zalogować się nowym hasłem.`                                                       | needs-copy-confirm                                                                             |
| 69  | R4 action `Go to sign in`                                                                                     | `Przejdź do logowania`                                                                           | needs-copy-confirm                                                                             |
| 70  | R5 title `This link has expired`                                                                              | `Link wygasł`                                                                                    | needs-copy-confirm                                                                             |
| 71  | R5 subtitle `Reset links are valid for 60 minutes. Request a fresh one to continue.`                          | `Linki resetujące są ważne 60 minut. Poproś o nowy, aby kontynuować.`                            | needs-copy-confirm                                                                             |
| 72  | R5 action `Request a new link`                                                                                | `Poproś o nowy link`                                                                             | needs-copy-confirm                                                                             |
| 73  | R6/R10 eyebrow `WELCOME TO FLOTA`                                                                             | `WITAJ W FLOCIE`                                                                                 | needs-copy-confirm                                                                             |
| 74  | R6/R10 title `Set your password`                                                                              | `Ustaw hasło`                                                                                    | needs-copy-confirm                                                                             |
| 75  | R6/R10 subtitle `You've been invited to the dispatch team. Create a password to activate your account.`       | `Masz zaproszenie do zespołu dyspozytorni. Utwórz hasło, aby aktywować konto.`                   | needs-copy-confirm                                                                             |
| 76  | R6/R10 submit `Activate account`                                                                              | `Aktywuj konto`                                                                                  | needs-copy-confirm                                                                             |

---

## Deviations register (quick index)

1. **Nav** — reuse shipped `StaffShell`; add only admin-only `Zespół` item (§3.22, §0.1).
2. **Filter tabs replace stat cards** — desktop segmented filter + avatar stack; mobile filter
   chips (§3.2, §3.13). The old screen-19 stat cards are gone.
3. **EN→PL localization** — deliberate; PL canonical; per-string in §5. Not re-flagged per line.
4. **Desktop `StaffShell` title bar suppressed** (`showHeader={false}`) to avoid a duplicate
   heading; island renders its own eyebrow+title (§3).
5. **Desktop H1 = `Pracownicy`, mobile H1 = `Zespół`, nav = `Zespół`** — three distinct labels,
   all transcribed exact (§3.1, §3.13, §3.22).
6. **Add-modal submit glyph** = chat/message bubble in the mockup → ship `Send` (paper-plane);
   the row/card reset action already uses `KeyRound` (§3.3, §3.6).
7. **Password strength checklist is illustrative UI only** — the enforced policy is config-driven
   (`minimum_password_length = 6`) and is **NOT** changed to match the "10 chars / number-or-
   symbol" hint; client validation must stay min-6 (§3.17, §3.20, §5 #65).
8. **Loading skeleton parked** — roster is SSR-loaded, so no first-paint skeleton; spec kept for a
   future client refetch (§3.11).
9. **Mobile parity resolved to full parity** — mobile now HAS search, filter chips, and a per-card
   reset (key) action, and draws the admin avatar crimson (consistent with desktop). The old
   "mobile omits reset/search, admin avatar navy" divergences are gone (§3.13).
10. **Reset flow reuses the shipped auth-card shell** (`signin.astro`) incl. the mobile truck-band
    (§3.14); the mobile back link reads `Logowanie`.
11. **Footer note differs by breakpoint** — desktop = self-removal note; mobile = self-service-
    reset note (both transcribed, §3.5, §3.13).
