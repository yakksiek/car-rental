// core
import * as React from "react";

// others
import type { RejectionReason } from "../../types";

// The single decision mechanism (S-03 Phase 7), shared by the pending queue and
// the calendar. It owns the PATCH /api/reservations/[id] call and classifies the
// response into a typed outcome; the caller decides how to reflect it (result
// overlay, list removal, calendar recolor, banner). No UI here.

export type DecisionOutcome =
  | { status: "confirmed" | "rejected" }
  | { status: "already_decided" }
  | { status: "error" };

export async function postDecision(
  id: string,
  decision: "confirm" | "reject",
  reason?: RejectionReason,
  note?: string,
): Promise<DecisionOutcome> {
  const payload: { decision: "confirm" | "reject"; reason?: RejectionReason; note?: string } = { decision };
  if (reason) {
    payload.reason = reason;
  }
  const trimmedNote = note?.trim();
  if (trimmedNote) {
    payload.note = trimmedNote;
  }
  try {
    const res = await fetch(`/api/reservations/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (res.status === 200) {
      const body = (await res.json()) as { status: "confirmed" | "rejected" };
      return { status: body.status };
    }
    if (res.status === 409) {
      return { status: "already_decided" };
    }
    return { status: "error" };
  } catch {
    return { status: "error" };
  }
}

/**
 * `decide(...)` PATCHes the decision and returns the typed outcome while tracking
 * an in-flight `busy` flag (so the caller can disable its buttons). The caller
 * awaits the outcome and updates its own view state.
 */
export function useReservationDecision() {
  const [busy, setBusy] = React.useState(false);

  const decide = React.useCallback(
    async (
      id: string,
      decision: "confirm" | "reject",
      reason?: RejectionReason,
      note?: string,
    ): Promise<DecisionOutcome> => {
      setBusy(true);
      const outcome = await postDecision(id, decision, reason, note);
      setBusy(false);
      return outcome;
    },
    [],
  );

  return { busy, decide };
}
