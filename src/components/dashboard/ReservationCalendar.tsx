// core
import * as React from "react";
import { IlamyResourceCalendar, defaultTranslations, useIlamyCalendarContext } from "@ilamy/calendar";
import type { CalendarEvent, CalendarView, Resource, Translations } from "@ilamy/calendar";
import { ChevronLeft, ChevronRight } from "lucide-react";

// components
import { CalendarDecision } from "./ReservationDecision";

// others
import dayjs from "../../lib/calendar/dayjs";
import { reservationsToEvents } from "../../lib/calendar/map";
import { dayMonthYearRange, monthYearLong } from "../../lib/format-date";
import { dashboard } from "../../lib/i18n/dashboard";
import { translator } from "../../lib/i18n/types";
import type { Locale } from "../../lib/i18n/types";
import { cn } from "../../lib/utils";
import type { CalendarReservation } from "../../types";

// The resource-timeline calendar island (S-03 Phase 7). Rendered client:only
// (the lib never SSRs in workerd). Vehicles are resource rows; pending+confirmed
// reservations are day-spanning bars. Clicking a pending bar opens the shared
// accept/reject flow (CalendarDecision → useReservationDecision); a confirmed bar
// opens a read-only detail. Read-only otherwise: no drag/resize, no empty-slot
// create.
//
// Layout follow-up (manual-testing notes L8/L9): rental granularity is one day, so
// the week view runs at `weekViewGranularity="daily"` (7 day columns, no hour grid)
// and month is the default. A custom `headerComponent` replaces the library
// toolbar to (a) omit the `+ New` create button (L9) and (b) restrict the view
// switcher to month / week (no hour-grid day view, no year). The precise
// 14:00→10:00 times live in the request detail, not the calendar bar.

function translationsFor(locale: Locale): Translations {
  const t = translator(locale, dashboard);
  return {
    ...defaultTranslations,
    today: t("calToday"),
    month: t("calMonth"),
    week: t("calWeek"),
    day: t("calDay"),
    year: t("calYear"),
    event: t("calEvent"),
    events: t("calEvents"),
    more: t("calMore"),
    resources: t("calResources"),
    resource: t("calResource"),
    time: t("calTime"),
    date: t("calDate"),
    noResourcesVisible: t("calNoResources"),
  };
}

function isoDate(value: unknown): string {
  if (typeof value === "string") {
    return value.slice(0, 10);
  }
  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }
  // dayjs object (or anything date-like): prefer .format, fall back to .toISOString.
  const candidate = value as { format?: (fmt: string) => string; toISOString?: () => string };
  if (typeof candidate.format === "function") {
    return candidate.format("YYYY-MM-DD");
  }
  if (typeof candidate.toISOString === "function") {
    return candidate.toISOString().slice(0, 10);
  }
  return "";
}

// The two views the switcher offers; the labels come from the catalog.
const VIEW_OPTIONS: { id: CalendarView; labelKey: "calMonth" | "calWeek" }[] = [
  { id: "month", labelKey: "calMonth" },
  { id: "week", labelKey: "calWeek" },
];

