-- Renewing a classifieds listing from My listings (backlog K-4): renew_listing() in
-- supabase/migrations/20261127223233_listing_renewal.sql. My listings' Server Function calls it
-- with the service role, passing the signed-in member's id, so the tests do too.
--
-- A renewal happens at the real time, so the listings' dates are relative to now(), the
-- transaction's start, which renew_listing() and the guard trigger also use. Days count on the
-- Society's calendar: "in 5 days" is noon in the Ozarks on the date 5 days after today's date
-- there, whatever time the tests run.
--
-- The test users are created here, inside the transaction. Their ids start
-- 00000000-0000-4000-8930-, the listings' 00000000-0000-4000-8940-; the last two digits name them
-- below, and each listing's title starts with its number (R01...).
begin;
select plan(28);

insert into auth.users (id, email)
values
  ('00000000-0000-4000-8930-000000000001', 'test.poster@example.com'),
  ('00000000-0000-4000-8930-000000000002', 'test.other-member@example.com'),
  ('00000000-0000-4000-8930-000000000003', 'test.lapsed@example.com'),
  ('00000000-0000-4000-8930-000000000004', 'test.no-level@example.com'),
  ('00000000-0000-4000-8930-000000000005', 'test.never-paid@example.com');

-- Memberships, as server code writes them: 01 and 02 current, 03 ended yesterday, 04 an expiry
-- without a level (not a membership), 05 never paid.
update public.profiles as p
set level = m.level::public.membership_level, expires_at = m.expires_at
from (
  values
    ('01', 'individual', now() + interval '30 days'),
    ('02', 'band', now() + interval '200 days'),
    ('03', 'band', now() - interval '1 day'),
    ('04', null, now() + interval '30 days'),
    ('05', null, null)
) as m (n, level, expires_at)
where p.id = ('00000000-0000-4000-8930-0000000000' || m.n)::uuid;

-- R01's photo, in its poster's folder; a listing keeps its object's version.
insert into storage.objects (bucket_id, name, version)
values (
  'listing-photos',
  '00000000-0000-4000-8930-000000000001/00000000-0000-4000-8950-000000000001.jpg', 'v1'
);

-- Noon in the Ozarks, `days` days after today's date there.
create function pg_temp.noon_in(days integer)
returns timestamptz
language sql
stable
as $$
  select ((now() at time zone 'America/Chicago')::date + days + time '12:00')
    at time zone 'America/Chicago';
$$;

insert into public.listings (
  id, profile_id, category, title, body, photo_path, status, reject_reason, created_at,
  approved_at, expires_at
)
select
  ('00000000-0000-4000-8940-0000000000' || l.n)::uuid,
  ('00000000-0000-4000-8930-0000000000' || l.poster)::uuid,
  'gear', l.title, 'Details.', l.photo_path, l.status::public.listing_status, l.reject_reason,
  coalesce(l.expires_at, now()) - interval '61 days', l.expires_at - interval '60 days',
  l.expires_at
from (
  values
    -- Comes down in 5 days: the day its reminder goes out.
    ('01', '01', 'R01 ends in 5 days', 'live', null,
      '00000000-0000-4000-8930-000000000001/00000000-0000-4000-8950-000000000001.jpg',
      pg_temp.noon_in(5)),
    -- Comes down in 6 days.
    ('02', '01', 'R02 ends in 6 days', 'live', null, null, pg_temp.noon_in(6)),
    -- Its 60 days ended a minute ago; the daily job hasn't marked it expired yet.
    ('03', '01', 'R03 live past its end', 'live', null, null, now() - interval '1 minute'),
    -- Came down 10 days ago.
    ('04', '01', 'R04 expired', 'expired', null, null, now() - interval '10 days'),
    -- Waiting for a moderator, and rejected: no moderator has approved them as they stand.
    ('05', '01', 'R05 pending', 'pending', null, null, null),
    ('06', '01', 'R06 rejected', 'rejected', 'Not about music.', null, null),
    -- Expired listings of the other member, the lapsed member, and members without a level.
    ('07', '02', 'R07 other member''s', 'expired', null, null, now() - interval '3 days'),
    ('08', '03', 'R08 lapsed poster''s', 'expired', null, null, now() - interval '3 days'),
    ('09', '04', 'R09 no-level poster''s', 'expired', null, null, now() - interval '3 days'),
    ('10', '05', 'R10 never-paid poster''s', 'expired', null, null, now() - interval '3 days'),
    -- Taken down by a moderator while live, 3 days before its end: rejected, with its dates.
    ('11', '01', 'R11 taken down', 'rejected', 'Sold out, please remove.', null,
      pg_temp.noon_in(3))
) as l (n, poster, title, status, reject_reason, photo_path, expires_at);

