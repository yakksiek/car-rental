// core
import * as React from "react";
import { useFieldArray, useForm } from "react-hook-form";
import type { Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, Check, Plus, TriangleAlert, X } from "lucide-react";

// components
import { Button } from "../ui/button";
import { Checkbox } from "../ui/checkbox";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { LABEL_CLASS, Section } from "./FormSection";
import { DamageEditor, DamageEmpty, DamageRow } from "./DamageEditor";
import { FuelBar } from "./FuelBar";
import { ConflictScreen, ResultOverlay } from "./Overlays";
import type { OverlayVariant } from "./Overlays";
import { PhotoDropZone, PhotoSlot } from "./PhotoSlot";
import { SignatureField } from "./SignaturePad";

// others
import { cn } from "../../lib/utils";
import { buildProtocolPdf } from "../../lib/media/protocol-pdf";
import { DAMAGE_TYPE_LABELS_PL, PHOTO_SLOT_LABELS_PL } from "../../lib/protocol-labels";
import { computeReturnDeltas } from "../../lib/protocol-delta";
import { formatFuelDelta, formatKmDriven, formatNewDamageCount } from "../../lib/return-form";
import { PHOTO_SLOTS } from "../../lib/protocol-schema";
import { returnProtocolSchema } from "../../lib/return-protocol-schema";
import type { ReturnProtocolInput } from "../../lib/return-protocol-schema";
import { allSlotsFilled, formatOdometer, parseOdometer, randomUuid } from "../../lib/protocol-form";
import * as paths from "../../lib/protocol-storage-paths";
import { resendReturnEmail, useReturnProtocolSubmit } from "../hooks/useReturnProtocolSubmit";
import { IDLE, useProtocolMedia } from "../hooks/useProtocolMedia";
import type { ProtocolPhotoSlot } from "../../types";
import { uploadObject } from "./storage";
import type { DamageValue, ReturnProtocolContext } from "./types";

// The return-protocol form (S-06 Phase 5) — the issue form's return sibling, built
// on the shared `useProtocolMedia` hook and the same S-05 leaves (`SignaturePad`,
// `FuelBar`, `PhotoSlot`, `DamageEditor`, `FormSection`). It adds the three things
// a return needs over an issue: a **read-only baseline reference** (the issue
// odometer / fuel / damage list, never editable — FR-007), each entered damage
// auto-tagged `Istniejące | Nowe` against that baseline with a manual override,
// and a **live comparison** driven by the pure `computeReturnDeltas` so the numbers
// on screen and in the emailed PDF come from one place.
//
// **Mounted `client:only="react"`, never `client:load`** — same reason as the
// issue form: a server-rendered island drags pdf-lib + heic2any into the Worker
// bundle. Validation runs `returnProtocolSchema`, the same schema
// `POST /api/return-protocols` enforces, so client and trust boundary agree.
//
// Soft warnings never block (design invariant #5): a below-baseline odometer paints
// the amber warning and shows a negative km, but submit stays enabled.

interface Props {
  ctx: ReturnProtocolContext;
  supabaseUrl: string;
  supabaseKey: string;
}

// Mirrors the issue form's FormValues plus the return additions: the baseline id
// the RPC asserts, and a per-damage `baselineDamageId` (the persisted existing/new
// decision). Odometer is a string (coerced by the schema); `fuelEighths` starts
// `undefined` so an unlooked-at level is never recorded.
interface FormValues {
  protocolId: string;
  reservationId: string;
  baselineProtocolId: string;
  odometerKm: string;
  fuelEighths: number | undefined;
  customerAck: boolean;
  signedAt: string;
  signaturePath: string;
  photos: Partial<Record<ProtocolPhotoSlot, string>>;
  damages: DamageValue[];
}

/** Visual order — drives "scroll to and focus the first error" on a failed submit. */
const ERROR_ORDER: (keyof FormValues)[] = [
  "odometerKm",
  "fuelEighths",
  "photos",
  "damages",
  "customerAck",
  "signaturePath",
];

const ERROR_ANCHOR: Partial<Record<keyof FormValues, string>> = { photos: "photos-grid", damages: "damages" };

type ChipTone = "neutral" | "bad";

