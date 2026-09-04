// core
import { defineDict } from "./types";

// ---------------------------------------------------------------------------
// `/terms` — the rental terms the reservation checkbox has always asked
// customers to accept, and which until now did not exist anywhere in the repo:
// no route, no page, not even a link (frame decision 4). It could not be
// translated because it was never written, so under "literally everything
// English" writing it is a prerequisite rather than a translation task.
//
// *** Every section body below is SAMPLE TEXT. *** Flota is a portfolio
// deployment, not a rental company; nothing here has been drafted or reviewed by
// a lawyer and none of it binds anyone. The page says so in a banner rather than
// burying it, because the whole point of the decision was to make the gap
// VISIBLE — a plausible-looking terms page nobody flagged would have been worse
// than the missing one.
//
// The document is versioned, not just written: `TERMS_VERSION`
// (`src/lib/reservation-schema.ts`) is stamped onto every reservation alongside
// the locale the customer read it in, so a past consent stays attributable to
// the exact text it was given. *** Bump that constant whenever the copy in this
// file changes *** — the two files name each other for that reason.
//
// No island reaches this namespace: the page is a plain `.astro` route, so it
// reads `Astro.locals.t("terms.…")` and ships no JavaScript.
// ---------------------------------------------------------------------------
export const terms = defineDict({
  en: {
    title: "Rental terms — Flota",
    eyebrow: "Rental terms",
    heading: "Rental terms and conditions",
    lead: "The terms every reservation is made under. Accepting them on the reservation form records which version you read, and in which language.",
    versionLabel: "Version",

    // ── The placeholder banner ────────────────────────────────────────────
    noticeTitle: "Sample text — not a legal document",
    noticeBody:
      "Flota is a portfolio demonstration, not a rental company. Everything below is placeholder copy written to show the shape of the document: none of it has been drafted or reviewed by a lawyer, and none of it binds anyone. The page exists so the reservation form's checkbox points at a real document, and so every acceptance is recorded against a version and a language.",
    sampleTag: "Sample",

    // ── Sections, in display order ────────────────────────────────────────
    s1Title: "1. Scope",
    s1Body:
      "These terms cover the rental of a vehicle from Flota's Warsaw · Mokotów branch. They apply from the moment a reservation is confirmed until the vehicle is returned and the pickup and return protocols are both signed.",
    s2Title: "2. Who may rent",
    s2Body:
      "The driver must be at least 21 years old, hold a valid driving licence for the vehicle class, and present an identity document at pickup. Vehicles over 3.5 t require the matching licence category. A company renting on an invoice gives its tax details when booking.",
    s3Title: "3. Deposit and payment",
    s3Body:
      "A refundable deposit is taken at pickup and released once the vehicle comes back undamaged, normally within three working days. The rental itself is settled at pickup; nothing is charged when the reservation is submitted.",
    s4Title: "4. Mileage and fuel",
    s4Body:
      "Each rental includes a daily mileage allowance, shown on the vehicle's page and on the reservation summary. Kilometres beyond it are billed at the per-kilometre rate quoted there. The vehicle is handed over with a recorded fuel level and is expected back at the same one.",
    s5Title: "5. Condition, damage and returns",
    s5Body:
      "The vehicle's condition is recorded in a pickup protocol that both sides sign, and again in a return protocol. Damage that was not on the pickup protocol is settled against the deposit. Both protocols are emailed as a PDF in the language of the reservation.",
    s6Title: "6. Changing or cancelling a booking",
    s6Body:
      "A reservation can be cancelled free of charge up to 24 hours before the pickup day. Later than that, or when the vehicle is not collected, the first rental day may be retained. Date changes depend on the vehicle being free for the new range.",
    s7Title: "7. Personal data",
    s7Body:
      "The details given when booking are used to handle the reservation, to issue the rental documents, and to contact the customer about that booking. This deployment carries fictional data only and sends nothing to third parties.",

    // ── Foot ───────────────────────────────────────────────────────────────
    footNote:
      "Any question a real set of terms would answer is answered by a person here: call the branch or write to us before you book.",
    contactCta: "Contact us",
  },
  pl: {
    title: "Regulamin wynajmu — Flota",
    eyebrow: "Regulamin",
    heading: "Regulamin wynajmu",
    lead: "Warunki, na jakich zawierana jest każda rezerwacja. Akceptacja w formularzu rezerwacji zapisuje, którą wersję i w jakim języku przeczytałeś.",
    versionLabel: "Wersja",

    noticeTitle: "Tekst przykładowy — to nie jest dokument prawny",
    noticeBody:
      "Flota to demonstracja portfolio, a nie wypożyczalnia. Wszystko poniżej jest tekstem przykładowym, który pokazuje jedynie kształt takiego dokumentu: nic tu nie zostało napisane ani sprawdzone przez prawnika i nic nikogo nie wiąże. Ta strona istnieje po to, żeby checkbox w formularzu rezerwacji wskazywał na prawdziwy dokument, a każda akceptacja była zapisana razem z wersją i językiem.",
    sampleTag: "Przykład",

    s1Title: "1. Zakres",
    s1Body:
      "Regulamin obejmuje wynajem pojazdu z oddziału Flota Warszawa · Mokotów. Obowiązuje od potwierdzenia rezerwacji do zwrotu pojazdu i podpisania protokołu wydania oraz protokołu zwrotu.",
    s2Title: "2. Kto może wynająć",
    s2Body:
      "Kierowca musi mieć ukończone 21 lat, posiadać ważne prawo jazdy odpowiedniej kategorii i okazać dokument tożsamości przy wydaniu. Pojazdy powyżej 3,5 t wymagają odpowiedniej kategorii prawa jazdy. Firma wynajmująca na fakturę podaje swoje dane przy rezerwacji.",
    s3Title: "3. Kaucja i płatności",
    s3Body:
      "Przy wydaniu pobieramy zwrotną kaucję, którą oddajemy po zwrocie nieuszkodzonego pojazdu, zwykle w ciągu trzech dni roboczych. Za sam wynajem płaci się przy odbiorze; w momencie wysłania rezerwacji nie pobieramy żadnej opłaty.",
    s4Title: "4. Limit kilometrów i paliwo",
    s4Body:
      "Każdy wynajem zawiera dzienny limit kilometrów, podany na stronie pojazdu i w podsumowaniu rezerwacji. Kilometry ponad limit rozliczamy według podanej tam stawki. Pojazd wydajemy z zapisanym poziomem paliwa i oczekujemy zwrotu na tym samym poziomie.",
    s5Title: "5. Stan pojazdu, uszkodzenia i zwrot",
    s5Body:
      "Stan pojazdu zapisujemy w protokole wydania podpisywanym przez obie strony, a następnie w protokole zwrotu. Uszkodzenia, których nie było w protokole wydania, rozliczamy z kaucji. Oba protokoły wysyłamy w PDF w języku rezerwacji.",
    s6Title: "6. Zmiana i odwołanie rezerwacji",
    s6Body:
      "Rezerwację można odwołać bezpłatnie do 24 godzin przed dniem wydania. Później — albo gdy pojazd nie zostanie odebrany — możemy zatrzymać opłatę za pierwszą dobę. Zmiana terminu zależy od dostępności pojazdu w nowym zakresie dat.",
    s7Title: "7. Dane osobowe",
    s7Body:
      "Dane podane przy rezerwacji wykorzystujemy do jej obsługi, wystawienia dokumentów wynajmu i kontaktu w sprawie tej rezerwacji. To wdrożenie zawiera wyłącznie fikcyjne dane i nie przekazuje ich nikomu.",

    footNote:
      "Na każde pytanie, na które odpowiedziałby prawdziwy regulamin, odpowie tu człowiek: zadzwoń do oddziału albo napisz do nas przed rezerwacją.",
    contactCta: "Kontakt",
  },
});
