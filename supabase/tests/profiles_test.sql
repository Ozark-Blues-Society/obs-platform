-- Row level security and privileges on profiles and user_roles (backlog M-2). The test users are
-- created here, inside the transaction, so these tests don't depend on the seed, and creating them
-- runs the sign-up trigger. Their ids start 00000000-0000-4000-8900-; the fixtures use 8100-
-- (members) and 8200- (listings).
--
-- To act as a member, a test switches to the authenticated role and sets the JWT claims, as the
-- Data API does for a request. postgres, which runs the setup and the checks between, bypasses row
-- level security.
begin;
select plan(34);

insert into auth.users (id, email, raw_user_meta_data)
values
  ('00000000-0000-4000-8900-000000000001', 'test.alice@example.com',
    '{"first_name": "Alice", "last_name": "Archer"}'),
  ('00000000-0000-4000-8900-000000000002', 'test.bob@example.com',
    '{"first_name": "Bob", "last_name": "Baker"}'),
  ('00000000-0000-4000-8900-000000000003', 'test.moderator@example.com', '{}'),
  ('00000000-0000-4000-8900-000000000004', 'test.editor@example.com', '{}'),
  ('00000000-0000-4000-8900-000000000005', 'test.admin@example.com', '{}'),
  ('00000000-0000-4000-8900-000000000006', 'test.manager@example.com', '{}');

-- Sign-up

select results_eq(
  $$
    select email, first_name, last_name, level, status, expires_at, auto_renew
    from public.profiles
    where id = '00000000-0000-4000-8900-000000000001'
  $$,
  $$
    values (
      'test.alice@example.com', 'Alice', 'Archer', null::public.membership_level,
      null::public.membership_status, null::timestamptz, false
    )
  $$,
  'signing up creates a profile with the address and names from the sign-up, and no membership'
);

select is(
  (select count(*)::int from public.profiles where id::text like '00000000-0000-4000-8900-%'),
  6,
  'every new user gets a profile'
);

update auth.users
set email = 'test.alice.new@example.com'
where id = '00000000-0000-4000-8900-000000000001';

select is(
  (select email from public.profiles where id = '00000000-0000-4000-8900-000000000001'),
  'test.alice.new@example.com',
  'changing the address in Supabase Auth changes the profile''s address'
);

-- Memberships and roles for the tests below. Only server code (the service role) or postgres can
-- write these.

update public.profiles
set
  level = 'band',
  status = 'active',
  expires_at = now() + interval '200 days',
  joined_at = now() - interval '165 days'
where id::text like '00000000-0000-4000-8900-%';

insert into public.user_roles (profile_id, role)
values
  ('00000000-0000-4000-8900-000000000003', 'moderator'),
  ('00000000-0000-4000-8900-000000000004', 'editor'),
  ('00000000-0000-4000-8900-000000000005', 'admin'),
  ('00000000-0000-4000-8900-000000000006', 'membership_manager');

-- Policies and privileges. Each policy is covered by the behaviour tests below; a new one needs
-- tests of its own.

select policies_are(
  'public', 'profiles',
  array[
    'Read own profile; admins and membership managers read all',
    'Update own profile'
  ],
  'profiles has only the policies tested here'
);

select policies_are(
  'public', 'user_roles',
  array['Read own roles; admins read all'],
  'user_roles has only the policy tested here'
);

select table_privs_are(
  'public', 'profiles', 'anon', array[]::text[],
  'visitors have no privileges on profiles'
);

select table_privs_are(
  'public', 'user_roles', 'anon', array[]::text[],
  'visitors have no privileges on user_roles'
);

select table_privs_are(
  'public', 'profiles', 'authenticated', array['SELECT'],
  'members can only select profiles (updates are granted column by column)'
);

select table_privs_are(
  'public', 'user_roles', 'authenticated', array['SELECT'],
  'members can only select user_roles'
);

select results_eq(
  $$
    select attname::text collate "default"
    from pg_attribute
    where attrelid = 'public.profiles'::regclass
      and attnum > 0
      and not attisdropped
      and has_column_privilege('authenticated', 'public.profiles', attname, 'UPDATE')
    order by attname
  $$,
  array['first_name', 'last_name', 'phone'],
  'the only profile columns members can update are first_name, last_name and phone'
);

select schema_privs_are(
  'private', 'anon', array[]::text[],
  'visitors can''t use the private schema'
);

select schema_privs_are(
  'private', 'authenticated', array['USAGE'],
  'members can call the private schema''s functions (through policies) but not create objects there'
);

-- Alice, a member with no staff role

set local role authenticated;
set local request.jwt.claims to
  '{"sub": "00000000-0000-4000-8900-000000000001", "role": "authenticated"}';

