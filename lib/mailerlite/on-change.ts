import "server-only";
import { serverEnv } from "@/lib/env/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getMailerLiteClient } from "./client";
import { createMailerLiteStore } from "./store";
import { syncMailerLite, type MailerLiteSyncSummary } from "./sync";

/** How long a sync after a change may keep calling MailerLite; the nightly run does the rest. */
const ON_CHANGE_BUDGET_MS = 10_000;

/**
 * Syncs these members' MailerLite groups now, after server code changed their membership (level,
 * status or expiry), address or name: the Stripe webhook, recording a payment, the importer. Call
 * it once the change is saved, inside `after()` from next/server so the answer isn't held up:
 *
 *     after(() => syncMembersToMailerLite([profileId]));
 *
 * Meant for a few members at a time; the nightly run (lib/jobs/daily.ts) syncs everyone. Does
 * nothing while the sync is off (no MAILERLITE_API_KEY). Never throws: it logs what failed, and the
 * nightly run tries again.
 */
export async function syncMembersToMailerLite(
  profileIds: readonly string[],
): Promise<MailerLiteSyncSummary | "off"> {
  const client = getMailerLiteClient(serverEnv("MAILERLITE_API_KEY"));
  if (!client) return "off";
  let summary: MailerLiteSyncSummary;
  try {
    summary = await syncMailerLite({
      client,
      store: createMailerLiteStore(createAdminClient()),
      profileIds,
      deadline: Date.now() + ON_CHANGE_BUDGET_MS,
    });
  } catch (error) {
    // The service role isn't configured (createAdminClient).
    const message = error instanceof Error ? error.message : String(error);
    summary = {
      ...{ synced: 0, removed: 0, claimedElsewhere: 0, deferred: 0 },
      failed: profileIds.length,
      errors: [`MailerLite sync: couldn't start: ${message}`],
    };
  }
  if (summary.errors.length > 0) {
    console.error(`The MailerLite sync after a change ran with errors: ${JSON.stringify(summary)}`);
  }
  return summary;
}
