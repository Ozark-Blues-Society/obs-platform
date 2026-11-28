-- The daily job's classifieds step (backlog K-4): expire_listings(), due_listing_reminders() and the
-- listing_reminders claims, in supabase/migrations/20261127221430_listing_expiry.sql.
--
-- The functions take the time to work from as a parameter: these tests pass a fake clock in June
-- 2001, long before any fixture listing was posted, so only the test listings below come down or
-- are due. 2001-06-15 13:00 UTC is 8 AM on June 15 in the Ozarks (Central Daylight Time, UTC-5).
-- The job runs as the service role, so the tests do too.
--
-- The test users are created here, inside the transaction. Their ids start
-- 00000000-0000-4000-8930-, the listings' 00000000-0000-4000-8940-; the last two digits name them
-- below, and each listing's title starts with its number (L01...). The posters have no
-- membership: a reminder goes out whatever the membership (My listings asks a poster whose
-- membership has ended to renew it before renewing a listing).
begin;
select plan(31);

insert into auth.users (id, email, raw_user_meta_data)
values
  ('00000000-0000-4000-8930-000000000001', 'test.poster@example.com', '{"first_name": "Jordan"}'),
  ('00000000-0000-4000-8930-000000000002', 'test.no-name@example.com', '{}');

-- Listings, as K-1 and K-2 leave them: approving sets approved_at and expires_at 60 days later. The
-- comments give the day each run ends in the Ozarks and how many days that is from June 15, 2001.
insert into public.listings (
  id, profile_id, category, title, body, status, reject_reason, created_at, approved_at,
  expires_at
)
select
  ('00000000-0000-4000-8940-0000000000' || l.n)::uuid,
  ('00000000-0000-4000-8930-0000000000' || l.poster)::uuid,
  l.category::public.listing_category, l.title, 'Details.', l.status::public.listing_status,
  l.reject_reason, coalesce(l.expires_at - interval '61 days', '2001-06-14 17:00+00'),
  l.expires_at - interval '60 days', l.expires_at
from (
  values
    -- Ended at 7 AM, an hour before the job runs.
    ('01', '01', 'gear', 'L01 ended an hour ago', 'live', null, '2001-06-15 12:00+00'::timestamptz),
    -- Ends at the very moment the job runs.
    ('02', '01', 'gear', 'L02 ends as the job runs', 'live', null, '2001-06-15 13:00+00'),
    -- Today, 10 AM: two hours after the job runs. Its reminder wasn't sent on its day.
    ('03', '01', 'merch', 'L03 ends later today', 'live', null, '2001-06-15 15:00+00'),
    -- June 20, noon: 5 days.
    ('04', '01', 'musicians_wanted', 'L04 ends in 5 days', 'live', null, '2001-06-20 17:00+00'),
    -- June 20, 11:30 PM: still 5 days in the Ozarks, though it's June 21 in UTC.
    ('05', '01', 'street_team', 'L05 ends in 5 days, late', 'live', null, '2001-06-21 04:30+00'),
    -- June 21, 12:30 AM: 6 days.
    ('06', '01', 'member_connect', 'L06 ends in 6 days', 'live', null, '2001-06-21 05:30+00'),
    -- June 16, noon: tomorrow. Its poster gave no first name.
    ('07', '02', 'gear', 'L07 ends tomorrow', 'live', null, '2001-06-16 17:00+00'),
    -- Came down on June 10, and already marked expired.
    ('08', '01', 'gear', 'L08 expired', 'expired', null, '2001-06-10 17:00+00'),
    -- Taken down by a moderator, so rejected, 2 days before its end: the dates stay.
    ('09', '01', 'gear', 'L09 taken down', 'rejected', 'Sold elsewhere.', '2001-06-17 17:00+00'),
    -- Waiting for a moderator: never approved, so no dates.
    ('10', '01', 'gear', 'L10 pending', 'pending', null, null)
) as l (n, poster, category, title, status, reject_reason, expires_at);

-- Who can reach the table and the functions. The behaviour tests below cover what they do.

select policies_are(
  'public', 'listing_reminders', array[]::name[],
  'listing_reminders has no policies: only the service role, which bypasses row level security, '
    || 'reads and writes it'
);

select table_privs_are(
  'public', 'listing_reminders', 'anon', array[]::text[],
  'visitors have no privileges on listing_reminders'
);

