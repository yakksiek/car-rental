# Claude Design update brief — Cennik "Stawki wg typu pojazdu" table

**Target:** Claude Design project `Rental car company` (`352d78a6-84fd-49a2-8b38-2fe289691fc3`), file `info-pages.jsx`, the `PRICE_ROWS` constant + the "Stawki wg typu pojazdu" table in `PricingBody` (both `ScreenPricingDesktop` and `ScreenPricingMobile`).

**Why:** In the app, this table is rendered **live from real catalog data**, grouped by our five stored vehicle categories — not by the curated marketing "types" currently in the mock. The mock and the shipped page must match so the fidelity vision-diff converges. Everything else on the Cennik screen (the four rental-length tier cards, "W każdej cenie", "Dobrze wiedzieć") stays **exactly as is** — it is intentional static marketing copy.

## The only change: replace the 5 curated rows with our 5 real categories

Our schema stores pricing **per vehicle**, grouped by a 5-value `vehicle_category` enum. The page shows, per category, the **cheapest** active vehicle's daily and monthly rate as an "od" (from) figure. So each row should read `od {min daily} zł` / `od {min monthly} zł`.

Replace `PRICE_ROWS` with these five rows (Polish category labels are canonical — `categoryLabelPl`). Keep the same row styling (icon chip, `2.4fr 1fr 1fr` grid desktop, stacked mobile, header band). Prefix both numbers with **"od "**:

| icon           | Pojazd (label)  | subtitle (examples — keep or drop) | Doba      | Miesiąc     |
| -------------- | --------------- | ---------------------------------- | --------- | ----------- |
| `II.van`       | **Furgon**      | Renault Master, Ford Transit       | od 219 zł | od 4 500 zł |
| `II.bus`       | **Bus osobowy** | VW Crafter, Opel Movano            | od 279 zł | od 5 900 zł |
| `II.lift`      | **Autolaweta**  | transport pojazdów                 | od 349 zł | od 7 200 zł |
| `II.container` | **Chłodnia**    | zabudowa chłodnicza                | od 399 zł | od 8 400 zł |
| `II.crew`      | **Skrzyniowy**  | skrzynia / plandeka                | od 309 zł | od 6 600 zł |

(The numbers above are placeholders matching the current mock's spread — in the app they come from `MIN(daily_rate)` / `MIN(monthly_rate)` per category over active vehicles, formatted by `formatPln`. Keep the header columns `POJAZD / DOBA / MIESIĄC`. Keep the sub-line `Ceny netto, od. Ostateczna wycena zależy od terminu i długości najmu.`)

## Notes

- Categories with **no active vehicle** are hidden in the app; the mock can show all five.
- If a category's daily and monthly icon feels off, any lucide-style 24-grid glyph from the `II` set is fine — the app maps: cargo_van→van, passenger_van→bus, car_transporter→lift, refrigerated_truck→container, flatbed_truck→crew.
- Do **not** touch the tier cards (219→149), the "od" framing on them, or the "Dobrze wiedzieć" globals — those remain static marketing copy by product decision.

After re-export, replace the `prices desktop.jpg` / `prices mobile.jpg` in `context/changes/public-info-pages/design-review/` so the vision-diff compares against the corrected table.
