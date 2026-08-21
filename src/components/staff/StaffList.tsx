// core
import * as React from "react";
import { AlertTriangle, KeyRound, Plus, Search, Send, ShieldCheck, User, X } from "lucide-react";

// components
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";

// others
import { cn } from "../../lib/utils";
import { formatLastActive, plForm, staffCountLabel, staffInitials } from "../../lib/staff-format";
import { inviteActionLabel, provisionFailureMessage, repairedMailFailedMessage } from "../../lib/staff-banner";
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
  // authored in `lib/staff-banner.ts` rather than here, because
  // `repairedMailFailed` has to NAME whichever button that row shows — the
  // coupling that made a single shared label tempting in the first place.
  sendInvite: inviteActionLabel,
  sending: "Wysyłanie…",
  dupEmail: "Ten adres e-mail jest już w zespole.",
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
  mutationError: "Nie udało się zapisać zmiany. Sprawdź połączenie i spróbuj ponownie.",
  // Provisioning failed, so the network banner above would be a lie. ONE sentence
  // for both API codes — the distinction they carry is system health, not the
  // admin's situation — and it names the address, because a failed provisioning
  // drives no roster row and this is the only place that address appears.
  // Function-valued COPY member, as `eyebrowMobileWord` below already is; the
  // string itself is authored in `lib/staff-banner.ts` so the `unit` project can
  // gate it (design-contract.md §9.2, verbatim).
  provisionFailed: provisionFailureMessage,
  // Names an INVITE button, not `„Resetuj hasło”`: this banner fires only when
  // the target has NO password, and the roster shows exactly one action per
  // state — so the reset button the old string named is not on that row at all
  // (design-contract §9.2, §10 entry 2). Which invite button it names follows
  // the row's own state, so the copy can never point at a missing control.
  repairedMailFailed: repairedMailFailedMessage,
  retry: "Ponów",
  resetSent: "Wysłano e-mail do resetu hasła.",
  inviteSent: "Wysłano zaproszenie.",
  genericError: "Coś poszło nie tak. Spróbuj ponownie.",
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

