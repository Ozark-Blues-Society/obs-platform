// @vitest-environment node
// The daily jobs' classifieds step with a fake clock, a store kept in memory and a sender that
// records what it's given. Which listings expire or are due a reminder, on which day, is the
// database's job, tested in supabase/tests/listing_expiry_test.sql; e2e/daily-jobs.spec.ts runs
// this step against it. The claim-and-send rules it shares with the membership emails are tested in
// lib/jobs/daily.test.ts too.
import { describe, expect, it, vi } from "vitest";
import type { OutgoingEmail, SendEmail } from "@/lib/email/send";
import {
  reminderIdempotencyKey,
  runListingJobs,
  type DueListingReminder,
  type ListingJobsOptions,
  type ListingStore,
} from "./listings";

const NOW = new Date("2026-11-26T13:00:00Z");
const SITE_URL = "https://ozarkblues.example";

const VOCALIST: DueListingReminder = {
  listingId: "00000000-0000-4000-8200-000000000002",
  expiresAt: "2026-11-30T22:41:07.123+00:00",
  title: "Vocalist available for weekend gigs",
  email: "tasha.moore@example.com",
  firstName: "Tasha",
};
const DRUMS: DueListingReminder = {
  listingId: "00000000-0000-4000-8200-000000000014",
  expiresAt: "2026-12-01T18:00:00+00:00",
  title: "Drum kit, five pieces",
  email: "dale.ramsey@example.com",
  firstName: null,
};

/**
 * A store in memory that works like the database: a reminder is due until it's claimed, and a
 * reminder can be claimed once.
 */
function memoryStore(due: DueListingReminder[], expired = 2) {
  const claims = new Map<number, { reminder: DueListingReminder; providerId?: string }>();
  let nextId = 1;
  const isClaimed = (reminder: DueListingReminder) =>
    [...claims.values()].some(
      (claim) =>
        claim.reminder.listingId === reminder.listingId &&
        claim.reminder.expiresAt === reminder.expiresAt,
    );

  const store = {
    claims,
    expire: vi.fn<ListingStore["expire"]>(async () => expired),
    dueReminders: vi.fn<ListingStore["dueReminders"]>(async () =>
      due.filter((reminder) => !isClaimed(reminder)),
    ),
    claim: vi.fn<ListingStore["claim"]>(async (reminder) => {
      if (isClaimed(reminder)) return null;
      const id = nextId++;
      claims.set(id, { reminder });
      return id;
    }),
    markSent: vi.fn<ListingStore["markSent"]>(async (id, providerId) => {
      Object.assign(claims.get(id)!, { providerId });
    }),
    release: vi.fn<ListingStore["release"]>(async (id) => {
      claims.delete(id);
    }),
  };
  return store satisfies ListingStore;
}

/** A sender that records each email and answers with an id, or fails for the given addresses. */
function recordingSender(failFor: string[] = []) {
  const sent: OutgoingEmail[] = [];
  const send = vi.fn<SendEmail>(async (email) => {
    if (failFor.includes(email.to)) throw new Error("Resend refused the email (HTTP 500)");
    sent.push(email);
    return { id: `email-${sent.length}` };
  });
  return { send, sent };
}

function options(
  store: ListingStore,
  send: SendEmail,
  extra: Partial<ListingJobsOptions> = {},
): ListingJobsOptions {
  return {
    now: NOW,
    store,
    send,
    siteUrl: SITE_URL,
    deadline: Number.POSITIVE_INFINITY,
    clock: () => NOW.getTime(),
    ...extra,
  };
}

