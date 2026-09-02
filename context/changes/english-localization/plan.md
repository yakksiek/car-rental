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
   | `Intl.NumberFormat("en")` grouping separator                  | **U+002C (comma)** — not U+00A0         |
   | `Intl.NumberFormat("pl-PL").format(5900)`                     | **`5900`** — ungrouped, see below       |
   | `Intl.DateTimeFormat` with `timeZone:"Europe/Warsaw"`         | `12:49` from `10:49Z`                   |
   | `Intl.RelativeTimeFormat("pl-PL").format(-2,"day")`           | `przedwczoraj`                          |

   `Intl` reproduces every hand-rolled **grammar** behaviour, including the 12–14 plural exception
   **and** the nominative-vs-genitive month split that `ReservationCalendar.tsx:68-95` carries two
   tables for. Dates, plurals and relative time are a clean swap.

   **Number and currency formatting are NOT a clean swap** (plan-review F3, re-probed 2026-09-02).
   Three corrections to the original reading:
   - **Grouping threshold.** CLDR `pl` sets `minimumGroupingDigits = 2`, so `pl-PL` groups only at
     5+ integer digits: `1234 → "1234"`, `5900 → "5900"`, `10800 → "10 800"`. `format.ts` groups from
     4 digits and `format.test.ts:33` asserts `formatPln("5900.00") === "5 900 zł"`. A straight
     swap regresses the app's most common amounts. `{ useGrouping: "always" }` restores it and must
     be passed explicitly.
   - **`style:"currency"` changes more than the separator.** Under `pl` it forces two decimals
     (`5900 → "5900,00 zł"`), contradicting `formatPln`'s documented "whole amounts drop the decimal
     part". Under `en` it emits the ISO prefix `"PLN 1,234.50"`; even `currencyDisplay:"narrowSymbol"`
     gives `"zł 1,234.50"` — symbol _before_ the number. Preserving today's `"320 zł"` shape requires
     manual composition, not `style:"currency"`.
   - **The grouping character does NOT match across locales.** `format.ts:13`'s U+00A0 matches
     `pl-PL`; `en` / `en-US` / `en-GB` all group with a comma.

   **Consequence for `lessons.md`.** The standing lesson "Locale/timezone/currency are single-locale"
   still reads _"Mind workerd's trimmed ICU (why `returns.astro` hand-rolls Polish month names)"_
   (`lessons.md:78`). That premise is false — this probe disproves it, and Phase 2 deletes exactly
   those tables. Correcting that clause is a Phase 2 deliverable (§9), not a follow-up, or the next
   slice re-inherits the constraint.

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

**Test sequencing within each copy phase — all three test layers, not just E2E.** The specs are
re-anchored to English, and the copy they assert on changes in the same phase. Land the copy change
first and run the suite red, then rewrite that surface's assertions — never both in one commit. A
spec rewritten alongside its strings gives no signal about which half is wrong.

