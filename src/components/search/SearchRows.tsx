// core
import * as React from "react";
import { ChevronRight, Truck } from "lucide-react";

// others
import { cn } from "../../lib/utils";
import { estimatedTotal, formatPln, rentalDays, reservationStatusLabelPl } from "../../lib/format";
import { highlightSegments, relativeDayPl, searchDateRange } from "../../lib/search-format";
import type { SearchResultReservation, SearchResultReturn, SearchResultVehicle } from "../../types";

// The three result rows of the ⌘K dropdown and its mobile full-screen twin, built
// to design-contract.md Surface 2. Each renders a complete `<a>` and the caller
// only supplies the wrapper — cmdk's `Command.Item asChild`. They took a
// `className` override while a full results page reshaped them; that page is gone,
// so the row shell has exactly one shape.
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

/**
 * Row chrome shared by every result and quick-jump row — contract Surface 2 `RowShell`.
 *
 * THE ACTIVE BACKGROUND IS PER-SURFACE (contract D19), because the two surfaces sit on
 * different grounds. The design gives `RowShell` one active treatment — `tokens.bg` plus a
 * hairline inset ring — which reads on the desktop panel (`tokens.card`) but is a no-op inside
 * the mobile overlay, whose own body is `tokens.bg`: the row paints the exact color underneath
 * it and only the `rgba(15,23,42,0.08)` ring survives. The mock never exposed this because no
 * mobile screen passes `active`; we render it for real, since cmdk always keeps a row selected.
 * So below `md` figure and ground swap — white row on the grey overlay — and the ring is
 * unchanged on both. The two branches use disjoint media conditions rather than an override, so
 * neither depends on the other's position in the generated stylesheet.
 */
export const ROW_SHELL =
  "group mx-1.5 flex cursor-default items-center gap-3 rounded-[11px] px-3 py-[9px] data-[selected=true]:shadow-[inset_0_0_0_1px_var(--flota-hair)] max-md:data-[selected=true]:bg-card md:data-[selected=true]:bg-background";

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

/**
 * Keyboard-key chip — contract Surface D `Kbd`, at its exact values. One component
 * for all three uses (the field's `⌘`/`K`, the panel footer's hints, and the active
 * row's `↵`) because they are the same chip: written twice, it drifted twice.
 * `font-sans` is not decoration — it undoes the UA's monospace default on `<kbd>`,
 * which is what kept the old `<span>` copy looking identical.
 */
export function Kbd({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <kbd
      className={cn(
        "bg-card flex h-5 min-w-[18px] items-center justify-center rounded-[5px] border border-[var(--flota-hair)] px-[5px] font-sans text-[11px] font-[650] text-[var(--flota-ink-2)] shadow-[0_1px_0_rgba(15,23,42,0.05)]",
        className,
      )}
    >
      {children}
    </kbd>
  );
}

/** The `↵` affordance on the active row (contract Surface 2 ReservationRow). */
function EnterChip() {
  return <Kbd className="hidden group-data-[selected=true]:flex">↵</Kbd>;
}

/**
 * The trailing affordance on rows the mockup draws with a chevron. On the ACTIVE
 * row the chevron gives way to the `↵` chip: a chevron says "click me", but the
 * highlighted row is the one Enter opens, and leaving a dead arrow there while the
 * footer advertises "↵ otwórz" tells the user the wrong thing. The design keeps
 * both side by side — swapping them is a recorded deviation (contract D16).
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
  ...anchor
}: { row: SearchResultReservation; query: string } & RowAnchorProps) {
  const days = rentalDays(row.pickup_date, row.return_date);
  const vehicle = [row.vehicle_make, row.vehicle_model].filter(Boolean).join(" ") || row.vehicle_name;

  return (
    <a href={searchHref.reservation(row)} {...anchor} className={ROW_SHELL}>
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
  ...anchor
}: { row: SearchResultReturn; query: string; today: string } & RowAnchorProps) {
  const vehicle = [row.vehicle_make, row.vehicle_model].filter(Boolean).join(" ") || row.vehicle_name;
  const returned = row.status === "returned";

  return (
    <a href={searchHref.return(row)} {...anchor} className={ROW_SHELL}>
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

/**
 * The design draws this row (it did not when the row was first authored — its demo
 * fleet was empty), so the spec line follows it exactly: the MAKE only, separated
 * from the plate by a round dot rather than a `·` character. The model is not
 * rendered — the name already carries it (`Mercedes Sprinter 315 CDI` /
 * `Mercedes-Benz` / `Sprinter`). The `Wycofany` pill is the whole of D9: the design
 * has no retired state because its demo fleet has no retired vehicle.
 */
export function VehicleRow({ row, query, ...anchor }: { row: SearchResultVehicle; query: string } & RowAnchorProps) {
  return (
    <a href={searchHref.vehicle(row)} {...anchor} className={ROW_SHELL}>
      <VThumb />
      <span className="min-w-0 flex-1">
        <span className="text-foreground block truncate text-[13.5px] font-[600]">
          <Highlight text={row.name} query={query} />
        </span>
        <span className="mt-0.5 flex items-center gap-[7px] overflow-hidden whitespace-nowrap">
          {row.make && (
            <>
              <span className="text-muted-foreground text-[12px]">{row.make}</span>
              <span className="size-[3px] shrink-0 rounded-full bg-[var(--flota-hair)]" aria-hidden="true" />
            </>
          )}
          <span className="font-mono text-[11.5px] font-[600] text-[var(--flota-ink-2)]">
            <Highlight text={row.plate} query={query} />
          </span>
        </span>
      </span>
      {!row.is_active && <Pill label="Wycofany" tone="neutral" />}
      <TrailingAffordance />
    </a>
  );
}
