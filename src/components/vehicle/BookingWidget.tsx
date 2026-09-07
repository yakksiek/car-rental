// core
import * as React from "react";
import { navigate } from "astro:transitions/client";
import { type DateRange, type DayButton, type Matcher } from "react-day-picker";

// components
import { Calendar } from "../ui/calendar";

// others
import type { VehicleBusyRange } from "../../types";
import { checkRangeBookable, dayAvailabilityMap, type RangeConflict } from "../../lib/availability";
import { validateDateRange } from "../../lib/catalog-filters";
import { fromIsoDate, toIsoDate } from "../../lib/date-iso";
import { estimatedTotal, formatDuration, formatPln, formatPlnAmount, rentalDays } from "../../lib/format";
import { dayFull, dayMonthShort, monthYearLong } from "../../lib/format-date";
import { booking } from "../../lib/i18n/booking";
import { translator } from "../../lib/i18n/types";
import type { Locale } from "../../lib/i18n/types";
import { cn } from "../../lib/utils";

// Step 1 of the reservation flow (dates) — lives on the vehicle detail page
// (design desktop-1). A sticky right-column card on desktop, an inline block +
// sticky bottom bar on mobile. The visitor confirms a date range here; the
// reserve action carries the vehicle id + chosen dates to /reserve, which
// resumes at step 2 (the customer's own details). The calendar greys out past dates AND the
// vehicle's already-taken dates (pending + confirmed), Booking.com style, so a
// visitor never picks an unavailable range (Phase 6). Pricing, estimate, and
// date semantics reuse the same helpers the funnel and the EXCLUDE constraint
// agree on, so steps cannot diverge; the constraint stays the atomic backstop.

interface Props {
  vehicleId: string;
  /** numeric-as-string quirk tolerated, like every money input (src/types.ts). */
  dailyRate: string | number;
  monthlyRate: string | number;
  deposit: string | number;
  initialPickup?: string | null;
  initialReturn?: string | null;
  /** Pending + confirmed date bounds to grey out in the calendar (Phase 6). */
  busyRanges?: VehicleBusyRange[];
  /** Islands cannot read `Astro.locals`; the mounting page passes it down. */
  locale: Locale;
}

const arrow = (
  <svg
    className="size-4"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M5 12h14M13 6l6 6-6 6" />
  </svg>
);

/** `"Marzec 2026"` — the design's caption: sentence case, NOT uppercased. */
function formatCaption(date: Date, locale: Locale): string {
  const month = monthYearLong(date, locale);
  return month.charAt(0).toUpperCase() + month.slice(1);
}

/**
 * One day cell, re-authored rather than restyled through `classNames`. The
 * design's `DayCell` is a fixed-height, full-width, `overflow: hidden` box whose
 * radius and fill both depend on where in the range it sits; shadcn's stock day
 * button is a square icon-button, and `aspect-square` is exactly what stops the
 * grid filling the widget. Overriding the component is the same escape hatch
 * `ManualReservationCalendar`'s `MrDayCell` already uses — the shared
 * `ui/calendar.tsx` is not touched, so the other three consumers cannot regress.
 *
 * Precedence follows the design source: selected and in-range paint over a
 * blocked day, which paints over a plain one.
 */