select table_privs_are(
  'public', 'listing_reminders', 'authenticated', array[]::text[],
  'members have no privileges on listing_reminders'
);

select function_privs_are(
  'public', 'expire_listings', array['timestamp with time zone'], 'anon', array[]::text[],
  'visitors can''t call expire_listings'
);

select function_privs_are(
  'public', 'expire_listings', array['timestamp with time zone'], 'authenticated',
  array[]::text[],
  'members can''t call expire_listings'
);

select function_privs_are(
  'public', 'due_listing_reminders', array['timestamp with time zone'], 'anon', array[]::text[],
  'visitors can''t call due_listing_reminders'
);

select function_privs_are(
  'public', 'due_listing_reminders', array['timestamp with time zone'], 'authenticated',
  array[]::text[],
  'members can''t call due_listing_reminders'
);

select function_privs_are(
  'public', 'expire_listings', array['timestamp with time zone'], 'service_role',
  array['EXECUTE'],
  'the service role can call expire_listings'
);

select function_privs_are(
  'public', 'due_listing_reminders', array['timestamp with time zone'], 'service_role',
  array['EXECUTE'],
  'the service role can call due_listing_reminders'
);

set local role service_role;

-- Expiry.

select is(
  public.expire_listings('2001-06-15 13:00:00+00'),
  2,
  'the service role takes down the two live listings whose expires_at has come, and counts them'
);

select bag_eq(
  $$
    select right(id::text, 2), status::text
    from public.listings
    where id::text like '00000000-0000-4000-8940-%'
  $$,
  $$
    values
      ('01', 'expired'), ('02', 'expired'), ('03', 'live'), ('04', 'live'), ('05', 'live'),
      ('06', 'live'), ('07', 'live'), ('08', 'expired'), ('09', 'rejected'), ('10', 'pending')
  $$,
  'a live listing is expired from its expires_at on (one ending at the very moment too); listings '
    || 'still running, and those that aren''t live, keep their status'
);

select results_eq(
  $$
    select approved_at, expires_at, revision, reject_reason
    from public.listings
    where id = '00000000-0000-4000-8940-000000000001'
  $$,
  $$
    values (
      '2001-04-16 12:00+00'::timestamptz, '2001-06-15 12:00+00'::timestamptz, 1, null::text
    )
  $$,
  'an expired listing keeps its dates, so its poster sees when it came down, and its revision'
);

select is(
  public.expire_listings('2001-06-15 13:00:00+00'),
  0,
  'running it again at the same time changes nothing'
);

-- Reminders due on June 15, whatever the time of day in the Ozarks.

select bag_eq(
  $$
    select right(listing_id::text, 2)
    from public.due_listing_reminders('2001-06-15 13:00:00+00')
    where listing_id::text like '00000000-0000-4000-8940-%'
  $$,
  $$ values ('03'), ('04'), ('05'), ('07') $$,
  'due on June 15: the live listings that come down within 5 days on the Society''s calendar and '
    || 'haven''t yet; nothing for 6 days, for listings already down, taken down or pending'
);

select results_eq(
  $$
    select title, email, first_name, expires_at
    from public.due_listing_reminders('2001-06-15 13:00:00+00')
    where listing_id in (
      '00000000-0000-4000-8940-000000000004', '00000000-0000-4000-8940-000000000007'
    )
    order by listing_id
  $$,
  $$
    values
      ('L04 ends in 5 days', 'test.poster@example.com', 'Jordan',
        '2001-06-20 17:00+00'::timestamptz),
      ('L07 ends tomorrow', 'test.no-name@example.com', null, '2001-06-16 17:00+00')
  $$,
  'each reminder comes with what its template needs: the title, the poster''s address and first '
    || 'name, and when the listing comes down'
);

select results_eq(
  $$
    select right(listing_id::text, 2)
    from public.due_listing_reminders('2001-06-15 13:00:00+00')
    where listing_id::text like '00000000-0000-4000-8940-%'
  $$,
  $$ values ('03'), ('07'), ('04'), ('05') $$,
  'the reminders come soonest first, so a run that stops early has sent the most urgent'
);

select bag_eq(
  $$
    select right(listing_id::text, 2)
    from public.due_listing_reminders('2001-06-16 04:59:59+00')
    where listing_id::text like '00000000-0000-4000-8940-%'
  $$,
  $$ values ('04'), ('05'), ('07') $$,
  'at 11:59 PM it is still June 15 in the Ozarks (June 16 in UTC): the same reminders are due, '
    || 'less the listing that came down at 10 AM, even before the job marks it expired'
);

