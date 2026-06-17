// core
import * as React from "react";
import { format } from "date-fns";
import { pl } from "date-fns/locale";
import { ArrowRight, Check, Truck, X } from "lucide-react";

// components
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";

// others
import { cn } from "../../lib/utils";
import { fromIsoDate } from "../../lib/date-iso";
import { useReservationDecision } from "../hooks/useReservationDecision";
import type { CalendarReservation, RejectionReason } from "../../types";

// The shared, reusable decision UI (S-03 Phase 7): the reason bottom-sheet, the
// result overlay, and a compact calendar decision modal. The pending queue
// (PendingQueue.tsx) imports ReasonSheet + ResultOverlay from here so there is a
// single copy of each; the calendar drives the whole flow through CalendarDecision.
// All of them decide through the one useReservationDecision hook.

export const DECISION_COPY = {
  approve: "Zatwierdź",
  reject: "Odrzuć",
  close: "Zamknij",
  reasonTitle: "Powód odrzucenia",
  confirmReject: "Potwierdź odrzucenie",
  noteLabel: "Dodaj szczegóły",
  notePlaceholder: "Krótka informacja dla klienta…",
  confirmedTitle: "Rezerwacja potwierdzona",
  rejectedTitle: "Wniosek odrzucony",
  notifiedSub: "Klient powiadomiony e-mailem.",
  done: "Gotowe",
  pickup: "Odbiór",
  return: "Zwrot",
  confirmedBadge: "POTWIERDZONA",
  pendingBadge: "PENDING",
  genericError: "Coś poszło nie tak. Spróbuj ponownie.",
  alreadyHandled: "Ten wniosek został już rozpatrzony przez kogoś innego.",
} as const;

export const REASONS: { value: RejectionReason; label: string }[] = [
  { value: "dates_unavailable", label: "Daty już niedostępne" },
  { value: "no_category", label: "Brak wymaganej kategorii" },
  { value: "vehicle_withdrawn", label: "Pojazd wycofany" },
  { value: "other", label: "Inny" },
];

function formatDayShort(iso: string): string {
  const d = fromIsoDate(iso);
  return d ? format(d, "dd MMM", { locale: pl }) : iso;
}

// ── reason bottom-sheet (mobile) / centered modal (desktop) ──────────────────

export function ReasonSheet({
  busy,
  onConfirm,
  onClose,
}: {
  busy: boolean;
  onConfirm: (reason: RejectionReason, note: string) => void;
  onClose: () => void;
}) {
  const [reason, setReason] = React.useState<RejectionReason>(REASONS[0].value);
  const [note, setNote] = React.useState("");

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center bg-[rgba(20,18,22,0.55)] backdrop-blur-sm md:items-center"
      onClick={onClose}
    >
      <div
        onClick={(e) => {
          e.stopPropagation();
        }}
        className="bg-card shadow-overlay w-full rounded-t-[28px] p-6 pb-8 md:max-w-md md:rounded-2xl"
      >
        <div className="bg-border mx-auto mb-4 h-1 w-10 rounded-full md:hidden" />
        <div className="text-foreground text-xl font-bold tracking-tight">{DECISION_COPY.reasonTitle}</div>
        <div className="mt-4 flex flex-col gap-2">
          {REASONS.map((r) => (
            <button
              key={r.value}
              type="button"
              onClick={() => {
                setReason(r.value);
              }}
              className={cn(
                "text-foreground flex items-center gap-3 rounded-xl border px-3.5 py-3 text-left text-sm font-[540]",
                reason === r.value ? "border-foreground bg-background" : "border-border bg-card",
              )}
            >
              <span
                className={cn(
                  "flex size-[18px] shrink-0 items-center justify-center rounded-full border-2",
                  reason === r.value ? "border-foreground bg-foreground" : "border-border",
                )}
              >
                {reason === r.value && <span className="bg-background size-1.5 rounded-full" />}
              </span>
              {r.label}
            </button>
          ))}
        </div>

        {reason === "other" && (
          <div className="mt-3">
            <label className="text-muted-foreground text-[11px] font-semibold" htmlFor="reject-note">
              {DECISION_COPY.noteLabel}
            </label>
            <textarea
              id="reject-note"
              value={note}
              onChange={(e) => {
                setNote(e.target.value);
              }}
              placeholder={DECISION_COPY.notePlaceholder}
              maxLength={500}
              rows={3}
              className="border-border bg-card text-foreground focus-visible:ring-ring mt-1 w-full resize-none rounded-xl border px-3.5 py-2.5 text-sm outline-none focus-visible:ring-2"
            />
          </div>
        )}

        <Button
          variant="destructive"
          className="mt-5 h-12 w-full"
          disabled={busy}
          onClick={() => {
            onConfirm(reason, note);
          }}
        >
          {DECISION_COPY.confirmReject}
        </Button>
      </div>
    </div>
  );
}

// ── result overlay ───────────────────────────────────────────────────────────

