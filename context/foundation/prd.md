---
project: "FleetRent"
version: 1
status: draft
created: 2026-05-18
context_type: greenfield
product_type: web-app
target_scale:
  users: medium
  qps: low
  data_volume: small
timeline_budget:
  mvp_weeks: 3
  hard_deadline: null
  after_hours_only: false
---

## Vision & Problem Statement

Local commercial vehicle rental companies manage their fleet, reservations, and handover protocols manually — phone, email, paper. This coordination overhead across multiple employees leads to double bookings, while critical operational data (mileage, fuel level, damage condition) trapped in paper protocols cannot be searched, compared, or flagged automatically. Overdue returns go unnoticed until someone manually checks.

Small operators don't invest in software until a costly incident forces the issue. Existing rental tools target consumer car rental (B2C), not commercial fleet operations that require handover protocols with damage documentation, cargo vehicle specs (load dimensions, payload capacity), and employee-level fleet assignment.

## User & Persona

### Primary persona: Fleet employee

Role: Operational staff at a local commercial vehicle rental company. Manages vehicles day-to-day — processes reservations, performs vehicle handovers (issue and return), documents mileage/fuel/damage on paper, tracks overdue returns manually.

Moment of pain: A customer returns a van. The employee must find the paper handover protocol from weeks ago, compare mileage and fuel, check for new damage, calculate extra charges — all while another customer is waiting to pick up the same vehicle.

### Primary persona: Owner / Admin

Role: Business owner or manager of the rental operation. Oversees the entire fleet, all employees, and all reservations. Responsible for pricing, fleet composition, and employee management.

Moment of pain: Discovers a double booking when a customer arrives and the vehicle is already out. No single view of fleet status, reservation conflicts, or overdue vehicles — has to call employees one by one to piece together the picture.

## Success Criteria

### Primary
- A customer can browse the fleet, pick a vehicle and dates, and submit a reservation request in under 3 minutes — without creating an account.
- An employee can accept a reservation and complete an issue protocol (mileage, fuel, damage photos, digital signature) in under 5 minutes.
- The return protocol displays the issue protocol baseline and highlights deltas (mileage difference, fuel level change, new damage) after the employee enters current values.

### Secondary
- Customer sees real-time availability as they pick dates — conflicts shown during browsing, not just rejected after submission.

### Guardrails
- No double bookings: the system must prevent two reservations for the same vehicle on overlapping dates. This is the core data integrity guarantee.
- Customer personal data (names, emails, phone numbers, protocol photos) must not be accessible to unauthorized users.

## User Stories

### US-01: Customer reserves a commercial vehicle

- **Given** a visitor on the FleetRent site
- **When** they select a vehicle category, filter by specs and dates, pick a vehicle, and submit a reservation request with their contact details
- **Then** the system confirms receipt, prevents overlapping reservations on that vehicle, and the request appears on the employee dashboard for approval

#### Acceptance Criteria
- Reservation request can be completed without creating an account
- Overlapping date selection for an already-booked vehicle is blocked before submission
- Employee sees the new request within their pending reservations list

### US-02: Employee completes a vehicle handover (issue + return)

- **Given** an employee with an accepted reservation due for pickup
- **When** they open the issue protocol, record mileage/fuel/damage with photos, capture a digital signature, and submit
- **Then** the protocol is saved and auto-emailed to the customer; when the vehicle returns, the return protocol opens with the issue baseline as reference, the employee enters current values, and the system displays the comparison

#### Acceptance Criteria
- Issue protocol captures: mileage, fuel level, damage notes, photos, digital signature
- Return protocol shows issue baseline as reference; employee must enter all current values fresh
- System auto-compares and displays deltas (km driven, fuel difference, new damage)
- Both protocols are emailed to the customer automatically
- Overdue returns (past expected return date) are flagged on the employee dashboard

## Functional Requirements

