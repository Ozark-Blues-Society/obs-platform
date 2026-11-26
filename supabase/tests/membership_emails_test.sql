-- The daily job's membership statuses and emails (backlog E-2): refresh_membership_statuses(),
-- due_membership_emails() and the membership_emails claims, in
-- supabase/migrations/20261126143035_membership_emails.sql, and the refresh as
-- 20261126163935_membership_status_from_row.sql replaced it, with private.membership_status_at().
-- membership_status_race_test.sql runs the refresh against a renewal in another session.
--
-- The functions take the time to work from as a parameter: these tests pass a fake clock in June
-- 2031, far from the fixture members' dates, so only the test members below are due. 2031-06-15
-- 13:00 UTC is 8 AM on June 15 in the Ozarks (Central Daylight Time, UTC-5). The job runs as the
-- service role, so the tests do too.
--
-- The test users are created here, inside the transaction. Their ids start
-- 00000000-0000-4000-8930-; the last two digits name them below.
begin;
select plan(35);

insert into auth.users (id, email, raw_user_meta_data)
values
  ('00000000-0000-4000-8930-000000000001', 'test.reminder-30@example.com',
    '{"first_name": "Jordan"}'),
  ('00000000-0000-4000-8930-000000000002', 'test.reminder-30-late@example.com', '{}'),
  ('00000000-0000-4000-8930-000000000003', 'test.ends-in-31@example.com', '{}'),
  ('00000000-0000-4000-8930-000000000004', 'test.reminder-8@example.com', '{}'),
  ('00000000-0000-4000-8930-000000000005', 'test.last-reminder-7@example.com', '{}'),
  ('00000000-0000-4000-8930-000000000006', 'test.ends-today@example.com', '{}'),
  ('00000000-0000-4000-8930-000000000007', 'test.auto-renew-30@example.com', '{}'),
  ('00000000-0000-4000-8930-000000000008', 'test.auto-renew-7@example.com', '{}'),
  ('00000000-0000-4000-8930-000000000009', 'test.lapsed-14@example.com', '{}'),
  ('00000000-0000-4000-8930-000000000010', 'test.lapsed-20@example.com', '{}'),
  ('00000000-0000-4000-8930-000000000011', 'test.lapsed-21@example.com', '{}'),
  ('00000000-0000-4000-8930-000000000012', 'test.lapsed-13@example.com', '{}'),
  ('00000000-0000-4000-8930-000000000013', 'test.lapsed-14-auto-renew@example.com', '{}'),
  ('00000000-0000-4000-8930-000000000014', 'test.ended-just-now@example.com', '{}'),
  ('00000000-0000-4000-8930-000000000015', 'test.never-paid@example.com', '{}'),
  ('00000000-0000-4000-8930-000000000016', 'test.no-level@example.com', '{}'),
  ('00000000-0000-4000-8930-000000000017', 'test.active@example.com', '{}'),
  ('00000000-0000-4000-8930-000000000018', 'test.lapsed-long-ago@example.com', '{}');

-- Memberships, as server code writes them. Times are UTC; the comments give the day in the
-- Ozarks and how many days that is from June 15, 2031.
update public.profiles as p
set
  level = m.level::public.membership_level,
  expires_at = m.expires_at::timestamptz,
  auto_renew = m.auto_renew,
  status = m.status::public.membership_status
