import { createHash, timingSafeEqual } from "node:crypto";
import { getEmailSender } from "@/lib/email/send";
import { runDailyJobs, type DailyJobsSummary } from "@/lib/jobs/daily";
import { createMembershipStore } from "@/lib/jobs/membership-store";
import { createAdminClient } from "@/lib/supabase/admin";

// Runs the daily jobs (lib/jobs/daily.ts). Netlify's scheduled function,
// netlify/functions/daily-jobs.mts, calls this once a day with the shared secret CRON_SECRET in the
// Authorization header (decision 0006). Until CRON_SECRET is set, the daily jobs are off.
//
// Answers 200 with the run's summary (counts only, no addresses) when everything went through, and
// 500 when something failed, so the scheduled function's log shows the failure.

/**
 * How long a run may keep starting emails; the next run sends the rest. Netlify stops a scheduled
 * function after 30 seconds, and netlify/functions/daily-jobs.mts waits 28 of them for this answer.
 * The last email started may take up to 10 seconds more to send (REQUEST_TIMEOUT_MS in
 * lib/email/send.ts), and this route may have to start up first: 15 + 10 leaves a few seconds for
 * that, so the scheduled function gets the answer instead of logging a timeout for a run that went
 * fine.
 */
const RUN_BUDGET_MS = 15_000;

export async function POST(request: Request): Promise<Response> {
  const secret = process.env.CRON_SECRET;
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
    summary = await runDailyJobs({
      now: new Date(startedAt),
      deadline: startedAt + RUN_BUDGET_MS,
      store: createMembershipStore(createAdminClient()),
      send: getEmailSender(),
      siteUrl: siteUrl(),
    });
  } catch (error) {
    // A missing setting: the service role key, the email settings or the site's address.
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

/** The site's address for the links in the emails, from SITE_URL. */
function siteUrl(): string {
  const value = process.env.SITE_URL;
  const url = value ? URL.parse(value) : null;
  if (!url || (url.protocol !== "https:" && url.protocol !== "http:")) {
    throw new Error("SITE_URL must be the site's address, such as https://<Society domain>.");
  }
  return url.origin;
}