// Replaces the library toolbar: prev / today / next + period label on the left, a
// month/week segmented switch on the right. No `+ New`, no export, no
// hour-grid day / year view. Rendered inside the calendar provider, so it can drive
// navigation through the public context hook.
function CalendarHeader({ locale }: { locale: Locale }) {
  const t = translator(locale, dashboard);
  const { currentDate, view, setView, nextPeriod, prevPeriod, today } = useIlamyCalendarContext();

  // The two period labels used to need two hand-rolled Polish month tables — a
  // NOMINATIVE one for the standalone month title (`lipiec 2026`) and a GENITIVE
  // one for the week range (`25–31 lipca 2026`) — on the belief that workerd's ICU
  // could not be trusted. It can (probed 2026-09-01), and `Intl` makes the same
  // split for free: a month asked for on its own comes back nominative, a month
  // asked for beside a day comes back genitive. `formatRange` even reproduces the
  // range's elision byte for byte, including which end keeps the month.
  let label: string;
  if (view === "week") {
    const start = currentDate.subtract((currentDate.day() + 6) % 7, "day"); // Monday
    const end = start.add(6, "day");
    label = dayMonthYearRange(start.toDate(), end.toDate(), locale);
  } else {
    label = monthYearLong(currentDate.toDate(), locale);
  }

  const navButton = "text-foreground hover:bg-background flex size-9 items-center justify-center rounded-full";

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 px-1 pb-3">
      <div className="flex items-center gap-1">
        <button type="button" onClick={prevPeriod} aria-label={t("calPrevPeriod")} className={navButton}>
          <ChevronLeft className="size-[18px]" />
        </button>
        <button
          type="button"
          onClick={today}
          className="border-border text-foreground hover:bg-background rounded-full border px-3.5 py-1.5 text-sm font-medium"
        >
          {t("calToday")}
        </button>
        <button type="button" onClick={nextPeriod} aria-label={t("calNextPeriod")} className={navButton}>
          <ChevronRight className="size-[18px]" />
        </button>
        <span className="text-foreground ml-1.5 text-base font-bold tracking-tight capitalize">{label}</span>
      </div>

      <div className="bg-background flex rounded-full p-1">
        {VIEW_OPTIONS.map((v) => (
          <button
            key={v.id}
            type="button"
            onClick={() => {
              setView(v.id);
            }}
            aria-pressed={view === v.id}
            className={cn(
              "rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors",
              view === v.id ? "bg-card text-foreground shadow-card" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {t(v.labelKey)}
          </button>
        ))}
      </div>
    </div>
  );
}

// @ilamy v1.8.1 has no public hook for two things the day-resolution timeline
// needs (researched against the shipped bundle): (C1) marking today in the
// *month* resource header — its day cells render a plain `format("D")` with no
// `day-number-today` testid and no highlight (only the week header marks today),
// and (C2) scrolling the horizontal timeline to a target day on load. Both are
// derivable from one primitive — the target day's column index in the visible
// window — so this component computes it and drives the DOM directly. The hooks
// it relies on (`ilamy-resource-calendar`, `horizontal-grid-header`, the Radix
// `scroll-area-viewport`, the sticky gutter being the row's first child) are
// internal/unofficial; every step bails safely if the structure can't be
// resolved, so a library upgrade degrades to "no marker / no auto-scroll" rather
// than throwing. Pin: @ilamy/calendar 1.8.1.

// Walk past single-child wrappers to the flex row that holds the sticky
// resource-label gutter (first child) + the per-day column cells (the rest).
// The day cells carry no testid, so callers index them positionally.
function findColumnRow(header: Element): HTMLElement | null {
  let node: Element = header;
  while (node.children.length === 1) {
    node = node.children[0];
  }
  return node.children.length >= 2 ? (node as HTMLElement) : null;
}

function CalendarAutoFocus({ focusDate }: { focusDate?: string }) {
  const { currentDate, view } = useIlamyCalendarContext();
  const dateKey = currentDate.valueOf();
  const didScroll = React.useRef(false);

  React.useEffect(() => {
    // Two frames: let @ilamy commit the (re)rendered header/grid before we measure.
    let raf2 = 0;
    const raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => {
        const root = document.querySelector('[data-testid="ilamy-resource-calendar"]');
        const header = root?.querySelector('[data-testid="horizontal-grid-header"]');
        if (!root || !header) return;
        const row = findColumnRow(header);
        if (!row) return;
        const cells = Array.from(row.children) as HTMLElement[];
        const dayCells = cells.slice(1); // drop the sticky resource-label gutter
        if (dayCells.length === 0) return;

        const windowStart =
          view === "week"
            ? currentDate.subtract((currentDate.day() + 6) % 7, "day").startOf("day") // Monday
            : currentDate.startOf("month");
        const today = dayjs().startOf("day");

        // C1 — mark today's column header. Month view only: the week header is
        // already marked by the library, so we'd otherwise double-highlight.
        root.querySelectorAll("[data-today-col]").forEach((el) => {
          el.removeAttribute("data-today-col");
        });
        if (view === "month") {
          const todayIdx = today.diff(windowStart, "day");
          if (todayIdx >= 0 && todayIdx < dayCells.length) {
            dayCells[todayIdx].setAttribute("data-today-col", "");
          }
        }

        // C2 — one-time horizontal scroll to the deep-linked pickup day (L5) or,
        // on a default load, today. Aligns the target column flush past the
        // pinned gutter. Skipped after the first run so it never fights the user.
        if (!didScroll.current) {
          didScroll.current = true;
          const target = focusDate ? dayjs(focusDate).startOf("day") : today;
          const idx = target.diff(windowStart, "day");
          const viewport = root.querySelector('[data-slot="scroll-area-viewport"]');
          if (viewport && idx >= 0 && idx < dayCells.length) {
            const gutterWidth = cells[0]?.getBoundingClientRect().width ?? 0;
            const delta =
              dayCells[idx].getBoundingClientRect().left - viewport.getBoundingClientRect().left - gutterWidth;
            viewport.scrollLeft += delta;
          }
        }
      });
    });
    return () => {
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
    };
  }, [dateKey, view, focusDate, currentDate]);

  return null;
}

