-- Messages to classifieds posters (backlog K-3): listing_messages and record_listing_message(), in
-- supabase/migrations/20261127195203_listing_messages.sql. Server code sends the messages with the
-- service role, so the behaviour tests run as it.
--
-- The test users are created here, inside the transaction. Their ids start
-- 00000000-0000-4000-8980- and the listings' 00000000-0000-4000-8990-; the last two digits name
-- them below.
begin;
select plan(23);

insert into auth.users (id, email)
values
  ('00000000-0000-4000-8980-000000000001', 'test.messages-poster@example.com'),
  ('00000000-0000-4000-8980-000000000002', 'test.messages-sender@example.com'),
  ('00000000-0000-4000-8980-000000000003', 'test.messages-other-sender@example.com'),
  ('00000000-0000-4000-8980-000000000004', 'test.messages-earlier-sender@example.com');

update public.profiles
set level = 'band', expires_at = now() + interval '200 days'
where id = '00000000-0000-4000-8980-000000000001';

insert into public.listings (
  id, profile_id, category, title, body, status, approved_at, expires_at
)
values
  ('00000000-0000-4000-8990-000000000001', '00000000-0000-4000-8980-000000000001', 'gear',
    'L01 live', 'Tweed-style amp.', 'live', now() - interval '1 day', now() + interval '59 days'),
  ('00000000-0000-4000-8990-000000000002', '00000000-0000-4000-8980-000000000001', 'gear',
    'L02 pending', 'Harmonica set.', 'pending', null, null),
  ('00000000-0000-4000-8990-000000000003', '00000000-0000-4000-8980-000000000001', 'merch',
    'L03 past its date', 'Band T-shirts.', 'live', now() - interval '61 days',
    now() - interval '1 day');

-- Who can reach the table and the function. The behaviour tests below cover what they do.

select policies_are(
  'public', 'listing_messages', array[]::name[],
  'listing_messages has no policies: only the service role, which bypasses row level security, '
    || 'reads and writes it'
);

select table_privs_are(
  'public', 'listing_messages', 'anon', array[]::text[],
  'visitors have no privileges on listing_messages'
);

select table_privs_are(
  'public', 'listing_messages', 'authenticated', array[]::text[],
  'members have no privileges on listing_messages'
);

select function_privs_are(
  'public', 'record_listing_message', array['uuid', 'uuid', 'integer'], 'anon', array[]::text[],
  'visitors can''t call record_listing_message'
);

select function_privs_are(
  'public', 'record_listing_message', array['uuid', 'uuid', 'integer'], 'authenticated',
  array[]::text[],
  'members can''t call record_listing_message'
);

select function_privs_are(
  'public', 'record_listing_message', array['uuid', 'uuid', 'integer'], 'service_role',
  array['EXECUTE'],
  'the service role can call record_listing_message'
);

-- A member can't record messages for themselves, or see who wrote to whom.

set local role authenticated;
set local request.jwt.claims to
  '{"sub": "00000000-0000-4000-8980-000000000002", "role": "authenticated"}';

select throws_ok(
  $$
    select public.record_listing_message(
      '00000000-0000-4000-8980-000000000002', '00000000-0000-4000-8990-000000000001', 1000
    )
  $$,
  '42501', null,
  'a member can''t call the function that records messages'
);

select throws_ok(
  $$ select 1 from public.listing_messages $$,
  '42501', null,
  'a member can''t read who wrote to whom'
);

reset role;
set local role service_role;

-- Up to the limit (3 here), each message is recorded; then nothing is, until a day has passed.

select isnt(
  public.record_listing_message(
    '00000000-0000-4000-8980-000000000002', '00000000-0000-4000-8990-000000000001', 3
  ),
  null,
  'a first message is recorded, and its id comes back'
);

