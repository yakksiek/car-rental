<!-- PLAN-REVIEW-REPORT -->

# Plan Review: English Localization

- **Plan**: `context/changes/english-localization/plan.md`
- **Mode**: Deep
- **Date**: 2026-09-01
- **Verdict**: REVISE → **SOUND after triage** (all 10 findings fixed in plan.md, 2026-09-02)
- **Findings**: 3 critical, 6 warnings, 1 observation

> **Triage complete 2026-09-02 — all 10 findings applied to `plan.md`, both blind spots closed.**
> Every finding below records what was changed and where.
>
> - **F1 blind spot (demo account) — CLOSED.** `set_profile_locale` writes for the demo account like
>   any other; the _read_ side skips it instead (Phase 1 §2: middleware ignores `profiles.locale`
>   when `is_demo`). The shared demo row therefore cannot carry one visitor's language to the next,
>   while the cookie still gives a demo visitor a fully working switch. Because this leaves a stored
>   value nothing reads — a natural target for a later "cleanup" — both sites must name each other
>   in a comment, and steps 1.16/1.17 make the leak a failing test rather than a silent regression.
> - **F4 blind spot (bundle baseline) — CLOSED.** Phase 1 step 1.15 records per-island chunk sizes
>   from a production build, before any catalog string lands, into `island-baseline.md` stamped with
>   its commit SHA. Phase 5 step 5.13 compares against it. Performance Considerations names the
>   twelve islands to measure and what a jump on a public-site one means.

## Verdicts

| Dimension             | Verdict |
| --------------------- | ------- |
| End-State Alignment   | WARNING |
| Lean Execution        | PASS    |
| Architectural Fitness | WARNING |
| Blind Spots           | FAIL    |
| Plan Completeness     | FAIL    |

Two dimensions FAIL, which by the rubric reads RETHINK. Called **REVISE**
deliberately: the architecture, phase ordering and research all hold up — every
finding is a bounded addition inside the existing phase structure, not a reason
to re-approach.

## Grounding

21/21 paths ✓ (3 are files the plan creates), 6/6 symbols ✓, brief↔plan ✓,
Progress↔Phase mechanical contract ✓ (1 `## Progress` heading, 7 phases matched
by name, indices contiguous and unique, no stray checkboxes in phase blocks).
Two Current State counts are off: "17 of 20 API route files" is 17 of 25; the
brief's "~35 formatting sites" is 52.

## What held up under verification

The `isDemo` threading precedent; the URL-prefix security argument against
`access.ts:49-51`; the inert-sitemap claim (`astro.config.mjs` has `sitemap()`
but no `site` key); `HeaderContactToggle`'s single importer (`SiteHeader.astro:4`
— the deletion is clean); the two live header bugs and their `known-issues.md`
entries (`:340`, `:372`); the design prerequisites (all three closed, 14 PNGs in
`design-review/`); the `slug.ts` caution as a rule. The research behind this plan
is unusually good — the findings are gaps in specification, not in understanding.

---

## Findings

### F1 — Every new locale column is unwritable through the paths the plan names

