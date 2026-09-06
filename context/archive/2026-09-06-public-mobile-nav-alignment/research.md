---
date: 2026-09-06T10:28:39+02:00
researcher: Claude Code (for Marcin Kulbicki)
git_commit: 074cb5f9a564987bbf21b97667c4017792f87088
branch: worktree-fix-mobile-header-nav
repository: yakksiek/car-rental
topic: "Public-screen mobile navigation: the landing page opens a dropdown while every other public screen opens a full-screen overlay"
tags: [research, codebase, LandingNav, SiteHeader, MobileNav, PublicDock, mobile-nav, public-shell]
status: complete
last_updated: 2026-09-06
last_updated_by: Claude Code (for Marcin Kulbicki)
---

# Research: Public-screen mobile navigation inconsistency

**Date**: 2026-09-06T10:28:39+02:00
**Researcher**: Claude Code (for Marcin Kulbicki)
**Git Commit**: 074cb5f9a564987bbf21b97667c4017792f87088
**Branch**: worktree-fix-mobile-header-nav
**Repository**: yakksiek/car-rental

## Research Question

On mobile, the landing page's navigation menu opens as a small dropdown. Every other public screen opens a full-screen navigation overlay. The staff panel is out of scope. Where does each implementation live, why does the landing page diverge, what does the design system say the mobile nav should be, and what would aligning the landing page with the rest of the public screens take?

## Summary

**The inconsistency is real and was measured, not eyeballed.** At 390px the landing menu is a 224×301px dark panel hanging off the hamburger. On `/fleet` the menu is a white full-viewport overlay. The two differ in mechanism, size, colour, typography, close behaviour, scroll locking, and accessibility attributes. Section 1 has the numbers. Rendered evidence is in `design-review/app-landing-390-menu-open.png` and `design-review/app-fleet-390-menu-open.png`.

