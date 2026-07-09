// core
import { test as setup, expect, type Locator } from "@playwright/test";

// others
import { SEEDED_CREDENTIALS } from "../tests/helpers/clients";

// Authentication setup. Runs once before the browser projects (see the `setup`
// project in `playwright.config.ts`), signing in each staff role through the
// real UI and persisting the resulting Supabase session cookies to disk.
//
// Why through the UI rather than a direct `signInWithPassword` call: the app's
// session lives in cookies written by the Astro signin route via `@supabase/ssr`.
// A session minted straight from `supabase-js` is not in the shape middleware
// reads back, so it would not survive a page load.
//
// Credentials come from `tests/helpers/clients.ts` — the same seeded users the
// integration suite uses (`supabase/seed.sql`). One source, so a rotated seed
// password can't leave the two harnesses disagreeing.
//
// `norole@fleetrent.test` deliberately has no saved state: it is the
// fail-closed fixture, and every test that needs it must drive the sign-in
// itself so the 403 it triggers is the observed behavior, not a fixture detail.

const AUTH_DIR = "playwright/.auth";

/**
 * Fill a React-island input and prove the value stuck.
 *
 * Astro server-renders `SignInForm`, then hydrates it (`client:load`). A `fill()`
 * that lands in the window between paint and hydration writes straight to the
 * DOM node, and React then re-renders the controlled input from its empty
 * `useState` — silently discarding the value. The form submits blank and the
 * test times out waiting for a redirect that never comes.
 *
 * `toPass` retries the fill until the value survives a round trip, which is a
 * wait on application state (the island is interactive) rather than on time.
 * Do not replace this with `waitForTimeout`.
 */
async function fillHydrated(locator: Locator, value: string) {
  await expect(async () => {
    await locator.fill(value);
    await expect(locator).toHaveValue(value);
  }).toPass({ timeout: 10_000 });
}

for (const role of ["employee", "admin"] as const) {
  setup(`authenticate as ${role}`, async ({ page }) => {
    const { email, password } = SEEDED_CREDENTIALS[role];

    await page.goto("/auth/signin");

    await fillHydrated(page.getByRole("textbox", { name: "E-mail służbowy" }), email);
    // Scoped to the textbox role on purpose: `FormField` nests the "Pokaż hasło"
    // toggle inside the field's <label>, so the input's accessible name is
    // "Hasło Pokaż hasło" and a bare getByLabel("Hasło") also matches the button.
    await fillHydrated(page.getByRole("textbox", { name: "Hasło" }), password);
    await page.getByRole("button", { name: "Zaloguj się" }).click();

    // The signin route redirects to DEFAULT_POST_LOGIN on success and back to
    // /auth/signin?error=… on failure. Waiting for the dashboard URL — not for
    // a timeout — makes bad credentials or a misconfigured `.dev.vars` fail
    // here with an obvious message instead of somewhere deep in a spec.
    await page.waitForURL("/dashboard");

    // Landing on /dashboard proves the cookie cleared middleware's role gate:
    // it is a protected route, so an unauthenticated or role-less session would
    // have been bounced back to sign-in. The sign-out control is the marker
    // because it renders at every breakpoint — the dashboard's <h1> is
    // `md:hidden`, so asserting on it would pass or fail by viewport.
    await expect(page.getByRole("button", { name: "Wyloguj" })).toBeVisible();

    await page.context().storageState({ path: `${AUTH_DIR}/${role}.json` });
  });
}