function BookingDayCell({ className, day, modifiers, ...props }: React.ComponentProps<typeof DayButton>) {
  const inRange = modifiers.range_middle;
  const selected = modifiers.selected && !inRange;

  // Carried over verbatim from `CalendarDayButton` (`ui/calendar.tsx:174-177`).
  // react-day-picker moves focus by state only — the single `.focus()` call in
  // the whole library lives in its default `DayButton`. Overriding the component
  // makes it ours to re-supply, or arrow keys repaint the highlight while DOM
  // focus stays on the first cell.
  const ref = React.useRef<HTMLButtonElement>(null);
  React.useEffect(() => {
    if (modifiers.focused) ref.current?.focus();
  }, [modifiers.focused]);

  return (
    <button
      ref={ref}
      data-day={day.date.toLocaleDateString("en-CA")}
      className={cn(
        "relative flex h-[32px] w-full items-center justify-center overflow-hidden text-[12.5px] transition-[background-color] duration-[120ms]",
        // Radius 9 on the range endpoints, 0 on the days between, so a selected
        // span reads as one continuous bar.
        inRange ? "rounded-none" : "rounded-[9px]",
        selected
          ? "bg-primary text-primary-foreground font-bold"
          : inRange
            ? "bg-accent text-accent-foreground font-medium"
            : modifiers.blocked
              ? // The design fades the LABEL only (`opacity: full ? 0.75 : 1` on
                // its `<span>`), keeping the `--flota-busy` fill solid. Carrying
                // the fade on the button would fade the fill too — #E1E5EA over
                // card instead of the contract's #D7DCE3 — so it rides the text
                // colour's own alpha. It must also NOT take the disabled fade: a
                // booked day reads as solidly unavailable, not as a faded past day.
                "cell-busy-full text-muted-foreground/75 font-medium"
              : modifiers.pickupOnly
                ? "cell-busy-am text-foreground font-medium"
                : modifiers.returnOnly
                  ? "cell-busy-pm text-foreground font-medium"
                  : modifiers.today
                    ? // D-03: the design draws no today marker; the app keeps one
                      // and paints it the same pink as an in-range day. Ranked
                      // below the busy fills, so a booked today still reads busy.
                      "bg-accent text-accent-foreground font-medium"
                    : modifiers.disabled
                      ? "text-muted-foreground font-medium opacity-50"
                      : modifiers.outside
                        ? // D-02: the design renders no outside-month days; the
                          // app keeps them muted. Owner decision.
                          "text-muted-foreground font-medium"
                        : "text-foreground font-medium",
        modifiers.disabled && "cursor-not-allowed",
        className,
      )}
      {...props}
    />
  );
}

