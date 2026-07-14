// core
import * as React from "react";
import { Check, Download, TriangleAlert } from "lucide-react";

// components
import { Button } from "../ui/button";

// others
import { cn } from "../../lib/utils";

// The three post-submit overlays and the conflict screen. Bottom sheet on mobile,
// centred 460px modal on desktop — the same shell as the damage editor.
//
// Every variant says "Protokół zapisany" first, because in all three the handover
// has already committed. That is the whole point of the commit-then-best-effort
// ordering: the vehicle physically changed hands, and a provider 503 or a thrown
// PDF build must read as a recoverable follow-up, never as a failed handover.
//
//   sent  — committed, PDF stored, mail delivered.
//   email — committed, PDF stored, the send failed. Resend now or from the dispatch list.
//   pdf   — committed, but the PDF never generated or never uploaded, so no send
//           was attempted. Regenerate; there is nothing to resend.

export type OverlayVariant = "sent" | "email" | "pdf";

type Tone = "ok" | "warn" | "bad";

const TONE: Record<Tone, string> = {
  ok: "text-success bg-[var(--flota-success-soft)]",
  warn: "text-warning bg-[var(--flota-warning-soft)]",
  bad: "text-primary bg-[var(--flota-danger-soft)]",
};

function Badge({ tone, children }: { tone: Tone; children: React.ReactNode }) {
  return <span className={cn("rounded-[7px] px-2.5 py-1 text-[11.5px] font-bold", TONE[tone])}>{children}</span>;
}

interface Copy {
  tone: Tone;
  icon: React.ReactNode;
  title: string;
  sub: string;
  badges: { tone: Tone; label: string }[];
  primary: string;
  secondary?: string;
}

const COPY: Record<OverlayVariant, Copy> = {
  sent: {
    tone: "ok",
    icon: <Check className="size-7" />,
    title: "Protokół wysłany",
    sub: "Wysłany do klienta i zapisany jako PDF.",
    badges: [
      { tone: "ok", label: "Protokół zapisany" },
      { tone: "ok", label: "Dostarczono" },
    ],
    primary: "Gotowe",
  },
  email: {
    tone: "bad",
    icon: <TriangleAlert className="size-7" />,
    title: "Nie udało się wysłać e-maila",
    sub: "Protokół jest zapisany i podpisany. Możesz wysłać ponownie teraz lub później.",
    badges: [
      { tone: "ok", label: "Protokół zapisany" },
      { tone: "bad", label: "E-mail niewysłany" },
    ],
    primary: "Wyślij ponownie",
    secondary: "Później",
  },
  pdf: {
    tone: "warn",
    icon: <TriangleAlert className="size-7" />,
    title: "Nie udało się wygenerować PDF",
    sub: "Protokół został zapisany. Wygeneruj PDF ponownie, aby wysłać klientowi.",
    badges: [
      { tone: "ok", label: "Protokół zapisany" },
      { tone: "warn", label: "Błąd PDF" },
    ],
    primary: "Spróbuj ponownie",
    secondary: "Później",
  },
};

function Sheet({ children }: { children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <div className="bg-foreground/40 absolute inset-0" />
      <div
        role="dialog"
        aria-modal="true"
        className="bg-card shadow-overlay relative w-full rounded-t-[28px] p-6 pb-8 text-center sm:max-w-[460px] sm:rounded-[18px] sm:pb-6"
      >
        {children}
      </div>
    </div>
  );
}

