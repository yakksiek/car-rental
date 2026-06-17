# Fleet Management (S-04) — Plan Brief

> Full plan: `context/changes/fleet-management/plan.md`

## What & Why

Give a logged-in employee a screen to **add, edit, and remove vehicles** (FR-011), with removal blocked when the vehicle has active reservations. This replaces F-01's seed-only fleet with real CRUD — the operator can now manage their own fleet instead of editing SQL.

## Starting Point

The `vehicles` schema is already complete (F-01, ~18 columns incl. `is_active` soft-delete flag, already used by the seed's retired "Fiat Ducato"), but **vehicles are read-only** — only SELECT RLS exists, so every write is currently denied. A read service (`listVehicles`/`getCategoryCounts`/…) and the employee role gate (`/dashboard` → employee) already exist. S-03 is only *planned*, so the dashboard is still a placeholder and this slice lands in parallel.

## Desired End State

An employee opens `/dashboard/vehicles`, sees the fleet as category-filterable, searchable cards (desktop table / mobile cards) with an `Aktywny`/`Wycofany` status and rate, and can add (`/new`), edit (`/[id]/edit`), and retire vehicles. Retiring pulls a vehicle from the public catalog but keeps it visible to staff (restorable); retiring a vehicle with `pending`/`confirmed` reservations is blocked with a Polish "cancel them first" message.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| --- | --- | --- | --- |
| Design scope | Core CRUD only | FR-011 is add/edit/remove; the prototype's stats/utilization/plate/next-booking map to parked scope, S-07, or unmodeled data | Plan |
| Remove semantics | Soft-delete (retire → `is_active=false`) | The ON DELETE RESTRICT FK makes hard delete impossible once any reservation exists; matches the seed's retired pattern | Plan |
| "Active" reservation | `status in ('pending','confirmed')` | Same set as the EXCLUDE constraint + `available_vehicles` | Research |
| Access level | Employee | FR-011 wording; `/dashboard` already gates `employee` (no access.ts change) | Plan |
| Write mechanism | Hybrid: RLS INSERT/UPDATE + guarded RPC for retire | Least boilerplate for create/edit; the retire guard must be atomic | Plan |
| Retire guard | Single-statement RPC (`set_vehicle_active`) | Avoids the check-then-write TOCTOU race | Plan |
| Staff sees retired | Broaden authenticated SELECT to `using(true)` | v1 has no customer accounts, so `authenticated` == staff; patch `listVehicles` with explicit `is_active` filter | Plan |
| Form UX | Dedicated `/new` + `/[id]/edit` routes | ~18 fields need room; simplest island state | Plan |
| Plate (`Rejestracja`) | Defer | Not in schema, not in FR-011 | Plan |
| Status badge | `Aktywny` / `Wycofany` from `is_active` | Zero new queries; honest about what S-04 knows | Plan |
| Photos | URL-list textarea → `photos text[]` | Real upload/storage arrives in S-05 | Plan |
| Mobile design | Real screenshot provided + filed (screen 23) | User added `23-admin-mobile-fleet-management.jpg`; distilled into the Phase 4 contract | Plan |

## Scope

**In scope:** write RLS + `set_vehicle_active` RPC + types; `vehicle-schema.ts` + service writes/`listFleet` + `listVehicles` patch; `POST /api/vehicles`, `PATCH /api/vehicles/[id]`, `POST /api/vehicles/[id]/active`; `/dashboard/vehicles` list (responsive, pills/search/show-retired/guarded retire) + dashboard card; `/new` + `/[id]/edit` shared `VehicleForm`.

**Out of scope:** license plate, utilization/stats, stat cards, next-booking column, grid toggle, `maintenance` status, real photo upload (S-05), hard delete, bulk actions, audit trail, admin-only gating, English copy.

## Architecture / Approach

Bottom-up, mirroring S-02/S-03. Create/edit cross RLS through the user's authed client (role-gated INSERT/UPDATE policies); the retire crosses through a SECURITY DEFINER RPC that holds the active-reservation guard atomically. The service wraps each write as a null-graceful tagged union; three Origin-checked, role-gated, zod-validated API routes map results to 201/200/400/401/403/404/409. The UI is one responsive island (table ↔ cards) over the SSR-loaded fleet, plus shared full-page create/edit form routes.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Data layer | Write RLS + broadened SELECT + `set_vehicle_active` guard RPC + types | Atomic guard correctness; RLS↔catalog-leak |
| 2. Service + schema | zod schema; create/update/setActive/listFleet; `listVehicles` patch | Money fields are strings; remembering the `is_active` patch |
| 3. API routes | 3 role-gated, Origin-checked, zod endpoints | Correct status mapping (esp. 409 retire-blocked) |
| 4. List screen | Responsive fleet list + pills/search/toggle + guarded retire + dashboard card | Faithful rebuild from contract, not prototype JSX |
| 5. Add/edit form | Shared `VehicleForm` over `/new` + `/[id]/edit` | ~18-field form; photos-as-URLs |

**Prerequisites:** F-01 + F-02 (both done). Mobile + desktop designs in hand (screens 23 + 17), distilled into the Phase 4 contract.
**Estimated effort:** ~2–3 sessions; Phases 1–3 are small/back-end (no manual gate), Phase 4–5 carry the UI work.

## Open Risks & Assumptions

- **Parallel with S-03.** Shared-merge surfaces: `dashboard.astro`, `types.ts`, generated `database.types.ts` (regen once after *both* migrations). No `access.ts` change in S-04.
- **`authenticated` == staff** holds only because v1 has no customer accounts; if that changes, the broadened SELECT must be revisited.
- **Photos are URLs** until S-05 stands up storage.

## Success Criteria (Summary)

- An employee can add, edit, and retire/restore vehicles from `/dashboard/vehicles`; added/edited vehicles appear correctly in the public catalog.
- Retiring a vehicle with active (`pending`/`confirmed`) reservations is blocked with a clear Polish message; the guard is atomic.
- Lint + build + `astro sync` + a clean `supabase db reset` all pass.
