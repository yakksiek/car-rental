// core
import type { SupabaseClient } from "@supabase/supabase-js";

// others
import type { Database } from "../../db/database.types";
import type {
  ReservationStatus,
  SearchResultReservation,
  SearchResultReturn,
  SearchResultVehicle,
  SearchResults,
  SearchRow,
  VehicleCategory,
} from "../../types";

// The single home for staff global-search data access (S-13). Like every other
// staff read, it crosses the RLS boundary through a SECURITY DEFINER RPC —
// `reservations` SELECT is revoked and `protocols` is policy-less, so the search
// simply cannot be assembled client-side. The RPC gates on `current_app_role()`
// itself, so this is safe to call with any authenticated client: a non-staff
// caller gets zero rows, not an error.
//
// Mirrors the reservations/vehicles services: takes the per-request client and
// degrades to empty groups when it is `null` (Supabase unconfigured) rather than
// throwing.

type SearchClient = SupabaseClient<Database>;

/** Mirrors the RPC's own guard (and the endpoint's zod rule) — see the migration. */
export const MIN_QUERY_LENGTH = 2;

const EMPTY: SearchResults = { reservations: [], returns: [], vehicles: [] };

/**
 * Split the RPC's tagged union rows into the three groups the UI renders.
 *
 * Pure and exported for its own unit test: it is the one place the union row's
 * per-kind nullability is resolved, so an unexpected `kind` (or a row missing the
 * fields its kind promises) must be dropped rather than rendered as a half-empty
 * card. Row order within a group is preserved — the RPC already ranked it.
 */
export function groupSearchRows(rows: SearchRow[]): SearchResults {
  const results: SearchResults = { reservations: [], returns: [], vehicles: [] };

  for (const row of rows) {
    switch (row.kind) {
      case "reservation": {
        const reservation = toReservation(row);
        if (reservation) {
          results.reservations.push(reservation);
        }
        break;
      }
      case "return": {
        const reservation = toReservation(row);
        // The RPC emits only these two states for a return row; anything else is
        // a contract break, not a rendering decision.
        if (reservation && (row.status === "due" || row.status === "returned")) {
          results.returns.push({ ...reservation, status: row.status } satisfies SearchResultReturn);
        }
        break;
      }
      case "vehicle":
        results.vehicles.push({
          id: row.id,
          name: row.vehicle_name,
          make: row.vehicle_make,
          model: row.vehicle_model,
          plate: row.vehicle_plate,
          category: row.vehicle_category as VehicleCategory,
          is_active: row.status === "active",
          daily_rate: row.daily_rate,
        } satisfies SearchResultVehicle);
        break;
      default:
        // Unknown tag — ignore rather than guess which group it belongs to.
        break;
    }
  }

  return results;
}

/** The reservation-shaped core both `reservation` and `return` rows carry, or null if incomplete. */
function toReservation(row: SearchRow): SearchResultReservation | null {
  if (row.reference === null || row.customer_name === null || row.pickup_date === null || row.return_date === null) {
    return null;
  }
  return {
    id: row.id,
    reference: row.reference,
    customer_name: row.customer_name,
    vehicle_id: row.vehicle_id,
    vehicle_name: row.vehicle_name,
    vehicle_make: row.vehicle_make,
    vehicle_model: row.vehicle_model,
    vehicle_plate: row.vehicle_plate,
    pickup_date: row.pickup_date,
    return_date: row.return_date,
    status: row.status as ReservationStatus,
    daily_rate: row.daily_rate,
  };
}

/**
 * Search reservations / returns / vehicles for `query` via the role-gated
 * `search_staff` definer RPC, grouped for rendering. A blank or too-short query
 * (and a `null` client) short-circuits to empty groups without a round-trip —
 * the resting dropdown asks for nothing.
 */
export async function searchStaff(client: SearchClient | null, query: string): Promise<SearchResults> {
  const trimmed = query.trim();
  if (!client || trimmed.length < MIN_QUERY_LENGTH) {
    return EMPTY;
  }

  const { data, error } = await client.rpc("search_staff", { p_query: trimmed });
  if (error) {
    throw error;
  }
  return groupSearchRows(data);
}
