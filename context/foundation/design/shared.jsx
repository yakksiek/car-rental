// Shared design tokens, icons, data, and small atoms for Flota
// All exported to window for cross-script availability.

const T = /*EDITMODE-BEGIN*/{
  "accent": "#0057FF",
  "lang": "EN",
  "vehicleStyle": "silhouette",
  "showSpecs": true
}/*EDITMODE-END*/;

// ─── Tokens ─────────────────────────────────────────────────
const tokens = {
  bg: '#F1F3F6',          // cool light grey
  card: '#FFFFFF',        // pure white
  ink: '#0F172A',         // deep navy/near-black
  ink2: '#334155',
  muted: '#94A3B8',
  hair: 'rgba(15,23,42,0.08)',
  hair2: 'rgba(15,23,42,0.05)',
  accent: '#B43638',      // crimson — kept
  accentDark: '#8E2628',
  accentSoft: '#FBE4E1',
  accentInk: '#FFFFFF',
  green: '#1B9E5A',
  greenSoft: '#E3F5EC',
  amber: '#B6790E',
  amberSoft: '#FBF1DA',
  red: '#B43638',
  redSoft: '#FBE4E1',
  grey: '#64748B',
  greySoft: '#EEF1F5',
  blue: '#B43638',
  blueSoft: '#FBE4E1',
  font: 'Inter, -apple-system, system-ui, sans-serif',
  serif: '"Instrument Serif", "Cormorant Garamond", "Times New Roman", serif',
  mono: '"JetBrains Mono", "SF Mono", Menlo, monospace',
  shadow1: '0 1px 2px rgba(15,23,42,0.04), 0 2px 6px rgba(15,23,42,0.05)',
  shadow2: '0 2px 6px rgba(15,23,42,0.06), 0 12px 30px rgba(15,23,42,0.08)',
  shadow3: '0 4px 12px rgba(15,23,42,0.08), 0 24px 60px rgba(15,23,42,0.10)',
};

