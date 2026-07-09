// core
import { defineConfig, devices } from "@playwright/test";

// E2E config. Complements the two Vitest projects in `vitest.config.ts` (unit,
// integration) with the only layer that crosses every boundary at once:
// browser → middleware → Astro route → Supabase → back into rendered HTML.
//
// Reserve this layer for risks that a cheaper test would have to lie about.
// RLS, the overlap constraint, and the authz matrix are already proven
// deterministically in `tests/integration/` — do not re-prove them here.
//
// The dev server reads Supabase credentials from `.dev.vars`, NOT `.env.test`.
// These tests sign in as users seeded by `supabase/seed.sql`, so `.dev.vars`
// must point at the local stack (`npx supabase start`). Against any other
// project the sign-in in `auth.setup.ts` fails loudly rather than silently
// writing to the wrong database.
const BASE_URL = process.env.E2E_BASE_URL ?? "http://localhost:4321";

export default defineConfig({
  testDir: "./e2e",

  // Each spec is self-contained (own setup, action, assertion, cleanup), so
  // files run in parallel. Unique per-test identifiers — not serialization —
  // are what keep concurrent runs from colliding.
  fullyParallel: true,

  // A stray `test.only` must never silently shrink the CI suite.
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : [["list"], ["html", { open: "never" }]],

  use: {
    baseURL: BASE_URL,
    // Kept on the first retry only: full trace on every run is slow and large,
    // and a test that passes first try has nothing to explain.
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },

  projects: [
    // Signs in once per role and writes the session to `playwright/.auth/`.
    // Everything below depends on it, so no spec ever drives the login form
    // to reach the thing it actually wants to test.
    { name: "setup", testMatch: /auth\.setup\.ts/ },

    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        // Default identity: employee. This is the lowest-privilege role that
        // still clears the `/dashboard` gate, so a test that accidentally
        // depends on admin rights fails instead of passing by over-permission.
        //
        // Opt out per file:
        //   anon  — test.use({ storageState: { cookies: [], origins: [] } })
        //   admin — test.use({ storageState: "playwright/.auth/admin.json" })
        storageState: "playwright/.auth/employee.json",
      },
      dependencies: ["setup"],
    },
  ],

  webServer: {
    command: "npm run dev",
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000,
    stdout: "ignore",
    stderr: "pipe",
  },
});
