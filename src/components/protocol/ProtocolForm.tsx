// core
import * as React from "react";
import { useFieldArray, useForm } from "react-hook-form";
import type { Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, MessageSquare, Plus, TriangleAlert, X } from "lucide-react";

// components
import { Button } from "../ui/button";
import { Checkbox } from "../ui/checkbox";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { DamageEditor, DamageEmpty, DamageRow } from "./DamageEditor";
import { FuelBar } from "./FuelBar";
import { ConflictScreen, ResultOverlay } from "./Overlays";
import type { OverlayVariant } from "./Overlays";
import { PhotoDropZone, PhotoSlot } from "./PhotoSlot";
import { SignatureField } from "./SignaturePad";

// others
import { cn } from "../../lib/utils";
import { compressImage } from "../../lib/media/compress";
import { buildProtocolPdf } from "../../lib/media/protocol-pdf";
import { PHOTO_SLOT_LABELS_PL } from "../../lib/protocol-labels";
import { PHOTO_SLOTS, protocolInputSchema } from "../../lib/protocol-schema";
import type { ProtocolInput } from "../../lib/protocol-schema";
import { allSlotsFilled, filledSlotCount, formatOdometer, parseOdometer, randomUuid } from "../../lib/protocol-form";
import { resendProtocolEmail, useProtocolSubmit } from "../hooks/useProtocolSubmit";
import type { ProtocolPhotoSlot } from "../../types";
import { createStorageClient, damagePhotoPath, pdfPath, photoPath, signaturePath, uploadObject } from "./storage";
import type { DamageValue, ProtocolContext, UploadState } from "./types";

// The issue-protocol form (S-05 Phase 5) — one component tree, two layouts. On a
// phone it is a single scrolling form: an employee standing in the rain must not
// paginate. On desktop the same sections sit in two columns (condition + damage
// left, photos + signature right).
//
// **Mounted `client:only="react"`, never `client:load`.** A `client:load` island is
// server-rendered to produce its initial HTML, so Astro's server build must be able
// to execute this component — and emits everything reachable from it. That drags
// pdf-lib and heic2any into the Worker bundle (measured: 559 → 1,506 KiB gzip).
// Converting the imports to `await import()` does not sever the edge; Vite's SSR
// build follows a dynamic import too. `client:only` is the only lever, and it costs
// nothing here: the form is staff-only behind auth, so there is no SEO or no-JS
// story to protect.
//
// First adopter of `react-hook-form` in this repo, per `lessons.md`. `VehicleForm`'s
// `useState` map is a known exception, not a precedent. `useFieldArray` drives the
// dynamic damage list and its per-item photo strips.
//
// Validation runs `protocolInputSchema` — the same schema `POST /api/protocols`
// enforces — so the client and the trust boundary cannot disagree.
//
// The React Compiler skips memoizing this component: RHF's `watch()` returns a
// function it cannot memoize safely. That is expected and correct (`eslint` warns,
// does not error) — the form is one screen, and stale memoized field values would
// be far worse than the re-renders.

interface Props {
  ctx: ProtocolContext;
  supabaseUrl: string;
  supabaseKey: string;
}

