// core
import { defineDict } from "./types";

// `SiteFooter.astro` — the 3-column contact footer shared across the whole
// customer-facing site.
//
// **`staffZone` is the highest-leverage string in the repo.** It is the ONLY
// link from the public site into the demo sign-in, so an English-speaking
// recruiter who cannot read "Strefa pracownika" never reaches the cockpit at
// all — which is the acceptance test this whole change is ordered around.
// English harvested from `STR.EN.login.zone`.
//
// The brand wordmark and the `© 2026 Flota` prefix are composed in the
// component and stay untranslated; only `rights` is a sentence.
export const footer = defineDict({
  en: {
    tagline: "Van rental in Warsaw — by the day, short-term and long-term.",
    headingRental: "Rental",
    headingInfo: "Information",
    headingContact: "Contact",
    daily: "By the day",
    shortTerm: "Short-term",
    mediumTerm: "Medium-term",
    longTerm: "Long-term",
    about: "About",
    pricing: "Pricing",
    faq: "FAQ",
    contact: "Contact",
    staffZone: "Employee zone",
    open247: "Open 24/7",
    // The one depot. The city translates; the street name is a proper noun.
    address: "Al. Jerozolimskie 200, Warsaw",
    rights: "All rights reserved.",
  },
  pl: {
    tagline: "Wynajem samochodów dostawczych w Warszawie — na dobę, krótko- i długoterminowo.",
    headingRental: "Wynajem",
    headingInfo: "Informacje",
    headingContact: "Kontakt",
    daily: "Na dobę",
    shortTerm: "Krótkoterminowy",
    mediumTerm: "Średnioterminowy",
    longTerm: "Długoterminowy",
    about: "O nas",
    pricing: "Cennik",
    faq: "FAQ",
    contact: "Kontakt",
    staffZone: "Strefa pracownika",
    open247: "Czynne 24/7",
    address: "Al. Jerozolimskie 200, Warszawa",
    rights: "Wszelkie prawa zastrzeżone.",
  },
});
