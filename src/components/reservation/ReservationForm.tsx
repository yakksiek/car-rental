// core
import * as React from "react";
import { format } from "date-fns";
import { pl } from "date-fns/locale";
import { CheckIcon } from "lucide-react";
import type { DateRange } from "react-day-picker";

// components
import { Calendar } from "../ui/calendar";
import { Checkbox } from "../ui/checkbox";
import { Input } from "../ui/input";
import { Label } from "../ui/label";

// others
import { cn } from "../../lib/utils";
import { fromIsoDate, toIsoDate } from "../../lib/date-iso";
import { estimatedTotal, formatDailyRate, formatDuration, formatPln, rentalDays } from "../../lib/format";
import { reservationRequestSchema } from "../../lib/reservation-schema";

// The reservation funnel's only interactive piece (design screens 04/05 +
// desktop set): a two-step flow (dates + details → review) with a live
// estimate, submitting to POST /api/reservations. Inline validation runs the
// SAME zod schema the API route enforces (`reservationRequestSchema`), so the
// client and the trust boundary cannot disagree about what a valid payload is.
// The availability pre-check lives server-side in the POST route (Supabase
// credentials are server-only secrets — the browser has no client); an
// overlapping range comes back as a 409 with the Polish conflict message. The
// calendar is the plain range picker — past dates disabled, booked dates NOT
// greyed (resolved design divergence); the EXCLUDE constraint is the authority.

interface VehicleSummary {
  id: string;
  /** numeric-as-string quirk tolerated, like every money input (src/types.ts). */
  dailyRate: string | number;
  deposit: string | number;
}

interface Props {
  vehicle: VehicleSummary;
  /** Where the back chevron exits to from the first step (the vehicle detail). */
  backHref: string;
  initialPickup?: string | null;
  initialReturn?: string | null;
  /** Server-rendered chosen-vehicle card, slotted under the header. */
  children?: React.ReactNode;
}

// Round back-chevron, shared by the step-aware header control.
const CHEVRON_CLASSES =
  "bg-card shadow-card text-foreground hover:bg-accent inline-flex size-10 shrink-0 items-center justify-center rounded-full transition-colors";

const chevronIcon = (
  <svg
    className="size-[18px]"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M19 12H5M11 18l-6-6 6-6" />
  </svg>
);

type Step = "form" | "review";

interface SubmitSuccess {
  reference: string;
  token: string;
}

interface SubmitFailure {
  error?: string;
  errors?: Record<string, string>;
}

const COPY = {
  chooseRange: "Wybierz zakres dat",
  fixFields: "Popraw zaznaczone pola.",
  genericError: "Coś poszło nie tak. Spróbuj ponownie.",
} as const;

/** `24 – 27 marca` (same month shows the pickup day only) / `28 marca – 2 kwietnia`. */
function rangeHeadline(from: Date, to: Date): string {
  const sameMonth = from.getMonth() === to.getMonth() && from.getFullYear() === to.getFullYear();
  const fromLabel = sameMonth ? format(from, "d", { locale: pl }) : format(from, "d MMMM", { locale: pl });
  return `${fromLabel} – ${format(to, "d MMMM", { locale: pl })}`;
}

/** First zod message per top-level field, e.g. `{ customer_email: "Podaj…" }`. */
function firstIssuePerField(issues: { path: PropertyKey[]; message: string }[]): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const issue of issues) {
    const key = String(issue.path[0] ?? "form");
    errors[key] ??= issue.message;
  }
  return errors;
}

