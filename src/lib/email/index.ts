// Provider-agnostic email seam (S-02). Transactional email has no real
// provider until S-05 (roadmap Open Question #1) — this module fixes the
// calling contract now so S-03 can send confirm/reject mails and S-05 only
// swaps the adapter, never the callers.
//
// The sole adapter today is dev/log: it prints the composed message to the
// server console (no network). Messages are composed and "sent" to the log,
// not delivered — flagged explicitly in the slice's scope.

/** Composed subject + bodies, before addressing (what templates return). */
export interface EmailContent {
  subject: string;
  html: string;
  text: string;
}

/** A fully-addressed outbound message. */
export interface EmailMessage extends EmailContent {
  to: string;
}

type EmailAdapter = (message: EmailMessage) => Promise<void>;

const devLogAdapter: EmailAdapter = (message) => {
  // eslint-disable-next-line no-console
  console.log(
    [
      "[email:dev-log] message composed (no provider configured — NOT delivered)",
      `  To:      ${message.to}`,
      `  Subject: ${message.subject}`,
      `  Text:    ${message.text.replaceAll("\n", "\n           ")}`,
    ].join("\n"),
  );
  return Promise.resolve();
};

// S-05: select a real adapter from configuration here (and keep dev/log as
// the unconfigured fallback). Callers never change.
const adapter: EmailAdapter = devLogAdapter;

/** Send an email through the configured adapter. */
export async function sendEmail(message: EmailMessage): Promise<void> {
  await adapter(message);
}
