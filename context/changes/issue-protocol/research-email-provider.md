---
topic: Transactional email provider selection for issue/return protocol delivery (FR-008)
researcher: Claude (external research via exa.ai + Context7)
change_id: issue-protocol
type: external
date: 2026-06-17
---

# Research — Transactional email provider (S-05)

> External research. Sources: exa.ai web search + Context7 (`/llmstxt/resend_llms_txt`), 2026-06-17.
> Scope: transactional email provider for auto-emailing the completed issue protocol to the customer (FR-008), shared with S-06 (return protocol). Resolves Open Roadmap Question #1.

## Question

Which transactional email provider aligns with `context/foundation/tech-stack.md` and lets S-05 auto-email the protocol (PDF/photos + HTML body) to the customer?

## Stack constraints (compatibility criteria)

- **Runtime:** Cloudflare Workers (`@astrojs/cloudflare`, workerd) — **no Node SMTP**. The provider must send over an **HTTP/`fetch` API**, called server-side from an Astro API route (`src/pages/api/`).
- **Backend:** Astro SSR API-route + zod pattern; secrets via `astro:env/server` (same path as `SUPABASE_URL`/`SUPABASE_KEY`).
- **Frontend:** React 19 islands — makes React Email (JSX email templates) a natural fit if we want it.
- **S-05 need (FR-008):** deliver the protocol to the customer with **attachments** (PDF and/or photos from Supabase Storage) and an HTML body. Polish-only content. Needs a **verified sender domain** (SPF/DKIM/DMARC).
- **Priors:** `main_goal: speed`, solo capacity, agent-friendly docs are an explicit quality signal.

### Stack-wide gotcha (decides the field, not the brand)

The hard line is **HTTP-API, not SMTP**. SMTP libraries do not work on workerd. Every provider below is reduced to "one `fetch` POST with a Bearer token," which is exactly what Workers is good at. The historical free path — **MailChannels' free Cloudflare Workers integration — was discontinued 30 Jun 2024**; Cloudflare's own docs now redirect that guide to Resend. Do not build on any MailChannels-free tutorial.

## Options

| Provider | Workers fit (HTTP) | Attachments | Free tier | Paid entry | Agent-friendly docs | Notes |
|---|---|---|---|---|---|---|
| **Resend** | ✅ Native `fetch` SDK, **zero adaptation**; official CF Workers + Astro guides + example repo | ✅ `attachments: [{ filename, content: base64 }]`, 40 MB total | **3,000/mo, 100/day — no base-plan required** | $20/mo (50k) | ✅ `llms.txt` + React Email (which Resend authors) | De-facto default for this exact stack; Cloudflare's own recommended replacement for MailChannels |
| **Postmark** | ⚠️ REST works; official SDK not Workers-friendly (use raw `fetch`) | ✅ via REST | 100/mo | $15/mo (10k) | ⚠️ good docs, no React Email | Best-in-class transactional deliverability (dedicated IP day 1). Overkill for v1 volume |
| **AWS SES** | ⚠️ Official SDK adds 200KB+ to the Worker bundle; need `aws4fetch` | ✅ | pay-as-you-go | ~$0.10/1k | ❌ verbose | Cheapest at scale, but you "eat the ops" — wrong trade for a solo 3-week build |
| **SendGrid** | ✅ HTTP API works | ✅ | low (reduced) | ~$20/mo (50k) | ❌ dated DX, shared-IP reputation risk at low tier | "Hard to recommend for new builds" — only if already standardized |
| **Cloudflare Email Service** (`send_email` binding) | ✅ zero-config, edge co-located | ⚠️ evolving | 3,000/mo **but requires $5/mo Workers Paid** | $0.35/1k after | n/a | Public beta (since Apr 2026), 50-recipient cap, API-instability risk — too green for a field-critical protocol |

## Recommendation

**Lead: Resend.** It is the single best-aligned option for FleetRent's stack and goal:

