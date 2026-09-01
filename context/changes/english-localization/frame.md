# Frame Brief: English localization

> Framing step before /10x-plan. This document captures what is _actually_
> at issue, separated from what was initially assumed.

## Reported Observation

The app is Polish-only. `src/layouts/Layout.astro:17` is a literal `<html lang="pl">`;
there is no i18n layer anywhere (`astro.config.mjs` has no `i18n` block, `src/middleware.ts`
never resolves a locale, zero i18n dependencies in `package.json`). Polish literals appear in
**157 of 249 files** under `src/` — 1161 diacritic-carrying lines, which undercounts, since
`Start`, `Flota`, `Cennik`, `Pulpit`, `Wnioski`, `Wydania`, `Zwroty`, `Zespół` carry none.

This is a deliberately parked item, not an oversight: `context/foundation/prd.md:154` Non-Goals —
_"No multi-language support. Polish only in v1. English deferred to a later phase."_ The
landing redesign's mockups shipped a PL·EN nav toggle that was explicitly cut
(`context/archive/2026-07-28-landing-redesign/plan.md:78`, _"no i18n / PL·EN toggle"_).

## Initial Framing (preserved)

- **User's stated cause or approach**: none offered — this arrived as a scope request
  ("I would like to add english localization to the app"), not a diagnosis.
- **User's proposed direction**: add English localization to the app.
- **Pre-dispatch narrowing**: scope = **"Whole app incl. staff"**; audience = **"Real non-Polish
  customers"**; symptom = **"Copy only"** (dates/prices keep rendering as they do now).
- **Post-investigation narrowing** (Step 4): target set = **"Genuinely the whole app"**;
  second reader = **"Yes — recruiters/reviewers"**; legal text, in the user's own words —
  **"Everything, literarly everything should be english when the english is switched on"**.

## Dimension Map

1. **String surface** — Polish may originate outside component markup, where a catalog can't reach.
2. **Locale-selection seam** — there may be nowhere in the request pipeline to hang a language.
3. **Copy/formatting separability** — "copy only" assumes copy and formatting are separable. ← initial framing
4. **Audience/scope alignment** — the named audience and the named scope may not describe the same surfaces.
5. **Verification/design coupling** — Polish may be load-bearing for the gates that would verify the change.
6. **Header capacity** — the locale control needs somewhere to live, and the chrome may have no room. ← added by the user after Step 4

## Hypothesis Investigation

