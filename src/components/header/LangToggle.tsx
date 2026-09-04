// core
import * as React from "react";

// others
import { translator, type Locale } from "../../lib/i18n/types";
import { nav } from "../../lib/i18n/nav";
import { cn } from "../../lib/utils";

// Compact language switcher for the public chrome (design `shared.jsx`
// `LangToggle`): globe + the CURRENT locale's 2-letter code, in a 38px pill.
// Visible at EVERY width — it is the only affordance a recruiter arriving on a
// Polish page has, so it never collapses into a menu.
//
// *** It is a real <form method="POST">, not a click handler. *** The cookie is
// written SERVER-side by `POST /api/locale`, which then 303s back to `redirect`.
// A client-side `document.cookie` write would leave the server-rendered markup
// in the previous locale until the next navigation, and any island reading the
// cookie would hydrate against markup the server produced under a different
// locale — the hydration-mismatch class `lessons.md` records for the signature
// timestamp. As a native form it also works with JavaScript disabled; the island
// exists only to paint the pending state (project async-button rule), so a
// pre-hydration click still switches the language.
//
// Deviations from the design source, all recorded in `design-contract.md`:
//   • *** NO CARET. *** The design draws one (`design-contract.md` §2 item 4
//     flags it as a confirmed defect: "the caret promises a menu that never
//     appears"), because its own click handler toggles EN⇄PL directly. With two
//     locales a dropdown is strictly worse — two interactions instead of one, and
//     it could not open without JavaScript, which would cost this control the one
//     property that makes it work before hydration. So the false affordance goes
//     rather than the toggle. The design's staff sibling (`SidebarLangRow`) draws
//     no caret either, so this is also the internally-consistent half of the
//     design. Revisit only if a THIRD locale lands, which is what actually turns
//     a toggle into a menu;
//   • the design hardcodes the `aria-label` in English in BOTH `STR` halves —
//     the same gap as its untranslated staff nav — so the Polish half is authored;
//   • the design mutates `window.__flotaLang`; ours round-trips the server;
//   • the design specifies no focus-visible state, so we author one.

interface Props {
  /** The locale currently in effect — this is what the pill DISPLAYS. */
  locale: Locale;
  /** Where to land after the switch. Re-validated server-side by `safeInternalPath`. */
  redirect: string;
  /** `dark` for the landing's over-hero glass chrome. */
  tone?: "light" | "dark";
}

function GlobeGlyph() {
  return (
    <svg
      width={15}
      height={15}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" />
    </svg>
  );
}

export default function LangToggle({ locale, redirect, tone = "light" }: Props) {
  const t = translator(locale, nav);
  const [submitting, setSubmitting] = React.useState(false);
  const dark = tone === "dark";
  // Two locales, so the switch target is simply "the other one". A third locale
  // would need the caret's promised menu instead — see the contract's deviation.
  const next: Locale = locale === "en" ? "pl" : "en";

  return (
    <form
      method="POST"
      action="/api/locale"
      onSubmit={() => {
        setSubmitting(true);
      }}
      className="shrink-0"
    >
      <input type="hidden" name="locale" value={next} />
      <input type="hidden" name="redirect" value={redirect} />
      <button
        type="submit"
        disabled={submitting}
        aria-label={t("changeLanguage")}
        className={cn(
          "inline-flex h-[38px] shrink-0 items-center gap-1.5 rounded-full border px-2.5 transition-colors",
          "focus-visible:ring-2 focus-visible:outline-none disabled:opacity-70",
          dark
            ? "border-white/[0.22] bg-white/[0.14] text-white backdrop-blur-[6px] focus-visible:ring-white/40"
            : "bg-card text-foreground border-[var(--flota-hair)] focus-visible:ring-[var(--flota-ink-2)]/25",
        )}
      >
        {submitting ? (
          // Same 15px box as the globe, so the pill never changes width mid-flight.
          <span
            className={cn(
              "size-[15px] animate-spin rounded-full border-2",
              dark ? "border-white/30 border-t-white" : "border-foreground/25 border-t-foreground",
            )}
          />
        ) : (
          <GlobeGlyph />
        )}
        <span className="text-[12.5px] font-bold tracking-[0.3px] uppercase">{locale}</span>
      </button>
    </form>
  );
}
