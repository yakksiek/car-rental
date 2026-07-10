// others
import type { EmailAdapter, EmailMessage } from "./index";

// The real transactional-email adapter (S-05).
//
// `workerd` has no arbitrary TCP sockets, so SMTP is impossible — every viable
// provider had to expose a `fetch()`-callable HTTP API. That is also why this
// ships NO SDK and no Node dependency: a bare `fetch` cannot drag a Node stream
// API into the Worker, where it would throw only in production.
//
// Attachments are forwarded in Resend's HOSTED-URL form (`path`), which Resend
// fetches server-side at send time. The Worker therefore never handles a PDF
// byte. Two consequences worth knowing: the object must already exist at that
// URL when the send is made (which is why the protocol email is sent from the
// finalize route, not from `POST /api/protocols`), and Resend's 40 MB cap is
// measured AFTER base64 encoding (~28 MB of real file).
//
// Kept as a factory rather than a module-level const so this file never imports
// `astro:env/server`: configuration is read once in `./index`, and the adapter
// stays a pure function of its credentials (and unit-testable with a fake fetch).

const RESEND_ENDPOINT = "https://api.resend.com/emails";

interface ResendOptions {
  apiKey: string;
  /** Verified sender, e.g. `FleetRent <protokol@fleetrent.pl>`. */
  from: string;
  /** Injectable for tests; defaults to the platform `fetch`. */
  fetchImpl?: typeof fetch;
}

/**
 * Build a Resend-backed {@link EmailAdapter}.
 *
 * A non-2xx response **throws** — the adapter's job is to send or say it could
 * not. Deciding what a failure means (swallow, retry, record a `failed` delivery
 * row) belongs to the caller; see `sendTracked`.
 */
export function createResendAdapter(options: ResendOptions): EmailAdapter {
  const send = options.fetchImpl ?? fetch;

  return async (message: EmailMessage): Promise<void> => {
    const response = await send(RESEND_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${options.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: options.from,
        to: [message.to],
        subject: message.subject,
        html: message.html,
        text: message.text,
        ...(message.attachments?.length
          ? { attachments: message.attachments.map((a) => ({ path: a.path, filename: a.filename })) }
          : {}),
      }),
    });

    if (!response.ok) {
      // Resend returns a JSON `{ name, message }` on error, but a gateway may
      // return HTML — read as text so a non-JSON body never masks the status.
      const body = await response.text().catch(() => "");
      throw new Error(`Resend rejected the message (${response.status}): ${body.slice(0, 500)}`);
    }
  };
}
