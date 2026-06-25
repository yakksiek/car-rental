# S-02 Funnel — Design-Alignment Gaps (D0–D24)

Catalogue of differences between the Phase-4 funnel and the S-02 hi-fi design
(`context/foundation/design/screenshots/s-02-reservation-flow/desktop-1..3`, `mobile-2..4`),
captured during Phase-4 manual review. Drives **Phase 5: Design Alignment** in `plan.md`; each
item maps to a Phase-5 change item.

Tags: **[STRUCTURE]** flow/arch · **[SCOPE]** re-adds a deferred feature/DB · **[LAYOUT]**
arrangement · **[STYLE]** tokens/type · **[BUG]** broken vs intent.

| ID | Tag | Gap | → P5 item |
| --- | --- | --- | --- |
| D0 | STRUCTURE | Flow: design = 3-step desktop wizard (step 1 = detail page w/ booking widget → step 2 details → step 3 confirm); ours = combined `/reserve` form → review. Root cause of the double-current indicator bug. | 1 (Opt A/B) |
| D1 | STRUCTURE/LAYOUT | No booking widget/calendar on our detail page (calendar is on `/reserve`). | 1 |
| D2 | LAYOUT | Specs: design 3-col icon grid; ours vertical list. | 5 |
| D3 | SCOPE | Trust row (Pay at pick-up / Fully insured / 24·7) absent. | 5 |
| D4 | STYLE | Green "Available for your dates" badge — **intentionally omitted** (non-gap). | — |
| D5 | STYLE | "No account needed · free cancellation…" reassurance absent. | 5 |
| D6 | SCOPE | Plate (`WX 4827K`) + branch (`Warszawa · Mokotów`) dropped (no schema). | 7 |
| D7 | SCOPE | Company / VAT-NIP / Notes fields (optional). | 4 (DB+RPC) |
| D8 | LAYOUT | Step-2 field grid (name\|phone, email, company\|vat, notes) vs stacked column. | 3 |
| D9 | LAYOUT | ORDER SUMMARY sidebar (Pickup/Return/Branch, navy total band) differs. | 3 |
| D10 | STYLE | Eyebrow + serif "Your details." header missing. | 3 |
| D11 | LAYOUT | Back-to-vehicle + Request-booking button placement. | 3 |
| D12 | STYLE | Indicator colors: design green-✓/navy-current/grey; ours crimson. | 2 |
| D13 | STRUCTURE | Indicator shown from step 2 (not step 1). | 1 |
| D14 | STYLE | Request-received badge: design green; ours crimson. | 6 |
| D15 | LAYOUT | Reference: design crimson mono above title; ours chip in a chip row. | 6 |
| D16 | STRUCTURE | "What happens next": design 3 horizontal cards; ours vertical stepper. | 6 |
| D17 | LAYOUT | Summary card horizontal (price right) vs vertical rows. | 6 |
| D18 | LAYOUT | Two buttons (Back to fleet + navy Browse) vs single. | 6 |
| D19 | STYLE | Title bold-sans (design) vs Instrument Serif (ours) — confirm canonical. | 6 |
| D20 | STYLE | Reference format `R-YYMM-NNNN` vs `R-`+base36. | 7 (RPC) |
| D21 | BUG/LAYOUT | Mobile sticky CTA: design full-width action under estimate band; ours cramped side button with truncated "+ kaucj…". | 1/3 |
| D22 | SCOPE | Daily/Monthly toggle present in design; dropped (Daily-only). | 7 |
| D23 | STYLE | Mobile header centered "Reservation" + card `›`; ours left "Rezerwacja". | 3 |
| D24 | STYLE | "Unavailable — booked or requested" legend — **intentionally omitted** (non-gap). | — |

## Intentional non-gaps (no action)

- **D4** green availability badge — we handle availability via the RPC pre-check + EXCLUDE
  constraint, not a per-vehicle green badge.
- **D24** booked-date greying — resolved design divergence; the calendar never greys booked dates.