// ─── i18n ───────────────────────────────────────────────────
const STR = {
  EN: {
    brand: 'Flota',
    tagline: 'Commercial vehicles, by the day or the month.',
    types: ['Cargo van', 'Passenger van', 'Car transporter', 'Refrigerated', 'Flatbed'],
    typesShort: ['Cargo', 'Passenger', 'Transport.', 'Refrig.', 'Flatbed'],
    browseFleet: 'Browse the fleet',
    popular: 'Popular this week',
    seeAll: 'See all',
    fleet: 'Fleet',
    results: 'vehicles',
    from: 'From',
    perDay: '/day',
    perMonth: '/month',
    reserve: 'Reserve',
    checkAvailability: 'Check availability',
    reserveNow: 'Reserve now',
    reservation: 'Reservation',
    dates: 'Dates',
    pickup: 'Pickup',
    return: 'Return',
    totalEst: 'Estimated total',
    submitReservation: 'Request booking',
    myReservations: 'My reservations',
    home: 'Home',
    calendar: 'Calendar',
    saved: 'Saved',
    profile: 'Profile',
    specs: 'Specifications',
    pricing: 'Pricing',
    daily: 'Daily',
    monthly: 'Monthly',
    deposit: 'Deposit',
    kmLimit: 'Km limit',
    extraKm: 'Extra km',
    seats: 'Seats',
    transmission: 'Transmission',
    fuel: 'Fuel',
    cargo: 'Cargo (L×W×H)',
    payload: 'Payload',
    year: 'Year',
    status: {
      pending: 'Pending',
      approved: 'Approved',
      rejected: 'Rejected',
      active: 'Active',
      completed: 'Completed',
      overdue: 'Overdue',
    },
    workerDash: 'Dispatch',
    today: "Today",
    pickupsToday: 'Pickups today',
    returnsToday: 'Returns today',
    pending: 'Pending requests',
    approve: 'Approve',
    reject: 'Reject',
    fleetMgmt: 'Fleet management',
    pickupProtocol: 'Pickup protocol',
    odometer: 'Odometer',
    fuelLevel: 'Fuel level',
    damages: 'Damage notes',
    photos: 'Photos',
    signature: 'Signature',
    confirm: 'Confirm pickup',
    step: 'Step',
    of: 'of',
    front: 'Front',
    back: 'Back',
    left: 'Left',
    right: 'Right',
    interior: 'Interior',
    damage: 'Damage',
    customer: 'Customer',
    vehicle: 'Vehicle',
    until: 'until',
    overdue1: 'Overdue',
    daysOverdue: 'days overdue',
    extendBooking: 'Extend booking',
    contactCustomer: 'Contact',
    markReturned: 'Mark returned',
    yourDeposit: 'Your deposit',
    refundedAfter: 'Refunded after booking ends',
    // S-06 return protocol
    returnProtocol: 'Return protocol',
    comparison: 'Pickup → Return comparison',
    comparisonSub: 'Values are auto-compared against the issue protocol.',
    atPickup: 'At pickup',
    atReturn: 'At return',
    kmDriven: 'Distance driven',
    fuelChange: 'Fuel level',
    newDamageT: 'New damage',
    noNewDamage: 'No new damage found',
    refuelNote: 'Refuel charge',
    finishEmail: 'Finish & email customer',
    protocolSent: 'Protocol sent',
    sentTo: 'Emailed to',
    doneLabel: 'Done',
    existingTag: 'existing',
    addedTag: 'new',
    backStep: 'Back',
    // S-02 request-received confirmation
    requestReceived: 'Request received',
    requestReceivedSub: "No account needed — we'll confirm everything by email.",
    reference: 'Reference',
    whatNext: 'What happens next',
    next1t: 'Awaiting approval',
    next1d: 'An employee reviews your request, usually within a few hours.',
    next2t: 'Email confirmation',
    next2d: "You'll get a confirmation (or alternative dates) by email.",
    next3t: 'Pickup',
    next3d: 'Bring your ID and licence to collect the vehicle.',
    emailedCopy: 'Confirmation sent to',
    backToFleet: 'Back to fleet',
    // review/summary step
    reviewTitle: 'Review request',
    continueBtn: 'Review summary',
    bookingDetails: 'Booking details',
    customerData: 'Customer details',
    payment: 'Payment',
    duration: 'Duration',
    rentalCost: 'Rental',
    depositRefundable: 'Deposit (refundable)',
    paymentAtPickup: 'Paid at pickup — cash or card.',
    agreeTerms: 'I accept the rental terms & conditions.',
    changeBtn: 'Change',
    unavailableLegend: 'Unavailable — booked or requested',
    // S-03 approval queue + request detail
    reviewBtn: 'Review',
    requestLabel: 'Request',
    submittedLabel: 'Submitted',
    datesHeld: 'Dates held',
    datesHeldNote: 'Blocked for other customers while pending — rejecting releases them.',
    licence: 'Licence',
    reasonTitle: 'Reason for rejection',
    reason1: 'Dates no longer available',
    reason2: 'Missing licence category',
    reason3: 'Vehicle withdrawn',
    reason4: 'Other',
    bookingConfirmed: 'Booking confirmed',
    bookingConfirmedSub: 'Customer notified by email · dates now active.',
    requestRejected: 'Request rejected',
    requestRejectedSub: 'Dates released · customer notified by email.',
    confirmReject: 'Confirm rejection',
    customerLabel: 'Customer',
    ago2h: '2 hrs ago',
    // S-05 signature + email
    signSection: 'Signature & confirmation',
    signSub: 'Review the details, then capture the customer signature.',
    recap: 'Protocol summary',
    ackCustomer: 'Customer confirms the vehicle condition and rental terms.',
    signedBy: 'Signed by',
    signedAt: 'signed',
    clearSig: 'Clear',
    confirmEmail: 'Confirm pickup & email',
    protocolSentPickup: 'Protocol sent',
    protocolSentPickupSub: 'Issue protocol emailed to the customer and saved as PDF.',
    // S-04 fleet CRUD
    addVehicle: 'Add vehicle',
    editVehicle: 'Edit vehicle',
    vBrand: 'Make', vModel: 'Model', vType: 'Type', vYear: 'Year', vPlate: 'Plate',
    vFuel: 'Fuel', vTrans: 'Transmission', vSeats: 'Seats', vPayload: 'Payload', vCargo: 'Cargo (L×W×H)',
    vDaily: 'Daily rate (zł)', vMonthly: 'Monthly rate (zł)', vDeposit: 'Deposit (zł)', vKmLimit: 'Km limit', vStatus: 'Status',
    saveBtn: 'Save', editAction: 'Edit', removeAction: 'Remove',
    blockedTitle: 'Can’t remove this vehicle',
    blockedSub: 'active reservations',
    blockedHint: 'Cancel or complete them before deleting the vehicle.',
    viewReservations: 'View reservations',
    closeBtn: 'Close',
    removeVehicleQ: 'Remove vehicle?',
    removeVehicleSub: 'This permanently removes it from the fleet.',
    vehicleAdded: 'Vehicle added',
    vehicleSaved: 'Changes saved',
    vehicleRemoved: 'Vehicle removed',
    statusAvailable: 'Available', statusService: 'Service',
    // S-08 employees
    employees: 'Employees',
    addEmployee: 'Add employee',
    role: 'Role',
    roleAdmin: 'Admin',
    roleEmployee: 'Employee',
    lastActive: 'Last active',
    invitedS: 'Invited',
    activeS: 'Active',
    resetPassword: 'Reset password',
    removeEmp: 'Remove',
    resetSentTo: 'Reset link sent to',
    removedEmp: 'Employee removed',
    fullName: 'Full name',
    emailAddr: 'Email address',
    sendInvite: 'Send invite',
    cancelB: 'Cancel',
    selfResetNote: 'Employees can also reset their own password from the sign-in screen.',
    onlineNow: 'Online now',
    removeConfirmQ: 'Remove this employee?',
    removeConfirmSub: 'They lose access immediately. Completed protocols stay on file.',
  },
  PL: {
    brand: 'Flota',
    tagline: 'Pojazdy użytkowe, na dzień lub miesiąc.',
    types: ['Furgony', 'Busy osobowe', 'Lawety', 'Izotermy', 'Plandeki'],
    typesShort: ['Furgony', 'Busy', 'Lawety', 'Izoterm.', 'Plandeki'],
    browseFleet: 'Przeglądaj flotę',
    popular: 'Popularne w tym tygodniu',
    seeAll: 'Wszystkie',
    fleet: 'Flota',
    results: 'pojazdów',
    from: 'Od',
    perDay: '/dzień',
    perMonth: '/mies.',
    reserve: 'Rezerwuj',
    checkAvailability: 'Sprawdź dostępność',
    reserveNow: 'Zarezerwuj',
    reservation: 'Rezerwacja',
    dates: 'Daty',
    pickup: 'Odbiór',
    return: 'Zwrot',
    totalEst: 'Szac. koszt',
    submitReservation: 'Wyślij rezerwację',
    myReservations: 'Moje rezerwacje',
    home: 'Start',
    calendar: 'Kalendarz',
    saved: 'Zapisane',
    profile: 'Profil',
    specs: 'Specyfikacja',
    pricing: 'Cennik',
    daily: 'Doba',
    monthly: 'Miesiąc',
    deposit: 'Kaucja',
    kmLimit: 'Limit km',
    extraKm: 'Dodatk. km',
    seats: 'Miejsca',
    transmission: 'Skrzynia',
    fuel: 'Paliwo',
    cargo: 'Ładunek (D×S×W)',
    payload: 'Ładowność',
    year: 'Rok',
    status: {
      pending: 'Oczekuje',
      approved: 'Zatwierdz.',
      rejected: 'Odrzucona',
      active: 'Aktywna',
      completed: 'Zakończ.',
      overdue: 'Po terminie',
    },
    workerDash: 'Dyspozytornia',
    today: 'Dzisiaj',
    pickupsToday: 'Odbiory dziś',
    returnsToday: 'Zwroty dziś',
    pending: 'Oczekujące',
    approve: 'Zatwierdź',
    reject: 'Odrzuć',
    fleetMgmt: 'Zarządzanie flotą',
    pickupProtocol: 'Protokół wydania',
    odometer: 'Licznik',
    fuelLevel: 'Poziom paliwa',
    damages: 'Uwagi o uszkodzeniach',
    photos: 'Zdjęcia',
    signature: 'Podpis',
    confirm: 'Potwierdź wydanie',
    step: 'Krok',
    of: 'z',
    front: 'Przód',
    back: 'Tył',
    left: 'Lewy',
    right: 'Prawy',
    interior: 'Wnętrze',
    damage: 'Uszkodz.',
    customer: 'Klient',
    vehicle: 'Pojazd',
    until: 'do',
    overdue1: 'Po terminie',
    daysOverdue: 'dni po terminie',
    extendBooking: 'Przedłuż',
    contactCustomer: 'Kontakt',
    markReturned: 'Oznacz zwrot',
    yourDeposit: 'Twoja kaucja',
    refundedAfter: 'Zwrot po zakończonej rezerwacji',
    // S-06 return protocol
    returnProtocol: 'Protokół zwrotu',
    comparison: 'Porównanie wydanie → zwrot',
    comparisonSub: 'Wartości porównane automatycznie z protokołem wydania.',
    atPickup: 'Przy wydaniu',
    atReturn: 'Przy zwrocie',
    kmDriven: 'Przejechano',
    fuelChange: 'Poziom paliwa',
    newDamageT: 'Nowe uszkodzenia',
    noNewDamage: 'Brak nowych uszkodzeń',
    refuelNote: 'Opłata za paliwo',
    finishEmail: 'Zakończ i wyślij e-mail',
    protocolSent: 'Protokół wysłany',
    sentTo: 'Wysłano do',
    doneLabel: 'Gotowe',
    existingTag: 'istniejące',
    addedTag: 'nowe',
    backStep: 'Wstecz',
    // S-02 request-received confirmation
    requestReceived: 'Prośba przyjęta',
    requestReceivedSub: 'Konto nie jest wymagane — wszystko potwierdzimy e-mailem.',
    reference: 'Numer',
    whatNext: 'Co dalej',
    next1t: 'Oczekuje na zatwierdzenie',
    next1d: 'Pracownik sprawdzi prośbę, zwykle w ciągu kilku godzin.',
    next2t: 'Potwierdzenie e-mail',
    next2d: 'Otrzymasz potwierdzenie (lub alternatywne daty) e-mailem.',
    next3t: 'Odbiór',
    next3d: 'Zabierz dowód i prawo jazdy, aby odebrać pojazd.',
    emailedCopy: 'Potwierdzenie wysłane do',
    backToFleet: 'Wróć do floty',
    // review/summary step
    reviewTitle: 'Podsumowanie',
    continueBtn: 'Do podsumowania',
    bookingDetails: 'Szczegóły rezerwacji',
    customerData: 'Dane klienta',
    payment: 'Płatność',
    duration: 'Czas trwania',
    rentalCost: 'Najem',
    depositRefundable: 'Kaucja (zwrotna)',
    paymentAtPickup: 'Płatność przy odbiorze — gotówka lub karta.',
    agreeTerms: 'Akceptuję regulamin najmu.',
    changeBtn: 'Zmień',
    unavailableLegend: 'Niedostępne — zarezerwowane lub zgłoszone',
    // S-03 approval queue + request detail
    reviewBtn: 'Sprawdź',
    requestLabel: 'Wniosek',
    submittedLabel: 'Złożono',
    datesHeld: 'Daty zarezerwowane',
    datesHeldNote: 'Zablokowane dla innych klientów na czas oczekiwania — odrzucenie je zwalnia.',
    licence: 'Prawo jazdy',
    reasonTitle: 'Powód odrzucenia',
    reason1: 'Daty już niedostępne',
    reason2: 'Brak wymaganej kategorii',
    reason3: 'Pojazd wycofany',
    reason4: 'Inny',
    bookingConfirmed: 'Rezerwacja potwierdzona',
    bookingConfirmedSub: 'Klient powiadomiony e-mailem · daty aktywne.',
    requestRejected: 'Wniosek odrzucony',
    requestRejectedSub: 'Daty zwolnione · klient powiadomiony e-mailem.',
    confirmReject: 'Potwierdź odrzucenie',
    customerLabel: 'Klient',
    ago2h: '2 godz. temu',
    // S-05 signature + email
    signSection: 'Podpis i potwierdzenie',
    signSub: 'Sprawdź dane, a następnie pobierz podpis klienta.',
    recap: 'Podsumowanie protokołu',
    ackCustomer: 'Klient potwierdza stan pojazdu i warunki najmu.',
    signedBy: 'Podpisał(a)',
    signedAt: 'podpisano',
    clearSig: 'Wyczyść',
    confirmEmail: 'Potwierdź wydanie i wyślij',
    protocolSentPickup: 'Protokół wysłany',
    protocolSentPickupSub: 'Protokół wydania wysłany do klienta i zapisany jako PDF.',
    // S-04 fleet CRUD
    addVehicle: 'Dodaj pojazd',
    editVehicle: 'Edytuj pojazd',
    vBrand: 'Marka', vModel: 'Model', vType: 'Typ', vYear: 'Rok', vPlate: 'Rejestracja',
    vFuel: 'Paliwo', vTrans: 'Skrzynia', vSeats: 'Miejsca', vPayload: 'Ładowność', vCargo: 'Ładunek (D×S×W)',
    vDaily: 'Stawka / doba (zł)', vMonthly: 'Stawka / mies. (zł)', vDeposit: 'Kaucja (zł)', vKmLimit: 'Limit km', vStatus: 'Status',
    saveBtn: 'Zapisz', editAction: 'Edytuj', removeAction: 'Usuń',
    blockedTitle: 'Nie można usunąć pojazdu',
    blockedSub: 'aktywne rezerwacje',
    blockedHint: 'Anuluj lub zakończ je przed usunięciem pojazdu.',
    viewReservations: 'Zobacz rezerwacje',
    closeBtn: 'Zamknij',
    removeVehicleQ: 'Usunąć pojazd?',
    removeVehicleSub: 'Pojazd zostanie trwale usunięty z floty.',
    vehicleAdded: 'Pojazd dodany',
    vehicleSaved: 'Zmiany zapisane',
    vehicleRemoved: 'Pojazd usunięty',
    statusAvailable: 'Dostępny', statusService: 'Serwis',
    // S-08 employees
    employees: 'Pracownicy',
    addEmployee: 'Dodaj pracownika',
    role: 'Rola',
    roleAdmin: 'Administrator',
    roleEmployee: 'Pracownik',
    lastActive: 'Ostatnia aktywność',
    invitedS: 'Zaproszony',
    activeS: 'Aktywny',
    resetPassword: 'Resetuj hasło',
    removeEmp: 'Usuń',
    resetSentTo: 'Link resetujący wysłany do',
    removedEmp: 'Pracownik usunięty',
    fullName: 'Imię i nazwisko',
    emailAddr: 'Adres e-mail',
    sendInvite: 'Wyślij zaproszenie',
    cancelB: 'Anuluj',
    selfResetNote: 'Pracownicy mogą też zresetować hasło z ekranu logowania.',
    onlineNow: 'Online teraz',
    removeConfirmQ: 'Usunąć tego pracownika?',
    removeConfirmSub: 'Utraci dostęp natychmiast. Zakończone protokoły pozostają w archiwum.',
  },
};

