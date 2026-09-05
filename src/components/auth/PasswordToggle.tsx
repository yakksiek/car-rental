import { Eye, EyeOff } from "lucide-react";

import { auth } from "../../lib/i18n/auth";
import { translator, type Locale } from "../../lib/i18n/types";

interface PasswordToggleProps {
  visible: boolean;
  onToggle: () => void;
  /** Passed down from the form island; this is not separately mounted. */
  locale: Locale;
}

// Trailing eye toggle inside the light staff FormField row (flex child, not
// absolutely positioned).
export function PasswordToggle({ visible, onToggle, locale }: PasswordToggleProps) {
  const t = translator(locale, auth);

  return (
    <button
      type="button"
      onClick={onToggle}
      className="text-muted-foreground hover:text-foreground flex shrink-0 items-center transition-colors"
      aria-label={visible ? t("hidePassword") : t("showPassword")}
    >
      {visible ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
    </button>
  );
}
