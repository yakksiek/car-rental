// core
import type { Locale } from "./types";

// others
import type { RejectionReason, ReservationStatus } from "../../types";

// ---------------------------------------------------------------------------
// Reservation vocabulary — the status pill and the four canned rejection
// reasons, moved out of `format.ts` with the rest of the enum dictionaries
// (Phase 1 §1). Same `Record<Locale, Record<Enum, string>>` shape and the same
// reason as `./vehicle.ts`: it checks both axes exhaustively.
//
// `STATUS_LABELS` is the single source for BOTH the status card
// (`ReservationStatusCard.astro`) and the S-13 search rows
// (`SearchRows.tsx`) — extracted precisely so the two cannot drift. Tints stay
// per-surface (each pill idiom differs); only the wording is shared.
// ---------------------------------------------------------------------------

const STATUS_LABELS: Record<Locale, Record<ReservationStatus, string>> = {
  en: {
    pending: "Pending",
    confirmed: "Confirmed",
    rejected: "Rejected",
    cancelled: "Cancelled",
  },
  pl: {
    pending: "Oczekuje",
    confirmed: "Potwierdzone",
    rejected: "Odrzucone",
    cancelled: "Anulowane",
  },
};

/** Label for a reservation status enum value, in the active locale. */
export function reservationStatusLabel(status: ReservationStatus, locale: Locale): string {
  return STATUS_LABELS[locale][status];
}

// Canonical labels for the four canned rejection reasons (S-03). Single source
// for the reject-reason sheet and the rejection email. English harvested from
// the design source's `STR.EN.reason1-4`.
const REJECTION_REASON_LABELS: Record<Locale, Record<RejectionReason, string>> = {
  en: {
    dates_unavailable: "Dates no longer available",
    no_category: "Missing licence category",
    vehicle_withdrawn: "Vehicle withdrawn",
    other: "Other",
  },
  pl: {
    dates_unavailable: "Daty już niedostępne",
    no_category: "Brak wymaganej kategorii",
    vehicle_withdrawn: "Pojazd wycofany",
    other: "Inny",
  },
};

/** Label for a rejection-reason enum value, in the active locale. */
export function rejectionReasonLabel(reason: RejectionReason, locale: Locale): string {
  return REJECTION_REASON_LABELS[locale][reason];
}
