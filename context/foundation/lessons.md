# Lessons Learned

> Append-only register of recurring rules and patterns. Re-read at start by /10x-frame, /10x-research, /10x-plan, /10x-plan-review, /10x-implement, /10x-impl-review.

## Read the design system before building any UI slice

- **Context**: Any user-facing slice (a UI screen or component), during both planning and implementation phases.
- **Problem**: Neither /10x-plan nor /10x-implement auto-discovers the design system, so UI gets built with no design reference — wrong tokens, spacing, structure, or copy.
- **Rule**: For any user-facing slice, read context/foundation/design-system.md first, then open only the matching screenshot(s) and source JSX for that slice. Build against the live tokens in src/styles/global.css; never import from context/foundation/design/ (it's a static prototype). Polish UI copy is canonical.
- **Applies to**: plan, implement

## Distill UI screenshots into a textual design contract at plan time

- **Context**: Any UI slice that maps to design screenshot(s), across the plan → implement handoff.
- **Problem**: PNG screenshots are vision tokens and cost far more context than text. When the plan only references screen *numbers*, /10x-implement re-opens the PNG for every slice (and on every resume), burning the image cost repeatedly. The image is already on screen during /10x-plan — that's the cheapest moment to convert it.
- **Rule**: Pay the image cost once, at plan time. While /10x-plan views a screen, distill it into a compact **textual design contract** in that phase — layout structure, spacing/token intent, the component breakdown, and the canonical Polish copy strings — and name the exact screenshot path (e.g. `context/foundation/design/screenshots/03-...png`). /10x-implement then builds from the contract text and does NOT open the PNG. If implement genuinely must view an image, delegate it to a subagent (Explore/general-purpose) and consume only the returned text description — vision tokens stay in the subagent's context, never the main loop.
- **Applies to**: plan, implement

## Use react-hook-form for larger form islands

- **Context**: Any React (TSX) form island with many fields (roughly 8+), e.g. `src/components/fleet/VehicleForm.tsx` (~18 fields). Not small forms like `ReservationForm`.
- **Problem**: The plain `useState` + manual `fieldErrors` map pattern gets boilerplate-heavy and re-render-noisy as field count grows. A misconception that "react-hook-form isn't recommended with Astro" pushes people to keep hand-rolling state — but RHF runs fine inside an Astro island (it's just client React; the only nuance is island bundle size).
- **Rule**: For larger/complex form islands, prefer `react-hook-form` + `@hookform/resolvers` (`zodResolver(sharedSchema)`) over plain `useState`; keep the zod schema as the single validation source for client + API. Reserve plain `useState` for small forms. For non-interactive forms that don't need an island at all, the Astro-native choice is a plain `<form method="POST">` to an API route (works without JS).
- **Applies to**: plan, implement, impl-review
