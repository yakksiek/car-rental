// core
import * as React from "react";
import { Camera, Check, TriangleAlert } from "lucide-react";

// others
import { cn } from "../../lib/utils";
import type { UploadState } from "./types";

// One baseline photo tile, in four states: empty / uploading / failed / done.
//
// `accept="image/*"` and deliberately NOT `image/heic` — Safari has been observed
// converting uploads *to* HEIC when the type is listed, and Chrome/Firefox cannot
// draw a HEIC to canvas at all (see `src/lib/media/heic.ts`). `capture="environment"`
// opens the rear camera on a phone and is ignored on desktop.

interface Props {
  slot: string;
  label: string;
  state: UploadState;
  /** Coarse progress: compression, then upload. `storage-js` reports no byte-level progress. */
  pct: number;
  /** Object URL of the compressed JPEG, once uploaded. */
  preview?: string;
  invalid?: boolean;
  onPick: (file: File) => void;
  onRetry: () => void;
}

const TILE = "relative flex aspect-square w-full flex-col items-center justify-center gap-1.5 rounded-[14px]";
const LABEL = "text-[10px] font-bold tracking-[0.08em] uppercase";

export function PhotoSlot({ slot, label, state, pct, preview, invalid, onPick, onRetry }: Props) {
  const inputId = `photo-${slot}`;

  if (state === "uploading") {
    return (
      <div className={cn(TILE, "bg-foreground text-background overflow-hidden")} aria-busy="true">
        <span className="border-background/30 border-t-background size-[26px] animate-spin rounded-full border-2" />
        <span className="font-mono text-[11px] font-bold tabular-nums">{pct}%</span>
        <span className="sr-only">{label}</span>
        <span className="bg-background/20 absolute inset-x-0 bottom-0 h-[3px]">
          <span className="bg-background block h-full transition-[width]" style={{ width: `${pct}%` }} />
        </span>
      </div>
    );
  }

  if (state === "failed") {
    return (
      <button
        type="button"
        onClick={onRetry}
        className={cn(TILE, "border-primary text-primary border bg-[var(--flota-danger-soft)]")}
      >
        <TriangleAlert className="size-5" />
        <span className={LABEL}>Ponów</span>
        <span className="sr-only">{label}</span>
      </button>
    );
  }

  // Empty and done both open the picker, so both are a label wrapping the input:
  // a bad shot must be retakeable without clearing the tile first.
  return (
    <label
      htmlFor={inputId}
      className={cn(
        TILE,
        "cursor-pointer overflow-hidden",
        state === "done"
          ? "bg-foreground text-background"
          : cn(
              "text-muted-foreground border border-dashed",
              invalid ? "border-primary bg-[var(--flota-danger-soft)]" : "bg-background border-[var(--flota-hair)]",
            ),
      )}
    >
      {state === "done" && preview && (
        <>
          <img src={preview} alt="" className="absolute inset-0 size-full object-cover" />
          <span className="bg-foreground/55 absolute inset-0" />
        </>
      )}
      <span className="relative flex flex-col items-center gap-1.5">
        {state === "done" ? <Check className="size-5" /> : <Camera className="size-5" />}
        <span className={LABEL}>{label}</span>
      </span>
      {/* No `capture` attribute: the employee may have already photographed the
          car, so the native picker must offer the photo library as well as the
          camera (Take Photo / Photo Library / Choose File). `accept="image/*"`
          without `image/heic` — Safari has been seen converting uploads *to* HEIC
          when it is listed, and an iPhone library photo is HEIC anyway, handled by
          `isHeic` downstream. */}
      <input
        id={inputId}
        type="file"
        accept="image/*"
        className="sr-only"
        onChange={(event) => {
          const file = event.target.files?.[0];
          // Reset the input so picking the same file twice still fires `change`.
          event.target.value = "";
          if (file) {
            onPick(file);
          }
        }}
      />
    </label>
  );
}

/** Desktop-only drop zone above the grid: multi-select fills the next free slots. */
export function PhotoDropZone({ onFiles }: { onFiles: (files: File[]) => void }) {
  const [hovering, setHovering] = React.useState(false);

  return (
    <label
      htmlFor="photo-multi"
      onDragOver={(event) => {
        event.preventDefault();
        setHovering(true);
      }}
      onDragLeave={() => {
        setHovering(false);
      }}
      onDrop={(event) => {
        event.preventDefault();
        setHovering(false);
        onFiles(Array.from(event.dataTransfer.files).filter((file) => file.type.startsWith("image/")));
      }}
      className={cn(
        "mb-3 hidden cursor-pointer flex-col items-center justify-center gap-1 rounded-[14px] border border-dashed px-4 py-6 text-center transition-colors sm:flex",
        hovering ? "border-primary bg-[var(--flota-danger-soft)]" : "bg-background border-[var(--flota-hair)]",
      )}
    >
      <span className="text-foreground text-[13px] font-semibold">Przeciągnij zdjęcia tutaj</span>
      <span className="text-muted-foreground text-[12px]">lub zrób je telefonem</span>
      <input
        id="photo-multi"
        type="file"
        accept="image/*"
        multiple
        className="sr-only"
        onChange={(event) => {
          const files = Array.from(event.target.files ?? []);
          event.target.value = "";
          if (files.length) {
            onFiles(files);
          }
        }}
      />
    </label>
  );
}
