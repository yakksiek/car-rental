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
import { categoryLabel, transmissionLabel } from "../../lib/i18n/vehicle";
import type { Locale } from "../../lib/i18n/types";
import { firstIssuePerField, vehicleInputSchema } from "../../lib/vehicle-schema";
import { fleetAdmin } from "../../lib/i18n/fleet-admin";
import { translator } from "../../lib/i18n/types";
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

// Text/number fields rendered identically (label + Input). Category + transmission
// (the two selects) and the photos textarea are handled out of band. `id` matches
// a `vehicleInputSchema` key so the error map and scroll-to-error key on it.
interface FieldDef {
  id: StringFieldKey;
  /** Catalog key rather than a literal, so the table can stay module-level. */
  labelKey: keyof (typeof fleetAdmin)["en"];
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
  labelKey: "fieldName",
  required: true,
  full: true,
  placeholder: "np. Mercedes Sprinter 317 CDI",
};
const PLATE_FIELD: FieldDef = {
  id: "plate",
  labelKey: "fieldPlate",
  required: true,
  full: true,
  placeholder: "WX 0000A",
};
const IDENTITY: FieldDef[] = [
  { id: "make", labelKey: "fieldMake", placeholder: "Mercedes-Benz" },
  { id: "model", labelKey: "fieldModel", placeholder: "Sprinter 317 CDI" },
  { id: "production_year", labelKey: "fieldYear", type: "number", inputMode: "numeric", placeholder: "2024" },
];

// ── Specyfikacja (Specs) — fuel, then transmission(select), then seats + dims.
const SPEC_FUEL: FieldDef = { id: "fuel_type", labelKey: "fieldFuel", placeholder: "Diesel" };
const SPEC_REST: FieldDef[] = [
  { id: "seats", labelKey: "fieldSeats", type: "number", inputMode: "numeric", placeholder: "3" },
  { id: "payload_capacity_kg", labelKey: "fieldPayload", type: "number", inputMode: "decimal", placeholder: "1320" },
  { id: "cargo_length_cm", labelKey: "fieldLength", type: "number", inputMode: "decimal", placeholder: "430" },
  { id: "cargo_width_cm", labelKey: "fieldWidth", type: "number", inputMode: "decimal", placeholder: "178" },
  { id: "cargo_height_cm", labelKey: "fieldHeight", type: "number", inputMode: "decimal", placeholder: "194" },
];

// ── Ceny i limity (Pricing & limits).
const PRICING: FieldDef[] = [
  {
    id: "daily_rate",
    labelKey: "fieldDailyRate",
    type: "number",
    inputMode: "decimal",
    required: true,
    placeholder: "320",
  },
  {
    id: "monthly_rate",
    labelKey: "fieldMonthlyRate",
    type: "number",
    inputMode: "decimal",
    required: true,
    placeholder: "6800",
  },
  {
    id: "deposit",
    labelKey: "fieldDeposit",
    type: "number",
    inputMode: "decimal",
    required: true,
    placeholder: "2500",
  },
  {
    id: "per_extra_km_rate",
    labelKey: "fieldExtraKm",
    type: "number",
    inputMode: "decimal",
    required: true,
    placeholder: "1.20",
  },
  { id: "km_limit", labelKey: "fieldKmLimit", type: "number", inputMode: "numeric", placeholder: "300" },
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
  locale,
}: {
  submitting: boolean;
  submitLabel: string;
  pendingLabel: string;
  fullWidth?: boolean;
  className?: string;
  locale: Locale;
}) {
  const t = translator(locale, fleetAdmin);
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <Button asChild variant="outline" className={cn("h-11", fullWidth && "flex-1")}>
        <a href="/dashboard/vehicles">{t("cancel")}</a>
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
  /** Islands cannot read `Astro.locals`, so the page passes the request locale in. */
  locale: Locale;
}