| Hypothesis                                                                   | Evidence                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | Verdict                                      |
| ---------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------- |
| **A. String surface** — copy is spread beyond markup                         | **481 of 1161 Polish lines (41%) are in `.ts`**: zod `MSG` maps (`src/lib/reservation-schema.ts:16-25`, `protocol-schema.ts:30-40`, +3), `MSG` blocks in **20 of ~22 API route files**, ~12 `src/lib` label modules. Both schemas and handlers are **module-level constants with no locale parameter**; nothing reads `Accept-Language`. **But the DB layer is the cleanest in the repo** — 4 Polish strings across 34 migrations, all comments; no `RAISE EXCEPTION`; enums are English tokens (`cargo_van`, `scratch`); RPCs return English codes (`'unauthorized'`, `'no_baseline'`). GoTrue errors already walled off at `src/lib/auth-messages.ts:120-140`                                                                                                                                                                                                                                                                                                     | **PARTIAL** — broke, but not where predicted |
| **B. Locale-selection seam** — nowhere to hang a locale                      | **False as stated.** The seam exists: `App.Locals` (`src/env.d.ts:9-22`), populated at `src/middleware.ts:17,49,54`. `isDemo` (2026-08-28) is a working precedent for threading a per-request scalar preference: one `profiles` column, one line in the middleware select, one `Locals` field, one pure reader (`src/lib/access.ts:92-94`). Cost appears **only if locale goes in the URL** — and there it is a security regression, not an inconvenience: `src/lib/access.ts:49-51` matches literal prefixes, so `/en/dashboard/staff` matches nothing, `resolveRequiredRole` returns `null`, and `src/middleware.ts:69` **waves the request through unauthenticated**. `safe-redirect.ts:25` and `back-target.ts:26-30` break the same way. The usual argument for URL-visible locales does not apply: site-wide `noindex` (`Layout.astro:35`), `Disallow: /` (`public/robots.txt`), and `@astrojs/sitemap` is **inert** (no `site` key; no `sitemap*` in `dist`) | **WEAK**                                     |
| **C. Copy/formatting separability** — "copy only" is not a boundary          | `src/lib/format.ts:108-119` `pluralPl(n, [one, few, many])` — Polish's **three-form** plural incl. the 12–14 exception; duplicated at `staff-format.ts:11` `plForm`, `protocol-pdf.ts:559` `photoCountWord`, `templates.ts:206` `damageLabel`. English has two forms: **every call site has the wrong arity**. `ReservationCalendar.tsx:68-95` carries `PL_MONTHS_NOM` **and** `PL_MONTHS_GEN` — grammatical case selected by view mode. `PendingQueue.tsx:92` `formatDistanceToNow(d, {locale: pl})` emits Polish sentences with **no literal in the repo**; ~25 such sites across 8 components, `pl` a **static import**. `format.ts:47,52` bake `zł` and `/doba` into the money formatter, then `BookingWidget.tsx:353` and `ReservationForm.tsx:658` `.replace(/\s*zł$/,"")` to restyle it. `ProtocolView.tsx:476` renders `Podpisał(a)` — gender agreement as a parenthetical                                                                                  | **STRONG**                                   |
| **D. Audience/scope alignment** — audience and scope name different surfaces | Against the _originally stated_ audience: **no customer account concept exists** (`src/pages/api/auth/signup.ts:8-12` hard-refuses signup; `prd.md:152` Non-Goal). 12 of 13 dashboard routes are unreachable by a customer. Split: ~13,200 lines staff-side vs ~4,000 public-side. The one customer-touched dashboard screen is the signature overlay (`SignaturePad.tsx:253-281`), reached by being _handed a device_. Meanwhile everything highest-stakes for a customer sat **outside** the stated scope: 5 email templates + the PDF, per `templates.ts:170-173` _"this mail and its PDF attachment are their ONLY copy of the evidence, possibly needed in a dispute months later."_ **Step 4 resolved this**: the real reader is the recruiter, which makes whole-app scope correct                                                                                                                                                                           | **STRONG**                                   |
| **E. Verification/design coupling** — Polish is load-bearing for the gates   | **~137 of 158 E2E locator string arguments (87%) are literal Polish UI copy**, and `e2e/e2e-rules.md:9-10` _mandates_ it — **0 `getByTestId` in the suite by policy**, so there is no decoupled addressing layer. Plus ~74 Polish unit assertions, ~4 integration. ≈215 total. `CLAUDE.md` confirms **no component test layer at all** below Playwright. **Design half is softer**: the design source carries parallel `STR.EN`/`STR.PL` dictionaries at enforced key parity — `context/archive/2026-07-09-issue-protocol/design-audit.md:37-39`, _"`STR.EN.proto` and `STR.PL.proto` both hold 82 keys, zero asymmetry."_ Polish was **selected** from a bilingual source, not hardcoded                                                                                                                                                                                                                                                                           | **STRONG** (tests) / **PARTIAL** (design)    |

| **F. Header capacity** — the chrome has no room for a locale control | **Confirmed, and tighter than "cramped."** `SiteHeader.astro:41` is a `justify-between` flex row with **no `gap`, no `min-w-0`, no `truncate`, no `flex-1`** — nothing in the bar can shrink. At the `lg` entry width (1024px) total slack is **~105px**; a segmented PL\|EN pill at the codebase's own geometry is ~76–84px, which consumes it. At the `md` entry width (768px) slack is **~4px** — and `HeaderContactToggle` **grows ~40px** when the user switches it to phone mode (`HeaderContactToggle.tsx:95-108`, `revealWidth` 112→150), so that state already overflows. The nav pill's `min-[840px]:px-[18px]` (`SiteHeader.astro:57`) is an **existing compression hack**. `LandingNav` is worse: at 1024–1279px it carries a 5-link nav plus the 160px "Przeglądaj flotę" CTA with the phone already deferred to `xl`, and its tablet bar has **already dropped "O nas"** (`LandingNav.astro:115`, `nav.slice(0, 4)`). The staff band is at capacity too — at 768px the 520px ⌘K field + 92px QuickAdd = 624px of 632px usable, and `StaffShell.astro:272-275` documents the crush in its own comment. The mobile tab bar is at **8 items = 360px on a 360px viewport** (`:293-299`) | **STRONG** |

