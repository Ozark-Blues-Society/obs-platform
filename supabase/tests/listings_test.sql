-- Classifieds listings (backlog K-1): row level security and the change rules on public.listings,
-- and the Storage policies on the listing-photos bucket. Viewing, listing and signing a URL all
-- need SELECT on storage.objects, so the object queries below stand for what Storage lets each
-- person do with a photo.
--
-- The test users are created here, inside the transaction. Their ids start
-- 00000000-0000-4000-8930-, the listings' 00000000-0000-4000-8940- and the photos' names end in
-- 00000000-0000-4000-8950-<n>. Each listing's title starts with its number (T01...), so results
-- read as titles. Direct deletes from Storage tables are blocked by a trigger unless
-- storage.allow_delete_query is on; the tests turn it on so that only the policies decide.
--
-- The sections change the data as they go (a poster edits and deletes, a moderator approves), so
-- each section's expected results follow from the ones before it.
begin;
select plan(67);

insert into auth.users (id, email)
values
  ('00000000-0000-4000-8930-000000000001', 'test.poster@example.com'),
  ('00000000-0000-4000-8930-000000000002', 'test.other-member@example.com'),
  ('00000000-0000-4000-8930-000000000003', 'test.lapsed@example.com'),
  ('00000000-0000-4000-8930-000000000004', 'test.ends-now@example.com'),
  ('00000000-0000-4000-8930-000000000005', 'test.never-paid@example.com'),
  ('00000000-0000-4000-8930-000000000006', 'test.moderator@example.com'),
  ('00000000-0000-4000-8930-000000000007', 'test.admin@example.com'),
  ('00000000-0000-4000-8930-000000000008', 'test.editor@example.com'),
  ('00000000-0000-4000-8930-000000000009', 'test.membership-manager@example.com');

-- Memberships: only server code (the service role) or postgres can write these. now() is the
-- transaction's start, the same instant the policies compare against. The staff have no
-- membership: their roles are what count.
update public.profiles
set
  level = case id
    when '00000000-0000-4000-8930-000000000001' then 'individual'::public.membership_level
    else 'band'
  end,
  expires_at = case id
    when '00000000-0000-4000-8930-000000000003' then now() - interval '1 day'
    when '00000000-0000-4000-8930-000000000004' then now()
    else now() + interval '30 days'
  end
where id in (
  '00000000-0000-4000-8930-000000000001', '00000000-0000-4000-8930-000000000002',
  '00000000-0000-4000-8930-000000000003', '00000000-0000-4000-8930-000000000004'
);

insert into public.user_roles (profile_id, role)
values
  ('00000000-0000-4000-8930-000000000006', 'moderator'),
  ('00000000-0000-4000-8930-000000000007', 'admin'),
  ('00000000-0000-4000-8930-000000000008', 'editor'),
  ('00000000-0000-4000-8930-000000000009', 'membership_manager');