/** A mono delta chip — neutral (km, unchanged) or `bad` (adverse fuel / new damage). */
function DeltaChip({ text, tone }: { text: string; tone: ChipTone }) {
  return (
    <span
      className={cn(
        "shrink-0 rounded-[7px] px-2 py-0.5 font-mono text-[12.5px] font-bold tabular-nums",
        tone === "bad"
          ? "text-primary bg-[var(--flota-danger-soft)]"
          : "text-foreground bg-[var(--flota-neutral-soft)]",
      )}
    >
      {text}
    </span>
  );
}

/**
 * One `label · chip` row of the comparison summary card. The summary is the **dark**
 * ink variant on every breakpoint (bottom of the desktop right column, and just
 * above the submit bar on mobile), so the label is light-on-ink and bad values go
 * `#FB9B9B`. (The condition cards keep the always-light `DeltaChip`.)
 */
function SummaryRow({ label, text, tone }: { label: string; text: string; tone: ChipTone }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-background/70 text-[13px] font-medium">{label}</span>
      <span
        className={cn(
          "shrink-0 rounded-[7px] bg-white/10 px-2 py-0.5 font-mono text-[12.5px] font-bold tabular-nums",
          tone === "bad" ? "text-[#FB9B9B]" : "text-background",
        )}
      >
        {text}
      </span>
    </div>
  );
}

