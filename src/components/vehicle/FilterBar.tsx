// core
import * as React from "react";
import { navigate } from "astro:transitions/client";
import { format } from "date-fns";
import { pl } from "date-fns/locale";
import { ArrowUpDown, CalendarIcon, ChevronDownIcon, Package, SlidersHorizontal } from "lucide-react";
import type { DateRange } from "react-day-picker";

// components
import { Button } from "../ui/button";
import { Calendar } from "../ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";

// others
import { cn } from "../../lib/utils";
import type { CatalogSort, VehicleFilters } from "../../types";
import { serializeFilters, validateDateRange } from "../../lib/catalog-filters";
import { fromIsoDate, toIsoDate } from "../../lib/date-iso";

// The catalog's only interactive piece — the restyled filter card (design
// ScreenDesktopFleet / ScreenTabletFleet / ScreenMobileFleet). It stages
// date-range / minimum-payload / price-sort locally and commits to the URL on an
// explicit "Zastosuj" — one navigation per deliberate change. It is NOT
// `transition:persist`ed: it remounts on every navigation and re-derives its state
// from `initial` (the current URL filters), so category-pill and apply navigations
// never leave it stale. Inline date validation mirrors `validateDateRange` so the
// picker can't submit a range the RPC would choke on.
//
// Each trigger is a `FilterBtn`: a white pill on the grey card (desktop/tablet) that
// morphs into a full-width row on mobile (< sm). Termin keeps its calendar icon on
// mobile with a left-aligned value; Ładowność / Sortowanie drop the icon and lay
// out label-left / value-right. "Zastosuj" is inline-right on desktop and a
// full-width row on tablet + mobile.

interface Props {
  initial: VehicleFilters;
}

const PAYLOAD_OPTIONS = [
  { value: "any", label: "dowolna" },
  { value: "500", label: "500+ kg" },
  { value: "1000", label: "1000+ kg" },
  { value: "1500", label: "1500+ kg" },
  { value: "2000", label: "2000+ kg" },
  { value: "3000", label: "3000+ kg" },
];

const SORT_OPTIONS: { value: CatalogSort; label: string }[] = [
  { value: "price_asc", label: "Cena: rosnąco" },
  { value: "price_desc", label: "Cena: malejąco" },
];

// Shared FilterBtn chrome: full-width row (mobile) → content-hugging auto pill that
// wraps (sm+); the fields never stretch to fill the row (design F6). The chevron rides
// on the value's line (see each field) so it hugs the value instead of the wider
// uppercase label. The `data-[size=default]:*`
// heights are load-bearing: <SelectTrigger> stamps `data-[size=default]:h-9`, which
// (same modifier, differing base) tailwind-merge can't dedupe against a plain
// `h-[52px]`, so the Ładowność/Sortowanie pills collapsed to 36px. Overriding with
// the same modifier drops it and re-aligns them to Termin's 50/52px. `py-0` kills
// the trigger's inherited `py-2`.
const fieldShell =
  "bg-card flex h-[50px] w-full items-center gap-2.5 rounded-[13px] px-4 py-0 text-left whitespace-nowrap border border-[var(--flota-hair)] outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring/50 data-[size=default]:h-[50px] sm:h-[52px] sm:w-auto sm:flex-none sm:gap-[11px] sm:rounded-full sm:pr-[14px] sm:pl-2 sm:shadow-[0_1px_2px_rgba(15,23,42,0.04)] sm:data-[size=default]:h-[52px]";

const fieldLabel = "text-[10px] leading-none text-muted-foreground uppercase sm:tracking-[0.5px]";