## Narrowing Signals

- **The recruiter, not the customer, is the reader** (user, Step 4). This is the decisive signal:
  it converts the whole-app scope from a mismatch into a requirement. `context/archive/2026-08-28-demo-account-gate/plan.md:5`
  — _"This deployment is a portfolio. The half worth showing — the staff cockpit — sits behind auth
  and a role gate, so a recruiter following a link from a CV currently hits `/auth/signin` with no way in."_
  The staff dashboard is not incidental to the audience; it is what they came for.
- **"Literally everything English when the switch is on"** (user, verbatim). This overrides the
  pre-dispatch "copy only" and "excluding outbound artifacts" positions, and makes the frozen-artifact
  and free-text questions load-bearing rather than edge cases.
- **The bridge into the demo is itself Polish.** `SiteFooter.astro:31` — "Strefa pracownika" is the
  _only_ link from the public site to the demo sign-in. An English-speaking recruiter has no reason to
  recognize it. They then read zero English from CV link through sign-out.
- **The locale control forces a header redesign, and the design already carries one** (user, after
  Step 4). This is not incidental scope: the header has zero slack (Dimension F), so the switcher
  cannot be added without restructuring the right-hand cluster.

## Design Source — the header redesign already exists

Pulled live from the Claude Design project `Rental car company`
(`352d78a6-84fd-49a2-8b38-2fe289691fc3`), file `info-pages.jsx` — **not** from the repo's screenshot
cache, which this project treats as a stale export.

`InfoHeader` already carries `<LangToggle />` as the first item of the right-hand cluster, followed by
`.info-phone`, `.info-cta` ("Zarezerwuj", `h44 / px22 / #141B2D / radius 999`), and a `.info-toggle`
holding `<ActionMenu />` that is `display:none` by default. The reflow is governed by:

```css
@container (max-width:1180px) {
  .info-header {
    padding-left: 28px;
    padding-right: 28px;
  }
}
@container (max-width:980px) {
  .info-phone {
    display: none;
  }
  .info-cta {
    display: none;
  }
  .info-toggle {
    display: inline-flex;
  }
}
@container (max-width:840px) {
  .info-nav-pill {
    padding-left: 13px;
    padding-right: 13px;
  }
}
```

So the design's answer is: **below 980px the phone and the CTA both collapse into one `ActionMenu`,
while `LangToggle` stays visible at every width**, with nav-pill padding as a second relief valve at
840px. `InfoHeaderMobile` reduces to `LangToggle` + `ActionMenu`.

Two reconciliations this forces, both of which belong in the plan's design contract rather than here:

1. **Mechanism mismatch.** The design collapses phone+CTA into a single `ActionMenu`; the shipped app
   collapses them into `HeaderContactToggle`, a two-segment _mode switch_ (`SiteHeader.astro:84-86`).
   The design **replaces** that component rather than extending it.
2. **Query-type mismatch.** The design drives reflow with **container queries**
   (`containerType: 'inline-size'` + `@container`); the shipped header uses **viewport** breakpoints
   (`md:` / `lg:` / `min-[840px]:`). The container-query form is the one this project's own lesson
   _"Embeddable panels: size internal layout by container width, not the viewport"_ prefers, so the
   mock is already idiomatic here.

**Defect found in the design source while pulling it**: `INFO_NAV` reads
`[['home','Start'], ['fleet','Fleet'], ['rates','Cennik'], ['faq','FAQ'], ['about','O nas']]` —
**`'Fleet'` is English inside the otherwise-Polish nav** and should read `Flota`. This is the
`Flota`-vs-`Fleet` collision listed at item 7 below, now confirmed as a live defect in the design
source rather than a hypothetical. The design project is writable; fixing it is a plan-time task.

**Not pulled deliberately**: the exact geometry of `LangToggle` and `ActionMenu`. Transcribing exact
values is `/10x-plan`'s Design Alignment Audit gate, not frame's job. Note also that
`design-review/index.md` — the project's canonical screenshot index — carries **no header/nav row**,
so the redesigned header is not yet in the reviewed set and will need capturing at plan time.

## Cross-System Convention

