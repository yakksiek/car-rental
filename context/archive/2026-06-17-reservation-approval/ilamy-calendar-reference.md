# `@ilamy/calendar` — Implementation Reference

> **Source:** Context7 MCP (`/kcsujeet/ilamy-calendar`, 511 snippets), fetched 2026-06-17.
> Companion to `calendar-component-research.md` (the why). This is the verified API surface (the how).
> **Verify against the installed version** — see the CSS note below; Context7 indexes a mix of doc versions.

## Install

```bash
npm install @ilamy/calendar
# peer deps (React 19+, Tailwind 4+):
npm install react react-dom tailwindcss tailwindcss-animate
```

## Tailwind v4 wiring (required)

Tailwind v4 ignores `node_modules`, so point it at ilamy's dist or its classes are never generated:

```css
/* in our global stylesheet, path relative to the CSS file */
@import 'tailwindcss';
@source "../node_modules/@ilamy/calendar/dist";
```

⚠️ **CSS-import discrepancy (verify at install):** the live GitHub README states the package **ships no
CSS** and styles purely via shadcn token classes (`bg-background`, `bg-primary`, `border-border`, …) —
which is ideal for us (it inherits `design-system.md`). One Context7-indexed README snippet still shows
`import '@ilamy/calendar/dist/index.css'`. This is version drift. After `npm install`, check whether
`dist/index.css` exists; if it does not, drop the import and rely on shadcn tokens + the `@source` line.

## dayjs setup (required — the lib uses dayjs for all dates)

```ts
import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc'
import timezone from 'dayjs/plugin/timezone'
import isSameOrAfter from 'dayjs/plugin/isSameOrAfter'
import isSameOrBefore from 'dayjs/plugin/isSameOrBefore'

dayjs.extend(utc)
dayjs.extend(timezone)
dayjs.extend(isSameOrAfter)
dayjs.extend(isSameOrBefore)
```

For Polish: pass `locale="pl"` + `timezone="Europe/Warsaw"`, and supply a full `translations` object
(`Translations` type) for the UI strings.

## Astro / Cloudflare integration

Render as a React island with **`client:only="react"`** (admin-only, interactive) — never SSRs in
`workerd`, sidestepping edge-runtime concerns. Per CLAUDE.md, rewrite any `@/` imports to relative paths.

## Components

- `IlamyCalendar` — standard month/week/day/year calendar.
- `IlamyResourceCalendar` — resource rows (extends `IlamyCalendarProps`); **vehicle = resource**.
  Note: `'year'` view is not supported in resource mode.

Neither component accepts `children`. To reach calendar state from inside, use the context hook from a
component passed via `headerComponent` / `renderEvent` / `renderResource` / `renderEventForm`.

## Key types

```ts
interface CellClickInfo {
  start: dayjs.Dayjs
  end: dayjs.Dayjs
  resourceId?: string | number
  allDay?: boolean
}

// CalendarEvent (observed fields): id, title, start, end, uid,
//   resourceId?, color?, backgroundColor?
//   start/end accept ISO strings ('2026-05-01T10:00:00Z') OR dayjs objects.
// Other exported types: Resource, CalendarView ('month'|'week'|'day'|'year'),
//   Translations, BusinessHours.
```

## Props (IlamyCalendar)

| Prop | Type | Notes |
| --- | --- | --- |
| `events` | `CalendarEvent[]` | The data to render. |
| `initialView` | `CalendarView` | default `'month'`. |
| `initialDate` | date | starting date. |
| `firstDayOfWeek` | `'sunday' \| 'monday'` | use `'monday'` for PL. |
| `onCellClick` | `(info: CellClickInfo) => void` | **empty-slot click → predefined time.** |
| `onEventClick` | `(event: CalendarEvent) => void` | open existing reservation. |
| `onEventAdd` | `(event) => void` | fired on create. |
| `onEventUpdate` | `(event) => void` | fired on drag/resize/edit. |
| `onEventDelete` | `(eventId or event) => void` | ⚠️ signature varies by version — verify installed types. |
| `onViewChange` | `(view) => void` | |
| `onDateChange` | `(date, range: {start,end}) => void` | use `range` to fetch the visible window. |
| `locale` / `timezone` / `translations` | | i18n (PL). |
| `slotDuration` | minutes | time-grid granularity. |
| `businessHours` | `BusinessHours \| BusinessHours[]` | + `hideNonBusinessHours`. |
| `disableCellClick` / `disableEventClick` / `disableDragAndDrop` | `boolean` | gate interactions (e.g. read-only roles). |
| `renderEvent` / `renderEventForm` / `headerComponent` / `renderCurrentTimeIndicator` | render fns | custom UI; can use the context hook. |
| `dayMaxEvents`, `eventSpacing`, `stickyViewHeader`, `hiddenDays`, `hideExportButton`, `classesOverride` | | layout/UX tuning. |

`IlamyResourceCalendar` adds: `resources: Resource[]`, `renderResource`, and `onCellClick` returns `resourceId`.

## Context API — `useIlamyCalendarContext()` / `useIlamyResourceCalendarContext()`

**State:** `currentDate`, `view`, `events`, `isEventFormOpen`, `selectedEvent`, `selectedDate`,
`firstDayOfWeek`, `resources`, `businessHours`.

**CRUD:** `addEvent(event)`, `updateEvent(eventId, updates: Partial<CalendarEvent>)`,
`deleteEvent(eventId)`, `getEventsForResource(resourceId)` (resource only).

**Navigation:** `setCurrentDate`, `selectDate`, `setView`, `nextPeriod`, `prevPeriod`, `today`.

**Form:** `openEventForm(eventData?: Partial<CalendarEvent>)`, `closeEventForm()`.

## The target interaction: click empty slot → prefilled reservation form

```tsx
const handleCellClick = (info: CellClickInfo) => {
  const { start, end, resourceId, allDay } = info  // dayjs times from the clicked cell
  openEventForm({ start, end, resourceId, allDay }) // or open our own shadcn Dialog form
}

<IlamyResourceCalendar
  resources={vehicles}        // each vehicle as a Resource row
  events={reservations}       // mapped from Supabase
  initialView="week"
  firstDayOfWeek="monday"
  locale="pl"
  timezone="Europe/Warsaw"
  onCellClick={handleCellClick}
  onEventClick={openReservation}
/>
```

## Data-binding pattern (Supabase)

The calendar is effectively controlled via `events` + the `on*` callbacks. Plan:
1. Load reservations for the visible range (SSR initial + refetch on `onDateChange(date, range)`).
2. Map `reservation → CalendarEvent` (`start`/`end` from pickup/return; `resourceId = vehicle_id`).
3. On `onCellClick`, prefill our reservation form with `start`/`end`/`resourceId`; POST through the
   existing API-route + overlap-rule path (do **not** trust the client; the server EXCLUDE constraint
   remains the source of truth).
4. On `onEventUpdate` (drag/resize), PATCH and re-validate against the overlap rule; revert on 409.

## Open items to confirm during the spike

- `dist/index.css` present or not (CSS note above).
- Exact `CalendarEvent` shape from the installed `.d.ts` (required vs optional fields, `uid`).
- `onEventDelete` callback signature (`eventId` vs `event`) in the installed version.
- Mobile layout density on a real phone vs. screen `22-admin-mobile-calendar.jpg`.
