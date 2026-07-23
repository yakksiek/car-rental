// core
import { test, expect } from "@playwright/test";

// others
import { fillHydrated, waitForIslands } from "./support/hydration";
import { createActiveEmployee, deleteStaffByEmail, deleteStaffUser } from "./fixtures/staff";

// ---------------------------------------------------------------------------
// EMPLOYEES ADMIN CRUD (S-08, plan Phase 4) — the rendered admin roster:
//   1. add employee → an INVITED row appears
//   2. remove via typed-email confirmation → the row disappears
//   3. the admin's own remove ✕ is disabled (can't remove yourself)
//   4. a last-admin refusal surfaces the refusal modal
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

test("admin adds an employee → an INVITED row appears in the roster", async ({ page }) => {
  const email = `e2e-add-${Date.now()}-${Math.floor(Math.random() * 1e6)}@fleetrent.test`;
  try {
    await page.goto("/dashboard/staff");
    await waitForIslands(page);

    await page.getByRole("button", { name: "Dodaj pracownika" }).click();
    await fillHydrated(page.getByLabel("IMIĘ I NAZWISKO"), "Nowy Pracownik");
    await fillHydrated(page.getByLabel("ADRES E-MAIL"), email);
    await page.getByRole("button", { name: "Wyślij zaproszenie" }).click();

    // The new row lands optimistically, INVITED (no sign-in yet).
    const row = page.getByRole("row", { name: new RegExp(email, "i") });
    await expect(row).toBeVisible();
    await expect(row.getByText("ZAPROSZONY")).toBeVisible();
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
