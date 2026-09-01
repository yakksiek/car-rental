# English Localization Implementation Plan

## Overview

Add a second locale (English) to FleetRent as a **locale dimension**, not a translation pass. The
change spans a request-scoped locale seam, Polish grammar currently encoded as executable logic,
outbound artifacts (5 emails + the protocol PDF + GoTrue auth mail), stored locale state on three
tables, and the page chrome that must carry the switch.

The driver is the **portfolio/recruiter** reader, not the rental customer. That is what makes the
whole-app scope — staff cockpit included — correct, and it is what sets the acceptance test: _a
recruiter following a CV link reaches the staff cockpit and reads it end to end._

English is the **default** locale. Polish becomes the opt-in.

## Current State Analysis

There is no i18n layer: `astro.config.mjs` has no `i18n` block, `src/middleware.ts` never resolves a
locale, `package.json` carries zero i18n dependencies, and `src/layouts/Layout.astro:17` is a literal
`<html lang="pl">`. Polish literals appear in **157 of 249 files** under `src/`.

Four findings from planning research materially change the shape of the work versus the frame's
worst case:

1. **workerd has full ICU — the premise behind every hand-rolled Polish table is false.** Probed
   2026-09-01 with a minimal worker on `wrangler dev` (`compatibility_date` 2026-01-01):

   | Call                                                          | Result                                  |
   | ------------------------------------------------------------- | --------------------------------------- |
   | `Intl.DateTimeFormat("pl-PL", {day:"numeric",month:"long"})`  | `25 września` (genitive)                |
   | `Intl.DateTimeFormat("pl-PL", {month:"long"})`                | `wrzesień` (nominative)                 |
   | `Intl.PluralRules("pl-PL").select(n)` for 1 / 2 / 5 / 12 / 22 | `one` / `few` / `many` / `many` / `few` |
   | `Intl.NumberFormat("pl-PL")` grouping separator               | U+00A0                                  |
   | `Intl.DateTimeFormat` with `timeZone:"Europe/Warsaw"`         | `12:49` from `10:49Z`                   |
   | `Intl.RelativeTimeFormat("pl-PL").format(-2,"day")`           | `przedwczoraj`                          |

   `Intl` reproduces every hand-rolled behaviour, including the 12–14 plural exception **and** the
   nominative-vs-genitive month split that `ReservationCalendar.tsx:68-95` carries two tables for.
   The grouping character matches `format.ts:13`'s hand-rolled non-breaking space exactly.

2. **The `pluralPl` arity problem is ~6 call sites, not "every call site"** — `TrustCard.astro:22`,
   `StaffList.tsx:104`, `staff-format.ts:21-22`, `templates.ts:206`, `protocol-pdf.ts:559`, plus the
   buggy inline two-form at `pickups.astro:30`.

3. **The catalog already half-exists.** 36 `COPY` / `MSG` objects across 14 island components and
   **17 of 20** API route files. Strings are already collected into named objects.

4. **Astro's built-in `i18n` is unusable here.** `Astro.currentLocale` is URL-derived and falls back
   to `defaultLocale` when there is no `/[locale]/` prefix. The frame established that a URL-prefix
   locale is a **security regression**: `src/lib/access.ts:49-51` matches literal prefixes, so
   `/en/dashboard/staff` resolves to no required role and `src/middleware.ts:69` waves the request
   through unauthenticated. `safe-redirect.ts:25` and `back-target.ts:26-30` break identically.

Test coupling: **~89 Polish E2E locator arguments, 84% in two files** (`staff-admin.spec.ts` 53,
`staff-auth.spec.ts` 22), plus ~170 Polish lines across 22 unit-test files and ~64 across 15
integration files. `e2e/e2e-rules.md:9-10` mandates literal-copy locators and forbids
`getByTestId` — there is no decoupled addressing layer to fall back on.

Header capacity is exhausted. `SiteHeader.astro:41` is a `justify-between` row with no `gap`,
`min-w-0`, `truncate` or `flex-1`; slack is ~105px at `lg` and ~4px at `md`. The staff band is worse
— at 768px the 520px `GlobalSearch` field plus the 92px `QuickAddButton` consume 624px of 632px
usable, documented in `StaffShell.astro:272-275`. The mobile tab bar is at 8 items = 360px on a
360px viewport.

## Desired End State

A visitor lands on any URL and reads **English** by default. A `LangToggle` in the public header
(always visible at every width) and a control in the staff sidebar switch to Polish; the choice
persists in a cookie, and for signed-in staff in `profiles.locale`. Every app-authored string —
public pages, staff cockpit, validation messages, API errors, email bodies, the PDF — renders in the
active locale. Customer emails and PDFs render in the language stored on the **reservation**, not the
sender's session.

Verify by: switching to Polish and back on both the public site and the cockpit; running the E2E
suite green in EN and the PL smoke spec green; confirming key parity between the `pl` and `en` halves
of every catalog namespace; and a rendered vision-diff of the header against the canonical mockups.

### Key Discoveries:

- **The locale seam already exists** — `App.Locals` (`src/env.d.ts:9-22`), populated at
  `src/middleware.ts:17,49,54`. `isDemo` (2026-08-28) is a working precedent for threading a
  per-request scalar preference: one `profiles` column, one line in the middleware select, one
  `Locals` field, one pure reader (`src/lib/access.ts:92-94`).
- **Starlight is the scale precedent for the catalog.** Astro's own docs framework resolves the
  locale in middleware and exposes a bound translator as `Astro.locals.t('404.text')`, with
  `useTranslations(lang)` as the equivalent for non-component code and fallback to the default
  language on a missing key. That is exactly our `App.Locals` shape.
- **React islands cannot read `Astro.locals`.** An island takes `locale` as a prop and imports its
  own namespace file. A _flat_ central catalog imported by an island would ship both locales' full
  dictionary in that island's bundle — which is why the catalog is namespaced per domain.
- **The design source is already bilingual at enforced key parity** —
  `context/archive/2026-07-09-issue-protocol/design-audit.md:37-39`: _"`STR.EN.proto` and
  `STR.PL.proto` both hold 82 keys, zero asymmetry."_ Mockup'd screens are a harvest problem;
  app-authored strings (validation, API, email, PDF) have no EN twin and are the real authoring cost.
- **GoTrue errors are already walled off** at `src/lib/auth-messages.ts:120-140` — one module maps
  provider errors to our copy, so provider English never leaks and our translation has one seam.
- **The DB layer is the cleanest in the repo** — 4 Polish strings across 34 migrations, all comments;
  no `RAISE EXCEPTION`; enums are English tokens (`cargo_van`, `scratch`); RPCs return English codes
  (`'unauthorized'`, `'no_baseline'`). Nothing to translate below the app.

## What We're NOT Doing

- **No URL-prefixed locales** (`/en/...`). It fails open on `access.ts:49-51`. The usual SEO argument
  does not apply: site-wide `noindex` (`Layout.astro:35`), `Disallow: /` (`public/robots.txt`), and
  `@astrojs/sitemap` is inert (no `site` key, no `sitemap*` in `dist`).
- **No `Accept-Language` sniffing.** Response would vary by request header, needing
  `Vary: Accept-Language` and making SSR output non-deterministic for the same URL.