1. **Workers-native.** Pure `fetch`-based SDK — Cloudflare's own docs name it the recommended post-MailChannels provider, with first-party CF Workers **and** Astro tutorials plus an example repo. No bundle bloat (unlike SES's AWS SDK).
2. **Attachments built in.** `attachments: [{ filename, content }]` where `content` is base64 — exactly what's needed to attach the protocol PDF / Supabase-Storage photos for FR-008. 40 MB/email ceiling is comfortable.
3. **Genuinely free at v1 volume.** 3,000/mo + 100/day with **no base-plan requirement** — a single-operator fleet sends nowhere near this. (Cloudflare's own 3,000/mo tier, by contrast, requires the $5/mo Workers Paid plan.)
4. **Best agent-friendly docs in the category** (`llms.txt`, the quality signal called out in CLAUDE.md) and **React Email** — JSX email templates that fit the React 19 island convention, so S-06's return protocol reuses the same template machinery.
5. **Fits existing conventions.** API key lands as an `astro:env/server` secret (same pattern as Supabase), called from a `src/pages/api/` route with zod — and stored as a Cloudflare **Worker secret** (`wrangler secret put`), not a public var.

**Fallback (if deliverability becomes the priority over DX): Postmark** — transactional-only reputation, dedicated IP from day 1, via raw `fetch`. Not needed for v1 volume, but the natural escalation if customers report protocols landing in spam.

## Plan-time checks (not blockers)

- **`react:` param is "Node.js only."** Resend's docs mark the `react` (React Email) parameter as Node-only, yet the official CF Workers example uses it — it works **only with `nodejs_compat`** enabled. **Safer for this field-critical email:** render the template to an HTML string server-side (`@react-email/render`, or a plain template) and pass **`html`** + base64 **`attachments`**, rather than relying on the `react:` param inside workerd. Decide at plan time; don't let it block.
- **Verified domain required.** Production `from` must use a domain verified in Resend (SPF/DKIM/DMARC DNS records). `onboarding@resend.dev` is test-only — using it (or an unverified domain) in prod returns **403**. Pick + verify the sender domain as a plan-0 task (this is the "sender domain" half of Open Roadmap Q#1).
- **Secrets, not vars.** `RESEND_API_KEY` must be a Worker **secret** binding (and in `.dev.vars` locally for Wrangler), surfaced through `astro:env/server`. A misconfigured key reads as a 403, not a clean error.
- **Use `idempotencyKey`** on the send so a retried protocol submission doesn't double-email the customer.
- **Free-tier rate caps** (100/day, 5 req/s) are far above v1 demand — note them but don't engineer around them now.

## Sources

- Cloudflare Workers docs — *Send Emails With Resend* (official tutorial): https://developers.cloudflare.com/workers/tutorials/send-emails-with-resend/
- Resend — *Send with Cloudflare Workers*: https://resend.com/docs/send-with-cloudflare-workers · *Send with Astro*: https://resend.com/docs/send-with-astro · example repo: https://github.com/resend/resend-cloudflare-workers-example
- MailChannels free-tier EOL (30 Jun 2024): https://community.cloudflare.com/t/mailchannels-end-of-life-notice-migrate-now/658638 · https://resources.mailertogo.com/comparisons/smtp-vs-email-api-cloudflare-workers
- Provider comparisons (2026): https://www.sideguysolutions.com/shareables/resend-vs-sendgrid-vs-mailgun-vs-postmark-vs-ses-vs-loops-honest-comparison.html · https://dev.to/contrite42/resend-vs-postmark-vs-sendgrid-three-production-accounts-later-382h
- Cloudflare Email Service vs Resend: https://www.sequenzy.com/versus/cloudflare-email-vs-resend
- Astro+Workers Resend troubleshooting (403/422): https://mayfield.io/blog/fix-resend-403-422-astro-contact-form-cloudflare-workers/
- Attachments / API reference: Context7 `/llmstxt/resend_llms_txt`
