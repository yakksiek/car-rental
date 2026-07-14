// core
import * as React from "react";
import { Check, PenLine, X } from "lucide-react";

// components
import { Button } from "../ui/button";

// others
import { cn } from "../../lib/utils";

// Signature capture (S-05 Phase 5), as a full-screen signing modal rather than an
// inline pad. Two reasons this beats the inline canvas on a phone:
//
//  * Scroll lock. An inline canvas can use `touch-action: none` for strokes that
//    land on it, but a customer's first stroke that lands a few pixels above it
//    scrolls the page instead. A modal with the body locked removes that entirely.
//  * A real signing surface. The person signing is the customer, not a trained
//    employee, and 140px inside a form column is a poor target.
//
// The canvas lives ONLY inside the modal, so the clear-vs-async-upload race the
// inline pad suffered cannot occur: a signature is committed by an explicit
// `Zatwierdź`, or it is not committed at all.
//
// Deviation from the distilled design contract (which specified an inline pad),
// taken deliberately at the user's request; recorded in change.md.

interface FieldProps {
  /** null until a signature is committed. Set by the parent once the PNG has uploaded. */
  signedAt: string | null;
  customerName: string;
  invalid?: boolean;
  /** Upload the committed PNG; resolves `true` on success. The parent owns storage + `signed_at`. */
  onSigned: (png: Blob) => Promise<boolean>;
}

function signedTimePl(signedAt: string): string {
  return new Date(signedAt).toLocaleTimeString("pl-PL", { hour: "2-digit", minute: "2-digit" });
}

/** The inline Section-4 control: a prompt button when empty, a summary once signed. */
export function SignatureField({ signedAt, customerName, invalid, onSigned }: FieldProps) {
  const [open, setOpen] = React.useState(false);

  return (
    <div className="flex flex-col gap-2">
      <span className="text-muted-foreground text-[11px] font-[650] tracking-[0.01em]">Podpis</span>

      {signedAt ? (
        <div className="border-border bg-card shadow-card flex items-center justify-between gap-3 rounded-[14px] border p-4">
          <span className="text-success flex items-center gap-2 text-[13px] font-semibold">
            <Check className="size-4 shrink-0" />
            Podpisał(a) {customerName} · o {signedTimePl(signedAt)}
          </span>
          <button
            type="button"
            onClick={() => {
              setOpen(true);
            }}
            className="text-primary shrink-0 text-[12px] font-semibold"
          >
            Zmień
          </button>
        </div>
      ) : (
        <>
          <button
            type="button"
            id="signaturePath"
            onClick={() => {
              setOpen(true);
            }}
            aria-invalid={invalid ?? undefined}
            className={cn(
              "flex flex-col items-center justify-center gap-1.5 rounded-[14px] border border-dashed px-4 py-7 transition-colors",
              invalid
                ? "border-primary bg-[var(--flota-danger-soft)]"
                : "bg-card hover:bg-background border-[var(--flota-hair)]",
            )}
          >
            <PenLine className="text-muted-foreground size-5" />
            <span className="text-foreground text-[13px] font-semibold">Poproś klienta o podpis</span>
            <span className="text-muted-foreground text-[12px]">Otwórz pełny ekran podpisu</span>
          </button>
          {invalid && <p className="text-destructive text-sm font-medium">Wymagany podpis</p>}
        </>
      )}

      {open && (
        <SignatureModal
          onConfirm={onSigned}
          onClose={() => {
            setOpen(false);
          }}
        />
      )}
    </div>
  );
}

/** Cap the backing-store scale: retina crispness without a needlessly large PNG. */
const MAX_DPR = 2;

interface ModalProps {
  onConfirm: (png: Blob) => Promise<boolean>;
  onClose: () => void;
}

