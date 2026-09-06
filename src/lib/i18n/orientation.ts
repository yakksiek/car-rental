// core
import { defineDict } from "./types";

// The first-visit orientation overlay (staff-panel-discovery Phase 3).
//
// *** TRANSCRIBED VERBATIM from the design source. *** These strings are
// authored in the Claude Design project as `STR.{EN,PL}.guide` in `shared.jsx`
// and rendered by `recruiter-guide.jsx`; `design-contract.md` §7 carries the
// table and the rendered proof (`design-review/guide-d-pl.png` / `-en.png`).
// The design is the source of record here, not this file — a copy change starts
// there and is copied down.
//
// ISLAND-FACING. `OrientationOverlay.tsx` imports THIS module and reaches it
// through `translator` from `./types`, never the composed map in `./index.ts`,
// so only this namespace lands in the browser chunk. The overlay is on the
// landing page's critical path (`client:load`), which is what makes that rule
// load-bearing here rather than merely tidy.
//
// The lead is THREE keys because the design emphasises the product name
// mid-sentence and a catalog string carries no markup. Keep the spacing inside
// the values: `leadBefore` ends with a space and `leadAfter` opens with one, so
// the three concatenate without the component adding whitespace of its own.
export const orientation = defineDict({
  en: {
    kicker: "Start here · portfolio",
    heading: "Flota is two products in one.",
    leadBefore: "A public rental site for customers and the ",
    leadStrong: "Staff area",
    leadAfter: " — the operations and admin app behind it. Demo sign-in credentials are published on the sign-in page.",
    publicTitle: "Public site",
    publicBody: "Browse the fleet and request a reservation — no account needed.",
    publicCta: "Explore the site",
    staffTitle: "Staff area",
    staffBody: "The operations and admin app behind sign-in. A ready demo account is waiting on the sign-in page.",
    staffCta: "Go to the staff area",
    skip: "Skip and explore the site",
    close: "Close",
    dialogLabel: "About this project",
    // Introduces the non-interactive replica of the footer's staff pill. The
    // pill's LABEL is not here — it is `footer.staffZone`, passed in as a prop,
    // so the replica and the real control cannot drift apart.
    locator: "You'll also find it at the bottom of every page:",
  },
  pl: {
    kicker: "Zacznij tutaj · portfolio",
    heading: "Flota to dwa produkty w jednym.",
    leadBefore: "Publiczna strona wynajmu dla klientów i ",
    leadStrong: "Strefa pracownika",
    leadAfter:
      " — panel obsługi i administracji, który za nią stoi. Dane logowania do wersji demo znajdziesz na stronie logowania.",
    publicTitle: "Strona publiczna",
    publicBody: "Przeglądaj flotę i złóż rezerwację — bez zakładania konta.",
    publicCta: "Przeglądaj stronę",
    staffTitle: "Strefa pracownika",
    staffBody: "Panel obsługi i administracji za logowaniem. Na stronie logowania czeka gotowe konto demo.",
    staffCta: "Przejdź do strefy pracownika",
    skip: "Pomiń i przeglądaj stronę",
    close: "Zamknij",
    dialogLabel: "O tym projekcie",
    locator: "Znajdziesz ją też na dole każdej strony:",
  },
});
