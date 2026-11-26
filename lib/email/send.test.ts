// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createMailpitSender,
  createResendSender,
  getEmailSender,
  type OutgoingEmail,
} from "./send";

const EMAIL: OutgoingEmail = {
  to: "jordan.ellis@example.com",
  subject: "Time to renew your Ozark Blues Society membership",
  html: "<p>Time to renew</p>",
  text: "Time to renew",
};

/** A stand-in for fetch that answers every request with `status` and `body` (as JSON). */
function fakeFetch(status: number, body: unknown) {
  return vi.fn<typeof globalThis.fetch>(async () => Response.json(body, { status }));
}

function sentRequest(fetch: ReturnType<typeof fakeFetch>) {
  expect(fetch).toHaveBeenCalledOnce();
  const [url, init] = fetch.mock.calls[0];
  return {
    url: String(url),
    method: init?.method,
    headers: new Headers(init?.headers),
    body: JSON.parse(String(init?.body)) as Record<string, unknown>,
  };
}

describe("createResendSender", () => {
  it("sends the email through Resend's API from the Society's address", async () => {
    const fetch = fakeFetch(200, { id: "49a3999c-0ce1-4ea6-ab68-afcd6dc2e794" });
    const send = createResendSender({
      apiKey: "re_test_key",
      from: "noreply@mail.example.org",
      fetch,
    });

    const result = await send({ ...EMAIL, idempotencyKey: "renewal_reminder/abc/2026-12-26" });

    expect(result).toEqual({ id: "49a3999c-0ce1-4ea6-ab68-afcd6dc2e794" });
    const request = sentRequest(fetch);
    expect(request.url).toBe("https://api.resend.com/emails");
    expect(request.method).toBe("POST");
    expect(request.headers.get("authorization")).toBe("Bearer re_test_key");
    expect(request.headers.get("content-type")).toBe("application/json");
    expect(request.headers.get("user-agent")).toBeTruthy();
    expect(request.headers.get("idempotency-key")).toBe("renewal_reminder/abc/2026-12-26");
    expect(request.body).toEqual({
      from: "Ozark Blues Society <noreply@mail.example.org>",
      to: EMAIL.to,
      subject: EMAIL.subject,
      html: EMAIL.html,
      text: EMAIL.text,
    });
  });

  it("leaves out the idempotency key when the email has none", async () => {
    const fetch = fakeFetch(200, { id: "email-id" });
    await createResendSender({ apiKey: "re_test_key", from: "noreply@mail.example.org", fetch })(
      EMAIL,
    );

    expect(sentRequest(fetch).headers.has("idempotency-key")).toBe(false);
  });

  it("throws Resend's error type and message when it refuses the email, without the key", async () => {
    const fetch = fakeFetch(429, {
      statusCode: 429,
      name: "daily_quota_exceeded",
      message: "You have reached your daily email sending quota.",
    });
    const send = createResendSender({
      apiKey: "re_test_key",
      from: "noreply@mail.example.org",
      fetch,
    });

    const error = await send(EMAIL).catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toBe(
      "Resend refused the email (HTTP 429 daily_quota_exceeded): You have reached your daily email sending quota.",
    );
    expect((error as Error).message).not.toContain("re_test_key");
  });

  it("throws when Resend's answer isn't JSON", async () => {
    const fetch = vi.fn(async () => new Response("Bad gateway", { status: 502 }));
    const send = createResendSender({
      apiKey: "re_test_key",
      from: "noreply@mail.example.org",
      fetch,
    });

    await expect(send(EMAIL)).rejects.toThrow("Resend refused the email (HTTP 502)");
  });

  it("throws when Resend accepts the email but sends back no id", async () => {
    const send = createResendSender({
      apiKey: "re_test_key",
      from: "noreply@mail.example.org",
      fetch: fakeFetch(200, {}),
    });

    await expect(send(EMAIL)).rejects.toThrow("Resend accepted the email but sent back no id");
  });
});

describe("createMailpitSender", () => {
  it("delivers the email to Mailpit's inbox through its send API", async () => {
    const fetch = fakeFetch(200, { ID: "mailpit-message-id" });
    const send = createMailpitSender({
      url: "http://127.0.0.1:54324",
      from: "onboarding@resend.dev",
      fetch,
    });

    const result = await send({ ...EMAIL, idempotencyKey: "renewal_reminder/abc/2026-12-26" });

    expect(result).toEqual({ id: "mailpit-message-id" });
    const request = sentRequest(fetch);
    expect(request.url).toBe("http://127.0.0.1:54324/api/v1/send");
    expect(request.method).toBe("POST");
    expect(request.body).toEqual({
      From: { Email: "onboarding@resend.dev", Name: "Ozark Blues Society" },
      To: [{ Email: EMAIL.to }],
      Subject: EMAIL.subject,
      HTML: EMAIL.html,
      Text: EMAIL.text,
    });
  });

  it.each(["http://localhost:54324", "http://127.0.0.1:54324", "http://[::1]:54324"])(
    "accepts Mailpit on this machine (%s)",
    (url) => {
      expect(() => createMailpitSender({ url, from: "onboarding@resend.dev" })).not.toThrow();
    },
  );

  it.each([
    "https://mailpit.example.org",
    "http://192.168.1.20:54324",
    "http://localhost.example.org",
  ])("refuses a Mailpit that isn't on this machine (%s), so member data stays local", (url) => {
    expect(() => createMailpitSender({ url, from: "onboarding@resend.dev" })).toThrow(
      "MAILPIT_URL must be on this machine",
    );
  });

  it("throws when Mailpit doesn't take the email", async () => {
    const send = createMailpitSender({
      url: "http://127.0.0.1:54324",
      from: "onboarding@resend.dev",
      fetch: fakeFetch(400, "invalid From address"),
    });

    await expect(send(EMAIL)).rejects.toThrow("Mailpit didn't take the email (HTTP 400)");
  });
});

describe("getEmailSender", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("sends through Resend when RESEND_API_KEY is set, even if MAILPIT_URL is too", async () => {
    const fetch = fakeFetch(200, { id: "email-id" });
    vi.stubGlobal("fetch", fetch);

    const send = getEmailSender({
      EMAIL_FROM: "onboarding@resend.dev",
      RESEND_API_KEY: "re_test_key",
      MAILPIT_URL: "http://127.0.0.1:54324",
    });
    await send(EMAIL);

    expect(sentRequest(fetch).url).toBe("https://api.resend.com/emails");
  });

  it("delivers to Mailpit when there's no Resend key", async () => {
    const fetch = fakeFetch(200, { ID: "mailpit-message-id" });
    vi.stubGlobal("fetch", fetch);

    const send = getEmailSender({
      EMAIL_FROM: "onboarding@resend.dev",
      MAILPIT_URL: "http://127.0.0.1:54324",
    });
    await send(EMAIL);

    expect(sentRequest(fetch).url).toBe("http://127.0.0.1:54324/api/v1/send");
  });

  it("refuses to send with neither Resend nor Mailpit set up", () => {
    expect(() => getEmailSender({ EMAIL_FROM: "onboarding@resend.dev" })).toThrow(
      "Email isn't set up",
    );
  });

  it.each([
    ["missing", undefined],
    ["empty", " "],
    ["a name and an address", "Ozark Blues Society <noreply@mail.example.org>"],
    ["not an address", "noreply"],
  ])("refuses an EMAIL_FROM that is %s", (_case, from) => {
    expect(() => getEmailSender({ EMAIL_FROM: from, RESEND_API_KEY: "re_test_key" })).toThrow(
      "EMAIL_FROM must be the address emails are sent from",
    );
  });
});
