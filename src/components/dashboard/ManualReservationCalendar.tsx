// core
import * as React from "react";
import { AlertTriangle } from "lucide-react";
import { type DateRange, type DayButton, type Matcher } from "react-day-picker";

// components
import { Calendar } from "../ui/calendar";

// others
import { checkRangeBookable, dayAvailabilityMap, type RangeConflict } from "../../lib/availability";
import { fromIsoDate, toIsoDate } from "../../lib/date-iso";
import { formatDuration, rentalDays } from "../../lib/format";
import { dayFull, dayMonthShort, monthYearLong } from "../../lib/format-date";
import type { Locale } from "../../lib/i18n/types";
import type { BusyRangesFetchState } from "../../lib/manual-availability";
import { dashboard } from "../../lib/i18n/dashboard";
import { translator } from "../../lib/i18n/types";
import { cn } from "../../lib/utils";
import type { VehicleBusyRange } from "../../types";

// The manual-reservation modal's availability-aware range picker (S-12a),
// ported from the design source's `MrCalendarPopover` + `DayCell` — see
// `context/changes/manual-reservation-date-picker/design-contract.md` for the
// per-element spec every value here is transcribed from.
//
// Two shells, one grid (the source's own `variant` prop):
//
// - `popover` — desktop. In flow beneath the `Termin` button, not absolutely
//   positioned, so the modal body grows and its footer stays pinned. It IS the
//   card: border, radius 16, padding 16, shadow, and the tail pointing up at the
//   trigger it opened from.
// - `sheet` — mobile. Drops all of that chrome, because the picker is its own
//   layer over the form sheet and that sheet owns the surface — a card inside a
//   card otherwise.
//
// Selection is `react-day-picker` `mode="range"` rather than the source's
// hand-rolled `pickDay` (D11) — the house pattern (`BookingWidget.tsx:217`).
//
// That pattern gives keyboard and screen-reader behaviour for free ONLY while
// `DayButton` is left alone. `BookingWidget` overrides `labelDayButton` and
// nothing else, so it earns it; overriding the component — as `MrDayCell` below
// does — takes the focus plumbing with it. RDP moves focus by state alone
// (`useFocus` → `setFocused`); the single `.focus()` call in the whole library
// lives in its default `DayButton`. So an override MUST carry the ref +
// `modifiers.focused` effect over from `ui/calendar.tsx:134-141`, or arrow keys
// repaint the highlight while DOM focus stays on the first cell.

// The source's own two-letter forms — narrower than the shared calendar's default
// header, which is why this grid overrides `formatWeekdayName`. Indexed by
// `getDay()`, so the order is Sunday-first. These are design copy, not grammar
// (`Intl` would give a different abbreviation), so they live in the catalog.
const WEEKDAY_KEYS = [
  "weekdaySun",
  "weekdayMon",
  "weekdayTue",
  "weekdayWed",
  "weekdayThu",
  "weekdayFri",
  "weekdaySat",
] as const;

/** `"1 kwi"` — the source's `mrFmt`, shared with the modal's day labels. */
function formatDayShort(date: Date, locale: Locale): string {
  return dayMonthShort(date, locale);
}

