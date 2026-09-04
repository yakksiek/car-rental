// core
import * as React from "react";
import { AlertTriangle, CalendarDays, Check, ChevronDown, Truck, X } from "lucide-react";

// components
import { ManualReservationCalendar } from "./ManualReservationCalendar";

// others
import { cn } from "../../lib/utils";
import { fromIsoDate } from "../../lib/date-iso";
import { estimatedTotal, formatDuration, formatPln, formatPlnAmount, rentalDays } from "../../lib/format";
import { checkRangeBookable } from "../../lib/availability";
import { canCreateReservation, resolveAvailability, type AvailabilityState } from "../../lib/manual-availability";
import { dayMonthShort, dayMonthYearShort } from "../../lib/format-date";
import { dashboard } from "../../lib/i18n/dashboard";
import { LOCALES, LOCALE_ENDONYMS, translator } from "../../lib/i18n/types";
import type { Locale } from "../../lib/i18n/types";
import { manualReservationSchema } from "../../lib/reservation-schema";
import { useManualReservation } from "../hooks/useManualReservation";
import { useMediaQuery } from "../hooks/useMediaQuery";
import { useVehicleBusyRanges } from "../hooks/useVehicleBusyRanges";
import type { PickerVehicle } from "../../types";

// The manual-reservation modal (S-12): desktop-centered / mobile bottom sheet,
// ported from the design source `manual-reservation.jsx` (MrD_FormOk /
// MrD_FormConflict / MrD_Done + MrM_*). Overlay shell reuses the house idiom
// from ReservationDecision.tsx (design contract D6), overriding its md:max-w-md
// to the mockup's 560px desktop width.
//
// Recorded deviations it implements (design-contract.md): D1 name+e-mail+phone
// all required (the mockup enables on a name alone); D2 plain conflict message,
// no clashing-booking card and no "next free" hint; D3 no "Pojazd w serwisie"
// state (only active vehicles are selectable); D5 no company/VAT/notes.

/** `"Renault Master"`, falling back to the fleet name when make/model are absent. */
function vehicleTitle(vehicle: PickerVehicle): string {
  return [vehicle.make, vehicle.model].filter(Boolean).join(" ") || vehicle.name;
}

/** `"1 kwi"` — the mockup's short day label (`mrFmt`). */
function formatDayShort(iso: string, locale: Locale): string {
  const date = fromIsoDate(iso);
  return date ? dayMonthShort(date, locale) : iso;
}

/** `"1 kwi 2026"` — the date-button label (`mrFmtFull`). */
function formatDayFull(iso: string, locale: Locale): string {
  const date = fromIsoDate(iso);
  return date ? dayMonthYearShort(date, locale) : iso;
}

// ── customer language ────────────────────────────────────────────────────────

/**
 * Which language THIS customer is emailed in — the one field the public funnel
 * has no equivalent of, because there the customer answers it by choosing the
 * site's language.
 *
 * A segmented pair rather than a `<select>`: with exactly two options a select
 * costs an extra interaction and hides the alternative, and the same reasoning
 * already produced `LangToggle`'s caret-less toggle. Shaped as
 * `role="group"` + `aria-pressed` toggles, matching `DamageEditor`'s
 * classification chips — not `radiogroup`/`radio`, which would owe the reader
 * arrow-key roving this repo has no implementation of.
 *
 * Both labels are ENDONYMS (`English` / `Polski`), never translated — same rule
 * as the header and sidebar controls: a language name has to read in the
 * language it names.
 *
 * `locale` is the EMPLOYEE's session (it renders the group's own label); `value`
 * is the CUSTOMER's. They are deliberately independent, which is the whole point
 * of the field.
 */
