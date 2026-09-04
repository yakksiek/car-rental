// core
import * as React from "react";
import { Pencil, RotateCcw, Search, Truck, X } from "lucide-react";

// components
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import QuickAddButton from "../dashboard/QuickAddButton";

// others
import { cn } from "../../lib/utils";
import { formatPln } from "../../lib/format";
import { categoryLabel, fuelLabel, transmissionLabel } from "../../lib/i18n/vehicle";
import { fleetAdmin } from "../../lib/i18n/fleet-admin";
import { translator } from "../../lib/i18n/types";
import type { Locale } from "../../lib/i18n/types";
import type { CategoryCounts } from "../../lib/services/vehicles";
import type { Vehicle, VehicleCategory } from "../../types";

// The fleet-management island (S-04 Phase 4). One responsive surface over the
// SSR-loaded fleet (active + retired): category pills + name/make/model search +
// a show-retired toggle, rendered as a table at md+ and stacked cards below.
// Edit links out to the form route; the red × opens the guarded retire confirm,
// which POSTs /api/vehicles/[id]/active and maps the 409 (active reservations)
// to an inline message. Retired rows offer restore. Polish copy is canonical.
//
// ── PHASE 11 of invite-journey-fixes: the row arm's feedback ─────────────────
//
// This screen already got HALF of that change right before it was written: the
// retire confirmation reports INSIDE its dialog (`setDialogError` → `RetireDialog`'s
// `error` prop), which is the shape phase 9 had to build for the staff add modal.
// The row arm was the wrong half — `restore`'s banner sat above the list while
// `Przywróć` is per-row, so the message landed off-screen. Fixed by applying phase
// 10 §3's answer verbatim; see the banner's own comment below.
//
// THREE DECISIONS RECORDED HERE, because an unstated omission is what produced
// this phase (plan §2, §3; design-contract §10 entry 5):
//
//   1. NO SHARED MODULE. `staff-report.ts` exists because the staff roster's
//      routing was provably wrong and had to be gated by a unit test. Phase 10
//      §3's answer is PRESENTATIONAL — a `sticky` and a ✕ — so this change is
//      presentational too. Fleet's two failure arms are already resolved inside
//      `postActive` and its copy is local (`genericError` / `hasReservations`).
//      Porting the module across the slice boundary, or widening its `Outcome`
//      union with vehicle arms, would buy symmetry and nothing testable.
//
//   2. THE VANISHING ANCHOR IS MOOT, not solved. Retiring with "Pokaż wycofane"
//      unchecked does drop the row out of `filtered`, so a ROW-ANCHORED report
//      would inherit phase 10 §3's constraint. Sticky is not row-anchored, so
//      the constraint never binds — and that asymmetry is one of the reasons
//      option (c) lost on the staff roster. Restated, not re-decided.
//
//   3. `restore` STILL HAS NO SUCCESS FEEDBACK, and that is deliberate — not the
//      same omission phase 10 closed with `inviteSent`. There, a resend changes
//      NOTHING on screen (the badge is already ZAPROSZONY), so the banner was the
//      only signal. Here the row itself answers: `is_active` flips, so the badge
//      goes retired → active and the action goes restore → retire, on
//      the row the admin just clicked — verified against the running app at
//      390×844, 2026-08-24, reading the card before and after. A restored row
//      also cannot vanish either; it passes `filtered` at any toggle state. Out
//      of scope, and not carried as a follow-up; adding a banner would be a
//      second signal for a change already visible at the point of the click.

// Stable display order for the category pills (matches the catalog).
const CATEGORY_ORDER: VehicleCategory[] = [
  "cargo_van",
  "passenger_van",
  "car_transporter",
  "refrigerated_truck",
  "flatbed_truck",
];

const cardClass = "rounded-lg border border-border bg-card shadow-card";

/** `2021 · Diesel · Manualna` — only the present fields, dot-separated. */
function specLine(vehicle: Vehicle, locale: Locale): string {
  return [
    vehicle.production_year ? String(vehicle.production_year) : null,
    vehicle.fuel_type ? fuelLabel(vehicle.fuel_type, locale) : null,
    vehicle.transmission ? transmissionLabel(vehicle.transmission, locale) : null,
  ]
    .filter(Boolean)
    .join(" · ");
}

