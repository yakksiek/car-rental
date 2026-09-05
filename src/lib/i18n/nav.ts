// core
import { defineDict } from "./types";

// Public site chrome — the five nav destinations plus the header controls that
// sit beside them (`SiteHeader.astro`, `LandingNav.astro`, `MobileNav.tsx`,
// `ActionMenu.tsx`, `LangToggle.tsx`).
//
// *** `fleet` is the NAV ITEM, and it translates. *** The identically-spelled
// BRAND lives in `./layout.ts` and does not — frame decision 5. Keeping them in
// different namespaces is the whole point: extraction tooling sees one string
// `Flota` with two opposite requirements, and only the namespace split tells them
// apart. Do not "deduplicate" these.
//
// English harvested from the design source's `STR.EN` (`home`, `fleet`,
// `pricing`, `reserveNow`, `browseFleet`, `ret.call`); see the change's
// `glossary.md` §1 and §7.
export const nav = defineDict({
  en: {
    home: "Home",
    fleet: "Fleet",
    pricing: "Pricing",
    faq: "FAQ",
    about: "About",
    // Header CTA → /fleet (`STR.EN.reserveNow`).
    reserve: "Reserve now",
    // Landing-pill CTA and the second <ActionMenu> row, both → /fleet.
    browseFleet: "Browse the fleet",
    // First <ActionMenu> row — a `tel:` link (`STR.EN.ret.call`).
    call: "Call",
    // <ActionMenu> trigger. The design labels it `t.browseFleet`, which
    // design-contract.md §2 item 3 records as a confirmed defect; we name the
    // menu's real purpose instead.
    contactMenu: "Contact & booking",
    menu: "Menu",
    closeMenu: "Close menu",
    // <LangToggle>. The design hardcodes English in BOTH halves — the same
    // design gap as the untranslated staff nav (design-contract.md §2 item 9),
    // so the Polish half is authored here.
    changeLanguage: "Change language",
  },
  pl: {
    home: "Start",
    fleet: "Flota",
    pricing: "Cennik",
    faq: "FAQ",
    about: "O nas",
    reserve: "Zarezerwuj",
    browseFleet: "Przeglądaj flotę",
    call: "Zadzwoń",
    contactMenu: "Kontakt i rezerwacja",
    menu: "Menu",
    closeMenu: "Zamknij menu",
    changeLanguage: "Zmień język",
  },
});
