// core
import * as React from "react";
import { format } from "date-fns";
import { pl } from "date-fns/locale";
import { CheckIcon } from "lucide-react";

// components
import { Checkbox } from "../ui/checkbox";
import { Input } from "../ui/input";
import { Label } from "../ui/label";

// others
import { cn } from "../../lib/utils";
import { fromIsoDate } from "../../lib/date-iso";
import { estimatedTotal, formatDuration, formatPln, rentalDays } from "../../lib/format";
import { reservationRequestSchema } from "../../lib/reservation-schema";

// Reservation flow steps 2–3 — "Twoje dane" then "Podsumowanie" (design
// desktop-2 / mobile-3). The date range is chosen at step 1 (the detail page
// BookingWidget) and arrives fixed via props, so this screen has NO calendar.
// Two internal sub-steps:
//   • "details" (step 2) — the customer fields; "Dalej" advances to review.
//   • "review"  (step 3) — a read-only summary; "Wyślij zgłoszenie" SUBMITS,
//     posting to /api/reservations and redirecting to /r/<token> (the
//     post-submit "request received" page, which is NOT a wizard step).
// Inline validation runs the SAME zod schema the API route enforces, so the
// client and the trust boundary cannot disagree. The 3-step indicator shows
// from step 2 on (D13); done = green ✓, current = navy, upcoming = grey (D12).

interface VehicleSummary {
  id: string;
  label: string;
  year: number | null;
  /** numeric-as-string quirk tolerated, like every money input (src/types.ts). */
  dailyRate: string | number;
  deposit: string | number;
}

interface Props {
  vehicle: VehicleSummary;
  pickup: string;
  return: string;
  /** Back to step 1 (the detail page) with the chosen range pre-filled. */
  backHref: string;
  /** Server-rendered silhouette for the order-summary thumbnail. */
  children?: React.ReactNode;
}

const BRANCH = "Warszawa · Mokotów";

const COPY = {
  eyebrow: "Zarezerwuj pojazd",
  headingDetails: "Twoje dane",
  headingReview: "Podsumowanie",
  backToVehicle: "Wróć do pojazdu",
  backToDetails: "Wróć do danych",
  next: "Dalej",
  submit: "Wyślij zgłoszenie",
  change: "Zmień",
  summary: "Twoja rezerwacja",
  bookingDetails: "Dane rezerwacji",
  customerDetails: "Dane klienta",
  pickup: "Odbiór",
  return: "Zwrot",
  duration: "Czas trwania",
  rate: "Stawka",
  branch: "Oddział",
  estimate: "Szacunkowa cena",
  deposit: "Kaucja",
  terms: "Akceptuję regulamin wynajmu.",
  reassurance: "Bez płatności teraz — potwierdzimy dostępność e-mailem, zwykle w godzinę.",
  fixFields: "Popraw zaznaczone pola.",
  genericError: "Coś poszło nie tak. Spróbuj ponownie.",
} as const;

const STEPS = ["Daty", "Twoje dane", "Podsumowanie"] as const;

// Field ids in visual order — drives "scroll to the first error" on a failed
// submit (the element id matches each field's `id`/`htmlFor`).
const FIELD_ORDER = [
  "customer_name",
  "customer_phone",
  "customer_email",
  "company",
  "vat_id",
  "notes",
  "terms_accepted",
];

type Step = "details" | "review";

interface SubmitSuccess {
  reference: string;
  token: string;
}

interface SubmitFailure {
  error?: string;
  errors?: Record<string, string>;
}

