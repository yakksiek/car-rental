// core
import * as React from "react";
import { ArrowLeft, Check, Download, RefreshCw, X } from "lucide-react";

// components
import { Button } from "../ui/button";
import { DeliveryBadge, deliveryBadge } from "./DeliveryBadge";

// others
import { cn } from "../../lib/utils";
import { fuelLabelPl } from "../../lib/protocol-labels";
import { computeReturnDeltas } from "../../lib/protocol-delta";
import { formatFuelDelta, formatKmDriven, formatNewDamageCount } from "../../lib/return-form";
import { useResendEmail } from "../hooks/useResendEmail";
import type { ProtocolKind, ProtocolDamageType, ProtocolPhotoSlot } from "../../types";

// The read-only issue-protocol view (S-05 Phase 6). Reached from the dispatch
// list and from the conflict screen's `Otwórz protokół`. Its reason to exist is
// the dispute months later: a filed protocol must be reopenable, its PDF
// downloadable, and a failed email resendable long after the post-submit overlay
// is gone.
//
// Every object URL here is a short-TTL SIGNED url minted server-side in the page
// frontmatter — staff read storage under RLS with their JWT, but the customer
// never receives a bucket URL. This component only renders what it is handed.

export interface ProtocolViewPhoto {
  slot: ProtocolPhotoSlot;
  label: string;
  /** Signed URL, or null if the object could not be signed. */
  url: string | null;
}

export interface ProtocolViewDamage {
  id: string;
  type: ProtocolDamageType;
  typeLabel: string;
  location: string;
  size: string | null;
  /** Signed URLs for this item's photos. */
  photoUrls: string[];
  /**
   * The persisted existing/new decision (S-06 return rows): truthy ⇒ carried over
   * from a baseline item (`Istniejące`), falsy ⇒ new (`Nowe`). Always null on issue
   * rows, where the static tag is not rendered.
   */
  baselineDamageId?: string | null;
}

/**
 * One issue-baseline damage as the return view shows it read-only (S-06): the
 * `Uszkodzenia z protokołu wydania` reference list. No photos — the reference is a
 * label, mirroring the return form's baseline panel.
 */
export interface ProtocolViewBaselineDamage {
  id: string;
  typeLabel: string;
  location: string;
  size: string | null;
}

export interface ProtocolViewProps {
  protocolId: string;
  reference: string;
  customerName: string;
  customerEmail: string;
  vehicle: string;
  plate: string;
  pickupTime: string;
  odometerKm: number;
  fuelEighths: number;
  signedAt: string;
  customerAck: boolean;
  pdfPath: string | null;
  pdfUrl: string | null;
  deliveryStatus: string | null;
  signatureUrl: string | null;
  photos: ProtocolViewPhoto[];
  damages: ProtocolViewDamage[];
  // ── Return additions (S-06) — all optional; absent ⇒ the issue view, unchanged.
  /** `'return'` switches the title/back/PDF label and renders the comparison block. */
  kind?: ProtocolKind;
  /** The booking's fixed return hour for the context line (return rows). */
  returnTime?: string;
  /** The issue baseline the deltas are measured against; present ⇒ render the comparison summary. */
  comparison?: {
    baselineOdometerKm: number;
    baselineFuelEighths: number;
  };
  /** The issue damage list, shown read-only above the current damages on a return. */
  baselineDamages?: ProtocolViewBaselineDamage[];
}

