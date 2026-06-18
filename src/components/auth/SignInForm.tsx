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
}

// Staff sign-in form ("Strefa pracownika"). The designed login also shows a
// "remember me" checkbox and a "forgot password" link; both are intentionally
// omitted — neither has a backing flow yet (sessions persist via Supabase
// cookies; password reset is a separate, unbuilt slice), and inert controls
// read as broken. They can be added when those flows land.
export default function SignInForm({ serverError, redirectTo }: Props) {
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
