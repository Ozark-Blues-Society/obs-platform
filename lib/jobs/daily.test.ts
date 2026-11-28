// @vitest-environment node
// The daily jobs with a fake clock, a store kept in memory and a sender that records what it's
// given. Which emails are due on which day is the database's job, tested in
// supabase/tests/membership_emails_test.sql; e2e/daily-jobs.spec.ts runs these jobs against it.
// The classifieds step is tested in lib/jobs/listings.test.ts; here, only where it runs.
import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { SOCIETY_TIME_ZONE } from "@/sanity/schemas/options";
import type { OutgoingEmail, SendEmail } from "@/lib/email/send";
import type { MailerLiteClient } from "@/lib/mailerlite/client";
import type { MailerLiteStore, MailerLiteSyncSummary } from "@/lib/mailerlite/sync";
import {
  idempotencyKey,
  runDailyJobs,
  type DailyJobsOptions,
  type DueMembershipEmail,
  type MembershipStore,
} from "./daily";
import type { DueListingReminder, ListingStore } from "./listings";

// A stand-in for the MailerLite group sync: lib/mailerlite/sync.test.ts tests it.
const mailerLite = vi.hoisted(() => ({ syncMailerLite: vi.fn() }));
vi.mock("@/lib/mailerlite/sync", () => mailerLite);

const NOW = new Date("2026-11-26T13:00:00Z");
const SITE_URL = "https://ozarkblues.example";

const REMINDER: DueMembershipEmail = {
  profileId: "00000000-0000-4000-8100-000000000011",
  kind: "renewal_reminder",
  expiresAt: "2026-12-26T18:00:00+00:00",
  email: "bev.grant@example.com",
  firstName: "Bev",
  level: "individual",
};
const LAST_REMINDER: DueMembershipEmail = {
  profileId: "00000000-0000-4000-8100-000000000012",
  kind: "renewal_last_reminder",
  expiresAt: "2026-12-03T18:00:00+00:00",
  email: "otis.ivy@example.com",
  firstName: null,
  level: "individual",
};
const LAPSED: DueMembershipEmail = {
  profileId: "00000000-0000-4000-8100-000000000014",
  kind: "membership_lapsed",
  expiresAt: "2026-11-12T18:00:00+00:00",
  email: "lena.park@example.com",
  firstName: "Lena",
  level: "band",
};

type Claim = { email: DueMembershipEmail; providerId?: string; sentAt?: Date };

/**
 * A store in memory that works like the database: an email is due until it's claimed, and an email
 * can be claimed once.
 */
function memoryStore(due: DueMembershipEmail[]) {
  const claims = new Map<number, Claim>();
  let nextId = 1;
  const same = (a: DueMembershipEmail, b: DueMembershipEmail) =>
    a.profileId === b.profileId && a.kind === b.kind && a.expiresAt === b.expiresAt;
  const isClaimed = (email: DueMembershipEmail) =>
    [...claims.values()].some((claim) => same(claim.email, email));

  const store = {
    claims,
    refreshStatuses: vi.fn<MembershipStore["refreshStatuses"]>(async () => ({
      expiring: 2,
      lapsed: 1,
    })),
    dueEmails: vi.fn<MembershipStore["dueEmails"]>(async () =>
      due.filter((email) => !isClaimed(email)),
    ),
    claim: vi.fn<MembershipStore["claim"]>(async (email) => {
      if (isClaimed(email)) return null;
      const id = nextId++;
      claims.set(id, { email });
      return id;
    }),
    markSent: vi.fn<MembershipStore["markSent"]>(async (id, providerId, sentAt) => {
      Object.assign(claims.get(id)!, { providerId, sentAt });
    }),
    release: vi.fn<MembershipStore["release"]>(async (id) => {
      claims.delete(id);
    }),
  };
  return store satisfies MembershipStore;
}

