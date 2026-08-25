// core
import * as React from "react";
import { AlertTriangle, KeyRound, Plus, Search, Send, ShieldCheck, User, X } from "lucide-react";

// components
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import QuickAddButton from "../dashboard/QuickAddButton";

// others
import { cn } from "../../lib/utils";
import { formatLastActive, plForm, staffInitials } from "../../lib/staff-format";
import {
  type AddOutcome,
  type Report,
  type ReportTone,
  inviteActionLabel,
  resolveAddReport,
  resolveRemoveReport,
  resolveRowActionReport,
} from "../../lib/staff-report";
import { employeeInviteSchema, type StaffMember } from "../../lib/services/staff";

// Employees admin roster (S-08 Phase 4). One responsive surface over the
// SSR-loaded staff list: filter tabs (desktop) / chips (mobile) + name/email
// search, a table at md+ and stacked cards below, plus add / remove(typed
// confirm) / reset-password actions. Feedback is an inline banner + optimistic
// list mutation (no toast). Built to design-contract.md §3.1–3.13. Polish copy
// canonical.

const COPY = {
  title: "Pracownicy",
  titleMobile: "Zespół",
  searchPlaceholder: "Imię lub e-mail…",
  add: "Dodaj pracownika",
  tabAll: "Wszyscy",
  tabActive: "Aktywny",
  tabInvited: "Zaproszony",
  tabCreated: "Dodany",
  tabAdmin: "Administrator",
  colName: "Imię i nazwisko",
  colRole: "Rola",
  colStatus: "Status",
  colLastActive: "Ostatnia aktywność",
  selfSuffix: "· Ty",
  roleAdmin: "ADMINISTRATOR",
  roleEmployee: "PRACOWNIK",
  statusActive: "AKTYWNY",
  statusInvited: "ZAPROSZONY",
  statusCreated: "DODANY",
  reset: "Resetuj hasło",
  removeAria: "Usuń pracownika",
  resetAria: "Resetuj hasło",
  footerBold: "Nie możesz usunąć siebie.",
  footerRest: " Poproś innego administratora o usunięcie Twojego konta.",
  // add modal — step 1 of two. The subtitle and the CTA both stopped promising
  // an email when the add stopped sending one (design-contract §9.2): the CTA
  // now names what the button does (`Dodaj`, matching the modal's own title),
  // and `Wyślij zaproszenie` moved to the row action that really sends.
  addTitle: "Dodaj pracownika",
  addSubtitle: "Konto powstanie od razu. Zaproszenie wyślesz w kolejnym kroku.",
  labelName: "IMIĘ I NAZWISKO",
  labelEmail: "ADRES E-MAIL",
  cancel: "Anuluj",
  addConfirm: "Dodaj",
  adding: "Dodawanie…",
  // Row action — TWO labels, one per password-less state (owner, 2026-08-21):
  // a first send on a DODANY row, a resend on a ZAPROSZONY one, where reusing
  // the first-send wording read as if nothing had been sent yet. Both are
  // authored in `lib/staff-report.ts` rather than here, because
  // `repairedMailFailed` has to NAME whichever button that row shows — the
  // coupling that made a single shared label tempting in the first place.
  sendInvite: inviteActionLabel,
  sending: "Wysyłanie…",
  close: "Zamknij",
  // remove modal
  removeTitle: "Usunąć tego pracownika?",
  removeBodyTail: " — Utraci dostęp natychmiast. Zakończone protokoły pozostają w archiwum.",
  confirmLabel: "WPISZ E-MAIL, ABY POTWIERDZIĆ",
  remove: "Usuń",
  // last-admin modal
  lastAdminTitle: "Nie można usunąć ostatniego administratora",
  lastAdminBody: "Musi pozostać co najmniej jeden administrator. Najpierw awansuj inną osobę.",
  // states
  emptyTitle: "Brak pracowników",
  emptyHint: "Dodaj pierwszą osobę — zaproszenie wyślesz w kolejnym kroku.",
  noResultsTitle: "Brak wyników",
  noResultsHint: "Żaden pracownik nie pasuje do wyszukiwania. Spróbuj innego imienia lub e-maila.",
  // banners
  //
  // No message string lives here any more. `mutationError`, `inviteSent`,
  // `resetSent` and `repairedMailFailed` all moved into `lib/staff-report.ts`
  // alongside the routing that places them, so the outcome→surface table owns
  // every arm's words rather than owning some of them (phase 10 §1). What stays
  // are the two CONTROL labels the banner renders, which belong to the island.
  // The dismiss control phase 10 §3 owes the sticky banner reuses `close` above
  // — the shipped `ModalShell` label — rather than authoring a second word for
  // the same affordance. (`genericError` used to sit here and was dead: nothing
  // referenced it. Removed with the strings that moved.)
  retry: "Ponów",
  // mobile
  eyebrowMobileWord: (n: number) => `${n} ${plForm(n, "osoba", "osoby", "osób").toUpperCase()}`,
  chipActive: "Aktywni",
  chipInvited: "Zaproszeni",
  chipCreated: "Dodani",
  chipAdmin: "Administratorzy",
  roleAdminMobile: "ADMIN",
  statusActiveMobile: "Aktywny",
  statusInvitedMobile: "Zaproszony",
  statusCreatedMobile: "Dodany",
  footerMobile: "Pracownicy mogą też zresetować swoje hasło z ekranu logowania.",
} as const;

// 16px content cards (design source = borderRadius:16 = rounded-lg). The project
// remaps the Tailwind radius scale in global.css: rounded-lg=16px, rounded-xl=20px.
// (28px is sheet-only — applied as an explicit rounded-t-[28px], not a utility.)
const cardClass = "rounded-lg border border-border bg-card shadow-card";

