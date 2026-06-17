// core
import * as React from "react";
import { format, formatDistanceToNow } from "date-fns";
import { pl } from "date-fns/locale";
import { ArrowRight, Check, ChevronLeft, Mail, Phone, Truck, User, X } from "lucide-react";

// components
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";

// others
import { cn } from "../../lib/utils";
import { fromIsoDate } from "../../lib/date-iso";
import { estimatedTotal, formatDuration, formatPln, rentalDays } from "../../lib/format";
import type { PendingReservation, RejectionReason } from "../../types";

// The employee approval island (S-03 Phase 4 mobile; Phase 5 layers desktop).
// It owns the queue → detail → reason-sheet → result-overlay flow over the
// SSR-loaded pending list, deciding via PATCH /api/reservations/[id]. The detail,
// reason sheet, and result overlay are extracted into shared components in Phase 7
// so the calendar can reuse the same single decision mechanism.

const COPY = {
  pending: "Oczekujące",
  awaitingDecision: "oczekuje na decyzję",
  empty: "Brak oczekujących wniosków",
  emptyHint: "Nowe zgłoszenia pojawią się tutaj.",
  approve: "Zatwierdź",
  reject: "Odrzuć",
  review: "Sprawdź",
  reasonTitle: "Powód odrzucenia",
  confirmReject: "Potwierdź odrzucenie",
  noteLabel: "Dodaj szczegóły",
  notePlaceholder: "Krótka informacja dla klienta…",
  requestLabel: "Wniosek",
  submitted: "Złożono",
  pickup: "Odbiór",
  return: "Zwrot",
  datesHeld: "Daty zarezerwowane",
  datesHeldNote: "Zablokowane dla innych klientów na czas oczekiwania — odrzucenie je zwalnia.",
  customer: "Klient",
  name: "Imię i nazwisko",
  email: "Email",
  phone: "Telefon",
  company: "Firma",
  vatId: "NIP",
  notes: "Uwagi klienta",
  deposit: "Kaucja",
  confirmedTitle: "Rezerwacja potwierdzona",
  rejectedTitle: "Wniosek odrzucony",
  notifiedSub: "Klient powiadomiony e-mailem.",
  done: "Gotowe",
  alreadyHandled: "Ten wniosek został już rozpatrzony przez kogoś innego.",
  genericError: "Coś poszło nie tak. Spróbuj ponownie.",
} as const;

const REASONS: { value: RejectionReason; label: string }[] = [
  { value: "dates_unavailable", label: "Daty już niedostępne" },
  { value: "no_category", label: "Brak wymaganej kategorii" },
  { value: "vehicle_withdrawn", label: "Pojazd wycofany" },
  { value: "other", label: "Inny" },
];

// ── pure display helpers ────────────────────────────────────────────────────

function formatDayShort(iso: string): string {
  const d = fromIsoDate(iso);
  return d ? format(d, "dd MMM", { locale: pl }) : iso;
}

/** `02 – 09 kwi` (same month) / `28 mar – 02 kwi`. */
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

function submittedAgo(createdAt: string): string {
  const d = new Date(createdAt);
  if (Number.isNaN(d.getTime())) {
    return "";
  }
  return formatDistanceToNow(d, { locale: pl, addSuffix: true });
}

function vehicleName(r: PendingReservation): string {
  const label = [r.vehicle_make, r.vehicle_model].filter(Boolean).join(" ");
  return label === "" ? "Pojazd" : label;
}

// ── decision plumbing (extracted to useReservationDecision in Phase 7) ───────

type DecisionOutcome = { status: "confirmed" | "rejected" } | { status: "already_decided" } | { status: "error" };

