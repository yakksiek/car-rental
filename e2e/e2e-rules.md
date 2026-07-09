# E2E Testing Rules

Read this before writing or changing anything under `e2e/`. `seed.spec.ts` is the
worked exemplar — model new specs on it. The two together are the quality levers:
what the seed shows and these rules constrain is what a generator produces.

## The rules

- Use `getByRole`, `getByLabel`, `getByText` as primary locators. Fall back to
  `getByTestId` only when accessibility attributes are ambiguous.
- Never use CSS selectors, XPath, or DOM structure for locating elements.
- Each test must be independently runnable — no shared state between tests.
- Never use `page.waitForTimeout()`. Wait for specific conditions:
  `toBeVisible()`, `waitForURL()`, `waitForResponse()`.
- Assert the business outcome, not implementation details.
- Use unique identifiers (timestamp suffix) for test data to avoid collisions in
  parallel runs. Clean up in `afterEach`.
- Use `storageState` for authentication — never log in through the UI in
  individual tests. `e2e/auth.setup.ts` owns login; it is the only exception.
- The assertion must fail if the risk materializes. Control question for every
  assertion: _would this fail if the `test-plan.md` risk came true?_ If not, it
  is decorative. Prove it by deliberately breaking the production behavior and
  watching the test go red. Never commit the break.
- Name the test after the risk it protects, and cite that risk in a header
  comment. Not `test('test 1', ...)`.

## Project-specific rules

These are not generic advice — each one cost us a red test or a false green.

- **Never assert on DOM classes or greying to prove availability.**
  `test-plan.md` names this as risk #6's anti-pattern ("snapshot-without-meaning
  on the calendar; asserting rendered DOM over the derivation logic"). Assert on
  what the user can _do_: is the day button `disabled`, does the accessible name
  carry the changeover suffix, does the booking complete. `BookingWidget` exposes
  all three through the accessibility tree on purpose.

- **Wait for island hydration before touching an island.** Astro server-renders
  `client:*` islands, so their markup is present and fully inert before React
  mounts: `fill()` writes a value the hydrating re-render discards, and `click()`
  hits a button with no handler. Call `waitForIslands(page)` from
  `e2e/support/hydration.ts` first. It watches Astro's own `astro-island[ssr]`
  marker — the same mechanism Astro's E2E suite uses (`waitForHydrate`,
  withastro/astro#7084). Playwright's auto-waiting does **not** cover this:
  actionability means visible/stable/enabled, never "a handler is attached".
  Never substitute a sleep or `networkidle` (Playwright explicitly discourages
  the latter).

  Two traps here. Retrying `fill()` until `toHaveValue()` passes does **not**
  work on its own — pre-hydration nothing resets the DOM value, so the assertion
  passes vacuously and React wipes it a moment later. And a `client:visible`
  island below the fold never hydrates until scrolled into view, so a page-wide
  wait would hang; the app has none today.

  The structural fix Playwright's maintainers recommend is to render inputs
  `disabled` until hydrated, which would make both the test and a real user on a
  slow connection safe. Worth considering for `SignInForm` if this recurs.

- **Seed test data through the service-role client, never the UI.** Driving the
  public form to set up a booking would make every test depend on the funnel it
  isn't testing. `e2e/fixtures/booking.ts` inserts and deletes directly. This
  client bypasses RLS, so it is for setup/teardown only — never route an access
  assertion through it or a PII-leak test would pass falsely (the same invariant
  `tests/helpers/clients.ts` holds for the integration suite).

- **Chromium runs as `employee` by default** (`playwright.config.ts`). For a
  public/anonymous flow, opt out per file:
  `test.use({ storageState: { cookies: [], origins: [] } })`. For admin:
  `test.use({ storageState: "playwright/.auth/admin.json" })`. The default is the
  lowest role that clears the `/dashboard` gate, so a test that silently needs
  admin fails instead of passing by over-permission.

- **`/dashboard`'s `<h1>` is `md:hidden`.** Do not assert on it — it passes or
  fails by viewport. The "Wyloguj" button renders at every breakpoint.

- **The password input's accessible name is `"Hasło Pokaż hasło"`**, because
  `FormField` nests the toggle inside the `<label>`. Scope by role:
  `getByRole("textbox", { name: "Hasło" })`, not `getByLabel("Hasło")`.

## Real vs mocked

Internal boundaries — auth, routing, the database — stay **real**. That is where
integration risk hides, and it is the whole reason this layer exists. Mock only
expensive or non-deterministic **external** APIs at the network layer.

Nothing in the app calls an external API today. When S-05 lands transactional
email, mock it **where the server calls out** — `page.route()` intercepts the
browser, and the send happens server-side, so it will not fire.

## Choosing this layer at all

E2E is the slowest, most flake-prone layer. A risk earns a browser test only when
it crosses several system boundaries (auth → routing → API → DB) or exists only
in the rendered UI. If an isolated function or an integration test can prove it,
that test is better. Risks #1, #2, #4, and #5 in `test-plan.md` are each covered
by a named suite in `tests/integration/` — do not re-prove them here.
