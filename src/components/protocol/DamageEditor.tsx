// core
import * as React from "react";
import { Check, ChevronRight, Plus, Trash2, TriangleAlert } from "lucide-react";

// components
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";

// others
import { cn } from "../../lib/utils";
import { plural } from "../../lib/format";
import { damageTypeLabel, protocol } from "../../lib/i18n/protocol";
import { translator } from "../../lib/i18n/types";
import type { Locale } from "../../lib/i18n/types";
import { DAMAGE_TYPES } from "../../lib/protocol-schema";
import { suggestBaselineDamageId } from "../../lib/return-form";
import type { ProtocolDamageType, ReturnBaselineDamage } from "../../types";
import type { DamageValue } from "./types";

// The damage list row + its editor. The editor is a bottom sheet on mobile and a
// 480px centred modal on desktop — one component, two layouts.
//
// A remove action exists because a mistyped entry on a document the customer is
// about to sign must be removable before submit.
//
// **Two modes, one component.** Without `baselineDamages` (issue form, S-05) the
// row shows a static lower-case "existing" tag — at pickup every mark is
// pre-existing by definition. With `baselineDamages` (return form, S-06) each row
// is auto-tagged Existing (carried over from a baseline item) or New (fresh),
// suggested by `suggestBaselineDamageId` and overridable via the editor's
// classification control. The presence of the prop is the issue/return switch;
// issue behavior is unchanged when it is absent.

const LABEL_CLASS = "text-muted-foreground text-[11px] font-[650] tracking-[0.01em]";
const FIELD_CLASS = "bg-background h-11 rounded-[11px]";

/**
 * The photo count under a damage row. Hand-rolled Polish plurals here survived
 * Phase 2's sweep (which grepped for `pluralPl` / `plForm` by name); this routes
 * through the shared CLDR helper like every other counted noun.
 */
function photoCount(
  n: number,
  locale: Locale,
  t: (key: "photoCountOne" | "photoCountFew" | "photoCountMany" | "photoCountOther") => string,
): string {
  const word = plural(n, locale, {
    one: t("photoCountOne"),
    few: t("photoCountFew"),
    many: t("photoCountMany"),
    other: t("photoCountOther"),
  });
  return `${String(n)} ${word}`;
}

export function DamageRow({
  damage,
  preview,
  onOpen,
  returnMode,
  locale,
}: {
  damage: DamageValue;
  preview?: string;
  onOpen: () => void;
  /** Return form: tag Existing / New off `baselineDamageId`. Issue form: a static quiet tag. */
  returnMode?: boolean;
  /** Islands cannot read `Astro.locals`; the mounting page passes it down. */
  locale: Locale;
}) {
  const t = translator(locale, protocol);
  const title = [damageTypeLabel(damage.type, locale), damage.location].join(" — ");
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
        <span className="text-foreground line-clamp-2 text-[14px] font-semibold tracking-tight">
          {title}
          {damage.size ? ` (${damage.size})` : ""}
        </span>
        <span className="text-muted-foreground block text-[12px]">{photoCount(damage.photos.length, locale, t)}</span>
      </span>
      {returnMode ? (
        damage.baselineDamageId ? (
          <span className="text-muted-foreground shrink-0 rounded-[7px] bg-[var(--flota-neutral-soft)] px-2 py-1 text-[11.5px] font-bold">
            {t("damageExisting")}
          </span>
        ) : (
          <span className="text-primary shrink-0 rounded-[7px] bg-[var(--flota-danger-soft)] px-2 py-1 text-[11.5px] font-bold">
            {t("damageNew")}
          </span>
        )
      ) : (
        <span className="text-muted-foreground shrink-0 rounded-[7px] bg-[var(--flota-neutral-soft)] px-2 py-1 text-[11.5px] font-bold">
          {t("damageExistingQuiet")}
        </span>
      )}
      <ChevronRight className="text-muted-foreground size-4 shrink-0" />
    </button>
  );
}