- **No regeneration of issued PDFs** (frame decision 1). A protocol PDF stays in the language it was
  generated in, permanently — the customer's signature at `protocol-pdf.ts:290` sits directly beneath
  the declaration they actually signed.
- **No machine translation of human-typed free text** (frame decision 2) —
  `protocol_damages.location`, `reservations.rejection_note`, `reservations.notes`,
  `vehicles.fuel_type`. English chrome around Polish free text is the correct outcome.
- **No `autoTagDamages` fix.** `protocol-delta.ts:110-137` matching baseline damages on typed strings
  is a pre-existing suggestion-quality weakness (it already breaks on a trailing full stop) that a
  locale switch degrades further. It is a **suggestion the employee confirms**, not an unattended
  billing path. Tracked in `known-issues.md`, fixed on its own schedule.
- **No `generateLink` + own-send auth architecture** (frame decision 6). GoTrue templates go
  bilingual instead — one template carrying English above Polish.
- **No English equivalents invented for Polish legal concepts** (frame decision 3). NIP, dowód
  osobisty, prawo jazdy kat. B/C, kaucja, faktura VAT keep their Polish name plus a one-time gloss.
- **No translation columns on business entities** (`vehicles.name_en` and friends). Seed fixtures are
  rewritten in English; real user-entered data stays verbatim.
- **No `npm run format`** across the repo — it rewrites ~68 unrelated files. Format only the touched
  set.

## Implementation Approach

**Namespaced catalog, Starlight-shaped accessor.** `src/lib/i18n/<domain>.ts` files each export
`{ pl, en }` at enforced key parity. Astro components read `Astro.locals.t("ns.key")`; `src/lib` and
API routes call `useTranslations(locale)`; React islands import their own namespace and take `locale`
as a prop. Per-namespace files keep island bundles tree-shakeable.

**Locale resolution mirrors `isDemo` exactly.** Cookie → `profiles.locale` → `en`. One column, one
line in the middleware select, one `Locals` field, one pure reader. Zero routes perturbed.

**Grammar is deleted, not duplicated.** Every hand-rolled Polish table and plural helper is replaced
by `Intl`, keyed on the active locale. A third locale would then cost zero grammar code.

**Locale is a property of the reservation, not the sender.** `reservations.locale` is captured at
submission and drives every customer email, so an employee working in an English dashboard still
emails a Polish customer in Polish. `protocols.locale` stamps what language a stored PDF was rendered
in.

**Phases are ordered so the acceptance test passes at Phase 4**, before the long tail of remaining
screens and artifacts.

## Critical Implementation Details

**Test sequencing within each copy phase.** The E2E specs are re-anchored to English, and the copy
they assert on changes in the same phase. Land the copy change first and run the suite red, then
rewrite that surface's locators — never both in one commit. A spec rewritten alongside its strings
gives no signal about which half is wrong.

**Cookie writes must not break the SSR/hydration contract.** The switch is a POST to an API route
that sets the cookie and redirects back, not a client-side `document.cookie` write. A client write
would leave the server-rendered markup in the previous locale until the next navigation, and any
island reading the cookie directly would hydrate against markup the server produced under a different
locale — the same class of mismatch `lessons.md` records for the signature timestamp.

**`Flota` is both the brand and a nav item** (frame decision 5). It must **not** translate at
`Layout.astro:13` and `SiteFooter.astro:86`; it **must** become "Fleet" at `SiteHeader.astro:33`,
`LandingNav.astro:38`, `MobileNav.tsx:26`. Identical string, opposite requirement, invisible to
extraction tooling — so the nav label and the brand name must live in different catalog namespaces.

**`supabase/config.toml` loads only on `supabase stop && start`** — never `supabase config push`
(it would overwrite hosted settings that are managed in the dashboard).

## Phase 1: Locale Seam + Storage

### Overview

Establish the request-scoped locale and the places it is stored. No user-visible copy changes — the
app still renders Polish everywhere, now through a seam that knows the locale is `pl`.

### Changes Required:

#### 1. Catalog scaffold

**File**: `src/lib/i18n/index.ts`, `src/lib/i18n/types.ts`

**Intent**: Define the locale type and the translator factory that both Astro components and plain
modules use, following Starlight's shape.

**Contract**: `export type Locale = "en" | "pl"`; `DEFAULT_LOCALE = "en"`; `LOCALES` as an ordered
readonly tuple for the switcher. `useTranslations(locale: Locale)` returns `t(key)` resolving against
the composed namespace map, falling back to `DEFAULT_LOCALE` on a missing key. Key parity between the
`pl` and `en` halves must be a **type error**, not a runtime fallback — the fallback exists for
robustness in production, not as a licence to ship an untranslated key.

```ts
// The parity constraint every namespace file is declared against.
export type Dict<T extends Record<string, string>> = { en: T; pl: Record<keyof T, string> };
```

#### 2. Middleware resolution

**File**: `src/middleware.ts`

**Intent**: Resolve the locale once per request and attach it plus a bound translator to
`context.locals`, mirroring how `isDemo` is resolved.

**Contract**: Read the `locale` cookie; if absent and the user has a profile, use `profiles.locale`;
otherwise `DEFAULT_LOCALE`. Add `locale` to the existing `profiles` select at `:33` (no extra round
trip). Set `context.locals.locale` and `context.locals.t`. Resolution must run **before** the access
gate so a redirect can carry the locale, and must never throw — an unrecognised cookie value falls
back to the default rather than erroring.

#### 3. Locals declaration

**File**: `src/env.d.ts`

**Intent**: Declare the two new `App.Locals` fields.

**Contract**: `locale: import("./lib/i18n/types").Locale` (non-nullable, defaulted — never `null`,
same rule as `isDemo`) and `t: ReturnType<typeof useTranslations>`.

#### 4. Document language

**File**: `src/layouts/Layout.astro`

**Intent**: Stop hardcoding `lang="pl"`, and translate the default page title and the missing-config
banner copy.

**Contract**: `<html lang={Astro.locals.locale}>` at `:17`. The default title at `:13` keeps **Flota**
as the brand (untranslated) with only the tagline localized. `Uwaga:` / `Dokumentacja` at `:52,58`
move into the catalog.

#### 5. Locale switch endpoint

**File**: `src/pages/api/locale.ts`

**Intent**: Set the locale cookie server-side and persist it to `profiles.locale` for signed-in staff.

**Contract**: `POST` only. Self-gates per the API lesson: (a) same-origin CSRF check → 403, (b) zod
parse of `{ locale, redirect }` → 400. Deliberately **public** (no auth gate) — an anonymous visitor
must be able to switch; say so in a comment. `redirect` is validated through the existing
`safeRedirectPath` so a tampered value can only resolve to an internal path. When
`context.locals.user` is set, also write `profiles.locale`. Cookie uses the shared
`shouldSecureCookies(context.url)` rule, `sameSite: "lax"`, one-year max-age. Responds 303 to the
validated path.

#### 6. Migration

**File**: `supabase/migrations/<timestamp>_locale_dimension.sql`

**Intent**: Add the three locale columns plus the consent-attribution columns frame decision 4
requires.

