-- The Zeffy level mapping (backlog M-3, decision 0007): administrators read and change it, server
-- code with the service role reads it, and nobody else sees a row. The test users are created here,
-- inside the transaction. Their ids start 00000000-0000-4000-89a0- (the other test files use 8900-
-- to 8990-, the fixtures 8100- and 8200-).
--
-- To act as someone, a test switches to the authenticated role and sets the JWT claims, as the Data
-- API does for a request. postgres runs the setup and the checks between, and bypasses row level
-- security. The update and delete checks return a constant, not a column: a statement that reads a
-- column also gets the SELECT policy as a filter, which would hide an UPDATE or DELETE policy that
-- lets too many people in.
begin;
select plan(38);

insert into auth.users (id, email)
values
  ('00000000-0000-4000-89a0-000000000001', 'test.mapping.admin@example.com'),
  ('00000000-0000-4000-89a0-000000000002', 'test.mapping.member@example.com'),
  ('00000000-0000-4000-89a0-000000000003', 'test.mapping.manager@example.com'),
  ('00000000-0000-4000-89a0-000000000004', 'test.mapping.moderator@example.com'),
  ('00000000-0000-4000-89a0-000000000005', 'test.mapping.editor@example.com');

insert into public.user_roles (profile_id, role)
values
  ('00000000-0000-4000-89a0-000000000001', 'admin'),
  ('00000000-0000-4000-89a0-000000000003', 'membership_manager'),
  ('00000000-0000-4000-89a0-000000000004', 'moderator'),
  ('00000000-0000-4000-89a0-000000000005', 'editor');

-- Only this file's rows. The seed's (lib/zeffy/level-mapping.ts) come back at the rollback. Each
-- person's tests below start from these two rows, so a write that one person shouldn't have been
-- able to make can't leave the next person's checks with nothing to find.
delete from public.zeffy_level_mappings;
prepare restore_mapping as
  insert into public.zeffy_level_mappings (campaign_id, rate_id, level)
  values
    ('test-membership-form', 'test-rate-individual', 'individual'),
    ('test-membership-form', 'test-rate-band', 'band')
  on conflict (campaign_id, rate_id) do update set level = excluded.level;
execute restore_mapping;

-- Who can reach the table

select policies_are(
  'public', 'zeffy_level_mappings', array['Admins manage the Zeffy level mapping'],
  'zeffy_level_mappings has one policy, for administrators'
);

select table_privs_are(
  'public', 'zeffy_level_mappings', 'anon', array[]::text[],
  'visitors have no privileges on the mapping'
);

select table_privs_are(
  'public', 'zeffy_level_mappings', 'authenticated', array['SELECT', 'INSERT', 'UPDATE', 'DELETE'],
  'signed-in users may select, insert, update and delete, where the policy lets them, and never '
    || 'truncate'
);

select table_privs_are(
  'public', 'zeffy_level_mappings', 'service_role', array['SELECT'],
  'server code with the service role reads the mapping and can''t change it'
);

select col_is_pk(
  'public', 'zeffy_level_mappings', array['campaign_id', 'rate_id'],
  'a campaign and rate are the key'
);

-- What a mapping can hold

select throws_ok(
  $$
    insert into public.zeffy_level_mappings (campaign_id, rate_id, level)
    values ('test-membership-form', 'test-rate-band', 'sponsor')
  $$,
  '23505', null,
  'a campaign and rate map to one level only'
);

select throws_ok(
  $$
    insert into public.zeffy_level_mappings (campaign_id, rate_id, level)
    values ('test-membership-form', 'test-rate-family', 'family')
  $$,
  '22P02', null,
  'the level is a membership level (there are no family memberships)'
);

select throws_ok(
  $$
    insert into public.zeffy_level_mappings (campaign_id, rate_id, level)
    values ('', 'test-rate-empty', 'band')
  $$,
  '23514', null,
  'a campaign id can''t be empty'
);

select throws_ok(
  $$
    insert into public.zeffy_level_mappings (campaign_id, rate_id, level)
    values ('test-membership-form', repeat('r', 65), 'band')
  $$,
  '23514', null,
  'ids are at most 64 characters'
);

select lives_ok(
  $$
    insert into public.zeffy_level_mappings (campaign_id, rate_id, level)
    values ('test-other-form', 'test-rate-band', 'business')
  $$,
  'the same rate id can map to another level in another campaign'
);

delete from public.zeffy_level_mappings where campaign_id = 'test-other-form';

-- A visitor

set local role anon;

select throws_ok(
  $$ select 1 from public.zeffy_level_mappings $$,
  '42501', null,
  'a visitor can''t read the mapping'
);

select throws_ok(
  $$
    insert into public.zeffy_level_mappings (campaign_id, rate_id, level)
    values ('test-membership-form', 'test-rate-visitor', 'sponsor')
  $$,
  '42501', null,
  'a visitor can''t add a mapping'
);

reset role;

-- A member with no role

set local role authenticated;
set local request.jwt.claims to
  '{"sub": "00000000-0000-4000-89a0-000000000002", "role": "authenticated"}';

select is_empty($$ select 1 from public.zeffy_level_mappings $$, 'a member reads no mapping');

select throws_ok(
  $$
    insert into public.zeffy_level_mappings (campaign_id, rate_id, level)
    values ('test-membership-form', 'test-rate-member', 'sponsor')
  $$,
  '42501', null,
  'a member can''t add a mapping'
);

