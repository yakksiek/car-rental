# Fleet page layout parity — Plan Brief

> Full plan: `context/changes/fleet-page-layout-parity/plan.md`
> Research: `context/changes/fleet-page-layout-parity/research.md`
> Design contract: `context/changes/fleet-page-layout-parity/design-contract.md`

## What & Why

The public vehicle detail page (`/fleet/<id>`) diverges from the live design in two visible ways: the booking calendar sits inset with 85px of dead space on each side while every sibling element spans the full width, and the car-information blocks below the photo are structurally different from the design. The page was built in June against an early export and was explicitly excluded from the August restyle that brought the listing to parity, so it has never had a design contract.

## Starting Point

`/fleet` is at parity and closed its own vision gate. The detail page has had two visual commits ever and has no `exact` / `deviation` register. Its calendar is capped at `max-w-[300px]` inside a 470px content box; its spec tiles are 116px tall against the design's 78px; its what's-included row is three white cards with the same check icon repeated, at 87px against the design's 43px. The busy-day greying is the known open item D14, and the design-faithful CSS for it already exists for the staff picker.

## Desired End State

At desktop the calendar fills its widget inside a bordered month frame, with a left caption and square nav buttons grouped right, and busy days read in the design's darker grey with a visible diagonal divider. Below the photo the header sits left and outside the card at desktop while staying centred inside it on mobile, spec tiles are compact, and the what's-included row is a light strip of three bare items with three different icons. The listing popover, landing hero search and staff picker are untouched.

## Key Decisions Made

| Decision                           | Choice                                                 | Why                                                                                                                                              | Source   |
| ---------------------------------- | ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------ | -------- |
| Change shape                       | One change, two shippable tracks                       | Shared research, design source and gate; two folders would duplicate all three                                                                   | Plan     |
| Calendar blast radius              | Opt-in prop on the shared calendar, defaults unchanged | The shared component has four consumers, one with its own pinned contract; opt-in leaves three unaffected by construction rather than by testing | Plan     |
| Calendar detail                    | Bordered frame and left caption with square nav only   | Adopted; weekday abbreviations, outside days and today highlight stay as shipped                                                                 | Plan     |
| Hero                               | Responsive restructure                                 | The mobile board centres the title in a card, the desktop board puts it left and outside; the app applies the mobile treatment everywhere        | Plan     |
| What's-included row                | Bare items, three distinct icons                       | Halves row height and fixes the repeated check, the row's most visible defect                                                                    | Plan     |
| Busy-day fill                      | Adopt D14 now                                          | The darker fill and divider utilities already exist; nearly free while in the calendar                                                           | Plan     |
| Availability strip, subtitle, copy | Not adopted                                            | D4 stands, no trim field in the schema, and the per-day suffix split is documented as deliberate                                                 | Research |
| Verification data                  | Throwaway seeding script                               | The seed has no live bookings, and changing it risks shifting availability counts in existing suites                                             | Plan     |

## Scope

**In scope:** the booking widget's calendar width, frame, caption and nav; the busy-day fill and divider; the detail page hero, spec tiles and what's-included row; an opt-in cell-shape prop on the shared calendar.

**Out of scope:** the `/fleet` listing restyle; the widget's price header, date fields, breakdown and CTA chrome; the availability strip; a model subtitle; a breadcrumb; copy changes; seed file changes.

## Architecture / Approach

Two tracks that share no files. Track A touches `ui/calendar.tsx` additively plus `BookingWidget.tsx`; Track B touches `VehicleDetail.astro` and one icon module. The shared calendar change is a new opt-in prop with unchanged defaults, so `FilterBar`, `HeroSearch` and `ManualReservationCalendar` keep today's rendering without needing rework. A closing phase verifies those three and reconciles the contract.

## Phases at a Glance

| Phase                            | What it delivers                                               | Key risk                                                                                       |
| -------------------------------- | -------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| 1. Calendar fills its container  | Full-width calendar, month frame, left caption, square nav     | Caller class slots replace rather than merge, so overrides can silently drop default utilities |
| 2. Busy-day treatment (D14)      | Darker fill plus diagonal divider, matching the staff picker   | The two surfaces paint the gradient on different elements; the selected range must still win   |
| 3. Hero restructure              | Header left and outside the card at desktop, centred on mobile | The `lg` boundary can orphan padding or produce a double card                                  |
| 4. Spec tiles                    | Compact tiles, 116px down to about 78px                        | Long cargo values truncating                                                                   |
| 5. What's-included row           | Bare strip, three distinct icons, 87px down to about 43px      | Notes wrapping at narrow widths                                                                |
| 6. Regression sweep and sign-off | Three untouched calendars verified, contract reconciled        | Nothing about busy days is observable without seeding first                                    |

**Prerequisites:** a dev server for this worktree on its own port, the local Supabase stack running, and the design harness available for rendering the boards.
**Estimated effort:** roughly two to three sessions across six phases.

## Open Risks & Assumptions

- The shared calendar's caller `classNames` slots replace the built-in ones outright. Phase 1 overrides must restate any default utility that is still wanted, or styling will regress in ways type checking cannot catch.
- The staff picker's cell values are pinned by the S-12a contract. The opt-in prop must leave its rendering byte-identical, which Phase 6 verifies rather than assumes.
- The today highlight stays, and it shares its pink with in-range days. This is a recorded deviation, not an oversight, but it may read as ambiguous once cells widen.
- The seed's date rot is not fixed by this change. Anyone verifying locally must seed forward-dated bookings first or conclude the legend is missing.

## Success Criteria (Summary)

- The calendar's left and right edges align with the date fields and the CTA, with no dead space
- Busy and changeover days are legible at a glance, with the divider visible
- The car-information blocks below the photo match the design boards at 390, 834 and 1440
- The listing, landing and staff calendars render exactly as they did before