function editHref(vehicle: Vehicle): string {
  return `/dashboard/vehicles/${vehicle.id}/edit`;
}

// ── shared cells ─────────────────────────────────────────────────────────────

function Thumbnail({ vehicle, className }: { vehicle: Vehicle; className?: string }) {
  const src = vehicle.photos.at(0);
  if (src) {
    return (
      <img
        src={src}
        alt=""
        className={cn("bg-background shrink-0 rounded-[10px] object-cover", className)}
        loading="lazy"
      />
    );
  }
  return (
    <div
      className={cn(
        "bg-background text-muted-foreground flex shrink-0 items-center justify-center rounded-[10px]",
        className,
      )}
      aria-hidden="true"
    >
      <Truck className="size-6" strokeWidth={1.5} />
    </div>
  );
}

function StatusBadge({ active, locale }: { active: boolean; locale: Locale }) {
  const t = translator(locale, fleetAdmin);
  return active ? (
    <Badge className="text-success bg-[var(--flota-success-soft)]">{t("active")}</Badge>
  ) : (
    <Badge className="text-muted-foreground bg-muted">{t("retired")}</Badge>
  );
}

function Rate({ vehicle, className, locale }: { vehicle: Vehicle; className?: string; locale: Locale }) {
  const t = translator(locale, fleetAdmin);
  return (
    <div className={className}>
      <span className="text-foreground text-sm font-[650] tracking-tight">
        {formatPln(vehicle.daily_rate, locale)}
        {t("perDay")}
      </span>
      <span className="text-muted-foreground ml-2 text-xs">
        {formatPln(vehicle.monthly_rate, locale)}
        {t("perMonth")}
      </span>
    </div>
  );
}

// ── retire confirm (mobile bottom-sheet / desktop centered modal) ────────────

