import React, { useState, type ReactNode } from "react";
import { Lock, Check } from "lucide-react";
import { FormField } from "./FormField";
import { PasswordToggle } from "./PasswordToggle";
import { SubmitButton } from "./SubmitButton";
import { ServerError } from "./ServerError";

interface Props {
  // "recovery" (R3/R9 — set a new password) or "invite" (R6/R10 — first password,
  // crimson WELCOME eyebrow + "Aktywuj konto"). Read server-side from the marker
  // cookie /auth/callback stamped — the form no longer posts it, because a field
  // the client controls has no business steering a security-adjacent route (S-14).
  mode: "recovery" | "invite";
  serverError?: string | null;
  // The `Ustawiasz hasło dla <email>` account box, slotted in from
  // reset-password.astro so R3/R9 and R6/R10 reuse AccountBox.astro rather than a
  // React copy of it. Astro renders it to static HTML before hydration, so it is
  // inert markup as far as this island is concerned.
  children?: ReactNode;
}

// Set-password form (S-08, designs R3/R9 recovery + R6/R10 invite-accept).
//
// THERE IS NO SESSION WHILE THIS RENDERS. It used to say the opposite — that
// /auth/callback had already exchanged the link into a cookie — and that stopped
// being true at invite-journey-fixes. The GET now only validates, resolves and
// stamps the token, minting nothing (callback.ts:23-26), and any visitor who DOES
// hold a session is redirected to /auth/link-conflict instead (callback.ts:50-52).
//
// The exchange happens at step (f) of the POST — reset-password.ts:128-133 — as
// one operation with the password set. That ordering is why a typo'd confirmation
// leaves the link usable: the token is spent only once validation has passed.
//
// So this posts natively to /api/auth/reset-password, which does
// verifyOtp → updateUser({ password }). The enforced minimum is the config.toml
// policy (6); the "10 chars / number or symbol" checklist in the design is an
// illustrative hint, not a policy change.
export default function ResetPasswordForm({ mode, serverError, children }: Props) {
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
      <div>
        {invite && (
          <div className="text-primary mb-1.5 text-[11px] font-bold tracking-wide uppercase">Witaj we Flocie</div>
        )}
        <h1 className="text-foreground text-[28px] leading-[1.05] font-bold tracking-[-0.8px]">
          {invite ? "Ustaw hasło" : "Ustaw nowe hasło"}
        </h1>
        <p className="text-muted-foreground mt-2 text-sm leading-[1.45]">
          {invite
            ? "Masz zaproszenie do zespołu dyspozytorni. Utwórz hasło, aby aktywować konto."
            : "Wybierz silne hasło, którego nie używasz nigdzie indziej."}
        </p>
      </div>

      {/* Account box (`Ustawiasz hasło dla`). A direct flex child, so the form's
          own gap-[18px] supplies the 18px the design puts above and below it —
          no margin of its own. */}
      {children}

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
