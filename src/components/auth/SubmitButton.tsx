import type { ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "../ui/button";

interface SubmitButtonProps {
  pendingText: string;
  icon: ReactNode;
  children: ReactNode;
  // Explicit pending flag. The form posts to a URL (native navigation), not a
  // React form-action, so `useFormStatus` never reports pending — the caller
  // drives the spinner via this prop instead. `useFormStatus` is kept as a
  // fallback for any future form-action use.
  pending?: boolean;
}

// Dark-ink primary submit for the staff sign-in (label, then trailing arrow),
// matching the design's submit button (staff-login.jsx).
export function SubmitButton({ pendingText, icon, children, pending: pendingProp }: SubmitButtonProps) {
  const { pending: formPending } = useFormStatus();
  const pending = pendingProp ? true : formPending;

  return (
    <Button
      type="submit"
      disabled={pending}
      className="bg-foreground text-background hover:bg-foreground/90 flex h-[52px] w-full items-center justify-center gap-2 rounded-[13px] text-[15px] font-[650] tracking-[-0.1px]"
    >
      {pending ? (
        <span className="flex items-center gap-2">
          <span className="border-background/30 border-t-background size-4 animate-spin rounded-full border-2" />
          {pendingText}
        </span>
      ) : (
        <span className="flex items-center gap-2">
          {children}
          {icon}
        </span>
      )}
    </Button>
  );
}