function useLang() {
  // Reads window.__flotaLang; default EN
  const [lang, setLang] = React.useState(window.__flotaLang || T.lang);
  React.useEffect(() => {
    const h = (e) => setLang(window.__flotaLang || T.lang);
    window.addEventListener('flota-lang', h);
    return () => window.removeEventListener('flota-lang', h);
  }, []);
  return STR[lang] || STR.EN;
}

// ─── Vehicle silhouettes (simple geometric) ─────────────────
function Silhouette({ kind, color = '#0A0A0F', w = 220 }) {
  // kind: cargo, passenger, transporter, refrigerated, flatbed
  const stroke = color;
  const fill = 'transparent';
  const sw = 1.6;
  const props = { fill, stroke, strokeWidth: sw, strokeLinejoin: 'round', strokeLinecap: 'round' };
  const wheel = (cx) => (
    <g key={cx}>
      <circle cx={cx} cy="74" r="8" fill={color} opacity="0.92" />
      <circle cx={cx} cy="74" r="3.5" fill="#fff" />
    </g>
  );
  if (kind === 'cargo') {
    return (
      <svg viewBox="0 0 240 90" width={w} style={{ maxWidth: '100%' }}>
        <path d="M10 74 L10 38 Q10 30 18 30 L80 30 L98 14 L200 14 Q210 14 210 24 L210 74" {...props} />
        <line x1="98" y1="14" x2="98" y2="30" {...props} />
        <rect x="105" y="22" width="80" height="20" rx="2" {...props} />
        <line x1="80" y1="30" x2="80" y2="42" {...props} />
        <line x1="10" y1="74" x2="210" y2="74" {...props} />
        {[40, 180].map(wheel)}
      </svg>
    );
  }
  if (kind === 'passenger') {
    return (
      <svg viewBox="0 0 240 90" width={w} style={{ maxWidth: '100%' }}>
        <path d="M8 74 L8 38 Q8 28 18 28 L72 28 L88 12 L208 12 Q220 12 220 24 L220 74" {...props} />
        {[0,1,2,3].map(i => <rect key={i} x={92 + i*30} y="20" width="22" height="18" rx="2" {...props} />)}
        <rect x="34" y="38" width="36" height="18" rx="2" {...props} />
        <line x1="8" y1="74" x2="220" y2="74" {...props} />
        {[40, 180].map(wheel)}
      </svg>
    );
  }
  if (kind === 'transporter') {
    return (
      <svg viewBox="0 0 280 90" width={w} style={{ maxWidth: '100%' }}>
        {/* cab */}
        <path d="M8 74 L8 36 Q8 26 18 26 L58 26 L70 14 L88 14 Q94 14 94 22 L94 74" {...props} />
        <rect x="22" y="34" width="48" height="24" rx="2" {...props} />
        {/* deck */}
        <path d="M94 56 L270 56 L270 64 L94 64 Z" {...props} />
        <path d="M260 56 L270 40 L270 56" {...props} />
        {/* car on deck */}
        <path d="M130 56 L138 44 L210 44 L226 56" {...props} />
        <circle cx="150" cy="56" r="4" fill={color} />
        <circle cx="210" cy="56" r="4" fill={color} />
        {[42, 110, 230, 250].map(wheel)}
      </svg>
    );
  }
  if (kind === 'refrigerated') {
    return (
      <svg viewBox="0 0 280 90" width={w} style={{ maxWidth: '100%' }}>
        <path d="M8 74 L8 36 Q8 26 18 26 L58 26 L70 14 L88 14 Q94 14 94 22 L94 74" {...props} />
        <rect x="22" y="34" width="48" height="24" rx="2" {...props} />
        <rect x="98" y="10" width="170" height="64" rx="3" {...props} />
        <path d="M108 14 L108 28 M108 21 L130 21 M119 14 L119 28" {...props} opacity="0.7" />
        <rect x="245" y="18" width="18" height="14" rx="2" {...props} />
        {[42, 120, 240].map(wheel)}
      </svg>
    );
  }
  if (kind === 'flatbed') {
    return (
      <svg viewBox="0 0 280 90" width={w} style={{ maxWidth: '100%' }}>
        <path d="M8 74 L8 36 Q8 26 18 26 L58 26 L70 14 L88 14 Q94 14 94 22 L94 74" {...props} />
        <rect x="22" y="34" width="48" height="24" rx="2" {...props} />
        {/* tarp */}
        <path d="M98 30 Q100 22 108 22 L260 22 Q268 22 268 30 L268 60 L98 60 Z" {...props} />
        <path d="M108 22 L108 60 M138 22 L138 60 M168 22 L168 60 M198 22 L198 60 M228 22 L228 60 M258 22 L258 60" {...props} opacity="0.5" />
        <path d="M98 60 L268 60 L268 70 L98 70 Z" {...props} />
        {[42, 120, 240].map(wheel)}
      </svg>
    );
  }
  return null;
}

