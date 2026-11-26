-- Granting and revoking staff roles (backlog A-2): only administrators can, nobody changes a role
-- in place, and the last administrator can't be removed. The test users are created here, inside
-- the transaction. Their ids start 00000000-0000-4000-8901- (profiles_test.sql uses 8900-, the
-- fixtures 8100- and 8200-).
--
-- To act as someone, a test switches to the authenticated role and sets the JWT claims, as the Data
-- API does for a request. postgres runs the setup and the checks between, and bypasses row level
-- security. service_role is server code, which bypasses it too.
begin;
select plan(30);

insert into auth.users (id, email)
values
  ('00000000-0000-4000-8901-000000000001', 'test.roles.admin@example.com'),
  ('00000000-0000-4000-8901-000000000002', 'test.roles.second.admin@example.com'),
  ('00000000-0000-4000-8901-000000000003', 'test.roles.member@example.com'),
  ('00000000-0000-4000-8901-000000000004', 'test.roles.manager@example.com'),
  ('00000000-0000-4000-8901-000000000005', 'test.roles.moderator@example.com'),
  ('00000000-0000-4000-8901-000000000006', 'test.roles.editor@example.com');

insert into public.user_roles (profile_id, role)
values
  ('00000000-0000-4000-8901-000000000001', 'admin'),
  ('00000000-0000-4000-8901-000000000002', 'admin'),
  ('00000000-0000-4000-8901-000000000004', 'membership_manager'),
  ('00000000-0000-4000-8901-000000000005', 'moderator'),
  ('00000000-0000-4000-8901-000000000006', 'editor');

-- The seed has an administrator too. Leave the two test administrators as the only ones, so the
-- tests below don't depend on other data. The trigger allows it, since these two remain.
delete from public.user_roles
where role = 'admin'
  and profile_id not in (
    '00000000-0000-4000-8901-000000000001', '00000000-0000-4000-8901-000000000002'
  );

select results_eq(
  $$ select profile_id from public.user_roles where role = 'admin' order by profile_id $$,
  $$
    values
      ('00000000-0000-4000-8901-000000000001'::uuid),
      ('00000000-0000-4000-8901-000000000002'::uuid)
  $$,
  'the two test administrators are the only ones'
);

-- An administrator

set local role authenticated;
set local request.jwt.claims to
  '{"sub": "00000000-0000-4000-8901-000000000001", "role": "authenticated"}';

select lives_ok(
  $$
    insert into public.user_roles (profile_id, role)
    values ('00000000-0000-4000-8901-000000000003', 'moderator')
  $$,
  'an administrator can give a member a role'
);

select results_eq(
  $$
    select role::text
    from public.user_roles
    where profile_id = '00000000-0000-4000-8901-000000000003'
  $$,
  $$ values ('moderator') $$,
  'the member has the role'
);

select throws_ok(
  $$
    insert into public.user_roles (profile_id, role)
    values ('00000000-0000-4000-8901-000000000003', 'moderator')
  $$,
  '23505', null,
  'giving someone a role they already have fails'
);

select results_eq(
  $$
    delete from public.user_roles
    where profile_id = '00000000-0000-4000-8901-000000000003' and role = 'moderator'
    returning role::text
  $$,
  $$ values ('moderator') $$,
  'an administrator can remove a member''s role'
);

select is_empty(
  $$ select role from public.user_roles where profile_id = '00000000-0000-4000-8901-000000000003' $$,
  'the member no longer has the role'
);

select throws_ok(
  $$
    update public.user_roles
    set role = 'editor'
    where profile_id = '00000000-0000-4000-8901-000000000005'
  $$,
  '42501', null,
  'not even an administrator can change a role in place'
);

-- The last administrator

select throws_ok(
  $$ delete from public.user_roles where role = 'admin' $$,
  'OB001', 'The last administrator can''t be removed.',
  'removing every administrator at once fails'
);

select results_eq(
  $$ select profile_id from public.user_roles where role = 'admin' order by profile_id $$,
  $$
    values
      ('00000000-0000-4000-8901-000000000001'::uuid),
      ('00000000-0000-4000-8901-000000000002'::uuid)
  $$,
  'so both administrators keep the role'
);

set local request.jwt.claims to
  '{"sub": "00000000-0000-4000-8901-000000000002", "role": "authenticated"}';

select results_eq(
  $$
    delete from public.user_roles
    where profile_id = '00000000-0000-4000-8901-000000000002' and role = 'admin'
    returning role::text
  $$,
  $$ values ('admin') $$,
  'an administrator can give up the role while another administrator remains'
);

set local request.jwt.claims to
  '{"sub": "00000000-0000-4000-8901-000000000001", "role": "authenticated"}';

select throws_ok(
  $$
    delete from public.user_roles
    where profile_id = '00000000-0000-4000-8901-000000000001' and role = 'admin'
  $$,
  'OB001', 'The last administrator can''t be removed.',
  'the last administrator can''t give up the role'
);

select lives_ok(
  $$
    insert into public.user_roles (profile_id, role)
    values ('00000000-0000-4000-8901-000000000001', 'editor')
  $$,
  'the last administrator can give themselves another role'
);

