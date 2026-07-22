// core
import { Check, TriangleAlert } from "lucide-react";
import type { LucideIcon } from "lucide-react";

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

// Every design `PpBadge` carries a leading glyph (check when delivered, warning
// otherwise), like `OverdueBadge` — so the badge does too.
const TONE_ICON: Record<Tone, LucideIcon> = {
  ok: Check,
  warn: TriangleAlert,
  bad: TriangleAlert,
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

export function DeliveryBadge({
  pdfPath,
  deliveryStatus,
  fullWidthOnMobile = false,
}: {
  pdfPath: string | null;
  deliveryStatus: string | null;
  /**
   * When set, the badge renders as a full-width tinted status *bar* on the mobile
   * card (design RtQueueCardM returned states) and collapses back to the compact
   * inline pill at `sm+`. Default (false) is the compact pill on every breakpoint,
   * which is what the dispatch row and protocol view use.
   */
  fullWidthOnMobile?: boolean;
}) {
  const { tone, label } = deliveryBadge(pdfPath, deliveryStatus);
  const Icon = TONE_ICON[tone];
  return (
    <span
      className={cn(
        "items-center font-bold",
        fullWidthOnMobile
          ? "flex h-9 w-full gap-2 rounded-[10px] px-3.5 text-[13px] sm:inline-flex sm:h-6 sm:w-auto sm:shrink-0 sm:gap-1 sm:rounded-[7px] sm:px-2.5 sm:text-[11.5px] sm:whitespace-nowrap"
          : "inline-flex h-6 shrink-0 gap-1 rounded-[7px] px-2.5 text-[11.5px] whitespace-nowrap",
        TONE[tone],
      )}
    >
      <Icon className={cn("size-3.5", fullWidthOnMobile && "size-4 sm:size-3.5")} />
      {label}
    </span>
  );
}
