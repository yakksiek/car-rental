# Staff-Panel Discovery — Plan Brief

> Full plan: `context/changes/staff-panel-discovery/plan.md`
> Frame brief: `context/changes/staff-panel-discovery/frame.md`

## What & Why

The public site presents itself as a real rental company and hides its only door to the cockpit
behind a below-the-fold link labelled for employees, so a visitor is never told, before that door,
that this is a two-product portfolio with demo credentials one click away.

Three pieces answer that: a first-visit orientation overlay on the landing page, an info pill in the
landing header that reopens it, and the footer's staff entry restyled into a copyright-bar pill.

## Starting Point

The staff route is one of five identical rows in the footer's Information column, on every public
page, always below several hundred lines of body. Every string on that path — "Employee zone",
"Employee zone — sign in", "Ask your administrator" — tells the reader they need credentials they do
not have. The only copy that says "portfolio" sits on the sign-in page, behind the door it
advertises. Mockups for all three pieces exist in the Claude Design project, but the overlay's copy
describes a static prototype and contradicts the deployed app.

## Desired End State

A first-time visitor to the landing page meets a dark modal over the hero saying Flota is two
products, naming the staff area, and pointing at the demo credentials published on the sign-in page.
One button dismisses, another goes to sign-in; both remember the visit. It does not return, and an
info pill beside the language switcher brings it back. Every public page's footer now carries a
bordered staff pill with a lock icon rather than a grey link among four siblings.

## Key Decisions Made

| Decision             | Choice                                                      | Why (1 sentence)                                                                              | Source |
| -------------------- | ----------------------------------------------------------- | --------------------------------------------------------------------------------------------- | ------ |
| Problem framing      | Orientation before the door, not a bigger door              | Every string on the path says "not for you", so salience alone would not fix it.              | Frame  |
| Trigger              | Once per browser, then reopen from the header               | The design already carries the reopen affordance, so auto-showing twice is unnecessary.       | Frame  |
| Where state lives    | Server-written cookie, read server-side                     | The house rule: zero client cookie writes exist in `src/`, and locale is the model.           | Frame  |
| Overlay scope        | Landing page only                                           | Owner scoped it there; other public pages get the footer pill only.                           | Plan   |
| Info pill scope      | Landing header only, and it opens the overlay               | Owner scoped it there; the pill's job is reopening, not navigating.                           | Plan   |
| Dismissal            | Form POST intercepted by the island, no reload              | Follows the cookie rule while keeping the close instant, and degrades without JS.             | Plan   |
| Signed-in staff      | Never auto-shown                                            | Someone already in the cockpit needs no orientation, and it leaves the one landing e2e alone. | Plan   |
| Landing width budget | Add the pill, raise the collapse threshold                  | Design-exact placement; the hero carries its own primary CTA below the threshold.             | Plan   |
| Overlay copy         | Two products plus credentials published on the sign-in page | Undoes the "not for you" reading, which is the actual barrier.                                | Plan   |
| Design source        | Aligned in Phase 1, before any code                         | The mock currently contradicts the app and is English-only.                                   | Plan   |
| Footer pill element  | An `<a>` styled as the design's pill                        | It navigates, so an anchor is correct, and the existing Polish walk stays untouched.          | Plan   |
| Dialog primitive     | Radix dialog from the installed `radix-ui` package          | No new dependency, and the app has no focus trap anywhere today.                              | Plan   |

## Scope

**In scope:** orientation overlay on the landing page · info pill in the three landing-nav clusters ·
footer staff pill on all nine public pages · a seen-state cookie, resolver and public POST route ·
Polish and English copy · Claude Design alignment and canonical PNG exports · one new e2e spec.

**Out of scope:** the eight non-landing public headers · `SiteHeader.astro` · 404 and 500 pages · a
meta description · a README link to sign-in · the dead `Topbar.astro` · changing the staff label ·
rendering demo credentials in the overlay.

## Architecture / Approach

Server decides, island renders. The landing page resolves the cookie and the session through a pure
helper and hands the answer to the island as a prop, mirroring locale resolution — which is why
there is no hydration mismatch and no client cookie write. The modal's action buttons live in one
real form posting to a new public route, each carrying its own redirect target; the island
intercepts the two dismiss buttons and lets the staff button submit natively, so the cookie is set
on the way to sign-in. The header pill carries no JavaScript at all — the island picks up its click
by delegation.

## Phases at a Glance

| Phase                       | What it delivers                                      | Key risk                                                                       |
| --------------------------- | ----------------------------------------------------- | ------------------------------------------------------------------------------ |
| 1. Design alignment         | Re-authored bilingual mock, canonical PNGs, contract  | The overlay is absent from the design's export harness and must be added first |
| 2. Seen-state plumbing      | Cookie, pure resolver, public POST route, tests       | A public mutation route that must fail closed cross-origin                     |
| 3. Orientation overlay      | Copy catalog, modal island, landing mount             | A new island on the landing's critical path can breach the size budget         |
| 4. Landing header info pill | Pill in three clusters, re-derived collapse threshold | A measured width budget that this change spends; 360px is the tight fit        |
| 5. Footer staff pill        | Relocated and restyled entry on nine pages            | One e2e asserts the current link role and name                                 |
| 6. E2E and fidelity sweep   | Anonymous landing spec, final vision-diff             | Proving the spec would actually catch a regression                             |

**Prerequisites:** write access to the Claude Design project (confirmed), a local Supabase stack for
the integration and e2e layers, and the app's self-hosted Inter fonts for faithful PNG capture.

**Estimated effort:** roughly 4–6 sessions across six phases, with Phase 1 gating the rest.

## Open Risks & Assumptions

- The desktop threshold arithmetic predicts about 1424px viewport, but the number must be measured
  in the browser before it is written; the plan requires that rather than trusting the estimate.
- The mobile landing bar gains a fourth control at a 360px floor. If it does not fit, the hamburger
  size or the cluster gap gets traded, and whichever gives is recorded as a deviation.
- Scoping the overlay to the landing knowingly diverges from the frame's finding that visitors
  arrive on any public page. A visitor landing on `/fleet` from a search result is oriented only by
  the footer pill.
- The overlay advertises that credentials are published one click away. That is already true today,
  but this makes it prominent on the site's front page.

## Success Criteria (Summary)

- A first-time visitor to the landing page is told, before reaching sign-in, that a staff app exists
  and that demo credentials are published there.
- The overlay appears once per browser and returns only when the visitor asks for it.
- The staff route is visually distinct from every other footer link on all nine public pages.
