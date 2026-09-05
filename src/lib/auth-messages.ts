// ---------------------------------------------------------------------------
// Auth error copy (S-14, F6) — the app authors every sentence it renders.
//
// Until this slice the auth routes put their message text straight into
// `?error=`, and three pages reflected it verbatim into `ServerError`'s styled
// alert. Not XSS (both escaping hops verified), but a crafted link could put
// arbitrary words in the app's mouth on a legitimate, authenticated URL — a
// ready-made phishing lure. It also let GoTrue's raw English ("New password
// should be different from the old password.") reach an all-Polish UI.
//
// So no message sentence travels in a URL any more. Routes emit a short code; the
// page resolves it HERE, server-side, and hands the island a plain string as
// before — `ServerError.tsx` is unchanged. An unrecognised code resolves to
// `null`, which renders nothing at all: guessing a valid code is the *only* way
// to get an alert, and every alert it could produce is text we wrote.
//
// The tables are per surface, so a code is only honoured where it can honestly
// have happened — `wrongCurrent` on the sign-in page resolves to nothing.
//
// New copy with no design mockup (design-contract §9: `deviation(no mockup —
// inline alert strings, existing pattern)`). It extends the shipped `MSG` idiom
// from `change-password.ts`, and reuses those exact strings where they existed.
// The whole PL auth block is gender-neutral — keep it that way.
//
// *** The table is bilingual HERE rather than in `src/lib/i18n/auth.ts`, and that
// is deliberate. *** Its guarantee is that the set of sentences an `?error=`
// code can produce is CLOSED; splitting it across two modules would split that
// guarantee, and the resolver would no longer be the one place to read to know
// what this app can be made to say. `auth.ts` carries the screens' copy; this
// carries the error sentences, in both locales, behind the same resolver.
// ---------------------------------------------------------------------------

// others
import type { Locale } from "./i18n/types";

/** The closed set of codes the app is willing to carry in a URL. */
export const AUTH_ERROR_CODES = [
  "invalidCredentials",
  "rateLimited",
  "unconfigured",
  "signupClosed",
  "wrongCurrent",
  "tooShort",
  "mismatch",
  "samePassword",
  "weakPassword",
  "generic",
] as const;

export type AuthErrorCode = (typeof AUTH_ERROR_CODES)[number];

/** The three pages with an `?error=` sink. `/auth/forgot-password` has none. */
export type AuthSurface = "signin" | "resetPassword" | "changePassword";

// Shared strings live in one const each so the two password surfaces cannot
// drift apart. The four marked "shipped" are carried over verbatim in the Polish
// half — they are already in front of users.
const RATE_LIMITED = {
  en: "Too many attempts. Try again in a few minutes.",
  pl: "Zbyt wiele prób. Spróbuj ponownie za kilka minut.", // shipped
};
const WRONG_CURRENT = {
  en: "That current password is not right",
  pl: "Nieprawidłowe obecne hasło", // shipped
};
const TOO_SHORT = {
  en: "Password must be at least 6 characters",
  pl: "Hasło musi mieć co najmniej 6 znaków", // shipped
};
const MISMATCH = {
  en: "The passwords do not match",
  pl: "Hasła nie są takie same", // shipped
};
const SAME_PASSWORD = {
  en: "The new password must differ from the current one",
  pl: "Nowe hasło musi się różnić od obecnego",
};
const WEAK_PASSWORD = {
  en: "That password is too weak. Choose another one.",
  pl: "Hasło jest zbyt słabe. Wybierz inne.",
};

type SurfaceMessages = Partial<Record<AuthErrorCode, string>>;

