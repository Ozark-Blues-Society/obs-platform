-- K-4, part 1: the daily job takes classifieds listings down when their 60 days are over, and
-- reminds each poster 5 days before (backlog K-4; board-decisions §7; decision 0006). Builds on
-- K-1's listings (20261126210923_listings.sql) and follows E-2's membership emails
-- (20261126143035_membership_emails.sql).
--
-- The daily job (lib/jobs/listings.ts, run by lib/jobs/daily.ts) is server code with the service
-- role. Each run it:
--   1. calls expire_listings(now), which marks the live listings whose expires_at has passed as
--      expired. Nobody sees a live listing after its expires_at anyway (the listings policies
--      check it), so this only brings the status in line, for the poster and the moderators. The
--      dates stay, so the poster can see when it came down. The guard trigger
--      private.check_listing_change() doesn't limit the service role.
--   2. calls due_listing_reminders(now), the reminders due that haven't been sent: one to the
--      poster of each live listing whose 60 days end within 5 days.
--   3. claims each of them in listing_reminders before sending it (emails/listing-expiring.tsx).
--      The unique constraint lets one run claim a reminder, once, so running the job twice in a
--      day, or two runs at once, sends nothing twice.
--
-- Days count on the Society's calendar, in Central Time (America/Chicago), as for the membership
-- emails: "5 days before" is the day whose date is 5 days before the date the listing comes down,
-- whatever time of day the job runs. A reminder stays due until the listing comes down, so a run
-- that was missed catches up the next day.
--
-- Nobody reads these through the Data API: the functions and the table are for the service role
-- only. The functions are SECURITY INVOKER and live in public because the job calls them through
-- the Data API, as E-2's do (the baseline test allows no SECURITY DEFINER function in public).

create table public.listing_reminders (
  id bigint generated always as identity primary key,
  listing_id uuid not null references public.listings (id) on delete cascade,
  -- The end of the listing's run the reminder is about: listings.expires_at when it was claimed.
  -- A renewal or a new approval moves expires_at, so the next run's reminder is a new row.
  expires_at timestamptz not null,
  claimed_at timestamptz not null default now(),
  -- When the email service accepted the email. Null while it's being sent, or if the run stopped
  -- before it could record that (such a claim is never sent again).
  sent_at timestamptz,
  -- The email service's id for the email: Resend's, to look it up in Resend's dashboard (or
  -- Mailpit's, locally).
  provider_id text check (char_length(provider_id) <= 200),
  -- One reminder per run of a listing. Its first column also serves as the index for the foreign
  -- key.
  constraint listing_reminders_once unique (listing_id, expires_at)
);

comment on table public.listing_reminders is
  'The reminders the daily job has sent (or is sending) 5 days before a classifieds listing comes '
  'down, one per run of a listing. Server code with the service role only.';

alter table public.listing_reminders enable row level security;

-- No policies, and no privileges for visitors or members: only the service role, which bypasses
-- row level security, reads and writes these rows. Supabase's default privileges give anon and
-- authenticated everything on new tables in public, so take that back.
revoke all on table public.listing_reminders from anon, authenticated;
grant select, insert, update, delete on table public.listing_reminders to service_role;

-- Marks the live listings whose expires_at is p_now or earlier as expired, and returns how many.
-- A second run at the same moment changes nothing. A listing renewed while this runs keeps its
-- status: the WHERE is checked again on the row the renewal committed, whose expires_at is ahead.
create function public.expire_listings(p_now timestamptz)
returns integer
language sql
security invoker
set search_path = ''
as $$
  with expired as (
    update public.listings
    set status = 'expired'
    where status = 'live' and expires_at <= p_now
    returning 1
  )
  select count(*)::integer from expired;
$$;

-- The reminders due as of p_now that no run has claimed yet (see the top of this file), with what
-- the template needs: the live listings that end within 5 days on the Society's calendar and
-- haven't ended yet.
create function public.due_listing_reminders(p_now timestamptz)
returns table (
  listing_id uuid,
  expires_at timestamptz,
  title text,
  email text,
  first_name text
)
language sql
stable
security invoker
set search_path = ''
as $$
  select l.id, l.expires_at, l.title, p.email, p.first_name
  from public.listings as l
  join public.profiles as p on p.id = l.profile_id
  where l.status = 'live'
    and l.expires_at > p_now
    and (l.expires_at at time zone 'America/Chicago')::date
      - (p_now at time zone 'America/Chicago')::date <= 5
    and not exists (
      select 1
      from public.listing_reminders as claimed
      where claimed.listing_id = l.id and claimed.expires_at = l.expires_at
    )
  order by l.expires_at, l.id;
$$;

-- Server code only. Supabase's default privileges let anon and authenticated execute new
-- functions in public, and revoking from public leaves those grants, so revoke them by name.
revoke all on function public.expire_listings(timestamptz) from public, anon, authenticated;
revoke all on function public.due_listing_reminders(timestamptz) from public, anon, authenticated;
grant execute on function public.expire_listings(timestamptz) to service_role;
grant execute on function public.due_listing_reminders(timestamptz) to service_role;
