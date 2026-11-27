-- K-3: messages people send classifieds posters through the site (backlog K-3; board-decisions §7).
-- Builds on K-1's listings (20261126210923_listings.sql).
--
-- A listing's page lets signed-in people write to its poster. The site emails the message to the
-- poster's address, which it reads with the service role and never shows, and the poster replies
-- straight to the sender (lib/listings/contact-actions.ts). Each message goes out through the
-- same email account as the sign-in links, so one person may send only so many a day: a hijacked
-- account can't flood the posters or use up the day's email quota.
--
-- listing_messages records who wrote about which listing, and when: nothing of what they wrote.
-- The limit counts a sender's rows from the last day, and older rows are deleted as new messages
-- come in, so the table holds about a day of messages. A listing's or a member's rows go with them.
--
-- Nobody reads these through the Data API but the service role: the table has no policies, and
-- members and visitors have no privileges on it or on the function. The function lives in public
-- because server code calls it through the Data API; it is SECURITY INVOKER, so it runs with the
-- caller's rights (supabase/tests/rls_baseline_test.sql allows no SECURITY DEFINER function in
-- public).

create table public.listing_messages (
  id bigint generated always as identity primary key,
  listing_id uuid not null references public.listings (id) on delete cascade,
  sender_id uuid not null references public.profiles (id) on delete cascade,
  sent_at timestamptz not null default now()
);

comment on table public.listing_messages is
  'Who wrote to a classifieds poster through the site, about which listing and when (not what '
  'they wrote), for the daily limit on messages. About a day of rows. Service role only.';

-- The limit counts a sender's recent rows; deleting a listing finds its rows.
create index listing_messages_sender_id_sent_at_idx
  on public.listing_messages (sender_id, sent_at);
create index listing_messages_listing_id_idx on public.listing_messages (listing_id);

alter table public.listing_messages enable row level security;

-- No policies, and no privileges for visitors or members: only the service role, which bypasses
-- row level security, reads and writes these rows. Supabase's default privileges give anon and
-- authenticated everything on new tables in public, so take that back.
revoke all on table public.listing_messages from anon, authenticated;
-- (Deleting old rows locks them first, with SELECT ... FOR UPDATE, which needs UPDATE.)
grant select, insert, update, delete on table public.listing_messages to service_role;

-- Records a message from p_sender_id about p_listing_id, unless that sender has already sent
-- p_daily_limit messages in the last day: returns the new row's id, or null at the limit. Raises
-- no_data_found (P0002) for a listing that isn't live. A message that then fails to go out is
-- deleted by its id, so it doesn't count.
--
-- One sender's messages are recorded one at a time (a lock on the sender until the transaction
-- ends), so messages sent at the same moment can't all pass the count. Rows older than a day are
-- deleted on the way, skipping any another transaction holds.
create function public.record_listing_message(
  p_sender_id uuid,
  p_listing_id uuid,
  p_daily_limit integer
)
returns bigint
language plpgsql
set search_path = ''
as $$
declare
  recorded bigint;
begin
  if not exists (
    select 1
    from public.listings
    where listings.id = p_listing_id
      and listings.status = 'live'
      and listings.expires_at > now()
  ) then
    raise exception 'listing % isn''t live', p_listing_id using errcode = 'no_data_found';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('listing_messages:' || p_sender_id::text, 0));

  delete from public.listing_messages
  where listing_messages.id in (
    select stale.id
    from public.listing_messages as stale
    where stale.sent_at <= now() - interval '1 day'
    for update skip locked
  );

  if (
    select count(*)
    from public.listing_messages
    where listing_messages.sender_id = p_sender_id
      and listing_messages.sent_at > now() - interval '1 day'
  ) >= p_daily_limit then
    return null;
  end if;

  insert into public.listing_messages (listing_id, sender_id)
  values (p_listing_id, p_sender_id)
  returning listing_messages.id into recorded;
  return recorded;
end;
$$;

-- Server code only. Supabase's default privileges let anon and authenticated execute new
-- functions in public, and revoking from public leaves those grants, so revoke them by name.
revoke all on function public.record_listing_message(uuid, uuid, integer)
  from public, anon, authenticated;
grant execute on function public.record_listing_message(uuid, uuid, integer) to service_role;
