// core
import { describe, expect, it } from "vitest";

// others
import { createResendAdapter } from "./resend";

const message = {
  to: "anna@example.test",
  subject: "FleetRent — protokół wydania R-2401",
  html: "<p>Wąsik</p>",
  text: "Wąsik",
};

/** The subset of Resend's request body this adapter is contracted to send. */
interface ResendBody {
  from: string;
  to: string[];
  subject: string;
  html: string;
  text: string;
  attachments?: { path: string; filename: string }[];
}

/** A `fetch` double that records its call and replays a canned response. */
function fakeFetch(response: Response) {
  const calls: { url: string; init: RequestInit }[] = [];
  const impl = (url: RequestInfo | URL, init?: RequestInit) => {
    const href = url instanceof Request ? url.url : url instanceof URL ? url.href : url;
    calls.push({ url: href, init: init ?? {} });
    return Promise.resolve(response);
  };
  /** The parsed JSON body of the recorded call. */
  const body = (): ResendBody => JSON.parse(calls[0].init.body as string) as ResendBody;
  return { calls, impl, body };
}

describe("createResendAdapter", () => {
  it("POSTs a Bearer-authenticated JSON message to the Resend API", async () => {
    const { calls, impl, body } = fakeFetch(new Response("{}", { status: 200 }));
    await createResendAdapter({ apiKey: "re_test", from: "FleetRent <a@b.pl>", fetchImpl: impl })(message);

    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe("https://api.resend.com/emails");
    const headers = calls[0].init.headers as Record<string, string>;
    expect(headers.Authorization).toBe("Bearer re_test");

    expect(body().from).toBe("FleetRent <a@b.pl>");
    expect(body().to).toEqual(["anna@example.test"]);
    expect(body().subject).toContain("protokół");
    // No attachment on this message — the key must be absent, not `undefined`.
    expect(body()).not.toHaveProperty("attachments");
  });

  it("forwards attachments in Resend's hosted-URL form", async () => {
    const { impl, body } = fakeFetch(new Response("{}", { status: 200 }));
    await createResendAdapter({ apiKey: "re_test", from: "a@b.pl", fetchImpl: impl })({
      ...message,
      attachments: [{ path: "https://signed.example/protocol.pdf?token=x", filename: "protokol.pdf" }],
    });

    expect(body().attachments).toEqual([
      { path: "https://signed.example/protocol.pdf?token=x", filename: "protokol.pdf" },
    ]);
  });

  it("throws on a non-2xx response, carrying the status and the body", async () => {
    const { impl } = fakeFetch(new Response('{"message":"domain not verified"}', { status: 403 }));
    const adapter = createResendAdapter({ apiKey: "re_test", from: "a@b.pl", fetchImpl: impl });

    // One call only: a Response body streams once, and the adapter consumes it.
    await expect(adapter(message)).rejects.toThrow(/403.*domain not verified/);
  });

  it("throws on a 5xx whose body is not JSON", async () => {
    const { impl } = fakeFetch(new Response("<html>502 Bad Gateway</html>", { status: 502 }));
    const adapter = createResendAdapter({ apiKey: "re_test", from: "a@b.pl", fetchImpl: impl });

    await expect(adapter(message)).rejects.toThrow(/502/);
  });
});