const arrow = (
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

// Round back-chevron control for the mobile header (design mobile-2/3).
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

export default function ReservationForm(props: Props) {
  const { vehicle, pickup, return: returnIso, backHref, children } = props;

  const [step, setStep] = React.useState<Step>("details");
  const [name, setName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [phone, setPhone] = React.useState("");
  const [company, setCompany] = React.useState("");
  const [vatId, setVatId] = React.useState("");
  const [notes, setNotes] = React.useState("");
  const [terms, setTerms] = React.useState(false);
  // Honeypot: real users never see (or fill) this; the API route short-circuits
  // a non-empty value to a benign success without inserting.
  const [honeypot, setHoneypot] = React.useState("");
  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string | undefined>>({});
  const [submitError, setSubmitError] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);

  // The "Popraw zaznaczone pola." banner is DERIVED from the live field errors,
  // so it disappears on its own once the last field is fixed (no stale state).
  // `submitError` holds only the persistent server errors (conflict / generic).
  const hasFieldErrors = Object.values(fieldErrors).some(Boolean);
  const formError = submitError ?? (hasFieldErrors ? COPY.fixFields : null);

  const days = rentalDays(pickup, returnIso);
  const total = estimatedTotal(vehicle.dailyRate, days);
  const pickupDate = fromIsoDate(pickup);
  const returnDate = fromIsoDate(returnIso);
  const datesHeadline =
    pickupDate && returnDate ? `${rangeHeadline(pickupDate, returnDate)} · ${formatDuration(days)}` : "";

  function buildPayload() {
    return {
      vehicle_id: vehicle.id,
      pickup,
      return: returnIso,
      customer_name: name,
      customer_email: email,
      customer_phone: phone,
      company,
      vat_id: vatId,
      notes,
      terms_accepted: terms,
      company_url: honeypot,
    };
  }

  /**
   * Mirror the server contract exactly: run the shared zod schema client-side.
   * Returns the per-field error map on failure, or `null` when valid.
   */
  function validate(): Record<string, string> | null {
    const parsed = reservationRequestSchema.safeParse(buildPayload());
    if (parsed.success) {
      setFieldErrors({});
      return null;
    }
    const errors = firstIssuePerField(parsed.error.issues);
    setFieldErrors(errors);
    return errors;
  }

  /**
   * Scroll to (and focus) the first errored field in visual order. Deferred via
   * a double rAF so the errors — and, on a failed submit from the review step,
   * the switch back to the fields — have committed to the DOM first.
   */
  function scrollToFirstError(errors: Record<string, string>) {
    const id = FIELD_ORDER.find((field) => errors[field]);
    if (!id) {
      return;
    }
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        const el = document.getElementById(id);
        if (!el) {
          return;
        }
        el.scrollIntoView({ behavior: "smooth", block: "center" });
        el.focus({ preventScroll: true });
      }),
    );
  }

  /** Step 2 → 3: validate the fields, then show the review. */
  function handleNext() {
    setSubmitError(null);
    const errors = validate();
    if (errors) {
      scrollToFirstError(errors);
      return;
    }
    setStep("review");
    window.scrollTo({ top: 0 });
  }

  function backToDetails() {
    setSubmitError(null);
    setStep("details");
    window.scrollTo({ top: 0 });
  }

  /** Step 3: submit. The reservation is created and we land on /r/<token>. */
  async function handleSubmit() {
    setSubmitError(null);
    const errors = validate();
    if (errors) {
      setStep("details");
      scrollToFirstError(errors);
      return;
    }
    setSubmitting(true);
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
        const serverErrors = body.errors ?? {};
        setFieldErrors(serverErrors);
        setStep("details");
        scrollToFirstError(serverErrors);
        return;
      }
      setSubmitError(COPY.genericError);
    } catch {
      setSubmitError(COPY.genericError);
    } finally {
      setSubmitting(false);
    }
  }

  // Two-column field grid (design desktop-2): name | phone, email full,
  // company | vat, notes full. The optional B2B fields carry an "(opcj.)" hint
  // and never block submission.
  interface FieldDef {
    id: string;
    label: string;
    type: string;
    autoComplete: string;
    value: string;
    set: (value: string) => void;
    full?: boolean;
  }
  const textFields: FieldDef[] = [
    { id: "customer_name", label: "Imię i nazwisko", type: "text", autoComplete: "name", value: name, set: setName },
    { id: "customer_phone", label: "Telefon", type: "tel", autoComplete: "tel", value: phone, set: setPhone },
    {
      id: "customer_email",
      label: "Email",
      type: "email",
      autoComplete: "email",
      value: email,
      set: setEmail,
      full: true,
    },
    {
      id: "company",
      label: "Firma (opcj.)",
      type: "text",
      autoComplete: "organization",
      value: company,
      set: setCompany,
    },
    { id: "vat_id", label: "NIP (opcj.)", type: "text", autoComplete: "off", value: vatId, set: setVatId },
  ];

  const summaryRows = [
    { label: COPY.pickup, value: pickupDate ? `${format(pickupDate, "d MMM", { locale: pl })} · 14:00` : "—" },
    { label: COPY.return, value: returnDate ? `${format(returnDate, "d MMM", { locale: pl })} · 10:00` : "—" },
    { label: COPY.branch, value: BRANCH },
  ];

  const priceRows = [
    { label: `${formatPln(vehicle.dailyRate)} × ${formatDuration(days)}`, value: formatPln(total) },
    { label: COPY.deposit, value: formatPln(vehicle.deposit) },
  ];

  // Read-only review rows (step 3). Optional B2B fields only appear when filled.
  const reviewBookingRows = [
    { label: COPY.pickup, value: pickupDate ? `${format(pickupDate, "d MMM", { locale: pl })} · 14:00` : "—" },
    { label: COPY.return, value: returnDate ? `${format(returnDate, "d MMM", { locale: pl })} · 10:00` : "—" },
    { label: COPY.duration, value: formatDuration(days) },
    { label: COPY.rate, value: `${formatPln(vehicle.dailyRate)}/doba` },
  ];
  const reviewCustomerRows = [
    { label: "Imię i nazwisko", value: name },
    { label: "Email", value: email },
    { label: "Telefon", value: phone },
    ...(company.trim() ? [{ label: "Firma", value: company }] : []),
    ...(vatId.trim() ? [{ label: "NIP", value: vatId }] : []),
    ...(notes.trim() ? [{ label: "Uwagi", value: notes }] : []),
  ];

  // Step-aware bits.
  const heading = step === "details" ? COPY.headingDetails : COPY.headingReview;
  const primaryLabel = step === "details" ? COPY.next : COPY.submit;
  const onPrimary = step === "details" ? handleNext : () => void handleSubmit();

  function stepState(i: number): "done" | "current" | "upcoming" {
    if (i === 0) return "done"; // Daty — always done (chosen at step 1).
    if (i === 1) return step === "details" ? "current" : "done";
    return step === "review" ? "current" : "upcoming";
  }

  return (
    <>
      {/* Mobile header — round back chevron + centered title (design mobile-2/3).
          No step pills on mobile; the chevron is the step navigation: it exits to
          step 1 (the detail page) from "details", or back to the fields from the
          "review" sub-step. */}
      <div className="flex items-center gap-3 py-4 lg:hidden">
        {step === "details" ? (
          <a href={backHref} aria-label={COPY.backToVehicle} className={CHEVRON_CLASSES}>
            {chevronIcon}
          </a>
        ) : (
          <button type="button" onClick={backToDetails} aria-label={COPY.backToDetails} className={CHEVRON_CLASSES}>
            {chevronIcon}
          </button>
        )}
        <h1 className="text-foreground flex-1 text-center text-xl font-bold tracking-tight">{heading}</h1>
        <span className="size-10 shrink-0" aria-hidden="true" />
      </div>

      {/* Desktop heading + step indicator (design desktop-2): heading left, steps
          right. Indicator is desktop-only — mobile navigates via the chevron. */}
      <div className="hidden py-6 lg:flex lg:items-center lg:justify-between lg:gap-8">
        <div>
          <p className="text-muted-foreground text-[11px] font-semibold tracking-[0.14em] uppercase">{COPY.eyebrow}</p>
          <h1 className="text-foreground mt-1 font-serif text-4xl tracking-tight">{heading}</h1>
          {datesHeadline && <p className="text-muted-foreground mt-2 text-sm">{datesHeadline}</p>}
        </div>

        <ol className="flex shrink-0 items-center gap-2">
          {STEPS.map((label, i) => {
            const state = stepState(i);
            return (
              <li key={label} className="flex items-center gap-2">
                {i > 0 && <span className="w-8 border-t border-[var(--flota-hair-2)]" />}
                {/* Purely visual — navigation is handled by the explicit
                    "Wróć do…" buttons and "Zmień" links. */}
                <span
                  className={cn(
                    "flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
                    state === "done" && "bg-success text-white",
                    state === "current" && "bg-foreground text-background",
                    state === "upcoming" && "bg-card text-muted-foreground border border-[var(--flota-hair-2)]",
                  )}
                >
                  {state === "done" ? <CheckIcon className="size-3.5" /> : i + 1}
                </span>
                <span
                  className={cn(
                    "text-sm font-semibold",
                    state === "upcoming" ? "text-muted-foreground" : "text-foreground",
                    state === "current" && "font-bold",
                  )}
                >
                  {label}
                </span>
              </li>
            );
          })}
        </ol>
      </div>

      <div className="lg:grid lg:grid-cols-[7fr_3fr] lg:items-start lg:gap-10">
        {/* Order summary — sticky right on desktop, on top on mobile (D9, D23). */}
        <aside className="bg-card shadow-card mb-6 rounded-2xl p-6 lg:sticky lg:top-8 lg:col-start-2 lg:row-start-1 lg:mb-0">
          <h2 className="text-muted-foreground text-[11px] font-semibold tracking-wide uppercase">{COPY.summary}</h2>

          <div className="mt-3 flex items-center gap-3">
            <div className="text-foreground w-14 shrink-0">{children}</div>
            <div className="min-w-0">
              <p className="text-foreground truncate text-sm font-bold tracking-tight">{vehicle.label}</p>
              {vehicle.year && <p className="text-muted-foreground text-xs">{vehicle.year}</p>}
            </div>
          </div>

          <dl className="mt-4 divide-y divide-[var(--flota-hair-2)] border-t border-[var(--flota-hair-2)]">
            {summaryRows.map((row) => (
              <div key={row.label} className="flex items-center justify-between gap-3 py-2.5">
                <dt className="text-muted-foreground text-sm font-medium">{row.label}</dt>
                <dd className="text-foreground text-sm font-semibold">{row.value}</dd>
              </div>
            ))}
            {priceRows.map((row) => (
              <div key={row.label} className="flex items-center justify-between gap-3 py-2.5">
                <dt className="text-muted-foreground text-sm font-medium">{row.label}</dt>
                <dd className="text-foreground text-sm font-semibold">{row.value}</dd>
              </div>
            ))}
          </dl>

          {/* Navy estimated-total band (design desktop-2). */}
          <div className="bg-foreground text-background mt-4 flex items-center justify-between gap-3 rounded-xl px-4 py-3">
            <span className="text-sm font-semibold">{COPY.estimate}</span>
            <span className="text-lg font-bold tracking-tight">{formatPln(total)}</span>
          </div>

          <p className="text-muted-foreground mt-4 text-sm leading-snug">{COPY.reassurance}</p>
        </aside>

        {/* Main: step 2 fields OR step 3 review. */}
        <div className="min-w-0 lg:col-start-1 lg:row-start-1">
          {step === "details" ? (
            <section className="bg-card shadow-card rounded-2xl p-5 sm:p-6">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {textFields.map((field) => (
                  <div key={field.id} className={cn("flex flex-col gap-1.5", field.full && "sm:col-span-2")}>
                    <Label htmlFor={field.id}>{field.label}</Label>
                    <Input
                      id={field.id}
                      type={field.type}
                      autoComplete={field.autoComplete}
                      value={field.value}
                      aria-invalid={Boolean(fieldErrors[field.id])}
                      onChange={(e) => {
                        field.set(e.target.value);
                        setFieldErrors(({ [field.id]: _gone, ...rest }) => rest);
                      }}
                    />
                    {fieldErrors[field.id] && (
                      <p className="text-destructive text-sm font-medium">{fieldErrors[field.id]}</p>
                    )}
                  </div>
                ))}

                {/* Notes — full-width textarea (optional). */}
                <div className="flex flex-col gap-1.5 sm:col-span-2">
                  <Label htmlFor="notes">Uwagi dla zespołu (opcj.)</Label>
                  <textarea
                    id="notes"
                    rows={3}
                    value={notes}
                    aria-invalid={Boolean(fieldErrors.notes)}
                    onChange={(e) => {
                      setNotes(e.target.value);
                      setFieldErrors(({ notes: _gone, ...rest }) => rest);
                    }}
                    className="border-input bg-background placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:border-destructive w-full resize-y rounded-md border px-3 py-2 text-sm shadow-xs transition-[color,box-shadow] outline-none focus-visible:ring-[3px]"
                    placeholder="Coś, o czym powinniśmy wiedzieć — ładunek, dodatkowy kierowca, preferowana godzina odbioru…"
                  />
                  {fieldErrors.notes && <p className="text-destructive text-sm font-medium">{fieldErrors.notes}</p>}
                </div>
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
                    {COPY.terms}
                  </Label>
                </div>
                {fieldErrors.terms_accepted && (
                  <p className="text-destructive mt-2 text-sm font-medium">{fieldErrors.terms_accepted}</p>
                )}
              </div>

              {formError && (
                <p className="bg-destructive/10 text-destructive mt-5 rounded-xl px-4 py-3 text-sm font-medium">
                  {formError}
                </p>
              )}

              {/* Buttons inside the card; desktop only (mobile uses the sticky bar). */}
              <div className="mt-6 hidden items-center gap-3 lg:flex">
                <a
                  href={backHref}
                  className="border-input text-foreground hover:bg-accent rounded-button inline-flex h-12 shrink-0 items-center gap-1.5 border bg-transparent px-5 text-sm font-semibold transition-colors"
                >
                  <span aria-hidden="true">‹</span> {COPY.backToVehicle}
                </a>
                <button
                  type="button"
                  onClick={handleNext}
                  className="bg-primary text-primary-foreground rounded-button inline-flex h-12 flex-1 items-center justify-center gap-2 px-7 text-[15px] font-semibold transition-colors hover:bg-[var(--flota-accent-dark)]"
                >
                  {COPY.next}
                  {arrow}
                </button>
              </div>
            </section>
          ) : (
            <section className="bg-card shadow-card rounded-2xl p-5 sm:p-6">
              {/* Booking details — dates change on step 1 (the detail page). */}
              <div className="flex items-center justify-between">
                <h2 className="text-muted-foreground text-[11px] font-semibold tracking-wide uppercase">
                  {COPY.bookingDetails}
                </h2>
                <a href={backHref} className="text-primary text-sm font-semibold hover:underline">
                  {COPY.change}
                </a>
              </div>
              <dl className="mt-2 divide-y divide-[var(--flota-hair-2)]">
                {reviewBookingRows.map((row) => (
                  <div key={row.label} className="flex items-center justify-between gap-3 py-2.5">
                    <dt className="text-muted-foreground text-sm font-medium">{row.label}</dt>
                    <dd className="text-foreground text-sm font-semibold">{row.value}</dd>
                  </div>
                ))}
              </dl>

              {/* Customer details — edit returns to the fields sub-step. */}
              <div className="mt-6 flex items-center justify-between border-t border-[var(--flota-hair-2)] pt-5">
                <h2 className="text-muted-foreground text-[11px] font-semibold tracking-wide uppercase">
                  {COPY.customerDetails}
                </h2>
                <button
                  type="button"
                  onClick={backToDetails}
                  className="text-primary text-sm font-semibold hover:underline"
                >
                  {COPY.change}
                </button>
              </div>
              <dl className="mt-2 divide-y divide-[var(--flota-hair-2)]">
                {reviewCustomerRows.map((row) => (
                  <div key={row.label} className="flex items-start justify-between gap-3 py-2.5">
                    <dt className="text-muted-foreground shrink-0 text-sm font-medium">{row.label}</dt>
                    <dd className="text-foreground min-w-0 text-right text-sm font-semibold break-words">
                      {row.value}
                    </dd>
                  </div>
                ))}
              </dl>

              {formError && (
                <p className="bg-destructive/10 text-destructive mt-5 rounded-xl px-4 py-3 text-sm font-medium">
                  {formError}
                </p>
              )}

              {/* Buttons inside the card; desktop only (mobile uses the sticky bar). */}
              <div className="mt-6 hidden items-center gap-3 lg:flex">
                <button
                  type="button"
                  onClick={backToDetails}
                  className="border-input text-foreground hover:bg-accent rounded-button inline-flex h-12 shrink-0 items-center gap-1.5 border bg-transparent px-5 text-sm font-semibold transition-colors"
                >
                  <span aria-hidden="true">‹</span> {COPY.backToDetails}
                </button>
                <button
                  type="button"
                  onClick={() => void handleSubmit()}
                  disabled={submitting}
                  className="bg-primary text-primary-foreground rounded-button inline-flex h-12 flex-1 items-center justify-center gap-2 px-7 text-[15px] font-semibold transition-colors hover:bg-[var(--flota-accent-dark)] disabled:opacity-60"
                >
                  {COPY.submit}
                  {arrow}
                </button>
              </div>
            </section>
          )}
        </div>
      </div>

      {/* Mobile/tablet sticky CTA (design mobile-2/3): a crimson estimate band
          stacked above a full-width crimson CTA — not a band with a side button.
          Advances (Dalej) on step 2, submits (Wyślij zgłoszenie) on step 3. */}
      <div className="fixed inset-x-0 bottom-0 z-10 border-t border-[var(--flota-hair-2)] bg-[var(--flota-bg)]/92 backdrop-blur lg:hidden">
        <div className="mx-auto max-w-2xl px-5 pt-4 pb-4 sm:px-8">
          <div className="bg-primary text-primary-foreground rounded-button flex items-center justify-between gap-4 px-5 py-4">
            <div className="min-w-0">
              <div className="text-[11px] font-semibold tracking-[0.18em] uppercase opacity-80">{COPY.estimate}</div>
              <div className="mt-0.5 font-bold tracking-tight">
                <span className="text-[2.5rem] leading-none">{formatPln(total).replace(/\s*zł$/, "")}</span>
                <span className="ml-1 text-lg">zł</span>
              </div>
            </div>
            <div className="shrink-0 text-right text-xs leading-snug opacity-80">
              <div>
                {formatDuration(days)} × {formatPln(vehicle.dailyRate)}
              </div>
              <div>+ kaucja {formatPln(vehicle.deposit)}</div>
            </div>
          </div>
          <button
            type="button"
            onClick={onPrimary}
            disabled={submitting}
            className="bg-primary text-primary-foreground rounded-button mt-2 flex h-13 w-full items-center justify-center gap-2 px-6 text-[15px] font-semibold transition-colors hover:bg-[var(--flota-accent-dark)] disabled:opacity-60"
          >
            {primaryLabel}
            {arrow}
          </button>
        </div>
      </div>
    </>
  );
}
