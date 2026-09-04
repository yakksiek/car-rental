// core
import * as React from "react";

// others
import { LOCALE_ENDONYMS, translator, type Locale } from "../../lib/i18n/types";
import { staff } from "../../lib/i18n/staff";
import { cn } from "../../lib/utils";

// The STAFF locale control (design `staff-desktop.jsx` `SidebarLangRow`), in the
// two places the cockpit has room for one.
//
// *** It is deliberately NOT in the top band. *** The design originally put
// <LangToggle> in `StaffTopbar`; the shipped band cannot hold it — at 768px the
// 520px <GlobalSearch> field plus the 92px <QuickAddButton> already consume 624px
// of 632px usable (`StaffShell.astro`), so a ~75px control overflows by ~67px
// before the page title gets any space. The design was changed to match
// (2026-09-01): the row now lives in the sidebar's `mt-auto` block, above the user
// chip, where its trailing code chip lands in the same right-hand column as the
// nav badges (4, 2, PL). Mobile gets no chrome control at all — the tab bar is
// already at 8 items = 360px on a 360px viewport — so the `account` variant below
// carries the preference where a `profiles.locale` setting belongs.
//
// The label is the ENDONYM of the CURRENT language ("Polski" / "English"), never a
// translated string: a language row has to read in the language it names, or the
// one control someone needs in order to escape a language they cannot read is
// itself written in that language.
//
// Like <LangToggle> this is a real form POST to `/api/locale` — see that file for
// why the cookie is written server-side. The island exists to paint the pending
// state (project async-button rule); a pre-hydration click still switches.

interface Props {
  /** The locale currently in effect — this is what the row DISPLAYS. */
  locale: Locale;
  /** Where to land after the switch. Re-validated server-side by `safeInternalPath`. */
  redirect: string;
  /** `sidebar` = the desktop rail/sidebar row; `account` = the /dashboard/account row. */
  variant: "sidebar" | "account";
}

function GlobeGlyph({ size }: { size: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" />
    </svg>
  );
}

function Spinner({ size }: { size: number }) {
  return (
    <span
      className="border-foreground/25 border-t-foreground block animate-spin rounded-full border-2"
      style={{ width: size, height: size }}
    />
  );
}

export default function LangRow({ locale, redirect, variant }: Props) {
  const t = translator(locale, staff);
  const [submitting, setSubmitting] = React.useState(false);
  // Two locales, so the switch target is simply "the other one".
  const next: Locale = locale === "en" ? "pl" : "en";
  const sidebar = variant === "sidebar";

  // Same geometry as the sidebar nav rows and the account card's rows, so each
  // reads as a sibling of what it sits beside rather than a bolted-on control.
  const code = (
    <span
      className={cn(
        "flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-[var(--flota-neutral-soft)] px-[5px] text-[10.5px] font-bold",
        "text-foreground ml-auto shrink-0 uppercase",
        sidebar && "hidden lg:flex",
      )}
    >
      {locale}
    </span>
  );

  return (
    <form
      method="POST"
      action="/api/locale"
      onSubmit={() => {
        setSubmitting(true);
      }}
      className="w-full"
    >
      <input type="hidden" name="locale" value={next} />
      <input type="hidden" name="redirect" value={redirect} />
      <button
        type="submit"
        disabled={submitting}
        aria-label={sidebar ? t("changeLanguage") : undefined}
        className={cn(
          "flex items-center transition-colors disabled:opacity-60",
          sidebar
            ? "text-foreground hover:bg-background rounded-[10px] md:mx-auto md:size-11 md:justify-center lg:size-auto lg:w-full lg:justify-start lg:gap-2.5 lg:px-2.5 lg:py-2.5 lg:text-[13px] lg:font-[540] lg:tracking-tight"
            : "hover:bg-background w-full gap-[13px] px-4 py-3.5 text-left",
        )}
      >
        <span
          className={cn(
            "flex shrink-0 items-center justify-center text-[var(--flota-ink-2)]",
            sidebar ? "size-[18px]" : "bg-background size-9 rounded-[10px]",
          )}
        >
          {submitting ? <Spinner size={16} /> : <GlobeGlyph size={16} />}
        </span>

        {sidebar ? (
          <span className="hidden lg:inline">{LOCALE_ENDONYMS[locale]}</span>
        ) : (
          <span className="min-w-0">
            <span className="text-foreground block text-[13.5px] font-[650] tracking-[-0.15px]">
              {t("languageLabel")}
            </span>
            <span className="text-muted-foreground mt-0.5 block text-[12px]">{LOCALE_ENDONYMS[locale]}</span>
          </span>
        )}

        {code}
      </button>
    </form>
  );
}
