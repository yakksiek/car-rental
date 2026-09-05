// core
import { ArrowRight, Key, List, TriangleAlert } from "lucide-react";

// others
import { cn } from "../../lib/utils";
import type { DayCounts } from "../../lib/dispatch-board";
import { translator, type Locale } from "../../lib/i18n/types";
import { staff } from "../../lib/i18n/staff";

// The desktop KPI row of the dispatch cockpit (design `DashStat`, design-contract
// §B). Four whole-card links onto the views they count: three white cards with a
// tone accent bar and a watermark glyph, then the filled-crimson overdue
// urgency card. Numbers are DAY TOTALS — the row count of the view each card
// opens — so a card's number always matches the list it lands on.

interface ToneCard {
  href: string;
  label: string;
  subLabel: string;
  value: number;
  /** Top accent bar + number + watermark tone. */
  accent: string;
  numberTone: string;
  Icon: typeof Key;
}

/** One of the three white cards: accent bar, big tone-coloured number, watermark. */
function StatCard({ card }: { card: ToneCard }) {
  const { Icon } = card;
  return (
    <a
      href={card.href}
      className="bg-card shadow-card relative flex min-h-[148px] flex-1 flex-col justify-between overflow-hidden rounded-[18px] px-5 pt-[18px] pb-4"
    >
      <span className={cn("absolute inset-x-0 top-0 h-1 opacity-90", card.accent)} aria-hidden="true" />
      <Icon
        className={cn("pointer-events-none absolute -right-5 -bottom-[26px] size-32 opacity-[0.06]", card.numberTone)}
        aria-hidden="true"
      />
      <div className={cn("text-[46px] leading-none font-[750] tracking-[-2px] tabular-nums", card.numberTone)}>
        {card.value}
      </div>
      <div>
        <div className="text-foreground mt-[7px] text-[14.5px] font-[650] tracking-[-0.2px]">{card.label}</div>
        <div className="text-muted-foreground mt-[3px] text-[10.5px] font-bold tracking-[0.5px] uppercase">
          {card.subLabel}
        </div>
      </div>
    </a>
  );
}

/** The urgency card — filled crimson, no accent bar, an `urgent` pill beside the sub-label. */
function OverdueCard({ value, t }: { value: number; t: (key: keyof typeof staff.en) => string }) {
  return (
    <a
      href="/dashboard/returns?filter=overdue"
      className="bg-primary relative flex min-h-[148px] flex-1 flex-col justify-between overflow-hidden rounded-[18px] px-5 pt-[18px] pb-4 shadow-[0_10px_26px_var(--flota-danger-soft)]"
    >
      <TriangleAlert
        className="pointer-events-none absolute -right-5 -bottom-[26px] size-32 text-white opacity-[0.18]"
        aria-hidden="true"
      />
      <div className="text-[46px] leading-none font-[750] tracking-[-2px] text-white tabular-nums">{value}</div>
      <div>
        <div className="mt-[7px] text-[14.5px] font-[650] tracking-[-0.2px] text-white">{t("overdue")}</div>
        <div className="mt-[3px] flex items-center gap-2">
          {/* `uppercase` is the CSS, so the catalog holds sentence case. */}
          <span className="text-[10.5px] font-bold tracking-[0.5px] text-white/70 uppercase">{t("today")}</span>
          <span className="inline-flex h-5 items-center gap-[5px] rounded-full bg-white/15 px-[9px] text-[9.5px] font-bold tracking-[0.4px] text-white uppercase">
            <span className="size-[5px] rounded-full bg-white" aria-hidden="true" />
            {t("urgent")}
          </span>
        </div>
      </div>
    </a>
  );
}

export default function StatCards({ counts, locale }: { counts: DayCounts; locale: Locale }) {
  const t = translator(locale, staff);
  const cards: ToneCard[] = [
    {
      href: "/dashboard/pickups",
      label: t("navPickups"),
      subLabel: t("today"),
      value: counts.pickups,
      accent: "bg-foreground",
      numberTone: "text-foreground",
      Icon: Key,
    },
    {
      href: "/dashboard/returns",
      label: t("navReturns"),
      subLabel: t("today"),
      value: counts.returns,
      accent: "bg-success",
      numberTone: "text-success",
      Icon: ArrowRight,
    },
    {
      href: "/dashboard/reservations?from=dashboard",
      label: t("navRequests"),
      subLabel: t("pendingSub"),
      value: counts.requests,
      accent: "bg-warning",
      numberTone: "text-warning",
      Icon: List,
    },
  ];

  return (
    <div className="flex gap-4">
      {cards.map((card) => (
        <StatCard key={card.href} card={card} />
      ))}
      <OverdueCard value={counts.overdue} t={t} />
    </div>
  );
}