type Filter = "all" | "active" | "invited" | "created" | "admin";

// What the island holds for a banner it has been told to render. `tone` and
// `msg` come straight off the `Report`; `retry` is the callback the module can
// only ask for (`offersRetry`), never supply.
interface Banner {
  tone: ReportTone;
  msg: string;
  retry?: () => void;
}

// ── avatar ───────────────────────────────────────────────────────────────────

function Avatar({ member, className }: { member: StaffMember; className?: string }) {
  const isAdmin = member.role === "admin";
  return (
    <span
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full font-bold",
        isAdmin ? "bg-primary text-primary-foreground" : "bg-foreground text-background",
        className,
      )}
      aria-hidden="true"
    >
      {staffInitials(member.fullName, member.email)}
    </span>
  );
}

// ── badges (§3.4) ─────────────────────────────────────────────────────────────

function RoleBadge({ role, mobile = false }: { role: StaffMember["role"]; mobile?: boolean }) {
  if (role === "admin") {
    return (
      <Badge className="text-primary gap-1 bg-[var(--flota-danger-soft)]">
        <KeyRound className="size-3" />
        {mobile ? COPY.roleAdminMobile : COPY.roleAdmin}
      </Badge>
    );
  }
  return (
    <Badge className="text-muted-foreground bg-muted gap-1">
      <User className="size-3" />
      {COPY.roleEmployee}
    </Badge>
  );
}

// Three tones, transcribed from the design's `EmpStatusBadge`: green
// (success) = AKTYWNY, amber (warning) = ZAPROSZONY, neutral grey = DODANY.
// The grey pair is `--flota-neutral` / `--flota-neutral-soft` — the palette's
// own "inert state" colours, sampled #64748B on #EEF1F5 off the design board —
// and has no semantic Tailwind utility here, hence the explicit var(). Additive:
// the two shipped arms render byte-identically to before.
const STATUS_TONE = {
  active: { label: COPY.statusActive, mobile: COPY.statusActiveMobile, text: "text-success", dot: "bg-success" },
  invited: { label: COPY.statusInvited, mobile: COPY.statusInvitedMobile, text: "text-warning", dot: "bg-warning" },
  created: {
    label: COPY.statusCreated,
    mobile: COPY.statusCreatedMobile,
    text: "text-[var(--flota-neutral)]",
    dot: "bg-[var(--flota-neutral)]",
  },
} as const;

const STATUS_SOFT: Record<StaffMember["status"], string> = {
  active: "bg-[var(--flota-success-soft)]",
  invited: "bg-[var(--flota-warning-soft)]",
  created: "bg-[var(--flota-neutral-soft)]",
};

function StatusBadge({ status }: { status: StaffMember["status"] }) {
  const tone = STATUS_TONE[status];
  return (
    <Badge className={cn("gap-1.5", tone.text, STATUS_SOFT[status])}>
      <span className={cn("size-1.5 rounded-full", tone.dot)} />
      {tone.label}
    </Badge>
  );
}

// Filter pill — shared by the desktop white bar (bare=false) and the
// mobile/tablet wrapping row (bare=true → inactive pills get a white card+border
// so they read on the grey background).
function TabButton({
  t,
  active,
  onClick,
  bare = false,
}: {
  t: { key: Filter; label: string; count: number };
  active: boolean;
  onClick: () => void;
  bare?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "flex items-center gap-2 rounded-full px-4 py-2 text-sm font-[540] tracking-tight transition-colors",
        active
          ? "bg-foreground text-background"
          : bare
            ? "border-border bg-card shadow-card text-foreground border"
            : "text-foreground hover:bg-background",
      )}
    >
      {t.label}
      <span
        className={cn(
          "flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-xs font-bold",
          active ? "text-background bg-white/20" : "bg-muted text-muted-foreground",
        )}
      >
        {t.count}
      </span>
    </button>
  );
}

// ── modal shell (mirrors RetireDialog) ────────────────────────────────────────

function ModalShell({
  onClose,
  children,
  showClose = false,
}: {
  onClose: () => void;
  children: React.ReactNode;
  showClose?: boolean;
}) {
  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center bg-[rgba(20,18,22,0.55)] backdrop-blur-sm md:items-center"
      onClick={onClose}
    >
      <div
        onClick={(e) => {
          e.stopPropagation();
        }}
        className="bg-card shadow-overlay relative w-full rounded-t-[28px] p-6 pb-8 md:max-w-md md:rounded-xl"
      >
        <div className="bg-border mx-auto mb-4 h-1 w-10 rounded-full md:hidden" />
        {showClose && (
          <button
            type="button"
            onClick={onClose}
            aria-label={COPY.close}
            className="bg-muted text-muted-foreground hover:text-foreground absolute top-4 right-4 flex size-8 items-center justify-center rounded-full"
          >
            <X className="size-4" />
          </button>
        )}
        {children}
      </div>
    </div>
  );
}

// ── add-employee modal (§3.6) ─────────────────────────────────────────────────

