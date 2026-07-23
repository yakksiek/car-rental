// core
import { test, expect } from "@playwright/test";

// others
import { fillHydrated, waitForIslands } from "./support/hydration";
import { clearMailbox, waitForCallbackLink } from "./support/mailpit";
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
  await clearMailbox();

  // Request the reset from the forgot-password form.
  await page.goto("/auth/forgot-password");
  await waitForIslands(page);
  await fillHydrated(page.getByRole("textbox", { name: "E-mail służbowy" }), email);
  await page.getByRole("button", { name: "Wyślij link resetujący" }).click();

  // Neutral confirmation (no account-existence leak).
  await page.waitForURL(/\/auth\/forgot-password\?sent=1/);
  await expect(page.getByRole("heading", { name: "Sprawdź skrzynkę" })).toBeVisible();

  // Follow the emailed recovery link — establishes the recovery session.
  const link = await waitForCallbackLink(email);
  await page.goto(link);
  await page.waitForURL(/\/auth\/reset-password(?!\?done)/);
  await waitForIslands(page);
  await expect(page.getByRole("heading", { name: "Ustaw nowe hasło" })).toBeVisible();

  // Set the new password.
  await fillHydrated(page.getByRole("textbox", { name: "Nowe hasło" }), newPassword);
  await fillHydrated(page.getByRole("textbox", { name: "Potwierdź hasło" }), newPassword);
  await page.getByRole("button", { name: "Zapisz hasło" }).click();
  await page.waitForURL(/\/auth\/reset-password\?done=1/);
  await expect(page.getByRole("heading", { name: "Hasło zaktualizowane" })).toBeVisible();

  // The assertion of record: the NEW password signs in and clears the gate.
  await page.goto("/auth/signin");
  await waitForIslands(page);
  await fillHydrated(page.getByRole("textbox", { name: "E-mail służbowy" }), email);
  await fillHydrated(page.getByRole("textbox", { name: "Hasło" }), newPassword);
  await page.getByRole("button", { name: "Zaloguj się" }).click();
  await page.waitForURL("/dashboard");
  await expect(page.getByRole("button", { name: "Wyloguj" })).toBeVisible();
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
  await expect(page.getByRole("heading", { name: "Ustaw hasło" })).toBeVisible();
  await expect(page.getByText("Witaj w Flocie")).toBeVisible();

  // Set the first password.
  await fillHydrated(page.getByRole("textbox", { name: "Nowe hasło" }), password);
  await fillHydrated(page.getByRole("textbox", { name: "Potwierdź hasło" }), password);
  await page.getByRole("button", { name: "Aktywuj konto" }).click();
  await page.waitForURL(/\/auth\/reset-password\?done=1/);
  await expect(page.getByRole("heading", { name: "Hasło zaktualizowane" })).toBeVisible();

  // The new hire signs in with the password they just set (INVITED → ACTIVE).
  await page.goto("/auth/signin");
  await waitForIslands(page);
  await fillHydrated(page.getByRole("textbox", { name: "E-mail służbowy" }), email);
  await fillHydrated(page.getByRole("textbox", { name: "Hasło" }), password);
  await page.getByRole("button", { name: "Zaloguj się" }).click();
  await page.waitForURL("/dashboard");
  await expect(page.getByRole("button", { name: "Wyloguj" })).toBeVisible();
});
