// core
import { test, expect, type Page } from "@playwright/test";

// others
import { fillHydrated, waitForIslands } from "./support/hydration";
import { isInViewport, isTopmostAtItsOwnCentre, scrollToBottom } from "./support/reachability";
import { waitForCallbackLink } from "./support/mailpit";
import { createActiveEmployee, createPendingEmployee, deleteStaffByEmail, deleteStaffUser } from "./fixtures/staff";

// ---------------------------------------------------------------------------
// EMPLOYEES ADMIN CRUD (S-08, plan Phase 4) — the rendered admin roster:
//   1. add employee → an ADDED row appears and nothing is sent
//   2. send the invitation → ADDED becomes INVITED and the link works
//   3. remove via typed-email confirmation → the row disappears
//   4. the admin's own remove ✕ is disabled (can't remove yourself)
//   5. a last-admin refusal surfaces the refusal modal
//   6. a dropped connection reports INSIDE the modal, on top of the overlay
//   7. a provisioning failure does too, keeping the form the admin would retry in
//   8. a duplicate still reports inline under the e-mail field, unchanged
//
// Why a browser: these are pure UI behaviours over the real /api/staff* routes
// (add/deactivate) + middleware admin gate — the SSR roster, the hydrated
// island, the typed-confirm gate, and the optimistic list mutation. The account
// lifecycle + guards themselves are proven deterministically in
// tests/integration/staff.test.ts; this layer proves the surface wires to them.
//
// Admin session (the roster is admin-only). Data is seeded/torn down through the
// service-role fixture, never by driving another flow.
// ---------------------------------------------------------------------------

test.use({ storageState: "playwright/.auth/admin.json" });

/**
 * Open the add-employee dialog.
 *
 * S-12b Phase 6 retired this page's own add-employee button: the action is
 * now the promoted first row of the shell's `＋ New` quick-add menu, and reaches
 * the roster island through a `CustomEvent` (the pill is a different island). The
 * entry point moved; the dialog and everything past it did not — which is why
 * this is one helper rather than a change to five tests.
 */
async function openAddEmployee(page: Page) {
  await page.getByRole("button", { name: "New" }).click();
  await page.getByRole("button", { name: /Add employee/ }).click();
}

const SEED_ADMIN_EMAIL = "admin@fleetrent.test";

test("admin adds an employee → an ADDED row appears, and the row's only action is to invite", async ({ page }) => {
  // The two-step add (invite-journey-fixes phase 8): step 1 creates the account
  // and sends nothing, so the roster's third state has to exist and the row must
  // offer `Send invite` — NOT `Reset password`, which would send a recovery link
  // to someone who has never had a password.
  const email = `e2e-add-${Date.now()}-${Math.floor(Math.random() * 1e6)}@fleetrent.test`;
  try {
    await page.goto("/dashboard/staff");
    await waitForIslands(page);

    await openAddEmployee(page);
    await fillHydrated(page.getByLabel("FULL NAME"), "Nowy Pracownik");
    await fillHydrated(page.getByLabel("EMAIL ADDRESS"), email);
    // The modal's CTA stopped promising an email when the add stopped sending one.
    await page.getByRole("button", { name: "Add", exact: true }).click();

    const row = page.getByRole("row", { name: new RegExp(email, "i") });
    await expect(row).toBeVisible();
    await expect(row.getByText("ADDED")).toBeVisible();
    // The first-send wording — a ADDED row has had nothing sent for it yet.
    await expect(row.getByRole("button", { name: "Send invite", exact: true })).toBeVisible();
    await expect(row.getByRole("button", { name: "Reset password" })).toHaveCount(0);
  } finally {
    await deleteStaffByEmail(email);
  }
});

