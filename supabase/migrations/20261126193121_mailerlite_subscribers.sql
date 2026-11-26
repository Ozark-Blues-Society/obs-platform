-- E-3: the MailerLite group sync (backlog E-3). Builds on M-2's 20261126050904_profiles_and_roles.sql.
--
-- The sync (lib/mailerlite/sync.ts) keeps seven groups in MailerLite in step with the members'
-- profiles: one per status (active, expiring, lapsed) and one per level, which holds the members
-- of that level whose membership hasn't lapsed. It runs every night, as part of the daily jobs, and
-- whenever server code changes a membership (lib/mailerlite/on-change.ts). It is server code with
-- the service role, and off until MAILERLITE_API_KEY is set.
--
-- mailerlite_subscribers holds, for each member the sync has put into MailerLite, what MailerLite
-- was last given: the subscriber's id there, the address, the name and the member groups. The sync
-- compares that with each profile and only calls MailerLite for the members whose groups, address
-- or name changed, so a night with no changes costs no more than listing the groups.
--
-- Two runs can overlap: the nightly run and a sync after a payment, say. So a run takes a member
-- before working on them (claim_mailerlite_member, a lease of a minute) and lets go of them when it
-- records what it did (finish_mailerlite_member). A run that finds a member taken leaves them to
-- the run that has them. The profile is read when a member is taken and again when they're let go,
-- in the same statement that lets go, so a change made while a run worked on the member is either
-- seen by that run, which then goes round again, or synced by whoever made it once the member is
-- free.
--
-- Nobody reads these through the Data API but the service role: the table has no policies, and
-- members and visitors have no privileges on it or on the functions. The functions live in public
-- because the sync calls them through the Data API; they are SECURITY INVOKER, so they run with the
-- caller's rights (supabase/tests/rls_baseline_test.sql allows no SECURITY DEFINER function in
-- public).

create table public.mailerlite_subscribers (
  -- The member. Not a foreign key: when a profile is deleted, its row stays, so the next sync can
  -- still take that subscriber out of the member groups. The sync then deletes the row.
  profile_id uuid primary key,
  -- MailerLite's id for the subscriber. Null while the first sync of this member hasn't finished.
  subscriber_id text check (char_length(subscriber_id) <= 64),
  -- What MailerLite was last given: the address, the name (MailerLite's name and last_name
  -- fields) and the member groups the sync put the subscriber in, as MailerLite group ids.
  email text,
  first_name text,
  last_name text,
  group_ids text[] not null default '{}',
  synced_at timestamptz,
  -- A run that has taken the member holds them until then.
  lease_until timestamptz
);

comment on table public.mailerlite_subscribers is
  'What the MailerLite group sync last gave MailerLite for each member: subscriber id, address, name '
  'and member groups. Server code with the service role only.';

alter table public.mailerlite_subscribers enable row level security;

-- No policies, and no privileges for visitors or members: only the service role, which bypasses
-- row level security, reads and writes these rows. Supabase's default privileges give anon and
-- authenticated everything on new tables in public, so take that back.
revoke all on table public.mailerlite_subscribers from anon, authenticated;
grant select, insert, update, delete on table public.mailerlite_subscribers to service_role;

-- Takes a member for a run, for p_lease_seconds: returns what MailerLite was last given for them
-- (all null for a member never synced) and their profile as it is now (is_profile false once the
-- profile is deleted). Returns no row when another run has the member and its lease hasn't run out.
-- A member never synced gets a row here, with nothing but the lease.
create function public.claim_mailerlite_member(p_profile_id uuid, p_lease_seconds integer)
returns table (
  subscriber_id text,
  synced_email text,
  synced_first_name text,
  synced_last_name text,
  synced_group_ids text[],
  is_profile boolean,
  email text,
  first_name text,
  last_name text,
  level public.membership_level,
  status public.membership_status
)
language sql
security invoker
set search_path = ''
as $$
  with claimed as (
    insert into public.mailerlite_subscribers as s (profile_id, lease_until)
    values (p_profile_id, now() + make_interval(secs => p_lease_seconds))
    on conflict (profile_id) do update
      set lease_until = excluded.lease_until
      where s.lease_until is null or s.lease_until <= now()
    returning s.profile_id, s.subscriber_id, s.email, s.first_name, s.last_name, s.group_ids
  )
  select
    claimed.subscriber_id,
    claimed.email,
    claimed.first_name,
    claimed.last_name,
    claimed.group_ids,
    p.id is not null,
    p.email,
    p.first_name,
    p.last_name,
    p.level,
    p.status
  from claimed
  left join public.profiles as p on p.id = claimed.profile_id;
$$;

-- Records what MailerLite now has for a member the run has taken, and lets go of them. With a
-- subscriber id, it saves the subscriber's id, address, name and member groups; with a null one
-- (the member is out of every member group), it deletes the member's row. Either way it returns the
-- profile as it is now, read in the same statement (is_profile false once it's deleted), so the
-- run can tell whether the member changed while it worked on them.
create function public.finish_mailerlite_member(
  p_profile_id uuid,
  p_subscriber_id text,
  p_email text,
  p_first_name text,
  p_last_name text,
  p_group_ids text[]
)
returns table (
  is_profile boolean,
  email text,
  first_name text,
  last_name text,
  level public.membership_level,
  status public.membership_status
)
language sql
security invoker
set search_path = ''
as $$
  with saved as (
    update public.mailerlite_subscribers as s
    set
      subscriber_id = p_subscriber_id,
      email = p_email,
      first_name = p_first_name,
      last_name = p_last_name,
      group_ids = coalesce(p_group_ids, '{}'),
      synced_at = now(),
      lease_until = null
    where s.profile_id = p_profile_id and p_subscriber_id is not null
    returning s.profile_id
  ),
  removed as (
    delete from public.mailerlite_subscribers as s
    where s.profile_id = p_profile_id and p_subscriber_id is null
    returning s.profile_id
  )
  select p.id is not null, p.email, p.first_name, p.last_name, p.level, p.status
  from (select p_profile_id as id) as member
  left join public.profiles as p on p.id = member.id;
$$;

-- Server code only. Supabase's default privileges let anon and authenticated execute new
-- functions in public, and revoking from public leaves those grants, so revoke them by name.
revoke all on function public.claim_mailerlite_member(uuid, integer)
  from public, anon, authenticated;
revoke all on function public.finish_mailerlite_member(uuid, text, text, text, text, text[])
  from public, anon, authenticated;
grant execute on function public.claim_mailerlite_member(uuid, integer) to service_role;
grant execute on function public.finish_mailerlite_member(uuid, text, text, text, text, text[])
  to service_role;
