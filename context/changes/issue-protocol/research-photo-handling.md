---
topic: Photo-handling optimization for the issue-protocol photos field (FR-006/FR-007)
researcher: Claude (external research via exa.ai)
change_id: issue-protocol
type: external
date: 2026-06-17
---

# Research — Photo handling & optimization (S-05)

> External research. Source: exa.ai web search, 2026-06-17 (Supabase Storage docs dated 2026-06-16, Cloudflare Images docs dated 2026-05/06, mobile-capture best-practice articles 2026).
> Scope: where to optimize protocol photos — at capture/upload (client), in Supabase Storage, or at render — given the FleetRent stack. Reused by S-06 (return-protocol-comparison).

## Question

Employees capture protocol photos on a phone/tablet **at the vehicle**, upload them, and the photos are then (a) shown in the protocol detail view and (b) embedded in the auto-emailed protocol (FR-008). Modern phone photos are 3–12 MB. Where should optimization happen — client-side before upload, on Supabase, at render time, or some combination?

## Short answer

**Not either/or — the three layers do different jobs, and for THIS app the decisive win is client-side, at capture, before upload.** Render-time/Supabase transforms optimize *delivery*; they do nothing for the *upload*, which is the actual field-usability risk (cellular, at the vehicle, NFR). Recommendation:

1. **Mandatory — client-side compress + EXIF-normalize before upload.** Primary win. Free, no plan dependency, fixes the upload bottleneck and the sideways-photo bug in one place.
2. **Optional second layer — render-time resizing for thumbnails.** Likely *not needed for v1's volume* (a handful of protocols, a few photos each). If wanted, two options below; otherwise just serve the single normalized image.
3. **Email path is special — always generate a baseline JPEG.** Email clients don't run JS and render WebP/AVIF/HEIC unreliably; the emailed protocol must use JPEG/PNG, so a transform-on-the-fly URL is the wrong tool there.

Do **not** attempt heavy server-side processing inside the Worker (no `sharp`/libvips; Workers CPU/memory limits). The only sanctioned server-side transform path on this stack is the Cloudflare Images binding (`env.IMAGES`), not a native image lib.

## Stack constraints

- **Runtime:** Astro 6 SSR on **Cloudflare Workers** (`@astrojs/cloudflare`). No Node native modules → `sharp`/ImageMagick are not available in-process.
- **Storage:** Supabase Storage (S3-compatible), stood up for the first time in S-05.
- **Plan reality (CONFIRMED 2026-06-17):** the project is on the **Supabase Free plan**, so **Image Transformations are NOT available** (Pro-only). Layer 2 (Supabase on-the-fly resize) is off the table unless the plan is upgraded. Free plan also caps storage at 1 GB / egress at 5 GB — another reason uncompressed 3–12 MB photos are untenable and client-side compression is the only size-control lever. The only render-time transform option on this stack is therefore **Cloudflare Images**.
- **Two consumers:** protocol detail view (browser, EXIF-aware, WebP-capable) **and** auto-email (not EXIF-aware, JPEG-safe only).

## The three layers compared

| Layer | What it optimizes | Cost / dependency | Fit for S-05 |
|---|---|---|---|
| **Client-side (canvas / `browser-image-compression`)** | Upload payload + stored size; bakes EXIF orientation into pixels; can transcode HEIC→JPEG/WebP | Free; ~1 s for a 10 MB photo in a Web Worker | **Essential.** Only layer that fixes the upload (the NFR risk). 10 MB → ~700 KB. |
| **Supabase Storage transforms** (on-the-fly URL resize) | Delivery only (resize, quality, auto-WebP via `?width=&quality=`) | **Pro plan only**, $5/1k origin images over quota; max 25 MB / 50 MP source; **HEIC accepted as source but not as output** | Optional. Nice for responsive thumbnails; adds a paid dependency. Does nothing for upload. |
| **Cloudflare Images** (Worker `env.IMAGES` binding or `cf.image` fetch) | Delivery + optional transform-then-store; AVIF/WebP output | $0.50/1k unique transforms (remote); already on Workers so binding is native; free in local `wrangler dev` | Optional. Strongest if you later want server-controlled variants without leaving the stack. |

## Why client-side is the primary win here (evidence)

- **Upload bandwidth is the real bottleneck.** "A 5 MB image over 4G costs the user time and data, while a pre-compressed 500 KB equivalent feels instant." Field employees on cellular at the vehicle are exactly this case. Render-side transforms can't help — the big bytes already crossed the network. One report measured the upload step dropping from ~1000 ms (client→serverless→Sharp→storage) to ~200–400 ms once compression moved to the client and the server just did a straight upload.
- **Keeps you in Supabase's simple upload path.** Standard uploads are "ideal for files not larger than 6 MB"; above that Supabase recommends TUS resumable uploads. Compressing to ~1 MB client-side avoids needing resumable uploads at all.
- **No plan dependency.** Client-side compression is free and works on any Supabase plan; Supabase transforms gate behind Pro + per-image billing.
- **EXIF orientation must be normalized at capture regardless.** Phone sensors store pixels in native (usually landscape) orientation plus an EXIF "please rotate me" tag. Galleries honor it; **email clients and many web contexts do not** → sideways photos. The fix is to *bake* rotation into pixels client-side (canvas / `expo-image-manipulator`-style), not to rely on downstream EXIF-awareness. Doing this client-side also strips GPS/EXIF PII, which aligns with the PRD guardrail ("protocol photos must not be accessible to unauthorized users").
- **HEIC.** iPhones default to HEIC. Supabase accepts HEIC as a *source* but **cannot output it**, and email clients can't render it. Transcoding to JPEG/WebP client-side (canvas `toBlob`) sidesteps this everywhere downstream.

