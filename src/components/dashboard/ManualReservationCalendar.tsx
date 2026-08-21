// core
import * as React from "react";
import { format } from "date-fns";
import { pl } from "date-fns/locale";
import { labelDayButton, type DateRange, type DayButton, type Matcher } from "react-day-picker";

// components
import { Calendar } from "../ui/calendar";

// others
import { checkRangeBookable, dayAvailabilityMap, type RangeConflict } from "../../lib/availability";
import { fromIsoDate, toIsoDate } from "../../lib/date-iso";
import { formatDuration, rentalDays } from "../../lib/format";
import { cn } from "../../lib/utils";
import type { VehicleBusyRange } from "../../types";

// The manual-reservation modal's availability-aware range picker (S-12a),
// ported from the design source's `MrCalendarPopover` + `DayCell` — see
// `context/changes/manual-reservation-date-picker/design-contract.md` for the
// per-element spec every value here is transcribed from.
//
// Rendered IN FLOW beneath the two `Termin` fields, not absolutely positioned:
// the modal body grows and its footer stays pinned on both breakpoints.
//
// Selection is `react-day-picker` `mode="range"` rather than the source's
// hand-rolled `pickDay` (D11) — the house pattern (`BookingWidget.tsx:217`),
// which gives keyboard and screen-reader behaviour for free. The open field
// drives which caption reads as active, not which end of the range is set.

const COPY = {
  // Verbatim from the source.
  legendSelected: "Wybrane",
  legendHalf: "Dzień odbioru / zwrotu — wciąż dostępny",
  legendFull: "W pełni zajęte",
  apply: "Zastosuj",
  // deviation(reuse): the static source draws no veto state; these three are
  // already shipped and translated on the public widget.
  hintPickupTaken: "Wybrany dzień odbioru jest niedostępny. Wybierz inny termin.",
  hintReturnTaken: "Wybrany dzień zwrotu jest niedostępny. Wybierz inny termin.",
  hintSpansBooked: "Wybrany termin jest niedostępny. Wybierz inne daty.",
  // deviation(a11y-added): the static source has no aria.
  pickupOnlyLabel: "dostępny tylko jako dzień odbioru",
  returnOnlyLabel: "dostępny tylko jako dzień zwrotu",
  prevMonth: "Poprzedni miesiąc",
  nextMonth: "Następny miesiąc",
} as const;

const HINT: Record<RangeConflict, string> = {
  pickupTaken: COPY.hintPickupTaken,
  returnTaken: COPY.hintReturnTaken,
  spansBooked: COPY.hintSpansBooked,
};

// The source's own two-letter forms. The raw `pl` locale emits "pon.", "wt.", …,
// so the headers are forced through `formatWeekdayName`. Indexed by `getDay()`.
const WEEKDAYS = ["Nd", "Pn", "Wt", "Śr", "Cz", "Pt", "So"] as const;

/** `"1 kwi"` — the source's `mrFmt`, shared with the modal's day labels. */
function formatDayShort(date: Date): string {
  return format(date, "d MMM", { locale: pl });
}

/** `"Kwiecień 2026"` — the source's `PL_MON_FULL` caption; sentence case, NOT uppercased. */
function formatCaption(date: Date): string {
  const month = format(date, "LLLL yyyy", { locale: pl });
  return month.charAt(0).toUpperCase() + month.slice(1);
}

/**
 * One day cell. Re-authored rather than restyled through `modifiersClassNames`:
 * the source's `DayCell` is a 34px-tall, full-width, `overflow: hidden` box whose
 * radius and fill both depend on where in the range it sits, and shadcn's stock
 * day button is a square icon-button. Precedence is the contract's: selected and
 * in-range paint over the busy fills, which paint over a plain day.
 */
function MrDayCell({ className, day, modifiers, ...props }: React.ComponentProps<typeof DayButton>) {
  const inRange = modifiers.range_middle;
  const selected = modifiers.selected && !inRange;
  const busyFull = modifiers.busyFull;

  return (
    <button
      data-day={day.date.toLocaleDateString("en-CA")}
      className={cn(
        "relative flex h-[34px] w-full items-center justify-center overflow-hidden text-[13px] transition-[background-color] duration-[120ms]",
        // Radius 9 on the range endpoints, 0 on the days between, so a selected
        // span reads as one continuous bar.
        inRange ? "rounded-none" : "rounded-[9px]",
        selected
          ? "bg-primary font-bold text-white"
          : inRange
            ? "bg-accent text-primary font-medium"
            : busyFull
              ? "cell-busy-full text-muted-foreground font-medium opacity-75"
              : modifiers.busyAm
                ? "cell-busy-am text-foreground font-medium"
                : modifiers.busyPm
                  ? "cell-busy-pm text-foreground font-medium"
                  : modifiers.disabled
                    ? "text-muted-foreground font-medium opacity-50"
                    : "text-foreground font-medium",
        modifiers.disabled && "cursor-not-allowed",
        className,
      )}
      {...props}
    />
  );
}

