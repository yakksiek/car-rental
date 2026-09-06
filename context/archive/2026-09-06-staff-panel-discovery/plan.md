# Staff-Panel Discovery Implementation Plan

## Overview

The deployed site is a portfolio, and its most interesting half — the staff dispatch cockpit — is
reachable only through a footer link labelled for employees. This change tells a visitor, on the
landing page and before that door, that Flota is two products and that the sign-in page publishes
working demo credentials.

Three pieces: a first-visit orientation overlay on the landing page, an info pill in the landing
header that reopens it, and the footer's staff entry restyled from a column text link into a
copyright-bar pill.

## Current State Analysis

The framing work is done in `context/changes/staff-panel-discovery/frame.md` and is authoritative
here. Its findings, confirmed against the code during this planning session:

- **The only public route into the cockpit is `SiteFooter.astro:40`** — the fifth and last row of
  the Information column, styled by the shared `itemClass` at `:48` and byte-identical to "FAQ" and
  "Kontakt". It sits below 250–320 lines of body on all nine public pages.
- **Every string on that path repels a visitor.** `footer.staffZone` is "Employee zone", the
  sign-in title is "Employee zone — sign in", and the help link reads "Ask your administrator".
- **Nothing on the public site says "portfolio".** The only such copy is the demo card in
  `src/lib/i18n/auth.ts`, rendered by `SignInForm.tsx` on `/auth/signin` — behind the door it
  advertises.
- **Per-visitor presentation state is a server-written cookie**, set by a POST route and read by the
  server, never a client write. `src/pages/api/locale.ts` is the reference implementation and
  `src/lib/i18n/resolve.ts` the reference pure resolver. There are zero `localStorage`,
  `sessionStorage` or `document.cookie` writes anywhere in `src/`.
- **There are two public header components, not one.** `SiteHeader.astro` backs eight pages;
  `LandingNav.astro` is a deliberate fork for the landing's over-hero chrome, with three clusters
  (desktop pill, tablet glass band, mobile bar). This change touches the fork only.

### Key Discoveries

- **The dialog primitive already ships.** `package.json` depends on the unified `radix-ui` package
  at `^1.5.0`, which re-exports `react-dialog` alongside the `react-popover` that
  `src/components/ui/popover.tsx` already consumes. No new dependency, and no hand-rolled focus
  trap — the app currently has none anywhere.
- **The Astro-to-island open seam has a precedent.** `src/components/search/GlobalSearch.tsx`
  listens for a DOM event so plain Astro markup can open a React island. The header pill can be a
  zero-JavaScript Astro button.
- **The existing e2e suite needs no changes.** Only `e2e/locale-pl.spec.ts:66` visits `/`, and it
  runs under the default `employee` storage state. The signed-in carve-out means it never sees the
  overlay. `e2e/auth.setup.ts` and `e2e/seed.spec.ts` are anonymous but visit `/auth/signin` and
  `/fleet/{id}`, neither of which the overlay reaches.
- **The landing desktop cluster is width-budgeted, and this change spends the budget.**
  `LandingNav.astro:96-108` records the measurement: the pill is `grid-cols-[1fr_auto_1fr]`, so the
  content box must hold the 393px nav plus twice the 402px right cluster, giving the current
  `@min-[1208px]` threshold. Adding a 38px pill and its 20px gap takes the cluster to 460px and the
  threshold to roughly 1324px content, about 1424px viewport.
- **The overlay mock is not registered in the design's own export harness.** `export-shot.html`
  loads eighteen JSX files and `recruiter-guide.jsx` is not among them, and its three screens have
  no `SCREENS` entry. Phase 1 has to add both before any PNG can be exported.
- **The mock's copy contradicts the app.** Its lead says "Everything here is a static design: no
  sign-in needed", which describes the prototype. It is English-only, with no `STR.EN` / `STR.PL`
  entries, and `InfoButton`'s `aria-label` is hardcoded English.

## Desired End State

A visitor arriving at the landing page for the first time in a browser sees a dark modal over the
hero. It says Flota is two products, names the staff area, and says the sign-in page publishes demo
credentials. One button dismisses it, another goes to sign-in; both remember the visit. It does not
return on the next page view, and an info pill beside the language switcher brings it back at any
time. On every public page the footer's staff entry is now a bordered pill in the copyright bar with
a lock icon and an arrow, instead of a grey link lost among four siblings.

