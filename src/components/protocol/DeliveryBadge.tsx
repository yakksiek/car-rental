// others
import { cn } from "../../lib/utils";

// The delivery badge for an *issued* protocol (S-05 Phase 6). Rendered on the
// dispatch row and the protocol view, it turns the newest `email_deliveries` row
// — folded in by `list_dispatch_today` / `get_protocol` via a lateral join —
// into a single at-a-glance pill. `email_deliveries` exists precisely so an
// employee who dismissed the post-submit overlay can still recover the failure
// from the dashboard later.
//
// Only render this on a row that HAS a `protocol_id`. A reservation not yet
// issued has no delivery to report and must show `Wydaj`, never a red badge.

type Tone = "ok" | "warn" | "bad";

const TONE: Record<Tone, string> = {
  ok: "text-success bg-[var(--flota-success-soft)]",
  warn: "text-warning bg-[var(--flota-warning-soft)]",
  bad: "text-primary bg-[var(--flota-danger-soft)]",
};

export interface BadgeState {
  tone: Tone;
  label: string;
}

/**
 * Derive the badge from an issued protocol's `pdf_path` and newest delivery
 * status, in this exact order (the plan's Phase 6 §2):
 *
 *   1. no `pdf_path`      → `Błąd PDF` (warn) — the PDF never generated, so no
 *                           send was even attempted; regenerate, don't resend.
 *   2. `failed` / no row  → `E-mail niewysłany` (bad) — a send failed or was
 *                           never recorded; the resend action is the recovery.
 *   3. `sent`             → `Dostarczono` (ok).
 */
export function deliveryBadge(pdfPath: string | null, deliveryStatus: string | null): BadgeState {
  if (!pdfPath) {
    return { tone: "warn", label: "Błąd PDF" };
  }
  if (deliveryStatus !== "sent") {
    return { tone: "bad", label: "E-mail niewysłany" };
  }
  return { tone: "ok", label: "Dostarczono" };
}

export function DeliveryBadge({ pdfPath, deliveryStatus }: { pdfPath: string | null; deliveryStatus: string | null }) {
  const { tone, label } = deliveryBadge(pdfPath, deliveryStatus);
  return (
    <span className={cn("inline-flex h-6 items-center rounded-[7px] px-2.5 text-[11.5px] font-bold", TONE[tone])}>
      {label}
    </span>
  );
}
