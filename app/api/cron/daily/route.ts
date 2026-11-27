import { createHash, timingSafeEqual } from "node:crypto";
import { getEmailSender } from "@/lib/email/send";
import { serverEnv } from "@/lib/env/server";
import { runDailyJobs, type DailyJobsSummary } from "@/lib/jobs/daily";
import { createMembershipStore } from "@/lib/jobs/membership-store";
import { getMailerLiteClient } from "@/lib/mailerlite/client";
import { createMailerLiteStore } from "@/lib/mailerlite/store";
import { siteUrl } from "@/lib/site/site-url";
import { createAdminClient } from "@/lib/supabase/admin";

// Runs the daily jobs (lib/jobs/daily.ts). Netlify's scheduled function,
// netlify/functions/daily-jobs.mts, calls this once a day with the shared secret CRON_SECRET in the
// Authorization header (decision 0006). Until CRON_SECRET is set, the daily jobs are off.
//
// Answers 200 with the run's summary (counts only, no addresses) when everything went through, and
// 500 when something failed, so the scheduled function's log shows the failure.

/**
 * How long a run may keep starting emails, then MailerLite requests; the next run does the rest.
 * Netlify stops a scheduled function after 30 seconds, and netlify/functions/daily-jobs.mts waits
 * 28 of them for this answer. The last email or request started may take up to 10 seconds more
 * (REQUEST_TIMEOUT_MS in lib/email/send.ts and lib/mailerlite/client.ts), and this route may have
 * to start up first: 15 + 10 leaves a few seconds for that, so the scheduled function gets the
 * answer instead of logging a timeout for a run that went fine.
 */
const RUN_BUDGET_MS = 15_000;

export async function POST(request: Request): Promise<Response> {
  const secret = serverEnv("CRON_SECRET").CRON_SECRET;
  if (!secret) {
    return Response.json(
      { error: "The daily jobs are off: CRON_SECRET isn't set." },
      { status: 503 },
    );
  }
  if (!hasSecret(request, secret)) {
    return Response.json(
      { error: "Unauthorized." },
      { status: 401, headers: { "www-authenticate": "Bearer" } },
    );
  }

  const startedAt = Date.now();
  let summary: DailyJobsSummary;
  try {
    const supabase = createAdminClient();
    // The MailerLite group sync is off until MAILERLITE_API_KEY is set.
    const mailerLiteClient = getMailerLiteClient(serverEnv("MAILERLITE_API_KEY"));
    summary = await runDailyJobs({
      now: new Date(startedAt),
      deadline: startedAt + RUN_BUDGET_MS,
      store: createMembershipStore(supabase),
      send: getEmailSender(serverEnv("EMAIL_FROM", "RESEND_API_KEY", "MAILPIT_URL")),
      siteUrl: siteUrl(),
      mailerLite: mailerLiteClient
        ? { client: mailerLiteClient, store: createMailerLiteStore(supabase) }
        : undefined,
    });
  } catch (error) {
    // A missing or invalid setting (an EnvError): the service role key, the email settings or
    // the site's address.
    const message = error instanceof Error ? error.message : String(error);
    console.error(`The daily jobs couldn't start: ${message}`);
    return Response.json({ error: `The daily jobs couldn't start: ${message}` }, { status: 500 });
  }

  if (summary.errors.length > 0) {
    console.error(`The daily jobs ran with errors: ${JSON.stringify(summary)}`);
    return Response.json(summary, { status: 500 });
  }
  console.info(`The daily jobs ran: ${JSON.stringify(summary)}`);
  return Response.json(summary);
}

/** Whether the request carries "Authorization: Bearer <secret>", compared in constant time. */
function hasSecret(request: Request, secret: string): boolean {
  const digest = (value: string) => createHash("sha256").update(value).digest();
  return timingSafeEqual(
    digest(request.headers.get("authorization") ?? ""),
    digest(`Bearer ${secret}`),
  );
}
