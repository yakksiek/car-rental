// core
import type { SupabaseClient } from "@supabase/supabase-js";

// others
import type { Database } from "../../db/database.types";
import type {
  CalendarReservation,
  CreateReservationInput,
  CreateReservationResult,
  DecideReservationResult,
  PendingReservation,
  RejectionReason,
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
 * List the employee pending queue via the `list_pending_reservations` definer
 * RPC — every pending request joined with its vehicle's display fields, newest
 * first. The RPC itself gates on the caller's app_role (a non-staff caller gets
 * zero rows), so this is safe to call with any authenticated client. Returns
 * `[]` for a `null` client (Supabase unconfigured).
 */
export async function listPendingReservations(client: ReservationClient | null): Promise<PendingReservation[]> {
  if (!client) {
    return [];
  }

  const { data, error } = await client.rpc("list_pending_reservations");
  if (error) {
    throw error;
  }
  return data;
}

/**
 * Apply an employee decision to a pending reservation via the `decide_reservation`
 * definer RPC. The RPC is the single transition authority: it gates on role,
 * locks + re-reads the row's status, and either flips it (confirm/reject) or
 * returns a typed non-success tag. We translate its `result` into the
 * `DecideReservationResult` union the endpoint maps to status codes.
 *
 * A `null` client (or malformed id) degrades to `unauthorized` — the caller
 * cannot mutate anything, which the endpoint surfaces as a 403.
 */
export async function decideReservation(
  client: ReservationClient | null,
  id: string,
  decision: "confirm" | "reject",
  reason?: RejectionReason,
  note?: string,
): Promise<DecideReservationResult> {
  if (!client || !UUID_RE.test(id)) {
    return { status: "unauthorized" };
  }

  const { data, error } = await client.rpc("decide_reservation", {
    p_id: id,
    p_decision: decision,
    p_reason: reason ?? undefined,
    p_note: note ?? undefined,
  });
  if (error) {
    throw error;
  }

  // The RPC always returns exactly one row with a result tag.
  const row = data.at(0);
  switch (row?.result) {
    case "confirmed":
    case "rejected": {
      const { result, ...email } = row;
      return { status: result, email };
    }
    case "already_decided":
      return { status: "already_decided" };
    case "not_found":
      return { status: "not_found" };
    case "unauthorized":
      return { status: "unauthorized" };
    case "invalid_reason":
      return { status: "invalid_reason" };
    default:
      throw new Error(`decide_reservation returned an unexpected result: ${JSON.stringify(data)}`);
  }
}

/**
 * List the pending + confirmed reservations overlapping `[rangeStart, rangeEnd]`
 * for the resource-timeline calendar, via the role-gated
 * `list_reservations_for_calendar` definer RPC. Returns `[]` for a `null` client.
 * The RPC only ever returns `pending`/`confirmed` rows, so the cast narrows the
 * generated enum status to the calendar's two-value union.
 */
export async function listReservationsForCalendar(
  client: ReservationClient | null,
  rangeStart: string,
  rangeEnd: string,
): Promise<CalendarReservation[]> {
  if (!client) {
    return [];
  }

  const { data, error } = await client.rpc("list_reservations_for_calendar", {
    p_start: rangeStart,
    p_end: rangeEnd,
  });
  if (error) {
    throw error;
  }
  return data as CalendarReservation[];
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
