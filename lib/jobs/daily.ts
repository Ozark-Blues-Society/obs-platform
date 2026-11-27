// The daily jobs (backlog E-2, decision 0006). Netlify runs them once a day through
// app/api/cron/daily/route.ts. Each run:
//   1. brings every membership's status in line with its expiry date (lapsed at expiry, with no
//      grace period; expiring in the last 30 days);
//   2. sends the membership emails due: the renewal reminders 30 and 7 days before a membership
//      ends, for members not on yearly auto-renew, and the lapsed note 14 days after it ended;
//   3. takes down the classifieds listings whose 60 days are over and reminds posters 5 days before
//      (backlog K-4, lib/jobs/listings.ts);
//   4. syncs the member groups in MailerLite (backlog E-3, lib/mailerlite/sync.ts), once the
//      statuses are up to date, when MAILERLITE_API_KEY is set.
// Which emails are due, on which day, is decided by the database:
// supabase/migrations/20261126143035_membership_emails.sql. Running the job again the same day
// sends nothing twice: each email is claimed in membership_emails before it's sent.
//
// Everything that depends on time takes `now`, so tests run it with a fake clock.

import type { RenewalReminderProps } from "@/emails/_components/renewal";
import type { EmailTemplate } from "@/emails/_lib/template";
import MembershipLapsedEmail from "@/emails/membership-lapsed";
import { renderEmail } from "@/emails/render";
import RenewalLastReminderEmail from "@/emails/renewal-last-reminder";
import RenewalReminderEmail from "@/emails/renewal-reminder";
import type { SendEmail } from "@/lib/email/send";
import type { MailerLiteClient } from "@/lib/mailerlite/client";
import {
  syncMailerLite,
  type MailerLiteStore,
  type MailerLiteSyncCounts,
} from "@/lib/mailerlite/sync";
import type { MembershipLevel } from "@/sanity/schemas/options";
import { sendClaimedEmails, type EmailClaims } from "./claimed-emails";
import { runListingJobs, type ListingJobsSummary, type ListingStore } from "./listings";

export const MEMBERSHIP_STATUSES = ["active", "expiring", "lapsed"] as const;
export type MembershipStatus = (typeof MEMBERSHIP_STATUSES)[number];

export const MEMBERSHIP_EMAIL_KINDS = [
  "renewal_reminder",
  "renewal_last_reminder",
  "membership_lapsed",
] as const;
/** public.membership_email_kind: which email it is. */
export type MembershipEmailKind = (typeof MEMBERSHIP_EMAIL_KINDS)[number];

/** The template for each kind. All three take the member's name, level and expiry date. */
const TEMPLATES: Record<MembershipEmailKind, EmailTemplate<RenewalReminderProps>> = {
  renewal_reminder: RenewalReminderEmail,
  renewal_last_reminder: RenewalLastReminderEmail,
  membership_lapsed: MembershipLapsedEmail,
};

/** An email that is due and that no run has claimed yet (public.due_membership_emails). */
export interface DueMembershipEmail {
  profileId: string;
  kind: MembershipEmailKind;
  /** profiles.expires_at, as the database returned it: the membership end the email is about. */
  expiresAt: string;
  email: string;
  firstName: string | null;
  level: MembershipLevel;
}

/**
 * What the membership jobs read and write, with the claims of the emails (membership_emails).
 * lib/jobs/membership-store.ts keeps it in Supabase.
 */
export interface MembershipStore extends EmailClaims<DueMembershipEmail> {
  /** Sets every membership's status from its expiry date; returns how many moved to each status. */
  refreshStatuses(now: Date): Promise<Partial<Record<MembershipStatus, number>>>;
  /** The emails due at `now` that no run has claimed. */
  dueEmails(now: Date): Promise<DueMembershipEmail[]>;
}

export interface DailyJobsOptions {
  /** The time of the run, which decides what's due. */
  now: Date;
  store: MembershipStore;
  /** The classifieds listings (lib/jobs/listing-store.ts). */
  listings: ListingStore;
  send: SendEmail;
  /** The site's address, for the links in the emails. */
  siteUrl: string;
  /** No email is started after this time (milliseconds since 1970); the rest wait for the next run. */
  deadline?: number;
  /** The current time in milliseconds, for the deadline and sent_at. Defaults to Date.now. */
  clock?: () => number;
  /** For the MailerLite group sync. Left out while it's off (no MAILERLITE_API_KEY). */
  mailerLite?: { client: MailerLiteClient; store: MailerLiteStore };
}

