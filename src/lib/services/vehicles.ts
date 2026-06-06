// core
import type { SupabaseClient } from "@supabase/supabase-js";

// others
import type { Database } from "../../db/database.types";
import type { Vehicle, VehicleFilters } from "../../types";

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
 * List active vehicles (no date filter). RLS limits rows to `is_active = true`.
 * Applies category / minimum-payload filters and a daily-rate sort.
 */
export async function listVehicles(client: CatalogClient | null, filters: VehicleFilters): Promise<Vehicle[]> {
  if (!client) {
    return [];
  }

  let query = client.from("vehicles").select("*");
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

/**
 * Fetch one active vehicle by id, or `null` when missing or inactive (RLS hides
 * inactive rows, so the detail route renders a 404 for both).
 */
export async function getVehicleById(client: CatalogClient | null, id: string): Promise<Vehicle | null> {
  if (!client) {
    return null;
  }

  const { data, error } = await client.from("vehicles").select("*").eq("id", id).maybeSingle();
  if (error) {
    throw error;
  }
  return data;
}
