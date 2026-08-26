// core
import React, { useState, type ReactNode } from "react";
import { Lock, Check } from "lucide-react";

// components
import { FormField } from "../auth/FormField";
import { PasswordToggle } from "../auth/PasswordToggle";
import { SubmitButton } from "../auth/SubmitButton";
import { ServerError } from "../auth/ServerError";

interface Props {
  serverError?: string | null;
  // Server-rendered markup slotted into the <form> from password.astro — today
  // just the `autocomplete="username"` anchor. Mirrors ResetPasswordForm.tsx:19
  // rather than inventing a second pattern; Astro renders it to static HTML
  // before hydration, so it is inert as far as this island is concerned.
  children?: ReactNode;
}

// In-session change-password form (S-11, design-contract D6 — no mockup; forks the
// shipped ResetPasswordForm idiom with a third "current password" field). Posts
// natively to /api/auth/change-password, which reauthenticates before updating, so
// the current password is verified server-side — the checks here are only to spare
// an obviously-doomed round-trip. Plain useState: three fields is a small form (RHF
// is reserved for 8+ per lessons).
export default function ChangePasswordForm({ serverError, children }: Props) {
  const [current, setCurrent] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState({ current: false, password: false, confirm: false });
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<{ current?: string; password?: string; confirm?: string }>({});

  function handleSubmit(e: React.SubmitEvent<HTMLFormElement>) {
    const next: typeof errors = {};
    if (current.length === 0) {
      next.current = "Podaj obecne hasło";
    }
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
      action="/api/auth/change-password"
      className="flex flex-col gap-[18px]"
      onSubmit={handleSubmit}
      noValidate
    >
      {/* First child of the <form>, above the whole password group: Firefox's
          LoginManager only searches fields BEFORE the first password field, and
          here that first field is `current`. A slot placed between the fields
          would never be found. */}
      {children}

      <div className="flex flex-col gap-3.5">
        <FormField
          id="current"
          label="Obecne hasło"
          type={show.current ? "text" : "password"}
          value={current}
          onChange={(v) => {
            setCurrent(v);
            if (errors.current) setErrors((p) => ({ ...p, current: undefined }));
          }}
          placeholder="Twoje obecne hasło"
          autoComplete="current-password"
          error={errors.current}
          icon={<Lock className="size-[17px]" />}
          endContent={
            <PasswordToggle
              visible={show.current}
              onToggle={() => {
                setShow((p) => ({ ...p, current: !p.current }));
              }}
            />
          }
        />
        <FormField
          id="password"
          label="Nowe hasło"
          type={show.password ? "text" : "password"}
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
              visible={show.password}
              onToggle={() => {
                setShow((p) => ({ ...p, password: !p.password }));
              }}
            />
          }
        />
        <FormField
          id="confirm"
          label="Powtórz nowe hasło"
          type={show.confirm ? "text" : "password"}
          value={confirm}
          onChange={(v) => {
            setConfirm(v);
            if (errors.confirm) setErrors((p) => ({ ...p, confirm: undefined }));
          }}
          placeholder="Powtórz nowe hasło"
          autoComplete="new-password"
          error={errors.confirm}
          icon={<Lock className="size-[17px]" />}
          endContent={
            <PasswordToggle
              visible={show.confirm}
              onToggle={() => {
                setShow((p) => ({ ...p, confirm: !p.confirm }));
              }}
            />
          }
        />
      </div>

      <ServerError message={serverError} />

      <SubmitButton pending={submitting} pendingText="Zapisywanie…" icon={<Check className="size-[17px]" />}>
        Zmień hasło
      </SubmitButton>
    </form>
  );
}