// ─── Icons (single set, line, 1.6 stroke) ───────────────────
const Icon = {
  base: (props) => ({
    width: props.s || 18, height: props.s || 18,
    viewBox: '0 0 24 24', fill: 'none',
    stroke: props.c || 'currentColor', strokeWidth: 1.7,
    strokeLinecap: 'round', strokeLinejoin: 'round',
    style: props.style,
  }),
  search: (p={}) => <svg {...Icon.base(p)}><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>,
  filter: (p={}) => <svg {...Icon.base(p)}><path d="M4 6h16M7 12h10M10 18h4"/></svg>,
  back: (p={}) => <svg {...Icon.base(p)}><path d="m15 6-6 6 6 6"/></svg>,
  more: (p={}) => <svg {...Icon.base(p)}><circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/></svg>,
  close: (p={}) => <svg {...Icon.base(p)}><path d="M6 6l12 12M18 6L6 18"/></svg>,
  plus: (p={}) => <svg {...Icon.base(p)}><path d="M12 5v14M5 12h14"/></svg>,
  check: (p={}) => <svg {...Icon.base(p)}><path d="m5 12 5 5 9-11"/></svg>,
  calendar: (p={}) => <svg {...Icon.base(p)}><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/></svg>,
  clock: (p={}) => <svg {...Icon.base(p)}><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>,
  user: (p={}) => <svg {...Icon.base(p)}><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 4-6 8-6s8 2 8 6"/></svg>,
  heart: (p={}) => <svg {...Icon.base(p)}><path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/></svg>,
  home: (p={}) => <svg {...Icon.base(p)}><path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z"/></svg>,
  seats: (p={}) => <svg {...Icon.base(p)}><path d="M6 10V6a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v4M4 10h16v6H4zM7 16v4M17 16v4"/></svg>,
  fuel: (p={}) => <svg {...Icon.base(p)}><path d="M4 20V6a2 2 0 0 1 2-2h7a2 2 0 0 1 2 2v14M4 12h11M15 9l3 3v6a2 2 0 0 0 2 2"/></svg>,
  gear: (p={}) => <svg {...Icon.base(p)}><circle cx="12" cy="12" r="3"/><path d="M12 5v3M12 16v3M5 12h3M16 12h3"/></svg>,
  ruler: (p={}) => <svg {...Icon.base(p)}><path d="M3 9l6 12 12-6L9 3z"/><path d="M7 8l2 2M10 12l2 2M13 15l2 2"/></svg>,
  weight: (p={}) => <svg {...Icon.base(p)}><path d="M6 8h12l-1 12H7zM9 8V6a3 3 0 0 1 6 0v2"/></svg>,
  pin: (p={}) => <svg {...Icon.base(p)}><path d="M12 22s7-7 7-12a7 7 0 0 0-14 0c0 5 7 12 7 12z"/><circle cx="12" cy="10" r="2.5"/></svg>,
  arrowRight: (p={}) => <svg {...Icon.base(p)}><path d="M5 12h14M13 6l6 6-6 6"/></svg>,
  arrowDown: (p={}) => <svg {...Icon.base(p)}><path d="M12 5v14M6 13l6 6 6-6"/></svg>,
  camera: (p={}) => <svg {...Icon.base(p)}><path d="M4 8h3l2-3h6l2 3h3a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z"/><circle cx="12" cy="13" r="3.5"/></svg>,
  edit: (p={}) => <svg {...Icon.base(p)}><path d="M5 19h3l11-11-3-3L5 16zM14 6l3 3"/></svg>,
  chevR: (p={}) => <svg {...Icon.base(p)}><path d="m9 6 6 6-6 6"/></svg>,
  chevD: (p={}) => <svg {...Icon.base(p)}><path d="m6 9 6 6 6-6"/></svg>,
  bell: (p={}) => <svg {...Icon.base(p)}><path d="M6 16V11a6 6 0 1 1 12 0v5l1.5 2H4.5zM10 20a2 2 0 0 0 4 0"/></svg>,
  truck: (p={}) => <svg {...Icon.base(p)}><path d="M3 7h11v10H3zM14 11h5l2 3v3h-7"/><circle cx="7" cy="18" r="2"/><circle cx="17" cy="18" r="2"/></svg>,
  warning: (p={}) => <svg {...Icon.base(p)}><path d="M12 4 2 20h20zM12 10v5M12 18h.01"/></svg>,
  key: (p={}) => <svg {...Icon.base(p)}><circle cx="8" cy="14" r="4"/><path d="m11 13 9-9M16 7l2 2M14 9l2 2"/></svg>,
  phone: (p={}) => <svg {...Icon.base(p)}><path d="M5 4h4l2 5-3 2a12 12 0 0 0 5 5l2-3 5 2v4a2 2 0 0 1-2 2A15 15 0 0 1 3 6a2 2 0 0 1 2-2z"/></svg>,
  message: (p={}) => <svg {...Icon.base(p)}><path d="M4 5h16v12H8l-4 4z"/></svg>,
  pen: (p={}) => <svg {...Icon.base(p)}><path d="M14 4l6 6-10 10H4v-6z"/></svg>,
  grid: (p={}) => <svg {...Icon.base(p)}><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>,
  list: (p={}) => <svg {...Icon.base(p)}><path d="M4 6h16M4 12h16M4 18h16"/></svg>,
};

