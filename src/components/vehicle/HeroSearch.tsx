// core
import * as React from "react";
import { navigate } from "astro:transitions/client";
import { format } from "date-fns";
import { pl } from "date-fns/locale";
import { CalendarIcon, SearchIcon } from "lucide-react";
import type { DateRange } from "react-day-picker";

// components
import { Calendar } from "../ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";

// others
import { cn } from "../../lib/utils";
import type { VehicleCategory, VehicleFilters } from "../../types";
import { serializeFilters, validateDateRange } from "../../lib/catalog-filters";
import { toIsoDate } from "../../lib/date-iso";
import { categoryLabelPl } from "../../lib/format";

// The landing hero's primary action (design screen 07): a Typ / Daty / Oddział
// search bar that commits to `/fleet`. Replaces the old generic CTA buttons — a
// visitor picks a type + date range and lands directly in a pre-filtered catalog.
// "Oddział" is a single fixed branch (no location concept in the schema yet), so
// it renders as a static field, not a control. Date validation mirrors the
// catalog's rule via `validateDateRange`.

const CATEGORIES: VehicleCategory[] = [
  "cargo_van",
  "passenger_van",
  "car_transporter",
  "refrigerated_truck",
  "flatbed_truck",
];

interface Props {
  // Current category preselection, if the landing was reached with one. Usually null.
  category?: VehicleCategory | null;
}

export default function HeroSearch({ category = null }: Props) {
  const [type, setType] = React.useState<string>(category ?? "all");
  const [range, setRange] = React.useState<DateRange | undefined>(undefined);
  const [error, setError] = React.useState<string | null>(null);
  const [calendarOpen, setCalendarOpen] = React.useState(false);

  const dateLabel =
    range?.from && range.to
      ? `${format(range.from, "d MMM", { locale: pl })} – ${format(range.to, "d MMM", { locale: pl })}`
      : range?.from
        ? `${format(range.from, "d MMM", { locale: pl })} – …`
        : "Dowolne daty";

  function handleSearch() {
    const pickup = range?.from ? toIsoDate(range.from) : null;
    const returnDate = range?.to ? toIsoDate(range.to) : null;

    const check = validateDateRange(pickup, returnDate);
    if (!check.ok) {
      setError(check.error);
      return;
    }
    setError(null);

    const filters: VehicleFilters = {
      category: type === "all" ? null : (type as VehicleCategory),
      pickup,
      return: returnDate,
      minPayload: null,
      sort: null,
    };

    const params = serializeFilters(filters);
    const query = params.toString();
    void navigate(`/fleet${query ? `?${query}` : ""}`);
  }

  return (
    <div className="w-full">
      {/* Restyled search pill (S3): stacked white card on mobile (in the light sheet),
          inline pill on desktop (≥xl, inside the dark hero). One island — the page
          repositions it across the hero/sheet boundary, it is never double-mounted. */}
      <div className="bg-card flex flex-col rounded-[22px] p-3 [box-shadow:0_18px_40px_-14px_rgba(0,0,0,0.30)] xl:flex-row xl:items-center xl:p-[7px] xl:[box-shadow:0_18px_40px_-12px_rgba(0,0,0,0.40)]">
        {/* Typ */}
        <div className="min-w-0 flex-1 border-b border-[#EEF1F5] px-4 py-2.5 xl:border-b-0 xl:py-2">
          <div className="text-[10px] font-bold tracking-[0.8px] text-[#9AA3B2] uppercase">Typ</div>
          <Select value={type} onValueChange={setType}>
            <SelectTrigger className="mt-1 h-auto w-full justify-between border-0 bg-transparent p-0 text-[15px] font-bold text-[#0E1524] shadow-none hover:bg-transparent focus-visible:ring-0 xl:text-[14.5px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Wszystkie typy</SelectItem>
              {CATEGORIES.map((c) => (
                <SelectItem key={c} value={c}>
                  {categoryLabelPl(c)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Daty */}
        <div className="min-w-0 flex-1 border-b border-[#EEF1F5] px-4 py-2.5 xl:border-b-0 xl:border-l xl:border-[#E4E8EF] xl:py-2">
          <div className="text-[10px] font-bold tracking-[0.8px] text-[#9AA3B2] uppercase">Daty</div>
          <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
            <PopoverTrigger asChild>
              <button
                type="button"
                className={cn(
                  "mt-1 flex w-full min-w-0 items-center gap-2 text-[15px] font-bold xl:text-[14.5px]",
                  range?.from ? "text-[#0E1524]" : "text-[#0E1524]/55",
                )}
              >
                <CalendarIcon className="size-4 shrink-0" />
                <span className="truncate">{dateLabel}</span>
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
        </div>

        {/* Oddział — single fixed branch (no location data model yet) */}
        <div className="min-w-0 flex-1 border-b border-[#EEF1F5] px-4 py-2.5 xl:border-b-0 xl:border-l xl:border-[#E4E8EF] xl:py-2">
          <div className="text-[10px] font-bold tracking-[0.8px] text-[#9AA3B2] uppercase">Oddział</div>
          <div className="mt-1 truncate text-[15px] font-bold text-[#0E1524] xl:text-[14.5px]">Warszawa · Mokotów</div>
        </div>

        {/* Szukaj */}
        <button
          type="button"
          onClick={handleSearch}
          className="bg-foreground text-background mt-2 inline-flex h-[52px] w-full shrink-0 items-center justify-center gap-2 rounded-[15px] text-[15.5px] font-bold transition hover:opacity-90 xl:mt-0 xl:h-auto xl:w-auto xl:px-6 xl:py-[15px] xl:text-[14.5px]"
        >
          <SearchIcon className="size-4" />
          Szukaj
        </button>
      </div>

      {error && <p className="text-destructive mt-2 px-2 text-sm font-medium">{error}</p>}
    </div>
  );
}
