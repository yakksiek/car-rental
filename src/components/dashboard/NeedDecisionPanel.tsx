// core
import * as React from "react";
import { format } from "date-fns";
import { pl } from "date-fns/locale";
import { ArrowRight, Calendar, Check } from "lucide-react";

// components
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { ReasonSheet, ResultOverlay } from "./ReservationDecision";

// others
import { cn } from "../../lib/utils";
import { fromIsoDate } from "../../lib/date-iso";
import { estimatedTotal, formatPln, rentalDays } from "../../lib/format";
import { useReservationDecision } from "../hooks/useReservationDecision";
import type { PendingReservation, RejectionReason } from "../../types";

// The dashboard "Need a decision" panel (S-03 follow-up L3). The design's staff
// dashboard leads with this: the pending queue surfaced as a quick-action
// mini-list with inline Odrzuć/Zatwierdź + an "Otwórz →" link to the full queue.
// It reuses the one decision mechanism (useReservationDecision + ReasonSheet +
// ResultOverlay) the queue and calendar share; only the local view state is
// wired here. The rest of the dispatch dashboard (greeting, Pickups/Returns/
// Overdue tiles, Today's Schedule) needs S-05/S-06/S-07 data and stays deferred.

const COPY = {
  title: "Wymaga decyzji",
  open: "Otwórz",
  empty: "Brak oczekujących wniosków",
  emptyHint: "Nowe zgłoszenia pojawią się tutaj.",
  approve: "Zatwierdź",
  reject: "Odrzuć",
  more: "Zobacz wszystkie",
  alreadyHandled: "Ten wniosek został już rozpatrzony przez kogoś innego.",
  genericError: "Coś poszło nie tak. Spróbuj ponownie.",
} as const;

// How many cards to preview before deferring to the full queue.
const PREVIEW_LIMIT = 4;

const cardClass = "rounded-2xl border border-border bg-card shadow-card";

function formatRange(pickup: string, returnDate: string): string {
  const from = fromIsoDate(pickup);
  const to = fromIsoDate(returnDate);
  if (!from || !to) {
    return `${pickup} – ${returnDate}`;
  }
  const sameMonth = from.getMonth() === to.getMonth() && from.getFullYear() === to.getFullYear();
  const fromLabel = sameMonth ? format(from, "dd", { locale: pl }) : format(from, "dd MMM", { locale: pl });
  return `${fromLabel} – ${format(to, "dd MMM", { locale: pl })}`;
}

function vehicleName(r: PendingReservation): string {
  const label = [r.vehicle_make, r.vehicle_model].filter(Boolean).join(" ");
  return label === "" ? "Pojazd" : label;
}

function DecisionCard({
  reservation,
  busy,
  onApprove,
  onReject,
}: {
  reservation: PendingReservation;
  busy: boolean;
  onApprove: () => void;
  onReject: () => void;
}) {
  const days = rentalDays(reservation.pickup_date, reservation.return_date);
  const total = formatPln(estimatedTotal(reservation.vehicle_daily_rate, days));

  return (
    <div className={cn(cardClass, "p-4")}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-muted-foreground font-mono text-[11px] font-semibold">{reservation.reference}</span>
        <Badge className="text-warning bg-[var(--flota-warning-soft)]">PENDING</Badge>
      </div>
      <div className="mt-2 flex items-baseline justify-between gap-3">
        <div className="text-foreground truncate text-[15px] font-[650] tracking-tight">
          {reservation.customer_name}
        </div>
        <div className="text-foreground shrink-0 text-sm font-bold tracking-tight">{total}</div>
      </div>
      <div className="text-muted-foreground mt-1 flex items-center gap-1.5 text-xs">
        <Calendar className="size-3.5 shrink-0" />
        <span className="truncate">
          {formatRange(reservation.pickup_date, reservation.return_date)} · {vehicleName(reservation)}
        </span>
      </div>
      <div className="mt-3.5 flex gap-2">
        <Button
          variant="outline"
          className="text-destructive hover:text-destructive h-10 flex-1"
          disabled={busy}
          onClick={onReject}
        >
          {COPY.reject}
        </Button>
        <Button className="h-10 flex-[1.6]" disabled={busy} onClick={onApprove}>
          <Check className="size-4" />
          {COPY.approve}
        </Button>
      </div>
    </div>
  );
}

export default function NeedDecisionPanel({ reservations: initial }: { reservations: PendingReservation[] }) {
  const [reservations, setReservations] = React.useState<PendingReservation[]>(initial);
  const [reasonForId, setReasonForId] = React.useState<string | null>(null);
  const [result, setResult] = React.useState<"confirmed" | "rejected" | null>(null);
  const [decidedId, setDecidedId] = React.useState<string | null>(null);
  const [banner, setBanner] = React.useState<string | null>(null);
  const { busy, decide: runDecision } = useReservationDecision();

  function removeFromQueue(id: string) {
    setReservations((rows) => rows.filter((r) => r.id !== id));
  }

  async function decide(id: string, decision: "confirm" | "reject", reason?: RejectionReason, note?: string) {
    setBanner(null);
    const outcome = await runDecision(id, decision, reason, note);
    setReasonForId(null);

    if (outcome.status === "confirmed" || outcome.status === "rejected") {
      setDecidedId(id);
      setResult(outcome.status);
      return;
    }
    if (outcome.status === "already_decided") {
      removeFromQueue(id);
      setBanner(COPY.alreadyHandled);
      return;
    }
    setBanner(COPY.genericError);
  }

  function onResultDone() {
    if (decidedId) {
      removeFromQueue(decidedId);
    }
    setDecidedId(null);
    setResult(null);
  }

  const count = reservations.length;
  const visible = reservations.slice(0, PREVIEW_LIMIT);
  const overflow = count - visible.length;

  return (
    <div className="relative">
      <div className="mb-3 flex items-center justify-between px-1">
        <span className="text-muted-foreground text-[13px] font-bold tracking-wide uppercase">{COPY.title}</span>
        {count > 0 && (
          <a
            href="/dashboard/reservations"
            className="text-primary flex items-center gap-1 text-xs font-[650] hover:underline"
          >
            {COPY.open}
            <ArrowRight className="size-3.5" />
          </a>
        )}
      </div>

      {banner && (
        <div className="border-border mb-3 rounded-xl border bg-[var(--flota-warning-soft)] px-4 py-3 text-sm text-[var(--flota-ink-2)]">
          {banner}
        </div>
      )}

      {count === 0 ? (
        <div className={cn(cardClass, "flex flex-col items-center justify-center px-6 py-10 text-center")}>
          <div className="text-foreground text-base font-[650]">{COPY.empty}</div>
          <div className="text-muted-foreground mt-1 text-sm">{COPY.emptyHint}</div>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {visible.map((r) => (
            <DecisionCard
              key={r.id}
              reservation={r}
              busy={busy}
              onApprove={() => decide(r.id, "confirm")}
              onReject={() => {
                setReasonForId(r.id);
              }}
            />
          ))}
          {overflow > 0 && (
            <a
              href="/dashboard/reservations"
              className="text-muted-foreground hover:text-foreground py-1 text-center text-sm font-medium"
            >
              {COPY.more} ({count}) →
            </a>
          )}
        </div>
      )}

      {reasonForId && (
        <ReasonSheet
          busy={busy}
          onClose={() => {
            setReasonForId(null);
          }}
          onConfirm={(reason, note) => decide(reasonForId, "reject", reason, note)}
        />
      )}

      {result && <ResultOverlay status={result} onDone={onResultDone} />}
    </div>
  );
}
