// core
import { ArrowDown, Check, ChevronRight, Key, Truck } from "lucide-react";

// others
import { cn } from "../../lib/utils";
import { captionOf } from "../../lib/returns-filter";
import { withFrom } from "../../lib/back-target";
import type { ScheduleGroups } from "../../lib/dispatch-board";
import type { DispatchReturnRow, DispatchRow } from "../../types";

// Today's Schedule — the grouped Wydania/Zwroty worklist of the dispatch cockpit
// (design-contract §C). Desktop renders ONE unified card whose two groups are
// opened by a tinted band and whose rows are hairline-divided; the row itself is
// deliberately lighter than the full queue rows (no plates, delivery badges or
// resend) because it is a dispatcher's glance, not the processing screen.
//
// Completion state is free from the row data: a dispatch row is done once it
// carries a `protocol_id`, a return row once it carries a `return_protocol_id`.
// Done rows dim and link to the filed protocol; open rows link into the handover
// flow. `today` is the server's UTC date, so the overdue split matches the queue.

/** A schedule row flattened to what both breakpoints render. */
export interface ScheduleItem {
  key: string;
  href: string;
  customerName: string;
  vehicle: string;
  reference: string;
  done: boolean;
  overdue: boolean;
}

/** Which group a row belongs to — drives the CTA copy and the band tone. */
export type ScheduleKind = "pickups" | "returns";

// Rows carry `?from=/dashboard` so the screen they open sends the user back HERE
// rather than to its own worklist — the cockpit is a second entry point to pages
// that used to have only one (see `lib/back-target.ts`).
const ORIGIN = "/dashboard";

export function toPickupItem(row: DispatchRow): ScheduleItem {
  const done = Boolean(row.protocol_id);
  return {
    key: row.reservation_id,
    href: withFrom(
      done ? `/dashboard/protocols/${row.protocol_id}` : `/dashboard/pickups/${row.reservation_id}`,
      ORIGIN,
    ),
    customerName: row.customer_name,
    vehicle: [row.vehicle_make, row.vehicle_model].filter(Boolean).join(" "),
    reference: row.reference,
    done,
    overdue: false,
  };
}

export function toReturnItem(row: DispatchReturnRow, today: string): ScheduleItem {
  const caption = captionOf(row, today);
  const done = caption === "returned";
  return {
    key: row.reservation_id,
    href: withFrom(
      done ? `/dashboard/protocols/${row.return_protocol_id}` : `/dashboard/returns/${row.reservation_id}`,
      ORIGIN,
    ),
    customerName: row.customer_name,
    vehicle: [row.vehicle_make, row.vehicle_model].filter(Boolean).join(" "),
    reference: row.reference,
    done,
    overdue: caption === "overdue",
  };
}

/** Open: a hairline ring. Done: a filled green disc with a check. */
export function StatusCircle({ done }: { done: boolean }) {
  return done ? (
    <span className="bg-success flex size-6 shrink-0 items-center justify-center rounded-full">
      <Check className="size-[13px] text-white" />
    </span>
  ) : (
    <span className="border-border size-6 shrink-0 rounded-full border-[1.5px]" />
  );
}

/**
 * The generic vehicle glyph box — the `list_dispatch_today` / `list_returns_today`
 * RPCs return no vehicle type or photo, so the design's per-type silhouette is a
 * single `Truck` (deviation 5), same stand-in `ReturnQueue` uses.
 */
export function VehicleGlyph() {
  return (
    <span className="bg-background flex h-11 w-[70px] shrink-0 items-center justify-center rounded-[9px]">
      <Truck className="text-muted-foreground size-5" />
    </span>
  );
}

/** Customer name over the muted `{make model} · {reference}` line. */
export function ScheduleItemText({ item }: { item: ScheduleItem }) {
  return (
    <div className="min-w-0 flex-1">
      <div className="text-foreground truncate text-[14px] font-[650] tracking-[-0.2px]">{item.customerName}</div>
      <div className="text-muted-foreground mt-0.5 truncate text-[12px]">
        {item.vehicle}
        {" · "}
        <span className="font-mono">{item.reference}</span>
      </div>
    </div>
  );
}