interface Banner {
  kind: "error" | "success";
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
  onSubmit: (values: { full_name: string; email: string }) => Promise<{ dupEmail?: boolean } | undefined>;
}) {
  const [fullName, setFullName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [errors, setErrors] = React.useState<{ full_name?: string; email?: string }>({});
  const [dup, setDup] = React.useState(false);
  const emailInvalid = Boolean(errors.email) || dup;

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
    setDup(false);
    const result = await onSubmit(parsed.data);
    if (result?.dupEmail) setDup(true);
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
                setDup(false);
                if (errors.email) setErrors((p) => ({ ...p, email: undefined }));
              }}
              className={cn(inputBase, emailInvalid && "border-destructive bg-[var(--flota-danger-soft)]")}
              autoComplete="off"
            />
            {emailInvalid && (
              <p className="text-destructive mt-1.5 flex items-center gap-1.5 text-[13px]">
                <AlertTriangle className="size-3.5" />
                {dup ? COPY.dupEmail : errors.email}
              </p>
            )}
          </div>
        </div>

        <div className="mt-5 flex gap-2.5">
          <Button type="button" variant="outline" className="h-12 flex-1" disabled={busy} onClick={onClose}>
            {COPY.cancel}
          </Button>
          <Button type="submit" className="bg-primary text-primary-foreground h-12 flex-1 gap-2" disabled={busy || dup}>
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
  onConfirm: (confirmEmail: string) => void;
}) {
  const [typed, setTyped] = React.useState("");
  const matches = typed.trim().toLowerCase() === member.email.toLowerCase();
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
        }}
        placeholder={member.email}
        autoComplete="off"
        className="border-border bg-background text-foreground mt-1.5 h-11 w-full rounded-xl border px-3.5 font-mono text-sm"
      />
      <div className="mt-5 flex gap-2.5">
        <Button variant="outline" className="h-12 flex-1" disabled={busy} onClick={onClose}>
          {COPY.cancel}
        </Button>
        <Button
          variant="destructive"
          className="h-12 flex-1 gap-2"
          disabled={busy || !matches}
          onClick={() => {
            onConfirm(typed.trim());
          }}
        >
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

  async function addEmployee(values: {
    full_name: string;
    email: string;
  }): Promise<{ dupEmail?: boolean } | undefined> {
    setAddBusy(true);
    setBanner(null);
    try {
      const res = await fetch("/api/staff", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      if (res.status === 201 || res.status === 200) {
        const body = (await res.json().catch(() => null)) as {
          member?: StaffMember;
          activationMail?: "sent" | "failed" | "not_needed";
        } | null;
        const member = body?.member;
        if (member) setStaff((rows) => [...rows.filter((r) => r.id !== member.id), member]);
        setAddOpen(false);
        // The repair succeeded — the row belongs on the roster and the modal
        // closes — but the activation email did not go out, so the hire has no
        // way in. Error tone because the admin must act; no `retry`, because the
        // remedy is the row's own invite action, which the copy names
        // (design-contract §8.1).
        //
        // The message is keyed off the member the server just returned, so it
        // names the button THAT row renders: a repair can land on either
        // password-less state, and `deriveStaffStatus` has already decided which.
        if (body?.activationMail === "failed") {
          setBanner({ kind: "error", msg: COPY.repairedMailFailed(member?.status ?? "created") });
        }
        return;
      }
      if (res.status === 409) {
        return { dupEmail: true };
      }
      // Provisioning failed. The route marks it with a machine-readable `code`;
      // an unhandled 500 has none, so the resolver answers null and we fall
      // through to the network banner below, unchanged. Both provisioning codes
      // resolve to the same sentence — the API keeps them apart for logs and
      // monitoring (`api/staff.ts`), the admin sees one message.
      const failure = (await res.json().catch(() => null)) as { code?: string } | null;
      const provisionFailed = COPY.provisionFailed(failure?.code, values.email);
      if (provisionFailed) {
        // Close the modal: the banner's `Ponów` is the single retry surface, and
        // leaving the form open behind it would offer a competing second one.
        setAddOpen(false);
        setBanner({ kind: "error", msg: provisionFailed, retry: () => void addEmployee(values) });
        return;
      }
      setBanner({ kind: "error", msg: COPY.mutationError, retry: () => void addEmployee(values) });
    } catch {
      setBanner({ kind: "error", msg: COPY.mutationError, retry: () => void addEmployee(values) });
    } finally {
      setAddBusy(false);
    }
  }

  async function removeEmployee(member: StaffMember, confirmEmail: string) {
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
        setRemoveFor(null);
        return;
      }
      if (res.status === 409) {
        // last admin — swap to the refusal modal
        setRemoveFor(null);
        setLastAdminOpen(true);
        return;
      }
      setBanner({ kind: "error", msg: COPY.mutationError });
    } catch {
      setBanner({ kind: "error", msg: COPY.mutationError });
    } finally {
      setBusyId(null);
    }
  }

  // Step 2 of the two-step add. Offered for BOTH password-less states, so this
  // one call covers a first send and a resend; GoTrue invalidates the previous
  // link on a resend, so there is never more than one live token per person.
  // On success the row moves DODANY → ZAPROSZONY off the server's own
  // `invited_at`, not a locally-guessed timestamp.
  async function sendInvite(member: StaffMember) {
    setBusyId(member.id);
    setBanner(null);
    try {
      const res = await fetch(`/api/staff/${member.id}/invite`, { method: "POST" });
      if (res.status === 200) {
        const body = (await res.json().catch(() => null)) as { invitedAt?: string | null } | null;
        const invitedAt = body?.invitedAt ?? new Date().toISOString();
        setStaff((rows) => rows.map((r) => (r.id === member.id ? { ...r, status: "invited", invitedAt } : r)));
        setBanner({ kind: "success", msg: COPY.inviteSent });
      } else {
        setBanner({ kind: "error", msg: COPY.mutationError, retry: () => void sendInvite(member) });
      }
    } catch {
      setBanner({ kind: "error", msg: COPY.mutationError, retry: () => void sendInvite(member) });
    } finally {
      setBusyId(null);
    }
  }

  async function resetPassword(member: StaffMember) {
    setBusyId(member.id);
    setBanner(null);
    try {
      const res = await fetch(`/api/staff/${member.id}/reset-password`, { method: "POST" });
      if (res.status === 200) {
        setBanner({ kind: "success", msg: COPY.resetSent });
      } else {
        setBanner({ kind: "error", msg: COPY.mutationError, retry: () => void resetPassword(member) });
      }
    } catch {
      setBanner({ kind: "error", msg: COPY.mutationError, retry: () => void resetPassword(member) });
    } finally {
      setBusyId(null);
    }
  }

  const isEmpty = total === 0;
  const noResults = !isEmpty && filtered.length === 0;

  return (
    <div>
      {/* ── Header band (full-width white, flush top — aligned with other sections) ── */}
      <header className="bg-card border-border border-b">
        <div className="mx-auto w-full max-w-[1024px] px-4 py-5 md:px-6">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="text-muted-foreground text-xs font-semibold tracking-wide uppercase md:hidden">
                {COPY.eyebrowMobileWord(total)}
              </div>
              <div className="text-muted-foreground hidden text-xs font-semibold tracking-wide uppercase md:block">
                {staffCountLabel(total, adminCount)}
              </div>
              <h1 className="text-foreground mt-1 text-[28px] leading-none font-bold tracking-tight md:text-[32px]">
                <span className="md:hidden">{COPY.titleMobile}</span>
                <span className="hidden md:inline">{COPY.title}</span>
              </h1>
            </div>

            <div className="flex items-center gap-3">
              {/* Search inline only at lg+ (moves to its own row below on tablet/mobile) */}
              <div className="relative hidden w-64 lg:block">
                <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2" />
                <input
                  type="search"
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                  }}
                  placeholder={COPY.searchPlaceholder}
                  className="border-border bg-background text-foreground placeholder:text-muted-foreground focus-visible:ring-ring h-11 w-full rounded-[10px] border pr-4 pl-10 text-sm outline-none focus-visible:ring-2"
                />
              </div>
              {/* Add employee — labeled dark button at md+ (tablet + desktop), circular FAB below md */}
              <Button
                className="bg-foreground text-background hover:bg-foreground/90 hidden h-11 px-4 md:inline-flex"
                onClick={() => {
                  setAddOpen(true);
                }}
              >
                <Plus className="size-4" />
                {COPY.add}
              </Button>
              <Button
                className="bg-foreground text-background hover:bg-foreground/90 flex size-12 shrink-0 rounded-full md:hidden"
                aria-label={COPY.add}
                onClick={() => {
                  setAddOpen(true);
                }}
              >
                <Plus className="size-5" />
              </Button>
            </div>
          </div>

          {/* Search full-width — mobile + tablet (below lg) */}
          <div className="relative mt-4 lg:hidden">
            <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2" />
            <input
              type="search"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
              }}
              placeholder={COPY.searchPlaceholder}
              className="border-border bg-background text-foreground placeholder:text-muted-foreground h-12 w-full rounded-[10px] border pr-4 pl-11 text-sm outline-none"
            />
          </div>
        </div>
      </header>

      {/* ── Content (grey) ─────────────────────────────────────────────── */}
      <div className="mx-auto w-full max-w-[1024px] px-4 py-6 md:px-6">
        {/* Mutation banner (§3.12) — above the filter card */}
        {banner && (
          <div
            className={cn(
              "mb-5 flex items-center justify-between gap-3 rounded-lg border px-5 py-3.5",
              banner.kind === "error"
                ? "border-destructive/30 bg-[var(--flota-danger-soft)]"
                : "border-success/30 bg-[var(--flota-success-soft)]",
            )}
          >
            <span
              className={cn(
                "flex items-center gap-2.5 text-sm font-[540]",
                banner.kind === "error" ? "text-destructive" : "text-success",
              )}
            >
              {banner.kind === "error" ? (
                <AlertTriangle className="size-4 shrink-0" />
              ) : (
                <ShieldCheck className="size-4 shrink-0" />
              )}
              {banner.msg}
            </span>
            {banner.kind === "error" && banner.retry && (
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