export default function ReturnProtocolForm({ ctx, supabaseUrl, supabaseKey }: Props) {
  // Minted once, before the first byte is uploaded — RHF needs it in defaultValues
  // at construction (before any media callback that reads the form could exist).
  const [protocolId] = React.useState(() => randomUuid());

  const [editing, setEditing] = React.useState<{ value: DamageValue; isNew: boolean } | null>(null);
  const [overlay, setOverlay] = React.useState<OverlayVariant | null>(null);
  const [overlayBusy, setOverlayBusy] = React.useState(false);
  const [conflictId, setConflictId] = React.useState<string | null>(null);
  const [submitError, setSubmitError] = React.useState<string | null>(null);
  // An object URL for the just-built PDF, so the `sent` / `email` overlay can offer
  // a "Pobierz PDF" download without a round-trip. Session-scoped; the durable path
  // is the return view screen (Phase 6), which re-mints a signed URL server-side.
  const [pdfHref, setPdfHref] = React.useState<string | null>(null);

  const {
    control,
    handleSubmit,
    setValue,
    setError,
    clearErrors,
    watch,
    formState: { errors, isSubmitted },
  } = useForm<FormValues, unknown, ReturnProtocolInput>({
    // `returnProtocolSchema` sees the *input* side (odometer as a string, ids/paths
    // the form fills in as it goes) and yields `ReturnProtocolInput`; the resolver
    // is asserted across that boundary once, here — as in the issue form.
    resolver: zodResolver(returnProtocolSchema) as unknown as Resolver<FormValues, unknown, ReturnProtocolInput>,
    mode: "onSubmit",
    reValidateMode: "onChange",
    defaultValues: {
      protocolId,
      reservationId: ctx.reservationId,
      baselineProtocolId: ctx.baselineProtocolId,
      odometerKm: "",
      fuelEighths: undefined,
      customerAck: false,
      signedAt: "",
      signaturePath: "",
      photos: {},
      damages: [],
    },
  });

  // `keyName` is renamed off `id`: our damage rows carry their own client-minted
  // `id`, which keys their storage objects.
  const damages = useFieldArray({ control, name: "damages", keyName: "_key" });

  const photos = watch("photos");
  const odometer = watch("odometerKm");
  const fuelEighths = watch("fuelEighths");
  const customerAck = watch("customerAck");
  const signedAt = watch("signedAt");

  const onPhotoUploaded = React.useCallback(
    (slot: ProtocolPhotoSlot, path: string) => {
      setValue(`photos.${slot}`, path);
      clearErrors(`photos.${slot}`);
      clearErrors("photos");
    },
    [setValue, clearErrors],
  );

  const onSignatureUploaded = React.useCallback(
    (path: string, signedAtIso: string) => {
      setValue("signaturePath", path);
      setValue("signedAt", signedAtIso);
      clearErrors(["signaturePath", "signedAt"]);
    },
    [setValue, clearErrors],
  );

  // `kind: "return"` pins every object under the `return/` storage prefix (the
  // shared `protocol-storage-paths` module), governed by the same `storage.objects`
  // RLS predicate as `issue/`.
  const {
    client,
    previews,
    tiles,
    uploading,
    done,
    capture,
    retryCapture,
    fillFreeSlots,
    uploadDamagePhoto,
    handleSigned,
    bytesOf,
  } = useProtocolMedia({
    supabaseUrl,
    supabaseKey,
    kind: "return",
    protocolId,
    photos,
    onPhotoUploaded,
    onSignatureUploaded,
  });

  // ── Live comparison (the differentiating value) ───────────────────────────────

  const odometerDigits = parseOdometer(odometer);
  const hasOdometer = odometerDigits !== "";
  const hasFuel = fuelEighths !== undefined;

  // Computed by the SAME pure helper the PDF and the email use. A still-unset
  // dimension feeds NaN, so the summary shows `—` for it (and its adverse flag stays
  // false) rather than a spurious number.
  const deltas = computeReturnDeltas(
    { odometerKm: ctx.baselineOdometerKm, fuelEighths: ctx.baselineFuelEighths },
    {
      odometerKm: hasOdometer ? Number(odometerDigits) : NaN,
      fuelEighths: fuelEighths ?? NaN,
      damages: damages.fields.map((field) => ({ baselineDamageId: field.baselineDamageId })),
    },
  );

  const summaryEmpty = !hasOdometer && !hasFuel && damages.fields.length === 0;
  // The soft-warning state (design R5): a below-baseline reading. Never blocks.
  const odometerLow = hasOdometer && deltas.kmDriven < 0;
  const kmText = hasOdometer ? formatKmDriven(deltas.kmDriven) : "—";
  const fuelText = hasFuel ? formatFuelDelta(deltas.fuelDelta) : "—";
  const fuelTone: ChipTone = hasFuel && deltas.flags.fuelAdverse ? "bad" : "neutral";
  const damageTone: ChipTone = deltas.flags.damageAdverse ? "bad" : "neutral";

  // Baseline ids already claimed by *other* current rows, so the editor's auto-tag
  // does not double-claim one baseline scratch across two return damages.
  const takenBaselineIds = React.useMemo(() => {
    if (!editing) {
      return [];
    }
    const editingId = editing.value.id;
    return damages.fields.flatMap((field) =>
      field.id !== editingId && field.baselineDamageId ? [field.baselineDamageId] : [],
    );
  }, [editing, damages.fields]);

  // ── Damages ─────────────────────────────────────────────────────────────────

  function saveDamage(value: DamageValue) {
    const at = damages.fields.findIndex((field) => field.id === value.id);
    if (at === -1) {
      damages.append(value);
    } else {
      damages.update(at, value);
    }
    clearErrors("damages");
    setEditing(null);
  }

  function deleteDamage(id: string) {
    const at = damages.fields.findIndex((field) => field.id === id);
    if (at !== -1) {
      damages.remove(at);
    }
    setEditing(null);
  }

  // ── Submit ──────────────────────────────────────────────────────────────────

  const committed = React.useRef<ReturnProtocolInput | null>(null);

  const uploadPdf = React.useCallback(
    async (id: string) => {
      const input = committed.current;
      if (!input) {
        throw new Error("Brak danych protokołu.");
      }
      // Recompute the deltas from the committed numbers, so the PDF's comparison
      // section matches what the form showed (one helper, three consumers).
      const pdfDeltas = computeReturnDeltas(
        { odometerKm: ctx.baselineOdometerKm, fuelEighths: ctx.baselineFuelEighths },
        {
          odometerKm: input.odometerKm,
          fuelEighths: input.fuelEighths,
          damages: input.damages.map((damage) => ({ baselineDamageId: damage.baselineDamageId })),
        },
      );
      const pdf = await buildProtocolPdf({
        reference: ctx.reference,
        customerName: ctx.customerName,
        vehicle: ctx.vehicle,
        plate: ctx.plate,
        odometerKm: input.odometerKm,
        fuelEighths: input.fuelEighths,
        signedAt: input.signedAt,
        customerAck: input.customerAck,
        signaturePng: await bytesOf(input.signaturePath),
        photos: await Promise.all(PHOTO_SLOTS.map(async (slot) => ({ slot, jpeg: await bytesOf(input.photos[slot]) }))),
        damages: await Promise.all(
          input.damages.map(async (damage) => ({
            type: damage.type,
            location: damage.location,
            size: damage.size,
            // The persisted existing/new link — the PDF renders the tag from it.
            baselineDamageId: damage.baselineDamageId,
            photos: await Promise.all(damage.photos.map(bytesOf)),
          })),
        ),
        // The presence of this block switches the document to "Protokół zwrotu" and
        // renders the baseline-vs-current comparison section.
        comparison: {
          baselineOdometerKm: ctx.baselineOdometerKm,
          baselineFuelEighths: ctx.baselineFuelEighths,
          kmDriven: pdfDeltas.kmDriven,
          fuelDelta: pdfDeltas.fuelDelta,
          newDamageCount: pdfDeltas.newDamageCount,
          fuelAdverse: pdfDeltas.flags.fuelAdverse,
          damageAdverse: pdfDeltas.flags.damageAdverse,
          odometerSuspect: pdfDeltas.flags.odometerSuspect,
        },
      });
      setPdfHref((prev) => {
        if (prev) {
          URL.revokeObjectURL(prev);
        }
        return URL.createObjectURL(pdf);
      });
      return uploadObject(client, paths.pdfPath("return", id), pdf);
    },
    [bytesOf, client, ctx],
  );

  // Release the PDF object URL on unmount (a client-side SPA nav would leak it).
  React.useEffect(() => {
    return () => {
      if (pdfHref) {
        URL.revokeObjectURL(pdfHref);
      }
    };
  }, [pdfHref]);

  const { submitting, submit, retryPdf } = useReturnProtocolSubmit(uploadPdf);

  function scrollToFirstError(present: (key: keyof FormValues) => boolean) {
    const key = ERROR_ORDER.find(present);
    if (!key) {
      return;
    }
    const anchor = ERROR_ANCHOR[key] ?? key;
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        const el = document.getElementById(anchor);
        el?.scrollIntoView({ behavior: "smooth", block: "center" });
        el?.focus({ preventScroll: true });
      }),
    );
  }

  async function onValid(input: ReturnProtocolInput) {
    setSubmitError(null);
    committed.current = input;
    const outcome = await submit(input);
    switch (outcome.status) {
      case "sent":
      case "email":
      case "pdf":
        setOverlay(outcome.status);
        return;
      case "conflict":
        setConflictId(outcome.protocolId);
        return;
      case "errors":
        for (const [field, message] of Object.entries(outcome.errors)) {
          setError(field as keyof FormValues, { message });
        }
        scrollToFirstError((key) => Boolean(outcome.errors[key]));
        return;
      case "error":
        setSubmitError(outcome.message ?? "Coś poszło nie tak. Spróbuj ponownie.");
    }
  }

  // ── Overlay actions ─────────────────────────────────────────────────────────

  const backToDispatch = () => {
    window.location.assign("/dashboard/returns");
  };

  async function overlayPrimary() {
    if (overlay === "sent") {
      backToDispatch();
      return;
    }
    setOverlayBusy(true);
    if (overlay === "email") {
      const delivery = await resendReturnEmail(protocolId);
      setOverlay(delivery === "sent" ? "sent" : "email");
    } else {
      const outcome = await retryPdf(protocolId);
      setOverlay(outcome.status === "sent" ? "sent" : outcome.status === "email" ? "email" : "pdf");
    }
    setOverlayBusy(false);
  }

  if (conflictId) {
    return (
      <ConflictScreen
        reference={ctx.reference}
        plate={ctx.plate}
        protocolId={conflictId}
        description="Dla tej rezerwacji istnieje już protokół zwrotu — każdy zwrot może mieć tylko jeden."
        backHref="/dashboard/returns"
      />
    );
  }

  return (
    <form
      onSubmit={(event) =>
        void handleSubmit(onValid, () => {
          scrollToFirstError((key) => Boolean(errors[key]));
        })(event)
      }
    >
      {/* Header — back / title / close. One scrolling form, no step rail. */}
      <header className="border-border bg-card sticky top-0 z-10 border-b">
        <div className="mx-auto flex max-w-[1180px] items-center justify-between gap-3 px-4 py-3.5 sm:px-6">
          <a
            href="/dashboard/returns"
            aria-label="Wróć"
            className="border-border bg-card text-foreground hover:bg-background flex size-10 shrink-0 items-center justify-center rounded-[11px] border"
          >
            <ArrowLeft className="size-[18px]" />
          </a>
          <div className="min-w-0 text-center sm:text-left">
            <h1 className="text-foreground truncate text-[17px] font-bold tracking-tight">Protokół zwrotu</h1>
            <p className="text-muted-foreground hidden truncate text-[12px] sm:block">
              {ctx.reference} · {ctx.customerName} · {ctx.vehicle} · {ctx.plate} · Zwrot {ctx.returnTime}
            </p>
          </div>
          <a
            href="/dashboard/returns"
            aria-label="Zamknij"
            className="border-border bg-card text-foreground hover:bg-background flex size-10 shrink-0 items-center justify-center rounded-[11px] border"
          >
            <X className="size-[18px]" />
          </a>
        </div>
      </header>

      <div className="mx-auto max-w-[1180px] px-4 pt-5 pb-32 sm:px-6 sm:pb-8">
        {/* Context strip — the mobile equivalent of the desktop topbar subtitle. */}
        <div className="border-border bg-card shadow-card mb-5 rounded-[14px] border px-4 py-3 sm:hidden">
          <p className="text-foreground text-[14px] font-semibold tracking-tight">
            {ctx.reference} · {ctx.customerName}
          </p>
          <p className="text-muted-foreground mt-0.5 text-[12px]">
            {ctx.vehicle} · <span className="font-mono">{ctx.plate}</span> · Zwrot {ctx.returnTime}
          </p>
        </div>

        {(isSubmitted && Object.keys(errors).length > 0) || submitError ? (
          <p className="bg-destructive/10 text-destructive mb-5 flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-medium">
            <TriangleAlert className="size-4 shrink-0" />
            {submitError ?? "Sprawdź podświetlone pola"}
          </p>
        ) : null}

        <div className="flex flex-col gap-5 lg:grid lg:grid-cols-[1.35fr_1fr] lg:items-start lg:gap-7">
          <div className="contents lg:flex lg:min-w-0 lg:flex-col lg:gap-5">
            {/* ── 1. Stan techniczny ───────────────────────────────────────── */}
            <Section
              n={1}
              title="Stan techniczny"
              sub="Licznik, paliwo i istniejące uszkodzenia. Zdjęcia można zrobić telefonem lub wgrać tutaj."
              className="order-1"
            >
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                {/* Odometer — current value entered fresh; baseline shown read-only. */}
                <div className="flex flex-col gap-2">
                  <Label htmlFor="odometerKm" className={LABEL_CLASS}>
                    Licznik
                  </Label>
                  <div
                    className={cn(
                      "bg-background flex items-center gap-2 rounded-[11px] border px-3 py-2",
                      errors.odometerKm ? "border-primary" : odometerLow ? "border-warning" : "border-transparent",
                    )}
                  >
                    <Input
                      id="odometerKm"
                      inputMode="numeric"
                      autoComplete="off"
                      placeholder="Wpisz odczyt"
                      aria-invalid={Boolean(errors.odometerKm)}
                      value={formatOdometer(odometer)}
                      onChange={(event) => {
                        setValue("odometerKm", parseOdometer(event.target.value), { shouldValidate: isSubmitted });
                      }}
                      className="h-9 border-0 bg-transparent p-0 text-[27px] font-bold tabular-nums shadow-none focus-visible:ring-0 md:text-[27px]"
                    />
                    <span className="text-muted-foreground text-[13px] font-semibold">km</span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-muted-foreground text-[12px]">
                      Przy wydaniu{" "}
                      <span className="text-foreground font-mono font-semibold">
                        {formatOdometer(String(ctx.baselineOdometerKm))}
                      </span>{" "}
                      km
                    </span>
                    <DeltaChip text={kmText} tone="neutral" />
                  </div>
                  {odometerLow && (
                    <p className="text-warning text-[12px] font-medium">
                      Licznik niższy niż przy wydaniu — sprawdź odczyt.
                    </p>
                  )}
                  {errors.odometerKm && (
                    <p className="text-destructive flex items-center gap-1.5 pt-1 text-sm font-medium">
                      <TriangleAlert className="size-4 shrink-0" />
                      {errors.odometerKm.message}
                    </p>
                  )}
                </div>

                {/* Fuel — current level entered fresh; baseline shown read-only. */}
                <div className="flex flex-col gap-2">
                  <FuelBar
                    value={fuelEighths}
                    invalid={Boolean(errors.fuelEighths)}
                    onChange={(value) => {
                      setValue("fuelEighths", value, { shouldValidate: isSubmitted });
                    }}
                  />
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-muted-foreground text-[12px]">
                      Przy wydaniu{" "}
                      <span className="text-foreground font-mono font-semibold">{ctx.baselineFuelEighths}/8</span>
                    </span>
                    <DeltaChip text={fuelText} tone={fuelTone} />
                  </div>
                  {errors.fuelEighths && (
                    <p className="text-destructive mt-auto flex items-center gap-1.5 pt-1 text-sm font-medium">
                      <TriangleAlert className="size-4 shrink-0" />
                      {errors.fuelEighths.message}
                    </p>
                  )}
                </div>
              </div>
            </Section>

            {/* ── 3. Uszkodzenia ───────────────────────────────────────────── */}
            <Section
              n={3}
              title="Uszkodzenia"
              sub="Zapisz każdy ślad osobno — zwrot porówna się z tą listą."
              className="order-3"
              aside={
                <Button
                  type="button"
                  variant="outline"
                  className="h-9 shrink-0 text-[12.5px]"
                  onClick={() => {
                    setEditing({
                      value: {
                        id: randomUuid(),
                        type: "scratch",
                        location: "",
                        size: null,
                        baselineDamageId: null,
                        photos: [],
                      },
                      isNew: true,
                    });
                  }}
                >
                  <Plus className="size-3.5" />
                  Dodaj uszkodzenie
                </Button>
              }
            >
              {/* Baseline reference — read-only, never editable (FR-007). */}
              {ctx.baselineDamages.length > 0 && (
                <div className="border-border bg-background mb-3 rounded-[14px] border p-3.5">
                  <p className={cn(LABEL_CLASS, "mb-2 uppercase")}>Uszkodzenia z protokołu wydania</p>
                  <div className="flex flex-col gap-1.5">
                    {ctx.baselineDamages.map((baseline) => (
                      <div key={baseline.id} className="flex items-center justify-between gap-2">
                        <span className="text-foreground min-w-0 truncate text-[13px]">
                          {[DAMAGE_TYPE_LABELS_PL[baseline.type], baseline.location].join(" — ")}
                          {baseline.size ? ` (${baseline.size})` : ""}
                        </span>
                        <span className="text-muted-foreground shrink-0 rounded-[7px] bg-[var(--flota-neutral-soft)] px-2 py-0.5 text-[11px] font-bold">
                          Istniejące
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div id="damages" tabIndex={-1} className="flex flex-col gap-2">
                {damages.fields.length === 0 ? (
                  <DamageEmpty returnMode />
                ) : (
                  damages.fields.map((field) => (
                    <DamageRow
                      key={field._key}
                      damage={field}
                      returnMode
                      preview={field.photos[0] ? previews[field.photos[0]] : undefined}
                      onOpen={() => {
                        const { _key: _rhfKey, ...value } = field;
                        setEditing({ value, isNew: false });
                      }}
                    />
                  ))
                )}
              </div>
            </Section>
          </div>

          <div className="contents lg:flex lg:min-w-0 lg:flex-col lg:gap-5">
            {/* ── Comparison summary ──────────────────────────────────────────
                Dark ink card on EVERY breakpoint, placed LAST (`order-last`):
                bottom of the right column on desktop (below photos + signature),
                and just above the submit bar on mobile (last in the single-column
                flow). Supersedes the contract's original mobile-top light card —
                user design decision 2026-07-20, recorded in design-contract.md §3/§4. */}
            <section className="bg-foreground shadow-card order-last rounded-[18px] p-5 sm:p-[22px]">
              <h2 className="text-background text-[15px] font-bold tracking-tight">Porównanie wydanie → zwrot</h2>
              <p className="text-background/60 mt-0.5 text-[12px]">
                Wartości porównane automatycznie z protokołem wydania.
              </p>
              {summaryEmpty ? (
                <p className="text-background/70 mt-4 rounded-[12px] bg-white/5 px-4 py-3 text-[13px]">
                  Wprowadź bieżące wartości, aby zobaczyć porównanie
                </p>
              ) : (
                <div className="mt-4 flex flex-col gap-2.5">
                  <SummaryRow label="Przejechano" text={kmText} tone="neutral" />
                  <SummaryRow label="Zmiana paliwa" text={fuelText} tone={fuelTone} />
                  <SummaryRow
                    label="Nowe uszkodzenia"
                    text={formatNewDamageCount(deltas.newDamageCount)}
                    tone={damageTone}
                  />
                </div>
              )}
            </section>

            {/* ── 2. Zdjęcia pojazdu ───────────────────────────────────────── */}
            <Section
              n={2}
              title="Zdjęcia pojazdu"
              sub="Sześć bazowych ujęć pojazdu przy zwrocie."
              className="order-2"
              aside={
                <span
                  className={cn(
                    "shrink-0 font-mono text-[12px] font-bold tabular-nums",
                    allSlotsFilled(photos) ? "text-success" : "text-muted-foreground",
                  )}
                >
                  {done}/6
                </span>
              }
            >
              <PhotoDropZone onFiles={fillFreeSlots} />
              <div id="photos-grid" tabIndex={-1} className="grid grid-cols-3 gap-2">
                {PHOTO_SLOTS.map((slot) => {
                  const tile = tiles[slot] ?? IDLE;
                  const path = photos[slot];
                  return (
                    <PhotoSlot
                      key={slot}
                      slot={slot}
                      label={PHOTO_SLOT_LABELS_PL[slot]}
                      state={path ? "done" : tile.state}
                      pct={tile.pct}
                      preview={path ? previews[path] : undefined}
                      invalid={Boolean(errors.photos)}
                      onPick={(file) => void capture(slot, file)}
                      onRetry={() => {
                        retryCapture(slot);
                      }}
                    />
                  );
                })}
              </div>
              {errors.photos && (
                <p className="text-destructive mt-3 text-sm font-medium">Wykonaj wszystkie sześć zdjęć pojazdu.</p>
              )}
            </Section>

            {/* ── 4. Podpis ────────────────────────────────────────────────── */}
            <Section
              n={4}
              title="Podpis"
              sub="Klient potwierdza powyższy stan i składa podpis."
              card={false}
              className="order-4 px-0 sm:px-0"
            >
              <label
                htmlFor="customerAck"
                className="border-border bg-card shadow-card mb-4 flex items-center gap-3 rounded-[14px] border p-4"
              >
                <Checkbox
                  id="customerAck"
                  checked={customerAck}
                  aria-invalid={Boolean(errors.customerAck)}
                  onCheckedChange={(checked) => {
                    setValue("customerAck", checked === true, { shouldValidate: isSubmitted });
                  }}
                />
                <span className="text-foreground text-[13px] font-medium">
                  Klient potwierdza stan pojazdu i warunki najmu.
                </span>
              </label>
              {errors.customerAck && (
                <p className="text-destructive mb-3 text-sm font-medium">{errors.customerAck.message}</p>
              )}

              <SignatureField
                signedAt={signedAt || null}
                customerName={ctx.customerName}
                invalid={Boolean(errors.signaturePath)}
                onSigned={handleSigned}
              />
            </Section>
          </div>
        </div>
      </div>

      {/* Sticky submit bar. Disabled while a photo or the signature is still in
          flight — the payload would carry a path with no object behind it. A soft
          warning (below-baseline odometer) never disables it. */}
      <div className="border-border bg-card fixed inset-x-0 bottom-0 z-20 border-t px-4 pt-3 pb-[30px] sm:static sm:border-0 sm:bg-transparent sm:px-6 sm:pb-8">
        <div className="mx-auto flex max-w-[1180px] sm:justify-end">
          <Button
            type="submit"
            disabled={submitting || uploading}
            aria-busy={submitting}
            className="bg-foreground text-background hover:bg-foreground/90 h-12 w-full rounded-[13px] text-[15px] font-[650] sm:w-auto sm:px-6"
          >
            {submitting ? (
              <>
                <span className="border-background/30 border-t-background size-4 animate-spin rounded-full border-2" />
                Wysyłanie…
              </>
            ) : (
              <>
                <Check className="size-4" />
                Potwierdź zwrot i wyślij
              </>
            )}
          </Button>
        </div>
      </div>

      {editing && (
        <DamageEditor
          value={editing.value}
          isNew={editing.isNew}
          previews={previews}
          baselineDamages={ctx.baselineDamages}
          takenBaselineIds={takenBaselineIds}
          onUploadPhoto={uploadDamagePhoto}
          onSave={saveDamage}
          onDelete={() => {
            deleteDamage(editing.value.id);
          }}
          onCancel={() => {
            setEditing(null);
          }}
        />
      )}

      {overlay && (
        <ResultOverlay
          variant={overlay}
          customerEmail={ctx.customerEmail}
          busy={overlayBusy}
          pdfHref={pdfHref}
          pdfFilename={`protokol-zwrotu-${ctx.reference}.pdf`}
          onPrimary={() => void overlayPrimary()}
          onSecondary={backToDispatch}
        />
      )}
    </form>
  );
}
