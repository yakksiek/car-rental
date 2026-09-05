<!-- IMPL-REVIEW-REPORT -->

# Implementation Review: English Localization

- **Plan**: `context/changes/english-localization/plan.md`
- **Scope**: Phases 1–8 of 8 (full plan)
- **Date**: 2026-09-04
- **Verdict**: NEEDS ATTENTION
- **Findings**: 8 warnings, 2 observations
- **Branch**: `feature/english-localization` — commits `7fe5b43` … `7c7e052` (9 commits, 254 files)

## Verdicts

| Dimension           | Verdict     |
| ------------------- | ----------- |
| Plan Adherence      | WARNING (3) |
| Scope Discipline    | PASS        |
| Safety & Quality    | WARNING (4) |
| Architecture        | PASS        |
| Pattern Consistency | WARNING (2) |
| Success Criteria    | PASS        |

**Overall: NEEDS ATTENTION.**

Nothing here blocks the branch on its own. Eight warnings and two observations, all with small,
known fixes. They are carried into the plan as Phases 9 to 13.

**Severity correction on F1.** The first draft of this report called F1 critical. That was based on
one confirmed exploit path plus an assumption that the other two behaved the same way. I then tested
all three. They do not. Only the back-link path actually navigates off-site. The two header paths
either fail to navigate or return a 500. F1 is a warning.

---

## Automated verification

I re-ran every automated check the plan lists. All pass.

| Check                                                    | Result                                   |
| -------------------------------------------------------- | ---------------------------------------- |
| `npx astro check`                                        | 0 errors, 0 warnings, 8 hints            |
| `npm run lint`                                           | 0 errors, 2 warnings (both pre-existing) |
| `npm test` (unit)                                        | 576 passed, 41 files                     |
| `npm run test:integration`                               | 327 passed, 26 files                     |
| `npm run build`                                          | succeeds                                 |
| `npm run test:e2e`                                       | 31 passed, 0 failed (see note below)     |
| `grep -rn "date-fns/locale" src/`                        | clean                                    |
| `grep -rn "pluralPl\|plForm\|MONTHS_PL\|PL_MONTHS" src/` | one hit, and it is a comment             |
| `grep -rn "HeaderContactToggle" src/`                    | clean                                    |
| `grep -rn "FleetRent" src/ public/`                      | clean                                    |
| `npx supabase migration list --linked`                   | both new migrations are on production    |

I did not run `npx supabase db reset`. It is destructive. It would drop a sibling worktree's
migrations from the shared local stack. The migrations are proven applied anyway: 327 integration
tests pass against them, and production lists both.

### Note: the E2E suite failed once, then passed

The first run came back 30 of 31. The new Polish smoke test failed on a blank protocol screen.

That was not a code problem. The dev server had been running for a while. Its Vite dependency cache
had gone stale. The browser was getting a 404 for
`node_modules/.vite/deps/react-hook-form.js?v=a13cb4d8`. The React island never loaded, so the page
stayed empty.

I confirmed it was not a language bug by loading the same page in English. It was blank too.

I cleared `node_modules/.vite` and restarted the dev server. All 31 tests then passed.

**The dev server on port 4321 is now a process I started.** Kill it and restart it however you
prefer.

### Note: island bundle sizes

The plan wanted proof that no React island pulled in the full translation catalog. The clearest
signal held.

`format.js` is the shared chunk that 11 islands import. It got **smaller**: 1406 bytes down to 1099.
Nothing reached the combined catalog.

| chunk                 | before (bytes) | after (bytes) | change |
| --------------------- | -------------: | ------------: | ------ |
| `format`              |          1 406 |         1 099 | −22%   |
| `BookingWidget`       |          7 857 |         7 290 | −7%    |
| `FleetList`           |         10 876 |        10 554 | −3%    |
| `HeroSearch`          |          3 777 |         3 838 | +2%    |
| `PendingQueue`        |         19 363 |        16 586 | −14%   |
| `ReservationCalendar` |        338 251 |       338 130 | −0.04% |
| `ReservationForm`     |         15 083 |        14 696 | −3%    |
| `VehicleForm`         |         11 742 |        11 222 | −4%    |
| `GlobalSearch`        |         28 312 |        29 354 | +3.7%  |
| `StaffList`           |         24 550 |        28 771 | +17%   |

