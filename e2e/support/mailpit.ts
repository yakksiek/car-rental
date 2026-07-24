// Mailpit helpers for the E2E suite. The local Supabase stack routes all auth
// email to Mailpit (config.toml `[inbucket]`, web+API on :54324) — the invite and
// recovery flows cross email → link → session, so a spec must read the real
// message to get the link it then drives. This talks to Mailpit's HTTP API; it
// never touches the browser.
//
// The polling loop below waits on an EXTERNAL async condition (mail delivery),
// bounded by a deadline — it is not a `page.waitForTimeout` (which e2e-rules.md
// forbids for in-page state). There is no DOM signal for "the SMTP send landed".

const MAILPIT = process.env.MAILPIT_URL ?? "http://127.0.0.1:54324";

/** Wipe the mailbox so a spec only sees mail it triggered. */
export async function clearMailbox(): Promise<void> {
  await fetch(`${MAILPIT}/api/v1/messages`, { method: "DELETE" });
}

interface MailpitListItem {
  ID: string;
}

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&#38;/g, "&")
    .replace(/&quot;/g, '"');
}

/**
 * Poll Mailpit until a message addressed to `recipient` carries an
 * `/auth/callback` link, then return that link (entity-decoded). Throws on
 * timeout so a broken send fails loudly here, not deep in the flow.
 */
export async function waitForCallbackLink(recipient: string, { timeoutMs = 20000 } = {}): Promise<string> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const res = await fetch(`${MAILPIT}/api/v1/search?query=${encodeURIComponent(`to:${recipient}`)}`);
    if (res.ok) {
      const data = (await res.json()) as { messages?: MailpitListItem[] };
      const first = data.messages?.[0];
      if (first) {
        const full = (await (await fetch(`${MAILPIT}/api/v1/message/${first.ID}`)).json()) as {
          HTML?: string;
          Text?: string;
        };
        const body = decodeEntities(`${full.HTML ?? ""} ${full.Text ?? ""}`);
        const match = /https?:\/\/[^\s"'<>]+\/auth\/callback[^\s"'<>]*/.exec(body);
        if (match) {
          return match[0];
        }
      }
    }
    await new Promise((resolve) => setTimeout(resolve, 300));
  }
  throw new Error(`No /auth/callback link for ${recipient} within ${timeoutMs}ms`);
}
