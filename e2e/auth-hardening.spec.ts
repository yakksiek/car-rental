// core
import { test, expect } from "@playwright/test";

// others
import { waitForIslands } from "./support/hydration";
import {
  createActiveEmployee,
  deactivateStaffUser,
  deleteStaffUser,
  inviteCallbackLink,
  recoveryCallbackLink,
} from "./fixtures/staff";

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
// The second and third tests used to carry "refusing must not BURN the token".
// invite-journey-fixes made that trivially true — the callback exchanges nothing
// at all now — so they were RETARGETED at the property that replaced it and is
// not trivial: the link is IDEMPOTENT. Opening it renders the form, closing the
// tab changes nothing, and reopening renders the form again. That sequence IS
// Bug 2, and it is unreachable from the integration layer: it needs a real
// browser keeping (and re-sending) the pending-token cookie across navigations.
//
// They also carry the second half of the same fix: opening a link must mint NO
// session. Measured on 2026-08-20, before the change, `GET /auth/callback` then
// `GET /dashboard` answered 200 — clicking an invite link alone granted a working
// employee session to someone who had never chosen a password.
//
// Runs on the chromium project's default `employee` storage state — this spec
// NEEDS a signed-in browser, which is why it cannot live in `staff-auth.spec.ts`
// (that file opts the whole file out of auth at `test.use`). The tests that need
// a signed-OUT browser open their own anonymous context instead; a file-level
// `test.use` would take the storage state away from the ones that need it.
//
// The fourth test carries a second, later risk (auth-followups, F1): the same
// "explain the refusal, don't answer a raw status" property, for the deactivated
// staffer the set-password page used to walk all the way to the submit button.
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

test("a recovery link is idempotent — reopening it renders the form again, and mints no session", async ({
  page,
  browser,
}) => {
  const { id, email } = await createActiveEmployee("Fl0ta-E2E-Nietkniety-2026!");
  cleanupId = id;
  const link = await recoveryCallbackLink(email);

  // First open: refused, because this browser already holds a session. Still
  // worth asserting — the refusal is what keeps a colleague's session intact.
  await page.goto(link);
  await page.waitForURL(/\/auth\/link-conflict/);
  await expect(page.getByRole("button", { name: "Wyloguj się" })).toBeVisible();

  // A fresh context rather than clicking R11's own sign-out button: that button
  // posts to /api/auth/signout, which calls `signOut()` at supabase-js's default
  // GLOBAL scope, so clicking it would revoke every session of the shared
  // `employee` storage-state identity and poison any spec that starts afterwards
  // (see e2e-rules.md).
  const anon = await browser.newContext({ storageState: { cookies: [], origins: [] } });
  const anonPage = await anon.newPage();

  await anonPage.goto(link);
  await anonPage.waitForURL(/\/auth\/reset-password/);
  await waitForIslands(anonPage);
  await expect(anonPage.getByRole("heading", { name: "Ustaw nowe hasło" })).toBeVisible();

  // NO SESSION was minted by merely opening the link. Before invite-journey-fixes
  // this navigation answered 200 with the dashboard.
  await anonPage.goto("/dashboard");
  await anonPage.waitForURL(/\/auth\/signin/);

  // BUG 2, EXACTLY: the hire walked away without setting a password, and comes
  // back to the same link. It must still work. This used to answer "Link wygasł",
  // because the token was spent when the form first RENDERED.
  await anonPage.goto(link);
  await anonPage.waitForURL(/\/auth\/reset-password/);
  await waitForIslands(anonPage);
  await expect(anonPage.getByRole("heading", { name: "Ustaw nowe hasło" })).toBeVisible();

  await anon.close();
});

test("an INVITE link behaves the same — refused inside a session, idempotent outside one", async ({
  page,
  browser,
}) => {
  // The scenario R11 was designed for: a shared rental-desk workstation where a
  // new hire opens their invite inside a colleague's session. Worth its own case
  // rather than trusting the recovery test to cover it — the invite arm carries
  // different copy and a different GoTrue token type, and getting this wrong
  // would strand a hire on their first day with a burnt link and no way to ask
  // for a new one (unlike recovery, there is no self-service "send me another").
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

  // Idempotent, and still in INVITE mode on the second open — the type comes from
  // the cookie the callback stamped, which is re-resolved against the token every
  // render, so a reopen cannot silently downgrade the welcome to recovery copy.
  await anonPage.goto(link);
  await anonPage.waitForURL(/\/auth\/reset-password/);
  await waitForIslands(anonPage);
  await expect(anonPage.getByRole("heading", { name: "Ustaw hasło" })).toBeVisible();
  await expect(anonPage.getByText("Witaj we Flocie")).toBeVisible();

  await anon.close();
});

test("a deactivated staffer on a live recovery link is told why, not shown the form", async ({ browser }) => {
  // WHY A BROWSER. The refusal lives on the PAGE, and nothing in the repo renders
  // an `.astro` page under Vitest — `tests/integration/pages-authz.test.ts` drives
  // `middleware.ts` with a synthetic context and never renders anything. So this
  // branch is covered here or nowhere.
  //
  // WHY IT IS REACHABLE AT ALL. `/api/auth/forgot-password` sends a reset link to
  // any valid address — it must, since it deliberately never reveals whether an
  // account exists — and GoTrue knows nothing about `profiles.deactivated_at`. So
  // the link is real and the session it mints is real; only the app's own role
  // gate refuses. Before this fix the page skipped that gate, so an ex-employee
  // typed a new password, submitted, and got an unstyled `Forbidden`.
  const { id, email } = await createActiveEmployee("Fl0ta-E2E-Dezaktywacja-2026!");
  cleanupId = id;
  await deactivateStaffUser(id);
  const link = await recoveryCallbackLink(email);

  // Signed-OUT, in its own context: the three tests above need the chromium
  // project's `employee` storage state, so the opt-out is per-test (same pattern
  // as the two anonymous contexts above).
  const anon = await browser.newContext({ storageState: { cookies: [], origins: [] } });
  const anonPage = await anon.newPage();

  const response = await anonPage.goto(link);
  await anonPage.waitForURL(/\/auth\/reset-password/);

  // A real page, not a status. `Forbidden` is a 403 with no markup at all — the
  // exact thing this branch exists to replace.
  expect(response?.status()).toBe(200);
  await expect(anonPage.getByRole("heading", { name: "Konto jest nieaktywne" })).toBeVisible();

  // And NOT the form. The island is server-rendered before it hydrates, so this
  // heading would already be in the HTML if the page had fallen through.
  await expect(anonPage.getByRole("heading", { name: "Ustaw nowe hasło" })).toHaveCount(0);
  await expect(anonPage.getByLabel("Nowe hasło")).toHaveCount(0);

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
