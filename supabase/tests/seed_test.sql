-- The seed (supabase/seed.sql, generated from scripts/fixtures/) loads the fixture members as
-- working sign-ins. `supabase db reset` applies the seed. Fixture ids start 00000000-0000-4000-8100-.
begin;
select plan(4);

select is(
  (select count(*)::int from auth.users where id::text like '00000000-0000-4000-8100-%'),
  40,
  'the seed creates the 40 fixture members'
);

select is(
  (
    select count(*)::int
    from auth.identities
    where provider = 'email' and user_id::text like '00000000-0000-4000-8100-%'
  ),
  40,
  'every fixture member has an email identity'
);

select ok(
  (
    select bool_and(email_confirmed_at is not null and email like '%@example.com')
    from auth.users
    where id::text like '00000000-0000-4000-8100-%'
  ),
  'every fixture member has a confirmed @example.com address'
);

select ok(
  (
    select bool_and(encrypted_password = extensions.crypt('obs-local-dev', encrypted_password))
    from auth.users
    where id::text like '00000000-0000-4000-8100-%'
  ),
  'every fixture member signs in with the documented local password'
);

select * from finish();
rollback;