// ─── Vehicle data ───────────────────────────────────────────
const VEHICLES = [
  {
    id: 'spr',
    type: 'cargo',
    brand: 'Mercedes-Benz', model: 'Sprinter 317 CDI', year: 2024,
    fuel: 'Diesel', trans: 'Auto', seats: 3,
    cargo: '4.30 × 1.78 × 1.94 m', payload: '1320 kg',
    daily: 320, monthly: 6800, deposit: 2500, kmLimit: 300, extraKm: 1.2,
    plate: 'WX 4827K', status: 'rented', popular: true,
  },
  {
    id: 'trf',
    type: 'cargo',
    brand: 'Ford', model: 'Transit L3H2', year: 2023,
    fuel: 'Diesel', trans: 'Manual', seats: 3,
    cargo: '3.95 × 1.78 × 1.89 m', payload: '1180 kg',
    daily: 290, monthly: 6200, deposit: 2200, kmLimit: 300, extraKm: 1.1,
    plate: 'WX 5519M', status: 'available', popular: true,
  },
  {
    id: 'crf',
    type: 'passenger',
    brand: 'VW', model: 'Crafter 9-seater', year: 2024,
    fuel: 'Diesel', trans: 'Auto', seats: 9,
    cargo: '— · 9 osób', payload: '900 kg',
    daily: 380, monthly: 8200, deposit: 2800, kmLimit: 400, extraKm: 1.3,
    plate: 'WX 6204A', status: 'available', popular: true,
  },
  {
    id: 'mas',
    type: 'flatbed',
    brand: 'Renault', model: 'Master Plandeka', year: 2023,
    fuel: 'Diesel', trans: 'Manual', seats: 3,
    cargo: '4.10 × 2.10 × 2.20 m', payload: '1100 kg',
    daily: 340, monthly: 7400, deposit: 2500, kmLimit: 300, extraKm: 1.2,
    plate: 'WX 3318B', status: 'maintenance',
  },
  {
    id: 'dly',
    type: 'refrigerated',
    brand: 'Iveco', model: 'Daily 35S14 Izoterma', year: 2024,
    fuel: 'Diesel', trans: 'Manual', seats: 3,
    cargo: '4.30 × 1.96 × 1.90 m · −20 °C', payload: '1050 kg',
    daily: 420, monthly: 8900, deposit: 3000, kmLimit: 300, extraKm: 1.4,
    plate: 'WX 7715C', status: 'rented',
  },
  {
    id: 'daf',
    type: 'transporter',
    brand: 'DAF', model: 'LF 180 Laweta', year: 2022,
    fuel: 'Diesel', trans: 'Manual', seats: 3,
    cargo: '6.20 × 2.30 m · do 3.5 t', payload: '3200 kg',
    daily: 520, monthly: 11200, deposit: 4000, kmLimit: 250, extraKm: 1.8,
    plate: 'WX 1102D', status: 'available',
  },
];

