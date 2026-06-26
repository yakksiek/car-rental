// core
import * as React from "react";
import { Pencil, Plus, RotateCcw, Search, Truck, X } from "lucide-react";

// components
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";

// others
import { cn } from "../../lib/utils";
import { categoryLabelPl, formatPln, fuelLabelPl, transmissionLabelPl } from "../../lib/format";
import type { CategoryCounts } from "../../lib/services/vehicles";
import type { Vehicle, VehicleCategory } from "../../types";

// The fleet-management island (S-04 Phase 4). One responsive surface over the
// SSR-loaded fleet (active + retired): category pills + name/make/model search +
// a show-retired toggle, rendered as a table at md+ and stacked cards below.
// Edit links out to the form route; the red × opens the guarded retire confirm,
// which POSTs /api/vehicles/[id]/active and maps the 409 (active reservations)
// to an inline message. Retired rows offer restore. Polish copy is canonical.

const COPY = {
  eyebrow: "pojazdów",
  title: "Zarządzanie flotą",
  add: "Dodaj pojazd",
  searchPlaceholder: "Marka, model…",
  all: "Wszystkie",
  showRetired: "Pokaż wycofane",
  active: "Aktywny",
  retired: "Wycofany",
  edit: "Edytuj",
  restore: "Przywróć",
  colVehicle: "Pojazd",
  colStatus: "Status",
  colRate: "Stawka",
  perDay: "/doba",
  perMonth: "/mies",
  retireTitle: "Wycofać pojazd z floty?",
  cancel: "Anuluj",
  retireConfirm: "Wycofaj",
  hasReservations: "Pojazd ma aktywne rezerwacje — najpierw je anuluj.",
  genericError: "Coś poszło nie tak. Spróbuj ponownie.",
  empty: "Brak pojazdów",
  emptyHint: "Zmień filtry lub dodaj nowy pojazd do floty.",
} as const;

// Stable display order for the category pills (matches the catalog).
const CATEGORY_ORDER: VehicleCategory[] = [
  "cargo_van",
  "passenger_van",
  "car_transporter",
  "refrigerated_truck",
  "flatbed_truck",
];

const cardClass = "rounded-2xl border border-border bg-card shadow-card";

