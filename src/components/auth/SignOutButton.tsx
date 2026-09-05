import { useState } from "react";
import { ArrowRight } from "lucide-react";
import { SubmitButton } from "./SubmitButton";
import { auth } from "../../lib/i18n/auth";
import { translator, type Locale } from "../../lib/i18n/types";

interface Props {
  /** Islands cannot read `Astro.locals`, so the page passes the request locale in. */
  locale: Locale;
}

// R11's only action (S-14): sign out so the link can be re-opened on a clean
// browser. A native <form method="POST"> to the signout route rather than a
// fetch — it works without JS, and it matches every other auth surface here.
//
// The project rule is that any button triggering an async action shows a pending
// state. `useFormStatus` never reports pending for a form that posts to a URL
// (the browser navigates; React never owns the submission), so the flag is
// explicit. There is deliberately no reset: the only outcome of a native POST is
// a navigation, so the spinner must survive until the new document paints.
export default function SignOutButton({ locale }: Props) {
  const t = translator(locale, auth);
  const [submitting, setSubmitting] = useState(false);

  return (
    <form
      method="POST"
      action="/api/auth/signout"
      onSubmit={() => {
        setSubmitting(true);
      }}
    >
      <SubmitButton pending={submitting} pendingText={t("signingOut")} icon={<ArrowRight className="size-[17px]" />}>
        {t("signOut")}
      </SubmitButton>
    </form>
  );
}