test("admin sends the invitation → the row becomes INVITED and the emailed link still activates the account", async ({
  page,
  browser,
}) => {
  // The end-to-end claim phase 8 rests on: splitting create from invite keeps the
  // REAL GoTrue invite (`supabase/templates/invite.html`) working on an account
  // that already exists. If `createUser({ email_confirm: false })` or the
  // separate `inviteUserByEmail` hop were wrong, the link would 422 at send time
  // or dead-end at the form — both invisible to any cheaper layer.
  const email = `e2e-invite-${Date.now()}-${Math.floor(Math.random() * 1e6)}@fleetrent.test`;
  const password = "Fl0ta-E2E-TwoStep-2026!";
  try {
    await page.goto("/dashboard/staff");
    await waitForIslands(page);

    await openAddEmployee(page);
    await fillHydrated(page.getByLabel("FULL NAME"), "Robert Zieliński");
    await fillHydrated(page.getByLabel("EMAIL ADDRESS"), email);
    await page.getByRole("button", { name: "Add", exact: true }).click();

    const row = page.getByRole("row", { name: new RegExp(email, "i") });
    await expect(row.getByText("ADDED")).toBeVisible();

    // Step 2: the explicit send.
    await row.getByRole("button", { name: "Send invite", exact: true }).click();
    await expect(page.getByText("Invitation sent.")).toBeVisible();
    await expect(row.getByText("INVITED")).toBeVisible();
    // The action re-labels itself once something HAS been sent, so the row never
    // invites a second send in wording that implies a first one.
    await expect(row.getByRole("button", { name: "Resend invite" })).toBeVisible();
    await expect(row.getByRole("button", { name: "Send invite", exact: true })).toHaveCount(0);

    // The hire opens the real emailed link in their OWN browser — a fresh
    // signed-out context, never by signing this one out (that would revoke the
    // shared admin storageState globally; see e2e-rules.md).
    const link = await waitForCallbackLink(email);
    const hire = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    try {
      const hirePage = await hire.newPage();
      await hirePage.goto(link);
      await hirePage.waitForURL(/\/auth\/reset-password\?mode=invite/);
      await waitForIslands(hirePage);
      await expect(hirePage.getByRole("heading", { name: "Set your password" })).toBeVisible();
      await expect(hirePage.getByText("Welcome to Flota")).toBeVisible();
      // The account box names the hire the admin typed, by their initials.
      await expect(hirePage.getByText("RZ", { exact: true })).toBeVisible();

      await fillHydrated(hirePage.getByRole("textbox", { name: "New password" }), password);
      await fillHydrated(hirePage.getByRole("textbox", { name: "Confirm password" }), password);
      await hirePage.getByRole("button", { name: "Activate account" }).click();
      await hirePage.waitForURL(/\/auth\/reset-password\?done=1/);

      // The assertion of record: the password they just set signs them in.
      await hirePage.goto("/auth/signin");
      await waitForIslands(hirePage);
      await fillHydrated(hirePage.getByRole("textbox", { name: "Work email" }), email);
      await fillHydrated(hirePage.getByRole("textbox", { name: "Password" }), password);
      await hirePage.getByRole("button", { name: "Sign in" }).click();
      await hirePage.waitForURL("/dashboard");
      await expect(hirePage.getByRole("button", { name: "Sign out" })).toBeVisible();
    } finally {
      await hire.close();
    }

    // And the roster now reports them as someone who can sign in, so the row's
    // action flips to the one that suits a person WITH a password.
    await page.reload();
    await waitForIslands(page);
    await expect(row.getByText("ACTIVE")).toBeVisible();
    await expect(row.getByRole("button", { name: "Reset password" })).toBeVisible();
    await expect(row.getByRole("button", { name: "Send invite", exact: true })).toHaveCount(0);
    await expect(row.getByRole("button", { name: "Resend invite" })).toHaveCount(0);
  } finally {
    await deleteStaffByEmail(email);
  }
});

test("admin removes an employee via typed-email confirmation → the row disappears", async ({ page }) => {
  const { id, email } = await createActiveEmployee("Fl0ta-E2E-Remove-2026!");
  try {
    await page.goto("/dashboard/staff");
    await waitForIslands(page);

    const row = page.getByRole("row", { name: new RegExp(email, "i") });
    await expect(row).toBeVisible();
    await row.getByRole("button", { name: "Remove employee" }).click();

    // Server re-checks the typed email; the confirm button unlocks only on a match.
    const confirm = page.getByRole("button", { name: "Remove", exact: true });
    await expect(confirm).toBeDisabled();
    await fillHydrated(page.getByLabel("TYPE THE EMAIL TO CONFIRM"), email);
    await expect(confirm).toBeEnabled();
    await confirm.click();

    await expect(page.getByRole("row", { name: new RegExp(email, "i") })).toHaveCount(0);
  } finally {
    await deleteStaffUser(id);
  }
});

