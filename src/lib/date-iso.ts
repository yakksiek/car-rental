// Pure conversions between `Date` and the `YYYY-MM-DD` strings the catalog filter
// state uses. Both catalog islands (FilterBar, HeroSearch) feed a react-day-picker
// `Date` to/from the URL, so this lives in one place. We use LOCAL calendar
// components (not `toISOString`, which is UTC) so the string matches what
// `catalog-filters.parseFilters` reads back.

/** Local calendar date → `YYYY-MM-DD`. */
export function toIsoDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/** `YYYY-MM-DD` (or null) → local midnight `Date`, or `undefined`. */
export function fromIsoDate(value: string | null): Date | undefined {
  if (!value) {
    return undefined;
  }
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}
