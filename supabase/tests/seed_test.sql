-- The seed (supabase/seed.sql, generated from scripts/fixtures/) loads the fixture members as
-- working sign-ins, with their profiles and staff roles, and their classifieds listings.
-- `supabase db reset` applies the seed. Fixture member ids start 00000000-0000-4000-8100-, listing
-- ids 00000000-0000-4000-8200-.
begin;
select plan(10);

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

select is(
  (select count(*)::int from public.profiles where id::text like '00000000-0000-4000-8100-%'),
  40,
  'every fixture member has a profile'
);

select ok(
  (
    select bool_and(
      p.email = u.email
      and p.first_name is not null
      and p.level is not null
      and p.status is not null
      and p.joined_at < p.expires_at
    )
    from public.profiles p
    join auth.users u on u.id = p.id
    where p.id::text like '00000000-0000-4000-8100-%'
  ),
  'every fixture profile has the member''s address, name and membership dates'
);

select is(
  (
    select count(distinct (level, status))::int
    from public.profiles
    where id::text like '00000000-0000-4000-8100-%'
  ),
  12,
  'the fixture profiles cover every level and status'
);

select results_eq(
  $$
    select p.email, r.role::text
    from public.user_roles r
    join public.profiles p on p.id = r.profile_id
    where p.id::text like '00000000-0000-4000-8100-%'
    order by r.role
  $$,
  $$
    values
      ('avery.collins@example.com', 'admin'),
      ('jordan.ellis@example.com', 'membership_manager'),
      ('dale.ramsey@example.com', 'moderator'),
      ('morgan.hale@example.com', 'editor')
  $$,
  'each staff role belongs to the fixture member the README names'
);

select results_eq(
  $$
    select count(*)::int, count(distinct category)::int, count(distinct status)::int
    from public.listings
    where id::text like '00000000-0000-4000-8200-%'
  $$,
  $$ values (13, 5, 4) $$,
  'the seed adds the 13 fixture listings, covering every category and status'
);

select ok(
  (
    select bool_and(
      case
        when status in ('live', 'expired') then
          expires_at = approved_at + interval '60 days' and (status = 'live') = (expires_at > now())
        else approved_at is null and expires_at is null
      end
    )
    from public.listings
    where id::text like '00000000-0000-4000-8200-%'
  ),
  'approved fixture listings run 60 days from approval, and only the live ones are still running'
);

select * from finish();
rollback;
