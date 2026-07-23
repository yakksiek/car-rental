// core
import * as React from "react";
import { Calendar, Check, ChevronRight, RefreshCw, TriangleAlert, Truck } from "lucide-react";

// components
import { Button } from "../ui/button";
import { DeliveryBadge, deliveryBadge } from "../protocol/DeliveryBadge";

// others
import { cn } from "../../lib/utils";
import { resendReturnEmail } from "../hooks/useReturnProtocolSubmit";
import { captionOf, toggleReturnsFilter } from "../../lib/returns-filter";
import type { ReturnCaption } from "../../lib/returns-filter";
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

/** The active filter, `null` = "Wszystkie" (all). The three captions carry a tone. */
type FilterKey = ReturnCaption | null;

/** Live counts by caption plus the `all` total — the badge numbers on every control. */
interface FilterCounts {
  all: number;
  due: number;
  overdue: number;
  returned: number;
}

// "Wszystkie" (all) selected fill — navy, matching the mobile `All` pill (O5). Desktop
// and mobile both lead with this control, so the fill is shared.
const ALL_SELECTED_FILL = "bg-foreground text-background";

// The three tone-coded controls after "Wszystkie". Selected fill is per-tone:
// `Na dziś` neutral → navy, `Po terminie` danger → crimson, `Zwrócono` success → green
// (design-contract §B; navy/success selected were `provisional`, resolved here to the
// tone-solid fills the token map names).
const SEGMENTS: { key: ReturnCaption; label: string; selectedFill: string }[] = [
  { key: "due", label: "Na dziś", selectedFill: ALL_SELECTED_FILL },
  { key: "overdue", label: "Po terminie", selectedFill: "bg-primary text-primary-foreground" },
  { key: "returned", label: "Zwrócono", selectedFill: "bg-success text-white" },
];

/** Labels for the live list header, keyed by the active filter (`null` → `all`). */
const HEADER_LABELS: Record<"all" | ReturnCaption, string> = {
  all: "Wszystkie zwroty",
  due: "Na dziś",
  overdue: "Po terminie",
  returned: "Zwrócono",
};

/**
 * The small live count nested in a segment/pill. On a selected (tone-filled) control
 * it darkens the tone (`bg-black/15`) and inherits the control's light text; unselected
 * it is a neutral-soft chip with muted digits.
 */
function CountBadge({ value, selected, className }: { value: number; selected: boolean; className?: string }) {
  return (
    <span
      className={cn(
        "flex items-center justify-center rounded-full px-1.5 font-bold tabular-nums",
        selected ? "bg-black/15" : "text-muted-foreground bg-[var(--flota-neutral-soft)]",
        className,
      )}
    >
      {value}
    </span>
  );
}

/** One desktop segment: a tone-filled rounded pill when selected, plain text otherwise. */
function DesktopSegment({
  label,
  count,
  selected,
  selectedFill,
  onClick,
}: {
  label: string;
  count: number;
  selected: boolean;
  selectedFill: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={cn(
        "flex items-center gap-2 rounded-full px-4 py-2 text-[14px] font-[650] transition-colors",
        selected ? selectedFill : "text-foreground hover:bg-background",
      )}
    >
      {label}
      <CountBadge value={count} selected={selected} className="min-w-[20px] text-[12px]" />
    </button>
  );
}

/** One mobile pill: tone-filled when selected, a white card chip otherwise. */
function MobilePill({
  label,
  count,
  selected,
  selectedFill,
  onClick,
}: {
  label: string;
  count: number;
  selected: boolean;
  selectedFill: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={cn(
        "flex shrink-0 items-center gap-1.5 rounded-full px-4 py-2 text-[13px] font-[650] transition-colors",
        selected ? selectedFill : "text-foreground bg-card shadow-card",
      )}
    >
      {label}
      <CountBadge value={count} selected={selected} className="min-w-[18px] text-[11px]" />
    </button>
  );
}

/**
 * The stat area rebuilt as a filter bar (design-contract §B). Both breakpoints lead
 * with a "Wszystkie" (all/`null`) control followed by the three tone-coded captions.
 * Desktop (≥ sm) is one unified white bar of four segments; mobile (< sm) is four
 * pills that wrap to a second row (no horizontal scroll). Counts stay live (from all
 * rows); the search field and sparkline in the EN artboards are cut (out of scope).
 */