select results_eq(
  $$
    delete from public.user_roles
    where profile_id = '00000000-0000-4000-8901-000000000001' and role = 'editor'
    returning role::text
  $$,
  $$ values ('editor') $$,
  'and remove it again: only the Administrator role is held back'
);

-- Everyone else. Each staff member tries to remove their own role, which they can see, so only the
-- policy for removing roles stands in the way.

set local request.jwt.claims to
  '{"sub": "00000000-0000-4000-8901-000000000003", "role": "authenticated"}';

select throws_ok(
  $$
    insert into public.user_roles (profile_id, role)
    values ('00000000-0000-4000-8901-000000000006', 'moderator')
  $$,
  '42501', null,
  'a member can''t give anyone a role'
);

select is_empty(
  $$
    delete from public.user_roles
    where profile_id = '00000000-0000-4000-8901-000000000005'
    returning role
  $$,
  'a member can''t remove anyone''s role'
);

set local request.jwt.claims to
  '{"sub": "00000000-0000-4000-8901-000000000004", "role": "authenticated"}';

select throws_ok(
  $$
    insert into public.user_roles (profile_id, role)
    values ('00000000-0000-4000-8901-000000000004', 'admin')
  $$,
  '42501', null,
  'a membership manager can''t give anyone a role'
);

select is_empty(
  $$
    delete from public.user_roles
    where profile_id = '00000000-0000-4000-8901-000000000004'
    returning role
  $$,
  'a membership manager can''t remove a role, even their own'
);

set local request.jwt.claims to
  '{"sub": "00000000-0000-4000-8901-000000000005", "role": "authenticated"}';

select throws_ok(
  $$
    insert into public.user_roles (profile_id, role)
    values ('00000000-0000-4000-8901-000000000005', 'admin')
  $$,
  '42501', null,
  'a moderator can''t give anyone a role'
);

select is_empty(
  $$
    delete from public.user_roles
    where profile_id = '00000000-0000-4000-8901-000000000005'
    returning role
  $$,
  'a moderator can''t remove a role, even their own'
);

set local request.jwt.claims to
  '{"sub": "00000000-0000-4000-8901-000000000006", "role": "authenticated"}';

select throws_ok(
  $$
    insert into public.user_roles (profile_id, role)
    values ('00000000-0000-4000-8901-000000000006', 'admin')
  $$,
  '42501', null,
  'an editor can''t give anyone a role'
);

select is_empty(
  $$
    delete from public.user_roles
    where profile_id = '00000000-0000-4000-8901-000000000006'
    returning role
  $$,
  'an editor can''t remove a role, even their own'
);

reset role;
set local role anon;
set local request.jwt.claims to '{"role": "anon"}';

select throws_ok(
  $$
    insert into public.user_roles (profile_id, role)
    values ('00000000-0000-4000-8901-000000000003', 'admin')
  $$,
  '42501', null,
  'visitors can''t give anyone a role'
);

select throws_ok(
  $$ delete from public.user_roles where profile_id = '00000000-0000-4000-8901-000000000005' $$,
  '42501', null,
  'visitors can''t remove anyone''s role'
);

reset role;

select results_eq(
  $$
    select profile_id, role::text
    from public.user_roles
    where profile_id::text like '00000000-0000-4000-8901-%'
    order by profile_id, role
  $$,
  $$
    values
      ('00000000-0000-4000-8901-000000000001'::uuid, 'admin'),
      ('00000000-0000-4000-8901-000000000004'::uuid, 'membership_manager'),
      ('00000000-0000-4000-8901-000000000005'::uuid, 'moderator'),
      ('00000000-0000-4000-8901-000000000006'::uuid, 'editor')
  $$,
  'nobody but the administrators changed a role'
);

-- Server code, and deleting accounts

set local role service_role;

select throws_ok(
  $$
    delete from public.user_roles
    where profile_id = '00000000-0000-4000-8901-000000000001' and role = 'admin'
  $$,
  'OB001', 'The last administrator can''t be removed.',
  'server code can''t remove the last administrator either'
);

select throws_ok(
  $$
    update public.user_roles
    set role = 'editor'
    where profile_id = '00000000-0000-4000-8901-000000000001' and role = 'admin'
  $$,
  'OB001', 'The last administrator can''t be removed.',
  'or turn the last administrator''s role into another'
);

select lives_ok(
  $$
    update public.user_roles
    set role = 'admin'
    where profile_id = '00000000-0000-4000-8901-000000000001' and role = 'admin'
  $$,
  'an update that keeps the Administrator role goes through'
);

reset role;

select throws_ok(
  $$ delete from auth.users where id = '00000000-0000-4000-8901-000000000001' $$,
  'OB001', 'The last administrator can''t be removed.',
  'the last administrator''s account can''t be deleted'
);

insert into public.user_roles (profile_id, role)
values ('00000000-0000-4000-8901-000000000003', 'admin');

select lives_ok(
  $$ delete from auth.users where id = '00000000-0000-4000-8901-000000000001' $$,
  'once someone else is an administrator, the old one''s account can be deleted'
);

select results_eq(
  $$ select profile_id from public.user_roles where role = 'admin' $$,
  $$ values ('00000000-0000-4000-8901-000000000003'::uuid) $$,
  'which leaves the new administrator'
);

select * from finish();
rollback;
