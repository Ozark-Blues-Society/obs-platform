import { expect, type APIRequestContext } from "@playwright/test";
import type { SubscriberStatus } from "../../lib/mailerlite/fake-api";

// The end-to-end tests' view of the MailerLite stand-in (e2e/support/mailerlite-stand-in.mts),
// which Playwright starts and the app talks to instead of MailerLite (playwright.config.ts).

/** The stand-in's address: MAILERLITE_STAND_IN_PORT, or E2E_PORT + 500 as in playwright.config.ts. */
export const MAILERLITE_STAND_IN_URL = `http://127.0.0.1:${
  process.env.MAILERLITE_STAND_IN_PORT ?? Number(process.env.E2E_PORT ?? 3000) + 500
}`;

/** A subscriber as the stand-in has them. */
export type StandInSubscriber = {
  status: SubscriberStatus;
  /** The names of their groups, sorted. */
  groups: string[];
  /** How many times MailerLite would have emailed them a link to confirm their address. */
  confirmationEmails: number;
};

/** The subscriber with this address in the stand-in, or null. */
export async function standInSubscriber(
  request: APIRequestContext,
  email: string,
): Promise<StandInSubscriber | null> {
  const response = await request.get(`${MAILERLITE_STAND_IN_URL}/stand-in/subscriber`, {
    params: { email },
  });
  if (response.status() === 404) return null;
  expect(response.status()).toBe(200);
  return (await response.json()) as StandInSubscriber;
}

/** Puts a subscriber in the stand-in, as MailerLite would have them before the test. */
export async function putStandInSubscriber(
  request: APIRequestContext,
  email: string,
  subscriber: { status: SubscriberStatus; groups: string[] },
) {
  const response = await request.put(`${MAILERLITE_STAND_IN_URL}/stand-in/subscriber`, {
    params: { email },
    data: subscriber,
  });
  expect(response.status()).toBe(200);
}

/** Makes the stand-in answer the next request about this address with an error. */
export async function failStandInOnce(request: APIRequestContext, email: string, status = 500) {
  const response = await request.post(`${MAILERLITE_STAND_IN_URL}/stand-in/fail`, {
    params: { email },
    data: { status },
  });
  expect(response.status()).toBe(200);
}