Two independent pressure tests were run. The second was **blind** — an agent told only the observation,
never the hypothesis, asked what would stay stubbornly Polish. It independently reproduced the same map
(no i18n layer, grammar-as-logic, frozen PDFs, GoTrue templates, free-text boundary), which raises
confidence that the dimension map is the system's real shape and not an artifact of how it was probed.

It also found one thing **no dimension predicted, and it is the most serious single finding here**:

> **`src/lib/protocol-delta.ts:110-137` — `autoTagDamages` links a return damage to its issue-time
> baseline by exact equality on `type` + `normalize(location)` + `normalize(size)`, where `location`
> and `size` are free text an employee typed at the counter** (`DamageEditor.tsx:255`, placeholder
> `np. lewy tylny zderzak`). `normalize` (`:110`) lowercases, collapses whitespace and trims — it does
> **not** strip punctuation. Issue a van with the UI in Polish, return it with the UI in English, and
> every baseline match fails, so every pre-existing scratch defaults to `new`.

**Severity, stated accurately** (corrected 2026-09-01 after reading the call site): this is a
**degraded default, not a silent miscalculation**. Both `protocol-delta.ts:114-119` and
`return-form.ts:55-61` document the contract — _"A **suggestion only**: the employee's override on the
form is the persisted value."_ `ReturnProtocolForm.tsx:248,318,338` persists whatever
`baselineDamageId` the employee confirms per row. So a human sits between the bad suggestion and the
customer's bill.

What actually degrades: the auto-tag silently stops suggesting anything, and correctness falls entirely
on the employee remembering to re-tag each row by hand. A busy employee accepting prefilled defaults is
a real risk on a document that feeds `computeReturnDeltas` (`:80`), the return PDF's comparison section
(`protocol-pdf.ts:245-252`) and the customer's email (`templates.ts:341`) — but it is a **usability and
data-quality regression, not an unattended billing error**. It still deserves fixing, and the fix
(match on a stable baseline id rather than on typed strings) is worth doing independently of English:
the heuristic already fails today on a trailing full stop or a reworded location.

The project's own tiering (`known-issues.md:67-71`) already anticipated the order: **(1)** centralize
`LOCALE`/`TIMEZONE`/`CURRENCY`, **(2)** per-tenant config, **(3)** full copy i18n — _"large, only when a
non-PL deployment is real."_ The request is tier 3, and the docs put tier 1 first. `lessons.md:79` is
the standing instruction: _"Prefer a single named constant/helper over an inline `pl-PL` string so the
eventual i18n seam is one place. Do NOT build full i18n speculatively (YAGNI)."_ The recruiter audience
is what retires the YAGNI.

## Reframed (or Confirmed) Problem Statement

> **The actual problem to plan around is**: FleetRent has no locale seam, and the second locale it now
> needs is not a copy layer — it is a locale _dimension_ spanning copy, Polish grammar encoded as
> executable logic, outbound artifacts, stored data, and the page chrome that must carry the switch,
> whose "everything English" requirement is unattainable for a specific, enumerable set that must be
> decided as product questions **before** planning rather than discovered during it.

**The scope was right; the reason was wrong, and the reason is what sets the acceptance test.**
"Whole app incl. staff" survives — but under the customer framing it was three-quarters wasted effort,
and under the recruiter framing it is the point. That difference does not change _what_ gets translated;
it changes what "done" means. Done is no longer "a customer can book in English" (that path is ~4,000
lines and excludes the cockpit). It is **a recruiter following a CV link reaches the staff cockpit and
reads it end to end** — which makes `SiteFooter.astro:31` and `/auth/signin` the highest-leverage strings
in the repo, and makes the protocol flow the surface that most needs to be legible.

Two sub-framings did not survive, one of which the user overrode themselves:

- **"Copy only" is not a coherent boundary** (Dimension C, STRONG). Polish grammar is in function
  _signatures_ — `pluralPl(n, [one, few, many])` is a three-slot tuple. English needs two. This is
  logic to delete and re-abstract, not strings to swap.
- **"Excluding outbound artifacts" is void** — superseded by "literally everything," and correctly so:
  the PDF is the customer's only durable record.

**Where "literally everything" provably cannot hold.** These need decisions, not effort:

1. **Issued PDFs are frozen bytes.** `protocol-pdf.ts:163` bakes title, labels, date format and Polish
   plural into the file at signature time; nothing regenerates it (`services/protocols.ts:242-253`
   re-signs the _existing_ object). The bytes embed the customer's signature immediately beneath the
   Polish declaration `Klient potwierdza stan pojazdu i warunki najmu.` (`:290`). Re-rendering in
   English produces a document the customer never signed.
