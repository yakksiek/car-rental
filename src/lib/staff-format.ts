// Polish label formatters for the Employees roster (S-08). Pure + I/O-free so
// they unit-test in isolation. Single-locale by construction (pl-PL) — the
// relative-time helper takes an explicit `nowMs` rather than reading the clock,
// so the caller controls SSR-vs-client evaluation and there is no hidden
// hydration mismatch (locale lesson).

/** Polish count-noun selection: 1 → one, 2–4 (but not 12–14) → few, else → many. */
export function plForm(n: number, one: string, few: string, many: string): string {
  if (n === 1) return one;
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 >= 2 && mod10 <= 4 && !(mod100 >= 12 && mod100 <= 14)) return few;
  return many;
}

/** Roster eyebrow, uppercased: `5 OSÓB · 1 ADMINISTRATOR`. */
export function staffCountLabel(total: number, admins: number): string {
  const people = plForm(total, "osoba", "osoby", "osób").toUpperCase();
  const adm = plForm(admins, "administrator", "administratorzy", "administratorów").toUpperCase();
  return `${total} ${people} · ${admins} ${adm}`;
}

export interface LastActiveInput {
  status: "active" | "invited";
  lastSignInAt: string | null;
  invitedAt: string | null;
}

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

function daysWord(n: number): string {
  return n === 1 ? "dzień" : "dni";
}

/**
 * PL last-active string (design §5.2). `nowMs` is passed in so SSR and the first
 * client render can agree (pass a stable value until mounted, then Date.now()).
 *   active:  przed chwilą / {n} min temu / {n} godz. temu / wczoraj / {n} dni temu
 *   invited: zaproszenie · dziś / zaproszenie · {n} dni temu
 */
export function formatLastActive(m: LastActiveInput, nowMs: number): string {
  if (m.status === "invited") {
    if (!m.invitedAt) return "zaproszenie";
    const days = Math.max(0, Math.floor((nowMs - new Date(m.invitedAt).getTime()) / DAY));
    if (days === 0) return "zaproszenie · dziś";
    return `zaproszenie · ${days} ${daysWord(days)} temu`;
  }

  if (!m.lastSignInAt) return "przed chwilą";
  const diff = nowMs - new Date(m.lastSignInAt).getTime();
  if (diff < MINUTE) return "przed chwilą";
  if (diff < HOUR) {
    const min = Math.floor(diff / MINUTE);
    return `${min} min temu`;
  }
  if (diff < DAY) {
    const hrs = Math.floor(diff / HOUR);
    return `${hrs} godz. temu`;
  }
  const days = Math.floor(diff / DAY);
  if (days === 1) return "wczoraj";
  return `${days} ${daysWord(days)} temu`;
}

/** Initials from the first two words of a name (fallback to the email's first char). */
export function staffInitials(fullName: string | null, email: string): string {
  const words = (fullName ?? "").trim().split(/\s+/).filter(Boolean);
  if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase();
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return email.slice(0, 2).toUpperCase();
}
