// core
import * as React from "react";
import { IlamyResourceCalendar, defaultTranslations, useIlamyCalendarContext } from "@ilamy/calendar";
import type { CalendarEvent, CalendarView, Resource, Translations } from "@ilamy/calendar";
import { ChevronLeft, ChevronRight } from "lucide-react";

// components
import { CalendarDecision } from "./ReservationDecision";

// others
import "../../lib/calendar/dayjs";
import { reservationsToEvents } from "../../lib/calendar/map";
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
// switcher to Miesiąc / Tydzień (no hour-grid Dzień, no Rok). The precise
// 14:00→10:00 times live in the request detail, not the calendar bar.

const TRANSLATIONS: Translations = {
  ...defaultTranslations,
  today: "Dziś",
  month: "Miesiąc",
  week: "Tydzień",
  day: "Dzień",
  year: "Rok",
  event: "rezerwacja",
  events: "rezerwacje",
  more: "więcej",
  resources: "Pojazdy",
  resource: "Pojazd",
  time: "Godzina",
  date: "Data",
  noResourcesVisible: "Brak pojazdów",
};

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

// Polish month names — nominative for the month-view title, genitive for the
// week-view range. Self-contained so the label never depends on the dayjs locale
// bundle being loaded in workerd.
const PL_MONTHS_NOM = [
  "styczeń",
  "luty",
  "marzec",
  "kwiecień",
  "maj",
  "czerwiec",
  "lipiec",
  "sierpień",
  "wrzesień",
  "październik",
  "listopad",
  "grudzień",
];
const PL_MONTHS_GEN = [
  "stycznia",
  "lutego",
  "marca",
  "kwietnia",
  "maja",
  "czerwca",
  "lipca",
  "sierpnia",
  "września",
  "października",
  "listopada",
  "grudnia",
];

const VIEW_OPTIONS: { id: CalendarView; label: string }[] = [
  { id: "month", label: "Miesiąc" },
  { id: "week", label: "Tydzień" },
];

// Replaces the library toolbar: prev / Dziś / next + period label on the left, a
// Miesiąc/Tydzień segmented switch on the right. No `+ New`, no export, no
// hour-grid Dzień / Rok. Rendered inside the calendar provider, so it can drive
// navigation through the public context hook.
function CalendarHeader() {
  const { currentDate, view, setView, nextPeriod, prevPeriod, today } = useIlamyCalendarContext();

  let label: string;
  if (view === "week") {
    const start = currentDate.subtract((currentDate.day() + 6) % 7, "day"); // Monday
    const end = start.add(6, "day");
    label =
      start.month() === end.month()
        ? `${start.date()}–${end.date()} ${PL_MONTHS_GEN[end.month()]} ${end.year()}`
        : `${start.date()} ${PL_MONTHS_GEN[start.month()]} – ${end.date()} ${PL_MONTHS_GEN[end.month()]} ${end.year()}`;
  } else {
    label = `${PL_MONTHS_NOM[currentDate.month()]} ${currentDate.year()}`;
  }

  const navButton = "text-foreground hover:bg-background flex size-9 items-center justify-center rounded-full";

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 px-1 pb-3">
      <div className="flex items-center gap-1">
        <button type="button" onClick={prevPeriod} aria-label="Poprzedni okres" className={navButton}>
          <ChevronLeft className="size-[18px]" />
        </button>
        <button
          type="button"
          onClick={today}
          className="border-border text-foreground hover:bg-background rounded-full border px-3.5 py-1.5 text-sm font-medium"
        >
          Dziś
        </button>
        <button type="button" onClick={nextPeriod} aria-label="Następny okres" className={navButton}>
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
            {v.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export default function ReservationCalendar({
  resources,
  reservations: initial,
  initialDate,
  initialView = "month",
  focusVehicleId,
}: {
  resources: Resource[];
  reservations: CalendarReservation[];
  initialDate?: string;
  initialView?: CalendarView;
  focusVehicleId?: string;
}) {
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

  // On a focus deep-link the week's 7 day columns overflow a narrow viewport and
  // open scrolled to Monday, so a booking later in the week sits off-screen.
  // Once the grid has rendered, scroll the pickup day's column into view. @ilamy
  // tags each day-number element `day-number-<D>` (or `day-number-today`); we
  // poll briefly because the resource grid mounts after this effect first runs.
  React.useEffect(() => {
    if (!initialDate) {
      return;
    }
    const day = Number(initialDate.slice(8, 10));
    const todayIso = new Date().toISOString().slice(0, 10);
    const id = initialDate === todayIso ? "day-number-today" : `day-number-${day}`;

    let tries = 0;
    const timer = setInterval(() => {
      const el = document.getElementById(id);
      if (el) {
        el.scrollIntoView({ inline: "center", block: "nearest" });
        clearInterval(timer);
      } else if (++tries > 20) {
        clearInterval(timer);
      }
    }, 80);
    return () => {
      clearInterval(timer);
    };
  }, [initialDate]);

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
      <div className="border-border bg-card shadow-card overflow-x-auto rounded-2xl border p-2">
        <IlamyResourceCalendar
          resources={displayResources}
          events={events}
          initialView={initialView}
          initialDate={initialDate}
          weekViewGranularity="daily"
          firstDayOfWeek="monday"
          locale="pl"
          timezone="Europe/Warsaw"
          disableDragAndDrop
          disableCellClick
          hideExportButton
          headerComponent={<CalendarHeader />}
          translations={TRANSLATIONS}
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
          Oczekujące
        </span>
        <span className="flex items-center gap-2">
          <span
            className={cn("size-3 rounded-[4px]")}
            style={{ backgroundColor: "#E3F5EC", borderLeft: "2px solid #1B9E5A" }}
          />
          Potwierdzone
        </span>
      </div>

      {active && (
        <CalendarDecision
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