Verify by: loading `/` in a clean browser profile (overlay appears), reloading (it does not),
clicking the header pill (it returns), and checking that `/fleet` and the other public pages show
the footer pill and no overlay.

## What We're NOT Doing

- **No overlay or info pill on the eight non-landing public pages.** The owner scoped both to the
  landing. Those pages get the footer pill only. This knowingly diverges from the frame's "any
  public page" arrival finding — recorded as a deviation, not an oversight.
- **No change to `SiteHeader.astro`.** Its two clusters, its container-query thresholds, and its
  mobile hamburger are untouched.
- **No 404 or 500 page**, no meta description, no README link to `/auth/signin`, and no removal of
  the dead `Topbar.astro`. The frame lists these as separate changes.
- **No change to the footer's label.** It stays "Strefa pracownika" / "Employee zone"; the overlay
  carries the invitation.
- **No demo credentials rendered in the overlay.** It says where to find them; the sign-in card
  keeps publishing them.
- **No change to `shouldSecureCookies`**, to `/api/locale`, or to the locale resolution chain.

## Implementation Approach

Server decides, island renders. The landing page computes whether to auto-show from the cookie and
the session, and hands the answer to the island as a prop — the same shape as locale resolution, and
the reason there is no hydration mismatch and no client cookie write.

Dismissal is a real `<form method="POST">` wrapping the modal's action buttons, each carrying its
own `redirect` value. Without JavaScript the form posts, the cookie is set, and the server 303s back
to the right place. With JavaScript the island intercepts the two dismiss buttons, closes the modal
in place, and sends the same POST in the background; the staff button is left to submit natively so
the cookie is set on the way to sign-in. One mechanism, two behaviours, no separate no-JS path.

The header pill carries no JavaScript. The island attaches one delegated click listener and opens
when a `[data-orientation-open]` element is clicked, so the header stays plain Astro markup.

**Why a form at all** (asked and settled 2026-09-06). The form exists because the island mounts
`client:load`, which server-renders the modal into the landing page's HTML. With JavaScript
disabled that markup is present and visible but never hydrates, so plain buttons would be dead and
the visitor would sit behind a scrim with no way out. The form is what keeps them working. It also
removes a race: a background POST fired immediately before navigating to sign-in can be cancelled
in flight, whereas a native submit sets the cookie and follows the redirect in one step.

Two alternatives were weighed and rejected. Writing the cookie at render time with plain anchors as
dismiss controls would delete the form, this route and the fetch — but it puts the first cookie
write in this codebase outside a POST route, and Astro enables link prefetching alongside the
view-transition router, so a hovered link to `/` from another page could burn a visitor's first
view before they click. Mounting `client:only` would remove the trap at its source but makes the
modal pop in after the hero paints, on the one page whose job is a first impression. The owner
chose to keep every cookie write in a POST route, matching the locale precedent exactly.

## Critical Implementation Details

**Timing and lifecycle.** The island mounts `client:load`, not `client:idle`. On a portfolio landing
page the modal must be in the server-rendered HTML — a `client:idle` island would paint the hero
first and pop the modal in afterwards, which reads as a defect on the one page whose job is a first
impression.

**State sequencing.** The background POST is fire-and-forget and must not gate the close. Close the
modal first, then send. A failed POST means the overlay returns on the next visit, which is a
tolerable outcome; a close that waits on the network is not.

**Performance constraints.** `context/archive/2026-09-01-english-localization/island-baseline.md`
governs island chunk sizes, and its sentinel rule is that `format.*.js` must not move and the
server-only namespace chunks must stay absent from `dist/client/`. A new island importing a new
namespace is exactly the shape that breaks it, so the island must import `translator` from
`src/lib/i18n/types.ts` and only the `orientation` namespace — never the composed map from
`src/lib/i18n/index.ts`.

## Phase 1: Design Alignment

### Overview

Bring the Claude Design source into agreement with the decisions above, then export canonical
screenshots so the later phases have something to diff against. Nothing in `src/` changes here.

### Changes Required:

#### 1. Overlay copy, in both locales