- **Severity**: ❌ CRITICAL
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Blind Spots
- **Location**: Phase 1 §5–6, Phase 6 §2, Phase 7 §2
- **Detail**: The plan has exactly one migration (Phase 1 §6, columns only) but
  five distinct write paths, none of which can write through the code the plan
  names.
  - **`profiles.locale`** — `POST /api/locale` writes it through the user
    session client. `profiles_update_authenticated`
    (`supabase/migrations/20260604153139_employee_admin_roles.sql:80-84`,
    tightened by `20260828140000_demo_account_write_gate.sql:86-95`) is
    `using (current_app_role() = 'admin' and not current_is_demo())`. An
    employee cannot update `profiles` at all, and the demo account is
    explicitly excluded — the exact persona the acceptance test targets. An
    RLS-denied UPDATE is not an error: PostgREST reports zero rows affected, so
    this fails **silently**. Criterion 1.10 cannot pass. Every existing
    `profiles` write in the repo goes through the service-role client
    (`src/lib/services/staff.ts:238,256,317,356`); the only user-session
    `from("profiles")` calls are SELECTs (`src/middleware.ts:32`,
    `src/pages/dashboard/account.astro:26`).
  - **`reservations.locale` + `terms_version` + `terms_locale`** — the public
    funnel writes through `create_reservation_request`
    (`src/lib/services/reservations.ts:50`), a SECURITY DEFINER RPC with a fixed
    insert column list
    (`supabase/migrations/20260810140000_reservation_date_order_guard.sql:185-193`).
    New columns need three new RPC parameters.
  - **`protocols.locale`** — same shape via `create_protocol` and
    `create_return_protocol`
    (`supabase/migrations/20260716120000_return_protocol.sql:129-136`, `:456-463`),
    called from `src/lib/services/protocols.ts:75`.
  - **`create_confirmed_reservation`** (`src/lib/services/reservations.ts:102`,
    `src/pages/api/reservations/manual.ts:99`) is a second reservation-creation
    path that returns an email payload and mails the customer. No phase gives it
    a locale, and `ManualReservationModal` gets no language field — so a walk-in
    Polish customer booked by an English-working employee receives an English
    email. That is precisely the outcome the Implementation Approach says the
    design prevents. (This is the End-State Alignment half of the finding.)
  - `lessons.md` "Revoke EXECUTE before granting it" applies to every one of
    these redefinitions — `revoke execute … from public, anon` first, per
    function, every time. The plan never mentions the RPCs, so it does not carry
    the rule.
- **Fix A ⭐ Recommended**: Extend Phase 1's migration to cover all five write
  paths — a `set_profile_locale()` SECURITY DEFINER RPC (the shape
  `mark_password_set()` already uses: stamps `auth.uid()`'s own row only), plus
  the three new params on the four creation RPCs, each with its revoke/grant
  block. Thread the params in Phases 6/7.
  - Strength: One prod migration push, so the Worker-outruns-migration trap the
    plan already documents is faced once, not three times. RPC params land
    unused until their callers arrive — harmless, since every new column is
    defaulted.
  - Tradeoff: Phase 1 grows from a 5-column migration to five function
    redefinitions; its manual verification gets longer.
  - Confidence: HIGH — all four RPC bodies and the RLS policy read directly.
  - Blind spot: ~~Whether `set_profile_locale` should refuse the demo account~~ —
    **resolved 2026-09-02**: it writes uniformly, and middleware skips the
    `profiles.locale` fallback for the demo row instead. See the header note.
- **Fix B**: Keep Phase 1 columns-only; add an explicit migration sub-step to
  Phase 6 and Phase 7 alongside the code that consumes it.
  - Strength: Each migration ships next to the change that needs it.
  - Tradeoff: Three separate hosted-migration pushes, each carrying the
    app-wide-lockout trap; `profiles.locale` still needs its RPC in Phase 1
    regardless, so this doesn't fully simplify.
  - Confidence: MEDIUM — safe, but it multiplies the riskiest ops step.
  - Blind spot: Prod migration lag is already a recorded recurring failure here.
- **Decision**: FIXED via Fix A — all five write paths folded into Phase 1 §6's migration (`set_profile_locale` RPC + `p_locale`/`p_terms_*` params on the four creation RPCs, each with its revoke/grant block). Part C resolved by adding a customer-language field to `ManualReservationModal`, defaulting to `pl`. Locale capture moved Phase 7 §2 → Phase 6 §5, ahead of the templates that read it.

### F2 — "E2E suite green" is an unachievable gate in Phases 2 and 4

- **Severity**: ❌ CRITICAL
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phase 2 criterion 2.5, Phase 4 criterion 4.4
- **Detail**: Phase 4 translates the staff shell, auth and dashboard, but
  re-anchors only `staff-auth.spec.ts` / `auth.setup.ts` / `fixtures/*`. Four
  specs Phase 5 owns assert on Phase-4 copy and go red at the end of Phase 4:
  - `e2e/staff-admin.spec.ts` — `:43` `"Nowe"`, `:44` `/Dodaj pracownika/` (both
    inside `openAddEmployee`, used by 5 tests); `:118,119` `"Ustaw hasło"`,
    `"Witaj we Flocie"`; `:123-125`; `:131-133` `"E-mail służbowy"` / `"Hasło"` /
    `"Zaloguj się"`; `:134` `"Wyloguj"`.
  - `e2e/auth-hardening.spec.ts` — `:70,81,96,109,122,150,151,159,160,194,198,199`.
  - `e2e/quick-actions.spec.ts` — `:46` `"Nowe"`, `:48` `/Nowa rezerwacja/`; the
    entire spec is two clicks, both Phase-4 strings.
  - `e2e/demo-gate.spec.ts` — `:63`, `:80` `"Wyloguj"`, the live-session
    precondition for both tests.

  Phase 2 is worse, because its criterion says "E2E suite still green (copy has
  not changed yet)": `e2e/seed.spec.ts:55` builds day-button names with
  `format(…, { locale: pl })` from `date-fns/locale` — exactly the import Phase 2
  §4 deletes and criterion 2.6 greps for. `src/lib/search-format.test.ts:14,18`
  consumes `MONTHS_ABBR_PL` and breaks in Phase 2 too.

  (`e2e/fleet-admin.spec.ts` genuinely survives Phase 4 — its locators are all
  Phase-5 fleet copy. The plan's split is right for that one.)

- **Fix**: Move `staff-admin`, `auth-hardening`, `quick-actions` and `demo-gate`
  into Phase 4 §6's re-anchor list (the copy-first-then-locators sequencing rule
  still applies per surface). Add `e2e/seed.spec.ts` and
  `src/lib/search-format.test.ts` to Phase 2 §8, and reword 2.5 from "still
  green" to "green after the date-helper re-anchor".
