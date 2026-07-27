// components
import NeedDecisionPanel from "./NeedDecisionPanel";
import StatCards from "./StatCards";
import DispatchSchedule from "./DispatchSchedule";

// others
import type { DayCounts, ScheduleGroups } from "../../lib/dispatch-board";
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
}

export default function DispatchBoard({ pending, counts, groups, today }: DispatchBoardProps) {
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
            <DispatchSchedule groups={groups} today={today} />
          </div>
          <NeedDecisionPanel reservations={pending} />
        </div>
      </div>
    </>
  );
}
