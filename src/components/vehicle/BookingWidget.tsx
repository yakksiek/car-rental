// core
import * as React from "react";
import { navigate } from "astro:transitions/client";
import { format } from "date-fns";
import { pl } from "date-fns/locale";
import { labelDayButton, type DateRange, type Matcher } from "react-day-picker";

// components
import { Calendar } from "../ui/calendar";

// others
import type { VehicleBusyRange } from "../../types";
import { dayAvailabilityMap, isRangeBookable } from "../../lib/availability";
import { validateDateRange } from "../../lib/catalog-filters";
import { fromIsoDate, toIsoDate } from "../../lib/date-iso";
import { estimatedTotal, formatDuration, formatPln, rentalDays } from "../../lib/format";

// Step 1 of the reservation flow ("Daty") — lives on the vehicle detail page
// (design desktop-1). A sticky right-column card on desktop, an inline block +
// sticky bottom bar on mobile. The visitor confirms a date range here; the
// "Zarezerwuj" action carries the vehicle id + chosen dates to /reserve, which
// resumes at step 2 ("Twoje dane"). The calendar greys out past dates AND the
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
}

const COPY = {
  perDay: "/doba",
  perMonth: "/mies",
  rangeLabel: "Termin",
  pickup: "Odbiór",
  return: "Zwrot",
  chooseRange: "Wybierz daty odbioru i zwrotu",
  deposit: "Kaucja (zwrotna)",
  estimate: "Szacunkowa cena",
  cta: "Zarezerwuj",
  reassurance: "Bez konta · darmowa anulacja do 24h przed odbiorem",
  // Shown when a completed range starts/ends on — or crosses — the occupied half
  // of a changeover day (the `isRangeBookable` veto). Polish-canonical tone.
  changeoverHint: "Wybrany termin nachodzi na dzień przekazania pojazdu. Wybierz inny zakres.",
  // Per-day aria-label suffixes for the two half-available changeover states, so
  // SR/keyboard users get the start-only/end-only signal the half-cell can't convey.
  pickupOnlyLabel: "dostępny tylko jako dzień odbioru",
  returnOnlyLabel: "dostępny tylko jako dzień zwrotu",
} as const;

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