- **Decision**: FIXED — `staff-admin`, `auth-hardening`, `quick-actions`, `demo-gate` moved to Phase 4 §6; `seed.spec.ts` + `search-format.test.ts` added to Phase 2 §8; criterion 2.5 reworded. `fleet-admin` confirmed as genuine Phase 5 work.

### F3 — Phase 2's `Intl` premise is overstated in three ways that change the code

- **Severity**: ❌ CRITICAL
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Blind Spots
- **Location**: Current State Analysis item 1 (`plan.md:25-40`), Phase 2 §3,
  Testing Strategy (`plan.md:939`)
- **Detail**: The workerd ICU probe is right — `Intl` is available and handles
  Polish plurals, genitive months and Warsaw time. But three follow-on claims
  are false, and each changes what Phase 2 must write:
  1. _"The grouping character matches `format.ts:13`'s hand-rolled non-breaking
     space exactly."_ The character matches; the behaviour does not. CLDR `pl`
     sets `minimumGroupingDigits = 2`, so
     `Intl.NumberFormat("pl-PL").format(5900)` → `"5900"`, while `format.ts`
     emits `"5 900"` and `src/lib/format.test.ts:33` asserts `"5 900 zł"`.
     A straight swap regresses the app's most common amounts.
     `{ useGrouping: "always" }` restores it and must be passed explicitly.
  2. `style: "currency"` is not a drop-in. Under `pl` it forces two decimals
     (`5900` → `"5900,00 zł"`), contradicting `formatPln`'s documented "whole
     amounts drop the decimal part". Under `en` it emits `"PLN 1,234.50"`;
     `currencyDisplay: "narrowSymbol"` gives `"zł 1,234.50"` — symbol _before_
     the number. Keeping today's `"320 zł"` shape requires manual composition.
     The plan never states what EN money should look like.
  3. Testing Strategy: _"grouping separator is U+00A0 in both locales."_ English
     groups with **U+002C**. `en` / `en-US` / `en-GB` all return `,` from
     `formatToParts`. A unit test written to that assertion fails.

  Related: `context/foundation/lessons.md:78` still reads "Mind workerd's
  trimmed ICU (why `returns.astro` hand-rolls Polish month names)" — the premise
  this plan disproves and Phase 2 acts on. No phase corrects it, so the next
  slice re-inherits it. Same for the three `known-issues.md` entries this change
  retires (`:51` single-locale, `:340` and `:372` the two header bugs).

