// core
import * as React from "react";
import { Dialog as DialogPrimitive } from "radix-ui";

// components
import Brand from "../brand/Brand";

// others
import { cn } from "../../lib/utils";
import { orientation } from "../../lib/i18n/orientation";
import { translator, type Locale } from "../../lib/i18n/types";

// First-visit orientation overlay (staff-panel-discovery Phase 3), built to
// `design-contract.md` §§3–4 from the design's `recruiter-guide.jsx`. Polish copy
// canonical, transcribed in `src/lib/i18n/orientation.ts`.
//
// *** IT IS A REAL <form method="POST">, not three click handlers. *** The island
// mounts `client:load`, so this markup is SERVER-RENDERED into the landing page
// and is on screen before — and, with JavaScript off, INSTEAD of — hydration.
// Plain buttons would be dead in that window and the visitor would sit behind a
// scrim with no way out. As a native form the ✕, the "explore" button and the
// skip link each post their own `redirect` value to `POST /api/orientation`,
// which writes the seen cookie and 303s back. Same reasoning as `LangToggle`.
//
// The staff button is deliberately NOT intercepted: a background fetch fired
// immediately before `location.assign` can be cancelled in flight, whereas the
// native submit sets the cookie and follows the redirect in one step.
//
// Deviations from the design source, all in `design-contract.md` §8:
//   • the modal is NOT portalled. Radix's `Portal` resolves its container from
//     `document.body`, which does not exist during SSR, so a portalled dialog
//     renders nothing on the server and pops in after hydration — the one thing
//     the plan's timing rule forbids on this page. Rendered in place it is in the
//     initial HTML, and `position: fixed` still covers the viewport because the
//     island mounts as a direct child of the layout, outside the hero's
//     `overflow-hidden` stacking context;
//   • focus trap, Escape, `aria-modal` and scroll lock come from the primitive —
//     the source specifies no behaviour, and no other overlay in this codebase
//     has a focus trap;
//   • the accessible name is carried by a visually-hidden `Dialog.Title` rather
//     than the source's bare `aria-label`. Same computed name, and it is how
//     Radix expects a dialog to be named;
//   • hover / focus-visible are authored — the source specifies no states.

/** Any element carrying this attribute reopens the overlay. See the listener below. */
const OPEN_ATTRIBUTE = "data-orientation-open";

const ENDPOINT = "/api/orientation";

/** Where the staff card's button goes. The one `redirect` value that is not the current path. */
const STAFF_TARGET = "/auth/signin";

interface Props {
  /** Request locale — islands cannot read `Astro.locals`, so it arrives as a prop. */
  locale: Locale;
  /**
   * Whether the overlay opens by itself. Decided SERVER-side by
   * `shouldAutoShowOrientation` from the cookie and the session, so the markup
   * the server produced and the markup React hydrates cannot disagree.
   */
  initialOpen: boolean;
  /** The current path, the `redirect` value the two dismiss controls post. */
  redirect: string;
  /**
   * The footer pill's own label, for the non-interactive replica in card 02.
   *
   * A PROP rather than a catalog key, and deliberately so: the replica exists to
   * be recognised as the real control, so the two must never drift. The label
   * lives in `footer.staffZone`, and this island may not import that namespace
   * without pulling a second catalog into the landing page's browser chunk — so
   * the server, which already has the composed translator, hands it down.
   */
  staffPillLabel: string;
}

function ArrowGlyph() {
  return (
    <svg
      width={15}
      height={15}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.4}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  );
}

/**
 * A non-interactive REPLICA of the footer's staff pill (`SiteFooter.astro`),
 * for card 02's locator line — design `shared.jsx` `StaffPill`.
 *
 * *** It is a picture of a control, never a control. *** A `<span>` with no
 * role, no tabIndex and no handler: the real pill is one scroll away, and a
 * second focusable copy of it inside a modal would be a trap for anyone
 * tabbing through. Both glyphs are decorative, so the line reads as one
 * sentence ending in the label.
 *
 * Geometry is the footer pill's own, from `design-contract.md` section 6, so a
 * reader recognises it rather than merely reading about it.
 */
