// The daily jobs' classifieds step (backlog K-4, board-decisions §7), which runDailyJobs()
// (lib/jobs/daily.ts) runs after the membership emails. Each run:
//   1. takes down the live listings whose 60 days are over: their status becomes expired;
//   2. sends the reminders due: one to the poster of each live listing that comes down within 5
//      days, with a link to renew it (emails/listing-expiring.tsx).
// Which listings, on which day, is decided by the database:
// supabase/migrations/20261127221430_listing_expiry.sql. Running the job again the same day sends
// nothing twice: each reminder is claimed in listing_reminders before it's sent.

import ListingExpiringEmail from "@/emails/listing-expiring";
import { renderEmail } from "@/emails/render";
import type { SendEmail } from "@/lib/email/send";
import { sendClaimedEmails, type EmailClaims } from "./claimed-emails";

/** A reminder that is due and that no run has claimed yet (public.due_listing_reminders). */
export interface DueListingReminder {
  listingId: string;
  /** listings.expires_at, as the database returned it: the end of the run the reminder is about. */
  expiresAt: string;
  /** listings.title, as the poster wrote it. */
  title: string;
  /** The poster's address and first name, from their profile. */
  email: string;
  firstName: string | null;
}

/** What the listing step reads and writes. lib/jobs/listing-store.ts keeps it in Supabase. */
export interface ListingStore extends EmailClaims<DueListingReminder> {
  /** Marks the live listings whose expires_at is `now` or earlier as expired; returns how many. */
  expire(now: Date): Promise<number>;
  /** The reminders due at `now` that no run has claimed. */
  dueReminders(now: Date): Promise<DueListingReminder[]>;
}

export interface ListingJobsOptions {
  /** The time of the run, which decides what's due. */
  now: Date;
  store: ListingStore;
  send: SendEmail;
  /** The site's address, for the links in the emails. */
  siteUrl: string;
  /** No email is started after this time (milliseconds since 1970); the rest wait for the next run. */
  deadline: number;
  /** The current time in milliseconds, for the deadline and sent_at. */
  clock: () => number;
}

export interface ListingJobsSummary {
  /** How many live listings came down. */
  expired: number;
  reminders: {
    sent: number;
    /** Not sent because of an error; the next run tries them again. */
    failed: number;
    /** Claimed by another run going at the same time, which sends them. */
    claimedElsewhere: number;
    /** Not started before the deadline; the next run sends them. */
    deferred: number;
  };
}

const describeError = (error: unknown) => (error instanceof Error ? error.message : String(error));

/**
 * The key Resend uses to recognize a repeat of this reminder (see OutgoingEmail.idempotencyKey).
 * It names the claim's row, so a retry within 24 hours is never delivered twice.
 */
export function reminderIdempotencyKey(reminder: DueListingReminder): string {
  return `listing_expiring/${reminder.listingId}/${reminder.expiresAt}`;
}

/**
 * Runs the classifieds step once. Never throws: what failed is in `errors` (listing ids, never
 * addresses).
 */
export async function runListingJobs(
  options: ListingJobsOptions,
): Promise<ListingJobsSummary & { errors: string[] }> {
  const { now, store, send, siteUrl } = options;
  const summary: ListingJobsSummary & { errors: string[] } = {
    expired: 0,
    reminders: { sent: 0, failed: 0, claimedElsewhere: 0, deferred: 0 },
    errors: [],
  };

  try {
    summary.expired = await store.expire(now);
  } catch (error) {
    summary.errors.push(`Taking down the expired listings failed: ${describeError(error)}`);
  }

  let due: DueListingReminder[];
  try {
    due = await store.dueReminders(now);
  } catch (error) {
    summary.errors.push(`Finding the listing reminders due failed: ${describeError(error)}`);
    return summary;
  }

  const { sent, errors, ...counts } = await sendClaimedEmails({
    due,
    claims: store,
    send,
    deadline: options.deadline,
    clock: options.clock,
    label: (reminder) => `the reminder for listing ${reminder.listingId}`,
    email: async (reminder) => ({
      to: reminder.email,
      ...(await renderEmail(ListingExpiringEmail, {
        siteUrl,
        firstName: reminder.firstName,
        listingId: reminder.listingId,
        listingTitle: reminder.title,
        expiresAt: reminder.expiresAt,
      })),
      idempotencyKey: reminderIdempotencyKey(reminder),
    }),
  });
  summary.reminders = { sent: sent.length, ...counts };
  summary.errors.push(...errors);
  return summary;
}
