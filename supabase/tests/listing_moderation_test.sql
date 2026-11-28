-- Moderating classifieds listings (backlog K-2, A-3): the revision a moderator's decision applies
-- to, and the reason a rejection needs (supabase/migrations/20261126225448_listing_moderation.sql).
-- Who may change a listing's status at all (moderators and administrators only) is tested in
-- listings_test.sql.
--
-- The test users are created here, inside the transaction. Their ids start
-- 00000000-0000-4000-8960- and the listings' 00000000-0000-4000-8970-. The sections change the
-- data as they go, so each section's expected results follow from the ones before it.
begin;
select plan(21);

insert into auth.users (id, email)
values
  ('00000000-0000-4000-8960-000000000001', 'test.moderation-poster@example.com'),
  ('00000000-0000-4000-8960-000000000002', 'test.moderation-moderator@example.com'),
  ('00000000-0000-4000-8960-000000000003', 'test.moderation-admin@example.com');

update public.profiles
set level = 'individual', expires_at = now() + interval '30 days'
where id = '00000000-0000-4000-8960-000000000001';

insert into public.user_roles (profile_id, role)
values
  ('00000000-0000-4000-8960-000000000002', 'moderator'),
  ('00000000-0000-4000-8960-000000000003', 'admin');

insert into public.listings (
  id, profile_id, category, title, body, status, approved_at, expires_at
)
values
  ('00000000-0000-4000-8970-000000000001', '00000000-0000-4000-8960-000000000001', 'gear',
    'M01 amp', 'Tweed-style amp.', 'pending', null, null),
  ('00000000-0000-4000-8970-000000000002', '00000000-0000-4000-8960-000000000001', 'merch',
    'M02 live', 'Band T-shirts.', 'live', now() - interval '1 day', now() + interval '59 days'),
  ('00000000-0000-4000-8970-000000000003', '00000000-0000-4000-8960-000000000001', 'gear',
    'M03 pending to reject', 'Sunglasses.', 'pending', null, null);

-- The poster: a new listing is revision 1, and each change to it is a new revision

set local role authenticated;
set local request.jwt.claims to
  '{"sub": "00000000-0000-4000-8960-000000000001", "role": "authenticated"}';

select results_eq(
  $$
    insert into public.listings (category, title, body)
    values ('gear', 'M04 new amp', 'Tweed-style amp.')
    returning revision
  $$,
  $$ values (1) $$,
  'a new listing is revision 1'
);

select throws_ok(
  $$
    insert into public.listings (category, title, body, revision)
    values ('gear', 'M05 amp', 'Tweed-style amp.', 5)
  $$,
  '42501', null,
  'a member can''t choose a new listing''s revision'
);

select throws_ok(
  $$
    update public.listings set revision = 7
    where id = '00000000-0000-4000-8970-000000000001'
  $$,
  '42501', null,
  'a member can''t set a listing''s revision'
);

select results_eq(
  $$
    update public.listings set title = 'M01 amp, 15 W'
    where id = '00000000-0000-4000-8970-000000000001'
    returning revision, status::text
  $$,
  $$ values (2, 'pending') $$,
  'the poster''s change is a new revision, still waiting for a moderator'
);

select results_eq(
  $$
    update public.listings set title = 'M01 amp, 15 W', body = 'Tweed-style amp.'
    where id = '00000000-0000-4000-8970-000000000001'
    returning revision
  $$,
  $$ values (2) $$,
  'saving the listing unchanged isn''t a new revision'
);

-- Every part of what the poster wrote counts, not only the words: a moderator must see the new
-- price, contact preference or photo before approving it.

select results_eq(
  $$
    update public.listings set price = 640
    where title = 'M04 new amp'
    returning revision
  $$,
  $$ values (2) $$,
  'a new price is a new revision'
);

select results_eq(
  $$
    update public.listings set contact_pref = 'phone'
    where title = 'M04 new amp'
    returning revision
  $$,
  $$ values (3) $$,
  'a new contact preference is a new revision'
);

insert into storage.objects (bucket_id, name, version)
values (
  'listing-photos',
  '00000000-0000-4000-8960-000000000001/00000000-0000-4000-8980-000000000001.jpg',
  'v1'
);

