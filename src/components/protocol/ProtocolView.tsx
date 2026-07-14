// core
import * as React from "react";
import { ArrowLeft, Check, Download, RefreshCw } from "lucide-react";

// components
import { Button } from "../ui/button";
import { DeliveryBadge, deliveryBadge } from "./DeliveryBadge";

// others
import { cn } from "../../lib/utils";
import { fuelLabelPl } from "../../lib/protocol-labels";
import { useResendEmail } from "../hooks/useResendEmail";
import type { ProtocolDamageType, ProtocolPhotoSlot } from "../../types";

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
}

function Section({
  n,
  title,
  action,
  children,
}: {
  n: number;
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="border-border bg-card shadow-card rounded-[18px] border p-5">
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

const FUEL_SEGMENTS = [1, 2, 3, 4, 5, 6, 7, 8];

function formatSignedAt(signedAt: string): string {
  const date = new Date(signedAt);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  // Client island → full ICU. `pl-PL`, day + short time, e.g. "10 lip 2026, 14:08".
  return new Intl.DateTimeFormat("pl-PL", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export default function ProtocolView(props: ProtocolViewProps) {
  const { busy, resend } = useResendEmail();
  const [deliveryStatus, setDeliveryStatus] = React.useState<string | null>(props.deliveryStatus);
  const [error, setError] = React.useState<string | null>(null);

  const badge = deliveryBadge(props.pdfPath, deliveryStatus);
  const canResend = Boolean(props.pdfPath) && badge.tone !== "ok";

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

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-6">
      <a
        href="/dashboard/pickups"
        className="text-muted-foreground hover:text-foreground mb-4 inline-flex items-center gap-1.5 text-[13px] font-semibold"
      >
        <ArrowLeft className="size-4" />
        Wróć do wydań
      </a>

      {/* Header */}
      <div className="border-border bg-card shadow-card mb-4 rounded-[18px] border p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-foreground text-[21px] font-bold tracking-tight">Protokół wydania</h1>
            <p className="text-muted-foreground mt-1 text-[13px]">
              <span className="font-mono">{props.reference}</span> · {props.customerName} · {props.vehicle} ·{" "}
              <span className="font-mono">{props.plate}</span> · Odbiór {props.pickupTime}
            </p>
          </div>
          <DeliveryBadge pdfPath={props.pdfPath} deliveryStatus={deliveryStatus} />
        </div>

        <div className="mt-4 flex flex-wrap gap-2.5">
          {props.pdfUrl && (
            <Button asChild variant="outline" className="h-10">
              <a
                href={props.pdfUrl}
                target="_blank"
                rel="noopener noreferrer"
                download={`protokol-wydania-${props.reference}.pdf`}
              >
                <Download className="size-4" />
                Pobierz PDF
              </a>
            </Button>
          )}
          {canResend && (
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
          )}
        </div>
        {error && <p className="text-primary mt-2 text-[12px] font-medium">{error}</p>}
      </div>

      <div className="flex flex-col gap-4">
        {/* 1 — Stan techniczny */}
        <Section n={1} title="Stan techniczny">
          <div className="grid grid-cols-2 gap-5">
            <Readout label="Licznik" value={`${props.odometerKm.toLocaleString("pl-PL")} km`} />
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
            </div>
          </div>
        </Section>

        {/* 2 — Zdjęcia pojazdu */}
        <Section
          n={2}
          title="Zdjęcia pojazdu"
          action={
            <span className="text-muted-foreground font-mono text-[12px] font-bold">{props.photos.length}/6</span>
          }
        >
          <div className="grid grid-cols-3 gap-2">
            {props.photos.map((photo) => (
              <figure key={photo.slot}>
                <div className="bg-muted relative aspect-square overflow-hidden rounded-[10px]">
                  {photo.url ? (
                    <img src={photo.url} alt={photo.label} className="size-full object-cover" />
                  ) : (
                    <div className="text-muted-foreground flex size-full items-center justify-center text-[11px]">
                      Brak
                    </div>
                  )}
                </div>
                <figcaption className="text-muted-foreground mt-1 text-[10px] font-semibold tracking-wide uppercase">
                  {photo.label}
                </figcaption>
              </figure>
            ))}
          </div>
        </Section>

        {/* 3 — Uszkodzenia */}
        <Section n={3} title="Uszkodzenia">
          {props.damages.length === 0 ? (
            <p className="text-muted-foreground text-[13px]">Brak uszkodzeń.</p>
          ) : (
            <ul className="flex flex-col gap-3">
              {props.damages.map((damage) => (
                <li key={damage.id} className="border-border rounded-[12px] border p-3">
                  <div className="text-foreground text-[14px] font-semibold tracking-tight">
                    {damage.typeLabel} — {damage.location}
                    {damage.size ? ` (${damage.size})` : ""}
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
              ))}
            </ul>
          )}
        </Section>

        {/* 4 — Podpis */}
        <Section n={4} title="Podpis">
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
              <div className="text-muted-foreground flex h-32 items-center justify-center text-[13px]">
                Brak podpisu
              </div>
            )}
          </div>
          <p className="text-muted-foreground mt-2 text-[12px]">
            Podpisał(a) {props.customerName} · {formatSignedAt(props.signedAt)}
          </p>
        </Section>
      </div>
    </main>
  );
}