### Recommended client-side library

- **`browser-image-compression`** — ~3.2k★, actively maintained, TypeScript, runs canvas work in a Web Worker (`useWebWorker: true`), `maxSizeMB` + `maxWidthOrHeight` options, progress callback, `preserveExif`. Lazy-import it (`await import(...)`) so it's not in the island's initial bundle.
  - Suggested options: `{ maxWidthOrHeight: 1600, maxSizeMB: 1, fileType: 'image/jpeg', useWebWorker: true }` — caps canvas memory (an 8000×6000 photo allocates ~192 MB RGBA and can crash mobile Safari), forces JPEG output (PNG compresses poorly for photos), and yields email-safe JPEGs.
  - Alternative: hand-rolled canvas resize→`toBlob('image/webp', 0.85)` with JPEG fallback (zero deps) — fine if you'd rather not add a dependency, but you re-implement orientation/memory handling yourself.
- Gotcha: Safari < 16.4 lacks `OffscreenCanvas`, so the worker falls back to the main thread — keep a loading state and a `file.size` sanity cap to reject pathological inputs.

## Render-time layer — only if you want thumbnails

For v1's volume (a few protocols, a few photos each), the simplest correct design is: **store one normalized ~1600px JPEG per photo and serve it directly** (with a long `Cache-Control`). Add a render-time transform layer only if grids feel heavy:

- **If on Supabase Pro:** use `getPublicUrl(..., { transform: { width, quality } })` for thumbnails; it auto-serves WebP to capable browsers and "never resizes bigger than the original." Watch the per-origin-image billing.
- **If staying off Pro / want it in-stack:** Cloudflare Images via the Worker `env.IMAGES` binding or a `cf.image` fetch on a dedicated `/img/*` path (keep it separate from the originals path to avoid request loops). Pre-generate + store common variants to cap cost (both vendors' docs recommend pre-generating over transforming on every request).

## Email path — handle explicitly (FR-008)

Email is the constraint that rules out "just use transform URLs everywhere":

- Email clients don't execute JS and render WebP/AVIF/HEIC inconsistently → **embed/attach JPEG (or PNG)**.
- Because client-side step (1) already produces a ~1 MB JPEG, the email can reuse that artifact directly (attach, or a CID-embedded image), or a smaller derived JPEG. No separate transform service required for email.

## Decision checklist for /10x-plan

- [x] Confirm prod Supabase plan — **Free** (confirmed 2026-06-17). Supabase transforms unavailable; thumbnails, if wanted, come from Cloudflare Images only.
- [ ] Adopt client-side compress + orientation-bake + HEIC→JPEG as the upload contract (target ≤1 MB / ≤1600px). This is the load-bearing decision.
- [ ] Decide thumbnails: serve-the-normalized-original (simplest, recommended for v1) vs Supabase-transform (Pro) vs CF Images binding.
- [ ] Email uses a JPEG variant, never a WebP/transform URL.
- [ ] Set a long `Cache-Control` on served photos; pre-generate variants if a transform layer is added.

## Sources

- Supabase — Storage Image Transformations (resize on-the-fly, Pro-only, formats, 25 MB/50 MP limits): https://supabase.com/docs/guides/storage/serving/image-transformations
- Supabase — Manage Image Transformations usage / pricing ($5 per 1k origin images, optimize-usage tips): https://supabase.com/docs/guides/platform/manage-your-usage/storage-image-transformations
- Supabase — Standard Uploads (6 MB simple-upload guidance, TUS for larger): https://supabase.com/docs/guides/storage/uploads/standard-uploads
- Supabase — Image resizing + Smart CDN announcement (no-footguns / sane defaults): https://supabase.com/blog/storage-image-resizing-smart-cdn
- `browser-image-compression`: https://github.com/Donaldcwl/browser-image-compression/ and guide https://tarkarn.com/blog/browser-image-compression-guide
- Client-side image optimization without a library (canvas WebP + memory cleanup, latency numbers): https://www.scalebloom.com/blog/client-side-image-optimization/
- Client-side compression + Supabase Storage (compressorjs pattern): https://mikeesto.com/posts/supabaseimagecompression/
- Cloudflare Images — Workers bindings (`env.IMAGES`, local `wrangler dev`): https://developers.cloudflare.com/images/transform-images/bindings/
- Cloudflare Images — Transform via Workers (`cf.image`, loop-avoidance): https://developers.cloudflare.com/images/optimization/transformations/transform-via-workers/
- Cloudflare — Transform user-uploaded images before R2 upload: https://developers.cloudflare.com/images/tutorials/optimize-user-uploaded-image/
- EXIF orientation (normalize-at-capture, not EXIF-aware downstream): https://vsidhu.com/blogs/fixing-exif-orientation-in-react-native-camera
- Image upload best practices (HEIC, server-side normalization, metadata/PII): https://uploadfile.pro/best-practices-for-uploading-images-on-the-web-size-format-compression-and-metadata
- Mobile camera photo upload (3–12 MB files, compress-before-upload): https://catdoes.com/blog/add-camera-to-mobile-app