export interface DailyJobsSummary {
  ranAt: string;
  /** How many memberships moved to each status. */
  statuses: Record<MembershipStatus, number>;
  emails: {
    sent: Record<MembershipEmailKind, number>;
    /** Not sent because of an error (listed in `errors`); the next run tries them again. */
    failed: number;
    /** Claimed by another run going at the same time, which sends them. */
    claimedElsewhere: number;
    /** Not started before the deadline; the next run sends them. */
    deferred: number;
  };
  /** The listings taken down, and the reminders to their posters. */
  listings: ListingJobsSummary;
  /** What the MailerLite group sync did, or "off" without MAILERLITE_API_KEY. */
  mailerLite: MailerLiteSyncCounts | "off";
  /** What went wrong, for the logs. Profile and listing ids, never addresses. */
  errors: string[];
}

const zeros = <Key extends string>(keys: readonly Key[]) =>
  Object.fromEntries(keys.map((key) => [key, 0])) as Record<Key, number>;

const describeError = (error: unknown) => (error instanceof Error ? error.message : String(error));

/**
 * The key Resend uses to recognize a repeat of this email (see OutgoingEmail.idempotencyKey). It
 * names the claim's row, so a retry of the same email within 24 hours is never delivered twice.
 */
export function idempotencyKey(email: DueMembershipEmail): string {
  return `${email.kind}/${email.profileId}/${email.expiresAt}`;
}

/** Runs the daily jobs once. Never throws: what failed is in the summary's `errors`. */
export async function runDailyJobs(options: DailyJobsOptions): Promise<DailyJobsSummary> {
  const summary: DailyJobsSummary = {
    ranAt: options.now.toISOString(),
    statuses: zeros(MEMBERSHIP_STATUSES),
    emails: {
      sent: zeros(MEMBERSHIP_EMAIL_KINDS),
      failed: 0,
      claimedElsewhere: 0,
      deferred: 0,
    },
    listings: {
      expired: 0,
      reminders: { sent: 0, failed: 0, claimedElsewhere: 0, deferred: 0 },
    },
    mailerLite: "off",
    errors: [],
  };

  try {
    const moved = await options.store.refreshStatuses(options.now);
    for (const status of MEMBERSHIP_STATUSES) summary.statuses[status] = moved[status] ?? 0;
  } catch (error) {
    summary.errors.push(`Updating the membership statuses failed: ${describeError(error)}`);
  }

  try {
    await sendMembershipEmails(options, summary);
  } catch (error) {
    summary.errors.push(`Finding the membership emails due failed: ${describeError(error)}`);
  }

  // Within what's left of the run's time; it never throws.
  const { errors: listingErrors, ...listings } = await runListingJobs({
    now: options.now,
    store: options.listings,
    send: options.send,
    siteUrl: options.siteUrl,
    deadline: options.deadline ?? Number.POSITIVE_INFINITY,
    clock: options.clock ?? Date.now,
  });
  summary.listings = listings;
  summary.errors.push(...listingErrors);

  if (options.mailerLite) {
    // Within what's left of the run's time; it never throws.
    const { errors, ...counts } = await syncMailerLite({
      ...options.mailerLite,
      deadline: options.deadline,
      clock: options.clock,
    });
    summary.mailerLite = counts;
    summary.errors.push(...errors);
  }

  return summary;
}

async function sendMembershipEmails(options: DailyJobsOptions, summary: DailyJobsSummary) {
  const { store, send, siteUrl, deadline = Number.POSITIVE_INFINITY, clock = Date.now } = options;
  const due = await store.dueEmails(options.now);

  const { sent, errors, ...counts } = await sendClaimedEmails({
    due,
    claims: store,
    send,
    deadline,
    clock,
    label: (email) => `${email.kind} for profile ${email.profileId}`,
    email: async (email) => ({
      to: email.email,
      ...(await renderEmail(TEMPLATES[email.kind], {
        siteUrl,
        firstName: email.firstName,
        level: email.level,
        expiresAt: email.expiresAt,
      })),
      idempotencyKey: idempotencyKey(email),
    }),
  });
  for (const email of sent) summary.emails.sent[email.kind] += 1;
  Object.assign(summary.emails, counts);
  summary.errors.push(...errors);
}
