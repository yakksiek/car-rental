---
topic: Resend integration reference for protocol email (S-05 / FR-008)
researcher: Claude (Context7 — /llmstxt/resend_llms_txt)
change_id: issue-protocol
type: external
date: 2026-06-17
---

# Resend integration reference (S-05 / S-06)

> Live docs fetched via Context7 (`/llmstxt/resend_llms_txt`), 2026-06-17. Provider decision in [research-email-provider.md](./research-email-provider.md).
> Purpose: implementation-ready API surface mapped to FleetRent conventions (Astro SSR API route on Cloudflare Workers, `astro:env/server` secrets, Supabase Storage attachments). Copy-adapt at `/10x-implement` time — verify against the dashboard before shipping.

## 0. One-time setup (plan-0 tasks)

1. **Install:** `npm install resend`. For JSX templates also `npm install @react-email/components` (gives `render()`).
2. **Verify the sending domain** (resolves the "sender domain" half of Open Roadmap Q#1):
   - Resend dashboard → Domains → add domain → copy the **SPF, DKIM, DMARC** DNS records into the domain's DNS (Cloudflare DNS if the domain is there) → click **Verify**.
   - Until status is **Verified**, sending from `@yourdomain` returns **403**. `onboarding@resend.dev` works only for testing.
3. **Secret, not var.** Add `RESEND_API_KEY` to `astro.config.mjs` `env.schema` as a server secret (same mechanism as `SUPABASE_KEY`), consumed via `astro:env/server`. On Cloudflare: `wrangler secret put RESEND_API_KEY` for prod, and `.dev.vars` locally for `wrangler dev`.
4. **Compatibility flag.** Enable `nodejs_compat` in `wrangler.jsonc` `compatibility_flags` — needed for `Buffer` (attachment base64) and for the `react:` param if ever used. (See §3 for a Buffer-free alternative.)

## 1. Minimal send — Astro API route on Workers

The Resend SDK is `fetch`-based and runs in workerd. Follow the repo's API-route + zod pattern; read the key from `astro:env/server`.

```ts
// src/pages/api/protocols/[id]/email.ts (illustrative)
// core
import type { APIRoute } from "astro";
import { RESEND_API_KEY } from "astro:env/server";
import { Resend } from "resend";

export const prerender = false;

export const POST: APIRoute = async ({ params }) => {
  const resend = new Resend(RESEND_API_KEY);

  const { data, error } = await resend.emails.send(
    {
      from: "FleetRent <protokoly@yourdomain.pl>", // verified domain
      to: [customerEmail],
      subject: "Protokół wydania pojazdu",
      html: bodyHtml, // see §3
    },
    { idempotencyKey: `issue-protocol/${params.id}` }, // see §4
  );

  if (error) {
    // error: { name, message } — log and surface a clean 5xx; do NOT leak the key
    return new Response(JSON.stringify({ error: error.message }), { status: 502 });
  }
  return new Response(JSON.stringify({ id: data!.id }), { status: 200 });
};
```

**`{ data, error }` is the contract** — the SDK does not throw on API errors; always branch on `error`.

## 2. send() parameter reference

| Param | Type | Notes for FleetRent |
|---|---|---|
| `from` | `string` | `"FleetRent <protokoly@yourdomain.pl>"` — **must** be a verified domain in prod |
| `to` | `string \| string[]` | customer email; max 50 addresses |
| `subject` | `string` | Polish copy |
| `html` | `string` | the rendered protocol body (§3) |
| `text` | `string` | optional plain-text fallback; auto-derived from `html` if omitted |
| `react` | `ReactNode` | **avoid on Workers** — marked "Node.js only"; use `render()` → `html` instead (§3) |
| `attachments` | `Attachment[]` | protocol PDF + photos; **40 MB total** after encoding (§5) |
| `replyTo` | `string \| string[]` | e.g. operator's inbox |
| `headers` | `object` | custom headers if needed |
| `idempotencyKey` | passed as 2nd-arg option | dedupe retries (§4) |

Returns `{ data: { id }, error: null }` on success.

## 3. Building the HTML body (React Email, Workers-safe)

The `react:` param is documented **"Node.js only"** and needs `nodejs_compat`. The robust path on workerd is to **render the JSX to an HTML string yourself** and pass it as `html` — decouples the email from the runtime quirk and keeps S-06 reusing the same template.

```ts
// core
import { render } from "@react-email/components";
import { IssueProtocolEmail } from "../emails/issue-protocol"; // a React Email component

const bodyHtml = await render(<IssueProtocolEmail protocol={protocol} />);
// render() is async; returns a complete HTML document string → pass as `html`
```

If you *do* use the `react:` param instead: pass it **as a function call** (`IssueProtocolEmail({ protocol })`), **not** JSX, and ensure `nodejs_compat` is on. `react` is mutually exclusive with `html`/`text`.

## 4. Idempotency (prevents double-emailing on retry)

Pass `idempotencyKey` in the **options object** (2nd arg). Recommended shape `<event-type>/<entity-id>`, e.g. `issue-protocol/${protocolId}`. Keys **expire after 24 h**, max 256 chars. A retried protocol submission with the same key won't re-send.

```ts
await resend.emails.send(payload, { idempotencyKey: `issue-protocol/${protocolId}` });
```

## 5. Attachments — from Supabase Storage

`attachments[].content` accepts a **base64 string** (or `Buffer`). Two patterns:

**(a) File attachment (PDF / photo) — fetch bytes from Supabase, base64-encode:**
```ts
// download from Supabase Storage → ArrayBuffer → base64
const { data: blob } = await supabase.storage.from("protocol-photos").download(path);
const bytes = new Uint8Array(await blob.arrayBuffer());

// with nodejs_compat:
const content = Buffer.from(bytes).toString("base64");
// without Buffer, a Workers-safe helper:
// const content = btoa(String.fromCharCode(...bytes));  // ok for small files; chunk for large

attachments: [{ filename: "protokol-wydania.pdf", content }]
```

**(b) Remote file by URL** — Resend fetches it for you (use a Supabase signed/public URL):
```ts
attachments: [{ path: signedUrl, filename: "zdjecie-1.jpg" }]
```

**Inline image in the HTML** (e.g. embedded photo/signature) — add `contentId` and reference `cid:` in the markup:
```ts
html: '<p>Podpis klienta:</p><img src="cid:signature-img" />',
attachments: [{ content: signatureBase64, filename: "podpis.png", contentId: "signature-img" }],
```

> Total attachment payload is capped at **40 MB after base64 encoding** — for many full-res photos, attach a generated PDF and/or use `path` URLs rather than inlining every image.

## 6. Limits & failure modes (note, don't engineer around for v1)

- **Rate limit:** 5 req/s per team (`429` if exceeded); free tier **100/day, 3,000/mo** — far above a single-operator fleet.
- **403** → unverified domain or wrong-scoped/missing key (looks like 502 in the browser if the route wraps it). **422** → bad payload shape (e.g. `to` not an array, invalid `from` format). Surface `error.message` from one failed call when debugging.
- Redeploy after changing secrets; a stale/absent `RESEND_API_KEY` reads as 403/503, not a clean error.

## Sources (Context7 `/llmstxt/resend_llms_txt`)

- Send (Cloudflare Workers): https://resend.com/docs/send-with-cloudflare-workers
- Send (Astro): https://resend.com/docs/send-with-astro
- Attachments: https://resend.com/docs/dashboard/emails/attachments · Inline images: https://resend.com/docs/dashboard/emails/embed-inline-images
- API reference (send-email, attachments): https://resend.com/docs/api-reference/emails/send-email
- Idempotency: https://resend.com/docs/send-with-nodejs