select bag_eq(
  $$
    select right(listing_id::text, 2)
    from public.due_listing_reminders('2001-06-16 05:00:00+00')
    where listing_id::text like '00000000-0000-4000-8940-%'
  $$,
  $$ values ('04'), ('05'), ('06'), ('07') $$,
  'at midnight in the Ozarks every count moves on a day: 6 days becomes 5'
);

-- Claims: the job inserts a row before sending, and skips a reminder whose row exists.

select results_eq(
  $$
    insert into public.listing_reminders (listing_id, expires_at)
    values ('00000000-0000-4000-8940-000000000004', '2001-06-20 17:00+00')
    on conflict (listing_id, expires_at) do nothing
    returning listing_id
  $$,
  $$ values ('00000000-0000-4000-8940-000000000004'::uuid) $$,
  'the service role claims a reminder by inserting its row'
);

select is_empty(
  $$
    insert into public.listing_reminders (listing_id, expires_at)
    values ('00000000-0000-4000-8940-000000000004', '2001-06-20 17:00+00')
    on conflict (listing_id, expires_at) do nothing
    returning listing_id
  $$,
  'a second claim of the same reminder gets nothing, so a second run doesn''t send it'
);

select throws_ok(
  $$
    insert into public.listing_reminders (listing_id, expires_at)
    values ('00000000-0000-4000-8940-000000000004', '2001-06-20 17:00+00')
  $$,
  '23505', null,
  'one reminder per run of a listing'
);

select bag_eq(
  $$
    select right(listing_id::text, 2)
    from public.due_listing_reminders('2001-06-15 14:00:00+00')
    where listing_id::text like '00000000-0000-4000-8940-%'
  $$,
  $$ values ('03'), ('05'), ('07') $$,
  'a claimed reminder is no longer due when the job runs again the same day'
);

reset role;
update public.listings
set expires_at = '2001-06-19 17:00+00'
where id = '00000000-0000-4000-8940-000000000004';
set local role service_role;

select results_eq(
  $$
    select right(listing_id::text, 2)
    from public.due_listing_reminders('2001-06-15 13:00:00+00')
    where listing_id = '00000000-0000-4000-8940-000000000004'
  $$,
  $$ values ('04') $$,
  'a claim covers one run of a listing: when expires_at moves (a renewal), the reminder for the '
    || 'new end is due in its time'
);

reset role;

-- Members and visitors can't read or write the claims or call the functions.

set local role authenticated;
set local request.jwt.claims to
  '{"sub": "00000000-0000-4000-8930-000000000001", "role": "authenticated"}';

select throws_ok(
  $$ select * from public.listing_reminders $$,
  '42501', null,
  'a member can''t read listing_reminders, not even for their own listings'
);

select throws_ok(
  $$
    insert into public.listing_reminders (listing_id, expires_at)
    values ('00000000-0000-4000-8940-000000000007', '2001-06-16 17:00+00')
  $$,
  '42501', null,
  'a member can''t claim a reminder, which would stop it being sent'
);

select throws_ok(
  $$ select * from public.due_listing_reminders('2001-06-15 13:00:00+00') $$,
  '42501', null,
  'a member can''t list the reminders due, with other members'' addresses'
);

select throws_ok(
  $$ select public.expire_listings('2001-06-15 13:00:00+00') $$,
  '42501', null,
  'a member can''t take listings down'
);

reset role;
set local role anon;
set local request.jwt.claims to '{"role": "anon"}';

select throws_ok(
  $$ select * from public.listing_reminders $$,
  '42501', null,
  'a visitor can''t read listing_reminders'
);

select throws_ok(
  $$ select * from public.due_listing_reminders('2001-06-15 13:00:00+00') $$,
  '42501', null,
  'a visitor can''t list the reminders due'
);

select throws_ok(
  $$ select public.expire_listings('2001-06-15 13:00:00+00') $$,
  '42501', null,
  'a visitor can''t take listings down'
);

reset role;

-- Deleting a listing deletes its claims.

delete from public.listings where id = '00000000-0000-4000-8940-000000000004';

select is_empty(
  $$
    select from public.listing_reminders
    where listing_id = '00000000-0000-4000-8940-000000000004'
  $$,
  'deleting a listing deletes its listing_reminders rows'
);

select * from finish();
rollback;