test("the admin's own remove ✕ is disabled — you can't remove yourself", async ({ page }) => {
  await page.goto("/dashboard/staff");
  await waitForIslands(page);

  const ownRow = page.getByRole("row", { name: new RegExp(SEED_ADMIN_EMAIL, "i") });
  await expect(ownRow).toBeVisible();
  await expect(ownRow.getByText("· You")).toBeVisible();
  await expect(ownRow.getByRole("button", { name: "Remove employee" })).toBeDisabled();
});

test("a last-admin refusal surfaces the refusal modal", async ({ page }) => {
  // The last-admin GUARD is authoritative in the deactivate_staff RPC and proven
  // in integration; it is unreachable through this UI (the sole admin's own ✕ is
  // disabled). Here we prove the one UI-specific behaviour: a 409 from the
  // deactivate route surfaces the refusal modal rather than removing the row.
  const { id, email } = await createActiveEmployee("Fl0ta-E2E-LastAdmin-2026!");
  await page.route("**/api/staff/*/deactivate", (route) =>
    route.fulfill({ status: 409, contentType: "application/json", body: JSON.stringify({ error: "last_admin" }) }),
  );
  try {
    await page.goto("/dashboard/staff");
    await waitForIslands(page);

    const row = page.getByRole("row", { name: new RegExp(email, "i") });
    await row.getByRole("button", { name: "Remove employee" }).click();
    await fillHydrated(page.getByLabel("TYPE THE EMAIL TO CONFIRM"), email);
    await page.getByRole("button", { name: "Remove", exact: true }).click();

    await expect(page.getByText("The last admin cannot be removed")).toBeVisible();
    // The row is NOT removed — the refusal blocked it.
    await expect(row).toBeVisible();
  } finally {
    await page.unroute("**/api/staff/*/deactivate");
    await deleteStaffUser(id);
  }
});

// ---------------------------------------------------------------------------
// WHERE the add failure is reported (invite-journey-fixes, phase 9).
//
// The risk these two protect is not "is the error in the DOM" — it was, and a
// bare `toBeVisible()` passed while the admin saw nothing. `addEmployee`'s
// failure arms set a BANNER and left the modal open, so the message painted
// behind `ModalShell`'s overlay (`fixed inset-0 z-[60] … backdrop-blur-sm`).
// Hit-testing the banner's centre returned the overlay, not the banner.
//
// So the assertion is the one the defect was measured with: the error must be
// the topmost element at its own centre. `isTopmostAtItsOwnCentre` goes red if a
// future edit routes either arm back to a surface the overlay covers.
// ---------------------------------------------------------------------------

// The three measurements live in `support/reachability.ts` — phase 11 moved them
// there when `/dashboard/vehicles` turned out to need the same pair, so the
// definition of "readable" stays one definition. `isInViewport` +
// `isTopmostAtItsOwnCentre` are always asserted together; `scrollToBottom`
// supplies the precondition without which neither can fail.

test("a dropped connection reports inside the add modal, on top of the overlay — not behind it", async ({ page }) => {
  // THE PHASE-9 DEFECT. `fetch` throws, the typed values are still perfectly
  // good, and this arm used to give the admin a blurred red smear behind a
  // dimmed backdrop — the most common failure reporting nothing readable.
  const email = `e2e-neterr-${Date.now()}-${Math.floor(Math.random() * 1e6)}@fleetrent.test`;
  await page.route("**/api/staff", (route) => route.abort());
  try {
    await page.goto("/dashboard/staff");
    await waitForIslands(page);

    await openAddEmployee(page);
    await fillHydrated(page.getByLabel("FULL NAME"), "Nowy Pracownik");
    await fillHydrated(page.getByLabel("EMAIL ADDRESS"), email);
    await page.getByRole("button", { name: "Add", exact: true }).click();

    // Located by its copy, not by `role="alert"` — the layout's missing-config
    // banner is an alert too, so the role alone is ambiguous on this page.
    const error = page.getByText("Could not create the account. Check your connection and try again.");
    await expect(error).toBeVisible();
    // Present is not the same as readable — this is the assertion that matters.
    expect(await isTopmostAtItsOwnCentre(error)).toBe(true);

    // The modal stayed open with the typed values intact, and its own submit is
    // the retry — so there is exactly one retry control on screen, not two.
    await expect(page.getByLabel("FULL NAME")).toHaveValue("Nowy Pracownik");
    await expect(page.getByLabel("EMAIL ADDRESS")).toHaveValue(email);
    await expect(page.getByRole("button", { name: "Add", exact: true })).toBeEnabled();
    await expect(page.getByRole("button", { name: "Retry" })).toHaveCount(0);
  } finally {
    await page.unroute("**/api/staff");
  }
});