function FilterBar({
  filter,
  counts,
  dateLabel,
  onSelect,
}: {
  filter: FilterKey;
  counts: FilterCounts;
  dateLabel?: string;
  onSelect: (next: FilterKey) => void;
}) {
  return (
    <>
      <div className="bg-card shadow-card mb-4 hidden items-center gap-1 rounded-[18px] p-2 sm:flex">
        <DesktopSegment
          label="Wszystkie"
          count={counts.all}
          selected={filter === null}
          selectedFill={ALL_SELECTED_FILL}
          onClick={() => {
            onSelect(null);
          }}
        />
        {SEGMENTS.map((seg) => (
          <DesktopSegment
            key={seg.key}
            label={seg.label}
            count={counts[seg.key]}
            selected={filter === seg.key}
            selectedFill={seg.selectedFill}
            onClick={() => {
              onSelect(toggleReturnsFilter(filter, seg.key));
            }}
          />
        ))}
        {/* Today's date on the bar's right — replaces the cut sparkline (design O2). */}
        {dateLabel && (
          <span className="text-muted-foreground mr-2 ml-auto flex items-center gap-1.5 text-[13px] font-[540]">
            <Calendar className="size-4" />
            {dateLabel}
          </span>
        )}
      </div>

      {/* Four pills that wrap to a second row on a narrow screen (design O5/O6). */}
      <div className="mb-4 flex flex-wrap gap-2 sm:hidden">
        <MobilePill
          label="Wszystkie"
          count={counts.all}
          selected={filter === null}
          selectedFill={ALL_SELECTED_FILL}
          onClick={() => {
            onSelect(null);
          }}
        />
        {SEGMENTS.map((seg) => (
          <MobilePill
            key={seg.key}
            label={seg.label}
            count={counts[seg.key]}
            selected={filter === seg.key}
            selectedFill={seg.selectedFill}
            onClick={() => {
              onSelect(toggleReturnsFilter(filter, seg.key));
            }}
          />
        ))}
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

export default function ReturnQueue({
  rows,
  today,
  initialFilter = null,
  dateLabel,
}: {
  rows: DispatchReturnRow[];
  today: string;
  // Seeded server-side from `?filter` (parsed in returns.astro) so a deep-link renders
  // pre-filtered with no hydration flash — a client-only `window.location` read would
  // differ from the SSR'd HTML and mismatch/flash. `null` = "Wszystkie" (all).
  initialFilter?: ReturnCaption | null;
  // Today's date, pre-formatted server-side (workerd ICU can't do Polish) for the
  // desktop filter bar's right edge.
  dateLabel?: string;
}) {
  const [states, setStates] = React.useState<RowState[]>(() => rows.map((row) => ({ row, deliveryOverride: null })));
  const [resendingId, setResendingId] = React.useState<string | null>(null);
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [filter, setFilter] = React.useState<FilterKey>(initialFilter);

  // Toggle the active filter and mirror it into the URL — `history.replaceState`, not a
  // navigation, so reloads/deep-links are stable and the back button is untouched.
  const applyFilter = React.useCallback((next: FilterKey) => {
    setFilter(next);
    const url = new URL(window.location.href);
    if (next === null) {
      url.searchParams.delete("filter");
    } else {
      url.searchParams.set("filter", next);
    }
    window.history.replaceState(window.history.state, "", url);
  }, []);

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

  const counts: FilterCounts = {
    all: states.length,
    due: states.filter((s) => captionOf(s.row, today) === "due").length,
    overdue: states.filter((s) => captionOf(s.row, today) === "overdue").length,
    returned: states.filter((s) => captionOf(s.row, today) === "returned").length,
  };
  const visibleStates = states.filter((s) => filter === null || captionOf(s.row, today) === filter);

  return (
    <>
      <FilterBar filter={filter} counts={counts} dateLabel={dateLabel} onSelect={applyFilter} />
      {/* Live list header — desktop only; on mobile the per-filter counts live inside
          the pills, so the mockups drop this line there (deviation(screenshot)). */}
      <p className="text-foreground mb-3 hidden text-[14px] font-[650] tracking-tight sm:block">
        {HEADER_LABELS[filter ?? "all"]} <span className="text-muted-foreground">· {visibleStates.length}</span>
      </p>
      {visibleStates.length === 0 ? (
        filter === "overdue" ? (
          // The reassuring overdue-clear state (design-contract §D, O3/O7): a green-soft
          // check chip over the positive copy. Shown only when the overdue filter is on
          // and nothing is overdue (there are still due/returned rows on the list).
          <div className="border-border bg-card shadow-card rounded-2xl border p-10 text-center">
            <span className="mx-auto flex size-16 items-center justify-center rounded-[18px] bg-[var(--flota-success-soft)]">
              <Check className="text-success size-7" />
            </span>
            <h2 className="text-foreground mt-4 text-[16px] font-[650] tracking-tight">Brak zwrotów po terminie</h2>
            <p className="text-muted-foreground mx-auto mt-1.5 max-w-sm text-[13px]">
              Wszystkie pojazdy wróciły na czas.
            </p>
          </div>
        ) : (
          // `Na dziś` / `Zwrócono` filter with no matches — a neutral line (design-contract §D).
          <p className="text-muted-foreground py-10 text-center text-[13px]">Brak pozycji dla tego filtra.</p>
        )
      ) : (
        // Mobile = separate cards with a gap. Desktop = one rounded card whose rows
        // are split by internal hairlines (`divide-y`); `overflow-hidden` clips the
        // rows' corners and overdue tints to the outer radius. Shadow only, no border
        // (design ScreenReturnsQueue card).
        <ul className="sm:divide-border sm:bg-card sm:shadow-card flex flex-col gap-3 sm:gap-0 sm:divide-y sm:overflow-hidden sm:rounded-[18px]">
          {visibleStates.map((state) => {
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
      )}
    </>
  );
}