- **Fix A ⭐ Recommended**: Correct the probe table in Current State Analysis;
  add an explicit EN money-format decision to Phase 2 §3 (compose manually —
  `Intl.NumberFormat(locale, { useGrouping: "always", maximumFractionDigits: … })`
  plus a catalog currency suffix, keeping `zł` in both locales since the business
  is Polish); fix the Testing Strategy bullet; add a Phase 2 step correcting the
  `lessons.md` ICU clause and a Phase 7 step closing the three `known-issues.md`
  entries.
  - Strength: Preserves current rendered output exactly, which is what criterion
    2.8 ("renders identically to before under `pl`") actually demands.
  - Tradeoff: Keeps a thin composition helper rather than handing everything to
    `Intl` — slightly less "grammar is deleted".
  - Confidence: HIGH — all three behaviours probed against Node 24 full ICU,
    matching the plan's own probe environment.
  - Blind spot: Whether EN readers should see `zł` or `PLN` is a product call.
- **Fix B**: Adopt `Intl` output verbatim and update the assertions to match.
  - Strength: Zero bespoke formatting code; a third locale is free.
  - Tradeoff: Visibly changes Polish output (`5900 zł`, `5900,00 zł`) and
    contradicts Phase 2's own "renders identically" criterion.
  - Confidence: MEDIUM — technically clean, but it silently reprices the visual
    design of every card and summary.
  - Blind spot: The design contract pins money typography; a changed shape may
    fail the vision-diff gate.
- **Decision**: FIXED via Fix A — probe table corrected (en comma, pl minimumGroupingDigits), Phase 2 §3 now specifies manual composition with `useGrouping:"always"`, Testing Strategy bullet rewritten, and a new Phase 2 §9 corrects `lessons.md`'s trimmed-ICU clause.

### F4 — The catalog accessor contradicts the island tree-shaking rationale

- **Severity**: ⚠️ WARNING
- **Impact**: 🔬 HIGH — architectural stakes; think carefully before deciding
- **Dimension**: Architectural Fitness
- **Location**: Phase 1 §1 (`plan.md:187`), Performance Considerations (`:980`)
- **Detail**: Phase 1 defines `useTranslations(locale)` as returning `t(key)`
  "resolving against the composed namespace map". Performance Considerations
  says the catalog is namespaced "specifically so React islands tree-shake — a
  flat catalog would put every string in both locales into each of 14 island
  bundles." Those two statements are in tension the moment a shared `src/lib`
  module needs a string.

  Phase 2 §3 does exactly that: it moves the `/doba` suffix into the catalog,
  inside `src/lib/format.ts` — which 11 island files import (`BookingWidget`,
  `HeroSearch`, `ReservationForm`, `SearchRows`, `PendingQueue`,
  `NeedDecisionPanel`, `ManualReservationModal`, `FleetList`,
  `ManualReservationCalendar`, `VehicleForm`, plus `staff-format` consumers). If
  `format.ts` calls `useTranslations`, the composed map lands in all 11 bundles —
  the exact failure the plan is trying to design around.

  Separately, the island-side API is never specified. Astro components get
  `locals.t`; `src/lib` and API routes get `useTranslations(locale)`; islands
  "import their own namespace and take `locale` as a prop" — but with what call
  shape? Phase 5 has 14 island `COPY` objects to convert and no documented
  target to convert them to.

  Note also that avoiding the leak requires **inventing an API the plan does not
  describe**, while causing it requires **following the plan as written** — the
  only named, callable accessor on offer for non-Astro code is the composed one.
  The careful implementer and the careless one land in the same place, and no
  phase has a bundle-size gate that would tell them apart.