// ─── Atoms ──────────────────────────────────────────────────
function Pill({ children, active, onClick, style, dark }) {
  return (
    <button onClick={onClick} style={{
      height: 36, padding: '0 16px', borderRadius: 9999,
      border: `1px solid ${active ? tokens.ink : tokens.hair}`,
      background: active ? tokens.ink : tokens.card,
      color: active ? '#fff' : tokens.ink,
      fontFamily: tokens.font, fontSize: 13, fontWeight: 540,
      letterSpacing: -0.1, cursor: 'pointer',
      whiteSpace: 'nowrap', flexShrink: 0,
      transition: 'all .15s',
      ...style,
    }}>{children}</button>
  );
}

function StatusBadge({ status, t, style }) {
  const map = {
    pending:   { bg: tokens.amberSoft, fg: tokens.amber },
    approved:  { bg: tokens.greenSoft, fg: tokens.green },
    rejected:  { bg: tokens.redSoft,   fg: tokens.red },
    active:    { bg: tokens.blueSoft,  fg: tokens.blue },
    completed: { bg: tokens.greySoft,  fg: tokens.grey },
    overdue:   { bg: tokens.redSoft,   fg: tokens.red },
    available: { bg: tokens.greenSoft, fg: tokens.green },
    rented:    { bg: tokens.blueSoft,  fg: tokens.blue },
    maintenance: { bg: tokens.amberSoft, fg: tokens.amber },
  };
  const c = map[status] || map.pending;
  const label = (t && t.status && t.status[status]) || status;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      height: 22, padding: '0 8px', borderRadius: 6,
      background: c.bg, color: c.fg,
      fontFamily: tokens.font, fontSize: 11, fontWeight: 600,
      letterSpacing: 0.1, textTransform: 'uppercase',
      ...style,
    }}>
      <span style={{ width: 5, height: 5, borderRadius: 99, background: c.fg }}/>
      {label}
    </span>
  );
}