**File**: Claude Design project `352d78a6-84fd-49a2-8b38-2fe289691fc3`, `recruiter-guide.jsx`

**Intent**: The mock's lead describes a static prototype and contradicts the deployed app, and the
whole file is English-only. Re-author the kicker, heading, lead, both cards and the skip link to the
agreed message — two products, a staff app behind sign-in, credentials published on the sign-in
page — and drive every string from `useLang()` so the mock renders in Polish too.

**Contract**: Add a `guide` block to both `STR.EN` and `STR.PL` in `shared.jsx` carrying:
`kicker`, `heading`, `leadBefore`, `leadStrong`, `leadAfter`, `publicTitle`, `publicBody`,
`publicCta`, `staffTitle`, `staffBody`, `staffCta`, `skip`, `close`, `dialogLabel`. The card-01
button's label becomes a dismiss action rather than a navigation. Polish is canonical; the strings
are listed verbatim in `design-contract.md` and are the source `src/lib/i18n/orientation.ts` copies
from in Phase 3.

#### 2. Header button and footer pill labels

**File**: Claude Design project, `shared.jsx` (`InfoButton`), `info-pages.jsx` (`InfoFooter`)

**Intent**: `InfoButton` hardcodes `aria-label="About this project"` in English in both halves, the
same gap the language toggle had. Give it a translated label. Reconcile the footer pill's
accessible name with what the app will ship.

**Contract**: `InfoButton` reads its label and title from `useLang()`. `InfoFooter`'s pill keeps its
visual spec unchanged; its `aria-label` is recorded in the contract as the design's value, against
which the app's anchor is marked a deviation.

#### 3. Remove the info pill from the four non-landing clusters

**File**: Claude Design project, `info-pages.jsx` (`InfoHeader`, `InfoHeaderMobile`),
`customer-desktop.jsx` (the three landing clusters keep it)

**Intent**: The design draws `InfoButton` in all five public header clusters; the app ships it on
the landing only. Delete it from the two `info-pages.jsx` headers so the design and the app agree,
rather than carrying a permanent five-way deviation.

**Contract**: `<InfoButton /><LangToggle />` becomes `<LangToggle />` in `InfoHeader` and
`InfoHeaderMobile`. The three landing clusters in `customer-desktop.jsx` are unchanged.

#### 4. Register the overlay in the export harness

**File**: Claude Design project, `export-shot.html`

**Intent**: `recruiter-guide.jsx` is loaded by no script tag and has no `SCREENS` entry, so its three
screens cannot be rendered by the harness that produces every other canonical PNG.

**Contract**: Add a `<script type="text/babel" src="recruiter-guide.jsx">` tag after
`customer-desktop.jsx` (which defines the `ScreenDesktopHome` / `ScreenTabletHome` /
`ScreenMobileHome` the overlay renders behind itself), plus three `SCREENS` entries —
`guide-d` at 1440×900, `guide-t` at 834×1112, `guide-m` at 390×844.

#### 5. Export canonical screenshots

**File**: `context/changes/staff-panel-discovery/design-review/`

**Intent**: No canonical PNG exists for the overlay, the landing header with the pill, or the
restyled footer. Without them the Phase 3–5 vision-diff gates have nothing to compare against.

**Contract**: Render through the harness with Playwright at `deviceScaleFactor: 2`, in both locales
for the overlay. Serve the design directory locally and drive `window.__render2x(id, lang)`.
Files: `guide-d-pl.png`, `guide-d-en.png`, `guide-t-pl.png`, `guide-m-pl.png`,
`landing-header-pl.png`, `footer-pill-pl.png`, and `info-header-pl.png` (added during execution so
the pill removal has its own baseline). Fonts must come from the app's own self-hosted
variable Inter, copied from `.astro/fonts/` with per-subset `@font-face` rules including
`latin-ext`, and font readiness asserted at capture time — the Google CDN serves static instances
that snap the design's 540/650/750 weights and silently skew the diff.

**DONE 2026-09-06.** Seven boards captured, zero page errors. The design project's own
`export-shot.html` cannot produce diff-grade output for these boards because it links the CDN's
static Inter; that caveat is now written into both the harness and `design-review/index.md`.

#### 6. The design contract

**File**: `context/changes/staff-panel-discovery/design-contract.md`

