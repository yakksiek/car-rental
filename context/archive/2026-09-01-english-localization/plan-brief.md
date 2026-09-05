# English Localization — Plan Brief

> Full plan: `context/changes/english-localization/plan.md`
> Frame brief: `context/changes/english-localization/frame.md`

## What & Why

FleetRent has no locale seam, and the second locale it now needs is not a copy layer — it is a locale
_dimension_ spanning copy, Polish grammar encoded as executable logic, outbound artifacts, stored
data, and the page chrome that must carry the switch. The driver is the **portfolio/recruiter**
reader, not the rental customer, which is what makes whole-app scope (staff cockpit included) correct
rather than wasteful.

## Starting Point

No i18n layer exists: no `i18n` block in `astro.config.mjs`, no locale in `src/middleware.ts`, zero
i18n dependencies, and a literal `<html lang="pl">`. Polish literals sit in **157 of 249 files** under
`src/`. Polish grammar is in function _signatures_ — `pluralPl(n, [one, few, many])` is a three-slot
tuple where English needs two. Every header surface is at or past capacity (~4px of slack at 768px).
~89 E2E locators and ~170 unit assertions are anchored to literal Polish copy, with `getByTestId`
forbidden by policy.

## Desired End State

Every visitor lands in **English** by default. A `LangToggle` in the public header (visible at every
width) and a control in the staff sidebar switch to Polish; the choice persists in a cookie and, for
signed-in staff, in `profiles.locale`. Every app-authored string renders in the active locale — public
pages, cockpit, validation, API errors, emails, the PDF. Customer emails and PDFs render in the
language stored on the **reservation**, so an employee working in English still emails a Polish
customer in Polish.

## Key Decisions Made

| Decision           | Choice                                                       | Why (1 sentence)                                                                                                   | Source |
| ------------------ | ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------ | ------ |
| Issued PDFs        | Stamped, never re-rendered                                   | The signature sits directly beneath the declaration the customer actually signed.                                  | Frame  |
| Free text          | Verbatim, never machine-translated                           | English chrome around Polish free text is the correct outcome; hybrid documents are by design.                     | Frame  |
| Polish legal terms | Keep Polish name + one-time English gloss                    | Inventing an English equivalent for NIP or _dowód osobisty_ produces confidently wrong English.                    | Frame  |
| `/terms`           | Placeholder page in PL + EN, clearly marked                  | Customers currently accept a document that does not exist anywhere in the repo.                                    | Frame  |
| Brand              | `Flota` everywhere; the _nav item_ translates to Fleet       | Identical string, opposite requirement — so brand and nav label live in different catalog namespaces.              | Frame  |
| GoTrue auth email  | Bilingual templates, no architecture change                  | GoTrue renders one template per project per type; per-user language would mean dropping its mailer entirely.       | Frame  |
| Locale storage     | `reservations.locale` + `profiles.locale`                    | Language is a property of the reservation, not the sender's session — resolves the async-send problem at the root. | Frame  |
| Catalog shape      | Namespaced `src/lib/i18n/<domain>.ts`, exposed as `locals.t` | Astro's own recipe, at Starlight's scale; per-namespace files keep React island bundles tree-shakeable.            | Plan   |
| Locale resolution  | Cookie → `profiles.locale` → **EN** default                  | Deterministic and SSR-safe; the recruiter reads English from CV link to sign-out with zero interaction.            | Plan   |
| Grammar handling   | Full `Intl` migration — delete the hand-rolled Polish        | Probe proved workerd has full ICU, so grammar is deletable rather than duplicable per language.                    | Plan   |
| Test strategy      | Re-anchor specs to EN, keep a PL smoke spec                  | The suite should test the default a recruiter actually sees.                                                       | Plan   |
| EN copy authorship | Harvest design `STR.EN` → seed a glossary → author the rest  | The design source is already bilingual at enforced key parity; it becomes the pinned vocabulary.                   | Plan   |
| Seed data          | Translate to EN, retain 2 PL rows                            | Fixtures are content we control; the retained rows keep hybrid rendering visible and testable.                     | Plan   |

## Scope

**In scope:** locale seam (middleware + cookie + 5 DB columns); full `Intl` migration; public header
redesign with `LangToggle`; staff sidebar + account controls; all 157 files of app copy; 17 API `MSG`
maps; 5 zod schema maps; 5 email templates; the protocol PDF; bilingual GoTrue templates; brand
reconciliation; `/terms` placeholder; seed translation; E2E re-anchoring.

