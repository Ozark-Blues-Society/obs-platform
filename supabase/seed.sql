-- Generated from scripts/fixtures/ by `pnpm fixtures:generate`. Don't edit it by hand.
--
-- LOCAL DEVELOPMENT ONLY. Synthetic people with @example.com addresses, all sharing a password
-- that is published in the README. Never load this into a hosted project.

-- Fixture members as confirmed email + password sign-ins.
with fixture (id, email, first_name, last_name) as (
  values
    ('00000000-0000-4000-8100-000000000001'::uuid, 'avery.collins@example.com', 'Avery', 'Collins'),
    ('00000000-0000-4000-8100-000000000002'::uuid, 'jordan.ellis@example.com', 'Jordan', 'Ellis'),
    ('00000000-0000-4000-8100-000000000003'::uuid, 'morgan.hale@example.com', 'Morgan', 'Hale'),
    ('00000000-0000-4000-8100-000000000004'::uuid, 'casey.brooks@example.com', 'Casey', 'Brooks'),
    ('00000000-0000-4000-8100-000000000005'::uuid, 'robin.fields@example.com', 'Robin', 'Fields'),
    ('00000000-0000-4000-8100-000000000006'::uuid, 'jesse.carter@example.com', 'Jesse', 'Carter'),
    ('00000000-0000-4000-8100-000000000007'::uuid, 'terry.mills@example.com', 'Terry', 'Mills'),
    ('00000000-0000-4000-8100-000000000008'::uuid, 'glen.pruitt@example.com', 'Glen', 'Pruitt'),
    ('00000000-0000-4000-8100-000000000009'::uuid, 'june.little@example.com', 'June', 'Little'),
    ('00000000-0000-4000-8100-000000000010'::uuid, 'shannon.oneal@example.com', 'Shannon', 'O''Neal'),
    ('00000000-0000-4000-8100-000000000011'::uuid, 'bev.grant@example.com', 'Bev', 'Grant'),
    ('00000000-0000-4000-8100-000000000012'::uuid, 'otis.ivy@example.com', 'Otis', 'Ivy'),
    ('00000000-0000-4000-8100-000000000013'::uuid, 'rosa.delgado@example.com', 'Rosa', 'Delgado'),
    ('00000000-0000-4000-8100-000000000014'::uuid, 'lena.park@example.com', 'Lena', 'Park'),
    ('00000000-0000-4000-8100-000000000015'::uuid, 'wes.turner@example.com', 'Wes', 'Turner'),
    ('00000000-0000-4000-8100-000000000016'::uuid, 'nora.quinn@example.com', 'Nora', 'Quinn'),
    ('00000000-0000-4000-8100-000000000017'::uuid, 'dale.ramsey@example.com', 'Dale', 'Ramsey'),
    ('00000000-0000-4000-8100-000000000018'::uuid, 'tasha.moore@example.com', 'Tasha', 'Moore'),
    ('00000000-0000-4000-8100-000000000019'::uuid, 'marcus.lane@example.com', 'Marcus', 'Lane'),
    ('00000000-0000-4000-8100-000000000020'::uuid, 'ruth.abbott@example.com', 'Ruth', 'Abbott'),
    ('00000000-0000-4000-8100-000000000021'::uuid, 'chris.price@example.com', 'Chris', 'Price'),
    ('00000000-0000-4000-8100-000000000022'::uuid, 'pat.walsh@example.com', 'Pat', 'Walsh'),
    ('00000000-0000-4000-8100-000000000023'::uuid, 'ray.booker@example.com', 'Ray', 'Booker'),
    ('00000000-0000-4000-8100-000000000024'::uuid, 'eddie.vance@example.com', 'Eddie', 'Vance'),
    ('00000000-0000-4000-8100-000000000025'::uuid, 'mae.whitfield@example.com', 'Mae', 'Whitfield'),
    ('00000000-0000-4000-8100-000000000026'::uuid, 'cole.barrett@example.com', 'Cole', 'Barrett'),
    ('00000000-0000-4000-8100-000000000027'::uuid, 'grace.holloway@example.com', 'Grace', 'Holloway'),
    ('00000000-0000-4000-8100-000000000028'::uuid, 'victor.nash@example.com', 'Victor', 'Nash'),
    ('00000000-0000-4000-8100-000000000029'::uuid, 'irene.coleman@example.com', 'Irene', 'Coleman'),
    ('00000000-0000-4000-8100-000000000030'::uuid, 'frank.delaney@example.com', 'Frank', 'Delaney'),
    ('00000000-0000-4000-8100-000000000031'::uuid, 'hazel.monroe@example.com', 'Hazel', 'Monroe'),
    ('00000000-0000-4000-8100-000000000032'::uuid, 'leon.pierce@example.com', 'Leon', 'Pierce'),
    ('00000000-0000-4000-8100-000000000033'::uuid, 'doris.kemp@example.com', 'Doris', 'Kemp'),
    ('00000000-0000-4000-8100-000000000034'::uuid, 'walt.ferris@example.com', 'Walt', 'Ferris'),
    ('00000000-0000-4000-8100-000000000035'::uuid, 'margaret.sloan@example.com', 'Margaret', 'Sloan'),
    ('00000000-0000-4000-8100-000000000036'::uuid, 'curtis.bell@example.com', 'Curtis', 'Bell'),
    ('00000000-0000-4000-8100-000000000037'::uuid, 'elaine.foster@example.com', 'Elaine', 'Foster'),
    ('00000000-0000-4000-8100-000000000038'::uuid, 'russell.boyd@example.com', 'Russell', 'Boyd'),
    ('00000000-0000-4000-8100-000000000039'::uuid, 'vera.lindqvist@example.com', 'Vera', 'Lindqvist'),
    ('00000000-0000-4000-8100-000000000040'::uuid, 'howard.keene@example.com', 'Howard', 'Keene')
),
fixture_password as materialized (
  select extensions.crypt('obs-local-dev', extensions.gen_salt('bf')) as hash
),
new_user as (
  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, recovery_token, email_change_token_new, email_change
  )
  select
    '00000000-0000-0000-0000-000000000000'::uuid, f.id, 'authenticated', 'authenticated',
    f.email, p.hash, now(),
    '{"provider": "email", "providers": ["email"]}'::jsonb,
    jsonb_build_object('first_name', f.first_name, 'last_name', f.last_name),
    now(), now(),
    -- Supabase Auth reads these token columns as strings and fails on NULL.
    '', '', '', ''
  from fixture f cross join fixture_password p
  returning id, email
)
insert into auth.identities (provider_id, user_id, identity_data, provider, created_at, updated_at)
select
  u.id::text, u.id,
  jsonb_build_object('sub', u.id::text, 'email', u.email, 'email_verified', true),
  'email', now(), now()
