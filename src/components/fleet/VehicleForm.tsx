// core
import * as React from "react";
import { ArrowLeft, Check } from "lucide-react";

// components
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { Textarea } from "../ui/textarea";

// others
import { cn } from "../../lib/utils";
import { categoryLabelPl } from "../../lib/format";
import { firstIssuePerField, vehicleInputSchema } from "../../lib/vehicle-schema";
import type { Vehicle, VehicleCategory } from "../../types";

// The shared add/edit form island (S-04 Phase 5). One surface for both create and
// edit; which one is driven by `mode` (the only difference is POST /api/vehicles
// vs PATCH /api/vehicles/[id], the heading, and the prefilled values). Inline
// validation runs the SAME `vehicleInputSchema` the API route enforces — the
// client and the trust boundary cannot disagree — and a 400 round-trip re-maps
// the server's `{ errors }` onto the fields. Every numeric/money field is held as
// a string (the form input value and the DB's numeric-as-string quirk align), so
// the payload drops straight onto the schema's coerce step with no mapping. On
// success we hard-navigate to the fleet list.
//
// Layout mirrors the connected design's add-vehicle screen (Claude Design
// `add-vehicle.jsx`, canonical Polish copy from `shared.jsx` `vform`): a desktop
// two-column body (content 1.15fr / sticky photos 1fr, ~1080px) that stacks on
// mobile with the photos card FIRST; numbered section cards (Dane pojazdu /
// Specyfikacja / Ceny i limity / Zdjęcia); an eyebrow+title header with a back
// arrow; grey-filled 44px field tiles; category as chips. The design's branch,
// maintenance-status, photo-upload, and save-draft affordances are intentionally
// OUT of S-04 scope (no DB columns / deferred to S-07), so they're omitted;
// `per_extra_km_rate` is included because the column is NOT NULL even though the
// mockup omits it. The design's `Rejestracja` field landed in S-05, which added
// the `vehicles.plate` column (not null, unique). Polish copy is canonical.

// Stable display order for the category chips (matches the catalog + fleet list).
const CATEGORY_ORDER: VehicleCategory[] = [
  "cargo_van",
  "passenger_van",
  "car_transporter",
  "refrigerated_truck",
  "flatbed_truck",
];

// Sentinel for the "leave transmission unset" option — Radix Select items cannot
// carry an empty value, so we map this to "" when building the payload.
const TRANSMISSION_NONE = "__none__";

// Shared field styling to match the design's inset tiles: ~44px tall, radius 11,
// page-grey fill against the white card. Labels: 11px / 650 / muted grey.
const FIELD_CLASS = "bg-background h-11 rounded-[11px]";
const LABEL_CLASS = "text-muted-foreground text-[11px] font-[650] tracking-[0.01em]";

const COPY = {
  eyebrow: "Zarządzanie flotą",
  createTitle: "Dodaj pojazd",
  editTitle: "Edytuj pojazd",
  createSub: "Zarejestruj nowy pojazd w bazie floty.",
  editSub: "Zaktualizuj dane pojazdu we flocie.",
  createSubmit: "Dodaj do floty",
  editSubmit: "Zapisz zmiany",
  createPending: "Dodawanie…",
  editPending: "Zapisywanie…",
  cancel: "Anuluj",
  back: "Wróć do floty",
  secIdentity: "Dane pojazdu",
  secSpec: "Specyfikacja",
  secPricing: "Ceny i limity",
  secPhotos: "Zdjęcia",
  labelType: "Typ",
  labelTransmission: "Skrzynia",
  transmissionPlaceholder: "Wybierz skrzynię",
  transmissionNone: "Nie określono",
  photosLabel: "Adresy URL zdjęć",
  photosHint: "Po jednym adresie URL w wierszu. Pierwsze zdjęcie jest miniaturą.",
  fixFields: "Popraw zaznaczone pola.",
  genericError: "Coś poszło nie tak. Spróbuj ponownie.",
} as const;

// Text/number fields rendered identically (label + Input). Category + transmission
// (the two selects) and the photos textarea are handled out of band. `id` matches
// a `vehicleInputSchema` key so the error map and scroll-to-error key on it.
interface FieldDef {
  id: StringFieldKey;
  label: string;
  type?: string;
  inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"];
  placeholder?: string;
  required?: boolean;
  full?: boolean;
}

