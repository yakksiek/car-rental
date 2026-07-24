import React, { useState } from "react";
import { Mail, ArrowRight } from "lucide-react";
import { FormField } from "./FormField";
import { SubmitButton } from "./SubmitButton";

// Forgot-password request form (S-08, design R1/R7). Small form → plain useState.
// Posts natively to /api/auth/forgot-password, which always redirects to the
// neutral "check your email" state (no account-existence leak). The island only
// validates the email client-side and flags the pending state through the POST.
export default function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | undefined>(undefined);

  function handleSubmit(e: React.SubmitEvent<HTMLFormElement>) {
    if (!email.trim()) {
      setError("Podaj adres e-mail");
      e.preventDefault();
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError("Podaj poprawny adres e-mail");
      e.preventDefault();
      return;
    }
    setSubmitting(true);
  }

  return (
    <form
      method="POST"
      action="/api/auth/forgot-password"
      className="flex flex-col gap-[18px]"
      onSubmit={handleSubmit}
      noValidate
    >
      <div>
        <h1 className="text-foreground text-[28px] leading-[1.05] font-bold tracking-[-0.8px]">Zresetuj hasło</h1>
        <p className="text-muted-foreground mt-2 text-sm leading-[1.45]">
          Podaj służbowy adres e-mail, a wyślemy link do resetu.
        </p>
      </div>

      <FormField
        id="email"
        type="email"
        label="E-mail służbowy"
        value={email}
        onChange={(v) => {
          setEmail(v);
          if (error) setError(undefined);
        }}
        placeholder="imie@flota.pl"
        autoComplete="username"
        error={error}
        icon={<Mail className="size-[17px]" />}
      />

      <SubmitButton pending={submitting} pendingText="Wysyłanie..." icon={<ArrowRight className="size-[17px]" />}>
        Wyślij link resetujący
      </SubmitButton>

      <a
        href="/auth/signin"
        className="text-muted-foreground hover:text-foreground inline-flex items-center justify-center gap-1.5 text-sm transition-colors"
      >
        <span aria-hidden="true">‹</span> Powrót do logowania
      </a>
    </form>
  );
}
