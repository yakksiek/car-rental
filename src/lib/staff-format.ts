// others
import { plural, type PluralForms } from "./format";
import { dashboard } from "./i18n/dashboard";
import { translator } from "./i18n/types";
import type { Locale } from "./i18n/types";
import type { StaffStatus } from "./staff-status";

// Label formatters for the Employees roster (S-08). Pure + I/O-free so they
// unit-test in isolation. The relative-time helper takes an explicit `nowMs`
// rather than reading the clock, so the caller controls SSR-vs-client evaluation
// and there is no hidden hydration mismatch (locale lesson).
//
// The two hand-rolled count-noun selectors — this module's and its twin in
// `format.ts`, each open-coding Polish's 1 / 2–4 / rest split and its 12–14
// exception — are gone; both now route through the one `Intl.PluralRules` helper
// (`plural`). The counted nouns are locale-keyed tables beside them.

const PEOPLE_FORMS: Record<Locale, PluralForms> = {
  en: { one: "person", other: "people" },
  pl: { one: "osoba", few: "osoby", many: "osób", other: "osób" },
};

const ADMIN_FORMS: Record<Locale, PluralForms> = {
  en: { one: "admin", other: "admins" },
  pl: { one: "administrator", few: "administratorzy", many: "administratorów", other: "administratorów" },
};

/** Roster eyebrow, uppercased: `5 OSÓB · 1 ADMINISTRATOR`. */
export function staffCountLabel(total: number, admins: number, locale: Locale): string {
  const people = plural(total, locale, PEOPLE_FORMS[locale]).toUpperCase();
  const adm = plural(admins, locale, ADMIN_FORMS[locale]).toUpperCase();
  return `${total} ${people} · ${admins} ${adm}`;
}

export interface LastActiveInput {
  status: StaffStatus;
  lastSignInAt: string | null;
  invitedAt: string | null;
}

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/**
 * Last-active string (design §5.2). `nowMs` is passed in so SSR and the first
 * client render can agree (pass a stable value until mounted, then Date.now()).
 *   active:  just now / {n} min ago / {n} h ago / yesterday / {n} days ago
 *   invited: invitation · today / invitation · {n} days ago
 *   created: —
 *
 * Composed rather than `Intl.RelativeTimeFormat`'d: the design ships its own
 * abbreviations (`godz.`, `min`) and the `invitation · ` prefix, none of which a
 * formatter produces. The counted noun still routes through the shared CLDR
 * `plural` helper, so Polish gets `dzień` / `dni` for free.
 *
 * `opts.invitePrefix: false` drops the leading prefix for invited rows — used when
 * the string sits next to the INVITED status badge, where the word would be
 * redundant (→ just "2 days ago" / "today").
 */
export function formatLastActive(
  m: LastActiveInput,
  nowMs: number,
  locale: Locale,
  opts?: { invitePrefix?: boolean },
): string {
  const t = translator(locale, dashboard);
  const daysWord = (n: number) =>
    plural(n, locale, { one: t("lastActiveDayOne"), few: t("lastActiveDayOther"), other: t("lastActiveDayOther") });
  const ago = (n: number) => `${String(n)} ${daysWord(n)} ${t("lastActiveAgo")}`;
  // Created but never invited: nothing has happened to this account yet, so an
  // em dash rather than a fabricated timestamp. The design board's own note on
  // the DODANY row (`employee-states.jsx` ES_LAST id 6) says exactly this, and
  // the `active` branch below would otherwise answer "just now" off a null
  // `lastSignInAt` — which would read as a sign-in that never happened.
  if (m.status === "created") {
    return "—";
  }

  if (m.status === "invited") {
    const withPrefix = opts?.invitePrefix !== false;
    if (!m.invitedAt) return withPrefix ? t("lastActiveInvitation") : "—";
    const days = Math.max(0, Math.floor((nowMs - new Date(m.invitedAt).getTime()) / DAY));
    const rel = days === 0 ? t("lastActiveToday") : ago(days);
    return withPrefix ? `${t("lastActiveInvitation")} · ${rel}` : rel;
  }

  if (!m.lastSignInAt) return t("lastActiveJustNow");
  const diff = nowMs - new Date(m.lastSignInAt).getTime();
  if (diff < MINUTE) return t("lastActiveJustNow");
  if (diff < HOUR) {
    const min = Math.floor(diff / MINUTE);
    return `${String(min)} ${t("lastActiveMinutesAgo")}`;
  }
  if (diff < DAY) {
    const hrs = Math.floor(diff / HOUR);
    return `${String(hrs)} ${t("lastActiveHoursAgo")}`;
  }
  const days = Math.floor(diff / DAY);
  if (days === 1) return t("lastActiveYesterday");
  return ago(days);
}

/** Initials from the first two words of a name (fallback to the email's first char). */
export function staffInitials(fullName: string | null, email: string): string {
  const words = (fullName ?? "").trim().split(/\s+/).filter(Boolean);
  if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase();
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return email.slice(0, 2).toUpperCase();
}