describe("runListingJobs", () => {
  it("takes down the listings whose time is up, then reminds each poster due", async () => {
    const store = memoryStore([VOCALIST, DRUMS]);
    const { send, sent } = recordingSender();

    const summary = await runListingJobs(options(store, send));

    expect(store.expire).toHaveBeenCalledExactlyOnceWith(NOW);
    expect(store.dueReminders).toHaveBeenCalledExactlyOnceWith(NOW);
    expect(store.expire.mock.invocationCallOrder[0]).toBeLessThan(
      store.dueReminders.mock.invocationCallOrder[0],
    );
    expect(sent.map(({ to, subject }) => ({ to, subject }))).toEqual([
      { to: "tasha.moore@example.com", subject: "Your classified listing expires soon" },
      { to: "dale.ramsey@example.com", subject: "Your classified listing expires soon" },
    ]);
    expect(summary).toEqual({
      expired: 2,
      reminders: { sent: 2, failed: 0, claimedElsewhere: 0, deferred: 0 },
      errors: [],
    });
  });

  it("fills the reminder from the listing, with a link to renew that listing", async () => {
    const { send, sent } = recordingSender();

    await runListingJobs(options(memoryStore([VOCALIST, DRUMS]), send));

    const [vocalist, drums] = sent;
    expect(vocalist.html).toContain("Your listing expires soon, Tasha");
    expect(vocalist.text).toMatch(/Listing +Vocalist available for weekend gigs\n/);
    // 4:41 PM on November 30 in the Ozarks.
    expect(vocalist.text).toMatch(/Expires on +November 30, 2026\n/);
    expect(vocalist.html).toContain(
      `href="${SITE_URL}/account/listings?renew=00000000-0000-4000-8200-000000000002"`,
    );
    // No first name: the greeting does without.
    expect(drums.html).toContain("Your listing expires soon<");
    expect(drums.html).not.toContain("null");
  });

  it("names each reminder for Resend, so a retried send isn't delivered twice", async () => {
    const { send } = recordingSender();

    await runListingJobs(options(memoryStore([VOCALIST]), send));

    expect(send.mock.calls[0][0].idempotencyKey).toBe(
      "listing_expiring/00000000-0000-4000-8200-000000000002/2026-11-30T22:41:07.123+00:00",
    );
    expect(reminderIdempotencyKey(VOCALIST).length).toBeLessThanOrEqual(256);
  });

  it("records each reminder as sent, and sends nothing twice when it runs again", async () => {
    const store = memoryStore([VOCALIST, DRUMS]);
    const { send, sent } = recordingSender();

    await runListingJobs(options(store, send));
    const again = await runListingJobs(options(store, send));

    expect(sent).toHaveLength(2);
    expect([...store.claims.values()].map((claim) => claim.providerId)).toEqual([
      "email-1",
      "email-2",
    ]);
    expect(again.reminders.sent).toBe(0);
  });

  it("gives up the claim of a reminder that failed, so the next run sends it", async () => {
    const store = memoryStore([VOCALIST, DRUMS]);
    const failing = recordingSender(["tasha.moore@example.com"]);

    const summary = await runListingJobs(options(store, failing.send));

    expect(failing.sent.map((email) => email.to)).toEqual(["dale.ramsey@example.com"]);
    expect(summary.reminders).toEqual({ sent: 1, failed: 1, claimedElsewhere: 0, deferred: 0 });
    expect(summary.errors).toEqual([
      "Sending the reminder for listing 00000000-0000-4000-8200-000000000002: Resend refused the email (HTTP 500)",
    ]);

    const next = recordingSender();
    await runListingJobs(options(store, next.send));

    expect(next.sent.map((email) => email.to)).toEqual(["tasha.moore@example.com"]);
  });

  it("starts no reminder after the deadline and leaves the rest for the next run", async () => {
    const store = memoryStore([VOCALIST, DRUMS]);
    const { send, sent } = recordingSender();
    let time = NOW.getTime();
    send.mockImplementation(async (email) => {
      time += 8_000;
      sent.push(email);
      return { id: `email-${sent.length}` };
    });

    const summary = await runListingJobs(
      options(store, send, { clock: () => time, deadline: NOW.getTime() + 5_000 }),
    );

    expect(sent.map((email) => email.to)).toEqual(["tasha.moore@example.com"]);
    expect(summary.reminders.deferred).toBe(1);
    expect(await store.dueReminders(NOW)).toEqual([DRUMS]);
  });

  it("still sends the reminders when taking listings down fails", async () => {
    const store = memoryStore([VOCALIST]);
    store.expire.mockRejectedValueOnce(new Error("expire_listings: 57014 timeout"));
    const { send, sent } = recordingSender();

    const summary = await runListingJobs(options(store, send));

    expect(sent).toHaveLength(1);
    expect(summary.expired).toBe(0);
    expect(summary.errors).toEqual([
      "Taking down the expired listings failed: expire_listings: 57014 timeout",
    ]);
  });

  it("reports a failure to find the reminders due, without throwing", async () => {
    const store = memoryStore([]);
    store.dueReminders.mockRejectedValueOnce(
      new Error("due_listing_reminders: PGRST202 not found"),
    );
    const { send } = recordingSender();

    const summary = await runListingJobs(options(store, send));

    expect(send).not.toHaveBeenCalled();
    expect(summary).toEqual({
      expired: 2,
      reminders: { sent: 0, failed: 0, claimedElsewhere: 0, deferred: 0 },
      errors: [
        "Finding the listing reminders due failed: due_listing_reminders: PGRST202 not found",
      ],
    });
  });
});