test("a provisioning failure reports inside the add modal, keeping the form the admin would retry in", async ({
  page,
}) => {
  // Phase 1 closed the modal here and made the banner's `Retry` the retry. Phase
  // 8 stopped sending mail on create, so a failed create is fully retryable in
  // place with nothing delivered — and phase 7's "try again" was an instruction
  // issued after the form had been taken away.
  const email = `e2e-provfail-${Date.now()}-${Math.floor(Math.random() * 1e6)}@fleetrent.test`;
  await page.route("**/api/staff", (route) =>
    route.fulfill({
      status: 500,
      contentType: "application/json",
      body: JSON.stringify({ error: "provisioning failed", code: "provision_rolled_back" }),
    }),
  );
  try {
    await page.goto("/dashboard/staff");
    await waitForIslands(page);

    await openAddEmployee(page);
    await fillHydrated(page.getByLabel("FULL NAME"), "Nowy Pracownik");
    await fillHydrated(page.getByLabel("EMAIL ADDRESS"), email);
    await page.getByRole("button", { name: "Add", exact: true }).click();

    const error = page.getByText("Could not create the account. Try again.");
    await expect(error).toBeVisible();
    expect(await isTopmostAtItsOwnCentre(error)).toBe(true);

    await expect(page.getByLabel("EMAIL ADDRESS")).toHaveValue(email);
    await expect(page.getByRole("button", { name: "Retry" })).toHaveCount(0);
  } finally {
    await page.unroute("**/api/staff");
  }
});

test("a duplicate still reports inline under the e-mail field, unchanged", async ({ page }) => {
  // The 409 is the idiom phase 9 generalised FROM — it must not move. It stays
  // attached to the field it belongs to, and it still locks the submit, because
  // retrying that address cannot succeed until the admin edits it.
  const email = `e2e-dup-${Date.now()}-${Math.floor(Math.random() * 1e6)}@fleetrent.test`;
  await page.route("**/api/staff", (route) =>
    route.fulfill({
      status: 409,
      contentType: "application/json",
      body: JSON.stringify({ errors: { email: "An employee with that email address already exists." } }),
    }),
  );
  try {
    await page.goto("/dashboard/staff");
    await waitForIslands(page);

    await openAddEmployee(page);
    await fillHydrated(page.getByLabel("FULL NAME"), "Nowy Pracownik");
    await fillHydrated(page.getByLabel("EMAIL ADDRESS"), email);
    await page.getByRole("button", { name: "Add", exact: true }).click();

    const dupError = page.getByText("This email is already on the team.");
    await expect(dupError).toBeVisible();
    expect(await isTopmostAtItsOwnCentre(dupError)).toBe(true);
    // Field-level, not form-level: the form slot must stay empty. Both §9.4
    // strings share this lead clause, so one assertion covers the pair.
    await expect(page.getByText(/^Could not create the account\./)).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Add", exact: true })).toBeDisabled();
  } finally {
    await page.unroute("**/api/staff");
  }
});

// ---------------------------------------------------------------------------
// WHERE the OTHER three mutations are reported (invite-journey-fixes, phase 10).
//
// Phase 9 fixed the add flow and, in doing so, established the measurement: an
// error can be in the DOM, pass `toBeVisible()`, and still be unreadable. Phase
// 10 found the same class of defect on the row-triggered mutations, in a form
// phase 9's assertion could not have caught — the message was not COVERED, it
// was outside the viewport, because the banner sits at the top of a scrolling
// document while the ✕ / invite / reset controls are per-row.
//
// Measured against the running app, 2026-08-21:
//
//   removeEmployee failure, 390×844, scrollY 1298 → banner top -1033, hit null
//   resetPassword success,  390×844, scrollY  689 → banner top  -424, hit null
//
// `toBeVisible()` passed on every one of those. So these specs assert BOTH
// halves: in the viewport, and topmost at its own centre.
// ---------------------------------------------------------------------------

