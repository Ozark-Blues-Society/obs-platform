# 0006 — The daily jobs run from a Netlify scheduled function

Status: Accepted (technical choice made with backlog E-2, 2026-11-26). Both options are in the fixed
stack and neither adds an account or a cost, so this isn't a human gate (`docs/HUMAN_GATES.md`).
Switching the jobs on in production is one: see Consequences.

## Context

The architecture's "Scheduled jobs (daily)": renewal reminders 30 and 7 days before a membership
ends, lapsing memberships at expiry and the lapsed note 14 days after (backlog E-2), expiring
classified listings with a reminder 5 days before (K-4), and the nightly MailerLite group sync (E-3).
E-2 asks for the scheduler to be recorded: Netlify scheduled functions or Supabase pg_cron.

## Decision

A Netlify scheduled function, `netlify/functions/daily-jobs.mts`, runs every day at 13:00 UTC: 7 AM
in the Ozarks in winter, 8 AM in summer (Netlify schedules in UTC). It calls the app's route
`POST /api/cron/daily` with a shared secret, `CRON_SECRET`, and the route runs the jobs
(`lib/jobs/daily.ts`). Which emails are due on which day is decided in the database
(`supabase/migrations/20261126143035_membership_emails.sql`), from a time it's given, so the rules
are tested with a fake clock.

Why:

- The schedule lives in the repository and deploys with the site. Netlify's Functions page shows
  the function, its next run, its log and a **Run now** button.
- Netlify runs scheduled functions only for the production deploy. Deploy previews and branch
  deploys never run them, so they never email members.
- Scheduled functions are on every Netlify plan. A run takes seconds of function time.
- The work stays in the app, next to the email templates, behind a route any scheduler can call.

## Options considered

| Option | For | Against |
| --- | --- | --- |
| A. Netlify scheduled function that calls the app's route. **Chosen.** | Above. | Netlify stops a scheduled function after 30 seconds, so a run stops starting emails after 15 seconds (sending the last one can take 10 more) and the next run sends the rest. Tied to Netlify. |
| B. Supabase pg_cron, calling the app's route through pg_net | Runs in the database, whatever hosts the site. | The schedule, the site's address and the secret live in each database, set by hand (not in the repository), so they drift. pg_net stops waiting for an answer after a few seconds and keeps answers for hours, so failures go unseen. |
| C. A scheduled GitHub Actions workflow | Nothing to host. | Uses the Actions minutes CI already runs short of. GitHub delays scheduled runs at busy times. |

## Consequences

- **Off until `CRON_SECRET` is set** in Netlify's production environment, together with
  `SUPABASE_SECRET_KEY`, `SITE_URL`, `EMAIL_FROM` and `RESEND_API_KEY` (see "Daily jobs" in the
  README). Setting it starts emails to real members, and production settings are a human gate
  (`docs/HUMAN_GATES.md`). Renewal and lapsed emails are Launch 2 (decision 0002).
- Running the jobs twice the same day sends nothing twice: each email is claimed in
  `membership_emails` before it's sent. **Run now** is safe.
- A status changes up to a day after its date: a membership shows as lapsed the morning after it
  ends. Access doesn't wait for that: members-only content checks `expires_at` itself
  (`lib/members/access.ts`).
- A run that misses a day (an outage, the secret unset for a while) catches up at the next run: each
  email stays due for a few days after its day (the migration lists how long). Nothing older is
  sent, so the first run after the ClubExpress import won't send "your membership ended two weeks
  ago" to members who lapsed long before.
- Resend's free plan sends 100 emails a day, sign-in emails included (architecture, "Known
  gotchas"). The first production run sends a reminder to everyone within 30 days of their expiry
  date at once, about a tenth of the members. Past the quota, Resend refuses the rest, and the next
  day's run sends them.
- K-4 and E-3 add their jobs to `runDailyJobs` in `lib/jobs/daily.ts`, on the same schedule.
- If the site moves to Vercel (the fallback host), a Vercel Cron Job can call the same route with
  the same secret. Vercel's cron requests are GETs, so the route would answer GET too.