export default function ReservationForm({
  vehicle,
  backHref,
  initialPickup = null,
  initialReturn = null,
  children,
}: Props) {
  const [step, setStep] = React.useState<Step>("form");
  const [range, setRange] = React.useState<DateRange | undefined>(() => {
    const from = fromIsoDate(initialPickup);
    const to = fromIsoDate(initialReturn);
    return from || to ? { from, to } : undefined;
  });
  const [name, setName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [phone, setPhone] = React.useState("");
  const [terms, setTerms] = React.useState(false);
  // Honeypot: real users never see (or fill) this; the API route short-circuits
  // a non-empty value to a benign success without inserting.
  const [honeypot, setHoneypot] = React.useState("");
  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string | undefined>>({});
  const [submitError, setSubmitError] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);

  const pickupIso = range?.from ? toIsoDate(range.from) : null;
  const returnIso = range?.to ? toIsoDate(range.to) : null;
  const days = pickupIso && returnIso ? rentalDays(pickupIso, returnIso) : 0;
  const hasEstimate = days > 0;
  const total = hasEstimate ? estimatedTotal(vehicle.dailyRate, days) : 0;

  const dateHeadline =
    range?.from && range.to && hasEstimate
      ? `${rangeHeadline(range.from, range.to)} · ${formatDuration(days)}`
      : COPY.chooseRange;
  const dateError = fieldErrors.pickup ?? fieldErrors.return;

  function buildPayload() {
    return {
      vehicle_id: vehicle.id,
      pickup: pickupIso ?? "",
      return: returnIso ?? "",
      customer_name: name,
      customer_email: email,
      customer_phone: phone,
      terms_accepted: terms,
      company_url: honeypot,
    };
  }

  /** Mirror the server contract exactly: run the shared zod schema client-side. */
  function validate(): boolean {
    const parsed = reservationRequestSchema.safeParse(buildPayload());
    if (parsed.success) {
      setFieldErrors({});
      return true;
    }
    setFieldErrors(firstIssuePerField(parsed.error.issues));
    return false;
  }

  function handleReview() {
    setSubmitError(null);
    if (!validate()) {
      return;
    }
    setStep("review");
    window.scrollTo({ top: 0 });
  }

  function backToForm() {
    setSubmitError(null);
    setStep("form");
    window.scrollTo({ top: 0 });
  }

  async function handleSubmit() {
    setSubmitting(true);
    setSubmitError(null);
    try {
      const res = await fetch("/api/reservations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildPayload()),
      });

      if (res.status === 201) {
        const body = (await res.json()) as SubmitSuccess;
        window.location.assign(`/r/${body.token}`);
        return;
      }

      const body = (await res.json().catch(() => ({}))) as SubmitFailure;
      if (res.status === 409) {
        // Conflict ("pojazd właśnie został zarezerwowany") or vehicle gone.
        setSubmitError(body.error ?? COPY.genericError);
        return;
      }
      if (res.status === 400) {
        setFieldErrors(body.errors ?? {});
        setSubmitError(COPY.fixFields);
        setStep("form");
        window.scrollTo({ top: 0 });
        return;
      }
      setSubmitError(COPY.genericError);
    } catch {
      setSubmitError(COPY.genericError);
    } finally {
      setSubmitting(false);
    }
  }

  const ctaLabel = step === "form" ? "Podsumowanie" : "Wyślij zgłoszenie";
  const handleCta = step === "form" ? handleReview : () => void handleSubmit();

  const ctaArrow = (
    <svg
      className="size-4"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  );

  const summaryRows = [
    { label: "Stawka", value: formatDailyRate(vehicle.dailyRate) },
    { label: "Czas trwania", value: hasEstimate ? formatDuration(days) : "—" },
    { label: "Szacunkowa cena", value: hasEstimate ? formatPln(total) : "—" },
    { label: "Kaucja", value: formatPln(vehicle.deposit) },
  ];

  const reviewBookingRows =
    range?.from && range.to
      ? [
          { label: "Odbiór", value: `${format(range.from, "d MMM", { locale: pl })} · 14:00` },
          { label: "Zwrot", value: `${format(range.to, "d MMM", { locale: pl })} · 10:00` },
          { label: "Czas trwania", value: formatDuration(days) },
          { label: "Stawka", value: formatDailyRate(vehicle.dailyRate) },
        ]
      : [];

  const reviewCustomerRows = [
    { label: "Imię i nazwisko", value: name },
    { label: "Email", value: email },
    { label: "Telefon", value: phone },
  ];

  const fields = [
    {
      id: "customer_name",
      label: "Imię i nazwisko",
      type: "text",
      autoComplete: "name",
      value: name,
      onChange: setName,
    },
    {
      id: "customer_email",
      label: "Email",
      type: "email",
      autoComplete: "email",
      value: email,
      onChange: setEmail,
    },
    {
      id: "customer_phone",
      label: "Telefon",
      type: "tel",
      autoComplete: "tel",
      value: phone,
      onChange: setPhone,
    },
  ];

  return (
    <>
      {/* Step-aware header: on the form step the chevron exits to the vehicle
          under the "Rezerwacja" title; on review it becomes a labeled back
          control ("Wróć do danych") that walks one step back to the form. */}
      <div className="flex items-center gap-3 py-5">
        {step === "form" ? (
          <>
            <a href={backHref} aria-label="Wróć do pojazdu" className={CHEVRON_CLASSES}>
              {chevronIcon}
            </a>
            <h1 className="text-foreground text-2xl font-bold tracking-tight">Rezerwacja</h1>
          </>
        ) : (
          <button type="button" onClick={backToForm} className="group flex items-center gap-3">
            <span className={cn(CHEVRON_CLASSES, "group-hover:bg-accent")}>{chevronIcon}</span>
            <span className="text-foreground text-2xl font-bold tracking-tight">Wróć do danych</span>
          </button>
        )}
      </div>

      {/* Chosen-vehicle card (server-rendered slot). */}
      {children}

      <div className="pb-40 lg:grid lg:grid-cols-[1fr_360px] lg:items-start lg:gap-10 lg:pb-16">
        <div className="min-w-0">
          {/* Desktop step indicator (Daty · Twoje dane · Potwierdzenie). The flow
              is two screens; the first covers steps 1–2. From review, the earlier
              pills are clickable shortcuts back to the form. */}
          <ol className="hidden items-center gap-2 pb-5 lg:flex">
            {["Daty", "Twoje dane", "Potwierdzenie"].map((label, i) => {
              // The form screen covers steps 1–2 (both "current"); review marks
              // those done and makes Potwierdzenie the current step. The current
              // step is rendered slightly larger so "you are here" is obvious.
              const state = step === "review" ? (i < 2 ? "done" : "current") : i < 2 ? "current" : "upcoming";
              const canGoBack = state === "done";
              const inner = (
                <>
                  <span
                    className={cn(
                      "flex shrink-0 items-center justify-center rounded-full font-semibold transition-colors",
                      state === "current" && "bg-primary text-primary-foreground ring-primary/20 size-7 text-xs ring-4",
                      state === "done" &&
                        "bg-primary text-primary-foreground size-6 text-[11px] group-hover:bg-[var(--flota-accent-dark)]",
                      state === "upcoming" &&
                        "bg-card text-muted-foreground size-6 border border-[var(--flota-hair-2)] text-[11px]",
                    )}
                  >
                    {state === "done" ? <CheckIcon className="size-3.5" /> : i + 1}
                  </span>
                  <span
                    className={cn(
                      "text-sm group-hover:underline group-hover:underline-offset-4",
                      state === "current" ? "text-foreground font-bold" : "font-semibold",
                      state === "upcoming" ? "text-muted-foreground" : "text-foreground",
                    )}
                  >
                    {label}
                  </span>
                </>
              );
              return (
                <li key={label} className="flex items-center gap-2">
                  {i > 0 && <span className="w-6 border-t border-[var(--flota-hair-2)]" />}
                  {canGoBack ? (
                    <button
                      type="button"
                      onClick={backToForm}
                      aria-label={`Wróć do kroku: ${label}`}
                      className="group flex cursor-pointer items-center gap-2 rounded-full"
                    >
                      {inner}
                    </button>
                  ) : (
                    <div className="flex items-center gap-2">{inner}</div>
                  )}
                </li>
              );
            })}
          </ol>

          {step === "form" ? (
            <div className="flex flex-col gap-6">
              {/* Date range — plain range picker; past disabled, NO booked-date greying. */}
              <section className="bg-card shadow-card rounded-2xl p-5">
                <h2 className="text-muted-foreground text-[11px] font-semibold tracking-wide uppercase">Daty</h2>
                <p className="text-foreground mt-1.5 text-lg font-bold tracking-tight">{dateHeadline}</p>
                <div className="mt-2 flex justify-center">
                  <Calendar
                    mode="range"
                    selected={range}
                    onSelect={(next) => {
                      setRange(next);
                      setFieldErrors(({ pickup: _p, return: _r, ...rest }) => rest);
                      setSubmitError(null);
                    }}
                    numberOfMonths={1}
                    disabled={{ before: new Date(new Date().setHours(0, 0, 0, 0)) }}
                    locale={pl}
                    formatters={{
                      formatCaption: (date) => format(date, "LLLL yyyy", { locale: pl }).toUpperCase(),
                    }}
                  />
                </div>
                {dateError && <p className="text-destructive mt-2 text-sm font-medium">{dateError}</p>}
              </section>

              {/* Customer details */}
              <section className="bg-card shadow-card rounded-2xl p-5">
                <h2 className="text-muted-foreground text-[11px] font-semibold tracking-wide uppercase">Twoje dane</h2>
                <div className="mt-4 flex flex-col gap-4">
                  {fields.map((field) => (
                    <div key={field.id} className="flex flex-col gap-1.5">
                      <Label htmlFor={field.id}>{field.label}</Label>
                      <Input
                        id={field.id}
                        type={field.type}
                        autoComplete={field.autoComplete}
                        value={field.value}
                        aria-invalid={Boolean(fieldErrors[field.id])}
                        onChange={(e) => {
                          field.onChange(e.target.value);
                          setFieldErrors(({ [field.id]: _gone, ...rest }) => rest);
                        }}
                      />
                      {fieldErrors[field.id] && (
                        <p className="text-destructive text-sm font-medium">{fieldErrors[field.id]}</p>
                      )}
                    </div>
                  ))}
                </div>

                {/* Honeypot — visually hidden; bots fill it, people never see it. */}
                <div className="sr-only" aria-hidden="true">
                  <label htmlFor="company_url">Firmowa strona WWW</label>
                  <input
                    id="company_url"
                    name="company_url"
                    type="text"
                    tabIndex={-1}
                    autoComplete="off"
                    value={honeypot}
                    onChange={(e) => {
                      setHoneypot(e.target.value);
                    }}
                  />
                </div>

                <div className="mt-5 border-t border-[var(--flota-hair-2)] pt-4">
                  <div className="flex items-start gap-3">
                    <Checkbox
                      id="terms_accepted"
                      checked={terms}
                      aria-invalid={Boolean(fieldErrors.terms_accepted)}
                      onCheckedChange={(checked) => {
                        setTerms(checked === true);
                        setFieldErrors(({ terms_accepted: _gone, ...rest }) => rest);
                      }}
                      className="mt-0.5"
                    />
                    <Label htmlFor="terms_accepted" className="text-foreground text-sm leading-snug font-medium">
                      Akceptuję regulamin wynajmu.
                    </Label>
                  </div>
                  {fieldErrors.terms_accepted && (
                    <p className="text-destructive mt-2 text-sm font-medium">{fieldErrors.terms_accepted}</p>
                  )}
                </div>
              </section>
            </div>
          ) : (
            <div className="flex flex-col gap-6">
              <h2 className="text-foreground font-serif text-3xl tracking-tight">Przegląd zgłoszenia</h2>

              {/* Booking details */}
              <section className="bg-card shadow-card rounded-2xl p-5">
                <div className="flex items-center justify-between">
                  <h3 className="text-muted-foreground text-[11px] font-semibold tracking-wide uppercase">
                    Dane rezerwacji
                  </h3>
                  <button
                    type="button"
                    onClick={backToForm}
                    className="text-primary text-sm font-semibold hover:underline"
                  >
                    Zmień
                  </button>
                </div>
                <dl className="mt-2 divide-y divide-[var(--flota-hair-2)]">
                  {reviewBookingRows.map((row) => (
                    <div key={row.label} className="flex items-center justify-between gap-3 py-3">
                      <dt className="text-muted-foreground text-sm font-medium">{row.label}</dt>
                      <dd className="text-foreground text-sm font-semibold">{row.value}</dd>
                    </div>
                  ))}
                </dl>
              </section>

              {/* Customer details */}
              <section className="bg-card shadow-card rounded-2xl p-5">
                <div className="flex items-center justify-between">
                  <h3 className="text-muted-foreground text-[11px] font-semibold tracking-wide uppercase">
                    Dane klienta
                  </h3>
                  <button
                    type="button"
                    onClick={backToForm}
                    className="text-primary text-sm font-semibold hover:underline"
                  >
                    Zmień
                  </button>
                </div>
                <dl className="mt-2 divide-y divide-[var(--flota-hair-2)]">
                  {reviewCustomerRows.map((row) => (
                    <div key={row.label} className="flex items-center justify-between gap-3 py-3">
                      <dt className="text-muted-foreground text-sm font-medium">{row.label}</dt>
                      <dd className="text-foreground min-w-0 truncate text-sm font-semibold">{row.value}</dd>
                    </div>
                  ))}
                </dl>
              </section>
            </div>
          )}

          {submitError && (
            <p className="bg-destructive/10 text-destructive mt-6 rounded-xl px-4 py-3 text-sm font-medium">
              {submitError}
            </p>
          )}
        </div>

        {/* Desktop order summary (sticky side card). */}
        <aside className="bg-card shadow-card sticky top-8 hidden rounded-2xl p-6 lg:block">
          <h2 className="text-muted-foreground text-[11px] font-semibold tracking-wide uppercase">Podsumowanie</h2>
          <dl className="mt-2 divide-y divide-[var(--flota-hair-2)]">
            {summaryRows.map((row) => (
              <div key={row.label} className="flex items-center justify-between gap-3 py-3">
                <dt className="text-muted-foreground text-sm font-medium">{row.label}</dt>
                <dd className="text-foreground text-sm font-semibold">{row.value}</dd>
              </div>
            ))}
          </dl>
          <button
            type="button"
            onClick={handleCta}
            disabled={submitting}
            className="bg-primary text-primary-foreground mt-5 flex h-12 w-full items-center justify-center gap-2 rounded-full px-6 text-[15px] font-semibold transition-colors hover:bg-[var(--flota-accent-dark)] disabled:opacity-60"
          >
            {ctaLabel}
            {ctaArrow}
          </button>
          <p className="text-muted-foreground mt-4 text-sm leading-snug">
            Bez płatności teraz — potwierdzimy dostępność e-mailem, zwykle w godzinę.
          </p>
        </aside>

        {/* Mobile/tablet sticky estimate bar (crimson). */}
        <div className="bg-primary text-primary-foreground fixed inset-x-0 bottom-0 z-10 lg:hidden">
          <div className="mx-auto flex max-w-2xl items-center justify-between gap-4 px-5 py-4 sm:px-8">
            <div className="min-w-0">
              <div className="text-[10px] font-semibold tracking-wide uppercase opacity-80">Szacunkowa cena</div>
              <div className="text-xl font-bold tracking-tight">{hasEstimate ? formatPln(total) : "—"}</div>
              <div className="truncate text-xs opacity-80">
                {hasEstimate ? `${formatDuration(days)} × ${formatPln(vehicle.dailyRate)} · ` : ""}+ kaucja{" "}
                {formatPln(vehicle.deposit)}
              </div>
            </div>
            <button
              type="button"
              onClick={handleCta}
              disabled={submitting}
              className="bg-background text-foreground flex h-12 shrink-0 items-center justify-center gap-2 rounded-full px-5 text-sm font-semibold transition hover:opacity-90 disabled:opacity-60"
            >
              {ctaLabel}
              {ctaArrow}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
