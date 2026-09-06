# Frame Brief: Staff-panel discovery on the portfolio site

> Framing step before /10x-plan. This document captures what is _actually_
> at issue, separated from what was initially assumed.

## Reported Observation

This deployment is a portfolio. The staff cockpit is the half worth showing.
The only route into it from the public site is the "Strefa pracownika" link in
the footer, and visitors do not find it. Mockups for a welcome overlay exist in
the Claude Design project. The staff link in the app's footer looks different
from the one in the mockup.

## Initial Framing (preserved)

- **User's stated cause or approach**: Visitors need an entry screen that tells
  them a staff panel exists. Once it is closed, a small info icon in the header
  should reopen it. The footer staff button should be restyled to match the
  mockup.
- **User's proposed direction**: Build the overlay, the header info icon, and
  the footer restyle. Open question: show the overlay on every landing-page
  visit or only the first time, and how to implement that logic.
- **Pre-dispatch narrowing**: Leading concern is "visitors never find the staff
  panel". The visitor may arrive on any public page, not only the home page.
  The mockup copy is "not sure — assess it against our idea, then align the
  design to match our decision."

## Dimension Map

The observation could originate at any of these dimensions:

1. **Placement and salience of the existing door** — the link is one of ~13
   identical footer links, below the fold on every page.
2. **No orienting message on the public surface** — nothing before the door
   says "portfolio, two products, demo credentials". ← initial framing
3. **Re-entry model and where "seen" state can live** — the owner's open
   question. The codebase's SSR cookie rule, view transitions, and the e2e
   suite all constrain it.
4. **Design source completeness** — the mock is behaviour-less and English-only.
   The design is ahead of the app on the header button and the footer pill.
5. **Arrival surface coverage** — a public page with no footer would leave a
   visitor with zero route.

## Hypothesis Investigation

| Hypothesis                                                             | Evidence                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | Verdict |
| ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- |
| 1. The door is invisible where it sits                                 | `SiteFooter.astro:40` — 5th of 5 in the Information column, shared `itemClass` (`:48`, 13.5px `#3B4453`), byte-identical to "FAQ" and "Contact". Present on all 9 public pages, always after 250–320 lines of body. Both headers carry no staff affordance by recorded decision (`SiteHeader.astro:23-24`). **The label repels**: "Employee zone" (`i18n/footer.ts:29,48`), title "Employee zone — sign in" (`i18n/auth.ts:34,160`), and "Ask your administrator" (`auth.ts:30-31`) all say "you need credentials you don't have".                                                                                                                                                                                                                                                                                                                                                                                  | STRONG  |
| 2. Nothing tells the visitor a second product exists (initial framing) | Zero user-visible hits for demo / portfolio / staff panel in `i18n/landing.ts`, `info.ts`, `nav.ts`, `fleet.ts`, `layout.ts` and every public page. The only "portfolio demo" copy is `i18n/auth.ts:55,179`, rendered by `SignInForm.tsx:87` — on `/auth/signin`, behind the door it advertises. `/terms` says "portfolio" (`terms.ts:36-39`) but is an orphan route linked only from a mid-funnel checkbox and never mentions a staff app. No `<meta name="description">` exists anywhere.                                                                                                                                                                                                                                                                                                                                                                                                                         | STRONG  |
| 3. The frequency question is constrained, not free                     | House rule: per-visitor presentation state is a **server-written cookie** read once in middleware and passed to islands as props (`api/locale.ts:13-22`, `LangToggle.tsx:14-22`, `middleware.ts:76-90`). Zero `localStorage` / `sessionStorage` / `document.cookie` writes in `src/`. Island state dies on every `<ClientRouter />` swap (`useGlobalSearchHotkey.ts:7-15`, `MobileNav.tsx:13-16`); nothing is `transition:persist`ed. Playwright gives every test a fresh context (`playwright.config.ts:65`), so a first-visit overlay fires in every public-page test and blocks `e2e/locale-pl.spec.ts:75-77`, which clicks the footer link by name. `tests/integration/pages-authz.test.ts:36-38` stubs `cookies.get` only. The design already encodes the answer: `recruiter-guide.jsx` header says "Shown once on first visit", and `shared.jsx` `InfoButton` says "Reopens the first-visit welcome overlay". | STRONG  |
| 4. The design source is incomplete for this slice                      | `recruiter-guide.jsx`: "MOCK ONLY (no behaviour)"; English only; lead copy says "Everything here is a static design: no sign-in needed", which describes the prototype and contradicts the app (the cockpit is behind sign-in with a demo card). No `STR.EN`/`STR.PL` entries for the overlay; `InfoButton` `aria-label="About this project"` hardcoded English. No PNG export in `design-review/index.md`. **Ahead of the app**: `InfoButton` sits beside `LangToggle` in every public nav (`customer-desktop.jsx:31,92,520,706,808`; `info-pages.jsx` `InfoHeader` / `InfoHeaderMobile`), and `InfoFooter` renders the staff link as a 36px pill (lock icon, 12.5px bold label, 22px ink arrow dot) in the copyright bar, not in a column.                                                                                                                                                                        | PARTIAL |
| 5. Some arrival pages have no route at all                             | All 9 public pages render `SiteFooter` (`index.astro:276`, `fleet/index.astro:273`, `fleet/[id]/[...slug].astro:73`, `pricing.astro:319`, `faq.astro:101`, `about.astro:250`, `reserve.astro:101`, `r/[token].astro:103`, `terms.astro:132`). Side finding: no `404.astro` or `500.astro` exists, so a bad URL is a dead end.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | NONE    |