/** A classifieds store in memory: `expired` listings come down, and `due` reminders go out once. */
function listingStore(due: DueListingReminder[] = [], expired = 0) {
  const claimed = new Set<string>();
  const store = {
    expire: vi.fn<ListingStore["expire"]>(async () => expired),
    dueReminders: vi.fn<ListingStore["dueReminders"]>(async () =>
      due.filter((reminder) => !claimed.has(reminder.listingId)),
    ),
    claim: vi.fn<ListingStore["claim"]>(async (reminder) => {
      if (claimed.has(reminder.listingId)) return null;
      claimed.add(reminder.listingId);
      return claimed.size;
    }),
    markSent: vi.fn<ListingStore["markSent"]>(async () => {}),
    release: vi.fn<ListingStore["release"]>(async () => {}),
  };
  return store satisfies ListingStore;
}

const VOCALIST: DueListingReminder = {
  listingId: "00000000-0000-4000-8200-000000000002",
  expiresAt: "2026-11-30T22:41:07.123+00:00",
  title: "Vocalist available for weekend gigs",
  email: "tasha.moore@example.com",
  firstName: "Tasha",
};

/** A sender that records each email and answers with an id, or fails for the given addresses. */
function recordingSender(failFor: string[] = []) {
  const sent: OutgoingEmail[] = [];
  const send = vi.fn<SendEmail>(async (email) => {
    if (failFor.includes(email.to)) {
      throw new Error("Resend refused the email (HTTP 422 validation_error): Invalid `to` field.");
    }
    sent.push(email);
    return { id: `email-${sent.length}` };
  });
  return { send, sent };
}

function options(
  store: MembershipStore,
  send: SendEmail,
  extra: Partial<DailyJobsOptions> = {},
): DailyJobsOptions {
  return {
    now: NOW,
    store,
    listings: listingStore(),
    send,
    siteUrl: SITE_URL,
    clock: () => NOW.getTime(),
    ...extra,
  };
}

