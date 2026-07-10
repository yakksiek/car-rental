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

// One blocking reservation's date bounds for the per-vehicle busy-ranges RPC
// (S-02 Phase 6). Date-only `[pickup_date, return_date]` ISO `YYYY-MM-DD`, no
// PII — the booking calendar greys these out so a visitor never picks a taken
// range. The EXCLUDE constraint stays the atomic backstop.
export type VehicleBusyRange = Database["public"]["Functions"]["get_vehicle_busy_ranges"]["Returns"][number];

// ---------------------------------------------------------------------------
// Reservation approval (S-03) — the employee decision contracts. Like the S-02
// reads, the queue read and the decision write both cross the RLS boundary via
// SECURITY DEFINER RPCs (`list_pending_reservations`, `decide_reservation`), so
// these are RPC-shaped. NOTE: vehicle_daily_rate / vehicle_deposit are
// numeric(10,2) → string at runtime despite the generated `number` type.
// ---------------------------------------------------------------------------

// One row of the employee pending queue: customer + B2B fields + vehicle summary
// + dates + reference + created_at, newest first.
export type PendingReservation = Database["public"]["Functions"]["list_pending_reservations"]["Returns"][number];

// The four canned rejection reasons (mirrors the DB CHECK on rejection_reason).
// `other` accepts a short free-text note.
export type RejectionReason = "dates_unavailable" | "no_category" | "vehicle_withdrawn" | "other";

// The decision RPC's success payload (every returned field except the `result`
// tag) — the customer + vehicle fields the notification email needs.
export type DecisionEmailPayload = Omit<
  Database["public"]["Functions"]["decide_reservation"]["Returns"][number],
  "result"
>;

// Typed union over `decide_reservation`'s result tag, mirroring
// CreateReservationResult's tagged-union style. A committed decision carries the
// email payload; every other tag is an outcome the endpoint maps to a status code.
export type DecideReservationResult =
  | { status: "confirmed" | "rejected"; email: DecisionEmailPayload }
  | { status: "already_decided" }
  | { status: "not_found" }
  | { status: "unauthorized" }
  | { status: "invalid_reason" };

// One reservation bar for the resource-timeline calendar (S-03 Phase 6): the
// fields needed to plot it (no PII beyond the customer name shown on the bar).
// Read through the role-gated `list_reservations_for_calendar` definer RPC;
// status is always `pending`/`confirmed` (the RPC filters the rest out).
export interface CalendarReservation {
  id: string;
  reference: string;
  status: "pending" | "confirmed";
  customer_name: string;
  vehicle_id: string;
  vehicle_make: string | null;
  vehicle_model: string | null;
  pickup_date: string;
  return_date: string;
}

// Input shape for the pure overlap predicate (src/lib/availability.ts, Phase 2).
// Bare local calendar dates (ISO `YYYY-MM-DD`); the predicate applies the fixed
// hotel-style hours (pickup 14:00, return 10:00) to build the comparable window,
// mirroring the DB's generated `reserved_period` tsrange.
export interface BookingWindow {
  pickupDate: string;
  returnDate: string;
}

// ---------------------------------------------------------------------------
// Issue protocol (S-05) — the handover record. Like S-02/S-03, every read and
// write crosses the RLS boundary through a SECURITY DEFINER RPC (the five new
// tables carry a `revoke all` and no policies at all), so the view contracts are
// RPC-shaped while the entities are table-row-shaped.
//
// "Issued" is not a reservation_status value — it is the existence of a
// `protocols` row, which is why the EXCLUDE overlap predicate is untouched.
//
// NOTE: `odometer_km` is `int` and `fuel_eighths` is `smallint`, so both really
// are numbers at runtime — unlike the numeric(10,2) money fields above. Do not
// add a numeric column here.
// ---------------------------------------------------------------------------

export type Protocol = Database["public"]["Tables"]["protocols"]["Row"];
export type ProtocolPhoto = Database["public"]["Tables"]["protocol_photos"]["Row"];
export type ProtocolDamage = Database["public"]["Tables"]["protocol_damages"]["Row"];
export type EmailDelivery = Database["public"]["Tables"]["email_deliveries"]["Row"];

export type ProtocolPhotoSlot = Database["public"]["Enums"]["protocol_photo_slot"];
export type ProtocolDamageType = Database["public"]["Enums"]["protocol_damage_type"];

// One row of the dispatch list: today's confirmed reservations with their
// protocol state folded in. `protocol_id` null ⇒ still awaiting handover (the
// row offers `Wydaj`); non-null ⇒ already issued, carrying `pdf_path` and the
// newest delivery status for the badge + resend action. `last_odometer_km` is
// the soft-warning baseline, never a hard block.
export type DispatchRow = Database["public"]["Functions"]["list_dispatch_today"]["Returns"][number];

// The full protocol for the read-only view screen: photos and damages arrive as
// jsonb aggregates, so they are typed here rather than left as `Json`.
export type ProtocolView = Omit<
  Database["public"]["Functions"]["get_protocol"]["Returns"][number],
  "photos" | "damages"
> & {
  photos: { slot: ProtocolPhotoSlot; path: string }[];
  damages: ProtocolDamageItem[];
};

// A damage item as it crosses the wire: `id` is client-minted (it keys the
// item's storage objects, so it must exist before the first byte uploads).
// The `existing | new` tag is derived at return time (S-06) by diffing against
// this issue baseline — never stored at pickup.
export interface ProtocolDamageItem {
  id: string;
  type: ProtocolDamageType;
  location: string;
  size: string | null;
  photos: string[];
}

// Typed union over `create_protocol`'s result tag. `conflict` carries the
// existing protocol's id so the conflict screen can link to it.
export type CreateProtocolResult =
  | { status: "ok"; protocolId: string }
  | { status: "conflict"; protocolId: string }
  | { status: "not_found" }
  | { status: "not_confirmed" }
  | { status: "unauthorized" };

// The outcome of a tracked send. Never thrown — recorded in `email_deliveries`
// and surfaced on the dispatch row, because email is the customer's only channel.
export type DeliveryStatus = "sent" | "failed";

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
