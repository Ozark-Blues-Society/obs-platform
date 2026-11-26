import { expect, type APIRequestContext } from "@playwright/test";

// Mailpit catches every email the local Supabase stack sends (see "Local Supabase" in the README),
// and locally the app's own emails too (lib/email/send.ts).
export const MAILPIT_URL = process.env.MAILPIT_URL ?? "http://127.0.0.1:54324";

type MessageSummary = { ID: string; Subject: string };

function sentTo(address: string) {
  return { query: `to:"${address}"` };
}

/** Deletes every email sent to `address`, so a test only sees the emails it causes. */
export async function clearInbox(request: APIRequestContext, address: string): Promise<void> {
  const response = await request.delete(`${MAILPIT_URL}/api/v1/search`, {
    params: sentTo(address),
  });
  expect(response.ok(), `Mailpit at ${MAILPIT_URL} should answer`).toBe(true);
}

/** The emails Mailpit holds for `address`, newest first: each one's id and subject. */
export async function emailsTo(
  request: APIRequestContext,
  address: string,
): Promise<MessageSummary[]> {
  const response = await request.get(`${MAILPIT_URL}/api/v1/search`, { params: sentTo(address) });
  expect(response.ok(), `Mailpit at ${MAILPIT_URL} should answer`).toBe(true);
  const { messages } = (await response.json()) as { messages: MessageSummary[] };
  return messages.map(({ ID, Subject }) => ({ ID, Subject }));
}

/** Waits for the sign-in email sent to `address` and returns the link in it. */
export async function signInLinkFor(request: APIRequestContext, address: string): Promise<URL> {
  let id = "";
  await expect
    .poll(
      async () => {
        const response = await request.get(`${MAILPIT_URL}/api/v1/search`, {
          params: { ...sentTo(address), limit: 1 },
        });
        const { messages } = (await response.json()) as { messages: MessageSummary[] };
        id = messages[0]?.ID ?? "";
        return id;
      },
      { message: `a sign-in email to ${address}`, timeout: 15_000 },
    )
    .not.toBe("");

  const response = await request.get(`${MAILPIT_URL}/api/v1/message/${id}`);
  const message = (await response.json()) as { Subject: string; HTML: string };
  expect(message.Subject).toBe("Your Ozark Blues Society sign-in link");

  const href = /href="([^"]*\/auth\/confirm\?[^"]*)"/.exec(message.HTML)?.[1];
  if (!href) {
    throw new Error(`The sign-in email to ${address} has no /auth/confirm link:\n${message.HTML}`);
  }
  return new URL(href.replaceAll("&amp;", "&"));
}
