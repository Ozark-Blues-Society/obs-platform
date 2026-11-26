-- The MailerLite group sync's records (backlog E-3): mailerlite_subscribers, claim_mailerlite_member()
-- and finish_mailerlite_member(), in supabase/migrations/20261126193121_mailerlite_subscribers.sql.
-- The sync runs as the service role, so the behaviour tests do too.
--
-- The test users are created here, inside the transaction. Their ids start
-- 00000000-0000-4000-8940-; the last two digits name them below.
begin;
select plan(30);

insert into auth.users (id, email, raw_user_meta_data)
values
  ('00000000-0000-4000-8940-000000000001', 'test.ml-member@example.com',
    '{"first_name": "Ada", "last_name": "Quinn"}'),
  ('00000000-0000-4000-8940-000000000002', 'test.ml-leaving@example.com', '{}'),
  ('00000000-0000-4000-8940-000000000003', 'test.ml-other@example.com', '{}');

update public.profiles
set level = 'band', status = 'active', expires_at = '2031-07-15 23:00+00'
where id in ('00000000-0000-4000-8940-000000000001', '00000000-0000-4000-8940-000000000002');

-- Who can reach the table and the functions. The behaviour tests below cover what they do.

select policies_are(
  'public', 'mailerlite_subscribers', array[]::name[],
  'mailerlite_subscribers has no policies: only the service role, which bypasses row level '
    || 'security, reads and writes it'
);

select table_privs_are(
  'public', 'mailerlite_subscribers', 'anon', array[]::text[],
  'visitors have no privileges on mailerlite_subscribers'
);

select table_privs_are(
  'public', 'mailerlite_subscribers', 'authenticated', array[]::text[],
  'members have no privileges on mailerlite_subscribers'
);

select function_privs_are(
  'public', 'claim_mailerlite_member', array['uuid', 'integer'], 'anon', array[]::text[],
  'visitors can''t call claim_mailerlite_member'
);

select function_privs_are(
  'public', 'claim_mailerlite_member', array['uuid', 'integer'], 'authenticated', array[]::text[],
  'members can''t call claim_mailerlite_member'
);

select function_privs_are(
  'public', 'claim_mailerlite_member', array['uuid', 'integer'], 'service_role',
  array['EXECUTE'],
  'the service role can call claim_mailerlite_member'
);

select function_privs_are(
  'public', 'finish_mailerlite_member', array['uuid', 'text', 'text', 'text', 'text', 'text[]'],
  'anon', array[]::text[],
  'visitors can''t call finish_mailerlite_member'
);

select function_privs_are(
  'public', 'finish_mailerlite_member', array['uuid', 'text', 'text', 'text', 'text', 'text[]'],
  'authenticated', array[]::text[],
  'members can''t call finish_mailerlite_member'
);

select function_privs_are(
  'public', 'finish_mailerlite_member', array['uuid', 'text', 'text', 'text', 'text', 'text[]'],
  'service_role', array['EXECUTE'],
  'the service role can call finish_mailerlite_member'
);

set local role service_role;

-- Taking a member never synced.

select results_eq(
  $$
    select subscriber_id, synced_email, synced_group_ids, is_profile, email, first_name,
      last_name, level::text, status::text
    from public.claim_mailerlite_member('00000000-0000-4000-8940-000000000001', 60)
  $$,
  $$
    values (null::text, null::text, '{}'::text[], true, 'test.ml-member@example.com', 'Ada',
      'Quinn', 'band', 'active')
  $$,
  'taking a member never synced returns their profile and nothing synced'
);

select results_eq(
  $$
    select subscriber_id, email, group_ids, synced_at, lease_until = now() + interval '60 seconds'
    from public.mailerlite_subscribers
    where profile_id = '00000000-0000-4000-8940-000000000001'
  $$,
  $$ values (null::text, null::text, '{}'::text[], null::timestamptz, true) $$,
  'taking a member never synced gives them a row with nothing but the lease'
);

select is_empty(
  $$ select from public.claim_mailerlite_member('00000000-0000-4000-8940-000000000001', 60) $$,
  'a member another run has taken can''t be taken while its lease runs'
);

-- Recording what MailerLite was given.

select results_eq(
  $$
    select is_profile, email, first_name, last_name, level::text, status::text
    from public.finish_mailerlite_member(
      '00000000-0000-4000-8940-000000000001', '31897397363737859', 'test.ml-member@example.com',
      'Ada', 'Quinn', array['101', '105']
    )
  $$,
  $$ values (true, 'test.ml-member@example.com', 'Ada', 'Quinn', 'band', 'active') $$,
  'finishing returns the profile as it is now'
);

select results_eq(
  $$
    select subscriber_id, email, first_name, last_name, group_ids, synced_at = now(),
      lease_until
    from public.mailerlite_subscribers
    where profile_id = '00000000-0000-4000-8940-000000000001'
  $$,
  $$
    values ('31897397363737859', 'test.ml-member@example.com', 'Ada', 'Quinn',
      array['101', '105'], true, null::timestamptz)
  $$,
  'finishing records what MailerLite was given and lets go of the member'
);