type StringFieldKey =
  | "name"
  | "plate"
  | "make"
  | "model"
  | "production_year"
  | "fuel_type"
  | "seats"
  | "payload_capacity_kg"
  | "cargo_length_cm"
  | "cargo_width_cm"
  | "cargo_height_cm"
  | "km_limit"
  | "daily_rate"
  | "monthly_rate"
  | "deposit"
  | "per_extra_km_rate";

// ── Dane pojazdu (Identity) — name + category(chips) are special; these fill out the rest.
const NAME_FIELD: FieldDef = {
  id: "name",
  label: "Nazwa",
  required: true,
  full: true,
  placeholder: "np. Mercedes Sprinter 317 CDI",
};
const PLATE_FIELD: FieldDef = {
  id: "plate",
  label: "Rejestracja",
  required: true,
  full: true,
  placeholder: "WX 0000A",
};
const IDENTITY: FieldDef[] = [
  { id: "make", label: "Marka", placeholder: "Mercedes-Benz" },
  { id: "model", label: "Model", placeholder: "Sprinter 317 CDI" },
  { id: "production_year", label: "Rok", type: "number", inputMode: "numeric", placeholder: "2024" },
];

// ── Specyfikacja (Specs) — fuel, then transmission(select), then seats + dims.
const SPEC_FUEL: FieldDef = { id: "fuel_type", label: "Paliwo", placeholder: "Diesel" };
const SPEC_REST: FieldDef[] = [
  { id: "seats", label: "Miejsca", type: "number", inputMode: "numeric", placeholder: "3" },
  { id: "payload_capacity_kg", label: "Ładowność (kg)", type: "number", inputMode: "decimal", placeholder: "1320" },
  { id: "cargo_length_cm", label: "Długość (cm)", type: "number", inputMode: "decimal", placeholder: "430" },
  { id: "cargo_width_cm", label: "Szerokość (cm)", type: "number", inputMode: "decimal", placeholder: "178" },
  { id: "cargo_height_cm", label: "Wysokość (cm)", type: "number", inputMode: "decimal", placeholder: "194" },
];

// ── Ceny i limity (Pricing & limits).
const PRICING: FieldDef[] = [
  {
    id: "daily_rate",
    label: "Stawka / doba (zł)",
    type: "number",
    inputMode: "decimal",
    required: true,
    placeholder: "320",
  },
  {
    id: "monthly_rate",
    label: "Stawka / mies. (zł)",
    type: "number",
    inputMode: "decimal",
    required: true,
    placeholder: "6800",
  },
  { id: "deposit", label: "Kaucja (zł)", type: "number", inputMode: "decimal", required: true, placeholder: "2500" },
  {
    id: "per_extra_km_rate",
    label: "Za dodatkowy km (zł)",
    type: "number",
    inputMode: "decimal",
    required: true,
    placeholder: "1.20",
  },
  { id: "km_limit", label: "Limit km", type: "number", inputMode: "numeric", placeholder: "300" },
];

// Visual order — drives "scroll to the first error" on a failed submit.
const FIELD_ORDER: string[] = [
  "name",
  "plate",
  "category",
  ...IDENTITY.map((f) => f.id),
  "fuel_type",
  "transmission",
  ...SPEC_REST.map((f) => f.id),
  ...PRICING.map((f) => f.id),
  "photos",
];

/** Vehicle value (string | number | null) → the string an input holds. */
function toInput(value: string | number | null | undefined): string {
  return value === null || value === undefined ? "" : String(value);
}

type StringFields = Record<StringFieldKey, string>;

function initialStrings(vehicle?: Vehicle): StringFields {
  return {
    name: toInput(vehicle?.name),
    plate: toInput(vehicle?.plate),
    make: toInput(vehicle?.make),
    model: toInput(vehicle?.model),
    production_year: toInput(vehicle?.production_year),
    fuel_type: toInput(vehicle?.fuel_type),
    seats: toInput(vehicle?.seats),
    payload_capacity_kg: toInput(vehicle?.payload_capacity_kg),
    cargo_length_cm: toInput(vehicle?.cargo_length_cm),
    cargo_width_cm: toInput(vehicle?.cargo_width_cm),
    cargo_height_cm: toInput(vehicle?.cargo_height_cm),
    km_limit: toInput(vehicle?.km_limit),
    daily_rate: toInput(vehicle?.daily_rate),
    monthly_rate: toInput(vehicle?.monthly_rate),
    deposit: toInput(vehicle?.deposit),
    per_extra_km_rate: toInput(vehicle?.per_extra_km_rate),
  };
}

