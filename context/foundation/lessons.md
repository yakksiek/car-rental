# Lessons Learned

> Append-only register of recurring rules and patterns. Re-read at start by /10x-frame, /10x-research, /10x-plan, /10x-plan-review, /10x-implement, /10x-impl-review.

## Read the design system before building any UI slice

- **Context**: Any user-facing slice (a UI screen or component), during both planning and implementation phases.
- **Problem**: Neither /10x-plan nor /10x-implement auto-discovers the design system, so UI gets built with no design reference — wrong tokens, spacing, structure, or copy.
- **Rule**: For any user-facing slice, read context/foundation/design-system.md first, then open only the matching screenshot(s) and source JSX for that slice. Build against the live tokens in src/styles/global.css; never import from context/foundation/design/ (it's a static prototype). Polish UI copy is canonical.
- **Applies to**: plan, implement
