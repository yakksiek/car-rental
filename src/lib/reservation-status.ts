// others
import type { ReservationStatus } from "../types";
import { booking } from "./i18n/booking";
import { translator } from "./i18n/types";
import type { Locale } from "./i18n/types";

// Pure model for the status page's "what happens next" stepper (S-02). One canonical
// ordered step list; `stepperFor` marks each step done/current/upcoming for a
// reservation status. No I/O — this is the model S-03 (confirm/reject) and the
// later pickup/return slices extend. Labels + descriptions come from the
// `booking` namespace (design screens 06 / mobile-4 / desktop-3 give each step a
// one-line muted explanation under its bold title).
//
// The happy path is linear: the request waits for acceptance, the decision
// arrives by email, then the pickup (a later-slice placeholder, always greyed
// in S-02). `rejected`/`cancelled` are terminal branches: the wait is over,
// the terminal step replaces the decision step, and no pickup will happen.

export type StepState = "done" | "current" | "upcoming";

// Icon key for the horizontal "Co dalej" cards (design desktop-3 / mobile-4):
// awaiting → clock, email decision → chat, pickup → key, terminal → x.
export type StepIcon = "clock" | "chat" | "key" | "x";

export interface Step {
  key: "pending" | "decision" | "pickup";
  label: string;
  description: string;
  icon: StepIcon;
  state: StepState;
}

function copyFor(locale: Locale) {
  const t = translator(locale, booking);
  return {
    pending: { label: t("stepPendingLabel"), description: t("stepPendingDesc"), icon: "clock" },
    decision: { label: t("stepDecisionLabel"), description: t("stepDecisionDesc"), icon: "chat" },
    pickup: { label: t("stepPickupLabel"), description: t("stepPickupDesc"), icon: "key" },
    rejected: { label: t("stepRejectedLabel"), description: t("stepRejectedDesc"), icon: "x" },
    cancelled: { label: t("stepCancelledLabel"), description: t("stepCancelledDesc"), icon: "x" },
  } as const;
}

/** Ordered stepper for a reservation status, with its copy in `locale`. */
export function stepperFor(status: ReservationStatus, locale: Locale): Step[] {
  const COPY = copyFor(locale);
  switch (status) {
    case "pending":
      return [
        { key: "pending", ...COPY.pending, state: "current" },
        { key: "decision", ...COPY.decision, state: "upcoming" },
        { key: "pickup", ...COPY.pickup, state: "upcoming" },
      ];
    case "confirmed":
      return [
        { key: "pending", ...COPY.pending, state: "done" },
        { key: "decision", ...COPY.decision, state: "done" },
        { key: "pickup", ...COPY.pickup, state: "current" },
      ];
    case "rejected":
      return [
        { key: "pending", ...COPY.pending, state: "done" },
        { key: "decision", ...COPY.rejected, state: "current" },
      ];
    case "cancelled":
      return [
        { key: "pending", ...COPY.pending, state: "done" },
        { key: "decision", ...COPY.cancelled, state: "current" },
      ];
  }
}
