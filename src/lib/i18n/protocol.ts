// core
import { defineDict, type Locale } from "./types";

// others
import type { ProtocolDamageType, ProtocolPhotoSlot } from "../../types";

// ---------------------------------------------------------------------------
// The handover flow — the issue protocol, the return protocol, and the read-only
// view of either. Eight islands reach this file (`ProtocolForm`,
// `ReturnProtocolForm`, `ProtocolView`, `DamageEditor`, `SignaturePad`,
// `PhotoSlot`, `FuelBar`, `Overlays`, `DeliveryBadge`), which is exactly why it
// is one namespace rather than five: they render one document between them, and
// a slot named one thing on the form and another in the customer's only copy of
// the evidence is the failure this file exists to prevent.
//
// The two enum dictionaries at the top were `protocol-labels.ts` — the same
// `Record<Locale, Record<Enum, string>>` shape as `./vehicle.ts`, exhaustively
// checked on BOTH axes, which is stronger than `Dict` parity (that only checks
// `pl` covers `en`'s keys — it cannot know an enum member is missing from both).
//
// **The PDF still renders Polish.** `media/protocol-pdf.ts` calls these with its
// `ARTIFACT_LOCALE` constant, pinned to `pl` until Phase 6 §2 stamps the real
// `protocols.locale` — a protocol's language is a property of the DOCUMENT, not
// of the employee's session, and no issued PDF is ever regenerated.
// ---------------------------------------------------------------------------

const PHOTO_SLOT_LABELS: Record<Locale, Record<ProtocolPhotoSlot, string>> = {
  en: {
    front: "Front",
    rear: "Rear",
    left: "Left side",
    right: "Right side",
    interior: "Interior",
    // Abbreviated to fit the tile, as the Polish is ("Deska rozdz.").
    dashboard: "Dashboard",
  },
  pl: {
    front: "Przód",
    rear: "Tył",
    left: "Lewy bok",
    right: "Prawy bok",
    interior: "Wnętrze",
    dashboard: "Deska rozdz.",
  },
};

/** `protocol_photo_slot` → the capture label, in the given locale. */
export function photoSlotLabel(slot: ProtocolPhotoSlot, locale: Locale): string {
  return PHOTO_SLOT_LABELS[locale][slot];
}

const DAMAGE_TYPE_LABELS: Record<Locale, Record<ProtocolDamageType, string>> = {
  en: {
    scratch: "Scratch",
    dent: "Dent",
    crack: "Crack",
    missing: "Missing part",
  },
  pl: {
    scratch: "Rysa",
    dent: "Wgniecenie",
    crack: "Pęknięcie",
    missing: "Brak części",
  },
};

/** `protocol_damage_type` → the chip label used by the damage editor. */
export function damageTypeLabel(type: ProtocolDamageType, locale: Locale): string {
  return DAMAGE_TYPE_LABELS[locale][type];
}

const FUEL_ENDS: Record<Locale, { full: string; empty: string }> = {
  en: { full: "8/8 · full", empty: "0/8 · empty" },
  pl: { full: "8/8 · pełny", empty: "0/8 · pusty" },
};

/**
 * `3` → `"3/8"`, with the two ends named the way the form's fuel bar names them:
 * `8/8 · full`, `0/8 · empty`.
 */
export function fuelLevelLabel(eighths: number, locale: Locale): string {
  if (eighths === 8) {
    return FUEL_ENDS[locale].full;
  }
  if (eighths === 0) {
    return FUEL_ENDS[locale].empty;
  }
  return `${eighths}/8`;
}