**Intent**: The exact-values contract the build phases work from, and the audit record the project's
plan gate requires.

**Contract**: Follows the `english-localization` contract's structure — a Design Alignment Audit
block (freshness, quality gaps, plan-vs-design alignment, verdict), a token map, a per-surface spec
table with one exact value per element, and verbatim Polish copy. Every line marked `exact` or
`deviation(reason)`. Sections: overlay (desktop / tablet / mobile), `InfoButton`, footer pill.

### Success Criteria:

#### Automated Verification:

- Every edited design file parses: `node_modules/.bin/esbuild <file>.jsx --outfile=/dev/null`
- Six PNGs exist under `context/changes/staff-panel-discovery/design-review/`
- The capture run reports zero page errors and `document.fonts.check("650 13px Inter")` true
- `design-contract.md` exists and every spec line carries `exact` or `deviation(`

#### Manual Verification:

- The re-authored overlay copy reads correctly in Polish and says nothing untrue about the app
- The exported overlay PNGs show the modal over a recognisable landing page at all three widths
- The two `info-pages.jsx` headers no longer draw the info pill

**Implementation Note**: Pause here for confirmation that the design source and the exported
screenshots are right before any code is written. Every later phase diffs against these files.

---

## Phase 2: Seen-State Plumbing

### Overview

The cookie, the pure resolver that decides whether to auto-show, and the public POST route that
writes it. No UI. Fully testable before anything renders.

### Changes Required:

#### 1. The resolver and cookie name

**File**: `src/lib/orientation.ts`

**Intent**: Decide, from the cookie and the session, whether the landing page should auto-show the
overlay. Kept pure and I/O-free so the precedence is unit-testable without a request — the same
split as `resolveLocale`, where middleware does the I/O and this decides.

**Contract**: Exports `ORIENTATION_COOKIE` (the cookie name, `"orientation"` — the presentation
class, alongside `locale`, so no `flota-` prefix, which is reserved for the auth-session markers in
`src/lib/auth-session.ts`), `ORIENTATION_SEEN` (the stored value), and
`shouldAutoShowOrientation({ cookie, signedIn }): boolean`. Returns false when the cookie holds the
seen value, false when signed in, true otherwise. Never throws; an unrecognised cookie value is
treated as absent, so a hand-edited cookie shows the overlay rather than erroring the landing page.

#### 2. The write route

**File**: `src/pages/api/orientation.ts`

**Intent**: Set the seen cookie server-side. Deliberately public — an anonymous visitor is its only
user — and bounded to setting one cookie to one constant value and redirecting to a re-validated
internal path.

**Contract**: `POST` only. Self-gates in the order the project's API rule requires: same-origin
check on `origin` against `context.url.origin` → 403, then body parse → 400, then the write. Must
carry a comment saying it is intentionally public, as the rule requires for such routes. The cookie
is written with `httpOnly: true` (nothing in the browser reads it — the island receives the answer
as a prop), `sameSite: "lax"`, `path: "/"`, `maxAge` one year, and `secure: shouldSecureCookies(url)`.

The `redirect` field is optional and decides the response shape: present → 303 to
`safeInternalPath(redirect)`, absent → 204. `safeInternalPath`, not `safeRedirectPath` — the latter
falls back to `/dashboard` and refuses `/auth/*`, both wrong here, and the staff button redirects to
exactly `/auth/signin`.

#### 3. Tests

**File**: `src/lib/orientation.test.ts`, `tests/integration/api-authz.test.ts`

**Intent**: Prove the resolver's precedence and that the route fails closed on a cross-origin POST.

**Contract**: Unit tests cover the four resolver cases — no cookie and anonymous, seen cookie,
signed in, unrecognised cookie value. The route joins the existing API authorization suite with a
negative case: a POST carrying a foreign `Origin` header is refused 403 and sets no cookie.

### Success Criteria:

#### Automated Verification:

- Unit tests pass: `npm test`
- Integration tests pass: `npm run test:integration`
- Type checking passes: `npx astro check`
- Linting passes: `npm run lint`

#### Manual Verification:

- A `curl` POST to `/api/orientation` with no `Origin` header is refused 403
- A same-origin POST with a `redirect` field responds 303 and sets the cookie

---

