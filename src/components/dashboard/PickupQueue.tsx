// core
import * as React from "react";
import { ArrowRight, RefreshCw } from "lucide-react";

// components
import { Button } from "../ui/button";
import { DeliveryBadge, deliveryBadge } from "../protocol/DeliveryBadge";

// others
import { cn } from "../../lib/utils";
import { postResend } from "../hooks/useResendEmail";
import type { DispatchRow } from "../../types";

// The dispatch list (S-05 Phase 6) — the entry point that did not exist before
// this slice. Today's confirmed reservations, each either awaiting handover
// (`Wydaj`) or already issued (a delivery badge + `Otwórz protokół`, plus
// `Wyślij ponownie` when the last send did not land).
//
// Issued rows are the whole point of keeping `email_deliveries`: a dismissed
// post-submit overlay is recoverable here, and this is the only discoverable
// entry to the protocol view screen. So a filed protocol stays on the list as an
// issued row — it is not removed.
//
// `list_dispatch_today` types `protocol_id` / `pdf_path` / `delivery_status` as
// non-null strings, but they come from LEFT JOINs and are null at runtime for an
// un-issued reservation (or an issued one with no send yet). The row logic keys
// entirely off `protocol_id` being truthy.

/** A row plus the client-side delivery-status override a successful resend applies. */
interface RowState {
  row: DispatchRow;
  /** Set once a resend succeeds this session, so the badge flips to `Dostarczono` without a reload. */
  deliveryOverride: string | null;
}

function Plate({ plate }: { plate: string }) {
  return (
    <span className="text-foreground rounded-[7px] bg-[var(--flota-neutral-soft)] px-1.5 py-0.5 font-mono text-[12px] font-semibold tracking-tight">
      {plate}
    </span>
  );
}

function PickupRow({
  state,
  resending,
  error,
  onResend,
}: {
  state: RowState;
  resending: boolean;
  error: string | null;
  onResend: () => void;
}) {
  const { row } = state;
  const vehicle = [row.vehicle_make, row.vehicle_model].filter(Boolean).join(" ");
  const issued = Boolean(row.protocol_id);
  // For issued rows, the effective delivery status is the resend override when one
  // landed this session, else the folded-in value from the RPC.
  const deliveryStatus = state.deliveryOverride ?? row.delivery_status;
  const pdfPath = row.pdf_path as string | null;
  const badge = deliveryBadge(pdfPath, deliveryStatus);
  // Offer resend only when there is a stored PDF to attach *and* the last send did
  // not land. A missing PDF (`Błąd PDF`, warn) is not resendable — regenerate.
  const canResend = issued && Boolean(pdfPath) && badge.tone !== "ok";

  return (
    <li className="border-border bg-card shadow-card rounded-lg border p-4">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-foreground truncate text-[15px] font-[650] tracking-tight">{vehicle}</span>
            <Plate plate={row.vehicle_plate} />
          </div>
          <div className="text-muted-foreground mt-1 text-[13px]">
            {row.customer_name} · <span className="font-mono">{row.reference}</span>
          </div>
        </div>

        <div className="flex shrink-0 flex-col items-end gap-2">
          {issued ? (
            <>
              <DeliveryBadge pdfPath={pdfPath} deliveryStatus={deliveryStatus} />
              <div className="flex items-center gap-2">
                {canResend && (
                  <Button type="button" variant="outline" size="sm" disabled={resending} onClick={onResend}>
                    {resending ? (
                      <>
                        <span className="border-muted-foreground/30 border-t-foreground size-3.5 animate-spin rounded-full border-2" />
                        Wysyłanie…
                      </>
                    ) : (
                      <>
                        <RefreshCw className="size-3.5" />
                        Wyślij ponownie
                      </>
                    )}
                  </Button>
                )}
                <Button asChild variant="ghost" size="sm">
                  <a href={`/dashboard/protocols/${row.protocol_id}`}>
                    Otwórz protokół
                    <ArrowRight className="size-3.5" />
                  </a>
                </Button>
              </div>
            </>
          ) : (
            <Button asChild size="sm" className="bg-foreground text-background hover:bg-foreground/90">
              <a href={`/dashboard/pickups/${row.reservation_id}`}>
                Wydaj
                <ArrowRight className="size-3.5" />
              </a>
            </Button>
          )}
        </div>
      </div>
      {error && <p className="text-primary mt-2 text-right text-[12px] font-medium">{error}</p>}
    </li>
  );
}

export default function PickupQueue({ rows }: { rows: DispatchRow[] }) {
  const [states, setStates] = React.useState<RowState[]>(() => rows.map((row) => ({ row, deliveryOverride: null })));
  const [resendingId, setResendingId] = React.useState<string | null>(null);
  const [errors, setErrors] = React.useState<Record<string, string>>({});

  const handleResend = React.useCallback(async (protocolId: string) => {
    setResendingId(protocolId);
    setErrors((prev) => Object.fromEntries(Object.entries(prev).filter(([key]) => key !== protocolId)));
    const outcome = await postResend(protocolId);
    setResendingId(null);
    if (outcome.status === "sent") {
      setStates((prev) => prev.map((s) => (s.row.protocol_id === protocolId ? { ...s, deliveryOverride: "sent" } : s)));
      return;
    }
    const message =
      outcome.status === "no_pdf"
        ? "Brak zapisanego PDF — wygeneruj go ponownie."
        : "Nie udało się wysłać. Spróbuj ponownie.";
    setErrors((prev) => ({ ...prev, [protocolId]: message }));
  }, []);

  if (states.length === 0) {
    return (
      <div className={cn("border-border bg-card shadow-card rounded-lg border p-10 text-center")}>
        <h2 className="text-foreground text-[16px] font-[650] tracking-tight">Brak wydań na dziś</h2>
        <p className="text-muted-foreground mx-auto mt-1.5 max-w-sm text-[13px]">
          Gdy rezerwacja będzie gotowa do wydania, pojawi się tutaj.
        </p>
      </div>
    );
  }

  return (
    <ul className="flex flex-col gap-3">
      {states.map((state) => {
        const protocolId = state.row.protocol_id;
        return (
          <PickupRow
            key={state.row.reservation_id}
            state={state}
            resending={resendingId !== null && resendingId === protocolId}
            error={protocolId ? (errors[protocolId] ?? null) : null}
            onResend={() => protocolId && handleResend(protocolId)}
          />
        );
      })}
    </ul>
  );
}
