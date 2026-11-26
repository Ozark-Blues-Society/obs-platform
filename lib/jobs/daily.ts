// The daily jobs (backlog E-2, decision 0006). Netlify runs them once a day through
// app/api/cron/daily/route.ts. Each run:
//   1. brings every membership's status in line with its expiry date (lapsed at expiry, with no
//      grace period; expiring in the last 30 days);
//   2. sends the membership emails due: the renewal reminders 30 and 7 days before a membership
//      ends, for members not on yearly auto-renew, and the lapsed note 14 days after it ended.
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
import type { MembershipLevel } from "@/sanity/schemas/options";

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

/** What the jobs read and write. lib/jobs/membership-store.ts keeps it in Supabase. */
export interface MembershipStore {
  /** Sets every membership's status from its expiry date; returns how many moved to each status. */
  refreshStatuses(now: Date): Promise<Partial<Record<MembershipStatus, number>>>;
  /** The emails due at `now` that no run has claimed. */
  dueEmails(now: Date): Promise<DueMembershipEmail[]>;
  /** Claims an email before it's sent: its claim's id, or null when another run has claimed it. */
  claim(email: DueMembershipEmail): Promise<number | null>;
  /** Records that the email service accepted the claimed email. */
  markSent(claimId: number, providerId: string, sentAt: Date): Promise<void>;
  /** Drops the claim of an email that wasn't sent, so the next run tries again. */
  release(claimId: number): Promise<void>;
}

export interface DailyJobsOptions {
  /** The time of the run, which decides what's due. */
  now: Date;
  store: MembershipStore;
  send: SendEmail;
  /** The site's address, for the links in the emails. */
  siteUrl: string;
  /** No email is started after this time (milliseconds since 1970); the rest wait for the next run. */
  deadline?: number;
  /** The current time in milliseconds, for the deadline and sent_at. Defaults to Date.now. */
  clock?: () => number;
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
  /** What went wrong, for the logs. Profile ids, never addresses. */
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

  return summary;
}

async function sendMembershipEmails(options: DailyJobsOptions, summary: DailyJobsSummary) {
  const { store, send, siteUrl, deadline = Number.POSITIVE_INFINITY, clock = Date.now } = options;
  const due = await store.dueEmails(options.now);

  for (const [index, email] of due.entries()) {
    if (clock() >= deadline) {
      summary.emails.deferred = due.length - index;
      return;
    }
    const failed = (what: string, error: unknown) => {
      summary.emails.failed += 1;
      summary.errors.push(
        `${what} ${email.kind} for profile ${email.profileId}: ${describeError(error)}`,
      );
    };

    let claimId: number | null;
    try {
      claimId = await store.claim(email);
    } catch (error) {
      failed("Claiming", error);
      continue;
    }
    if (claimId === null) {
      summary.emails.claimedElsewhere += 1;
      continue;
    }

    let providerId: string;
    try {
      const rendered = await renderEmail(TEMPLATES[email.kind], {
        siteUrl,
        firstName: email.firstName,
        level: email.level,
        expiresAt: email.expiresAt,
      });
      ({ id: providerId } = await send({
        to: email.email,
        ...rendered,
        idempotencyKey: idempotencyKey(email),
      }));
    } catch (error) {
      failed("Sending", error);
      try {
        await store.release(claimId);
      } catch (releaseError) {
        // The claim stays, so this email won't be sent: better than sending it twice.
        summary.errors.push(
          `Releasing claim ${claimId} failed, so it won't be retried: ${describeError(releaseError)}`,
        );
      }
      continue;
    }

    summary.emails.sent[email.kind] += 1;
    try {
      await store.markSent(claimId, providerId, new Date(clock()));
    } catch (error) {
      // It was sent, and its claim stays, so it won't go out again; only the record is missing.
      summary.errors.push(
        `Recording ${email.kind} for profile ${email.profileId} as sent (${providerId}) failed: ${describeError(error)}`,
      );
    }
  }
}
