-- K-1: classifieds listings that members submit, each with an optional photo (backlog K-1;
-- docs/spec/architecture.md, "People and money"). Builds on M-2's profiles and roles.
--
-- The board's rules (docs/spec/board-decisions.md §7): viewing is public; posting needs an active
-- membership, at any level; every level posts in all five categories; a listing runs 60 days from
-- approval. A membership is active while it has a level and expires_at is still in the future,
-- with no grace period (§4), as for members-only content (lib/members/access.ts).
--
-- Who can do what:
--   - Everyone, visitors included, reads live listings until their expires_at, and sees their
--     photos. Nobody else's pending, rejected or expired listings, and no unattached uploads.
--   - An active member submits listings as themselves. A new listing waits for a moderator
--     (status pending), whatever the request says: the status columns can't be inserted.
--   - The poster reads all their own listings and deletes them at any time. While their membership
--     is active, they change what they wrote (category, title, body, price, photo, contact
--     preference). A changed listing goes back to the moderators (pending), so nothing reaches the
--     public unreviewed.
--   - Moderators and administrators read every listing and change its status and reject_reason
--     (approve, reject, take down), but not what the poster wrote. Approving starts the 60 days.
--   - Server code with the service role (the scheduled job that expires listings, K-4) isn't
--     limited by these rules.
--
-- Row level security picks the rows; who may change which columns is checked by a trigger,
-- because posters and moderators are the same database role (authenticated). The checks live in
-- the private schema, which the Data API doesn't expose, as in M-2.

create type public.listing_category as enum (
  'musicians_wanted', 'gear', 'merch', 'street_team', 'member_connect'
);
create type public.listing_status as enum ('pending', 'live', 'rejected', 'expired');
create type public.listing_contact as enum ('email', 'phone');

create table public.listings (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  category public.listing_category not null,
  title text not null check (char_length(title) <= 100 and btrim(title) <> ''),
  body text not null check (char_length(body) <= 2000 and btrim(body) <> ''),
  -- Asking price in US dollars; null when nothing is for sale.
  price numeric(8, 2) check (price >= 0),
  -- The photo's object in the listing-photos bucket: "<profile_id>/<random uuid>.<jpg|png|webp>".
  photo_path text unique,
  contact_pref public.listing_contact not null default 'email',
  status public.listing_status not null default 'pending',
  reject_reason text check (char_length(reject_reason) <= 500),
  created_at timestamptz not null default now(),
  approved_at timestamptz,
  expires_at timestamptz,
  -- In the poster's own folder, so a listing can't show (and make public) someone else's upload.
  constraint listings_photo_path check (
    photo_path ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.(jpg|png|webp)$'
    and split_part(photo_path, '/', 1) = profile_id::text
  ),
  constraint listings_live_dates check (
    status <> 'live' or (approved_at is not null and expires_at is not null)
  )
);

comment on table public.listings is
  'Classifieds listings (backlog K-*). Everyone reads live listings; active members submit '
  'listings, which wait for a moderator; posters manage their own; moderators change the status.';
comment on column public.listings.contact_pref is
  'How the poster wants to be reached: email (people write through the site; the address stays '
  'private) or phone (the phone number on their profile).';
comment on column public.listings.status is
  'pending until a moderator approves (live) or rejects it; live listings become expired at '
  'expires_at. A poster''s change sends a listing back to pending.';
comment on column public.listings.expires_at is
  'Set when a moderator approves the listing: 60 days later (board-decisions §7). Nobody sees a '
  'live listing after this, even before the scheduled job marks it expired.';

-- Deleting a profile deletes their listings; the index saves scanning the table for them, and
-- serves "my listings".
create index listings_profile_id_idx on public.listings (profile_id);

alter table public.listings enable row level security;

-- As in M-2: start from nothing and grant only what the policies below use. The status, the dates
-- and the poster can't be inserted, so they take their defaults; moderators change the status and
-- reject_reason; the dates follow the status (the trigger below).
revoke all on table public.listings from anon, authenticated;
grant select on table public.listings to anon, authenticated;
grant insert (category, title, body, price, photo_path, contact_pref)
  on table public.listings to authenticated;
grant update (category, title, body, price, photo_path, contact_pref, status, reject_reason)
  on table public.listings to authenticated;
grant delete on table public.listings to authenticated;

-- Whether the signed-in member's membership is active: a level, and expires_at still in the
-- future.
create function private.has_active_membership()
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
  );
$$;

-- Whether the signed-in member moderates the classifieds: moderators and administrators.
create function private.moderates_listings()
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
      and user_roles.role in ('moderator', 'admin')
  );