function AddModal({
  busy,
  onClose,
  onSubmit,
}: {
  busy: boolean;
  onClose: () => void;
  onSubmit: (values: { full_name: string; email: string }) => Promise<Report>;
}) {
  const [fullName, setFullName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [errors, setErrors] = React.useState<{ full_name?: string; email?: string }>({});
  // Two server-side error slots, one per shape of failure. `dup` belongs to the
  // e-mail the admin typed (the shipped idiom); `formError` belongs to the
  // SUBMISSION — a provisioning failure or a dropped connection attaches to no
  // field, and before phase 9 it had nowhere to go but a banner the modal's own
  // overlay painted over. `resolveAddReport` decides which one a response fills.
  const [dup, setDup] = React.useState<string | null>(null);
  const [formError, setFormError] = React.useState<string | null>(null);
  const emailInvalid = Boolean(errors.email) || dup !== null;

  async function submit(e: React.SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    const parsed = employeeInviteSchema.safeParse({ full_name: fullName, email });
    if (!parsed.success) {
      const next: typeof errors = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path[0];
        if (typeof key === "string" && !(key in next)) next[key as keyof typeof errors] = issue.message;
      }
      setErrors(next);
      return;
    }
    setErrors({});
    setDup(null);
    setFormError(null);
    const report = await onSubmit(parsed.data);
    if (report.slot === "email") setDup(report.message);
    else if (report.slot === "form") setFormError(report.message);
  }

  const inputBase = "border-border bg-background text-foreground h-11 w-full rounded-xl border px-3.5 text-sm";
  const labelBase = "text-muted-foreground mb-1.5 block text-[11px] font-bold tracking-wide uppercase";

  return (
    <ModalShell onClose={onClose} showClose>
      <form onSubmit={submit}>
        <div className="text-foreground text-xl font-bold tracking-tight">{COPY.addTitle}</div>
        <p className="text-muted-foreground mt-1 text-sm leading-relaxed">{COPY.addSubtitle}</p>

        <div className="mt-5 flex flex-col gap-4">
          <div>
            <label htmlFor="staff-name" className={labelBase}>
              {COPY.labelName}
            </label>
            <input
              id="staff-name"
              type="text"
              value={fullName}
              onChange={(e) => {
                setFullName(e.target.value);
                setFormError(null);
                if (errors.full_name) setErrors((p) => ({ ...p, full_name: undefined }));
              }}
              className={cn(inputBase, errors.full_name && "border-destructive")}
              autoComplete="off"
            />
            {errors.full_name && (
              <p className="text-destructive mt-1.5 flex items-center gap-1.5 text-[13px]">
                <AlertTriangle className="size-3.5" />
                {errors.full_name}
              </p>
            )}
          </div>
          <div>
            <label htmlFor="staff-email" className={labelBase}>
              {COPY.labelEmail}
            </label>
            <input
              id="staff-email"
              type="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                setDup(null);
                setFormError(null);
                if (errors.email) setErrors((p) => ({ ...p, email: undefined }));
              }}
              className={cn(inputBase, emailInvalid && "border-destructive bg-[var(--flota-danger-soft)]")}
              autoComplete="off"
            />
            {emailInvalid && (
              <p className="text-destructive mt-1.5 flex items-center gap-1.5 text-[13px]">
                <AlertTriangle className="size-3.5" />
                {dup ?? errors.email}
              </p>
            )}
          </div>
        </div>

        {/* Form-level error (§8.4) — the submission failed, and it belongs to no
            field. Type ramp, colour, glyph and gap are the field-level idiom
            above, verbatim. Three properties differ, and all three are because
            this string WRAPS where a field error never does — measured at 2 lines
            at both breakpoints (400px desktop, 342px mobile), not assumed:
            `items-start` + `mt-0.5` put the glyph on the first line instead of
            floating it on the line boundary (the app's own idiom for a glyph
            leading wrapping text — `ReservationForm.tsx:531,540`,
            `pricing.astro:258`), and `shrink-0` stops the 14px glyph being
            squeezed. `mt-5` is the modal's block rhythm, matching above and below. */}
        {formError && (
          <p role="alert" className="text-destructive mt-5 flex items-start gap-1.5 text-[13px]">
            <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
            {formError}
          </p>
        )}

        <div className="mt-5 flex gap-2.5">
          <Button type="button" variant="outline" className="h-12 flex-1" disabled={busy} onClick={onClose}>
            {COPY.cancel}
          </Button>
          {/* Stays enabled through a form-level error — it IS the retry now, and
              the typed values are still in the fields behind it. Only a duplicate
              disables it, because retrying that address cannot succeed until the
              admin edits it. */}
          <Button
            type="submit"
            className="bg-primary text-primary-foreground h-12 flex-1 gap-2"
            disabled={busy || dup !== null}
          >
            {busy ? (
              <>
                <span className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                {COPY.adding}
              </>
            ) : (
              <>
                <Plus className="size-4" />
                {COPY.addConfirm}
              </>
            )}
          </Button>
        </div>
      </form>
    </ModalShell>
  );
}

// ── remove / typed-confirm modal (§3.7) ───────────────────────────────────────

