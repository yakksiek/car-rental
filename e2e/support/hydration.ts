// core
import { expect, type Locator, type Page } from "@playwright/test";

// Astro server-renders every `client:*` island and hydrates it afterwards. In
// the window between paint and hydration the markup is fully present and fully
// inert: buttons have no handlers, and a controlled React input has no `onChange`
// to record what you type. Anything a test does in that window is silently lost.
//
// The two helpers here wait for the island to become interactive. Neither waits
// on a duration — waiting on time is the anti-pattern this file exists to avoid.

/**
 * Block until every island on the page has hydrated.
 *
 * Astro stamps each island as `<astro-island ssr …>` and removes the `ssr`
 * attribute only *after* the hydrator resolves — see `removeAttribute("ssr")` in
 * `astro/dist/runtime/server/astro-island.js`, immediately before it dispatches
 * `astro:hydrate`. The absence of `astro-island[ssr]` is therefore an exact,
 * app-emitted "mounted" signal, not a "started mounting" one. Nested islands are
 * covered too: a child whose parent is still `[ssr]` defers until the parent's
 * `astro:hydrate` fires, so it can't clear early.
 *
 * This is the same mechanism Astro's own E2E suite uses (`waitForHydrate` in
 * `packages/astro/e2e/test-utils.ts`, added in withastro/astro#7084 to fix
 * exactly this class of flake). Playwright's auto-waiting does not cover it:
 * actionability means visible/stable/enabled, never "a handler is attached".
 *
 * This is the one place in the suite allowed to reach for a DOM query — it is a
 * *wait condition*, not an element locator. Locators stay role-based.
 *
 * Caveat: a `client:visible` island below the fold never hydrates until scrolled
 * into view, so this would wait out the timeout. The app has none today
 * (`client:load`, `client:only`, `client:idle` only — all of which do hydrate on
 * their own). Scroll it into view first, or wait on that island specifically.
 *
 * @param expectIslands Guard against a silent pass. If Astro ever renames the
 *   element or attribute, the `[ssr]` query would match nothing and this helper
 *   would return instantly, quietly reintroducing the flake it exists to prevent.
 *   Requiring at least one `astro-island` to exist first turns that into a loud
 *   timeout. Set `false` only for a page with genuinely no islands.
 */
export async function waitForIslands(page: Page, { expectIslands = true } = {}): Promise<void> {
  if (expectIslands) {
    await page.waitForFunction(() => document.querySelector("astro-island") !== null);
  }
  await page.waitForFunction(() => document.querySelectorAll("astro-island[ssr]").length === 0);
}

/**
 * Fill a controlled React input and prove the value survived.
 *
 * `waitForIslands` alone should be enough. This is deliberate belt-and-braces:
 * hydration is per-island, and a page can mount one island while another is
 * still inert. Note the ordering trap — checking `toHaveValue()` *without* first
 * waiting for hydration passes vacuously, because pre-hydration nothing is there
 * to reset the DOM value; React wipes it a moment later. The assertion only
 * means something once the island owns the input.
 */
export async function fillHydrated(locator: Locator, value: string): Promise<void> {
  await expect(async () => {
    await locator.fill(value);
    await expect(locator).toHaveValue(value);
  }).toPass({ timeout: 10_000 });
}