function CustomerLanguage({
  locale,
  value,
  onChange,
  busy,
}: {
  locale: Locale;
  value: Locale;
  onChange: (next: Locale) => void;
  busy: boolean;
}) {
  const t = translator(locale, dashboard);
  return (
    <div className="mt-0.5 min-w-0">
      <span id="mr-language-label" className="text-muted-foreground mb-1.5 block text-[11.5px] font-[540]">
        {t("manualLanguage")}
      </span>
      <div className="grid grid-cols-2 gap-2" role="group" aria-labelledby="mr-language-label">
        {LOCALES.map((option) => {
          const on = option === value;
          return (
            <button
              key={option}
              type="button"
              aria-pressed={on}
              disabled={busy}
              onClick={() => {
                onChange(option);
              }}
              className={cn(
                "flex h-[42px] items-center justify-center rounded-[11px] border text-[13.5px] transition-colors",
                "focus-visible:ring-2 focus-visible:ring-[var(--flota-ink-2)]/25 focus-visible:outline-none",
                "disabled:opacity-60",
                on
                  ? "border-foreground bg-foreground text-background font-[650]"
                  : "text-foreground bg-card hover:bg-background border-[var(--flota-hair)] font-[540]",
              )}
            >
              {LOCALE_ENDONYMS[option]}
            </button>
          );
        })}
      </div>
      <div className="text-muted-foreground mt-1.5 text-[11.5px] font-[540]">{t("manualLanguageHint")}</div>
    </div>
  );
}

// ── availability panel ───────────────────────────────────────────────────────

function MrAvailability({
  availability,
  onRetry,
  locale,
}: {
  availability: AvailabilityState;
  onRetry: () => void;
  locale: Locale;
}) {
  const t = translator(locale, dashboard);
  const box = "flex items-start gap-[11px] rounded-[13px] px-[13px] py-3 md:px-[15px] md:py-[13px]";

  if (availability.state === "idle") {
    return (
      <div className={cn(box, "bg-secondary")}>
        <CalendarDays className="text-muted-foreground size-[18px] shrink-0" />
        <div className="text-muted-foreground pt-px text-[12.5px] font-[540]">{t("avIdle")}</div>
      </div>
    );
  }

  if (availability.state === "checking") {
    return (
      <div className={cn(box, "bg-secondary items-center")}>
        <span className="size-[17px] shrink-0 animate-spin rounded-full border-2 border-[var(--flota-hair)] border-t-[var(--flota-ink-2)] [animation-duration:0.7s]" />
        <div className="text-[12.5px] font-semibold text-[var(--flota-ink-2)]">{t("avChecking")}</div>
      </div>
    );
  }

  // `invalid` (a malformed range, caught locally) and `error` (the check itself
  // failed) share the warning treatment: both mean "we cannot confirm this yet".
  if (availability.state === "invalid" || availability.state === "error") {
    return (
      <div className={cn(box, "bg-[var(--flota-warning-soft)]")}>
        <AlertTriangle className="text-warning size-[18px] shrink-0" />
        <div className="pt-px">
          <div className="text-warning text-[12.5px] font-semibold">
            {availability.state === "invalid" ? availability.message : t("availabilityReadFailed")}
          </div>
          {/* `invalid` is a bad range, which no amount of re-reading fixes —
              only the failed read gets the retry. */}
          {availability.state === "error" && (
            <button
              type="button"
              onClick={onRetry}
              className="text-warning mt-1 text-[12.5px] font-bold underline underline-offset-2"
            >
              {t("availabilityRetry")}
            </button>
          )}
        </div>
      </div>
    );
  }

  if (availability.state === "conflict") {
    return (
      <div className={cn(box, "bg-[var(--flota-danger-soft)]")}>
        <AlertTriangle className="text-destructive size-[18px] shrink-0" />
        <div className="pt-px">
          <div className="text-destructive text-[13px] font-bold tracking-[-0.1px]">{t("avConflict")}</div>
          <div className="text-destructive mt-0.5 text-[12px] opacity-85">{t("avConflictSub")}</div>
        </div>
      </div>
    );
  }

  // Status only (D10). The subtitle used to name the NEXT booking's start
  // date; without the source's `· kolejna rez. {reference}` clause — which the
  // PII-safe RPC cannot supply — it read as a claim about the range being
  // booked, and it went silent exactly when a warning would matter: a booking
  // starting ON the return day is a legal 10:00/14:00 changeover, so it never
  // counted as "next". Single-line, so the box centers like `checking`.
  return (
    <div className={cn(box, "items-center bg-[var(--flota-success-soft)]")}>
      <Check className="text-success size-[18px] shrink-0" />
      <div className="text-success text-[13px] font-bold tracking-[-0.1px]">{t("avAvailable")}</div>
    </div>
  );
}

// ── customer-field errors ────────────────────────────────────────────────────

/** The three inputs a per-field message can hang under — the schema's key names. */
type CustomerField = "customer_name" | "customer_phone" | "customer_email";