select results_eq(
  $$
    select listing_id, sender_id, sent_at = now()
    from public.listing_messages
    where sender_id = '00000000-0000-4000-8980-000000000002'
  $$,
  $$
    values (
      '00000000-0000-4000-8990-000000000001'::uuid, '00000000-0000-4000-8980-000000000002'::uuid,
      true
    )
  $$,
  'the record holds the listing, the sender and the time: nothing of the message'
);

select results_eq(
  $$
    select public.record_listing_message(
      '00000000-0000-4000-8980-000000000002', '00000000-0000-4000-8990-000000000001', 3
    ) is not null
    from generate_series(1, 2)
  $$,
  $$ values (true), (true) $$,
  'the second and third messages are recorded'
);

select is(
  public.record_listing_message(
    '00000000-0000-4000-8980-000000000002', '00000000-0000-4000-8990-000000000001', 3
  ),
  null,
  'at the limit, a message isn''t recorded: null comes back'
);

select is(
  (
    select count(*)::integer from public.listing_messages
    where sender_id = '00000000-0000-4000-8980-000000000002'
  ),
  3,
  'at the limit, no row is added'
);

select isnt(
  public.record_listing_message(
    '00000000-0000-4000-8980-000000000003', '00000000-0000-4000-8990-000000000001', 3
  ),
  null,
  'one sender''s messages don''t count against another'
);

-- Messages from more than a day ago don't count, and go.

insert into public.listing_messages (listing_id, sender_id, sent_at)
select '00000000-0000-4000-8990-000000000001', '00000000-0000-4000-8980-000000000004',
  now() - interval '1 day' - make_interval(mins => minute)
from generate_series(1, 3) as minute;

select isnt(
  public.record_listing_message(
    '00000000-0000-4000-8980-000000000004', '00000000-0000-4000-8990-000000000001', 3
  ),
  null,
  'messages from more than a day ago don''t count'
);

select is(
  (
    select count(*)::integer from public.listing_messages
    where sent_at <= now() - interval '1 day'
  ),
  0,
  'recording a message deletes every row from more than a day ago'
);

select is(
  (select count(*)::integer from public.listing_messages),
  5,
  'the last day''s rows stay'
);

-- One sender at a time: recording holds a lock on the sender until the transaction ends.

select ok(
  exists (
    select 1
    from pg_locks
    where locktype = 'advisory'
      and pid = pg_backend_pid()
      and granted
      and objsubid = 1
      and (classid::bigint << 32) | objid::bigint
        = hashtextextended('listing_messages:00000000-0000-4000-8980-000000000002', 0)
  ),
  'recording a message locks its sender until the transaction ends'
);

-- Only live listings take messages.

select throws_ok(
  $$
    select public.record_listing_message(
      '00000000-0000-4000-8980-000000000002', '00000000-0000-4000-8990-000000000002', 3
    )
  $$,
  'P0002', null,
  'a listing waiting for a moderator takes no messages'
);

select throws_ok(
  $$
    select public.record_listing_message(
      '00000000-0000-4000-8980-000000000003', '00000000-0000-4000-8990-000000000003', 3
    )
  $$,
  'P0002', null,
  'a listing past its expiry takes no messages, even before the daily job marks it expired'
);

select throws_ok(
  $$
    select public.record_listing_message(
      '00000000-0000-4000-8980-000000000003', '00000000-0000-4000-8990-000000000099', 3
    )
  $$,
  'P0002', null,
  'a listing that doesn''t exist takes no messages'
);

-- A listing's rows and a member's rows go with them.

reset role;

delete from auth.users where id = '00000000-0000-4000-8980-000000000003';

select is(
  (
    select count(*)::integer from public.listing_messages
    where sender_id = '00000000-0000-4000-8980-000000000003'
  ),
  0,
  'deleting a member deletes the record of their messages'
);

delete from public.listings where id = '00000000-0000-4000-8990-000000000001';

select is(
  (select count(*)::integer from public.listing_messages),
  0,
  'deleting a listing deletes the record of the messages about it'
);

select * from finish();
rollback;