**Where it lives.** The landing page is the only consumer of the forked header [`LandingNav.astro`](https://github.com/yakksiek/car-rental/blob/074cb5f9a564987bbf21b97667c4017792f87088/src/components/LandingNav.astro). Its mobile menu is a native `<details>` element at lines 207–263. The other eight public pages render [`SiteHeader.astro`](https://github.com/yakksiek/car-rental/blob/074cb5f9a564987bbf21b97667c4017792f87088/src/components/SiteHeader.astro), which mounts the React island [`MobileNav.tsx`](https://github.com/yakksiek/car-rental/blob/074cb5f9a564987bbf21b97667c4017792f87088/src/components/MobileNav.tsx). The overlay is `fixed inset-0 z-[60]` at line 80.

**Why it diverges.** The fork was a deliberate, documented decision in the `landing-redesign` change (2026-07-30), not an oversight. An early plan draft said "reuse `MobileNav`". An adversarial review reversed that because `MobileNav` was shared by five pages and, at the time, rendered a light two-link overlay with no phone number. The open state of the dropdown was built with no mockup (`deviation(no-mock for open state)`). When the shared shell was redesigned three days later, `LandingNav` was declared out of scope, then reconciled for content only ("no structural change"). No document since has proposed unifying the two. Two of the three original objections no longer hold: the overlay now has five links, and the phone number moved into `ActionMenu` on both headers.

**What the design says.** Neither. The live Claude Design project has no hamburger, no dropdown, and no full-screen overlay on any public screen. Mobile navigation is a floating bottom pill called `PublicDock`, present on the landing, fleet, pricing, FAQ, about, 404 and 500 mobile screens. The header's right cluster is `LangToggle` + `ActionMenu` only. The repo already records both app menus as deviations: `deviation(overlay-undesigned)` and `deviation(no PublicDock in app; hamburger retains mobile nav)`.

**What aligning takes.** There are two possible targets:

- **Option A: align the landing to the app's overlay.** Mount `MobileNav` inside `LandingNav`'s mobile cluster, add a `tone="dark"` prop to its trigger following the pattern `ActionMenu` and `LangToggle` already use, and delete the `<details>` block. Small change, one component touched twice. This is the direct answer to the question asked. Recommended as the scope of this change.
- **Option B: align both headers to the design.** Build `PublicDock` for all nine public pages, remove the hamburger from both headers, delete `MobileNav`. Larger, touches every public page, and replaces both recorded deviations. This is the design-faithful answer and is better handled as its own slice.

Section 5 details both. Section 6 lists the decisions a plan needs.

## Detailed Findings

### 1. The two menus, measured

Measured with Playwright against the dev server at commit `074cb5f`, viewport 390×844 and 360×844, English locale. The script and raw output live in the session scratchpad; the two open-state renders are kept in this change's `design-review/` folder.

| Property            | Landing page (`LandingNav.astro`)                                     | Other public pages (`MobileNav.tsx`)                     |
| ------------------- | --------------------------------------------------------------------- | -------------------------------------------------------- |
| Mechanism           | Native `<details>` / `<summary>`, no JavaScript                       | React island with `useState`, `client:idle`              |
| Open panel at 390px | `absolute`, 224×301px, at x=150 y=64                                  | `fixed`, 390×844px, at 0,0 (full viewport)               |
| Open panel at 360px | 224×301px at x=120                                                    | 360×844px                                                |
| Surface             | `#0A0D14` at 95%, `backdrop-blur-md`, `rounded-2xl`                   | `bg-card` (#ffffff), no radius                           |
| Links               | 5 pages + phone number, 15px semibold rows                            | 5 pages with lucide icons, `text-3xl font-bold`, centred |
| Active item         | `bg-white/10 text-white`                                              | `text-primary` (crimson)                                 |
| Close control       | None. Tap the hamburger again                                         | X button, `aria-label="Close menu"`                      |
| Escape key          | Does not close                                                        | Closes                                                   |
| Outside click       | Does not close                                                        | Not applicable, covers the screen                        |
| Body scroll lock    | None                                                                  | `document.body.style.overflow = "hidden"` while open     |
| `aria-expanded`     | Absent on `<summary>`                                                 | `true` / `false` on the button                           |
| z-index             | `auto`, inherits the `z-40` wrapper                                   | `z-[60]`                                                 |
| Trigger style       | Glass, `bg-white/15 backdrop-blur-[6px] text-white`, `rounded-[12px]` | Light, `bg-background text-foreground`, `rounded-[12px]` |
| Trigger label       | `aria-label="Menu"`                                                   | `aria-label="Menu"`                                      |

Both triggers share the label because both read the same `nav.menu` key. The overlay's close button reads `nav.closeMenu`. Both keys exist in [`src/lib/i18n/nav.ts`](https://github.com/yakksiek/car-rental/blob/074cb5f9a564987bbf21b97667c4017792f87088/src/lib/i18n/nav.ts#L17-L55), so an Astro file calling `t("nav.menu")` and an island calling `translator(locale, navCopy)("menu")` resolve to the same catalog. No new copy is needed to unify them.

### 2. Where each implementation lives, and who uses it

**Page to header mapping.** `Layout.astro` renders no header of its own. Each page composes one inside the layout slot.

| Page                                                                                                                                                                     | Header                                         | `active`  |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------- | --------- |
| [`index.astro:58`](https://github.com/yakksiek/car-rental/blob/074cb5f9a564987bbf21b97667c4017792f87088/src/pages/index.astro#L58)                                       | `LandingNav`                                   | `home`    |
| [`fleet/index.astro:116`](https://github.com/yakksiek/car-rental/blob/074cb5f9a564987bbf21b97667c4017792f87088/src/pages/fleet/index.astro#L116)                         | `SiteHeader`                                   | `fleet`   |
| [`fleet/[id]/[...slug].astro:55`](https://github.com/yakksiek/car-rental/blob/074cb5f9a564987bbf21b97667c4017792f87088/src/pages/fleet/%5Bid%5D/%5B...slug%5D.astro#L55) | `SiteHeader`                                   | `fleet`   |
| [`pricing.astro:88`](https://github.com/yakksiek/car-rental/blob/074cb5f9a564987bbf21b97667c4017792f87088/src/pages/pricing.astro#L88)                                   | `SiteHeader`                                   | `pricing` |
| [`faq.astro:27`](https://github.com/yakksiek/car-rental/blob/074cb5f9a564987bbf21b97667c4017792f87088/src/pages/faq.astro#L27)                                           | `SiteHeader`                                   | `faq`     |
| [`about.astro:66`](https://github.com/yakksiek/car-rental/blob/074cb5f9a564987bbf21b97667c4017792f87088/src/pages/about.astro#L66)                                       | `SiteHeader`                                   | `about`   |
| [`terms.astro:45`](https://github.com/yakksiek/car-rental/blob/074cb5f9a564987bbf21b97667c4017792f87088/src/pages/terms.astro#L45)                                       | `SiteHeader`                                   | none      |
| [`reserve.astro:53`](https://github.com/yakksiek/car-rental/blob/074cb5f9a564987bbf21b97667c4017792f87088/src/pages/reserve.astro#L53)                                   | `SiteHeader`                                   | none      |
| [`r/[token].astro:60`](https://github.com/yakksiek/car-rental/blob/074cb5f9a564987bbf21b97667c4017792f87088/src/pages/r/%5Btoken%5D.astro#L60)                           | `SiteHeader`                                   | none      |
| `auth/*` pages                                                                                                                                                           | `AuthShell` or none. No hamburger, no page nav | —         |

So the split is exactly one page against eight. `SiteFooter.astro` also lists the five destinations, which is a fourth copy of the nav model but not a menu.

**`LandingNav.astro`.** Three breakpoint bands in one file. Desktop (`lg+`) is a floating white pill. Tablet (`md` to `lg`) is a glass bar over the hero. Mobile (`<md`) is the cluster at [lines 198–265](https://github.com/yakksiek/car-rental/blob/074cb5f9a564987bbf21b97667c4017792f87088/src/components/LandingNav.astro#L198-L265): brand, `LangToggle tone="dark"`, `ActionMenu tone="dark"`, then the `<details>` menu. The whole component sits in an `absolute inset-x-0 top-0 z-40` wrapper ([line 65](https://github.com/yakksiek/car-rental/blob/074cb5f9a564987bbf21b97667c4017792f87088/src/components/LandingNav.astro#L65)) over the hero section. The header comment at [lines 10–15](https://github.com/yakksiek/car-rental/blob/074cb5f9a564987bbf21b97667c4017792f87088/src/components/LandingNav.astro#L10-L15) states the intent: "a FORK, not the shared `<SiteHeader>`" and "the shared `<MobileNav.tsx>` is deliberately untouched, so `/fleet` + the other public pages keep their own overlay." The mobile-cluster comment at [lines 194–197](https://github.com/yakksiek/car-rental/blob/074cb5f9a564987bbf21b97667c4017792f87088/src/components/LandingNav.astro#L194-L197) claims the cluster "mirrors `<SiteHeader>`'s mobile cluster so the two public headers behave identically". That is true for the brand, language toggle and action menu. It is not true for the menu itself.

**`SiteHeader.astro`.** Desktop is driven by container queries ported from the design. The mobile bar at [lines 135–153](https://github.com/yakksiek/car-rental/blob/074cb5f9a564987bbf21b97667c4017792f87088/src/components/SiteHeader.astro#L135-L153) is brand, `LangToggle`, `ActionMenu`, `<MobileNav active={active} locale={locale} client:idle />`. The comment at [lines 128–134](https://github.com/yakksiek/car-rental/blob/074cb5f9a564987bbf21b97667c4017792f87088/src/components/SiteHeader.astro#L128-L134) records why the hamburger exists at all: the design has none, mobile nav in the design is a `PublicDock`, and the app has no dock.

**`MobileNav.tsx`.** The trigger is at [lines 67–77](https://github.com/yakksiek/car-rental/blob/074cb5f9a564987bbf21b97667c4017792f87088/src/components/MobileNav.tsx#L67-L77). Escape handling and body scroll lock are in one effect at [lines 47–62](https://github.com/yakksiek/car-rental/blob/074cb5f9a564987bbf21b97667c4017792f87088/src/components/MobileNav.tsx#L47-L62). The overlay at [lines 79–126](https://github.com/yakksiek/car-rental/blob/074cb5f9a564987bbf21b97667c4017792f87088/src/components/MobileNav.tsx#L79-L126) is rendered inline, not through a portal. Its header row copies `SiteHeader`'s mobile bar geometry (`px-[18px] py-[14px]`, 34px mark) so the brand does not jump when the overlay opens. The component remounts on every view-transition swap because `Layout.astro` uses `<ClientRouter />` ([line 44](https://github.com/yakksiek/car-rental/blob/074cb5f9a564987bbf21b97667c4017792f87088/src/layouts/Layout.astro#L44)), which resets the open state after navigation.

### 3. Why the landing page diverges

Everything in this section is documented in `context/archive/`. Inferences are marked.

**Timeline.**

| Date       | Commit    | Event                                                                                                                                         |
| ---------- | --------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-06-06 | `f12dab6` | `MobileNav.tsx` created with the `fixed inset-0` overlay. Two links at the time.                                                              |
| 2026-07-30 | `83bbcc6` | `LandingNav.astro` created with the `<details>` dropdown, 44 days after the overlay existed.                                                  |
| 2026-08-01 | `deff00c` | `public-info-pages` redesigns `SiteHeader`, `SiteFooter`, `MobileNav` to five links. `LandingNav` declared out of scope.                      |
| 2026-08-02 | `0960c5e` | `public-info-pages` phase 7 adds the three new links to the landing dropdown. Structure kept.                                                 |
| 2026-09-05 | `074cb5f` | `english-localization` adds `LangToggle` and `ActionMenu` to both headers. Phone row moves into `ActionMenu`. Current header comment written. |

**The fork was planned, not accidental.** The framing step for `landing-redesign` lists "Chrome is shared → editing cascades" as a strong risk and concludes: "must fork a landing-local `LandingNav`, not replace shared" (`context/archive/2026-07-28-landing-redesign/frame.md:33`, `:46`, `:73-74`).

**Reusing the overlay was proposed and then rejected.** The research document records that an adversarial pass found the draft plan said "reuse `MobileNav`", flagged it as a shared-component trap that "would regress `/fleet` in an uninterrupted run", and changed it to "forked to landing-local dropdown" (`context/archive/2026-07-28-landing-redesign/research.md:118-127`).

**The shipped rationale.** The design contract says, under a `deviation(no-mock for open state)` tag: "landing-local dropdown built inside `LandingNav` (dark trigger + Start + Flota + phone). Do NOT edit the shared `MobileNav.tsx` — only `SiteHeader` consumes it, so restyling it regresses the mobile menu on `/fleet` + the other 4 public pages, and reusing it unmodified fails this spec (it renders a light `bg-card` overlay + `rounded-full` trigger, Start/Flota only, no phone)" (`context/archive/2026-07-28-landing-redesign/design-contract.md:151-155`). The plan repeats it at `plan.md:150-153`. The deviations register lists it as item 12, `no shared edit` (`design-contract.md:344`).

Three objections were given. Their status today:

| Objection in July                                            | Status now                                                                                                                                                           |
| ------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Overlay had only Start and Flota                             | Gone. The overlay lists all five pages since `deff00c`.                                                                                                              |
| Overlay had no phone number                                  | Gone as a requirement. Both headers now carry the phone as the first row of `ActionMenu`. `MobileNav.tsx:19-22` explains the phone chip was removed for that reason. |
| Light `bg-card` overlay and a light trigger over a dark hero | Still true. This is the only remaining reason the landing cannot mount `MobileNav` as-is.                                                                            |

**The open state was never designed.** Register item 8 lists "nav-open" among "States with no mock" that were "derived from existing behavior + responsive judgment" (`design-contract.md:342`). The design agent's read of the July design source confirms the mockup had a hamburger glyph with no open state drawn.

**Later changes kept the structure on purpose.** `public-info-pages` marked `LandingNav` as "current — Landing keeps its own immersive nav; out of scope" (`context/archive/2026-08-01-public-info-pages/design-contract.md:25-26`) and listed "No `LandingNav` change" as a non-goal (`plan.md:44`). Review feedback reversed that for content only. Phase 7 says: "Both the desktop pill and the mobile dropdown map over the same array, so both inherit the new items — no structural change" (`plan.md:294-298`). Phase 7 also kept the phone chip CSS-only because "`LandingNav` has no island (its menu is a CSS `<details>`)" (`plan.md:304`). That premise is now false. `LandingNav` has carried two React islands, `LangToggle` and `ActionMenu`, since `074cb5f`. Inference: the "no island on the landing" argument was a description of the code at the time, not a stated goal, and it no longer applies.

**The gap is named in the design index.** `context/foundation/design-system.md:97-101` says the S-09 slice redesigned the shared shell and then: "`LandingNav` keeps its own immersive fork."

**Nobody has proposed closing it.** A search of every `plan.md`, `design-contract.md`, `research.md`, `impl-review.md` and `known-issues.md` under `context/` for unify, align, consolidate, follow-up or deferred near the nav terms found nothing. The only tracked `LandingNav` issue is the desktop phone-number breakpoint gap, fixed in `074cb5f` (`context/foundation/known-issues.md:379-413`).

### 4. What the design prescribes

Source: the live Claude Design project `Rental car company` (`352d78a6-84fd-49a2-8b38-2fe289691fc3`), pulled with `DesignSync` on 2026-09-06 (`info-pages.jsx`, `nav-spec.jsx`) and 2026-09-02 (`customer-desktop.jsx`, `shared.jsx`). Quotes are verbatim.

**The design removed the hamburger and says so.** `info-pages.jsx` carries this comment between `InfoHeader` and `InfoHeaderMobile`:

> `// (Full-screen hamburger MobileMenu removed — mobile nav is now the floating PublicDock pill on every public page, matching the app.)`

**The mobile header has no menu control.** `InfoHeaderMobile` in `info-pages.jsx` renders brand, then a right cluster of `<InfoButton /><LangToggle /><ActionMenu />`. `ScreenMobileHome` in `customer-desktop.jsx` (the landing, lines 777–811 of the 2026-09-02 pull) renders the same pair in dark tone: `<LangToggle tone="dark" />` and `<ActionMenu tone="dark" />`. There is no hamburger on either.

**Every public mobile screen ends with the dock.** In `info-pages.jsx`, `ScreenPricingMobile`, `ScreenFaqMobile`, `ScreenAboutMobile`, `Screen404Mobile` and `Screen500Mobile` each end with `<div style={{ height: 96 }} /><PublicDock active="…" />`. In `customer-desktop.jsx`, `ScreenMobileHome` (line 923) and `ScreenMobileFleet` (line 603) do the same. The landing and the info pages are treated identically on mobile. The only difference between them is header tone: glass controls over the hero photo on the landing, a white sticky bar elsewhere.

**What `PublicDock` is.** Defined in `shared.jsx` (lines 1344–1386 of the 2026-09-02 pull). A horizontally centred pill pinned to the bottom, background `#0A0A0F`, radius `9999`, `z-index 25`. Five tabs: Start, Flota, Cennik, FAQ, O nas, each with an icon. Two resting states. Expanded: height 48, padding 6, gap 4, bottom 22, active tab shows a 14px/700 label in a white pill. Compact: height 40, icons only, bottom 14, lighter shadow. Motion `300ms cubic-bezier(.4,0,.2,1)`. The comment calls it "the same floating dark dock as the app/staff TabBar, 5 logged-out destinations."

**Scroll behaviour.** `nav-spec.jsx` (`ScreenNavScrollSpec`) is a handoff board titled "Pasek nawigacji — zachowanie przy przewijaniu". Rules, translated: scroll down → compact, scroll up → expanded, ignore moves under 6px; always expanded when `scrollTop < 24px`; always `fixed`, centred, `z-index 25`; hidden on screens that have a bottom action bar (checkout, protocols); each tab is a link or button with `aria-label`; respect `prefers-reduced-motion`.

**The only dropdown in the design is `ActionMenu`.** It opens a two-row panel (call, browse fleet). It holds no page links. There is no full-screen overlay anywhere in the public design source.

**Conclusion for the design question.** The app's landing dropdown has no counterpart in the design. The app's full-screen overlay has no counterpart either. The repo already records both as deviations: `deviation(overlay-undesigned)` in `context/archive/2026-08-01-public-info-pages/design-contract.md:33`, and `deviation(no PublicDock in app; hamburger retains mobile nav)` in `context/archive/2026-09-01-english-localization/design-contract.md:528-534`. Aligning the landing to the design would mean neither a dropdown nor an overlay. It would mean the dock.

One unrelated aside from the pull: the design's header clusters now include an `InfoButton` before `LangToggle`. The app has no such control. That is a separate drift, noted here only so it is not mistaken for part of this change.

### 5. What aligning the landing page requires

#### Option A: mount the shared overlay in the landing header (recommended for this change)

This answers the question as asked. The landing page gets the same full-screen menu as the other eight pages.

1. **Give `MobileNav` a `tone` prop for its trigger.** `MobileNav.tsx:74` styles the button `text-foreground bg-background`. Over the dark hero it needs the glass recipe the landing already uses for its `<summary>` and that `ActionMenu` and `LangToggle` implement as `tone="dark"`: `bg-white/15 backdrop-blur-[6px] text-white hover:bg-white/25` ([`ActionMenu.tsx:93-106`](https://github.com/yakksiek/car-rental/blob/074cb5f9a564987bbf21b97667c4017792f87088/src/components/header/ActionMenu.tsx#L93-L106), [`LangToggle.tsx:92-104`](https://github.com/yakksiek/car-rental/blob/074cb5f9a564987bbf21b97667c4017792f87088/src/components/header/LangToggle.tsx#L92-L104)). Both define `tone?: "light" | "dark"`, default `"light"`, and `const dark = tone === "dark"`. Follow that exactly. Only the trigger changes with tone in those two components. The opened panel stays light.

2. **Decide the overlay surface.** The overlay is `bg-card` white with ink text. Keeping it white on the landing is the consistent choice and the smallest change. A dark variant would be a second design invention with no mockup. Recommendation: keep it identical. The overlay covers the hero entirely, so the light surface is not visually broken.

3. **Replace the `<details>` block.** Delete [`LandingNav.astro:207-263`](https://github.com/yakksiek/car-rental/blob/074cb5f9a564987bbf21b97667c4017792f87088/src/components/LandingNav.astro#L207-L263) and render `<MobileNav active={active} locale={locale} tone="dark" client:idle />` in its place. The phone row in the dropdown is already redundant: `ActionMenu`'s first row is the phone on both headers.

4. **Rewrite the comments that describe the old behaviour.** `LandingNav.astro:13-15` ("landing-local `<details>` dropdown … `<MobileNav.tsx>` is deliberately untouched") and `:194-197`. `context/foundation/design-system.md:100-101` ("`LandingNav` keeps its own immersive fork") should say the landing now shares the overlay.

5. **Stacking and positioning are safe.** Verified by reading the ancestors. The overlay is `fixed inset-0 z-[60]`, rendered inline. Inside `LandingNav` it sits in the `absolute … z-40` wrapper, which forms a stacking context, and inside a `pointer-events-none` wrapper whose mobile cluster is `pointer-events-auto`, so the overlay still receives events. The hero `<section>` at [`index.astro:57`](https://github.com/yakksiek/car-rental/blob/074cb5f9a564987bbf21b97667c4017792f87088/src/pages/index.astro#L57) is `relative w-full overflow-hidden` with no `transform`, `filter` or `backdrop-filter`, so `overflow-hidden` does not clip a fixed descendant and the overlay covers the full viewport. Nothing else on the landing page is above `z-40` except portaled popovers (`ui/popover.tsx` default `z-50`, `ActionMenu` `z-[60]`), which paint only while open.

6. **The brand lockup will shift on open.** The overlay's header row copies `SiteHeader`'s bar: 18px horizontal padding, 14px vertical, a 34px mark, ink colour on white. The landing's mobile bar is 16px inset, an 18px-tall mark, a 19px wordmark, white on the photo. On the landing, opening the overlay changes the brand's size and colour and moves it a few pixels. `MobileNav.tsx:89-92` explains why the row mirrors `SiteHeader`. A plan should either accept the jump on the landing or add a small prop for the row's mark size. Measure before deciding.

7. **Hydration is already paid for.** `LandingNav` already hydrates two islands. Adding a third `client:idle` island costs one more small chunk. The July "no island on the landing" argument is moot.

8. **Copy needs nothing.** `nav.menu` and `nav.closeMenu` exist in both locales.

9. **Tests do not exist for either menu.** No spec in `e2e/`, `tests/` or `src/**/*.test.ts` touches `MobileNav`, `LandingNav`, the hamburger, or `<details>`. `playwright.config.ts:52-68` defines only a desktop Chrome project and no mobile viewport. A plan following `/10x-e2e` would add one mobile-viewport risk: open the landing menu at 390px, assert the overlay is visible, close with Escape, and repeat on `/fleet`. Any such test must call `waitForIslands()` before clicking, per `e2e/support/hydration.ts:42-47`.

10. **Record the deviation.** The overlay is undesigned. The new `design-contract.md` should carry `deviation(overlay-undesigned; landing now shares SiteHeader's overlay)` so the vision-diff gate converges.

Net code change: roughly 60 lines removed from `LandingNav.astro`, about 10 lines added to `MobileNav.tsx`, a handful of comment edits, and one e2e spec.

#### Option B: build the design's `PublicDock` for every public page

This is what the design prescribes and it would replace both recorded deviations.

- New component, likely a React island because of the scroll-direction state: fixed bottom pill, five icon tabs, expanded and compact states per `nav-spec.jsx`, `z-index 25` in the design. In this app it must stay below the `z-[60]` overlay tier and above page content, so `z-30` to `z-40` would be the local mapping.
- Mount on all nine public pages, plus a 96px bottom spacer so content clears the pill. The spec hides it on screens with a bottom action bar. `reserve.astro` and the vehicle detail page's `BookingWidget` need checking for such bars. `FleetList.tsx:405` mentions "the mobile tab bar at `z-30`", the category pill, which sits at the top, not the bottom, so it does not conflict.
- Remove the hamburger from both `SiteHeader.astro` and `LandingNav.astro`, delete `MobileNav.tsx`, and retire the two deviation lines.
- Larger blast radius: every public page, a new scroll listener, `prefers-reduced-motion`, and a new e2e risk. Better as its own change after Option A, or instead of it if the team wants to reach the design in one step.

### 6. Decisions a plan needs

1. Target: Option A (share the overlay) or Option B (build the dock)? Recommendation: A for this change, B as a follow-up slice.
2. Overlay surface on the landing: keep white (recommended) or add a dark variant?
3. Brand lockup on open: accept the shift, or add a prop to match the landing's mark size?
4. Whether to add a mobile Playwright project or set the viewport per test.

## Code References

- `src/components/LandingNav.astro:10-15` — the fork's header comment and the "deliberately untouched" claim.
- `src/components/LandingNav.astro:65` — `absolute inset-x-0 top-0 z-40` wrapper, the stacking context an overlay would live in.
- `src/components/LandingNav.astro:198-265` — mobile cluster; `:207-263` is the `<details>` dropdown to remove.
- `src/components/SiteHeader.astro:128-134` — why the hamburger exists (no `PublicDock` in the app).
- `src/components/SiteHeader.astro:151` — where `MobileNav` is mounted.
- `src/components/MobileNav.tsx:47-62` — Escape and body scroll lock.
- `src/components/MobileNav.tsx:67-77` — trigger button, the only part that needs a `tone`.
- `src/components/MobileNav.tsx:79-126` — the `fixed inset-0 z-[60]` overlay, rendered inline.
- `src/components/header/ActionMenu.tsx:38-43,82-106` — the `tone` prop pattern to copy.
- `src/components/header/LangToggle.tsx:40-47,68-104` — same pattern.
- `src/components/ui/popover.tsx:21,27` — portaled, `z-50` default.
- `src/pages/index.astro:57-58` — the hero section that hosts `LandingNav`.
- `src/layouts/Layout.astro:3,44` — `<ClientRouter />`, which remounts islands on navigation.
- `src/lib/i18n/nav.ts:17-55` — `menu` and `closeMenu` keys, both locales.
- `e2e/support/hydration.ts:42-47` — `waitForIslands()`.
- `playwright.config.ts:52-68` — desktop-only projects.
- `context/foundation/design-system.md:97-101` — "`LandingNav` keeps its own immersive fork."

## Architecture Insights

- **Two presentations of one nav model.** Both headers build the same five-item array from the same catalog and pass an `active` id. Only the mobile menu differs. That makes Option A a small change rather than a merge of two components.
- **`tone` is the established way to put a header control over the dark hero.** `Brand`, `LangToggle` and `ActionMenu` all take a tone prop and swap only the trigger surface. `MobileNav` is the one header control without it, which is the direct cause of the fork's survival.
- **Overlays in this app render inline at `z-[60]`, popovers portal at `z-50` or `z-[60]`.** A fixed overlay inside `LandingNav`'s `z-40` wrapper is fine as long as nothing outside that wrapper is also above `z-40`. Today nothing is.
- **View transitions reset island state.** Any menu that closes on navigation gets that for free here because `ClientRouter` remounts the island.
- **The design's answer is a bottom dock, and the app has chosen a hamburger twice.** Both choices are recorded deviations. A third pattern, a dark dropdown, exists only because the July contract forbade touching the shared overlay.

## Historical Context (from prior changes)

- `context/archive/2026-07-28-landing-redesign/frame.md:33,46,73-74` — the decision to fork `LandingNav` rather than edit shared chrome.
- `context/archive/2026-07-28-landing-redesign/research.md:118-127` — adversarial review reversing "reuse `MobileNav`".
- `context/archive/2026-07-28-landing-redesign/design-contract.md:151-155,342,344` — the dropdown's rationale, the `no-mock` open state, and register item 12.
- `context/archive/2026-07-28-landing-redesign/plan.md:150-153` — the same rule in the approved plan.
- `context/archive/2026-08-01-public-info-pages/design-contract.md:25-26,33` — `LandingNav` out of scope; `deviation(overlay-undesigned)`.
- `context/archive/2026-08-01-public-info-pages/plan.md:44,288,294-298,304` — non-goal, its reversal, and "no structural change".
- `context/archive/2026-09-01-english-localization/design-contract.md:393-395,438-450,528-534` — `InfoHeaderMobile` transcription, the dock scroll rules, and the `no PublicDock` deviation.
- `context/foundation/known-issues.md:379-413` — the only tracked `LandingNav` issue (desktop phone breakpoint), unrelated to the menu.

## Related Research

- `context/archive/2026-07-28-landing-redesign/research.md` — the landing fork's origin.
- `context/archive/2026-08-01-public-info-pages/research.md` — the shared-shell redesign that produced the five-link overlay.
- `context/archive/2026-09-01-english-localization/research.md` — the change that added `LangToggle` and `ActionMenu` to both headers.

## Open Questions

- Does the product owner want the landing to match the app's overlay (Option A) or both headers to match the design's dock (Option B)? The research supports A as the direct fix and B as the design-faithful end state.
- Is a white overlay acceptable over the landing's dark hero, or is a dark overlay variant wanted? There is no mockup for either.
- `InfoButton` appears in the design's header clusters and not in the app. Out of scope here, but worth its own freshness check.
- The design pull of `customer-desktop.jsx` and `shared.jsx` used in this research is from 2026-09-02. Line numbers quoted from those two files hold only if nobody edited them since. `info-pages.jsx` and `nav-spec.jsx` were pulled today.
