# Design Prompt: Commercial Vehicle Rental App

## Project Overview

Design a complete UI/UX for a commercial vehicle rental web application. The company is a local Polish business renting out commercial vehicles (cargo vans, passenger vans, car transporters, refrigerated trucks, flatbed trucks). The app serves two audiences: customers booking vehicles online and staff managing the fleet, reservations, and handover protocols.

The app is bilingual: Polish and English.

## Design System

- **Apple-inspired**: minimalist, clean, generous white space, precise typography, subtle shadows
- **Mobile-first**, fully responsive to desktop
- **Color palette**: black/white base with a single accent color (blue recommended, inspired by Apple's system blue). Use color sparingly and intentionally — status indicators, CTAs, active states
- **Typography**: system font stack (SF Pro / Inter), clear hierarchy, no decorative fonts
- **Components**: rounded corners, subtle shadows, card-based layouts
- **Floating navigation bars**: pill-shaped, elevated with shadow, used for vehicle type selectors, section navigation, and mobile bottom nav — inspired by iOS floating tab bars
- **Sticky bottom bar on mobile**: price summary + CTA button, always visible during booking flow
- **Data-driven vehicle cards**: prioritize practical specs (cargo dimensions, payload, seats, transmission, fuel type) over lifestyle imagery. Cards should feel informational, not promotional
- **Filter chips**: horizontal scrollable row for vehicle types, clean toggle states

## Vehicle Types

1. **Cargo Vans** (Furgony)
2. **Passenger Vans** (Busy osobowe)
3. **Car Transporters** (Lawety)
4. **Refrigerated Trucks** (Izotermy)
5. **Flatbed/Tarpaulin Trucks** (Plandeki)

## Vehicle Data Model

Each vehicle displays:
- Brand, model, year
- Photos (gallery)
- Fuel type (petrol/diesel/electric/hybrid)
- Transmission (manual/auto)
- Seats count
- Cargo dimensions (length, width, height in meters)
- Daily rate + monthly rate
- Deposit amount
- Km limit (per day/month)
- Price per additional km

## User Roles

### Customer
- Browse and filter fleet
- View vehicle details
- Submit reservation requests
- Track reservation status (pending/approved/rejected)

### Worker (staff)
- View assigned vehicles with status (available/rented/maintenance)
- See today's pickups and returns at a glance
- Approve or reject pending reservations (with rejection reason)
- Create pickup and return protocols
- View calendar of all vehicles and their bookings

### Admin
- Everything worker can do
- Manage all vehicles (add/edit/remove)
- Manage staff members
- Full dashboard with all vehicles and stats

## Pages & Flows

### Customer-Facing Pages

**1. Homepage**
- Hero section with company value proposition
- Vehicle type selector (floating pill navigation)
- Featured/popular vehicles
- CTA to browse fleet

**2. Fleet Listing**
- Filter chips: vehicle type (floating pill bar)
- Additional filters: capacity (seats), cargo dimensions, dates
- Vehicle cards in a grid/list showing: photo, name, key specs, daily + monthly price
- Results count

**3. Vehicle Detail Page**
- Photo gallery
- Full specs table
- Pricing table (daily rate, monthly rate, deposit, km limit, extra km cost)
- Availability indicator
- "Reserve" CTA button

**4. Reservation Form**
- Selected vehicle summary
- Date picker (from/to)
- Rental type toggle: daily vs monthly
- Customer info: name, email, phone
- Price calculation preview
- Sticky bottom bar with total price + "Submit Reservation" button

**5. My Reservations**
- List of customer's reservations
- Status badges: pending (yellow), approved (green), rejected (red), active (blue), completed (gray), overdue (red)
- Reservation details expandable: vehicle, dates, price, rejection reason if applicable

### Staff/Admin Pages

**6. Worker Dashboard**
- Welcome section with today's date
- Three sections:
  - Assigned vehicles with status indicators
  - Today's pickups and returns (action cards)
  - Pending reservation requests (approve/reject actions)

**7. Reservation Management**
- List/table of all reservations with filters (status, date range, vehicle)
- Each row: customer name, vehicle, dates, status, actions
- Approve button + Reject button (opens modal for rejection reason)

**8. Fleet Management (Admin)**
- Vehicle list/grid with status
- Add/edit vehicle form with all data fields + photo upload
- Assign vehicles to workers

**9. Calendar View**
- Full-width calendar, horizontal timeline
- One row per vehicle
- Colored blocks per reservation (color-coded by status)
- Hover/click to see reservation details
- Filter by vehicle type, worker assignment
- Visual indicator for today's date

**10. Pickup Protocol**
- Step-by-step form:
  1. Select reservation (pre-filled if coming from dashboard)
  2. Record mileage (odometer reading)
  3. Record fuel level
  4. Damage notes (text field)
  5. Photo upload (multiple, with labels: front, back, left, right, interior, damage)
  6. Digital signature pad (customer signs)
  7. Summary review
  8. Confirm — car status changes to "rented"

**11. Return Protocol**
- Same form as pickup, but:
  - Pre-filled with pickup data for comparison
  - Side-by-side display: pickup value vs return value
  - Auto-calculated: km driven, fuel difference
  - Highlight new damage (not present in pickup)
  - Digital signature
  - Confirm — car status changes to "available"
  - If overdue: display overdue duration and applicable late fees

**12. Overdue Returns**
- Auto-flagged list of vehicles not returned by agreed date
- Each entry shows: vehicle, customer, expected return date, days overdue, calculated late fees
- Quick actions: contact customer, extend reservation, mark returned

## Key Interactions

- **Double-booking prevention**: date picker grays out unavailable dates for a given vehicle
- **Real-time price calculation**: as customer selects dates, the estimated cost updates in the sticky bottom bar
- **Status transitions**: reservation flows through pending → approved → active (picked up) → completed (returned) or overdue
- **Overdue auto-detection**: system flags reservations past their return date automatically

## Responsive Breakpoints

- **Mobile** (< 768px): single column, floating bottom nav, sticky price bar, stacked cards
- **Tablet** (768-1024px): two-column grid, side navigation starts appearing
- **Desktop** (> 1024px): full layout, sidebar navigation for admin, multi-column grids, full calendar view

## Deliverables

For each page, provide:
1. Mobile wireframe/layout
2. Desktop wireframe/layout
3. Key component specs (spacing, colors, typography sizes)
4. Interactive states (hover, active, disabled, loading)
5. Status color system for reservations and vehicles
