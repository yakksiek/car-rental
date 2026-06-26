# Fleet Management (S-04) Implementation Plan

## Overview

Give a logged-in employee an authenticated screen to **add, edit, and remove vehicles** in the fleet (FR-011). "Remove" is a soft-delete (retire → `is_active = false`), **blocked when the vehicle has active (`pending`/`confirmed`) reservations**. The vehicle schema already exists (F-01); this slice adds the **write path** (currently vehicles are read-only) and the **employee UI** at `/dashboard/vehicles`, built bottom-up against the established S-02/S-03 patterns.

## Current State Analysis

- **Schema is complete, writes are denied.** `vehicles` (migration `20260603155136_booking_integrity_data.sql:48-82`) has ~18 columns: `name`, `category` (enum `vehicle_category`: `cargo_van`/`passenger_van`/`car_transporter`/`refrigerated_truck`/`flatbed_truck`), `make`/`model`/`production_year`/`fuel_type`/`transmission` (enum `manual`/`automatic`)/`seats`, `payload_capacity_kg`, `cargo_{length,width,height}_cm`, NOT-NULL money fields `daily_rate`/`monthly_rate`/`deposit`/`per_extra_km_rate`, `km_limit`, `photos text[] default '{}'`, `is_active bool default true`, timestamps with an `updated_at` trigger. Only **SELECT** RLS exists (`vehicles_select_anon` + `vehicles_select_authenticated`, both `using (is_active = true)`, lines 140-148) — no INSERT/UPDATE/DELETE policy, so all writes are currently denied.
- **The deletion guard is half-built in the DB.** `reservations.vehicle_id` is `ON DELETE RESTRICT` (`…155136.sql:90`); "active" = `status in ('pending','confirmed')` — the exact set used by the `reservations_no_overlap` EXCLUDE constraint, `available_vehicles`, and `get_vehicle_busy_ranges`. Historical `rejected`/`cancelled` rows still pin the FK, so a hard delete is effectively impossible — **soft-delete is the only coherent "remove,"** and the seed already models it (`Fiat Ducato (wycofany)`, `is_active=false`).
- **Money fields deserialize to `string`** in supabase-js (`src/types.ts:12-16`) — the form/DTO layer owns parsing.
- **Read service already exists.** `src/lib/services/vehicles.ts` has `listVehicles`/`searchAvailableVehicles`/`getCategoryCounts`/`getVehicleById`. `getCategoryCounts` (line 93) already returns `{ total, byCategory }` — reusable for the category-pill counts.
- **Patterns to mirror (S-02/S-03):** role gate via `current_app_role()` RPC (`20260604153139…sql:47`) + `requireRole(locals,'employee')` (`src/lib/access.ts:67`); API routes do an **Origin/CSRF check → zod → tagged-union → HTTP status** (`src/pages/api/reservations.ts`); services are null-graceful and take the client as the first arg; forms are **plain React state + client-side zod** (no react-hook-form), see `src/components/reservation/ReservationForm.tsx`.
- **Access already covers the route.** `src/lib/access.ts:27-33` gates `/dashboard` at `employee`. `/dashboard/vehicles` falls under that prefix → **no `access.ts` change needed.**
- **S-03 is only planned, not merged** (branch `s03-reservation-approval-plan`); `src/pages/dashboard.astro` is still a placeholder and `/dashboard/reservations` does not exist yet. S-03 and S-04 land in parallel — see Migration Notes for shared-merge surfaces.

### Key Discoveries:

- Soft-delete guard can be **atomic and unbypassable** in one statement: `update vehicles set is_active=false where id=$1 and not exists (select 1 from reservations where vehicle_id=$1 and status in ('pending','confirmed'))` — a SECURITY DEFINER RPC distinguishes `not_found` vs `has_active_reservations` vs `ok`.
- Broadening `vehicles_select_authenticated` to `using (true)` is safe in v1 because **there are no customer accounts — `authenticated` == staff.** The one correctness cost: the public catalog's `listVehicles` (table read, not the `available_vehicles` RPC) currently relies on RLS to hide retired vehicles, so it must gain an explicit `.eq('is_active', true)`.
- The design (`screenshots/17-admin-desktop-fleet-management.png` + `screenshots/23-admin-mobile-fleet-management.jpg`) is an aspirational cockpit; its plate (`Rejestracja`), utilization (`Wykorzystanie`), next-booking (`Najbliższe`), and `Service`/`Rented`/`Available` status all map to **deferred** scope (unmodeled / parked stats / S-07). The S-04 surface is the **vehicle list + add/edit form + guarded retire**.

