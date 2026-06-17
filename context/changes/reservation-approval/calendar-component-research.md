# Calendar Component Research — admin reservation calendar

> **Status:** scoped into **S-03 reservation-approval** (decided 2026-06-17). Library chosen: `@ilamy/calendar`.
> **Date:** 2026-06-17 · **Method:** exa.ai web search + fetch (Nov 2025 – Mar 2026 sources).
> **Scope decision:** The **read/visualization** calendar (reservations on a mobile + desktop calendar;
> designs `22-admin-mobile-calendar.jpg` + `16-admin-desktop-calendar.png`) is **in scope for S-03** as a
> complementary surface to the pending queue. The **click-empty-slot → manual reservation creation** is
> **explicitly out of scope** (future work, not in the roadmap) and must not be built in this slice.

## The ask

A detailed calendar layout on **mobile and desktop** to view reservations. (Deferred future work, not
this slice: **click an empty slot → open a reservation form prefilled with the clicked time**.) Component
must fit the current stack (`tech-stack.md`): Astro 6 SSR + React 19 islands + Tailwind CSS 4 +
shadcn/ui, deployed to Cloudflare Workers (`workerd`).

## Recommendation: `@ilamy/calendar`

The only library found that matches the stack on every axis **and** treats click-to-create as a
first-class API.

- **Stack-native:** built for React 19 + Tailwind CSS 4 + shadcn/ui. Peer deps: `react`, `react-dom`,
  `tailwindcss@4`, `tailwindcss-animate`. Ships **zero CSS** — renders with shadcn token classes
  (`bg-background`, `bg-primary`, `border-border`, …), so it inherits our `design-system.md` palette
  instead of fighting it.
- **License/size:** MIT; ~40 KB min / ~13 KB gzip core; plugins opt-in (recurrence, agenda).
- **Views:** Month / Week / Day / Year; responsive desktop/tablet/mobile; drag-and-drop via `@dnd-kit`;
  dayjs timezones; 100+ locales.
- **Has an in-repo Astro example** (also Next, Vite).
- **Maturity:** young — first published Jul 2025, ~290★, ~1.5K downloads/wk, one primary maintainer
  (`kcsujeet`). Actively developed (PRs landing through Apr 2026; 100% test coverage on date logic).

### Click-to-create is a first-class API (confirmed from docs)

```tsx
// onCellClick fires on empty-cell click, with the clicked time range
const handleCellClick = (info: CellClickInfo) => {
  const { start, end, resource, allDay } = info;   // start/end are dayjs
  openEventForm({ start, end, resourceId: resource?.id, allDay });
};

<IlamyCalendar events={events} onCellClick={handleCellClick} />
```

- `onCellClick(info)` → `{ start, end, resource?, allDay? }` — the predefined time from where the user clicked.
- `useIlamyCalendarContext()` exposes `openEventForm(eventData?)` (prefill a form) plus
  `addEvent` / `updateEvent` / `deleteEvent`.
- **`IlamyResourceCalendar`** variant: each **vehicle = a resource row**; `onCellClick` returns the
  `resourceId`. Maps cleanly onto a fleet calendar where you click an empty slot under a specific van.

### Integration notes for our stack

- Render as a React island with **`client:only="react"`** (admin-only, interactive) — sidesteps
  SSR-in-`workerd` on Cloudflare entirely; the calendar never server-renders.
- Tailwind v4 ignores `node_modules`: add `@source "../node_modules/@ilamy/calendar/dist";` to the stylesheet.
- Per CLAUDE.md: rewrite any generated `@/` imports to relative paths.

## The one real risk + fallback

`@ilamy/calendar` is a **bus-factor bet** (young, single maintainer). If longevity outweighs
design-system fit, fall back to **`react-big-calendar`**:

- 500K+ downloads/wk, MIT, React 19 support since Feb 2025. Same interaction via
  `onSelectSlot` → `{ start, end, slots }`.
- Trade-offs: heavy global SASS styling that won't match Tailwind/shadcn (manual theming), and needs a
  date-fns/dayjs `localizer` adapter wired up.

## Comparison

| | `@ilamy/calendar` | `react-big-calendar` | Schedule-X | FullCalendar |
| --- | --- | --- | --- | --- |
| Stack fit (R19 + TW4 + shadcn) | ✅ native | ⚠️ manual theming | ⚠️ has a shadcn theme | ⚠️ TW support "coming" |
| Click empty slot → time | ✅ `onCellClick` | ✅ `onSelectSlot` | ⚠️ interactive modal is **premium** | ✅ `dateClick`/`select` |
| License for what we need | MIT, all free | MIT, all free | drag-to-create/modal = paid | core free; premium views paid |
| API style | declarative props | declarative props | plugin config | imperative (ref) |
| Maturity | young (2025) | mature | mid (~2.2K★) | very mature |

**Avoid for this use case:** Schedule-X (the interactive event modal + drag-to-create — exactly what we
want — are premium plugins behind an authed registry); FullCalendar (imperative API, Tailwind support
not yet shipped, heavier than needed).

## Sources (exa)

- ilamy docs — Calendar API / `onCellClick` + `CellInfo`: https://ilamy.dev/docs/components/calendar/
- ilamy docs — Resource Calendar (room/vehicle-as-resource booking): https://ilamy.dev/docs/components/resource-calendar/
- ilamy docs — `useIlamyCalendarContext` (`openEventForm`): https://ilamy.dev/docs/components/use-ilamy-calendar-context/
- ilamy repo: https://github.com/kcsujeet/ilamy-calendar · npm: https://www.npmjs.com/package/@ilamy/calendar
- react-big-calendar `onSelectSlot` (Builder.io 2025-08): https://www.builder.io/blog/best-react-calendar-component-ai
- Schedule-X premium split (ReactLibs / schedule-x.dev): https://reactlibs.dev/articles/schedule-x/ · https://schedule-x.dev/
- JS calendar UI survey (Mar 2026): https://research.modelcitizendeveloper.com/survey/1-221/

## Decision

**Chosen: `@ilamy/calendar`** (2026-06-17). Verified API surface + setup captured in
`ilamy-calendar-reference.md` (fetched via Context7).

## Next step (if pursued)

Spike a minimal `@ilamy/calendar` island wired to Supabase reservations (vehicles as resource rows,
`onCellClick` → reservation form) to validate fit before committing to a plan.