/** Desktop right affordance: outline `Protokół ›`, the overdue chip, or `Zakończone`. */
function DesktopAction({ item }: { item: ScheduleItem }) {
  if (item.done) {
    return <span className="text-success shrink-0 text-[12.5px] font-[650]">Zakończone</span>;
  }
  if (item.overdue) {
    return (
      <span className="text-primary inline-flex h-8 shrink-0 items-center rounded-[10px] bg-[var(--flota-danger-soft)] px-3 text-[12px] font-[650]">
        Po terminie
      </span>
    );
  }
  return (
    <span className="border-border bg-card text-foreground inline-flex h-[34px] shrink-0 items-center gap-1.5 rounded-[9px] border px-3.5 text-[12.5px] font-[650]">
      Protokół
      <ChevronRight className="size-[13px] text-[var(--flota-ink-2)]" />
    </span>
  );
}

/** One desktop row — the whole row is the link (deviation: JSX rows are static). */
function DesktopRow({ item }: { item: ScheduleItem }) {
  return (
    <li>
      <a
        href={item.href}
        className={cn(
          "border-border hover:bg-background flex flex-wrap items-center gap-x-4 gap-y-2.5 border-b px-5 py-3.5 transition-colors",
          "last:border-b-0",
          item.done && "opacity-55",
        )}
      >
        <StatusCircle done={item.done} />
        <VehicleGlyph />
        <ScheduleItemText item={item} />
        {/* Below a ~500px COLUMN width the affordance drops to its own right-aligned
            line so the customer name stops colliding with it. Keyed on the card's
            container width, not the viewport: this panel is sized by the 1.5fr grid
            column, so a `lg:` breakpoint would measure the wrong box (see the
            embeddable-panels lesson). 500px ≈ a 1157px viewport at the desktop grid. */}
        <span className="flex w-full shrink-0 justify-end @min-[500px]:w-auto">
          <DesktopAction item={item} />
        </span>
      </a>
    </li>
  );
}

/** The tinted band that opens a group: tone dot + label, progress right-aligned. */
function GroupHeader({
  kind,
  label,
  progressLabel,
  first,
}: {
  kind: ScheduleKind;
  label: string;
  progressLabel: string;
  first: boolean;
}) {
  return (
    <div
      className={cn(
        // The `#E6EAF0` band tint is a deliberate one-off from the design JSX —
        // darker than `bg-background` so the band reads inside the white card.
        "border-border flex items-center justify-between border-b bg-[#E6EAF0] px-5 pt-3 pb-2.5",
        !first && "border-t",
      )}
    >
      <div className="flex items-center gap-2">
        <span
          className={cn("size-[7px] rounded-full", kind === "pickups" ? "bg-foreground" : "bg-success")}
          aria-hidden="true"
        />
        <span className="text-[11.5px] font-bold tracking-[0.4px] text-[var(--flota-ink-2)] uppercase">{label}</span>
      </div>
      <span className="text-muted-foreground text-[11.5px] font-[650]">{progressLabel}</span>
    </div>
  );
}

/** Per-group quiet-day line, reusing the queue pages' copy (design-contract §G). */
export const EMPTY_COPY: Record<ScheduleKind, string> = {
  pickups: "Brak wydań na dziś",
  returns: "Brak zwrotów na dziś",
};

