// How the daily jobs send an email at most once: claim it in the database, send it, then record the
// email service's id. The membership emails (lib/jobs/daily.ts) and the listing reminders
// (lib/jobs/listings.ts) both send this way, each with its own table of claims, whose unique
// constraint lets one run claim an email, once.

import type { OutgoingEmail, SendEmail } from "@/lib/email/send";

/** The claims of one kind of email, kept in the database. */
export interface EmailClaims<Due> {
  /** Claims an email before it's sent: its claim's id, or null when another run has claimed it. */
  claim(due: Due): Promise<number | null>;
  /** Records that the email service accepted the claimed email. */
  markSent(claimId: number, providerId: string, sentAt: Date): Promise<void>;
  /** Drops the claim of an email that wasn't sent, so the next run tries again. */
  release(claimId: number): Promise<void>;
}

export interface SendClaimedOptions<Due> {
  /** The emails due that no run had claimed when they were listed, in the order to send them. */
  due: readonly Due[];
  claims: EmailClaims<Due>;
  send: SendEmail;
  /** The email for `due`: addressed and rendered, with its idempotency key. */
  email(due: Due): Promise<OutgoingEmail>;
  /** Names `due` in the run's errors, such as "renewal_reminder for profile <id>": never an address. */
  label(due: Due): string;
  /** No email is started after this time (milliseconds since 1970); the rest wait for the next run. */
  deadline: number;
  /** The current time in milliseconds, for the deadline and sent_at. */
  clock: () => number;
}

export interface SendClaimedResult<Due> {
  /** The emails the email service accepted. */
  sent: Due[];
  /** Not sent because of an error (listed in `errors`); the next run tries them again. */
  failed: number;
  /** Claimed by another run going at the same time, which sends them. */
  claimedElsewhere: number;
  /** Not started before the deadline; the next run sends them. */
  deferred: number;
  /** What went wrong, for the logs. */
  errors: string[];
}

const describeError = (error: unknown) => (error instanceof Error ? error.message : String(error));

/** Claims, sends and records each email due, in order, until the deadline. Never throws. */
export async function sendClaimedEmails<Due>(
  options: SendClaimedOptions<Due>,
): Promise<SendClaimedResult<Due>> {
  const { due, claims, send, deadline, clock } = options;
  const result: SendClaimedResult<Due> = {
    sent: [],
    failed: 0,
    claimedElsewhere: 0,
    deferred: 0,
    errors: [],
  };

  for (const [index, item] of due.entries()) {
    if (clock() >= deadline) {
      result.deferred = due.length - index;
      break;
    }
    const label = options.label(item);
    const failed = (what: string, error: unknown) => {
      result.failed += 1;
      result.errors.push(`${what} ${label}: ${describeError(error)}`);
    };

    let claimId: number | null;
    try {
      claimId = await claims.claim(item);
    } catch (error) {
      failed("Claiming", error);
      continue;
    }
    if (claimId === null) {
      result.claimedElsewhere += 1;
      continue;
    }

    let providerId: string;
    try {
      ({ id: providerId } = await send(await options.email(item)));
    } catch (error) {
      failed("Sending", error);
      try {
        await claims.release(claimId);
      } catch (releaseError) {
        // The claim stays, so this email won't be sent: better than sending it twice.
        result.errors.push(
          `Releasing claim ${claimId} failed, so it won't be retried: ${describeError(releaseError)}`,
        );
      }
      continue;
    }

    result.sent.push(item);
    try {
      await claims.markSent(claimId, providerId, new Date(clock()));
    } catch (error) {
      // It was sent, and its claim stays, so it won't go out again; only the record is missing.
      result.errors.push(
        `Recording ${label} as sent (${providerId}) failed: ${describeError(error)}`,
      );
    }
  }
  return result;
}