## Desired End State

An employee opens `/dashboard/vehicles`, sees the fleet as category-filterable, searchable cards/rows (each showing name, specs, **Aktywny/Wycofany** status, daily+monthly rate, edit + delete), and can:
- **Add** a vehicle via `/dashboard/vehicles/new` (full-page form), which appears in the public catalog (S-01).
- **Edit** any vehicle via `/dashboard/vehicles/[id]/edit`.
- **Retire** a vehicle (the `×` action) — it leaves the public catalog but stays visible to staff under a "Pokaż wycofane" toggle and can be restored. Retiring a vehicle that has `pending`/`confirmed` reservations is **blocked** with a Polish message telling the employee to cancel those first.

Verified by: migration applies on a clean `supabase db reset`; lint/build/typecheck pass; manual CRUD + the retire-blocked path behave as above.

## What We're NOT Doing

- **No** license-plate (`Rejestracja`) column, utilization/`Wykorzystanie` stats, the four stat cards (`Dostępne/Wynajęte/Serwis/Po terminie`), the `Najbliższe` next-booking column, the list/grid view toggle, or a `maintenance`/`service` vehicle status — all deferred (unmodeled, parked statistics, or S-07).
- **No** real photo upload / object storage — photos are entered as **URLs** (storage arrives in S-05). 
- **No** hard delete; **no** bulk actions; **no** audit trail (parked to v2).
- **No** change to `src/lib/access.ts` or the auth/role model (F-02 already gates `/dashboard`).
- **No** admin-only gating — fleet management is **employee-level** per FR-011.
- **No** English copy — Polish is canonical.

## Implementation Approach

Bottom-up, mirroring S-02/S-03:

1. **Data layer** — a migration adds role-gated INSERT/UPDATE RLS (create/edit go through the user's authed client), broadens authenticated SELECT (staff see retired), and adds the `set_vehicle_active` SECURITY DEFINER RPC that holds the retire guard atomically.
2. **Service + validation** — a shared zod schema + service functions wrapping the writes as null-graceful tagged unions; patch `listVehicles` for the RLS change.
3. **API** — three role-gated, Origin-checked, zod-validated routes mapping service results to 201/200/400/401/403/404/409.
4. **List UI** — one responsive island (desktop table ↔ mobile cards) over the SSR-loaded fleet, with pills/search/show-retired toggle and the delete-with-guard flow; a dashboard entry card.
5. **Form UI** — dedicated `new`/`edit` routes sharing one `VehicleForm` island.

Phases 1–3 are fully automated-verifiable (no manual gate) and safe to run unattended in parallel with S-03; the manual UI checks are batched into Phases 4–5.

## Critical Implementation Details

- **Retire guard must be atomic, not check-then-write.** Do the existence/active-reservation check and the `is_active` flip in a single RPC statement (or `select … for update`), or a reservation confirmed between a separate check and update could slip past the guard. The RPC returns a tag (`ok`/`has_active_reservations`/`not_found`/`unauthorized`); the API maps `has_active_reservations` → **409**.
- **RLS broadening ↔ catalog leak.** The moment `vehicles_select_authenticated` becomes `using (true)`, the public catalog's `listVehicles` (Phase 2) **must** add `.eq('is_active', true)` — otherwise a logged-in employee browsing the public fleet would see retired vehicles. The `available_vehicles` RPC and `getVehicleById` for anon are unaffected (RPC already filters `is_active`; anon RLS still `is_active = true`).
- **Money/numeric fields are strings.** The zod schema validates numeric **strings** (coerce + positive checks); don't assume `number` at the DB boundary. Reuse the existing money formatter for display.
- **Reuse, don't reinvent, category labels + counts.** The Polish category labels (Furgony/Busy/Lawety/Izotermy/Plandeki ↔ enum values) and counts already exist for S-01 (`getCategoryCounts` + the catalog's category-label map). Import them; do not hard-code a second mapping.

