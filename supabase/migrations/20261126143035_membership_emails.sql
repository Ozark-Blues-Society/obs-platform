-- E-2: what the daily job does with memberships (backlog E-2, decision 0006). Builds on M-2's
-- 20261126050904_profiles_and_roles.sql.
--
-- The daily job (lib/jobs/daily.ts, run by app/api/cron/daily/route.ts) is server code with the
-- service role. Each run it:
--   1. calls refresh_membership_statuses(now), which keeps profiles.status in step with
--      expires_at: lapsed once expires_at has passed (there's no grace period, board-decisions
--      §4), expiring when the membership ends within 30 days, active otherwise. Members on yearly
--      auto-renew count as expiring too: the status is about the date, and Stripe's renewal sets it
--      back to active.
--   2. calls due_membership_emails(now), the emails due that haven't been sent: the renewal
--      reminders 30 and 7 days before a membership ends, for members not on yearly auto-renew
--      (Stripe emails those who are), and the lapsed note 14 days after it ended, for everyone.
--   3. claims each of them in membership_emails before sending it. The unique constraint lets one
--      run claim an email, once, so running the job twice in a day, or two runs at once, sends
--      nothing twice.
--
-- Days count on the Society's calendar, in Central Time (America/Chicago, SOCIETY_TIME_ZONE in
-- sanity/schemas/options.ts), whatever time of day the job runs: "30 days before" is the day whose
-- date is 30 days before the date the membership ends.
--
-- An email stays due for a few days after its day, so a missed run (an outage, the job switched off
-- for a while) catches up the next time it runs: the first reminder until 8 days before (from 7 days
-- before, the last reminder replaces it), the last reminder until the membership ends, and the
-- lapsed note until 20 days after. Nothing older is sent: a member whose membership ended months
-- ago, such as one imported from ClubExpress, never gets a note about "two weeks ago".
--
-- Nobody reads these through the Data API: the functions and the table are for the service role
-- only. The functions live in public because the job calls them through the Data API; they are
-- SECURITY INVOKER, so they run with the caller's rights (the baseline test in
-- supabase/tests/rls_baseline_test.sql allows no SECURITY DEFINER function in public).

create type public.membership_email_kind as enum (
  -- emails/renewal-reminder.tsx, 30 days before the membership ends
  'renewal_reminder',
  -- emails/renewal-last-reminder.tsx, 7 days before
  'renewal_last_reminder',
  -- emails/membership-lapsed.tsx, 14 days after it ended
  'membership_lapsed'
);

create table public.membership_emails (
  id bigint generated always as identity primary key,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  kind public.membership_email_kind not null,
  -- The end of the membership the email is about: profiles.expires_at when it was claimed. A
  -- renewal moves expires_at, so the next year's emails are new rows.
  expires_at timestamptz not null,
  claimed_at timestamptz not null default now(),
  -- When the email service accepted the email. Null while it's being sent, or if the run stopped
  -- before it could record that (such a claim is never sent again).
  sent_at timestamptz,
  -- The email service's id for the email: Resend's, to look it up in Resend's dashboard (or
  -- Mailpit's, locally).
  provider_id text check (char_length(provider_id) <= 200),
  -- One email of each kind per membership period. Its first column also serves as the index for
  -- the foreign key.
  constraint membership_emails_once unique (profile_id, kind, expires_at)
);

comment on table public.membership_emails is
  'The membership emails the daily job has sent (or is sending): renewal reminders and the lapsed '
  'note, one of each kind per membership period. Server code with the service role only.';

alter table public.membership_emails enable row level security;

-- No policies, and no privileges for visitors or members: only the service role, which bypasses
-- row level security, reads and writes these rows. Supabase's default privileges give anon and
-- authenticated everything on new tables in public, so take that back.
revoke all on table public.membership_emails from anon, authenticated;
grant select, insert, update, delete on table public.membership_emails to service_role;

-- Sets each membership's status from expires_at as of p_now (see the top of this file). Returns how
-- many profiles moved to each status; a second run at the same moment changes nothing. Profiles
-- without expires_at (never paid) keep their status.
create function public.refresh_membership_statuses(p_now timestamptz)
returns table (new_status public.membership_status, members integer)
language sql
security invoker
set search_path = ''
as $$
  with expected as (
    select
      p.id,
      case
        when p.expires_at <= p_now then 'lapsed'
        when (p.expires_at at time zone 'America/Chicago')::date
          - (p_now at time zone 'America/Chicago')::date <= 30 then 'expiring'
        else 'active'
      end::public.membership_status as status
    from public.profiles as p
    where p.expires_at is not null
  ),
  changed as (
    update public.profiles as p
    set status = expected.status
    from expected
    where p.id = expected.id and p.status is distinct from expected.status
    returning p.status
  )
  select changed.status, count(*)::integer
  from changed
  group by changed.status
  order by changed.status;
$$;

-- The membership emails due as of p_now that no run has claimed yet (see the top of this file),
-- with what the templates need. Members without a level (never paid) get none.
create function public.due_membership_emails(p_now timestamptz)
returns table (
  profile_id uuid,
  kind public.membership_email_kind,
  expires_at timestamptz,
  email text,
  first_name text,
  level public.membership_level
)
language sql
stable
security invoker
set search_path = ''
as $$
  select p.id, due.kind, p.expires_at, p.email, p.first_name, p.level
  from public.profiles as p
  -- Days from today to the day the membership ends, on the Society's calendar: 30 for the first
  -- reminder, negative once it has ended.
  cross join lateral (
    select
      (p.expires_at at time zone 'America/Chicago')::date
        - (p_now at time zone 'America/Chicago')::date as days_left
  ) as calendar
  cross join lateral (
    select
      case
        when p.expires_at > p_now and not p.auto_renew and calendar.days_left between 8 and 30
          then 'renewal_reminder'
        when p.expires_at > p_now and not p.auto_renew and calendar.days_left <= 7
          then 'renewal_last_reminder'
        when calendar.days_left between -20 and -14
          then 'membership_lapsed'
      end::public.membership_email_kind as kind
  ) as due
  where due.kind is not null
    and p.level is not null
    and not exists (
      select 1
      from public.membership_emails as claimed
      where claimed.profile_id = p.id
        and claimed.kind = due.kind
        and claimed.expires_at = p.expires_at
    )
  order by p.expires_at, p.id;
$$;

-- Server code only. Supabase's default privileges let anon and authenticated execute new
-- functions in public, and revoking from public leaves those grants, so revoke them by name.
revoke all on function public.refresh_membership_statuses(timestamptz)
  from public, anon, authenticated;
revoke all on function public.due_membership_emails(timestamptz)
  from public, anon, authenticated;
grant execute on function public.refresh_membership_statuses(timestamptz) to service_role;
grant execute on function public.due_membership_emails(timestamptz) to service_role;