function RetireDialog({
  vehicle,
  busy,
  error,
  onConfirm,
  onClose,
  locale,
}: {
  vehicle: Vehicle;
  busy: boolean;
  error: string | null;
  onConfirm: () => void;
  onClose: () => void;
  locale: Locale;
}) {
  const t = translator(locale, fleetAdmin);
  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center bg-[rgba(20,18,22,0.55)] backdrop-blur-sm md:items-center"
      onClick={onClose}
    >
      <div
        onClick={(e) => {
          e.stopPropagation();
        }}
        className="bg-card shadow-overlay w-full rounded-t-[28px] p-6 pb-8 md:max-w-md md:rounded-xl"
      >
        <div className="bg-border mx-auto mb-4 h-1 w-10 rounded-full md:hidden" />
        <div className="text-foreground text-xl font-bold tracking-tight">{t("retireTitle")}</div>
        <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
          {t("retireBodyHead")}
          {vehicle.name}
          {t("retireBodyTail")}
        </p>

        {error && (
          <div className="text-destructive mt-4 rounded-xl bg-[var(--flota-danger-soft)] px-3.5 py-2.5 text-sm">
            {error}
          </div>
        )}

        <div className="mt-5 flex gap-2.5">
          <Button variant="outline" className="h-12 flex-1" disabled={busy} onClick={onClose}>
            {t("cancel")}
          </Button>
          <Button variant="destructive" className="h-12 flex-1" disabled={busy} onClick={onConfirm}>
            {t("retireConfirm")}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ── main island ──────────────────────────────────────────────────────────────

export default function FleetList({
  vehicles: initial,
  counts,
  locale,
}: {
  vehicles: Vehicle[];
  counts: CategoryCounts;
  /** Islands cannot read `Astro.locals`; the mounting page passes it down. */
  locale: Locale;
}) {
  const t = translator(locale, fleetAdmin);
  const [vehicles, setVehicles] = React.useState<Vehicle[]>(initial);
  const [category, setCategory] = React.useState<VehicleCategory | null>(null);
  const [search, setSearch] = React.useState("");
  const [showRetired, setShowRetired] = React.useState(false);
  const [confirmFor, setConfirmFor] = React.useState<Vehicle | null>(null);
  const [busyId, setBusyId] = React.useState<string | null>(null);
  const [dialogError, setDialogError] = React.useState<string | null>(null);
  const [banner, setBanner] = React.useState<string | null>(null);

  const q = search.trim().toLowerCase();
  const filtered = vehicles.filter((v) => {
    if (!showRetired && !v.is_active) {
      return false;
    }
    if (category && v.category !== category) {
      return false;
    }
    if (q) {
      const haystack = [v.name, v.make, v.model].filter(Boolean).join(" ").toLowerCase();
      if (!haystack.includes(q)) {
        return false;
      }
    }
    return true;
  });

  function applyActive(id: string, active: boolean) {
    setVehicles((rows) => rows.map((r) => (r.id === id ? { ...r, is_active: active } : r)));
  }

  // POST the guarded flip. 200 → applied; 409 → the active-reservations message;
  // anything else → generic. Same-origin fetch carries cookies + Origin, so the
  // CSRF + auth gates pass without extra headers.
  async function postActive(id: string, active: boolean): Promise<{ ok: true } | { ok: false; error: string }> {
    try {
      const res = await fetch(`/api/vehicles/${id}/active`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active }),
      });
      if (res.status === 200) {
        return { ok: true };
      }
      if (res.status === 409) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        return { ok: false, error: body?.error ?? t("hasReservations") };
      }
      return { ok: false, error: t("genericError") };
    } catch {
      return { ok: false, error: t("genericError") };
    }
  }

  async function confirmRetire() {
    if (!confirmFor) {
      return;
    }
    setBusyId(confirmFor.id);
    setDialogError(null);
    const result = await postActive(confirmFor.id, false);
    setBusyId(null);
    if (result.ok) {
      applyActive(confirmFor.id, false);
      setConfirmFor(null);
    } else {
      setDialogError(result.error);
    }
  }

  // The row's own state IS the success report — see decision 3 in the header
  // comment. Only the failure arm has anything to say, and it says it in a
  // banner that is now pinned.
  async function restore(vehicle: Vehicle) {
    setBusyId(vehicle.id);
    setBanner(null);
    const result = await postActive(vehicle.id, true);
    setBusyId(null);
    if (result.ok) {
      applyActive(vehicle.id, true);
    } else {
      setBanner(result.error);
    }
  }

  const pills: { key: string; label: string; count: number; value: VehicleCategory | null }[] = [
    { key: "all", label: t("all"), count: counts.total, value: null },
    ...CATEGORY_ORDER.map((c) => ({
      key: c,
      label: categoryLabel(c, locale),
      count: counts.byCategory[c],
      value: c,
    })),
  ];

  return (
    <div>
      {/* Header: eyebrow count, title, primary add action.
          The title block is `md:hidden` since S-12b: at md+ the shell's band
          already renders "Zarządzanie flotą", so drawing it here too put the
          page title on screen twice — a defect the band's new right-hand pill
          sits directly above. Below md there is no shell header, so it stays. */}
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 md:hidden">
          <div className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
            {filtered.length} {t("eyebrow")}
          </div>
          <h1 className="text-foreground mt-1 text-[28px] leading-none font-bold tracking-tight">{t("title")}</h1>
        </div>
        {/* No md+ button since Phase 6: `Dodaj pojazd` is reached through the
            shell's `＋ Nowe` menu at every breakpoint, where this page's action is
            the promoted crimson row. Keeping it here as well rendered the same
            action twice on this one board. */}
        {/* Below md this board's own create action is ABSORBED into the
            quick-action sheet as its promoted (crimson) first row, so the screen
            carries a single `＋` and manual reservation stays reachable from here.
            `vehicle` collides with a canonical key, so the sheet is 2 rows with no
            duplicate. Size 48 → 40 per the settled reconciliation, with the
            design's own shadow (replacing `shadow-accent`). */}
        <div className="md:hidden">
          <QuickAddButton mode="mobile" promoted="vehicle" locale={locale} />
        </div>
      </div>

      {/* Search */}
      <div className="relative mt-5">
        <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2" />
        <input
          type="search"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
          }}
          placeholder={t("searchPlaceholder")}
          className="border-border bg-card text-foreground placeholder:text-muted-foreground focus-visible:ring-ring h-11 w-full rounded-xl border pr-4 pl-10 text-sm outline-none focus-visible:ring-2"
        />
      </div>

      {/* Category pills */}
      <div className="mt-4 flex flex-wrap gap-2">
        {pills.map((p) => {
          const isActive = category === p.value;
          return (
            <button
              key={p.key}
              type="button"
              onClick={() => {
                setCategory(p.value);
              }}
              aria-pressed={isActive}
              className={cn(
                "rounded-full px-3.5 py-1.5 text-[13px] font-[540] tracking-tight transition-colors",
                isActive
                  ? "bg-foreground text-background"
                  : "border-border bg-card text-foreground hover:bg-background border",
              )}
            >
              {p.label} · {p.count}
            </button>
          );
        })}
      </div>

      {/* Show-retired toggle */}
      <label className="mt-4 flex w-fit cursor-pointer items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={showRetired}
          onChange={(e) => {
            setShowRetired(e.target.checked);
          }}
          className="accent-foreground size-4 rounded"
        />
        <span className="text-foreground font-[540]">{t("showRetired")}</span>
      </label>

      {/* Restore-failure banner — PINNED, phase 11 of invite-journey-fixes.

          `Przywróć` is per-row and reachable at any scroll depth; this banner is
          anchored above the list. So the message landed outside the viewport
          exactly as the roster's did — measured 2026-08-24 at 390×844 with a
          retired row at the bottom of the list: the page scrolls 1186px, and at
          that depth the banner sat at top **-879** with `elementFromPoint`
          answering `null` at its own centre, while `toBeVisible()` passed.

          `sticky top-4 z-20` is phase 10 §3's answer for the staff roster
          (design-contract §8.6 / §10 entry 4), applied here rather than
          re-decided — the whole point of ordering this phase after phase 10 is
          that the app gets ONE answer to "feedback from a per-row control".

          The ELEMENT is this screen's own, not §8.1's: `rounded-xl`, `px-4 py-3`,
          `text-sm`, no icon, no border, no retry. Only the positioning and the ✕
          are inherited. Design-contract §8.7 measures both.

          `z-20` sits above the list and below the two fixed layers it must not
          fight — `RetireDialog` at `z-[60]` and the mobile tab bar at `z-30`. */}
      {banner && (
        <div className="text-destructive sticky top-4 z-20 mt-4 flex items-center justify-between gap-3 rounded-xl bg-[var(--flota-danger-soft)] px-4 py-3 text-sm">
          <span className="min-w-0">{banner}</span>
          {/* The exit pinning takes away. Scrolling past the banner used to be
              how it went away — which IS this defect — and `setBanner(null)`
              otherwise fires only at the start of the next restore. Geometry and
              label are the staff roster's ✕ (§8.6), itself `ModalShell`'s
              shipped control minus its absolute positioning. */}
          <button
            type="button"
            aria-label={t("close")}
            onClick={() => {
              setBanner(null);
            }}
            className="bg-card text-muted-foreground hover:text-foreground flex size-8 shrink-0 items-center justify-center rounded-full"
          >
            <X className="size-4" />
          </button>
        </div>
      )}

      {filtered.length === 0 ? (
        <div className={cn(cardClass, "mt-5 flex flex-col items-center justify-center px-6 py-16 text-center")}>
          <div className="text-foreground text-base font-[650]">{t("empty")}</div>
          <div className="text-muted-foreground mt-1 text-sm">{t("emptyHint")}</div>
        </div>
      ) : (
        <>
          {/* ── Desktop table (md+) ───────────────────────────────────────── */}
          <div className={cn(cardClass, "mt-5 hidden overflow-hidden md:block")}>
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="text-muted-foreground border-border border-b text-[11px] font-bold tracking-wide uppercase">
                  <th className="px-5 py-3 font-bold">{t("colVehicle")}</th>
                  <th className="px-5 py-3 font-bold">{t("colStatus")}</th>
                  <th className="px-5 py-3 font-bold">{t("colRate")}</th>
                  <th className="px-5 py-3" aria-label={t("colActions")} />
                </tr>
              </thead>
              <tbody>
                {filtered.map((v) => (
                  <tr key={v.id} className="border-b border-[var(--flota-hair-2)] last:border-0">
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <Thumbnail vehicle={v} className="h-11 w-16" />
                        <div className="min-w-0">
                          <div className="text-foreground truncate text-sm font-[650] tracking-tight">{v.name}</div>
                          <div className="text-muted-foreground mt-0.5 truncate text-xs">{specLine(v, locale)}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3.5">
                      <StatusBadge locale={locale} active={v.is_active} />
                    </td>
                    <td className="px-5 py-3.5">
                      <Rate vehicle={v} locale={locale} />
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          asChild
                          variant="ghost"
                          size="icon"
                          className="text-muted-foreground hover:text-foreground"
                        >
                          <a href={editHref(v)} aria-label={t("edit")}>
                            <Pencil className="size-4" />
                          </a>
                        </Button>
                        {v.is_active ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-muted-foreground hover:text-destructive gap-1.5"
                            disabled={busyId === v.id}
                            onClick={() => {
                              setDialogError(null);
                              setConfirmFor(v);
                            }}
                          >
                            <X className="size-3.5" />
                            {t("retireConfirm")}
                          </Button>
                        ) : (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-muted-foreground hover:text-foreground gap-1.5"
                            disabled={busyId === v.id}
                            onClick={() => restore(v)}
                          >
                            <RotateCcw className="size-3.5" />
                            {t("restore")}
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* ── Mobile cards (below md) ────────────────────────────────────── */}
          <div className="mt-5 flex flex-col gap-3 md:hidden">
            {filtered.map((v) => (
              <div key={v.id} className={cn(cardClass, "p-4")}>
                <div className="flex items-start gap-3">
                  <Thumbnail vehicle={v} className="h-14 w-20" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <div className="text-foreground truncate text-[15px] font-[650] tracking-tight">{v.name}</div>
                      <StatusBadge locale={locale} active={v.is_active} />
                    </div>
                    <div className="text-muted-foreground mt-0.5 truncate text-xs">{specLine(v, locale)}</div>
                    <Rate vehicle={v} locale={locale} className="mt-1.5" />
                  </div>
                </div>
                <div className="mt-3.5 flex gap-2">
                  <Button
                    asChild
                    variant="outline"
                    className="bg-card hover:bg-background hover:text-foreground h-10 flex-1"
                  >
                    <a href={editHref(v)}>
                      <Pencil className="size-4" />
                      {t("edit")}
                    </a>
                  </Button>
                  {v.is_active ? (
                    <Button
                      variant="outline"
                      className="text-destructive hover:text-destructive bg-card hover:bg-background h-10 shrink-0 px-4"
                      disabled={busyId === v.id}
                      onClick={() => {
                        setDialogError(null);
                        setConfirmFor(v);
                      }}
                    >
                      <X className="size-4" />
                      {t("retireConfirm")}
                    </Button>
                  ) : (
                    <Button
                      variant="outline"
                      className="bg-card hover:bg-background hover:text-foreground h-10 shrink-0 px-4"
                      disabled={busyId === v.id}
                      onClick={() => restore(v)}
                    >
                      <RotateCcw className="size-3.5" />
                      {t("restore")}
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {confirmFor && (
        <RetireDialog
          locale={locale}
          vehicle={confirmFor}
          busy={busyId === confirmFor.id}
          error={dialogError}
          onConfirm={confirmRetire}
          onClose={() => {
            setConfirmFor(null);
            setDialogError(null);
          }}
        />
      )}
    </div>
  );
}
