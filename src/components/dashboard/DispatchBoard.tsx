// core
import * as React from "react";
import { ArrowRight, Bell } from "lucide-react";

// components
import NeedDecisionPanel from "./NeedDecisionPanel";
import StatCards from "./StatCards";
import DispatchSchedule, { MobileScheduleSection, MobileSection, toPickupItem, toReturnItem } from "./DispatchSchedule";

// others
import { cn } from "../../lib/utils";
import { isSectionVisible } from "../../lib/dispatch-board";
import type { DayCounts, ScheduleGroups, SectionKey } from "../../lib/dispatch-board";
import type { PendingReservation } from "../../types";

// The dispatch cockpit's single island. It owns both breakpoints so the compact
// schedule row has one source of truth (no Astro/React duplication) and so the
// mobile chip state can filter the sections client-side. `NeedDecisionPanel` is
// imported directly rather than mounted as a second island — the whole board is
// one hydration unit.
//
// Dependency-light (no pdf-lib/heic2any) exactly like `ReturnQueue`, so
// `client:load` is safe. All data is fetched once server-side in `dashboard.astro`;
// nothing is fetched here.

export interface DispatchBoardProps {
  pending: PendingReservation[];
  counts: DayCounts;
  groups: ScheduleGroups;
  /** The server's UTC calendar date (ISO `YYYY-MM-DD`) — the overdue split. */
  today: string;
  // Seeded server-side from `?section` (parsed in dashboard.astro) so a deep-link
  // renders pre-filtered with no hydration flash — a client-only `window.location`
  // read would differ from the SSR'd HTML. `wszystko` = all sections.
  initialSection?: SectionKey;
}

/** The four mobile chips, in order; the fill is per-chip tone (design-contract §F). */
const CHIPS: { key: SectionKey; label: string; selectedFill: string }[] = [
  { key: "wszystko", label: "Wszystko", selectedFill: "bg-foreground" },
  { key: "wydania", label: "Wydania", selectedFill: "bg-primary" },
  { key: "zwroty", label: "Zwroty", selectedFill: "bg-foreground" },
  { key: "wnioski", label: "Wnioski", selectedFill: "bg-warning" },
];

/** One chip: a white card pill unselected, a tone fill with white text selected. */
function Chip({
  label,
  count,
  selected,
  selectedFill,
  onClick,
}: {
  label: string;
  count: number;
  selected: boolean;
  selectedFill: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={cn(
        "inline-flex h-[38px] items-center gap-[7px] rounded-full px-3.5 text-[13px] font-[650] whitespace-nowrap",
        selected ? cn(selectedFill, "text-white") : "bg-card text-foreground border-border border",
      )}
    >
      {label}
      <span
        className={cn(
          "flex h-[19px] min-w-[19px] items-center justify-center rounded-full px-[5px] text-[10.5px] font-bold tabular-nums",
          selected ? "bg-white/24 text-white" : "text-muted-foreground bg-[var(--flota-neutral-soft)]",
        )}
      >
        {count}
      </span>
    </button>
  );
}

export default function DispatchBoard({
  pending,
  counts,
  groups,
  today,
  initialSection = "wszystko",
}: DispatchBoardProps) {
  const [section, setSection] = React.useState<SectionKey>(initialSection);

  // Mirror the active chip into `?section` — `history.replaceState`, not a
  // navigation, so reloads/deep-links are stable and the back button is untouched
  // (the same mechanism `ReturnQueue` uses for `?filter`).
  const selectSection = React.useCallback((next: SectionKey) => {
    setSection(next);
    const url = new URL(window.location.href);
    if (next === "wszystko") {
      url.searchParams.delete("section");
    } else {
      url.searchParams.set("section", next);
    }
    window.history.replaceState(window.history.state, "", url);
  }, []);

  const chipCounts: Record<SectionKey, number> = {
    wszystko: counts.all,
    wydania: counts.pickups,
    zwroty: counts.returns,
    wnioski: counts.wnioski,
  };

  // What a row hands the destination as its `?from`. Derived from the section STATE,
  // not `window.location`, so the SSR'd href and the first client render agree (no
  // hydration mismatch) and the active chip survives the round trip: leave the
  // cockpit on "Zwroty", press back on the protocol screen, land back on "Zwroty".
  const origin = section === "wszystko" ? "/dashboard" : `/dashboard?section=${section}`;

  const pickupItems = groups.pickups.rows.map((row) => toPickupItem(row, origin));
  const returnItems = groups.returns.rows.map((row) => toReturnItem(row, today, origin));

  return (
    <>
      {/* ── Desktop cockpit (lg+; the page owns the width, so `lg:` is safe) ── */}
      <div className="hidden lg:block">
        <StatCards counts={counts} />
        <div className="mt-6 grid gap-5 lg:grid-cols-[1.5fr_1fr]">
          <div>
            <h2 className="text-muted-foreground mb-3 text-[13px] font-bold tracking-[0.4px] uppercase">
              Harmonogram na dziś
            </h2>
            <DispatchSchedule groups={groups} today={today} origin={origin} />
          </div>
          <NeedDecisionPanel reservations={pending} />
        </div>
      </div>

      {/* ── Mobile / tablet (< lg): chips + the sections they select ────────── */}
      <div className="lg:hidden">
        <div className="mt-4 flex flex-wrap gap-2">
          {CHIPS.map((chip) => (
            <Chip
              key={chip.key}
              label={chip.label}
              count={chipCounts[chip.key]}
              selected={section === chip.key}
              selectedFill={chip.selectedFill}
              onClick={() => {
                selectSection(chip.key);
              }}
            />
          ))}
        </div>

        <div className="mt-5">
          {isSectionVisible(section, "wydania") && (
            <MobileScheduleSection kind="pickups" label="Wydania" total={counts.pickups} items={pickupItems} />
          )}
          {isSectionVisible(section, "zwroty") && (
            <MobileScheduleSection kind="returns" label="Zwroty" total={counts.returns} items={returnItems} />
          )}
          {/* Wnioski sits in the amber tinted panel like the other two sections; the
              band carries the title and the "Otwórz" link, so `NeedDecisionPanel`
              renders its cards without its own header (its empty state is kept). */}
          {isSectionVisible(section, "wnioski") && (
            <MobileSection
              title={`Wnioski · ${counts.wnioski}`}
              icon={Bell}
              tint="amber"
              action={
                counts.wnioski > 0 && (
                  <a
                    href="/dashboard/reservations?from=pulpit"
                    className="text-primary flex items-center gap-1 text-xs font-[650] hover:underline"
                  >
                    Otwórz
                    <ArrowRight className="size-3.5" />
                  </a>
                )
              }
            >
              <div className="mb-2">
                <NeedDecisionPanel reservations={pending} showHeader={false} />
              </div>
            </MobileSection>
          )}
        </div>
      </div>
    </>
  );
}