test("a failed remove reports inside the remove modal, with the typed confirmation intact", async ({ page }) => {
  // Half one of the phase-10 defect. Both failure arms used to set the roster
  // banner and leave `RemoveModal` open — so the message was off-screen while
  // the admin was scrolled, and under `ModalShell`'s own `z-[60]` overlay once
  // they scrolled up to it. There was no scroll position that showed it.
  const { id, email } = await createActiveEmployee("Fl0ta-E2E-RemoveFail-2026!");
  await page.route("**/api/staff/*/deactivate", (route) => route.abort());
  try {
    await page.goto("/dashboard/staff");
    await waitForIslands(page);

    const row = page.getByRole("row", { name: new RegExp(email, "i") });
    await row.getByRole("button", { name: "Remove employee" }).click();
    await fillHydrated(page.getByLabel("TYPE THE EMAIL TO CONFIRM"), email);
    await page.getByRole("button", { name: "Remove", exact: true }).click();

    const error = page.getByText("Could not remove the employee. Check your connection and try again.");
    await expect(error).toBeVisible();
    // Present is not the same as readable — the assertions that matter.
    expect(await isInViewport(error)).toBe(true);
    expect(await isTopmostAtItsOwnCentre(error)).toBe(true);

    // The modal stayed open with the typed confirmation intact, and its own
    // `Remove` is the retry — so exactly one retry control is on screen, not two.
    await expect(page.getByLabel("TYPE THE EMAIL TO CONFIRM")).toHaveValue(email);
    await expect(page.getByRole("button", { name: "Remove", exact: true })).toBeEnabled();
    await expect(page.getByRole("button", { name: "Retry" })).toHaveCount(0);
    // And the row is still there — the abort changed nothing server-side.
    await expect(row).toBeVisible();
  } finally {
    await page.unroute("**/api/staff/*/deactivate");
    await deleteStaffUser(id);
  }
});

test("the last-admin refusal still swaps modals rather than reporting in the form", async ({ page }) => {
  // The arm phase 10 must NOT move. A 409 is a different screen with its own
  // copy, and `resolveRemoveReport` returns it as a surface swap carrying no
  // message — so the new form-level slot has to stay empty here.
  const { id, email } = await createActiveEmployee("Fl0ta-E2E-LastAdmin2-2026!");
  await page.route("**/api/staff/*/deactivate", (route) =>
    route.fulfill({ status: 409, contentType: "application/json", body: JSON.stringify({ error: "last_admin" }) }),
  );
  try {
    await page.goto("/dashboard/staff");
    await waitForIslands(page);

    const row = page.getByRole("row", { name: new RegExp(email, "i") });
    await row.getByRole("button", { name: "Remove employee" }).click();
    await fillHydrated(page.getByLabel("TYPE THE EMAIL TO CONFIRM"), email);
    await page.getByRole("button", { name: "Remove", exact: true }).click();

    await expect(page.getByText("The last admin cannot be removed")).toBeVisible();
    await expect(page.getByText(/^Could not remove the employee\./)).toHaveCount(0);
    await expect(row).toBeVisible();
  } finally {
    await page.unroute("**/api/staff/*/deactivate");
    await deleteStaffUser(id);
  }
});