export default function ReservationCalendar({
  resources,
  reservations: initial,
  initialDate,
  initialView = "month",
  focusVehicleId,
  locale,
}: {
  resources: Resource[];
  reservations: CalendarReservation[];
  initialDate?: string;
  initialView?: CalendarView;
  focusVehicleId?: string;
  /** Islands cannot read `Astro.locals`; the mounting page passes it down. */
  locale: Locale;
}) {
  const t = translator(locale, dashboard);
  const [reservations, setReservations] = React.useState<CalendarReservation[]>(initial);
  const [active, setActive] = React.useState<CalendarReservation | null>(null);

  const events = React.useMemo(() => reservationsToEvents(reservations), [reservations]);

  // When deep-linked from a request's dates-held card (L5), tint the focused
  // vehicle's row so it's obvious which booking the calendar landed on.
  const displayResources = React.useMemo(
    () =>
      focusVehicleId
        ? resources.map((r) =>
            String(r.id) === focusVehicleId ? { ...r, backgroundColor: "var(--flota-accent-soft)" } : r,
          )
        : resources,
    [resources, focusVehicleId],
  );

  async function refetch(range: { start: unknown; end: unknown }) {
    try {
      const params = new URLSearchParams({
        start: isoDate(range.start),
        end: isoDate(range.end),
      });
      const res = await fetch(`/api/reservations/calendar?${params.toString()}`);
      if (res.ok) {
        setReservations((await res.json()) as CalendarReservation[]);
      }
    } catch {
      // A failed refetch leaves the current window plotted; the user can retry by
      // navigating again. The decision path is unaffected.
    }
  }

  function onEventClick(event: CalendarEvent) {
    const match = reservations.find((r) => r.id === event.id);
    if (match) {
      setActive(match);
    }
  }

  function onDecided(id: string, status: "confirmed" | "rejected") {
    setActive(null);
    setReservations((rows) =>
      status === "confirmed"
        ? rows.map((r) => (r.id === id ? { ...r, status: "confirmed" } : r))
        : rows.filter((r) => r.id !== id),
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="border-border bg-card shadow-card overflow-x-auto rounded-lg border p-2">
        <IlamyResourceCalendar
          resources={displayResources}
          events={events}
          initialView={initialView}
          initialDate={initialDate}
          weekViewGranularity="daily"
          firstDayOfWeek="monday"
          locale={locale}
          timezone="Europe/Warsaw"
          disableDragAndDrop
          disableCellClick
          hideExportButton
          headerComponent={
            <>
              <CalendarHeader locale={locale} />
              <CalendarAutoFocus focusDate={initialDate} />
            </>
          }
          translations={translationsFor(locale)}
          onEventClick={onEventClick}
          onDateChange={(_date: unknown, range: { start: unknown; end: unknown }) => refetch(range)}
        />
      </div>

      {/* Two-item legend (no Filtry / future-state legend) */}
      <div className="text-muted-foreground flex items-center gap-5 px-1 text-xs">
        <span className="flex items-center gap-2">
          <span
            className={cn("size-3 rounded-[4px]")}
            style={{ backgroundColor: "#FBF1DA", borderLeft: "2px solid #B6790E" }}
          />
          {t("calLegendPending")}
        </span>
        <span className="flex items-center gap-2">
          <span
            className={cn("size-3 rounded-[4px]")}
            style={{ backgroundColor: "#E3F5EC", borderLeft: "2px solid #1B9E5A" }}
          />
          {t("calLegendConfirmed")}
        </span>
      </div>

      {active && (
        <CalendarDecision
          locale={locale}
          reservation={active}
          onClose={() => {
            setActive(null);
          }}
          onDecided={onDecided}
        />
      )}
    </div>
  );
}
