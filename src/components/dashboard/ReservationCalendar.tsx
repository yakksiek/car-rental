// core
import * as React from "react";
import { IlamyResourceCalendar, defaultTranslations } from "@ilamy/calendar";
import type { CalendarEvent, Resource, Translations } from "@ilamy/calendar";

// components
import { CalendarDecision } from "./ReservationDecision";

// others
import "../../lib/calendar/dayjs";
import { reservationsToEvents } from "../../lib/calendar/map";
import { cn } from "../../lib/utils";
import type { CalendarReservation } from "../../types";

// The resource-timeline calendar island (S-03 Phase 7). Rendered client:only
// (the lib never SSRs in workerd). Vehicles are resource rows; pending+confirmed
// reservations are bars at the 14:00→10:00 window. Clicking a pending bar opens
// the shared accept/reject flow (CalendarDecision → useReservationDecision); a
// confirmed bar opens a read-only detail. Read-only otherwise: no drag/resize,
// no empty-slot create.

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

export default function ReservationCalendar({
  resources,
  reservations: initial,
}: {
  resources: Resource[];
  reservations: CalendarReservation[];
}) {
  const [reservations, setReservations] = React.useState<CalendarReservation[]>(initial);
  const [active, setActive] = React.useState<CalendarReservation | null>(null);

  const events = React.useMemo(() => reservationsToEvents(reservations), [reservations]);

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
          resources={resources}
          events={events}
          initialView="week"
          firstDayOfWeek="monday"
          locale="pl"
          timezone="Europe/Warsaw"
          disableDragAndDrop
          disableCellClick
          hideExportButton
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