// The reachability specs run at 390×844, pinned here rather than in the config.
//
// This defect only exists on a page tall enough to scroll, and the default
// `devices["Desktop Chrome"]` viewport does not give one: measured 2026-08-21, a
// seeded roster scrolls 46px at 1280×900 and 488px at 390×844. At the desktop
// default the banner never leaves the viewport, so BOTH the assertion and the
// deliberate-reintroduction check would pass whether or not the fix exists —
// a spec that cannot fail. 390px is also where the banner is worst (a 227px
// message column, wrapping to 3–4 lines) and is already a gated breakpoint.
//
// Consequence carried deliberately: below `lg` the roster is the CARD list, not
// the table, so these use the cards' own icon-button labels. The desktop reading
// stays a manual gate rather than being faked with a seeded row count that would
// land in the filter-tab counts other specs read under `fullyParallel`.
test.describe("the row actions' banner is reachable from the row that set it", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("a failed invite from a scrolled row is readable without scrolling", async ({ page }) => {
    // The fixture exists to put a ADDED row on the roster (so a row carries an
    // invite action) and to make the page tall enough to scroll. The spec never
    // needs its address — the failure banner names no one.
    const { id } = await createPendingEmployee();
    await page.route("**/api/staff/*/invite", (route) => route.abort());
    try {
      await page.goto("/dashboard/staff");
      await waitForIslands(page);

      const scrollY = await scrollToBottom(page);
      expect(scrollY, "the roster must actually scroll or this proves nothing").toBeGreaterThan(200);

      await page.getByRole("button", { name: "Send invite", exact: true }).last().click();

      const banner = page.getByText("Could not save your change. Check your connection and try again.");
      await expect(banner).toBeVisible();
      // THE PHASE-10 ASSERTIONS. Before the fix this banner sat at top -424 with
      // `elementFromPoint` answering `null`, and `toBeVisible()` passed anyway.
      expect(await isInViewport(banner), "banner is outside the viewport").toBe(true);
      expect(await isTopmostAtItsOwnCentre(banner), "banner is covered").toBe(true);
      // The admin was not moved to achieve that — the property that separates a
      // pinned banner from scrolling one into view, which would land near 0.
      // `>=` rather than `===` because Chrome's SCROLL ANCHORING bumps scrollY by
      // the banner's own height when it is inserted above the viewport, which is
      // the browser keeping the visible content still — the effect we want.
      expect(await page.evaluate(() => Math.round(window.scrollY))).toBeGreaterThanOrEqual(scrollY);

      // A failure keeps its retry, and the banner now carries its own exit.
      await expect(page.getByRole("button", { name: "Retry" })).toBeVisible();
      await expect(page.getByRole("button", { name: "Close" })).toBeVisible();
    } finally {
      await page.unroute("**/api/staff/*/invite");
      await deleteStaffUser(id);
    }
  });

  test("a successful invite from a scrolled row is readable without scrolling, and dismissible", async ({ page }) => {
    // The success arm is load-bearing, which is why it gets its own spec rather
    // than riding on the failure one: a resend changes nothing else on screen —
    // the badge is already INVITED — so `inviteSent` is the ONLY feedback
    // there is (design-contract §9.3). A success banner the admin never sees
    // fails that job exactly as completely as a failure banner does.
    //
    // The route is stubbed rather than really sent: what this spec is about is
    // the SURFACE, the real GoTrue invite is already proven by the phase-8 spec
    // above, and a real send would burn one of the two emails per hour.
    const { id, email } = await createPendingEmployee();
    await page.route("**/api/staff/*/invite", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ status: "sent", invitedAt: new Date().toISOString() }),
      }),
    );
    try {
      await page.goto("/dashboard/staff");
      await waitForIslands(page);

      const scrollY = await scrollToBottom(page);
      expect(scrollY, "the roster must actually scroll or this proves nothing").toBeGreaterThan(200);

      await page.getByRole("button", { name: "Send invite", exact: true }).last().click();

      const banner = page.getByText("Invitation sent.");
      await expect(banner).toBeVisible();
      expect(await isInViewport(banner), "banner is outside the viewport").toBe(true);
      expect(await isTopmostAtItsOwnCentre(banner), "banner is covered").toBe(true);
      // Same scroll-anchoring caveat as the failure spec above.
      expect(await page.evaluate(() => Math.round(window.scrollY))).toBeGreaterThanOrEqual(scrollY);

      // A success needs no retry, and pinning removed the old exit (scrolling
      // past it), so the ✕ is what replaces it.
      await expect(page.getByRole("button", { name: "Retry" })).toHaveCount(0);
      await page.getByRole("button", { name: "Close" }).click();
      await expect(banner).toHaveCount(0);
      // Dismissing the message must not undo the mutation it reported. The
      // ADDED → INVITED flip and the action's re-label are the phase-8
      // spec's subject, proven above at the desktop breakpoint; what belongs
      // here is only that the row survived the ✕.
      //
      // `.first()` because the roster renders BOTH surfaces into the DOM and
      // hides one per breakpoint (`hidden lg:block` table, `lg:hidden` cards),
      // so the address is present twice at any width.
      await expect(page.getByText(email).first()).toBeAttached();
    } finally {
      await page.unroute("**/api/staff/*/invite");
      await deleteStaffUser(id);
    }
  });
});