**Contract**: `profiles.locale text` (nullable — null means "no preference, use default");
`reservations.locale text not null default 'en'`; `protocols.locale text not null default 'pl'`;
`reservations.terms_version text` and `reservations.terms_locale text` beside the existing
`terms_accepted_at`. A `check` constraint pins each to `('en','pl')`.

**Backfill is asymmetric and deliberate**: existing `reservations` and `protocols` rows are stamped
`'pl'` — they were created by a Polish-only app, and for `protocols` the stored PDF bytes are
provably Polish. The column _defaults_ differ from the backfill (`reservations` defaults `'en'` for
new rows; `protocols` defaults `'pl'` and is always written explicitly at render time). No RLS policy
changes — the columns ride existing row grants.

#### 7. Type regeneration

**File**: `src/db/database.types.ts`

**Intent**: Regenerate so the new columns are typed.

**Contract**: `npx supabase gen types typescript --local`. Verify `profiles.locale`,
`reservations.locale`, `protocols.locale`, `reservations.terms_version`,
`reservations.terms_locale` appear.

### Success Criteria:

#### Automated Verification:

- Migration applies cleanly: `npx supabase db reset`
- Type check passes: `npx astro check`
- Lint passes: `npm run lint`
- Unit tests pass: `npm test`
- Integration tests pass: `npm run test:integration`
- Build succeeds: `npm run build`
- A new unit test pins locale resolution precedence (cookie > profile > default) including the
  unrecognised-cookie fallback

#### Manual Verification:

- App renders identically to before — no visible copy or layout change
- `<html lang>` reads `en` on a fresh visit; `POST /api/locale` with `pl` flips it and the cookie
  persists across navigation
- Signed in as a staff account, switching locale writes `profiles.locale`; clearing the cookie and
  reloading restores that preference
- `POST /api/locale` from a foreign origin is refused 403; a `redirect` of `https://evil.test` lands
  on an internal path

**Implementation Note**: Pause here for manual confirmation before proceeding to Phase 2.

---

## Phase 2: Retire Polish Grammar-as-Logic

### Overview

Replace every hand-rolled Polish grammar and date table with `Intl`, keyed on the active locale. This
is the phase that converts "copy" from an incoherent boundary into a real one — after it, translating
is genuinely a string problem.

### Changes Required:

#### 1. Locale-aware date formatting

**File**: `src/lib/pl-date.ts` → `src/lib/format-date.ts`

**Intent**: Delete the three hand-rolled Polish tables and re-express every helper in terms of
`Intl.DateTimeFormat` with an explicit locale and timezone.

