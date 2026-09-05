// core
import * as React from "react";
import { ArrowDown, Check, ChevronRight, Key, Truck } from "lucide-react";
import type { LucideIcon } from "lucide-react";

// others
import { cn } from "../../lib/utils";
import { captionOf } from "../../lib/returns-filter";
import { withFrom } from "../../lib/back-target";
import type { ScheduleGroups } from "../../lib/dispatch-board";
import { translator, type Locale } from "../../lib/i18n/types";
import { staff } from "../../lib/i18n/staff";
import type { DispatchReturnRow, DispatchRow } from "../../types";

// Today's Schedule — the grouped pickups/returns worklist of the dispatch cockpit
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

/** The `staff`-namespace translator these row components take instead of a locale. */
type Translate = (key: keyof typeof staff.en) => string;

// Rows carry `?from=<the cockpit's current URL>` so the screen they open sends the
// user back HERE rather than to its own worklist — the cockpit is a second entry
// point to pages that used to have only one (see `lib/back-target.ts`). `origin`
// includes the active `?section`, so the mobile chip survives the round trip.

export function toPickupItem(row: DispatchRow, origin: string): ScheduleItem {
  const done = Boolean(row.protocol_id);
  return {
    key: row.reservation_id,
    href: withFrom(
      done ? `/dashboard/protocols/${row.protocol_id}` : `/dashboard/pickups/${row.reservation_id}`,
      origin,
    ),
    customerName: row.customer_name,
    vehicle: [row.vehicle_make, row.vehicle_model].filter(Boolean).join(" "),
    reference: row.reference,
    done,
    overdue: false,
  };
}

export function toReturnItem(row: DispatchReturnRow, today: string, origin: string): ScheduleItem {
  const caption = captionOf(row, today);
  const done = caption === "returned";
  return {
    key: row.reservation_id,
    href: withFrom(
      done ? `/dashboard/protocols/${row.return_protocol_id}` : `/dashboard/returns/${row.reservation_id}`,
      origin,
    ),
    customerName: row.customer_name,
    vehicle: [row.vehicle_make, row.vehicle_model].filter(Boolean).join(" "),
    reference: row.reference,
    done,
    overdue: caption === "overdue",
  };
}

/**
 * Open: a hairline ring. Done: a filled green disc with a check.
 *
 * Two sizes, both from the design source: the desktop row's `size-6` / 1.5px ring
 * (§C) and the mobile `ActionRow`'s 30px / 2px one.
 */
