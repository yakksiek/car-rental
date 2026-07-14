// core
import * as React from "react";

// The resend mechanism (S-05 Phase 6), shared by the dispatch row and the
// protocol view. It owns the `POST /api/protocols/[id]/resend-email` call and
// classifies the response into a typed outcome; the caller decides how to
// reflect it (re-derive the badge, show a banner). No UI here.
//
// The route re-signs the stored PDF and re-sends, returning 200 with the new
// delivery status in the body regardless of the provider outcome — a failed
// send is a `failed` body field, never an HTTP error. A null `pdf_path` (the PDF
// never generated) is the one hard 409: there is nothing to attach, so the
// employee must regenerate from the form rather than resend.

export type ResendOutcome = { status: "sent" | "failed" } | { status: "no_pdf" } | { status: "error" };

export async function postResend(protocolId: string): Promise<ResendOutcome> {
  try {
    const res = await fetch(`/api/protocols/${protocolId}/resend-email`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });
    if (res.status === 200) {
      const body = (await res.json()) as { delivery: "sent" | "failed" };
      return { status: body.delivery };
    }
    if (res.status === 409) {
      return { status: "no_pdf" };
    }
    return { status: "error" };
  } catch {
    return { status: "error" };
  }
}

/**
 * `resend(id)` POSTs the resend and returns the typed outcome while tracking an
 * in-flight `busy` flag (so the caller can disable its button). Matches
 * `useReservationDecision`'s shape exactly.
 */
export function useResendEmail() {
  const [busy, setBusy] = React.useState(false);

  const resend = React.useCallback(async (protocolId: string): Promise<ResendOutcome> => {
    setBusy(true);
    const outcome = await postResend(protocolId);
    setBusy(false);
    return outcome;
  }, []);

  return { busy, resend };
}
