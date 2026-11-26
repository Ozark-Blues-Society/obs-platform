-- M-2: member profiles and staff roles (docs/spec/architecture.md, "People and money").
--
-- No households: the board created no family memberships (docs/spec/board-decisions.md §2).
--
-- Who can do what:
--   - A member reads their own profile and changes only their name and phone. Level, status,
--     expires_at and the other membership columns are written by server code with the service
--     role (Stripe webhook, scheduled jobs, importer), never by the member. Column privileges
--     enforce this, so it holds whatever the policies say.
--   - Administrators and membership managers read every profile. Moderators and editors read only
--     their own, like any member.
--   - A member reads their own roles, and administrators read everyone's. Nobody grants or revokes
--     roles through the Data API yet (backlog A-2).
--   - Visitors (anon) can't read either table.
--
-- The role check lives in the private schema, which the Data API doesn't expose (api.schemas in
-- supabase/config.jsonc). It is SECURITY DEFINER so a policy can read user_roles without running
-- into user_roles' own policies. In public it would be callable at /rest/v1/rpc and skip row
-- level security. The trigger functions live there too.

create type public.membership_level as enum ('individual', 'band', 'business', 'sponsor');
create type public.membership_status as enum ('active', 'expiring', 'lapsed');
create type public.app_role as enum ('admin', 'membership_manager', 'moderator', 'editor');

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  first_name text check (char_length(first_name) <= 100),
  last_name text check (char_length(last_name) <= 100),
  email text not null,
  phone text check (char_length(phone) <= 40),
  level public.membership_level,
  status public.membership_status,
  expires_at timestamptz,
  auto_renew boolean not null default false,
  stripe_customer_id text unique,
  joined_at timestamptz,
  notes text
);

comment on table public.profiles is
  'One row per member, created when they sign up. Members read their own row and change only '
  'first_name, last_name and phone.';
comment on column public.profiles.email is
  'Copied from auth.users and kept in step with it. Members change it through Supabase Auth.';
comment on column public.profiles.level is
  'Membership level (board-decisions §1). Null until the first payment.';
comment on column public.profiles.status is
  'Null until the first payment. Kept up to date by server code (Stripe webhook, scheduled jobs).';
comment on column public.profiles.expires_at is
  'When the membership ends. Members-only access ends then: there is no grace period '
  '(board-decisions §4).';
comment on column public.profiles.joined_at is
  'When the membership started. Members renew on its anniversary (board-decisions §3).';
comment on column public.profiles.notes is
  'Staff notes. Members can read their own profile, notes included.';

create table public.user_roles (
  profile_id uuid not null references public.profiles (id) on delete cascade,
  role public.app_role not null,
  primary key (profile_id, role)
);

comment on table public.user_roles is
  'Staff roles. A member reads their own roles; administrators read everyone''s.';

alter table public.profiles enable row level security;
alter table public.user_roles enable row level security;

-- Supabase's default privileges give anon and authenticated every privilege on new tables in
-- public, leaving row level security to pick the rows. Start from nothing and grant only what the
-- policies below use. A table-level UPDATE grant would cover every column, so members get
-- UPDATE on their editable columns only.
revoke all on table public.profiles, public.user_roles from anon, authenticated;
grant select on table public.profiles, public.user_roles to authenticated;
grant update (first_name, last_name, phone) on table public.profiles to authenticated;

create schema private;
comment on schema private is
  'Functions for policies and triggers. The Data API does not expose this schema.';

-- Policies run as the member, so they need to reach the role check.
grant usage on schema private to authenticated;

-- Whether the signed-in member has a role. The parameter has its own name because, in an SQL
-- function, a column called role would take precedence over a parameter called role.
create function private.has_role(requested_role public.app_role)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.user_roles
    where user_roles.profile_id = (select auth.uid())
      and user_roles.role = requested_role
  );
$$;

-- New functions are executable by everyone unless revoked.
revoke all on function private.has_role(public.app_role) from public;
grant execute on function private.has_role(public.app_role) to authenticated;

-- (select ...) around auth.uid() and the role checks lets Postgres evaluate them once per query
-- instead of once per row.
create policy "Read own profile; admins and membership managers read all"
  on public.profiles
  for select
  to authenticated
  using (
    id = (select auth.uid())
    or (select private.has_role('admin'))
    or (select private.has_role('membership_manager'))
  );

create policy "Update own profile"
  on public.profiles
  for update
  to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

create policy "Read own roles; admins read all"
  on public.user_roles
  for select
  to authenticated
  using (profile_id = (select auth.uid()) or (select private.has_role('admin')));

-- A profile for every new user. Supabase Auth inserts the user; the names come from the sign-up's
-- user metadata (options.data), which the person filling in the form controls, so nothing else
-- is read from it.
create function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email, first_name, last_name)
  values (
    new.id,
    new.email,
    left(new.raw_user_meta_data ->> 'first_name', 100),
    left(new.raw_user_meta_data ->> 'last_name', 100)
  );
  return new;
end;
$$;

revoke all on function private.handle_new_user() from public;

create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function private.handle_new_user();

-- When a member changes their address through Supabase Auth, the profile follows.
create function private.sync_profile_email()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.profiles set email = new.email where id = new.id;
  return new;
end;
$$;

revoke all on function private.sync_profile_email() from public;

create trigger on_auth_user_email_changed
  after update of email on auth.users
  for each row
  when (old.email is distinct from new.email)
  execute function private.sync_profile_email();