select is_empty(
  $$ update public.zeffy_level_mappings set level = 'sponsor' returning 1 $$,
  'a member can''t change a mapping'
);

select is_empty(
  $$ delete from public.zeffy_level_mappings returning 1 $$,
  'a member can''t remove a mapping'
);

-- A membership manager

reset role;
execute restore_mapping;
set local role authenticated;
set local request.jwt.claims to
  '{"sub": "00000000-0000-4000-89a0-000000000003", "role": "authenticated"}';

select is_empty(
  $$ select 1 from public.zeffy_level_mappings $$,
  'a membership manager reads no mapping'
);

select throws_ok(
  $$
    insert into public.zeffy_level_mappings (campaign_id, rate_id, level)
    values ('test-membership-form', 'test-rate-manager', 'sponsor')
  $$,
  '42501', null,
  'a membership manager can''t add a mapping'
);

select is_empty(
  $$ update public.zeffy_level_mappings set level = 'sponsor' returning 1 $$,
  'a membership manager can''t change a mapping'
);

select is_empty(
  $$ delete from public.zeffy_level_mappings returning 1 $$,
  'a membership manager can''t remove a mapping'
);

-- A moderator

reset role;
execute restore_mapping;
set local role authenticated;
set local request.jwt.claims to
  '{"sub": "00000000-0000-4000-89a0-000000000004", "role": "authenticated"}';

select is_empty($$ select 1 from public.zeffy_level_mappings $$, 'a moderator reads no mapping');

select throws_ok(
  $$
    insert into public.zeffy_level_mappings (campaign_id, rate_id, level)
    values ('test-membership-form', 'test-rate-moderator', 'sponsor')
  $$,
  '42501', null,
  'a moderator can''t add a mapping'
);

select is_empty(
  $$ update public.zeffy_level_mappings set level = 'sponsor' returning 1 $$,
  'a moderator can''t change a mapping'
);

select is_empty(
  $$ delete from public.zeffy_level_mappings returning 1 $$,
  'a moderator can''t remove a mapping'
);

-- An editor

reset role;
execute restore_mapping;
set local role authenticated;
set local request.jwt.claims to
  '{"sub": "00000000-0000-4000-89a0-000000000005", "role": "authenticated"}';

select is_empty($$ select 1 from public.zeffy_level_mappings $$, 'an editor reads no mapping');

select throws_ok(
  $$
    insert into public.zeffy_level_mappings (campaign_id, rate_id, level)
    values ('test-membership-form', 'test-rate-editor', 'sponsor')
  $$,
  '42501', null,
  'an editor can''t add a mapping'
);

select is_empty(
  $$ update public.zeffy_level_mappings set level = 'sponsor' returning 1 $$,
  'an editor can''t change a mapping'
);

select is_empty(
  $$ delete from public.zeffy_level_mappings returning 1 $$,
  'an editor can''t remove a mapping'
);

reset role;

select results_eq(
  $$ select rate_id, level::text from public.zeffy_level_mappings order by rate_id $$,
  $$ values ('test-rate-band', 'band'), ('test-rate-individual', 'individual') $$,
  'the editor changed nothing either'
);

-- An administrator

execute restore_mapping;
set local role authenticated;
set local request.jwt.claims to
  '{"sub": "00000000-0000-4000-89a0-000000000001", "role": "authenticated"}';

select results_eq(
  $$ select rate_id, level::text from public.zeffy_level_mappings order by rate_id $$,
  $$ values ('test-rate-band', 'band'), ('test-rate-individual', 'individual') $$,
  'an administrator reads every mapping'
);

select lives_ok(
  $$
    insert into public.zeffy_level_mappings (campaign_id, rate_id, level)
    values ('test-membership-form', 'test-rate-business', 'business')
  $$,
  'an administrator adds a mapping'
);

select results_eq(
  $$
    update public.zeffy_level_mappings
    set level = 'sponsor'
    where rate_id = 'test-rate-business'
    returning level::text
  $$,
  $$ values ('sponsor') $$,
  'an administrator changes a mapping'
);

select results_eq(
  $$ delete from public.zeffy_level_mappings where rate_id = 'test-rate-business' returning 1 $$,
  $$ values (1) $$,
  'an administrator removes a mapping'
);

reset role;

-- Server code with the service role

set local role service_role;

select results_eq(
  $$ select rate_id, level::text from public.zeffy_level_mappings order by rate_id $$,
  $$ values ('test-rate-band', 'band'), ('test-rate-individual', 'individual') $$,
  'the service role reads every mapping'
);

select throws_ok(
  $$
    insert into public.zeffy_level_mappings (campaign_id, rate_id, level)
    values ('test-membership-form', 'test-rate-server', 'sponsor')
  $$,
  '42501', null,
  'the service role can''t add a mapping'
);

select throws_ok(
  $$ update public.zeffy_level_mappings set level = 'sponsor' $$,
  '42501', null,
  'the service role can''t change a mapping'
);

select throws_ok(
  $$ delete from public.zeffy_level_mappings $$,
  '42501', null,
  'the service role can''t remove a mapping'
);

reset role;

select results_eq(
  $$ select rate_id, level::text from public.zeffy_level_mappings order by rate_id $$,
  $$ values ('test-rate-band', 'band'), ('test-rate-individual', 'individual') $$,
  'the mapping is as it was: only the administrator changed it, and back'
);

select * from finish();
rollback;