function StaffPillReplica({ label }: { label: string }) {
  return (
    <span className="inline-flex h-[36px] shrink-0 items-center gap-[8px] rounded-full border border-[#D8DEE8] bg-white pr-[8px] pl-[14px] align-middle">
      <svg
        width={14}
        height={14}
        viewBox="0 0 24 24"
        fill="none"
        stroke="#5B6474"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <rect x="4" y="11" width="16" height="10" rx="2" />
        <path d="M8 11V8a4 4 0 0 1 8 0v3" />
      </svg>
      <span className="text-[12.5px] font-bold tracking-[-0.1px] text-[#141922]">{label}</span>
      <span className="inline-flex size-[22px] shrink-0 items-center justify-center rounded-full bg-[#141922]">
        <svg
          width={12}
          height={12}
          viewBox="0 0 24 24"
          fill="none"
          stroke="#fff"
          strokeWidth={2.4}
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M5 12h14M13 6l6 6-6 6" />
        </svg>
      </span>
    </span>
  );
}

/** The design's `.fw-btn`. `flex-1` below the modal's 520px collapse, as the source does. */
const BUTTON_SHELL = cn(
  "inline-flex h-[46px] items-center justify-center gap-[9px] rounded-full pr-[16px] pl-[18px]",
  "text-[15px] font-[650] tracking-[-0.2px] whitespace-nowrap transition-colors",
  "focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0F172A] focus-visible:outline-none",
  "@max-[520px]:h-[44px] @max-[520px]:flex-1",
);

