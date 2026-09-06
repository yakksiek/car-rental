# Public Mobile Nav Alignment — Implementation Plan

## Overview

On phones, the landing page opens its navigation as a small dark dropdown. Every other public page opens a full-screen overlay. This plan makes the landing page use the same overlay. The overlay learns a dark tone so it sits on the landing's dark hero. The other eight public pages keep the light overlay they have today.

Option A from `research.md` §5. Option B (the design's bottom `PublicDock`) is out of scope and may become its own change later.

## Current State Analysis

- `src/components/LandingNav.astro` is the landing page's forked header. Its mobile cluster (lines 198–265) holds the brand, `LangToggle tone="dark"`, `ActionMenu tone="dark"`, and a native `<details>` dropdown (lines 207–263). The dropdown is a 224px-wide dark panel with the five page links and the phone number. It has no Escape handling, no outside-click close, no scroll lock, no close button, and no `aria-expanded`.
- `src/components/SiteHeader.astro` is the shared header on the other eight public pages. Its mobile bar (lines 135–153) mounts `src/components/MobileNav.tsx`, a `client:idle` React island. The island's trigger is light (`bg-background text-foreground`). Its overlay is `fixed inset-0 z-[60] bg-card`, lists the five pages with lucide icons at `text-3xl font-bold`, closes on Escape and on a close button, and locks body scroll while open.
- `ActionMenu.tsx` and `LangToggle.tsx` already carry a `tone?: "light" | "dark"` prop. Both default to `"light"`, derive `const dark = tone === "dark"`, and swap only their trigger's surface: `bg-white/15 backdrop-blur-[6px] text-white hover:bg-white/25` in dark. `Brand.tsx` takes `tone="inverse"` for a white mark and wordmark.
- The fork was a deliberate July decision. Two of its three reasons no longer hold: the overlay has five links, and the phone number lives in `ActionMenu` on both headers. The remaining reason is the light surface over the dark hero, which the `tone` prop resolves.
- No test covers either menu. `playwright.config.ts` has no mobile project. `e2e/e2e-rules.md` requires role locators, `waitForIslands()`, an anonymous `storageState` for public flows, and a named risk in the spec's header comment.
- The design had no opened-menu mockup in either tone. One was authored during planning as `nav-overlay.jsx` in the Claude Design project and rendered to four boards in `design-review/`. The Design Alignment Audit in `design-contract.md` records the method and the verdict (PASS).

## Desired End State

- On the landing page at any width below `md`, tapping the hamburger opens the same full-screen overlay as on `/fleet`, rendered in a dark tone: `#0A0D14` surface, white links, crimson active item, glass trigger and close button.
- On `/fleet`, `/pricing`, `/faq`, `/about`, the vehicle detail page, `/terms`, `/reserve` and `/r/[token]`, nothing changes. A render of the `/fleet` menu after this change is pixel-identical to `design-review/app-fleet-390-menu-open.png`.
- The `<details>` dropdown no longer exists. `LandingNav.astro` mounts `MobileNav` with `tone="dark"`.
- The overlay is announced as a modal dialog named "Menu" / "Menu", so both assistive tech and the e2e can address it by role.
- Comments in `LandingNav.astro` and the note in `context/foundation/design-system.md` describe the new state. The opened overlay is recorded as a deviation with a drafted mockup in `design-contract.md`.
- One Playwright spec proves a phone visitor can open the menu on the landing page and on `/fleet`, reach another public page from it, and close it with Escape.

### Key Discoveries:

- `src/components/header/ActionMenu.tsx:38-43,82-106` and `src/components/header/LangToggle.tsx:40-47,68-104` — the `tone` pattern to copy: optional prop, default light, one boolean, trigger classes swap, panel untouched.
- `src/components/MobileNav.tsx:67-77` — the trigger is the only light-only part of the closed state. `:79-126` — the overlay, rendered inline, `fixed inset-0 z-[60]`. `:89-92` — the overlay header row mirrors the bar it opens from, on purpose, so the brand does not jump.
- `src/components/LandingNav.astro:65` — the header wrapper is `absolute inset-x-0 top-0 z-40` and forms a stacking context. `src/pages/index.astro:57` — the hero section is `relative overflow-hidden` with no transform or filter, so a fixed descendant is not clipped. Verified in `research.md` §5 item 5.
- `src/components/LandingNav.astro:198-205` — the landing bar is 16px inset (`inset-x-4 top-4`) with `Brand tone="inverse" markClass="h-[18px]" wordmarkClass="text-[19px]"`. The light overlay's row uses `px-[18px] py-[14px]` and a 34px mark. A dark row must use the landing's values or the lockup jumps on open.
- `src/lib/i18n/nav.ts:17-55` — `menu` and `closeMenu` exist in both locales. No copy is added.
- `src/components/ui/popover.tsx:21,27` — popovers portal at `z-50`; `ActionMenu` overrides to `z-[60]`. Nothing else on the landing sits above `z-40`.
- `e2e/seed.spec.ts` and `e2e/e2e-rules.md` — the exemplar and the rules. `e2e/support/hydration.ts:42-47` — `waitForIslands()`.
- Dev-server traps recorded in memory: a never-before-used Tailwind utility needs a dev restart; a new import in an island can leave a stale chunk (free `.vite` cache); the production build is the truth.

## What We're NOT Doing

- Not building the design's `PublicDock` bottom pill. Not removing the hamburger from `SiteHeader`.
- Not changing the light overlay's look on the other eight pages. Not adding the light overlay's missing focus ring beyond what the dark tone needs for parity (see Phase 1, contract).
- Not changing the landing's desktop pill or tablet band.
- Not adding a dark variant of `ActionMenu`'s opened panel. It stays light on both headers.
- Not adding a phone number row to the overlay. `ActionMenu`'s first row is the phone on both headers.
- Not adding a mobile Playwright project. The spec sets its viewport per file.
- Not porting the design's `InfoButton` (a separate drift noted in `research.md`).

## Implementation Approach

Extend, then swap, then prove.

1. Teach `MobileNav.tsx` a `tone` prop so it can sit on a dark surface. The default stays light, so the eight `SiteHeader` pages are untouched by construction. While in the file, give the overlay modal-dialog semantics.
2. Replace `LandingNav.astro`'s `<details>` block with the island in dark tone. Update the comments and the design index that describe the old fork.
3. Add one e2e spec at phone width, driven through `/10x-e2e`.

The mockup for the dark overlay is drafted in the Claude Design project during planning (Design Alignment Audit). Implementation ports its exact values from `design-contract.md`, never from the screenshot.

## Critical Implementation Details

**Brand lockup on open.** The dark overlay's header row must reproduce the landing bar exactly: 16px inset, `Brand tone="inverse"` with the landing's mark and wordmark sizes, and a 40px glass close button. Otherwise the brand changes size and colour the moment the menu opens. The light row keeps `SiteHeader`'s values. Both rows are 72px tall with the brand centred at 36px, which is what keeps the lockup still.

**Stacking.** The overlay stays rendered inline, not portaled. Inside `LandingNav` it lives in the `z-40` wrapper. That is fine today because nothing outside that wrapper is above `z-40`. Do not "fix" this by portaling; `ActionMenu`'s comment at `ActionMenu.tsx:126-134` records the same reasoning.

**Dev server.** `bg-[#0A0D14]` is already used by `index.astro`, so Tailwind has it. Any other new utility, and the new `MobileNav` import in `LandingNav.astro`, can leave the dev server stale. If the landing renders blank or shows old copy, free port 4321 and clear `node_modules/.vite`. Verify on `npm run build` before blaming the CSS.

## Phase 1: `MobileNav` learns a dark tone

### Overview

Add `tone?: "light" | "dark"` to `MobileNav.tsx` and give the overlay dialog semantics. No page changes appearance. `/fleet` renders exactly as before.

### Changes Required:

#### 1. Tone prop and dark styling

**File**: `src/components/MobileNav.tsx`

**Intent**: Let the same island sit on the landing's dark hero. Follow the `ActionMenu`/`LangToggle` pattern: optional prop, default `"light"`, one `dark` boolean, class swaps through `cn()`.

**Contract**: `interface Props { active?: NavId; locale: Locale; tone?: "light" | "dark" }`, default `"light"`. Exact values per tone, all `exact` against `design-contract.md`:

| Element                  | Light (unchanged)                                                                                         | Dark                                                                                                                                                                                                   |
| ------------------------ | --------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Trigger                  | `text-foreground bg-background inline-flex size-10 shrink-0 items-center justify-center rounded-[12px]`   | `text-white bg-white/15 backdrop-blur-[6px] hover:bg-white/25 focus-visible:ring-2 focus-visible:ring-white/40 focus-visible:ring-offset-transparent focus-visible:outline-none`, same size and radius |
| Overlay surface          | `bg-card`                                                                                                 | `bg-[#0A0D14]`                                                                                                                                                                                         |
| Header row               | `px-[18px] py-[14px]`                                                                                     | `px-4 py-4`                                                                                                                                                                                            |
| Brand                    | `Brand className="gap-1.5" markClass="w-[34px]" wordmarkClass="text-[18px] tracking-[-0.4px]"` (tone ink) | `Brand tone="inverse"` with the landing's `markClass="h-[18px]" wordmarkClass="text-[19px]"`; keep the gap `LandingNav.astro:200` renders                                                              |
| Close button             | same as light trigger                                                                                     | same as dark trigger                                                                                                                                                                                   |
| Inactive link            | `text-foreground hover:text-primary`                                                                      | `text-white hover:text-primary`                                                                                                                                                                        |
| Active link              | `text-primary`                                                                                            | `text-primary`                                                                                                                                                                                         |
| Link type, icon, spacing | `flex items-center gap-3 text-3xl font-bold tracking-tight`, icon `size-7`, nav `gap-8`                   | identical                                                                                                                                                                                              |

The light column must not change. Read the landing's actual `Brand` props from `LandingNav.astro:200` at implementation time rather than from this table if they differ.

#### 2. Dialog semantics

**File**: `src/components/MobileNav.tsx`

**Intent**: The overlay is a full-screen modal with scroll lock and Escape. Announce it as one so screen readers and the e2e can address it by role. Applies to both tones.

**Contract**: the overlay root gets `role="dialog"`, `aria-modal="true"`, and `aria-label={t("menu")}`. The trigger keeps `aria-expanded`. No focus trap is added in this change (the shared popover primitive is not used here; note the gap in `design-contract.md` as `deviation(no focus trap; Escape + close button only)`).

### Success Criteria:

#### Automated Verification:

- Lint passes: `npm run lint`
- Types and Astro check pass: `npx astro check`
- Production build passes: `npm run build`
- Unit suite passes: `npm test`

#### Manual Verification:

- `/fleet` at 390px: the hamburger, the opened overlay, and the close button look identical to `design-review/app-fleet-390-menu-open.png`. Measure with the scratch script from `research.md` §1 rather than by eye: overlay box 390×844, `fixed`, `z-index 60`, white surface, body overflow hidden while open, Escape closes.
- The opened overlay is exposed as `role="dialog"` named "Menu" (check the accessibility tree in DevTools or with Playwright's `getByRole("dialog", { name: "Menu" })`).

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase. Phase blocks use plain bullets — the corresponding `- [ ]` checkboxes for these items live in the `## Progress` section at the bottom of the plan.

---

## Phase 2: Landing page swaps the dropdown for the overlay

### Overview

`LandingNav.astro` mounts `MobileNav` in dark tone and drops its `<details>` block. Comments and the design index are updated. The rendered landing menu is diffed against the drafted mockup.

### Changes Required:

#### 1. Replace the dropdown

**File**: `src/components/LandingNav.astro`

**Intent**: Use the shared overlay on the landing page. Delete the landing-local `<details>` menu, its phone row, and the SVG it carried.

**Contract**: import `MobileNav from "./MobileNav.tsx"` under `// components`. In the mobile cluster (lines 203–264), replace the whole `<details>…</details>` element with `<MobileNav active={active} locale={locale} tone="dark" client:idle />` as the third item after `LangToggle` and `ActionMenu`. `PHONE_LABEL` and `PHONE_HREF` stay; the desktop pill still uses them. The `cn` import stays; the desktop and tablet bands still use it.

#### 2. Rewrite the comments that describe the old fork

**File**: `src/components/LandingNav.astro`

**Intent**: Lines 10–15 and 194–197 explain a `<details>` dropdown and a "deliberately untouched" `MobileNav`. Both are now false.

**Contract**: the header comment says the landing keeps its own desktop pill and tablet band but shares `MobileNav` (dark tone) with `SiteHeader` for the phone menu, and points at `context/changes/public-mobile-nav-alignment/`. The mobile-cluster comment says the cluster is `SiteHeader`'s mobile cluster in dark tone, including the menu.

#### 3. Update the design index

**File**: `context/foundation/design-system.md`

**Intent**: Lines 97–101 say "`LandingNav` keeps its own immersive fork." Since this change the fork is desktop and tablet only.

**Contract**: rewrite the sentence to say the landing shares the mobile overlay (`MobileNav`, dark tone) and keeps its own desktop and tablet chrome, with a pointer to this change's `design-contract.md`. Add a catalog note that the opened overlay boards (light and dark) live in the Claude Design project as `nav-overlay.jsx` and in this change's `design-review/`.

#### 4. Record the deviation

**File**: `context/changes/public-mobile-nav-alignment/design-contract.md`

**Intent**: The contract written at planning time carries the audit and the exact values. Implementation marks each line `exact` or `deviation(reason)` as it lands and records the measured render.

**Contract**: every row in the Phase 1 table above appears in the contract with its verdict. The `deviation(no focus trap)` line and the `deviation(overlay-drafted, not designed)` line are present.

### Success Criteria:

#### Automated Verification:

- Lint passes: `npm run lint`
- Types and Astro check pass: `npx astro check`
- Production build passes: `npm run build`
- No `<details` remains in `src/components/LandingNav.astro`: `grep -c '<details' src/components/LandingNav.astro` prints `0`

#### Manual Verification:

- Landing page at 390px and 360px, Polish and English: the hamburger opens the full-screen dark overlay. Compare against `design-review/mock-landing-390-menu-open-pl.png` and `-en.png` with a vision subagent and iterate the punch-list to empty, minus recorded deviations.
- Measured with the scratch script: landing open box equals the viewport, `fixed`, `z-index 60`, surface `#0A0D14` at 100%, body overflow hidden, Escape closes, close button labelled "Close menu" / "Zamknij menu".
- The brand lockup does not move or change size when the menu opens (compare the closed and open screenshots at 390px).
- `/fleet` at 390px is still identical to `design-review/app-fleet-390-menu-open.png`.
- Opening the menu, tapping "Home", and tapping "Fleet" each navigate and leave no overlay behind.

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 3: One phone-width e2e for the public menu

### Overview

Prove in a browser that a phone visitor can open the menu on the landing page and on `/fleet`, reach another public page from it, and close it with Escape. Driven through `/10x-e2e` against the running app.

### Changes Required:

#### 1. The spec

**File**: `e2e/public-mobile-nav.spec.ts`

**Intent**: Protect the risk this change exists for. Risk (named here, not in `test-plan.md`'s register): "a phone visitor on a public page cannot reach the other public pages because the menu fails to open, hydrate, or navigate, or the landing page silently ships a different menu than the rest of the site."

**Contract**: follows `e2e/seed.spec.ts` and `e2e/e2e-rules.md`. `test.use({ storageState: { cookies: [], origins: [] }, viewport: { width: 390, height: 844 } })` at file scope. Two tests, one for `/` and one for `/fleet`, each self-contained: `page.goto`, `waitForIslands(page)`, `getByRole("button", { name: "Menu" }).click()`, `const menu = page.getByRole("dialog", { name: "Menu" })`, `expect(menu).toBeVisible()`, then `menu.getByRole("link", { name: "Pricing" }).click()` and `page.waitForURL("/pricing")`. A third assertion in one of the tests: reopen, press Escape, `expect(menu).toBeHidden()`. Locators are role-based only; the dialog scope is what keeps "Pricing" from matching the footer link. Anonymous default locale is `en`, so the labels are "Menu" and "Pricing". No `waitForTimeout`. No fixture rows are needed, so no cleanup.

### Success Criteria:

#### Automated Verification:

- The spec passes against the dev server on port 4321: `npx playwright test e2e/public-mobile-nav.spec.ts`
- Lint passes on the new spec: `npm run lint`
- Break-it check: with the `MobileNav` mount removed from `LandingNav.astro`, the landing test goes red; restore it and the suite is green again. Never commit the break.

#### Manual Verification:

- The spec's header comment names the risk and explains why it needs a browser (hydration plus the two headers sharing one island).

---

## Testing Strategy

### Unit Tests:

- None. There is no DOM or component test layer in this repo (`CLAUDE.md`). `npm test` runs to prove nothing else broke.

### Integration Tests:

- None. No API, database, or auth boundary is touched.

### Manual Testing Steps:

1. Start the dev server on port 4321 from this worktree (stop any other worktree's server first).
2. Run the scratch measurement script from `research.md` §1 (`nav-compare.mjs`) against `/` and `/fleet` at 390 and 360. Both pages must report a full-viewport `fixed` `z-index 60` overlay, `closesOnEscape: true`, body overflow hidden while open.
3. Render the landing menu open at 390 in `pl` and `en` and hand the PNGs plus the mockups to a vision subagent for the punch-list.
4. Open the menu on the landing, tap each of the five links, confirm navigation and no leftover overlay.
5. Switch language with the toggle, reopen the menu, confirm the labels and the close button's `aria-label` follow the locale.

## Performance Considerations

One more `client:idle` island on the landing page, sharing the chunk `/fleet` already loads. The landing already hydrates `LangToggle` and `ActionMenu`, so the cost is one small extra hydration after idle.

## Migration Notes

None. No data, config, or route changes. Rollback is reverting two files.

## References

- Related research: `context/changes/public-mobile-nav-alignment/research.md`
- Design contract and audit: `context/changes/public-mobile-nav-alignment/design-contract.md`
- Tone pattern: `src/components/header/ActionMenu.tsx:82-106`, `src/components/header/LangToggle.tsx:68-104`
- Overlay: `src/components/MobileNav.tsx:64-128`
- Landing mobile cluster: `src/components/LandingNav.astro:194-265`
- E2E exemplar and rules: `e2e/seed.spec.ts`, `e2e/e2e-rules.md`, `e2e/support/hydration.ts`
- Prior decisions: `context/archive/2026-07-28-landing-redesign/design-contract.md:151-155`, `context/archive/2026-08-01-public-info-pages/design-contract.md:33`, `context/archive/2026-09-01-english-localization/design-contract.md:528-534`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: `MobileNav` learns a dark tone

#### Automated

- [x] 1.1 Lint passes: `npm run lint` — 959fef2
- [x] 1.2 Types and Astro check pass: `npx astro check` — 959fef2
- [x] 1.3 Production build passes: `npm run build` — 959fef2
- [x] 1.4 Unit suite passes: `npm test` — 959fef2

#### Manual

- [x] 1.5 `/fleet` at 390px renders identically to `design-review/app-fleet-390-menu-open.png`, measured with the scratch script — 959fef2
- [x] 1.6 The opened overlay is exposed as `role="dialog"` named "Menu" — 959fef2

### Phase 2: Landing page swaps the dropdown for the overlay

#### Automated

- [x] 2.1 Lint passes: `npm run lint` — 2a11ed7
- [x] 2.2 Types and Astro check pass: `npx astro check` — 2a11ed7
- [x] 2.3 Production build passes: `npm run build` — 2a11ed7
- [x] 2.4 No `<details` remains in `src/components/LandingNav.astro` — 2a11ed7

#### Manual

- [x] 2.5 Landing menu at 390px and 360px in `pl` and `en` matches the drafted mockups after a vision-diff punch-list reaches empty — 2a11ed7
- [x] 2.6 Measured: landing overlay is full-viewport, `fixed`, `z-index 60`, `#0A0D14`, body scroll locked, Escape closes, close button labelled per locale — 2a11ed7
- [x] 2.7 Brand lockup does not move or resize when the menu opens — 2a11ed7
- [x] 2.8 `/fleet` at 390px still identical to `design-review/app-fleet-390-menu-open.png` — 2a11ed7
- [x] 2.9 Each of the five overlay links navigates and leaves no overlay behind — 2a11ed7

### Phase 3: One phone-width e2e for the public menu

#### Automated

- [x] 3.1 `npx playwright test e2e/public-mobile-nav.spec.ts` passes on port 4321 — 52c10bf
- [x] 3.2 Lint passes on the new spec: `npm run lint` — 52c10bf
- [x] 3.3 Break-it check: removing the `MobileNav` mount from `LandingNav.astro` turns the landing test red; restored, green — 52c10bf

#### Manual

- [x] 3.4 The spec's header comment names the risk and why it needs a browser — 52c10bf