## Phase 3: Orientation Overlay

### Overview

The copy catalog, the modal island, and the landing mount that decides whether it opens by itself.

### Changes Required:

#### 1. The copy catalog

**File**: `src/lib/i18n/orientation.ts`, `src/lib/i18n/index.ts`

**Intent**: The overlay's Polish and English strings, transcribed verbatim from the Phase 1 design
contract.

**Contract**: A `defineDict` namespace exporting `orientation`, registered in the `NAMESPACES` map.
Registration is what brings it under the key-parity and Polish-leakage gates in
`src/lib/i18n/parity.test.ts`, which walks that map rather than a list of its own. Keys as listed in
Phase 1. The lead sentence is three keys — `leadBefore`, `leadStrong`, `leadAfter` — because the
design emphasises the product name mid-sentence and a catalog string carries no markup.

#### 2. The overlay island

**File**: `src/components/orientation/OrientationOverlay.tsx`

**Intent**: The modal itself — dark card over a blurred scrim, brand and close button, kicker,
serif heading, lead, two cards, skip link. Built on the Radix dialog already inside the app's
`radix-ui` dependency, so focus trapping, Escape-to-close, scroll lock and the `aria-modal`
contract come from the primitive rather than being hand-rolled. Every existing overlay in this
codebase hand-rolls them and none has a focus trap.

**Contract**: Props are `locale: Locale` and `initialOpen: boolean`. Imports `translator` from
`src/lib/i18n/types.ts` with the `orientation` namespace only — never the composed map from
`src/lib/i18n/index.ts`, which would pull every namespace and both locales into the browser chunk.

The modal's three action controls live inside one `<form method="POST" action="/api/orientation">`.
Each is a submit button carrying `name="redirect"` with its own value: the ✕ and the "explore the
site" button send the current path, the staff button sends `/auth/signin`. The island intercepts
submission of the first two, closes in place and sends the POST in the background; it does not
intercept the staff button, so the native submit sets the cookie and follows the 303. The skip link
is the same action as the explore button.

Reopening: one delegated `click` listener on `document`, matching
`event.target.closest("[data-orientation-open]")`, added and removed with the island's lifecycle.
Delegation is what keeps the header free of JavaScript and avoids the `astro:page-load` re-binding
guard that `StaffShell.astro` needs for its own bound handlers.

Layout follows the design's container queries, not viewport breakpoints: the modal is the query
container and collapses its two cards to one column below 520px, matching the mock and the
project's embeddable-panels rule.

#### 3. The landing mount

**File**: `src/pages/index.astro`

**Intent**: Compute the auto-show answer server-side and hand it to the island.

**Contract**: Reads the cookie via `Astro.cookies` and the session via `Astro.locals.user`, passes
both through `shouldAutoShowOrientation`, and mounts the island `client:load` — not `client:idle`,
so the modal is in the server-rendered HTML and does not pop in after the hero paints. The current
path is passed for the dismiss buttons' `redirect` value.

### Success Criteria:

#### Automated Verification:

- Catalog parity passes for the new namespace: `npm test`
- Type checking passes: `npx astro check`
- Linting passes: `npm run lint`
- Production build succeeds: `npm run build`
- Island budget holds: after `npm run build`, `format.*.js` has not grown and no
  `orientation.*.js` server-copy chunk appears in `dist/client/_astro/`

#### Manual Verification:

- A clean profile at `/` shows the overlay; Escape, the ✕ and the explore button all close it
- Reloading does not show it again; the staff button lands on `/auth/signin` and does not show it on
  return
- Focus is trapped inside the modal while open and the page behind does not scroll
- Vision-diff against `guide-d-pl.png`, `guide-t-pl.png` and `guide-m-pl.png` is clean apart from
  recorded deviations

**Implementation Note**: Pause here for manual confirmation before Phase 4.

---

## Phase 4: Landing Header Info Pill

### Overview

The reopen affordance, in all three clusters of the landing nav fork, and the container-query
threshold that adding it moves.

### Changes Required:

#### 1. The pill

**File**: `src/components/LandingNav.astro`

**Intent**: A 38px circular button matching the language toggle's geometry so the pair reads as one
group, carrying the design's info glyph, in the desktop pill, the tablet glass band and the mobile
bar. Plain Astro markup with no client directive — the overlay island picks up the click by
delegation.

