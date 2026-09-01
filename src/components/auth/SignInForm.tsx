import React, { useState } from "react";
import { Mail, Lock, ArrowRight, ShieldCheck } from "lucide-react";
import { FormField } from "./FormField";
import { PasswordToggle } from "./PasswordToggle";
import { SubmitButton } from "./SubmitButton";
import { ServerError } from "./ServerError";

interface Props {
  serverError?: string | null;
  // Validated internal path to land on after login (A1). Posted as a hidden
  // field so the signin endpoint honors the user's intended destination.
  redirectTo: string;
  // Published demo credentials (demo-account-gate). Present only when the page
  // resolved BOTH the flagged account's address (`demo_account_email()`) and
  // DEMO_PASSWORD; absent everywhere else, and the card then emits no wrapper
  // at all so the form is unchanged.
  demo?: { email: string; password: string };
}

// Staff sign-in form ("Strefa pracownika"). The "forgot password" link now
// routes to the S-08 self-service reset flow (/auth/forgot-password). The
// designed "remember me" checkbox stays omitted — sessions persist via Supabase
// cookies, so an inert control would read as broken.
//
// The demo card above the <h1> is the portfolio deployment's front door: the
// cockpit sits behind auth, so a recruiter following a CV link needs published
// credentials. It renders only when the page resolved both the flagged account's
// address and DEMO_PASSWORD — the address comes from `profiles.is_demo` via
// `demo_account_email()`, so this card can never name an ungated account
// (impl-review F3). Values transcribed from `design-contract.md` §2; the canonical
// mockup is `staff-login.jsx` → `LoginDemoCard`.
export default function SignInForm({ serverError, redirectTo, demo }: Props) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});

  function validate() {
    const next: typeof errors = {};
    if (!email.trim()) {
      next.email = "Podaj adres e-mail";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      next.email = "Podaj poprawny adres e-mail";
    }
    if (!password) {
      next.password = "Podaj hasło";
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  function clearError(field: keyof typeof errors) {
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: undefined }));
  }

  function handleSubmit(e: React.SubmitEvent<HTMLFormElement>) {
    if (!validate()) {
      e.preventDefault();
      return;
    }
    // Let the native POST proceed; flag pending so the button shows a spinner
    // while the browser round-trips to the signin endpoint and redirects.
    setSubmitting(true);
  }

  return (
    <form
      method="POST"
      action="/api/auth/signin"
      className="flex flex-col gap-[18px]"
      onSubmit={handleSubmit}
      noValidate
    >
      <input type="hidden" name="redirect" value={redirectTo} />

      {demo ? (
        <div className="bg-background border-border flex flex-col gap-2.5 rounded-md border p-3.5">
          <p className="text-muted-foreground font-mono text-[10.5px] leading-none font-semibold tracking-[0.5px] uppercase">
            Konto demo
          </p>
          <p className="text-[13px] leading-[1.45] font-[540] text-[var(--flota-ink-2)]">
            To wersja demonstracyjna portfolio. Zaloguj się poniższymi danymi, aby obejrzeć panel pracownika.
          </p>

          <dl className="flex flex-col gap-1">
            {[
              { label: "E-mail", value: demo.email },
              { label: "Hasło", value: demo.password },
            ].map((row) => (
              <div key={row.label} className="flex items-baseline justify-between gap-2.5">
                <dt className="text-[11.5px] font-[650] tracking-[0.2px] text-[var(--flota-ink-2)]">{row.label}</dt>
                {/* select-all so one click grabs the whole value — these exist to be copied. */}
                <dd className="text-foreground font-mono text-[12.5px] font-semibold select-all">{row.value}</dd>
              </div>
            ))}
          </dl>

          {/* Fills both controlled inputs. Synchronous, so the project's
              async-button pending-state rule does not apply; `type="button"`
              keeps it from submitting the form it sits inside. */}
          <button
            type="button"
            onClick={() => {
              setEmail(demo.email);
              setPassword(demo.password);
              setErrors({});
            }}
            className="border-border bg-card text-foreground hover:bg-background h-[38px] w-full rounded-[10px] border text-[13px] font-[650] transition-colors"
          >
            Wypełnij dane demo
          </button>

          <p className="text-muted-foreground text-xs leading-[1.45]">
            Dodawanie i usuwanie kont, reset hasła oraz tworzenie rezerwacji są w trybie demo wyłączone.
          </p>
        </div>
      ) : null}

      <div>
        <h1 className="text-foreground text-[28px] leading-[1.05] font-bold tracking-[-0.8px]">Zaloguj się</h1>
        <p className="text-muted-foreground mt-2 text-sm leading-[1.45]">
          Użyj konta służbowego Flota, aby wejść do panelu.
        </p>
      </div>

      <div className="flex flex-col gap-3.5">
        <FormField
          id="email"
          type="email"
          label="E-mail służbowy"
          value={email}
          onChange={(v) => {
            setEmail(v);
            clearError("email");
          }}
          placeholder="imie@flota.pl"
          autoComplete="username"
          error={errors.email}
          icon={<Mail className="size-[17px]" />}
        />

        <FormField
          id="password"
          label="Hasło"
          type={showPassword ? "text" : "password"}
          value={password}
          onChange={(v) => {
            setPassword(v);
            clearError("password");
          }}
          placeholder="Twoje hasło"
          autoComplete="current-password"
          error={errors.password}
          icon={<Lock className="size-[17px]" />}
          endContent={
            <PasswordToggle
              visible={showPassword}
              onToggle={() => {
                setShowPassword(!showPassword);
              }}
            />
          }
        />
      </div>

      <div className="-mt-1 flex justify-end">
        <a
          href="/auth/forgot-password"
          className="text-muted-foreground hover:text-foreground text-[13px] transition-colors"
        >
          Nie pamiętasz hasła?
        </a>
      </div>

      <ServerError message={serverError} />

      <SubmitButton pending={submitting} pendingText="Logowanie..." icon={<ArrowRight className="size-[17px]" />}>
        Zaloguj się
      </SubmitButton>

      <div className="text-muted-foreground flex items-center justify-center gap-1.5 text-xs">
        <ShieldCheck className="text-success size-3.5" />
        <span>Połączenie szyfrowane · tylko personel</span>
      </div>
    </form>
  );
}
