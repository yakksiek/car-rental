import { useState } from "react";
import { ArrowRight } from "lucide-react";
import { SubmitButton } from "./SubmitButton";

// R11's only action (S-14): sign out so the link can be re-opened on a clean
// browser. A native <form method="POST"> to the signout route rather than a
// fetch — it works without JS, and it matches every other auth surface here.
//
// The project rule is that any button triggering an async action shows a pending
// state. `useFormStatus` never reports pending for a form that posts to a URL
// (the browser navigates; React never owns the submission), so the flag is
// explicit. There is deliberately no reset: the only outcome of a native POST is
// a navigation, so the spinner must survive until the new document paints.
export default function SignOutButton() {
  const [submitting, setSubmitting] = useState(false);

  return (
    <form
      method="POST"
      action="/api/auth/signout"
      onSubmit={() => {
        setSubmitting(true);
      }}
    >
      <SubmitButton pending={submitting} pendingText="Wylogowywanie…" icon={<ArrowRight className="size-[17px]" />}>
        Wyloguj się
      </SubmitButton>
    </form>
  );
}
