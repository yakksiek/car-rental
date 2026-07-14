// core
import * as React from "react";
import { Check, ChevronRight, Plus, Trash2, TriangleAlert } from "lucide-react";

// components
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";

// others
import { cn } from "../../lib/utils";
import { DAMAGE_TYPE_LABELS_PL } from "../../lib/protocol-labels";
import { DAMAGE_TYPES } from "../../lib/protocol-schema";
import type { ProtocolDamageType } from "../../types";
import type { DamageValue } from "./types";

// The damage list row + its editor. The editor is a bottom sheet on mobile and a
// 480px centred modal on desktop — one component, two layouts.
//
// A `Usuń` action exists because a mistyped entry on a document the customer is
// about to sign must be removable before submit. The `istniejące | nowe` tag is
// always `istniejące` here: at pickup every mark is pre-existing by definition,
// and the tag is derived at return time (S-06) by diffing against this baseline.

const LABEL_CLASS = "text-muted-foreground text-[11px] font-[650] tracking-[0.01em]";
const FIELD_CLASS = "bg-background h-11 rounded-[11px]";

/** Polish counts take three forms: 1 zdjęcie · 2–4 zdjęcia · 0, 5+ and the teens zdjęć. */
function photoCountPl(n: number): string {
  if (n === 1) {
    return "1 zdjęcie";
  }
  const last = n % 10;
  const teens = n % 100;
  const few = last >= 2 && last <= 4 && !(teens >= 12 && teens <= 14);
  return `${n} ${few ? "zdjęcia" : "zdjęć"}`;
}

export function DamageRow({ damage, preview, onOpen }: { damage: DamageValue; preview?: string; onOpen: () => void }) {
  const title = [DAMAGE_TYPE_LABELS_PL[damage.type], damage.location].join(" — ");
  return (
    <button
      type="button"
      onClick={onOpen}
      className="border-border bg-card hover:bg-background flex w-full items-center gap-3 rounded-[14px] border p-3 text-left transition-colors"
    >
      <span className="bg-background text-muted-foreground flex size-[42px] shrink-0 items-center justify-center overflow-hidden rounded-[10px]">
        {preview ? (
          <img src={preview} alt="" className="size-full object-cover" />
        ) : (
          <TriangleAlert className="size-4" />
        )}
      </span>
      <span className="min-w-0 flex-1">
        <span className="text-foreground block truncate text-[14px] font-semibold tracking-tight">
          {title}
          {damage.size ? ` (${damage.size})` : ""}
        </span>
        <span className="text-muted-foreground block text-[12px]">{photoCountPl(damage.photos.length)}</span>
      </span>
      <span className="text-muted-foreground shrink-0 rounded-[7px] bg-[var(--flota-neutral-soft)] px-2 py-1 text-[11.5px] font-bold">
        istniejące
      </span>
      <ChevronRight className="text-muted-foreground size-4 shrink-0" />
    </button>
  );
}

export function DamageEmpty() {
  return (
    <div className="border-border bg-background rounded-[14px] border border-dashed px-4 py-8 text-center">
      <p className="text-foreground text-[14px] font-semibold">Brak uszkodzeń</p>
      <p className="text-muted-foreground mt-1 text-[12px]">
        Dodaj każdą rysę, wgniecenie lub pęknięcie, aby zwrot mógł porównać.
      </p>
    </div>
  );
}

interface EditorProps {
  value: DamageValue;
  isNew: boolean;
  previews: Record<string, string>;
  /** Compress + upload one photo for this damage item; resolves to its storage path. */
  onUploadPhoto: (damageId: string, index: number, file: File) => Promise<string>;
  onSave: (value: DamageValue) => void;
  onDelete: () => void;
  onCancel: () => void;
}