**Contract**: `<button type="button" data-orientation-open>` with a translated `aria-label` added to
`src/lib/i18n/nav.ts` (the existing `about` key is the "O nas" nav destination and must not be
reused). Sits immediately before `<LangToggle>` in each cluster, matching the design's order. Light
tone on the desktop pill, dark tone on the tablet and mobile over-hero clusters, borrowing the
language toggle's own tone treatment.

#### 2. The desktop threshold

**File**: `src/components/LandingNav.astro`

**Intent**: The desktop pill's `@min-[1208px]` threshold was derived by measurement and is now
wrong. The cluster grows by the pill plus its gap, and the grid's symmetric `1fr` side columns mean
the container must hold twice that growth.

**Contract**: Re-derive rather than guess: measure the expanded cluster in the browser, apply
`nav + 2 × cluster`, round up for font-rendering slack, and update the three `@min-[…]` utilities on
the phone link, the CTA and the action-menu wrapper together. The arithmetic predicts a cluster near
460px and a threshold near 1324px content, about 1424px viewport, but the measured number governs.
Update the explanatory comment at `LandingNav.astro:96-108` with the new figures — it is the record
of why the number is what it is.

The consequence is deliberate and belongs in the contract: between roughly 1280px and 1424px the
phone number and "Przeglądaj flotę" now live in the action menu rather than the bar. The hero
carries its own primary search CTA, and the number stays one tap away at every width.

#### 3. Mobile fit

**File**: `src/components/LandingNav.astro`

**Intent**: The mobile bar already carries the language toggle, the action menu and the hamburger.
A fourth control at the project's 360px viewport floor is the tightest fit in this change.

**Contract**: Verify at 360px that the row does not wrap and the page gains no horizontal scrollbar.
If it does not fit, the hamburger's `size-10` and the cluster gap are the two values to trade, and
whichever is changed is recorded as a deviation.

### Success Criteria:

#### Automated Verification:

- Type checking passes: `npx astro check`
- Linting passes: `npm run lint`
- Production build succeeds: `npm run build`

#### Manual Verification:

- The pill opens the overlay from all three clusters, including after a view-transition navigation
  back to `/`
- Measured sweep at 1920 / 1440 / 1424 / 1400 / 1280 / 1208 / 1024 / 900 / 768 / 500 / 390 / 360:
  the nav pill never wraps, `scrollWidth` never exceeds the viewport, and the phone and CTA appear
  exactly at the new threshold
- Vision-diff against `landing-header-pl.png` is clean apart from recorded deviations

**Implementation Note**: Pause here for manual confirmation before Phase 5.

---

## Phase 5: Footer Staff Pill

### Overview

Move the staff entry out of the Information column into the copyright bar and restyle it as the
design's pill. Affects all nine public pages, since the footer is shared.

### Changes Required:

#### 1. The pill

**File**: `src/components/SiteFooter.astro`

**Intent**: The staff link is currently the fifth of five identical rows in a column, which is why
visitors do not find it. The design puts it in the copyright bar as a bordered pill with a lock icon
and a filled arrow dot — the only element in the footer that is not a plain text link.

**Contract**: Remove the `staffZone` entry from the `information` array. The copyright bar becomes a
wrapping flex row, copyright text at one end and the pill at the other. The pill ships as an `<a>`,
not the design's `role="button"` — it navigates, so an anchor is the correct element, and its
visible label stays its accessible name. This keeps `e2e/locale-pl.spec.ts:75` working unchanged,
and is recorded as `deviation(anchor navigates; role="button" would mis-announce it)`.

Exact values come from the design contract: 36px height, pill radius, the border and fill, a 14px
lock glyph, a 12.5px bold label, and a 22px ink circle holding a 12px white arrow.

#### 2. The label comment

**File**: `src/components/SiteFooter.astro`

**Intent**: The file carries a long comment explaining why this link exists and why it sits last in
the Information column. That second half is now false.

**Contract**: Rewrite the placement rationale to describe the copyright bar and this change; keep
the part explaining that the route is public and self-gating.

### Success Criteria:

#### Automated Verification:

- Type checking passes: `npx astro check`
- Linting passes: `npm run lint`
- Existing e2e still passes: `npm run test:e2e`

