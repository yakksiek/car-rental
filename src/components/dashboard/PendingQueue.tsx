// core
import * as React from "react";
import { format, formatDistanceToNow } from "date-fns";
import { pl } from "date-fns/locale";
import { ArrowRight, Check, ChevronLeft, Mail, Phone, Truck, User } from "lucide-react";

// components
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { ReasonSheet, ResultOverlay } from "./ReservationDecision";

// others
import { cn } from "../../lib/utils";
import { fromIsoDate } from "../../lib/date-iso";
import { estimatedTotal, formatDuration, formatPln, rentalDays } from "../../lib/format";
import { useReservationDecision } from "../hooks/useReservationDecision";
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
  openCalendar: "Zobacz w kalendarzu",
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

// ── subcomponents ────────────────────────────────────────────────────────────

const cardClass = "rounded-lg border border-border bg-card shadow-card";

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

// Compact desktop master-list card: click selects (detail renders in the right
// panel). No action buttons — the detail panel carries the decision controls.
function MasterCard({
  reservation,
  selected,
  onSelect,
}: {
  reservation: PendingReservation;
  selected: boolean;
  onSelect: () => void;
}) {
  const days = rentalDays(reservation.pickup_date, reservation.return_date);
  const total = formatPln(estimatedTotal(reservation.vehicle_daily_rate, days));

  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        cardClass,
        "w-full p-4 text-left transition-colors",
        selected ? "ring-foreground ring-2" : "hover:bg-background",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="text-muted-foreground font-mono text-[11px] font-semibold">{reservation.reference}</span>
        <span className="text-muted-foreground text-[11px]">{submittedAgo(reservation.created_at)}</span>
      </div>
      <div className="text-foreground mt-1 truncate text-[15px] font-[650] tracking-tight">
        {reservation.customer_name}
      </div>
      <div className="mt-2 flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <Truck className="text-foreground size-5 shrink-0" strokeWidth={1.5} />
          <span className="text-muted-foreground truncate text-xs">
            {vehicleName(reservation)} · {formatRange(reservation.pickup_date, reservation.return_date)}
          </span>
        </div>
        <span className="text-foreground shrink-0 text-sm font-bold tracking-tight">{total}</span>
      </div>
    </button>
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

  const pad = Math.max(1, Math.round(days * 0.4));
  const heldSidePct = (pad / (days + 2 * pad)) * 100;

  // Deep-link the dates-held card to the calendar focused on this booking: week
  // view, anchored on the pickup date, with the vehicle's row highlighted (L5).
  const calendarHref = `/dashboard/calendar?view=week&date=${reservation.pickup_date}&vehicle=${encodeURIComponent(
    reservation.vehicle_id,
  )}`;

  return (
    // `@container`: the vehicle/dates 2-up below keys off THIS panel's width, not
    // the viewport — RequestDetail is shared (calendar reuses it) and renders in a
    // narrow master-detail column, where a viewport breakpoint would clip.
    <div className={cn("@container flex flex-col", className)}>
      {/* Compact header — centered, with the list→detail back affordance. Shown
          below lg, where the detail is a full-width view reached from the queue
          (the back button is the only way back); the master-detail header is at lg+. */}
      <div className="flex items-center justify-between gap-2 px-1 pb-3 lg:hidden">
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

      {/* Master-detail header (lg+) — left-aligned reference + PENDING + name,
          with a prominent right-aligned total (L7). No back button: the master
          list stays visible beside it, so it renders with withBackButton={false}. */}
      <div className="hidden items-start justify-between gap-4 px-1 pb-4 lg:flex">
        <div className="min-w-0">
          <div className="flex items-center gap-2.5">
            <span className="text-muted-foreground font-mono text-xs font-semibold">{reservation.reference}</span>
            {!readOnly && <Badge className="text-warning bg-[var(--flota-warning-soft)]">PENDING</Badge>}
          </div>
          <h2 className="text-foreground mt-2 truncate text-[26px] font-bold tracking-tight">
            {reservation.customer_name}
          </h2>
          <div className="text-muted-foreground mt-1 text-[13px]">
            {COPY.submitted} · {submittedAgo(reservation.created_at)}
          </div>
        </div>
        <div className="shrink-0 text-right">
          <div className="text-foreground text-[26px] font-bold tracking-tight">{total}</div>
          <div className="text-muted-foreground mt-1 text-xs">
            {formatDuration(days)} · + kaucja {formatPln(reservation.vehicle_deposit)}
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-3">
        {/* Vehicle + dates sit 2-up once this panel is wide enough (L7), stacked
            otherwise. Container-query, not viewport: in the master-detail column
            the detail is ~300px even on a wide screen, so `md:` would split it in
            half and clip the vehicle card. */}
        <div className="grid gap-3 @min-[520px]:grid-cols-2">
          {/* Vehicle */}
          <div className={cn(cardClass, "flex items-center gap-3.5 p-4")}>
            <div className="bg-background text-foreground flex h-[60px] w-24 shrink-0 items-center justify-center rounded-xl">
              <Truck className="size-10" strokeWidth={1.4} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-foreground text-[15px] font-[650] tracking-tight">{vehicleName(reservation)}</div>
              {reservation.vehicle_production_year ? (
                <div className="text-muted-foreground mt-0.5 text-xs">
                  Rocznik {reservation.vehicle_production_year}
                </div>
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
        </div>

        {/* Dates held — a mini timeline of the held window that links through to
            the full calendar (L5). The vehicle's other bookings (green confirmed
            blocks) need the per-vehicle busy ranges and are a follow-up. */}
        <a href={calendarHref} className={cn(cardClass, "hover:bg-background block p-4 transition-colors")}>
          <div className="mb-2 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="bg-warning size-2 rounded-[3px]" />
              <span className="text-muted-foreground text-xs font-bold tracking-wide uppercase">{COPY.datesHeld}</span>
            </div>
            <span className="text-muted-foreground flex items-center gap-1 text-[11px] font-medium">
              {COPY.openCalendar}
              <ArrowRight className="size-3" />
            </span>
          </div>
          <div className="bg-background relative h-7 overflow-hidden rounded-md">
            <div
              className="border-warning bg-warning/15 absolute inset-y-0 flex items-center rounded-[5px] border-l-2 px-2"
              style={{ left: `${heldSidePct}%`, right: `${heldSidePct}%` }}
            >
              <span className="text-warning truncate font-mono text-[10.5px] font-bold">{reservation.reference}</span>
            </div>
          </div>
          <div className="text-muted-foreground mt-1.5 flex justify-between text-[10.5px]">
            <span>{formatDayShort(reservation.pickup_date)}</span>
            <span>{formatDayShort(reservation.return_date)}</span>
          </div>
          <div className="mt-2.5 text-xs leading-relaxed text-[var(--flota-ink-2)]">{COPY.datesHeldNote}</div>
        </a>

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

// ── main island ──────────────────────────────────────────────────────────────

export default function PendingQueue({ reservations: initial }: { reservations: PendingReservation[] }) {
  const [reservations, setReservations] = React.useState<PendingReservation[]>(initial);
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [reasonForId, setReasonForId] = React.useState<string | null>(null);
  const [result, setResult] = React.useState<"confirmed" | "rejected" | null>(null);
  // The id whose decision produced the current result overlay — removed on "Gotowe".
  // Tracked explicitly because on desktop the decided row may be the fallback
  // selection (selectedId still null).
  const [decidedId, setDecidedId] = React.useState<string | null>(null);
  const [banner, setBanner] = React.useState<string | null>(null);
  // The one decision mechanism, shared with the calendar.
  const { busy, decide: runDecision } = useReservationDecision();

  const selected = reservations.find((r) => r.id === selectedId) ?? null;

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
      // The friendly re-sync: drop the stale card and return to the queue.
      removeFromQueue(id);
      if (selectedId === id) {
        setSelectedId(null);
      }
      setBanner(COPY.alreadyHandled);
      return;
    }
    setBanner(COPY.genericError);
  }

  function onResultDone() {
    if (decidedId) {
      removeFromQueue(decidedId);
      if (selectedId === decidedId) {
        // Mobile returns to the queue; desktop advances to the next pending row.
        setSelectedId(null);
      }
    }
    setDecidedId(null);
    setResult(null);
  }

  const count = reservations.length;
  // Desktop master-detail keeps a request selected on the right at all times;
  // fall back to the first pending one (and advance to the next after a decision).
  const desktopSelected = selected ?? reservations.at(0) ?? null;

  const emptyState = (
    <div className={cn(cardClass, "flex flex-col items-center justify-center px-6 py-16 text-center")}>
      <div className="text-foreground text-base font-[650]">{COPY.empty}</div>
      <div className="text-muted-foreground mt-1 text-sm">{COPY.emptyHint}</div>
    </div>
  );

  return (
    <div className="relative min-h-[60vh]">
      {/* The count header lives in the shell topbar (desktop) + page header
          (mobile); the queue only owns the re-sync banner + the list/detail. */}
      {banner && (
        <div className="border-border rounded-xl border bg-[var(--flota-warning-soft)] px-4 py-3 text-sm text-[var(--flota-ink-2)]">
          {banner}
        </div>
      )}

      {/* ── Mobile + tablet: queue → detail navigation (below lg) ────────── */}
      <div className="lg:hidden">
        {selected ? (
          <div className="mt-4">
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
        ) : (
          <div className="mt-4 flex flex-col gap-3">
            {count === 0
              ? emptyState
              : reservations.map((r) => (
                  <QueueCard
                    key={r.id}
                    reservation={r}
                    busy={busy}
                    onReview={() => {
                      setSelectedId(r.id);
                    }}
                    onReject={() => {
                      setReasonForId(r.id);
                    }}
                  />
                ))}
          </div>
        )}
      </div>

      {/* ── Desktop: master list + detail panel side by side ────────────── */}
      {/* At lg+, not md+: below 1024px the 240px sidebar + 360px master leave the
          detail too narrow, so sub-lg widths use the single-column queue above. */}
      <div className="mt-4 hidden lg:grid lg:grid-cols-[360px_1fr] lg:gap-6">
        {count === 0 ? (
          <div className="lg:col-span-2">{emptyState}</div>
        ) : (
          <>
            <div className="flex flex-col gap-3">
              {reservations.map((r) => (
                <MasterCard
                  key={r.id}
                  reservation={r}
                  selected={r.id === desktopSelected?.id}
                  onSelect={() => {
                    setSelectedId(r.id);
                  }}
                />
              ))}
            </div>
            <div>
              {desktopSelected && (
                <RequestDetail
                  reservation={desktopSelected}
                  busy={busy}
                  withBackButton={false}
                  onApprove={() => decide(desktopSelected.id, "confirm")}
                  onReject={() => {
                    setReasonForId(desktopSelected.id);
                  }}
                />
              )}
            </div>
          </>
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
