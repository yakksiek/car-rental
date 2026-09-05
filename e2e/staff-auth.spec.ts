// core
import { test, expect } from "@playwright/test";

// others
import { fillHydrated, waitForIslands } from "./support/hydration";
import { waitForCallbackLink } from "./support/mailpit";
import { createActiveEmployee, deleteStaffUser, inviteEmployee } from "./fixtures/staff";

// ---------------------------------------------------------------------------
// STAFF AUTH FLOWS (S-08, plan Phase 3) — the two paths integration can't reach
// because they cross email → link → session:
//   1. self-service password reset  (forgot → recovery email → new password → sign in)
//   2. invite-accept                (admin invite → invite email → first password → sign in)
//
// Why a browser. Both flows chain the forgot/reset routes, the GoTrue email, the
// /auth/callback token_hash exchange (verifyOtp establishes the cookie session),
// the middleware, and the sign-in route. The token_hash link exists precisely
// because the default confirmation-URL flow fails server-side (invite session in
// a URL hash; cross-browser recovery needs a verifier cookie) — nothing but a
// real browser round-trip proves the whole chain lands a usable session.
//
// The assertion of record for both: signing in with the NEW password reaches the
// gated /dashboard. That fails if the exchange, the updateUser, or the session
// cookie ever breaks — exactly the risk this layer exists to catch.
// ---------------------------------------------------------------------------

// Unauthenticated flows: opt out of the chromium project's default employee session.
test.use({ storageState: { cookies: [], origins: [] } });

let cleanupId: string | undefined;

test.afterEach(async () => {
  if (cleanupId) {
    await deleteStaffUser(cleanupId);
    cleanupId = undefined;
  }
});

test("self-service reset: forgot password → emailed link → new password → sign in with it", async ({ page }) => {
  const oldPassword = "Fl0ta-E2E-Old-2026!";
  const newPassword = "Fl0ta-E2E-New-2026!";
  const { id, email } = await createActiveEmployee(oldPassword);
  cleanupId = id;
  // No mailbox wipe. `waitForCallbackLink` searches by this unique recipient, so
  // a clear buys nothing — and Mailpit's DELETE is GLOBAL, so it was destroying
  // mail that a concurrently-running spec was still waiting for (`fullyParallel`
  // is on). That is shared state between tests, which e2e-rules.md forbids; it
  // went unnoticed while only one other spec read mail, and surfaced as soon as
  // the phase-8 two-step add spec became a third reader.

  // Request the reset from the forgot-password form.
  await page.goto("/auth/forgot-password");
  await waitForIslands(page);
  await fillHydrated(page.getByRole("textbox", { name: "Work email" }), email);
  await page.getByRole("button", { name: "Send reset link" }).click();

  // Neutral confirmation (no account-existence leak).
  await page.waitForURL(/\/auth\/forgot-password\?sent=1/);
  await expect(page.getByRole("heading", { name: "Check your email" })).toBeVisible();

  // Follow the emailed recovery link — establishes the recovery session.
  const link = await waitForCallbackLink(email);
  await page.goto(link);
  await page.waitForURL(/\/auth\/reset-password(?!\?done)/);
  await waitForIslands(page);
  await expect(page.getByRole("heading", { name: "Set a new password" })).toBeVisible();

  // Set the new password.
  await fillHydrated(page.getByRole("textbox", { name: "New password" }), newPassword);
  await fillHydrated(page.getByRole("textbox", { name: "Confirm password" }), newPassword);
  await page.getByRole("button", { name: "Save password" }).click();
  await page.waitForURL(/\/auth\/reset-password\?done=1/);
  await expect(page.getByRole("heading", { name: "Password updated" })).toBeVisible();

  // The assertion of record: the NEW password signs in and clears the gate.
  await page.goto("/auth/signin");
  await waitForIslands(page);
  await fillHydrated(page.getByRole("textbox", { name: "Work email" }), email);
  await fillHydrated(page.getByRole("textbox", { name: "Password" }), newPassword);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL("/dashboard");
  await expect(page.getByRole("button", { name: "Sign out" })).toBeVisible();
});

