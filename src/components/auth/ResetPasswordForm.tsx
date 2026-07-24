import React, { useState } from "react";
import { Lock, Check } from "lucide-react";
import { FormField } from "./FormField";
import { PasswordToggle } from "./PasswordToggle";
import { SubmitButton } from "./SubmitButton";
import { ServerError } from "./ServerError";

interface Props {
  // "recovery" (R3/R9 — set a new password) or "invite" (R6/R10 — first password,
  // crimson WELCOME eyebrow + "Aktywuj konto"). Chosen from the callback link type.
  mode: "recovery" | "invite";
  serverError?: string | null;
}

// Set-password form (S-08, designs R3/R9 recovery + R6/R10 invite-accept). The
// recovery session is already established (cookie) by the /auth/callback exchange,
// so this posts natively to /api/auth/reset-password → updateUser({ password }).
// The enforced minimum is the config.toml policy (6); the "10 chars / number or
// symbol" checklist in the design is an illustrative hint, not a policy change.
export default function ResetPasswordForm({ mode, serverError }: Props) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<{ password?: string; confirm?: string }>({});

  const invite = mode === "invite";

  function handleSubmit(e: React.SubmitEvent<HTMLFormElement>) {
    const next: typeof errors = {};
    if (password.length < 6) {
      next.password = "Hasło musi mieć co najmniej 6 znaków";
    }
    if (confirm !== password) {
      next.confirm = "Hasła nie są takie same";
    }
    setErrors(next);
    if (Object.keys(next).length > 0) {
      e.preventDefault();
      return;
    }
    setSubmitting(true);
  }

  return (
    <form
      method="POST"
      action="/api/auth/reset-password"
      className="flex flex-col gap-[18px]"
      onSubmit={handleSubmit}
      noValidate
    >
      <input type="hidden" name="mode" value={mode} />

      <div>
        {invite && (
          <div className="text-primary mb-1.5 text-[11px] font-bold tracking-wide uppercase">Witaj w Flocie</div>
        )}
        <h1 className="text-foreground text-[28px] leading-[1.05] font-bold tracking-[-0.8px]">
          {invite ? "Ustaw hasło" : "Ustaw nowe hasło"}
        </h1>
        <p className="text-muted-foreground mt-2 text-sm leading-[1.45]">
          Wybierz silne hasło, którego nie używasz nigdzie indziej.
        </p>
      </div>

      <div className="flex flex-col gap-3.5">
        <FormField
          id="password"
          label="Nowe hasło"
          type={show ? "text" : "password"}
          value={password}
          onChange={(v) => {
            setPassword(v);
            if (errors.password) setErrors((p) => ({ ...p, password: undefined }));
          }}
          placeholder="Twoje nowe hasło"
          autoComplete="new-password"
          error={errors.password}
          icon={<Lock className="size-[17px]" />}
          endContent={
            <PasswordToggle
              visible={show}
              onToggle={() => {
                setShow(!show);
              }}
            />
          }
        />
        <FormField
          id="confirm"
          label="Potwierdź hasło"
          type={show ? "text" : "password"}
          value={confirm}
          onChange={(v) => {
            setConfirm(v);
            if (errors.confirm) setErrors((p) => ({ ...p, confirm: undefined }));
          }}
          placeholder="Powtórz hasło"
          autoComplete="new-password"
          error={errors.confirm}
          icon={<Lock className="size-[17px]" />}
        />
      </div>

      <ServerError message={serverError} />

      <SubmitButton pending={submitting} pendingText="Zapisywanie..." icon={<Check className="size-[17px]" />}>
        {invite ? "Aktywuj konto" : "Zapisz hasło"}
      </SubmitButton>
    </form>
  );
}