**Out of scope:** URL-prefixed locales (fails open on `access.ts:49-51`); `Accept-Language` sniffing;
regenerating issued PDFs; translating user-typed free text; the `autoTagDamages` string-matching fix
(pre-existing, tracked in `known-issues.md`); a `generateLink` auth-architecture change; translation
columns on business entities.

## Architecture / Approach

Locale resolves once per request in `src/middleware.ts` — cookie → `profiles.locale` → `en` — riding
the existing `profiles` select, so it costs no extra round trip. It lands on `App.Locals` as `locale`
plus a bound translator `t`, mirroring the `isDemo` precedent exactly and matching how Starlight
exposes `Astro.locals.t`. Astro components read `locals.t`; `src/lib` and API routes call
`useTranslations(locale)`; React islands take `locale` as a prop and import their own namespace file.
Switching is a `POST /api/locale` that sets the cookie server-side and redirects — never a client
cookie write, which would leave SSR markup in the previous locale.

## Phases at a Glance

| Phase                         | What it delivers                                                | Key risk                                                                       |
| ----------------------------- | --------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| 1. Locale seam + storage      | Middleware resolution, `locals.t`, switch endpoint, 1 migration | Worker deploying ahead of the migration locks out every staffer app-wide       |
| 2. Retire grammar-as-logic    | `Intl` replaces all hand-rolled PL dates, plurals, money        | ~35 formatting sites; the two `zł`-stripping regexes break silently under EN   |
| 3. Header redesign + switcher | Public header per design, staff sidebar + account controls      | Zero slack in existing chrome; staff design must be authored first             |
| 4. Recruiter path to English  | Glossary, landing, footer, auth, cockpit shell, Pulpit, seed    | **Acceptance test passes here** — leakage on this path is the headline failure |
| 5. Remaining app copy         | All other screens, 17 API maps, 5 schema maps, lib labels       | Largest surface; `slug.ts` must not change or vehicle URLs break               |
| 6. Outbound artifacts + brand | 5 emails, PDF + locale stamp, bilingual GoTrue, FleetRent→Flota | An English PDF still carries Polish names — the WinAnsi encoding trap          |
| 7. `/terms` + verification    | Terms page, consent attribution, PL smoke spec, parity gates    | Prod migration lag; `config.toml` must never be `config push`ed                |

**Prerequisites — all cleared 2026-09-01** (see `design-contract.md` §4/§5). The `INFO_NAV`
`'Fleet'`→`Flota` defect is fixed in the design source; `LangToggle` has been moved out of
`StaffTopbar` into a new `SidebarLangRow` in the sidebar `mt-auto` block (the shipped band cannot
hold it); and both edits are rendered and captured as 14 canonical PNGs in `design-review/`.
**Design Alignment Audit: PASS.** One new defect surfaced _by_ the render — the staff sidebar nav is
hardcoded Polish — which adds app-authored strings to Phase 4 but blocks nothing.

**Estimated effort:** ~7 sessions, one per phase; Phase 5 is the largest and may split.

## Open Risks & Assumptions

- **Phase 4/5 boundary leaves the app genuinely mixed-language.** Accepted — it buys the acceptance
  test passing three phases early.
- **Re-anchoring ~89 E2E locators to English happens in the same phases that change the copy.**
  Mitigated by landing copy first, running red, then rewriting locators — never both in one commit.
- **`Intl` output may differ cosmetically from the hand-rolled tables** (e.g. `pt.` vs `pt`). Phase 2
  spot-checks under `pl` before any copy changes, so a diff is attributable.
- **The design's container-query reflow replaces `HeaderContactToggle` rather than extending it** —
  a component deletion, not a refactor, so anything depending on its two-segment behaviour must be
  re-checked.
- **`profiles.locale` is nullable** — null means "no preference," resolving to EN, not to Polish.

## Success Criteria (Summary)

- A recruiter opens the landing page cold, follows the footer link, signs into the demo, and reads
  the cockpit and protocol flow end to end without encountering Polish.
- Switching to Polish anywhere returns the previous copy exactly, preserving the current page.
- A Polish customer's confirmation email and PDF stay Polish even when accepted from an English
  dashboard — and an already-issued PDF is never re-rendered.
