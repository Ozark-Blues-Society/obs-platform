-- The daily job's status refresh works each status out from the row it updates, so a renewal that
-- commits while the refresh runs keeps its status (op-04s.8, from the PR #38 review). Replaces
-- refresh_membership_statuses() from 20261126143035_membership_emails.sql; the rules and what it
-- returns are unchanged.
--
-- The race this closes: the refresh worked out every status first, in a CTE, from what the
-- statement saw when it started, then updated the profiles whose status differed. When another
-- transaction changed a profile and committed while the refresh was running (the Stripe webhook
-- renewing a member: expires_at a year on, status active), the refresh waited for that row, re-read
-- it and re-checked its WHERE on the new version (READ COMMITTED), but still set the status it had
-- worked out from the old version. The renewed member showed as lapsed, with an expiry a year away,
-- until the next day's run. Access and the emails go by expires_at, so only the status was wrong.
--
-- Now private.membership_status_at() works the status out from the row being updated, in the SET
-- and in the WHERE, so a re-read row gets the status of its new expiry.
-- supabase/tests/membership_status_race_test.sql runs that race with two sessions.

-- The status of a membership that ends at p_expires_at, as of p_now: lapsed once expires_at has
-- passed (there's no grace period, board-decisions §4), expiring when the membership ends within 30
-- days on the Society's calendar (Central Time), active otherwise.
create function private.membership_status_at(p_expires_at timestamptz, p_now timestamptz)
returns public.membership_status
language sql
immutable
set search_path = ''
as $$
  select case
    when p_expires_at <= p_now then 'lapsed'::public.membership_status
    when (p_expires_at at time zone 'America/Chicago')::date
      - (p_now at time zone 'America/Chicago')::date <= 30 then 'expiring'::public.membership_status
    else 'active'::public.membership_status
  end;
$$;

-- For the refresh, which runs with the caller's rights: the daily job calls it as the service role.
-- Functions in private are executable by everyone until revoked (the schema has no default
-- privileges), and the service role needs the schema too.
revoke all on function private.membership_status_at(timestamptz, timestamptz)
  from public, anon, authenticated;
grant usage on schema private to service_role;
grant execute on function private.membership_status_at(timestamptz, timestamptz) to service_role;

-- Sets each membership's status from expires_at as of p_now (see the top of
-- 20261126143035_membership_emails.sql). Returns how many profiles moved to each status; a second
-- run at the same moment changes nothing. Profiles without expires_at (never paid) keep their
-- status. A replaced function keeps its privileges: the service role's only.
create or replace function public.refresh_membership_statuses(p_now timestamptz)
returns table (new_status public.membership_status, members integer)
language sql
security invoker
set search_path = ''
as $$
  with changed as (
    update public.profiles as p
    set status = private.membership_status_at(p.expires_at, p_now)
    where p.expires_at is not null
      and p.status is distinct from private.membership_status_at(p.expires_at, p_now)
    returning p.status
  )
  select changed.status, count(*)::integer
  from changed
  group by changed.status
  order by changed.status;
$$;