2. **There is nowhere to record what language a customer wanted.** No `locale` column on `reservations`,
   `vehicles` or `profiles` (`src/db/database.types.ts:255-282,337-362`); the funnel is anonymous.
   Confirmation/rejection/protocol emails are sent **days later, by staff** — an employee clicking
   Accept in an English dashboard cannot know the customer submitted in Polish. `email_deliveries`
   stores only a `template` id, so past sends can't even be audited for language.
3. **Human-typed free text.** `protocol_damages.location`, `reservations.rejection_note` (rendered
   verbatim into the customer's email, `templates.ts:135`), `reservations.notes`, `vehicles.name`
   (_"Volkswagen Crafter 9-osobowy"_ — what the deployed portfolio actually renders), and
   `vehicles.fuel_type`, where `format.ts:197` **echoes the raw stored string capitalised**.
4. **GoTrue auth emails.** `supabase/config.toml:257-263` + `supabase/templates/*.html` are rendered
   outside this codebase, one template per project per type. Per-user English requires dropping
   GoTrue's mailer for `generateLink` + own send — an auth-architecture change.
5. **Polish law and country-specific facts.** `faq.astro:19,26-27,51,55` (dowód osobisty, prawo jazdy
   kat. B/C, kaucja, min. 21 lat, faktura VAT), the NIP field (`reservation-schema.ts:24,82`), the PL
   phone regex (`:34-37`). Translating these produces confidently wrong English.
6. **`terms_accepted_at` is a bare timestamp** (`20260611171737_public_reservation_request.sql:24`) with
   no version and no locale — and the _"regulamin wynajmu"_ customers must accept
   (`ReservationForm.tsx:70`) **does not exist anywhere in the repo**: no route, no page, not even a
   link. It cannot be translated because it was never written. Under "literally everything," this is a
   prerequisite, not a translation task.
7. **`Flota` is both the brand and the common noun.** Must not translate at `Layout.astro:13`,
   `SiteFooter.astro:86`; must become "Fleet" at `SiteHeader.astro:33`, `LandingNav.astro:38`,
   `MobileNav.tsx:26`. Identical string, opposite requirement, invisible to extraction tooling. (The
   brand is already inconsistent: emails and the PDF say **FleetRent**, the UI says **Flota**.)

## Decisions Taken (2026-09-01)

The seven points above were put to the user and resolved. These are settled inputs to `/10x-plan`,
not open questions. Items 1–3 were proposed by this frame and went unopposed; 4–7 were the user's call.

| #   | Decision                                                                                                                                                    | Consequence for the plan                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | **PDFs are stamped, never re-rendered.** A protocol PDF stays in the language it was generated in, permanently                                              | Add `locale` to `protocols` so a stored PDF's language is knowable. Never regenerate an issued document — the signature at `protocol-pdf.ts:290` sits under the declaration the customer actually signed                                                                                                                                                                                                                                                                                                                                                      |
| 2   | **Free text stays verbatim.** Never machine-translated; English chrome around Polish free text is the correct outcome                                       | Accept hybrid documents by design. **Separately**, fix `autoTagDamages` (`protocol-delta.ts:110-137`) to match baseline damages on a **stable id**, not on typed strings. The string heuristic already degrades today (a trailing full stop breaks the match) and a locale switch degrades it to always-`new`. It is a _suggestion_ the employee confirms, so this is a data-quality regression rather than an unattended billing error — tracked in `known-issues.md`, not in this slice                                                                     |
| 3   | **Polish legal terms keep their Polish name + a one-time English gloss** — e.g. _"NIP (Polish tax identification number)"_                                  | Translate the surrounding sentence in `faq.astro:19,26-27,51,55`, `about.astro:55`, `pricing.astro:68`; never invent an English equivalent for a Polish legal concept. `reservation-schema.ts:24` validates neither format today — leave that as-is unless separately scoped                                                                                                                                                                                                                                                                                  |
| 4   | **`/terms` gets a placeholder page in PL + EN**, with clearly-marked sample text                                                                            | The `ReservationForm.tsx:70` checkbox stops asking people to accept a document that does not exist; the gap becomes visible instead of hidden. Add `terms_version` + `terms_locale` beside `terms_accepted_at` (`20260611171737_public_reservation_request.sql:24`) so a past consent is attributable                                                                                                                                                                                                                                                         |
| 5   | **Brand is `Flota` everywhere.** The brand never translates; the _nav item_ does (Flota→Fleet)                                                              | Change the 5 email subjects/bodies (`templates.ts:28,87,139,225,313`) and the PDF footer (`protocol-pdf.ts:167,463`) from **FleetRent** to **Flota**; check `public/robots.txt`. Fix the design source defect: `info-pages.jsx` `INFO_NAV` reads `['fleet','Fleet']` and must read `Flota` in the PL dictionary. **Note**: `prd.md`, `roadmap.md` and the deployed hostname `fleetrent.marcin-kulbicki.workers.dev` still say FleetRent — the hostname is not user-visible brand and can stay, but the docs now diverge and should be reconciled or annotated |
| 6   | **GoTrue templates go bilingual** — one template carrying English beneath Polish, subjects likewise                                                         | `supabase/templates/invite.html`, `recovery.html`, and the subjects at `supabase/config.toml:258,262`. No auth-architecture change; GoTrue's one-template-per-project limit stops being a blocker instead of being worked around. Do **not** switch to `generateLink` + own send. Recall `config.toml` loads only on `supabase stop && start`, and never `supabase config push`                                                                                                                                                                               |
| 7   | **Locale is stored in two places**: `reservations.locale` (captured at submission, drives every customer email) and `profiles.locale` (staff UI preference) | Resolves the async-send problem at the root: an employee working in English still emails a Polish customer in Polish, because the language is a property of the _reservation_, not of the sender's session. `profiles.locale` follows the `isDemo` precedent exactly — one column, one line in the `middleware.ts:33` select, one `App.Locals` field, one pure reader                                                                                                                                                                                         |

**What these decisions retire.** Points 1, 3, 4, 5 and 6 were the places "literally everything English"
could not hold literally. Each now has a defined answer, so the requirement holds in the form that
matters — _nothing a reader encounters is unreadable_ — without pretending a signed Polish PDF can be
retroactively translated. The two genuine residuals are stated plainly: **free text stays in whatever
language its author typed** (decision 2), and **an already-issued PDF stays Polish forever**
(decision 1).

## Confidence

**HIGH** — five hypothesis investigations plus two pressure tests, all file-cited and mutually
consistent; a blind independent search reproduced the map without being told the hypothesis; and the
decisive narrowing signal (recruiter, not customer) came from the user directly and is corroborated by
the current HEAD's own change record.

One caveat worth a cheap empirical check before planning around it, not a blocker: **the
workerd-trimmed-ICU premise** behind all three hand-rolled Polish month tables (`pl-date.ts:3-7`) is
asserted in comments, backed by no compatibility flag in `wrangler.jsonc`, and **contradicted inside the
repo** — `ProtocolView.tsx:196-200` states the `pl-PL` date part already agrees across workerd/browser
ICU, and that file successfully SSRs `Intl.DateTimeFormat("pl-PL", { month: "short" })`. If ICU is in
fact fine, the "second hand-rolled table per language" cost disappears.

## What Changes for /10x-plan

Plan a **locale dimension**, not a translation pass. Items 1–7 are already decided (see Decisions
Taken) and enter the plan as settled inputs. Two things the plan must treat as first-class rather than
as consequences: the ≈215 Polish-anchored assertions with **no test-id layer to fall back on**
(`e2e-rules.md:9-10` forbids one), and the `pluralPl` arity change that touches every call site.
`autoTagDamages` is deliberately **out** of this slice — it is a pre-existing suggestion-quality
weakness tracked in `known-issues.md`, worth fixing on its own schedule.

Sequencing note the evidence supports: the cheap seam already exists (`App.Locals`, the `isDemo`
precedent) and a cookie/column locale perturbs **zero routes**; a URL-prefix locale **fails open** on
`access.ts:49-51`. And the design source is already bilingual at key parity, so mockup'd screens are a
re-export problem, not a re-authoring one — app-authored strings (validation, API, email, PDF) have no
EN twin and are the real authoring cost.

**The header is a phase, not a detail.** Dimension F means the locale control cannot be dropped into
existing chrome — `SiteHeader`, `LandingNav`, the staff band and the mobile tab bar are each at or past
capacity. The design already answers this for the public header (collapse phone+CTA into `ActionMenu`,
keep `LangToggle` always visible), and that answer **replaces** `HeaderContactToggle` and **switches the
reflow from viewport to container queries**. The staff shell has no equivalent design; the evidence
points at the uncontested `mt-auto` sidebar footer (`StaffShell.astro:193`) rather than the band, but
that is a design question the plan must raise, not settle from here. Note also there is **no
`toggle`/`tabs`/`dropdown-menu` primitive in `src/components/ui/`** — the closest existing patterns are
`HeaderContactToggle.tsx:122` and `ReservationCalendar.tsx:142-158`, with `ui/popover.tsx` already used
for header chrome at `QuickAddButton.tsx:205`.

## Adjacent, not in scope — flagged so planning sequences knowingly

The goal underneath this request is a recruiter evaluating the portfolio. English is **necessary and not
sufficient**; three current defects block that same goal and none is a language problem:

- **The protocol flow — the cockpit's most impressive surface — is unreachable from seeded state.**
  `list_dispatch_today` filters `pickup_date = current_date`
  (`20260710120000_issue_protocol.sql:456-457`); every seeded prod reservation is dated 2026-07-01…07-20.
  Wydania and Zwroty render _"Brak wydań na dziś"_. A recruiter never opens a protocol, a PDF, or the
  signature pad **in any language**.
- **Accepting a request fires a real Resend send** to a fictional `@example.com` address
  (`src/lib/email/index.ts:69-70`; no demo suppression), irreversibly consuming one of the demo's only
  two pending requests.
- **Landing featured cards render `picsum.photos` placeholders** — clouds and beaches instead of vans
  (`known-issues.md:75`).

Also surfaced en route, unrelated to localization: **`src/pages/dashboard/pickups.astro:30` has a live
Polish grammar bug** — a two-form approximation rendering _"5 rezerwacje"_ where correct Polish is
_"5 rezerwacji"_. `pluralPl` exists and is not used there.

## References

- Source files: `src/layouts/Layout.astro:17`, `src/middleware.ts:68-80`, `src/lib/access.ts:49-51,92-94`,
  `src/lib/format.ts:108-119`, `src/lib/protocol-delta.ts:110-137`, `src/lib/pl-date.ts:13-32`,
  `src/lib/media/protocol-pdf.ts:163,290,559`, `src/lib/email/templates.ts:170-173,206`,
  `src/lib/auth-messages.ts:120-140`, `src/components/dashboard/ReservationCalendar.tsx:68-95`,
  `src/components/protocol/SignaturePad.tsx:253-281`, `e2e/e2e-rules.md:9-10`
- Header surfaces (Dimension F): `src/components/SiteHeader.astro:41,51-91`,
  `src/components/LandingNav.astro:47-98,105-175`, `src/components/HeaderContactToggle.tsx:95-122`,
  `src/components/shell/StaffShell.astro:193,263-302`, `src/components/ui/popover.tsx`.
  Dead code found en route: `src/components/Topbar.astro` has zero importers and carries English
  starter-template strings
- Design source (live, via DesignSync): project `Rental car company`
  `352d78a6-84fd-49a2-8b38-2fe289691fc3` → `info-pages.jsx` (`InfoHeader`, `InfoHeaderMobile`,
  `INFO_NAV`, the `info-hdr-css` container-query block), `nav-spec.jsx` (mobile `PublicDock` scroll
  spec), `design-review/index.md` (canonical screenshot index — no header row yet)
- Foundation: `context/foundation/prd.md:154`, `context/foundation/known-issues.md:51-73`,
  `context/foundation/lessons.md:75-80,87`, `context/foundation/design-system.md:151`
- Prior decisions: `context/archive/2026-07-28-landing-redesign/plan.md:78` (PL·EN toggle cut),
  `context/archive/2026-08-28-demo-account-gate/plan.md:5,41` (recruiter path),
  `context/archive/2026-07-09-issue-protocol/design-audit.md:37-39` (`STR.EN`/`STR.PL` key parity)
- Investigations: 5 hypothesis agents (string surface, locale seam, copy/formatting separability,
  audience reachability, verification/design coupling) + 2 pressure tests (blind blocker search,
  recruiter journey trace)
