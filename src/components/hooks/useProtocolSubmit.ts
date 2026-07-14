// core
import * as React from "react";

// others
import type { ProtocolInput } from "../../lib/protocol-schema";

// The ordering here is the whole slice. Get it wrong and an employee is stranded
// at a vehicle with a customer waiting.
//
//   1. Photos are already in storage (uploaded per tile during the form session).
//   2. The signature PNG is already in storage (uploaded when the customer lifts
//      their finger — that is also when `signed_at` is fixed).
//   3. POST /api/protocols → **the protocol now exists.** No email is sent.
//   4. Build the PDF client-side.
//   5. Upload the PDF to storage.
//   6. POST /api/protocols/[id]/pdf → the server stores `pdf_path`, mints a
//      short-TTL signed URL and **sends the mail**. Its body carries the delivery
//      status; the HTTP status stays 200 either way.
//
// The send is step 6, not step 3, because until step 5 completes there is no
// object for Resend to fetch server-side — it would deliver an empty mail while
// `email_deliveries` recorded `sent`.
//
// If step 4, 5 or 6 throws outright, **do not roll back**. The handover physically
// happened; show the `pdf` overlay and let the dispatch list recover it. Blocking
// submission on PDF generation would strand the employee at the vehicle.
//
// A bare async function plus a thin hook holding the `submitting` flag, matching
// `useReservationDecision.ts`. No UI here.

export type ProtocolSubmitOutcome =
  /** Committed, PDF stored, mail delivered. */
  | { status: "sent" }
  /** Committed, PDF stored, the provider send failed — resend is live. */
  | { status: "email" }
  /** Committed, but the PDF never landed, so no send was attempted — regenerate. */
  | { status: "pdf" }
  /** `unique (reservation_id)` bit: this reservation already has a protocol. */
  | { status: "conflict"; protocolId: string }
  /** The trust boundary rejected the payload; re-map onto the fields. */
  | { status: "errors"; errors: Record<string, string> }
  | { status: "error"; message?: string };

interface Deps {
  /** Build the PDF and upload it. Resolves to its `issue/<protocolId>/protocol.pdf` storage path. */
  uploadPdf: (protocolId: string) => Promise<string>;
}

const json = { "Content-Type": "application/json" };

/** Steps 4–6, extracted so the `pdf` overlay's `Spróbuj ponownie` replays exactly them. */
export async function finalizeProtocol(protocolId: string, deps: Deps): Promise<ProtocolSubmitOutcome> {
  try {
    const path = await deps.uploadPdf(protocolId);
    const res = await fetch(`/api/protocols/${protocolId}/pdf`, {
      method: "POST",
      headers: json,
      body: JSON.stringify({ path }),
    });
    if (res.status !== 200) {
      return { status: "pdf" };
    }
    const body = (await res.json()) as { delivery?: "sent" | "failed" };
    return { status: body.delivery === "sent" ? "sent" : "email" };
  } catch {
    // Generation, upload or the finalize call itself. The protocol stands with
    // `pdf_path` null and no delivery row — exactly the `pdf` overlay's contract.
    return { status: "pdf" };
  }
}

export async function submitProtocol(input: ProtocolInput, deps: Deps): Promise<ProtocolSubmitOutcome> {
  let res: Response;
  try {
    res = await fetch("/api/protocols", { method: "POST", headers: json, body: JSON.stringify(input) });
  } catch {
    return { status: "error" };
  }

  if (res.status !== 201) {
    const body = (await res.json().catch(() => ({}))) as {
      errors?: Record<string, string>;
      error?: string;
      status?: string;
      protocol_id?: string;
    };
    if (res.status === 409 && body.status === "conflict" && body.protocol_id) {
      return { status: "conflict", protocolId: body.protocol_id };
    }
    if (res.status === 400 && body.errors) {
      return { status: "errors", errors: body.errors };
    }
    return { status: "error", message: body.error };
  }

  // The protocol exists. Everything below is best-effort and recoverable.
  return finalizeProtocol(input.protocolId, deps);
}

/** POST the resend route; the `email` overlay's primary action. */
export async function resendProtocolEmail(protocolId: string): Promise<"sent" | "failed"> {
  try {
    const res = await fetch(`/api/protocols/${protocolId}/resend-email`, { method: "POST", headers: json });
    if (res.status !== 200) {
      return "failed";
    }
    const body = (await res.json()) as { delivery?: "sent" | "failed" };
    return body.delivery === "sent" ? "sent" : "failed";
  } catch {
    return "failed";
  }
}

/**
 * `submit(...)` runs the ordering above while tracking an in-flight flag.
 *
 * The flag is **kept** through a success overlay and reset only when the form is
 * still on screen (a validation or transport error) — per CLAUDE.md, an async
 * button holds its pending state through a successful transition rather than
 * flashing back to idle behind a modal.
 */
export function useProtocolSubmit(uploadPdf: Deps["uploadPdf"]) {
  const [submitting, setSubmitting] = React.useState(false);

  const submit = React.useCallback(
    async (input: ProtocolInput): Promise<ProtocolSubmitOutcome> => {
      setSubmitting(true);
      const outcome = await submitProtocol(input, { uploadPdf });
      if (outcome.status === "errors" || outcome.status === "error") {
        setSubmitting(false);
      }
      return outcome;
    },
    [uploadPdf],
  );

  const retryPdf = React.useCallback((protocolId: string) => finalizeProtocol(protocolId, { uploadPdf }), [uploadPdf]);

  return { submitting, submit, retryPdf };
}
