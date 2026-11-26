-- K-2 and A-3: moderators approve or reject classifieds listings from the moderation queue
-- (backlog K-2, A-3; board-decisions §7). Builds on K-1's listings
-- (20261126210923_listings.sql), whose row level security and guard trigger already let only
-- moderators and administrators change a listing's status.
--
-- Two rules for the moderators' decisions:
--   - A decision applies to the listing the moderator saw. revision counts the versions of what the
--     poster wrote; the queue sends back the revision it showed, and the decision changes the row
--     only while it is still that revision. A poster who changes a pending listing while the
--     moderator is looking at it (the change keeps it pending) never gets the change approved
--     unseen.
--   - A rejected listing says why: the poster reads the reason in the email the queue sends them.

alter table public.listings
  add column revision integer not null default 1;

comment on column public.listings.revision is
  'Counts the versions of what the poster wrote: 1 when submitted, one more with each change to '
  'the category, title, details, price, photo or contact preference (set by a trigger, which '
  'ignores anything else written to it). Moderators approve or reject only the revision they saw.';

alter table public.listings
  add constraint listings_rejected_reason check (
    status <> 'rejected' or coalesce(reject_reason ~ '\S', false)
  );

-- As in K-1, plus the revision: only a change to what the poster wrote counts as a new revision,
-- whoever makes it. Members can't write revision at all (no column privilege), and anything the
-- service role writes to it is replaced. CREATE OR REPLACE keeps the function's privileges and its
-- trigger.
create or replace function private.check_listing_change()
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

  new.revision := old.revision + case when details_changed then 1 else 0 end;

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
