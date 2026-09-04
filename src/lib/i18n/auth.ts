// core
import { defineDict } from "./types";

// ---------------------------------------------------------------------------
// The staff auth surface — 8 pages under `src/pages/auth/` and the 8 components
// under `src/components/auth/`. Everything between the footer link and the
// cockpit.
//
// English harvested from the design source's `STR.EN.login.*` and
// `STR.EN.auth.*`, which cover this whole flow at parity (see the change's
// `glossary.md`). The screens with no design twin are marked below.
//
// Error SENTENCES are not here — they live in `src/lib/auth-messages.ts`, whose
// whole job is to be the one closed table a `?error=` code can resolve against.
// Splitting the table would be splitting that guarantee.
//
// `Flota` in `signInSub` and `inviteKicker` is the BRAND and stays untranslated
// in both halves, exactly as `STR.EN.login.sub` and `STR.EN.auth.inviteKick` do.
// ---------------------------------------------------------------------------
export const auth = defineDict({
  en: {
    // ── Shell chrome (`AuthShell.astro`, `signin.astro`) ────────────────────
    zone: "Employee zone",
    // Mobile band on the sign-in page, back to the public site.
    backToSite: "Back to flota.pl",
    // Mobile band on the recovery/invite shell, back to sign-in.
    signIn: "Sign in",
    secure: "Secure connection · staff only",
    backToLogin: "Back to sign in",
    helpQuestion: "Trouble signing in?",
    helpLink: "Ask your administrator",

    // ── Document titles ────────────────────────────────────────────────────
    titleSignIn: "Employee zone — sign in",
    titleForgot: "Employee zone — password reset",
    titleSetPassword: "Employee zone — set password",
    titleLinkConflict: "Employee zone — browser already signed in",
    titleSignUp: "Registration",

    // ── Sign-in form (`SignInForm.tsx`) ────────────────────────────────────
    signInHeading: "Sign in",
    signInSub: "Use your Flota work account to access dispatch.",
    emailLabel: "Work email",
    emailPlaceholder: "name@flota.pl",
    passwordLabel: "Password",
    passwordPlaceholder: "Your password",
    forgot: "Forgot password?",
    signInPending: "Signing in…",
    emailRequired: "Enter your email address",
    emailInvalid: "Enter a valid email address",
    passwordRequired: "Enter your password",

    // ── Demo card (demo-account-gate; `STR.EN.login.demo`) ─────────────────
    demoEyebrow: "Demo account",
    demoBody: "This is a portfolio demo. Sign in with the credentials below to look around the employee panel.",
    demoEmailLabel: "Email",
    demoPasswordLabel: "Password",
    demoFill: "Fill in demo credentials",
    demoNote: "Adding and removing accounts, password resets and creating reservations are disabled in demo mode.",

    // ── Password visibility toggle ─────────────────────────────────────────
    showPassword: "Show password",
    hidePassword: "Hide password",

    // ── Forgot-password request (R1/R7) ────────────────────────────────────
    forgotHeading: "Reset your password",
    forgotSub: "Enter your work email and we’ll send a reset link.",
    forgotSubmit: "Send reset link",
    forgotPending: "Sending…",

    // ── Check-your-email (R2/R8) ───────────────────────────────────────────
    sentTitle: "Check your email",
    sentSub: "If an account exists for that address, a reset link is on its way. It expires in 60 minutes.",

    // ── Expired link (R5) ──────────────────────────────────────────────────
    expiredTitle: "This link has expired",
    expiredSub: "Reset links are valid for 60 minutes. Request a fresh one to continue.",
    expiredCta: "Request a new link",

    // ── Set-password form (R3/R9 recovery · R6/R10 invite) ─────────────────
    inviteKicker: "Welcome to Flota",
    inviteHeading: "Set your password",
    inviteSub: "You’ve been invited to the dispatch team. Create a password to activate your account.",
    inviteSubmit: "Activate account",
    resetHeading: "Set a new password",
    resetSub: "Choose a strong password you don’t use elsewhere.",
    resetSubmit: "Save password",
    resetPending: "Saving…",
    newPasswordLabel: "New password",
    newPasswordPlaceholder: "Your new password",
    confirmLabel: "Confirm password",
    confirmPlaceholder: "Repeat the password",
    // Client-side mirrors of `auth-messages.ts`'s `tooShort` / `mismatch`; the
    // enforced minimum is the `config.toml` policy (6).
    passwordTooShort: "Password must be at least 6 characters",
    passwordMismatch: "The passwords do not match",

    // ── Password updated (R4) ──────────────────────────────────────────────
    doneTitle: "Password updated",
    doneSub: "You can now sign in with your new password.",
    doneCta: "Go to sign in",

    // ── Nothing to set here (R13) ──────────────────────────────────────────
    noLinkTitle: "Nothing to set here",
    noLinkSub: "To choose a password you need a reset link. Request one and we’ll email it to you.",
    noLinkCta: "Request a reset link",

    // ── Inactive account (R14) — no design twin, authored ───────────────────
    inactiveTitle: "This account is inactive",
    inactiveSub: "A password cannot be set for an inactive account. If that looks wrong, contact your administrator.",
    inactiveCta: "Back to sign in",

    // ── Change it in settings instead (R12) ────────────────────────────────
    inAppTitle: "Change your password in settings",
    inAppSub:
      "You’re already signed in, so there’s no reset link to use here. Open Account → “Change password” — it confirms your current password first.",
    inAppCta: "Go to account settings",

    // ── Link conflict (R11) ────────────────────────────────────────────────
    conflictHeading: "You’re already signed in",
    conflictSub:
      "This link opened in a browser where another account is signed in. Sign out first, then open the link again from your inbox.",
    signedInAs: "Signed in as",
    settingPasswordFor: "Setting password for",
    signOut: "Sign out",
    signingOut: "Signing out…",

    // ── Registration is closed (`signup.astro`) — no design twin ────────────
    signUpHeading: "Registration is not available",
    signUpBody: "Accounts are created by an administrator. Contact your administrator to get access.",
    signUpHaveAccount: "Already have an account?",

    // ── Email confirmation (`confirm-email.astro`) — no design twin ─────────
    confirmedHeading: "Registration successful",
    confirmedBody: "Your account has been created. You can now sign in.",
    confirmedCta: "Go to sign in",
    confirmPendingHeading: "Check your email",
    confirmPendingBody: "We’ve sent a confirmation link to your email address. Click it to activate your account.",
    confirmPendingCta: "Back to sign in",
  },
  pl: {
    zone: "Strefa pracownika",
    backToSite: "Powrót do flota.pl",
    signIn: "Logowanie",
    secure: "Połączenie szyfrowane · tylko personel",
    backToLogin: "Powrót do logowania",
    helpQuestion: "Problem z logowaniem?",
    helpLink: "Skontaktuj się z administratorem",

    titleSignIn: "Strefa pracownika — logowanie",
    titleForgot: "Strefa pracownika — reset hasła",
    titleSetPassword: "Strefa pracownika — ustaw hasło",
    titleLinkConflict: "Strefa pracownika — przeglądarka już zalogowana",
    titleSignUp: "Rejestracja",

    signInHeading: "Zaloguj się",
    signInSub: "Użyj konta służbowego Flota, aby wejść do panelu.",
    emailLabel: "E-mail służbowy",
    emailPlaceholder: "imie@flota.pl",
    passwordLabel: "Hasło",
    passwordPlaceholder: "Twoje hasło",
    forgot: "Nie pamiętasz hasła?",
    signInPending: "Logowanie…",
    emailRequired: "Podaj adres e-mail",
    emailInvalid: "Podaj poprawny adres e-mail",
    passwordRequired: "Podaj hasło",

    demoEyebrow: "Konto demo",
    demoBody: "To wersja demonstracyjna portfolio. Zaloguj się poniższymi danymi, aby obejrzeć panel pracownika.",
    demoEmailLabel: "E-mail",
    demoPasswordLabel: "Hasło",
    demoFill: "Wypełnij dane demo",
    demoNote: "Dodawanie i usuwanie kont, reset hasła oraz tworzenie rezerwacji są w trybie demo wyłączone.",

    showPassword: "Pokaż hasło",
    hidePassword: "Ukryj hasło",

    forgotHeading: "Zresetuj hasło",
    forgotSub: "Podaj służbowy adres e-mail, a wyślemy link do resetu.",
    forgotSubmit: "Wyślij link resetujący",
    forgotPending: "Wysyłanie…",

    sentTitle: "Sprawdź skrzynkę",
    sentSub: "Jeśli dla tego adresu istnieje konto, link do resetu jest już w drodze. Wygasa po 60 minutach.",

    expiredTitle: "Link wygasł",
    expiredSub: "Linki resetujące są ważne 60 minut. Poproś o nowy, aby kontynuować.",
    expiredCta: "Poproś o nowy link",

    inviteKicker: "Witaj we Flocie",
    inviteHeading: "Ustaw hasło",
    inviteSub: "Masz zaproszenie do zespołu dyspozytorni. Utwórz hasło, aby aktywować konto.",
    inviteSubmit: "Aktywuj konto",
    resetHeading: "Ustaw nowe hasło",
    resetSub: "Wybierz silne hasło, którego nie używasz nigdzie indziej.",
    resetSubmit: "Zapisz hasło",
    resetPending: "Zapisywanie…",
    newPasswordLabel: "Nowe hasło",
    newPasswordPlaceholder: "Twoje nowe hasło",
    confirmLabel: "Potwierdź hasło",
    confirmPlaceholder: "Powtórz hasło",
    passwordTooShort: "Hasło musi mieć co najmniej 6 znaków",
    passwordMismatch: "Hasła nie są takie same",

    doneTitle: "Hasło zaktualizowane",
    doneSub: "Możesz teraz zalogować się nowym hasłem.",
    doneCta: "Przejdź do logowania",

    noLinkTitle: "Nie ma tu nic do ustawienia",
    noLinkSub: "Aby ustawić hasło, potrzebujesz linku do resetu. Poproś o niego, a wyślemy go e-mailem.",
    noLinkCta: "Poproś o link do resetu",

    inactiveTitle: "Konto jest nieaktywne",
    inactiveSub: "Nie można ustawić hasła do nieaktywnego konta. Jeśli to pomyłka, skontaktuj się z administratorem.",
    inactiveCta: "Powrót do logowania",

    inAppTitle: "Zmień hasło w ustawieniach",
    inAppSub:
      "Ta sesja jest aktywna, więc nie ma tu linku do resetu. Otwórz Konto → „Zmień hasło” — najpierw potwierdzisz obecne hasło.",
    inAppCta: "Przejdź do ustawień konta",

    conflictHeading: "Ta przeglądarka jest już zalogowana",
    conflictSub:
      "Ten link otworzył się w przeglądarce, gdzie zalogowane jest inne konto. Najpierw wyloguj się, a potem otwórz link ponownie z wiadomości.",
    signedInAs: "Zalogowano jako",
    settingPasswordFor: "Ustawiasz hasło dla",
    signOut: "Wyloguj się",
    signingOut: "Wylogowywanie…",

    signUpHeading: "Rejestracja niedostępna",
    signUpBody: "Konta są zakładane przez administratora. Skontaktuj się z administratorem, aby uzyskać dostęp.",
    signUpHaveAccount: "Masz już konto?",

    confirmedHeading: "Rejestracja zakończona",
    confirmedBody: "Konto zostało utworzone. Możesz się teraz zalogować.",
    confirmedCta: "Przejdź do logowania",
    confirmPendingHeading: "Sprawdź skrzynkę",
    confirmPendingBody: "Wysłaliśmy link potwierdzający na Twój adres e-mail. Kliknij go, aby aktywować konto.",
    confirmPendingCta: "Powrót do logowania",
  },
});