insert into public.listings (
  id, profile_id, category, title, body, price, photo_path, status, reject_reason, created_at,
  approved_at, expires_at
)
values
  ('00000000-0000-4000-8940-000000000001', '00000000-0000-4000-8930-000000000001', 'gear',
    'T01 poster live', 'Tweed-style amp.', 650,
    '00000000-0000-4000-8930-000000000001/00000000-0000-4000-8950-000000000001.jpg', 'live', null,
    now() - interval '11 days', now() - interval '10 days', now() + interval '50 days'),
  ('00000000-0000-4000-8940-000000000002', '00000000-0000-4000-8930-000000000001',
    'musicians_wanted', 'T02 poster pending', 'Bass player wanted.', null,
    '00000000-0000-4000-8930-000000000001/00000000-0000-4000-8950-000000000002.jpg', 'pending',
    null, now(), null, null),
  ('00000000-0000-4000-8940-000000000003', '00000000-0000-4000-8930-000000000002', 'merch',
    'T03 other live', 'Band T-shirts.', 20, null, 'live', null,
    now() - interval '6 days', now() - interval '5 days', now() + interval '55 days'),
  ('00000000-0000-4000-8940-000000000004', '00000000-0000-4000-8930-000000000002',
    'street_team', 'T04 other pending', 'Poster crew.', null,
    '00000000-0000-4000-8930-000000000002/00000000-0000-4000-8950-000000000004.webp', 'pending',
    null, now(), null, null),
  ('00000000-0000-4000-8940-000000000005', '00000000-0000-4000-8930-000000000002',
    'member_connect', 'T05 other rejected', 'Cheap sunglasses.', 5, null, 'rejected',
    'Not about music or the Society.', now() - interval '2 days', null, null),
  ('00000000-0000-4000-8940-000000000006', '00000000-0000-4000-8930-000000000002', 'gear',
    'T06 other expired', 'Acoustic guitar.', 400, null, 'expired', null,
    now() - interval '71 days', now() - interval '70 days', now() - interval '10 days'),
  -- Live, but its 60 days ended a minute ago and the scheduled job hasn't marked it expired yet.
  ('00000000-0000-4000-8940-000000000007', '00000000-0000-4000-8930-000000000002', 'gear',
    'T07 other live past expiry', 'Drum kit.', 300, null, 'live', null,
    now() - interval '61 days', now() - interval '60 days 1 minute', now() - interval '1 minute'),
  ('00000000-0000-4000-8940-000000000008', '00000000-0000-4000-8930-000000000003', 'gear',
    'T08 lapsed live', 'Harmonica set.', 120, null, 'live', null,
    now() - interval '4 days', now() - interval '3 days', now() + interval '57 days'),
  ('00000000-0000-4000-8940-000000000009', '00000000-0000-4000-8930-000000000001',
    'member_connect', 'T09 poster live to edit', 'Carpool to the auditions.', null, null, 'live',
    null, now() - interval '2 days', now() - interval '1 day', now() + interval '59 days'),
  ('00000000-0000-4000-8940-000000000010', '00000000-0000-4000-8930-000000000002',
    'musicians_wanted', 'T10 other pending to approve', 'Keys player wanted.', null, null,
    'pending', null, now(), null, null),
  ('00000000-0000-4000-8940-000000000011', '00000000-0000-4000-8930-000000000002', 'merch',
    'T11 other pending to reject', 'Posters.', null, null, 'pending', null, now(), null, null);

-- The photos of T01, T02 and T04, and an upload of each member's that no listing shows (yet).
insert into storage.objects (bucket_id, name)
values
  ('listing-photos', '00000000-0000-4000-8930-000000000001/00000000-0000-4000-8950-000000000001.jpg'),
  ('listing-photos', '00000000-0000-4000-8930-000000000001/00000000-0000-4000-8950-000000000002.jpg'),
  ('listing-photos', '00000000-0000-4000-8930-000000000001/00000000-0000-4000-8950-000000000003.png'),
  ('listing-photos', '00000000-0000-4000-8930-000000000002/00000000-0000-4000-8950-000000000004.webp'),
  ('listing-photos', '00000000-0000-4000-8930-000000000002/00000000-0000-4000-8950-000000000006.jpg');

-- The bucket, policies, privileges and constraints. Each policy is covered by the behaviour tests
-- below; a new one needs tests of its own.

select is(
  (select public from storage.buckets where id = 'listing-photos'),
  false,
  'the listing-photos bucket is private: no public URLs'
);

select results_eq(
  $$
    select file_size_limit, allowed_mime_types
    from storage.buckets
    where id = 'listing-photos'
  $$,
  $$ values (10485760::bigint, array['image/jpeg', 'image/png', 'image/webp']) $$,
  'listing photos are JPEG, PNG or WebP images of at most 10 MB'
);

select policies_are(
  'public', 'listings',
  array[
    'Visitors read live listings',
    'Members read live listings and their own; moderators read all',
    'Active members submit listings',
    'Active posters change their listings; moderators change any',
    'Posters delete their own listings'
  ],
  'listings has only the policies tested here'
);