## Narrowing Signals

- The owner named "visitors never find the staff panel" as the leading concern,
  and "any public page" as the arrival surface. That rules out a home-page-only
  splash and makes the trigger site-wide.
- The independent search, given only the observation, ranked the same two
  causes first and added the label finding: every string on the path says
  "for employees". It also found the README's Live badge points at `/`, never
  at `/auth/signin`, and never publishes the demo credentials.
- The design already carries the re-entry affordance on every public page,
  which removes the reason to auto-show the overlay more than once.
- The mock's copy contradicts the deployed app. The owner said the design will
  follow the decision, so copy is a deliverable of this change, not an input.

## Cross-System Convention

Per-visitor presentation state in this codebase is a server-side cookie, set by
a POST route and read in middleware, never a client write. The overlay's "seen"
flag is exactly that class of state. The leading hypothesis matches the
convention. Public-chrome controls are 38px pills built as small islands that
receive `locale` as a prop; the design's `InfoButton` shares that geometry.
Polish copy is canonical and English is authored alongside it in
`src/lib/i18n/*.ts`.

## Reframed (or Confirmed) Problem Statement

> **The actual problem to plan around is**: the public site presents itself as a
> real rental company and hides its only door to the cockpit behind a
> below-the-fold link labelled for employees, so a visitor is never told, before
> that door, that this is a two-product portfolio with demo credentials one
> click away.

The initial framing holds in shape: an orientation overlay, a reopen button in
the header, and a more salient footer entry are the right three pieces. The
frame sharpens three things. First, the overlay's job is orientation, and its
copy must undo the "not for you" reading: say what the site is, that a staff
app exists, and that the sign-in page publishes demo credentials. The mock's
current copy says the opposite and must be re-authored in Polish and English.
Second, the frequency question is answered by the evidence: the design already
encodes "once, then reopen", the reopen button exists on every public page, and
the arrival is any public page, so the trigger is "first public-page view in
this browser", not "landing on the home page". Third, the footer item is a
relocation plus a restyle, from a column text link to a copyright-bar pill.
The label stays "Strefa pracownika"; the overlay is what carries the invitation.

## Confidence

- **HIGH** — strong evidence on dimensions 1, 2 and 3; the independent search
  converged on the same causes; the convention matches; the owner's narrowing
  answers were decisive.

## What Changes for /10x-plan

Plan for orientation before the door on every public page, not a home-page
splash. Treat copy as a first-class deliverable and update the design to match
it (overlay copy in PL and EN, `STR` entries, a Polish `InfoButton` label, and
a PNG export for the vision-diff gate). The "seen" state must follow the house
cookie rule, and the plan must account for: five header clusters
(`LandingNav` ×3, `SiteHeader` ×2), the landing desktop cluster already at its
measured container-query budget (`LandingNav.astro:98-108`), the fresh-context
e2e model and the footer-link assertion in `locale-pl.spec.ts:75-77` (role
`link`, name matches "Strefa pracownika"; the design's pill is `role="button"`
with a longer `aria-label`), and the `pages-authz` cookie stub. Out of scope
but worth their own changes: 404/500 pages, a meta description, a README link
to `/auth/signin` with the demo credentials, and the dead `Topbar.astro`.

## References

- Source files: `src/components/SiteFooter.astro:13-21,40,48`;
  `src/components/SiteHeader.astro:22-24,93-123,148-152`;
  `src/components/LandingNav.astro:94-139,188-191,203-264`;
  `src/lib/i18n/footer.ts:7-11,29,48`; `src/lib/i18n/auth.ts:30-37,55,179`;
  `src/pages/api/locale.ts:13-22,80-81`; `src/components/header/LangToggle.tsx:14-22`;
  `src/middleware.ts:76-90`; `src/lib/i18n/resolve.ts:32-46`;
  `src/components/hooks/useGlobalSearchHotkey.ts:7-15`; `src/components/MobileNav.tsx:13-16`;
  `e2e/locale-pl.spec.ts:63-80`; `playwright.config.ts:65`;
  `tests/integration/pages-authz.test.ts:29-42`; `README.md:8,15,26`.
- Design source (Claude Design `352d78a6-84fd-49a2-8b38-2fe289691fc3`, pulled
  2026-09-06): `recruiter-guide.jsx` (whole file); `shared.jsx` `InfoButton`
  and `STR.*.login`; `info-pages.jsx` `InfoHeader`, `InfoHeaderMobile`,
  `InfoFooter`; `customer-desktop.jsx:31,92,520,706,808`; `design-review/index.md`.
- Related research: none (net-new; no prior change touched a welcome overlay).
- Investigation tasks: three sub-agents (entry-path trace, persistence and
  e2e constraints, independent cause search). No task IDs — TaskCreate is not
  available in this session.