export default function BookingWidget({
  vehicleId,
  dailyRate,
  monthlyRate,
  deposit,
  initialPickup = null,
  initialReturn = null,
  busyRanges = [],
}: Props) {
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

  // The two half-available changeover states, as `Date[]` modifier sets. These
  // drive the per-day aria-label (Phase 2) and the diagonal half-cell visual
  // (Phase 3); selectability is governed by the `onSelect` veto, not by these.
  const changeoverModifiers = React.useMemo(() => {
    const pickupOnly: Date[] = [];
    const returnOnly: Date[] = [];
    for (const [iso, state] of availability) {
      const date = fromIsoDate(iso);
      if (!date) {
        continue;
      }
      if (state === "pickupOnly") {
        pickupOnly.push(date);
      } else if (state === "returnOnly") {
        returnOnly.push(date);
      }
    }
    return { pickupOnly, returnOnly };
  }, [availability]);

  const pickupIso = range?.from ? toIsoDate(range.from) : null;
  const returnIso = range?.to ? toIsoDate(range.to) : null;
  const days = pickupIso && returnIso ? rentalDays(pickupIso, returnIso) : 0;
  const hasEstimate = days > 0;
  const total = hasEstimate ? estimatedTotal(dailyRate, days) : 0;

  function handleReserve() {
    const check = validateDateRange(pickupIso, returnIso);
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
          {hasEstimate ? `${formatPln(dailyRate)} × ${formatDuration(days)}` : COPY.chooseRange}
        </dt>
        <dd className="text-foreground text-sm font-semibold">{hasEstimate ? formatPln(total) : "—"}</dd>
      </div>
      <div className="flex items-center justify-between gap-3 py-3">
        <dt className="text-muted-foreground text-sm font-medium">{COPY.deposit}</dt>
        <dd className="text-foreground text-sm font-semibold">{formatPln(deposit)}</dd>
      </div>
    </dl>
  );

  return (
    <div className="bg-card shadow-card rounded-2xl p-5 lg:sticky lg:top-8 lg:p-6">
      {/* Price header */}
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-foreground text-2xl font-bold tracking-tight">
          {formatPln(dailyRate)}
          <span className="text-muted-foreground text-sm font-medium"> {COPY.perDay}</span>
        </p>
        <p className="text-muted-foreground text-sm font-medium">
          {formatPln(monthlyRate)}
          {COPY.perMonth}
        </p>
      </div>

      {/* Selected-range fields */}
      <div className="mt-4 grid grid-cols-2 gap-2">
        {[
          { label: COPY.pickup, value: range?.from ? `${format(range.from, "d MMM", { locale: pl })} · 14:00` : "—" },
          { label: COPY.return, value: range?.to ? `${format(range.to, "d MMM", { locale: pl })} · 10:00` : "—" },
        ].map((field) => (
          <div key={field.label} className="rounded-xl border border-[var(--flota-hair-2)] px-3 py-2">
            <div className="text-muted-foreground text-[10px] font-semibold tracking-wide uppercase">{field.label}</div>
            <div className="text-foreground mt-0.5 text-sm font-semibold tracking-tight">{field.value}</div>
          </div>
        ))}
      </div>

      {/* Calendar — range picker; past dates AND the vehicle's taken dates greyed
          (Phase 6). Capped to a centered max-width so the desktop column can't
          stretch it into loose wide cells, and on a transparent ground so it
          reads as part of the card rather than a grey block. */}
      <div className="mx-auto mt-3 w-full max-w-[300px]">
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
              if (!isRangeBookable(busyRanges, nextPickup, nextReturn)) {
                setRange({ from: triggerDate });
                setError(COPY.changeoverHint);
                return;
              }
            }
            setRange(next);
            setError(null);
          }}
          numberOfMonths={1}
          disabled={disabledDays}
          modifiers={changeoverModifiers}
          excludeDisabled
          locale={pl}
          formatters={{
            formatCaption: (date) => format(date, "LLLL yyyy", { locale: pl }).toUpperCase(),
          }}
          labels={{
            // Append the start-only/end-only rule to each changeover day's
            // aria-label; wrap the library default so today/selected markers stay.
            labelDayButton: (date, modifiers, options, dateLib) => {
              const base = labelDayButton(date, modifiers, options, dateLib);
              if (modifiers.pickupOnly) {
                return `${base}, ${COPY.pickupOnlyLabel}`;
              }
              if (modifiers.returnOnly) {
                return `${base}, ${COPY.returnOnlyLabel}`;
              }
              return base;
            },
          }}
          className="w-full bg-transparent p-0 [--cell-size:--spacing(9)]"
          classNames={{
            root: "relative w-full",
            month_caption: "flex h-(--cell-size) items-center justify-center text-sm font-semibold tracking-wide",
          }}
        />
      </div>

      <div className="mt-2 border-t border-[var(--flota-hair-2)]">{breakdownRows}</div>

      {/* Estimated total */}
      <div className="flex items-center justify-between gap-3 border-t border-[var(--flota-hair-2)] pt-4">
        <span className="text-foreground text-sm font-semibold">{COPY.estimate}</span>
        <span className="text-foreground text-xl font-bold tracking-tight">{hasEstimate ? formatPln(total) : "—"}</span>
      </div>

      {error && <p className="text-destructive mt-3 text-sm font-medium">{error}</p>}

      {/* Inline CTA — desktop only; mobile uses the sticky bottom bar below. */}
      <button
        type="button"
        onClick={handleReserve}
        disabled={!hasEstimate}
        className="bg-primary text-primary-foreground rounded-button mt-4 hidden h-12 w-full items-center justify-center gap-2 px-6 text-[15px] font-semibold transition-colors hover:bg-[var(--flota-accent-dark)] disabled:opacity-50 lg:flex"
      >
        {COPY.cta}
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
        {COPY.reassurance}
      </p>

      {/* Mobile/tablet sticky CTA (matches funnel step 2/3): a crimson estimate
          band stacked above a full-width crimson CTA. The calendar is far up the
          page, so this is the persistent action. */}
      <div className="fixed inset-x-0 bottom-0 z-10 border-t border-[var(--flota-hair-2)] bg-[var(--flota-bg)]/92 backdrop-blur lg:hidden">
        <div className="mx-auto max-w-3xl px-5 pt-4 pb-4 sm:px-8">
          <div className="bg-primary text-primary-foreground rounded-button flex items-center justify-between gap-4 px-5 py-4">
            <div className="min-w-0">
              <div className="text-[11px] font-semibold tracking-[0.18em] uppercase opacity-80">{COPY.estimate}</div>
              <div className="mt-0.5 font-bold tracking-tight">
                <span className="text-[2.5rem] leading-none">
                  {hasEstimate ? formatPln(total).replace(/\s*zł$/, "") : "—"}
                </span>
                {hasEstimate && <span className="ml-1 text-lg">zł</span>}
              </div>
            </div>
            <div className="shrink-0 text-right text-xs leading-snug opacity-80">
              {hasEstimate && (
                <div>
                  {formatDuration(days)} × {formatPln(dailyRate)}
                </div>
              )}
              <div>+ kaucja {formatPln(deposit)}</div>
            </div>
          </div>
          <button
            type="button"
            onClick={handleReserve}
            disabled={!hasEstimate}
            className="bg-primary text-primary-foreground rounded-button mt-2 flex h-13 w-full items-center justify-center gap-2 px-6 text-[15px] font-semibold transition-colors hover:bg-[var(--flota-accent-dark)] disabled:opacity-50"
          >
            {COPY.cta}
            {arrow}
          </button>
        </div>
      </div>
    </div>
  );
}
