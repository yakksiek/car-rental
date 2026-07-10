// core
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";

// others
import type { Database } from "../../src/db/database.types";

// Test-data fixtures for the E2E suite. Rows are created and destroyed through a
// service-role client rather than by driving the UI, so a spec never depends on
// the funnel it isn't testing.
//
// SERVICE-ROLE ISOLATION INVARIANT (same rule as `tests/helpers/clients.ts`):
// this client bypasses RLS. It exists ONLY for setup/teardown. NEVER run an
// access assertion through it — that would make a PII-leak test pass falsely.
// Browser-side assertions go through the real app, which is subject to RLS
// exactly as production callers are.

// `playwright.config.ts` loads `.env.test` before any spec imports this module;
// the `?? ""` only satisfies the type checker.
const SUPABASE_URL = process.env.SUPABASE_URL ?? "";
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

// Typed with the generated `Database` so inserted/selected rows keep their shape
// — an untyped client returns `any`, which would silently swallow a column
// rename in the fixture rather than failing the typecheck.
function serviceClient() {
  return createClient<Database>(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } });
}

/** ISO `YYYY-MM-DD` for a given day of the month after this one. */
export function nextMonthDay(day: number): string {
  const now = new Date();
  const target = new Date(Date.UTC(now.getFullYear(), now.getMonth() + 1, day));
  const month = String(target.getUTCMonth() + 1).padStart(2, "0");
  return `${target.getUTCFullYear()}-${month}-${String(target.getUTCDate()).padStart(2, "0")}`;
}

export interface BookedVehicle {
  vehicleId: string;
  /** The confirmed booking's pickup day — a `returnOnly` changeover day. */
  bookedFrom: string;
  /** The confirmed booking's return day — a `pickupOnly` changeover day. */
  bookedTo: string;
}

/**
 * Create a vehicle nobody else is looking at, carrying one `confirmed`
 * reservation over `[bookedFrom, bookedTo]`.
 *
 * A dedicated vehicle per test — rather than a shared seeded one — is what makes
 * the suite safe under `fullyParallel`: two specs can never contend for the same
 * calendar. The name carries a timestamp so a crashed run leaves an identifiable
 * row rather than a collision.
 *
 * Dates land in the *following* month so they are always in the future (the
 * calendar disables past days) and always reachable with exactly one click of
 * "Go to the Next Month".
 */
export async function createBookedVehicle(): Promise<BookedVehicle> {
  const db = serviceClient();
  const stamp = Date.now();
  const bookedFrom = nextMonthDay(10);
  const bookedTo = nextMonthDay(14);

  const { data: vehicle, error: vehicleError } = await db
    .from("vehicles")
    .insert({
      name: `E2E Fixture ${stamp}`,
      // `plate` is NOT NULL + unique since S-05. It carries the same timestamp
      // stamp as the name so parallel runs and re-runs never collide on it.
      plate: `E2E ${stamp}`,
      category: "cargo_van",
      make: "E2E",
      model: "Fixture",
      production_year: 2024,
      fuel_type: "diesel",
      payload_capacity_kg: 1000,
      cargo_length_cm: 400,
      cargo_width_cm: 170,
      cargo_height_cm: 190,
      photos: ["https://picsum.photos/seed/e2e/960/600"],
      daily_rate: 200,
      monthly_rate: 5000,
      deposit: 1500,
      per_extra_km_rate: 1.0,
      km_limit: 300,
      seats: 3,
      transmission: "manual",
      is_active: true,
    })
    .select("id")
    .single();
  if (vehicleError) {
    throw new Error(`fixture: vehicle insert failed — ${vehicleError.message}`);
  }

  const { error: reservationError } = await db.from("reservations").insert({
    vehicle_id: vehicle.id,
    customer_name: "E2E Fixture",
    customer_email: `e2e-${stamp}@example.test`,
    customer_phone: "+48600100200",
    pickup_date: bookedFrom,
    return_date: bookedTo,
    // `confirmed` (not `pending`) so the row is unambiguously a real booking;
    // both statuses block, per the partial index on the EXCLUDE constraint.
    status: "confirmed",
    reference: `E2E-${stamp}`,
    access_token: randomUUID(),
  });
  if (reservationError) {
    // Don't leave the vehicle behind if only the reservation failed.
    await db.from("vehicles").delete().eq("id", vehicle.id);
    throw new Error(`fixture: reservation insert failed — ${reservationError.message}`);
  }

  return { vehicleId: vehicle.id, bookedFrom, bookedTo };
}

/**
 * Tear down a fixture vehicle and everything hanging off it. Safe to call twice
 * and safe to call on a vehicle that was never created — an `afterEach` running
 * after a mid-test failure must not raise a second, masking error.
 */
export async function deleteVehicle(vehicleId: string): Promise<void> {
  const db = serviceClient();
  await db.from("reservations").delete().eq("vehicle_id", vehicleId);
  await db.from("vehicles").delete().eq("id", vehicleId);
}
