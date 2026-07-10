// others
import { resetEmailAdapter, setEmailAdapter } from "../../src/lib/email";
import type { EmailAdapter, EmailMessage } from "../../src/lib/email";

// Email transport doubles.
//
// The send happens server-side, inside the route handler, so `page.route()`
// cannot stub it (e2e/e2e-rules.md:87-88) and there is nothing on the wire to
// intercept. The fake must be injected at the adapter — which is why
// `src/lib/email/index.ts` exports `setEmailAdapter`. Configuration alone cannot
// do this: it selects between `resendAdapter` and `devLogAdapter`, and a test
// double is neither.
//
// These are plain `EmailAdapter` functions, not `vi.mock` of module internals —
// the repo has zero precedent for module mocking, and mocking the transport so
// deeply that nothing real is asserted is the anti-pattern these tests exist to
// avoid. Integration tests run serially (`fileParallelism: false`), so a mutable
// module binding is safe. Always restore in `afterEach` via `restoreEmailAdapter`.

/** Records every message handed to the adapter, and delivers none. */
export function captureEmails(): { messages: EmailMessage[] } {
  const messages: EmailMessage[] = [];
  const adapter: EmailAdapter = (message) => {
    messages.push(message);
    return Promise.resolve();
  };
  setEmailAdapter(adapter);
  return { messages };
}

/** The provider is down. Stands in for a Resend non-2xx, which `resendAdapter` throws on. */
export function failEmails(message = "email provider unavailable"): void {
  setEmailAdapter(() => Promise.reject(new Error(message)));
}

/** Restore the configuration-selected adapter. Call from `afterEach`. */
export function restoreEmailAdapter(): void {
  resetEmailAdapter();
}