test("invite-accept: admin invite → emailed link → first password → sign in (INVITED→ACTIVE)", async ({ page }) => {
  const password = "Fl0ta-E2E-Invite-2026!";
  // The fixture provisions the invite and its email is sent by GoTrue; we search
  // Mailpit by this unique address, so no clear is needed (no cross-test race).
  const { id, email } = await inviteEmployee();
  cleanupId = id;

  // Follow the invite link — lands in invite-accept mode with a session.
  const link = await waitForCallbackLink(email);
  await page.goto(link);
  await page.waitForURL(/\/auth\/reset-password\?mode=invite/);
  await waitForIslands(page);
  await expect(page.getByRole("heading", { name: "Set your password" })).toBeVisible();
  await expect(page.getByText("Welcome to Flota")).toBeVisible();

  // Set the first password.
  await fillHydrated(page.getByRole("textbox", { name: "New password" }), password);
  await fillHydrated(page.getByRole("textbox", { name: "Confirm password" }), password);
  await page.getByRole("button", { name: "Activate account" }).click();
  await page.waitForURL(/\/auth\/reset-password\?done=1/);
  await expect(page.getByRole("heading", { name: "Password updated" })).toBeVisible();

  // The new hire signs in with the password they just set (INVITED → ACTIVE).
  await page.goto("/auth/signin");
  await waitForIslands(page);
  await fillHydrated(page.getByRole("textbox", { name: "Work email" }), email);
  await fillHydrated(page.getByRole("textbox", { name: "Password" }), password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL("/dashboard");
  await expect(page.getByRole("button", { name: "Sign out" })).toBeVisible();
});

// ---------------------------------------------------------------------------
// DEMO SIGN-IN (demo-account-gate, plan Phase 3) — the recruiter path.
//
// Why a browser. The slice exists so a recruiter following a CV link can get
// into the staff cockpit, and that path crosses every boundary at once: the
// server resolving DEMO_PASSWORD out of `astro:env/server` AND the demo address
// out of `demo_account_email()`, the card rendering them into the page, the React
// island hydrating, the prefill writing
// both controlled inputs, the native POST to /api/auth/signin, and the
// middleware gate on /dashboard. Nothing below the browser can prove the
// published credentials actually open the door — a unit test of the click
// handler would pass with the wrong values wired to the wrong fields.
//
// Only the PASSWORD is configuration now (impl-review F3): the address is derived
// from `profiles.is_demo` by `demo_account_email()`, so the card can never name an
// account the gate does not cover. That is why the expected e-mail below is the
// SEEDED account rather than `process.env.DEMO_EMAIL` — asserting against the env
// var would test a coincidence between `.env.test` and the database, and would red
// this spec for a config edit that left the app perfectly correct.
//
// `DEMO_PASSWORD` comes from `process.env` (playwright.config.ts loads `.env.test`)
// but the app under test reads `.dev.vars` — set it in BOTH. With it unset the card
// does not render, and this spec skips rather than failing a machine that never
// configured a demo account.
// ---------------------------------------------------------------------------

// The account `supabase/seed.sql` marks `is_demo`, and therefore the only address
// `demo_account_email()` can return against a seeded database.
const SEEDED_DEMO_EMAIL = "demo@fleetrent.test";

// Coerced to "" rather than left undefined so the assertion below needs no
// non-null assertion — the skip is what proves it is really set.
const DEMO_PASSWORD = process.env.DEMO_PASSWORD ?? "";

test("demo prefill: published credentials fill both fields in one click and sign in to /dashboard", async ({
  page,
}) => {
  test.skip(!DEMO_PASSWORD, "DEMO_PASSWORD unset — the demo card does not render");

  await page.goto("/auth/signin");
  await waitForIslands(page);

  const email = page.getByRole("textbox", { name: "Work email" });
  const password = page.getByRole("textbox", { name: "Password" });

  // The card is what publishes the credentials; without it there is nothing to
  // click and the prefill assertion below would pass vacuously on empty fields.
  await expect(page.getByText("Demo account")).toBeVisible();
  await expect(email).toHaveValue("");
  await expect(password).toHaveValue("");

  await page.getByRole("button", { name: "Fill in demo credentials" }).click();

  await expect(email).toHaveValue(SEEDED_DEMO_EMAIL);
  await expect(password).toHaveValue(DEMO_PASSWORD);

  // The assertion of record: the prefilled pair really signs in and clears the
  // /dashboard gate. Fails if the card ever publishes credentials the app does
  // not accept — the one way this slice can be broken and still look right.
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL("/dashboard");
  await expect(page.getByRole("button", { name: "Sign out" })).toBeVisible();
});