from new_user u;

-- Membership details. The sign-up trigger (supabase/migrations/) created each member's profile
-- above, with their address and names; joined_at is the given number of years before expires_at.
update public.profiles p
set
  phone = f.phone,
  level = f.level::public.membership_level,
  status = f.status::public.membership_status,
  expires_at = now() + make_interval(days => f.expires_in_days),
  joined_at = now() + make_interval(days => f.expires_in_days) - make_interval(years => f.years),
  auto_renew = f.auto_renew,
  notes = f.notes
from (
  values
    ('00000000-0000-4000-8100-000000000001'::uuid, '(479) 555-0101', 'individual', 'active', 280, 6, true, null),
    ('00000000-0000-4000-8100-000000000002'::uuid, '(479) 555-0102', 'individual', 'active', 145, 4, false, null),
    ('00000000-0000-4000-8100-000000000003'::uuid, '(479) 555-0103', 'individual', 'active', 200, 3, false, null),
    ('00000000-0000-4000-8100-000000000004'::uuid, '(479) 555-0104', 'individual', 'active', 364, 1, false, null),
    ('00000000-0000-4000-8100-000000000005'::uuid, null, 'individual', 'active', 31, 2, false, null),
    ('00000000-0000-4000-8100-000000000006'::uuid, '(479) 555-0106', 'individual', 'active', 90, 5, true, null),
    ('00000000-0000-4000-8100-000000000007'::uuid, '(479) 555-0107', 'individual', 'active', 120, 2, false, null),
    ('00000000-0000-4000-8100-000000000008'::uuid, '(479) 555-0108', 'individual', 'active', 240, 8, false, 'Paid by check at the door.'),
    ('00000000-0000-4000-8100-000000000009'::uuid, '(479) 555-0109', 'individual', 'active', 60, 1, false, null),
    ('00000000-0000-4000-8100-000000000010'::uuid, null, 'individual', 'active', 175, 3, false, null),
    ('00000000-0000-4000-8100-000000000011'::uuid, '(479) 555-0111', 'individual', 'expiring', 30, 4, false, null),
    ('00000000-0000-4000-8100-000000000012'::uuid, '(479) 555-0112', 'individual', 'expiring', 7, 2, false, null),
    ('00000000-0000-4000-8100-000000000013'::uuid, '(479) 555-0113', 'individual', 'expiring', 14, 9, true, null),
    ('00000000-0000-4000-8100-000000000014'::uuid, '(479) 555-0114', 'individual', 'lapsed', -14, 1, false, null),
    ('00000000-0000-4000-8100-000000000015'::uuid, null, 'individual', 'lapsed', -45, 3, false, null),
    ('00000000-0000-4000-8100-000000000016'::uuid, '(479) 555-0116', 'individual', 'lapsed', -400, 2, false, null),
    ('00000000-0000-4000-8100-000000000017'::uuid, '(479) 555-0117', 'band', 'active', 150, 4, false, null),
    ('00000000-0000-4000-8100-000000000018'::uuid, '(479) 555-0118', 'band', 'active', 220, 7, true, 'Books "Night Owls", a trio.'),
    ('00000000-0000-4000-8100-000000000019'::uuid, '(479) 555-0119', 'band', 'active', 75, 2, false, null),
    ('00000000-0000-4000-8100-000000000020'::uuid, null, 'band', 'active', 310, 5, false, null),
    ('00000000-0000-4000-8100-000000000021'::uuid, '(479) 555-0121', 'band', 'active', 45, 3, false, null),
    ('00000000-0000-4000-8100-000000000022'::uuid, '(479) 555-0122', 'band', 'active', 330, 1, false, null),
    ('00000000-0000-4000-8100-000000000023'::uuid, '(479) 555-0123', 'band', 'expiring', 21, 6, false, null),
    ('00000000-0000-4000-8100-000000000024'::uuid, '(479) 555-0124', 'band', 'expiring', 3, 2, false, null),
    ('00000000-0000-4000-8100-000000000025'::uuid, null, 'band', 'lapsed', -1, 4, false, null),
    ('00000000-0000-4000-8100-000000000026'::uuid, '(479) 555-0126', 'band', 'lapsed', -120, 2, false, null),
    ('00000000-0000-4000-8100-000000000027'::uuid, '(479) 555-0127', 'business', 'active', 190, 5, true, null),
    ('00000000-0000-4000-8100-000000000028'::uuid, '(479) 555-0128', 'business', 'active', 100, 3, false, null),
    ('00000000-0000-4000-8100-000000000029'::uuid, '(479) 555-0129', 'business', 'active', 255, 2, false, null),
    ('00000000-0000-4000-8100-000000000030'::uuid, null, 'business', 'active', 40, 6, false, null),
    ('00000000-0000-4000-8100-000000000031'::uuid, '(479) 555-0131', 'business', 'active', 350, 1, false, null),
    ('00000000-0000-4000-8100-000000000032'::uuid, '(479) 555-0132', 'business', 'expiring', 29, 4, false, null),
    ('00000000-0000-4000-8100-000000000033'::uuid, '(479) 555-0133', 'business', 'expiring', 7, 3, true, null),
    ('00000000-0000-4000-8100-000000000034'::uuid, '(479) 555-0134', 'business', 'lapsed', -15, 5, false, null),
    ('00000000-0000-4000-8100-000000000035'::uuid, null, 'sponsor', 'active', 270, 8, true, null),
    ('00000000-0000-4000-8100-000000000036'::uuid, '(479) 555-0136', 'sponsor', 'active', 160, 3, false, null),
    ('00000000-0000-4000-8100-000000000037'::uuid, '(479) 555-0137', 'sponsor', 'active', 85, 2, true, null),
    ('00000000-0000-4000-8100-000000000038'::uuid, '(479) 555-0138', 'sponsor', 'active', 300, 4, false, null),
    ('00000000-0000-4000-8100-000000000039'::uuid, '(479) 555-0139', 'sponsor', 'expiring', 1, 5, false, null),
    ('00000000-0000-4000-8100-000000000040'::uuid, null, 'sponsor', 'lapsed', -200, 3, false, null)
) as f (id, phone, level, status, expires_in_days, years, auto_renew, notes)
where p.id = f.id;

-- Staff roles.
insert into public.user_roles (profile_id, role)
values
  ('00000000-0000-4000-8100-000000000001'::uuid, 'admin'),
  ('00000000-0000-4000-8100-000000000002'::uuid, 'membership_manager'),
  ('00000000-0000-4000-8100-000000000003'::uuid, 'editor'),
  ('00000000-0000-4000-8100-000000000017'::uuid, 'moderator');