This holds identically for unit and integration specs (plan-review F6), and each phase's Changes
Required now names the ones it invalidates. The integration coupling is much smaller than the raw
diacritic count suggests: **6 assertions in 4 files**, not "~64 across 15" — the other files use
Polish as test-owned fixture data (`full_name: "Robert Zieliński"`,
`protocol-email.test.ts:51`'s `DAMAGE_LOCATION`), which is created by the test, never compared
against app copy, and must stay Polish.

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
readonly tuple for the switcher. Key parity between the `pl` and `en` halves must be a **type error**,
not a runtime fallback — the fallback exists for robustness in production, not as a licence to ship
an untranslated key.

```ts
// The parity constraint every namespace file is declared against.
export type Dict<T extends Record<string, string>> = { en: T; pl: Record<keyof T, string> };
```

**Two accessors, and the boundary between them is load-bearing** (plan-review F4). A single composed
accessor would defeat the per-domain namespacing this whole design exists for: bundlers tree-shake on
_exports_, not on object keys, so a module that merges every namespace pulls all of them into any
browser bundle that reaches it.

- **`locals.t("ns.key")` — composed, SERVER-ONLY.** Resolves against every namespace; used by
  `.astro` components, which ship no JavaScript. Falls back to `DEFAULT_LOCALE` on a missing key.
- **A named per-namespace accessor — for anything an island can reach.** Takes `locale` plus one
  namespace module and resolves within it. React islands import their own namespace and take
  `locale` as a prop; API routes and server-only `src/lib` modules may use either.

**The rule that makes it hold: a `src/lib` module that islands import never touches the composed
map.** Without a named island accessor the plan offers exactly one callable API, so an implementer
converting the 14 island `COPY` objects in Phase 5 has no correct option to reach for — the leak
becomes the path of least resistance rather than a slip. Nothing downstream would catch it: no phase
has a bundle-size gate, and Performance Considerations asks for a comparison against a baseline that
was never recorded. Record one before Phase 5.

**`src/lib/format.ts` is the file this rule is really about** — 11 islands import it. It splits along
a line already latent in the file:

- **Number arrangers** (`formatPlnAmount`, `formatPln`, `formatDailyRate`, `rentalDays`,
  `estimatedTotal`, `totalDueAtPickup`, `formatDuration`, `formatCargoDims`, `formatPayloadKg`,
  `pluralPl`) — the caller supplies any word, the helper arranges digits. `FleetList.tsx:150-160`
  already does this: `{formatPln(vehicle.daily_rate)}{COPY.perDay}`, number from the helper, word
  from the component — and pointedly does not call `formatDailyRate`. Most need nothing at all: `zł`
  and `" kg"` are units, identical in both locales. `formatDuration`'s plural noun takes injected
  forms (`plural(n, { one: t("day.one"), other: t("day.other") })`).
- **Vocabulary** (`categoryLabelPl`, `transmissionLabelPl`, `fuelLabelPl`, `rejectionReasonLabelPl`,
  `reservationStatusLabelPl`) — pure dictionaries with no formatting logic; `format.ts:162` is
  literally `return CATEGORY_LABELS_PL[category]`. Injecting a whole map is "import the namespace"
  with worse ergonomics. These five move **out** to a catalog namespace (`src/lib/i18n/vehicle.ts`),
  imported per-domain by whoever needs them.

After the split `format.ts` has no reason to reach the catalog at all — the leak stops existing
rather than being governed by a rule 157 files must remember, and `format.ts` stays a pure numeric
module, which is what makes `format.test.ts` the straightforward unit suite it is today.

#### 2. Middleware resolution

**File**: `src/middleware.ts`

**Intent**: Resolve the locale once per request and attach it plus a bound translator to
`context.locals`, mirroring how `isDemo` is resolved.

**Contract**: Read the `locale` cookie; if absent and the user has a profile, use `profiles.locale`;
otherwise `DEFAULT_LOCALE`. Add `locale` to the existing `profiles` select at `:33` (no extra round
trip). Set `context.locals.locale` and `context.locals.t`. Resolution must run **before** the access
gate so a redirect can carry the locale, and must never throw — an unrecognised cookie value falls
back to the default rather than erroring.

**One carve-out: the `profiles.locale` fallback is SKIPPED when the row is the demo account.** Read
`is_demo` and `locale` off the same row (both already in the select), and when `is_demo` is true go
straight to `DEFAULT_LOCALE`, ignoring the stored value. Every demo visitor shares one `profiles`
row, so without this the first person to touch the switch sets the language for every recruiter who
signs in afterwards — which is precisely the acceptance test ("reads English from CV link to
sign-out with zero interaction"). The cookie still governs within a session, so a demo visitor's
switch works exactly as it does for real staff; only the cross-visitor carry-over is cut.

**This pairs with a deliberate non-gate in §6 — comment BOTH sites as a pair.** `set_profile_locale`
writes for the demo account like any other, so the demo behaves identically to a real account for
anyone inspecting it; this read-side skip is the only thing preventing the leak. A stored value that
nothing reads is exactly the kind of thing a later change "cleans up", so each site must name the
other in a comment: remove the skip and the leak returns silently, with no test failing unless
`1.16` below is in place.

#### 3. Locals declaration

**File**: `src/env.d.ts`

**Intent**: Declare the two new `App.Locals` fields.

**Contract**: `locale: import("./lib/i18n/types").Locale` (non-nullable, defaulted — never `null`,
same rule as `isDemo`) and `t: ReturnType<typeof useTranslations>`.

#### 4. Document language

**File**: `src/layouts/Layout.astro`, `src/lib/config-status.ts`

**Intent**: Stop hardcoding `lang="pl"`, and translate the default page title and the missing-config
banner copy.

**Contract**: `<html lang={Astro.locals.locale}>` at `:17`. The default title at `:13` keeps **Flota**
as the brand (untranslated) with only the tagline localized. `Uwaga:` / `Dokumentacja` at `:52,58`
move into the catalog.

**`src/lib/config-status.ts` converts here too** (plan-review F9), not in Phase 5. `configStatuses`
and `missingConfigs` are module-level exported const arrays with Polish `message` and `docsLabel`
strings baked in, consumed as _values_ at `Layout.astro:45`. Making them locale-aware is a
value→function conversion (`missingConfigs(locale)`), not a parameter add — and doing it alongside
the banner chrome keeps the whole banner from rendering half-translated for four phases.

#### 5. Locale switch endpoint

**File**: `src/pages/api/locale.ts`

**Intent**: Set the locale cookie server-side and persist it to `profiles.locale` for signed-in staff.

**Contract**: `POST` only. Self-gates per the API lesson: (a) same-origin CSRF check → 403, (b) zod
parse of `{ locale, redirect }` → 400. Deliberately **public** (no auth gate) — an anonymous visitor
must be able to switch; say so in a comment. `redirect` is validated through the existing
`safeRedirectPath` so a tampered value can only resolve to an internal path. When
`context.locals.user` is set, also persist the preference by calling the `set_profile_locale(text)`
RPC from §6; a direct `.from("profiles").update(…)` **cannot work** and fails silently. Cookie uses
the shared `shouldSecureCookies(context.url)` rule, `sameSite: "lax"`, one-year max-age. Responds
303 to the validated path.

**`redirect` gets its own guard — do NOT reuse `safeRedirectPath`** (plan-review F8). That helper
carries two guarantees built for post-login redirects that are wrong here: it returns
`DEFAULT_POST_LOGIN` (`/dashboard`) for anything it rejects (`safe-redirect.ts:10,20`), and it
explicitly refuses `/auth` and `/auth/*` (`:25-27`) so sign-in never bounces to itself. The recruiter
path runs through `/auth/signin`, so switching there would throw an anonymous visitor at
`/dashboard`; on `/auth/reset-password` and `/auth/callback` it also drops the URL's
`token_hash`/`type` params and strands a mid-invite-accept user. Criteria 3.10 and 4.7 ("switching
locale preserves the current page") cannot pass on any auth page otherwise. Write a small sibling
with the same open-redirect rules — leading `/`, reject `//` and `/\` — falling back to `/` and
**not** excluding `/auth/*`. Leave `safeRedirectPath` untouched: its `/auth` refusal is load-bearing
for sign-in. (`back-target.ts:46-49` already works around the same fallback, and even that idiom
would not admit `/auth/*`.)

#### 6. Migration

**File**: `supabase/migrations/<timestamp>_locale_dimension.sql`

**Intent**: Add the three locale columns plus the consent-attribution columns frame decision 4
requires — **and** open the five write paths that would otherwise leave every one of them unfillable.

**Contract**: `profiles.locale text` (nullable — null means "no preference, use default");
`reservations.locale text not null default 'en'`; `protocols.locale text not null default 'pl'`;
`reservations.terms_version text` and `reservations.terms_locale text` beside the existing
`terms_accepted_at`. A `check` constraint pins each to `('en','pl')`.

**Adding the columns is the easy half — none of them is writable without SQL changes in this same
migration** (plan-review F1). Five write paths, all of them below the TypeScript layer:

1. **`profiles.locale`** — deliberately **not** demo-gated (see §2: the read side skips the demo
   row instead, so the write can stay uniform). There is exactly one UPDATE policy on the table,
   `profiles_update_authenticated` (`20260604153139_employee_admin_roles.sql:80-84`, tightened at
   `20260828140000_demo_account_write_gate.sql:86-94`), and it is
   `using (current_app_role() = 'admin' and not current_is_demo())`. There is **no** "update your own
   row" clause, so an employee matches nothing and the demo account is explicitly excluded — and an
   RLS-denied UPDATE is not an error, it is a successful update of zero rows. Add
   `set_profile_locale(p_locale text)`: `SECURITY DEFINER`, no target parameter, stamps `auth.uid()`'s
   own row only — the shape `mark_password_set()` already uses. Every existing `profiles` write in
   the repo goes through the service-role client for this same reason.
2. **`create_reservation_request`** — the public funnel's atomic write, called at
   `services/reservations.ts:50`. Its `insert into public.reservations (…)` column list is fixed
   (`20260810140000_reservation_date_order_guard.sql:185-193`). Add `p_locale`, `p_terms_version`,
   `p_terms_locale`.
3. **`create_confirmed_reservation`** — the staff manual-booking sibling
   (`services/reservations.ts:102`). Add `p_locale`. It returns an email payload and mails the
   customer, so this path needs a language as much as the funnel does.
4. **`create_protocol`** — issue protocol (`20260716120000_return_protocol.sql:129-136`).
   Add `p_locale`.
5. **`create_return_protocol`** — return protocol (`:456-463`). Add `p_locale`.

**Every redefinition carries the standing RPC lesson**: `revoke execute on function … from public,
anon;` **first**, then grant to the roles that need it — per function, every time. A
`grant execute … to authenticated` alone restricts nothing.

**Backfill is asymmetric and deliberate**: existing `reservations` and `protocols` rows are stamped
`'pl'` — they were created by a Polish-only app, and for `protocols` the stored PDF bytes are
provably Polish. The column _defaults_ differ from the backfill (`reservations` defaults `'en'` for
new rows; `protocols` defaults `'pl'` and is always written explicitly at render time). No RLS policy
changes — the columns ride existing row grants, and `set_profile_locale` is the seam that makes
`profiles` writable without widening the admin-only policy.

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
- Baseline island chunk sizes recorded to `island-baseline.md` from a production build, taken
  **before** any catalog string lands, stamped with its commit SHA

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

**File**: `src/lib/format.ts`, `src/lib/return-form.ts`, `src/lib/protocol-form.ts`,
`src/lib/media/protocol-pdf.ts`

**Intent**: Stop baking `zł` and `/doba` into the formatter, and unify the four independent
thousands-groupers.

**Contract**: `formatPln` / `formatPlnAmount` / `formatDailyRate` gain a `locale` parameter. The
currency stays PLN in both locales (the business is Polish), and `zł` therefore stays in both — it is
a currency symbol, not a translatable word. `groupThousands` and `PLN_GROUP_SEPARATOR` are replaced
by `Intl.NumberFormat`, but **compose the amount manually rather than using `style:"currency"`**,
and pass `{ useGrouping: "always" }` — see Current State Analysis item 1. The target output is
unchanged from today in both locales: `"320 zł"`, `"5 900 zł"`, `"1,20 zł"` under `pl`, and the same
shapes under `en` with `Intl`'s own separators. **Criterion 2.8 ("renders identically to before under
`pl`") is the gate on this**, and a naive `style:"currency"` swap fails it.

**There are FOUR hand-rolled groupers, not one, using THREE different separators** (plan-review F5).
"`groupThousands` is deleted" is safe only for money; enumerate all of them:

| location                            | separator | behind                                            |
| ----------------------------------- | --------- | ------------------------------------------------- |
| `src/lib/format.ts:13,23`           | U+00A0    | money **and** `formatPayloadKg` (`format.ts:150`) |
| `src/lib/return-form.ts:18-19`      | U+0020    | `formatKmDriven` (`:34`)                          |
| `src/lib/protocol-form.ts:32-38`    | U+202F    | `formatOdometer`, with an inverse `parseOdometer` |
| `src/lib/media/protocol-pdf.ts:528` | U+00A0    | the PDF odometer                                  |

- **Deleting `format.ts:23` breaks the kg path** unless `formatPayloadKg` moves to
  `Intl.NumberFormat` in the same edit — it has 4 call sites: `VehicleCard.astro:46`,
  `LandingVehicleCard.astro:43`, `VehicleDetail.astro:37`, `src/pages/fleet/index.astro:197`.
- **`protocol-form.ts` is a format→parse round trip.** `parseOdometer` is the inverse of
  `formatOdometer` (`display.replace(/\D/g,"")`), so the two must change together or the odometer
  field stops reading its own output. This file was in no phase's list before.
- Whether the three non-money groupers converge on one shared `Intl` helper or merely stop being
  hand-rolled is an implementation call; what matters is that none is left asserting a separator the
  others don't use.

The `/doba` suffix **leaves `format.ts` entirely** rather than being looked up from inside it — see
Phase 1 §1's island rule. It is duplicated in **6 places** outside `format.ts:52` and each needs a
catalog string: `BookingWidget.tsx:42`, `FleetList.tsx:74`, `ReservationForm.tsx:349`,
`PendingQueue.tsx:361`, `pricing.astro:169,231`. `formatDailyRate` either takes the suffix as an
argument or is deleted in favour of the composition `FleetList` already uses — check its remaining
callers to decide.

**Watch the two regex strippers**: `src/components/vehicle/BookingWidget.tsx:353` and
`src/components/reservation/ReservationForm.tsx:658` do `.replace(/\s*zł$/,"")` to restyle the
amount. Once currency is locale-aware these break silently under EN. Replace them with
`formatPlnAmount` (which already returns the bare number) rather than extending the regex — **and
note both render a hardcoded `zł` span on the very next line** (`BookingWidget.tsx:355`,
`ReservationForm.tsx:659`), which the strip fix alone leaves behind.

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

**File**: `src/lib/format.test.ts`, `src/lib/staff-format.test.ts`, **`src/lib/search-format.test.ts`**,
**`e2e/seed.spec.ts`**, and the ~20 other affected specs

**Intent**: Parameterize the ~170 Polish assertions by locale.

**Contract**: Every deleted helper's spec is rewritten against the replacement, asserting **both**
locales. The Polish plural table (`1:one, 2:few, 5:many, 12:many, 13:many, 14:many, 22:few, 25:many`)
is kept as an explicit test case — `Intl` supplies it now, but the assertion is what proves the
migration preserved behaviour rather than silently changing it.

**Two specs break in this phase even though no copy changes** (plan-review F2), because they consume
the helpers being deleted rather than the strings being translated:

- `src/lib/search-format.test.ts:14,18` asserts `"02 – 09 kwi"` / `"28 kwi – 03 maj"`, built from
  `MONTHS_ABBR_PL` — deleted by §1.
- `e2e/seed.spec.ts:55` builds its day-button locator names with
  `format(…, { locale: pl })` from `date-fns/locale` — the exact import §4 removes and criterion 2.6
  greps for. This is the one E2E spec this phase touches; the other six are Phase 4/5 work.

#### 9. Correct the trimmed-ICU lesson

**File**: `context/foundation/lessons.md`

**Intent**: The premise this phase acts on is still recorded as true in the durable register.

**Contract**: `lessons.md:78` ("Locale/timezone/currency are single-locale") ends with _"Mind
**workerd's trimmed ICU** for server-side locale formatting (why `returns.astro` hand-rolls Polish
month names)."_ That is false — probed 2026-09-01 and re-probed 2026-09-02 — and this phase deletes
the very tables it points at. Replace the clause with the probed result and the number/currency
caveats from Current State Analysis item 1. Leave the rest of the lesson intact: the explicit
`timeZone` rule and the SSR hydration-mismatch reasoning are unaffected and still correct.

### Success Criteria:

#### Automated Verification:

- Type check passes: `npx astro check`
- Lint passes: `npm run lint`
- Unit tests pass in both locales: `npm test`
- Integration tests pass: `npm run test:integration`
- E2E suite green after `seed.spec.ts`'s date locators are re-anchored (no app copy changes in this
  phase, but §8 covers the two specs that consume the deleted helpers): `npm run test:e2e`
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

**File**: `src/pages/auth/*.astro` (including `link-conflict.astro:49`), `src/components/auth/*`
(including `SignOutButton.tsx:26`), `src/lib/auth-messages.ts`, `src/lib/auth-messages.test.ts`

**Intent**: Everything between the footer link and the cockpit.

**Contract**: 8 auth pages and 8 auth components. `auth-messages.ts:120-140` is the single seam where
GoTrue provider errors map to our copy — translating it there covers every auth error surface at
once. The demo-credentials card rendered into `/auth/signin` is on this path.

#### 4. Cockpit shell and Pulpit

**File**: `src/components/shell/StaffShell.astro`, `src/components/shell/NavIcon.astro`,
`src/pages/dashboard.astro`, `src/components/dashboard/{DispatchBoard,DispatchSchedule,StatCards,NeedDecisionPanel,QuickAddButton,QuickActionMenu}.tsx`,
`src/components/dashboard/quick-actions.ts`,
`src/components/search/{GlobalSearch,SearchRows}.tsx`, `src/lib/dispatch-board.ts`,
`src/lib/staff-report.ts`, `src/lib/staff-report.test.ts`,
`src/components/dashboard/quick-actions.test.ts`

**Intent**: The first screen a recruiter sees after signing in, and the navigation around it.

**Contract**: The staff chrome strings carry no diacritics and are invisible to diacritic-based
extraction, so here is the full list (plan-review F10) — `StaffShell.astro:110-126` plus the chrome
around it: **Pulpit** (`:111`), **Wnioski** (`:112`), **Wydania** (`:113`), **Zwroty** (`:117`),
**Kalendarz** (`:121`), **Flota** (`:122`), **Zespół** (`:126`, admin-only), the sidebar section
heading **Operacje** (`:153`), **Profil** (`:201,202,341`) and **Wyloguj** (`:223,238`). The **Flota** nav item
becomes "Fleet" (frame decision 5) while the brand does not.

`QuickActionMenu.tsx` renders its labels from `src/components/dashboard/quick-actions.ts:35,92`
(`"Nowa rezerwacja"`, `"Dodaj pracownika"`) — the strings are not in the component, so the module and
its spec are listed above (plan-review F6).

#### 5. Seed data

**File**: `supabase/seed.sql`

**Intent**: Seeded content is fixture data we control, not user-typed free text — so it should read
English under English chrome.

**Contract**: **Vehicle `name` values only** — e.g. `'Volkswagen Crafter 9-osobowy'`. `seed.sql`
carries **no `notes` and no `rejection_note` values at all** (plan-review F7), so the earlier wording
named data that does not exist. **Retain two vehicle rows with Polish names deliberately** so the
hybrid-document behaviour frame decision 2 mandates stays visible and testable; name them here when
the seed is written so criterion 4.8 has a subject.

The one piece of seeded Polish free text is `protocol_damages.location` (`seed.sql:380,387`) — that
stays Polish, both because frame decision 2 governs it and because it is the diacritic fixture the
PDF path is proved against. Frame decision 2 is otherwise unchanged: it governs what real users
type, not fixtures. Note `known-issues.md:75`: the seeded `picsum.photos` URLs are a separate,
already-tracked issue and stay as-is.

**No slug risk from this rename.** `vehicleSlug` is called as
`vehicleSlug(vehicle.make ?? vehicle.name, vehicle.model ?? "")` at all three sites
(`VehicleCard.astro:33`, `LandingVehicleCard.astro:32`, `fleet/[id]/[...slug].astro:45`), and all 7
seeded rows have non-null Latin `make`/`model`. `name` is only a fallback, and
`fleet/[id]/[...slug].astro:13-14` resolves by `id` regardless.

#### 6. E2E re-anchor

**File**: `e2e/staff-auth.spec.ts`, `e2e/auth.setup.ts`, `e2e/fixtures/*`, **`e2e/staff-admin.spec.ts`**,
**`e2e/auth-hardening.spec.ts`**, **`e2e/quick-actions.spec.ts`**, **`e2e/demo-gate.spec.ts`**

**Intent**: Re-anchor this surface's Polish locators to English.

**Contract**: Land the copy change and run the suite red **first**, then rewrite the locators — a
spec rewritten alongside its strings gives no signal about which half is wrong. `auth.setup.ts` may
need the locale cookie seeded explicitly so the suite is deterministic rather than relying on the
default. `e2e-rules.md`'s literal-copy policy is preserved: locators keep literal strings, now
English ones. Recall that the invite/recovery specs only work on `:4321`.

**Four specs Phase 5 would otherwise own belong here** (plan-review F2) — they assert on copy THIS
phase changes, so leaving them to Phase 5 makes criterion 4.4 unreachable:

- `staff-admin.spec.ts` — `:43` `"Nowe"` and `:44` `/Dodaj pracownika/` inside `openAddEmployee`
  (used by 5 tests); `:118,119,123-125` the `ResetPasswordForm` strings; `:131-133` the `SignInForm`
  strings; `:134` `"Wyloguj"` from `StaffShell`.
- `auth-hardening.spec.ts` — `:70,81,96,109,122,150,151,159,160,194,198,199`.
- `quick-actions.spec.ts` — `:46` `"Nowe"`, `:48` `/Nowa rezerwacja/`. The whole spec is two clicks,
  both on Phase-4 strings.
- `demo-gate.spec.ts` — `:63,80` `"Wyloguj"`, the live-session precondition for both tests.

`fleet-admin.spec.ts` genuinely stays in Phase 5 — every locator in it is Phase-5 fleet copy.

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

**File**: 17 route files under `src/pages/api/`, `tests/integration/staff.test.ts`

**Intent**: The `MSG` maps in every API route.

**Contract**: Each handler reads `context.locals.locale` and resolves its messages through
`useTranslations`. The self-gating order from the API lesson is unchanged — CSRF, auth, role, zod,
then the DB call; only the message bodies localize. The three routes without a `MSG` map are checked
for inline literals.

#### 5. Remaining lib labels

**File**: `src/lib/{protocol-labels,reservation-status,returns-filter,search-format,catalog-filters,manual-availability,auth-session,back-target,slug,services/staff,services/vehicles,media/compress,media/fonts}.ts`,
`src/components/hooks/*`, `docs/reference/contract-surfaces.md`

**Intent**: The label modules that feed multiple screens.

**Contract**: Each exported label map gains a locale parameter. `slug.ts` needs care, but the
trigger is **editing `slug.ts` itself**, not the Phase 4 seed rename (plan-review F7): its 9-entry
lowercase `DIACRITICS` map exists for user-entered vehicles, and no spec, fixture or stored column
holds a slug value. Leave the transliteration behaviour alone.

**Four of these modules are named contract surfaces** (plan-review F9). "Gains a locale parameter" is
a shape change to load-bearing exports, so state the new signature per export and update
`docs/reference/contract-surfaces.md` in the same commit:

- `catalog-filters.ts` — `parseFilters` / `serializeFilters` / `validateDateRange`
- `auth-session.ts` — `readPendingToken` / `serializePendingToken` / `selectResetPasswordBranch`
- `services/staff.ts` — the 7 named exports plus `employeeInviteSchema`
- `services/vehicles.ts` — `listVehicles` / `searchAvailableVehicles` / `getVehicleById`

**`src/components/hooks/` was previously unowned.** Most of its Polish is comments, but
`useProtocolMedia.ts:228` throws a user-reachable `` `Brak pliku w pamięci: ${path}` ``.

**`config-status.ts` moved to Phase 1 §4** — it is not a label map. `configStatuses` and
`missingConfigs` are module-level const arrays consumed as _values_ by `Layout.astro:45`, so making
them locale-aware is a value→function conversion, and Phase 1 already translates the banner chrome
around them.

#### 6. E2E re-anchor

**File**: `e2e/fleet-admin.spec.ts`, plus any Phase-5 surface locators remaining in
`e2e/staff-admin.spec.ts` after Phase 4 §6

**Intent**: Re-anchor the remaining Polish locators on Phase-5 surfaces.

**Contract**: Same sequencing rule — copy first, red suite, then locators. Per surface, not all at
once. `quick-actions`, `auth-hardening`, `demo-gate` and `seed` moved out of this list — the first
three to Phase 4 §6 and `seed` to Phase 2 §8 (plan-review F2), because each asserts on copy or
helpers those earlier phases change. `fleet-admin.spec.ts` is genuinely Phase-5 work:
`"Pokaż wycofane"`, `"Przywróć"`, `"Wycofaj"`, `"Wycofać pojazd z floty?"`. Note its `:58` comment
reasons about the seeded `Fiat Ducato (wycofany)` sort order — English seed names keep
`e2e/fixtures/booking.ts:127`'s deliberate `Ż` prefix sorting last, so the behaviour survives, but
the comment goes stale and should be refreshed.

### Success Criteria:

#### Automated Verification:

- Type check passes: `npx astro check`
- Lint passes: `npm run lint`
- Unit + integration tests pass: `npm test && npm run test:integration`
- Full E2E suite green against English: `npm run test:e2e`
- Build succeeds: `npm run build`
- Island chunk sizes compared against `island-baseline.md`; no island has grown materially. A jump on
  a public-site island (`HeroSearch`, `FleetList`, `BookingWidget`) means something reached the
  composed map — find it before shipping, per Phase 1 §1's boundary rule
- No Polish diacritics remain in `src/pages/**` and `src/components/**` outside catalog `pl` blocks
  and code comments — a scripted sweep, since `Start` / `Flota` / `Cennik` / `Pulpit` carry none and
  a diacritic grep alone undercounts. **Scoped to those two trees deliberately** (plan-review F9):
  `src/lib/email/templates.ts` (42 diacritic lines) and `src/lib/media/protocol-pdf.ts` (16) are
  Phase 6 work, so the full `src/**` sweep is a Phase 6 criterion, not this one.

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

**File**: `src/lib/email/templates.ts`, `src/lib/email/index.ts`,
`tests/integration/{protocol-email,return-protocol-email,return-protocols-api}.test.ts`

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
`src/components/shell/StaffShell.astro:122,143`, `public/robots.txt`

**Intent**: The brand is **Flota** everywhere (frame decision 5); emails and the PDF currently say
FleetRent.

**Contract**: 5 email subjects/bodies and 2 PDF footer sites change FleetRent → Flota. Check
`robots.txt`. **`StaffShell.astro` holds both halves of the brand/nav collision in one file**
(plan-review F10): `:143` is the brand wordmark `Flota` and must NOT translate, while `:122` is the
nav item and becomes "Fleet" in Phase 4 §4 — neither was in the plan's brand or nav lists. `prd.md`, `roadmap.md` and the deployed hostname
`fleetrent.marcin-kulbicki.workers.dev` still say FleetRent — the hostname is not user-visible brand
and stays; annotate the divergence in the docs rather than renaming the deployment.

#### 5. Reservation locale capture — both creation paths

**Land this BEFORE §1.** Every template in §1 reads `reservations.locale`, and until something
writes it every row carries the column default `'en'` — so §1's Polish-customer behaviour is
unverifiable and manual check 6.7 cannot pass. (Moved here from Phase 7 §2 by plan-review F1: the
capture used to sit two phases after the code that depends on it.)

**File**: `src/pages/api/reservations.ts`, `src/lib/services/reservations.ts`,
`src/pages/api/reservations/manual.ts`, `src/components/dashboard/ManualReservationModal.tsx`,
`src/lib/reservation-schema.ts`

**Intent**: Stamp the language on the reservation at creation, on **both** paths — the public funnel
and the staff manual booking. The RPC parameters this needs already exist from Phase 1 §6.

**Contract**:

- **Public funnel** — pass `context.locals.locale` as `p_locale` to `create_reservation_request`.
  This is the funnel's only chance: confirmation emails are sent days later by staff who cannot know
  what language the customer used.
- **Manual booking** — `ManualReservationModal` gains a **customer-language field** (PL / EN),
  threaded through `manualReservationSchema` and `createConfirmedReservation` as `p_locale`. It must
  not default to the employee's session locale: an employee working in the English cockpit booking a
  Polish walk-in is exactly the case the whole `reservations.locale` design exists to serve, and
  `api/reservations/manual.ts:99` mails that customer immediately. Default the field to **`pl`** —
  a walk-in at a Polish depot is the common case — so the field is a correction, not a chore.

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
- The full sweep now passes: no Polish diacritics anywhere in `src/**` outside catalog `pl` blocks
  and code comments (deferred here from Phase 5 — plan-review F9)

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

**Contract**: On submission pass `terms_version` (a constant exported alongside the page, bumped when
the text changes) and `terms_locale` (the active locale) to `create_reservation_request` as
`p_terms_version` / `p_terms_locale`, landing beside the existing `terms_accepted_at`. The RPC
parameters exist from Phase 1 §6.

`reservations.locale` capture is **no longer here** — it moved to Phase 6 §5 (plan-review F1),
because Phase 6's email templates read it and cannot be verified without it. This section now covers
consent attribution only.

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
- Money formatting: grouping separator is U+00A0 under `pl` and U+002C under `en`; `pl` groups from
  4 digits only because `useGrouping: "always"` overrides CLDR's `minimumGroupingDigits = 2`
  (`formatPln("5900.00")` stays `"5 900 zł"`); whole amounts still drop the decimal part in both
  locales; `formatPlnAmount` returns the bare
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
- The integration assertions that actually compare against app copy — 6 across 4 files — are updated
  in the phase that changes their surface, and are listed in that phase's Changes Required:
  `staff.test.ts:703,841` (Phase 5), `protocol-email.test.ts:197,221`,
  `return-protocol-email.test.ts:209,234`, `return-protocols-api.test.ts:292` (Phase 6). The other
  Polish in `tests/integration/` is test-owned fixture data and stays Polish.

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
put every string in both locales into each of 14 island bundles. The two-accessor boundary in
Phase 1 §1 is what keeps that true; this section is how it gets _proved_ rather than asserted.

**Record the baseline in Phase 1, before any catalog string lands** (plan-review F4) —
`npm run build`, then the per-chunk byte sizes of `dist/_worker.js/_astro/*.js` for the island
entrypoints, written to `context/changes/english-localization/island-baseline.md` with the commit
SHA it was taken at. Phase 5 compares against that file. Without it, "have not grown materially" has
nothing to measure against and the check silently passes whatever happens — which is exactly how a
composed-map leak would reach production unnoticed.

The islands to record, being the ones that import `src/lib/format.ts` or `staff-format.ts` and are
therefore most exposed if the boundary leaks: `BookingWidget`, `HeroSearch`, `ReservationForm`,
`SearchRows`, `PendingQueue`, `NeedDecisionPanel`, `ManualReservationModal`, `FleetList`,
`ManualReservationCalendar`, `VehicleForm`, plus `GlobalSearch` and `StaffList`. If one has grown
materially, the namespace is too coarse — or something reached the composed map.

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

- [x] 1.1 Migration applies cleanly: `npx supabase db reset` — 7fe5b43
- [x] 1.2 Type check passes: `npx astro check` — 7fe5b43
- [x] 1.3 Lint passes: `npm run lint` — 7fe5b43
- [x] 1.4 Unit tests pass: `npm test` — 7fe5b43
- [x] 1.5 Integration tests pass: `npm run test:integration` — 7fe5b43
- [x] 1.6 Build succeeds: `npm run build` — 7fe5b43
- [x] 1.7 Unit test pins locale resolution precedence and unrecognised-cookie fallback — 7fe5b43
- [x] 1.12 Integration test proves `set_profile_locale` stamps an EMPLOYEE's own row (not just an admin's) — 7fe5b43
- [x] 1.13 Each redefined RPC carries `revoke execute … from public, anon` before its grant — 7fe5b43
- [x] 1.15 Baseline island chunk sizes recorded to `island-baseline.md` with its commit SHA — 7fe5b43
- [x] 1.16 Integration test: a demo-account locale write does NOT change what a fresh cookie-less demo session resolves to — 7fe5b43

#### Manual

- [x] 1.8 App renders identically to before — no visible copy or layout change — 7fe5b43
- [x] 1.9 `<html lang>` reads `en`; `POST /api/locale` flips it and the cookie persists — 7fe5b43
- [x] 1.10 Staff locale choice writes `profiles.locale` and survives a cleared cookie — 7fe5b43
- [x] 1.11 Foreign-origin POST refused 403; external redirect target sanitized — 7fe5b43
- [x] 1.14 Signed in as an EMPLOYEE (not admin), the preference persists across a cleared cookie — 7fe5b43
- [x] 1.17 Demo: switch to PL, sign out, clear cookies, sign back in — cockpit is English again — 7fe5b43

### Phase 2: Retire Polish Grammar-as-Logic

#### Automated

- [x] 2.1 Type check passes: `npx astro check` — f807e24
- [x] 2.2 Lint passes: `npm run lint` — f807e24
- [x] 2.3 Unit tests pass in both locales: `npm test` — f807e24
- [x] 2.4 Integration tests pass: `npm run test:integration` — f807e24
- [x] 2.5 E2E suite still green: `npm run test:e2e` — f807e24
- [x] 2.6 `grep -rn "date-fns/locale" src/` returns nothing — f807e24
- [x] 2.7 `grep -rn "pluralPl\|plForm\|MONTHS_PL\|PL_MONTHS" src/` returns nothing — f807e24
- [x] 2.12 `search-format.test.ts` and `e2e/seed.spec.ts` re-anchored off the deleted date helpers — f807e24
- [x] 2.14 All four thousands-groupers unified; `formatPayloadKg` and `parseOdometer` still round-trip — f807e24

#### Manual

- [x] 2.8 Dates, money and counts render identically to before under `pl` — f807e24
- [x] 2.9 `/dashboard/pickups` reads "5 rezerwacji" not "5 rezerwacje" — f807e24
- [x] 2.10 Signature timestamp still shows Warsaw time — f807e24
- [x] 2.11 Booking widget and reservation summaries show the bare amount, no stray `zł` — f807e24
- [x] 2.13 `lessons.md`'s trimmed-ICU clause corrected; `formatPln(5900)` still renders `5 900 zł` — f807e24

### Phase 3: Header Redesign + Language Switcher

#### Automated

- [x] 3.1 Type check passes: `npx astro check`
- [x] 3.2 Lint passes: `npm run lint`
- [x] 3.3 Build succeeds: `npm run build`
- [x] 3.4 E2E suite green: `npm run test:e2e`
- [x] 3.5 `grep -rn "HeaderContactToggle" src/` returns nothing

#### Manual

- [x] 3.6 Vision-diff of `SiteHeader` vs canonical mockup at 6 widths — punch-list empty
- [x] 3.7 No header overflow at any width, including previously-overflowing states
- [x] 3.8 `LangToggle` visible and operable at every public breakpoint
- [x] 3.9 Staff sidebar control and account row both persist the choice
- [x] 3.10 Switching locale preserves the current page, including on `/auth/*`
- [x] 3.11 Regression gate: no nav wrap / height change at 768–790px or 840px, interaction exercised
- [x] 3.12 Regression gate: landing phone reachable at ≥1136px, no width left with no phone affordance
- [x] 3.13 Matches `design-contract.md`

### Phase 4: Recruiter Path to English

#### Automated

- [ ] 4.1 Type check passes: `npx astro check`
- [ ] 4.2 Lint passes: `npm run lint`
- [ ] 4.3 Unit + integration tests pass
- [ ] 4.4 E2E suite green against English: `npm run test:e2e`
- [ ] 4.5 Catalog key parity holds for every namespace touched
- [ ] 4.10 `staff-admin`, `auth-hardening`, `quick-actions`, `demo-gate` re-anchored to English

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
- [ ] 5.6 Scripted sweep of `src/pages/**` + `src/components/**` finds no Polish outside catalog `pl` blocks and comments
- [ ] 5.12 `contract-surfaces.md` updated for the four surfaces whose exports gained a locale parameter
- [ ] 5.13 Island chunk sizes compared against `island-baseline.md` — no material growth

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
- [ ] 6.13 Integration test: a `locale:'pl'` reservation emails Polish from an `en` session
- [ ] 6.15 Full `src/**` Polish sweep passes (deferred from Phase 5)

#### Manual

- [ ] 6.7 Polish reservation emails Polish even when accepted from an English dashboard
- [ ] 6.8 English reservation produces an English email and PDF
- [ ] 6.9 Issued PDF re-download is byte-identical — not re-rendered
- [ ] 6.10 `protocols.locale` stamped correctly on new protocols
- [ ] 6.11 Invite and recovery emails bilingual with working links (throwaway account only)
- [ ] 6.12 Polish free-text damage note renders inside an English PDF
- [ ] 6.14 Manual-booking modal carries a customer-language field, defaulting to `pl`

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