// `Record<Locale, …>` rather than a `Dict`: this is a nested, partial table, so
// the exhaustive record checks BOTH locales on the outer axis while each inner
// map stays free to omit the codes its surface cannot produce.
const MESSAGES: Record<Locale, Record<AuthSurface, SurfaceMessages>> = {
  en: {
    signin: {
      invalidCredentials: "Incorrect email or password",
      rateLimited: RATE_LIMITED.en,
      unconfigured: "Signing in is temporarily unavailable. Contact your administrator.",
      signupClosed: "Registration is managed by an administrator.",
      generic: "Could not sign you in. Try again.",
    },
    resetPassword: {
      tooShort: TOO_SHORT.en,
      mismatch: MISMATCH.en,
      samePassword: SAME_PASSWORD.en,
      weakPassword: WEAK_PASSWORD.en,
      rateLimited: RATE_LIMITED.en,
      generic: "Could not save the password. Try again.",
    },
    changePassword: {
      wrongCurrent: WRONG_CURRENT.en,
      tooShort: TOO_SHORT.en,
      mismatch: MISMATCH.en,
      samePassword: SAME_PASSWORD.en,
      weakPassword: WEAK_PASSWORD.en,
      rateLimited: RATE_LIMITED.en,
      generic: "Could not change the password. Try again.",
    },
  },
  pl: {
    signin: {
      invalidCredentials: "Nieprawidłowy e-mail lub hasło",
      rateLimited: RATE_LIMITED.pl,
      unconfigured: "Logowanie jest chwilowo niedostępne. Skontaktuj się z administratorem.",
      signupClosed: "Rejestracja jest zarządzana przez administratora.", // shipped
      generic: "Nie udało się zalogować. Spróbuj ponownie.",
    },
    resetPassword: {
      tooShort: TOO_SHORT.pl,
      mismatch: MISMATCH.pl,
      samePassword: SAME_PASSWORD.pl,
      weakPassword: WEAK_PASSWORD.pl,
      rateLimited: RATE_LIMITED.pl,
      generic: "Nie udało się zapisać hasła. Spróbuj ponownie.",
    },
    changePassword: {
      wrongCurrent: WRONG_CURRENT.pl,
      tooShort: TOO_SHORT.pl,
      mismatch: MISMATCH.pl,
      samePassword: SAME_PASSWORD.pl,
      weakPassword: WEAK_PASSWORD.pl,
      rateLimited: RATE_LIMITED.pl,
      generic: "Nie udało się zmienić hasła. Spróbuj ponownie.",
    },
  },
};

// Membership is tested against a Set, not by indexing the table: the tables are
// plain object literals, so `MESSAGES.pl.signin["__proto__"]` would answer with
// `Object.prototype` — truthy, non-null, and rendered as "[object Object]".
// A `?error=__proto__` link is exactly the input F6 is about.
const KNOWN_CODES: ReadonlySet<string> = new Set(AUTH_ERROR_CODES);

/**
 * Resolve a `?error=` value to the sentence for that surface, in `locale`.
 * Anything unrecognised — an injected phrase, an empty string, a code that
 * belongs to a different surface — resolves to `null`, and `ServerError` renders
 * nothing.
 */
export function resolveAuthError(surface: AuthSurface, code: string | null | undefined, locale: Locale): string | null {
  if (!code || !KNOWN_CODES.has(code)) {
    return null;
  }
  return MESSAGES[locale][surface][code as AuthErrorCode] ?? null;
}

/** The two fields we read off a GoTrue error. `message` is deliberately absent. */
export interface GotrueErrorLike {
  code?: string | null;
  status?: number | null;
}

// Probe-verified against local GoTrue rather than taken from the docs (lessons:
// "A typed, accepted API parameter is not evidence that it is enforced"):
// wrong password / unknown address → 400 `invalid_credentials`; reusing the
// current password → 422 `same_password`; below the config.toml minimum → 422
// `weak_password`.
const GOTRUE_CODES: Record<string, AuthErrorCode> = {
  invalid_credentials: "invalidCredentials",
  same_password: "samePassword",
  weak_password: "weakPassword",
  over_request_rate_limit: "rateLimited",
  over_email_send_rate_limit: "rateLimited",
  signup_disabled: "signupClosed",
};

/**
 * Map a GoTrue error onto one of our codes, defaulting to `generic`. The
 * provider's own `message` is NEVER forwarded — that is the whole point: it is
 * English, and it is not ours to put on the page. The app now HAS an English
 * half, which makes this easier to forget and no less wrong: GoTrue's wording is
 * not our copy, has not been through a design pass, and would render in English
 * to a Polish reader.
 */
export function gotrueErrorCode(error: GotrueErrorLike | null | undefined): AuthErrorCode {
  if (!error) {
    return "generic";
  }
  const mapped = error.code ? GOTRUE_CODES[error.code] : undefined;
  if (mapped) {
    return mapped;
  }
  // GoTrue's rate limits are keyed on the caller's IP, which behind Workers is
  // the Worker's egress IP — one bucket shared by every user, so a throttled
  // staffer must not be told their password was wrong.
  if (error.status === 429) {
    return "rateLimited";
  }
  return "generic";
}