export default function OrientationOverlay({ locale, initialOpen, redirect, staffPillLabel }: Props) {
  const t = translator(locale, orientation);
  const [open, setOpen] = React.useState(initialOpen);

  // Close FIRST, then post. The write is fire-and-forget by design: a failed
  // POST means the overlay returns on the next visit, which is tolerable; a
  // close that waits on the network is not.
  const dismiss = React.useCallback(() => {
    setOpen(false);
    // Same-origin POST, so the browser sends `Origin` and the route's CSRF gate
    // passes. No `redirect` field — the modal is already closed, so the route
    // answers 204 rather than navigating.
    void fetch(ENDPOINT, { method: "POST", body: new URLSearchParams() }).catch(() => {
      // Deliberately swallowed — see above.
    });
  }, []);

  // The reopen seam. ONE delegated listener rather than a ref handed to the
  // header, so `LandingNav.astro` stays plain Astro markup with no client
  // directive — the same Astro-to-island seam `GlobalSearch.tsx` uses, minus its
  // custom event. Delegation also means no `astro:page-load` re-binding guard:
  // there is nothing bound to the header nodes to go stale across a view
  // transition.
  React.useEffect(() => {
    function onDocumentClick(event: MouseEvent) {
      const target = event.target;
      if (target instanceof Element && target.closest(`[${OPEN_ATTRIBUTE}]`)) {
        setOpen(true);
      }
    }
    document.addEventListener("click", onDocumentClick);
    return () => {
      document.removeEventListener("click", onDocumentClick);
    };
  }, []);

  return (
    <DialogPrimitive.Root
      open={open}
      onOpenChange={(next) => {
        // Radix routes Escape and an outside click through here. The form's own
        // buttons do not — they call `dismiss` from `onSubmit` — so the POST is
        // never sent twice for one dismissal.
        if (next) {
          setOpen(true);
        } else {
          dismiss();
        }
      }}
    >
      <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-[rgba(6,14,28,0.58)] backdrop-blur-[7px]" />
      <DialogPrimitive.Content
        // `aria-describedby={undefined}`: the modal has no single descriptive
        // paragraph to point at, and Radix otherwise warns about the missing id.
        aria-describedby={undefined}
        // `leading-[normal]` is the DESIGN's own line-height, not a nicety.
        // `.fw-modal` declares none, so everything inside it inherits the UA
        // `normal` except the four rules that set their own (heading 1.05, lead
        // 1.5, card title 1.15, card body 1.5) — all of which are written out
        // below. This app inherits 1.5 from `body` instead, which grew the
        // kicker, both card indices and the skip link by 2-3px each and pushed
        // the whole stack down 11px. Declaring it once here reproduces the
        // design's inheritance exactly. Same slip `LandingNav.astro` records for
        // the nav pill's items.
        //
        // `antialiased` is the second half of the same omission: `.fw-modal`
        // declares `-webkit-font-smoothing:antialiased` and that line was not
        // ported either. Without it every glyph in the modal renders ~20% heavier
        // than the board — invisible in a screenshot read by eye, and the single
        // largest source of pixel difference when the two are actually diffed.
        className={cn(
          "@container fixed z-50 box-border bg-[#0F172A] leading-[normal] text-white antialiased [box-shadow:0_30px_90px_rgba(0,0,0,0.5)]",
          // Mobile: bottom sheet.
          "inset-x-0 bottom-0 rounded-t-[24px] p-[18px_18px_24px]",
          // Tablet (the design's 834px board): centred, 660px.
          "md:inset-x-auto md:top-1/2 md:bottom-auto md:left-1/2 md:w-[660px] md:-translate-x-1/2 md:-translate-y-1/2",
          "md:rounded-[24px] md:p-[32px_34px_30px]",
          // Desktop (the design's 1440px board): 780px.
          "lg:w-[780px] lg:p-[36px_40px_34px]",
        )}
      >
        <DialogPrimitive.Title className="sr-only">{t("dialogLabel")}</DialogPrimitive.Title>

        <form
          method="POST"
          action={ENDPOINT}
          onSubmit={(event) => {
            // Only the two dismiss controls are intercepted. The staff button
            // carries no marker, so its native submit sets the cookie on the way
            // to /auth/signin rather than racing a cancelled fetch.
            const submitter = event.nativeEvent.submitter;
            if (submitter?.hasAttribute("data-orientation-dismiss")) {
              event.preventDefault();
              dismiss();
            }
          }}
          className="flex flex-col gap-[18px] md:gap-[26px]"
        >
          <div className="flex items-center justify-between">
            <Brand
              tone="inverse"
              className="gap-[9px]"
              markClass="w-[32px] h-auto"
              wordmarkClass="text-[19px] tracking-[-0.4px]"
            />
            <button
              type="submit"
              name="redirect"
              value={redirect}
              data-orientation-dismiss
              aria-label={t("close")}
              className={cn(
                "flex size-[40px] items-center justify-center rounded-full",
                "border border-white/[0.14] bg-white/[0.04] text-white transition-colors",
                "hover:bg-white/[0.12] focus-visible:ring-2 focus-visible:ring-white/40 focus-visible:outline-none",
              )}
            >
              <svg
                width={15}
                height={15}
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2.2}
                strokeLinecap="round"
                aria-hidden="true"
              >
                <path d="M6 6l12 12M18 6L6 18" />
              </svg>
            </button>
          </div>

          <div>
            <div className="inline-flex items-center gap-[10px] font-mono text-[11.5px] font-semibold tracking-[2px] text-[#F0A3A3] uppercase">
              <span aria-hidden="true" className="bg-primary size-[8px] rounded-[99px]" />
              {t("kicker")}
            </div>
            {/* `6cqw` resolves against the modal, not the viewport — 44px at 780,
                39.6px at 660, and the 30px floor on the bottom sheet. */}
            {/* An `h2`, not the design's `h1` — the landing page already has one.
                The dialog's own accessible name is the visually-hidden
                `Dialog.Title` above, which is what `design-contract.md` §3
                specifies ("O tym projekcie"). */}
            <h2 className="mt-[12px] font-serif text-[clamp(30px,6cqw,44px)] leading-[1.05] font-normal tracking-[-0.02em] [text-wrap:balance] @max-[520px]:mt-[10px]">
              {t("heading")}
            </h2>
            <p className="mt-[12px] max-w-[600px] text-[16px] leading-[1.5] [text-wrap:pretty] text-[#B4BDCD] @max-[520px]:mt-[10px] @max-[520px]:text-[14.5px]">
              {t("leadBefore")}
              <b className="font-[650] text-white">{t("leadStrong")}</b>
              {t("leadAfter")}
            </p>
          </div>

          <div className="grid grid-cols-[1fr_1.35fr] gap-[16px] @max-[520px]:grid-cols-1 @max-[520px]:gap-[12px]">
            <div
              className={cn(
                "flex min-w-0 flex-col gap-[18px] rounded-[18px] border border-white/[0.10] bg-white/[0.04] p-[22px]",
                "@max-[520px]:gap-[14px] @max-[520px]:p-[16px]",
              )}
            >
              <div>
                <div className="mb-[8px] font-mono text-[12.5px] font-semibold tracking-[1.5px] text-[#8B96AA]">01</div>
                <div className="text-[21px] leading-[1.15] font-bold tracking-[-0.4px]">{t("publicTitle")}</div>
                <div className="mt-[6px] text-[15px] leading-[1.5] [text-wrap:pretty] text-[#A5AFC0] @max-[520px]:text-[14.5px]">
                  {t("publicBody")}
                </div>
              </div>
              <div className="mt-auto flex">
                <button
                  type="submit"
                  name="redirect"
                  value={redirect}
                  data-orientation-dismiss
                  className={cn(
                    BUTTON_SHELL,
                    "border border-white/[0.16] bg-white/[0.06] text-[#E5EAF3]",
                    "hover:bg-white/[0.12] focus-visible:ring-white/40",
                  )}
                >
                  {t("publicCta")}
                  <ArrowGlyph />
                </button>
              </div>
            </div>

            <div
              className={cn(
                "flex min-w-0 flex-col gap-[18px] rounded-[18px] border border-[rgba(180,54,56,0.55)] bg-[rgba(180,54,56,0.10)] p-[22px]",
                "@max-[520px]:gap-[14px] @max-[520px]:p-[16px]",
              )}
            >
              <div>
                <div className="mb-[8px] font-mono text-[12.5px] font-semibold tracking-[1.5px] text-[#F0A3A3]">02</div>
                <div className="text-[21px] leading-[1.15] font-bold tracking-[-0.4px]">{t("staffTitle")}</div>
                <div className="mt-[6px] text-[15px] leading-[1.5] [text-wrap:pretty] text-[#D5DBE6] @max-[520px]:text-[14.5px]">
                  {t("staffBody")}
                </div>
              </div>
              <div className="mt-auto flex">
                {/* NOT marked `data-orientation-dismiss` — see the onSubmit comment. */}
                <button
                  type="submit"
                  name="redirect"
                  value={STAFF_TARGET}
                  className={cn(
                    BUTTON_SHELL,
                    "bg-primary border-primary border text-white",
                    "hover:opacity-90 focus-visible:ring-white/60",
                  )}
                >
                  {t("staffCta")}
                  <ArrowGlyph />
                </button>
              </div>
              {/* Two routes, two jobs: the CTA above takes the visitor there now,
                  this shows them the control they will find in the footer of
                  every public page, so they can get back once this overlay is
                  gone for good. */}
              <div className="flex flex-wrap items-center gap-[8px] text-[13px] leading-[1.4] text-[#C6A0A2] @max-[520px]:text-[12.5px]">
                {t("locator")}
                <StaffPillReplica label={staffPillLabel} />
              </div>
            </div>
          </div>

          {/* Same action as the "explore" button; hidden below the modal's 520px collapse. */}
          <button
            type="submit"
            name="redirect"
            value={redirect}
            data-orientation-dismiss
            className={cn(
              "self-start text-[14.5px] text-[#8B96AA] underline underline-offset-[3px] transition-colors",
              "hover:text-white focus-visible:ring-2 focus-visible:ring-white/40 focus-visible:outline-none",
              "@max-[520px]:hidden",
            )}
          >
            {t("skip")}
          </button>
        </form>
      </DialogPrimitive.Content>
    </DialogPrimitive.Root>
  );
}