- **Fix A ⭐ Recommended** _(shape revised 2026-09-02 during review discussion)_:
  Remove `format.ts`'s reason to touch the catalog at all, rather than adding a
  rule saying it must not. `src/lib/format.ts` has two kinds of export doing two
  different jobs, and they want opposite treatments.

  **Group 1 — arrangers of numbers** (`formatPlnAmount`, `formatPln`,
  `formatDailyRate`, `rentalDays`, `estimatedTotal`, `totalDueAtPickup`,
  `formatDuration`, `formatCargoDims`, `formatPayloadKg`, `pluralPl`): the caller
  supplies any word; the helper arranges digits. **The repo already does this** —
  `src/components/fleet/FleetList.tsx:150-160` renders
  `{formatPln(vehicle.daily_rate)}{COPY.perDay}`: number from the helper, word
  from the component. It pointedly does **not** call `formatDailyRate`, the one
  function that bakes the suffix in. Most of this group needs nothing at all —
  `zł` and `" kg"` are units, identical in both locales under the plan's own
  currency-stays-PLN decision. The only genuine word is `formatDuration`'s plural
  noun, which takes injected forms naturally:
  `plural(n, { one: t("day.one"), other: t("day.other") })`. `formatDailyRate`
  either gains a suffix argument or is deleted in favour of the composition
  `FleetList` already uses.

  **Group 2 — vocabulary** (`categoryLabelPl`, `transmissionLabelPl`,
  `fuelLabelPl`, `rejectionReasonLabelPl`, `reservationStatusLabelPl`): pure
  dictionaries with no formatting logic — `format.ts:162` is literally
  `return CATEGORY_LABELS_PL[category]`. Injection is the wrong tool here;
  passing a whole map as an argument is "import the namespace" with worse
  ergonomics and worse types. These five move **out** of `format.ts` into a
  catalog namespace (`src/lib/i18n/vehicle.ts`), imported per-domain by whoever
  needs them — which is exactly the import the tree-shaking sentence describes.

  Then give islands the named accessor the plan currently omits (a per-namespace
  `useTranslations(locale, ns)` or equivalent), and keep the composed `locals.t`
  server-side for Astro components.
  - Strength: After the split, `format.ts` has **no reason** to reach the catalog
    — the leak vector stops existing rather than being governed by a rule 157
    files have to remember. `format.ts` stays a pure numeric module, which is
    what makes `format.test.ts` the straightforward unit suite it is today. Group
    2 lands where it arguably belonged all along.
  - Tradeoff: Two accessor shapes to learn; five label functions change file,
    touching every importer of `format.ts`'s vocabulary half.
  - Confidence: HIGH — the composition pattern is already in the codebase at
    `FleetList.tsx:150-160`, and Starlight (the cited precedent) splits the
    accessor the same way.
  - Blind spot: Whether the type-level parity constraint survives the
    per-namespace split cleanly is unverified. Also unchecked: who else calls
    `formatDailyRate`, which decides whether it is amended or deleted.

  **Knock-on — Phase 2 §3 needs rewording.** It currently says "The `/doba`
  suffix becomes a catalog string (`/day` in EN)", i.e. looked up from inside
  `format.ts` — which is the leak itself. Under this fix the suffix _leaves_
  `format.ts` entirely and becomes the caller's business.

- **Fix B**: Keep a single composed-map `useTranslations`, drop the tree-shaking
  claim, and budget the bundle cost.
  - Strength: One API, simplest possible mental model.
  - Tradeoff: Both locales' full dictionary in 11+ island chunks; the Performance
    Considerations paragraph becomes untrue.
  - Confidence: MEDIUM — workable, but the cost isn't measured anywhere.
  - Blind spot: No baseline island chunk sizes recorded to measure against.
- **Decision**: FIXED via Fix A (revised shape) — Phase 1 §1 now defines two accessors with a server-only boundary, plus the `format.ts` split: number arrangers take injected words, the five vocabulary functions move to `src/lib/i18n/vehicle.ts`. Baseline island chunk sizes recorded in Phase 1 (step 1.15) and compared in Phase 5 (step 5.13).

