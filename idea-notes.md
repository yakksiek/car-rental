# FleetRent — MVP ideas

### Główny problem

Lokalne firmy wynajmu samochodów dostawczych zarządzają flotą, rezerwacjami i protokołami zdawczo-odbiorczymi ręcznie (telefon, mail, papier), co prowadzi do podwójnych rezerwacji, zagubionych protokołów i braku kontroli nad stanem pojazdów.

### Najmniejszy zestaw funkcjonalności

- Przeglądanie floty pojazdów dostawczych z filtrami (typ, ładowność, daty)
- Szczegółowa karta pojazdu z danymi technicznymi i cennikiem
- Składanie wniosku o rezerwację przez klienta (imię, email, telefon, daty)
- Panel pracownika: lista przypisanych pojazdów, akceptacja/odrzucenie rezerwacji
- Protokół wydania pojazdu (przebieg, paliwo, uwagi o uszkodzeniach, zdjęcia, podpis cyfrowy)
- Protokół zwrotu z porównaniem danych z wydania (różnica km, paliwa, nowe uszkodzenia)
- Automatyczne oznaczanie przeterminowanych zwrotów
- Prosty system kont: klient, pracownik, admin

### Co NIE wchodzi w zakres MVP

- Płatności online (na start rezerwacja + płatność przy odbiorze)
- Powiadomienia email/SMS o statusie rezerwacji
- Raportowanie i statystyki przychodów
- Aplikacja mobilna (na początek tylko responsywna strona web)
- Integracja z systemami księgowymi
- Wielojęzyczność (na start tylko polski, angielski jako drugi etap)
- Oceny i recenzje pojazdów przez klientów
- Zarządzanie serwisem i przeglądami pojazdów

### Kryteria sukcesu

- Klient może przeglądać flotę, wybrać pojazd i złożyć rezerwację w < 3 minuty
- Pracownik może zaakceptować rezerwację i wypełnić protokół wydania w < 5 minut
- System blokuje podwójne rezerwacje na ten sam pojazd i te same daty
- Protokół zwrotu automatycznie porównuje dane z protokołem wydania
- Przeterminowane zwroty są widoczne na dashboardzie pracownika bez ręcznego sprawdzania

### Typy pojazdów

- Furgony (Cargo Vans)
- Busy osobowe (Passenger Vans)
- Lawety (Car Transporters)
- Izotermy (Refrigerated Trucks)
- Plandeki (Flatbed/Tarpaulin Trucks)

### Dane pojazdu

- Marka, model, rocznik, zdjęcia
- Typ paliwa, skrzynia biegów, liczba miejsc
- Wymiary przestrzeni ładunkowej (długość, szerokość, wysokość)
- Stawka dzienna + stawka miesięczna
- Kaucja, limit km, cena za dodatkowy km

### Role użytkowników

- **Klient**: przeglądanie floty, rezerwacja, podgląd statusu rezerwacji
- **Pracownik**: zarządzanie przypisanymi pojazdami, rezerwacjami, protokołami, kalendarz
- **Admin**: pełny dostęp — zarządzanie flotą, pracownikami, wszystkimi rezerwacjami

### Logika biznesowa (jedno zdanie)

System oblicza koszt wynajmu na podstawie stawki dziennej/miesięcznej i limitu km, blokuje podwójne rezerwacje, automatycznie porównuje protokoły wydania i zwrotu, oraz flaguje przeterminowane zwroty z naliczaniem opłat za opóźnienie.
