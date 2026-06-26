// core
import type { SupabaseClient } from "@supabase/supabase-js";

// others
import type { Database } from "../../db/database.types";
import type { Vehicle, VehicleCategory, VehicleFilters } from "../../types";
import type { VehicleInput } from "../vehicle-schema";

// The single home for public catalog queries. Two paths return the identical
// `Vehicle[]` so the UI has one card and one mapper:
//   • no date range  → `listVehicles` over the `vehicles` table (RLS already
//     restricts `anon`/`authenticated` to `is_active = true`).
//   • date range      → `searchAvailableVehicles` via the `available_vehicles`
//     RPC, which re-applies `is_active` itself and excludes overlapping
//     reservations inside Postgres (the public role cannot read `reservations`).
// Both then share the same `.eq/.gte/.order` filter chain. Every function takes
// the per-request client and degrades to `[]`/`null` when it is `null`
// (Supabase unconfigured) rather than throwing.

type CatalogClient = SupabaseClient<Database>;

/** Ascending unless an explicit `price_desc` sort was requested. */
function sortAscending(filters: VehicleFilters): boolean {
  return filters.sort !== "price_desc";
}

/**
 * List active vehicles (no date filter). Applies category / minimum-payload
 * filters and a daily-rate sort.
 *
 * The explicit `.eq('is_active', true)` is load-bearing: S-04 broadened
 * `vehicles_select_authenticated` to `using (true)` so staff can manage retired
 * vehicles, so RLS no longer hides inactive rows from a logged-in caller. Without
 * this filter the public catalog (and S-03's calendar, which also reads this)
 * would leak retired vehicles to any signed-in employee. Anon callers are still
 * RLS-restricted, but the filter is unconditional so both roles see the same set.
 */
export async function listVehicles(client: CatalogClient | null, filters: VehicleFilters): Promise<Vehicle[]> {
  if (!client) {
    return [];
  }

  let query = client.from("vehicles").select("*").eq("is_active", true);
  if (filters.category) {
    query = query.eq("category", filters.category);
  }
  if (filters.minPayload !== null) {
    query = query.gte("payload_capacity_kg", filters.minPayload);
  }
  query = query.order("daily_rate", { ascending: sortAscending(filters) });

  const { data, error } = await query;
  if (error) {
    throw error;
  }
  return data;
}

/**
 * Search vehicles bookable for `filters.pickup`/`filters.return` via the
 * PII-safe `available_vehicles` RPC, then apply the same filter chain as the
 * undated path. Returns `[]` if the range is incomplete (caller validates first
 * with `validateDateRange`).
 */
export async function searchAvailableVehicles(
  client: CatalogClient | null,
  filters: VehicleFilters,
): Promise<Vehicle[]> {
  if (!client || !filters.pickup || !filters.return) {
    return [];
  }

  let query = client.rpc("available_vehicles", { p_pickup: filters.pickup, p_return: filters.return }).select("*");
  if (filters.category) {
    query = query.eq("category", filters.category);
  }
  if (filters.minPayload !== null) {
    query = query.gte("payload_capacity_kg", filters.minPayload);
  }
  query = query.order("daily_rate", { ascending: sortAscending(filters) });

  const { data, error } = await query;
  if (error) {
    throw error;
  }
  return data;
}

export interface CategoryCounts {
  total: number;
  byCategory: Record<VehicleCategory, number>;
}

/**
 * Count active vehicles overall and per category for the catalog's type tabs
 * (design screens 02/08 show `label · N`). These are fleet sizes — independent of
 * the date/payload filters and of the currently-selected category — so the tab
 * count reads as "how many of this type exist", not "how many match right now".
 * RLS restricts the rows to `is_active = true`; a `null` client yields zeros.
 */
export async function getCategoryCounts(client: CatalogClient | null): Promise<CategoryCounts> {
  const byCategory: Record<VehicleCategory, number> = {
    cargo_van: 0,
    passenger_van: 0,
    car_transporter: 0,
    refrigerated_truck: 0,
    flatbed_truck: 0,
  };
  if (!client) {
    return { total: 0, byCategory };
  }

  const { data, error } = await client.from("vehicles").select("category");
  if (error) {
    throw error;
  }
  for (const row of data) {
    byCategory[row.category] += 1;
  }
  return { total: data.length, byCategory };
}

// A malformed id is just a vehicle that cannot exist. We reject it before the
// query because `id` is a `uuid` column: PostgREST sends a non-UUID value to
// Postgres, which throws `invalid input syntax for type uuid` (a 500) instead of
// returning no rows. Guarding the shape turns that into the same `null` → 404 path
// as a missing/inactive vehicle.
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Fetch one active vehicle by id, or `null` when the id is malformed, missing, or
 * inactive (RLS hides inactive rows, so the detail route renders a 404 for all).
 */
export async function getVehicleById(client: CatalogClient | null, id: string): Promise<Vehicle | null> {
  if (!client || !UUID_RE.test(id)) {
    return null;
  }

  const { data, error } = await client.from("vehicles").select("*").eq("id", id).maybeSingle();
  if (error) {
    throw error;
  }
  return data;
}

