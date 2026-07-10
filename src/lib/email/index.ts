// core
import { EMAIL_FROM, RESEND_API_KEY } from "astro:env/server";

// others
import { createResendAdapter } from "./resend";

// Provider-agnostic email seam (S-02, given a real provider in S-05). Templates
// compose `EmailContent`; callers address it into an `EmailMessage` and hand it
// to `sendEmail`. The adapter behind that call is the only code that talks to a
// provider, which is why an attachment that is not on `EmailMessage` cannot
// reach the wire.
//
// Two adapters exist, selected from configuration:
//   • resend  — a real send, when RESEND_API_KEY and EMAIL_FROM are both set.
//   • dev/log — prints the composed message to the server console (no network),
//               the unconfigured fallback. Messages are composed and "sent" to
//               the log, not delivered.

/** Composed subject + bodies, before addressing (what templates return). */
export interface EmailContent {
  subject: string;
  html: string;
  text: string;
}

/**
 * A file the provider fetches server-side at send time. `path` is a URL (for a
 * private bucket, a short-TTL signed one) — no bytes transit the Worker.
 */
export interface EmailAttachment {
  path: string;
  filename: string;
}

/**
 * A fully-addressed outbound message.
 *
 * `attachments` lives here rather than on `EmailContent` because `EmailContent`
 * is *what the message says* — its templates are pure functions of domain data
 * and must not know a PDF sits behind an expiring signed URL. `EmailMessage` is
 * *what this send does*, which is already why `to` lives here. Optional, so the
 * pre-S-05 callers that spread `{ to, ...content }` compile and behave unchanged.
 */
export interface EmailMessage extends EmailContent {
  to: string;
  attachments?: EmailAttachment[];
}

export type EmailAdapter = (message: EmailMessage) => Promise<void>;

const devLogAdapter: EmailAdapter = (message) => {
  const attached = message.attachments?.map((a) => a.filename).join(", ");
  // eslint-disable-next-line no-console
  console.log(
    [
      "[email:dev-log] message composed (no provider configured — NOT delivered)",
      `  To:      ${message.to}`,
      `  Subject: ${message.subject}`,
      ...(attached ? [`  Files:   ${attached}`] : []),
      `  Text:    ${message.text.replaceAll("\n", "\n           ")}`,
    ].join("\n"),
  );
  return Promise.resolve();
};

// Configuration SELECTS between the two production adapters; it cannot INJECT a
// third. A missing key degrades to the log rather than failing the boot — the
// app runs unconfigured, exactly like Supabase does.
const defaultAdapter: EmailAdapter =
  RESEND_API_KEY && EMAIL_FROM ? createResendAdapter({ apiKey: RESEND_API_KEY, from: EMAIL_FROM }) : devLogAdapter;

let adapter: EmailAdapter = defaultAdapter;

/**
 * TEST-ONLY. Swap the adapter for a capturing or throwing double.
 *
 * `sendEmail`'s callers reach the adapter only through this module-local
 * binding, so without a setter the fakes have no way in and the only alternative
 * is `vi.mock` of module internals — which this repo has no precedent for.
 * Integration tests run serially (`vitest.config.ts` sets `fileParallelism:
 * false`), so a mutable binding is safe; restore with {@link resetEmailAdapter}
 * in `afterEach`.
 */
export function setEmailAdapter(next: EmailAdapter): void {
  adapter = next;
}

/** TEST-ONLY. Restore the configuration-selected adapter. */
export function resetEmailAdapter(): void {
  adapter = defaultAdapter;
}

/** Send an email through the configured adapter. Throws whatever the adapter throws. */
export async function sendEmail(message: EmailMessage): Promise<void> {
  await adapter(message);
}