-- Who can call it.

select function_privs_are(
  'public', 'renew_listing', array['uuid', 'uuid'], 'anon', array[]::text[],
  'visitors can''t call renew_listing'
);

select function_privs_are(
  'public', 'renew_listing', array['uuid', 'uuid'], 'authenticated', array[]::text[],
  'members can''t call renew_listing: My listings calls it for them, with the service role'
);

select function_privs_are(
  'public', 'renew_listing', array['uuid', 'uuid'], 'service_role', array['EXECUTE'],
  'the service role can call renew_listing'
);

set local role service_role;

-- What a renewal does.

select results_eq(
  $$
    select id, title, expires_at
    from public.renew_listing(
      '00000000-0000-4000-8940-000000000001', '00000000-0000-4000-8930-000000000001'
    )
  $$,
  $$
    values (
      '00000000-0000-4000-8940-000000000001'::uuid, 'R01 ends in 5 days',
      now() + interval '60 days'
    )
  $$,
  'a poster renews their live listing on the day its reminder goes out: it runs 60 days from now'
);

select results_eq(
  $$
    select status::text, approved_at, revision, photo_path, photo_version, reject_reason
    from public.listings
    where id = '00000000-0000-4000-8940-000000000001'
  $$,
  $$
    values (
      'live', now(), 1,
      '00000000-0000-4000-8930-000000000001/00000000-0000-4000-8950-000000000001.jpg', 'v1',
      null::text
    )
  $$,
  'a renewed listing is live, approved as of now, and otherwise as it was: the same revision and '
    || 'photo, with no new review'
);

select is_empty(
  $$
    select from public.renew_listing(
      '00000000-0000-4000-8940-000000000001', '00000000-0000-4000-8930-000000000001'
    )
  $$,
  'renewing it again at once changes nothing: it now comes down in 60 days'
);

select is_empty(
  $$
    select from public.renew_listing(
      '00000000-0000-4000-8940-000000000002', '00000000-0000-4000-8930-000000000001'
    )
  $$,
  'a listing that comes down in 6 days can''t be renewed yet'
);

select results_eq(
  $$
    select status::text, expires_at
    from public.listings
    where id = '00000000-0000-4000-8940-000000000002'
  $$,
  $$ values ('live', pg_temp.noon_in(6)) $$,
  'a refused renewal leaves the listing as it was'
);

select results_eq(
  $$
    select expires_at
    from public.renew_listing(
      '00000000-0000-4000-8940-000000000003', '00000000-0000-4000-8930-000000000001'
    )
  $$,
  $$ values (now() + interval '60 days') $$,
  'a live listing past its end, before the daily job marks it expired, can be renewed'
);

select results_eq(
  $$
    select expires_at
    from public.renew_listing(
      '00000000-0000-4000-8940-000000000004', '00000000-0000-4000-8930-000000000001'
    )
  $$,
  $$ values (now() + interval '60 days') $$,
  'an expired listing can be renewed'
);

select results_eq(
  $$
    select status::text, approved_at, expires_at
    from public.listings
    where id = '00000000-0000-4000-8940-000000000004'
  $$,
  $$ values ('live', now(), now() + interval '60 days') $$,
  'a renewed expired listing is live again for 60 days, approved as of now'
);

select is_empty(
  $$
    select from public.renew_listing(
      '00000000-0000-4000-8940-000000000005', '00000000-0000-4000-8930-000000000001'
    )
    union all
    select from public.renew_listing(
      '00000000-0000-4000-8940-000000000006', '00000000-0000-4000-8930-000000000001'
    )
  $$,
  'a pending or rejected listing can''t be renewed: no moderator has approved it as it stands'
);

select bag_eq(
  $$
    select right(id::text, 2), status::text, reject_reason
    from public.listings
    where id in ('00000000-0000-4000-8940-000000000005', '00000000-0000-4000-8940-000000000006')
  $$,
  $$ values ('05', 'pending', null), ('06', 'rejected', 'Not about music.') $$,
  'and they stay as they were'
);