export const protocol = defineDict({
  en: {
    // ── Shared header chrome (both forms + the view) ───────────────────────
    issueTitle: "Pickup protocol",
    returnTitle: "Return protocol",
    back: "Back",
    close: "Close",
    // Prefix on the header's context strip, before the scheduled time.
    pickupAt: "Pickup",
    returnAt: "Return",
    fixHighlighted: "Check the highlighted fields",
    sending: "Sending…",
    saving: "Saving…",
    missingProtocolData: "The protocol data is missing.",
    genericError: "Something went wrong. Try again.",

    // ── Section 1 — condition ──────────────────────────────────────────────
    conditionTitle: "Technical condition",
    conditionSub: "Odometer, fuel and existing damage. Photos can be taken with a phone or uploaded here.",
    conditionSubReturn: "Values are compared automatically against the pickup protocol.",
    odometer: "Odometer",
    // Soft warning, never a hard block: the reading is below the last one.
    odometerRollback: "The previous reading was",
    odometerRollbackTail: "km — check the odometer is right.",
    odometerBelowBaseline: "Lower than at pickup — check the reading.",
    odometerPlaceholder: "Enter the reading",
    // Return form's read-only baseline footers.
    atPickup: "At pickup",
    distanceDriven: "Distance driven",
    fuelChange: "Fuel change",
    fuelLevel: "Fuel level",

    // ── Section 2 — photos ─────────────────────────────────────────────────
    photosTitle: "Vehicle photos",
    photosSub: "Six baseline shots of the vehicle.",
    photosSubReturn: "Six baseline shots of the vehicle at return.",
    photosRequired: "Take all six vehicle photos.",
    photoRetry: "Retry",
    photoDropHere: "Drag photos here",
    photoDropOrPhone: "or take them with your phone",
    photoNone: "None",

    // ── Section 3 — damage ─────────────────────────────────────────────────
    damageTitle: "Damage",
    damageSub: "Record every mark separately — the return compares against this list.",
    damageAdd: "Add damage",
    damageDetails: "Damage details",
    damageEmptyIssue: "No damage",
    damageEmptyReturn: "No new damage recorded.",
    damageEmptyHintIssue: "Add every scratch, dent or crack so the return has something to compare against.",
    damageEmptyHintReturn: "Add every new mark — the return compares against the pickup protocol.",
    damageBaselineHeading: "Damage from the pickup protocol",
    // Row tag. Lower case on the issue form (every mark is pre-existing there by
    // definition, so it reads as a note); title case on the return form, where it
    // is one half of a real either/or against "New".
    damageExisting: "Existing",
    damageExistingQuiet: "existing",
    damageNew: "New",
    damageKind: "Classification",
    damageAutoTagged: "Detected automatically from the pickup protocol — change it if needed.",
    damageType: "Type",
    damageLocation: "Location",
    damageLocationPlaceholder: "e.g. left rear bumper",
    damageSize: "Size",
    damageSizePlaceholder: "e.g. 15 cm",
    damagePhotos: "Photos",
    damagePhotoUploadFailed: "The photo could not be uploaded. Try again.",
    damageLocationRequired: "Enter the damage location.",
    // Counted noun for a damage row's photo strip.
    photoCountOne: "photo",
    photoCountFew: "photos",
    photoCountMany: "photos",
    photoCountOther: "photos",
    remove: "Remove",
    cancel: "Cancel",
    save: "Save",

    // ── Section 4 — signature ──────────────────────────────────────────────
    signatureTitle: "Signature",
    signatureSub: "The customer confirms the condition above and signs.",
    ackLabel: "The customer confirms the vehicle's condition and the rental terms.",
    ackConfirmed: "The customer confirmed the vehicle's condition and the rental terms.",
    signature: "Signature",
    signatureRequired: "A signature is required",
    signaturePromptTitle: "Ask the customer to sign",
    signaturePromptSub: "Open the full-screen signature pad",
    signatureChange: "Change",
    signatureSheetTitle: "Customer signature",
    signatureSheetHint: "Ask the customer to sign in the field below.",
    signatureFieldLabel: "Customer signature field",
    signatureDrawHint: "Draw with a finger, a mouse or a trackpad",
    signatureClear: "Clear",
    signatureConfirm: "Confirm signature",
    signatureReadFailed: "The signature could not be read. Try again.",
    signatureSaveFailed: "The signature could not be saved. Try again.",
    // `Podpisał(a)` carries a Polish gender agreement with no English analogue;
    // "Signed by" is the plain equivalent (plan Phase 5 §2).
    signedBy: "Signed by",
    signatureImageAlt: "Customer signature",
    signatureMissing: "No signature",

    // ── Submit ─────────────────────────────────────────────────────────────
    submitIssue: "Confirm pickup and send",
    submitReturnShort: "Confirm return and send",
    submitReturnLong: "Finish and send",

    // ── Comparison (return only) ───────────────────────────────────────────
    comparisonTitle: "Pickup → return comparison",
    comparisonEmpty: "Enter the current values to see the comparison",
    comparisonNewDamage: "New damage",

    // ── Post-submit overlays ───────────────────────────────────────────────
    overlaySentTitle: "Protocol sent",
    overlaySentSub: "Sent to the customer and stored as a PDF.",
    overlayEmailTitle: "The email could not be sent",
    overlayEmailSub: "The protocol is stored and signed. You can resend it now or later.",
    overlayPdfTitle: "The PDF could not be generated",
    overlayPdfSub: "The protocol is stored. Generate the PDF again to send it to the customer.",
    badgeStored: "Protocol stored",
    badgeDelivered: "Delivered",
    badgeEmailNotSent: "Email not sent",
    badgePdfError: "PDF error",
    overlayDone: "Done",
    overlayResend: "Resend",
    overlayRetry: "Try again",
    overlayLater: "Later",
    overlayNotSentTo: "Not sent to",
    downloadPdf: "Download PDF",

    // ── Conflict screen ────────────────────────────────────────────────────
    conflictTitle: "That protocol already exists",
    conflictIssueBody: "This reservation already has a pickup protocol — a pickup can only have one.",
    conflictReturnBody: "This reservation already has a return protocol — a return can only have one.",
    openProtocol: "Open the protocol",
    backToDashboard: "Back to the dashboard",

    // ── Read-only view + resend ────────────────────────────────────────────
    resend: "Resend",
    resendNoPdf: "No stored PDF — generate it again.",
    resendFailed: "The send failed. Try again.",
    backToPickups: "Back to pickups",
    backToReturns: "Back to returns",

    // ── PDF filename stems (`protocol-<stem>-<reference>.pdf`) ─────────────
    // ASCII-only, because this becomes a filename on the customer's device.
    filenameIssue: "protocol-pickup",
    filenameReturn: "protocol-return",
  },
  pl: {
    issueTitle: "Protokół wydania",
    returnTitle: "Protokół zwrotu",
    back: "Wróć",
    close: "Zamknij",
    pickupAt: "Odbiór",
    returnAt: "Zwrot",
    fixHighlighted: "Sprawdź podświetlone pola",
    sending: "Wysyłanie…",
    saving: "Zapisywanie…",
    missingProtocolData: "Brak danych protokołu.",
    genericError: "Coś poszło nie tak. Spróbuj ponownie.",

    conditionTitle: "Stan techniczny",
    conditionSub: "Licznik, paliwo i istniejące uszkodzenia. Zdjęcia można zrobić telefonem lub wgrać tutaj.",
    conditionSubReturn: "Wartości porównane automatycznie z protokołem wydania.",
    odometer: "Licznik",
    odometerRollback: "Poprzedni odczyt to",
    odometerRollbackTail: "km — sprawdź, czy licznik się zgadza.",
    odometerBelowBaseline: "Licznik niższy niż przy wydaniu — sprawdź odczyt.",
    odometerPlaceholder: "Wpisz odczyt",
    atPickup: "Przy wydaniu",
    distanceDriven: "Przejechano",
    fuelChange: "Zmiana paliwa",
    fuelLevel: "Poziom paliwa",

    photosTitle: "Zdjęcia pojazdu",
    photosSub: "Sześć bazowych ujęć pojazdu.",
    photosSubReturn: "Sześć bazowych ujęć pojazdu przy zwrocie.",
    photosRequired: "Wykonaj wszystkie sześć zdjęć pojazdu.",
    photoRetry: "Ponów",
    photoDropHere: "Przeciągnij zdjęcia tutaj",
    photoDropOrPhone: "lub zrób je telefonem",
    photoNone: "Brak",

    damageTitle: "Uszkodzenia",
    damageSub: "Zapisz każdy ślad osobno — zwrot porówna się z tą listą.",
    damageAdd: "Dodaj uszkodzenie",
    damageDetails: "Szczegóły uszkodzenia",
    damageEmptyIssue: "Brak uszkodzeń",
    damageEmptyReturn: "Nie dodano nowych uszkodzeń.",
    damageEmptyHintIssue: "Dodaj każdą rysę, wgniecenie lub pęknięcie, aby zwrot mógł porównać.",
    damageEmptyHintReturn: "Dodaj każdy nowy ślad — zwrot porówna się z protokołem wydania.",
    damageBaselineHeading: "Uszkodzenia z protokołu wydania",
    damageExisting: "Istniejące",
    damageExistingQuiet: "istniejące",
    damageNew: "Nowe",
    damageKind: "Klasyfikacja",
    damageAutoTagged: "Wykryto automatycznie z protokołu wydania — zmień w razie potrzeby.",
    damageType: "Rodzaj",
    damageLocation: "Lokalizacja",
    damageLocationPlaceholder: "np. lewy tylny zderzak",
    damageSize: "Rozmiar",
    damageSizePlaceholder: "np. 15 cm",
    damagePhotos: "Zdjęcia",
    damagePhotoUploadFailed: "Nie udało się wgrać zdjęcia. Spróbuj ponownie.",
    damageLocationRequired: "Podaj lokalizację uszkodzenia.",
    photoCountOne: "zdjęcie",
    photoCountFew: "zdjęcia",
    photoCountMany: "zdjęć",
    photoCountOther: "zdjęć",
    remove: "Usuń",
    cancel: "Anuluj",
    save: "Zapisz",

    signatureTitle: "Podpis",
    signatureSub: "Klient potwierdza powyższy stan i składa podpis.",
    ackLabel: "Klient potwierdza stan pojazdu i warunki najmu.",
    ackConfirmed: "Klient potwierdził stan pojazdu i warunki najmu.",
    signature: "Podpis",
    signatureRequired: "Wymagany podpis",
    signaturePromptTitle: "Poproś klienta o podpis",
    signaturePromptSub: "Otwórz pełny ekran podpisu",
    signatureChange: "Zmień",
    signatureSheetTitle: "Podpis klienta",
    signatureSheetHint: "Poproś klienta, aby podpisał się w polu poniżej.",
    signatureFieldLabel: "Pole podpisu klienta",
    signatureDrawHint: "Rysuj palcem, myszką lub gładzikiem",
    signatureClear: "Wyczyść",
    signatureConfirm: "Zatwierdź podpis",
    signatureReadFailed: "Nie udało się odczytać podpisu. Spróbuj ponownie.",
    signatureSaveFailed: "Nie udało się zapisać podpisu. Spróbuj ponownie.",
    signedBy: "Podpisał(a)",
    signatureImageAlt: "Podpis klienta",
    signatureMissing: "Brak podpisu",

    submitIssue: "Potwierdź wydanie i wyślij",
    submitReturnShort: "Potwierdź zwrot i wyślij",
    submitReturnLong: "Zakończ i wyślij",

    comparisonTitle: "Porównanie wydanie → zwrot",
    comparisonEmpty: "Wprowadź bieżące wartości, aby zobaczyć porównanie",
    comparisonNewDamage: "Nowe uszkodzenia",

    overlaySentTitle: "Protokół wysłany",
    overlaySentSub: "Wysłany do klienta i zapisany jako PDF.",
    overlayEmailTitle: "Nie udało się wysłać e-maila",
    overlayEmailSub: "Protokół jest zapisany i podpisany. Możesz wysłać ponownie teraz lub później.",
    overlayPdfTitle: "Nie udało się wygenerować PDF",
    overlayPdfSub: "Protokół został zapisany. Wygeneruj PDF ponownie, aby wysłać klientowi.",
    badgeStored: "Protokół zapisany",
    badgeDelivered: "Dostarczono",
    badgeEmailNotSent: "E-mail niewysłany",
    badgePdfError: "Błąd PDF",
    overlayDone: "Gotowe",
    overlayResend: "Wyślij ponownie",
    overlayRetry: "Spróbuj ponownie",
    overlayLater: "Później",
    overlayNotSentTo: "Nie wysłano do",
    downloadPdf: "Pobierz PDF",

    conflictTitle: "Protokół już istnieje",
    conflictIssueBody: "Dla tej rezerwacji wydano już protokół — każde wydanie może mieć tylko jeden.",
    conflictReturnBody: "Dla tej rezerwacji istnieje już protokół zwrotu — każdy zwrot może mieć tylko jeden.",
    openProtocol: "Otwórz protokół",
    backToDashboard: "Wróć do pulpitu",

    resend: "Wyślij ponownie",
    resendNoPdf: "Brak zapisanego PDF — wygeneruj go ponownie.",
    resendFailed: "Nie udało się wysłać. Spróbuj ponownie.",
    backToPickups: "Wróć do wydań",
    backToReturns: "Wróć do zwrotów",

    filenameIssue: "protokol-wydania",
    filenameReturn: "protokol-zwrotu",
  },
});