async function postDecision(
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

// ── subcomponents ────────────────────────────────────────────────────────────

const cardClass = "rounded-2xl border border-border bg-card shadow-card";

function QueueCard({
  reservation,
  selected,
  busy,
  onReview,
  onReject,
}: {
  reservation: PendingReservation;
  selected?: boolean;
  busy: boolean;
  onReview: () => void;
  onReject: () => void;
}) {
  const days = rentalDays(reservation.pickup_date, reservation.return_date);
  const total = formatPln(estimatedTotal(reservation.vehicle_daily_rate, days));

  return (
    <div className={cn(cardClass, "p-4", selected && "ring-foreground ring-2")}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground font-mono text-[11px] font-semibold">{reservation.reference}</span>
            <Badge className="text-warning bg-[var(--flota-warning-soft)]">PENDING</Badge>
          </div>
          <div className="text-foreground mt-1.5 truncate text-base font-[650] tracking-tight">
            {reservation.customer_name}
          </div>
        </div>
        <div className="shrink-0 text-right">
          <div className="text-foreground text-base font-bold tracking-tight">{total}</div>
          <div className="text-muted-foreground mt-0.5 text-[11px]">{formatDuration(days)}</div>
        </div>
      </div>

      <div className="mt-3 flex items-center gap-3">
        <div className="bg-background text-foreground flex h-[42px] w-16 shrink-0 items-center justify-center rounded-[10px]">
          <Truck className="size-7" strokeWidth={1.5} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-foreground truncate text-[13px] font-[650] tracking-tight">
            {vehicleName(reservation)}
          </div>
          <div className="text-muted-foreground mt-0.5 text-xs">
            {formatRange(reservation.pickup_date, reservation.return_date)}
          </div>
        </div>
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
        <Button
          className="bg-foreground text-background hover:bg-foreground/90 h-10 flex-[2]"
          disabled={busy}
          onClick={onReview}
        >
          {COPY.review}
          <ArrowRight className="size-4" />
        </Button>
      </div>
    </div>
  );
}

function InfoRow({
  icon,
  label,
  value,
  last,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  last?: boolean;
}) {
  return (
    <div className={cn("flex items-center gap-3 px-3.5 py-3", !last && "border-b border-[var(--flota-hair-2)]")}>
      <span className="text-muted-foreground">{icon}</span>
      <div className="min-w-0 flex-1">
        <div className="text-muted-foreground text-[11px] font-semibold">{label}</div>
        <div className="text-foreground mt-0.5 truncate text-sm font-[540]">{value}</div>
      </div>
    </div>
  );
}

export function RequestDetail({
  reservation,
  busy,
  onApprove,
  onReject,
  onBack,
  readOnly,
  className,
  withBackButton = true,
}: {
  reservation: PendingReservation;
  busy: boolean;
  onApprove: () => void;
  onReject: () => void;
  onBack?: () => void;
  readOnly?: boolean;
  className?: string;
  withBackButton?: boolean;
}) {
  const days = rentalDays(reservation.pickup_date, reservation.return_date);
  const total = formatPln(estimatedTotal(reservation.vehicle_daily_rate, days));

  return (
    <div className={cn("flex flex-col", className)}>
      {/* Header */}
      <div className="flex items-center justify-between gap-2 px-1 pb-3">
        {withBackButton ? (
          <button
            type="button"
            onClick={onBack}
            className="text-foreground hover:bg-background flex size-9 items-center justify-center rounded-full"
            aria-label="Wróć"
          >
            <ChevronLeft className="size-[18px]" />
          </button>
        ) : (
          <span className="size-9" />
        )}
        <div className="text-center">
          <div className="text-muted-foreground text-[11px] font-semibold tracking-wide uppercase">
            {COPY.requestLabel} {reservation.reference}
          </div>
          <div className="text-foreground mt-0.5 text-[13px] font-[650] tracking-tight">
            {COPY.submitted} · {submittedAgo(reservation.created_at)}
          </div>
        </div>
        <span className="size-9" />
      </div>

      <div className="flex flex-col gap-3">
        {/* Vehicle */}
        <div className={cn(cardClass, "flex items-center gap-3.5 p-4")}>
          <div className="bg-background text-foreground flex h-[60px] w-24 shrink-0 items-center justify-center rounded-xl">
            <Truck className="size-10" strokeWidth={1.4} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-foreground text-[15px] font-[650] tracking-tight">{vehicleName(reservation)}</div>
            {reservation.vehicle_production_year ? (
              <div className="text-muted-foreground mt-0.5 text-xs">Rocznik {reservation.vehicle_production_year}</div>
            ) : null}
            <div className="mt-1 text-[12.5px] font-semibold text-[var(--flota-ink-2)]">
              {formatPln(reservation.vehicle_daily_rate)}/doba
            </div>
          </div>
        </div>

        {/* Dates */}
        <div className={cn(cardClass, "p-4")}>
          <div className="flex items-center justify-between">
            <div>
              <div className="text-muted-foreground text-[10.5px] font-semibold tracking-wide uppercase">
                {COPY.pickup}
              </div>
              <div className="text-foreground mt-0.5 text-lg font-bold tracking-tight">
                {formatDayShort(reservation.pickup_date)} · 14:00
              </div>
            </div>
            <ArrowRight className="text-muted-foreground size-[18px]" />
            <div className="text-right">
              <div className="text-muted-foreground text-[10.5px] font-semibold tracking-wide uppercase">
                {COPY.return}
              </div>
              <div className="text-foreground mt-0.5 text-lg font-bold tracking-tight">
                {formatDayShort(reservation.return_date)} · 10:00
              </div>
            </div>
          </div>
        </div>

        {/* Dates held */}
        <div className={cn(cardClass, "p-4")}>
          <div className="mb-1 flex items-center gap-2">
            <span className="bg-warning size-2 rounded-[3px]" />
            <span className="text-muted-foreground text-xs font-bold tracking-wide uppercase">{COPY.datesHeld}</span>
          </div>
          <div className="text-xs leading-relaxed text-[var(--flota-ink-2)]">{COPY.datesHeldNote}</div>
        </div>

        {/* Customer */}
        <div className="text-muted-foreground mx-1 mt-1 text-[13px] font-bold tracking-wide uppercase">
          {COPY.customer}
        </div>
        <div className={cn(cardClass, "p-1.5")}>
          <InfoRow icon={<User className="size-4" />} label={COPY.name} value={reservation.customer_name} />
          <InfoRow icon={<Mail className="size-4" />} label={COPY.email} value={reservation.customer_email} />
          <InfoRow
            icon={<Phone className="size-4" />}
            label={COPY.phone}
            value={reservation.customer_phone}
            last={!reservation.company && !reservation.notes}
          />
          {reservation.company ? (
            <InfoRow
              icon={<User className="size-4" />}
              label={COPY.company}
              value={
                reservation.vat_id
                  ? `${reservation.company} · ${COPY.vatId} ${reservation.vat_id}`
                  : reservation.company
              }
              last={!reservation.notes}
            />
          ) : null}
          {reservation.notes ? (
            <InfoRow icon={<Mail className="size-4" />} label={COPY.notes} value={reservation.notes} last />
          ) : null}
        </div>

        {/* Pricing */}
        <div className={cn(cardClass, "p-4")}>
          <div className="flex items-center justify-between border-b border-[var(--flota-hair-2)] py-2">
            <span className="text-muted-foreground text-[13px] font-[540]">
              {formatDuration(days)} × {formatPln(reservation.vehicle_daily_rate)}
            </span>
            <span className="text-foreground text-sm font-[650] tracking-tight">{total}</span>
          </div>
          <div className="flex items-center justify-between py-2">
            <span className="text-muted-foreground text-[13px] font-[540]">{COPY.deposit}</span>
            <span className="text-foreground text-sm font-[650] tracking-tight">
              {formatPln(reservation.vehicle_deposit)}
            </span>
          </div>
        </div>
      </div>

      {/* Actions */}
      {!readOnly && (
        <div className="mt-4 flex gap-2.5">
          <Button
            variant="outline"
            className="text-destructive hover:text-destructive h-12 flex-1"
            disabled={busy}
            onClick={onReject}
          >
            {COPY.reject}
          </Button>
          <Button className="h-12 flex-[2]" disabled={busy} onClick={onApprove}>
            <Check className="size-4" />
            {COPY.approve}
          </Button>
        </div>
      )}
    </div>
  );
}

export function ReasonSheet({
  busy,
  onConfirm,
  onClose,
  asModal,
}: {
  busy: boolean;
  onConfirm: (reason: RejectionReason, note: string) => void;
  onClose: () => void;
  asModal?: boolean;
}) {
  const [reason, setReason] = React.useState<RejectionReason>(REASONS[0].value);
  const [note, setNote] = React.useState("");

  return (
    <div
      className="absolute inset-0 z-50 flex bg-[rgba(20,18,22,0.55)] backdrop-blur-sm"
      onClick={onClose}
      style={{ alignItems: asModal ? "center" : "flex-end", justifyContent: "center" }}
    >
      <div
        onClick={(e) => {
          e.stopPropagation();
        }}
        className={cn("bg-card shadow-overlay w-full p-6 pb-8", asModal ? "max-w-md rounded-2xl" : "rounded-t-[28px]")}
      >
        {!asModal && <div className="bg-border mx-auto mb-4 h-1 w-10 rounded-full" />}
        <div className="text-foreground text-xl font-bold tracking-tight">{COPY.reasonTitle}</div>
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
              {COPY.noteLabel}
            </label>
            <textarea
              id="reject-note"
              value={note}
              onChange={(e) => {
                setNote(e.target.value);
              }}
              placeholder={COPY.notePlaceholder}
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
          {COPY.confirmReject}
        </Button>
      </div>
    </div>
  );
}

export function ResultOverlay({
  status,
  onDone,
  asModal,
}: {
  status: "confirmed" | "rejected";
  onDone: () => void;
  asModal?: boolean;
}) {
  const confirmed = status === "confirmed";
  return (
    <div
      className="absolute inset-0 z-50 flex bg-[rgba(20,18,22,0.55)] backdrop-blur-sm"
      style={{ alignItems: asModal ? "center" : "flex-end", justifyContent: "center" }}
    >
      <div
        className={cn("bg-card shadow-overlay w-full p-7 pb-8", asModal ? "max-w-sm rounded-2xl" : "rounded-t-[28px]")}
      >
        <div
          className={cn(
            "mx-auto mb-4 flex size-16 items-center justify-center rounded-full",
            confirmed ? "bg-[var(--flota-success-soft)]" : "bg-[var(--flota-danger-soft)]",
          )}
        >
          {confirmed ? <Check className="text-success size-8" /> : <X className="text-destructive size-8" />}
        </div>
        <div className="text-foreground text-center text-[22px] font-bold tracking-tight">
          {confirmed ? COPY.confirmedTitle : COPY.rejectedTitle}
        </div>
        <div className="text-muted-foreground mx-auto mt-2 max-w-[280px] text-center text-[13px] leading-relaxed">
          {COPY.notifiedSub}
        </div>
        <Button className="bg-foreground text-background hover:bg-foreground/90 mt-6 h-12 w-full" onClick={onDone}>
          {COPY.done}
        </Button>
      </div>
    </div>
  );
}

// ── main island ──────────────────────────────────────────────────────────────

export default function PendingQueue({ reservations: initial }: { reservations: PendingReservation[] }) {
  const [reservations, setReservations] = React.useState<PendingReservation[]>(initial);
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [reasonForId, setReasonForId] = React.useState<string | null>(null);
  const [result, setResult] = React.useState<"confirmed" | "rejected" | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [banner, setBanner] = React.useState<string | null>(null);

  const selected = reservations.find((r) => r.id === selectedId) ?? null;

  function removeFromQueue(id: string) {
    setReservations((rows) => rows.filter((r) => r.id !== id));
  }

  async function decide(id: string, decision: "confirm" | "reject", reason?: RejectionReason, note?: string) {
    setBusy(true);
    setBanner(null);
    const outcome = await postDecision(id, decision, reason, note);
    setBusy(false);
    setReasonForId(null);

    if (outcome.status === "confirmed" || outcome.status === "rejected") {
      setResult(outcome.status);
      return;
    }
    if (outcome.status === "already_decided") {
      // The friendly re-sync: drop the stale card and return to the queue.
      removeFromQueue(id);
      setSelectedId(null);
      setBanner(COPY.alreadyHandled);
      return;
    }
    setBanner(COPY.genericError);
  }

  function onResultDone() {
    if (selectedId) {
      removeFromQueue(selectedId);
    }
    setResult(null);
    setSelectedId(null);
  }

  const count = reservations.length;

  return (
    <div className="relative min-h-[60vh]">
      {/* Header */}
      <div className="flex items-baseline gap-2 px-1">
        <span className="text-warning text-[40px] leading-none font-bold tracking-tight">{count}</span>
        <span className="text-muted-foreground text-sm font-[540]">{COPY.awaitingDecision}</span>
      </div>

      {banner && (
        <div className="border-border mt-3 rounded-xl border bg-[var(--flota-warning-soft)] px-4 py-3 text-sm text-[var(--flota-ink-2)]">
          {banner}
        </div>
      )}

      {/* Detail (mobile: replaces the queue) */}
      {selected ? (
        <div className="mt-4 md:hidden">
          <RequestDetail
            reservation={selected}
            busy={busy}
            onApprove={() => decide(selected.id, "confirm")}
            onReject={() => {
              setReasonForId(selected.id);
            }}
            onBack={() => {
              setSelectedId(null);
            }}
          />
        </div>
      ) : null}

      {/* Queue */}
      <div className={cn("mt-4 flex flex-col gap-3", selected && "hidden md:flex")}>
        {count === 0 ? (
          <div className={cn(cardClass, "flex flex-col items-center justify-center px-6 py-16 text-center")}>
            <div className="text-foreground text-base font-[650]">{COPY.empty}</div>
            <div className="text-muted-foreground mt-1 text-sm">{COPY.emptyHint}</div>
          </div>
        ) : (
          reservations.map((r) => (
            <QueueCard
              key={r.id}
              reservation={r}
              selected={r.id === selectedId}
              busy={busy}
              onReview={() => {
                setSelectedId(r.id);
              }}
              onReject={() => {
                setReasonForId(r.id);
              }}
            />
          ))
        )}
      </div>

      {/* Reason sheet */}
      {reasonForId && (
        <ReasonSheet
          busy={busy}
          onClose={() => {
            setReasonForId(null);
          }}
          onConfirm={(reason, note) => decide(reasonForId, "reject", reason, note)}
        />
      )}

      {/* Result overlay */}
      {result && <ResultOverlay status={result} onDone={onResultDone} />}
    </div>
  );
}
