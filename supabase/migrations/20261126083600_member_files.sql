-- M-7: members-only files (decision 0001, backlog M-7). Builds on M-2's
-- 20261126050904_profiles_and_roles.sql.
--
-- Sanity serves every uploaded file publicly by URL, even from a private dataset, so files only
-- members may download (PDFs, documents, audio) live in the private Storage bucket member-files.
-- Each file has a row in public.member_files saying who may download it, with the audiences pages,
-- posts and events use (lib/members/access.ts), except everyone: public files belong in Sanity.
--   - members: a member whose membership is active, at any level;
--   - levels: an active member at one of `levels`.
-- A membership is active while profiles.expires_at is in the future, with no grace period
-- (board-decisions §4).
--
-- Who can do what:
--   - Members read the rows of, and download, the files they may. Visitors (anon), members who
--     never paid, members whose membership has ended and members at other levels get none of
--     them, through the Data API or Storage.
--   - Editors and administrators add and remove files and see them all. Nobody changes a row or an
--     object in place: remove it and add it again.
--   - The site downloads as the member: the download route (app/files/[id]/route.ts) checks access,
--     then asks Storage for a short-lived signed URL, which Storage gives only to someone these
--     policies let read the object.
--
-- The checks live in the private schema, which the Data API doesn't expose, as in M-2.

create type public.file_audience as enum ('members', 'levels');

create table public.member_files (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(btrim(title)) between 1 and 200),
  -- The object's name in the member-files bucket: "<id>/<file name with safe characters>".
  object_path text not null unique,
  -- The name the file downloads as.
  file_name text not null check (char_length(file_name) between 1 and 200),
  content_type text check (char_length(content_type) <= 200),
  size_bytes bigint check (size_bytes >= 0),
  audience public.file_audience not null default 'members',
  levels public.membership_level[] not null default '{}',
  uploaded_by uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  constraint member_files_object_path check (
    object_path ~ '^[0-9a-f-]{36}/[A-Za-z0-9._-]{1,120}$'
    and split_part(object_path, '/', 1) = id::text
  ),
  constraint member_files_levels check (
    (audience = 'members' and cardinality(levels) = 0)
    or (audience = 'levels' and cardinality(levels) > 0)
  )
);

comment on table public.member_files is
  'Members-only files in the member-files Storage bucket and who may download them. Members read '
  'the rows of the files they may download; editors and administrators add and remove files.';
comment on column public.member_files.levels is
  'For audience levels: the membership levels that may download the file. Empty for members.';

-- Deleting a profile sets uploaded_by to null; the index saves scanning the table for it.
create index member_files_uploaded_by_idx on public.member_files (uploaded_by);

alter table public.member_files enable row level security;

-- As in M-2: start from nothing and grant only what the policies below use. No UPDATE.
revoke all on table public.member_files from anon, authenticated;
grant select, insert, delete on table public.member_files to authenticated;

-- Whether the signed-in member's membership allows a file: active (a level, and expires_at still
-- in the future) and, for audience levels, at one of the levels. The parameters have their own
-- names because a column called level would take precedence over a parameter called level.
create function private.has_member_access(
  file_audience public.file_audience,
  file_levels public.membership_level[]
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles
    where profiles.id = (select auth.uid())
      and profiles.level is not null
      and profiles.expires_at > now()
      and (file_audience = 'members' or profiles.level = any (file_levels))
  );
$$;

-- Whether the signed-in member may download the object called object_name in member-files.
create function private.can_download_member_file(object_name text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.member_files
    where member_files.object_path = object_name
      and private.has_member_access(member_files.audience, member_files.levels)
  );
$$;

-- Whether the signed-in member is an editor or an administrator, who manage the files.
create function private.manages_member_files()
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
      and user_roles.role in ('editor', 'admin')
  );
$$;

revoke all on function private.has_member_access(public.file_audience, public.membership_level[])
  from public;
revoke all on function private.can_download_member_file(text) from public;
revoke all on function private.manages_member_files() from public;
grant execute on function private.has_member_access(public.file_audience, public.membership_level[])
  to authenticated;
grant execute on function private.can_download_member_file(text) to authenticated;
grant execute on function private.manages_member_files() to authenticated;

create policy "Members read files they may download; editors read all"
  on public.member_files
  for select
  to authenticated
  using (
    private.has_member_access(audience, levels)
    or (select private.manages_member_files())
  );

create policy "Editors add member files"
  on public.member_files
  for insert
  to authenticated
  with check ((select private.manages_member_files()) and uploaded_by = (select auth.uid()));

create policy "Editors remove member files"
  on public.member_files
  for delete
  to authenticated
  using ((select private.manages_member_files()));

-- The bucket: private, so every read goes through these policies or a signed URL. 50 MiB per file,
-- the most a Supabase project on the free plan allows.
insert into storage.buckets (id, name, public, file_size_limit)
values ('member-files', 'member-files', false, 52428800);

-- Storage checks these policies for the signed-in member's requests: downloading, listing and
-- signing need SELECT; uploading needs INSERT; removing needs DELETE (and SELECT). There's no
-- UPDATE policy, so nobody overwrites or moves a file. Visitors (anon) have no policy at all.
create policy "Members download member files they may"
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'member-files'
    and (private.can_download_member_file(name) or (select private.manages_member_files()))
  );

create policy "Editors upload member files"
  on storage.objects
  for insert
  to authenticated
  with check (bucket_id = 'member-files' and (select private.manages_member_files()));

create policy "Editors remove member files"
  on storage.objects
  for delete
  to authenticated
  using (bucket_id = 'member-files' and (select private.manages_member_files()));
