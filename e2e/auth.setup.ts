// core
import { test as setup, expect } from "@playwright/test";

// others
import { SEEDED_CREDENTIALS } from "../tests/helpers/clients";
import { fillHydrated, waitForIslands } from "./support/hydration";

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
//
// `demo` IS saved, because the thing it proves cannot be reached any other way:
// `demo-gate.spec.ts` needs two byte-identical requests differing only in whose
// session cookie is attached, and a real cookie session is the only way
// `locals.isDemo` gets populated by middleware at all. It is a distinct seeded
// account, so signing in as it rotates no password the rest of the suite needs.

const AUTH_DIR = "playwright/.auth";

// *** The suite runs in ENGLISH, pinned rather than inherited. ***
// `en` is `DEFAULT_LOCALE`, so a cookie-less request already renders English and
// this cookie changes nothing today. It is here because "nothing set it" and "it
// is set to en" fail differently: the seeded staff rows carry `profiles.locale =
// null` now, but any later seed or a stray `POST /api/locale` inside a spec would
// silently re-language every literal-copy locator in the suite. Written onto the
// context BEFORE sign-in so it rides into `storageState` with the session.
const LOCALE_COOKIE = { name: "locale", value: "en", domain: "localhost", path: "/" };

for (const role of ["employee", "admin", "demo"] as const) {
  setup(`authenticate as ${role}`, async ({ page }) => {
    const { email, password } = SEEDED_CREDENTIALS[role];

    await page.context().addCookies([LOCALE_COOKIE]);
    await page.goto("/auth/signin");

    // SignInForm is a `client:load` island. Filling before it hydrates writes to
    // an inert DOM node whose value React discards on mount — so wait for the
    // island to own its inputs before typing a character.
    await waitForIslands(page);

    await fillHydrated(page.getByRole("textbox", { name: "Work email" }), email);
    // Scoped to the textbox role on purpose: `FormField` nests the "Show password"
    // toggle inside the field's <label>, so the input's accessible name is
    // "Password Show password" and a bare getByLabel("Password") also matches the
    // button.
    await fillHydrated(page.getByRole("textbox", { name: "Password" }), password);
    await page.getByRole("button", { name: "Sign in" }).click();

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
    await expect(page.getByRole("button", { name: "Sign out" })).toBeVisible();

    await page.context().storageState({ path: `${AUTH_DIR}/${role}.json` });
  });
}