select results_eq(
  $$
    update public.listings
    set photo_path = '00000000-0000-4000-8960-000000000001/00000000-0000-4000-8980-000000000001.jpg'
    where title = 'M04 new amp'
    returning revision, photo_version
  $$,
  $$ values (4, 'v1') $$,
  'a new photo is a new revision'
);

reset role;

-- A moderator decides on the revision they saw

set local role authenticated;
set local request.jwt.claims to
  '{"sub": "00000000-0000-4000-8960-000000000002", "role": "authenticated"}';

select is_empty(
  $$
    update public.listings set status = 'live'
    where id = '00000000-0000-4000-8970-000000000001' and status = 'pending' and revision = 1
    returning id
  $$,
  'approving the revision the moderator saw changes nothing once the poster has changed it'
);

select is(
  (select status::text from public.listings where id = '00000000-0000-4000-8970-000000000001'),
  'pending',
  'so the changed listing still waits for a moderator'
);

select results_eq(
  $$
    update public.listings set status = 'live'
    where id = '00000000-0000-4000-8970-000000000001' and status = 'pending' and revision = 2
    returning status::text, revision
  $$,
  $$ values ('live', 2) $$,
  'the moderator approves the current revision; a decision isn''t a new revision'
);

select throws_ok(
  $$
    update public.listings set status = 'rejected'
    where id = '00000000-0000-4000-8970-000000000003'
  $$,
  '23514', null,
  'a moderator can''t reject a listing without a reason'
);

select throws_ok(
  $$
    update public.listings set status = 'rejected', reject_reason = E'  \n\t '
    where id = '00000000-0000-4000-8970-000000000003'
  $$,
  '23514', null,
  'nor with a reason that''s only spaces and line breaks'
);

select results_eq(
  $$
    update public.listings
    set status = 'rejected', reject_reason = 'Sunglasses aren''t music gear. Please post elsewhere.'
    where id = '00000000-0000-4000-8970-000000000003'
    returning status::text, revision
  $$,
  $$ values ('rejected', 1) $$,
  'a moderator rejects a listing with a reason'
);

select throws_ok(
  $$
    update public.listings set reject_reason = ''
    where id = '00000000-0000-4000-8970-000000000003'
  $$,
  '23514', null,
  'a rejected listing keeps a reason'
);

reset role;

-- An administrator taking a live listing down gives a reason too

set local role authenticated;
set local request.jwt.claims to
  '{"sub": "00000000-0000-4000-8960-000000000003", "role": "authenticated"}';

select throws_ok(
  $$
    update public.listings set status = 'rejected'
    where id = '00000000-0000-4000-8970-000000000002'
  $$,
  '23514', null,
  'an administrator can''t take a live listing down without a reason'
);

select lives_ok(
  $$
    update public.listings set status = 'rejected', reject_reason = 'Sold, says the poster.'
    where id = '00000000-0000-4000-8970-000000000002'
  $$,
  'an administrator takes a live listing down with a reason'
);

reset role;

-- The poster changes the rejected listing: a new revision, back to the moderators, reason cleared

set local role authenticated;
set local request.jwt.claims to
  '{"sub": "00000000-0000-4000-8960-000000000001", "role": "authenticated"}';

select results_eq(
  $$
    update public.listings set category = 'merch', body = 'Society sunglasses.'
    where id = '00000000-0000-4000-8970-000000000003'
    returning status::text, reject_reason, revision
  $$,
  $$ values ('pending', null::text, 2) $$,
  'a changed rejected listing is a new revision, waiting for a moderator without the old reason'
);

reset role;

-- Server code with the service role: the revision follows what the poster wrote, even for it

set local role service_role;
set local request.jwt.claims to '{"role": "service_role"}';

select results_eq(
  $$
    update public.listings set revision = 99
    where id = '00000000-0000-4000-8970-000000000001'
    returning revision
  $$,
  $$ values (2) $$,
  'the service role can''t set a revision either: it stays what the trigger counted'
);

select results_eq(
  $$
    update public.listings set status = 'expired'
    where id = '00000000-0000-4000-8970-000000000001'
    returning revision
  $$,
  $$ values (2) $$,
  'expiring a listing (the scheduled job) isn''t a new revision'
);

select results_eq(
  $$
    update public.listings set body = 'Tweed-style amp, hand-wired.'
    where id = '00000000-0000-4000-8970-000000000001'
    returning revision
  $$,
  $$ values (3) $$,
  'a change the service role makes to what the listing says is a new revision'
);

select * from finish();
rollback;
