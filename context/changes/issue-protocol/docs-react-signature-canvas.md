---
topic: react-signature-canvas API reference for the issue-protocol signature field (FR-006)
researcher: Claude (Context7 — /agilgur5/react-signature-canvas)
change_id: issue-protocol
type: external
date: 2026-06-17
---

# Docs — react-signature-canvas (S-05)

> External reference. Source: Context7 (`/agilgur5/react-signature-canvas`), fetched 2026-06-17.
> Companion to `research-signature-libraries.md` (which selected this library as the lead).
> Scope: the concrete API surface `/10x-plan` needs to wire the touch signature field — props, ref methods, and the stack-specific gotchas.

## What it is

A thin React wrapper (<150 LoC) around [`szimek/signature_pad`](https://github.com/szimek/signature_pad). Handles HiDPI/retina scaling internally and passes all `signature_pad` options through as props.

- Install: `npm i react-signature-canvas` (add `@types/react-signature-canvas` if types aren't bundled).
- **Must render in a `client:only="react"` island** — canvas/`window` don't exist in the Workers SSR runtime (see `research-signature-libraries.md` §Stack-wide gotcha).

## Basic usage with a ref

```tsx
import { useRef } from "react";
import SignatureCanvas from "react-signature-canvas";

function SignaturePad() {
  const sigCanvas = useRef<SignatureCanvas>(null);

  const clear = () => sigCanvas.current?.clear();

  const save = () => {
    if (sigCanvas.current?.isEmpty()) return; // guard: nothing drawn
    // trimmed = cropped to ink bounds; ideal for storage + email
    const dataUrl = sigCanvas.current!.getTrimmedCanvas().toDataURL("image/png");
    // → upload dataUrl to Supabase Storage / send to API
  };

  return (
    <SignatureCanvas
      ref={sigCanvas}
      penColor="black"
      canvasProps={{ className: "h-48 w-full rounded border touch-none" }}
    />
  );
}
```

## Props (passed through to signature_pad)

| Prop | Purpose |
|---|---|
| `penColor` | Ink color (e.g. `"black"`) |
| `backgroundColor` | Canvas fill — **set to `"#fff"`** if exporting JPEG or compositing onto a PDF, else background is transparent |
| `canvasProps` | Attributes for the `<canvas>`: `width`, `height`, `className`, etc. |
| `minWidth` / `maxWidth` / `dotSize` | Stroke thickness range / single-dot size |
| `velocityFilterWeight` | Stroke smoothing |
| `throttle` | Throttle point collection (ms) |
| `clearOnResize` | Whether the canvas clears on resize (default `true` — see gotcha #1) |
| `onBegin` / `onEnd` | Stroke start/end callbacks (e.g. enable a Save button) |

## Ref API methods

- `clear()` — reset the pad
- `isEmpty()` — validate before save
- `toDataURL(type?, encoderOptions?)` — export full canvas (`"image/png"` default, `"image/jpeg"`, `"image/svg+xml"`)
- `getTrimmedCanvas()` — returns a canvas cropped to the drawn area; chain `.toDataURL()`
- `getCanvas()` — the raw `<canvas>` element
- `fromDataURL(dataUrl, options?)` — restore a saved signature image
- `toData()` / `fromData(pointGroups)` — export/restore as point arrays (vector; smaller than PNG; useful for resize redraw)
- `on()` / `off()` — enable/disable drawing

## Gotchas that matter for the mobile NFR

1. **Resize wipes the signature.** `clearOnResize` defaults to `true`, so an orientation change on phone/tablet clears the drawing. Set `clearOnResize={false}`, but note signature_pad needs a manual redraw after a canvas resize — simplest robust patterns: keep a fixed-pixel `canvasProps` size and let CSS scale the element, or capture (`toData`) before resize and restore (`fromData`) after.
2. **`touch-none` on the canvas** (Tailwind `touch-action: none`) stops the page scrolling while the user signs — important on touch devices.
3. **Use `getTrimmedCanvas()` for output** so the emailed/stored image is cropped to the ink, not a mostly-empty rectangle.
4. **PNG over JPEG/SVG for email** — raster PNG renders most reliably in email clients (matches the research recommendation). Transparent background is fine for PNG; only JPEG needs a solid `backgroundColor`.
5. **React 19**: `ref` works as shown; the component still uses class-component `ref` semantics (no `ref` callback needed). v1.0.7 fixed the `ERESOLVE` peer-dep against `react@19`.

## Notes / limits of this doc

Context7 exposes only three snippets for this wrapper; the remaining option surface lives in the underlying `szimek/signature_pad` and is reflected in the props table above as pass-through options.

## Sources

- Context7: `/agilgur5/react-signature-canvas` (README + `src/index.tsx`)
- Underlying engine: https://github.com/szimek/signature_pad