#### Manual Verification:

- The pill appears in the copyright bar on all nine public pages and leads to `/auth/signin`
- At 360px the copyright bar wraps cleanly rather than overflowing
- Vision-diff against `footer-pill-pl.png` is clean apart from recorded deviations

**Implementation Note**: Pause here for manual confirmation before Phase 6.

---

## Phase 6: End-to-End Coverage and Fidelity Sweep

### Overview

One browser-level spec for the contract no cheaper layer can prove, and the final check that the
three surfaces match the Phase 1 exports.

### Changes Required:

#### 1. The spec

**File**: `e2e/orientation.spec.ts`

**Intent**: The once-then-reopen behaviour crosses the cookie, the API route, the server-rendered
page and a hydrated island. Every one of those can fail by silently showing the overlay on every
visit, which looks fine in a screenshot.

**Contract**: Anonymous context via `test.use({ storageState: { cookies: [], origins: [] } })`.
Asserts, in one walk: a first visit to `/` shows the overlay; dismissing it reveals the landing
page; a reload does not show it again; the header pill brings it back. Locators are role-based per
the suite's rules, `waitForIslands` runs before the first interaction with the island, and there is
no `waitForTimeout` anywhere.

A second, shorter test asserts the staff button reaches `/auth/signin` and that returning to `/`
afterwards shows no overlay — the case that would regress if the staff button stopped setting the
cookie.

#### 2. Suite check

**File**: `e2e/e2e-rules.md`

**Intent**: Record that the landing page now has a first-visit modal, so a future anonymous spec
that visits `/` knows to seed the cookie.

**Contract**: One rule entry naming the cookie and the two ways to suppress the overlay — seed the
cookie, or run under a storage state that carries a session.

### Success Criteria:

#### Automated Verification:

- The new spec passes: `npm run test:e2e`
- The full suite passes with no other spec changed
- Lint, types and build all pass

#### Manual Verification:

- Breaking the cookie write on purpose makes the reload assertion fail, proving the spec would catch
  a regression
- Final vision-diff across all three surfaces is empty apart from recorded deviations
- The overlay reads correctly in Polish with the `locale=pl` cookie set

---

## Testing Strategy

### Unit Tests

- `shouldAutoShowOrientation` precedence: absent cookie and anonymous, seen cookie, signed in,
  unrecognised cookie value
- Catalog parity: the `orientation` namespace has identical keys in both locales and no Polish
  leaking into the English half — covered automatically once registered in `NAMESPACES`

### Integration Tests

- `POST /api/orientation` refuses a cross-origin request 403 and sets no cookie
- A same-origin POST sets the cookie and, with a `redirect` field, responds 303 to a re-validated
  internal path

### Manual Testing Steps

1. Open `/` in a clean browser profile — the overlay is present in the initial HTML, not popped in
2. Press Escape, then reload — the overlay does not return
3. Clear the `orientation` cookie, reload, and click the staff button — sign-in loads; return to `/`
   and no overlay appears
4. Click the header info pill on desktop, tablet and mobile widths
5. Set the `locale=pl` cookie and repeat step 1 — every string is Polish
6. Sign in as staff and visit `/` — no overlay, but the pill still works
7. Disable JavaScript and load `/` — no overlay appears at all, and the footer pill still navigates
8. Sweep the landing header widths listed in Phase 4 and confirm no wrap and no horizontal scroll

## Performance Considerations

The overlay island is on the landing page's critical path by design, since it renders `client:load`
to avoid a visible pop-in. Keeping it cheap is the reason it imports one namespace through
`translator` rather than the composed catalog. The Phase 3 build check compares against
`island-baseline.md`: `format.*.js` must not move, and no server-only namespace chunk may appear in
`dist/client/`.

## Migration Notes

No database change, no migration, no environment variable. The cookie is additive — a visitor
without it simply sees the overlay once. Rolling back is deleting the island, the route and the
resolver; a stale `orientation` cookie left in a browser is inert.

## References