export function StatusCircle({ done, size = "sm" }: { done: boolean; size?: "sm" | "md" }) {
  const box = size === "sm" ? "size-6" : "size-[30px]";
  return done ? (
    <span className={cn("bg-success flex shrink-0 items-center justify-center rounded-full", box)}>
      <Check className={cn("text-white", size === "sm" ? "size-[13px]" : "size-[14px]")} />
    </span>
  ) : (
    <span className={cn("border-border shrink-0 rounded-full", box, size === "sm" ? "border-[1.5px]" : "border-2")} />
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

/** Index of the first done row; `-1` when the group has none. Rows arrive pre-sorted. */
function firstDoneIndex(items: ScheduleItem[]): number {
  return items.findIndex((item) => item.done);
}

/**
 * The rule that opens a group's finished block.
 *
 * Done rows sink to the bottom and are separated by this instead of being dimmed:
 * an `opacity` treatment reads as DISABLED, but these rows are live links to the
 * filed protocol. Position + this divider carry "done" without implying inert.
 */
function DoneDivider({ label, tone = "card" }: { label: string; tone?: "card" | "panel" }) {
  return (
    <div className={cn("flex items-center gap-2", tone === "card" ? "px-5 pt-3.5 pb-2" : "mt-3 mb-2 px-1.5")}>
      <span className="text-muted-foreground text-[10.5px] font-bold tracking-[0.4px] uppercase">{label}</span>
      <span className={cn("flex-1 border-t", tone === "card" ? "border-border" : "border-black/10")} />
    </div>
  );
}

/**
 * Desktop right affordance: outline `Protocol ›`, the overdue chip, or — on a done
 * row — the quieter `Protocol ›` that opens the FILED protocol.
 *
 * A done row used to show a "completed" status label here. That wasted the slot:
 * the row already links to the protocol, and the filled check circle plus the
 * completed divider state the outcome. The affordance names the action instead.
 */
function DesktopAction({ item, t }: { item: ScheduleItem; t: Translate }) {
  if (item.done) {
    return (
      <span className="border-border bg-background text-foreground inline-flex h-[34px] shrink-0 items-center gap-1.5 rounded-[9px] border px-3.5 text-[12.5px] font-[650]">
        {t("protocol")}
        <ChevronRight className="size-[13px] text-[var(--flota-ink-2)]" />
      </span>
    );
  }
  if (item.overdue) {
    return (
      <span className="text-primary inline-flex h-8 shrink-0 items-center rounded-[10px] bg-[var(--flota-danger-soft)] px-3 text-[12px] font-[650]">
        {t("overdue")}
      </span>
    );
  }
  return (
    <span className="border-border bg-card text-foreground inline-flex h-[34px] shrink-0 items-center gap-1.5 rounded-[9px] border px-3.5 text-[12.5px] font-[650]">
      {t("protocol")}
      <ChevronRight className="size-[13px] text-[var(--flota-ink-2)]" />
    </span>
  );
}

/** One desktop row — the whole row is the link (deviation: JSX rows are static). */
function DesktopRow({ item, t }: { item: ScheduleItem; t: Translate }) {
  return (
    <li>
      <a
        href={item.href}
        className={cn(
          "border-border hover:bg-background flex flex-wrap items-center gap-x-4 gap-y-2.5 border-b px-5 py-3.5 transition-colors",
          "last:border-b-0",
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
          <DesktopAction item={item} t={t} />
        </span>
      </a>
    </li>
  );
}

/** A group's rows, with the finished block fenced off by its divider. */
function DesktopRows({ items, t }: { items: ScheduleItem[]; t: Translate }) {
  const doneAt = firstDoneIndex(items);
  return (
    <ul>
      {items.map((item, i) => (
        <React.Fragment key={item.key}>
          {i === doneAt && (
            <li>
              <DoneDivider label={t("scheduleDone")} />
            </li>
          )}
          <DesktopRow item={item} t={t} />
        </React.Fragment>
      ))}
    </ul>
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
const EMPTY_KEY: Record<ScheduleKind, "emptyPickups" | "emptyReturns"> = {
  pickups: "emptyPickups",
  returns: "emptyReturns",
};

/**
 * Mobile CTA: filled protocol / ghost return / danger overdue.
 *
 * A done row keeps a real affordance — the ghost protocol link, opening the filed
 * protocol — rather than a "completed" status label; the check circle and the
 * completed divider already carry the outcome. Ghost, not filled, so finished
 * work does not compete with open work now that the dim is gone.
 */
function MobileAction({ item, kind, t }: { item: ScheduleItem; kind: ScheduleKind; t: Translate }) {
  if (item.done) {
    return (
      <span className="bg-background text-foreground border-border inline-flex h-8 shrink-0 items-center rounded-[10px] border px-3 text-[12px] font-[650]">
        {t("protocol")}
      </span>
    );
  }
  const cta =
    kind === "pickups"
      ? { label: t("protocol"), tone: "bg-foreground text-background" }
      : item.overdue
        ? { label: t("overdue"), tone: "text-primary bg-[var(--flota-danger-soft)]" }
        : { label: t("returnAction"), tone: "bg-background text-foreground border border-border" };

  return (
    <span className={cn("inline-flex h-8 shrink-0 items-center rounded-[10px] px-3 text-[12px] font-[650]", cta.tone)}>
      {cta.label}
    </span>
  );
}

/** One mobile row — a standalone white card; the whole card is the link. */
function MobileRow({ item, kind, t }: { item: ScheduleItem; kind: ScheduleKind; t: Translate }) {
  return (
    <a href={item.href} className="bg-card shadow-card mb-2 flex items-center gap-3 rounded-[16px] px-3.5 py-3">
      <StatusCircle done={item.done} size="md" />
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
      <MobileAction item={item} kind={kind} t={t} />
    </a>
  );
}

/**
 * The tinted section panel that now wraps each mobile group (design `Section`,
 * pulled 2026-07-27). Header and rows sit INSIDE one rounded tint; the three
 * tints are deliberate one-offs in the JSX, like the desktop band's `#E6EAF0`.
 */
const SECTION_TINTS = {
  ink: "bg-[#E4E6EA]",
  green: "bg-[#E2EAE3]",
  amber: "bg-[#EFE9DD]",
} as const;

export function MobileSection({
  title,
  icon: Icon,
  tint,
  action,
  children,
}: {
  title: string;
  icon: LucideIcon;
  tint: keyof typeof SECTION_TINTS;
  /** Optional right-hand affordance in the header band (e.g. the Wnioski "Otwórz"). */
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className={cn("mb-4 rounded-[18px] px-2 pt-2.5 pb-1", SECTION_TINTS[tint])}>
      <div className="mx-1.5 mb-2.5 flex items-center gap-2 px-1.5">
        <h2 className="text-foreground flex flex-1 items-center gap-2 text-[13px] font-extrabold tracking-[0.4px] uppercase">
          <Icon className="size-3.5" aria-hidden="true" />
          {title}
        </h2>
        {action}
      </div>
      <div className="px-1">{children}</div>
    </section>
  );
}

/** One mobile schedule section: the tinted panel plus its row cards. */
export function MobileScheduleSection({
  kind,
  label,
  total,
  items,
  locale,
}: {
  kind: ScheduleKind;
  label: string;
  total: number;
  items: ScheduleItem[];
  locale: Locale;
}) {
  const t = translator(locale, staff);
  return (
    <MobileSection
      title={`${label} · ${total}`}
      icon={kind === "pickups" ? Key : ArrowDown}
      tint={kind === "pickups" ? "ink" : "green"}
    >
      {items.length === 0 ? (
        <p className="bg-card shadow-card text-muted-foreground mb-2 rounded-[16px] px-3.5 py-6 text-center text-[13px]">
          {t(EMPTY_KEY[kind])}
        </p>
      ) : (
        items.map((item, i) => (
          <React.Fragment key={item.key}>
            {i === firstDoneIndex(items) && <DoneDivider label={t("scheduleDone")} tone="panel" />}
            <MobileRow item={item} kind={kind} t={t} />
          </React.Fragment>
        ))
      )}
    </MobileSection>
  );
}

/**
 * The desktop schedule: one card, two groups. Rows carry their own hairline, so
 * the group bands and rows share a single divider rhythm.
 */
export default function DispatchSchedule({
  groups,
  today,
  origin,
  locale,
}: {
  groups: ScheduleGroups;
  today: string;
  /** The cockpit's current URL, threaded onto each row as `?from`. */
  origin: string;
  locale: Locale;
}) {
  const t = translator(locale, staff);
  const pickupItems = groups.pickups.rows.map((row) => toPickupItem(row, origin));
  const returnItems = groups.returns.rows.map((row) => toReturnItem(row, today, origin));

  return (
    // `@container`: the rows' action-drop below keys off THIS card's width — it is
    // sized by the 1.5fr schedule column, never by the viewport.
    <div className="bg-card shadow-card @container overflow-hidden rounded-[18px]">
      {/* The band labels render uppercase in CSS, so the catalog holds sentence case. */}
      <GroupHeader kind="pickups" label={t("navPickups")} progressLabel={groups.pickups.progressLabel} first />
      {pickupItems.length === 0 ? (
        <p className="text-muted-foreground px-5 py-6 text-[13px]">{t("emptyPickups")}</p>
      ) : (
        <DesktopRows items={pickupItems} t={t} />
      )}

      <GroupHeader kind="returns" label={t("navReturns")} progressLabel={groups.returns.progressLabel} first={false} />
      {returnItems.length === 0 ? (
        <p className="text-muted-foreground px-5 py-6 text-[13px]">{t("emptyReturns")}</p>
      ) : (
        <DesktopRows items={returnItems} t={t} />
      )}
    </div>
  );
}