select results_eq(
  $$
    select subscriber_id, synced_email, synced_first_name, synced_last_name, synced_group_ids,
      is_profile, email
    from public.claim_mailerlite_member('00000000-0000-4000-8940-000000000001', 60)
  $$,
  $$
    values ('31897397363737859', 'test.ml-member@example.com', 'Ada', 'Quinn',
      array['101', '105'], true, 'test.ml-member@example.com')
  $$,
  'a member let go of can be taken again, with what MailerLite was given'
);

-- A run that stopped halfway (a crash) holds the member only until its lease runs out.

update public.mailerlite_subscribers
set lease_until = now() - interval '1 second'
where profile_id = '00000000-0000-4000-8940-000000000001';

select isnt_empty(
  $$ select from public.claim_mailerlite_member('00000000-0000-4000-8940-000000000001', 60) $$,
  'a member whose lease has run out can be taken'
);

-- A change made while the member was being synced shows when the run finishes.

update public.profiles
set status = 'expiring', first_name = 'Adaline'
where id = '00000000-0000-4000-8940-000000000001';

select results_eq(
  $$
    select first_name, status::text
    from public.finish_mailerlite_member(
      '00000000-0000-4000-8940-000000000001', '31897397363737859', 'test.ml-member@example.com',
      'Ada', 'Quinn', array['101', '105']
    )
  $$,
  $$ values ('Adaline', 'expiring') $$,
  'finishing reads the profile again, so the run sees a change made meanwhile'
);

select results_eq(
  $$
    select first_name, group_ids
    from public.mailerlite_subscribers
    where profile_id = '00000000-0000-4000-8940-000000000001'
  $$,
  $$ values ('Ada', array['101', '105']) $$,
  'finishing records what the run gave MailerLite, not the profile'
);

-- Out of every member group: the row goes.

select isnt_empty(
  $$ select from public.claim_mailerlite_member('00000000-0000-4000-8940-000000000001', 60) $$,
  'the member can be taken again'
);

select results_eq(
  $$
    select is_profile, status::text
    from public.finish_mailerlite_member(
      '00000000-0000-4000-8940-000000000001', null, null, null, null, null
    )
  $$,
  $$ values (true, 'expiring') $$,
  'finishing without a subscriber still returns the profile'
);

select is_empty(
  $$
    select from public.mailerlite_subscribers
    where profile_id = '00000000-0000-4000-8940-000000000001'
  $$,
  'finishing without a subscriber deletes the member''s row'
);

-- A deleted profile keeps its row, so the sync can still take that subscriber out of the groups.

select isnt_empty(
  $$ select from public.claim_mailerlite_member('00000000-0000-4000-8940-000000000002', 60) $$,
  'a second member can be taken'
);

select results_eq(
  $$
    select is_profile
    from public.finish_mailerlite_member(
      '00000000-0000-4000-8940-000000000002', '31897397363737860',
      'test.ml-leaving@example.com', null, null, array['101', '105']
    )
  $$,
  $$ values (true) $$,
  'the second member is synced'
);

reset role;
delete from auth.users where id = '00000000-0000-4000-8940-000000000002';
set local role service_role;

select results_eq(
  $$
    select subscriber_id, synced_email, synced_group_ids, is_profile, email, level::text
    from public.claim_mailerlite_member('00000000-0000-4000-8940-000000000002', 60)
  $$,
  $$
    values ('31897397363737860', 'test.ml-leaving@example.com', array['101', '105'], false,
      null::text, null::text)
  $$,
  'once a profile is deleted, its row stays: taking it returns the subscriber and no profile'
);

reset role;

-- Members and visitors can't read or write the records or call the functions.

set local role authenticated;
set local request.jwt.claims to
  '{"sub": "00000000-0000-4000-8940-000000000003", "role": "authenticated"}';

select throws_ok(
  $$ select * from public.mailerlite_subscribers $$,
  '42501', null,
  'a member can''t read mailerlite_subscribers, with other members'' addresses'
);

select throws_ok(
  $$
    insert into public.mailerlite_subscribers (profile_id, lease_until)
    values ('00000000-0000-4000-8940-000000000003', now() + interval '1 day')
  $$,
  '42501', null,
  'a member can''t write mailerlite_subscribers, say to keep themselves out of the groups'
);

select throws_ok(
  $$ select * from public.claim_mailerlite_member('00000000-0000-4000-8940-000000000001', 60) $$,
  '42501', null,
  'a member can''t take a member, which would also read their profile'
);

select throws_ok(
  $$
    select * from public.finish_mailerlite_member(
      '00000000-0000-4000-8940-000000000002', null, null, null, null, null
    )
  $$,
  '42501', null,
  'a member can''t finish a member'
);

reset role;
set local role anon;
set local request.jwt.claims to '{"role": "anon"}';

select throws_ok(
  $$ select * from public.mailerlite_subscribers $$,
  '42501', null,
  'a visitor can''t read mailerlite_subscribers'
);

select throws_ok(
  $$ select * from public.claim_mailerlite_member('00000000-0000-4000-8940-000000000001', 60) $$,
  '42501', null,
  'a visitor can''t take a member'
);

reset role;

select * from finish();
rollback;