function RemoveModal({
  member,
  busy,
  onClose,
  onConfirm,
}: {
  member: StaffMember;
  busy: boolean;
  onClose: () => void;
  onConfirm: (confirmEmail: string) => Promise<Report>;
}) {
  const [typed, setTyped] = React.useState("");
  // The form-level slot phase 10 §2 adds. `RemoveModal` had no error slot at
  // all — unlike `AddModal`, which had two field-level ones to generalise from
  // — because both of its failure arms used to set the roster banner and leave
  // this modal open. That put the message off-screen while the admin was
  // scrolled, and under `ModalShell`'s own overlay once they scrolled up to it.
  const [formError, setFormError] = React.useState<string | null>(null);
  const matches = typed.trim().toLowerCase() === member.email.toLowerCase();

  async function confirm() {
    setFormError(null);
    const report = await onConfirm(typed.trim());
    if (report.slot === "form") setFormError(report.message);
  }

  return (
    <ModalShell onClose={onClose}>
      <div className="text-destructive flex size-12 items-center justify-center rounded-lg bg-[var(--flota-danger-soft)]">
        <AlertTriangle className="size-6" />
      </div>
      <div className="text-foreground mt-4 text-xl font-bold tracking-tight">{COPY.removeTitle}</div>
      <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
        <span className="text-foreground font-[650]">{member.fullName ?? member.email}</span>
        {COPY.removeBodyTail}
      </p>
      <label
        htmlFor="confirm-email"
        className="text-muted-foreground mt-4 block text-[11px] font-bold tracking-wide uppercase"
      >
        {COPY.confirmLabel}
      </label>
      <input
        id="confirm-email"
        type="email"
        value={typed}
        onChange={(e) => {
          setTyped(e.target.value);
          setFormError(null);
        }}
        placeholder={member.email}
        autoComplete="off"
        className="border-border bg-background text-foreground mt-1.5 h-11 w-full rounded-xl border px-3.5 font-mono text-sm"
      />

      {/* Form-level error (§8.5) — inherited-exact from the add modal's §8.4
          slot: colour, type ramp, glyph, gap, `items-start`, `shrink-0` and
          `role="alert"` are that element verbatim, and this modal's content
          column is the same 400px / 342px, so the wrap behaviour transfers with
          them. `mt-5` is the ONE value measured here rather than inherited: the
          slot lands between a bare input (`mt-1.5` above it) and the button row,
          and that gap measures 20px, so a 20/20 split keeps the modal's own
          block rhythm instead of borrowing the add modal's field-group rhythm. */}
      {formError && (
        <p role="alert" className="text-destructive mt-5 flex items-start gap-1.5 text-[13px]">
          <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
          {formError}
        </p>
      )}

      <div className="mt-5 flex gap-2.5">
        <Button variant="outline" className="h-12 flex-1" disabled={busy} onClick={onClose}>
          {COPY.cancel}
        </Button>
        {/* Stays enabled through a form-level error — it IS the retry now, and
            the typed confirmation is still in the field behind it, so there is
            exactly one retry control on screen for one failure. */}
        <Button variant="destructive" className="h-12 flex-1 gap-2" disabled={busy || !matches} onClick={confirm}>
          {busy && <span className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent" />}
          {COPY.remove}
        </Button>
      </div>
    </ModalShell>
  );
}

// ── last-admin refusal modal (§3.8) ───────────────────────────────────────────

function LastAdminModal({ onClose }: { onClose: () => void }) {
  return (
    <ModalShell onClose={onClose}>
      <div className="text-warning flex size-12 items-center justify-center rounded-lg bg-[var(--flota-warning-soft)]">
        <ShieldCheck className="size-6" />
      </div>
      <div className="text-foreground mt-4 text-xl leading-snug font-bold tracking-tight">{COPY.lastAdminTitle}</div>
      <p className="text-muted-foreground mt-2 text-sm leading-relaxed">{COPY.lastAdminBody}</p>
      <Button className="bg-foreground text-background hover:bg-foreground/90 mt-5 h-12 w-full" onClick={onClose}>
        {COPY.cancel}
      </Button>
    </ModalShell>
  );
}

// ── main island ──────────────────────────────────────────────────────────────

export default function StaffList({ staff: initial, currentUserId }: { staff: StaffMember[]; currentUserId: string }) {
  const [staff, setStaff] = React.useState<StaffMember[]>(initial);
  const [search, setSearch] = React.useState("");
  const [filter, setFilter] = React.useState<Filter>("all");
  const [addOpen, setAddOpen] = React.useState(false);
  const [removeFor, setRemoveFor] = React.useState<StaffMember | null>(null);
  const [lastAdminOpen, setLastAdminOpen] = React.useState(false);
  const [busyId, setBusyId] = React.useState<string | null>(null);
  const [addBusy, setAddBusy] = React.useState(false);
  const [banner, setBanner] = React.useState<Banner | null>(null);
  // Client-only "now" for relative timestamps, lazy-initialized (not set in an
  // effect, so no cascading render). The time cells carry suppressHydrationWarning,
  // so the seconds-level server/client difference is silent (locale lesson).
  const [nowMs] = React.useState(() => Date.now());

  const total = staff.length;
  const activeCount = staff.filter((m) => m.status === "active").length;
  const invitedCount = staff.filter((m) => m.status === "invited").length;
  const createdCount = staff.filter((m) => m.status === "created").length;
  const adminCount = staff.filter((m) => m.role === "admin").length;

  // Pin the current admin to the top of the roster (design row 1 = `· Ty`), so
  // their crimson avatar also leads the avatar stack. V8's stable sort keeps the
  // created_at order for everyone else.
  const orderedStaff = [...staff].sort((a, b) => (a.id === currentUserId ? -1 : 0) - (b.id === currentUserId ? -1 : 0));

  const q = search.trim().toLowerCase();
  const filtered = orderedStaff.filter((m) => {
    if (filter === "active" && m.status !== "active") return false;
    if (filter === "invited" && m.status !== "invited") return false;
    if (filter === "created" && m.status !== "created") return false;
    if (filter === "admin" && m.role !== "admin") return false;
    if (q) {
      const hay = `${m.fullName ?? ""} ${m.email}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  // Lifecycle order, most-progressed first (design `EsShell` pill row): the new
  // `Dodany` pill sits between `Zaproszony` and `Administrator`.
  const tabs: { key: Filter; label: string; count: number }[] = [
    { key: "all", label: COPY.tabAll, count: total },
    { key: "active", label: COPY.tabActive, count: activeCount },
    { key: "invited", label: COPY.tabInvited, count: invitedCount },
    { key: "created", label: COPY.tabCreated, count: createdCount },
    { key: "admin", label: COPY.tabAdmin, count: adminCount },
  ];

  // ── mutations ──────────────────────────────────────────────────────────────

  // Applies a routing decision to the surfaces it can name. Every mutation goes
  // through here (phase 10 §1): the modal that owns a report reads `slot` off
  // the returned value and places the message itself, while this function only
  // opens/closes modals and fills the banner.
  //
  // `retry` is passed IN rather than read out. The module can say an arm needs a
  // retry control (`offersRetry`) but has no way to produce the callback, so the
  // caller supplies the one that re-runs its own mutation.
  function applyReport(report: Report, closeOwnModal: () => void, retry?: () => void): Report {
    if (!report.keepsModalOpen) closeOwnModal();
    if (report.target === "last-admin-modal") setLastAdminOpen(true);
    if (report.target === "banner" && report.message && report.tone) {
      setBanner({ tone: report.tone, msg: report.message, retry: report.offersRetry ? retry : undefined });
    }
    return report;
  }

  // WHERE an add failure is reported is decided by `resolveAddReport`, not here
  // — this function only reads the wire and applies the answer.
  //
  // Phase 1 closed the modal on a provisioning failure and made the banner's
  // `Ponów` the single retry, so that leaving the form open would not offer a
  // competing second one. That reasoning was sound while the invite mail had
  // already gone out: closing the modal was the signal that something
  // irreversible HAD happened. Two things retired it. Phase 7 collapsed the copy
  // to `Spróbuj ponownie.`, an instruction to retry issued after the form the
  // admin would retry in had been taken away; and phase 8 stopped sending any
  // mail on create, so a failed create is now fully retryable in place with
  // nothing delivered. The duplication did not disappear — it inverted, and
  // phase 9 resolves it the other way: the MODAL owns every add failure, its
  // submit button is the single retry, and the typed values stay on screen.
  //
  // Which also fixed the arm that reported nowhere at all. A thrown `fetch` used
  // to set a banner and leave the modal open, so the message painted behind
  // `ModalShell`'s overlay — the most common failure, and the one case where the
  // typed values are still perfectly good, was invisible.
  async function addEmployee(values: { full_name: string; email: string }): Promise<Report> {
    const closeAddModal = () => {
      setAddOpen(false);
    };
    setAddBusy(true);
    setBanner(null);
    try {
      const res = await fetch("/api/staff", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      let outcome: AddOutcome;
      if (res.status === 201 || res.status === 200) {
        const body = (await res.json().catch(() => null)) as {
          member?: StaffMember;
          activationMail?: "sent" | "failed" | "not_needed";
        } | null;
        const member = body?.member;
        if (member) setStaff((rows) => [...rows.filter((r) => r.id !== member.id), member]);
        // The activation-mail outcome is keyed off the member the server just
        // returned, so its banner names the button THAT row renders: a repair can
        // land on either password-less state, and `deriveStaffStatus` has already
        // decided which.
        outcome = { kind: "ok", activationMail: body?.activationMail ?? null, status: member?.status ?? "created" };
      } else if (res.status === 409) {
        outcome = { kind: "http", httpStatus: 409 };
      } else {
        // The route marks a provisioning failure with a machine-readable `code`;
        // an unhandled 500 carries Astro's HTML body and has none.
        const failure = (await res.json().catch(() => null)) as { code?: string } | null;
        outcome = { kind: "http", httpStatus: res.status, code: failure?.code ?? null };
      }
      return applyReport(resolveAddReport(outcome), closeAddModal);
    } catch {
      return applyReport(resolveAddReport({ kind: "network" }), closeAddModal);
    } finally {
      setAddBusy(false);
    }
  }

  // THE PHASE-10 DEFECT, half one. Both failure arms used to set the roster
  // banner and leave `RemoveModal` open — and `RemoveModal` is `fixed inset-0`
  // while the banner sits in the flow at the top of a document the admin has
  // scrolled. Measured 2026-08-21 at 390×844: banner top `-1033`,
  // `elementFromPoint` at its centre `null`, and `toBeVisible()` green. Scroll up
  // to it and the second failure takes over — `ModalShell`'s `z-[60]` overlay is
  // then what answers the hit test. There was no scroll position that showed the
  // message legibly while the dialog was open.
  //
  // Both now report in the modal, whose `Usuń` is the retry with the typed
  // confirmation still in the field. The 200 and 409 arms are deliberately
  // untouched: the row really went, or the refusal is a different screen.
  async function removeEmployee(member: StaffMember, confirmEmail: string): Promise<Report> {
    const closeRemoveModal = () => {
      setRemoveFor(null);
    };
    setBusyId(member.id);
    setBanner(null);
    try {
      const res = await fetch(`/api/staff/${member.id}/deactivate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmEmail }),
      });
      if (res.status === 200) {
        setStaff((rows) => rows.filter((r) => r.id !== member.id));
      }
      return applyReport(resolveRemoveReport({ kind: "http", httpStatus: res.status }), closeRemoveModal);
    } catch {
      return applyReport(resolveRemoveReport({ kind: "network" }), closeRemoveModal);
    } finally {
      setBusyId(null);
    }
  }

  // Step 2 of the two-step add. Offered for BOTH password-less states, so this
  // one call covers a first send and a resend; GoTrue invalidates the previous
  // link on a resend, so there is never more than one live token per person.
  // On success the row moves DODANY → ZAPROSZONY off the server's own
  // `invited_at`, not a locally-guessed timestamp.
  // THE PHASE-10 DEFECT, half two — and the half with no modal to move into.
  // These two are triggered from a per-row control reachable at any scroll
  // depth, and their SUCCESS messages are load-bearing: a resend changes nothing
  // else on screen (the badge is already ZAPROSZONY), so `inviteSent` is the
  // only feedback there is. A success banner the admin never sees fails that job
  // exactly as completely as a failure banner does. §3's answer is not to
  // relocate them but to make the banner itself reachable — see its `sticky`
  // placement below.
  //
  // `noModal` reads as ceremony for one line, and is deliberate: it says these
  // arms own no modal, which is why the banner is the only surface they can use
  // and why §3 had to be a layout decision rather than a routing one.
  const noModal = () => {
    /* row actions open no modal — nothing to close */
  };

  async function sendInvite(member: StaffMember): Promise<Report> {
    const retry = () => void sendInvite(member);
    setBusyId(member.id);
    setBanner(null);
    try {
      const res = await fetch(`/api/staff/${member.id}/invite`, { method: "POST" });
      if (res.status === 200) {
        const body = (await res.json().catch(() => null)) as { invitedAt?: string | null } | null;
        const invitedAt = body?.invitedAt ?? new Date().toISOString();
        setStaff((rows) => rows.map((r) => (r.id === member.id ? { ...r, status: "invited", invitedAt } : r)));
      }
      return applyReport(resolveRowActionReport("invite", { kind: "http", httpStatus: res.status }), noModal, retry);
    } catch {
      return applyReport(resolveRowActionReport("invite", { kind: "network" }), noModal, retry);
    } finally {
      setBusyId(null);
    }
  }

  async function resetPassword(member: StaffMember): Promise<Report> {
    const retry = () => void resetPassword(member);
    setBusyId(member.id);
    setBanner(null);
    try {
      const res = await fetch(`/api/staff/${member.id}/reset-password`, { method: "POST" });
      return applyReport(resolveRowActionReport("reset", { kind: "http", httpStatus: res.status }), noModal, retry);
    } catch {
      return applyReport(resolveRowActionReport("reset", { kind: "network" }), noModal, retry);
    } finally {
      setBusyId(null);
    }
  }

  const isEmpty = total === 0;
  const noResults = !isEmpty && filtered.length === 0;

  return (
    <div>
      {/* ── Mobile page header (below md) ──────────────────────────────
          At md+ the shell's own band carries the title and the count subtitle
          (S-12b) — this island no longer draws a second one. Below md there is
          no shell header at all, so the board keeps its own, matching the
          canonical mobile board (eyebrow + `Zespół` + one right-hand action). */}
      <header className="bg-card border-border border-b md:hidden">
        <div className="mx-auto w-full max-w-[1024px] px-4 py-5">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
                {COPY.eyebrowMobileWord(total)}
              </div>
              <h1 className="text-foreground mt-1 text-[28px] leading-none font-bold tracking-tight">
                {COPY.titleMobile}
              </h1>
            </div>
            {/* Absorbed into the quick-action sheet (S-12b): one `＋` per screen,
                with this board's own action promoted to the crimson first row.
                `employee` is a NEW key, so the sheet is 3 rows with exactly one
                divider (after row 1 — the rule is positional, not structural).
                The promoted action opens a dialog rather than navigating, so it
                carries `onPick` instead of an `href`. */}
            <QuickAddButton
              mode="mobile"
              promoted={{
                key: "employee",
                icon: User,
                label: COPY.add,
                desc: "Zaproś do zespołu",
                onPick: () => {
                  setAddOpen(true);
                },
              }}
            />
          </div>
        </div>
      </header>

      {/* ── Content (grey) ─────────────────────────────────────────────── */}
      <div className="mx-auto w-full max-w-[1024px] px-4 py-6 md:px-6">
        {/* Page action row — search plus this page's own create action. It sits
            on the grey field, in its own band below the shell's white one, which
            is what lets it coexist with the quick-add pill without ambiguity
            (design board `qa-v5`). */}
        <div className="mb-5 flex items-center gap-3">
          <div className="relative flex-1">
            <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2" />
            <input
              type="search"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
              }}
              placeholder={COPY.searchPlaceholder}
              className="border-border bg-card text-foreground placeholder:text-muted-foreground focus-visible:ring-ring h-11 w-full rounded-[10px] border pr-4 pl-10 text-sm outline-none focus-visible:ring-2"
            />
          </div>
          <Button
            className="bg-foreground text-background hover:bg-foreground/90 hidden h-11 shrink-0 px-4 md:inline-flex"
            onClick={() => {
              setAddOpen(true);
            }}
          >
            <Plus className="size-4" />
            {COPY.add}
          </Button>
        </div>

        {/* Mutation banner (§3.12, §8.6) — above the filter card, and PINNED.

            `sticky top-4 z-20` is phase 10 §3's answer for the row actions,
            which have no modal to report into. The element and every one of its
            dimensions are unchanged; what changed is that it no longer sits at a
            document offset the admin has scrolled away from. Measured
            2026-08-21 at 390×844: without it, top `-1033` and `elementFromPoint`
            `null` at its own centre — outside the viewport, while
            `toBeVisible()` passed. With it, top `16`, in viewport, topmost.

            This also restores the design's own behaviour rather than inventing
            one: `EsShell` in `employee-states.jsx` puts the banner OUTSIDE the
            scrolling region (`flex: 1; overflow: auto` is on the table body
            alone), so only the list scrolls and the banner is permanently on
            screen. The app built the same screen as a document that scrolls
            whole. Sticky is the local way back to the intended behaviour without
            restructuring the app shell.

            At scrollY 0 it renders byte-identically to before, so §11's existing
            baselines still hold — sticky only engages once the page has moved. */}
        {banner && (
          <div
            className={cn(
              "sticky top-4 z-20 mb-5 flex items-center justify-between gap-3 rounded-lg border px-5 py-3.5",
              banner.tone === "error"
                ? "border-destructive/30 bg-[var(--flota-danger-soft)]"
                : "border-success/30 bg-[var(--flota-success-soft)]",
            )}
          >
            <span
              className={cn(
                "flex items-center gap-2.5 text-sm font-[540]",
                banner.tone === "error" ? "text-destructive" : "text-success",
              )}
            >
              {banner.tone === "error" ? (
                <AlertTriangle className="size-4 shrink-0" />
              ) : (
                <ShieldCheck className="size-4 shrink-0" />
              )}
              {banner.msg}
            </span>
            <span className="flex shrink-0 items-center gap-2">
              {banner.tone === "error" && banner.retry && (
                <Button
                  variant="outline"
                  className="bg-card h-9 shrink-0 px-4 text-[13px] font-[650]"
                  onClick={() => {
                    const r = banner.retry;
                    setBanner(null);
                    r?.();
                  }}
                >
                  {COPY.retry}
                </Button>
              )}
              {/* The exit pinning takes away. Scrolling past the banner used to
                  be how it went away — which IS phase 10's defect, and was
                  simultaneously the only dismissal the design had. Sticky
                  removes it, so §3 owes a replacement: an explicit control on
                  both tones, chosen over auto-clearing the success tone because
                  an error that vanishes on a timer is worse than one that
                  persists, and because proving a timer without a sleep is a
                  cost `e2e-rules.md` should not have to carry. Geometry and
                  label are `ModalShell`'s shipped ✕ (`:264`), minus its absolute
                  positioning; `setBanner(null)` on the next mutation is
                  unchanged and still fires. */}
              <button
                type="button"
                aria-label={COPY.close}
                onClick={() => {
                  setBanner(null);
                }}
                className="bg-card text-muted-foreground hover:text-foreground flex size-8 shrink-0 items-center justify-center rounded-full"
              >
                <X className="size-4" />
              </button>
            </span>
          </div>
        )}

        {/* ── Filter tabs — white bar + avatar stack at lg+; bare wrapping pills below lg (§3.2/§3.13) ── */}
        <div className={cn(cardClass, "hidden items-center gap-1 px-3 py-2.5 lg:flex")}>
          {tabs.map((t) => (
            <TabButton
              key={t.key}
              t={t}
              active={filter === t.key}
              onClick={() => {
                setFilter(t.key);
              }}
            />
          ))}
          <div className="ml-auto flex items-center pr-1">
            {orderedStaff.slice(0, 4).map((m) => (
              <Avatar key={m.id} member={m} className="ring-card -ml-2 size-9 text-[13px] ring-2 first:ml-0" />
            ))}
            {orderedStaff.length > 4 && (
              <span className="bg-muted text-muted-foreground ring-card -ml-2 flex size-9 items-center justify-center rounded-full text-xs font-bold ring-2">
                +{orderedStaff.length - 4}
              </span>
            )}
          </div>
        </div>
        <div className="flex flex-wrap gap-2 lg:hidden">
          {tabs.map((t) => (
            <TabButton
              key={t.key}
              t={t}
              active={filter === t.key}
              bare
              onClick={() => {
                setFilter(t.key);
              }}
            />
          ))}
        </div>

        {/* ── Roster ────────────────────────────────────────────────────── */}
        {isEmpty ? (
          <EmptyState
            onAdd={() => {
              setAddOpen(true);
            }}
          />
        ) : noResults ? (
          <NoResults />
        ) : (
          <>
            {/* Desktop table (§3.3) — lg+ only (tablet uses cards) */}
            <div className={cn(cardClass, "mt-5 hidden overflow-hidden lg:block")}>
              <table className="w-full border-collapse text-left">
                <thead>
                  <tr className="text-muted-foreground border-border border-b text-[11px] font-bold tracking-wide uppercase">
                    <th className="px-4 py-3 font-bold">{COPY.colName}</th>
                    <th className="px-4 py-3 font-bold">{COPY.colRole}</th>
                    <th className="px-4 py-3 font-bold">{COPY.colStatus}</th>
                    <th className="px-4 py-3" aria-label="Akcje" />
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((m) => {
                    const isSelf = m.id === currentUserId;
                    return (
                      <tr key={m.id} className="border-b border-[var(--flota-hair-2)] last:border-0">
                        <td className="px-4 py-3.5">
                          <div className="flex items-center gap-3">
                            <Avatar member={m} className="size-9 text-[13px]" />
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5">
                                <span className="text-foreground truncate text-sm font-[650] tracking-tight">
                                  {m.fullName ?? m.email}
                                </span>
                                {isSelf && (
                                  <span className="text-muted-foreground text-sm font-normal">{COPY.selfSuffix}</span>
                                )}
                              </div>
                              <div className="text-muted-foreground mt-0.5 truncate text-xs">{m.email}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3.5">
                          <RoleBadge role={m.role} />
                        </td>
                        <td className="px-4 py-3.5">
                          <div className="flex flex-col items-start gap-1">
                            <StatusBadge status={m.status} />
                            <span className="text-muted-foreground text-xs" suppressHydrationWarning>
                              {formatLastActive(m, nowMs, { invitePrefix: false })}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3.5">
                          <div className="flex items-center justify-end gap-2">
                            {/* ONE action per state (design-contract §10 entry 2).
                                `Resetuj hasło` sends a RECOVERY link, which is the
                                wrong journey — and the wrong promise — for someone
                                who has never had a password. */}
                            {m.status === "active" ? (
                              <Button
                                variant="outline"
                                className="h-9 gap-1.5 px-3 text-[13px] font-[650]"
                                disabled={busyId === m.id}
                                onClick={() => resetPassword(m)}
                              >
                                <KeyRound className="size-3.5" />
                                {COPY.reset}
                              </Button>
                            ) : (
                              <Button
                                variant="outline"
                                className="h-9 gap-1.5 px-3 text-[13px] font-[650]"
                                disabled={busyId === m.id}
                                onClick={() => sendInvite(m)}
                              >
                                {busyId === m.id ? (
                                  <>
                                    <span className="size-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
                                    {COPY.sending}
                                  </>
                                ) : (
                                  <>
                                    <Send className="size-3.5" />
                                    {COPY.sendInvite(m.status)}
                                  </>
                                )}
                              </Button>
                            )}
                            <Button
                              variant="outline"
                              size="icon"
                              className={cn(
                                "size-9",
                                isSelf ? "text-muted-foreground disabled:opacity-50" : "text-destructive",
                              )}
                              disabled={isSelf || busyId === m.id}
                              aria-label={COPY.removeAria}
                              onClick={() => {
                                setRemoveFor(m);
                              }}
                            >
                              <X className="size-4" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Cards — mobile + tablet (below lg) */}
            <div className="mt-4 flex flex-col gap-3 lg:hidden">
              {filtered.map((m) => {
                const isSelf = m.id === currentUserId;
                return (
                  <div key={m.id} className={cn(cardClass, "flex items-center gap-3.5 p-4")}>
                    <Avatar member={m} className="size-14 text-[15px]" />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-foreground text-[17px] font-bold tracking-tight">
                          {m.fullName ?? m.email}
                        </span>
                        <RoleBadge role={m.role} mobile />
                      </div>
                      <div className="text-muted-foreground mt-0.5 truncate text-sm">{m.email}</div>
                      <div className="mt-1 flex items-center gap-1.5 text-[13px]">
                        <span className={cn("size-1.5 rounded-full", STATUS_TONE[m.status].dot)} />
                        <span className={cn("font-[540]", STATUS_TONE[m.status].text)}>
                          {STATUS_TONE[m.status].mobile}
                        </span>
                        <span className="text-muted-foreground" suppressHydrationWarning>
                          · {formatLastActive(m, nowMs, { invitePrefix: false })}
                        </span>
                      </div>
                    </div>
                    <div className="ml-auto flex flex-col gap-2">
                      {/* Same one-action-per-state rule as the desktop table. */}
                      {m.status === "active" ? (
                        <Button
                          variant="outline"
                          size="icon"
                          className="text-foreground size-11 rounded-xl"
                          disabled={busyId === m.id}
                          aria-label={COPY.resetAria}
                          onClick={() => resetPassword(m)}
                        >
                          <KeyRound className="size-4" />
                        </Button>
                      ) : (
                        <Button
                          variant="outline"
                          size="icon"
                          className="text-foreground size-11 rounded-xl"
                          disabled={busyId === m.id}
                          aria-label={COPY.sendInvite(m.status)}
                          onClick={() => sendInvite(m)}
                        >
                          {busyId === m.id ? (
                            <span className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                          ) : (
                            <Send className="size-4" />
                          )}
                        </Button>
                      )}
                      <Button
                        variant="outline"
                        size="icon"
                        className={cn(
                          "size-11 rounded-xl",
                          isSelf ? "text-muted-foreground disabled:opacity-50" : "text-destructive",
                        )}
                        disabled={isSelf || busyId === m.id}
                        aria-label={COPY.removeAria}
                        onClick={() => {
                          setRemoveFor(m);
                        }}
                      >
                        <X className="size-4" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}

        {/* Desktop footer note (§3.5) */}
        {!isEmpty && (
          <div className={cn(cardClass, "mt-4 hidden items-center gap-3 px-5 py-4 md:flex")}>
            <User className="text-muted-foreground size-5 shrink-0" />
            <p className="text-sm">
              <span className="text-foreground font-[650]">{COPY.footerBold}</span>
              <span className="text-muted-foreground">{COPY.footerRest}</span>
            </p>
          </div>
        )}

        {/* Mobile footer note (§3.13) */}
        {!isEmpty && (
          <p className="text-muted-foreground mt-4 px-2 text-center text-sm leading-relaxed md:hidden">
            {COPY.footerMobile}
          </p>
        )}
      </div>

      {/* ── Modals ────────────────────────────────────────────────────── */}
      {addOpen && (
        <AddModal
          busy={addBusy}
          onClose={() => {
            setAddOpen(false);
          }}
          onSubmit={addEmployee}
        />
      )}
      {removeFor && (
        <RemoveModal
          member={removeFor}
          busy={busyId === removeFor.id}
          onClose={() => {
            setRemoveFor(null);
          }}
          onConfirm={(email) => removeEmployee(removeFor, email)}
        />
      )}
      {lastAdminOpen && (
        <LastAdminModal
          onClose={() => {
            setLastAdminOpen(false);
          }}
        />
      )}
    </div>
  );
}

// ── empty / no-results states ─────────────────────────────────────────────────

function EmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <div className={cn(cardClass, "mt-5 flex flex-col items-center justify-center px-6 py-16 text-center")}>
      <div className="bg-muted text-muted-foreground flex size-16 items-center justify-center rounded-lg">
        <User className="size-7" />
      </div>
      <div className="text-foreground mt-4 text-xl font-bold tracking-tight">{COPY.emptyTitle}</div>
      <p className="text-muted-foreground mt-1.5 max-w-xs text-sm leading-relaxed">{COPY.emptyHint}</p>
      <Button className="bg-foreground text-background hover:bg-foreground/90 mt-5 h-11 px-4" onClick={onAdd}>
        <Plus className="size-4" />
        {COPY.add}
      </Button>
    </div>
  );
}

function NoResults() {
  return (
    <div className={cn(cardClass, "mt-5 flex flex-col items-center justify-center px-6 py-16 text-center")}>
      <div className="bg-muted flex size-16 items-center justify-center rounded-lg">
        <Search className="text-muted-foreground size-7" />
      </div>
      <div className="text-foreground mt-4 text-xl font-bold tracking-tight">{COPY.noResultsTitle}</div>
      <p className="text-muted-foreground mt-1.5 text-sm leading-relaxed">{COPY.noResultsHint}</p>
    </div>
  );
}