select results_eq(
  $$
    select policyname::text collate "default"
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and (qual like '%listing-photos%' or with_check like '%listing-photos%')
    order by policyname
  $$,
  array[
    'Active members upload listing photos',
    'Anyone sees the photos of listings they can read',
    'Members remove their unused listing photos'
  ],
  'the listing-photos bucket has only the Storage policies tested here'
);

select table_privs_are(
  'public', 'listings', 'anon', array['SELECT'],
  'visitors can only read listings (live ones, as the policies allow)'
);

select table_privs_are(
  'public', 'listings', 'authenticated', array['SELECT', 'DELETE'],
  'members read and delete listings as the policies allow; inserts and updates are per column'
);

select results_eq(
  $$
    select string_agg(attname::text collate "default", ', ' order by attnum)
    from pg_attribute
    where attrelid = 'public.listings'::regclass
      and attnum > 0
      and not attisdropped
      and has_column_privilege('authenticated', attrelid, attnum, 'INSERT')
    union all
    select string_agg(attname::text collate "default", ', ' order by attnum)
    from pg_attribute
    where attrelid = 'public.listings'::regclass
      and attnum > 0
      and not attisdropped
      and has_column_privilege('authenticated', attrelid, attnum, 'UPDATE')
  $$,
  array[
    'category, title, body, price, photo_path, contact_pref',
    'category, title, body, price, photo_path, contact_pref, status, reject_reason'
  ],
  'members insert only what a poster writes, and update that plus the status and reject reason'
);

select throws_ok(
  $$
    insert into public.listings (profile_id, category, title, body)
    values ('00000000-0000-4000-8930-000000000001', 'gear', '   ', 'Body')
  $$,
  '23514', null,
  'a listing needs a title'
);

select throws_ok(
  $$
    insert into public.listings (profile_id, category, title, body, price)
    values ('00000000-0000-4000-8930-000000000001', 'gear', 'Amp', 'Body', -1)
  $$,
  '23514', null,
  'a price can''t be negative'
);

select throws_ok(
  $$
    insert into public.listings (profile_id, category, title, body)
    values ('00000000-0000-4000-8930-000000000001', 'lessons', 'Lessons', 'Body')
  $$,
  '22P02', null,
  'a listing is in one of the five categories'
);

select throws_ok(
  $$
    insert into public.listings (profile_id, category, title, body, photo_path)
    values ('00000000-0000-4000-8930-000000000001', 'gear', 'Amp', 'Body',
      '00000000-0000-4000-8930-000000000002/00000000-0000-4000-8950-000000000006.jpg')
  $$,
  '23514', null,
  'a listing''s photo is in its poster''s own folder, so a listing can''t publish another member''s upload'
);

select throws_ok(
  $$
    insert into public.listings (profile_id, category, title, body, status)
    values ('00000000-0000-4000-8930-000000000001', 'gear', 'Amp', 'Body', 'live')
  $$,
  '23514', null,
  'a live listing has its approval date and its expiry'
);

-- A visitor

set local role anon;
set local request.jwt.claims to '{"role": "anon"}';

select results_eq(
  $$
    select title from public.listings
    where profile_id::text like '00000000-0000-4000-8930-%'
    order by title
  $$,
  array['T01 poster live', 'T03 other live', 'T08 lapsed live', 'T09 poster live to edit'],
  'a visitor reads only live listings, and none past its expiry'
);

select results_eq(
  $$
    select name from storage.objects
    where bucket_id = 'listing-photos' and name like '00000000-0000-4000-8930-%'
    order by name
  $$,
  array['00000000-0000-4000-8930-000000000001/00000000-0000-4000-8950-000000000001.jpg'],
  'a visitor sees only the photos of live listings'
);

select throws_ok(
  $$ insert into public.listings (category, title, body) values ('gear', 'Amp', 'Body') $$,
  '42501', null,
  'a visitor can''t submit a listing'
);

select throws_ok(
  $$ update public.listings set title = 'Changed' $$,
  '42501', null,
  'a visitor can''t change a listing'
);