interface Props {
  busyRanges: VehicleBusyRange[];
  /** ISO `YYYY-MM-DD`, or `""` when unset. */
  pickup: string;
  returnDate: string;
  /** Which `Termin` field opened the picker — positions the tail, nothing else. */
  openField: "pickup" | "return";
  onChange: (pickup: string, returnDate: string) => void;
  onApply: () => void;
}

export function ManualReservationCalendar({ busyRanges, pickup, returnDate, openField, onChange, onApply }: Props) {
  const [hint, setHint] = React.useState<string | null>(null);

  const selected = React.useMemo<DateRange | undefined>(() => {
    const from = fromIsoDate(pickup);
    const to = fromIsoDate(returnDate);
    return from || to ? { from: from ?? undefined, to: to ?? undefined } : undefined;
  }, [pickup, returnDate]);

  // Same per-day half-state map the public calendar uses, memoized on the ranges
  // exactly as `BookingWidget.tsx:112` does.
  const availability = React.useMemo(() => dayAvailabilityMap(busyRanges), [busyRanges]);

  // Disabled: past days (D13 — the source draws no past state) plus only the
  // FULLY-blocked days. The two half-states stay selectable and are caught by the
  // `onSelect` veto instead.
  const disabledDays = React.useMemo<Matcher[]>(() => {
    const matchers: Matcher[] = [{ before: new Date(new Date().setHours(0, 0, 0, 0)) }];
    for (const [iso, state] of availability) {
      if (state === "blocked") {
        const date = fromIsoDate(iso);
        if (date) {
          matchers.push(date);
        }
      }
    }
    return matchers;
  }, [availability]);

  const dayModifiers = React.useMemo(() => {
    const busyAm: Date[] = [];
    const busyPm: Date[] = [];
    const busyFull: Date[] = [];
    for (const [iso, state] of availability) {
      const date = fromIsoDate(iso);
      if (!date) {
        continue;
      }
      // `pickupOnly` is an existing booking's RETURN day — its morning is taken,
      // so the upper-left triangle is filled; `returnOnly` is its PICKUP day.
      if (state === "pickupOnly") {
        busyAm.push(date);
      } else if (state === "returnOnly") {
        busyPm.push(date);
      } else if (state === "blocked") {
        busyFull.push(date);
      }
    }
    return { busyAm, busyPm, busyFull };
  }, [availability]);

  const days = pickup && returnDate ? rentalDays(pickup, returnDate) : 0;

  return (
    <div className="relative mt-3">
      {/* Tail, pointing at the field that opened the picker. */}
      <span
        aria-hidden="true"
        className={cn(
          "bg-card absolute -top-1.5 z-[1] size-3 rotate-45 border-t border-l border-[var(--flota-hair-2)]",
          openField === "pickup" ? "left-[24%]" : "left-[74%]",
        )}
      />

      <div className="bg-card shadow-overlay rounded-[16px] border border-[var(--flota-hair-2)] p-4">
        <Calendar
          mode="range"
          selected={selected}
          onSelect={(next, triggerDate) => {
            // `excludeDisabled` only rejects ranges that SPAN a fully-blocked
            // day. A range ending on a `pickupOnly` day, starting on a
            // `returnOnly` day, or crossing a half-day interior passes that
            // filter — so veto it here against the same half-day rules the DB
            // enforces, resetting to the just-clicked day.
            if (next?.from && next.to) {
              const nextPickup = toIsoDate(next.from);
              const nextReturn = toIsoDate(next.to);
              const result = checkRangeBookable(busyRanges, nextPickup, nextReturn);
              if (!result.ok) {
                onChange(toIsoDate(triggerDate), "");
                setHint(HINT[result.reason]);
                return;
              }
              onChange(nextPickup, nextReturn);
              setHint(null);
              return;
            }
            onChange(next?.from ? toIsoDate(next.from) : "", next?.to ? toIsoDate(next.to) : "");
            setHint(null);
          }}
          numberOfMonths={1}
          disabled={disabledDays}
          modifiers={dayModifiers}
          excludeDisabled
          locale={pl}
          formatters={{
            formatCaption,
            formatWeekdayName: (date) => WEEKDAYS[date.getDay()],
          }}
          labels={{
            labelPrevious: () => COPY.prevMonth,
            labelNext: () => COPY.nextMonth,
            // Append the start-only/end-only rule to each changeover day's
            // aria-label; wrap the library default so today/selected markers stay.
            labelDayButton: (date, modifiers, options, dateLib) => {
              const base = labelDayButton(date, modifiers, options, dateLib);
              if (modifiers.busyAm) {
                return `${base}, ${COPY.pickupOnlyLabel}`;
              }
              if (modifiers.busyPm) {
                return `${base}, ${COPY.returnOnlyLabel}`;
              }
              return base;
            },
          }}
          components={{ DayButton: MrDayCell }}
          className="w-full bg-transparent p-0 [--cell-size:--spacing(8.5)]"
          classNames={{
            root: "relative w-full",
            // 12px between the header row and the grid.
            month: "flex w-full flex-col gap-3",
            months: "relative flex w-full flex-col",
            month_caption:
              "flex h-(--cell-size) w-full items-center justify-start p-0 text-[13.5px] font-bold tracking-[-0.2px] text-foreground",
            caption_label: "select-none",
            // D12: working buttons, 26×26, where the source draws inert spans.
            nav: "absolute inset-x-0 top-0 flex h-(--cell-size) w-full items-center justify-end gap-1.5",
            button_previous:
              "bg-card flex size-[26px] items-center justify-center rounded-[8px] border border-[var(--flota-hair)] p-0 text-[var(--flota-ink-2)] select-none aria-disabled:opacity-50 [&_svg]:size-[13px]",
            button_next:
              "bg-card flex size-[26px] items-center justify-center rounded-[8px] border border-[var(--flota-hair)] p-0 text-[var(--flota-ink-2)] select-none aria-disabled:opacity-50 [&_svg]:size-[13px]",
            month_grid: "w-full border-collapse",
            weekdays: "flex w-full gap-1",
            weekday: "flex-1 pb-1 text-center text-[10.5px] font-semibold text-muted-foreground select-none",
            week: "mt-1 flex w-full gap-1",
            day: "relative h-[34px] w-full p-0 text-center select-none",
            range_start: "",
            range_middle: "",
            range_end: "",
            today: "",
            outside: "",
            disabled: "",
          }}
        />

        {/* Legend — the source's three items verbatim (D15: one half-swatch
            stands for both the AM- and PM-busy treatments). */}
        <div className="mt-3.5 flex flex-wrap gap-x-4 gap-y-2 border-t border-[var(--flota-hair-2)] pt-3">
          {[
            { label: COPY.legendSelected, swatch: "bg-primary" },
            { label: COPY.legendHalf, swatch: "bg-card cell-busy-pm border border-[var(--flota-hair)]" },
            { label: COPY.legendFull, swatch: "bg-[var(--flota-busy)]" },
          ].map((item) => (
            <span key={item.label} className="text-muted-foreground inline-flex items-center gap-1.5 text-[11px]">
              <span aria-hidden="true" className={cn("size-3 shrink-0 rounded-[4px]", item.swatch)} />
              {item.label}
            </span>
          ))}
        </div>

        <div className="mt-3.5 flex items-center justify-between gap-2.5 border-t border-[var(--flota-hair-2)] pt-3">
          {/* The veto hint takes this slot while it is up: the range was just
              reset to the clicked day, so the summary it replaces has nothing
              left to summarize. */}
          {hint ? (
            <span className="text-destructive text-[12.5px] font-semibold">{hint}</span>
          ) : (
            <span className="text-[12.5px] font-semibold text-[var(--flota-ink-2)] tabular-nums">
              {selected?.from && selected.to
                ? `${formatDayShort(selected.from)} – ${formatDayShort(selected.to)} · ${formatDuration(days)}`
                : ""}
            </span>
          )}
          <button
            type="button"
            onClick={onApply}
            className="h-[38px] shrink-0 rounded-[11px] bg-[var(--foreground)] px-[18px] text-[13px] font-[650] text-white"
          >
            {COPY.apply}
          </button>
        </div>
      </div>
    </div>
  );
}