export function ResultOverlay({ status, onDone }: { status: "confirmed" | "rejected"; onDone: () => void }) {
  const confirmed = status === "confirmed";
  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-[rgba(20,18,22,0.55)] backdrop-blur-sm md:items-center">
      <div className="bg-card shadow-overlay w-full rounded-t-[28px] p-7 pb-8 md:max-w-sm md:rounded-2xl">
        <div
          className={cn(
            "mx-auto mb-4 flex size-16 items-center justify-center rounded-full",
            confirmed ? "bg-[var(--flota-success-soft)]" : "bg-[var(--flota-danger-soft)]",
          )}
        >
          {confirmed ? <Check className="text-success size-8" /> : <X className="text-destructive size-8" />}
        </div>
        <div className="text-foreground text-center text-[22px] font-bold tracking-tight">
          {confirmed ? DECISION_COPY.confirmedTitle : DECISION_COPY.rejectedTitle}
        </div>
        <div className="text-muted-foreground mx-auto mt-2 max-w-[280px] text-center text-[13px] leading-relaxed">
          {DECISION_COPY.notifiedSub}
        </div>
        <Button className="bg-foreground text-background hover:bg-foreground/90 mt-6 h-12 w-full" onClick={onDone}>
          {DECISION_COPY.done}
        </Button>
      </div>
    </div>
  );
}

// ── calendar decision modal ──────────────────────────────────────────────────

// Centered modal opened when a calendar bar is clicked. A pending bar gets the
// full accept/reject flow (reason sheet + result overlay), reusing the shared
// hook; a confirmed bar is read-only. On a committed decision it notifies the
// caller so the calendar can recolor (confirm) or remove (reject) the event.
export function CalendarDecision({
  reservation,
  onClose,
  onDecided,
}: {
  reservation: CalendarReservation;
  onClose: () => void;
  onDecided: (id: string, status: "confirmed" | "rejected") => void;
}) {
  const { busy, decide } = useReservationDecision();
  const [reasonOpen, setReasonOpen] = React.useState(false);
  const [result, setResult] = React.useState<"confirmed" | "rejected" | null>(null);
  const [banner, setBanner] = React.useState<string | null>(null);

  const vehicle = [reservation.vehicle_make, reservation.vehicle_model].filter(Boolean).join(" ") || "Pojazd";
  const isPending = reservation.status === "pending";

  async function run(decision: "confirm" | "reject", reason?: RejectionReason, note?: string) {
    setBanner(null);
    const outcome = await decide(reservation.id, decision, reason, note);
    setReasonOpen(false);
    if (outcome.status === "confirmed" || outcome.status === "rejected") {
      setResult(outcome.status);
      return;
    }
    if (outcome.status === "already_decided") {
      setBanner(DECISION_COPY.alreadyHandled);
      // Treat as handled so the calendar drops the stale bar on close.
      return;
    }
    setBanner(DECISION_COPY.genericError);
  }

  function finish() {
    if (result) {
      onDecided(reservation.id, result);
    }
    setResult(null);
    onClose();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-[rgba(20,18,22,0.55)] backdrop-blur-sm md:items-center"
      onClick={onClose}
    >
      <div
        onClick={(e) => {
          e.stopPropagation();
        }}
        className="bg-card shadow-overlay w-full rounded-t-[28px] p-6 pb-8 md:max-w-md md:rounded-2xl"
      >
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground font-mono text-[11px] font-semibold">{reservation.reference}</span>
          {isPending ? (
            <Badge className="text-warning bg-[var(--flota-warning-soft)]">{DECISION_COPY.pendingBadge}</Badge>
          ) : (
            <Badge className="text-success bg-[var(--flota-success-soft)]">{DECISION_COPY.confirmedBadge}</Badge>
          )}
        </div>
        <div className="text-foreground mt-1.5 text-lg font-bold tracking-tight">{reservation.customer_name}</div>

        <div className="bg-background mt-3 flex items-center gap-3 rounded-xl p-3">
          <Truck className="text-foreground size-6 shrink-0" strokeWidth={1.5} />
          <span className="text-foreground text-sm font-[540]">{vehicle}</span>
        </div>

        <div className="border-border mt-3 flex items-center justify-between rounded-xl border p-3">
          <div>
            <div className="text-muted-foreground text-[10.5px] font-semibold tracking-wide uppercase">
              {DECISION_COPY.pickup}
            </div>
            <div className="text-foreground mt-0.5 font-bold tracking-tight">
              {formatDayShort(reservation.pickup_date)} · 14:00
            </div>
          </div>
          <ArrowRight className="text-muted-foreground size-[18px]" />
          <div className="text-right">
            <div className="text-muted-foreground text-[10.5px] font-semibold tracking-wide uppercase">
              {DECISION_COPY.return}
            </div>
            <div className="text-foreground mt-0.5 font-bold tracking-tight">
              {formatDayShort(reservation.return_date)} · 10:00
            </div>
          </div>
        </div>

        {banner && (
          <div className="border-border mt-3 rounded-xl border bg-[var(--flota-warning-soft)] px-3.5 py-2.5 text-sm text-[var(--flota-ink-2)]">
            {banner}
          </div>
        )}

        {isPending ? (
          <div className="mt-5 flex gap-2.5">
            <Button
              variant="outline"
              className="text-destructive hover:text-destructive h-12 flex-1"
              disabled={busy}
              onClick={() => {
                setReasonOpen(true);
              }}
            >
              {DECISION_COPY.reject}
            </Button>
            <Button className="h-12 flex-[2]" disabled={busy} onClick={() => run("confirm")}>
              <Check className="size-4" />
              {DECISION_COPY.approve}
            </Button>
          </div>
        ) : (
          <Button variant="outline" className="mt-5 h-12 w-full" onClick={onClose}>
            {DECISION_COPY.close}
          </Button>
        )}
      </div>

      {reasonOpen && (
        <ReasonSheet
          busy={busy}
          onClose={() => {
            setReasonOpen(false);
          }}
          onConfirm={(reason, note) => run("reject", reason, note)}
        />
      )}
      {result && <ResultOverlay status={result} onDone={finish} />}
    </div>
  );
}