from (
  values
    -- July 15, 6 PM: 30 days.
    ('01', 'band', '2031-07-15 23:00+00', false, null),
    -- July 15, 11:30 PM: still 30 days in the Ozarks, though it's July 16 in UTC.
    ('02', 'individual', '2031-07-16 04:30+00', false, null),
    -- July 16, 12:30 AM: 31 days. Its status starts wrong.
    ('03', 'business', '2031-07-16 05:30+00', false, 'expiring'),
    -- June 23: 8 days. The first reminder wasn't sent on its day.
    ('04', 'band', '2031-06-23 17:00+00', false, null),
    -- June 22: 7 days.
    ('05', 'sponsor', '2031-06-22 17:00+00', false, null),
    -- Today, 10 AM: two hours after the job runs.
    ('06', 'band', '2031-06-15 15:00+00', false, null),
    -- 30 and 7 days, on yearly auto-renew.
    ('07', 'band', '2031-07-15 23:00+00', true, null),
    ('08', 'band', '2031-06-22 17:00+00', true, null),
    -- Ended June 1: 14 days ago. Its status starts wrong.
    ('09', 'band', '2031-06-01 17:00+00', false, 'active'),
    -- Ended May 26 and May 25: 20 and 21 days ago.
    ('10', 'band', '2031-05-26 17:00+00', false, null),
    ('11', 'band', '2031-05-25 17:00+00', false, null),
    -- Ended June 2: 13 days ago.
    ('12', 'band', '2031-06-02 17:00+00', false, null),
    -- Ended 14 days ago, still on auto-renew (Stripe's renewal failed).
    ('13', 'individual', '2031-06-01 17:00+00', true, null),
    -- Ended at the very moment the job runs.
    ('14', 'band', '2031-06-15 13:00+00', false, null),
    -- 15 never paid: no level, no expires_at, no status.
    ('15', null, null, false, null),
    -- An expiry without a level.
    ('16', null, '2031-07-15 23:00+00', false, null),
    -- January 1, 2032, and January 1, 2030. Their statuses start wrong.
    ('17', 'band', '2032-01-01 18:00+00', false, 'lapsed'),
    ('18', 'band', '2030-01-01 18:00+00', false, 'active')
) as m (n, level, expires_at, auto_renew, status)
where p.id = ('00000000-0000-4000-8930-0000000000' || m.n)::uuid;

-- Who can reach the table and the functions. The behaviour tests below cover what they do.

select policies_are(
  'public', 'membership_emails', array[]::name[],
  'membership_emails has no policies: only the service role, which bypasses row level security, '
    || 'reads and writes it'
);

select table_privs_are(
  'public', 'membership_emails', 'anon', array[]::text[],
  'visitors have no privileges on membership_emails'
);

select table_privs_are(
  'public', 'membership_emails', 'authenticated', array[]::text[],
  'members have no privileges on membership_emails'
);

select function_privs_are(
  'public', 'due_membership_emails', array['timestamp with time zone'], 'anon', array[]::text[],
  'visitors can''t call due_membership_emails'
);

select function_privs_are(
  'public', 'due_membership_emails', array['timestamp with time zone'], 'authenticated',
  array[]::text[],
  'members can''t call due_membership_emails'
);

select function_privs_are(
  'public', 'refresh_membership_statuses', array['timestamp with time zone'], 'anon',
  array[]::text[],
  'visitors can''t call refresh_membership_statuses'
);

select function_privs_are(
  'public', 'refresh_membership_statuses', array['timestamp with time zone'], 'authenticated',
  array[]::text[],
  'members can''t call refresh_membership_statuses'
);

select function_privs_are(
  'public', 'due_membership_emails', array['timestamp with time zone'], 'service_role',
  array['EXECUTE'],
  'the service role can call due_membership_emails'
);

select function_privs_are(
  'public', 'refresh_membership_statuses', array['timestamp with time zone'], 'service_role',
  array['EXECUTE'],
  'the service role can call refresh_membership_statuses'
);

select function_privs_are(
  'private', 'membership_status_at', array['timestamp with time zone', 'timestamp with time zone'],
  'anon', array[]::text[],
  'visitors can''t call membership_status_at'
);

select function_privs_are(
  'private', 'membership_status_at', array['timestamp with time zone', 'timestamp with time zone'],
  'authenticated', array[]::text[],
  'members can''t call membership_status_at'
);

select function_privs_are(
  'private', 'membership_status_at', array['timestamp with time zone', 'timestamp with time zone'],
  'service_role', array['EXECUTE'],
  'the service role can call membership_status_at, which the refresh calls with its rights'
);

set local role service_role;

-- Statuses. The first refresh also moves every fixture member to lapsed (it's 2031): the rows
-- below are the test members only.

select lives_ok(
  $$ select * from public.refresh_membership_statuses('2031-06-15 13:00:00+00') $$,
  'the service role can refresh the statuses'
);

select bag_eq(
  $$
    select right(id::text, 2), status::text
    from public.profiles
    where id::text like '00000000-0000-4000-8930-%'
  $$,
  $$
    values
      ('01', 'expiring'), ('02', 'expiring'), ('03', 'active'), ('04', 'expiring'),
      ('05', 'expiring'), ('06', 'expiring'), ('07', 'expiring'), ('08', 'expiring'),
      ('09', 'lapsed'), ('10', 'lapsed'), ('11', 'lapsed'), ('12', 'lapsed'), ('13', 'lapsed'),
      ('14', 'lapsed'), ('15', null), ('16', 'expiring'), ('17', 'active'), ('18', 'lapsed')
  $$,
  'a membership is lapsed from expires_at (no grace period), expiring when it ends within 30 days '
    || 'on the Society''s calendar (auto-renew or not), and active otherwise; a member who never '
    || 'paid keeps no status'
);

select is_empty(
  $$ select * from public.refresh_membership_statuses('2031-06-15 13:00:00+00') $$,
  'refreshing again at the same time changes nothing'
);

select is(
  (
    select array_agg(new_status::text || ' ' || members)
    from public.refresh_membership_statuses('2031-06-16 04:59:59+00')
  ),
  array['lapsed 1'],
  'by 11:59 PM on June 15 only the membership that ended at 10 AM has moved, to lapsed'
);

select is_empty(
  $$
    select from public.profiles
    where id = '00000000-0000-4000-8930-000000000003' and status <> 'active'
  $$,
  'a membership ending in 31 days on the Society''s calendar is still active'
);

-- Emails due on June 15, whatever the time of day in the Ozarks.

select bag_eq(
  $$
    select right(profile_id::text, 2), kind::text
    from public.due_membership_emails('2031-06-15 13:00:00+00')
    where profile_id::text like '00000000-0000-4000-8930-%'
  $$,
  $$
    values
      ('01', 'renewal_reminder'), ('02', 'renewal_reminder'), ('04', 'renewal_reminder'),
      ('05', 'renewal_last_reminder'), ('06', 'renewal_last_reminder'),
      ('09', 'membership_lapsed'), ('10', 'membership_lapsed'), ('13', 'membership_lapsed')
  $$,
  'due on June 15: the first reminder from 30 to 8 days before, the last reminder from 7 days '
    || 'before until the membership ends (neither on auto-renew), and the lapsed note from 14 to '
    || '20 days after; nothing for 31 days before, 13 or 21 days after, or without a level'
);

select results_eq(
  $$
    select email, first_name, level::text, expires_at
    from public.due_membership_emails('2031-06-15 13:00:00+00')
    where profile_id = '00000000-0000-4000-8930-000000000001'
  $$,
  $$ values ('test.reminder-30@example.com', 'Jordan', 'band', '2031-07-15 23:00+00'::timestamptz) $$,
  'each due email comes with what its template needs: the address, first name, level and expiry'
);

select bag_eq(
  $$
    select right(profile_id::text, 2), kind::text
    from public.due_membership_emails('2031-06-16 04:59:59+00')
    where profile_id::text like '00000000-0000-4000-8930-%'
  $$,
  $$
    values
      ('01', 'renewal_reminder'), ('02', 'renewal_reminder'), ('04', 'renewal_reminder'),
      ('05', 'renewal_last_reminder'),
      ('09', 'membership_lapsed'), ('10', 'membership_lapsed'), ('13', 'membership_lapsed')
  $$,
  'at 11:59 PM it is still June 15 in the Ozarks (June 16 in UTC): the same emails are due, less '
    || 'the last reminder for the membership that ended at 10 AM'
);

select bag_eq(
  $$
    select right(profile_id::text, 2), kind::text
    from public.due_membership_emails('2031-06-16 05:00:00+00')
    where profile_id::text like '00000000-0000-4000-8930-%'
  $$,
  $$
    values
      ('01', 'renewal_reminder'), ('02', 'renewal_reminder'), ('03', 'renewal_reminder'),
      ('04', 'renewal_last_reminder'), ('05', 'renewal_last_reminder'),
      ('09', 'membership_lapsed'), ('12', 'membership_lapsed'), ('13', 'membership_lapsed')
  $$,
  'at midnight in the Ozarks every count moves on a day: 31 days becomes 30, 8 becomes 7, 13 days '
    || 'after becomes 14 and 20 becomes 21'
);

-- Claims: the job inserts a row before sending, and skips an email whose row exists.

select results_eq(
  $$
    insert into public.membership_emails (profile_id, kind, expires_at)
    values ('00000000-0000-4000-8930-000000000001', 'renewal_reminder', '2031-07-15 23:00+00')
    on conflict (profile_id, kind, expires_at) do nothing
    returning profile_id
  $$,
  $$ values ('00000000-0000-4000-8930-000000000001'::uuid) $$,
  'the service role claims an email by inserting its row'
);

select is_empty(
  $$
    insert into public.membership_emails (profile_id, kind, expires_at)
    values ('00000000-0000-4000-8930-000000000001', 'renewal_reminder', '2031-07-15 23:00+00')
    on conflict (profile_id, kind, expires_at) do nothing
    returning profile_id
  $$,
  'a second claim of the same email gets nothing, so a second run doesn''t send it'
);

select throws_ok(
  $$
    insert into public.membership_emails (profile_id, kind, expires_at)
    values ('00000000-0000-4000-8930-000000000001', 'renewal_reminder', '2031-07-15 23:00+00')
  $$,
  '23505', null,
  'one email of each kind per membership period'
);

select bag_eq(
  $$
    select right(profile_id::text, 2), kind::text
    from public.due_membership_emails('2031-06-15 14:00:00+00')
    where profile_id::text like '00000000-0000-4000-8930-%'
  $$,
  $$
    values
      ('02', 'renewal_reminder'), ('04', 'renewal_reminder'),
      ('05', 'renewal_last_reminder'), ('06', 'renewal_last_reminder'),
      ('09', 'membership_lapsed'), ('10', 'membership_lapsed'), ('13', 'membership_lapsed')
  $$,
  'a claimed email is no longer due when the job runs again the same day'
);

insert into public.membership_emails (profile_id, kind, expires_at, sent_at, provider_id)
values (
  '00000000-0000-4000-8930-000000000004', 'renewal_reminder', '2031-06-23 17:00+00',
  '2031-06-15 13:00:01+00', 'test-email-id'
);

select results_eq(
  $$
    select kind::text
    from public.due_membership_emails('2031-06-16 05:00:00+00')
    where profile_id = '00000000-0000-4000-8930-000000000004'
  $$,
  $$ values ('renewal_last_reminder') $$,
  'a sent first reminder doesn''t stop the last reminder a week before'
);

reset role;
update public.profiles
set expires_at = '2031-07-14 23:00+00'
where id = '00000000-0000-4000-8930-000000000001';
set local role service_role;

select results_eq(
  $$
    select kind::text
    from public.due_membership_emails('2031-06-15 13:00:00+00')
    where profile_id = '00000000-0000-4000-8930-000000000001'
  $$,
  $$ values ('renewal_reminder') $$,
  'a claim covers one membership end: when expires_at moves, the emails for the new end are due'
);

reset role;

-- Members and visitors can't read or write the claims or call the functions.

set local role authenticated;
set local request.jwt.claims to
  '{"sub": "00000000-0000-4000-8930-000000000001", "role": "authenticated"}';

select throws_ok(
  $$ select * from public.membership_emails $$,
  '42501', null,
  'a member can''t read membership_emails, not even their own'
);

select throws_ok(
  $$
    insert into public.membership_emails (profile_id, kind, expires_at)
    values ('00000000-0000-4000-8930-000000000002', 'renewal_reminder', '2031-07-16 04:30+00')
  $$,
  '42501', null,
  'a member can''t claim an email, which would stop it being sent'
);

select throws_ok(
  $$ select * from public.due_membership_emails('2031-06-15 13:00:00+00') $$,
  '42501', null,
  'a member can''t list the emails due, with other members'' addresses'
);

select throws_ok(
  $$ select * from public.refresh_membership_statuses('2031-06-15 13:00:00+00') $$,
  '42501', null,
  'a member can''t refresh the statuses'
);

reset role;
set local role anon;
set local request.jwt.claims to '{"role": "anon"}';

select throws_ok(
  $$ select * from public.membership_emails $$,
  '42501', null,
  'a visitor can''t read membership_emails'
);

select throws_ok(
  $$ select * from public.due_membership_emails('2031-06-15 13:00:00+00') $$,
  '42501', null,
  'a visitor can''t list the emails due'
);

select throws_ok(
  $$ select * from public.refresh_membership_statuses('2031-06-15 13:00:00+00') $$,
  '42501', null,
  'a visitor can''t refresh the statuses'
);

reset role;

-- Deleting a member deletes their claims.

delete from auth.users where id = '00000000-0000-4000-8930-000000000001';

select is_empty(
  $$
    select from public.membership_emails
    where profile_id = '00000000-0000-4000-8930-000000000001'
  $$,
  'deleting a member deletes their membership_emails rows'
);

select * from finish();
rollback;