## Phase 1: Data layer — write RLS + retire guard

### Overview

Add the authenticated write path to `vehicles` and the atomic retire guard, and let staff read retired vehicles.

### Changes Required:

#### 1. Fleet-management migration

**File**: `supabase/migrations/<YYYYMMDDHHmmss>_fleet_management.sql`

**Intent**: Open vehicle writes to staff, broaden staff reads to include retired vehicles, and add a guarded soft-delete RPC. Mirror the definer-hygiene of existing RPCs (`security definer`, `set search_path = ''`, schema-qualified names, `grant execute`).

**Contract**:
- **Drop & recreate** `vehicles_select_authenticated` as `using (true)` (staff see all incl. retired; v1 `authenticated` == staff). Leave `vehicles_select_anon` (`is_active = true`) untouched.
- **New** `vehicles_insert_staff` (INSERT, `to authenticated`, `with check (public.current_app_role() in ('employee','admin'))`).
- **New** `vehicles_update_staff` (UPDATE, `to authenticated`, `using` + `with check` = `public.current_app_role() in ('employee','admin')`).
- **No DELETE policy** (hard delete stays denied; removal is the RPC's soft-delete).
- **New** `public.set_vehicle_active(p_id uuid, p_active boolean) returns table(result text)`, `security definer`, `set search_path = ''`:
  - if `public.current_app_role() not in ('employee','admin')` → `result = 'unauthorized'`.
  - else if `p_active = false`: `update public.vehicles set is_active = false where id = p_id and not exists (select 1 from public.reservations where vehicle_id = p_id and status in ('pending','confirmed'))`; if 0 rows updated → distinguish `not_found` (no such id) vs `has_active_reservations`; else `ok`.
  - else (`p_active = true`): `update … set is_active = true where id = p_id`; `not_found` if missing, else `ok`.
  - `grant execute on function public.set_vehicle_active(uuid, boolean) to authenticated`.

#### 2. Regenerate DB types

**File**: `src/db/database.types.ts`

**Intent**: Pick up the new `set_vehicle_active` function signature so the service is typed.

**Contract**: Regenerate via the project's type-gen command after the migration applies. Additive change (new `Functions` entry). See Migration Notes re: regen ordering vs S-03.

### Success Criteria:

#### Automated Verification:

- [ ] Migration applies cleanly on a fresh DB: `npx supabase db reset`
- [ ] `set_vehicle_active` exists and is `authenticated`-executable (visible in regenerated `database.types.ts` `Functions`)
- [ ] Type generation succeeds and `npx astro sync` passes
- [ ] `npm run lint` and `npm run build` pass

#### Manual Verification:

- [ ] (DB-level, optional) Calling `set_vehicle_active` on the seed's MAN Chłodnia (has a pending reservation) returns `has_active_reservations`; on an unreserved vehicle returns `ok`

---

## Phase 2: Service layer + validation schema

### Overview

A shared zod schema and the service functions wrapping create/update/retire/list as null-graceful tagged unions; patch the public read for the RLS change.

### Changes Required:

#### 1. Vehicle input schema

**File**: `src/lib/vehicle-schema.ts`

**Intent**: One zod schema shared by client form + server route (mirrors `reservation-schema.ts`), validating a create/edit payload.

**Contract**: `vehicleInputSchema` — required: `name` (non-empty), `category` (enum), `daily_rate`/`monthly_rate`/`deposit`/`per_extra_km_rate` (positive numeric **strings**). Optional/nullable: `make`, `model`, `production_year` (int range), `fuel_type`, `transmission` (enum), `seats` (int ≥ 0), `payload_capacity_kg`, `cargo_{length,width,height}_cm` (non-negative numeric strings), `km_limit` (int ≥ 0), `photos` (array of URL strings). Export the inferred `VehicleInput` type and a `firstIssuePerField` helper reuse (or import the existing one).

#### 2. Vehicle write/list service

**File**: `src/lib/services/vehicles.ts` (extend)

**Intent**: Add staff write + fleet-read functions; patch the public list for the broadened RLS.

**Contract**:
- `createVehicle(client, input): Promise<{status:'created'; vehicle: Vehicle} | {status:'unauthorized'}>` — insert; map RLS denial (Postgres `42501`) → `unauthorized`.
- `updateVehicle(client, id, input): Promise<{status:'updated'; vehicle: Vehicle} | {status:'not_found'} | {status:'unauthorized'}>` — UUID-guard like `getVehicleById`; update by id, `.select().maybeSingle()`; null row → `not_found`.
- `setVehicleActive(client, id, active): Promise<{status:'ok'|'has_active_reservations'|'not_found'|'unauthorized'}>` — `client.rpc('set_vehicle_active', …)`, map the `result` tag.
- `listFleet(client, opts: {category?: VehicleCategory; includeRetired?: boolean}): Promise<Vehicle[]>` — staff read; `includeRetired=false` adds `.eq('is_active', true)`; orders by `name`. (Text search is client-side in the island; no server param.)
- **Patch** `listVehicles` — add explicit `.eq('is_active', true)` (no longer guaranteed by RLS for authenticated callers).

### Success Criteria:

#### Automated Verification:

- [ ] `npm run lint` passes (typed-lint clean)
- [ ] `npm run build` passes (no type errors across the new service + schema)

#### Manual Verification:

- [ ] None (covered by Phase 3 API checks)

---

## Phase 3: API routes

### Overview

Three role-gated, Origin-checked, zod-validated endpoints mapping service results to HTTP.

### Changes Required:

#### 1. Create endpoint

**File**: `src/pages/api/vehicles.ts`

**Intent**: `POST` creates a vehicle. Follow `src/pages/api/reservations.ts` structure.

**Contract**: Origin check → `requireRole(locals,'employee')` (else 403; 401 if no user) → parse + `vehicleInputSchema.safeParse` (400 `{errors}` on fail) → `createVehicle` → **201** `{vehicle}` / 403 on `unauthorized`.

#### 2. Update endpoint

**File**: `src/pages/api/vehicles/[id].ts`

**Intent**: `PATCH` edits a vehicle.

**Contract**: Origin + role + zod as above → `updateVehicle` → **200** `{vehicle}` / **404** `not_found` / 403.

#### 3. Retire/restore endpoint

**File**: `src/pages/api/vehicles/[id]/active.ts`

**Intent**: `POST` toggles `is_active` through the guarded RPC.

**Contract**: Origin + role → body `{ active: boolean }` (zod) → `setVehicleActive` → **200** `{status:'ok'}` / **409** `has_active_reservations` (Polish message for the UI) / **404** `not_found` / 403.

### Success Criteria:

#### Automated Verification:

- [ ] `npm run lint` and `npm run build` pass
- [ ] `npx astro sync` passes (routes typecheck)

#### Manual Verification:

- [ ] `POST /api/vehicles` with a valid body (Origin header set) creates a vehicle; missing-field body returns 400 with `{errors}`; unauthenticated/non-staff returns 403
- [ ] `POST /api/vehicles/<man-chłodnia-id>/active {active:false}` returns 409; an unreserved vehicle returns 200 and disappears from the public catalog

---

## Phase 4: Fleet list screen (`/dashboard/vehicles`)

### Overview

One responsive island over the SSR-loaded fleet: category pills + search + show-retired toggle + edit/delete actions with the guarded-retire flow; plus a dashboard entry card.

### Design Contract (scope-adjusted from screens 17 desktop + 23 mobile)

Both designs reduce to the **same data** rendered responsively. App bg cool grey `#F1F3F6`, white `shadow-card` surfaces, crimson `--primary`, 12px+ radii, Inter. Build against live tokens in `src/styles/global.css`; **do not** import from `context/foundation/design/`.

- **Header**: eyebrow count (`N pojazdów`), H1 **„Zarządzanie flotą"**, primary action **„+ Dodaj pojazd"** (dark button desktop / dark circular FAB mobile) → `/dashboard/vehicles/new`. A search input (`placeholder „Marka, model…"`) filters by name/make/model.
- **Category pills**: „Wszystkie · N", then one per category using the **existing S-01 Polish labels** (Furgony/Busy/Lawety/Izotermy/Plandeki) with counts from `getCategoryCounts`; active pill is the dark filled state.
- **Show-retired toggle**: „Pokaż wycofane" (default off).
- **Desktop (`md+`) — table** (screen 17, minus deferred columns): columns **POJAZD** (thumbnail + name + secondary line `rok · paliwo · skrzynia`) · **STATUS** (badge: `Aktywny` = green tint, `Wycofany` = grey/neutral) · **STAWKA** (`{daily} zł/doba` bold + `{monthly} zł/mies` muted) · **actions** (pencil → edit, red `×` → retire). Omit Rejestracja / Wykorzystanie / Najbliższe.
- **Mobile (`<md`) — stacked cards** (screen 23): thumbnail + name + `rok · paliwo · skrzynia` + status badge top-right; rate line; full-width **„Edytuj"** (pencil) + red `×` retire button. (The prototype's bottom tab bar is the broader admin shell — out of scope; this screen is reached from the dashboard.)
- **Thumbnail**: first `photos[]` URL, else a neutral silhouette placeholder.
- **Retire flow**: `×` opens a confirm (shadcn `Dialog`) „Wycofać pojazd z floty?"; confirm → `POST …/active {active:false}`; **409** → inline error „Pojazd ma aktywne rezerwacje — najpierw je anuluj."; success → row updates to `Wycofany` (or leaves the list when the toggle is off). Retired rows show a **„Przywróć"** action (`active:true`).

Canonical screenshots: `context/foundation/design/screenshots/17-admin-desktop-fleet-management.png`, `…/23-admin-mobile-fleet-management.jpg`. **Implementers build from this contract text; do not re-open the PNG/JPG.**

### Changes Required:

#### 1. Fleet list page

**File**: `src/pages/dashboard/vehicles.astro`

**Intent**: SSR-load the fleet (incl. retired) + category counts via the service, render the island. Gated by middleware (`/dashboard` → employee).

**Contract**: Calls `listFleet(locals.supabase, {includeRetired:true})` + `getCategoryCounts`; passes data to `FleetList` as a `client:load` island.

#### 2. Fleet list island

**File**: `src/components/fleet/FleetList.tsx`

**Intent**: Render + interact per the design contract; own filter/search/toggle/confirm state.

**Contract**: Props: `vehicles: Vehicle[]`, `counts`. Plain React state for category/search/showRetired/confirm-dialog. Responsive table↔cards via Tailwind (`cn()`). Edit = link to `/dashboard/vehicles/[id]/edit`. Delete = guarded retire flow above. Reuse the money formatter + category labels.

#### 3. Dashboard entry card

**File**: `src/pages/dashboard.astro` (extend the placeholder)

**Intent**: Add a navigation card „Zarządzanie flotą" → `/dashboard/vehicles`.

**Contract**: A card/link in the dashboard grid. (Shared-merge surface with S-03 — see Migration Notes.)

### Success Criteria:

#### Automated Verification:

- [ ] `npm run lint`, `npm run build`, `npx astro sync` pass

#### Manual Verification:

- [ ] `/dashboard/vehicles` lists seed vehicles; category pills filter and show correct counts; search narrows by name/make/model
- [ ] „Pokaż wycofane" reveals the retired Fiat Ducato; default hides it
- [ ] Retiring an unreserved vehicle works; retiring the MAN Chłodnia shows the „aktywne rezerwacje" error; „Przywróć" restores
- [ ] Layout matches the contract at desktop (table) and mobile (cards); reached from the dashboard card
- [ ] Unauthenticated access to `/dashboard/vehicles` redirects to sign-in

---

## Phase 5: Add / Edit form

### Overview

Dedicated full-page routes sharing one `VehicleForm` island (~18 fields), client-side zod, submit → API → redirect.

### Changes Required:

#### 1. New-vehicle page

**File**: `src/pages/dashboard/vehicles/new.astro`

**Intent**: Render `VehicleForm` in create mode.

**Contract**: Role-gated by middleware; renders the island with no initial vehicle; on success redirects to `/dashboard/vehicles`.

#### 2. Edit-vehicle page

**File**: `src/pages/dashboard/vehicles/[id]/edit.astro`

**Intent**: SSR-load the vehicle (incl. retired, now visible to staff) and render `VehicleForm` in edit mode; 404 if missing.

**Contract**: `getVehicleById(locals.supabase, id)`; null → Astro 404; else pass to the island.

#### 3. Shared vehicle form island

**File**: `src/components/fleet/VehicleForm.tsx`

**Intent**: One form for create + edit; plain React state + `vehicleInputSchema` client validation; mirror `ReservationForm` error display.

**Contract**: Props: `mode: 'create'|'edit'`, optional `vehicle`. Grouped sections (Podstawowe / Specyfikacja / Wymiary / Cennik / Zdjęcia). **Photos** = textarea, one URL per line ↔ `string[]`. shadcn `Input`/`Select`/`Label`/`Textarea`/`Button`. Submit → `POST /api/vehicles` (create) or `PATCH /api/vehicles/[id]` (edit); 400 → map `{errors}` to fields; success → `window.location.assign('/dashboard/vehicles')`. (Add `textarea` via `npx shadcn@latest add textarea` if absent, then rewrite `@/` imports to relative.)

### Success Criteria:

#### Automated Verification:

- [ ] `npm run lint`, `npm run build`, `npx astro sync` pass

#### Manual Verification:

- [ ] Creating a vehicle (all required fields) adds it to the list and the public catalog
- [ ] Server-side validation: submitting an empty required field shows the field error (400 round-trip)
- [ ] Editing a vehicle persists changes; photos entered as URLs render in the catalog gallery
- [ ] Editing a retired vehicle works (staff can load it)

---

## Testing Strategy

No unit-test runner is configured (per CLAUDE.md), so automated verification is **lint + build + `astro sync` + a clean `supabase db reset`**; correctness of the guard rests on the DB constraint + the atomic RPC, verified manually.

### Manual Testing Steps:

1. `npx supabase db reset` (applies the migration + seed), `npm run dev`.
2. Sign in as `employee@fleetrent.test`; open `/dashboard/vehicles`.
3. Add a vehicle → confirm it shows in the list and on the public `/` catalog.
4. Edit it (change daily rate, add a photo URL) → confirm persisted + gallery shows the photo.
5. Retire it → leaves the public catalog, shows as `Wycofany` under the toggle; restore it.
6. Retire the MAN Chłodnia (seed pending reservation) → blocked with the Polish message.
7. Hit `POST /api/vehicles` without an Origin header / as anon → 403.

## Performance Considerations

Fleet size is small (single operator); `listFleet` is an unpaginated ordered read — fine. Category counts reuse one lightweight query. No N+1 (status is `is_active`, not a per-row reservation read — that's the deferred S-07 path).

## Migration Notes

**S-03 and S-04 land in parallel** (separate branches). Shared-merge surfaces:
- `src/pages/dashboard.astro` — both add an entry card. Additive; resolve by keeping both cards.
- `src/types.ts` — both add DTO/result types. Additive.
- `src/db/database.types.ts` — both regenerate after their migration. **Regenerate once after both migrations are applied** to avoid a stale/partial types file; never hand-merge this generated file.
- `src/lib/services/*.ts` — different files (`vehicles.ts` vs `reservations.ts`); `vehicles.ts` is S-04-only. **Note:** S-03's Phase 7 calendar also reads `listVehicles` for its vehicle rows, so the `listVehicles` `.eq('is_active', true)` patch (Phase 2) is not purely a public-catalog concern — keep it **coupled to the RLS broadening in the same migration/PR** so S-03's calendar never starts rendering retired vehicles.
- **Migration timestamps** — give the S-03 and S-04 migrations distinct, sequential `YYYYMMDDHHmmss` prefixes; order between them is functionally irrelevant (different tables), but overlapping timestamps confuse the migration list.
- **No** `src/lib/access.ts` change in S-04 (`/dashboard` already gates `employee`) — one fewer conflict than S-03.

## References

- Roadmap slice S-04: `context/foundation/roadmap.md:148-158` (FR-011)
- Change identity: `context/changes/fleet-management/change.md`
- Data model: `supabase/migrations/20260603155136_booking_integrity_data.sql:48-130`
- Role gate: `src/lib/access.ts:27-69`; `current_app_role()` `supabase/migrations/20260604153139_employee_admin_roles.sql:47`
- API pattern: `src/pages/api/reservations.ts`; form pattern: `src/components/reservation/ReservationForm.tsx`
- Read service: `src/lib/services/vehicles.ts`
- Design: `context/foundation/design-system.md`; `screenshots/17-admin-desktop-fleet-management.png`, `screenshots/23-admin-mobile-fleet-management.jpg`
- Sibling plans: `context/changes/reservation-approval/plan.md` (parallel S-03)

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Data layer — write RLS + retire guard

#### Automated

- [x] 1.1 Migration applies cleanly on a fresh DB: `npx supabase db reset` — 3de8e2b
- [x] 1.2 `set_vehicle_active` exists and is `authenticated`-executable (in regenerated types `Functions`) — 3de8e2b
- [x] 1.3 Type generation succeeds and `npx astro sync` passes — 3de8e2b
- [x] 1.4 `npm run lint` and `npm run build` pass — 3de8e2b

#### Manual

- [x] 1.5 `set_vehicle_active` returns `has_active_reservations` for the MAN Chłodnia, `ok` for an unreserved vehicle — 3de8e2b

### Phase 2: Service layer + validation schema

#### Automated

- [x] 2.1 `npm run lint` passes (typed-lint clean) — c7de9d6
- [x] 2.2 `npm run build` passes (no type errors across the new service + schema) — c7de9d6

### Phase 3: API routes

#### Automated

- [x] 3.1 `npm run lint` and `npm run build` pass — 67d7236
- [x] 3.2 `npx astro sync` passes (routes typecheck) — 67d7236

#### Manual

- [x] 3.3 `POST /api/vehicles` creates with valid body; 400 `{errors}` on missing fields; 403 for non-staff — 67d7236
- [x] 3.4 `POST /api/vehicles/<id>/active {active:false}` returns 409 for the MAN Chłodnia, 200 for an unreserved vehicle (then gone from the public catalog) — 67d7236

### Phase 4: Fleet list screen

#### Automated

- [x] 4.1 `npm run lint`, `npm run build`, `npx astro sync` pass

#### Manual

- [x] 4.2 List renders seed vehicles; category pills filter with correct counts; search narrows by name/make/model
- [x] 4.3 „Pokaż wycofane" reveals the retired Fiat Ducato; default hides it
- [x] 4.4 Retire unreserved works; MAN Chłodnia shows the „aktywne rezerwacje" error; „Przywróć" restores
- [x] 4.5 Matches the design contract at desktop (table) + mobile (cards); reached from the dashboard card
- [x] 4.6 Unauthenticated `/dashboard/vehicles` redirects to sign-in

### Phase 5: Add / Edit form

#### Automated

- [ ] 5.1 `npm run lint`, `npm run build`, `npx astro sync` pass

#### Manual

- [ ] 5.2 Creating a vehicle (required fields) adds it to the list + public catalog
- [ ] 5.3 Empty required field shows the field error (400 round-trip)
- [ ] 5.4 Editing persists; photo URLs render in the catalog gallery
- [ ] 5.5 Editing a retired vehicle works
