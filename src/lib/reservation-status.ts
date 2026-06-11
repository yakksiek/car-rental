// others
import type { ReservationStatus } from "../types";

// Pure model for the status page's "CO DALEJ" stepper (S-02). One canonical
// ordered step list; `stepperFor` marks each step done/current/upcoming for a
// reservation status. No I/O — this is the model S-03 (confirm/reject) and the
// later pickup/return slices extend. Polish labels are canonical (design
// screens 06 / mobile-4 / desktop-3).
//
// The happy path is linear: the request waits for acceptance, the decision
// arrives by email, then the pickup (a later-slice placeholder, always greyed
// in S-02). `rejected`/`cancelled` are terminal branches: the wait is over,
// the terminal step replaces the decision step, and no pickup will happen.

export type StepState = "done" | "current" | "upcoming";

export interface Step {
  key: "pending" | "decision" | "pickup";
  label: string;
  state: StepState;
}

const LABELS = {
  pending: "Oczekuje na akceptację",
  decision: "Potwierdzenie e-mailem",
  pickup: "Odbiór",
  rejected: "Odrzucone",
  cancelled: "Anulowane",
} as const;

/** Ordered stepper for a reservation status, Polish labels included. */
export function stepperFor(status: ReservationStatus): Step[] {
  switch (status) {
    case "pending":
      return [
        { key: "pending", label: LABELS.pending, state: "current" },
        { key: "decision", label: LABELS.decision, state: "upcoming" },
        { key: "pickup", label: LABELS.pickup, state: "upcoming" },
      ];
    case "confirmed":
      return [
        { key: "pending", label: LABELS.pending, state: "done" },
        { key: "decision", label: LABELS.decision, state: "done" },
        { key: "pickup", label: LABELS.pickup, state: "current" },
      ];
    case "rejected":
      return [
        { key: "pending", label: LABELS.pending, state: "done" },
        { key: "decision", label: LABELS.rejected, state: "current" },
      ];
    case "cancelled":
      return [
        { key: "pending", label: LABELS.pending, state: "done" },
        { key: "decision", label: LABELS.cancelled, state: "current" },
      ];
  }
}