### F5 — Phase 2's grammar surface is under-enumerated

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Architectural Fitness
- **Location**: Phase 2 §3
- **Detail**: "`groupThousands` and `PLN_GROUP_SEPARATOR` are deleted" is safe
  only for money. There are **four** hand-rolled thousands groupers using
  **three** different separator characters, and the plan names one:

  | file                                | separator | behind                                                                                  |
  | ----------------------------------- | --------- | --------------------------------------------------------------------------------------- |
  | `src/lib/format.ts:13`              | U+00A0    | money **and** `formatPayloadKg`                                                         |
  | `src/lib/return-form.ts:18-19`      | U+0020    | `formatKmDriven`                                                                        |
  | `src/lib/protocol-form.ts:32-38`    | U+202F    | `formatOdometer`, with an inverse `parseOdometer` that round-trips the formatted string |
  | `src/lib/media/protocol-pdf.ts:528` | ` `       | PDF odometer                                                                            |

  Deleting `format.ts:23` breaks `formatPayloadKg` (`format.ts:150`), which has
  4 call sites: `VehicleCard.astro:46`, `LandingVehicleCard.astro:43`,
  `VehicleDetail.astro:37`, `src/pages/fleet/index.astro:197`.
  `src/lib/protocol-form.ts` appears in **no** phase's file list.

  Two more under-counts in the same section: the `/doba` suffix is duplicated in
  6 places outside `format.ts:52` (`BookingWidget.tsx:42`, `FleetList.tsx:74`,
  `ReservationForm.tsx:349`, `PendingQueue.tsx:361`, `pricing.astro:169,231`),
  and the `zł`-strip fix leaves the hardcoded `zł` spans on the very next lines
  (`BookingWidget.tsx:355`, `ReservationForm.tsx:659`) untranslated. Call-site
  total is 52, not the brief's "~35"; the two named strip sites are correct
  except the first path is `src/components/vehicle/BookingWidget.tsx`, not
  `src/components/BookingWidget.tsx`.

- **Fix**: Enumerate all four groupers, `formatPayloadKg`, `formatKmDriven` and
  the `formatOdometer`/`parseOdometer` round trip in Phase 2 §3; add
  `src/lib/protocol-form.ts` to the file list; list the 6 `/doba` sites and the
  2 residual `zł` spans as part of the same change.
- **Decision**: FIXED — Phase 2 §3 enumerates all four groupers with their three separators, flags the `formatPayloadKg` breakage and the `formatOdometer`/`parseOdometer` round trip, adds `protocol-form.ts`/`return-form.ts`/`protocol-pdf.ts` to the file list, and lists the 6 `/doba` sites and 2 residual `zł` spans.

### F6 — No phase owns the test files it invalidates

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phases 4–6 Changes Required; Testing Strategy
- **Detail**: Not one file under `tests/integration/` appears in any phase's
  Changes Required. The only acknowledgement is a Testing Strategy bullet — "The
  ~64 Polish assertions across 15 integration files are updated as their
  surfaces land" — which is a note, not a work item with an owning phase, while
  every phase's automated criteria demand `npm run test:integration` green.

  Actually-coupled integration assertions (4 files, 6 sites):
  - `tests/integration/staff.test.ts:703`, `:841` → Phase 5 §4 (API `MSG` maps)
  - `tests/integration/protocol-email.test.ts:197`, `:221` → Phase 6
  - `tests/integration/return-protocol-email.test.ts:209`, `:234` → Phase 6
  - `tests/integration/return-protocols-api.test.ts:292` → Phase 6

  The other ~9 integration files with Polish diacritics use them only as
  test-owned fixture data (`full_name: "Robert Zieliński"`, damage-location
  strings), which survives untouched.

  Unit specs of files Phases 4/5 explicitly rewrite, named in no phase:
  - `src/lib/auth-messages.test.ts` (Phase 4 §3 rewrites the source)
  - `src/lib/staff-report.test.ts` (Phase 4 §4 lists the source)
  - `src/components/dashboard/quick-actions.test.ts` — and its source
    `src/components/dashboard/quick-actions.ts:35,92` is in no phase's list
    either, though Phase 4 §4 lists the `QuickActionMenu.tsx` that renders from it

- **Fix**: Add the four integration files to Phases 5/6 and the three unit specs
  (plus `quick-actions.ts`) to Phase 4's Changes Required.
- **Decision**: FIXED — the 3 unit specs + `quick-actions.ts` added to Phase 4, `staff.test.ts` to Phase 5, the 3 email specs to Phase 6; the copy-first-then-tests rule extended from E2E to all three layers; Testing Strategy's "~64 across 15" corrected to 6 assertions in 4 files.

