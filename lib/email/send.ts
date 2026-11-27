// Sending the app's own emails: the templates in emails/, rendered with renderEmail()
// (emails/render.ts). Everything that sends email goes through getEmailSender(), so every email
// leaves from the one address in EMAIL_FROM, with the Society's name (decision 0005).
//
// - Production sends through Resend (RESEND_API_KEY).
// - Locally, with no Resend key, emails go to Mailpit (MAILPIT_URL), the mail catcher of the local
//   Supabase stack, where the sign-in emails land too. Nothing leaves the machine.
// - With a Resend test key and Resend's test sender, onboarding@resend.dev, Resend delivers only to
//   its test addresses and the Resend account's owner (see the README).

import { EnvError, requireEnv, type ServerEnv } from "@/lib/env/schema";

/** The sender's name on every email (decision 0005). */
export const SENDER_NAME = "Ozark Blues Society";

export interface OutgoingEmail {
  to: string;
  subject: string;
  html: string;
  /** The plain-text version, for email clients that don't show HTML. */
  text: string;
  /**
   * Names this email, so that sending it again doesn't deliver it twice: for 24 hours, Resend
   * answers a repeated key with the first send's result. Up to 256 characters.
   */
  idempotencyKey?: string;
}

/** Sends one email. Resolves with the email service's id for it; throws if it wasn't accepted. */
export type SendEmail = (email: OutgoingEmail) => Promise<{ id: string }>;

type Fetch = typeof globalThis.fetch;

/** A sending request that hangs gives up after this long, so one email can't stall a whole run. */
const REQUEST_TIMEOUT_MS = 10_000;

const RESEND_EMAILS_API = "https://api.resend.com/emails";

/** Sends through Resend's API (https://resend.com/docs/api-reference/emails/send-email). */
export function createResendSender(options: {
  apiKey: string;
  from: string;
  fetch?: Fetch;
}): SendEmail {
  const { apiKey, from, fetch = globalThis.fetch } = options;
  return async (email) => {
    const response = await fetch(RESEND_EMAILS_API, {
      method: "POST",
      headers: {
        authorization: `Bearer ${apiKey}`,
        "content-type": "application/json",
        // Resend refuses requests without a User-Agent (403).
        "user-agent": "obs-platform",
        ...(email.idempotencyKey ? { "idempotency-key": email.idempotencyKey } : {}),
      },
      body: JSON.stringify({
        from: `${SENDER_NAME} <${from}>`,
        to: email.to,
        subject: email.subject,
        html: email.html,
        text: email.text,
      }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    const body = (await response.json().catch(() => null)) as {
      id?: unknown;
      name?: unknown;
      message?: unknown;
    } | null;
    if (!response.ok) {
      // Resend's errors carry a type (validation_error, daily_quota_exceeded, ...) and a message.
      const type = typeof body?.name === "string" ? ` ${body.name}` : "";
      const message = typeof body?.message === "string" ? `: ${body.message}` : "";
      throw new Error(`Resend refused the email (HTTP ${response.status}${type})${message}`);
    }
    if (typeof body?.id !== "string") {
      throw new Error("Resend accepted the email but sent back no id");
    }
    return { id: body.id };
  };
}

/**
 * Whether a URL's host is this machine, the only place a mail catcher should be: localhost, [::1]
 * or an address in 127.0.0.0/8. The URL parser has already turned every other way of writing an
 * IPv4 address (127.1, 0x7f000001) into four decimal numbers, so a name such as 127.example.org
 * doesn't pass.
 */
function isLoopback(url: URL): boolean {
  return (
    url.hostname === "localhost" ||
    url.hostname === "[::1]" ||
    /^127(?:\.\d{1,3}){3}$/.test(url.hostname)
  );
}

/**
 * Delivers to Mailpit's inbox through its HTTP API (POST /api/v1/send), for local development and
 * the end-to-end tests. Mailpit keeps every email it gets and sends none on. Only an address on
 * this machine is allowed, so member data can't be posted elsewhere by mistake.
 */
export function createMailpitSender(options: {
  url: string;
  from: string;
  fetch?: Fetch;
}): SendEmail {
  const { from, fetch = globalThis.fetch } = options;
  const endpoint = new URL("/api/v1/send", options.url);
  if (!isLoopback(endpoint)) {
    throw new Error(
      `MAILPIT_URL must be on this machine (localhost or 127.0.0.1), not ${options.url}`,
    );
  }
  return async (email) => {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        From: { Email: from, Name: SENDER_NAME },
        To: [{ Email: email.to }],
        Subject: email.subject,
        HTML: email.html,
        Text: email.text,
      }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    const body = (await response.json().catch(() => null)) as { ID?: unknown } | null;
    if (!response.ok || typeof body?.ID !== "string") {
      throw new Error(`Mailpit didn't take the email (HTTP ${response.status})`);
    }
    return { id: body.ID };
  };
}

/**
 * The sender for this environment's variables, which the caller reads with
 * `serverEnv("EMAIL_FROM", "RESEND_API_KEY", "MAILPIT_URL")` (lib/env checks them; the end-to-end
 * tests import this file, so it can't read them itself): Resend when RESEND_API_KEY is set,
 * otherwise Mailpit when MAILPIT_URL is set. Throws an EnvError when neither is, or when EMAIL_FROM
 * isn't set.
 */
export function getEmailSender(
  env: Pick<ServerEnv, "EMAIL_FROM" | "RESEND_API_KEY" | "MAILPIT_URL">,
): SendEmail {
  const from = requireEnv(
    env,
    "EMAIL_FROM",
    "every email is sent from it: noreply@mail.<Society domain> in production (decision 0005).",
  );
  if (env.RESEND_API_KEY) return createResendSender({ apiKey: env.RESEND_API_KEY, from });
  if (env.MAILPIT_URL) return createMailpitSender({ url: env.MAILPIT_URL, from });
  throw new EnvError([
    {
      key: "RESEND_API_KEY",
      message:
        "Email isn't set up: set RESEND_API_KEY to send through Resend or, locally, MAILPIT_URL " +
        "to deliver to Mailpit.",
    },
  ]);
}