describe("runDailyJobs", () => {
  it("updates the statuses, then sends each email due with its template", async () => {
    const store = memoryStore([REMINDER, LAST_REMINDER, LAPSED]);
    const { send, sent } = recordingSender();

    const summary = await runDailyJobs(options(store, send));

    expect(store.refreshStatuses).toHaveBeenCalledExactlyOnceWith(NOW);
    expect(store.dueEmails).toHaveBeenCalledExactlyOnceWith(NOW);
    expect(sent.map(({ to, subject }) => ({ to, subject }))).toEqual([
      { to: "bev.grant@example.com", subject: "Time to renew your Ozark Blues Society membership" },
      {
        to: "otis.ivy@example.com",
        subject: "Last reminder: your membership ends on December 3, 2026",
      },
      { to: "lena.park@example.com", subject: "Your Ozark Blues Society membership has ended" },
    ]);
    expect(summary).toEqual({
      ranAt: "2026-11-26T13:00:00.000Z",
      statuses: { active: 0, expiring: 2, lapsed: 1 },
      emails: {
        sent: { renewal_reminder: 1, renewal_last_reminder: 1, membership_lapsed: 1 },
        failed: 0,
        claimedElsewhere: 0,
        deferred: 0,
      },
      listings: { expired: 0, reminders: { sent: 0, failed: 0, claimedElsewhere: 0, deferred: 0 } },
      mailerLite: "off",
      errors: [],
    });
    expect(mailerLite.syncMailerLite).not.toHaveBeenCalled();
  });

  it("then takes down the listings whose time is up and reminds posters, in the time left", async () => {
    const store = memoryStore([REMINDER]);
    const listings = listingStore([VOCALIST], 3);
    const { send, sent } = recordingSender();
    mailerLite.syncMailerLite.mockResolvedValueOnce({
      ...{ synced: 0, removed: 0, claimedElsewhere: 0, deferred: 0, failed: 0 },
      errors: [],
    });
    const sync = {
      client: { kind: "MailerLite client" } as unknown as MailerLiteClient,
      store: { kind: "MailerLite store" } as unknown as MailerLiteStore,
    };

    const summary = await runDailyJobs(options(store, send, { listings, mailerLite: sync }));

    expect(listings.expire).toHaveBeenCalledExactlyOnceWith(NOW);
    expect(sent.map((email) => email.to)).toEqual([
      "bev.grant@example.com",
      "tasha.moore@example.com",
    ]);
    expect(summary.listings).toEqual({
      expired: 3,
      reminders: { sent: 1, failed: 0, claimedElsewhere: 0, deferred: 0 },
    });
    // After the membership emails, before the MailerLite sync.
    expect(store.dueEmails.mock.invocationCallOrder[0]).toBeLessThan(
      listings.expire.mock.invocationCallOrder[0],
    );
    expect(listings.dueReminders.mock.invocationCallOrder[0]).toBeLessThan(
      mailerLite.syncMailerLite.mock.invocationCallOrder[0],
    );
  });

  it("starts no listing reminder once the membership emails have used up the time", async () => {
    const store = memoryStore([REMINDER]);
    const listings = listingStore([VOCALIST], 1);
    const { send, sent } = recordingSender();
    let time = NOW.getTime();
    send.mockImplementation(async (email) => {
      time += 12_000;
      sent.push(email);
      return { id: `email-${sent.length}` };
    });

    const summary = await runDailyJobs(
      options(store, send, { listings, clock: () => time, deadline: NOW.getTime() + 10_000 }),
    );

    expect(sent.map((email) => email.to)).toEqual(["bev.grant@example.com"]);
    // Taking listings down sends nothing, so it still happens.
    expect(summary.listings).toEqual({
      expired: 1,
      reminders: { sent: 0, failed: 0, claimedElsewhere: 0, deferred: 1 },
    });
  });

  it("reports what the listing step got wrong with the rest of the run's errors", async () => {
    const listings = listingStore([VOCALIST]);
    listings.expire.mockRejectedValueOnce(new Error("expire_listings: 57014 timeout"));
    const { send } = recordingSender(["tasha.moore@example.com"]);

    const summary = await runDailyJobs(options(memoryStore([]), send, { listings }));

    expect(summary.errors).toEqual([
      "Taking down the expired listings failed: expire_listings: 57014 timeout",
      "Sending the reminder for listing 00000000-0000-4000-8200-000000000002: Resend refused the email (HTTP 422 validation_error): Invalid `to` field.",
    ]);
    expect(summary.errors.join()).not.toContain("tasha.moore@example.com");
  });

  it("then syncs the MailerLite groups, in the time left, and reports what it did", async () => {
    const store = memoryStore([REMINDER]);
    const { send } = recordingSender();
    const sync = {
      client: { kind: "MailerLite client" } as unknown as MailerLiteClient,
      store: { kind: "MailerLite store" } as unknown as MailerLiteStore,
    };
    const clock = () => NOW.getTime();
    const synced: MailerLiteSyncSummary = {
      ...{ synced: 2, removed: 1, claimedElsewhere: 0, deferred: 3, failed: 1 },
      errors: ["MailerLite sync: syncing profile p1 failed: MailerLite refused (HTTP 422)"],
    };
    mailerLite.syncMailerLite.mockResolvedValueOnce(synced);

    const summary = await runDailyJobs(
      options(store, send, { mailerLite: sync, clock, deadline: NOW.getTime() + 15_000 }),
    );

    expect(mailerLite.syncMailerLite).toHaveBeenCalledExactlyOnceWith({
      ...sync,
      clock,
      deadline: NOW.getTime() + 15_000,
    });
    // After the statuses are up to date and the emails sent.
    const [syncOrder] = mailerLite.syncMailerLite.mock.invocationCallOrder;
    expect(store.refreshStatuses.mock.invocationCallOrder[0]).toBeLessThan(syncOrder);
    expect(send.mock.invocationCallOrder[0]).toBeLessThan(syncOrder);
    expect(summary.mailerLite).toEqual({
      synced: 2,
      removed: 1,
      claimedElsewhere: 0,
      deferred: 3,
      failed: 1,
    });
    expect(summary.errors).toEqual(synced.errors);
  });

  it("fills each template from the member's profile, with links to the site", async () => {
    const { send, sent } = recordingSender();

    await runDailyJobs(options(memoryStore([REMINDER, LAST_REMINDER]), send));

    const [reminder, lastReminder] = sent;
    expect(reminder.html).toContain("Time to renew, Bev");
    expect(reminder.text).toContain("Your membership ends on December 26, 2026.");
    expect(reminder.text).toMatch(/Membership +Individual\n/);
    expect(reminder.html).toContain(`href="${SITE_URL}/join"`);
    // No first name: the greeting does without.
    expect(lastReminder.html).not.toContain("null");
    expect(lastReminder.text).toContain("December 3, 2026");
  });

  it("names each email for Resend, so a retried send isn't delivered twice", async () => {
    const { send } = recordingSender();

    await runDailyJobs(options(memoryStore([REMINDER]), send));

    expect(send.mock.calls[0][0].idempotencyKey).toBe(
      "renewal_reminder/00000000-0000-4000-8100-000000000011/2026-12-26T18:00:00+00:00",
    );
    expect(idempotencyKey(REMINDER).length).toBeLessThanOrEqual(256);
  });

  it("records each email as sent, with the email service's id and the time", async () => {
    const store = memoryStore([REMINDER, LAPSED]);
    const { send } = recordingSender();
    const sentAt = NOW.getTime() + 1500;

    await runDailyJobs(options(store, send, { clock: () => sentAt }));

    expect([...store.claims.values()]).toEqual([
      { email: REMINDER, providerId: "email-1", sentAt: new Date(sentAt) },
      { email: LAPSED, providerId: "email-2", sentAt: new Date(sentAt) },
    ]);
  });

  it("sends nothing twice when it runs again the same day", async () => {
    const store = memoryStore([REMINDER, LAST_REMINDER, LAPSED]);
    const { send, sent } = recordingSender();

    await runDailyJobs(options(store, send));
    const again = await runDailyJobs(options(store, send));

    expect(sent).toHaveLength(3);
    expect(again.emails.sent).toEqual({
      renewal_reminder: 0,
      renewal_last_reminder: 0,
      membership_lapsed: 0,
    });
  });

  it("leaves an email another run has claimed to that run", async () => {
    const store = memoryStore([REMINDER, LAPSED]);
    // Another run claims the reminder between this run's list and its claim.
    await store.claim(REMINDER);
    store.dueEmails.mockResolvedValueOnce([REMINDER, LAPSED]);
    const { send, sent } = recordingSender();

    const summary = await runDailyJobs(options(store, send));

    expect(sent.map((email) => email.to)).toEqual(["lena.park@example.com"]);
    expect(summary.emails.claimedElsewhere).toBe(1);
    expect(summary.errors).toEqual([]);
  });

  it("gives up the claim of an email that failed, so the next run sends it", async () => {
    const store = memoryStore([REMINDER, LAPSED]);
    const failing = recordingSender(["bev.grant@example.com"]);

    const summary = await runDailyJobs(options(store, failing.send));

    expect(failing.sent.map((email) => email.to)).toEqual(["lena.park@example.com"]);
    expect(summary.emails.failed).toBe(1);
    expect(summary.emails.sent.membership_lapsed).toBe(1);
    expect(summary.errors).toEqual([
      "Sending renewal_reminder for profile 00000000-0000-4000-8100-000000000011: Resend refused the email (HTTP 422 validation_error): Invalid `to` field.",
    ]);
    expect(summary.errors.join()).not.toContain("bev.grant@example.com");
    expect(store.release).toHaveBeenCalledExactlyOnceWith(1);

    const next = recordingSender();
    const nextSummary = await runDailyJobs(options(store, next.send));

    expect(next.sent.map((email) => email.to)).toEqual(["bev.grant@example.com"]);
    expect(nextSummary.emails.failed).toBe(0);
  });

  it("gives up the claim of an email that couldn't be rendered", async () => {
    const store = memoryStore([{ ...REMINDER, expiresAt: "soon" }]);
    const { send, sent } = recordingSender();

    const summary = await runDailyJobs(options(store, send));

    expect(sent).toEqual([]);
    expect(summary.emails.failed).toBe(1);
    expect(summary.errors).toEqual([
      'Sending renewal_reminder for profile 00000000-0000-4000-8100-000000000011: Not a date: "soon"',
    ]);
    expect(store.claims.size).toBe(0);
  });

  it("keeps the claim when giving it up fails: better a missed email than a duplicate", async () => {
    const store = memoryStore([REMINDER]);
    store.release.mockRejectedValueOnce(new Error("fetch failed"));
    const failing = recordingSender(["bev.grant@example.com"]);

    const summary = await runDailyJobs(options(store, failing.send));

    expect(store.claims.size).toBe(1);
    expect(summary.errors).toEqual([
      expect.stringContaining("Sending renewal_reminder for profile"),
      "Releasing claim 1 failed, so it won't be retried: fetch failed",
    ]);
  });

  it("counts an email as sent when only recording it fails, and keeps its claim", async () => {
    const store = memoryStore([REMINDER]);
    store.markSent.mockRejectedValueOnce(
      new Error("Recording in membership_emails: 57014 timeout"),
    );
    const { send, sent } = recordingSender();

    const summary = await runDailyJobs(options(store, send));

    expect(sent).toHaveLength(1);
    expect(summary.emails.sent.renewal_reminder).toBe(1);
    expect(summary.emails.failed).toBe(0);
    expect(store.release).not.toHaveBeenCalled();
    expect(summary.errors).toEqual([
      "Recording renewal_reminder for profile 00000000-0000-4000-8100-000000000011 as sent (email-1) failed: Recording in membership_emails: 57014 timeout",
    ]);
  });

  it("starts no email after the deadline and leaves the rest for the next run", async () => {
    const store = memoryStore([REMINDER, LAST_REMINDER, LAPSED]);
    const { send, sent } = recordingSender();
    // Each email takes 8 seconds.
    let time = NOW.getTime();
    send.mockImplementation(async (email) => {
      time += 8_000;
      sent.push(email);
      return { id: `email-${sent.length}` };
    });

    const summary = await runDailyJobs(
      options(store, send, { clock: () => time, deadline: NOW.getTime() + 10_000 }),
    );

    expect(sent.map((email) => email.to)).toEqual([
      "bev.grant@example.com",
      "otis.ivy@example.com",
    ]);
    expect(summary.emails.deferred).toBe(1);
    expect(store.claims.size).toBe(2);
    expect(await store.dueEmails(NOW)).toEqual([LAPSED]);
  });

  it("still sends the emails when updating the statuses fails", async () => {
    const store = memoryStore([REMINDER]);
    store.refreshStatuses.mockRejectedValueOnce(
      new Error("refresh_membership_statuses: 42501 denied"),
    );
    const { send, sent } = recordingSender();

    const summary = await runDailyJobs(options(store, send));

    expect(sent).toHaveLength(1);
    expect(summary.statuses).toEqual({ active: 0, expiring: 0, lapsed: 0 });
    expect(summary.errors).toEqual([
      "Updating the membership statuses failed: refresh_membership_statuses: 42501 denied",
    ]);
  });

  it("reports a failure to find the emails due, without throwing", async () => {
    const store = memoryStore([]);
    store.dueEmails.mockRejectedValueOnce(new Error("due_membership_emails: PGRST202 not found"));
    const { send } = recordingSender();

    const summary = await runDailyJobs(options(store, send));

    expect(send).not.toHaveBeenCalled();
    expect(summary.errors).toEqual([
      "Finding the membership emails due failed: due_membership_emails: PGRST202 not found",
    ]);
  });

  it("goes on to the next email when a claim fails", async () => {
    const store = memoryStore([REMINDER, LAPSED]);
    store.claim.mockRejectedValueOnce(new Error("Claiming in membership_emails: 08006 lost"));
    const { send, sent } = recordingSender();

    const summary = await runDailyJobs(options(store, send));

    expect(sent.map((email) => email.to)).toEqual(["lena.park@example.com"]);
    expect(summary.emails.failed).toBe(1);
    expect(summary.errors).toEqual([
      "Claiming renewal_reminder for profile 00000000-0000-4000-8100-000000000011: Claiming in membership_emails: 08006 lost",
    ]);
  });
});

describe("the database's calendar", () => {
  it("counts days in the Society's time zone, the one the emails show dates in", () => {
    const migration = readFileSync(
      new URL("../../supabase/migrations/20261126143035_membership_emails.sql", import.meta.url),
      "utf8",
    );
    const zones = new Set(
      [...migration.matchAll(/at time zone '([^']+)'/g)].map(([, zone]) => zone),
    );

    expect([...zones]).toEqual([SOCIETY_TIME_ZONE]);
  });
});