- Frame brief: `context/changes/staff-panel-discovery/frame.md`
- Design contract (written in Phase 1): `context/changes/staff-panel-discovery/design-contract.md`
- Cookie and public-POST reference: `src/pages/api/locale.ts`
- Pure resolver reference: `src/lib/i18n/resolve.ts`
- Astro-to-island open seam: `src/components/search/GlobalSearch.tsx`
- Landing cluster budget: `src/components/LandingNav.astro:96-108`
- Island size budget: `context/archive/2026-09-01-english-localization/island-baseline.md`
- Contract format model: `context/archive/2026-09-01-english-localization/design-contract.md`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Design Alignment

#### Automated

- [x] 1.1 Every edited design file parses under esbuild — `shared.jsx`, `recruiter-guide.jsx`, `info-pages.jsx`, and the inline block of `export-shot.html`
- [x] 1.2 Six PNGs exist under `design-review/` — seven shipped; `info-header-pl.png` was added so the pill removal has its own baseline
- [x] 1.3 Capture run reports zero page errors and Inter font readiness — all three families asserted with Polish diacritics, so `latin-ext` is proven loaded
- [x] 1.4 `design-contract.md` exists with every spec line marked

#### Manual

- [x] 1.5 Re-authored Polish copy reads correctly and says nothing untrue
- [x] 1.6 Overlay PNGs show the modal over the landing at all three widths
- [x] 1.7 The two info-pages headers no longer draw the info pill — asserted in the DOM, not by eye, and all five info-pages screens re-rendered with zero errors to prove the whole-file rewrite was faithful

### Phase 2: Seen-State Plumbing

#### Automated

- [x] 2.1 Unit tests pass — 6b43c4c
- [x] 2.2 Integration tests pass — 6b43c4c
- [x] 2.3 Type checking passes — 6b43c4c
- [x] 2.4 Linting passes — 6b43c4c

#### Manual

- [x] 2.5 Cross-origin POST refused 403 — 6b43c4c
- [x] 2.6 Same-origin POST with redirect responds 303 and sets the cookie — 6b43c4c

### Phase 3: Orientation Overlay

#### Automated

- [x] 3.1 Catalog parity passes for the new namespace — c13aa25
- [x] 3.2 Type checking passes — c13aa25
- [x] 3.3 Linting passes — c13aa25
- [x] 3.4 Production build succeeds — c13aa25
- [x] 3.5 Island budget holds against the baseline — c13aa25

#### Manual

- [x] 3.6 Clean profile shows the overlay; Escape, ✕ and explore all close it — c13aa25
- [x] 3.7 Reload does not re-show; staff button lands on sign-in and does not re-show on return — c13aa25
- [x] 3.8 Focus trapped, background does not scroll — c13aa25
- [x] 3.9 Vision-diff against the three overlay PNGs is clean — c13aa25

### Phase 4: Landing Header Info Pill

#### Automated

- [x] 4.1 Type checking passes — 4573152
- [x] 4.2 Linting passes — 4573152
- [x] 4.3 Production build succeeds — 4573152

#### Manual

- [x] 4.4 Pill opens the overlay from all three clusters, including after a view transition — 4573152
- [x] 4.5 Twelve-width sweep shows no wrap, no horizontal scroll, threshold correct — 4573152
- [x] 4.6 Vision-diff against the landing header PNG is clean — 4573152

### Phase 5: Footer Staff Pill

#### Automated

- [x] 5.1 Type checking passes — ddaad99
- [x] 5.2 Linting passes — ddaad99
- [x] 5.3 Existing e2e suite still passes — ddaad99

#### Manual

- [x] 5.4 Pill appears on all nine public pages and reaches sign-in — ddaad99
- [x] 5.5 Copyright bar wraps cleanly at 360px — ddaad99
- [x] 5.6 Vision-diff against the footer PNG is clean — ddaad99

### Phase 6: End-to-End Coverage and Fidelity Sweep

#### Automated

- [x] 6.1 New orientation spec passes — c5b6bcf
- [x] 6.2 Full e2e suite passes with no other spec changed — c5b6bcf
- [x] 6.3 Lint, types and build all pass — c5b6bcf

#### Manual

- [x] 6.4 Deliberately breaking the cookie write fails the reload assertion — c5b6bcf
- [x] 6.5 Final vision-diff across all three surfaces is empty apart from deviations — c5b6bcf
- [x] 6.6 Overlay reads correctly in Polish — c5b6bcf
