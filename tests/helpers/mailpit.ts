// Mailpit counter for the integration harness.
//
// GoTrue's own mail (invite / recovery) does NOT go through `src/lib/email` —
// it is sent by the auth service itself, so `tests/helpers/email.ts`'s adapter
// double cannot see it and there is nothing in-process to intercept. The local
// stack routes it to Mailpit (`config.toml [inbucket]`, HTTP API on :54324), so
// the only way to assert "exactly one mail" — or, harder and more valuable,
// "ZERO mail" — is to ask Mailpit.
//
// Counting is what the two-step add needs: `createEmployee` must send nothing
// and `inviteEmployee` must send exactly one. An absent error proves neither.

const MAILPIT = process.env.MAILPIT_URL ?? "http://127.0.0.1:54324";

interface MailpitSearch {
  messages_count?: number;
  messages?: { ID: string }[];
}

/**
 * How many messages Mailpit holds for `recipient`.
 *
 * Addresses are unique per test (`uniqueEmail`), so this needs no mailbox wipe
 * and cannot race a sibling test — unlike `clearMailbox`, which the e2e helper
 * uses and which would be unsafe in a suite that shares one stack.
 */
export async function mailCountFor(recipient: string): Promise<number> {
  const res = await fetch(`${MAILPIT}/api/v1/search?query=${encodeURIComponent(`to:${recipient}`)}`);
  if (!res.ok) {
    throw new Error(`Mailpit search failed (${String(res.status)}) — is the local stack running?`);
  }
  const data = (await res.json()) as MailpitSearch;
  return data.messages_count ?? data.messages?.length ?? 0;
}

/**
 * Poll until `recipient` has at least `expected` messages, then return the count.
 *
 * SMTP delivery is asynchronous, so a bare `mailCountFor` right after the call
 * races the send. Bounded by a deadline; the caller still asserts the exact
 * number, so an over-send fails rather than being absorbed.
 */
export async function waitForMailCount(recipient: string, expected: number, timeoutMs = 10_000): Promise<number> {
  const deadline = Date.now() + timeoutMs;
  let count = await mailCountFor(recipient);
  while (count < expected && Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 200));
    count = await mailCountFor(recipient);
  }
  return count;
}

/**
 * Assert nothing was sent, giving a real send time to arrive first.
 *
 * A "zero mail" claim checked instantly would pass even if a mail were on the
 * wire, so this waits out the same window a positive assertion would, then
 * reports the count. Deliberately a fixed settle, not a poll: there is no event
 * that says "no mail is coming".
 */
export async function settledMailCount(recipient: string, settleMs = 1500): Promise<number> {
  await new Promise((resolve) => setTimeout(resolve, settleMs));
  return mailCountFor(recipient);
}
