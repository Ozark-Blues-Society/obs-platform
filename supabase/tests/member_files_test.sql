-- Members-only files (backlog M-7): row level security on public.member_files and the Storage
-- policies on the member-files bucket. Downloading, listing and signing a URL all need SELECT on
-- storage.objects, so the object queries below stand for what Storage lets each person do.
--
-- The test users are created here, inside the transaction. Their ids start
-- 00000000-0000-4000-8910- and the files' 00000000-0000-4000-8920-. Direct deletes from Storage
-- tables are blocked by a trigger unless storage.allow_delete_query is on; the tests turn it on so
-- that only the policies decide.
begin;
select plan(35);

insert into auth.users (id, email)
values
  ('00000000-0000-4000-8910-000000000001', 'test.band@example.com'),
  ('00000000-0000-4000-8910-000000000002', 'test.individual@example.com'),
  ('00000000-0000-4000-8910-000000000003', 'test.lapsed@example.com'),
  ('00000000-0000-4000-8910-000000000004', 'test.ends-now@example.com'),
  ('00000000-0000-4000-8910-000000000005', 'test.never-paid@example.com'),
  ('00000000-0000-4000-8910-000000000006', 'test.editor@example.com'),
  ('00000000-0000-4000-8910-000000000007', 'test.admin@example.com'),
  ('00000000-0000-4000-8910-000000000008', 'test.sponsor@example.com');

-- Memberships: only server code (the service role) or postgres can write these. now() is the
-- transaction's start, the same instant the policies compare against.
update public.profiles
set
  level = case id
    when '00000000-0000-4000-8910-000000000002' then 'individual'::public.membership_level
    when '00000000-0000-4000-8910-000000000008' then 'sponsor'
    else 'band'
  end,
  expires_at = case id
    when '00000000-0000-4000-8910-000000000003' then now() - interval '1 day'
    when '00000000-0000-4000-8910-000000000004' then now()
    else now() + interval '30 days'
  end
where id in (
  '00000000-0000-4000-8910-000000000001', '00000000-0000-4000-8910-000000000002',
  '00000000-0000-4000-8910-000000000003', '00000000-0000-4000-8910-000000000004',
  '00000000-0000-4000-8910-000000000008'
);

insert into public.user_roles (profile_id, role)
values
  ('00000000-0000-4000-8910-000000000006', 'editor'),
  ('00000000-0000-4000-8910-000000000007', 'admin');

-- Three files: for every member, for Band and up, for Sponsors only.
insert into public.member_files (id, title, object_path, file_name, audience, levels)
values
  ('00000000-0000-4000-8920-000000000001', 'Meeting minutes',
    '00000000-0000-4000-8920-000000000001/minutes.pdf', 'Minutes.pdf', 'members', '{}'),
  ('00000000-0000-4000-8920-000000000002', 'Venue booking guide',
    '00000000-0000-4000-8920-000000000002/booking-guide.pdf', 'Booking guide.pdf', 'levels',
    '{band,business,sponsor}'),
  ('00000000-0000-4000-8920-000000000003', 'Sponsor kit',
    '00000000-0000-4000-8920-000000000003/sponsor-kit.zip', 'Sponsor kit.zip', 'levels',
    '{sponsor}');

insert into storage.objects (bucket_id, name)
values
  ('member-files', '00000000-0000-4000-8920-000000000001/minutes.pdf'),
  ('member-files', '00000000-0000-4000-8920-000000000002/booking-guide.pdf'),
  ('member-files', '00000000-0000-4000-8920-000000000003/sponsor-kit.zip');

-- The bucket, policies and privileges. Each policy is covered by the behaviour tests below; a new
-- one needs tests of its own.

select is(
  (select public from storage.buckets where id = 'member-files'),
  false,
  'the member-files bucket is private: no public URLs'
);

select policies_are(
  'public', 'member_files',
  array[
    'Members read files they may download; editors read all',
    'Editors add member files',
    'Editors remove member files'
  ],
  'member_files has only the policies tested here'
);

select policies_are(
  'storage', 'objects',
  array[
    'Members download member files they may',
    'Editors upload member files',
    'Editors remove member files'
  ],
  'storage.objects has only the policies tested here'
);

