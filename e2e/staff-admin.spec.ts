// core
import { test, expect } from "@playwright/test";

// others
import { fillHydrated, waitForIslands } from "./support/hydration";
import { waitForCallbackLink } from "./support/mailpit";
import { createActiveEmployee, deleteStaffByEmail, deleteStaffUser } from "./fixtures/staff";

// ---------------------------------------------------------------------------
// EMPLOYEES ADMIN CRUD (S-08, plan Phase 4) — the rendered admin roster:
//   1. add employee → a DODANY row appears and nothing is sent
//   2. send the invitation → DODANY becomes ZAPROSZONY and the link works
//   3. remove via typed-email confirmation → the row disappears
//   4. the admin's own remove ✕ is disabled (can't remove yourself)
//   5. a last-admin refusal surfaces the refusal modal
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

const SEED_ADMIN_EMAIL = "admin@fleetrent.test";

test("admin adds an employee → a DODANY row appears, and the row's only action is to invite", async ({ page }) => {
  // The two-step add (invite-journey-fixes phase 8): step 1 creates the account
  // and sends nothing, so the roster's third state has to exist and the row must
  // offer `Wyślij zaproszenie` — NOT `Resetuj hasło`, which would send a
  // recovery link to someone who has never had a password.
  const email = `e2e-add-${Date.now()}-${Math.floor(Math.random() * 1e6)}@fleetrent.test`;
  try {
    await page.goto("/dashboard/staff");
    await waitForIslands(page);

    await page.getByRole("button", { name: "Dodaj pracownika" }).click();
    await fillHydrated(page.getByLabel("IMIĘ I NAZWISKO"), "Nowy Pracownik");
    await fillHydrated(page.getByLabel("ADRES E-MAIL"), email);
    // The modal's CTA stopped promising an email when the add stopped sending one.
    await page.getByRole("button", { name: "Dodaj", exact: true }).click();

    const row = page.getByRole("row", { name: new RegExp(email, "i") });
    await expect(row).toBeVisible();
    await expect(row.getByText("DODANY")).toBeVisible();
    // The first-send wording — a DODANY row has had nothing sent for it yet.
    await expect(row.getByRole("button", { name: "Wyślij zaproszenie", exact: true })).toBeVisible();
    await expect(row.getByRole("button", { name: "Resetuj hasło" })).toHaveCount(0);
  } finally {
    await deleteStaffByEmail(email);
  }
});

test("admin sends the invitation → the row becomes ZAPROSZONY and the emailed link still activates the account", async ({
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

    await page.getByRole("button", { name: "Dodaj pracownika" }).click();
    await fillHydrated(page.getByLabel("IMIĘ I NAZWISKO"), "Robert Zieliński");
    await fillHydrated(page.getByLabel("ADRES E-MAIL"), email);
    await page.getByRole("button", { name: "Dodaj", exact: true }).click();

    const row = page.getByRole("row", { name: new RegExp(email, "i") });
    await expect(row.getByText("DODANY")).toBeVisible();

    // Step 2: the explicit send.
    await row.getByRole("button", { name: "Wyślij zaproszenie", exact: true }).click();
    await expect(page.getByText("Wysłano zaproszenie.")).toBeVisible();
    await expect(row.getByText("ZAPROSZONY")).toBeVisible();
    // The action re-labels itself once something HAS been sent, so the row never
    // invites a second send in wording that implies a first one.
    await expect(row.getByRole("button", { name: "Wyślij ponownie zaproszenie" })).toBeVisible();
    await expect(row.getByRole("button", { name: "Wyślij zaproszenie", exact: true })).toHaveCount(0);

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
      await expect(hirePage.getByRole("heading", { name: "Ustaw hasło" })).toBeVisible();
      await expect(hirePage.getByText("Witaj we Flocie")).toBeVisible();
      // The account box names the hire the admin typed, by their initials.
      await expect(hirePage.getByText("RZ", { exact: true })).toBeVisible();

      await fillHydrated(hirePage.getByRole("textbox", { name: "Nowe hasło" }), password);
      await fillHydrated(hirePage.getByRole("textbox", { name: "Potwierdź hasło" }), password);
      await hirePage.getByRole("button", { name: "Aktywuj konto" }).click();
      await hirePage.waitForURL(/\/auth\/reset-password\?done=1/);

      // The assertion of record: the password they just set signs them in.
      await hirePage.goto("/auth/signin");
      await waitForIslands(hirePage);
      await fillHydrated(hirePage.getByRole("textbox", { name: "E-mail służbowy" }), email);
      await fillHydrated(hirePage.getByRole("textbox", { name: "Hasło" }), password);
      await hirePage.getByRole("button", { name: "Zaloguj się" }).click();
      await hirePage.waitForURL("/dashboard");
      await expect(hirePage.getByRole("button", { name: "Wyloguj" })).toBeVisible();
    } finally {
      await hire.close();
    }

    // And the roster now reports them as someone who can sign in, so the row's
    // action flips to the one that suits a person WITH a password.
    await page.reload();
    await waitForIslands(page);
    await expect(row.getByText("AKTYWNY")).toBeVisible();
    await expect(row.getByRole("button", { name: "Resetuj hasło" })).toBeVisible();
    await expect(row.getByRole("button", { name: "Wyślij zaproszenie", exact: true })).toHaveCount(0);
    await expect(row.getByRole("button", { name: "Wyślij ponownie zaproszenie" })).toHaveCount(0);
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
    await row.getByRole("button", { name: "Usuń pracownika" }).click();

    // Server re-checks the typed email; the confirm button unlocks only on a match.
    const confirm = page.getByRole("button", { name: "Usuń", exact: true });
    await expect(confirm).toBeDisabled();
    await fillHydrated(page.getByLabel("WPISZ E-MAIL, ABY POTWIERDZIĆ"), email);
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
  await expect(ownRow.getByText("· Ty")).toBeVisible();
  await expect(ownRow.getByRole("button", { name: "Usuń pracownika" })).toBeDisabled();
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
    await row.getByRole("button", { name: "Usuń pracownika" }).click();
    await fillHydrated(page.getByLabel("WPISZ E-MAIL, ABY POTWIERDZIĆ"), email);
    await page.getByRole("button", { name: "Usuń", exact: true }).click();

    await expect(page.getByText("Nie można usunąć ostatniego administratora")).toBeVisible();
    // The row is NOT removed — the refusal blocked it.
    await expect(row).toBeVisible();
  } finally {
    await page.unroute("**/api/staff/*/deactivate");
    await deleteStaffUser(id);
  }
});