/** Mono number badge + title header for a section card (design add-vehicle screen). */
function SectionHead({ n, title }: { n: number; title: string }) {
  return (
    <div className="mb-4 flex items-center gap-2.5">
      <span className="bg-background text-muted-foreground border-border flex size-[22px] items-center justify-center rounded-[7px] border font-mono text-[11px] font-bold">
        {n}
      </span>
      <h2 className="text-foreground text-[15px] font-bold tracking-tight">{title}</h2>
    </div>
  );
}

/** A titled card wrapping a 2-column field grid. */
function Section({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <section className="border-border bg-card shadow-card rounded-[18px] border p-5 sm:p-[22px]">
      <SectionHead n={n} title={title} />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">{children}</div>
    </section>
  );
}

/** Required-field marker — the design's small crimson dot. */
function Req() {
  return (
    <span className="bg-primary ml-1 inline-block size-[5px] shrink-0 rounded-full align-middle" aria-hidden="true" />
  );
}

/**
 * Cancel + submit pair — rendered in the header strip (desktop, auto width) and a
 * bottom bar (mobile, `fullWidth` so the two buttons span the row).
 */
function FormActions({
  submitting,
  submitLabel,
  pendingLabel,
  fullWidth,
  className,
}: {
  submitting: boolean;
  submitLabel: string;
  pendingLabel: string;
  fullWidth?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <Button asChild variant="outline" className={cn("h-11", fullWidth && "flex-1")}>
        <a href="/dashboard/vehicles">{COPY.cancel}</a>
      </Button>
      <Button
        type="submit"
        disabled={submitting}
        aria-busy={submitting}
        className={cn("bg-foreground text-background hover:bg-foreground/90 h-11 px-5", fullWidth && "flex-1")}
      >
        {submitting ? (
          <>
            {/* Spinner matches the staff sign-in SubmitButton. */}
            <span className="border-background/30 border-t-background size-4 animate-spin rounded-full border-2" />
            {pendingLabel}
          </>
        ) : (
          <>
            <Check className="size-4" />
            {submitLabel}
          </>
        )}
      </Button>
    </div>
  );
}

interface Props {
  mode: "create" | "edit";
  vehicle?: Vehicle;
}

