// core
import { test, expect } from "@playwright/test";

// others
import { createTodayPickup, deleteVehicle } from "./fixtures/booking";
import { LOCALE_COOKIE } from "../src/lib/i18n/resolve";

// ---------------------------------------------------------------------------
// POLISH SMOKE (english-localization, plan Phase 7 §3)
//
// Risk protected: Polish silently stops being a working locale.
//
// Why this spec has to exist at all. English is now the DEFAULT, so every other
// spec in `e2e/` runs against `en` and would stay green with the `pl` half of
// the catalog deleted, mis-wired, or never reached. The one thing that WOULD
// notice is a walk that asks for Polish — and asks for it across the seam, not
// inside one page: the cookie is read once per request in `src/middleware.ts`
// and then has to survive a navigation, a role gate, a `.astro` page reading
// `Astro.locals.t`, and a React island that cannot read `Astro.locals` at all
// and takes `locale` as a prop instead. Each of those is a separate way for the
// locale to be dropped, and every one of them fails silently by rendering
// English — which is a perfectly good-looking page.
//
// So the assertion of record is not "a Polish string exists somewhere". It is
// that the SAME cookie carries Polish through all four layers of the recruiter's
// route, in reverse — landing → the footer's staff-zone link → sign-in →
// Pulpit → an issue-protocol screen. `<html lang>` is asserted alongside, since
// a page can be fully translated and still tell assistive tech it is English.
//
// Signed in as the default `employee` identity rather than driving the sign-in
// form (`e2e-rules.md`: `auth.setup.ts` owns login). The public half of the walk
// renders identically either way — `SiteHeader` carries no account chrome and
// the footer link is unconditional — so the session costs the walk nothing and
// buys the cockpit half without a second context.
//
// The protocol screen is `client:only="react"`, so `waitForIslands` is NOT used
// there: with no server-rendered markup there is no `astro-island[ssr]` to clear
// and the helper would return before React ever mounted. These are read-only
// assertions, so Playwright's own retry on `toBeVisible()` is the correct wait —
// the hydration helper matters for INPUT, which this spec never does.
// ---------------------------------------------------------------------------

let cleanupVehicleId: string | undefined;

test.afterEach(async () => {
  if (cleanupVehicleId) {
    await deleteVehicle(cleanupVehicleId);
    cleanupVehicleId = undefined;
  }
});

test("the pl cookie carries Polish from the landing page through to an issue protocol", async ({
  page,
  context,
  baseURL,
}) => {
  const pickup = await createTodayPickup();
  cleanupVehicleId = pickup.vehicleId;

  // Seed the choice the way a returning visitor arrives with it — the cookie
  // `POST /api/locale` writes. Set SERVER-side rather than through the switcher
  // so this spec keeps proving the READ path even if the control moves.
  await context.addCookies([{ name: LOCALE_COOKIE, value: "pl", url: baseURL ?? "http://localhost:4321" }]);

  // ── 1. Landing ──────────────────────────────────────────────────────────
  await page.goto("/");
  expect(await page.evaluate(() => document.documentElement.lang)).toBe("pl");
  // The public header's nav, which is a different catalog namespace from the
  // brand deliberately spelled the same way (`Flota` the brand never translates;
  // `Flota` the nav item is `Fleet` in English).
  await expect(page.getByRole("link", { name: "Cennik" }).first()).toBeVisible();

  // ── 2. The footer's staff-zone link — the only route from the public site
  //      into the cockpit, and the reason this walk starts here.
  const staffZone = page.getByRole("link", { name: "Strefa pracownika" });
  await expect(staffZone).toBeVisible();
  await staffZone.click();

  // ── 3. Sign-in ──────────────────────────────────────────────────────────
  await page.waitForURL(/\/auth\/signin/);
  expect(await page.evaluate(() => document.documentElement.lang)).toBe("pl");
  await expect(page.getByRole("heading", { name: "Zaloguj się" })).toBeVisible();

  // ── 4. Pulpit ───────────────────────────────────────────────────────────
  // The `<h1>` here is `md:hidden` (`e2e-rules.md`), so the assertion goes to
  // the shell's title band, which renders at every width.
  await page.goto("/dashboard");
  expect(await page.evaluate(() => document.documentElement.lang)).toBe("pl");
  await expect(page.getByText("Oto Twój dzień w oddziale Warszawa")).toBeVisible();

  // ── 5. An issue-protocol screen ─────────────────────────────────────────
  // The deepest surface in the app and the one furthest from the cookie: a
  // `client:only` React island that never sees `Astro.locals` and is handed the
  // locale as a prop by the page.
  await page.goto(`/dashboard/pickups/${pickup.reservationId}`);
  await expect(page.getByRole("heading", { name: "Protokół wydania" })).toBeVisible();
  await expect(page.getByText("Stan techniczny")).toBeVisible();
});

test("the same cockpit reads English with no cookie — the Polish above is the cookie's doing", async ({ page }) => {
  // Not decoration. Without this control the spec above passes for the wrong
  // reason the moment anything pins the app to Polish — a flipped
  // `DEFAULT_LOCALE`, a stored `profiles.locale` left behind by a manual pass —
  // and a globally-Polish app looks exactly like a working cookie.
  await page.goto("/dashboard");
  expect(await page.evaluate(() => document.documentElement.lang)).toBe("en");
  await expect(page.getByText("Here’s your day at the Warsaw depot")).toBeVisible();
});
