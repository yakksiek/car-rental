// core
import * as React from "react";
import { ArrowDown, Check, ChevronRight, RefreshCw, TriangleAlert, Truck } from "lucide-react";
import type { LucideIcon } from "lucide-react";

// components
import { Button } from "../ui/button";
import { DeliveryBadge, deliveryBadge } from "../protocol/DeliveryBadge";

// others
import { cn } from "../../lib/utils";
import { resendReturnEmail } from "../hooks/useReturnProtocolSubmit";
import type { DispatchReturnRow } from "../../types";

// The returns worklist (S-06 Phase 6) — the return sibling of `PickupQueue`. Every
// confirmed reservation due-or-overdue to return, with its return-protocol state
// folded in by `list_returns_today`. The action-vs-badge decision keys off
// `return_protocol_id` truthiness, exactly as the pickup list keys off `protocol_id`:
//
//   • open (still to process)  → `Przyjmij zwrot` → /dashboard/returns/<reservation_id>
//   • returned (filed today)   → a delivery badge + `Otwórz protokół` (+ a resend
//                                when the last send did not land)
//
// Overdue-open rows stay on the list until processed (the plan's due-or-overdue
// rule), so a late return never strands; they carry a `Po terminie` caption and a
// warm red-soft tint. `today` is the SERVER's calendar date (ISO `YYYY-MM-DD`),
// threaded in from the page so the overdue split is stable and never drifts with a
// client clock or a hydration mismatch.
//
// Returned rows are **kept, never filtered**: a return whose email failed is exactly
// the row the employee needs to find, and this is the only discoverable entry to the
// return view screen. `return_protocol_id` null ⇒ still open.

/** A row plus the client-side delivery-status override a successful resend applies. */
interface RowState {
  row: DispatchReturnRow;
  /** Set once a resend succeeds this session, so the badge flips to `Dostarczono` without a reload. */
  deliveryOverride: string | null;
}

type Caption = "returned" | "overdue" | "due";

/** The row's lifecycle state: returned wins, else overdue-vs-due by `return_date` against today. */
function captionOf(row: DispatchReturnRow, today: string): Caption {
  if (row.return_protocol_id) {
    return "returned";
  }
  return row.return_date < today ? "overdue" : "due";
}

/**
 * A generic vehicle glyph in a tinted box, at the row's leading edge — the app's
 * stand-in for the design's per-type silhouette (the `list_returns_today` RPC does
 * not return a vehicle photo, so a photo would need a data-layer change).
 */
function VehicleIcon() {
  return (
    <span className="bg-background flex h-[38px] w-[58px] shrink-0 items-center justify-center rounded-[9px] sm:h-11 sm:w-[70px]">
      <Truck className="text-muted-foreground size-5" />
    </span>
  );
}

/** The right-aligned overdue badge (design-contract §6) — red-soft, sharing DeliveryBadge's shape. */
function OverdueBadge() {
  return (
    <span className="text-primary inline-flex h-6 items-center gap-1 rounded-[7px] bg-[var(--flota-danger-soft)] px-2 text-[11.5px] font-bold">
      <TriangleAlert className="size-3.5" />
      Po terminie
    </span>
  );
}

type StatTone = "neutral" | "red" | "green";

const STAT_TONE: Record<StatTone, { value: string; iconBg: string; icon: string }> = {
  neutral: { value: "text-foreground", iconBg: "bg-[var(--flota-neutral-soft)]", icon: "text-foreground" },
  red: { value: "text-primary", iconBg: "bg-[var(--flota-danger-soft)]", icon: "text-primary" },
  green: { value: "text-success", iconBg: "bg-[var(--flota-success-soft)]", icon: "text-success" },
};