### Fleet browsing (public)
- FR-001: Visitor can browse vehicles by category (cargo van, passenger van, car transporter, refrigerated truck, flatbed truck). Priority: must-have
  > Socrates: Counter-argument considered: "too many categories fragments a small fleet — 5 types across 15 vehicles means 3 per page." Resolution: kept; UI should gracefully handle small category counts (show all vehicles with category filter rather than separate category pages).
- FR-002: Visitor can filter vehicles by specs (type, payload capacity, available dates). Priority: must-have
  > Socrates: No counter-argument; stands as written.
- FR-003: Visitor can view a vehicle detail card with technical specs, cargo dimensions, photos, and pricing (daily/monthly rate, deposit, km limit). Priority: must-have
  > Socrates: No counter-argument; stands as written.

### Reservation (public)
- FR-004: Visitor can submit a reservation request (name, email, phone, selected vehicle, dates) without creating an account. Priority: must-have
  > Socrates: No counter-argument; frictionless booking is the right trade for v1 targeting small operators.
- FR-005: System prevents reservation requests for a vehicle on dates that overlap with an existing confirmed reservation. Hotel-style rule: return by 10:00 AM, pickup from 2:00 PM — same-day turnaround is allowed. Priority: must-have
  > Socrates: Counter-argument considered: "strict date-level blocking loses same-day turnaround revenue." Resolution: clarified — hotel-style time windows (return by 10am, pickup from 2pm) allow same-day turnover with a 4-hour buffer.

### Handover protocols (employee)
- FR-006: Employee can fill out an issue protocol at vehicle pickup (mileage, fuel level, damage notes, photos, digital signature). Priority: must-have
  > Socrates: Counter-argument considered: "photo upload + signature capture adds significant technical complexity for v1." Resolution: kept; photos and signatures are the core value proposition — they replace paper protocols and provide dispute evidence. Complexity is accepted.
- FR-007: Employee can fill out a return protocol at vehicle return — issue protocol baseline data is shown as reference; employee must enter all current values fresh (current mileage, current fuel, new damage, new photos, signature). System auto-compares current vs. issue values. Priority: must-have
  > Socrates: Counter-argument considered: "pre-filling makes it easy to skip inspection." Resolution: clarified — only the issue baseline is pre-filled as reference. All current values (mileage, fuel, damage, photos) must be entered fresh by the employee. Comparison is then automatic.
- FR-008: System auto-emails the completed protocol to the customer after issue and after return. Priority: must-have
  > Socrates: No counter-argument; auto-email is the simplest delivery mechanism without a customer portal.

### Reservation management (employee)
- FR-009: Employee can view all pending reservation requests. Priority: must-have
- FR-010: Employee can accept or reject a reservation request. Priority: must-have
  > Socrates (FR-009/010): Counter-argument considered: "manual accept/reject adds delay — customer waits with no confirmation." Resolution: kept; B2B commercial fleet requires human judgment on each booking (vehicle suitability, customer reliability). The delay is a deliberate trade for control.

### Fleet management (employee)
- FR-011: Employee can add and edit vehicles in the fleet. Removal is blocked when active reservations exist — employee must cancel reservations first. Priority: must-have
  > Socrates: Counter-arguments considered: (1) "no audit trail — any employee can change pricing"; (2) "removing a vehicle with active reservations creates a data integrity problem." Resolution: (1) deferred to v2 — acceptable for small teams; (2) resolved — system blocks deletion when active reservations exist.

### Dashboard (employee)
- FR-012: Employee can see overdue returns flagged automatically on their dashboard. Priority: must-have
  > Socrates: No counter-argument; visibility into overdue returns is the baseline.

### Employee management (admin)
- FR-013: Admin can add and remove employee accounts. Employees can self-service reset their own password via email. Priority: must-have
  > Socrates: Counter-argument considered: "no password reset means admin becomes IT support." Resolution: resolved — employees can reset their own password via email; admin retains create/remove control.

### Availability (system)
- FR-014: System shows real-time vehicle availability to visitors as they select dates. Priority: nice-to-have

