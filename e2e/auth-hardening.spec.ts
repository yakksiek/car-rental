// core
import { test, expect } from "@playwright/test";

// others
import { waitForIslands } from "./support/hydration";
import { createActiveEmployee, deleteStaffUser, inviteCallbackLink, recoveryCallbackLink } from "./fixtures/staff";

// ---------------------------------------------------------------------------
// AUTH HARDENING — R3, the session-fixation refusal (S-14, plan Phase 2)
//
// THE RISK: `/auth/callback` was a GET-only session *installer* with no "am I
// already signed in?" branch. Astro exempts safe methods from its origin check,
// so a crafted top-level navigation to a link carrying somebody else's
// `token_hash` silently switched a victim's browser onto that account — and
// every protocol, signature and photo they filed afterwards landed in it.
//
// WHY A BROWSER. The property is "a link arriving at a browser that already
// holds a session changes nothing about that session". Session ownership lives
// in cookies across a top-level navigation, which is exactly what integration's
// constructed `APIContext` cannot model — it has no browser and no navigation.
//
// The second test carries the load-bearing half: refusing must not BURN the
// token. If the callback consumed it before refusing, the link would be dead by
// the time the user did what the screen told them to do, and the refusal would
// have turned a recoverable state into a lost one.
//
// Runs on the chromium project's default `employee` storage state — this spec
// NEEDS a signed-in browser, which is why it cannot live in `staff-auth.spec.ts`
// (that file opts the whole file out of auth at `test.use`).
// ---------------------------------------------------------------------------

let cleanupId: string | undefined;

test.afterEach(async () => {
  if (cleanupId) {
    await deleteStaffUser(cleanupId);
    cleanupId = undefined;
  }
});

test("a recovery link opened in a signed-in browser is refused, and that session survives", async ({ page }) => {
  // A DIFFERENT staffer's link — the colleague-at-the-rental-desk case.
  const { id, email } = await createActiveEmployee("Fl0ta-E2E-Konflikt-2026!");
  cleanupId = id;
  const link = await recoveryCallbackLink(email);

  await page.goto(link);

  await page.waitForURL(/\/auth\/link-conflict/);
  await expect(page.getByRole("heading", { name: "Ta przeglądarka jest już zalogowana" })).toBeVisible();

  // It names the account that is IN THE WAY (the signed-in employee), not the
  // link's recipient — that is the whole point of the screen.
  await expect(page.getByText("employee@fleetrent.test")).toBeVisible();
  await expect(page.getByText(email)).toHaveCount(0);

  // The assertion of record for the fixation risk: the original session is
  // untouched. If the callback had exchanged the token, this would now be the
  // fixture user's browser — or no session at all.
  await page.goto("/dashboard");
  await expect(page.getByRole("button", { name: "Wyloguj" })).toBeVisible();
});

test("refusing the link does not consume it — the same link still works afterwards", async ({ page, browser }) => {
  const { id, email } = await createActiveEmployee("Fl0ta-E2E-Nietkniety-2026!");
  cleanupId = id;
  const link = await recoveryCallbackLink(email);

  // First open: refused, because this browser already holds a session.
  await page.goto(link);
  await page.waitForURL(/\/auth\/link-conflict/);
  await expect(page.getByRole("button", { name: "Wyloguj się" })).toBeVisible();

  // Second open of the SAME link, from a browser with no session — the state the
  // R11 copy tells the reader to get into. It must exchange and land on the form.
  // A callback that consumed the token before refusing would strand them on
  // "Link wygasł" here, having followed the instructions correctly.
  //
  // A fresh context rather than clicking R11's own sign-out button: that button
  // posts to /api/auth/signout, which calls `signOut()` at supabase-js's default
  // GLOBAL scope, so clicking it would revoke every session of the shared
  // `employee` storage-state identity and poison any spec that starts afterwards
  // (see e2e-rules.md). The property under test is "the refusal left the token
  // spendable", and arriving signed-out is what proves it. The button's own
  // behaviour is covered by the manual checks in the plan.
  const anon = await browser.newContext({ storageState: { cookies: [], origins: [] } });
  const anonPage = await anon.newPage();
  await anonPage.goto(link);
  await anonPage.waitForURL(/\/auth\/reset-password/);
  await waitForIslands(anonPage);
  await expect(anonPage.getByRole("heading", { name: "Ustaw nowe hasło" })).toBeVisible();
  await anon.close();
});

test("an INVITE link behaves the same — refused, not consumed, still activatable", async ({ page, browser }) => {
  // The scenario R11 was designed for: a shared rental-desk workstation where a
  // new hire opens their invite inside a colleague's session. Worth its own case
  // rather than trusting the recovery test to cover it — the callback takes a
  // different branch for `type=invite`, and getting this wrong would strand a
  // hire on their first day with a burnt link and no way to ask for a new one
  // (unlike recovery, there is no self-service "send me another invite").
  const { id, link } = await inviteCallbackLink();
  cleanupId = id;

  await page.goto(link);
  await page.waitForURL(/\/auth\/link-conflict/);

  const anon = await browser.newContext({ storageState: { cookies: [], origins: [] } });
  const anonPage = await anon.newPage();
  await anonPage.goto(link);
  await anonPage.waitForURL(/\/auth\/reset-password/);
  await waitForIslands(anonPage);
  // Invite mode specifically — the welcome eyebrow and "Ustaw hasło", not the
  // recovery screen's "Ustaw nowe hasło".
  await expect(anonPage.getByRole("heading", { name: "Ustaw hasło" })).toBeVisible();
  await expect(anonPage.getByText("Witaj we Flocie")).toBeVisible();
  await anon.close();
});

test("/auth/link-conflict typed directly by a signed-out visitor redirects to sign-in", async ({ browser }) => {
  // No session, so the screen has nothing to name and nothing to offer.
  const context = await browser.newContext({ storageState: { cookies: [], origins: [] } });
  const page = await context.newPage();

  await page.goto("/auth/link-conflict");

  await page.waitForURL(/\/auth\/signin/);
  await context.close();
});