// The odometer is held as a string (like every numeric field in this repo) so the
// payload drops straight onto the schema's coerce step. `fuelEighths` starts
// `undefined` — the DB column is 0–8 with no "unset", but a form that silently
// defaults to half a tank would record a fuel level nobody looked at.
interface FormValues {
  protocolId: string;
  reservationId: string;
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

const LABEL_CLASS = "text-muted-foreground text-[11px] font-[650] tracking-[0.01em]";

function SectionHead({ n, title, sub, aside }: { n: number; title: string; sub: string; aside?: React.ReactNode }) {
  return (
    <div className="mb-4 flex items-start justify-between gap-3">
      <div className="flex items-start gap-2.5">
        <span className="bg-foreground text-background flex size-6 shrink-0 items-center justify-center rounded-[8px] font-mono text-[12px] font-bold">
          {n}
        </span>
        <div>
          <h2 className="text-foreground text-[15px] font-bold tracking-tight">{title}</h2>
          <p className="text-muted-foreground mt-0.5 text-[12px]">{sub}</p>
        </div>
      </div>
      {aside}
    </div>
  );
}

function Section({
  n,
  title,
  sub,
  aside,
  card = true,
  className,
  children,
}: {
  n: number;
  title: string;
  sub: string;
  aside?: React.ReactNode;
  card?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section
      className={cn("rounded-[18px] p-5 sm:p-[22px]", card && "border-border bg-card shadow-card border", className)}
    >
      <SectionHead n={n} title={title} sub={sub} aside={aside} />
      {children}
    </section>
  );
}

interface TileState {
  state: UploadState;
  pct: number;
}

const IDLE: TileState = { state: "empty", pct: 0 };

export default function ProtocolForm({ ctx, supabaseUrl, supabaseKey }: Props) {
  // Minted once, before the first byte is uploaded: this id keys every storage
  // object, and an id generated inside `create_protocol` would arrive too late.
  const [protocolId] = React.useState(() => randomUuid());
  const client = React.useMemo(() => createStorageClient(supabaseUrl, supabaseKey), [supabaseUrl, supabaseKey]);

  // Every compressed blob, keyed by its storage path. `buildProtocolPdf` re-reads
  // them from here rather than downloading back what it just uploaded.
  const blobs = React.useRef(new Map<string, Blob>());
  const [previews, setPreviews] = React.useState<Record<string, string>>({});
  // The last file picked per slot, so `Ponów` replays it without a second picker.
  const retryFiles = React.useRef(new Map<ProtocolPhotoSlot, File>());

  const [tiles, setTiles] = React.useState<Record<string, TileState>>({});
  const [editing, setEditing] = React.useState<{ value: DamageValue; isNew: boolean } | null>(null);
  const [overlay, setOverlay] = React.useState<OverlayVariant | null>(null);
  const [overlayBusy, setOverlayBusy] = React.useState(false);
  const [conflictId, setConflictId] = React.useState<string | null>(null);
  const [submitError, setSubmitError] = React.useState<string | null>(null);
  // An object URL for the just-built PDF, so the `sent` / `email` overlay can offer
  // a "Pobierz PDF" download without a round-trip — the blob is already in hand.
  // Session-scoped only: the durable "open it months later" path is the Phase 6
  // view-protocol screen, which re-mints a signed URL server-side on each visit.
  const [pdfHref, setPdfHref] = React.useState<string | null>(null);

  const {
    control,
    handleSubmit,
    setValue,
    setError,
    clearErrors,
    watch,
    formState: { errors, isSubmitted },
  } = useForm<FormValues, unknown, ProtocolInput>({
    // `protocolInputSchema` sees the *input* side (odometer as a string, ids and
    // paths the form fills in as it goes) and yields `ProtocolInput`. The two
    // shapes differ, so the resolver is asserted across that boundary once, here.
    resolver: zodResolver(protocolInputSchema) as unknown as Resolver<FormValues, unknown, ProtocolInput>,
    mode: "onSubmit",
    reValidateMode: "onChange",
    defaultValues: {
      protocolId,
      reservationId: ctx.reservationId,
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
  // `id`, which is what keys their storage objects.
  const damages = useFieldArray({ control, name: "damages", keyName: "_key" });

  const photos = watch("photos");
  const odometer = watch("odometerKm");
  const fuelEighths = watch("fuelEighths");
  const customerAck = watch("customerAck");
  const signedAt = watch("signedAt");

  // The signature uploads inside its modal, which stays open until the upload
  // resolves — so by the time the form is interactive again the signature is in.
  // Only the inline photo tiles can still be mid-flight here.
  const uploading = Object.values(tiles).some((tile) => tile.state === "uploading");
  const done = filledSlotCount(photos);

  const registerBlob = React.useCallback((path: string, blob: Blob) => {
    blobs.current.set(path, blob);
    setPreviews((prev) => ({ ...prev, [path]: URL.createObjectURL(blob) }));
  }, []);

  // ── Photos ──────────────────────────────────────────────────────────────────

  const capture = React.useCallback(
    async (slot: ProtocolPhotoSlot, file: File) => {
      retryFiles.current.set(slot, file);
      setTiles((prev) => ({ ...prev, [slot]: { state: "uploading", pct: 20 } }));
      try {
        // HEIC is detected and converted inside `compressImage`; a format the
        // browser cannot decode throws here rather than uploading a blank JPEG.
        const blob = await compressImage(file);
        setTiles((prev) => ({ ...prev, [slot]: { state: "uploading", pct: 65 } }));
        const path = photoPath(protocolId, slot);
        await uploadObject(client, path, blob);
        registerBlob(path, blob);
        setValue(`photos.${slot}`, path);
        clearErrors(`photos.${slot}`);
        clearErrors("photos");
        setTiles((prev) => ({ ...prev, [slot]: { state: "done", pct: 100 } }));
      } catch {
        // The tile paints its `failed` / `Ponów` state; the employee retries.
        setTiles((prev) => ({ ...prev, [slot]: { state: "failed", pct: 0 } }));
      }
    },
    [client, protocolId, registerBlob, setValue, clearErrors],
  );

  /** Desktop multi-select / drop: fill the next free slots, in capture order. */
  function fillFreeSlots(files: File[]) {
    const free = PHOTO_SLOTS.filter((slot) => !photos[slot]);
    free.slice(0, files.length).forEach((slot, i) => {
      void capture(slot, files[i]);
    });
  }

  // ── Damages ─────────────────────────────────────────────────────────────────

  const uploadDamagePhoto = React.useCallback(
    async (damageId: string, index: number, file: File) => {
      const blob = await compressImage(file);
      const path = damagePhotoPath(protocolId, damageId, index);
      await uploadObject(client, path, blob);
      registerBlob(path, blob);
      return path;
    },
    [client, protocolId, registerBlob],
  );

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

  // ── Signature ───────────────────────────────────────────────────────────────

  // Bumped on clear. The signature upload is async; if the customer taps `Wyczyść`
  // while a sign is still uploading, its resolve must not re-stamp `signedAt` onto
  // a now-empty pad. Each sign captures the current token and drops itself if the
  // token moved (a clear, or a newer sign superseding it) before it finished.
  const signSeq = React.useRef(0);

  // Upload the committed signature PNG and stamp `signed_at`. Returns success so
  // the modal keeps itself open (showing `Zapisywanie…`) until the object has
  // actually landed, then closes. The generation token guards against a rapid
  // re-sign (`Zmień`) superseding an older, still-uploading capture.
  async function handleSigned(png: Blob): Promise<boolean> {
    const seq = (signSeq.current += 1);
    try {
      const path = signaturePath(protocolId);
      await uploadObject(client, path, png);
      if (seq !== signSeq.current) {
        return false;
      }
      registerBlob(path, png);
      setValue("signaturePath", path);
      // `signed_at` is the moment the customer actually signed — a separate fact
      // from the booking's fixed 14:00 pickup hour.
      setValue("signedAt", new Date().toISOString());
      clearErrors(["signaturePath", "signedAt"]);
      return true;
    } catch {
      return false;
    }
  }

  // ── Submit ──────────────────────────────────────────────────────────────────

  // Held for the PDF build, which runs *after* the protocol has committed and so
  // cannot re-read the form (it may already be behind an overlay).
  const committed = React.useRef<ProtocolInput | null>(null);

  const bytesOf = React.useCallback(async (path: string): Promise<Uint8Array> => {
    const blob = blobs.current.get(path);
    if (!blob) {
      throw new Error(`Brak pliku w pamięci: ${path}`);
    }
    return new Uint8Array(await blob.arrayBuffer());
  }, []);

  const uploadPdf = React.useCallback(
    async (id: string) => {
      const input = committed.current;
      if (!input) {
        throw new Error("Brak danych protokołu.");
      }
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
            photos: await Promise.all(damage.photos.map(bytesOf)),
          })),
        ),
      });
      // Hold an object URL for the overlay's download. Revoke any prior one (a
      // retry rebuilds the PDF) so we never leak more than one.
      setPdfHref((prev) => {
        if (prev) {
          URL.revokeObjectURL(prev);
        }
        return URL.createObjectURL(pdf);
      });
      // `buildProtocolPdf` types its blob `application/pdf`; the bucket's
      // `allowed_mime_types` reads exactly that, so it is passed through untouched.
      return uploadObject(client, pdfPath(id), pdf);
    },
    [bytesOf, client, ctx],
  );

  // Release the PDF object URL when the island unmounts (browsers auto-revoke on
  // unload too, but a client-side nav within the SPA would otherwise leak it).
  React.useEffect(() => {
    return () => {
      if (pdfHref) {
        URL.revokeObjectURL(pdfHref);
      }
    };
  }, [pdfHref]);

  const { submitting, submit, retryPdf } = useProtocolSubmit(uploadPdf);

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

  async function onValid(input: ProtocolInput) {
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
    window.location.assign("/dashboard/pickups");
  };

  async function overlayPrimary() {
    if (overlay === "sent") {
      backToDispatch();
      return;
    }
    setOverlayBusy(true);
    if (overlay === "email") {
      const delivery = await resendProtocolEmail(protocolId);
      setOverlay(delivery === "sent" ? "sent" : "email");
    } else {
      // `pdf`: replay build → upload → finalize, which is also the first send.
      const outcome = await retryPdf(protocolId);
      setOverlay(outcome.status === "sent" ? "sent" : outcome.status === "email" ? "email" : "pdf");
    }
    setOverlayBusy(false);
  }

  if (conflictId) {
    return <ConflictScreen reference={ctx.reference} plate={ctx.plate} protocolId={conflictId} />;
  }

  const odometerDigits = parseOdometer(odometer);
  const rollback = ctx.lastOdometerKm !== null && odometerDigits !== "" && Number(odometerDigits) < ctx.lastOdometerKm;

  return (
    <form
      onSubmit={(event) =>
        void handleSubmit(onValid, () => {
          scrollToFirstError((key) => Boolean(errors[key]));
        })(event)
      }
    >
      {/* Header — back / title / close. No step rail: this is one scrolling form. */}
      <header className="border-border bg-card sticky top-0 z-10 border-b">
        <div className="mx-auto flex max-w-[1180px] items-center justify-between gap-3 px-4 py-3.5 sm:px-6">
          <a
            href="/dashboard/pickups"
            aria-label="Wróć"
            className="border-border bg-card text-foreground hover:bg-background flex size-10 shrink-0 items-center justify-center rounded-[11px] border"
          >
            <ArrowLeft className="size-[18px]" />
          </a>
          <div className="min-w-0 text-center sm:text-left">
            <h1 className="text-foreground truncate text-[17px] font-bold tracking-tight">Protokół wydania</h1>
            <p className="text-muted-foreground hidden truncate text-[12px] sm:block">
              {ctx.reference} · {ctx.customerName} · {ctx.vehicle} · {ctx.plate} · Odbiór {ctx.pickupTime}
            </p>
          </div>
          <a
            href="/dashboard/pickups"
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
            {ctx.vehicle} · <span className="font-mono">{ctx.plate}</span> · Odbiór {ctx.pickupTime}
          </p>
        </div>

        {(isSubmitted && Object.keys(errors).length > 0) || submitError ? (
          <p className="bg-destructive/10 text-destructive mb-5 flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-medium">
            <TriangleAlert className="size-4 shrink-0" />
            {submitError ?? "Sprawdź podświetlone pola"}
          </p>
        ) : null}

        {/* Two independent columns. On mobile the column wrappers are
            display:contents, so all four sections interleave in numeric order via
            `order-*`; at lg they become real flex columns that pack their own
            sections tightly — so a short section 1 no longer leaves a void before
            section 3. */}
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
                <div className="flex flex-col gap-2">
                  <Label htmlFor="odometerKm" className={LABEL_CLASS}>
                    Licznik
                  </Label>
                  {/* `flex-1` grows the box to fill the cell, so its bottom lands on
                    the fuel bar's E/F line (the taller fuel column sets the height).
                    `items-center` keeps the big number vertically centred in it. */}
                  <div
                    className={cn(
                      "bg-background flex flex-1 items-center gap-2 rounded-[11px] border px-3 py-2",
                      errors.odometerKm ? "border-primary" : "border-transparent",
                    )}
                  >
                    <Input
                      id="odometerKm"
                      inputMode="numeric"
                      autoComplete="off"
                      placeholder="0"
                      aria-invalid={Boolean(errors.odometerKm)}
                      value={formatOdometer(odometer)}
                      onChange={(event) => {
                        setValue("odometerKm", parseOdometer(event.target.value), { shouldValidate: isSubmitted });
                      }}
                      className="h-9 border-0 bg-transparent p-0 text-[27px] font-bold tabular-nums shadow-none focus-visible:ring-0 md:text-[27px]"
                    />
                    <span className="text-muted-foreground text-[13px] font-semibold">km</span>
                  </div>
                  {rollback && (
                    <p className="text-warning text-[12px] font-medium">
                      Poprzedni odczyt to {formatOdometer(String(ctx.lastOdometerKm))} km — sprawdź, czy licznik się
                      zgadza.
                    </p>
                  )}
                  {/* The grown input already pushes this to the bottom, level with
                    the fuel error. */}
                  {errors.odometerKm && (
                    <p className="text-destructive flex items-center gap-1.5 pt-1 text-sm font-medium">
                      <TriangleAlert className="size-4 shrink-0" />
                      {errors.odometerKm.message}
                    </p>
                  )}
                </div>

                {/* Fuel bar + its error share one grid cell, so the message sits
                  directly under the bar rather than dropping to a full-width row. */}
                <div className="flex flex-col gap-2">
                  <FuelBar
                    value={fuelEighths}
                    invalid={Boolean(errors.fuelEighths)}
                    onChange={(value) => {
                      setValue("fuelEighths", value, { shouldValidate: isSubmitted });
                    }}
                  />
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
                      value: { id: randomUuid(), type: "scratch", location: "", size: null, photos: [] },
                      isNew: true,
                    });
                  }}
                >
                  <Plus className="size-3.5" />
                  Dodaj uszkodzenie
                </Button>
              }
            >
              <div id="damages" tabIndex={-1} className="flex flex-col gap-2">
                {damages.fields.length === 0 ? (
                  <DamageEmpty />
                ) : (
                  damages.fields.map((field) => (
                    <DamageRow
                      key={field._key}
                      damage={field}
                      preview={field.photos[0] ? previews[field.photos[0]] : undefined}
                      onOpen={() => {
                        // Strip `useFieldArray`'s `_key` before it re-enters the form values.
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
            {/* ── 2. Zdjęcia pojazdu ───────────────────────────────────────── */}
            <Section
              n={2}
              title="Zdjęcia pojazdu"
              sub="Sześć bazowych ujęć pojazdu."
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
                        const file = retryFiles.current.get(slot);
                        if (file) {
                          void capture(slot, file);
                        } else {
                          setTiles((prev) => ({ ...prev, [slot]: IDLE }));
                        }
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
          flight — the payload would carry a path with no object behind it. */}
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
                <MessageSquare className="size-4" />
                Potwierdź wydanie i wyślij
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
          pdfFilename={`protokol-wydania-${ctx.reference}.pdf`}
          onPrimary={() => void overlayPrimary()}
          onSecondary={backToDispatch}
        />
      )}
    </form>
  );
}