Two islands grew. `StaffList` gained 1.3 KB gzipped. That is expected. Each island now carries both
languages for its own section of the catalog. That is the trade the design chose. It is not a leak.

---

## Findings

### F1 — The redirect guards let control characters through

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — the fix is small and obvious
- **Dimension**: Safety & Quality
- **Location**: `src/lib/safe-redirect.ts:19,57`

**What is wrong**

The app has two functions that check whether a redirect target is safe. Both look at the first two
characters. They reject `//` and `/\`. They do not reject a tab, a newline, or a carriage return.

Browsers throw those characters away when they parse a URL. That is in the URL spec. So a path like
`/<tab>/evil.com` becomes `//evil.com`. And `//evil.com` means `http://evil.com/`.

I ran the shipped functions directly. All four of these pass through unchanged:

```
safeRedirectPath("/\t/evil.com")  →  "/\t/evil.com"
safeInternalPath("/\t/evil.com")  →  "/\t/evil.com"
safeInternalPath("/\n/evil.com")  →  "/\n/evil.com"
safeInternalPath("/\r/evil.com")  →  "/\r/evil.com"
```

**Where it bites, tested per call site**

There are three consumers. They do not behave the same way. I tested each one against the running
app.

**1. The back link on protocol pages. This one works.**

I signed in as an employee and opened `/dashboard/pickups/<id>?from=/%09/evil.com`. The page rendered
a back link. The browser resolved it like this:

```
href="/\t/evil.com"   resolves to   http://evil.com/
```

The chain is short. `resolveBackTarget` (`src/lib/back-target.ts:53`) reads the `from` query
parameter. `URLSearchParams` decodes `%09` into a real tab. The guard returns the value unchanged.
The page prints it as an `<a href>`. HTML attributes go through the URL parser, which strips the tab
and leaves `//evil.com`.

Three pages do this: `pickups/[reservationId].astro:38`, `returns/[reservationId].astro:35`,
`protocols/[id].astro:55`.

**2. The post-login redirect. The header goes out, the browser refuses it.**

I did a real sign-in with `?redirect=/%09/evil.com`. The hidden field carried the tab. The POST
answered `Location: /<tab>/evil.com`. Chromium did not follow it. The navigation dead-ended on
`/api/auth/signin`.

A raw tab is not legal in an HTTP header value, so the browser rejects the redirect instead of
parsing it.

**3. The language switch. This is the new code, and the least reachable of the three.**

I posted crafted values to `/api/locale` from a same-origin page:

| redirect value           | result                           |
| ------------------------ | -------------------------------- |
| `/<tab>/evil.com`        | 303, browser treats it as opaque |
| `/<newline>/evil.com`    | 500                              |
| `/ok\r\nX-Injected: yes` | 500                              |

The newline cases return 500 because the runtime refuses to build a header containing a control
character. There is no response splitting here. It fails closed.

The endpoint also checks the request origin at `src/pages/api/locale.ts:50`, so a form on another
site gets a 403. And the app fills the field on the server from
`Astro.url.pathname + Astro.url.search`, which percent-encodes tabs.

**What this change did and did not do**

The live bug is in `safeRedirectPath`. This branch never touched that function.

The new function is `safeInternalPath`. This branch added it in Phase 1. It has the same hole, and it
is not exploitable today.

