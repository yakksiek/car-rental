// core
import { defineDict } from "./types";

// ---------------------------------------------------------------------------
// The three public info pages — `/pricing`, `/faq`, `/about`.
//
// **Authored, not harvested.** The design source's `info-pages.jsx` hardcodes
// every one of these strings in Polish and never reads `STR` (the same gap
// design-contract §2 item 9 records for the staff nav), so only the three NAV
// labels had an English twin and those live in `./nav.ts`. Everything here was
// written for this change against `glossary.md` §8's conventions: en-GB
// (licence / organisation), sentence case, typographic apostrophes.
//
// SERVER-ONLY — all three pages are pure Astro with no island, so nothing here
// reaches a browser bundle and the ~90 keys of marketing prose cost nothing.
// Keeping it out of `./vehicle.ts` is deliberate for exactly that reason: that
// namespace IS island-reachable (`HeroSearch`), and the Phase 4 near-miss
// recorded in `island-baseline.md` was prose leaking into it.
//
// **Polish-law terms keep their Polish name plus a one-time gloss** (frame
// decision 3, glossary §4): NIP, dowód osobisty, prawo jazdy kat. B/C and
// faktura VAT are named Polish legal instruments with no English equivalent, so
// inventing "tax ID" or "national ID card" would be wrong, not merely awkward.
// The gloss appears on first use per surface; later mentions use the bare term.
// ---------------------------------------------------------------------------
export const info = defineDict({
  en: {
    // ═══ /pricing ═════════════════════════════════════════════════════════
    pricingTitle: "Pricing — Flota",
    pricingEyebrow: "Pricing",
    pricingHeading: "Clear rates, no hidden costs",
    pricingLead:
      "You pay by the day or by the month — the longer the rental, the lower the rate. Insurance and roadside assistance are always included.",

    // Rental-length tiers (static marketing: a length-discount ladder we do not
    // store, so the numbers stay in the page and only the words are here).
    tierDailyName: "By the day",
    tierDailyWhen: "1–3 days",
    tierDailyNote: "Flexible, no commitment",
    tierShortName: "Short-term",
    tierShortWhen: "1–30 days",
    tierShortNote: "Lower daily rate",
    tierShortTag: "Popular",
    tierMediumName: "Medium-term",
    tierMediumWhen: "1–24 months",
    tierMediumNote: "Fixed monthly instalment",
    tierLongName: "Long-term",
    tierLongWhen: "24+ months",
    tierLongNote: "Lowest cost, full servicing",
    tierLongTag: "Best price",
    tierFrom: "from",
    // Rate suffix on a tier card. `zł` is a currency symbol, not a word, and
    // stays in both locales (glossary §4).
    tierPerDay: "zł/day",

    // Live per-category rate table.
    ratesHeading: "Rates by vehicle type",
    ratesLead: "Net prices, starting from. The final quote depends on the dates and the length of the rental.",
    ratesColVehicle: "Vehicle",
    ratesColDay: "Day",
    ratesColMonth: "Month",
    ratesEmpty: "Pricing is temporarily unavailable — call us on +48 22 100 20 30",
    // Prefix on a table amount; the amount itself comes from `formatPln`.
    ratesFrom: "from",
    ratesPerDayShort: "/day",
    ratesPerMonthShort: "/mo",

    includedHeading: "Included in every price",
    included1: "Full insurance — comprehensive, third-party and personal accident",
    included2: "24/7 roadside assistance across Poland",
    included3: "Free delivery within the city",
    included4: "300 km per day included (0.50 zł per km after that)",
    included5: "Servicing, inspections and tyre changes",
    included6: "A replacement vehicle if yours breaks down",

    goodToKnowHeading: "Good to know",
    goodToKnowDepositKey: "Deposit",
    goodToKnowDepositValue: "from 1 500 zł, refunded after the vehicle comes back",
    goodToKnowVatKey: "VAT",
    goodToKnowVatValue: "All prices are net (+23% VAT)",
    goodToKnowInvoiceKey: "Invoice",
    goodToKnowInvoiceValue: "A faktura VAT (Polish VAT invoice) with every rental",
    goodToKnowPaymentKey: "Payment",
    goodToKnowPaymentValue: "Card, bank transfer or cash on pickup",

    // Shared CTA (also on /about).
    reserveVehicle: "Reserve a vehicle",

    // ═══ /faq ═════════════════════════════════════════════════════════════
    faqTitle: "FAQ — Flota",
    faqEyebrow: "FAQ",
    faqHeading: "Frequently asked questions",
    faqLead:
      "Everything about renting — documents, deposit, insurance and payment. Didn’t find your answer? Call us, we’re available around the clock.",

    faqDocsQ: "What documents do I need to rent?",
    faqDocsA:
      "A dowód osobisty (Polish national ID card) and a valid prawo jazdy kat. B (Polish driving licence, category B) — category C for vehicles over 3.5 t. Companies also give their NIP (Polish tax identification number); we issue the invoice on the spot.",
    faqAccountQ: "Do I need an account to book?",
    faqAccountA:
      "No. You can book without creating an account — pick a vehicle and dates, and the confirmation arrives by email. You can also call us directly.",
    faqDepositQ: "How much is the deposit and when do you refund it?",
    faqDepositA:
      "The deposit starts at 1 500 zł and depends on the vehicle class. We refund it in full once the vehicle comes back undamaged, usually within 3 working days.",
    faqMileageQ: "What is the mileage limit?",
    faqMileageA:
      "300 km per day as standard. Every extra kilometre is 0.50 zł. For long-term rentals we agree a higher limit individually.",
    faqInsuranceQ: "What does the insurance cover?",
    faqInsuranceA:
      "Every vehicle carries full comprehensive, third-party and personal accident cover, plus 24/7 roadside assistance across Poland. If it breaks down or is in a collision, we bring you a replacement.",
    faqDeliveryQ: "Do you deliver the vehicle to my address?",
    faqDeliveryA:
      "Yes. Delivery and collection within the city are free. Outside the city we quote the trip individually — just give us the address when you book.",
    faqExtendQ: "Can I extend the rental?",
    faqExtendA:
      "Of course. A phone call or an email before the contract ends is enough. Over a longer period you automatically move to a better rate.",
    faqCancelQ: "How do I cancel or change a booking?",
    faqCancelA:
      "Free cancellation is possible up to 24 hours before pickup. We will change the dates or the vehicle over the phone at no extra charge.",
    faqAgeQ: "What is the minimum driver age?",
    faqAgeA:
      "The driver has to be 21 or over and have held a licence for at least 2 years. We add extra drivers to the contract free of charge.",
    faqPaymentQ: "How can I pay?",
    faqPaymentA:
      "By card, bank transfer or cash on pickup. For companies we offer deferred payment against a faktura VAT (Polish VAT invoice).",

    faqCtaHeading: "Got another question?",
    faqCtaSub: "Our team will help you pick the right vehicle — 24/7.",
    faqCtaCall: "Call",
    faqCtaWrite: "Write",

    // ═══ /about ═══════════════════════════════════════════════════════════
    aboutTitle: "About — Flota",
    aboutEyebrow: "About",
    aboutHeading: "A fleet you can rely on",
    aboutLead:
      "We are a team with over 10 years’ experience in van rental. We offer flexible arrangements for companies and private customers — from a single day to a long-term lease.",

    statYearsValue: "10+",
    statYearsLabel: "years in business",
    statFleetLabel: "vehicles in the fleet",
    statSupportValue: "24/7",
    statSupportLabel: "support and assistance",
    statAgeValue: "up to 2 yrs",
    statAgeLabel: "max. vehicle age",

    storyEyebrow: "Our story",
    storyHeading: "Dependable and flexible from day one",
    storyP1:
      "All our vehicles are kept in excellent technical condition, with low mileage and a generous specification. Whether you rent for a day, a month or longer, you can count on full insurance and support at every stage.",
    storyP2:
      "We specialise in short-, medium- and long-term rental, so we can match the offer to your business as its needs change.",

    fleetHeading: "Our fleet",
    fleetLead: "A wide choice of vehicles for every transport job.",
    fleetVansT: "L3 and L4H2 panel vans",
    fleetVansD: "Renault Master, Ford Transit, Mercedes Sprinter",
    fleetBusesT: "8–9 seat minibuses",
    fleetBusesD: "Ideal for moving larger groups",
    fleetBoxT: "Box bodies for 8–10 euro pallets",
    fleetBoxD: "Box and curtain-side bodies",
    fleetTailliftT: "Tail lift",
    fleetTailliftD: "Easy loading and unloading of heavy pallets",
    fleetCrewT: "7-seat crew vans",
    fleetCrewD: "Crew and cargo in one vehicle",
    fleetCityT: "Small city vans",
    fleetCityD: "Nimble, for transport around town",

    valuesHeading: "Why Flota",
    valueInsuranceT: "Full insurance",
    valueInsuranceD:
      "Every vehicle carries comprehensive, third-party and personal accident cover, plus 24/7 assistance across Poland.",
    valueMileageT: "Low mileage",
    valueMileageD: "Vehicles under manufacturer warranty, serviced and kept in perfect condition.",
    valueModernT: "A modern fleet",
    valueModernD: "We replace vehicles at most every 2 years — you drive the newest models.",
    valueFlexibleT: "Flexible terms",
    valueFlexibleD: "Rental by the day, short-, medium- and long-term — whatever you need.",
    valueInvoiceT: "Faktura VAT",
    valueInvoiceD: "Full paperwork and a faktura VAT (Polish VAT invoice) with every rental, for companies too.",
    valueSupportT: "24/7 support",
    valueSupportD: "We are on the phone at any hour — weekends and public holidays included.",

    contactEyebrow: "Contact",
    contactHeading: "Let’s talk about your transport",
    contactLead:
      "Call or write — we will match the vehicle and the dates to what you need. We are available around the clock.",
    contactPhoneKey: "Phone",
    contactEmailKey: "Email",
    contactAddressKey: "Address",
    contactAddressValue: "Al. Jerozolimskie 200, Warsaw",
    contactHoursKey: "Hours",
    contactHoursValue: "Open 24 / 7",
  },
  pl: {
    pricingTitle: "Cennik — Flota",
    pricingEyebrow: "Cennik",
    pricingHeading: "Przejrzyste stawki, bez ukrytych kosztów",
    pricingLead:
      "Płacisz za dobę lub za miesiąc — im dłuższy wynajem, tym niższa stawka. Ubezpieczenie i assistance zawsze w cenie.",

    tierDailyName: "Na dobę",
    tierDailyWhen: "1–3 dni",
    tierDailyNote: "Elastycznie, bez zobowiązań",
    tierShortName: "Krótkoterminowy",
    tierShortWhen: "1–30 dni",
    tierShortNote: "Niższa stawka dobowa",
    tierShortTag: "Popularny",
    tierMediumName: "Średnioterminowy",
    tierMediumWhen: "1–24 mies.",
    tierMediumNote: "Stała rata miesięczna",
    tierLongName: "Długoterminowy",
    tierLongWhen: "24+ mies.",
    tierLongNote: "Najniższy koszt, pełny serwis",
    tierLongTag: "Najlepsza cena",
    tierFrom: "od",
    tierPerDay: "zł/doba",

    ratesHeading: "Stawki wg typu pojazdu",
    ratesLead: "Ceny netto, od. Ostateczna wycena zależy od terminu i długości najmu.",
    ratesColVehicle: "Pojazd",
    ratesColDay: "Doba",
    ratesColMonth: "Miesiąc",
    ratesEmpty: "Cennik chwilowo niedostępny — zadzwoń: +48 22 100 20 30",
    ratesFrom: "od",
    ratesPerDayShort: "/doba",
    ratesPerMonthShort: "/mies",

    includedHeading: "W każdej cenie",
    included1: "Pełne ubezpieczenie AC / OC / NNW",
    included2: "Assistance 24/7 w całej Polsce",
    included3: "Bezpłatne podstawienie w mieście",
    included4: "Limit 300 km / dobę (potem 0,50 zł/km)",
    included5: "Serwis, przeglądy i wymiana opon",
    included6: "Auto zastępcze przy awarii",

    goodToKnowHeading: "Dobrze wiedzieć",
    goodToKnowDepositKey: "Kaucja",
    goodToKnowDepositValue: "od 1 500 zł, zwracana po zwrocie auta",
    goodToKnowVatKey: "VAT",
    goodToKnowVatValue: "Wszystkie ceny netto (+23% VAT)",
    goodToKnowInvoiceKey: "Faktura",
    goodToKnowInvoiceValue: "Faktura VAT do każdego wynajmu",
    goodToKnowPaymentKey: "Płatność",
    goodToKnowPaymentValue: "Karta, przelew lub gotówka przy odbiorze",

    reserveVehicle: "Zarezerwuj pojazd",

    faqTitle: "FAQ — Flota",
    faqEyebrow: "FAQ",
    faqHeading: "Najczęściej zadawane pytania",
    faqLead:
      "Wszystko o wynajmie — dokumenty, kaucja, ubezpieczenie i płatności. Nie znalazłeś odpowiedzi? Zadzwoń, jesteśmy dostępni całą dobę.",

    faqDocsQ: "Jakie dokumenty są potrzebne do wynajmu?",
    faqDocsA:
      "Dowód osobisty oraz ważne prawo jazdy kat. B (kat. C dla pojazdów powyżej 3,5 t). Firmy dodatkowo podają NIP — fakturę wystawiamy od ręki.",
    faqAccountQ: "Czy muszę mieć konto, żeby zarezerwować?",
    faqAccountA:
      "Nie. Rezerwację złożysz bez zakładania konta — wybierasz pojazd i termin, a potwierdzenie przychodzi e-mailem. Możesz też zadzwonić do nas bezpośrednio.",
    faqDepositQ: "Ile wynosi kaucja i kiedy ją zwracacie?",
    faqDepositA:
      "Kaucja zaczyna się od 1 500 zł i zależy od klasy pojazdu. Zwracamy ją w pełnej wysokości po zwrocie auta bez uszkodzeń, zwykle w ciągu 3 dni roboczych.",
    faqMileageQ: "Jaki jest limit kilometrów?",
    faqMileageA:
      "Standardowo 300 km na dobę. Każdy dodatkowy kilometr to 0,50 zł. Przy wynajmie długoterminowym ustalamy indywidualny, wyższy limit.",
    faqInsuranceQ: "Co obejmuje ubezpieczenie?",
    faqInsuranceA:
      "Każdy pojazd ma pełne AC, OC i NNW oraz assistance 24/7 w całej Polsce. W razie awarii lub kolizji podstawiamy auto zastępcze.",
    faqDeliveryQ: "Czy dostarczacie auto pod wskazany adres?",
    faqDeliveryA:
      "Tak. Podstawienie i odbiór w granicach miasta są bezpłatne. Poza miastem wyceniamy dojazd indywidualnie — wystarczy podać adres przy rezerwacji.",
    faqExtendQ: "Czy mogę przedłużyć wynajem?",
    faqExtendA:
      "Oczywiście. Wystarczy telefon lub e-mail przed końcem umowy. Przy dłuższym okresie automatycznie przechodzisz na korzystniejszą stawkę.",
    faqCancelQ: "Jak odwołać lub zmienić rezerwację?",
    faqCancelA:
      "Bezpłatne odwołanie jest możliwe do 24 godzin przed odbiorem. Zmianę terminu lub pojazdu zrobimy telefonicznie bez dodatkowych opłat.",
    faqAgeQ: "Jaki jest minimalny wiek kierowcy?",
    faqAgeA:
      "Kierowca musi mieć ukończone 21 lat i minimum 2 lata prawa jazdy. Dodatkowych kierowców dopisujemy do umowy bezpłatnie.",
    faqPaymentQ: "W jaki sposób mogę zapłacić?",
    faqPaymentA:
      "Kartą, przelewem lub gotówką przy odbiorze. Dla firm oferujemy płatność z odroczonym terminem na podstawie faktury VAT.",

    faqCtaHeading: "Masz inne pytanie?",
    faqCtaSub: "Nasz zespół pomoże Ci wybrać właściwy pojazd — 24/7.",
    faqCtaCall: "Zadzwoń",
    faqCtaWrite: "Napisz",

    aboutTitle: "O nas — Flota",
    aboutEyebrow: "O nas",
    aboutHeading: "Flota, na której możesz polegać",
    aboutLead:
      "Jesteśmy zespołem z ponad 10-letnim doświadczeniem w wynajmie samochodów dostawczych. Oferujemy elastyczne rozwiązania dla firm i klientów indywidualnych — od jednej doby po wynajem długoterminowy.",

    statYearsValue: "10+",
    statYearsLabel: "lat na rynku",
    statFleetLabel: "pojazdy we flocie",
    statSupportValue: "24/7",
    statSupportLabel: "wsparcie i assistance",
    statAgeValue: "do 2 lat",
    statAgeLabel: "maks. wiek auta",

    storyEyebrow: "Nasza historia",
    storyHeading: "Rzetelność i elastyczność od pierwszego dnia",
    storyP1:
      "Wszystkie nasze pojazdy są utrzymywane w doskonałym stanie technicznym, mają niski przebieg i bogate wyposażenie. Niezależnie od tego, czy wynajmujesz auto na dobę, miesiąc czy dłużej, możesz liczyć na pełne ubezpieczenie i wsparcie na każdym etapie.",
    storyP2:
      "Specjalizujemy się w wynajmie krótko-, średnio- i długoterminowym, dzięki czemu dopasowujemy ofertę do zmieniających się potrzeb Twojego biznesu.",

    fleetHeading: "Nasza flota",
    fleetLead: "Szeroki wybór pojazdów do każdego zadania transportowego.",
    fleetVansT: "Furgony L3 i L4H2",
    fleetVansD: "Renault Master, Ford Transit, Mercedes Sprinter",
    fleetBusesT: "Busy 8–9 osobowe",
    fleetBusesD: "Idealne do przewozu większych grup",
    fleetBoxT: "Kontenery 8–10 europalet",
    fleetBoxD: "Zabudowa kontenerowa i plandeka",
    fleetTailliftT: "Winda załadowcza",
    fleetTailliftD: "Łatwy za- i rozładunek ciężkich palet",
    fleetCrewT: "Brygadówki 7-osobowe",
    fleetCrewD: "Załoga i ładunek w jednym aucie",
    fleetCityT: "Małe vany miejskie",
    fleetCityD: "Zwrotne, do transportu w mieście",

    valuesHeading: "Dlaczego Flota",
    valueInsuranceT: "Pełne ubezpieczenie",
    valueInsuranceD: "Każdy pojazd z AC, OC i NNW oraz assistance 24/7 w całej Polsce.",
    valueMileageT: "Niski przebieg",
    valueMileageD: "Auta z gwarancją producenta, serwisowane i utrzymane w idealnym stanie.",
    valueModernT: "Nowoczesna flota",
    valueModernD: "Wymieniamy pojazdy maks. co 2 lata — jeździsz najnowszymi modelami.",
    valueFlexibleT: "Elastyczne terminy",
    valueFlexibleD: "Wynajem na dobę, krótko-, średnio- i długoterminowy — jak potrzebujesz.",
    valueInvoiceT: "Faktura VAT",
    valueInvoiceD: "Pełna dokumentacja i faktura do każdego wynajmu, także dla firm.",
    valueSupportT: "Wsparcie 24/7",
    valueSupportD: "Jesteśmy pod telefonem o każdej porze — także w weekendy i święta.",

    contactEyebrow: "Kontakt",
    contactHeading: "Porozmawiajmy o Twoim transporcie",
    contactLead: "Zadzwoń lub napisz — dobierzemy pojazd i termin do Twoich potrzeb. Jesteśmy dostępni całą dobę.",
    contactPhoneKey: "Telefon",
    contactEmailKey: "E-mail",
    contactAddressKey: "Adres",
    contactAddressValue: "Al. Jerozolimskie 200, Warszawa",
    contactHoursKey: "Godziny",
    contactHoursValue: "Czynne 24 / 7",
  },
});