select results_eq(
  $$ select id from public.profiles $$,
  $$ values ('00000000-0000-4000-8900-000000000001'::uuid) $$,
  'a member reads only their own profile'
);

select is_empty(
  $$ select id from public.profiles where id = '00000000-0000-4000-8900-000000000002' $$,
  'a member can''t read another member''s profile'
);

select lives_ok(
  $$
    update public.profiles
    set first_name = 'Allie', last_name = 'Archer-Smith', phone = '(479) 555-0199'
    where id = '00000000-0000-4000-8900-000000000001'
  $$,
  'a member can update their own name and phone'
);

select results_eq(
  $$
    select first_name, last_name, phone
    from public.profiles
    where id = '00000000-0000-4000-8900-000000000001'
  $$,
  $$ values ('Allie', 'Archer-Smith', '(479) 555-0199') $$,
  'the member''s changes are saved'
);

select is_empty(
  $$
    update public.profiles
    set first_name = 'Mallory'
    where id = '00000000-0000-4000-8900-000000000002'
    returning id
  $$,
  'a member can''t update another member''s profile'
);

select throws_ok(
  $$
    update public.profiles
    set level = 'sponsor'
    where id = '00000000-0000-4000-8900-000000000001'
  $$,
  '42501', null,
  'a member can''t change their own level'
);

select throws_ok(
  $$
    update public.profiles
    set status = 'expiring'
    where id = '00000000-0000-4000-8900-000000000001'
  $$,
  '42501', null,
  'a member can''t change their own status'
);

select throws_ok(
  $$
    update public.profiles
    set expires_at = now() + interval '10 years'
    where id = '00000000-0000-4000-8900-000000000001'
  $$,
  '42501', null,
  'a member can''t change their own expires_at'
);

select throws_ok(
  $$
    insert into public.profiles (id, email)
    values ('00000000-0000-4000-8900-000000000099', 'test.mallory@example.com')
  $$,
  '42501', null,
  'a member can''t create profiles'
);

select throws_ok(
  $$ delete from public.profiles where id = '00000000-0000-4000-8900-000000000001' $$,
  '42501', null,
  'a member can''t delete profiles'
);

select is_empty(
  $$ select role from public.user_roles $$,
  'a member with no role can''t see anyone''s roles'
);

select throws_ok(
  $$
    insert into public.user_roles (profile_id, role)
    values ('00000000-0000-4000-8900-000000000001', 'admin')
  $$,
  '42501', null,
  'a member can''t give themselves a role'
);

reset role;

select is(
  (select first_name from public.profiles where id = '00000000-0000-4000-8900-000000000002'),
  'Bob',
  'the other member''s profile is unchanged'
);

-- The moderator

set local role authenticated;
set local request.jwt.claims to
  '{"sub": "00000000-0000-4000-8900-000000000003", "role": "authenticated"}';

select results_eq(
  $$ select id from public.profiles $$,
  $$ values ('00000000-0000-4000-8900-000000000003'::uuid) $$,
  'a moderator can''t read other members'' profiles'
);

select results_eq(
  $$ select role::text from public.user_roles $$,
  $$ values ('moderator') $$,
  'a moderator reads only their own role'
);

-- The editor

set local request.jwt.claims to
  '{"sub": "00000000-0000-4000-8900-000000000004", "role": "authenticated"}';

select results_eq(
  $$ select id from public.profiles $$,
  $$ values ('00000000-0000-4000-8900-000000000004'::uuid) $$,
  'an editor can''t read other members'' profiles'
);

-- The administrator

set local request.jwt.claims to
  '{"sub": "00000000-0000-4000-8900-000000000005", "role": "authenticated"}';

select is(
  (select count(*)::int from public.profiles where id::text like '00000000-0000-4000-8900-%'),
  6,
  'an administrator reads every profile'
);

select is(
  (
    select count(*)::int
    from public.user_roles
    where profile_id::text like '00000000-0000-4000-8900-%'
  ),
  4,
  'an administrator reads every role'
);

-- The membership manager

set local request.jwt.claims to
  '{"sub": "00000000-0000-4000-8900-000000000006", "role": "authenticated"}';

select is(
  (select count(*)::int from public.profiles where id::text like '00000000-0000-4000-8900-%'),
  6,
  'a membership manager reads every profile'
);

select results_eq(
  $$ select role::text from public.user_roles $$,
  $$ values ('membership_manager') $$,
  'a membership manager reads only their own role'
);

-- A visitor

reset role;
set local role anon;
set local request.jwt.claims to '{"role": "anon"}';

select throws_ok(
  $$ select id from public.profiles $$,
  '42501', null,
  'visitors can''t read profiles'
);

select throws_ok(
  $$ select role from public.user_roles $$,
  '42501', null,
  'visitors can''t read roles'
);

reset role;

select * from finish();
rollback;
