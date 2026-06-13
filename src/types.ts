// core
import type { Database } from "./db/database.types";

// Generated database contract — regenerate after any schema change with:
//   supabase gen types typescript --linked > src/db/database.types.ts
// (or `--local` against a running local stack). Never hand-edit database.types.ts.
export type { Database };

// ---------------------------------------------------------------------------
// Entity / DTO aliases
//
// NOTE on money fields: numeric(10,2) columns (daily_rate, monthly_rate,
// deposit, per_extra_km_rate, payload_capacity_kg, cargo_* dimensions)
// deserialize to `string` in supabase-js, not `number`. The formatter / DTO
// layer owns parsing — do not assume these are numbers at the call site.
// ---------------------------------------------------------------------------

export type Vehicle = Database["public"]["Tables"]["vehicles"]["Row"];
export type VehicleInsert = Database["public"]["Tables"]["vehicles"]["Insert"];

export type Reservation = Database["public"]["Tables"]["reservations"]["Row"];
export type ReservationInsert = Database["public"]["Tables"]["reservations"]["Insert"];

export type VehicleCategory = Database["public"]["Enums"]["vehicle_category"];
export type ReservationStatus = Database["public"]["Enums"]["reservation_status"];
export type Transmission = Database["public"]["Enums"]["transmission_type"];

// Role layer (F-02): profiles map auth.users -> app_role. A user with no
// profiles row resolves to role = null and is denied (fail-closed).
export type Profile = Database["public"]["Tables"]["profiles"]["Row"];
export type ProfileInsert = Database["public"]["Tables"]["profiles"]["Insert"];

export type AppRole = Database["public"]["Enums"]["app_role"];

// ---------------------------------------------------------------------------
// Public reservation request (S-02) — the funnel's domain contracts. The write
// and the status read both cross the RLS boundary via SECURITY DEFINER RPCs
// (`reservations` itself stays anon-denied), so these are RPC-shaped, not
// table-row-shaped.
// ---------------------------------------------------------------------------

// Snake_case mirrors the POST body / RPC arguments so the zod-parsed payload
// flows into the service without a mapping layer. Dates are ISO `YYYY-MM-DD`.
export interface CreateReservationInput {
  vehicle_id: string;
  pickup: string;
  return: string;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  terms_accepted: boolean;
  // Optional B2B fields (S-02 Phase 5): captured on the form, stored for later
  // invoicing (company/VAT) and surfaced to staff in S-03 (notes). Empty when
  // a private customer skips them.
  company?: string;
  vat_id?: string;
  notes?: string;
}

// Typed union over the RPC's result tag. `conflict` is the north-star case:
// the EXCLUDE constraint rejected an overlapping range atomically.
export type CreateReservationResult =
  | { status: "created"; reference: string; token: string }
  | { status: "conflict" }
  | { status: "unavailable" };

// One row of display fields for the tokenized status page (`/r/<token>`).
// NOTE: vehicle_daily_rate / vehicle_deposit are numeric(10,2) → string at
// runtime despite the generated `number` type (see the money note above).
export type ReservationStatusView = Database["public"]["Functions"]["get_reservation_status"]["Returns"][number];

// Input shape for the pure overlap predicate (src/lib/availability.ts, Phase 2).
// Bare local calendar dates (ISO `YYYY-MM-DD`); the predicate applies the fixed
// hotel-style hours (pickup 14:00, return 10:00) to build the comparable window,
// mirroring the DB's generated `reserved_period` tsrange.
export interface BookingWindow {
  pickupDate: string;
  returnDate: string;
}

// ---------------------------------------------------------------------------
// Public catalog (S-01) — filter state carried in the URL and read by the
// fleet listing + filter island. `pickup`/`return` are ISO `YYYY-MM-DD` strings
// (or null when no range is set); presence of a *valid* range routes the query
// from `listVehicles` to `searchAvailableVehicles`.
// ---------------------------------------------------------------------------

export type CatalogSort = "price_asc" | "price_desc";

export interface VehicleFilters {
  category: VehicleCategory | null;
  pickup: string | null;
  return: string | null;
  minPayload: number | null;
  sort: CatalogSort | null;
}