export default function BookingWidget({
  vehicleId,
  dailyRate,
  monthlyRate,
  deposit,
  initialPickup = null,
  initialReturn = null,
  busyRanges = [],
  locale,
}: Props) {
  const t = translator(locale, booking);
  // Maps each range-conflict reason to its inline hint (see `checkRangeBookable`).
  const CHANGEOVER_HINT: Record<RangeConflict, string> = {
    pickupTaken: t("changeoverPickupTaken"),
    returnTaken: t("changeoverReturnTaken"),
    spansBooked: t("changeoverSpansBooked"),
  };

  const [range, setRange] = React.useState<DateRange | undefined>(() => {
    const from = fromIsoDate(initialPickup);
    const to = fromIsoDate(initialReturn);
    return from || to ? { from, to } : undefined;
  });
  const [error, setError] = React.useState<string | null>(null);

  // Per-day half-state map (S-02a): the half-open `[pickup 14:00, return 10:00)`
  // window leaves each booking's two changeover days half-free, so we no longer
  // grey ranges inclusive of both bounds. `dayAvailabilityMap` resolves every
  // changeover/interior day to `blocked` | `pickupOnly` | `returnOnly` (absent ⇒
  // free) from the SAME hours as the EXCLUDE constraint, so the calendar can't
  // drift from the DB authority.
  const availability = React.useMemo(() => dayAvailabilityMap(busyRanges), [busyRanges]);

  // Disabled-day matchers: past dates plus only the FULLY-blocked days (interiors
  // and shared return+pickup days). `excludeDisabled` resets any range that spans
  // one of these. The two half-states are NOT disabled — they ride `modifiers`
  // (for the cell visual + aria) and the `onSelect` veto below instead.
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

  // Per-day modifier sets driving the calendar's visuals: the two half-available
  // changeover states (diagonal half-grey + aria-label) plus `blocked` (a solid
  // grey fill so fully-booked days read as "niedostępny" and match the legend
  // swatch — distinct from merely-past days, which stay faded). Selectability is
  // governed by `disabled` + the `onSelect` veto, not by these.
  const dayModifiers = React.useMemo(() => {
    const pickupOnly: Date[] = [];
    const returnOnly: Date[] = [];
    const blocked: Date[] = [];
    for (const [iso, state] of availability) {
      const date = fromIsoDate(iso);
      if (!date) {
        continue;
      }
      if (state === "pickupOnly") {
        pickupOnly.push(date);
      } else if (state === "returnOnly") {
        returnOnly.push(date);
      } else if (state === "blocked") {
        blocked.push(date);
      }
    }
    return { pickupOnly, returnOnly, blocked };
  }, [availability]);

  const pickupIso = range?.from ? toIsoDate(range.from) : null;
  const returnIso = range?.to ? toIsoDate(range.to) : null;
  const days = pickupIso && returnIso ? rentalDays(pickupIso, returnIso) : 0;
  const hasEstimate = days > 0;
  const total = hasEstimate ? estimatedTotal(dailyRate, days) : 0;

  function handleReserve() {
    const check = validateDateRange(pickupIso, returnIso, locale);
    if (!check.ok || !pickupIso || !returnIso) {
      setError(check.ok ? null : check.error);
      return;
    }
    setError(null);
    const params = new URLSearchParams({ vehicle_id: vehicleId, pickup: pickupIso, return: returnIso });
    void navigate(`/reserve?${params.toString()}`);
  }

  // The breakdown + estimate, shared between the desktop card body and the
  // mobile sticky bar's expanded content.
  const breakdownRows = (
    <dl className="divide-y divide-[var(--flota-hair-2)]">
      <div className="flex items-center justify-between gap-3 py-3">
        <dt className="text-muted-foreground text-sm font-medium">
          {hasEstimate ? `${formatPln(dailyRate, locale)} × ${formatDuration(days, locale)}` : t("chooseRange")}
        </dt>
        <dd className="text-foreground text-sm font-semibold">{hasEstimate ? formatPln(total, locale) : "—"}</dd>
      </div>
      <div className="flex items-center justify-between gap-3 py-3">
        <dt className="text-muted-foreground text-sm font-medium">{t("depositRefundable")}</dt>
        <dd className="text-foreground text-sm font-semibold">{formatPln(deposit, locale)}</dd>
      </div>
    </dl>
  );

  return (
    <div className="bg-card shadow-card rounded-lg p-5 lg:sticky lg:top-8 lg:p-6">
      {/* Price header */}
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-foreground text-2xl font-bold tracking-tight">
          {formatPln(dailyRate, locale)}
          <span className="text-muted-foreground text-sm font-medium"> {t("perDay")}</span>
        </p>
        <p className="text-muted-foreground text-sm font-medium">
          {formatPln(monthlyRate, locale)}
          {t("perMonth")}
        </p>
      </div>

      {/* Selected-range fields */}
      <div className="mt-4 grid grid-cols-2 gap-2">
        {[
          { label: t("pickup"), value: range?.from ? `${dayMonthShort(range.from, locale)} · 14:00` : "—" },
          { label: t("return"), value: range?.to ? `${dayMonthShort(range.to, locale)} · 10:00` : "—" },
        ].map((field) => (
          <div key={field.label} className="rounded-xl border border-[var(--flota-hair-2)] px-3 py-2">
            <div className="text-muted-foreground text-[10px] font-semibold tracking-wide uppercase">{field.label}</div>
            <div className="text-foreground mt-0.5 text-sm font-semibold tracking-tight">{field.value}</div>
          </div>
        ))}
      </div>

      {/* Calendar — range picker; past dates AND the vehicle's taken dates greyed
          (Phase 6). The design frames the month in a hairline box that fills the
          widget's inner content box, so the grid lines up with the date-field row
          and the CTA above and below it. Transparent ground, so it reads as part
          of the card rather than a grey block. */}
      <div className="mt-4 rounded-[16px] border border-[var(--flota-hair-2)] p-4">
        <Calendar
          mode="range"
          selected={range}
          onSelect={(next, triggerDate) => {
            // react-day-picker normalizes `from`/`to` to date order, so a complete
            // range always has from ≤ to. `excludeDisabled` already rejects ranges
            // that span a `blocked` day, but a range that ends on a `pickupOnly`
            // day, starts on a `returnOnly` day, or crosses a half-day in its
            // interior passes that filter — so veto it here against the same
            // half-day rules the DB enforces, resetting to the just-clicked day.
            if (next?.from && next.to) {
              const nextPickup = toIsoDate(next.from);
              const nextReturn = toIsoDate(next.to);
              const result = checkRangeBookable(busyRanges, nextPickup, nextReturn);
              if (!result.ok) {
                setRange({ from: triggerDate });
                setError(CHANGEOVER_HINT[result.reason]);
                return;
              }
            }
            setRange(next);
            setError(null);
          }}
          numberOfMonths={1}
          disabled={disabledDays}
          // D14: the busy treatment is painted by `BookingDayCell`, not through
          // `modifiersClassNames`. The gridcell is square and unclipped, so a
          // gradient laid there escapes the 9px cell radius; the button carries
          // `overflow-hidden` and the radius, which is the shape the design's
          // `DayCell` draws. It is also the target `global.css` documents for
          // `cell-busy-*`, and it is where the selected-range background can
          // paint over the fill. `modifiers` still rides the props below — it
          // drives both the cell branches and the aria-labels.
          modifiers={dayModifiers}
          excludeDisabled
          appLocale={locale}
          formatters={{
            formatCaption: (date) => formatCaption(date, locale),
          }}
          labels={{
            // Append the start-only/end-only rule to each changeover day's
            // aria-label. The base repeats the shared wrapper's `dayFull` because
            // an override REPLACES the entry rather than wrapping it.
            labelDayButton: (date, modifiers) => {
              const base = dayFull(date, locale);
              if (modifiers.pickupOnly) {
                return `${base}, ${t("pickupOnlyLabel")}`;
              }
              if (modifiers.returnOnly) {
                return `${base}, ${t("returnOnlyLabel")}`;
              }
              return base;
            },
          }}
          components={{ DayButton: BookingDayCell }}
          // 26px: the design's nav-button square, which sets the caption row's
          // height. Every other consumer of `--cell-size` in this grid is
          // overridden below.
          className="w-full bg-transparent p-0 [--cell-size:--spacing(6.5)]"
          // Each slot supplied here REPLACES the shared default wholesale
          // (`ui/calendar.tsx` spreads `...classNames` last), so anything from
          // the default that is still wanted has to be restated. That is also
          // what lets the grid escape the default `day` slot's `aspect-square`.
          classNames={{
            root: "relative w-full",
            months: "relative flex w-full flex-col",
            // 12px between the caption row and the grid.
            month: "flex w-full flex-col gap-3",
            month_caption:
              "flex h-(--cell-size) w-full items-center justify-start p-0 text-[13.5px] font-bold tracking-[-0.2px] text-foreground",
            caption_label: "select-none",
            nav: "absolute inset-x-0 top-0 flex h-(--cell-size) w-full items-center justify-end gap-1.5",
            button_previous:
              "flex size-[26px] items-center justify-center rounded-[8px] border border-[var(--flota-hair)] p-0 text-[var(--flota-ink-2)] select-none aria-disabled:opacity-50 [&_svg]:size-[13px]",
            button_next:
              "flex size-[26px] items-center justify-center rounded-[8px] border border-[var(--flota-hair)] p-0 text-[var(--flota-ink-2)] select-none aria-disabled:opacity-50 [&_svg]:size-[13px]",
            month_grid: "w-full border-collapse",
            weekdays: "flex w-full gap-1",
            weekday: "flex-1 pb-1 text-center text-[10.5px] font-semibold text-muted-foreground select-none",
            week: "mt-1 flex w-full gap-1",
            day: "relative h-[32px] w-full p-0 text-center select-none",
            // Blanked: fill, radius and text colour for every one of these states
            // are decided in `BookingDayCell`, so a second painter on the gridcell
            // would only show through at the corners.
            range_start: "",
            range_middle: "",
            range_end: "",
            today: "",
            outside: "",
            disabled: "",
          }}
        />

        {/* Legend — decodes the busy treatments, and sits inside the month frame
            because its separator is the design's own rule across that frame.
            Only shown when the vehicle has changeover/blocked days to explain
            (an empty map ⇒ nothing to decode) — D-05. */}
        {availability.size > 0 && (
          <ul className="text-muted-foreground mt-3.5 flex flex-wrap gap-x-4 gap-y-2 border-t border-[var(--flota-hair-2)] pt-3 text-[11px]">
            {[
              { label: t("legendBlocked"), swatch: "bg-[var(--flota-busy)]" },
              // D-15/D-04: one lower-right half-swatch stands for both changeover
              // directions. The design clips a plain `--flota-busy` fill and draws
              // NO divider, so this cannot reuse `cell-busy-am` / `cell-busy-pm`.
              { label: t("legendPickupOnly"), swatch: "bg-card legend-busy-half border border-[var(--flota-hair)]" },
              { label: t("legendReturnOnly"), swatch: "bg-card legend-busy-half border border-[var(--flota-hair)]" },
            ].map((item) => (
              <li key={item.label} className="flex items-center gap-1.5">
                <span aria-hidden="true" className={cn("size-3 shrink-0 rounded-[4px]", item.swatch)} />
                {item.label}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="mt-2 border-t border-[var(--flota-hair-2)]">{breakdownRows}</div>

      {/* Estimated total */}
      <div className="flex items-center justify-between gap-3 border-t border-[var(--flota-hair-2)] pt-4">
        <span className="text-foreground text-sm font-semibold">{t("estimate")}</span>
        <span className="text-foreground text-xl font-bold tracking-tight">
          {hasEstimate ? formatPln(total, locale) : "—"}
        </span>
      </div>

      {error && <p className="text-destructive mt-3 text-sm font-medium">{error}</p>}

      {/* Inline CTA — desktop only; mobile uses the sticky bottom bar below. */}
      <button
        type="button"
        onClick={handleReserve}
        disabled={!hasEstimate}
        className="bg-primary text-primary-foreground rounded-button mt-4 hidden h-12 w-full items-center justify-center gap-2 px-6 text-[15px] font-semibold transition-colors hover:bg-[var(--flota-accent-dark)] disabled:opacity-50 lg:flex"
      >
        {t("cta")}
        {arrow}
      </button>

      <p className="text-muted-foreground mt-3 flex items-center justify-center gap-1.5 text-center text-xs leading-snug">
        <svg
          className="size-3.5 shrink-0 text-[var(--flota-success)]"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M5 13l4 4 10-10" />
        </svg>
        {t("reassurance")}
      </p>

      {/* Mobile/tablet sticky CTA (matches funnel step 2/3): a crimson estimate
          band stacked above a full-width crimson CTA. The calendar is far up the
          page, so this is the persistent action. */}
      <div className="fixed inset-x-0 bottom-0 z-10 border-t border-[var(--flota-hair-2)] bg-[var(--flota-bg)]/92 backdrop-blur lg:hidden">
        <div className="mx-auto max-w-3xl px-5 pt-4 pb-4 sm:px-8">
          <div className="bg-primary text-primary-foreground rounded-button flex items-center justify-between gap-4 px-5 py-4">
            <div className="min-w-0">
              <div className="text-[11px] font-semibold tracking-[0.18em] uppercase opacity-80">{t("estimate")}</div>
              <div className="mt-0.5 font-bold tracking-tight">
                {/* The bare number and its unit are two type sizes, so the amount
                    comes from `formatPlnAmount` (which never appends the unit)
                    rather than from stripping `zł` off `formatPln` with a regex —
                    that strip silently stopped matching the moment the currency
                    became locale-aware. */}
                <span className="text-[2.5rem] leading-none">{hasEstimate ? formatPlnAmount(total, locale) : "—"}</span>
                {hasEstimate && <span className="ml-1 text-lg">zł</span>}
              </div>
            </div>
            <div className="shrink-0 text-right text-xs leading-snug opacity-80">
              {hasEstimate && (
                <div>
                  {formatDuration(days, locale)} × {formatPln(dailyRate, locale)}
                </div>
              )}
              <div>
                {t("statusPlusDeposit")} {formatPln(deposit, locale)}
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={handleReserve}
            disabled={!hasEstimate}
            className="bg-primary text-primary-foreground rounded-button mt-2 flex h-13 w-full items-center justify-center gap-2 px-6 text-[15px] font-semibold transition-colors hover:bg-[var(--flota-accent-dark)] disabled:opacity-50"
          >
            {t("cta")}
            {arrow}
          </button>
        </div>
      </div>
    </div>
  );
}