**Contract**: `WEEKDAYS_PL`, `MONTHS_PL`, `MONTHS_ABBR_PL` are deleted. Each exported helper
(`dateEyebrow`, and the rest of the module's surface) gains a `locale: Locale` parameter. **Always
pass an explicit `timeZone`** per the standing locale lesson — company-anchored events stay
`Europe/Warsaw`. The genitive/nominative distinction `MONTHS_PL` encoded is handled by `Intl`
automatically: requesting `{day, month:"long"}` yields `25 września`, `{month:"long"}` alone yields
`wrzesień`.

#### 2. Locale-generic plurals

**File**: `src/lib/format.ts`, `src/lib/staff-format.ts`

**Intent**: Replace the two three-slot Polish plural helpers with one CLDR-category helper that works
for any locale.

**Contract**: `pluralPl(n, [one, few, many])` and `plForm(n, one, few, many)` are both deleted,
replaced by a single helper keyed on `Intl.PluralRules(locale).select(n)` returning `one | few |
many | other`. Callers pass a partial record of forms; the helper resolves the category and falls
back to `other`. English supplies `{one, other}`; Polish supplies `{one, few, many}` — **arity stops
being per-language**, which is what makes this deletable rather than duplicable.

#### 3. Money and rate formatting

**File**: `src/lib/format.ts`

**Intent**: Stop baking `zł` and `/doba` into the formatter.

**Contract**: `formatPln` / `formatPlnAmount` / `formatDailyRate` gain a `locale` parameter. The
currency stays PLN in both locales (the business is Polish); only presentation localizes.
`groupThousands` and `PLN_GROUP_SEPARATOR` are deleted — `Intl.NumberFormat` emits the same U+00A0
separator, verified by probe. The `/doba` suffix becomes a catalog string (`/day` in EN).

**Watch the two regex strippers**: `BookingWidget.tsx:353` and `ReservationForm.tsx:658` do
`.replace(/\s*zł$/,"")` to restyle the amount. Once currency is locale-aware these break silently
under EN. Replace them with `formatPlnAmount` (which already returns the bare number) rather than
extending the regex.

#### 4. Relative time

**File**: `src/components/dashboard/PendingQueue.tsx` and the ~25 `date-fns/locale` sites

**Intent**: Remove the static `pl` locale import that emits Polish sentences with no literal in the
repo.

**Contract**: `formatDistanceToNow(d, { locale: pl })` at `PendingQueue.tsx:92` becomes
`Intl.RelativeTimeFormat` with the active locale (probe confirms `przedwczoraj` for `-2 day`). The
`format(date, "d MMM", { locale: pl })` calls across `FilterBar`, `HeroSearch`, `BookingWidget`,
`ReservationStatusCard`, `ReservationForm`, `NeedDecisionPanel`, `ManualReservationModal` become
`Intl.DateTimeFormat` calls through the Phase 2 helpers. Each island takes `locale` as a prop.

#### 5. Calendar month tables

**File**: `src/components/dashboard/ReservationCalendar.tsx`

**Intent**: Delete the twin nominative/genitive month tables.

**Contract**: `PL_MONTHS_NOM` and `PL_MONTHS_GEN` at `:68-95` are removed; the view-mode branch that
selects between them selects `Intl.DateTimeFormat` options instead — `{month:"long"}` for the
standalone caption, `{day:"numeric",month:"long"}` where a day accompanies it. Same for
`BookingWidget.tsx:261`'s `formatCaption`.

#### 6. PDF and email plural helpers

**File**: `src/lib/media/protocol-pdf.ts`, `src/lib/email/templates.ts`

**Intent**: Route the two private plural helpers through the shared one.

**Contract**: `photoCountWord` (`protocol-pdf.ts:559`) and `damageLabel` (`templates.ts:206`) take a
locale and delegate to the Phase 2 plural helper. Their call sites at `protocol-pdf.ts:267` and
`templates.ts:223,311` thread the locale through.

#### 7. Fix the live plural bug

**File**: `src/pages/dashboard/pickups.astro`

**Intent**: `:30` renders a two-form approximation producing _"5 rezerwacje"_ where correct Polish is
_"5 rezerwacji"_. Route it through the shared helper.

**Contract**: The inline conditional is replaced by the plural helper. This is a genuine bug fix
surfaced by the frame, not refactoring noise.

#### 8. Unit test migration

**File**: `src/lib/format.test.ts`, `src/lib/staff-format.test.ts`, and the ~20 other affected specs

**Intent**: Parameterize the ~170 Polish assertions by locale.

**Contract**: Every deleted helper's spec is rewritten against the replacement, asserting **both**
locales. The Polish plural table (`1:one, 2:few, 5:many, 12:many, 13:many, 14:many, 22:few, 25:many`)
is kept as an explicit test case — `Intl` supplies it now, but the assertion is what proves the
migration preserved behaviour rather than silently changing it.

### Success Criteria:

#### Automated Verification:

- Type check passes: `npx astro check`
- Lint passes: `npm run lint`
- Unit tests pass in both locales: `npm test`
- Integration tests pass: `npm run test:integration`
- E2E suite still green (copy has not changed yet): `npm run test:e2e`
- `grep -rn "date-fns/locale" src/` returns nothing
- `grep -rn "pluralPl\|plForm\|MONTHS_PL\|PL_MONTHS" src/` returns nothing

#### Manual Verification:

- Every date, money and count on the cockpit and public site renders identically to before under
  `pl` — spot-check Pulpit eyebrow, calendar captions, fleet card rates, staff list counts
- `/dashboard/pickups` now reads _"5 rezerwacji"_ rather than _"5 rezerwacje"_
- The signature timestamp on a protocol still shows Warsaw time, not UTC or viewer-local
- Booking widget and reservation form summaries show the bare amount with no stray `zł`

**Implementation Note**: Pause here for manual confirmation before proceeding to Phase 3.

---

## Phase 3: Header Redesign + Language Switcher

### Overview

The locale control cannot be dropped into existing chrome — every header surface is at or past
capacity. This phase restructures the public header per the design and adds the staff control.

Depends on the plan-time design work: the staff `LangToggle` must exist in the Claude Design project
before this phase starts (see Design Alignment Audit).

### Changes Required:

#### 1. Public header restructure

**File**: `src/components/SiteHeader.astro`, `src/components/HeaderContactToggle.tsx` (deleted),
`src/components/header/ActionMenu.tsx` (new)

**Intent**: Adopt the design's reflow — below 980px the phone and CTA collapse into a single
`ActionMenu`, while `LangToggle` stays visible at every width.

**Contract**: The design **replaces** `HeaderContactToggle` rather than extending it; the two-segment
mode switch is deleted, not adapted.

**This deletion fixes a live bug, verified 2026-09-01.** On every public page except the landing,
tapping the toggle's phone segment at **768–790px and 840px** wraps the nav pill's "O nas" onto two
lines and grows the header **86px → 108px**; the `Zarezerwuj` CTA simultaneously collapses to an
unlabelled icon. The toggle expands 183px → 227px (`revealWidth` 112 → 150) against a
`justify-between` row with no `gap`/`min-w-0`/`truncate` and nav links with no `whitespace-nowrap`,
so the nav text is the only thing that can give. `ActionMenu` is a fixed 40px trigger opening a
popover, so it cannot reproduce this. Do **not** patch `HeaderContactToggle` first — deleting it is
the fix. Full write-up in `known-issues.md`; evidence PNGs in `design-review/`. Reflow moves from viewport breakpoints (`md:` / `lg:` /
`min-[840px]:`) to **container queries** (`containerType: 'inline-size'` + `@container`), which is
what this project's own embeddable-panels lesson prefers. Exact values from `design-contract.md`.
`ActionMenu` builds on the existing `ui/popover.tsx`, already used for header chrome at
`QuickAddButton.tsx:205` — there is no `toggle` / `tabs` / `dropdown-menu` primitive in
`src/components/ui/`.

#### 2. LangToggle component

**File**: `src/components/header/LangToggle.tsx`

**Intent**: The segmented PL|EN control, posting to the Phase 1 endpoint.

**Contract**: Renders as a form POSTing to `/api/locale` with the current path as `redirect`, so it
works without JS and avoids a client-side cookie write. Per the project's async-button rule, it shows
a pending state while in flight. Geometry and states from `design-contract.md`. Closest existing
patterns for the segmented shape: `HeaderContactToggle.tsx:122` and `ReservationCalendar.tsx:142-158`.

#### 3. Landing and mobile nav

**File**: `src/components/LandingNav.astro`, `src/components/MobileNav.tsx`

**Intent**: Carry the switcher into the immersive landing fork and the mobile overlay.

**Contract**: `LandingNav` is the tightest surface — at 1024–1279px it carries a 5-link nav plus the
CTA with the phone already deferred to `xl`, and its tablet bar has **already dropped "O nas"**
(`:115`, `nav.slice(0, 4)`). Follow the design's collapse rather than compressing further.
`InfoHeaderMobile` reduces to `LangToggle` + `ActionMenu`.

**The landing pill has no collapse mechanism, and adding `LangToggle` to it regresses a live bug.**
Measured 2026-09-01: the pill is `grid-cols-[1fr_auto_1fr]`, side column `(vw − 100 − 393) / 2`. The
right cluster needs **322px** today (CTA 154 + phone 148 + `gap-5` 20), reached at **vw ≥ 1136** —
yet `LandingNav.astro:74` defers the phone to `xl` (1280), so the number is **absent across
1024–1279** with no fallback affordance in that band (below 1024 the tablet bar has a phone icon;
`SiteHeader` pages show it from `lg`). Adding the measured **75px** `LangToggle` plus its gap takes
the cluster to **417px**, which the column only reaches at **vw ≥ 1327** — so a naive port _widens_
the dead band to 1024–1326.

Therefore this phase must port the design's **collapse** to the landing fork, not just to
`SiteHeader`: below the threshold, phone + CTA fold into one `ActionMenu` while `LangToggle` stays
visible. Do not solve it by lowering the phone's breakpoint to `lg` — that overflows at 1024–1135.
Full write-up in `known-issues.md`; evidence PNGs in `design-review/`.

#### 4. Staff shell control

**File**: `src/components/shell/StaffShell.astro`, `src/pages/dashboard/account.astro`

**Intent**: Place the staff switcher where the chrome has actual slack.

**Contract**: Desktop — a compact control in the uncontested `mt-auto` block at `:193`, above the
Profil chip. The top band is **not** an option: at 768px `GlobalSearch` (520px) + `QuickAddButton`
(92px) already consume 624px of 632px usable. Mobile — no chrome control; the tab bar is at 8 items =
360px on a 360px viewport. Instead a language row on `/dashboard/account`, which is where a
`profiles.locale` preference belongs. Both write through `POST /api/locale`.

### Success Criteria:

#### Automated Verification:

- Type check passes: `npx astro check`
- Lint passes: `npm run lint`
- Build succeeds: `npm run build`
- E2E suite green: `npm run test:e2e`
- `grep -rn "HeaderContactToggle" src/` returns nothing

#### Manual Verification:

- Rendered vision-diff of `SiteHeader` against the canonical mockup at 1280 / 1180 / 980 / 840 / 768
  / 390px — punch-list iterated to empty minus recorded deviations
- Nothing in the header overflows at any width, including the states that overflowed before
- `LangToggle` is visible and operable at every breakpoint on the public site
- Staff sidebar control works on desktop; the account row works on mobile; both persist the choice
- Switching locale preserves the current page (redirect target is the path you were on)
- **Regression gate — the two live bugs this phase deletes must be provably gone** (both measured
  2026-09-01, both recorded in `known-issues.md`):
  - No header state wraps the nav or changes the bar's height at **768–790px or 840px** on
    `/fleet`, `/pricing`, `/faq`, `/about`. The old failure needed an interaction — exercise the
    contact/booking control, don't just load the page.
  - The phone number is reachable from the landing header at **1136px and above**, and no width
    between `md` and the widest desktop leaves the landing header with **no** phone affordance at all.
- Matches `design-contract.md`

**Implementation Note**: Pause here for manual confirmation before proceeding to Phase 4.

---

## Phase 4: Recruiter Path to English

### Overview

The acceptance test passes at the end of this phase: a recruiter following a CV link reaches the
staff cockpit and reads it end to end in English.

### Changes Required:

#### 1. Glossary

**File**: `context/changes/english-localization/glossary.md`

**Intent**: Pin the recurring domain vocabulary once, seeded from the design source, so 157 files
don't each re-decide it.

**Contract**: Harvest the `STR.EN` dictionaries from the Claude Design project first — those terms
have already been through a design pass and match the mockups. Then extend with the terms that have
no EN twin. At minimum: kaucja, wydanie, zwrot, protokół, wniosek, doba, flota (brand vs nav),
pojazd, najem, odbiór, uszkodzenie, przebieg, paliwo. Record frame decision 3's gloss form for Polish
legal terms — _"NIP (Polish tax identification number)"_ — and the terms it applies to: NIP, dowód
osobisty, prawo jazdy kat. B/C, faktura VAT.

#### 2. Public entry surfaces

**File**: `src/pages/index.astro`, `src/components/landing/*`, `src/components/SiteFooter.astro`

**Intent**: The landing page and the one bridge into the demo.

**Contract**: `SiteFooter.astro:31` — _"Strefa pracownika"_ — is the **only** link from the public
site to the demo sign-in, and the highest-leverage string in the repo: an English-speaking recruiter
has no reason to recognize it. `SiteFooter.astro:86` keeps **Flota** as the brand, untranslated.
Landing components: `ProcessSteps.astro`, `TrustCard.astro`, `TypeSelector.astro`,
`LandingVehicleCard.astro`.

#### 3. Auth surfaces

**File**: `src/pages/auth/*.astro`, `src/components/auth/*`, `src/lib/auth-messages.ts`

**Intent**: Everything between the footer link and the cockpit.

**Contract**: 8 auth pages and 8 auth components. `auth-messages.ts:120-140` is the single seam where
GoTrue provider errors map to our copy — translating it there covers every auth error surface at
once. The demo-credentials card rendered into `/auth/signin` is on this path.

#### 4. Cockpit shell and Pulpit

**File**: `src/components/shell/StaffShell.astro`, `src/components/shell/NavIcon.astro`,
`src/pages/dashboard.astro`, `src/components/dashboard/{DispatchBoard,DispatchSchedule,StatCards,NeedDecisionPanel,QuickAddButton,QuickActionMenu}.tsx`,
`src/components/search/{GlobalSearch,SearchRows}.tsx`, `src/lib/dispatch-board.ts`,
`src/lib/staff-report.ts`

**Intent**: The first screen a recruiter sees after signing in, and the navigation around it.

**Contract**: Nav labels — Pulpit, Wnioski, Wydania, Zwroty, Zespół, Flota — carry no diacritics and
are invisible to diacritic-based extraction; enumerate them explicitly. The **Flota** nav item
becomes "Fleet" (frame decision 5) while the brand does not.

#### 5. Seed data

**File**: `supabase/seed.sql`

**Intent**: Seeded content is fixture data we control, not user-typed free text — so it should read
English under English chrome.

**Contract**: Vehicle names (e.g. `'Volkswagen Crafter 9-osobowy'`), notes and rejection reasons are
rewritten in English. **Retain two Polish rows deliberately** so the hybrid-document behaviour frame
decision 2 mandates stays visible and testable. Frame decision 2 is unchanged — it governs what real
users type, not fixtures. Note `known-issues.md:75`: the seeded `picsum.photos` URLs are a separate,
already-tracked issue and stay as-is.

#### 6. E2E re-anchor

**File**: `e2e/staff-auth.spec.ts`, `e2e/auth.setup.ts`, `e2e/fixtures/*`

**Intent**: Re-anchor this surface's ~22 Polish locators to English.

**Contract**: Land the copy change and run the suite red **first**, then rewrite the locators — a
spec rewritten alongside its strings gives no signal about which half is wrong. `auth.setup.ts` may
need the locale cookie seeded explicitly so the suite is deterministic rather than relying on the
default. `e2e-rules.md`'s literal-copy policy is preserved: locators keep literal strings, now
English ones. Recall that the invite/recovery specs only work on `:4321`.

### Success Criteria:

#### Automated Verification:

- Type check passes: `npx astro check`
- Lint passes: `npm run lint`
- Unit + integration tests pass: `npm test && npm run test:integration`
- E2E suite green against English: `npm run test:e2e`
- Catalog key parity holds for every namespace touched (type check covers this)

#### Manual Verification:

- **The acceptance test**: open the landing page cold, follow the footer link to sign-in, sign in
  with the demo account, land on Pulpit and navigate the nav — every string English, no Polish
  leakage
- Switching to Polish on any of those screens returns the previous copy exactly
- Seeded vehicle names read English on the landing featured cards and fleet catalog; the two retained
  Polish rows render correctly under English chrome
- The **Flota** brand still reads Flota in the header wordmark and footer while the nav item reads
  Fleet

**Implementation Note**: Pause here for manual confirmation before proceeding to Phase 5.

---

## Phase 5: Remaining App Copy

### Overview

The long tail — every surface off the recruiter path, plus the validation and API layers that no
screen owns.

### Changes Required:

#### 1. Remaining public pages

**File**: `src/pages/{fleet/index,fleet/[id]/[...slug],pricing,faq,about,reserve,r/[token]}.astro`,
`src/components/vehicle/*`, `src/components/reservation/*`

**Intent**: The catalog, vehicle detail, info pages and the reservation funnel.

**Contract**: `faq.astro:19,26-27,51,55`, `about.astro:55` and `pricing.astro:68` carry the
Polish-law facts frame decision 3 governs — translate the surrounding sentence, keep the Polish term
plus its gloss, never invent an English equivalent. 7 vehicle components and 3 reservation
components.

#### 2. Remaining dashboard screens

**File**: `src/pages/dashboard/{reservations,calendar,vehicles,vehicles/new,vehicles/[id]/edit,staff,pickups,pickups/[reservationId],returns,returns/[reservationId],protocols/[id],account,account/password}.astro`,
`src/components/dashboard/*`, `src/components/fleet/*`, `src/components/staff/*`,
`src/components/protocol/*`, `src/components/account/*`

**Intent**: Every remaining cockpit surface, including the protocol flow.

**Contract**: The protocol flow is the surface the frame identified as most needing to be legible —
9 protocol components including `ProtocolView.tsx:476`'s `Podpisał(a)`, whose gender-agreement
parenthetical has no English analogue and becomes a plain "Signed by". `SignaturePad.tsx:253-281` is
the one customer-touched dashboard screen (reached by being handed a device).

#### 3. Validation schemas

**File**: `src/lib/{reservation,protocol,return-protocol,vehicle}-schema.ts`, `src/lib/return-form.ts`

**Intent**: The zod `MSG` maps that are module-level constants with no locale parameter.

**Contract**: Each schema becomes a factory taking a locale, or its `MSG` map is looked up at
validation time through `useTranslations`. The schema stays the single validation source for client
**and** API per the RHF lesson — do not fork it. `reservation-schema.ts:24,82` (NIP) and `:34-37`
(the PL phone regex) keep their Polish-specific validation; only the messages localize.

#### 4. API messages

**File**: 17 route files under `src/pages/api/`

**Intent**: The `MSG` maps in every API route.

**Contract**: Each handler reads `context.locals.locale` and resolves its messages through
`useTranslations`. The self-gating order from the API lesson is unchanged — CSRF, auth, role, zod,
then the DB call; only the message bodies localize. The three routes without a `MSG` map are checked
for inline literals.

#### 5. Remaining lib labels

**File**: `src/lib/{protocol-labels,reservation-status,returns-filter,search-format,catalog-filters,manual-availability,config-status,auth-session,back-target,slug,services/staff,services/vehicles,media/compress,media/fonts}.ts`

**Intent**: The label modules that feed multiple screens.

**Contract**: Each exported label map gains a locale parameter. `slug.ts` needs care — if it
transliterates Polish diacritics for URL generation, that behaviour must **not** change, or existing
vehicle URLs break.

#### 6. E2E re-anchor

**File**: `e2e/{staff-admin,fleet-admin,quick-actions,auth-hardening,demo-gate,seed}.spec.ts`

**Intent**: Re-anchor the remaining ~67 Polish locators, 53 of them in `staff-admin.spec.ts`.

**Contract**: Same sequencing rule — copy first, red suite, then locators. Per surface, not all at
once.

### Success Criteria:

#### Automated Verification:

- Type check passes: `npx astro check`
- Lint passes: `npm run lint`
- Unit + integration tests pass: `npm test && npm run test:integration`
- Full E2E suite green against English: `npm run test:e2e`
- Build succeeds: `npm run build`
- No Polish diacritics remain in `src/**` outside catalog `pl` blocks and code comments — a scripted
  sweep, since `Start` / `Flota` / `Cennik` / `Pulpit` carry none and a diacritic grep alone
  undercounts

#### Manual Verification:

- Walk every dashboard route and every public page in English — no Polish leakage
- Walk the full protocol flow (issue → signature → PDF → return → comparison) in English
- Trigger a validation error on the reservation form, the vehicle form and the protocol form in both
  locales
- Trigger an API error (wrong role, duplicate plate) and confirm the message is localized
- Vehicle detail URLs are unchanged — no slug regression

**Implementation Note**: Pause here for manual confirmation before proceeding to Phase 6.

---

## Phase 6: Outbound Artifacts + Brand

### Overview

The artifacts a customer keeps. Locale comes from the **reservation**, not the sender's session —
which is what makes an employee working in English still email a Polish customer in Polish.

### Changes Required:

#### 1. Email templates

**File**: `src/lib/email/templates.ts`, `src/lib/email/index.ts`

**Intent**: Localize the 5 templates on the reservation's stored locale.

**Contract**: Every template function takes `locale` sourced from `reservations.locale`, never from
`context.locals.locale`. `templates.ts:135` renders `rejection_note` **verbatim** into the customer's
email — free text stays untranslated per frame decision 2, with localized chrome around it.
Subjects localize too. Note `templates.ts:170-173`'s own contract: _"this mail and its PDF attachment
are their ONLY copy of the evidence, possibly needed in a dispute months later."_

#### 2. Protocol PDF

**File**: `src/lib/media/protocol-pdf.ts`, `src/lib/services/protocols.ts`

**Intent**: Render the PDF in the reservation's locale and **stamp** what language it was rendered
in.

**Contract**: `protocol-pdf.ts:163` bakes title, labels and date format at signature time. Add
`locale` to the render call and persist it to `protocols.locale` at creation. **Never regenerate an
issued document** — `services/protocols.ts:242-253` re-signs the _existing_ object and must continue
to; the signature at `:290` sits directly beneath the declaration the customer actually signed.

Keep the Unicode TTF embedding regardless of locale (`registerFontkit` + `embedFont(..., {subset:
true})`) — an English PDF can still carry a Polish customer name or a Polish free-text damage note,
which is exactly the WinAnsi failure the PDF lesson records. The full diacritic set stays a test
fixture in **both** locales.

#### 3. GoTrue auth email

**File**: `supabase/templates/invite.html`, `supabase/templates/recovery.html`,
`supabase/config.toml:258,262`

**Intent**: Bilingual templates — one template carrying English above Polish (frame decision 6).

**Contract**: GoTrue renders one template per project per type, outside this codebase, so per-user
language is impossible without an auth-architecture change we are explicitly not making. Both
subjects become bilingual. The `token_hash` link structure must not change — S-08's rollout chain
records that a template regression surfaces as _"Link wygasł"_. **`config.toml` loads only on
`supabase stop && start`; never `supabase config push`.**

#### 4. Brand reconciliation

**File**: `src/lib/email/templates.ts:28,87,139,225,313`, `src/lib/media/protocol-pdf.ts:167,463`,
`public/robots.txt`

**Intent**: The brand is **Flota** everywhere (frame decision 5); emails and the PDF currently say
FleetRent.

**Contract**: 5 email subjects/bodies and 2 PDF footer sites change FleetRent → Flota. Check
`robots.txt`. `prd.md`, `roadmap.md` and the deployed hostname
`fleetrent.marcin-kulbicki.workers.dev` still say FleetRent — the hostname is not user-visible brand
and stays; annotate the divergence in the docs rather than renaming the deployment.

### Success Criteria:

#### Automated Verification:

- Type check passes: `npx astro check`
- Lint passes: `npm run lint`
- Unit tests pass, including `email/templates.test.ts` and `media/protocol-pdf.test.ts` asserting
  both locales: `npm test`
- Integration tests pass, including `protocol-email` and `return-protocol-email`:
  `npm run test:integration`
- A PDF render test with the full diacritic set (`ą ć ę ł ń ó ś ź ż` + uppercase) passes in **both**
  locales
- `grep -rn "FleetRent" src/ public/` returns nothing

#### Manual Verification:

- A reservation submitted in Polish produces a Polish confirmation email even when accepted from an
  English dashboard
- A reservation submitted in English produces an English email and PDF
- An issued PDF re-downloaded after switching locale is byte-identical to the original — not
  re-rendered
- `protocols.locale` records the correct language on newly issued protocols
- Invite and recovery emails arrive bilingual with working links (mint a link for a throwaway account
  — never complete a reset on `employee@` / `admin@fleetrent.test`, it rotates the password the
  suite signs in with)
- A Polish free-text damage note renders correctly inside an English PDF

**Implementation Note**: Pause here for manual confirmation before proceeding to Phase 7.

---

## Phase 7: `/terms` + Verification Pass

### Overview

Close the consent gap frame decision 4 identified, then prove the whole thing holds in both locales.

### Changes Required:

#### 1. Terms page

**File**: `src/pages/terms.astro`

**Intent**: `ReservationForm.tsx:70` asks customers to accept a _"regulamin wynajmu"_ that **does not
exist anywhere in the repo** — no route, no page, not even a link. Under "literally everything
English," this is a prerequisite, not a translation task.

**Contract**: A placeholder page rendering in both locales with **clearly-marked sample text** — the
gap becomes visible rather than hidden. Uses the standard public shell so the header switcher works.
`ReservationForm.tsx:70`'s checkbox links to it.

#### 2. Consent attribution

**File**: `src/pages/api/reservations.ts`, `src/lib/reservation-schema.ts`

**Intent**: Record which terms, in which language, a customer accepted.

**Contract**: On submission write `terms_version` (a constant exported alongside the page, bumped
when the text changes) and `terms_locale` (the active locale) beside the existing
`terms_accepted_at`. Also capture `reservations.locale` here — this is the funnel's only chance,
since confirmation emails are sent days later by staff who cannot know what language the customer
used.

#### 3. Polish smoke spec

**File**: `e2e/locale-pl.spec.ts`

**Intent**: The suite now runs English; Polish needs coverage that isn't merely "the default still
works."

**Contract**: One spec seeding the `pl` cookie and walking the recruiter path in reverse — landing →
footer → sign-in → Pulpit → one protocol screen — asserting Polish literals. Independent, with its
own setup and cleanup, unique ids per the E2E rules.

#### 4. Key-parity and leakage gates

**File**: `src/lib/i18n/parity.test.ts`

**Intent**: Make an untranslated key a failing test, not a silent fallback.

**Contract**: A unit test walking every namespace asserting `Object.keys(en)` and `Object.keys(pl)`
match exactly, and that no value in the `en` half contains a Polish diacritic. The type system
enforces parity at compile time; this catches the runtime shape and the copy-paste-forgot-to-translate
case the types cannot see.

### Success Criteria:

#### Automated Verification:

- Migration state is current: `npx supabase migration list --linked`
- Type check passes: `npx astro check`
- Lint passes: `npm run lint`
- Unit tests pass including the parity test: `npm test`
- Integration tests pass: `npm run test:integration`
- Full E2E suite green in English **and** the PL smoke spec green: `npm run test:e2e`
- Build succeeds: `npm run build`

#### Manual Verification:

- `/terms` renders in both locales, sample text clearly marked as placeholder
- The reservation checkbox links to it; submitting records `terms_version`, `terms_locale` and
  `reservations.locale`
- Full recruiter journey in English, then the same journey in Polish, both clean
- A rendered vision-diff of the header against the canonical mockups is empty minus recorded
  deviations
- Deployed to production: migrations pushed **and** verified with
  `supabase migration list --linked` (merging to main deploys the Worker but pushes **no**
  migrations — prod 500s on missing columns while unauthenticated probes still return 401)

---

## Testing Strategy

### Unit Tests:

- Locale resolution precedence: cookie > `profiles.locale` > default; unrecognised cookie falls back
- The Polish plural table via `Intl.PluralRules` — `1:one, 2:few, 5:many, 12:many, 13:many, 14:many,
22:few, 25:many` — kept as an explicit assertion so the migration is provably behaviour-preserving
- English plural selection — `1:one`, everything else `other`
- Date formatting in both locales with an explicit `Europe/Warsaw` timezone
- Money formatting: grouping separator is U+00A0 in both locales; `formatPlnAmount` returns the bare
  number with no currency suffix
- Catalog key parity per namespace, plus no-Polish-diacritics-in-`en`
- Email template rendering in both locales, with Polish free text embedded in an English template
- PDF rendering with the full diacritic set in both locales

### Integration Tests:

- A reservation created with `locale: 'pl'` produces a Polish email when accepted by a session whose
  locale is `en`
- `protocols.locale` is stamped at creation and an existing PDF is never re-rendered
- `POST /api/locale` rejects a foreign origin (403) and sanitizes the redirect target
- API error messages localize per `locals.locale`
- The ~64 Polish assertions across 15 integration files are updated as their surfaces land

### E2E Tests:

- Suite runs against **English** with the locale cookie seeded in `auth.setup.ts` for determinism
- ~89 locators re-anchored to English, per surface, **after** that surface's copy lands
- One PL smoke spec covering the recruiter path in reverse
- Literal-copy locators preserved — `getByRole` / `getByLabel` / `getByText`, no `getByTestId`, per
  `e2e-rules.md:9-10`
- `waitForIslands()` before interacting with any `client:*` island; never `waitForTimeout`

### Manual Testing Steps:

1. Cold visit as an English-speaking recruiter: landing → footer link → sign-in → Pulpit → protocol
   flow. No Polish anywhere.
2. Switch to Polish at each stage; confirm the page you were on is preserved and copy flips fully.
3. Sign in as staff, set a language preference, clear the cookie, reload — preference restored.
4. Submit a reservation in Polish; accept it from an English dashboard; confirm the email is Polish.
5. Issue a protocol in English, add a Polish free-text damage note, confirm the PDF renders both.
6. Re-download an issued PDF after switching locale; confirm it is unchanged.
7. Resize the public header through 1280 / 1180 / 980 / 840 / 768 / 390px; nothing overflows and
   `LangToggle` stays visible.

## Performance Considerations

Locale resolution adds **no round trip** — `locale` rides the existing `profiles` select in
`middleware.ts:33`, exactly as `is_demo` does.

The catalog is namespaced per domain specifically so React islands tree-shake. A flat catalog would
put every string in both locales into each of 14 island bundles. Verify after Phase 5 that island
chunk sizes have not grown materially; if one has, the namespace is too coarse and should be split.

Retiring `date-fns/locale`'s `pl` static import from 8 components removes that locale bundle from
those chunks. `Intl` is a runtime built-in with no bundle cost.

## Migration Notes

One migration adds five columns. The backfill is deliberately asymmetric: `reservations.locale`
defaults `'en'` for new rows but existing rows are stamped `'pl'`; `protocols.locale` defaults `'pl'`
because every stored PDF's bytes are provably Polish. `profiles.locale` is nullable — null means "no
preference," which resolves to the default rather than to Polish.

**Production sequencing is the known trap.** Merging to main auto-deploys the Worker but pushes **no**
migrations. The middleware select at `:33` gains `locale`; if the Worker ships before the migration,
that select 400s and the error branch nulls `role` for **every** staffer on **every** gated route —
app-wide lockout, with unauthenticated probes still returning 401 so it looks healthy from outside.
Push the migration first, then verify with `supabase migration list --linked`. The real prod project
ref is `fmgbyfpilgzvhkziigsj`.

Rollback: the columns are additive and nullable-or-defaulted, so reverting the Worker leaves a
harmless schema. `supabase/config.toml` changes need `supabase stop && start` locally and are applied
by hand on hosted — never `supabase config push`.

## References

- Frame brief: `context/changes/english-localization/frame.md`
- Design contract: `context/changes/english-localization/design-contract.md`
- Glossary: `context/changes/english-localization/glossary.md`
- Astro i18n recipe (dictionary + `useTranslations`): https://docs.astro.build/en/recipes/i18n
- Starlight `Astro.locals.t` precedent: https://starlight.astro.build/guides/i18n/
- `isDemo` threading precedent: `context/archive/2026-08-28-demo-account-gate/plan.md`,
  `src/middleware.ts:33,54`, `src/lib/access.ts:92-94`
- Locale/timezone lesson: `context/foundation/lessons.md` → "Locale/timezone/currency are
  single-locale"
- PDF encoding lesson: `context/foundation/lessons.md` → "Polish text breaks every Latin-1 / WinAnsi
  output path"
- API self-gating lesson: `context/foundation/lessons.md` → "API routes are outside middleware's
  gate"
- Tiering this supersedes: `context/foundation/known-issues.md` → "Single-locale by construction"

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not
> rename step titles. See `references/progress-format.md`.

### Phase 1: Locale Seam + Storage

#### Automated

- [ ] 1.1 Migration applies cleanly: `npx supabase db reset`
- [ ] 1.2 Type check passes: `npx astro check`
- [ ] 1.3 Lint passes: `npm run lint`
- [ ] 1.4 Unit tests pass: `npm test`
- [ ] 1.5 Integration tests pass: `npm run test:integration`
- [ ] 1.6 Build succeeds: `npm run build`
- [ ] 1.7 Unit test pins locale resolution precedence and unrecognised-cookie fallback

#### Manual

- [ ] 1.8 App renders identically to before — no visible copy or layout change
- [ ] 1.9 `<html lang>` reads `en`; `POST /api/locale` flips it and the cookie persists
- [ ] 1.10 Staff locale choice writes `profiles.locale` and survives a cleared cookie
- [ ] 1.11 Foreign-origin POST refused 403; external redirect target sanitized

### Phase 2: Retire Polish Grammar-as-Logic

#### Automated

- [ ] 2.1 Type check passes: `npx astro check`
- [ ] 2.2 Lint passes: `npm run lint`
- [ ] 2.3 Unit tests pass in both locales: `npm test`
- [ ] 2.4 Integration tests pass: `npm run test:integration`
- [ ] 2.5 E2E suite still green: `npm run test:e2e`
- [ ] 2.6 `grep -rn "date-fns/locale" src/` returns nothing
- [ ] 2.7 `grep -rn "pluralPl\|plForm\|MONTHS_PL\|PL_MONTHS" src/` returns nothing

#### Manual

- [ ] 2.8 Dates, money and counts render identically to before under `pl`
- [ ] 2.9 `/dashboard/pickups` reads "5 rezerwacji" not "5 rezerwacje"
- [ ] 2.10 Signature timestamp still shows Warsaw time
- [ ] 2.11 Booking widget and reservation summaries show the bare amount, no stray `zł`

### Phase 3: Header Redesign + Language Switcher

#### Automated

- [ ] 3.1 Type check passes: `npx astro check`
- [ ] 3.2 Lint passes: `npm run lint`
- [ ] 3.3 Build succeeds: `npm run build`
- [ ] 3.4 E2E suite green: `npm run test:e2e`
- [ ] 3.5 `grep -rn "HeaderContactToggle" src/` returns nothing

#### Manual

- [ ] 3.6 Vision-diff of `SiteHeader` vs canonical mockup at 6 widths — punch-list empty
- [ ] 3.7 No header overflow at any width, including previously-overflowing states
- [ ] 3.8 `LangToggle` visible and operable at every public breakpoint
- [ ] 3.9 Staff sidebar control and account row both persist the choice
- [ ] 3.10 Switching locale preserves the current page
- [ ] 3.11 Regression gate: no nav wrap / height change at 768–790px or 840px, interaction exercised
- [ ] 3.12 Regression gate: landing phone reachable at ≥1136px, no width left with no phone affordance
- [ ] 3.13 Matches `design-contract.md`

### Phase 4: Recruiter Path to English

#### Automated

- [ ] 4.1 Type check passes: `npx astro check`
- [ ] 4.2 Lint passes: `npm run lint`
- [ ] 4.3 Unit + integration tests pass
- [ ] 4.4 E2E suite green against English: `npm run test:e2e`
- [ ] 4.5 Catalog key parity holds for every namespace touched

#### Manual

- [ ] 4.6 Acceptance test: landing → footer → sign-in → Pulpit → nav, all English
- [ ] 4.7 Switching to Polish restores previous copy exactly
- [ ] 4.8 Seeded vehicle names read English; the two retained Polish rows render correctly
- [ ] 4.9 Brand reads Flota; nav item reads Fleet

### Phase 5: Remaining App Copy

#### Automated

- [ ] 5.1 Type check passes: `npx astro check`
- [ ] 5.2 Lint passes: `npm run lint`
- [ ] 5.3 Unit + integration tests pass
- [ ] 5.4 Full E2E suite green against English: `npm run test:e2e`
- [ ] 5.5 Build succeeds: `npm run build`
- [ ] 5.6 Scripted sweep finds no Polish outside catalog `pl` blocks and comments

#### Manual

- [ ] 5.7 Every dashboard route and public page walked in English — no leakage
- [ ] 5.8 Full protocol flow walked in English
- [ ] 5.9 Validation errors localize on reservation, vehicle and protocol forms
- [ ] 5.10 API errors localize
- [ ] 5.11 Vehicle detail URLs unchanged — no slug regression

### Phase 6: Outbound Artifacts + Brand

#### Automated

- [ ] 6.1 Type check passes: `npx astro check`
- [ ] 6.2 Lint passes: `npm run lint`
- [ ] 6.3 Unit tests pass including email and PDF specs in both locales
- [ ] 6.4 Integration tests pass including protocol-email specs
- [ ] 6.5 PDF renders the full diacritic set in both locales
- [ ] 6.6 `grep -rn "FleetRent" src/ public/` returns nothing

#### Manual

- [ ] 6.7 Polish reservation emails Polish even when accepted from an English dashboard
- [ ] 6.8 English reservation produces an English email and PDF
- [ ] 6.9 Issued PDF re-download is byte-identical — not re-rendered
- [ ] 6.10 `protocols.locale` stamped correctly on new protocols
- [ ] 6.11 Invite and recovery emails bilingual with working links (throwaway account only)
- [ ] 6.12 Polish free-text damage note renders inside an English PDF

### Phase 7: `/terms` + Verification Pass

#### Automated

- [ ] 7.1 Migration state current: `npx supabase migration list --linked`
- [ ] 7.2 Type check passes: `npx astro check`
- [ ] 7.3 Lint passes: `npm run lint`
- [ ] 7.4 Unit tests pass including the parity test
- [ ] 7.5 Integration tests pass
- [ ] 7.6 Full E2E green in English and the PL smoke spec green
- [ ] 7.7 Build succeeds: `npm run build`

#### Manual

- [ ] 7.8 `/terms` renders in both locales, sample text clearly marked
- [ ] 7.9 Checkbox links to it; submission records version, terms locale and reservation locale
- [ ] 7.10 Full recruiter journey clean in English and in Polish
- [ ] 7.11 Header vision-diff empty minus recorded deviations
- [ ] 7.12 Deployed: migrations pushed **and** verified with `supabase migration list --linked`