export function DamageEmpty({ returnMode, locale }: { returnMode?: boolean; locale: Locale }) {
  const t = translator(locale, protocol);
  return (
    <div className="border-border bg-background rounded-[14px] border border-dashed px-4 py-8 text-center">
      <p className="text-foreground text-[14px] font-semibold">
        {returnMode ? t("damageEmptyReturn") : t("damageEmptyIssue")}
      </p>
      <p className="text-muted-foreground mt-1 text-[12px]">
        {returnMode ? t("damageEmptyHintReturn") : t("damageEmptyHintIssue")}
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
  /** Return form only: the issue baseline to classify against. Absent ⇒ issue mode (no `Klasyfikacja`). */
  baselineDamages?: ReturnBaselineDamage[];
  /** Baseline ids already claimed by other current rows, so the auto-tag does not double-claim one. */
  takenBaselineIds?: readonly string[];
  /** Islands cannot read `Astro.locals`; the mounting page passes it down. */
  locale: Locale;
}

export function DamageEditor({
  value,
  isNew,
  previews,
  onUploadPhoto,
  onSave,
  onDelete,
  onCancel,
  baselineDamages,
  takenBaselineIds,
  locale,
}: EditorProps) {
  const t = translator(locale, protocol);
  const [draft, setDraft] = React.useState<DamageValue>(value);
  const [error, setError] = React.useState<string | null>(null);
  const [uploading, setUploading] = React.useState(false);
  // Auto-follow the type/location/size match for a fresh row; stop once the
  // employee overrides the classification (or when editing an existing row, whose
  // stored decision must be preserved).
  const [autoClassify, setAutoClassify] = React.useState(isNew);

  // The live existing/new decision (return mode). Computed at render — never stored
  // via an effect — so it tracks the identifying fields while `autoClassify` is on
  // and freezes to the manual pick otherwise. `save()` persists exactly this.
  const baselineDamageId = React.useMemo(() => {
    if (!baselineDamages || !autoClassify) {
      return draft.baselineDamageId ?? null;
    }
    return suggestBaselineDamageId(
      baselineDamages,
      { type: draft.type, location: draft.location, size: draft.size },
      takenBaselineIds ?? [],
    );
  }, [baselineDamages, autoClassify, draft.baselineDamageId, draft.type, draft.location, draft.size, takenBaselineIds]);

  function classify(next: string | null) {
    setAutoClassify(false);
    setDraft((prev) => ({ ...prev, baselineDamageId: next }));
  }

  async function pick(file: File) {
    setUploading(true);
    setError(null);
    try {
      const path = await onUploadPhoto(draft.id, draft.photos.length, file);
      setDraft((prev) => ({ ...prev, photos: [...prev.photos, path] }));
    } catch {
      setError(t("damagePhotoUploadFailed"));
    } finally {
      setUploading(false);
    }
  }

  function save() {
    if (!draft.location.trim()) {
      setError(t("damageLocationRequired"));
      return;
    }
    // A blank size is `null`, not `""` — the column is nullable and the PDF
    // renders `{type} — {location} ({size})` only when there is a size to render.
    const size = draft.size?.trim() ?? "";
    // Persist the live classification (return mode); issue mode carries no baseline
    // and keeps the draft value (undefined), which the issue schema strips.
    onSave({
      ...draft,
      location: draft.location.trim(),
      size: size === "" ? null : size,
      baselineDamageId: baselineDamages ? baselineDamageId : draft.baselineDamageId,
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <button
        type="button"
        aria-label={t("close")}
        onClick={onCancel}
        className="bg-foreground/40 absolute inset-0 cursor-default"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={isNew ? t("damageAdd") : t("damageDetails")}
        className="bg-card shadow-overlay relative max-h-[90vh] w-full overflow-y-auto rounded-t-[28px] p-5 pb-8 sm:max-w-[480px] sm:rounded-[18px] sm:pb-5"
      >
        <span className="mx-auto mb-4 block h-1 w-10 rounded-full bg-[var(--flota-hair)] sm:hidden" />
        <h2 className="text-foreground mb-4 text-[17px] font-bold tracking-tight">
          {isNew ? t("damageAdd") : t("damageDetails")}
        </h2>

        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <span id="damage-type-label" className={LABEL_CLASS}>
              {t("damageType")}
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
                    {damageTypeLabel(type, locale)}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="damage-location" className={LABEL_CLASS}>
              {t("damageLocation")}
            </Label>
            <Input
              id="damage-location"
              value={draft.location}
              maxLength={60}
              placeholder={t("damageLocationPlaceholder")}
              className={FIELD_CLASS}
              onChange={(event) => {
                setDraft((prev) => ({ ...prev, location: event.target.value }));
              }}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="damage-size" className={LABEL_CLASS}>
              {t("damageSize")}
            </Label>
            <Input
              id="damage-size"
              value={draft.size ?? ""}
              placeholder={t("damageSizePlaceholder")}
              className={cn(FIELD_CLASS, "w-[160px]")}
              onChange={(event) => {
                setDraft((prev) => ({ ...prev, size: event.target.value }));
              }}
            />
          </div>

          {/* Return form only: the existing/new classification. "New" unlinks the
              row; each baseline item links it (⇒ existing). Auto-suggested above,
              overridable here. */}
          {baselineDamages && (
            <div className="flex flex-col gap-1.5">
              <span id="damage-class-label" className={LABEL_CLASS}>
                {t("damageKind")}
              </span>
              <div className="flex flex-wrap gap-2" role="group" aria-labelledby="damage-class-label">
                <button
                  type="button"
                  aria-pressed={baselineDamageId == null}
                  onClick={() => {
                    classify(null);
                  }}
                  className={cn(
                    "h-[38px] rounded-[10px] border px-3.5 text-[13px] font-semibold tracking-tight transition-colors",
                    baselineDamageId == null
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-card text-foreground hover:bg-background",
                  )}
                >
                  {t("damageNew")}
                </button>
                {baselineDamages.map((baseline) => {
                  const on = baselineDamageId === baseline.id;
                  const label = [damageTypeLabel(baseline.type, locale), baseline.location].join(" — ");
                  return (
                    <button
                      key={baseline.id}
                      type="button"
                      aria-pressed={on}
                      onClick={() => {
                        classify(baseline.id);
                      }}
                      className={cn(
                        "h-[38px] max-w-full truncate rounded-[10px] border px-3.5 text-[13px] font-semibold tracking-tight transition-colors",
                        on
                          ? "border-foreground bg-foreground text-background"
                          : "border-border bg-card text-foreground hover:bg-background",
                      )}
                    >
                      {label}
                      {baseline.size ? ` (${baseline.size})` : ""}
                    </button>
                  );
                })}
              </div>
              <p className="text-muted-foreground text-[12px]">{t("damageAutoTagged")}</p>
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <span className={LABEL_CLASS}>{t("damagePhotos")}</span>
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
                {t("remove")}
              </Button>
            )}
            <Button type="button" variant="outline" className="h-11 flex-1" onClick={onCancel}>
              {t("cancel")}
            </Button>
            <Button
              type="button"
              disabled={uploading}
              className="bg-foreground text-background hover:bg-foreground/90 h-11 flex-[2]"
              onClick={save}
            >
              <Check className="size-4" />
              {t("save")}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
