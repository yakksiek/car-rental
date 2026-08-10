// core
import * as React from "react";
import { ArrowDown, Search, Tag, Truck } from "lucide-react";

// components
import { ReservationRow, ReturnRow, VehicleRow } from "./SearchRows";

// others
import { cn } from "../../lib/utils";
import { pluralPl } from "../../lib/format";
import type { SearchResults as SearchResultsData } from "../../types";

// The full results page's body (S-13 Phase 4) — filter chips over sectioned card
// lists, built to design-contract.md Surface 3 (desktop) and Surface 4 (mobile).
// Polish copy canonical.
//
// The groups are SSR'd by `search.astro` and handed in whole, so chip filtering is
// pure client-side slicing of data already on the page: no fetch, no spinner, no
// hydration flash on a pasted deep-link. The rows are the same components the ⌘K
// dropdown renders — only their chrome differs (hairline-separated card rows here,
// roving-focus list rows there), which is why `className` overrides the row shell
// instead of a second set of row components existing.

const COPY = {
  eyebrow: "Wyniki dla",
  all: "Wszystko",
  reservations: "Rezerwacje",
  returns: "Zwroty",
  vehicles: "Pojazdy",
  noResults: "Brak wyników dla",
  noResultsHint: "Sprawdź pisownię lub szukaj po numerze rezerwacji, nazwisku lub rejestracji.",
  // The mockup has no "arrived here without a query" state — reaching the page
  // with a blank `?q=` is only possible by hand-editing the URL. It gets a prompt
  // rather than the no-results copy, which would read `Brak wyników dla „”`.
  prompt: "Zacznij pisać, aby wyszukać",
  promptHint: "Szukaj po numerze rezerwacji, nazwisku klienta lub rejestracji pojazdu.",
  back: "Wróć",
};

const RESULT_FORMS: [string, string, string] = ["wynik", "wyniki", "wyników"];

type ChipId = "all" | "reservations" | "returns" | "vehicles";

export interface SearchResultsProps {
  q: string;
  initial: SearchResultsData;
  /** The server's calendar date, so the returns rows' "dziś / wczoraj" survives hydration. */
  today: string;
}

/** `„{q}” · {n} wyników` — the headline's mixed-weight tail, shared by both breakpoints. */
export function resultCountLabel(count: number): string {
  return `${count} ${pluralPl(count, RESULT_FORMS)}`;
}

export default function SearchResults({ q, initial, today }: SearchResultsProps) {
  const [chip, setChip] = React.useState<ChipId>("all");

  const counts = {
    all: initial.reservations.length + initial.returns.length + initial.vehicles.length,
    reservations: initial.reservations.length,
    returns: initial.returns.length,
    vehicles: initial.vehicles.length,
  };

  // A chip whose group is empty is not offered at all — the mockup only draws the
  // groups that actually matched.
  const chips: { id: ChipId; label: string }[] = [
    { id: "all", label: COPY.all },
    { id: "reservations", label: COPY.reservations },
    { id: "returns", label: COPY.returns },
    { id: "vehicles", label: COPY.vehicles },
  ].filter((entry) => entry.id === "all" || counts[entry.id as ChipId] > 0) as { id: ChipId; label: string }[];

  const show = (id: Exclude<ChipId, "all">) => chip === "all" || chip === id;

  if (counts.all === 0) {
    return (
      <div className="mx-auto flex max-w-[920px] flex-col items-center px-4 py-20 text-center md:px-8">
        <span className="bg-card text-muted-foreground flex size-[60px] items-center justify-center rounded-[14px]">
          <Search className="size-6" />
        </span>
        <p className="text-foreground mt-4 text-[17px] font-bold">{q ? `${COPY.noResults} „${q}”` : COPY.prompt}</p>
        <p className="text-muted-foreground mt-1.5 max-w-[340px] text-[13px]">
          {q ? COPY.noResultsHint : COPY.promptHint}
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-[920px] px-4 pt-5 pb-10 md:px-8">
      {/* Filter chips — horizontally scrollable below md (contract Surface 4). */}
      <div className="-mx-4 mb-5 flex gap-2 overflow-x-auto px-4 pb-1 md:mx-0 md:flex-wrap md:overflow-visible md:px-0">
        {chips.map((entry) => {
          const active = chip === entry.id;
          return (
            <button
              key={entry.id}
              type="button"
              onClick={() => {
                setChip(entry.id);
              }}
              aria-pressed={active}
              className={cn(
                "flex h-8 shrink-0 items-center gap-1.5 rounded-full px-3.5 text-[13px] font-[600] transition-colors md:h-[34px]",
                active ? "bg-foreground text-background" : "bg-card text-foreground border border-[var(--flota-hair)]",
              )}
            >
              {entry.label}
              <span className={cn("text-[12px]", active ? "text-background/70" : "text-muted-foreground")}>
                {counts[entry.id]}
              </span>
            </button>
          );
        })}
      </div>

      {show("reservations") && counts.reservations > 0 && (
        <ResultSection icon={Tag} label={COPY.reservations} count={counts.reservations}>
          {initial.reservations.map((row) => (
            <ReservationRow key={row.id} row={row} query={q} className={PAGE_ROW} />
          ))}
        </ResultSection>
      )}

      {show("returns") && counts.returns > 0 && (
        <ResultSection icon={ArrowDown} label={COPY.returns} count={counts.returns}>
          {initial.returns.map((row) => (
            <ReturnRow key={row.id} row={row} query={q} today={today} className={PAGE_ROW} />
          ))}
        </ResultSection>
      )}

      {show("vehicles") && counts.vehicles > 0 && (
        <ResultSection icon={Truck} label={COPY.vehicles} count={counts.vehicles}>
          {initial.vehicles.map((row) => (
            <VehicleRow key={row.id} row={row} query={q} className={PAGE_ROW} />
          ))}
        </ResultSection>
      )}
    </div>
  );
}

// Page rows are wider and square-cornered — they sit inside a shared card at md+
// (hairline-separated) and in their own card below it, so the dropdown's inset
// pill chrome is overridden rather than duplicated.
const PAGE_ROW = "mx-0 rounded-none px-4 py-3.5 hover:bg-background md:px-5";

function ResultSection({
  icon: Icon,
  label,
  count,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  count: number;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-6">
      <h2 className="text-foreground mb-2 flex items-center gap-2 text-[13px] font-bold md:text-[14px]">
        <Icon className="text-muted-foreground size-[15px]" />
        {label}
        <span className="bg-secondary flex h-[20px] min-w-[20px] items-center justify-center rounded-full px-1.5 text-[11px] font-[650] text-[var(--flota-neutral)]">
          {count}
        </span>
      </h2>
      {/* One card holding hairline-separated rows at md+; each row its own card below. */}
      <div className="md:shadow-card flex flex-col gap-2 md:gap-0 md:overflow-hidden md:rounded-[16px]">
        {React.Children.map(children, (child) => (
          <div className="bg-card shadow-card overflow-hidden rounded-[14px] md:rounded-none md:shadow-none md:not-first:border-t md:not-first:border-[var(--flota-hair-2)]">
            {child}
          </div>
        ))}
      </div>
    </section>
  );
}
