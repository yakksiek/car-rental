import React, { useState } from "react";
import { Mail, ArrowRight } from "lucide-react";
import { FormField } from "./FormField";
import { SubmitButton } from "./SubmitButton";
import { auth } from "../../lib/i18n/auth";
import { translator, type Locale } from "../../lib/i18n/types";

interface Props {
  /** Islands cannot read `Astro.locals`, so the page passes the request locale in. */
  locale: Locale;
}

// Forgot-password request form (S-08, design R1/R7). Small form → plain useState.
// Posts natively to /api/auth/forgot-password, which always redirects to the
// neutral "check your email" state (no account-existence leak). The island only
// validates the email client-side and flags the pending state through the POST.
export default function ForgotPasswordForm({ locale }: Props) {
  const t = translator(locale, auth);
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | undefined>(undefined);

  function handleSubmit(e: React.SubmitEvent<HTMLFormElement>) {
    if (!email.trim()) {
      setError(t("emailRequired"));
      e.preventDefault();
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError(t("emailInvalid"));
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
        <h1 className="text-foreground text-[28px] leading-[1.05] font-bold tracking-[-0.8px]">{t("forgotHeading")}</h1>
        <p className="text-muted-foreground mt-2 text-sm leading-[1.45]">{t("forgotSub")}</p>
      </div>

      <FormField
        id="email"
        type="email"
        label={t("emailLabel")}
        value={email}
        onChange={(v) => {
          setEmail(v);
          if (error) setError(undefined);
        }}
        placeholder={t("emailPlaceholder")}
        autoComplete="username"
        error={error}
        icon={<Mail className="size-[17px]" />}
      />

      <SubmitButton pending={submitting} pendingText={t("forgotPending")} icon={<ArrowRight className="size-[17px]" />}>
        {t("forgotSubmit")}
      </SubmitButton>

      <a
        href="/auth/signin"
        className="text-muted-foreground hover:text-foreground inline-flex items-center justify-center gap-1.5 text-sm transition-colors"
      >
        <span aria-hidden="true">‹</span> {t("backToLogin")}
      </a>
    </form>
  );
}