The plan wrote the rules for that new guard: must start with `/`, reject `//` and `/\`. That list was
incomplete, so the gap got carried into fresh code.

The existing test file only covers absolute URLs, protocol-relative paths, and the backslash form.

**Fix**

Reject or strip characters in the range `\x00-\x1F` and `\x7F` in both functions. Add tab, newline,
and carriage return cases to `src/lib/safe-redirect.test.ts`.

- Strength: two lines. Closes the live bug and the new one at the same time.
- Tradeoff: none. No real internal path has a control character in it.
- Confidence: HIGH. I reproduced the exploit against the running app.
- Blind spot: none significant.

**Decision**: PENDING

---

### F2 — Polish customers land on an English status page

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — there is a real choice to make here
- **Dimension**: Plan Adherence
- **Location**: `src/pages/r/[token].astro:21`

**What is wrong**

Walk through what a Polish customer sees.

1. They book a car on the Polish site.
2. They get a confirmation email in Polish.
3. That email has a link to check their booking status.
4. They click it. They arrive with no cookie set.
5. The page shows English.

The page reads the language from `Astro.locals.t`. That is the visitor's session. It should read the
language from the reservation.

Before this change the page was always Polish. So for Polish customers this is a step backwards.

**Why it happened**

The reservation's language is not available on this page. The database function
`get_reservation_status` does not return it. The second migration added the language column to five
read functions. This one was not among them.

The plan said customer emails and PDFs follow the reservation's language. It never named the status
page. So this is a gap in the plan, not a mistake in the code.

It is also not written down in `known-issues.md`.

**Fix A ⭐ Recommended**: add `r.locale` to `get_reservation_status` and read the page's language
from it.

- Strength: the second migration already did this exact thing five times. Same pattern, same file.
- Tradeoff: a sixth function rewrite and another migration to push to production.
- Confidence: HIGH. Same problem, same proven solution.
- Blind spot: I did not check whether other parts of the page read the session language. The header
  and footer probably should keep following the visitor.

**Fix B**: write the gap into `known-issues.md` and leave the code alone.

- Strength: no schema change. The page gets little traffic.
- Tradeoff: the change's main promise stays broken on its only public customer page.
- Confidence: MEDIUM. Only sensible if you treat the status page as chrome, not as a document.
- Blind spot: the language switcher is on this page, so a customer can fix it themselves.

**Decision**: PENDING

---

### F3 — A missing language value silently becomes English, and the PDF keeps it forever

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — the fix is small and obvious
- **Dimension**: Safety & Quality
- **Location**: `src/pages/dashboard/pickups/[reservationId].astro:71`,
  `src/pages/dashboard/returns/[reservationId].astro:70`

**What is wrong**

The page reads the customer's language off a database row:

```ts
documentLocale: asLocale(row.locale);
```

`asLocale` returns English whenever the value is missing. It does not complain.

Now think about a deploy. In this project, merging to main deploys the Worker. It does not push
migrations. So there is a window where the new code is live and the old database is still in place.

In that window the database function returns no language column. Every issue and return PDF renders
in English. The protocol row gets stamped `'en'`.

Issued PDFs are never regenerated. That is a rule the plan states. So the wrong stamp is permanent.

This deploy went out in the right order. Both migrations are on production. Nothing is broken today.
The problem is the shape of the code: a missing value should be loud, not quiet.

**Fix**

Make the missing case fail. Throw, or refuse to render the protocol form, when `row.locale` is
absent. A lagging migration then shows up as an obvious 500 instead of a silent permanent mistake.

**Decision**: PENDING

---

### F4 — Three database functions were rebuilt but never added to the permission test

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — the fix is small and obvious
- **Dimension**: Safety & Quality
- **Location**: `tests/integration/rpc-execute-grants.test.ts`

**What is wrong**

The second migration drops five database functions and creates them again. Dropping a function throws
away its permissions.

This project has a test suite whose whole job is to catch that. This change added three functions to
it: `create_protocol`, `create_return_protocol`, and `set_profile_locale`.

Three were left out:

- `list_dispatch_today`
- `get_return_baseline`
- `get_protocol`

All three return customer personal data. Names, emails, signatures, damage notes.

I checked the migration. It does re-apply the permissions correctly on all three, at lines 376, 464,
and 589. So nothing is open right now. There is also a role check inside each function as a second
layer.

The gap is in the test, not the code. If someone rewrites one of these functions later and forgets
the permission line, nothing will fail.

**Fix**

Add the three functions to the "anon is refused" block, next to the ones this change already added.

**Decision**: PENDING

---

### F5 — A reference doc says something that is not true

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — the fix is small and obvious
- **Dimension**: Plan Adherence
- **Location**: `docs/reference/contract-surfaces.md:94-99`

**What is wrong**

Two functions in `src/lib/services/vehicles.ts` gained a language parameter on this branch:

```ts
export function reduceCategoryPricing(vehicles, locale: Locale); // line 157
export async function getCategoryPricing(client, locale: Locale); // line 197
```

The doc has a table listing every export that gained a language parameter. Neither of these is in it.

Then the doc says the opposite:

> `getCategoryPricing` already took a locale

That is wrong. On main the signature is `getCategoryPricing(client: CatalogClient | null)`. I checked
with `git show f8e4a8e`. There is no locale.

So the doc has a false statement, and that statement is covering for the two missing rows.

Both functions changed in commit `d146e49`. The commit message does not mention the doc. The plan
said to update the doc in the same commit. That step was missed.

**Two smaller staleness items, same family**

`plan.md` section 5.5 still says `protocol-labels.ts` gains a language parameter. The file was
deleted instead. Its labels moved into `src/lib/i18n/protocol.ts`.

The same section says `useProtocolMedia.ts:228` throws a message a user can see. It does not. The
caller catches it and shows a translated overlay instead.

Both of those were correct decisions made during implementation. Only the code records them.

**Fix**

Add both exports to the table. Delete the false sentence.

**Decision**: PENDING

---

### F6 — A customer's name can break their own email

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — the fix is small and obvious
- **Dimension**: Safety & Quality
- **Location**: `src/lib/email/templates.ts:280,374`

**What is wrong**

The email templates now build the greeting like this:

```ts
const greeting = t("greeting").replace("{name}", params.customerName);
```

JavaScript treats some characters in a replacement string as special. `$&`, `` $` ``, `$'`, and `$1`
all mean something to `replace`. They are not inserted literally.

