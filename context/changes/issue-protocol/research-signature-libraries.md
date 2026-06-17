---
topic: Signature-capture library selection for the issue-protocol digital-signature field (FR-006)
researcher: Claude (external research via exa.ai)
change_id: issue-protocol
type: external
date: 2026-06-17
---

# Research — Signature-capture libraries (S-05)

> External research. Source: exa.ai web search, 2026-06-17.
> Scope: signature-capture library options for the issue-protocol's digital-signature field (FR-006), compatible with the FleetRent tech stack.

## Question

Which signature-capture library should S-05 use for the touch/tablet digital signature, given the stack in `context/foundation/tech-stack.md`?

## Stack constraints (compatibility criteria)

- **Frontend:** Astro 6 SSR + React 19 islands + Tailwind 4 + shadcn/ui, TypeScript.
- **Runtime:** Cloudflare Workers (`@astrojs/cloudflare`), full SSR (`output: "server"`).
- **S-05 NFR:** touch signature must work on phone/tablet **at the vehicle**; output is stored (Supabase Storage) and embedded in the auto-emailed protocol (FR-008).

### Stack-wide gotcha (applies to every option)

All candidates are **canvas/DOM, browser-only** libraries. `canvas`/`window` do not exist in the Workers SSR runtime, so the signature component **must** render inside a React island as **`client:only="react"`** (or `client:load`) and never be server-rendered. This is the real compatibility line — not the library choice itself. Repo convention: extract the drawing logic to a hook under `src/components/hooks/`.

## Options

| Library | What it is | React 19 | Maintenance | Export | Notes |
|---|---|---|---|---|---|
| **`react-signature-canvas`** (agilgur5) | Thin (<150 LoC) React wrapper over `signature_pad` | ✅ peerDep widened to React 19 in **v1.0.7** (Jan 2025); native TS in 1.1.0-alpha | ⚠️ Snyk flags **"Inactive"** (no release ~12mo) — low risk given how thin it is over an active core | PNG/JPEG/SVG, `getTrimmedCanvas()` to crop whitespace | **~1M weekly downloads**, de-facto standard, 372 dependents |
| **`signature_pad`** (szimek) | The underlying engine, framework-agnostic | N/A (no React dep → no version risk) | ✅ Active, zero deps | PNG/JPEG/SVG + point-group data | Pointer Events (mouse/touch/pen unified), Bézier smoothing. Wrap in ~30-line `useSignaturePad` hook + island |
| **`@uiw/react-signature`** | React component built on `perfect-freehand` | ✅ (uiw ecosystem tracks current React) | ✅ Active (uiw org) | SVG-first | Pressure/velocity strokes; SVG output is crisp but extra work if you need raster PNG for email |
| **`@tinyforged/signature-kit-react`** | React wrapper over `signature_pad`, bundled | ✅ | 🆕 New (2026) | PNG/JPEG/SVG/Blob/File + **undo/redo**, trim, DPI-aware | Feature-rich; younger/less-proven |
| **`react-simple-signature`** | Minimal React 19 component | ✅ (built on React 19/Vite/Vitest) | 🆕 New (2025) | Blob (PNG/JPEG) | Smallest API; emits `Blob` directly (convenient for upload). Low adoption |

Also seen but too new / low-adoption to bet a field-critical form on: `@mshafiqyajid/react-signature` (headless hook), `@melihbirim/signature-pad` (draw + type modes).

## Recommendation

Given `main_goal: speed`, solo capacity, and that the UI is owned via shadcn/Tailwind:

1. **Lead: `react-signature-canvas`** — fastest path. Massive adoption, React 19 supported, bring-your-own Clear/Undo (shadcn `Button`); `getTrimmedCanvas().toDataURL("image/png")` produces exactly what's needed to push to Supabase Storage and inline in the email. Only knock is the "inactive" maintenance flag, mild because it's a <150-line shim over the actively-maintained `signature_pad`.

2. **Fallback (zero dependency risk): `signature_pad` directly** — skip the wrapper if the maintenance flag is a concern. Core is active, zero-dependency; a small `useSignaturePad` hook (init on a `<canvas ref>`, expose `clear()`/`toDataURL()`/`isEmpty()`) removes all React-version coupling for ~30 extra lines and fits the `src/components/hooks/` convention.

Both export **PNG** (raster — renders more reliably in email than SVG) and run identically inside a `client:only` island.

## Plan-time checks (not blockers)

- Confirm the React 19 peer-dep resolves cleanly under npm (v1.0.7 specifically fixed the `ERESOLVE` against `react@19`).
- If ever exporting JPEG, set a **solid `backgroundColor`** on the pad (transparent bg → black box). PNG keeps transparency.
- Render the pad island `client:only="react"`; do not SSR it (Workers has no `canvas`/`window`).

## Sources

- `react-signature-canvas` — https://www.npmjs.com/package/react-signature-canvas · React 19 peerDep PR https://github.com/agilgur5/react-signature-canvas/pull/116 · Snyk maintenance https://security.snyk.io/package/npm/react-signature-canvas
- `signature_pad` — https://github.com/szimek/signature_pad
- `@uiw/react-signature` — https://uiwjs.github.io/react-signature/
- `@tinyforged/signature-kit` — https://github.com/TinyForged/signature-kit
- `react-simple-signature` — https://github.com/jamesmckeon/react-simple-signature