select throws_ok(
  $$ delete from public.listings $$,
  '42501', null,
  'a visitor can''t delete a listing'
);

select throws_ok(
  $$
    insert into storage.objects (bucket_id, name)
    values ('listing-photos',
      '00000000-0000-4000-8930-000000000001/00000000-0000-4000-8950-000000000009.jpg')
  $$,
  '42501', null,
  'a visitor can''t upload a photo'
);

select throws_ok(
  $$ select private.has_active_membership() $$,
  '42501', null,
  'a visitor can''t call the membership check'
);

reset role;

-- Another active member (Band): reads the poster's live listings, changes none of them

set local role authenticated;
set local request.jwt.claims to
  '{"sub": "00000000-0000-4000-8930-000000000002", "role": "authenticated"}';

select results_eq(
  $$
    select title from public.listings
    where profile_id::text like '00000000-0000-4000-8930-%'
    order by title
  $$,
  array[
    'T01 poster live', 'T03 other live', 'T04 other pending', 'T05 other rejected',
    'T06 other expired', 'T07 other live past expiry', 'T08 lapsed live',
    'T09 poster live to edit', 'T10 other pending to approve', 'T11 other pending to reject'
  ],
  'a member reads live listings and all of their own, not other members'' pending ones'
);

select results_eq(
  $$
    select name from storage.objects
    where bucket_id = 'listing-photos' and name like '00000000-0000-4000-8930-%'
    order by name
  $$,
  array[
    '00000000-0000-4000-8930-000000000001/00000000-0000-4000-8950-000000000001.jpg',
    '00000000-0000-4000-8930-000000000002/00000000-0000-4000-8950-000000000004.webp',
    '00000000-0000-4000-8930-000000000002/00000000-0000-4000-8950-000000000006.jpg'
  ],
  'a member sees the photos of live listings and their own uploads, not other members'' others'
);

select is_empty(
  $$
    update public.listings set body = 'Changed'
    where id = '00000000-0000-4000-8940-000000000001'
    returning id
  $$,
  'a member can''t change another member''s listing'
);

select is_empty(
  $$ delete from public.listings where id = '00000000-0000-4000-8940-000000000001' returning id $$,
  'a member can''t delete another member''s listing'
);

select throws_ok(
  $$
    insert into storage.objects (bucket_id, name)
    values ('listing-photos',
      '00000000-0000-4000-8930-000000000001/00000000-0000-4000-8950-000000000009.jpg')
  $$,
  '42501', null,
  'a member can''t upload into another member''s folder'
);

reset role;

-- Staff who don't moderate: an editor and a membership manager read what any visitor reads

set local role authenticated;
set local request.jwt.claims to
  '{"sub": "00000000-0000-4000-8930-000000000008", "role": "authenticated"}';

select results_eq(
  $$
    select title from public.listings
    where profile_id::text like '00000000-0000-4000-8930-%'
    order by title
  $$,
  array['T01 poster live', 'T03 other live', 'T08 lapsed live', 'T09 poster live to edit'],
  'an editor reads only live listings'
);

select is_empty(
  $$
    update public.listings set status = 'rejected'
    where id = '00000000-0000-4000-8940-000000000003'
    returning id
  $$,
  'an editor can''t change a listing''s status'
);

reset role;

set local role authenticated;
set local request.jwt.claims to
  '{"sub": "00000000-0000-4000-8930-000000000009", "role": "authenticated"}';

select results_eq(
  $$
    select title from public.listings
    where profile_id::text like '00000000-0000-4000-8930-%'
    order by title
  $$,
  array['T01 poster live', 'T03 other live', 'T08 lapsed live', 'T09 poster live to edit'],
  'a membership manager reads only live listings'
);

reset role;

-- The poster, an active Individual member: submits, uploads, edits and deletes their own

set local role authenticated;
set local request.jwt.claims to
  '{"sub": "00000000-0000-4000-8930-000000000001", "role": "authenticated"}';