export function DamageEditor({ value, isNew, previews, onUploadPhoto, onSave, onDelete, onCancel }: EditorProps) {
  const [draft, setDraft] = React.useState<DamageValue>(value);
  const [error, setError] = React.useState<string | null>(null);
  const [uploading, setUploading] = React.useState(false);

  async function pick(file: File) {
    setUploading(true);
    setError(null);
    try {
      const path = await onUploadPhoto(draft.id, draft.photos.length, file);
      setDraft((prev) => ({ ...prev, photos: [...prev.photos, path] }));
    } catch {
      setError("Nie udało się wgrać zdjęcia. Spróbuj ponownie.");
    } finally {
      setUploading(false);
    }
  }

  function save() {
    if (!draft.location.trim()) {
      setError("Podaj lokalizację uszkodzenia.");
      return;
    }
    // A blank `Rozmiar` is `null`, not `""` — the column is nullable and the PDF
    // renders `{type} — {location} ({size})` only when there is a size to render.
    const size = draft.size?.trim() ?? "";
    onSave({ ...draft, location: draft.location.trim(), size: size === "" ? null : size });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <button
        type="button"
        aria-label="Zamknij"
        onClick={onCancel}
        className="bg-foreground/40 absolute inset-0 cursor-default"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={isNew ? "Dodaj uszkodzenie" : "Szczegóły uszkodzenia"}
        className="bg-card shadow-overlay relative max-h-[90vh] w-full overflow-y-auto rounded-t-[28px] p-5 pb-8 sm:max-w-[480px] sm:rounded-[18px] sm:pb-5"
      >
        <span className="mx-auto mb-4 block h-1 w-10 rounded-full bg-[var(--flota-hair)] sm:hidden" />
        <h2 className="text-foreground mb-4 text-[17px] font-bold tracking-tight">
          {isNew ? "Dodaj uszkodzenie" : "Szczegóły uszkodzenia"}
        </h2>

        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <span id="damage-type-label" className={LABEL_CLASS}>
              Rodzaj
            </span>
            <div className="flex flex-wrap gap-2" role="group" aria-labelledby="damage-type-label">
              {DAMAGE_TYPES.map((type: ProtocolDamageType) => {
                const on = draft.type === type;
                return (
                  <button
                    key={type}
                    type="button"
                    aria-pressed={on}
                    onClick={() => {
                      setDraft((prev) => ({ ...prev, type }));
                    }}
                    className={cn(
                      "h-[38px] rounded-[10px] border px-3.5 text-[13px] font-semibold tracking-tight transition-colors",
                      on
                        ? "border-foreground bg-foreground text-background"
                        : "border-border bg-card text-foreground hover:bg-background",
                    )}
                  >
                    {DAMAGE_TYPE_LABELS_PL[type]}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="damage-location" className={LABEL_CLASS}>
              Lokalizacja
            </Label>
            <Input
              id="damage-location"
              value={draft.location}
              placeholder="np. lewy tylny zderzak"
              className={FIELD_CLASS}
              onChange={(event) => {
                setDraft((prev) => ({ ...prev, location: event.target.value }));
              }}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="damage-size" className={LABEL_CLASS}>
              Rozmiar
            </Label>
            <Input
              id="damage-size"
              value={draft.size ?? ""}
              placeholder="np. 15 cm"
              className={cn(FIELD_CLASS, "w-[160px]")}
              onChange={(event) => {
                setDraft((prev) => ({ ...prev, size: event.target.value }));
              }}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <span className={LABEL_CLASS}>Zdjęcia</span>
            <div className="flex flex-wrap gap-2">
              {draft.photos.map((path) => (
                <span key={path} className="bg-background size-[62px] overflow-hidden rounded-[10px]">
                  {previews[path] && <img src={previews[path]} alt="" className="size-full object-cover" />}
                </span>
              ))}
              <label
                htmlFor="damage-photo"
                className="text-muted-foreground bg-background flex size-[62px] cursor-pointer items-center justify-center rounded-[10px] border border-dashed border-[var(--flota-hair)]"
                aria-busy={uploading}
              >
                {uploading ? (
                  <span className="border-muted-foreground/30 border-t-muted-foreground size-4 animate-spin rounded-full border-2" />
                ) : (
                  <Plus className="size-4" />
                )}
                {/* No `capture`: allow the photo library as well as the camera. */}
                <input
                  id="damage-photo"
                  type="file"
                  accept="image/*"
                  className="sr-only"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    event.target.value = "";
                    if (file) {
                      void pick(file);
                    }
                  }}
                />
              </label>
            </div>
          </div>

          {error && <p className="text-destructive text-sm font-medium">{error}</p>}

          <div className="flex items-center gap-2.5">
            {!isNew && (
              <Button type="button" variant="outline" className="text-destructive h-11" onClick={onDelete}>
                <Trash2 className="size-4" />
                Usuń
              </Button>
            )}
            <Button type="button" variant="outline" className="h-11 flex-1" onClick={onCancel}>
              Anuluj
            </Button>
            <Button
              type="button"
              disabled={uploading}
              className="bg-foreground text-background hover:bg-foreground/90 h-11 flex-[2]"
              onClick={save}
            >
              <Check className="size-4" />
              Zapisz
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
