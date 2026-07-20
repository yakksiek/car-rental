// core
import * as React from "react";

// others
import type { ReturnProtocolInput } from "../../lib/return-protocol-schema";
import type { ProtocolSubmitOutcome } from "./useProtocolSubmit";

// The return-protocol submit ordering (S-06 Phase 5) — the return sibling of
// `useProtocolSubmit`. Identical shape, pointed at the `/api/return-protocols*`
// routes, so the two flows cannot drift on the commit-then-best-effort contract:
//
//   1. Photos + signature are already in storage (uploaded per tile / on sign).
//   2. POST /api/return-protocols → **the return now exists.** No email is sent.
//   3. Build the PDF client-side (now carrying the comparison section).
//   4. Upload the PDF to storage.
//   5. POST /api/return-protocols/[id]/pdf → the server stores `pdf_path`, mints a
//      short-TTL signed URL and **sends the mail**. Body carries the delivery
//      status; the HTTP status stays 200 either way.
//
// After step 2 nothing rolls back: the vehicle was physically returned. A PDF or
// email failure surfaces on the badge and is resendable. The `ProtocolSubmitOutcome`
// union is reused verbatim from the issue hook — the only new create result,
// `no_baseline` (the issue baseline vanished between page load and submit, which
// the loaded-baseline page makes near-impossible), folds into a generic `error`
// rather than a bespoke terminal screen the design contract does not define.

const json = { "Content-Type": "application/json" };

interface Deps {
  /** Build the PDF and upload it. Resolves to its `return/<protocolId>/protocol.pdf` storage path. */
  uploadPdf: (protocolId: string) => Promise<string>;
}

/** Steps 3–5, extracted so the `pdf` overlay's `Spróbuj ponownie` replays exactly them. */
export async function finalizeReturnProtocol(protocolId: string, deps: Deps): Promise<ProtocolSubmitOutcome> {
  try {
    const path = await deps.uploadPdf(protocolId);
    const res = await fetch(`/api/return-protocols/${protocolId}/pdf`, {
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
    // Generation, upload or the finalize call itself. The return stands with
    // `pdf_path` null and no delivery row — exactly the `pdf` overlay's contract.
    return { status: "pdf" };
  }
}

export async function submitReturnProtocol(input: ReturnProtocolInput, deps: Deps): Promise<ProtocolSubmitOutcome> {
  let res: Response;
  try {
    res = await fetch("/api/return-protocols", { method: "POST", headers: json, body: JSON.stringify(input) });
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
    // `no_baseline` (409) and every other non-201 map to a recoverable error banner.
    return { status: "error", message: body.error };
  }

  // The return exists. Everything below is best-effort and recoverable.
  return finalizeReturnProtocol(input.protocolId, deps);
}

/** POST the return resend route; the `email` overlay's primary action. */
export async function resendReturnEmail(protocolId: string): Promise<"sent" | "failed"> {
  try {
    const res = await fetch(`/api/return-protocols/${protocolId}/resend-email`, { method: "POST", headers: json });
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
 * `submit(...)` runs the ordering above while tracking an in-flight flag — kept
 * through a success overlay, reset only when the form is still on screen (a
 * validation or transport error), matching `useProtocolSubmit`.
 */
export function useReturnProtocolSubmit(uploadPdf: Deps["uploadPdf"]) {
  const [submitting, setSubmitting] = React.useState(false);

  const submit = React.useCallback(
    async (input: ReturnProtocolInput): Promise<ProtocolSubmitOutcome> => {
      setSubmitting(true);
      const outcome = await submitReturnProtocol(input, { uploadPdf });
      if (outcome.status === "errors" || outcome.status === "error") {
        setSubmitting(false);
      }
      return outcome;
    },
    [uploadPdf],
  );

  const retryPdf = React.useCallback(
    (protocolId: string) => finalizeReturnProtocol(protocolId, { uploadPdf }),
    [uploadPdf],
  );

  return { submitting, submit, retryPdf };
}
