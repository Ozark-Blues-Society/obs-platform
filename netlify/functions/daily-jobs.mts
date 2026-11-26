// Netlify runs this scheduled function once a day (decision 0006): at 13:00 UTC, which is 7 AM in
// the Ozarks in winter and 8 AM in summer. It runs only on the production deploy, never on deploy
// previews or branch deploys. Its one job is to ask the site to run the daily jobs, at
// app/api/cron/daily/route.ts, with the shared secret CRON_SECRET; the work happens there.
//
// No CRON_SECRET, no daily jobs: setting it in Netlify (with the email settings, see the README)
// turns them on. Netlify's Functions page shows this function's log, and its "Run now" button runs
// it at once; running it twice the same day sends no email twice.
//
// Every file in netlify/functions is a function, so this file's tests live in lib/jobs/.

/** The part of Netlify's context object this function reads. */
interface NetlifyContext {
  site: { url?: string };
}

/**
 * Netlify allows a scheduled function 30 seconds; give up on the site's answer before that. The
 * route answers in time: it starts no email after 15 seconds (RUN_BUDGET_MS in
 * app/api/cron/daily/route.ts), and sending one takes 10 seconds at most.
 */
const TIMEOUT_MS = 28_000;

export default async function dailyJobs(_request: Request, context: NetlifyContext): Promise<void> {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    console.warn("The daily jobs are off: CRON_SECRET isn't set.");
    return;
  }
  // The site's main address: its own domain once that's set up.
  const site = context.site.url;
  if (!site) throw new Error("Netlify didn't say the site's address (context.site.url).");

  const response = await fetch(new URL("/api/cron/daily", site), {
    method: "POST",
    headers: { authorization: `Bearer ${secret}` },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  const summary = await response.text();
  if (!response.ok) {
    throw new Error(`The daily jobs failed (HTTP ${response.status}): ${summary}`);
  }
  console.info(`The daily jobs ran: ${summary}`);
}

export const config = {
  schedule: "0 13 * * *",
};