/** `2021 · Diesel · Manualna` — only the present fields, dot-separated. */
function specLine(vehicle: Vehicle): string {
  return [
    vehicle.production_year ? String(vehicle.production_year) : null,
    vehicle.fuel_type ? fuelLabelPl(vehicle.fuel_type) : null,
    vehicle.transmission ? transmissionLabelPl(vehicle.transmission) : null,
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

function StatusBadge({ active }: { active: boolean }) {
  return active ? (
    <Badge className="text-success bg-[var(--flota-success-soft)]">{COPY.active}</Badge>
  ) : (
    <Badge className="text-muted-foreground bg-muted">{COPY.retired}</Badge>
  );
}

function Rate({ vehicle, className }: { vehicle: Vehicle; className?: string }) {
  return (
    <div className={className}>
      <span className="text-foreground text-sm font-[650] tracking-tight">
        {formatPln(vehicle.daily_rate)}
        {COPY.perDay}
      </span>
      <span className="text-muted-foreground ml-2 text-xs">
        {formatPln(vehicle.monthly_rate)}
        {COPY.perMonth}
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
}: {
  vehicle: Vehicle;
  busy: boolean;
  error: string | null;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center bg-[rgba(20,18,22,0.55)] backdrop-blur-sm md:items-center"
      onClick={onClose}
    >
      <div
        onClick={(e) => {
          e.stopPropagation();
        }}
        className="bg-card shadow-overlay w-full rounded-t-[28px] p-6 pb-8 md:max-w-md md:rounded-2xl"
      >
        <div className="bg-border mx-auto mb-4 h-1 w-10 rounded-full md:hidden" />
        <div className="text-foreground text-xl font-bold tracking-tight">{COPY.retireTitle}</div>
        <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
          „{vehicle.name}” zniknie z publicznego katalogu. Możesz przywrócić pojazd w każdej chwili.
        </p>

        {error && (
          <div className="text-destructive mt-4 rounded-xl bg-[var(--flota-danger-soft)] px-3.5 py-2.5 text-sm">
            {error}
          </div>
        )}

        <div className="mt-5 flex gap-2.5">
          <Button variant="outline" className="h-12 flex-1" disabled={busy} onClick={onClose}>
            {COPY.cancel}
          </Button>
          <Button variant="destructive" className="h-12 flex-1" disabled={busy} onClick={onConfirm}>
            {COPY.retireConfirm}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ── main island ──────────────────────────────────────────────────────────────

export default function FleetList({ vehicles: initial, counts }: { vehicles: Vehicle[]; counts: CategoryCounts }) {
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
        return { ok: false, error: body?.error ?? COPY.hasReservations };
      }
      return { ok: false, error: COPY.genericError };
    } catch {
      return { ok: false, error: COPY.genericError };
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
    { key: "all", label: COPY.all, count: counts.total, value: null },
    ...CATEGORY_ORDER.map((c) => ({
      key: c,
      label: categoryLabelPl(c),
      count: counts.byCategory[c],
      value: c,
    })),
  ];

  return (
    <div>
      {/* Header: eyebrow count, title, primary add action */}
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
            {filtered.length} {COPY.eyebrow}
          </div>
          <h1 className="text-foreground mt-1 text-[28px] leading-none font-bold tracking-tight md:text-[32px]">
            {COPY.title}
          </h1>
        </div>
        {/* Dark button at md+, dark circular FAB below md */}
        <Button
          asChild
          className="bg-foreground text-background hover:bg-foreground/90 hidden h-11 px-4 md:inline-flex"
        >
          <a href="/dashboard/vehicles/new">
            <Plus className="size-4" />
            {COPY.add}
          </a>
        </Button>
        <Button
          asChild
          className="bg-foreground text-background hover:bg-foreground/90 shadow-accent flex size-12 shrink-0 rounded-full md:hidden"
        >
          <a href="/dashboard/vehicles/new" aria-label={COPY.add}>
            <Plus className="size-5" />
          </a>
        </Button>
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
          placeholder={COPY.searchPlaceholder}
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
        <span className="text-foreground font-[540]">{COPY.showRetired}</span>
      </label>

      {banner && (
        <div className="text-destructive mt-4 rounded-xl bg-[var(--flota-danger-soft)] px-4 py-3 text-sm">{banner}</div>
      )}

      {filtered.length === 0 ? (
        <div className={cn(cardClass, "mt-5 flex flex-col items-center justify-center px-6 py-16 text-center")}>
          <div className="text-foreground text-base font-[650]">{COPY.empty}</div>
          <div className="text-muted-foreground mt-1 text-sm">{COPY.emptyHint}</div>
        </div>
      ) : (
        <>
          {/* ── Desktop table (md+) ───────────────────────────────────────── */}
          <div className={cn(cardClass, "mt-5 hidden overflow-hidden md:block")}>
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="text-muted-foreground border-border border-b text-[11px] font-bold tracking-wide uppercase">
                  <th className="px-5 py-3 font-bold">{COPY.colVehicle}</th>
                  <th className="px-5 py-3 font-bold">{COPY.colStatus}</th>
                  <th className="px-5 py-3 font-bold">{COPY.colRate}</th>
                  <th className="px-5 py-3" aria-label="Akcje" />
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
                          <div className="text-muted-foreground mt-0.5 truncate text-xs">{specLine(v)}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3.5">
                      <StatusBadge active={v.is_active} />
                    </td>
                    <td className="px-5 py-3.5">
                      <Rate vehicle={v} />
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          asChild
                          variant="ghost"
                          size="icon"
                          className="text-muted-foreground hover:text-foreground"
                        >
                          <a href={editHref(v)} aria-label={COPY.edit}>
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
                            {COPY.retireConfirm}
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
                            {COPY.restore}
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
                      <StatusBadge active={v.is_active} />
                    </div>
                    <div className="text-muted-foreground mt-0.5 truncate text-xs">{specLine(v)}</div>
                    <Rate vehicle={v} className="mt-1.5" />
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
                      {COPY.edit}
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
                      {COPY.retireConfirm}
                    </Button>
                  ) : (
                    <Button
                      variant="outline"
                      className="bg-card hover:bg-background hover:text-foreground h-10 shrink-0 px-4"
                      disabled={busyId === v.id}
                      onClick={() => restore(v)}
                    >
                      <RotateCcw className="size-3.5" />
                      {COPY.restore}
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
