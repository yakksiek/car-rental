// core
import * as React from "react";
import { ChevronRight, Truck } from "lucide-react";

// others
import { cn } from "../../lib/utils";
import { estimatedTotal, formatPln, rentalDays, reservationStatusLabelPl } from "../../lib/format";
import { highlightSegments, relativeDayPl, searchDateRange } from "../../lib/search-format";
import type { SearchResultReservation, SearchResultReturn, SearchResultVehicle } from "../../types";

// The three result rows shared by the ⌘K dropdown (Phase 3) and the full results
// page (Phase 4), built to design-contract.md Surface 2. Each renders a complete
// `<a>` so the caller only decides the wrapper: cmdk's `Command.Item asChild` in
// the dropdown, a plain list item on the results page.
//
// The thumbnail is a lucide `<Truck>` in a tinted box, not `VehicleSilhouette`
// (contract D3 — the silhouette is an Astro component, and every other React list
// in the app already uses this stand-in).

/** Deep-link targets — there is no per-reservation staff detail route (contract D8). */
export const searchHref = {
  /** The calendar focused on the booking: week view, anchored on pickup, vehicle row highlighted. */
  reservation: (row: SearchResultReservation) =>
    `/dashboard/calendar?view=week&date=${row.pickup_date}&vehicle=${encodeURIComponent(row.vehicle_id)}`,
  return: (row: SearchResultReturn) => `/dashboard/returns/${row.id}`,
  vehicle: (row: SearchResultVehicle) => `/dashboard/vehicles/${row.id}/edit`,
};

/** Row chrome shared by every result and quick-jump row — contract Surface 2 `RowShell`. */
export const ROW_SHELL =
  "group mx-1.5 flex cursor-default items-center gap-3 rounded-[11px] px-3 py-[9px] data-[selected=true]:bg-background data-[selected=true]:shadow-[inset_0_0_0_1px_var(--flota-hair)]";

/** Wrap the parts of `text` that the query matched, so a row shows WHY it is here. */
export function Highlight({ text, query }: { text: string; query: string }) {
  return (
    <>
      {highlightSegments(text, query).map((segment, index) =>
        segment.match ? (
          <mark key={index} className="rounded-[3px] bg-[rgba(180,54,56,0.14)] text-inherit">
            {segment.text}
          </mark>
        ) : (
          <React.Fragment key={index}>{segment.text}</React.Fragment>
        ),
      )}
    </>
  );
}

type PillTone = "pending" | "success" | "warning" | "danger" | "neutral";

const PILL_TONES: Record<PillTone, string> = {
  pending: "bg-[var(--flota-warning-soft)] text-warning",
  warning: "bg-[var(--flota-warning-soft)] text-warning",
  success: "bg-[var(--flota-success-soft)] text-success",
  danger: "bg-[var(--flota-danger-soft)] text-primary",
  neutral: "bg-[var(--flota-neutral-soft)] text-[var(--flota-neutral)]",
};

/** Status pill — dot + label, contract Surface 2 `Pill`. */
export function Pill({ label, tone }: { label: string; tone: PillTone }) {
  return (
    <span
      className={cn(
        "inline-flex h-[22px] shrink-0 items-center gap-1 rounded-[6px] px-2 text-[11px] font-[650]",
        PILL_TONES[tone],
      )}
    >
      <span className="size-1.5 rounded-full bg-current" aria-hidden="true" />
      {label}
    </span>
  );
}

/** Reservation status → pill tone. Base statuses only (contract D4 — no derived "Zakończona"). */
const RESERVATION_TONES: Record<SearchResultReservation["status"], PillTone> = {
  pending: "pending",
  confirmed: "success",
  rejected: "danger",
  cancelled: "neutral",
};

/** 58×40 vehicle thumbnail stand-in (contract D3). */
function VThumb() {
  return (
    <span className="bg-background flex h-10 w-[58px] shrink-0 items-center justify-center rounded-[10px]">
      <Truck className="text-muted-foreground size-[18px]" />
    </span>
  );
}

function MonoRef({ children }: { children: React.ReactNode }) {
  return <span className="text-muted-foreground font-mono text-[12px]">{children}</span>;
}

