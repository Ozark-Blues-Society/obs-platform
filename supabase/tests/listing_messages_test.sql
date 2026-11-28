-- Messages to classifieds posters (backlog K-3, decision 0009): listing_messages and
-- record_listing_message(), in supabase/migrations/20261127195203_listing_messages.sql. Server code
-- sends the messages with the service role, so the behaviour tests run as it.
--
-- The test users are created here, inside the transaction. Their ids start
-- 00000000-0000-4000-8980- and the listings' 00000000-0000-4000-8990-; the last two digits name
-- them below. The senders are hashes: repeat('a', 64) is one email address, repeat('1', 64) one
-- network address, and so on.
begin;
select plan(27);

insert into auth.users (id, email)
values
  ('00000000-0000-4000-8980-000000000001', 'test.messages-poster@example.com'),
  ('00000000-0000-4000-8980-000000000002', 'test.messages-member@example.com');

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
    now() - interval '1 day'),
  ('00000000-0000-4000-8990-000000000004', '00000000-0000-4000-8980-000000000001', 'merch',
    'L04 live too', 'Posters.', 'live', now() - interval '1 day', now() + interval '59 days');

-- The counts below start from no messages. A database that people tried the form on holds some
-- for a day; the rollback at the end brings them back.
delete from public.listing_messages;

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
  'public', 'record_listing_message', array['uuid', 'text', 'text', 'integer', 'integer'], 'anon',
  array[]::text[],
  'visitors can''t call record_listing_message'
);

select function_privs_are(
  'public', 'record_listing_message', array['uuid', 'text', 'text', 'integer', 'integer'],
  'authenticated', array[]::text[],
  'members can''t call record_listing_message'
);

select function_privs_are(
  'public', 'record_listing_message', array['uuid', 'text', 'text', 'integer', 'integer'],
  'service_role', array['EXECUTE'],
  'the service role can call record_listing_message'
);

-- Visitors and members can't record messages past the limits, or see who wrote to whom.

set local role anon;
set local request.jwt.claims to '{"role": "anon"}';

select throws_ok(
  $$
    select public.record_listing_message(
      '00000000-0000-4000-8990-000000000001', repeat('a', 64), repeat('1', 64), 1000, 1000
    )
  $$,
  '42501', null,
  'a visitor can''t call the function that records messages'
);

reset role;
set local role authenticated;
set local request.jwt.claims to
  '{"sub": "00000000-0000-4000-8980-000000000002", "role": "authenticated"}';

select throws_ok(
  $$ select 1 from public.listing_messages $$,
  '42501', null,
  'a member can''t read who wrote to whom'
);

reset role;
set local role service_role;

-- The limits: 2 messages a day from a sender (by email or network address), 4 to a listing.

select isnt(
  public.record_listing_message(
    '00000000-0000-4000-8990-000000000001', repeat('a', 64), repeat('1', 64), 2, 4
  ),
  null,
  'a first message is recorded, and its id comes back'
);

select results_eq(
  $$
    select listing_id, sender_email_hash, sender_ip_hash, sent_at = now()
    from public.listing_messages
  $$,
  $$
    values (
      '00000000-0000-4000-8990-000000000001'::uuid, repeat('a', 64), repeat('1', 64), true
    )
  $$,
  'the record holds the listing, the time and the sender''s hashes: nothing of the message'
);

select isnt(
  public.record_listing_message(
    '00000000-0000-4000-8990-000000000001', repeat('a', 64), repeat('1', 64), 2, 4
  ),
  null,
  'a second message from the same sender is recorded'
);

select throws_ok(
  $$
    select public.record_listing_message(
      '00000000-0000-4000-8990-000000000004', repeat('a', 64), repeat('2', 64), 2, 4
    )
  $$,
  'OB201', null,
  'past the limit, the same email address can''t send more, from another network or to another '
    || 'listing'
);