/**
 * One stat card of the returns worklist header — a tinted icon chip + big value +
 * label + a `Dzisiaj` caption, mirroring the design's `StatCard` (arrow-down = due,
 * triangle = overdue, check = returned). The design's `StatCard` is the desktop
 * treatment; on mobile it collapses to a compact chip (icon over value+label, no
 * `Dzisiaj`) so three fit across a 390px screen without clipping — the contract's
 * "desktop cards / mobile chips".
 */
function StatCard({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: LucideIcon;
  label: string;
  value: number;
  tone: StatTone;
}) {
  const c = STAT_TONE[tone];
  return (
    <div className="border-border bg-card shadow-card flex flex-col gap-1.5 rounded-[14px] border p-3 sm:flex-row sm:items-center sm:gap-3 sm:p-4">
      <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-[10px] sm:size-10", c.iconBg)}>
        <Icon className={cn("size-[18px]", c.icon)} />
      </span>
      <div className="min-w-0">
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0">
          <span
            className={cn("text-[20px] leading-none font-bold tracking-tight tabular-nums sm:text-[24px]", c.value)}
          >
            {value}
          </span>
          <span className="text-foreground text-[12.5px] font-[650] tracking-tight sm:text-[13px]">{label}</span>
        </div>
        <div className="text-muted-foreground mt-1 hidden text-[11.5px] sm:block">Dzisiaj</div>
      </div>
    </div>
  );
}

/** A compact rounded-full stat chip — the mobile treatment (design shows two: due + overdue). */
function StatPill({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: LucideIcon;
  label: string;
  value: number;
  tone: StatTone;
}) {
  const c = STAT_TONE[tone];
  // The "due today" pill is a white card chip (shadow, no fill); the overdue pill
  // keeps the red-soft fill. Rounded rectangle (9px), not a full stadium.
  const pillBg = tone === "red" ? "bg-[var(--flota-danger-soft)]" : "bg-card shadow-card";
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-[9px] px-3 py-1.5", pillBg)}>
      <Icon className={cn("size-3.5", c.icon)} />
      <span className={cn("text-[13px] font-bold tabular-nums", c.value)}>{value}</span>
      <span className="text-foreground text-[12.5px] font-[650]">{label}</span>
    </span>
  );
}

/**
 * The returns worklist header stats (design-contract §6). Desktop keeps the three
 * `StatCard`s (due · overdue · returned); mobile collapses to two compact chips
 * (due + overdue only — `Zwrócono` is dropped below `sm`), matching the mockup.
 */
function Stats({ due, overdue, returned }: { due: number; overdue: number; returned: number }) {
  return (
    <>
      <div className="mb-5 flex flex-wrap gap-2 sm:hidden">
        <StatPill icon={ArrowDown} label="Na dziś" value={due} tone="neutral" />
        <StatPill icon={TriangleAlert} label="Po terminie" value={overdue} tone="red" />
      </div>
      <div className="mb-6 hidden grid-cols-3 gap-4 sm:grid">
        <StatCard icon={ArrowDown} label="Na dziś" value={due} tone="neutral" />
        <StatCard icon={TriangleAlert} label="Po terminie" value={overdue} tone="red" />
        <StatCard icon={Check} label="Zwrócono" value={returned} tone="green" />
      </div>
    </>
  );
}