### F7 — Phase 4 §5's seed contract describes data that isn't in seed.sql

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phase 4 §5, criterion 4.8
- **Detail**: The contract says "Vehicle names …, notes and rejection reasons are
  rewritten in English" and "retain two Polish rows deliberately".
  `supabase/seed.sql` has **no** `notes` values and **no** `rejection_note`
  values at all. The only seeded Polish free text is `protocol_damages.location`
  (`seed.sql:380,387`) — which frame decision 2 says must never be translated.
  So the "two retained Polish rows" have no defined subject, and criterion 4.8
  asserts on rows that don't exist.

  Grounding win worth recording alongside it: the Phase 5 §5 slug caution is
  correct as a rule but its trigger is misidentified. `vehicleSlug` is called as
  `vehicleSlug(vehicle.make ?? vehicle.name, vehicle.model ?? "")` at all three
  sites (`VehicleCard.astro:33`, `LandingVehicleCard.astro:32`,
  `src/pages/fleet/[id]/[...slug].astro:45`), and all 7 seeded rows have Latin
  `make`/`model` (`Mercedes-Benz/Sprinter` … `Fiat/Ducato`, `seed.sql:31-85`).
  Renaming seeded `name` values changes no slug; `fleet/[id]/[...slug].astro:13-14`
  resolves by `id` and documents the slug as decorative. No spec, fixture or
  stored column holds a slug value. The risk is a `slug.ts` edit, nothing else.

- **Fix**: Re-specify §5 against the actual seed contents — vehicle `name` only —
  and name the two rows to be left Polish. Reword the Phase 5 §5 slug caution to
  say the risk is editing `slug.ts`, not the rename.
- **Decision**: FIXED — Phase 4 §5 re-specified against actual seed contents (vehicle `name` only, two rows to stay Polish, `protocol_damages.location` untouched); Phase 5 §5's slug caution retargeted at editing `slug.ts`.

