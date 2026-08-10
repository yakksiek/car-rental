// core
import type { SupabaseClient } from "@supabase/supabase-js";

// others
import type { Database } from "../../db/database.types";
import { reservationConfirmedEmail } from "../email/templates";
import { sendTracked } from "./email-delivery";
import type { DecisionEmailPayload } from "../../types";

// The confirmed-reservation notification, extracted so the two paths that can
// produce a confirmed booking send exactly the same email (S-12):
//   * PATCH /api/reservations/[id] — an employee approving a pending request,
//   * POST  /api/reservations/manual — an employee entering a phone-in booking.
//
// Both feed it a `DecisionEmailPayload`, which is possible only because
// `create_confirmed_reservation` RETURNS the same 11 columns `decide_reservation`
// does. Keeping the send here rather than duplicating it is what stops the two
// paths from drifting on the status link, the vehicle label, or the delivery
// `template` tag the dispatch list reads.

type EmailClient = SupabaseClient<Database>;

/** Display label for the vehicle, e.g. `"Mercedes-Benz Sprinter (2022)"`. */
export function vehicleLabel(email: DecisionEmailPayload): string {
  return [
    [email.vehicle_make, email.vehicle_model].filter(Boolean).join(" "),
    email.vehicle_production_year ? `(${email.vehicle_production_year})` : null,
  ]
    .filter(Boolean)
    .join(" ");
}

/**
 * Send the reservation-confirmed email and record the outcome in
 * `email_deliveries`. **Never throws** — `sendTracked` swallows provider and
 * recording failures — because the booking is already committed by the time this
 * runs, so a send failure must be visible (a `failed` delivery row) but must not
 * fail the request that created it.
 */
export async function notifyReservationConfirmed(
  client: EmailClient | null,
  payload: DecisionEmailPayload,
  origin: string,
  reservationId: string,
): Promise<void> {
  const statusUrl = new URL(`/r/${payload.access_token}`, origin).href;
  const content = reservationConfirmedEmail({
    reference: payload.reference,
    statusUrl,
    vehicle: vehicleLabel(payload),
    pickup: payload.pickup_date,
    return: payload.return_date,
    dailyRate: payload.vehicle_daily_rate,
    deposit: payload.vehicle_deposit,
  });

  await sendTracked(client, payload.customer_email, content, {
    entityType: "reservation",
    entityId: reservationId,
    template: "reservation_confirmed",
  });
}