function ReturnRow({
  state,
  today,
  resending,
  error,
  onResend,
}: {
  state: RowState;
  today: string;
  resending: boolean;
  error: string | null;
  onResend: () => void;
}) {
  const { row } = state;
  const vehicle = [row.vehicle_make, row.vehicle_model].filter(Boolean).join(" ");
  const caption = captionOf(row, today);
  const returned = caption === "returned";
  const overdue = caption === "overdue";
  // For returned rows, the effective delivery status is the resend override when one
  // landed this session, else the folded-in value from the RPC.
  const deliveryStatus = state.deliveryOverride ?? row.delivery_status;
  const pdfPath = row.pdf_path as string | null;
  const badge = deliveryBadge(pdfPath, deliveryStatus);
  // Offer resend only when there is a stored PDF to attach *and* the last send did
  // not land. A missing PDF (`Błąd PDF`, warn) is not resendable — regenerate.
  const canResend = returned && Boolean(pdfPath) && badge.tone !== "ok";

  return (
    <li
      className={cn(
        // Mobile card padding 14; desktop row padding 15/20 (design RtQueueCardM / RtQueueRow).
        "p-3.5 sm:px-5 sm:py-[15px]",
        // Mobile = a standalone white card (outline drawn with a ring so it never
        // fights the desktop row divider). Desktop = a flat row inside the one unified
        // list card (see the `<ul>`); the shared hairline is the `<ul>`'s `divide-y`.
        "shadow-card bg-card ring-border rounded-[16px] ring-1 sm:rounded-none sm:bg-transparent sm:shadow-none sm:ring-0",
        // Overdue-open rows carry a 3px red left accent bar on both breakpoints, plus a
        // full red-soft row tint on the desktop unified list (design R1 desktop queue,
        // 2026-07-21 — reverses the earlier hover-only call). Mobile cards stay white
        // (mobile mockup). OverdueBadge shares --flota-danger-soft, so on the tinted
        // desktop row its pill blends into the fill and reads as plain icon+text.
        overdue && "border-l-primary border-l-[3px] sm:bg-[var(--flota-danger-soft)]",
      )}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-4 sm:gap-y-3">
        {/* Info — customer-first: bold customer name, then the muted vehicle line, then
            (mobile only) the reference on its own mono line. Desktop folds the
            reference into the muted line, so it needs no third line. */}
        <div className="flex min-w-0 items-center gap-3 sm:grow sm:basis-96">
          <VehicleIcon />
          <div className="min-w-0">
            <div className="text-foreground truncate text-[14px] font-[650] tracking-tight">{row.customer_name}</div>
            <div className="text-muted-foreground mt-0.5 truncate text-[11.5px] sm:text-[12px]">
              {vehicle}
              <span className="hidden sm:inline">
                {" · "}
                <span className="font-mono">{row.reference}</span>
              </span>
              {" · "}
              <span className="font-mono">{row.vehicle_plate}</span>
            </div>
            <div className="text-muted-foreground mt-px font-mono text-[11.5px] tracking-tight sm:hidden">
              {row.reference}
            </div>
          </div>
        </div>

        {/* Hairline between the info block and the action row — mobile card only,
            content-width (not full-bleed), per the design card. */}
        <div className="border-border border-t sm:hidden" />

        {/* Action row — badge left / button right on the mobile card
            (`justify-between`); a single right-aligned cluster on desktop. */}
        {returned ? (
          // Returned: badge on its own line, then two equal-width buttons below on the
          // mobile card; a single right-aligned row on desktop (design RtQueueCardM /
          // RtQueueRow). Resend is the crimson CTA (shown when the last send failed);
          // open protocol is outline. The stacked mobile layout is what un-crowds the row.
          <div className="flex shrink-0 flex-col items-start gap-2.5 sm:ml-auto sm:flex-row sm:items-center sm:gap-2">
            <DeliveryBadge pdfPath={pdfPath} deliveryStatus={deliveryStatus} fullWidthOnMobile />
            <div className="flex w-full gap-2 sm:w-auto">
              {canResend && (
                <Button
                  type="button"
                  disabled={resending}
                  onClick={onResend}
                  className="bg-primary text-primary-foreground hover:bg-primary/90 h-10 flex-1 rounded-[10px] text-[13px] font-[650] sm:h-9 sm:flex-none sm:text-[12.5px]"
                >
                  {resending ? (
                    <span className="border-primary-foreground/30 border-t-primary-foreground size-4 animate-spin rounded-full border-2" />
                  ) : (
                    <RefreshCw className="size-4" />
                  )}
                  Wyślij ponownie
                </Button>
              )}
              <Button
                asChild
                variant="outline"
                className="bg-card hover:bg-background h-10 flex-1 rounded-[10px] text-[13px] font-[650] sm:h-9 sm:flex-none sm:text-[12.5px]"
              >
                <a href={`/dashboard/protocols/${row.return_protocol_id}`}>
                  Otwórz protokół
                  <ChevronRight className="size-3.5" />
                </a>
              </Button>
            </div>
          </div>
        ) : (
          <div
            className={cn(
              "flex shrink-0 items-center gap-2 sm:ml-auto",
              // Overdue puts its badge left of the button (mobile: full-width split;
              // desktop: both right on one line, wrapping below the info when cramped);
              // a plain due row is button-only.
              overdue ? "justify-between sm:justify-end" : "justify-end",
            )}
          >
            {overdue && <OverdueBadge />}
            <Button asChild size="sm" className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-[10px]">
              <a href={`/dashboard/returns/${row.reservation_id}`}>
                Przyjmij zwrot
                <ChevronRight className="size-3.5" />
              </a>
            </Button>
          </div>
        )}
      </div>
      {error && <p className="text-primary mt-2 text-right text-[12px] font-medium">{error}</p>}
    </li>
  );
}

