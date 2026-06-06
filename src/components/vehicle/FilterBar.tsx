// core
import * as React from "react";
import { navigate } from "astro:transitions/client";
import { format } from "date-fns";
import { pl } from "date-fns/locale";
import { CalendarIcon } from "lucide-react";
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

// The catalog's only interactive piece. It stages date-range / minimum-payload /
// price-sort locally and commits to the URL on an explicit "Zastosuj" — one
// navigation per deliberate change. It is NOT `transition:persist`ed: it remounts
// on every navigation and re-derives its state from `initial` (the current URL
// filters), so category-tab and apply navigations never leave it stale. Inline
// date validation mirrors `validateDateRange` so the picker can't submit a range
// the RPC would choke on.

interface Props {
  initial: VehicleFilters;
}

const PAYLOAD_OPTIONS = [
  { value: "any", label: "Ładowność: dowolna" },
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
    void navigate(`/fleet${query ? `?${query}` : ""}`);
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        {/* Date range */}
        <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              className={cn(
                "bg-card h-10 justify-start gap-2 rounded-full font-medium",
                !range?.from && "text-muted-foreground",
              )}
            >
              <CalendarIcon className="size-4" />
              {dateLabel}
            </Button>
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

        {/* Minimum payload */}
        <Select value={minPayload} onValueChange={setMinPayload}>
          <SelectTrigger className="bg-card hover:bg-accent hover:text-accent-foreground h-10 rounded-full font-medium transition-colors">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PAYLOAD_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Price sort + apply — pushed to the right on wider screens (design 08). */}
        <div className="flex items-center gap-2 sm:ml-auto">
          <Select
            value={sort}
            onValueChange={(value) => {
              setSort(value as CatalogSort);
            }}
          >
            <SelectTrigger className="bg-card hover:bg-accent hover:text-accent-foreground h-10 rounded-full font-medium transition-colors">
              <SelectValue placeholder="Sortowanie" />
            </SelectTrigger>
            <SelectContent>
              {SORT_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button onClick={handleApply} className="h-10 rounded-full px-5 font-semibold">
            Zastosuj
          </Button>
        </div>
      </div>

      {error && <p className="text-destructive text-sm font-medium">{error}</p>}
    </div>
  );
}