### F8 — `safeRedirectPath` rejects `/auth/*` and defaults to `/dashboard`

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Blind Spots
- **Location**: Phase 1 §5 (`plan.md:238`); criteria 3.10, 4.7
- **Detail**: Phase 1 validates the switcher's `redirect` through
  `safeRedirectPath`. That helper was built for post-login redirects and carries
  two guarantees beyond open-redirect safety: it returns `DEFAULT_POST_LOGIN`
  (`"/dashboard"`) for anything it rejects (`src/lib/safe-redirect.ts:10,20`),
  and it explicitly refuses `/auth` and `/auth/*` (`:25-27`) so sign-in never
  bounces back to itself.

  The recruiter path runs straight through `/auth/signin` (Phase 4 §3 owns it,
  and it carries the demo-credentials card). Switching language there sends an
  anonymous visitor to `/dashboard`, which middleware bounces to
  `/auth/signin?redirect=/dashboard`. Worse on `/auth/reset-password` and
  `/auth/callback`: the URL's `token_hash`/`type` params are dropped, which
  strands a mid-invite-accept user. Criteria 3.10 and 4.7 ("switching locale
  preserves the current page") cannot pass on any auth page.

  The repo already knows this: `src/lib/back-target.ts:46-49` works around the
  same fallback with `safeRedirectPath(raw) === raw ? raw : fallback` — and that
  idiom still wouldn't admit `/auth/*`.

- **Fix**: Give the locale switch its own validator in Phase 1 §5 — same
  open-redirect rules (leading `/`, reject `//` and `/\`), fallback to `/`, and
  no `/auth/*` exclusion. Do not relax `safeRedirectPath` in place; its `/auth`
  refusal is load-bearing for sign-in.
- **Decision**: FIXED — Phase 1 §5 now specifies a locale-specific redirect guard (fallback `/`, no `/auth/*` exclusion), leaving `safeRedirectPath` untouched.

### F9 — Phase 5's file list and its sweep gate don't line up with the code

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Plan Completeness
- **Location**: Phase 5 §4, §5, criterion 5.6
- **Detail**: Four separate mismatches in one phase.
  1. Criterion 5.6 ("no Polish diacritics remain in `src/**` outside catalog `pl`
     blocks and comments") cannot pass at Phase 5:
     `src/lib/email/templates.ts` still has 42 diacritic-carrying lines and
     `src/lib/media/protocol-pdf.ts` 16 — both translated in Phase 6 — and
     `/terms` copy arrives in Phase 7.
  2. `src/components/hooks/` is in no phase's file list, and
     `src/components/hooks/useProtocolMedia.ts:228` throws a user-reachable
     `` `Brak pliku w pamięci: ${path}` ``.
  3. Four of the modules §5 changes are named in
     `docs/reference/contract-surfaces.md`, which the plan never references:
     `catalog-filters.ts` (`parseFilters` / `serializeFilters` /
     `validateDateRange`), `auth-session.ts` (`readPendingToken` /
     `serializePendingToken` / `selectResetPasswordBranch`), `services/staff.ts`
     (7 named exports + `employeeInviteSchema`), `services/vehicles.ts`
     (`listVehicles` / `searchAvailableVehicles` / `getVehicleById`). "Each
     exported label map gains a locale parameter" is a shape change to
     load-bearing names with no migration note for consumers.
  4. `config-status.ts` is not a "label map": `configStatuses` and
     `missingConfigs` are module-level exported const **arrays** consumed as
     values by `Layout.astro:45`. Adding a locale means converting a value to a
     function — and Phase 1 §4 already translates half that banner (`Uwaga:` /
     `Dokumentacja`) four phases earlier.

  Related count: Current State Analysis says "17 of 20 API route files" carry a
  `MSG` map. It's 17 of 25 — 8 without, not 3. Six are `/api/auth/*` and route
  through `auth-messages.ts`; the two that carry inline Polish are
  `src/pages/api/reservations/calendar.ts:27,35` and `src/pages/api/search.ts:38,47`,
  which the plan's "checked for inline literals" instruction does cover.

- **Fix**: Move criterion 5.6 to Phase 6 (or scope the Phase 5 version to
  `src/pages/**` + `src/components/**`); add `src/components/hooks/` to §5;
  enumerate the exact signature change per contract-surface export and add a
  step updating `docs/reference/contract-surfaces.md`; call out
  `config-status.ts` as a value→function conversion and move it to Phase 1
  alongside the banner strings it feeds.
- **Decision**: FIXED — criterion 5.6 scoped to `src/pages/**` + `src/components/**` with the full sweep deferred to Phase 6; `src/components/hooks/` added to Phase 5 §5; the four contract-surface modules enumerated per-export with a `contract-surfaces.md` update step; `config-status.ts` moved to Phase 1 §4 as a value→function conversion.

### F10 — Staff nav enumeration is incomplete, and StaffShell carries both the brand and the nav item

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phase 4 §4 (`plan.md:600`), Phase 6 §4
- **Detail**: Phase 4 §4 says these labels "carry no diacritics and are invisible
  to diacritic-based extraction; enumerate them explicitly" — then enumerates
  six: Pulpit, Wnioski, Wydania, Zwroty, Zespół, Flota.
  `src/components/shell/StaffShell.astro:110-126` has seven, plus more strings in
  the same chrome: **Kalendarz** (`:121`), **Operacje** (sidebar section heading,
  `:153`), **Profil** (`:201,202,341`), **Wyloguj** (`:223,238`). The plan's own
  `design-contract.md` follow-up note lists Kalendarz and Operacje too, so plan
  and design contract disagree.

  The same file carries the brand/nav collision the plan flags elsewhere: `:143`
  is the **brand** wordmark `Flota`, `:122` is the **nav item** `Flota`. Neither
  appears in the plan's brand list (`Layout.astro:13`, `SiteFooter.astro:86`) or
  its nav list (`SiteHeader.astro:33`, `LandingNav.astro:38`, `MobileNav.tsx:26`).

  Two more strings on the Phase-4 recruiter path with no owning file entry:
  `src/pages/auth/link-conflict.astro:49` and
  `src/components/auth/SignOutButton.tsx:26`.

- **Fix**: Replace the enumeration with the full nine, add `StaffShell.astro:122`
  (nav) and `:143` (brand) to the brand-reconciliation list in Phase 6 §4, and
  add `link-conflict.astro` + `SignOutButton.tsx` to Phase 4 §3.
- **Decision**: FIXED — all nine staff chrome strings enumerated in Phase 4 §4; `StaffShell.astro:122` (nav) and `:143` (brand) added to Phase 6 §4; `link-conflict.astro:49` and `SignOutButton.tsx:26` added to Phase 4 §3.