select results_eq(
  $$
    select title from public.listings
    where profile_id::text like '00000000-0000-4000-8930-%'
    order by title
  $$,
  array[
    'T01 poster live', 'T02 poster pending', 'T03 other live', 'T08 lapsed live',
    'T09 poster live to edit'
  ],
  'the poster reads live listings and all of their own'
);

select results_eq(
  $$
    select name from storage.objects
    where bucket_id = 'listing-photos' and name like '00000000-0000-4000-8930-%'
    order by name
  $$,
  array[
    '00000000-0000-4000-8930-000000000001/00000000-0000-4000-8950-000000000001.jpg',
    '00000000-0000-4000-8930-000000000001/00000000-0000-4000-8950-000000000002.jpg',
    '00000000-0000-4000-8930-000000000001/00000000-0000-4000-8950-000000000003.png'
  ],
  'the poster sees their own photos, a pending listing''s and an unused upload included'
);

select lives_ok(
  $$
    insert into storage.objects (bucket_id, name)
    values ('listing-photos',
      '00000000-0000-4000-8930-000000000001/00000000-0000-4000-8950-000000000005.jpg')
  $$,
  'an active member uploads a photo into their own folder'
);

select lives_ok(
  $$
    insert into public.listings (category, title, body, price, photo_path, contact_pref)
    values ('gear', 'T12 poster new', 'Harmonica set with case.', 120,
      '00000000-0000-4000-8930-000000000001/00000000-0000-4000-8950-000000000005.jpg', 'phone')
  $$,
  'an active member submits a listing with that photo'
);

select results_eq(
  $$
    select status::text, profile_id::text, approved_at is null and expires_at is null
    from public.listings
    where title = 'T12 poster new'
  $$,
  $$ values ('pending', '00000000-0000-4000-8930-000000000001', true) $$,
  'a new listing is the poster''s own and waits for a moderator'
);

select throws_ok(
  $$
    insert into public.listings (category, title, body, status)
    values ('gear', 'Amp', 'Body', 'live')
  $$,
  '42501', null,
  'a member can''t submit a listing as already live'
);

select throws_ok(
  $$
    insert into public.listings (profile_id, category, title, body)
    values ('00000000-0000-4000-8930-000000000002', 'gear', 'Amp', 'Body')
  $$,
  '42501', null,
  'a member can''t submit a listing in another member''s name'
);

select throws_ok(
  $$
    insert into public.listings (category, title, body, photo_path)
    values ('gear', 'Amp', 'Body',
      '00000000-0000-4000-8930-000000000002/00000000-0000-4000-8950-000000000006.jpg')
  $$,
  '23514', null,
  'a member can''t put another member''s upload on their listing'
);

select lives_ok(
  $$
    update public.listings set body = 'Carpool to the auditions. Two seats left.'
    where id = '00000000-0000-4000-8940-000000000009'
  $$,
  'the poster changes their own live listing'
);

select results_eq(
  $$
    select status::text, approved_at is null and expires_at is null
    from public.listings
    where id = '00000000-0000-4000-8940-000000000009'
  $$,
  $$ values ('pending', true) $$,
  'a changed listing goes back to the moderators, so the change isn''t public unreviewed'
);

select throws_ok(
  $$
    update public.listings set status = 'live'
    where id = '00000000-0000-4000-8940-000000000002'
  $$,
  '42501', null,
  'the poster can''t approve their own listing'
);

select is_empty(
  $$
    update public.listings set body = 'Changed'
    where id = '00000000-0000-4000-8940-000000000003'
    returning id
  $$,
  'the poster can''t change another member''s listing'
);

select is_empty(
  $$ delete from public.listings where id = '00000000-0000-4000-8940-000000000003' returning id $$,
  'the poster can''t delete another member''s listing'
);

select throws_ok(
  $$
    insert into storage.objects (bucket_id, name)
    values ('listing-photos',
      '00000000-0000-4000-8930-000000000002/00000000-0000-4000-8950-000000000009.jpg')
  $$,
  '42501', null,
  'the poster can''t upload into another member''s folder'
);