select table_privs_are(
  'public', 'member_files', 'anon', array[]::text[],
  'visitors have no privileges on member_files'
);

select table_privs_are(
  'public', 'member_files', 'authenticated', array['SELECT', 'INSERT', 'DELETE'],
  'members can select, insert and delete member_files rows (as the policies allow), never update them'
);

select throws_ok(
  $$
    insert into public.member_files (id, title, object_path, file_name, audience, levels)
    values ('00000000-0000-4000-8920-000000000009', 'No levels',
      '00000000-0000-4000-8920-000000000009/a.pdf', 'a.pdf', 'levels', '{}')
  $$,
  '23514', null,
  'a file for some levels needs at least one level'
);

select throws_ok(
  $$
    insert into public.member_files (id, title, object_path, file_name)
    values ('00000000-0000-4000-8920-000000000009', 'Elsewhere',
      '00000000-0000-4000-8920-000000000001/a.pdf', 'a.pdf')
  $$,
  '23514', null,
  'a file''s object lives in a folder named after its own id'
);

-- A visitor

set local role anon;
set local request.jwt.claims to '{"role": "anon"}';

select throws_ok(
  $$ select id from public.member_files $$,
  '42501', null,
  'a visitor can''t read member_files'
);

select is_empty(
  $$ select name from storage.objects where bucket_id = 'member-files' $$,
  'a visitor can''t list or download members-only files'
);

select throws_ok(
  $$ insert into storage.objects (bucket_id, name) values ('member-files', 'x/evil.pdf') $$,
  '42501', null,
  'a visitor can''t upload to the member-files bucket'
);

select throws_ok(
  $$ select private.has_member_access('members', '{}') $$,
  '42501', null,
  'a visitor can''t call the membership check'
);

reset role;

-- An active Band member

set local role authenticated;
set local request.jwt.claims to
  '{"sub": "00000000-0000-4000-8910-000000000001", "role": "authenticated"}';

select results_eq(
  $$ select title from public.member_files order by title $$,
  array['Meeting minutes', 'Venue booking guide'],
  'a Band member reads the files for every member and for Band and up, not Sponsors only'
);

select results_eq(
  $$ select name from storage.objects where bucket_id = 'member-files' order by name $$,
  array[
    '00000000-0000-4000-8920-000000000001/minutes.pdf',
    '00000000-0000-4000-8920-000000000002/booking-guide.pdf'
  ],
  'a Band member can download the same files and no others'
);

select throws_ok(
  $$
    insert into public.member_files (id, title, object_path, file_name)
    values ('00000000-0000-4000-8920-000000000009', 'Mine',
      '00000000-0000-4000-8920-000000000009/mine.pdf', 'mine.pdf')
  $$,
  '42501', null,
  'a member can''t add files'
);

select is_empty(
  $$ delete from public.member_files returning id $$,
  'a member can''t remove files'
);

select throws_ok(
  $$ update public.member_files set title = 'Changed' $$,
  '42501', null,
  'nobody changes a file''s row in place'
);

select throws_ok(
  $$
    insert into storage.objects (bucket_id, name)
    values ('member-files', '00000000-0000-4000-8920-000000000009/mine.pdf')
  $$,
  '42501', null,
  'a member can''t upload to the member-files bucket'
);

set local storage.allow_delete_query = 'true';

select is_empty(
  $$ delete from storage.objects where bucket_id = 'member-files' returning name $$,
  'a member can''t remove files from the bucket'
);

reset role;

-- An active Individual member: the wrong level for two of the files

set local role authenticated;
set local request.jwt.claims to
  '{"sub": "00000000-0000-4000-8910-000000000002", "role": "authenticated"}';

select results_eq(
  $$ select title from public.member_files order by title $$,
  array['Meeting minutes'],
  'an Individual member reads only the file for every member'
);

select results_eq(
  $$ select name from storage.objects where bucket_id = 'member-files' order by name $$,
  array['00000000-0000-4000-8920-000000000001/minutes.pdf'],
  'an Individual member can''t list or download the files for other levels'
);

reset role;

-- An active Sponsor

set local role authenticated;
set local request.jwt.claims to
  '{"sub": "00000000-0000-4000-8910-000000000008", "role": "authenticated"}';

