// core
import { defineDict, type Locale } from "./types";

// others
import type { PluralForms } from "../format";

// The public landing page (`src/pages/index.astro`) and its three sections —
// `landing/ProcessSteps.astro`, `landing/TrustCard.astro`,
// `landing/TypeSelector.astro`. All server-rendered `.astro`, so they read these
// through `Astro.locals.t("landing.…")` and ship no JavaScript.
//
// **Nothing an island imports may reach this namespace.** It is ~35 keys of
// marketing prose, and the page's one island (`vehicle/HeroSearch.tsx`) would
// double in size carrying both locales of it for the six labels on a search bar
// — measured at +3 508 B raw / +1 394 B gzip against `island-baseline.md` before
// those six moved to `./vehicle.ts`. The rule is the accessor boundary in
// `./types.ts`; this is what it looks like inside one namespace.
//
// Marketing copy, so most of it is authored rather than harvested: the design's
// `STR` covers the reservation funnel and the cockpit, not this page's hero and
// stepper. Where a term recurs it follows `glossary.md` — `kaucja` → deposit,
// `protokół wydania` → pickup protocol, `faktura VAT` keeps its Polish name plus
// a one-time gloss (frame decision 3).

/**
 * The hero eyebrow's counted phrase — `7 pojazdów dostępnych dziś`.
 *
 * The whole phrase is plural-selected, not just the noun, because Polish agrees
 * the ADJECTIVE with the count too (`1 pojazd dostępny` / `2 pojazdy dostępne` /
 * `5 pojazdów dostępnych`). The string this replaced was a frozen genitive that
 * read correctly only for 5+ — invisible at the seeded fleet size of 7, wrong at
 * 1 or 2. Rendered uppercase by the component, so these stay sentence-cased.
 */
export const AVAILABLE_TODAY_FORMS: Record<Locale, PluralForms> = {
  en: {
    one: "vehicle available today",
    other: "vehicles available today",
  },
  pl: {
    one: "pojazd dostępny dziś",
    few: "pojazdy dostępne dziś",
    many: "pojazdów dostępnych dziś",
    other: "pojazdów dostępnych dziś",
  },
};

export const landing = defineDict({
  en: {
    // ── Hero ────────────────────────────────────────────────────────────────
    // The <h1>, split across two lines by the component's own <br>.
    heroTitleLine1: "Commercial",
    heroTitleLine2: "vehicles",
    // Mobile + tablet lede.
    heroLede: "Long-term and daily rental, fully online, with a faktura VAT (Polish VAT invoice).",
    // Desktop lede — deliberately different copy, per the design.
    heroLedeDesktop: "New vehicles for your business. Available right away.",
    heroBullet1: "Free delivery and collection in the city",
    heroBullet1Desktop: "Free delivery and collection across the city",
    heroBullet2: "Free cancellation",
    heroBullet3: "Medium-term rental from one month",
    heroCta: "Book online",

    // ── Trust card ──────────────────────────────────────────────────────────
    // Ratings row — a hardcoded placeholder; there is no reviews feature.
    reviews: "customer reviews",
    fleetCountSub: "in the fleet, ready to go",
    channelsTitle: "Reservation",
    channelsSub: "online or by phone",

    // ── Process steps ───────────────────────────────────────────────────────
    processEyebrow: "How it works",
    processTitle: "The rental process",
    processSub: "Online or by phone — the choice is yours.",
    processLanePrompt: "You choose how to start:",
    processLaneOnline: "Online — no phone call",
    processLanePhone: "By phone",
    step1Title: "Booking",
    step1TitleShort: "Booking",
    step1Desc: "You book online or by phone, and we confirm the dates by email.",
    step2Title: "Paperwork and payment",
    step2TitleShort: "Documents and payment",
    step2Desc: "We check your documents, take payment plus the deposit, and you sign on a tablet.",
    step3Title: "Inspection and vehicle pickup",
    step3TitleShort: "Inspection and pickup",
    step3Desc: "We inspect the vehicle together and you drive away with the pickup protocol in your inbox.",
    step4Title: "Vehicle return and deposit",
    step4TitleShort: "Return and deposit",
    step4Desc: "After the inspection you sign the return protocol and your deposit comes back to you.",

    // ── Type selector ───────────────────────────────────────────────────────
    typesTitle: "Choose a vehicle type",
    typesAllCta: "All vehicles",

    // ── Featured strip ──────────────────────────────────────────────────────
    popular: "Popular",
  },
  pl: {
    heroTitleLine1: "Pojazdy",
    heroTitleLine2: "użytkowe",
    heroLede: "Wynajem długoterminowy i na dobę, w pełni online, z fakturą VAT.",
    heroLedeDesktop: "Nowe samochody dla Twojej firmy. Dostępne od ręki!",
    heroBullet1: "Darmowe podstawienie i odbiór w mieście",
    heroBullet1Desktop: "Darmowe podstawienie i odbiór na terenie miasta",
    heroBullet2: "Bezpłatne odwołanie rezerwacji",
    heroBullet3: "Wynajem średnioterminowy już od 1 miesiąca",
    heroCta: "Zarezerwuj online",

    reviews: "opinii klientów",
    fleetCountSub: "we flocie, gotowe od ręki",
    channelsTitle: "Rezerwacja",
    channelsSub: "online lub telefonicznie",

    processEyebrow: "Jak to działa",
    processTitle: "Proces wynajmu pojazdu",
    processSub: "Online albo telefonicznie — wybór należy do Ciebie.",
    processLanePrompt: "Ty wybierasz, jak zaczynasz:",
    processLaneOnline: "Online — bez telefonu",
    processLanePhone: "Telefonicznie",
    step1Title: "Rezerwacja",
    step1TitleShort: "Rezerwacja",
    step1Desc: "Rezerwujesz online lub telefonicznie, a potwierdzenie terminu wysyłamy e-mailem.",
    step2Title: "Podpisanie dokumentów i płatność",
    step2TitleShort: "Dokumenty i płatność",
    step2Desc: "Sprawdzamy dokumenty, pobieramy płatność z kaucją, a umowę podpisujesz na tablecie.",
    step3Title: "Oględziny i wydanie pojazdu",
    step3TitleShort: "Oględziny i wydanie",
    step3Desc: "Wspólnie oglądamy pojazd i odbierasz auto z protokołem wydania na e-mailu.",
    step4Title: "Zwrot pojazdu i kaucja",
    step4TitleShort: "Zwrot i kaucja",
    step4Desc: "Po oględzinach podpisujesz protokół zwrotu, a kaucja wraca do Ciebie.",

    typesTitle: "Wybierz typ pojazdu",
    typesAllCta: "Cała flota",

    popular: "Popularne",
  },
});