export function ResultOverlay({
  variant,
  customerEmail,
  busy,
  pdfHref,
  pdfFilename,
  onPrimary,
  onSecondary,
}: {
  variant: OverlayVariant;
  customerEmail: string;
  busy: boolean;
  /** Object URL of the just-built PDF, if one exists this session. Absent on the `pdf` variant. */
  pdfHref?: string | null;
  pdfFilename?: string;
  onPrimary: () => void;
  onSecondary: () => void;
}) {
  const copy = COPY[variant];
  // Offer the in-session download wherever a PDF was actually produced (`sent` /
  // `email`). The `pdf` variant is the one where generation failed — nothing to
  // download, so the button stays absent there rather than linking to a stale blob.
  const canDownload = variant !== "pdf" && Boolean(pdfHref);
  return (
    <Sheet>
      <span className={cn("mx-auto flex size-16 items-center justify-center rounded-full", TONE[copy.tone])}>
        {copy.icon}
      </span>
      <h2 className="text-foreground mt-4 text-[21px] font-bold tracking-tight">{copy.title}</h2>
      <p className="text-muted-foreground mt-1.5 text-[13px]">{copy.sub}</p>
      {/* Only the `email` variant attempted (and failed) a send, so only it names
          the recipient — as "not sent", matching the badge. The `pdf` variant never
          reached the send step, so it shows no recipient line at all. */}
      {variant === "email" && <p className="text-muted-foreground mt-1 text-[12px]">Nie wysłano do {customerEmail}</p>}

      <div className="mt-4 flex flex-wrap justify-center gap-2">
        {copy.badges.map((badge) => (
          <Badge key={badge.label} tone={badge.tone}>
            {badge.label}
          </Badge>
        ))}
      </div>

      <div className="mt-6 flex flex-col gap-2.5">
        <Button
          type="button"
          disabled={busy}
          aria-busy={busy}
          onClick={onPrimary}
          className="bg-foreground text-background hover:bg-foreground/90 h-12 w-full"
        >
          {busy ? (
            <>
              <span className="border-background/30 border-t-background size-4 animate-spin rounded-full border-2" />
              Wysyłanie…
            </>
          ) : (
            copy.primary
          )}
        </Button>
        {canDownload && (
          <Button asChild variant="outline" className="h-11 w-full">
            <a href={pdfHref ?? undefined} download={pdfFilename}>
              <Download className="size-4" />
              Pobierz PDF
            </a>
          </Button>
        )}
        {copy.secondary && (
          <Button type="button" variant="ghost" disabled={busy} onClick={onSecondary} className="h-11 w-full">
            {copy.secondary}
          </Button>
        )}
      </div>
    </Sheet>
  );
}

/**
 * `create_protocol` answered `conflict`: this reservation already has a protocol,
 * and `unique (reservation_id)` guarantees it always will. Two employees tapping
 * at once produce one protocol and this screen, not a race and a 500.
 */
export function ConflictScreen({
  reference,
  plate,
  protocolId,
}: {
  reference: string;
  plate: string;
  protocolId: string;
}) {
  return (
    <div className="mx-auto flex min-h-screen max-w-[460px] flex-col justify-center px-5 py-10 text-center">
      <span className={cn("mx-auto flex size-16 items-center justify-center rounded-full", TONE.warn)}>
        <TriangleAlert className="size-7" />
      </span>
      <h1 className="text-foreground mt-4 text-[21px] font-bold tracking-tight">Protokół już istnieje</h1>
      <p className="text-muted-foreground mt-1.5 text-[13px]">
        Dla tej rezerwacji wydano już protokół — każde wydanie może mieć tylko jeden.
      </p>

      <div className="border-border bg-card shadow-card mt-5 flex items-center justify-between gap-3 rounded-[14px] border p-4">
        <span className="text-foreground text-[14px] font-semibold tracking-tight">
          {reference} · <span className="font-mono">{plate}</span>
        </span>
        <Badge tone="ok">Protokół zapisany</Badge>
      </div>

      <div className="mt-6 flex flex-col gap-2.5">
        <Button asChild className="bg-foreground text-background hover:bg-foreground/90 h-12 w-full">
          <a href={`/dashboard/protocols/${protocolId}`}>Otwórz protokół</a>
        </Button>
        <Button asChild variant="ghost" className="h-11 w-full">
          <a href="/dashboard/pickups">Wróć do pulpitu</a>
        </Button>
      </div>
    </div>
  );
}