The customer types their own name into the public booking form. Nobody checks it for those
characters.

I tested it:

```
"Firma $` SA"    →  "Dzień dobry Firma Dzień dobry  SA,"
"Anna $& Co"     →  "Dzień dobry Anna {name} Co,"
"O'Brien $' Ltd" →  "Dzień dobry O'Brien , Ltd,"
```

In the first case the email's own opening words get pasted into the middle of the customer's name.

This pattern appears 24 times across `src/`. The other places pass controlled values: reference
numbers, counts, enum labels. Only these two take free text.

**A separate, older issue on the same lines**

The HTML version of the email drops `customerName` into markup with no escaping. That is not new.
Commit `f8e4a8e` had the same shape at lines 244 and 336. There is no `escapeHtml` helper anywhere
in `src/lib/email/`. The impact is limited, because the email only goes to the person who typed the
name.

**Fix**

Pass a function instead of a string:

```ts
.replace("{name}", () => params.customerName)
```

A function replacement inserts the value literally. It costs nothing, so it is worth doing at all 24
sites.

**Decision**: PENDING

---

### F7 — A two-language text table sits outside the folder the parity test checks

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — the fix is small and obvious
- **Dimension**: Pattern Consistency
- **Location**: `src/lib/staff-report.ts:162`

**What is wrong**

`staff-report.ts` has an 11-key table with English and Polish text in it. It lives outside
`src/lib/i18n/`.

The parity test walks the `i18n` folder only. It checks two things: that both languages have the same
keys, and that no Polish text is hiding in the English half. It cannot see this table.

The test for this file only checks Polish. Line 28 reads `const LOCALE: Locale = "pl"`.

`auth-messages.ts` does the same thing. But it explains why in a comment at lines 25 to 30, and its
test covers both languages. `staff-report.ts` does neither.

**Fix**

Move the table into a catalog namespace, or add a both-languages case to its test.

**Decision**: PENDING

---

### F8 — Three small misses against the design contract

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — the fix is small and obvious
- **Dimension**: Pattern Consistency
- **Location**: `src/components/header/ActionMenu.tsx:121-124`,
  `src/components/SiteHeader.astro:96`, `src/components/header/LangToggle.tsx:91-97`

**What is wrong**

The header geometry is otherwise exact. No guessed pixel values. No invented dimensions. No raw
colours where a token exists. Three things did slip.

**1. The ActionMenu panel sits at the wrong stacking level.**
The contract marks `z-index: 60` as exact. The shipped `PopoverContent` sets no `z-` class at all, so
it inherits `z-50` from `src/components/ui/popover.tsx:27`. Nothing looks wrong today. The landing
header wrapper is `z-40`, so the panel still sits above it.

**2. The phone link can wrap.**
The contract marks `white-space: nowrap` as exact. The shipped class list is
`"info-phone text-foreground items-center gap-2 text-[14.5px] font-bold"`. There is no
`whitespace-nowrap`. The CTA two lines below does have it.

This matters because `known-issues.md:352-354` names that exact attribute as one of four causes of
the old nav-wrap bug at 768 to 790 pixels. It is harmless right now only because all three children
of the bar are `shrink-0`, so the row overflows instead of squeezing.

**3. Two controls have no hover state.**
The contract, section 2 item 5, says we author both hover and focus for `LangToggle` and
`ActionMenu`. Only focus shipped. `LangToggle` even carries `transition-colors` with nothing to
transition. Every other interactive thing in the header has a hover state.

**What did work**

The two header bugs Phase 3 set out to kill are genuinely gone, and gone by design rather than by
patch.

The bar now has `gap-5`, all children are `shrink-0`, and every nav item has `whitespace-nowrap`. The
old wrap cannot happen.

The landing collapse was really ported. `LandingNav.astro` lines 112, 132, and 136 use
`@min-[1208px]` guards, with the language toggle sitting outside them. The phone was not simply moved
to a lower breakpoint, which the plan forbade.

Container queries compile correctly. There is no bare `@[Npx]:` class anywhere in `src/`, which would
have emitted no CSS at all.

**Fix**

Add `z-[60]` to the `PopoverContent`. Add `whitespace-nowrap` to the phone anchor. Add a hover state
to both controls.

**Decision**: PENDING

---

### F9 — The Polish-leftover scanner does not gate anything

- **Severity**: 🔵 OBSERVATION
- **Impact**: 🏃 LOW — the fix is small and obvious
- **Dimension**: Success Criteria
- **Location**: `scripts/i18n-sweep.mjs`, `package.json:16`

**What is wrong**

The script's own header says it exits with code 1 on any hit, so it can gate CI.

It is not in `.github/workflows/ci.yml`. It is not in `.husky/pre-commit`. Only the npm script exists.

So plan criteria 5.6 and 6.15 are manual checks. Nobody has to run them.

That is a shame, because the script is good. It does not just grep for accented letters. It builds a
vocabulary of about 1170 Polish words by taking every word in the catalog's Polish half and
subtracting every word in the English half. Then it pulls out actual copy, skipping class lists,
addresses, and import paths. Accented letters are a second, separate check.

It caught a real case the plan predicted. The phrase `+ 3 000 kaucji` survived a clean sweep, because
the catalog only holds `kaucja` and `kaucją`. That is written up in the script at lines 150 to 156.

**Fix**

Add `npm run sweep:i18n -- --all` to the CI lint job.

**Decision**: PENDING

---

### F10 — A Phase 1 step actually landed in Phase 4

- **Severity**: 🔵 OBSERVATION
- **Impact**: 🏃 LOW — the fix is small and obvious
- **Dimension**: Plan Adherence
- **Location**: `src/lib/i18n/vehicle.ts`, `src/lib/i18n/reservation.ts`

**What is wrong**

The plan put five label functions moving out of `src/lib/format.ts` in Phase 1. That move was the
thing that stopped islands from reaching the full catalog.

Both new files were created in commit `d146e49`, which is Phase 4. Phase 1's commit never touched
`format.ts` at all.

No harm came of it. Nothing imported the combined catalog in between. The guardrail works now, and
the bundle measurements prove it.

It was just three phases later than planned.

**Fix**

Nothing to change in code. Worth noting if phase ordering matters for future plans.

**Decision**: PENDING

---

## What held up

I ran two separate audits over all 8 phases. Neither found a missing planned item. Neither found drift
that was not explained in the code.

Here is what I checked rather than assumed.

**Phase 1.** The two-accessor split is real. `translator(locale, ns)` lives in `types.ts` and imports
no namespaces. The combined `useTranslations` lives in `index.ts`. No `.tsx` file in `src/` imports
the combined version. Only `middleware.ts` and `api/locale.ts` do. `format.ts` imports `Locale` as a
type only, so the catalog cannot reach the 11 islands that use it.

The demo carve-out is in place at `resolve.ts:52`. Three files carry comments pointing at each other,
so nobody removes one half by accident. A test pins the behaviour.

Locale resolution runs before the access gate and cannot throw. The new redirect guard falls back to
`/` and allows `/auth/*`. The old guard's `/auth` refusal is byte-identical to main.

**Phase 2.** Every hand-written Polish table is gone. One plural helper covers both languages. Money
is composed by hand with `useGrouping: "always"`, never `style: "currency"`. All four number
groupers now go through one function. The odometer field still reads its own output. The two
`\s*zł$` regex strippers were replaced properly. The live plural bug is fixed. The lesson in
`lessons.md` was corrected.

**Phase 3.** `HeaderContactToggle` is deleted with no references left. `LangToggle` is a real POST
form with a pending state. The reflow uses genuine container queries.

**Phase 4.** The full staff nav is translated. The brand-versus-nav collision is handled in both
halves of `StaffShell.astro`. Line 157 is the literal word `Flota` as a brand. Line 136 is a lookup
that returns "Fleet". They live in different namespaces on purpose. Two seeded vehicles were kept in
Polish, each with a comment saying why.

**Phase 5.** All four schemas became factories. The phone regex and the tax-ID length are
byte-identical to main. No component duplicates a validation rule.

I checked the API gate order properly. I pulled the ordered sequence of gate tokens out of every
route at main and at HEAD, then diffed them. All 19 modified routes are identical.

`slug.ts` was left alone, as instructed.

**Phase 6.** All nine functions across both migrations revoke before they grant.

The second migration claims the five rebuilt function bodies are unchanged apart from one column. I
verified that. I diffed each one against its most recent previous definition. The role checks,
`security definer`, `search_path`, volatility, guard clauses, and WHERE conditions are all
byte-identical.

`get_protocol` correctly reads the protocol's own language, not the reservation's. That matters,
because an issued PDF is never re-rendered.

Font embedding does not branch on language. Resending a protocol re-signs the stored file and never
regenerates it. The invite and recovery links are byte-identical. Manual booking defaults to Polish,
written literally.

**Phase 7.** `/terms` has a loud placeholder banner and a sample tag on every section. The terms
version and language are stamped server-side. A crafted value in the request body is ignored, and a
test proves it.

The parity test finds namespaces automatically. It also guards against finding too few.

**Phase 8.** The commit touches one component and the plan. No new catalog keys. The submit gate is
unchanged.

**Scope.** All nine "What We're NOT Doing" rules hold. I checked each one. No `i18n` block in
`astro.config.mjs`. No `Accept-Language` header read anywhere. `protocol-delta.ts` untouched. No
`name_en`-style columns. No `generateLink` rework.

Extra work did land: a second migration, language stamps in the seed file, an ESLint block, an npm
script, and a `known-issues.md` update. Each is explained in its commit. None crosses a stated
boundary.

**E2E hygiene.** No `page.waitForTimeout()` anywhere. No `getByTestId` anywhere. The Polish smoke
test cleans up after itself, uses unique ids, and ships a control test that proves the same page
reads English without the cookie.

---

## Smaller notes

These did not become findings.

`src/pages/api/reservations.ts:140` passes the session language into the confirmation email. Phase 6
said never to do that. Here it is the same value: line 112 of the same request writes that language
onto the reservation. Lines 94 to 109 explain the reasoning. It is correct.

`src/components/ui/calendar.tsx:67` still uses `date.toLocaleString("default", …)`. It is dead code
today, because the caption layout defaults to labels. It would cause a hydration mismatch if dropdown
captions are ever turned on.

`e2e/quick-actions.spec.ts:64` uses `picker.locator("option")`. That is a CSS selector, which
`e2e-rules.md:10` forbids. It is pre-existing. Only the labels around it were changed.

`e2e/fleet-admin.spec.ts:150` still asserts a Polish string. That is fine. Line 123 is a stub that
injects that exact string, so the test is self-consistent.

`src/pages/api/reservations/[id].ts:114` answers 403 instead of 401 for a signed-out caller.
Pre-existing.

`src/components/SiteHeader.astro:32` reports an unused `Props` interface. That is Astro's normal
convention, not dead code.