/** The `↵` affordance on the active row (contract Surface 2 ReservationRow). */
function EnterChip() {
  return (
    <span className="bg-card text-muted-foreground hidden h-5 min-w-[18px] items-center justify-center rounded-[5px] border border-[var(--flota-hair)] px-1 text-[11px] font-[650] group-data-[selected=true]:flex">
      ↵
    </span>
  );
}

/**
 * The trailing affordance on rows the mockup draws with a chevron. On the ACTIVE
 * row the chevron gives way to the `↵` chip: a chevron says "click me", but the
 * highlighted row is the one Enter opens, and leaving a dead arrow there while the
 * footer advertises "↵ otwórz" tells the user the wrong thing. On the results page
 * nothing is ever selected, so the chevron simply stays.
 */
function TrailingAffordance() {
  return (
    <>
      <ChevronRight className="text-muted-foreground size-4 shrink-0 group-data-[selected=true]:hidden" />
      <EnterChip />
    </>
  );
}

// Every row spreads its remaining props onto the anchor. This is what makes
// `<Command.Item asChild><ReservationRow …/></Command.Item>` work: cmdk hands the
// child its `cmdk-item` marker, `data-selected`, id and ref through Slot, and a
// component that swallowed them would render a row the keyboard could never reach.
type RowAnchorProps = Omit<React.ComponentPropsWithRef<"a">, "children">;

export function ReservationRow({
  row,
  query,
  className,
  ...anchor
}: { row: SearchResultReservation; query: string } & RowAnchorProps) {
  const days = rentalDays(row.pickup_date, row.return_date);
  const vehicle = [row.vehicle_make, row.vehicle_model].filter(Boolean).join(" ") || row.vehicle_name;

  return (
    <a href={searchHref.reservation(row)} {...anchor} className={cn(ROW_SHELL, className)}>
      <VThumb />
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <MonoRef>{row.reference}</MonoRef>
          <Pill label={reservationStatusLabelPl(row.status)} tone={RESERVATION_TONES[row.status]} />
        </span>
        <span className="text-foreground mt-0.5 block truncate text-[13.5px] font-[600]">
          <Highlight text={row.customer_name} query={query} />
        </span>
        <span className="text-muted-foreground block truncate text-[12px]">
          {vehicle} · {searchDateRange(row.pickup_date, row.return_date)}
        </span>
      </span>
      <span className="text-foreground shrink-0 text-[14px] font-bold">
        {formatPln(estimatedTotal(row.daily_rate, days))}
      </span>
      <EnterChip />
    </a>
  );
}

export function ReturnRow({
  row,
  query,
  today,
  className,
  ...anchor
}: { row: SearchResultReturn; query: string; today: string } & RowAnchorProps) {
  const vehicle = [row.vehicle_make, row.vehicle_model].filter(Boolean).join(" ") || row.vehicle_name;
  const returned = row.status === "returned";

  return (
    <a href={searchHref.return(row)} {...anchor} className={cn(ROW_SHELL, className)}>
      <VThumb />
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <MonoRef>{row.reference}</MonoRef>
          <Pill label={returned ? "Zwrócono" : "Na dziś"} tone={returned ? "success" : "warning"} />
        </span>
        <span className="text-foreground mt-0.5 block truncate text-[13.5px] font-[600]">
          <Highlight text={row.customer_name} query={query} />
        </span>
        <span className="text-muted-foreground block truncate text-[12px]">
          {vehicle} · <span className="font-mono">{row.vehicle_plate}</span> · {relativeDayPl(row.return_date, today)}
        </span>
      </span>
      <TrailingAffordance />
    </a>
  );
}

export function VehicleRow({
  row,
  query,
  className,
  ...anchor
}: { row: SearchResultVehicle; query: string } & RowAnchorProps) {
  const spec = [row.make, row.model].filter(Boolean).join(" ");

  return (
    <a href={searchHref.vehicle(row)} {...anchor} className={cn(ROW_SHELL, className)}>
      <VThumb />
      <span className="min-w-0 flex-1">
        <span className="text-foreground block truncate text-[13.5px] font-[600]">
          <Highlight text={row.name} query={query} />
        </span>
        <span className="text-muted-foreground block truncate text-[12px]">
          {spec}
          {spec && " · "}
          <span className="font-mono">
            <Highlight text={row.plate} query={query} />
          </span>
        </span>
      </span>
      {!row.is_active && <Pill label="Wycofany" tone="neutral" />}
      <TrailingAffordance />
    </a>
  );
}