/** Mobile CTA: filled `Protokół` / ghost `Zwrot` / danger `Po terminie` / done text. */
function MobileAction({ item, kind }: { item: ScheduleItem; kind: ScheduleKind }) {
  if (item.done) {
    return <span className="text-success shrink-0 text-[12.5px] font-[650]">Zakończone</span>;
  }
  const cta =
    kind === "pickups"
      ? { label: "Protokół", tone: "bg-foreground text-background" }
      : item.overdue
        ? { label: "Po terminie", tone: "text-primary bg-[var(--flota-danger-soft)]" }
        : { label: "Zwrot", tone: "bg-background text-foreground border border-border" };

  return (
    <span className={cn("inline-flex h-8 shrink-0 items-center rounded-[10px] px-3 text-[12px] font-[650]", cta.tone)}>
      {cta.label}
    </span>
  );
}

/** One mobile row — a standalone white card; the whole card is the link. */
function MobileRow({ item, kind }: { item: ScheduleItem; kind: ScheduleKind }) {
  return (
    <a
      href={item.href}
      className={cn(
        "bg-card shadow-card mb-2 flex items-center gap-3 rounded-[16px] px-3.5 py-3",
        item.done && "opacity-55",
      )}
    >
      <StatusCircle done={item.done} />
      <div className="min-w-0 flex-1">
        <div className="text-foreground truncate text-[14px] leading-[1.15] font-[650] tracking-[-0.2px]">
          {item.customerName}
        </div>
        <div className="text-muted-foreground mt-0.5 truncate text-[12px]">
          {item.vehicle}
          {" · "}
          <span className="font-mono">{item.reference}</span>
        </div>
      </div>
      <MobileAction item={item} kind={kind} />
    </a>
  );
}

/**
 * One mobile section: an uppercase `WYDANIA · {total}` header with its glyph, then
 * the row cards (or the quiet-day line).
 */
export function MobileScheduleSection({
  kind,
  label,
  total,
  items,
}: {
  kind: ScheduleKind;
  label: string;
  total: number;
  items: ScheduleItem[];
}) {
  const Icon = kind === "pickups" ? Key : ArrowDown;
  return (
    <section className="mb-[18px]">
      <h2 className="text-muted-foreground flex items-center gap-2 px-1 pb-2 text-[13px] font-bold tracking-[0.4px] uppercase">
        <Icon className="size-3.5" aria-hidden="true" />
        {label} · {total}
      </h2>
      {items.length === 0 ? (
        <p className="bg-card shadow-card text-muted-foreground rounded-[16px] px-3.5 py-6 text-center text-[13px]">
          {EMPTY_COPY[kind]}
        </p>
      ) : (
        items.map((item) => <MobileRow key={item.key} item={item} kind={kind} />)
      )}
    </section>
  );
}

/**
 * The desktop schedule: one card, two groups. Rows carry their own hairline, so
 * the group bands and rows share a single divider rhythm.
 */
export default function DispatchSchedule({ groups, today }: { groups: ScheduleGroups; today: string }) {
  const pickupItems = groups.pickups.rows.map(toPickupItem);
  const returnItems = groups.returns.rows.map((row) => toReturnItem(row, today));

  return (
    // `@container`: the rows' action-drop below keys off THIS card's width — it is
    // sized by the 1.5fr schedule column, never by the viewport.
    <div className="bg-card shadow-card @container overflow-hidden rounded-[18px]">
      <GroupHeader kind="pickups" label="WYDANIA" progressLabel={groups.pickups.progressLabel} first />
      {pickupItems.length === 0 ? (
        <p className="text-muted-foreground px-5 py-6 text-[13px]">{EMPTY_COPY.pickups}</p>
      ) : (
        <ul>
          {pickupItems.map((item) => (
            <DesktopRow key={item.key} item={item} />
          ))}
        </ul>
      )}

      <GroupHeader kind="returns" label="ZWROTY" progressLabel={groups.returns.progressLabel} first={false} />
      {returnItems.length === 0 ? (
        <p className="text-muted-foreground px-5 py-6 text-[13px]">{EMPTY_COPY.returns}</p>
      ) : (
        <ul>
          {returnItems.map((item) => (
            <DesktopRow key={item.key} item={item} />
          ))}
        </ul>
      )}
    </div>
  );
}
