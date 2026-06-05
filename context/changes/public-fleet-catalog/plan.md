# Public Fleet Catalog (S-01) Implementation Plan

## Overview

Build the first public, user-visible surface of FleetRent: a marketing landing page, a filterable fleet listing, and a vehicle detail card — all server-rendered (Astro SSR) off F-01's `vehicles` schema. Visitors browse by category, filter by payload and an available-date range, sort by price, and open a detail card with full specs and pricing. Date-range availability is computed through a PII-safe `SECURITY DEFINER` Postgres RPC that mirrors F-01's no-overlap rule, because the public (`anon`) role cannot read `reservations`. The detail card ends in a "Zarezerwuj" CTA that hands the selected vehicle + dates to the S-02 reservation funnel (built next).

## Current State Analysis

- **F-01 schema is live and public-readable.** `vehicles` has full specs + pricing; RLS exposes it as `SELECT to anon, authenticated using (is_active = true)`. `reservations` denies `anon` entirely (no anon policy) and carries customer PII. The no-double-booking rule is a generated `reserved_period tsrange(pickup+14:00, return+10:00, '[)')` + an `EXCLUDE` constraint (migration `20260603155136`).
- **The pure overlap predicate exists** at `src/lib/availability.ts:56` (`hasConflict`/`windowsOverlap`/`bookingWindow`) — the TS twin of the SQL rule, already unit-tested. It needs the existing reservations as input, which `anon` can't fetch — hence the RPC (see Key Discoveries).
- **A `SECURITY DEFINER` precedent exists.** `current_app_role()` (migration `20260604153139`) is `language sql … stable security definer set search_path = ''` with schema-qualified names. The availability RPC follows this exact style.
- **Supabase client is per-request, cookie-based.** `createClient(headers, cookies)` (`src/lib/supabase.ts:7`) returns `null` when unconfigured. Middleware (`src/middleware.ts:6`) builds one per request but does **not** expose it on `locals`; pages currently have no data-fetch precedent (`dashboard.astro` only reads `locals`).
- **Money deserializes as string.** `numeric(10,2)` columns come back as `string` in supabase-js despite the generated `number` type (`src/types.ts:11`) — the formatter must own parsing.
- **Design is specified.** `context/foundation/design-system.md` maps S-01 to screenshots 01/02/03 (mobile) + 07/08 (desktop). Live tokens ship in `src/styles/global.css` (crimson `--primary`, status `bg-success`/`bg-warning`, Inter/Instrument Serif). Polish copy is canonical. **Two design↔data gaps resolved in this plan:** the prototype shows `Seats`/`Transmission` (absent from schema → added in Phase 1), and the home screen (01) is a logged-in-customer view with greeting + deposit (impossible in v1 → replaced by a public landing).
- **UI scaffold is thin.** `src/components/ui/` has only `button.tsx` + `LibBadge.astro`; no `src/lib/services/`; `/` still renders the starter `Welcome`. `photos[]` is empty in seed (storage is S-05).
- **Testing:** Vitest runs pure-function suites (`src/lib/*.test.ts`); no UI test runner, by decision none is added here.

## Desired End State

A visitor with no account can:

1. Land on `/` and see a public hero + category entry points + a few featured vehicles, then enter the catalog.
2. Browse `/fleet`, switch category tabs, set an available-date range + minimum payload, sort by price, and see only bookable active vehicles for that range (booked ones filtered out).
3. Open `/fleet/<id>/<slug>` and read full specs (seats, fuel, transmission, cargo L×W×H, year), all pricing (daily, monthly, deposit, per-extra-km, km limit), and an image/silhouette carousel.
4. Click "Zarezerwuj" and be carried — with the chosen vehicle + dates — toward the S-02 reservation route.

**Verification:** `supabase db reset` applies cleanly; `npm test` green (formatter + filter-param + availability-mapping suites); `npx astro check` + `npm run lint` clean; manual walk-through of the three screens against screenshots 02/03/08; the RPC returns active, non-overlapping vehicles for a date range, excludes a booked one, leaks no PII, and is executable as `anon`.