export default function ReturnQueue({ rows, today }: { rows: DispatchReturnRow[]; today: string }) {
  const [states, setStates] = React.useState<RowState[]>(() => rows.map((row) => ({ row, deliveryOverride: null })));
  const [resendingId, setResendingId] = React.useState<string | null>(null);
  const [errors, setErrors] = React.useState<Record<string, string>>({});

  const handleResend = React.useCallback(async (returnProtocolId: string) => {
    setResendingId(returnProtocolId);
    setErrors((prev) => Object.fromEntries(Object.entries(prev).filter(([key]) => key !== returnProtocolId)));
    const delivery = await resendReturnEmail(returnProtocolId);
    setResendingId(null);
    if (delivery === "sent") {
      setStates((prev) =>
        prev.map((s) => (s.row.return_protocol_id === returnProtocolId ? { ...s, deliveryOverride: "sent" } : s)),
      );
      return;
    }
    setErrors((prev) => ({ ...prev, [returnProtocolId]: "Nie udało się wysłać. Spróbuj ponownie." }));
  }, []);

  if (states.length === 0) {
    return (
      <div className={cn("border-border bg-card shadow-card rounded-2xl border p-10 text-center")}>
        <h2 className="text-foreground text-[16px] font-[650] tracking-tight">Brak zwrotów na dziś</h2>
        <p className="text-muted-foreground mx-auto mt-1.5 max-w-sm text-[13px]">
          Gdy wynajęty pojazd będzie do zwrotu, pojawi się tutaj.
        </p>
      </div>
    );
  }

  const due = states.filter((s) => captionOf(s.row, today) === "due").length;
  const overdue = states.filter((s) => captionOf(s.row, today) === "overdue").length;
  const returned = states.filter((s) => captionOf(s.row, today) === "returned").length;

  return (
    <>
      <Stats due={due} overdue={overdue} returned={returned} />
      {/* Mobile = separate cards with a gap. Desktop = one rounded card whose rows
          are split by internal hairlines (`divide-y`); `overflow-hidden` clips the
          rows' corners and overdue tints to the outer radius. Shadow only, no border
          (design ScreenReturnsQueue card). */}
      <ul className="sm:divide-border sm:bg-card sm:shadow-card flex flex-col gap-3 sm:gap-0 sm:divide-y sm:overflow-hidden sm:rounded-[18px]">
        {states.map((state) => {
          const returnProtocolId = state.row.return_protocol_id;
          return (
            <ReturnRow
              key={state.row.reservation_id}
              state={state}
              today={today}
              resending={resendingId !== null && resendingId === returnProtocolId}
              error={returnProtocolId ? (errors[returnProtocolId] ?? null) : null}
              onResend={() => returnProtocolId && handleResend(returnProtocolId)}
            />
          );
        })}
      </ul>
    </>
  );
}
