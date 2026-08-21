// core
import { test, expect, type Locator } from "@playwright/test";

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

/**
 * Does this element actually receive the pixel at the middle of itself?
 *
 * `elementFromPoint` answers with whatever the compositor puts on top, so an
 * element buried under a fixed overlay fails here while passing `toBeVisible()`.
 * Children count — the error paragraph wraps an icon and a text node.
 */
async function isTopmostAtItsOwnCentre(locator: Locator): Promise<boolean> {
  return locator.evaluate((el) => {
    const box = el.getBoundingClientRect();
    const hit = document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2);
    return hit !== null && (hit === el || el.contains(hit));
  });
}

test("a dropped connection reports inside the add modal, on top of the overlay — not behind it", async ({ page }) => {
  // THE PHASE-9 DEFECT. `fetch` throws, the typed values are still perfectly
  // good, and this arm used to give the admin a blurred red smear behind a
  // dimmed backdrop — the most common failure reporting nothing readable.
  const email = `e2e-neterr-${Date.now()}-${Math.floor(Math.random() * 1e6)}@fleetrent.test`;
  await page.route("**/api/staff", (route) => route.abort());
  try {
    await page.goto("/dashboard/staff");
    await waitForIslands(page);

    await page.getByRole("button", { name: "Dodaj pracownika" }).click();
    await fillHydrated(page.getByLabel("IMIĘ I NAZWISKO"), "Nowy Pracownik");
    await fillHydrated(page.getByLabel("ADRES E-MAIL"), email);
    await page.getByRole("button", { name: "Dodaj", exact: true }).click();

    // Located by its copy, not by `role="alert"` — the layout's missing-config
    // banner is an alert too, so the role alone is ambiguous on this page.
    const error = page.getByText("Nie udało się utworzyć konta. Sprawdź połączenie i spróbuj ponownie.");
    await expect(error).toBeVisible();
    // Present is not the same as readable — this is the assertion that matters.
    expect(await isTopmostAtItsOwnCentre(error)).toBe(true);

    // The modal stayed open with the typed values intact, and its own submit is
    // the retry — so there is exactly one retry control on screen, not two.
    await expect(page.getByLabel("IMIĘ I NAZWISKO")).toHaveValue("Nowy Pracownik");
    await expect(page.getByLabel("ADRES E-MAIL")).toHaveValue(email);
    await expect(page.getByRole("button", { name: "Dodaj", exact: true })).toBeEnabled();
    await expect(page.getByRole("button", { name: "Ponów" })).toHaveCount(0);
  } finally {
    await page.unroute("**/api/staff");
  }
});

test("a provisioning failure reports inside the add modal, keeping the form the admin would retry in", async ({
  page,
}) => {
  // Phase 1 closed the modal here and made the banner's `Ponów` the retry. Phase
  // 8 stopped sending mail on create, so a failed create is fully retryable in
  // place with nothing delivered — and phase 7's `Spróbuj ponownie.` was an
  // instruction issued after the form had been taken away.
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

    await page.getByRole("button", { name: "Dodaj pracownika" }).click();
    await fillHydrated(page.getByLabel("IMIĘ I NAZWISKO"), "Nowy Pracownik");
    await fillHydrated(page.getByLabel("ADRES E-MAIL"), email);
    await page.getByRole("button", { name: "Dodaj", exact: true }).click();

    const error = page.getByText("Nie udało się utworzyć konta. Spróbuj ponownie.");
    await expect(error).toBeVisible();
    expect(await isTopmostAtItsOwnCentre(error)).toBe(true);

    await expect(page.getByLabel("ADRES E-MAIL")).toHaveValue(email);
    await expect(page.getByRole("button", { name: "Ponów" })).toHaveCount(0);
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
      body: JSON.stringify({ errors: { email: "Pracownik z tym adresem e-mail już istnieje." } }),
    }),
  );
  try {
    await page.goto("/dashboard/staff");
    await waitForIslands(page);

    await page.getByRole("button", { name: "Dodaj pracownika" }).click();
    await fillHydrated(page.getByLabel("IMIĘ I NAZWISKO"), "Nowy Pracownik");
    await fillHydrated(page.getByLabel("ADRES E-MAIL"), email);
    await page.getByRole("button", { name: "Dodaj", exact: true }).click();

    const dupError = page.getByText("Ten adres e-mail jest już w zespole.");
    await expect(dupError).toBeVisible();
    expect(await isTopmostAtItsOwnCentre(dupError)).toBe(true);
    // Field-level, not form-level: the form slot must stay empty. Both §9.4
    // strings share this lead clause, so one assertion covers the pair.
    await expect(page.getByText(/^Nie udało się utworzyć konta\./)).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Dodaj", exact: true })).toBeDisabled();
  } finally {
    await page.unroute("**/api/staff");
  }
});