export default function VehicleForm({ mode, vehicle }: Props) {
  const [fields, setFields] = React.useState<StringFields>(() => initialStrings(vehicle));
  const [category, setCategory] = React.useState<string>(vehicle?.category ?? "");
  const [transmission, setTransmission] = React.useState<string>(vehicle?.transmission ?? "");
  const [photos, setPhotos] = React.useState<string>(() => (vehicle?.photos ?? []).join("\n"));
  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string | undefined>>({});
  const [submitError, setSubmitError] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);

  const hasFieldErrors = Object.values(fieldErrors).some(Boolean);
  const formError = submitError ?? (hasFieldErrors ? COPY.fixFields : null);

  function setField(id: StringFieldKey, value: string) {
    setFields((prev) => ({ ...prev, [id]: value }));
    clearError(id);
  }

  function clearError(id: string) {
    setFieldErrors(({ [id]: _gone, ...rest }) => rest);
  }

  function buildPayload() {
    return {
      ...fields,
      category,
      transmission,
      // Textarea → one URL per line; blank lines dropped. An empty list is valid.
      photos: photos
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean),
    };
  }

  /** Run the shared schema client-side. Returns the per-field map, or null when valid. */
  function validate(): Record<string, string> | null {
    const parsed = vehicleInputSchema.safeParse(buildPayload());
    if (parsed.success) {
      setFieldErrors({});
      return null;
    }
    const errors = firstIssuePerField(parsed.error.issues);
    setFieldErrors(errors);
    return errors;
  }

  function scrollToFirstError(errors: Record<string, string>) {
    const id = FIELD_ORDER.find((field) => errors[field]);
    if (!id) {
      return;
    }
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        const el = document.getElementById(id);
        if (!el) {
          return;
        }
        el.scrollIntoView({ behavior: "smooth", block: "center" });
        el.focus({ preventScroll: true });
      }),
    );
  }

  async function handleSubmit(event: React.SyntheticEvent) {
    event.preventDefault();
    setSubmitError(null);
    const errors = validate();
    if (errors) {
      scrollToFirstError(errors);
      return;
    }
    setSubmitting(true);
    try {
      const url = mode === "create" ? "/api/vehicles" : `/api/vehicles/${vehicle?.id}`;
      const res = await fetch(url, {
        method: mode === "create" ? "POST" : "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildPayload()),
      });

      if (res.status === 200 || res.status === 201) {
        window.location.assign("/dashboard/vehicles");
        return;
      }

      const body = (await res.json().catch(() => ({}))) as { errors?: Record<string, string>; error?: string };
      if (res.status === 400 && body.errors) {
        setFieldErrors(body.errors);
        scrollToFirstError(body.errors);
        return;
      }
      setSubmitError(body.error ?? COPY.genericError);
    } catch {
      setSubmitError(COPY.genericError);
    } finally {
      setSubmitting(false);
    }
  }

  const title = mode === "create" ? COPY.createTitle : COPY.editTitle;
  const pendingLabel = mode === "create" ? COPY.createPending : COPY.editPending;
  const submitLabel = mode === "create" ? COPY.createSubmit : COPY.editSubmit;

  function renderField(field: FieldDef) {
    const error = fieldErrors[field.id];
    return (
      <div key={field.id} className={cn("flex flex-col gap-1.5", field.full && "sm:col-span-2")}>
        <Label htmlFor={field.id} className={LABEL_CLASS}>
          {field.label}
          {field.required && <Req />}
        </Label>
        <Input
          id={field.id}
          type={field.type ?? "text"}
          inputMode={field.inputMode}
          placeholder={field.placeholder}
          value={fields[field.id]}
          aria-invalid={Boolean(error)}
          className={FIELD_CLASS}
          onChange={(e) => {
            setField(field.id, e.target.value);
          }}
        />
        {error && <p className="text-destructive text-sm font-medium">{error}</p>}
      </div>
    );
  }

  return (
    <form onSubmit={(e) => void handleSubmit(e)} className="w-full">
      {/* Header — a full-bleed white strip matching the dashboard chrome (StaffShell
          header), with back arrow + eyebrow + title (left) and the actions (right,
          desktop only — mobile gets a bottom bar). */}
      <div className="border-border bg-card border-b">
        <div className="mx-auto flex max-w-[1080px] items-center justify-between gap-4 px-4 py-4 sm:px-6 sm:py-5">
          <div className="flex min-w-0 items-center gap-3">
            <a
              href="/dashboard/vehicles"
              aria-label={COPY.back}
              className="border-border bg-card text-foreground hover:bg-background flex size-10 shrink-0 items-center justify-center rounded-[11px] border transition-colors"
            >
              <ArrowLeft className="size-[18px]" />
            </a>
            <div className="min-w-0">
              <p className="text-muted-foreground text-[11px] font-semibold tracking-[0.14em] uppercase">
                {COPY.eyebrow}
              </p>
              <h1 className="text-foreground mt-0.5 text-[26px] leading-tight font-bold tracking-tight sm:text-[28px]">
                {title}
              </h1>
            </div>
          </div>
          <FormActions
            submitting={submitting}
            submitLabel={submitLabel}
            pendingLabel={pendingLabel}
            className="hidden sm:flex"
          />
        </div>
      </div>

      {/* Body — centered to the header width. A flex column on mobile (so every
          card gets the same gap), switching to two columns at lg (content 1.15fr /
          sticky photos 1fr). */}
      <div className="mx-auto max-w-[1080px] px-4 py-6 sm:px-6">
        {formError && (
          <p className="bg-destructive/10 text-destructive mb-5 rounded-xl px-4 py-3 text-sm font-medium">
            {formError}
          </p>
        )}

        <div className="flex flex-col gap-5 lg:grid lg:grid-cols-[1.15fr_1fr] lg:items-start lg:gap-6">
          {/* Left: identity / specs / pricing. */}
          <div className="flex flex-col gap-5">
            <Section n={1} title={COPY.secIdentity}>
              {renderField(NAME_FIELD)}
              {renderField(PLATE_FIELD)}
              {/* Type — required category chips (reuses the catalog/list Polish labels). */}
              <div className="flex flex-col gap-1.5 sm:col-span-2">
                {/* The chips are a button group, not a single labelable control, so
                    the label associates via aria-labelledby on a role="group". */}
                <span id="category-label" className={cn(LABEL_CLASS, "flex items-center")}>
                  {COPY.labelType}
                  <Req />
                </span>
                <div
                  className="flex flex-wrap gap-2"
                  id="category"
                  role="group"
                  aria-labelledby="category-label"
                  aria-invalid={Boolean(fieldErrors.category)}
                  tabIndex={-1}
                >
                  {CATEGORY_ORDER.map((c) => {
                    const on = category === c;
                    return (
                      <button
                        key={c}
                        type="button"
                        aria-pressed={on}
                        onClick={() => {
                          setCategory(c);
                          clearError("category");
                        }}
                        className={cn(
                          "h-[38px] rounded-[10px] border px-3.5 text-[13px] font-semibold tracking-tight transition-colors",
                          on
                            ? "border-foreground bg-foreground text-background"
                            : "border-border bg-card text-foreground hover:bg-background",
                          fieldErrors.category && !category && "border-destructive",
                        )}
                      >
                        {categoryLabelPl(c)}
                      </button>
                    );
                  })}
                </div>
                {fieldErrors.category && <p className="text-destructive text-sm font-medium">{fieldErrors.category}</p>}
              </div>
              {IDENTITY.map(renderField)}
            </Section>

            <Section n={2} title={COPY.secSpec}>
              {renderField(SPEC_FUEL)}
              {/* Transmission — optional select with an explicit "unset" option. */}
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="transmission" className={LABEL_CLASS}>
                  {COPY.labelTransmission}
                </Label>
                <Select
                  value={transmission || undefined}
                  onValueChange={(value) => {
                    setTransmission(value === TRANSMISSION_NONE ? "" : value);
                    clearError("transmission");
                  }}
                >
                  <SelectTrigger
                    id="transmission"
                    className={cn(FIELD_CLASS, "w-full")}
                    aria-invalid={Boolean(fieldErrors.transmission)}
                  >
                    <SelectValue placeholder={COPY.transmissionPlaceholder} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={TRANSMISSION_NONE}>{COPY.transmissionNone}</SelectItem>
                    <SelectItem value="manual">Manualna</SelectItem>
                    <SelectItem value="automatic">Automatyczna</SelectItem>
                  </SelectContent>
                </Select>
                {fieldErrors.transmission && (
                  <p className="text-destructive text-sm font-medium">{fieldErrors.transmission}</p>
                )}
              </div>
              {SPEC_REST.map(renderField)}
            </Section>

            <Section n={3} title={COPY.secPricing}>
              {PRICING.map(renderField)}
            </Section>
          </div>

          {/* Right column on desktop (sticky), stacked last on mobile: photos.
            Real upload is deferred to S-05, so this is a URL textarea, not a gallery. */}
          <div className="lg:sticky lg:top-6">
            <section className="border-border bg-card shadow-card rounded-[18px] border p-5 sm:p-[22px]">
              <SectionHead n={4} title={COPY.secPhotos} />
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="photos" className={LABEL_CLASS}>
                  {COPY.photosLabel}
                </Label>
                <Textarea
                  id="photos"
                  rows={5}
                  value={photos}
                  aria-invalid={Boolean(fieldErrors.photos)}
                  placeholder={"https://…/zdjecie-1.jpg\nhttps://…/zdjecie-2.jpg"}
                  className="bg-background rounded-[11px]"
                  onChange={(e) => {
                    setPhotos(e.target.value);
                    clearError("photos");
                  }}
                />
                <p className="text-muted-foreground text-xs">{COPY.photosHint}</p>
                {fieldErrors.photos && <p className="text-destructive text-sm font-medium">{fieldErrors.photos}</p>}
              </div>
            </section>
          </div>
        </div>

        {/* Mobile action bar — the header actions are desktop-only; full-width here. */}
        <FormActions
          submitting={submitting}
          submitLabel={submitLabel}
          pendingLabel={pendingLabel}
          fullWidth
          className="mt-6 sm:hidden"
        />
      </div>
    </form>
  );
}