/** `"Kwiecień 2026"` — the source's `PL_MON_FULL` caption; sentence case, NOT uppercased. */
function formatCaption(date: Date, locale: Locale): string {
  const month = monthYearLong(date, locale);
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

  // Carried over verbatim from `CalendarDayButton` (`ui/calendar.tsx:134-141`).
  // react-day-picker moves focus by state only, so without this the arrow keys
  // move `modifiers.focused` and `tabIndex` while DOM focus stays put — see the
  // header note. Overriding `DayButton` is what makes it ours to re-supply.
  const ref = React.useRef<HTMLButtonElement>(null);
  React.useEffect(() => {
    if (modifiers.focused) ref.current?.focus();
  }, [modifiers.focused]);

  return (
    <button
      ref={ref}
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
              ? // The source fades the LABEL only (`opacity: full ? 0.75 : 1` on
                // its `<span>`), keeping the `--flota-busy` fill solid. Carrying
                // it on the button faded the fill too — #E1E5EA over card
                // instead of the contract's #D7DCE3.
                "cell-busy-full text-muted-foreground/75 font-medium"
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
  /**
   * How the read that produced `busyRanges` is doing. Required, because
   * `busyRanges: []` alone is ambiguous — it reads identically as "no bookings",
   * "still loading" and "the read failed", and the grid draws the first of those
   * for all three. Without it the picker paints a fully-free month over a failed
   * read (D19).
   */
  rangesState: BusyRangesFetchState;
  /** ISO `YYYY-MM-DD`, or `""` when unset. */
  pickup: string;
  returnDate: string;
  /** Desktop card-with-a-tail, or the bare grid the mobile sheet wraps. */
  variant: "popover" | "sheet";
  onChange: (pickup: string, returnDate: string) => void;
  onApply: () => void;
  /**
   * Re-read the vehicle's busy ranges. Offered HERE and not only on the
   * availability panel because the panel's error branch needs a complete range
   * to render at all — and after a failed read the grid is inert, so no range
   * can be picked. Without a retry inside the picker the surface is a dead end.
   */
  onRetry: () => void;
  /** Islands cannot read `Astro.locals`; the mounting modal passes it down. */
  locale: Locale;
}

export function ManualReservationCalendar({
  busyRanges,
  rangesState,
  pickup,
  returnDate,
  variant,
  onChange,
  onApply,
  onRetry,
  locale,
}: Props) {
  const t = translator(locale, dashboard);
  // Maps each range-conflict reason to its inline hint.
  const HINT: Record<RangeConflict, string> = {
    pickupTaken: t("hintPickupTaken"),
    returnTaken: t("hintReturnTaken"),
    spansBooked: t("hintSpansBooked"),
  };

  const [hint, setHint] = React.useState<string | null>(null);

  // The grid may only be operated when it is drawing a real answer. `inert`
  // rather than a `disabled` sweep: it takes the whole subtree — day cells,
  // month nav, and their focus — out of reach in one place, which is the same
  // "not rendered / not reachable" shape the busy freeze uses. The trigger
  // deliberately stays enabled (rejected: `disabled={busy || rangesState !==
  // "ready"}`), so the picker still opens and can say why it is empty.
  //
  // `error` splits in two, because the two failures leave very different things
  // on screen. A failed INITIAL read has no ranges at all, so the grid would
  // draw an all-free month it cannot vouch for — that is the case this guard
  // exists for. A failed RE-read still holds the previous good answer, which
  // `refetch` deliberately carries over rather than discarding; freezing that
  // would blank the grid the employee is reading from and undo the carry-over.
  // Operating on it is safe either way: `resolveAvailability` maps `error` to
  // `error`, and `canCreateReservation` only ever passes `available`, so submit
  // stays disarmed and the retry sits directly above.
  const gridUsable = rangesState === "ready" || (rangesState === "error" && busyRanges.length > 0);

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

  const grid = (
    <>
      {/* D19 — undrawn in the source, which only ever has its mock bookings to
          hand. Same string as the availability panel's `avError`, because on
          mobile the picker's own layer covers that panel outright: without it
          the employee reads an all-free month with the failure hidden behind. */}
      {rangesState === "error" && (
        <div className="mb-3 flex items-start gap-[11px] rounded-[13px] bg-[var(--flota-warning-soft)] px-[13px] py-3">
          <AlertTriangle className="text-warning size-[18px] shrink-0" />
          <div className="pt-px">
            <div className="text-warning text-[12.5px] font-semibold">{t("availabilityReadFailed")}</div>
            <button
              type="button"
              onClick={onRetry}
              className="text-warning mt-1 text-[12.5px] font-bold underline underline-offset-2"
            >
              {t("availabilityRetry")}
            </button>
          </div>
        </div>
      )}

      <div inert={!gridUsable} className={cn(!gridUsable && "opacity-50")}>
        <Calendar
          mode="range"
          selected={selected}
          // The source builds its grid from the current month only — blank
          // lead-in cells (`cells.push(null)`) and no trailing days — where
          // shadcn's Calendar defaults to showing neighbouring months' days as
          // greyed numbers.
          showOutsideDays={false}
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
          // Without it `addToRange` takes its `min = 0` default, whose empty-range
          // branch closes the range on the FIRST click — `{from: d, to: d}`. That
          // same-day range passes the veto (rule 3 skips both endpoints) and
          // reaches the modal, where `validateDateRange` rejects it: the panel
          // flashed "Data zwrotu musi być późniejsza niż data odbioru." between
          // the two clicks, which is the broken-looking state D18 exists to
          // prevent. Only `min > 1` gates the second click, so 1-day spans are
          // unaffected and the first click now yields `{from, to: undefined}`.
          min={1}
          disabled={disabledDays}
          modifiers={dayModifiers}
          excludeDisabled
          appLocale={locale}
          formatters={{
            formatCaption: (date) => formatCaption(date, locale),
            formatWeekdayName: (date) => t(WEEKDAY_KEYS[date.getDay()]),
          }}
          labels={{
            labelPrevious: () => t("prevMonth"),
            labelNext: () => t("nextMonth"),
            // Append the start-only/end-only rule to each changeover day's
            // aria-label. The base repeats the shared wrapper's `dayFull` because
            // an override REPLACES the entry rather than wrapping it.
            labelDayButton: (date, modifiers) => {
              const base = dayFull(date, locale);
              if (modifiers.busyAm) {
                return `${base}, ${t("pickupOnlyLabel")}`;
              }
              if (modifiers.busyPm) {
                return `${base}, ${t("returnOnlyLabel")}`;
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
      </div>

      {/* Legend — the source's three items verbatim (D15: one half-swatch
          stands for both the AM- and PM-busy treatments). */}
      <div className="mt-3.5 flex flex-wrap gap-x-4 gap-y-2 border-t border-[var(--flota-hair-2)] pt-3">
        {[
          { label: t("legendSelected"), swatch: "bg-primary" },
          // The source's swatch is a clean lower-right clip with NO divider —
          // unlike the day cells, which carry one. Reusing `cell-busy-pm` here
          // would draw a divider the mockup does not have.
          { label: t("legendHalf"), swatch: "bg-card legend-busy-half border border-[var(--flota-hair)]" },
          { label: t("legendFull"), swatch: "bg-[var(--flota-busy)]" },
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
              ? `${formatDayShort(selected.from, locale)} – ${formatDayShort(selected.to, locale)} · ${formatDuration(days, locale)}`
              : ""}
          </span>
        )}
        <button
          type="button"
          onClick={onApply}
          className="h-[38px] shrink-0 rounded-[11px] bg-[var(--foreground)] px-[18px] text-[13px] font-[650] text-white"
        >
          {t("apply")}
        </button>
      </div>
    </>
  );

  // The mobile sheet owns the surface, so the picker drops the card chrome
  // and its tail there — a card inside a card otherwise.
  if (variant === "sheet") {
    return <div>{grid}</div>;
  }

  return (
    <div className="relative mt-3">
      {/* Tail, centred under the single `Termin` trigger it opened from. */}
      <span
        aria-hidden="true"
        className="bg-card absolute -top-1.5 left-[calc(50%-6px)] z-[1] size-3 rotate-45 border-t border-l border-[var(--flota-hair-2)]"
      />

      <div className="bg-card shadow-overlay rounded-[16px] border border-[var(--flota-hair-2)] p-4">{grid}</div>
    </div>
  );
}