select results_eq(
  $$ select title from public.member_files order by title $$,
  array['Meeting minutes', 'Sponsor kit', 'Venue booking guide'],
  'a Sponsor reads all three files'
);

reset role;

-- Members without an active membership

set local role authenticated;
set local request.jwt.claims to
  '{"sub": "00000000-0000-4000-8910-000000000003", "role": "authenticated"}';

select is_empty(
  $$ select id from public.member_files $$,
  'a member whose membership ended yesterday reads no files'
);

select is_empty(
  $$ select name from storage.objects where bucket_id = 'member-files' $$,
  'a member whose membership ended can''t list or download any file'
);

reset role;

set local role authenticated;
set local request.jwt.claims to
  '{"sub": "00000000-0000-4000-8910-000000000004", "role": "authenticated"}';

select is_empty(
  $$ select name from storage.objects where bucket_id = 'member-files' $$,
  'access ends at expires_at: a membership ending this instant downloads nothing'
);

reset role;

set local role authenticated;
set local request.jwt.claims to
  '{"sub": "00000000-0000-4000-8910-000000000005", "role": "authenticated"}';

select is_empty(
  $$ select id from public.member_files $$,
  'someone who signed up but never paid reads no files'
);

reset role;

-- An editor (no membership needed: the role is enough)

set local role authenticated;
set local request.jwt.claims to
  '{"sub": "00000000-0000-4000-8910-000000000006", "role": "authenticated"}';

select results_eq(
  $$ select title from public.member_files order by title $$,
  array['Meeting minutes', 'Sponsor kit', 'Venue booking guide'],
  'an editor reads every file'
);

select is(
  (select count(*)::int from storage.objects where bucket_id = 'member-files'),
  3,
  'an editor can download every file'
);

select lives_ok(
  $$
    insert into storage.objects (bucket_id, name)
    values ('member-files', '00000000-0000-4000-8920-000000000004/newsletter.pdf')
  $$,
  'an editor can upload to the member-files bucket'
);

select lives_ok(
  $$
    insert into public.member_files (id, title, object_path, file_name)
    values ('00000000-0000-4000-8920-000000000004', 'Newsletter',
      '00000000-0000-4000-8920-000000000004/newsletter.pdf', 'Newsletter.pdf')
  $$,
  'an editor can add a file'
);

select is(
  (select uploaded_by from public.member_files where id = '00000000-0000-4000-8920-000000000004'),
  '00000000-0000-4000-8910-000000000006'::uuid,
  'a new file records who added it'
);

select throws_ok(
  $$
    insert into public.member_files (id, title, object_path, file_name, uploaded_by)
    values ('00000000-0000-4000-8920-000000000005', 'Not mine',
      '00000000-0000-4000-8920-000000000005/x.pdf', 'x.pdf', '00000000-0000-4000-8910-000000000007')
  $$,
  '42501', null,
  'an editor can''t add a file in someone else''s name'
);

select results_eq(
  $$
    delete from public.member_files
    where id = '00000000-0000-4000-8920-000000000004'
    returning title
  $$,
  array['Newsletter'],
  'an editor can remove a file'
);

set local storage.allow_delete_query = 'true';

select results_eq(
  $$
    delete from storage.objects
    where bucket_id = 'member-files' and name like '00000000-0000-4000-8920-000000000004/%'
    returning name
  $$,
  array['00000000-0000-4000-8920-000000000004/newsletter.pdf'],
  'an editor can remove a file from the bucket'
);

reset role;

-- An administrator

set local role authenticated;
set local request.jwt.claims to
  '{"sub": "00000000-0000-4000-8910-000000000007", "role": "authenticated"}';

select is(
  (select count(*)::int from public.member_files),
  3,
  'an administrator reads every file'
);

reset role;

-- Access follows expires_at when it changes: a renewal opens the files again.

update public.profiles
set expires_at = now() + interval '1 year'
where id = '00000000-0000-4000-8910-000000000003';

set local role authenticated;
set local request.jwt.claims to
  '{"sub": "00000000-0000-4000-8910-000000000003", "role": "authenticated"}';

select results_eq(
  $$ select title from public.member_files order by title $$,
  array['Meeting minutes', 'Venue booking guide'],
  'after renewing, the Band member reads their files again'
);

reset role;

select * from finish();
rollback;