select throws_ok(
  $$
    select public.record_listing_message(
      '00000000-0000-4000-8990-000000000004', repeat('b', 64), repeat('1', 64), 2, 4
    )
  $$,
  'OB201', null,
  'past the limit, the same network address can''t send more under another email address'
);

select is(
  (select count(*)::integer from public.listing_messages),
  2,
  'a refused message adds no row'
);

select isnt(
  public.record_listing_message(
    '00000000-0000-4000-8990-000000000001', repeat('c', 64), repeat('3', 64), 2, 4
  ),
  null,
  'another sender''s messages don''t count against this one'
);

select isnt(
  public.record_listing_message(
    '00000000-0000-4000-8990-000000000001', repeat('d', 64), repeat('4', 64), 2, 4
  ),
  null,
  'a listing takes messages up to its own limit'
);

select throws_ok(
  $$
    select public.record_listing_message(
      '00000000-0000-4000-8990-000000000001', repeat('e', 64), repeat('5', 64), 2, 4
    )
  $$,
  'OB202', null,
  'past its limit, a listing takes no more messages, even from a new sender'
);

select isnt(
  public.record_listing_message(
    '00000000-0000-4000-8990-000000000004', repeat('e', 64), repeat('5', 64), 2, 4
  ),
  null,
  'one listing''s messages don''t count against another'
);

-- Messages from more than a day ago don't count, and go.

insert into public.listing_messages (listing_id, sender_email_hash, sender_ip_hash, sent_at)
select '00000000-0000-4000-8990-000000000004', repeat('f', 64), repeat('6', 64),
  now() - interval '1 day' - make_interval(mins => minute)
from generate_series(1, 4) as minute;

select isnt(
  public.record_listing_message(
    '00000000-0000-4000-8990-000000000004', repeat('f', 64), repeat('6', 64), 2, 4
  ),
  null,
  'messages from more than a day ago count against neither the sender nor the listing'
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
  6,
  'the last day''s rows stay'
);

-- One message at a time: recording holds a lock until the transaction ends.

select ok(
  exists (
    select 1
    from pg_locks
    where locktype = 'advisory'
      and pid = pg_backend_pid()
      and granted
      and objsubid = 1
      and (classid::bigint << 32) | objid::bigint = hashtextextended('listing_messages', 0)
  ),
  'recording a message takes the messages'' lock until the transaction ends'
);

-- Only live listings take messages.

select throws_ok(
  $$
    select public.record_listing_message(
      '00000000-0000-4000-8990-000000000002', repeat('g', 64), repeat('7', 64), 2, 4
    )
  $$,
  'P0002', null,
  'a listing waiting for a moderator takes no messages'
);

select throws_ok(
  $$
    select public.record_listing_message(
      '00000000-0000-4000-8990-000000000003', repeat('g', 64), repeat('7', 64), 2, 4
    )
  $$,
  'P0002', null,
  'a listing past its expiry takes no messages, even before the daily job marks it expired'
);

select throws_ok(
  $$
    select public.record_listing_message(
      '00000000-0000-4000-8990-000000000099', repeat('g', 64), repeat('7', 64), 2, 4
    )
  $$,
  'P0002', null,
  'a listing that doesn''t exist takes no messages'
);

select throws_ok(
  $$
    insert into public.listing_messages (listing_id, sender_email_hash, sender_ip_hash)
    values ('00000000-0000-4000-8990-000000000001', 'jo.ames@example.com', repeat('1', 64))
  $$,
  '23514', null,
  'only a hash goes in, never an address'
);

-- A listing's rows go with it.

reset role;

delete from public.listings where id = '00000000-0000-4000-8990-000000000001';

select is(
  (
    select count(*)::integer from public.listing_messages
    where listing_id = '00000000-0000-4000-8990-000000000001'
  ),
  0,
  'deleting a listing deletes the record of the messages about it'
);

select * from finish();
rollback;