select throws_ok(
  $$
    insert into storage.objects (bucket_id, name)
    values ('listing-photos', '00000000-0000-4000-8930-000000000001/photo.gif')
  $$,
  '42501', null,
  'an upload is named like a listing photo: a random id and .jpg, .png or .webp'
);

set local storage.allow_delete_query = 'true';

select is_empty(
  $$
    delete from storage.objects
    where name = '00000000-0000-4000-8930-000000000001/00000000-0000-4000-8950-000000000001.jpg'
    returning name
  $$,
  'the poster can''t remove a photo a listing still shows'
);

select results_eq(
  $$
    delete from storage.objects
    where name = '00000000-0000-4000-8930-000000000001/00000000-0000-4000-8950-000000000003.png'
    returning name
  $$,
  array['00000000-0000-4000-8930-000000000001/00000000-0000-4000-8950-000000000003.png'],
  'the poster removes an upload no listing shows'
);

select results_eq(
  $$ delete from public.listings where id = '00000000-0000-4000-8940-000000000002' returning title $$,
  array['T02 poster pending'],
  'the poster deletes their own listing'
);

select results_eq(
  $$
    delete from storage.objects
    where name = '00000000-0000-4000-8930-000000000001/00000000-0000-4000-8950-000000000002.jpg'
    returning name
  $$,
  array['00000000-0000-4000-8930-000000000001/00000000-0000-4000-8950-000000000002.jpg'],
  'then the deleted listing''s photo can be removed'
);

reset role;

-- Members without an active membership can't submit, upload or change listings

set local role authenticated;
set local request.jwt.claims to
  '{"sub": "00000000-0000-4000-8930-000000000003", "role": "authenticated"}';

select throws_ok(
  $$ insert into public.listings (category, title, body) values ('gear', 'Amp', 'Body') $$,
  '42501', null,
  'a member whose membership ended yesterday can''t submit a listing'
);

select throws_ok(
  $$
    insert into storage.objects (bucket_id, name)
    values ('listing-photos',
      '00000000-0000-4000-8930-000000000003/00000000-0000-4000-8950-000000000009.jpg')
  $$,
  '42501', null,
  'a member whose membership ended can''t upload a photo'
);

select is_empty(
  $$
    update public.listings set body = 'Changed'
    where id = '00000000-0000-4000-8940-000000000008'
    returning id
  $$,
  'a member whose membership ended can''t change their listing'
);

select results_eq(
  $$ delete from public.listings where id = '00000000-0000-4000-8940-000000000008' returning title $$,
  array['T08 lapsed live'],
  'a member whose membership ended can still delete their listing'
);

reset role;

set local role authenticated;
set local request.jwt.claims to
  '{"sub": "00000000-0000-4000-8930-000000000004", "role": "authenticated"}';

select throws_ok(
  $$ insert into public.listings (category, title, body) values ('gear', 'Amp', 'Body') $$,
  '42501', null,
  'posting ends at expires_at: a membership ending this instant can''t submit a listing'
);

reset role;

set local role authenticated;
set local request.jwt.claims to
  '{"sub": "00000000-0000-4000-8930-000000000005", "role": "authenticated"}';

select throws_ok(
  $$ insert into public.listings (category, title, body) values ('gear', 'Amp', 'Body') $$,
  '42501', null,
  'someone who signed up but never paid can''t submit a listing'
);

reset role;

-- A moderator (no membership needed: the role is enough)

set local role authenticated;
set local request.jwt.claims to
  '{"sub": "00000000-0000-4000-8930-000000000006", "role": "authenticated"}';

select results_eq(
  $$
    select title from public.listings
    where profile_id::text like '00000000-0000-4000-8930-%'
    order by title
  $$,
  array[
    'T01 poster live', 'T03 other live', 'T04 other pending', 'T05 other rejected',
    'T06 other expired', 'T07 other live past expiry', 'T09 poster live to edit',
    'T10 other pending to approve', 'T11 other pending to reject', 'T12 poster new'
  ],
  'a moderator reads every listing'
);