function Section({
  n,
  title,
  action,
  className,
  children,
}: {
  n: number;
  title: string;
  action?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section className={cn("border-border bg-card shadow-card rounded-[16px] border p-5", className)}>
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="bg-foreground text-background flex size-6 items-center justify-center rounded-[8px] font-mono text-[12px] font-bold">
            {n}
          </span>
          <h2 className="text-foreground text-[15px] font-[650] tracking-tight">{title}</h2>
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

function Readout({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className="text-muted-foreground text-[11px] font-[650] tracking-[0.01em]">{label}</span>
      <div className="text-foreground mt-1 text-[27px] leading-none font-bold tracking-tight tabular-nums">{value}</div>
    </div>
  );
}

/**
 * A mono delta chip — neutral (km, unchanged) or `bad` (adverse fuel / new damage).
 * The same light chip the return form's condition cards use, so form and view agree.
 */
function DeltaChip({ text, bad }: { text: string; bad: boolean }) {
  return (
    <span
      className={cn(
        "shrink-0 rounded-[7px] px-2 py-0.5 font-mono text-[12.5px] font-bold tabular-nums",
        bad ? "text-primary bg-[var(--flota-danger-soft)]" : "text-foreground bg-[var(--flota-neutral-soft)]",
      )}
    >
      {text}
    </span>
  );
}

/**
 * One `label · chip` row of the comparison summary (S-06). The read-only view uses
 * the **dark** ink card — the same one the form and sent modals carry (design-contract
 * §3, "one dark variant everywhere"; R6 desktop) — so the label is light-on-ink and
 * bad values go `#FB9B9B`. The numbers come from the one pure `computeReturnDeltas`,
 * so all four surfaces read identically. (The condition footers keep the light chip.)
 */
function SummaryRow({ label, text, bad }: { label: string; text: string; bad: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-background/70 text-[13px] font-medium">{label}</span>
      <span
        className={cn(
          "shrink-0 rounded-[7px] bg-white/10 px-2 py-0.5 font-mono text-[12.5px] font-bold tabular-nums",
          bad ? "text-[#FB9B9B]" : "text-background",
        )}
      >
        {text}
      </span>
    </div>
  );
}

/**
 * The baseline-reference + delta footer under a return condition card (odometer /
 * fuel), mirroring the return form's condition cards: `Przy wydaniu <base>` on the
 * left, the live delta chip on the right. Rendered only on return rows.
 */
function CompareFoot({ base, text, bad }: { base: React.ReactNode; text: string; bad: boolean }) {
  return (
    <div className="border-border mt-3 flex items-center justify-between gap-2 border-t pt-3">
      <span className="text-muted-foreground text-[12px]">Przy wydaniu {base}</span>
      <DeltaChip text={text} bad={bad} />
    </div>
  );
}

const FUEL_SEGMENTS = [1, 2, 3, 4, 5, 6, 7, 8];

function formatSignedAt(signedAt: string): string {
  const date = new Date(signedAt);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  // `client:load` SSRs this on workerd (UTC) then hydrates in the browser (local
  // zone), so the time MUST be pinned to a fixed zone — otherwise the two renders
  // disagree and React throws a hydration mismatch. Europe/Warsaw = the company's
  // zone; the pl-PL date part already agrees across workerd/browser ICU, only the
  // timezone drifted. `pl-PL`, day + short time, e.g. "10 lip 2026, 14:08".
  return new Intl.DateTimeFormat("pl-PL", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Warsaw",
  }).format(date);
}

export default function ProtocolView(props: ProtocolViewProps) {
  const { busy, resend } = useResendEmail();
  const [deliveryStatus, setDeliveryStatus] = React.useState<string | null>(props.deliveryStatus);
  const [error, setError] = React.useState<string | null>(null);

  const badge = deliveryBadge(props.pdfPath, deliveryStatus);
  const canResend = Boolean(props.pdfPath) && badge.tone !== "ok";

  // ── Return-view specifics (S-06). Absent `kind` ⇒ the issue view, unchanged. ──
  const isReturn = props.kind === "return";
  const title = isReturn ? "Protokół zwrotu" : "Protokół wydania";
  const backHref = isReturn ? "/dashboard/returns" : "/dashboard/pickups";
  const backLabel = isReturn ? "Wróć do zwrotów" : "Wróć do wydań";
  const contextLabel = isReturn ? "Zwrot" : "Odbiór";
  const contextTime = isReturn ? (props.returnTime ?? "10:00") : props.pickupTime;
  const pdfFilename = `protokol-${isReturn ? "zwrotu" : "wydania"}-${props.reference}.pdf`;

  // The comparison summary — computed by the SAME pure `computeReturnDeltas` the form,
  // the PDF and the email use, so all four surfaces render identical numbers. The
  // new-damage count comes from each row's persisted `baselineDamageId`, not a re-derivation.
  // `comparison` is captured as a local so the condition-card footers narrow it without a `!`.
  const comparison = props.comparison;
  const deltas = comparison
    ? computeReturnDeltas(
        { odometerKm: comparison.baselineOdometerKm, fuelEighths: comparison.baselineFuelEighths },
        {
          odometerKm: props.odometerKm,
          fuelEighths: props.fuelEighths,
          damages: props.damages.map((d) => ({ baselineDamageId: d.baselineDamageId })),
        },
      )
    : null;

  const handleResend = React.useCallback(async () => {
    setError(null);
    const outcome = await resend(props.protocolId);
    if (outcome.status === "sent") {
      setDeliveryStatus("sent");
      return;
    }
    setError(
      outcome.status === "no_pdf"
        ? "Brak zapisanego PDF — wygeneruj go ponownie."
        : "Nie udało się wysłać. Spróbuj ponownie.",
    );
  }, [props.protocolId, resend]);

  // ── Shared building blocks ────────────────────────────────────────────────────

  // Header icon button — the return view's form-style header (S-06). Circular +
  // soft shadow on mobile, rounded-square + border on desktop (user decision
  // 2026-07-20). The issue view keeps its text back-link, so this is return-only.
  const iconBtn =
    "bg-card text-foreground hover:bg-background flex size-10 shrink-0 items-center justify-center rounded-full shadow-card sm:rounded-[11px] sm:border sm:border-border sm:shadow-none";

  const pdfButton = props.pdfUrl ? (
    <Button asChild variant="outline" className="h-10">
      <a href={props.pdfUrl} target="_blank" rel="noopener noreferrer" download={pdfFilename}>
        <Download className="size-4" />
        Pobierz PDF
      </a>
    </Button>
  ) : null;

  const resendButton = canResend ? (
    <Button
      type="button"
      disabled={busy}
      aria-busy={busy}
      onClick={handleResend}
      className="bg-foreground text-background hover:bg-foreground/90 h-10"
    >
      {busy ? (
        <>
          <span className="border-background/30 border-t-background size-4 animate-spin rounded-full border-2" />
          Wysyłanie…
        </>
      ) : (
        <>
          <RefreshCw className="size-4" />
          Wyślij ponownie
        </>
      )}
    </Button>
  ) : null;

  // The four read-only sections — identical content in both layouts; only the outer
  // arrangement differs (issue: single column; return: two-column, sections placed by
  // `order-*` so a mobile `display:contents` interleave stays 1·2·3·4·summary). The
  // return-only bits inside (`comparison`, `isReturn`) are false on an issue row.
  const sectionCondition = (
    <Section n={1} title="Stan techniczny" className="order-1">
      <div className="grid grid-cols-2 gap-5">
        {/* Odometer — current readout + (return only) the baseline reference + km-driven delta. */}
        <div>
          <Readout label="Licznik" value={`${props.odometerKm.toLocaleString("pl-PL")} km`} />
          {comparison && deltas && (
            <CompareFoot
              base={
                <>
                  <span className="text-foreground font-mono font-semibold">
                    {comparison.baselineOdometerKm.toLocaleString("pl-PL")}
                  </span>{" "}
                  km
                </>
              }
              text={formatKmDriven(deltas.kmDriven)}
              bad={false}
            />
          )}
        </div>
        <div>
          <span className="text-muted-foreground text-[11px] font-[650] tracking-[0.01em]">Poziom paliwa</span>
          <div className="text-foreground mt-1 text-[27px] leading-none font-bold tracking-tight tabular-nums">
            {fuelLabelPl(props.fuelEighths)}
          </div>
          <div className="mt-2 flex gap-[3px]">
            {FUEL_SEGMENTS.map((i) => (
              <span
                key={i}
                className={cn(
                  "h-[22px] flex-1 rounded-[4px]",
                  props.fuelEighths >= i ? "bg-foreground" : "bg-[var(--flota-hair-2)]",
                )}
              />
            ))}
          </div>
          {/* Fuel baseline reference + change delta (return only). */}
          {comparison && deltas && (
            <CompareFoot
              base={<span className="text-foreground font-mono font-semibold">{comparison.baselineFuelEighths}/8</span>}
              text={formatFuelDelta(deltas.fuelDelta)}
              bad={deltas.flags.fuelAdverse}
            />
          )}
        </div>
      </div>
    </Section>
  );

  const sectionPhotos = (
    <Section
      n={2}
      title="Zdjęcia pojazdu"
      className="order-2"
      action={<span className="text-muted-foreground font-mono text-[12px] font-bold">{props.photos.length}/6</span>}
    >
      <div className="grid grid-cols-3 gap-2">
        {props.photos.map((photo) => (
          <figure key={photo.slot}>
            <div className="bg-muted relative aspect-square overflow-hidden rounded-[10px]">
              {photo.url ? (
                <img src={photo.url} alt={photo.label} className="size-full object-cover" />
              ) : (
                <div className="text-muted-foreground flex size-full items-center justify-center text-[11px]">Brak</div>
              )}
            </div>
            <figcaption className="text-muted-foreground mt-1 text-[10px] font-semibold tracking-wide uppercase">
              {photo.label}
            </figcaption>
          </figure>
        ))}
      </div>
    </Section>
  );

  const sectionDamage = (
    <Section n={3} title="Uszkodzenia" className="order-3">
      {/* Baseline reference (return rows) — the issue damage list, read-only,
          mirroring the return form's `Uszkodzenia z protokołu wydania` panel. */}
      {isReturn && props.baselineDamages && props.baselineDamages.length > 0 && (
        <div className="border-border bg-background mb-3 rounded-[14px] border p-3.5">
          <p className="text-muted-foreground mb-2 text-[11px] font-[650] tracking-[0.01em] uppercase">
            Uszkodzenia z protokołu wydania
          </p>
          <div className="flex flex-col gap-1.5">
            {props.baselineDamages.map((baseline) => (
              <div key={baseline.id} className="flex items-center justify-between gap-2">
                <span className="text-foreground min-w-0 truncate text-[13px]">
                  {baseline.typeLabel} — {baseline.location}
                  {baseline.size ? ` (${baseline.size})` : ""}
                </span>
                <span className="text-muted-foreground shrink-0 rounded-[7px] bg-[var(--flota-neutral-soft)] px-2 py-0.5 text-[11px] font-bold tracking-[0.04em] uppercase">
                  Istniejące
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {props.damages.length === 0 ? (
        <p className="text-muted-foreground text-[13px]">
          {isReturn ? "Nie dodano nowych uszkodzeń." : "Brak uszkodzeń."}
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {props.damages.map((damage) => {
            // On return rows, the persisted `baselineDamageId` is the static tag:
            // truthy ⇒ carried over (`Istniejące`), falsy ⇒ new (`Nowe`). Issue rows
            // carry no tag, so the row renders exactly as it did in S-05.
            const existing = Boolean(damage.baselineDamageId);
            return (
              <li key={damage.id} className="border-border rounded-[12px] border p-3">
                <div className={cn(isReturn && "flex items-start justify-between gap-2")}>
                  <div className="text-foreground text-[14px] font-semibold tracking-tight">
                    {damage.typeLabel} — {damage.location}
                    {damage.size ? ` (${damage.size})` : ""}
                  </div>
                  {isReturn && (
                    <span
                      className={cn(
                        "shrink-0 rounded-[7px] px-2 py-0.5 text-[11px] font-bold tracking-[0.04em] uppercase",
                        existing
                          ? "text-muted-foreground bg-[var(--flota-neutral-soft)]"
                          : "text-primary bg-[var(--flota-danger-soft)]",
                      )}
                    >
                      {existing ? "Istniejące" : "Nowe"}
                    </span>
                  )}
                </div>
                {damage.photoUrls.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {damage.photoUrls.map((url, i) => (
                      <img
                        key={url}
                        src={url}
                        alt={`${damage.typeLabel} — zdjęcie ${i + 1}`}
                        className="size-16 rounded-[8px] object-cover"
                      />
                    ))}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </Section>
  );

  const sectionSignature = (
    <Section n={4} title="Podpis" className="order-4">
      <div className="flex items-center gap-2 text-[13px]">
        <span
          className={cn(
            "flex size-5 items-center justify-center rounded-full",
            props.customerAck ? "text-success bg-[var(--flota-success-soft)]" : "text-muted-foreground bg-muted",
          )}
        >
          <Check className="size-3.5" />
        </span>
        <span className="text-foreground">Klient potwierdził stan pojazdu i warunki najmu.</span>
      </div>
      <div className="border-border bg-background mt-3 rounded-[12px] border p-3">
        {props.signatureUrl ? (
          <img src={props.signatureUrl} alt="Podpis klienta" className="h-32 w-full object-contain" />
        ) : (
          <div className="text-muted-foreground flex h-32 items-center justify-center text-[13px]">Brak podpisu</div>
        )}
      </div>
      <p className="text-muted-foreground mt-2 text-[12px]">
        Podpisał(a) {props.customerName} · {formatSignedAt(props.signedAt)}
      </p>
    </Section>
  );

  // The comparison summary — the DARK ink card (return only), the same variant the
  // form + sent modals carry (design-contract §3; R6 desktop). `order-last` drops it
  // to the bottom of the right column (desktop) / the scroll (mobile).
  const darkSummary = deltas ? (
    <section className="bg-foreground shadow-card order-last rounded-[16px] p-5 sm:p-[22px]">
      <h2 className="text-background/70 text-[11px] font-bold tracking-[0.06em] uppercase">
        Porównanie wydanie → zwrot
      </h2>
      <div className="mt-3 flex flex-col gap-2.5">
        <SummaryRow label="Przejechano" text={formatKmDriven(deltas.kmDriven)} bad={false} />
        <SummaryRow label="Zmiana paliwa" text={formatFuelDelta(deltas.fuelDelta)} bad={deltas.flags.fuelAdverse} />
        <SummaryRow
          label="Nowe uszkodzenia"
          text={formatNewDamageCount(deltas.newDamageCount)}
          bad={deltas.flags.damageAdverse}
        />
      </div>
    </section>
  ) : null;

  // ── Return view (S-06) — form-style header, delivery row, two-column body (R6). ─
  if (isReturn) {
    return (
      <main className="mx-auto w-full max-w-[1180px] px-4 py-6">
        {/* Form-style header — back ‹ / title + context / close × (circular buttons). */}
        <div className="border-border bg-card shadow-card mb-4 flex items-center justify-between gap-3 rounded-[16px] border px-4 py-3.5 sm:px-6">
          <a href={backHref} aria-label="Wróć" className={iconBtn}>
            <ArrowLeft className="size-[18px]" />
          </a>
          <div className="min-w-0 text-center sm:text-left">
            <h1 className="text-foreground truncate text-[17px] font-bold tracking-tight">{title}</h1>
            <p className="text-muted-foreground truncate text-[12px]">
              <span className="font-mono">{props.reference}</span> · {props.customerName} · {props.vehicle} ·{" "}
              <span className="font-mono">{props.plate}</span> · {contextLabel} {contextTime}
            </p>
          </div>
          <a href={backHref} aria-label="Zamknij" className={iconBtn}>
            <X className="size-[18px]" />
          </a>
        </div>

        {/* Delivery + actions row — badge + recipient left, resend + PDF right. */}
        <div className="border-border bg-card shadow-card mb-4 rounded-[16px] border p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-center gap-2.5">
              <DeliveryBadge pdfPath={props.pdfPath} deliveryStatus={deliveryStatus} />
              <span className="text-muted-foreground truncate text-[13px]">{props.customerEmail}</span>
            </div>
            {(resendButton !== null || pdfButton !== null) && (
              <div className="flex flex-wrap gap-2.5">
                {resendButton}
                {pdfButton}
              </div>
            )}
          </div>
          {error && <p className="text-primary mt-2 text-[12px] font-medium">{error}</p>}
        </div>

        {/* Two-column: condition + damage left, photos + signature + summary right.
            On mobile the wrappers are `display:contents`, so the sections interleave
            in numeric order via `order-*` (as on the form). */}
        <div className="flex flex-col gap-4 lg:grid lg:grid-cols-[1.35fr_1fr] lg:items-start lg:gap-6">
          <div className="contents lg:flex lg:min-w-0 lg:flex-col lg:gap-4">
            {sectionCondition}
            {sectionDamage}
          </div>
          <div className="contents lg:flex lg:min-w-0 lg:flex-col lg:gap-4">
            {darkSummary}
            {sectionPhotos}
            {sectionSignature}
          </div>
        </div>
      </main>
    );
  }

  // ── Issue view (S-05) — unchanged: text back-link, header card, single column. ──
  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-6">
      <a
        href={backHref}
        className="text-muted-foreground hover:text-foreground mb-4 inline-flex items-center gap-1.5 text-[13px] font-semibold"
      >
        <ArrowLeft className="size-4" />
        {backLabel}
      </a>

      {/* Header */}
      <div className="border-border bg-card shadow-card mb-4 rounded-[16px] border p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-foreground text-[21px] font-bold tracking-tight">{title}</h1>
            <p className="text-muted-foreground mt-1 text-[13px]">
              <span className="font-mono">{props.reference}</span> · {props.customerName} · {props.vehicle} ·{" "}
              <span className="font-mono">{props.plate}</span> · {contextLabel} {contextTime}
            </p>
          </div>
          <DeliveryBadge pdfPath={props.pdfPath} deliveryStatus={deliveryStatus} />
        </div>

        {(pdfButton !== null || resendButton !== null) && (
          <div className="mt-4 flex flex-wrap gap-2.5">
            {pdfButton}
            {resendButton}
          </div>
        )}
        {error && <p className="text-primary mt-2 text-[12px] font-medium">{error}</p>}
      </div>

      <div className="flex flex-col gap-4">
        {sectionCondition}
        {sectionPhotos}
        {sectionDamage}
        {sectionSignature}
      </div>
    </main>
  );
}
