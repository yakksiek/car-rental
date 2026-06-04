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

// Input shape for the pure overlap predicate (src/lib/availability.ts, Phase 2).
// Bare local calendar dates (ISO `YYYY-MM-DD`); the predicate applies the fixed
// hotel-style hours (pickup 14:00, return 10:00) to build the comparable window,
// mirroring the DB's generated `reserved_period` tsrange.
export interface BookingWindow {
  pickupDate: string;
  returnDate: string;
}