select is_empty(
  $$
    select from public.renew_listing(
      '00000000-0000-4000-8940-000000000011', '00000000-0000-4000-8930-000000000001'
    )
  $$,
  'a listing a moderator took down can''t be put back up by renewing it, even in its last 5 days'
);

select results_eq(
  $$
    select status::text, reject_reason, expires_at
    from public.listings
    where id = '00000000-0000-4000-8940-000000000011'
  $$,
  $$ values ('rejected', 'Sold out, please remove.', pg_temp.noon_in(3)) $$,
  'it stays taken down'
);

-- Whose listings.

select is_empty(
  $$
    select from public.renew_listing(
      '00000000-0000-4000-8940-000000000007', '00000000-0000-4000-8930-000000000001'
    )
  $$,
  'a member can''t renew another member''s listing'
);

select results_eq(
  $$
    select right(id::text, 2)
    from public.renew_listing(
      '00000000-0000-4000-8940-000000000007', '00000000-0000-4000-8930-000000000002'
    )
  $$,
  $$ values ('07') $$,
  'its own poster can'
);

select is_empty(
  $$
    select from public.renew_listing(
      '00000000-0000-4000-8940-000000000008', '00000000-0000-4000-8930-000000000003'
    )
  $$,
  'a poster whose membership has ended can''t renew, as they can''t post'
);

select is_empty(
  $$
    select from public.renew_listing(
      '00000000-0000-4000-8940-000000000009', '00000000-0000-4000-8930-000000000004'
    )
  $$,
  'nor can a poster with an expiry date but no membership level'
);

select is_empty(
  $$
    select from public.renew_listing(
      '00000000-0000-4000-8940-000000000010', '00000000-0000-4000-8930-000000000005'
    )
  $$,
  'nor one who never paid'
);

select bag_eq(
  $$
    select right(id::text, 2), status::text
    from public.listings
    where id in (
      '00000000-0000-4000-8940-000000000008', '00000000-0000-4000-8940-000000000009',
      '00000000-0000-4000-8940-000000000010'
    )
  $$,
  $$ values ('08', 'expired'), ('09', 'expired'), ('10', 'expired') $$,
  'their listings stay expired'
);

select is_empty(
  $$
    select from public.renew_listing(
      '00000000-0000-4000-8940-000000000099', '00000000-0000-4000-8930-000000000001'
    )
  $$,
  'renewing a listing that doesn''t exist changes nothing'
);

-- What follows from a renewal.

select results_eq(
  $$
    select right(listing_id::text, 2)
    from public.due_listing_reminders(now() + interval '56 days')
    where listing_id = '00000000-0000-4000-8940-000000000001'
  $$,
  $$ values ('01') $$,
  'a renewed listing''s reminder comes again, 5 days before its new end'
);

reset role;
set local role anon;
set local request.jwt.claims to '{"role": "anon"}';

select results_eq(
  $$
    select right(id::text, 2)
    from public.listings
    where id in ('00000000-0000-4000-8940-000000000003', '00000000-0000-4000-8940-000000000004')
    order by id
  $$,
  $$ values ('03'), ('04') $$,
  'renewed listings are back on the classifieds for everyone, visitors included'
);

select is(
  (
    select count(*)::integer
    from storage.objects
    where bucket_id = 'listing-photos'
      and name = '00000000-0000-4000-8930-000000000001/00000000-0000-4000-8950-000000000001.jpg'
  ),
  1,
  'and so is a renewed listing''s photo, the version a moderator saw'
);

-- Members and visitors can't call it themselves.

select throws_ok(
  $$
    select * from public.renew_listing(
      '00000000-0000-4000-8940-000000000002', '00000000-0000-4000-8930-000000000001'
    )
  $$,
  '42501', null,
  'a visitor can''t renew a listing'
);

reset role;
set local role authenticated;
set local request.jwt.claims to
  '{"sub": "00000000-0000-4000-8930-000000000001", "role": "authenticated"}';

select throws_ok(
  $$
    select * from public.renew_listing(
      '00000000-0000-4000-8940-000000000002', '00000000-0000-4000-8930-000000000001'
    )
  $$,
  '42501', null,
  'a member can''t call renew_listing, even for their own listing'
);

select throws_ok(
  $$
    update public.listings
    set status = 'live'
    where id = '00000000-0000-4000-8940-000000000005'
  $$,
  '42501', null,
  'nor put their own listing up by setting its status: only moderators change it'
);

reset role;

select * from finish();
rollback;