function SignatureModal({ onConfirm, onClose }: ModalProps) {
  const canvasRef = React.useRef<HTMLCanvasElement | null>(null);
  const drawing = React.useRef(false);
  const dpr = React.useRef(1);
  const [hasInk, setHasInk] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // Lock the page behind the sheet, and close on Escape (desktop).
  React.useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  // Size the backing store to the laid-out canvas × DPR, so strokes are crisp and
  // undistorted regardless of the sheet's dimensions.
  React.useLayoutEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }
    const rect = canvas.getBoundingClientRect();
    const scale = Math.min(window.devicePixelRatio || 1, MAX_DPR);
    dpr.current = scale;
    canvas.width = Math.round(rect.width * scale);
    canvas.height = Math.round(rect.height * scale);
  }, []);

  const point = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return null;
    }
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((event.clientX - rect.left) / rect.width) * canvas.width,
      y: ((event.clientY - rect.top) / rect.height) * canvas.height,
    };
  };

  const context = () => {
    const ctx = canvasRef.current?.getContext("2d");
    if (ctx) {
      ctx.strokeStyle = "#0F172A";
      ctx.lineWidth = 2.4 * dpr.current;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
    }
    return ctx;
  };

  function handleDown(event: React.PointerEvent<HTMLCanvasElement>) {
    const at = point(event);
    const ctx = context();
    if (!at || !ctx) {
      return;
    }
    event.currentTarget.setPointerCapture(event.pointerId);
    drawing.current = true;
    ctx.beginPath();
    ctx.moveTo(at.x, at.y);
  }

  function handleMove(event: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawing.current) {
      return;
    }
    const at = point(event);
    const ctx = context();
    if (!at || !ctx) {
      return;
    }
    ctx.lineTo(at.x, at.y);
    ctx.stroke();
    setHasInk(true);
  }

  function handleUp() {
    drawing.current = false;
  }

  function clearCanvas() {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (canvas && ctx) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
    setHasInk(false);
    setError(null);
  }

  function confirm() {
    const canvas = canvasRef.current;
    if (!canvas || !hasInk) {
      return;
    }
    setBusy(true);
    setError(null);
    canvas.toBlob((blob) => {
      if (!blob) {
        setBusy(false);
        setError("Nie udało się odczytać podpisu. Spróbuj ponownie.");
        return;
      }
      // The signature canvas is the one blob the island mints itself, so it must
      // carry `image/png` explicitly — the bucket rejects an untyped blob as
      // `application/octet-stream`. `toBlob(_, "image/png")` already types it.
      void onConfirm(blob).then((ok) => {
        setBusy(false);
        if (ok) {
          onClose();
        } else {
          setError("Nie udało się zapisać podpisu. Spróbuj ponownie.");
        }
      });
    }, "image/png");
  }

  return (
    <div className="sm:bg-foreground/40 fixed inset-0 z-50 flex flex-col sm:items-center sm:justify-center">
      <div className="bg-card shadow-overlay flex h-full w-full flex-col sm:h-[540px] sm:max-w-[600px] sm:rounded-[18px]">
        <header className="border-border flex items-center justify-between border-b px-4 py-3.5">
          <h2 className="text-foreground text-[16px] font-bold tracking-tight">Podpis klienta</h2>
          <button
            type="button"
            aria-label="Zamknij"
            onClick={onClose}
            className="border-border bg-card text-foreground hover:bg-background flex size-9 items-center justify-center rounded-[10px] border"
          >
            <X className="size-[18px]" />
          </button>
        </header>

        <p className="text-muted-foreground px-4 pt-3 text-[13px]">Poproś klienta, aby podpisał się w polu poniżej.</p>

        <div className="relative min-h-0 flex-1 p-4">
          <canvas
            ref={canvasRef}
            tabIndex={-1}
            aria-label="Pole podpisu klienta"
            style={{ touchAction: "none" }}
            className="border-border bg-card size-full rounded-[14px] border border-dashed"
            onPointerDown={handleDown}
            onPointerMove={handleMove}
            onPointerUp={handleUp}
            onPointerCancel={handleUp}
          />
          {!hasInk && (
            <p className="text-muted-foreground pointer-events-none absolute inset-0 flex items-center justify-center text-[13px]">
              Rysuj palcem, myszką lub gładzikiem
            </p>
          )}
        </div>

        {error && <p className="text-destructive px-4 text-sm font-medium">{error}</p>}

        <footer className="border-border flex items-center gap-2.5 border-t px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <Button
            type="button"
            variant="outline"
            className="h-11 flex-1"
            disabled={!hasInk || busy}
            onClick={clearCanvas}
          >
            Wyczyść
          </Button>
          <Button
            type="button"
            className="bg-foreground text-background hover:bg-foreground/90 h-11 flex-[2]"
            disabled={!hasInk || busy}
            aria-busy={busy}
            onClick={confirm}
          >
            {busy ? (
              <>
                <span className="border-background/30 border-t-background size-4 animate-spin rounded-full border-2" />
                Zapisywanie…
              </>
            ) : (
              <>
                <Check className="size-4" />
                Zatwierdź podpis
              </>
            )}
          </Button>
        </footer>
      </div>
    </div>
  );
}
