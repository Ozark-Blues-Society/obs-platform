-- A-2: administrators grant and revoke staff roles (docs/backlog.md). Builds on M-2's
-- 20261126050904_profiles_and_roles.sql.
--
-- Who can do what:
--   - Administrators grant roles (insert into user_roles) and revoke them (delete). Nobody else can
--     through the Data API: not members, membership managers, moderators or editors.
--   - Nobody changes a role in place. There is no UPDATE privilege: revoke one role, grant another.
--   - There is always at least one administrator. A trigger refuses to remove the last one, whoever
--     tries: an administrator through the Data API, server code with the service role, or deleting
--     the last administrator's account (the delete cascades from auth.users to user_roles).

grant insert, delete on table public.user_roles to authenticated;

comment on table public.user_roles is
  'Staff roles. A member reads their own roles; administrators read, grant and revoke everyone''s. '
  'There is always at least one administrator.';

create policy "Admins grant roles"
  on public.user_roles
  for insert
  to authenticated
  with check ((select private.has_role('admin')));

create policy "Admins revoke roles"
  on public.user_roles
  for delete
  to authenticated
  using ((select private.has_role('admin')));

-- Runs before an administrator row is deleted or updated. Security definer, so the check counts
-- every administrator, whoever is removing one. Removals take turns: the advisory lock is held until
-- the transaction ends, and each check then sees the removals committed before it. Without the
-- lock, two administrators removing each other at the same moment would each still see the other,
-- and both would succeed.
create function private.keep_an_administrator()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' and new.role = 'admin' then
    return new;
  end if;

  perform pg_advisory_xact_lock(hashtextextended('public.user_roles: keep an administrator', 0));

  if not exists (
    select 1
    from public.user_roles
    where user_roles.role = 'admin'
      and user_roles.profile_id <> old.profile_id
  ) then
    -- A code of its own, so the app can tell this refusal from any other error.
    raise exception 'The last administrator can''t be removed.'
      using errcode = 'OB001', hint = 'Give someone else the Administrator role first.';
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

revoke all on function private.keep_an_administrator() from public;

create trigger keep_an_administrator
  before delete or update on public.user_roles
  for each row
  when (old.role = 'admin')
  execute function private.keep_an_administrator();