## Non-Functional Requirements

- Protocol forms (issue and return) must be fully usable on handheld devices (phones and tablets) in the field — employees complete these on-site at the vehicle, capturing photos and signatures during the handover.
- All user-facing pages load within 2 seconds on a standard broadband connection.

## Business Logic

The system enforces rental lifecycle integrity by calculating costs from rate structures and km limits, preventing scheduling conflicts via hotel-style availability windows, auto-comparing issue and return protocol data to surface discrepancies, and flagging overdue returns.

**Cost calculation.** Inputs: daily rate, monthly rate, km limit, per-extra-km charge, deposit. Output: rental cost based on selected duration and actual kilometers driven (captured in return protocol vs. issue protocol).

**Availability enforcement.** Hotel-style booking rule: vehicle must be returned by 10:00 AM, next pickup available from 2:00 PM. Same vehicle can turn over on the same day within the 4-hour buffer. The system blocks reservation requests that overlap with confirmed bookings under this rule.

**Protocol comparison.** The issue protocol captures the baseline state of the vehicle (mileage, fuel level, damage condition). The return protocol captures the current state. The system automatically computes and displays deltas: kilometers driven, fuel level change, new damage discovered.

**Overdue detection.** The system flags vehicles not returned by the expected return date and time. Flag only in v1 — no automatic late-fee calculation. Employee handles charges manually.

## Access Control

Two authenticated roles (employee, admin) plus an unauthenticated customer flow. Authentication via email and password.

- **Public (unauthenticated)**: Can browse the fleet catalog — view vehicles, filter by type/capacity/dates, see vehicle detail cards with specs and pricing. Can submit a reservation request (name, email, phone, dates) without creating an account. No login required for any customer action in v1.
- **Employee**: Logs in with access to all vehicles (no per-employee vehicle assignment). Can manage fleet (add/edit/remove vehicles), accept/reject reservations, fill out handover protocols (issue and return with photos and digital signature), view overdue returns on their dashboard.
- **Admin**: Everything an employee can do, plus employee management (add/remove staff accounts). Full fleet-wide oversight.

Customer accounts (login, history, statuses) are deferred to v2. In v1, customers interact only via the public site and receive protocols by email.

## Non-Goals

- **No online payment processing.** Reservation confirmed verbally; payment at vehicle pickup. No billing integration in v1. Keeps financial complexity out.
- **No customer accounts or portal.** Customers interact only via the public site and receive protocols by email. No login, no dashboard, no history view.
- **No notifications beyond protocol delivery.** No reservation status emails, no reminders, no SMS alerts. Only the auto-emailed protocol after issue/return.
- **No multi-language support.** Polish only in v1. English deferred to a later phase.
- **No revenue reporting or statistics.** No dashboards for income, utilization rates, or fleet performance analytics.
- **No native mobile app.** Responsive web only. Employees use their phone/tablet browsers for on-site protocols.
- **No accounting system integration.** No connection to external bookkeeping, invoicing, or ERP systems.
- **No customer reviews or ratings.** No feedback mechanism for customers to rate vehicles or service.
- **No vehicle maintenance or service management.** No tracking of inspections, repairs, insurance, or scheduled servicing.
- **No multi-tenancy.** Single-company deployment. Not a SaaS platform for multiple rental operators.
- **No automatic late-fee calculation.** System flags overdue returns; employee handles charges manually.

## Open Questions

All resolved — no blocking open questions remain.

1. ~~**Audit trail for fleet changes.**~~ Resolved: no audit trail in v1. Vehicle deletion guard reduces risk. Defer audit logging to v2.
2. ~~**Removing a vehicle with active reservations.**~~ Resolved: system blocks vehicle deletion when active reservations exist. Employee must cancel reservations first. Pricing edits remain unrestricted.
3. ~~**Password reset for employee accounts.**~~ Resolved: employees can self-service reset their password via email. Admin retains account create/remove control.
