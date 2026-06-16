// core
import type { SupabaseClient } from "@supabase/supabase-js";

// others
import type { Database } from "../../db/database.types";
import type {
  CreateReservationInput,
  CreateReservationResult,
  ReservationStatusView,
  VehicleBusyRange,
} from "../../types";

// The single home for reservation data access (S-02). `reservations` is
// anon-denied by design, so every call here crosses the RLS boundary through a
// SECURITY DEFINER RPC — the write (`create_reservation_request`), the status
// read (`get_reservation_status`), and the availability pre-check
// (`available_vehicles`, shared with the catalog). Mirrors the vehicles
// service: every function takes the per-request client and degrades gracefully
// when it is `null` (Supabase unconfigured) rather than throwing.

type ReservationClient = SupabaseClient<Database>;

// Same guard as the vehicles service: a malformed uuid would make Postgres
// throw `invalid input syntax for type uuid` (a 500) instead of "not found".
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Create a public reservation request via the definer RPC. The RPC attempts
 * the insert under the `reservations_no_overlap` EXCLUDE constraint and maps
 * a collision to the typed `conflict` tag — never check-then-insert, so the
 * no-double-booking guarantee stays atomic (first insert wins).
 *
 * A `null` client (or malformed vehicle id) degrades to `unavailable` — the
 * funnel cannot create anything, which is exactly what that tag means.
 */
export async function createReservationRequest(
  client: ReservationClient | null,
  input: CreateReservationInput,
): Promise<CreateReservationResult> {
  if (!client || !UUID_RE.test(input.vehicle_id)) {
    return { status: "unavailable" };
  }

  const { data, error } = await client.rpc("create_reservation_request", {
    p_vehicle_id: input.vehicle_id,
    p_pickup: input.pickup,
    p_return: input.return,
    p_customer_name: input.customer_name,
    p_customer_email: input.customer_email,
    p_customer_phone: input.customer_phone,
    p_terms_accepted: input.terms_accepted,
    p_company: input.company,
    p_vat_id: input.vat_id,
    p_notes: input.notes,
  });
  if (error) {
    throw error;
  }

  // The RPC always returns exactly one row with a result tag.
  const row = data.at(0);
  switch (row?.result) {
    case "created":
      return { status: "created", reference: row.reference, token: row.access_token };
    case "conflict":
      return { status: "conflict" };
    case "unavailable":
      return { status: "unavailable" };
    default:
      throw new Error(`create_reservation_request returned an unexpected result: ${JSON.stringify(data)}`);
  }
}

/**
 * Resolve a reservation's display fields by its secret `access_token` via the
 * definer RPC. Returns `null` for an unknown/malformed token or a `null`
 * client — the status route turns that into a 404.
 */
export async function getReservationStatus(
  client: ReservationClient | null,
  token: string,
): Promise<ReservationStatusView | null> {
  if (!client || !UUID_RE.test(token)) {
    return null;
  }

  const { data, error } = await client.rpc("get_reservation_status", { p_token: token });
  if (error) {
    throw error;
  }
  return data.at(0) ?? null;
}

/**
 * Pre-submit availability check: is the vehicle still bookable for the range?
 * Reuses the catalog's `available_vehicles` RPC (the same half-open window the
 * EXCLUDE constraint enforces) and checks the vehicle is in the result. UX
 * sugar only — the constraint inside `create_reservation_request` is the
 * authority. A `null` client degrades to `false` (cannot confirm availability).
 */
export async function isVehicleAvailable(
  client: ReservationClient | null,
  vehicleId: string,
  pickup: string,
  returnDate: string,
): Promise<boolean> {
  if (!client || !UUID_RE.test(vehicleId)) {
    return false;
  }

  const { data, error } = await client
    .rpc("available_vehicles", { p_pickup: pickup, p_return: returnDate })
    .select("id")
    .eq("id", vehicleId);
  if (error) {
    throw error;
  }
  return data.length > 0;
}

/**
 * Fetch the date bounds of a vehicle's blocking reservations (pending +
 * confirmed) via the PII-safe `get_vehicle_busy_ranges` definer RPC. The
 * booking calendar SSRs these in and greys the taken dates so a visitor never
 * picks an unavailable range (S-02 Phase 6). Returns `[]` for a `null`/
 * misconfigured client, a malformed id, OR an RPC error — the greying is
 * advisory UX sugar, so its failure must never 500 the (otherwise working)
 * detail page; the calendar simply greys nothing and the EXCLUDE constraint
 * remains the atomic backstop. (Unlike the write/status reads, which ARE the
 * point of their page and so propagate errors.)
 */
export async function getVehicleBusyRanges(
  client: ReservationClient | null,
  vehicleId: string,
): Promise<VehicleBusyRange[]> {
  if (!client || !UUID_RE.test(vehicleId)) {
    return [];
  }

  const { data, error } = await client.rpc("get_vehicle_busy_ranges", { p_vehicle_id: vehicleId });
  if (error) {
    // eslint-disable-next-line no-console
    console.error("[getVehicleBusyRanges] RPC failed; calendar greys nothing this load:", error);
    return [];
  }
  return data;
}