const CUSTOMER_FIELDS = ["customer_name", "customer_phone", "customer_email"] as const;

/**
 * First zod message per top-level field, e.g. `{ customer_phone: "Podaj…" }` —
 * deliberately the SAME shape `POST /api/reservations/manual` returns on a 400
 * (`api/reservations/manual.ts:32`) and the same one `ReservationForm` renders,
 * so the island and the trust boundary can only ever report the same fields.
 * Issues on `vehicle_id` / `pickup` / `return` land in the map too and are simply
 * not read — the range has its own panel, which answers about the range.
 */
function firstIssuePerField(issues: { path: PropertyKey[]; message: string }[]): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const issue of issues) {
    const key = String(issue.path[0] ?? "form");
    errors[key] ??= issue.message;
  }
  return errors;
}

/** `mrInputFull` — the shared customer-input shape (S-12 contract, Surface 2). */
const MR_INPUT =
  "text-foreground bg-card h-[42px] w-full rounded-[11px] border border-[var(--flota-hair)] px-[13px] text-[13.5px] outline-none aria-invalid:border-destructive";

/**
 * The message under an input. `deviation(undrawn-state)`: the S-12 source draws
 * no invalid field, so this takes the modal's own idioms — the `11.5px` of the
 * hints beside it, the `font-semibold` + `text-destructive` of the create-failure
 * banner below it.
 */
function FieldError({ id, message }: { id: string; message: string | undefined }) {
  if (!message) {
    return null;
  }
  return (
    <p id={id} className="text-destructive mt-1.5 text-[11.5px] font-semibold">
      {message}
    </p>
  );
}

// ── done panel ───────────────────────────────────────────────────────────────