export default function VehicleForm({ mode, vehicle, locale }: Props) {
  const t = translator(locale, fleetAdmin);
  const [fields, setFields] = React.useState<StringFields>(() => initialStrings(vehicle));
  const [category, setCategory] = React.useState<string>(vehicle?.category ?? "");
  const [transmission, setTransmission] = React.useState<string>(vehicle?.transmission ?? "");
  const [photos, setPhotos] = React.useState<string>(() => (vehicle?.photos ?? []).join("\n"));
  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string | undefined>>({});
  const [submitError, setSubmitError] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);

  const hasFieldErrors = Object.values(fieldErrors).some(Boolean);
  const formError = submitError ?? (hasFieldErrors ? t("fixFields") : null);

  // The values the form opened with, mirroring the `useState` initialisers above.
  // Dirtiness is a comparison against this rather than a flag, so none of the ~18
  // field handlers has to remember to set anything.
  const pristine = React.useMemo(
    () => ({
      fields: initialStrings(vehicle),
      category: vehicle?.category ?? "",
      transmission: vehicle?.transmission ?? "",
      photos: (vehicle?.photos ?? []).join("\n"),
    }),
    [vehicle],
  );

  const dirty =
    category !== pristine.category ||
    transmission !== pristine.transmission ||
    photos !== pristine.photos ||
    (Object.keys(pristine.fields) as StringFieldKey[]).some((key) => fields[key] !== pristine.fields[key]);

  // Don't drop a part-filled form on a full navigation. The case that prompted this
  // is ⌘K: on a page with no search field the shortcut runs
  // `location.assign("/dashboard?search=1")`, which would otherwise discard ~18
  // fields with no warning. A reload, a closed tab and an external link are covered
  // too. NOT covered: an in-app link click — `<ClientRouter>` swaps the DOM without
  // unloading the document, so nothing fires here. That needs its own
  // `astro:before-preparation` guard.
  //
  // Disarming on `submitting` is load-bearing: the success path is
  // `location.assign("/dashboard/vehicles")`, and leaving the handler attached would
  // prompt the user on a save that worked. That only holds because `submitting` stays
  // true through the redirect — `handleSubmit` resets it on the paths that return the
  // user to the form (400, generic error, network throw) and never on success. It must
  // not go back into a `finally`: the success branch `return`s from inside the `try`,
  // so a `finally` would re-attach this listener while the redirect is in flight.
  React.useEffect(() => {
    if (!dirty || submitting) {
      return;
    }
    function onBeforeUnload(event: BeforeUnloadEvent) {
      // `preventDefault()` alone is the current spec and is what every browser we
      // target honours. The old `event.returnValue = ""` companion is deprecated
      // (and lints as an error here); it only ever mattered for Chrome <119 /
      // Firefox <124. No browser displays a custom string either way.
      event.preventDefault();
    }
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload);
    };
  }, [dirty, submitting]);

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
    const parsed = vehicleInputSchema(locale).safeParse(buildPayload());
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
        setSubmitting(false);
        return;
      }
      setSubmitError(body.error ?? t("genericError"));
      setSubmitting(false);
    } catch {
      setSubmitError(t("genericError"));
      setSubmitting(false);
    }
  }

  const title = mode === "create" ? t("createTitle") : t("editTitle");
  const pendingLabel = mode === "create" ? t("createPending") : t("editPending");
  const submitLabel = mode === "create" ? t("createSubmit") : t("editSubmit");

  function renderField(field: FieldDef) {
    const error = fieldErrors[field.id];
    return (
      <div key={field.id} className={cn("flex flex-col gap-1.5", field.full && "sm:col-span-2")}>
        <Label htmlFor={field.id} className={LABEL_CLASS}>
          {t(field.labelKey)}
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
          desktop only — mobile gets a bottom bar). This screen passes
          `showHeader={false}`, so the shell draws NO band above it at any width and
          this strip is the page's only header — it must stay opaque and full-bleed
          at md+ too.
          The strip always spanned, but its CONTENT used to be capped
          `mx-auto max-w-[1080px]`, so at 1440 the title started at x=316 where every
          other staff page's band starts at x=272 — this screen read as inset by 44px.
          It now takes the band's own `sm:px-8` (`StaffShell.astro:180`). The body
          below deliberately keeps its 1080 column: no page in this app aligns its
          header to its body (bodies run 768…1440 with no convention, while the
          header rule is uniform), so matching the header is what makes this screen
          behave like the other nine. */}
      <div className="border-border bg-card border-b">
        <div className="flex items-center justify-between gap-4 px-4 py-4 sm:px-8 sm:py-5">
          <div className="flex min-w-0 items-center gap-3">
            <a
              href="/dashboard/vehicles"
              aria-label={t("back")}
              className="border-border bg-card text-foreground hover:bg-background flex size-10 shrink-0 items-center justify-center rounded-[11px] border transition-colors"
            >
              <ArrowLeft className="size-[18px]" />
            </a>
            <div className="min-w-0">
              <p className="text-muted-foreground text-[11px] font-semibold tracking-[0.14em] uppercase">
                {t("formEyebrow")}
              </p>
              <h1 className="text-foreground mt-0.5 text-[26px] leading-tight font-bold tracking-tight sm:text-[28px]">
                {title}
              </h1>
            </div>
          </div>
          <FormActions
            locale={locale}
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
            <Section n={1} title={t("secIdentity")}>
              {renderField(NAME_FIELD)}
              {renderField(PLATE_FIELD)}
              {/* Type — required category chips (reuses the catalog/list Polish labels). */}
              <div className="flex flex-col gap-1.5 sm:col-span-2">
                {/* The chips are a button group, not a single labelable control, so
                    the label associates via aria-labelledby on a role="group". */}
                <span id="category-label" className={cn(LABEL_CLASS, "flex items-center")}>
                  {t("labelType")}
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
                        {categoryLabel(c, locale)}
                      </button>
                    );
                  })}
                </div>
                {fieldErrors.category && <p className="text-destructive text-sm font-medium">{fieldErrors.category}</p>}
              </div>
              {IDENTITY.map(renderField)}
            </Section>

            <Section n={2} title={t("secSpec")}>
              {renderField(SPEC_FUEL)}
              {/* Transmission — optional select with an explicit "unset" option. */}
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="transmission" className={LABEL_CLASS}>
                  {t("labelTransmission")}
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
                    <SelectValue placeholder={t("transmissionPlaceholder")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={TRANSMISSION_NONE}>{t("transmissionNone")}</SelectItem>
                    <SelectItem value="manual">{transmissionLabel("manual", locale)}</SelectItem>
                    <SelectItem value="automatic">{transmissionLabel("automatic", locale)}</SelectItem>
                  </SelectContent>
                </Select>
                {fieldErrors.transmission && (
                  <p className="text-destructive text-sm font-medium">{fieldErrors.transmission}</p>
                )}
              </div>
              {SPEC_REST.map(renderField)}
            </Section>

            <Section n={3} title={t("secPricing")}>
              {PRICING.map(renderField)}
            </Section>
          </div>

          {/* Right column on desktop (sticky), stacked last on mobile: photos.
            Real upload is deferred to S-05, so this is a URL textarea, not a gallery. */}
          <div className="lg:sticky lg:top-6">
            <section className="border-border bg-card shadow-card rounded-[18px] border p-5 sm:p-[22px]">
              <SectionHead n={4} title={t("secPhotos")} />
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="photos" className={LABEL_CLASS}>
                  {t("photosLabel")}
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
                <p className="text-muted-foreground text-xs">{t("photosHint")}</p>
                {fieldErrors.photos && <p className="text-destructive text-sm font-medium">{fieldErrors.photos}</p>}
              </div>
            </section>
          </div>
        </div>

        {/* Mobile action bar — the header actions are desktop-only; full-width here. */}
        <FormActions
          locale={locale}
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