export default function FilterBar({ initial }: Props) {
  const [range, setRange] = React.useState<DateRange | undefined>(() => {
    const from = fromIsoDate(initial.pickup);
    const to = fromIsoDate(initial.return);
    return from || to ? { from, to } : undefined;
  });
  const [minPayload, setMinPayload] = React.useState<string>(initial.minPayload ? String(initial.minPayload) : "any");
  const [sort, setSort] = React.useState<CatalogSort | "">(initial.sort ?? "");
  const [error, setError] = React.useState<string | null>(null);
  const [calendarOpen, setCalendarOpen] = React.useState(false);
  // Pending state for "Zastosuj": the button triggers a navigation (async
  // view-transition fetch), so it must disable + show a spinner in-flight. It
  // never needs resetting — the non-persisted island remounts on the new page.
  const [submitting, setSubmitting] = React.useState(false);

  const hasDate = Boolean(range?.from);
  const dateLabel =
    range?.from && range.to
      ? `${format(range.from, "d MMM", { locale: pl })} – ${format(range.to, "d MMM", { locale: pl })}`
      : range?.from
        ? `${format(range.from, "d MMM", { locale: pl })} – …`
        : "Wybierz daty";

  function handleApply() {
    const pickup = range?.from ? toIsoDate(range.from) : null;
    const returnDate = range?.to ? toIsoDate(range.to) : null;

    const check = validateDateRange(pickup, returnDate);
    if (!check.ok) {
      setError(check.error);
      return;
    }
    setError(null);

    const filters: VehicleFilters = {
      category: initial.category,
      pickup,
      return: returnDate,
      minPayload: minPayload === "any" ? null : Number(minPayload),
      sort: sort === "" ? null : sort,
    };

    const params = serializeFilters(filters);
    const query = params.toString();
    setSubmitting(true);
    void navigate(`/fleet${query ? `?${query}` : ""}`);
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="bg-secondary flex flex-col gap-2 rounded-[18px] border border-[var(--flota-hair-2)] p-3.5 sm:flex-row sm:flex-wrap sm:items-center sm:gap-3.5 sm:p-3 sm:pr-[14px] sm:pl-5 lg:flex-nowrap">
        {/* "Filtry": a text eyebrow on mobile, a dark round chip + label on sm+. */}
        <span className={cn(fieldLabel, "text-[11px] font-bold tracking-[1px] sm:hidden")}>Filtry</span>
        <div className="hidden shrink-0 items-center gap-[9px] sm:flex">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[var(--flota-ink-deep)] text-white">
            <SlidersHorizontal className="size-4" />
          </span>
          <span className="text-[12px] font-bold tracking-[0.4px]">Filtry</span>
        </div>

        {/* Termin — date range (Popover + Calendar). Icon stays on mobile. */}
        <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
          <PopoverTrigger asChild>
            <button type="button" className={fieldShell}>
              <span className="text-muted-foreground sm:bg-accent sm:text-primary flex shrink-0 items-center justify-center sm:size-9 sm:rounded-full">
                <CalendarIcon className="size-4" />
              </span>
              <span className="flex min-w-0 flex-1 flex-col items-start leading-tight">
                <span className={cn(fieldLabel, "hidden font-bold sm:block")}>Termin</span>
                <span className="flex items-center gap-1.5">
                  <span
                    className={cn(
                      "text-[14.5px] sm:text-[14px]",
                      hasDate ? "font-[650]" : "text-muted-foreground font-medium",
                    )}
                  >
                    {dateLabel}
                  </span>
                  {/* Desktop: chevron hugs the value so it never floats to the pill's far edge. */}
                  <ChevronDownIcon className="text-muted-foreground hidden size-[15px] shrink-0 opacity-60 sm:block" />
                </span>
              </span>
              {/* Mobile: chevron trails at the full-width row's right edge. */}
              <ChevronDownIcon className="text-muted-foreground size-[15px] shrink-0 opacity-60 sm:hidden" />
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="range"
              selected={range}
              onSelect={(next) => {
                setRange(next);
                setError(null);
              }}
              numberOfMonths={1}
              disabled={{ before: new Date(new Date().setHours(0, 0, 0, 0)) }}
              locale={pl}
              autoFocus
            />
          </PopoverContent>
        </Popover>

        {/* Ładowność — minimum payload. No icon on mobile; label-left / value-right. */}
        <Select value={minPayload} onValueChange={setMinPayload}>
          <SelectTrigger className={cn(fieldShell, "sm:[&>svg]:hidden")}>
            <span className="flex min-w-0 flex-1 items-center gap-2.5">
              <span className="text-primary bg-accent hidden size-9 shrink-0 items-center justify-center rounded-full sm:flex">
                <Package className="size-4" />
              </span>
              <span className="flex w-full min-w-0 flex-row items-center justify-between gap-2 leading-tight sm:w-auto sm:flex-col sm:items-start sm:justify-start">
                <span
                  className={cn(
                    fieldLabel,
                    "text-foreground sm:text-muted-foreground text-[14.5px] font-semibold normal-case sm:text-[10px] sm:font-bold sm:uppercase",
                  )}
                >
                  Ładowność
                </span>
                <span className="flex items-center gap-1.5">
                  <span
                    className={cn(
                      "text-[14px]",
                      minPayload === "any" ? "text-muted-foreground font-medium" : "font-[650]",
                    )}
                  >
                    <SelectValue />
                  </span>
                  {/* Desktop chevron hugs the value; the Select's built-in one is hidden ≥sm. */}
                  <ChevronDownIcon className="text-muted-foreground hidden size-[15px] shrink-0 opacity-60 sm:block" />
                </span>
              </span>
            </span>
          </SelectTrigger>
          <SelectContent>
            {PAYLOAD_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Sortowanie — price sort. Same shape as Ładowność. */}
        <Select
          value={sort}
          onValueChange={(value) => {
            setSort(value as CatalogSort);
          }}
        >
          <SelectTrigger className={cn(fieldShell, "sm:[&>svg]:hidden")}>
            <span className="flex min-w-0 flex-1 items-center gap-2.5">
              <span className="text-primary bg-accent hidden size-9 shrink-0 items-center justify-center rounded-full sm:flex">
                <ArrowUpDown className="size-4" />
              </span>
              <span className="flex w-full min-w-0 flex-row items-center justify-between gap-2 leading-tight sm:w-auto sm:flex-col sm:items-start sm:justify-start">
                <span
                  className={cn(
                    fieldLabel,
                    "text-foreground sm:text-muted-foreground text-[14.5px] font-semibold normal-case sm:text-[10px] sm:font-bold sm:uppercase",
                  )}
                >
                  Sortowanie
                </span>
                <span className="flex items-center gap-1.5">
                  <span className={cn("text-[14px]", sort === "" ? "text-muted-foreground font-medium" : "font-[650]")}>
                    <SelectValue placeholder="domyślne" />
                  </span>
                  <ChevronDownIcon className="text-muted-foreground hidden size-[15px] shrink-0 opacity-60 sm:block" />
                </span>
              </span>
            </span>
          </SelectTrigger>
          <SelectContent>
            {SORT_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Zastosuj — inline-right on desktop, full-width row on tablet + mobile. */}
        <Button
          type="button"
          onClick={handleApply}
          disabled={submitting}
          className="h-[50px] w-full rounded-[13px] text-[15px] font-[650] shadow-[0_4px_14px_-2px_rgba(180,54,56,0.35)] sm:rounded-[14px] lg:ml-auto lg:h-[46px] lg:w-auto lg:rounded-full lg:px-[26px] lg:text-[14px]"
        >
          {submitting ? (
            <span className="flex items-center justify-center gap-2">
              <span className="size-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
              Szukam…
            </span>
          ) : (
            "Zastosuj"
          )}
        </Button>
      </div>

      {error && <p className="text-destructive text-sm font-medium">{error}</p>}
    </div>
  );
}