### Key Discoveries:

- **Availability must cross the RLS boundary via a definer RPC.** `anon` cannot read `reservations` even server-side (the SSR client runs as `anon` for a logged-out visitor). A `SECURITY DEFINER` function `available_vehicles(p_pickup, p_return) returns setof vehicles` runs the overlap check inside Postgres and returns only **vehicle** rows (no PII). It is the single home for the dated query.
- **One RPC + chainable filters.** PostgREST allows `.eq()/.gte()/.order()` on a function that `returns setof <table>`. So the dated path is `supabase.rpc('available_vehicles', {...}).eq('category', …).gte('payload_capacity_kg', …).order('daily_rate')`, and the no-date path is the identical chain on `.from('vehicles')`. Both yield `Vehicle[]` → one mapper, one card.
- **The RPC must re-apply `is_active` itself.** `SECURITY DEFINER` bypasses RLS, so the function body must filter `where v.is_active` and select only `vehicles` columns — otherwise it would leak inactive rows the public RLS hides.
- **Same rule, mirrored a third time — intentionally.** The overlap test exists in SQL (`EXCLUDE`), in TS (`availability.ts`, for S-02's client pre-check), and now in the RPC. All three use the identical half-open `[pickup 14:00, return 10:00)` window; the RPC reuses `tsrange(... '[)')` exactly as the generated column does, so they cannot drift.
- **Filter round-trips are batched, not per-field.** Server-side URL-param filtering (chosen) + a thin React island that commits to the URL only on an explicit "Zastosuj" → one navigation per deliberate apply. `astro:transitions` (persisting the filter bar) makes those SSR navigations feel instant without a React listing.

## What We're NOT Doing

- **No reservation form, submit, or overlap-block-on-submit** — that is S-02 (north star). S-01 ends at a "Zarezerwuj" CTA that links out with the vehicle + dates; the `/reserve` destination is S-02's deliverable.
- **No employee/admin or auth-gated surfaces** — the catalog is fully public; no changes to `PROTECTED_ROUTES`.
- **No file/object storage or photo upload** — silhouette placeholders render when `photos[]` is empty; storage is S-05.
- **No fleet CRUD** (add/edit/remove vehicles) — that is S-04; this slice is read-only over `vehicles`.
- **No real-time availability while typing dates (FR-014)** — parked nice-to-have; availability resolves on apply, server-side.
- **No new auth/PII exposure** — the RPC returns vehicle rows only; `reservations` RLS is untouched.
- **No UI test runner (Playwright/Testing Library)** — Vitest covers pure logic; UI is verified manually.
- **No English copy** — Polish only (PRD §Non-Goals); EN prototype strings are reference.
- **No multi-key sort, no fuel/transmission filter controls** — only category + dates + payload filters and a price sort ship (FR-002 surface). Seats/transmission are displayed, not filterable.

## Implementation Approach

Bottom-up: extend the data model and stand up the availability RPC first (Phase 1), wrap all data access + pure formatting/validation in a tested domain layer (Phase 2), then build the two server-rendered surfaces — landing + listing (Phase 3) and detail (Phase 4) — against the live design tokens. React appears only as a thin filter island; everything else is Astro. Each phase is independently verifiable; the UI phases consume the Phase 2 layer so queries and formatting live in one place.

## Critical Implementation Details

- **RPC definer hygiene (load-bearing).** `available_vehicles` must be `security definer set search_path = ''` with every name schema-qualified (`public.vehicles`, `public.reservations`), filter `where v.is_active`, return `setof public.vehicles` (no `reservations` columns), and `grant execute … to anon, authenticated`. Omitting the `is_active` filter or returning a joined shape would leak data the public RLS hides.
- **Window must match the generated column byte-for-byte.** The RPC's overlap test uses `tsrange(p_pickup + time '14:00', p_return + time '10:00', '[)') && r.reserved_period`. Any deviation (inclusive bound, different hours) silently diverges from the `EXCLUDE` constraint and the TS predicate.
- **Date validation is the named design point.** Reject `return_date < pickup_date` and past pickups before calling the RPC; surface inline (Polish). The picker's semantics (return 10:00 / pickup 14:00, same-day turnover allowed) must agree with the predicate — reuse `src/lib/availability.ts` semantics in the validator so the three enforcement points stay aligned.
- **Money is a string at runtime.** The formatter parses `string | number` defensively; never `toFixed` a raw column value assuming `number`.

## Phase 1: Schema Extension, Availability RPC, Seed & Types

### Overview

Add the two display specs the design needs (`seats`, `transmission`), create the PII-safe availability RPC, refresh the seed, and regenerate types — the data foundation the UI consumes.

### Changes Required:

#### 1. Migration — spec columns + availability RPC

**File**: `supabase/migrations/<YYYYMMDDHHmmss>_public_fleet_catalog.sql`

**Intent**: Extend `vehicles` with `seats` + `transmission` for the catalog/detail specs, and add the definer RPC that lets the public compute date-range availability without reading `reservations`. Additive over F-01/F-02 — no changes to existing tables' RLS.

**Contract**:
- `create type transmission_type as enum ('manual', 'automatic');`
- `alter table vehicles add column seats int, add column transmission transmission_type;` (both nullable — trucks may omit seats; backfilled in seed).
- `available_vehicles(p_pickup date, p_return date) returns setof vehicles language sql stable security definer set search_path = ''` — body returns `public.vehicles v` where `v.is_active` and `not exists (select 1 from public.reservations r where r.vehicle_id = v.id and r.status in ('pending','confirmed') and r.reserved_period && tsrange(p_pickup + time '14:00', p_return + time '10:00', '[)'))`.
- `grant execute on function public.available_vehicles(date, date) to anon, authenticated;`
- Mirror the `current_app_role()` style exactly (schema-qualified, empty search_path).

#### 2. Seed — backfill new specs

**File**: `supabase/seed.sql` (edit)

**Intent**: Populate `seats` + `transmission` for every seeded vehicle so cards/detail render realistically across categories.

**Contract**: Add `seats`/`transmission` to the `vehicles` insert column list + values (e.g. cargo/passenger vans `automatic` or `manual`, plausible seat counts; trucks a cab seat count). No change to reservation rows. Must still apply cleanly under `supabase db reset`.

#### 3. Regenerate types + alias

**Files**: `src/db/database.types.ts` (regen), `src/types.ts` (edit)

**Intent**: Keep row types in sync with the new columns/enum and expose an ergonomic `Transmission` alias.

**Contract**: Run `supabase gen types typescript --local > src/db/database.types.ts`. In `src/types.ts`, add `export type Transmission = Database["public"]["Enums"]["transmission_type"];`. `Vehicle` picks up `seats`/`transmission` automatically.

### Success Criteria:

#### Automated Verification:
- Migration + seed apply cleanly: `supabase db reset`
- Types regenerate without error: `supabase gen types typescript --local > src/db/database.types.ts`
- Type checking passes: `npx astro check`
- Linting passes: `npm run lint`

#### Manual Verification:
- In Studio/`psql`, `available_vehicles('2026-07-01','2026-07-05')` returns only `is_active` vehicles with no blocking overlap, and **no** `reservations` columns.
- For a date range overlapping a seeded confirmed reservation, the booked vehicle is **absent** from the RPC result; for a free range it is present.
- The RPC is executable with the **anon** key; a direct `select` on `reservations` with the anon key is still denied.
- `vehicles` rows show populated `seats`/`transmission`.

**Implementation Note**: After this phase and all automated verification passes, pause for manual confirmation before Phase 2.

---

## Phase 2: Domain Layer — Services, Formatting, Filter Parsing

### Overview

Centralize all catalog data access and pure presentation/validation logic in a tested layer the UI phases consume, and expose the per-request Supabase client on `locals`.

### Changes Required:

#### 1. Expose Supabase client on locals

**Files**: `src/middleware.ts` (edit), `src/env.d.ts` (edit), `docs/reference/contract-surfaces.md` (edit)

**Intent**: Let pages/services reuse the request's client instead of re-creating it.

**Contract**: In middleware, set `context.locals.supabase = supabase` (the already-created client, may be `null`). Declare `supabase: SupabaseClient<Database> | null` on `App.Locals` in `env.d.ts`. No behavior change to the existing auth/role gate. Register the new surface in `docs/reference/contract-surfaces.md` — add an `App.Locals.supabase` (`SupabaseClient<Database> | null`) row, located in `src/env.d.ts` / populated in `src/middleware.ts`, consumed by S-02+ — so it's treated as load-bearing by future plan reviews.

#### 2. Vehicle service

**File**: `src/lib/services/vehicles.ts` (new)

**Intent**: One home for catalog queries: list (no-date), search-by-availability (dated, via RPC), and get-by-id. Each takes a Supabase client; the dated and undated paths return the same `Vehicle[]`.

**Contract**: `listVehicles(client, filters): Promise<Vehicle[]>` — `.from('vehicles').select('*')` + `.eq('category')`/`.gte('payload_capacity_kg')`/`.order(...)` as filters dictate (RLS already restricts to active). `searchAvailableVehicles(client, filters): Promise<Vehicle[]>` — `.rpc('available_vehicles', { p_pickup, p_return })` then the **same** `.eq/.gte/.order` chain. `getVehicleById(client, id): Promise<Vehicle | null>`. Service decides list-vs-search by presence of a valid date range. Returns `[]`/`null` gracefully on a `null` client (unconfigured).

#### 3. Pure formatter + spec helpers

**File**: `src/lib/format.ts` (new)

**Intent**: Format PLN money (parsing the numeric-as-string quirk), cargo dims (cm→m), payload, and Polish enum labels for category/transmission/fuel.

**Contract**: `formatPln(value: string | number): string` (e.g. `"320 zł"`), `formatCargoDims(l, w, h): string` (`"4.30 × 1.78 × 1.94 m"`, null-safe), `categoryLabelPl`, `transmissionLabelPl`, plus a daily-rate display helper. Pure, no I/O.

#### 4. Filter param parsing + validation

**File**: `src/lib/catalog-filters.ts` (new)

**Intent**: Single source for reading/writing catalog state in the URL and validating the date range against the booking rule.

**Contract**: `parseFilters(searchParams): VehicleFilters` (category, pickup, return, minPayload, sort), `serializeFilters(filters): URLSearchParams`, `validateDateRange(pickup, return): { ok: true } | { ok: false; error: string }` rejecting `return < pickup` and past pickups (Polish messages), reusing `availability.ts` hour semantics. Add `VehicleFilters` + `CatalogSort` to `src/types.ts`.

#### 5. Unit tests

**Files**: `src/lib/format.test.ts` (new), `src/lib/catalog-filters.test.ts` (new)

**Intent**: Guard the breakable pure logic — money-string parsing and date-range validation/serialization.

**Contract**: `format` cases (string vs number input, zł formatting, null dims, PL labels); `catalog-filters` cases (round-trip parse/serialize, invalid/past ranges rejected, same-day range allowed, empty params).

### Success Criteria:

#### Automated Verification:
- Tests pass: `npm test`
- Type checking passes: `npx astro check`
- Linting passes: `npm run lint`

#### Manual Verification:
- A quick REPL/Studio spot-check that `searchAvailableVehicles` for a booked range omits the booked vehicle and `listVehicles` returns all active vehicles.

**Implementation Note**: After this phase and all automated verification passes, pause for manual confirmation before Phase 3.

---

## Phase 3: Public Landing, Fleet Listing & Filter Island

### Overview

Replace the starter homepage with a public landing, build the `/fleet` listing against the live tokens, and add the thin React filter island. This is the slice's primary public surface.

### Changes Required:

#### 1. shadcn primitives

**Files**: `src/components/ui/{card,badge,select,calendar,popover,input}.tsx` (new, via `npx shadcn@latest add`)

**Intent**: Add the UI primitives the listing/detail need.

**Contract**: Add card, badge, select, calendar, popover, input. **Rewrite every generated `@/` import to a relative path** (ESLint bans `@/` for local files). "new-york" style, against existing tokens.

#### 2. Enable view transitions in the layout

**File**: `src/layouts/Layout.astro` (edit)

**Intent**: Turn on `astro:transitions` app-wide so SSR navigations (filter applies, category tabs) feel instant. Currently unused anywhere in `src/`.

**Contract**: Add `<ClientRouter />` (from `astro:transitions`) to `<head>` in `Layout.astro`. No other behavior change; existing pages keep working as full-load fallback.

#### 3. Public landing

**Files**: `src/pages/index.astro` (rewrite), `src/components/Welcome.astro` (delete)

**Intent**: A public entry point adapted from screens 07/01 with **no** account chrome (no greeting, no deposit card).

**Contract**: Hero (Instrument Serif headline, Polish subhead "Pojazdy użytkowe, na dobę lub na miesiąc."), category quick-links into `/fleet?category=…`, a small "Popularne" featured strip (first few active vehicles via `listVehicles`), and a primary CTA into `/fleet`. Server-rendered; uses `VehicleCard`. Set `Layout` `title` + Polish `lang`.

#### 4. Fleet listing page

**File**: `src/pages/fleet/index.astro` (new)

**Intent**: The filterable catalog. Reads filters from URL, validates dates, calls the service, renders the grid + states.

**Contract**: Parse `Astro.url.searchParams` → `VehicleFilters`; if a valid date range is present call `searchAvailableVehicles` (booked vehicles already excluded), else `listVehicles`; on invalid dates skip the query and render the validation message. Render category tabs (plain `<a>` links preserving other params), the `<FilterBar>` island, a result count, a responsive `VehicleCard` grid, and an explicit empty state ("Brak pojazdów spełniających kryteria"). View transitions come from the layout's `<ClientRouter />` (Phase 3 item 2). **Do not** `transition:persist` the FilterBar — let it remount on each navigation and re-read its initial state from props (the current URL filters), so category-tab and apply navigations never leave it showing stale state. A persisted island would not remount and its prop-derived state would not refresh.

#### 5. Vehicle card + silhouette + status pill

**Files**: `src/components/vehicle/VehicleCard.astro` (new), `src/components/vehicle/VehicleSilhouette.astro` (new), `src/components/vehicle/StatusPill.astro` (new)

**Intent**: The repeated card (screens 02/08) and its supporting visuals.

**Contract**: `VehicleCard` shows make/model · year, category, daily rate (`formatPln`), a spec row (seats, transmission, fuel, payload with icons), the silhouette/photo, a status pill, and a link to the detail route (`/fleet/<id>/<slug>`). `VehicleSilhouette` renders a per-`vehicle_category` SVG when `photos[]` is empty, else the first photo. `StatusPill` shows `Dostępny` (is_active / available for range) using `bg-success`; reserved for future `Zajęty`. Polish labels via `format.ts`.

#### 6. Filter island

**File**: `src/components/vehicle/FilterBar.tsx` (new, React island)

**Intent**: The only interactive piece — stages filter state locally and commits to the URL on an explicit apply, so one navigation per deliberate change.

**Contract**: Controls for date range (calendar/popover), minimum payload (select/input), and price sort (select). Holds local state; **on "Zastosuj"** builds the query string via `serializeFilters` and navigates (preserving category). Inline date-range validation mirrors `validateDateRange`. Hydrated with `client:load`/`client:idle`; reads initial state from props (current URL filters). Not `transition:persist`ed — it remounts per navigation and re-derives state from props (see item 4), so it always reflects the live URL.

### Success Criteria:

#### Automated Verification:
- Type checking passes: `npx astro check`
- Linting passes: `npm run lint` (no `@/` imports remain)
- Build succeeds: `npm run build`
- Tests still pass: `npm test`

#### Manual Verification:
- `/` renders the public landing with no account chrome; category links land in `/fleet` pre-filtered.
- `/fleet` matches screenshots 02 (mobile) / 08 (desktop) closely; category tabs filter; price sort works.
- Applying a date range filters out booked vehicles (cross-check one seeded booked vehicle for its booked range); applying invalid/past dates shows the inline message and no results query.
- Minimum-payload filter narrows results; empty state shows on no match.
- Filter apply triggers a single navigation; the view-transition swap is smooth (no full-page flash) and the bar re-renders reflecting the applied URL filters.

**Implementation Note**: After this phase and all automated verification passes, pause for manual confirmation before Phase 4.

---

## Phase 4: Vehicle Detail Page

### Overview

The full vehicle detail card (screen 03) with specs, pricing, imagery, and the hand-off CTA to S-02.

### Changes Required:

#### 1. Detail route

**File**: `src/pages/fleet/[id]/[...slug].astro` (new)

**Intent**: Render one vehicle by id; the optional slug segment is decorative/SEO and ignored for resolution. Matches both `/fleet/<id>` and `/fleet/<id>/<slug>`.

**Contract**: Read `Astro.params.id`; `getVehicleById`; if `null` (missing or inactive — RLS hides inactive) return Astro 404. Otherwise render the detail card. Forward the visitor's selected `pickup`/`return` (if present in `Astro.url.searchParams`) into the Reserve CTA. Emit a canonical link including the name slug.

#### 2. Detail card components

**Files**: `src/components/vehicle/VehicleDetail.astro` (new), `src/components/vehicle/VehicleGallery.tsx` (new, island — only if a carousel is needed)

**Intent**: The detail layout from screen 03: title block, status, image/silhouette carousel, SPECIFICATIONS list, pricing block, CTA.

**Contract**: Title (make + model), `category`/year sub-label, `Dostępny` status pill, image carousel (silhouette fallback via `VehicleSilhouette`; `VehicleGallery` island only if multiple photos — single image/silhouette stays Astro), a "SPECYFIKACJA" list (seats, fuel, transmission, cargo L×W×H via `formatCargoDims`, payload, year), a pricing block (daily, monthly, deposit, per-extra-km, km limit via `formatPln`), and a primary "Zarezerwuj" CTA → `/reserve?vehicle_id=<id>&pickup=<…>&return=<…>` (the S-02 route; destination built in S-02). Polish copy.

### Success Criteria:

#### Automated Verification:
- Type checking passes: `npx astro check`
- Linting passes: `npm run lint`
- Build succeeds: `npm run build`
- Tests still pass: `npm test`

#### Manual Verification:
- `/fleet/<id>/<slug>` matches screenshot 03 closely; all specs + full pricing render with correct PLN formatting.
- An unknown or inactive vehicle id returns 404.
- Cards on `/fleet` link to the correct detail page; a selected date range carries into the Reserve CTA href.
- "Zarezerwuj" navigates to `/reserve?vehicle_id=…&pickup=…&return=…` (404 until S-02 — expected; the href contract is what S-01 owns).

**Implementation Note**: After this phase and all automated verification passes, pause for final manual confirmation.

---

## Testing Strategy

### Unit Tests (Vitest):
- `format.ts` — PLN formatting from `string` and `number`, null-safe cargo dims, Polish enum labels.
- `catalog-filters.ts` — parse/serialize round-trip, reject `return < pickup` and past pickups, allow same-day turnover, empty params default.

### Integration Tests:
- None automated (no UI runner by decision). The DB-level integration check is the `available_vehicles` RPC exercised manually against seed (present for free range, absent for booked range, anon-executable, no PII).

### Manual Testing Steps:
1. `supabase db reset` → clean apply; `available_vehicles` spot-checks (free vs booked range, anon key, no PII).
2. `/` → public landing, no account chrome, category links pre-filter.
3. `/fleet` → category tabs, payload filter, price sort, date-range filter excludes booked vehicles; invalid/past dates show inline error; empty state on no match; single navigation per apply.
4. `/fleet/<id>/<slug>` → specs + full pricing + silhouette; 404 on bad/inactive id; Reserve CTA carries vehicle + dates.
5. `npm test`, `npx astro check`, `npm run lint`, `npm run build` all green.

## Performance Considerations

Negligible at v1 scale (small fleet, low QPS). The dated path is one RPC backed by the GiST index on `reserved_period` + the `vehicles(category)`/`(is_active)` B-tree indexes from F-01. SSR + `astro:transitions` keeps the public catalog within the <2s NFR with minimal JS (one filter island).

## Migration Notes

Phase 1's migration is additive (two nullable columns + one enum + one function) and reversible (drop the function, columns, and enum). Regenerate `src/db/database.types.ts` after applying. No existing data to migrate (greenfield); seed is reset-reproducible.

## References

- Roadmap item: `context/foundation/roadmap.md` → S-01 (lines 98–109)
- PRD: `context/foundation/prd.md` → FR-001/002/003 (lines 81–86), Access Control / public (lines 142–143), NFR <2s (line 125)
- F-01 plan + schema: `context/changes/booking-integrity-data/plan.md`; migration `supabase/migrations/20260603155136_booking_integrity_data.sql`
- Overlap predicate (reuse for validation): `src/lib/availability.ts`
- Definer-function precedent: `current_app_role()` in `supabase/migrations/20260604153139_employee_admin_roles.sql`
- Design: `context/foundation/design-system.md`; screenshots `01,02,03` (mobile), `07,08` (desktop); tokens `src/styles/global.css`
- Conventions: `CLAUDE.md` (imports, relative paths, RLS, services, shadcn); `context/foundation/lessons.md` (read design system before UI)
- Change identity: `context/changes/public-fleet-catalog/change.md`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Schema Extension, Availability RPC, Seed & Types

#### Automated
- [x] 1.1 Migration + seed apply cleanly: `supabase db reset`
- [x] 1.2 Types regenerate without error: `supabase gen types typescript --local > src/db/database.types.ts`
- [x] 1.3 Type checking passes: `npx astro check`
- [x] 1.4 Linting passes: `npm run lint`

#### Manual
- [x] 1.5 `available_vehicles(...)` returns only active, non-overlapping vehicles with no `reservations` columns
- [x] 1.6 Booked vehicle absent for an overlapping range; present for a free range
- [x] 1.7 RPC executable with the anon key; direct `reservations` select still denied to anon
- [x] 1.8 `vehicles` rows show populated `seats`/`transmission`

### Phase 2: Domain Layer — Services, Formatting, Filter Parsing

#### Automated
- [ ] 2.1 Tests pass: `npm test`
- [ ] 2.2 Type checking passes: `npx astro check`
- [ ] 2.3 Linting passes: `npm run lint`

#### Manual
- [ ] 2.4 Spot-check: `searchAvailableVehicles` omits a booked vehicle; `listVehicles` returns all active

### Phase 3: Public Landing, Fleet Listing & Filter Island

#### Automated
- [ ] 3.1 Type checking passes: `npx astro check`
- [ ] 3.2 Linting passes (no `@/` imports remain): `npm run lint`
- [ ] 3.3 Build succeeds: `npm run build`
- [ ] 3.4 Tests still pass: `npm test`

#### Manual
- [ ] 3.5 `/` renders public landing, no account chrome; category links pre-filter
- [ ] 3.6 `/fleet` matches screenshots 02/08; category tabs + price sort work
- [ ] 3.7 Date range filters out booked vehicles; invalid/past dates show inline error
- [ ] 3.8 Payload filter narrows results; empty state on no match
- [ ] 3.9 Filter apply = single navigation; smooth view-transition swap (no flash); bar reflects applied URL filters

### Phase 4: Vehicle Detail Page

#### Automated
- [ ] 4.1 Type checking passes: `npx astro check`
- [ ] 4.2 Linting passes: `npm run lint`
- [ ] 4.3 Build succeeds: `npm run build`
- [ ] 4.4 Tests still pass: `npm test`

#### Manual
- [ ] 4.5 `/fleet/<id>/<slug>` matches screenshot 03; specs + full pricing render with PLN formatting
- [ ] 4.6 Unknown/inactive id returns 404
- [ ] 4.7 Cards link to correct detail page; selected dates carry into the Reserve CTA
- [ ] 4.8 "Zarezerwuj" navigates to `/reserve?vehicle_id=…&pickup=…&return=…` (404 until S-02, expected)