select results_eq(
  $$
    select name from storage.objects
    where bucket_id = 'listing-photos' and name like '00000000-0000-4000-8930-%'
    order by name
  $$,
  array[
    '00000000-0000-4000-8930-000000000001/00000000-0000-4000-8950-000000000001.jpg',
    '00000000-0000-4000-8930-000000000001/00000000-0000-4000-8950-000000000005.jpg',
    '00000000-0000-4000-8930-000000000002/00000000-0000-4000-8950-000000000004.webp'
  ],
  'a moderator sees every listing''s photo, but not uploads no listing shows'
);

select lives_ok(
  $$
    update public.listings set status = 'live'
    where id = '00000000-0000-4000-8940-000000000010'
  $$,
  'a moderator approves a listing'
);

select results_eq(
  $$
    select
      status::text,
      approved_at = now(),
      expires_at = now() + interval '60 days',
      reject_reason is null
    from public.listings
    where id = '00000000-0000-4000-8940-000000000010'
  $$,
  $$ values ('live', true, true, true) $$,
  'approving a listing starts its 60 days'
);

select lives_ok(
  $$
    update public.listings set status = 'rejected', reject_reason = 'Please add the price.'
    where id = '00000000-0000-4000-8940-000000000011'
  $$,
  'a moderator rejects a listing with a reason'
);

select results_eq(
  $$
    select status::text, reject_reason
    from public.listings
    where id = '00000000-0000-4000-8940-000000000011'
  $$,
  $$ values ('rejected', 'Please add the price.') $$,
  'the rejected listing keeps the reason for the poster'
);

select throws_ok(
  $$
    update public.listings set title = 'Edited by the moderator'
    where id = '00000000-0000-4000-8940-000000000003'
  $$,
  '42501', null,
  'a moderator can''t change what a poster wrote'
);

select throws_ok(
  $$
    update public.listings set expires_at = now() + interval '1 year'
    where id = '00000000-0000-4000-8940-000000000003'
  $$,
  '42501', null,
  'a moderator can''t set a listing''s expiry: approving sets it'
);

select is_empty(
  $$ delete from public.listings where id = '00000000-0000-4000-8940-000000000003' returning id $$,
  'a moderator can''t delete a member''s listing'
);

reset role;

-- After the moderator's decisions: the approved listing is public at once, the rejected one isn't

set local role anon;
set local request.jwt.claims to '{"role": "anon"}';

select results_eq(
  $$
    select title from public.listings
    where profile_id::text like '00000000-0000-4000-8930-%'
    order by title
  $$,
  array['T01 poster live', 'T03 other live', 'T10 other pending to approve'],
  'a visitor now reads the approved listing, not the rejected one or the one changed since approval'
);

reset role;

-- An administrator moderates too

set local role authenticated;
set local request.jwt.claims to
  '{"sub": "00000000-0000-4000-8930-000000000007", "role": "authenticated"}';

select is(
  (
    select count(*)::int from public.listings
    where profile_id::text like '00000000-0000-4000-8930-%'
  ),
  10,
  'an administrator reads every listing'
);

select lives_ok(
  $$
    update public.listings set status = 'rejected', reject_reason = 'Sold out, says the poster.'
    where id = '00000000-0000-4000-8940-000000000003'
  $$,
  'an administrator takes a live listing down'
);

select is(
  (select status::text from public.listings where id = '00000000-0000-4000-8940-000000000003'),
  'rejected',
  'the listing taken down is rejected'
);

reset role;

-- Server code with the service role: the scheduled job marks listings expired

set local role service_role;
set local request.jwt.claims to '{"role": "service_role"}';

select lives_ok(
  $$
    update public.listings set status = 'expired'
    where id = '00000000-0000-4000-8940-000000000001'
  $$,
  'the service role changes a listing''s status (the scheduled expiry job)'
);

select is(
  (select status::text from public.listings where id = '00000000-0000-4000-8940-000000000001'),
  'expired',
  'the listing is expired'
);

reset role;

select * from finish();
rollback;