// ---------------------------------------------------------------------------
// Staff write + fleet-read path (S-04). These run through the *authed* per-request
// client, so RLS (the vehicles_insert_staff / vehicles_update_staff policies) and
// the set_vehicle_active definer RPC are the authority — the API route's
// requireRole is the first gate, these are the trust boundary. Each returns a
// tagged union (mirroring reservations.ts) and degrades a `null` client to the
// "cannot act" tag rather than throwing. Input is the zod-validated `VehicleInput`,
// whose `number | null` shape maps straight onto the typed Insert/Update row.
// ---------------------------------------------------------------------------

// Postgres `insufficient_privilege` — raised when an RLS WITH CHECK rejects the
// write (e.g. a non-staff role slips past the route gate). Maps to `unauthorized`.
const PG_INSUFFICIENT_PRIVILEGE = "42501";

export type CreateVehicleResult = { status: "created"; vehicle: Vehicle } | { status: "unauthorized" };
export type UpdateVehicleResult =
  | { status: "updated"; vehicle: Vehicle }
  | { status: "not_found" }
  | { status: "unauthorized" };
export interface SetVehicleActiveResult {
  status: "ok" | "has_active_reservations" | "not_found" | "unauthorized";
}

/**
 * Insert a vehicle as staff. A `null` client (Supabase unconfigured) or an RLS
 * WITH CHECK denial (`42501`) both surface as `unauthorized`; any other Postgres
 * error is a real fault and rethrows.
 */
export async function createVehicle(client: CatalogClient | null, input: VehicleInput): Promise<CreateVehicleResult> {
  if (!client) {
    return { status: "unauthorized" };
  }

  const { data, error } = await client.from("vehicles").insert(input).select("*").single();
  if (error) {
    if (error.code === PG_INSUFFICIENT_PRIVILEGE) {
      return { status: "unauthorized" };
    }
    throw error;
  }
  return { status: "created", vehicle: data };
}

/**
 * Update a vehicle by id as staff. A malformed id or `null` client is
 * `unauthorized`; a missing row (or one hidden by the UPDATE policy's USING
 * clause) returns no row → `not_found`. The id-shape guard mirrors
 * `getVehicleById` — a non-UUID would otherwise 500 in Postgres.
 */
export async function updateVehicle(
  client: CatalogClient | null,
  id: string,
  input: VehicleInput,
): Promise<UpdateVehicleResult> {
  if (!client || !UUID_RE.test(id)) {
    return { status: "unauthorized" };
  }

  const { data, error } = await client.from("vehicles").update(input).eq("id", id).select("*").maybeSingle();
  if (error) {
    if (error.code === PG_INSUFFICIENT_PRIVILEGE) {
      return { status: "unauthorized" };
    }
    throw error;
  }
  if (!data) {
    return { status: "not_found" };
  }
  return { status: "updated", vehicle: data };
}

/**
 * Retire (`active=false`) or restore (`active=true`) a vehicle through the
 * atomic `set_vehicle_active` definer RPC. The RPC holds the retire guard —
 * blocking a flip-to-retired while pending/confirmed reservations exist — and
 * always returns exactly one `{ result }` row whose tag we surface verbatim:
 * `ok` / `has_active_reservations` / `not_found` / `unauthorized`.
 */
export async function setVehicleActive(
  client: CatalogClient | null,
  id: string,
  active: boolean,
): Promise<SetVehicleActiveResult> {
  if (!client || !UUID_RE.test(id)) {
    return { status: "unauthorized" };
  }

  const { data, error } = await client.rpc("set_vehicle_active", { p_id: id, p_active: active });
  if (error) {
    throw error;
  }

  const row = data.at(0);
  switch (row?.result) {
    case "ok":
    case "has_active_reservations":
    case "not_found":
    case "unauthorized":
      return { status: row.result };
    default:
      throw new Error(`set_vehicle_active returned an unexpected result: ${JSON.stringify(data)}`);
  }
}

/**
 * Staff fleet read for the management screen. Unlike the public `listVehicles`,
 * this can include retired vehicles (`includeRetired`) so they can be listed and
 * restored; `includeRetired = false` re-applies the `is_active = true` filter.
 * Orders by `name` (text search is client-side in the island). Degrades a `null`
 * client to `[]`.
 */
export async function listFleet(
  client: CatalogClient | null,
  opts: { category?: VehicleCategory; includeRetired?: boolean } = {},
): Promise<Vehicle[]> {
  if (!client) {
    return [];
  }

  let query = client.from("vehicles").select("*");
  if (opts.category) {
    query = query.eq("category", opts.category);
  }
  if (!opts.includeRetired) {
    query = query.eq("is_active", true);
  }
  query = query.order("name", { ascending: true });

  const { data, error } = await query;
  if (error) {
    throw error;
  }
  return data;
}