// Centered on BOTH breakpoints (the design's done step is a card, not a sheet).
function DonePanel({
  reference,
  customerName,
  vehicle,
  pickup,
  returnDate,
  onClose,
  locale,
}: {
  reference: string;
  customerName: string;
  vehicle: PickerVehicle;
  pickup: string;
  returnDate: string;
  onClose: () => void;
  locale: Locale;
}) {
  const t = translator(locale, dashboard);
  const days = rentalDays(pickup, returnDate);

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-[rgba(20,18,22,0.55)] px-4 backdrop-blur-sm md:p-8">
      <div className="bg-card shadow-overlay w-full rounded-[22px] p-7 text-center md:w-[440px] md:rounded-[20px]">
        <div className="mx-auto mb-4 flex size-[62px] items-center justify-center rounded-full bg-[var(--flota-success-soft)]">
          <Check className="text-success size-[30px]" />
        </div>
        <div className="text-foreground text-[21px] font-bold tracking-[-0.5px]">{t("manualDoneTitle")}</div>
        <div className="mt-[7px] text-[13.5px] leading-[1.5] text-[var(--flota-ink-2)]">{t("manualDoneSub")}</div>

        <div className="bg-background mt-5 mb-[22px] rounded-[14px] p-4 text-left">
          <div className="flex items-center justify-between">
            <span className="text-foreground font-mono text-[13px] font-bold">{reference}</span>
            <span className="bg-accent text-primary rounded-full px-2 py-[3px] text-[10px] font-bold tracking-[0.4px] uppercase">
              {t("manualBadgeLabel")}
            </span>
          </div>
          <div className="text-foreground mt-2.5 text-sm font-[650] tracking-[-0.2px]">{customerName}</div>
          <div className="text-muted-foreground mt-[3px] text-[12.5px]">{vehicleTitle(vehicle)}</div>
          <div className="mt-[7px] text-[13px] font-[650] text-[var(--flota-ink-2)] tabular-nums">
            {formatDayShort(pickup, locale)} – {formatDayShort(returnDate, locale)}{" "}
            <span className="text-muted-foreground font-[540]">· {formatDuration(days, locale)}</span>
          </div>
        </div>

        <div className="flex gap-2.5">
          <a
            href="/dashboard/calendar"
            className="bg-card flex h-[46px] flex-1 items-center justify-center rounded-md border border-[var(--flota-hair)] text-sm font-semibold text-[var(--flota-ink-2)]"
          >
            {t("manualSeeCalendar")}
          </a>
          <button
            type="button"
            onClick={onClose}
            className="bg-primary flex h-[46px] flex-1 items-center justify-center rounded-md text-sm font-[650] text-white"
          >
            {t("manualDone")}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── the modal ────────────────────────────────────────────────────────────────

export function ManualReservationModal({
  vehicles,
  onClose,
  locale,
}: {
  vehicles: PickerVehicle[];
  onClose: () => void;
  /** Islands cannot read `Astro.locals`; the mounting page passes it down. */
  locale: Locale;
}) {
  const t = translator(locale, dashboard);
  const [vehicleId, setVehicleId] = React.useState(vehicles[0]?.id ?? "");
  const [pickup, setPickup] = React.useState("");
  const [returnDate, setReturnDate] = React.useState("");
  const [name, setName] = React.useState("");
  const [phone, setPhone] = React.useState("");
  const [email, setEmail] = React.useState("");
  // *** Defaults to `pl`, NOT to `locale`. *** A walk-in at a Polish depot is the
  // common case, so the field is a correction rather than a chore — and seeding
  // it from the employee's session is exactly the bug `reservations.locale`
  // exists to prevent: a recruiter reading the English cockpit would otherwise
  // silently mail every phone-in customer in English.
  const [customerLocale, setCustomerLocale] = React.useState<Locale>("pl");
  // Which customer inputs have been blurred at least once. A field's message is
  // withheld until then: an employee who has typed nothing yet is not making a
  // mistake, and reding all three on open would be worse than the silence this
  // phase removes. There is deliberately no "submit was attempted" arm — the
  // gate below keeps the button `disabled` while the customer fields are
  // invalid, so no submit can be attempted from that state. It does not need
  // one either: clicking a disabled button moves focus to the body, so the
  // gesture that produces the confusion IS a blur, and it reveals the message
  // in the same tick (probed 2026-09-04).
  const [touched, setTouched] = React.useState<Partial<Record<CustomerField, boolean>>>({});
  const markTouched = (field: CustomerField) => {
    setTouched((prev) => (prev[field] ? prev : { ...prev, [field]: true }));
  };
  const [banner, setBanner] = React.useState<string | null>(null);
  const [created, setCreated] = React.useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = React.useState(false);

  // The picker is in flow under the trigger on desktop and its own layer over
  // the form sheet on mobile — two different places in the tree, so the
  // breakpoint has to be read in JS. Safe here because the modal only ever
  // mounts on a click, never during SSR or hydration. `md` = Tailwind's 48rem.
  const isMobile = !useMediaQuery("(min-width: 48rem)");

  const { ranges, state: rangesState, refetch } = useVehicleBusyRanges(vehicleId);
  const { busy: creating, create } = useManualReservation();

  // Lock the page behind the scrim, the same way `MobileNav.tsx:65` does. The
  // modal is only mounted while it is open, so mount/unmount IS the open/closed
  // edge. Without this the document keeps its own scrollbar: a wheel over the
  // scrim moves the dashboard behind, and once the modal's own body reaches its
  // end the scroll chains straight through to the page — measured at 114px on
  // desktop. That was true from S-12; the in-flow calendar only made the modal
  // tall enough to hit the chain point on the first gesture.
  React.useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, []);

  // The create's pre-flight re-read runs BEFORE `creating` flips, so without its
  // own flag the form would be live for the length of that request — F11 again,
  // through the new window. One `busy` covers the whole submit.
  const [preflighting, setPreflighting] = React.useState(false);
  const busy = preflighting || creating;

  // The panel's answer, resolved locally against the vehicle's busy ranges — the
  // same half-day rules the calendar cells draw and the EXCLUDE constraint
  // enforces, so the panel can never contradict the days shown under it.
  const resolved = resolveAvailability(vehicleId, pickup, returnDate, ranges, rangesState, locale);

  // The create (or the pre-flight) is the newer, authoritative answer about this
  // range, so it overrides the resolver — otherwise the employee would see a
  // green "Termin wolny" over a red banner, with the submit button still armed
  // for an identical retry. Layered rather than written into the ranges so the
  // next (vehicle, pickup, return) change drops it with the rest.
  const [conflictOverride, setConflictOverride] = React.useState(false);
  const availability: AvailabilityState = conflictOverride ? { state: "conflict" } : resolved;
  const markConflict = () => {
    setConflictOverride(true);
  };

  // The banner reports the outcome of a create against ONE range, so it must die
  // with that range: after a lost create the employee follows "Wybierz inny
  // termin.", the panel resolves green — and a banner cleared only at the top of
  // the next submit() would still be on screen contradicting it. Mirrors the
  // hook's render-phase reset (useManualReservation.ts:62-70) so the banner goes
  // in the same render the input changed rather than one paint later. Keyed on
  // (vehicle, pickup, return) only: a customer-field edit must NOT clear it.
  // `disabled` on a trigger does NOT close an already-open popover, and the
  // footer submit sits outside the scrollable body — so with the calendar left
  // live an employee could press Utwórz rezerwację and then click a day, moving
  // the range mid-POST and landing F11 again through the new surface. The
  // popover is simply not rendered while `busy` (below); this drops the trigger
  // out of its active treatment to match, in the same render `busy` flipped.
  const [lastBusy, setLastBusy] = React.useState(busy);
  if (lastBusy !== busy) {
    setLastBusy(busy);
    if (busy) {
      setPickerOpen(false);
    }
  }

  const rangeKey = `${vehicleId}|${pickup}|${returnDate}`;
  const [lastRangeKey, setLastRangeKey] = React.useState(rangeKey);
  if (lastRangeKey !== rangeKey) {
    setLastRangeKey(rangeKey);
    setBanner(null);
    setConflictOverride(false);
  }

  const vehicle = vehicles.find((v) => v.id === vehicleId) ?? vehicles[0];

  const payload = {
    vehicle_id: vehicleId,
    pickup,
    return: returnDate,
    customer_name: name,
    customer_email: email,
    customer_phone: phone,
    locale: customerLocale,
  };
  // The same schema the endpoint validates with, so the button cannot enable on
  // input the server would reject (D1: all three customer fields required) — and,
  // since it is one parse, the message under a field is by construction the same
  // one the 400 would carry, already in the employee's locale.
  const parsed = manualReservationSchema(locale).safeParse(payload);
  const canCreate = canCreateReservation(availability, parsed.success);
  const issues = parsed.success ? {} : firstIssuePerField(parsed.error.issues);
  // Live, so correcting a field clears its message in the same render.
  const errors = Object.fromEntries(
    CUSTOMER_FIELDS.map((field) => [field, touched[field] ? issues[field] : undefined]),
  ) as Partial<Record<CustomerField, string>>;

  const days = pickup && returnDate ? Math.max(rentalDays(pickup, returnDate), 0) : 0;
  const total = estimatedTotal(vehicle.daily_rate, days);

  // "1 kwi – 2 kwi 2026" — the first date's year is elided, as the source does,
  // since the pair is read as one span. Two states the source never draws (D18):
  // nothing picked at all, which prompts rather than showing "— – —"; and the
  // half-made range a veto leaves behind, which shows the one date it has.
  const rangeLabel =
    pickup && returnDate
      ? `${formatDayShort(pickup, locale)} – ${formatDayFull(returnDate, locale)}`
      : pickup
        ? formatDayFull(pickup, locale)
        : t("manualPickRange");

  async function submit() {
    setBanner(null);

    // Pre-flight: ranges are read once per vehicle SELECTION, so by submit time
    // the snapshot the panel judged against can be as old as the phone call —
    // with the calendar painting "free" days from it. Re-read here so the verdict
    // that gates the write is as fresh as the write. A failed read (`null`) falls
    // through to the POST, which is the authority anyway.
    setPreflighting(true);
    const fresh = await refetch();
    setPreflighting(false);
    if (fresh && !checkRangeBookable(fresh, pickup, returnDate).ok) {
      markConflict();
      setBanner(t("manualErrorConflict"));
      return;
    }

    const outcome = await create(payload);
    if (outcome.status === "created") {
      setCreated(outcome.reference);
      return;
    }
    // The create is the newer, authoritative answer about this range: flip the
    // panel with it, so the employee never sees a green "Termin wolny" over a red
    // banner — and `canCreate` falls false, disarming an identical retry.
    if (outcome.status === "conflict") {
      markConflict();
      setBanner(t("manualErrorConflict"));
      return;
    }
    if (outcome.status === "unavailable") {
      markConflict();
      setBanner(t("manualErrorUnavailable"));
      return;
    }
    setBanner(t("manualErrorCreate"));
  }

  if (created) {
    return (
      <DonePanel
        locale={locale}
        reference={created}
        customerName={name}
        vehicle={vehicle}
        pickup={pickup}
        returnDate={returnDate}
        onClose={onClose}
      />
    );
  }

  return (
    <div
      className={cn(
        "fixed inset-0 z-[60] flex items-end justify-center bg-[rgba(20,18,22,0.55)] backdrop-blur-sm md:p-8",
        // The in-flow calendar makes the modal taller than a centered box can
        // carry, so desktop rides the top of the viewport while a field is open.
        pickerOpen && !busy ? "md:items-start md:pt-14" : "md:items-center",
      )}
      // Inert while a create is in flight: unmounting mid-POST would still commit
      // the booking and email the customer, but the employee would never see the
      // reference — and might re-enter it straight into a 409.
      onClick={busy ? undefined : onClose}
    >
      <div
        onClick={(e) => {
          e.stopPropagation();
        }}
        className="bg-card shadow-overlay flex max-h-[94%] w-full flex-col overflow-hidden rounded-t-[26px] md:w-[560px] md:rounded-[20px]"
      >
        {/* header */}
        <div className="flex items-start justify-between border-b border-[var(--flota-hair-2)] px-[18px] pt-[18px] pb-[14px] md:px-6 md:pt-[22px] md:pb-4">
          <div>
            <div className="flex items-center gap-[9px]">
              <span className="text-foreground text-[18px] font-bold tracking-[-0.4px] md:text-[19px]">
                {t("manualTitle")}
              </span>
              <span className="bg-accent text-primary rounded-full px-2 py-[3px] text-[9.5px] font-bold tracking-[0.4px] uppercase">
                {t("manualBadgeLabel")}
              </span>
            </div>
            <div className="text-muted-foreground mt-[3px] text-[12.5px]">{t("manualSubtitle")}</div>
          </div>
          <button
            type="button"
            onClick={busy ? undefined : onClose}
            disabled={busy}
            aria-label={t("close")}
            className="bg-card flex size-[34px] shrink-0 items-center justify-center rounded-[10px] border border-[var(--flota-hair)] disabled:opacity-40"
          >
            <X className="size-4 text-[var(--flota-ink-2)]" />
          </button>
        </div>

        {/* body */}
        <div className="flex-1 overflow-auto">
          <div className="flex flex-col gap-[18px] px-[18px] pt-4 pb-2 md:px-6 md:pt-5">
            {/* Pojazd */}
            <div>
              <div className="text-muted-foreground mb-2 text-[11px] font-bold tracking-[0.4px] uppercase">
                {t("manualVehicle")}
              </div>
              <div className="bg-background relative flex items-center gap-3 rounded-[13px] px-3 py-2.5">
                <div className="bg-card shadow-card flex h-[42px] w-16 shrink-0 items-center justify-center rounded-[9px]">
                  <Truck className="text-foreground size-6" strokeWidth={1.5} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-foreground text-sm font-[650] tracking-[-0.2px]">{vehicleTitle(vehicle)}</div>
                  <div className="text-muted-foreground mt-0.5 text-[11.5px]">
                    <span className="font-mono">{vehicle.plate}</span> · {formatPln(vehicle.daily_rate, locale)}
                    {t("perDay")}
                  </div>
                </div>
                <span className="bg-card shadow-card flex size-[30px] shrink-0 items-center justify-center rounded-sm">
                  <ChevronDown className="size-[15px] text-[var(--flota-ink-2)]" />
                </span>
                {/* The mockup's own affordance: a real <select> laid transparently
                    over the card, so the styling is exact and the control stays
                    natively keyboard- and screen-reader-accessible. */}
                <select
                  aria-label={t("manualVehicle")}
                  value={vehicleId}
                  disabled={busy}
                  onChange={(e) => {
                    setVehicleId(e.target.value);
                  }}
                  className="absolute inset-0 size-full cursor-pointer appearance-none border-none opacity-0"
                >
                  {vehicles.map((v) => (
                    <option key={v.id} value={v.id}>
                      {vehicleTitle(v)} · {v.plate}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Termin */}
            <div>
              <div
                id="mr-term-label"
                className="text-muted-foreground mb-2 text-[11px] font-bold tracking-[0.4px] uppercase"
              >
                {t("manualTerm")}
              </div>

              {/* ONE field. The picker sets both ends of the range, so a second
                  trigger only restated what the calendar already carries — and
                  invited the reading that each opened a different calendar. The
                  Odbiór / Zwrot captions went with it; the section label above
                  already names the block. */}
              <div className="relative">
                <button
                  type="button"
                  disabled={busy}
                  aria-expanded={pickerOpen}
                  // Section label + current range, so the control announces
                  // "Termin 1 kwi – 2 kwi 2026" rather than bare dates.
                  aria-labelledby="mr-term-label mr-term-val"
                  onClick={() => {
                    setPickerOpen((open) => !open);
                  }}
                  className={cn(
                    "text-foreground bg-card flex h-10 w-full items-center gap-2 rounded-[10px] border border-[var(--flota-hair)] px-2.5 text-[13px] font-semibold disabled:opacity-40",
                    pickerOpen && "border-[var(--foreground)] shadow-[0_0_0_4px_rgba(15,23,42,0.06)]",
                  )}
                >
                  <CalendarDays
                    className={cn("size-3.5 shrink-0", pickerOpen ? "text-foreground" : "text-muted-foreground")}
                  />
                  <span id="mr-term-val" className="flex-1 text-left">
                    {rangeLabel}
                  </span>
                  {/* The count summarizes the range, so it waits for one: it is
                      absent from the prompt state and from the half-made range
                      a veto leaves behind (D18). */}
                  {days > 0 && (
                    <span className="text-muted-foreground text-[12px] font-semibold">
                      {formatDuration(days, locale)}
                    </span>
                  )}
                  <ChevronDown className="text-muted-foreground size-[13px] shrink-0" />
                </button>

                {/* Desktop: in flow, not absolutely positioned, so the body
                    grows and the footer stays pinned. Mobile gets its own layer
                    over the form sheet instead (rendered beside the modal card,
                    below). Unmounted while a create is in flight — that is the
                    whole F11 fix on this surface, so day cells, month nav and
                    Zastosuj need no guards of their own. */}
                {pickerOpen && !busy && !isMobile && (
                  <ManualReservationCalendar
                    locale={locale}
                    variant="popover"
                    busyRanges={ranges}
                    rangesState={rangesState}
                    pickup={pickup}
                    returnDate={returnDate}
                    onChange={(nextPickup, nextReturn) => {
                      setPickup(nextPickup);
                      setReturnDate(nextReturn);
                    }}
                    onApply={() => {
                      setPickerOpen(false);
                    }}
                    onRetry={() => {
                      void refetch();
                    }}
                  />
                )}
              </div>

              <div className="text-muted-foreground mt-2 text-[11.5px] font-[540]">{t("manualHours")}</div>
              <div className="mt-2.5">
                <MrAvailability
                  availability={availability}
                  locale={locale}
                  onRetry={() => {
                    void refetch();
                  }}
                />
              </div>
            </div>

            {/* Klient */}
            <div>
              <div className="text-muted-foreground mb-2 text-[11px] font-bold tracking-[0.4px] uppercase">
                {t("manualCustomer")}
              </div>
              <div className="flex flex-col gap-2">
                {/* Each input owns the row under it, so a message lands beside the
                    field it is about — and, inside the 2-up, under that column
                    only rather than pushing its neighbour down. */}
                <div>
                  <input
                    id="mr-name"
                    aria-label={t("manualNamePlaceholder")}
                    placeholder={t("manualNamePlaceholder")}
                    value={name}
                    disabled={busy}
                    aria-invalid={Boolean(errors.customer_name)}
                    aria-describedby={errors.customer_name ? "mr-name-error" : undefined}
                    onBlur={() => {
                      markTouched("customer_name");
                    }}
                    onChange={(e) => {
                      setName(e.target.value);
                    }}
                    className={MR_INPUT}
                  />
                  <FieldError id="mr-name-error" message={errors.customer_name} />
                </div>
                <div className="grid grid-cols-2 items-start gap-2">
                  <div>
                    <input
                      id="mr-phone"
                      aria-label={t("manualPhonePlaceholder")}
                      placeholder={t("manualPhonePlaceholder")}
                      inputMode="tel"
                      value={phone}
                      disabled={busy}
                      aria-invalid={Boolean(errors.customer_phone)}
                      aria-describedby={errors.customer_phone ? "mr-phone-error" : undefined}
                      onBlur={() => {
                        markTouched("customer_phone");
                      }}
                      onChange={(e) => {
                        setPhone(e.target.value);
                      }}
                      className={MR_INPUT}
                    />
                    <FieldError id="mr-phone-error" message={errors.customer_phone} />
                  </div>
                  <div>
                    <input
                      id="mr-email"
                      aria-label={t("manualEmailPlaceholder")}
                      placeholder={t("manualEmailPlaceholder")}
                      inputMode="email"
                      value={email}
                      disabled={busy}
                      aria-invalid={Boolean(errors.customer_email)}
                      aria-describedby={errors.customer_email ? "mr-email-error" : undefined}
                      onBlur={() => {
                        markTouched("customer_email");
                      }}
                      onChange={(e) => {
                        setEmail(e.target.value);
                      }}
                      className={MR_INPUT}
                    />
                    <FieldError id="mr-email-error" message={errors.customer_email} />
                  </div>
                </div>
                <CustomerLanguage locale={locale} value={customerLocale} onChange={setCustomerLocale} busy={busy} />
              </div>
            </div>

            {banner && (
              <div className="text-destructive rounded-[13px] bg-[var(--flota-danger-soft)] px-[13px] py-3 text-[12.5px] font-semibold">
                {banner}
              </div>
            )}
          </div>
        </div>

        {/* footer */}
        <div className="bg-card flex items-center gap-3 border-t border-[var(--flota-hair-2)] px-[18px] pt-3 pb-[18px] md:px-6 md:pt-3.5 md:pb-5">
          <div className="min-w-0 flex-1">
            <div className="text-muted-foreground text-[11px] font-semibold tracking-[0.3px] uppercase">
              {formatDuration(days, locale)} × {formatPln(vehicle.daily_rate, locale)}
            </div>
            <div className="text-foreground mt-px text-[18px] font-[750] tracking-[-0.5px] tabular-nums">
              {formatPln(total, locale)}{" "}
              <span className="text-muted-foreground text-[11.5px] font-semibold whitespace-nowrap">
                + {formatPlnAmount(vehicle.deposit, locale)} {t("manualDepositTail")}
              </span>
            </div>
          </div>
          <button
            type="button"
            disabled={!canCreate || busy}
            onClick={() => void submit()}
            className={cn(
              "inline-flex h-[46px] shrink-0 items-center justify-center gap-2 rounded-md px-5 text-sm font-[650] text-white",
              // The source greys the button out entirely while the panel reads
              // conflict — `tokens.muted`, on top of the disabled opacity.
              availability.state === "conflict" ? "bg-[var(--muted-foreground)]" : "bg-primary",
              canCreate && !busy ? "shadow-[0_8px_22px_rgba(180,54,56,0.24)]" : "opacity-40",
            )}
          >
            {busy ? (
              <>
                <span className="size-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                {t("manualSubmitting")}
              </>
            ) : (
              <>
                <Check className="size-4" />
                {t("manualSubmit")}
              </>
            )}
          </button>
        </div>
      </div>

      {/* Mobile: the picker is its OWN layer over the form sheet, not an inline
          block inside a scrolling body — in flow it moved under the thumb as the
          body reflowed, and a tap beside the grid could dismiss it mid-range. It
          stops the scrim's click, so the only way out is Zastosuj: no
          outside-click dismiss, so a stray tap cannot discard a half-made range.
          Inside Phase 1's freeze on the same terms as the desktop popover — not
          rendered at all while a create is in flight. */}
      {pickerOpen && !busy && isMobile && (
        <div
          onClick={(e) => {
            e.stopPropagation();
          }}
          className="absolute inset-0 z-[70] flex items-end bg-[rgba(20,18,22,0.5)] backdrop-blur-sm"
        >
          <div className="bg-card w-full rounded-t-[26px] px-4 pt-3.5 pb-[22px] shadow-[0_-10px_40px_rgba(0,0,0,0.22)]">
            <span aria-hidden="true" className="mx-auto mb-3.5 block h-1 w-10 rounded-full bg-[var(--flota-hair)]" />
            <ManualReservationCalendar
              locale={locale}
              variant="sheet"
              busyRanges={ranges}
              rangesState={rangesState}
              pickup={pickup}
              returnDate={returnDate}
              onChange={(nextPickup, nextReturn) => {
                setPickup(nextPickup);
                setReturnDate(nextReturn);
              }}
              onApply={() => {
                setPickerOpen(false);
              }}
              onRetry={() => {
                void refetch();
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