function PriceTag({ daily, monthly, t, size = 'md', align = 'right' }) {
  const big = size === 'lg' ? 22 : size === 'sm' ? 15 : 17;
  return (
    <div style={{ textAlign: align, fontFamily: tokens.font }}>
      <div style={{ color: tokens.ink, fontWeight: 700, fontSize: big, letterSpacing: -0.4, lineHeight: 1 }}>
        {daily} zł<span style={{ fontWeight: 500, color: tokens.muted, fontSize: big * 0.65 }}>{t.perDay}</span>
      </div>
      {monthly !== undefined && (
        <div style={{ color: tokens.muted, fontSize: 12, marginTop: 4, fontWeight: 500 }}>
          {monthly} zł{t.perMonth}
        </div>
      )}
    </div>
  );
}

function FleetCard({ v, onClick, t, compact }) {
  return (
    <div onClick={onClick} style={{
      background: tokens.card, borderRadius: 20,
      padding: compact ? 14 : 18, cursor: 'pointer',
      boxShadow: tokens.shadow1,
      transition: 'transform .15s, box-shadow .15s',
      fontFamily: tokens.font,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 16, fontWeight: 650, color: tokens.ink, letterSpacing: -0.3, lineHeight: 1.15 }}>
            {v.brand}
          </div>
          <div style={{ fontSize: 13.5, color: tokens.ink2, marginTop: 2 }}>
            {v.model} · {v.year}
          </div>
        </div>
        <PriceTag daily={v.daily} t={t} size="sm" />
      </div>
      <div style={{
        height: compact ? 88 : 110, margin: '6px -4px 10px',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <Silhouette kind={v.type} color={tokens.ink} w={compact ? 200 : 240} />
      </div>
      <div style={{
        display: 'flex', justifyContent: 'space-between',
        paddingTop: 10, borderTop: `1px solid ${tokens.hair2}`,
      }}>
        {[
          { i: Icon.seats, l: v.seats },
          { i: Icon.gear, l: v.trans },
          { i: Icon.fuel, l: v.fuel },
          { i: Icon.weight, l: v.payload },
        ].map((x, i) => (
          <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, color: tokens.ink2 }}>
            <x.i s={15} c={tokens.muted} />
            <span style={{ fontSize: 11, fontWeight: 540, color: tokens.ink, letterSpacing: -0.1 }}>{x.l}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── iPhone shell (lightweight, sans starter) ───────────────
function Phone({ children, w = 390, h = 844, label }) {
  return (
    <div style={{
      width: w, height: h, borderRadius: 50, overflow: 'hidden',
      position: 'relative', background: tokens.bg,
      boxShadow: '0 0 0 10px #0f0f12, 0 0 0 11px #2a2a30, 0 40px 80px rgba(15,23,42,0.16)',
      fontFamily: tokens.font, WebkitFontSmoothing: 'antialiased',
    }}>
      {/* Status bar */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: 50, zIndex: 30,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '18px 28px 0', pointerEvents: 'none',
      }}>
        <div style={{ fontFamily: tokens.font, fontWeight: 600, fontSize: 14, color: tokens.ink }}>9:41</div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <svg width="17" height="11" viewBox="0 0 17 11"><rect x="0" y="7" width="2.6" height="4" rx="0.5" fill="#0A0A0F"/><rect x="4" y="5" width="2.6" height="6" rx="0.5" fill="#0A0A0F"/><rect x="8" y="3" width="2.6" height="8" rx="0.5" fill="#0A0A0F"/><rect x="12" y="0" width="2.6" height="11" rx="0.5" fill="#0A0A0F"/></svg>
          <svg width="22" height="11" viewBox="0 0 22 11"><rect x="0.5" y="0.5" width="19" height="10" rx="2.5" stroke="#0A0A0F" fill="none"/><rect x="2" y="2" width="14" height="7" rx="1" fill="#0A0A0F"/></svg>
        </div>
      </div>
      {/* Dynamic island */}
      <div style={{
        position: 'absolute', top: 12, left: '50%', transform: 'translateX(-50%)',
        width: 120, height: 34, borderRadius: 22, background: '#000', zIndex: 35,
      }} />
      {/* Content */}
      <div style={{ height: '100%', overflow: 'hidden', position: 'relative' }}>{children}</div>
      {/* Home indicator */}
      <div style={{
        position: 'absolute', bottom: 8, left: '50%', transform: 'translateX(-50%)',
        width: 134, height: 5, borderRadius: 99, background: 'rgba(0,0,0,0.85)', zIndex: 40,
      }} />
    </div>
  );
}

// ─── Floating bottom tab bar ────────────────────────────────
function TabBar({ tabs, active, onChange, t }) {
  return (
    <div style={{
      position: 'absolute', bottom: 22, left: '50%', transform: 'translateX(-50%)',
      display: 'flex', gap: 4, padding: 6,
      background: '#0A0A0F', borderRadius: 9999,
      boxShadow: '0 8px 24px rgba(0,0,0,0.18), 0 2px 6px rgba(0,0,0,0.10)',
      zIndex: 25,
    }}>
      {tabs.map(tab => {
        const A = active === tab.id;
        return (
          <button key={tab.id} onClick={() => onChange && onChange(tab.id)} style={{
            display: 'flex', alignItems: 'center', gap: 6,
            height: 40, padding: A ? '0 14px' : '0 12px',
            background: A ? '#fff' : 'transparent', border: 'none',
            borderRadius: 9999, cursor: 'pointer',
            color: A ? tokens.ink : 'rgba(255,255,255,0.7)',
            fontFamily: tokens.font, fontSize: 13, fontWeight: 600,
            transition: 'all .2s',
          }}>
            <tab.icon s={18} />
            {A && <span>{tab.label}</span>}
          </button>
        );
      })}
    </div>
  );
}

// ─── Picture placeholder (for hero / gallery) ───────────────
function PicPlaceholder({ label, w = '100%', h = 180, dark, radius = 16 }) {
  const bg = dark ? '#1a1a1f' : '#EBEBEF';
  const fg = dark ? 'rgba(255,255,255,0.35)' : 'rgba(10,10,15,0.35)';
  return (
    <div style={{
      width: w, height: h, borderRadius: radius,
      background: `repeating-linear-gradient(135deg, ${bg} 0 16px, ${dark ? '#15151a' : '#E2E2E8'} 16px 32px)`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      position: 'relative', overflow: 'hidden',
    }}>
      <span style={{
        fontFamily: tokens.mono, fontSize: 10, fontWeight: 500,
        letterSpacing: 0.6, textTransform: 'uppercase', color: fg,
      }}>{label}</span>
    </div>
  );
}

Object.assign(window, {
  T, tokens, STR, useLang, Silhouette, Icon, VEHICLES,
  Pill, StatusBadge, PriceTag, FleetCard, Phone, TabBar, PicPlaceholder,
});
