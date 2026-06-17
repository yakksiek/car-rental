// core
import type { Resource } from "@ilamy/calendar";

// others
import dayjs from "./dayjs";
import type { CalendarReservation, Vehicle } from "../../types";

// Pure mappers turning domain rows into the calendar library's event/resource
// shapes (S-03 Phase 6). Isolated as pure functions so the edge-case logic — the
// 14:00→10:00 window and the status→color mapping — is unit-testable without a
// UI runner. Times are built in Europe/Warsaw, mirroring the DB's generated
// `reserved_period` tsrange (pickup 14:00, return 10:00).

const TZ = "Europe/Warsaw";

// Event colours from the design tokens (src/styles/global.css): pending = amber
// (warning), confirmed = green (success). The library accepts hex values.
const EVENT_COLORS: Record<CalendarReservation["status"], { backgroundColor: string; color: string }> = {
  pending: { backgroundColor: "#FBF1DA", color: "#B6790E" },
  confirmed: { backgroundColor: "#E3F5EC", color: "#1B9E5A" },
};

// The shape we hand to `IlamyResourceCalendar`'s `events` prop. start/end are ISO
// strings with the Warsaw offset (the prop accepts string | Date | Dayjs and
// converts internally); resourceId binds the bar to its vehicle row.
export interface CalendarEventInput {
  id: string;
  uid: string;
  title: string;
  start: string;
  end: string;
  resourceId: string;
  backgroundColor: string;
  color: string;
}

/** Build an ISO timestamp for `dateIso` at `time` wall-clock in Europe/Warsaw. */
function atWarsaw(dateIso: string, time: string): string {
  return dayjs.tz(`${dateIso}T${time}`, TZ).format();
}

/**
 * Map reservation rows to calendar events: `start = pickup @ 14:00`,
 * `end = return @ 10:00` (Europe/Warsaw), `resourceId = vehicle_id`,
 * `title = customer_name`, with a pending→amber / confirmed→green colour.
 */
export function reservationsToEvents(rows: CalendarReservation[]): CalendarEventInput[] {
  return rows.map((r) => {
    const colors = EVENT_COLORS[r.status];
    return {
      id: r.id,
      uid: r.id,
      title: r.customer_name,
      start: atWarsaw(r.pickup_date, "14:00:00"),
      end: atWarsaw(r.return_date, "10:00:00"),
      resourceId: r.vehicle_id,
      backgroundColor: colors.backgroundColor,
      color: colors.color,
    };
  });
}

/** Map active vehicles to resource rows: `id = vehicle.id`, `title = "<make> <model>"`. */
export function vehiclesToResources(vehicles: Vehicle[]): Resource[] {
  return vehicles.map((v) => {
    const label = [v.make, v.model].filter(Boolean).join(" ");
    return { id: v.id, title: label === "" ? v.name : label };
  });
}