$$;

revoke all on function private.has_active_membership() from public;
revoke all on function private.moderates_listings() from public;
grant execute on function private.has_active_membership() to authenticated;
grant execute on function private.moderates_listings() to authenticated;

-- (select ...) around auth.uid() and the checks lets Postgres evaluate them once per query.
-- One policy per role and command, so no two permissive policies overlap.
create policy "Visitors read live listings"
  on public.listings
  for select
  to anon
  using (status = 'live' and expires_at > now());

create policy "Members read live listings and their own; moderators read all"
  on public.listings
  for select
  to authenticated
  using (
    (status = 'live' and expires_at > now())
    or profile_id = (select auth.uid())
    or (select private.moderates_listings())
  );

create policy "Active members submit listings"
  on public.listings
  for insert
  to authenticated
  with check (
    profile_id = (select auth.uid())
    and status = 'pending'
    and (select private.has_active_membership())
  );

create policy "Active posters change their listings; moderators change any"
  on public.listings
  for update
  to authenticated
  using (
    (profile_id = (select auth.uid()) and (select private.has_active_membership()))
    or (select private.moderates_listings())
  )
  with check (
    (profile_id = (select auth.uid()) and (select private.has_active_membership()))
    or (select private.moderates_listings())
  );

create policy "Posters delete their own listings"
  on public.listings
  for delete
  to authenticated
  using (profile_id = (select auth.uid()));

-- Who changes which columns, and what follows from a change:
--   - only the poster changes what they wrote; only moderators change the status and
--     reject_reason (members reach this as authenticated; the service role isn't limited);
--   - a listing whose details change goes back to pending, unless the same change sets the status;
--   - approving (live) starts the 60 days and clears the reject reason; going back to pending
--     clears the approval.
-- SECURITY INVOKER, so current_user is the caller's role.
create function private.check_listing_change()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  details_changed boolean :=
    (new.category, new.title, new.body, new.price, new.photo_path, new.contact_pref)
    is distinct from
    (old.category, old.title, old.body, old.price, old.photo_path, old.contact_pref);
  moderation_changed boolean :=
    (new.status, new.reject_reason) is distinct from (old.status, old.reject_reason);
begin
  if current_user = 'authenticated' then
    if details_changed and old.profile_id is distinct from (select auth.uid()) then
      raise exception 'only the poster can change what a listing says'
        using errcode = '42501';
    end if;
    if moderation_changed and not private.moderates_listings() then
      raise exception 'only moderators can change a listing''s status'
        using errcode = '42501';
    end if;
  end if;

  if details_changed and not moderation_changed then
    new.status := 'pending';
  end if;

  if new.status is distinct from old.status then
    if new.status = 'live' then
      new.approved_at := now();
      new.expires_at := now() + interval '60 days';
      new.reject_reason := null;
    elsif new.status = 'pending' then
      new.approved_at := null;
      new.expires_at := null;
      new.reject_reason := null;
    end if;
  end if;
  return new;
end;
$$;

revoke all on function private.check_listing_change() from public;

create trigger check_listing_change
  before update on public.listings
  for each row
  execute function private.check_listing_change();

-- The photos: a private bucket, so a photo is seen only through these policies or a signed URL.
-- JPEG, PNG and WebP only (iPhones convert their photos to JPEG for uploads from the browser), up
-- to 10 MB each.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'listing-photos', 'listing-photos', false, 10485760,
  array['image/jpeg', 'image/png', 'image/webp']
);

-- Viewing, listing and signing need SELECT. A photo is visible to whoever can read a listing that
-- shows it (the subquery runs under the listings policies above: live ones for everyone, their own
-- for posters, all for moderators), and to its uploader, who checks an upload arrived before the
-- listing exists. Uploading needs INSERT: active members, into their own folder, under a name like
-- the listing's photo_path. Removing needs DELETE: the uploader, once no listing shows the photo.
-- There's no UPDATE policy, so nobody overwrites or moves a photo.
create policy "Anyone sees the photos of listings they can read"
  on storage.objects
  for select
  to anon, authenticated
  using (
    bucket_id = 'listing-photos'
    and (
      exists (select 1 from public.listings where listings.photo_path = objects.name)
      or (storage.foldername(name))[1] = (select auth.uid())::text
    )
  );

create policy "Active members upload listing photos"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'listing-photos'
    and name ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.(jpg|png|webp)$'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and (select private.has_active_membership())
  );

create policy "Members remove their unused listing photos"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'listing-photos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and not exists (select 1 from public.listings where listings.photo_path = objects.name)
  );
