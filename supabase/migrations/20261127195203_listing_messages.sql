-- K-3: messages people send classifieds posters through the site (backlog K-3; board-decisions §7;
-- decision 0009). Builds on K-1's listings (20261126210923_listings.sql).
--
-- Anyone, visitors included, can write to a poster from the listing's page: a name, an email
-- address and a message. The site emails the message to the poster's address, which it reads with
-- the service role and never shows, and the poster replies straight to the address the sender gave
-- (lib/listings/contact-actions.ts). The form is open to everyone, so decision 0009 asks for limits
-- without a third party: so many messages a day from one email address, from one network address,
-- and to one listing. Each message also goes out through the same email account as the sign-in
-- links, which a flood would use up.
--
-- listing_messages records each message: which listing, when, and hashes of the sender's email and
-- network addresses, so the limits can count them. Nothing of what anyone wrote, and neither
-- address itself. The limits look at the last day, and older rows are deleted as new messages come
-- in, so the table holds about a day of messages. A listing's rows go with it.
--
-- Nobody reads these through the Data API but the service role: the table has no policies, and
-- members and visitors have no privileges on it or on the function. The function lives in public
-- because server code calls it through the Data API; it is SECURITY INVOKER, so it runs with the
-- caller's rights (supabase/tests/rls_baseline_test.sql allows no SECURITY DEFINER function in
-- public).

create table public.listing_messages (
  id bigint generated always as identity primary key,
  listing_id uuid not null references public.listings (id) on delete cascade,
  -- SHA-256 (hex) of the sender's email address, lowercased, and of their network address.
  sender_email_hash text not null check (sender_email_hash ~ '^[0-9a-f]{64}$'),
  sender_ip_hash text not null check (sender_ip_hash ~ '^[0-9a-f]{64}$'),
  sent_at timestamptz not null default now()
);

comment on table public.listing_messages is
  'Messages sent to classifieds posters through the site: the listing, the time and hashes of the '
  'sender''s email and network addresses (not what they wrote), for the daily limits. About a day '
  'of rows. Service role only.';

-- The limits count recent rows by sender and by listing; deleting a listing finds its rows.
create index listing_messages_sender_email_hash_idx
  on public.listing_messages (sender_email_hash, sent_at);
create index listing_messages_sender_ip_hash_idx on public.listing_messages (sender_ip_hash, sent_at);
create index listing_messages_listing_id_idx on public.listing_messages (listing_id, sent_at);

alter table public.listing_messages enable row level security;

-- No policies, and no privileges for visitors or members: only the service role, which bypasses
-- row level security, reads and writes these rows. Supabase's default privileges give anon and
-- authenticated everything on new tables in public, so take that back.
revoke all on table public.listing_messages from anon, authenticated;
grant select, insert, delete on table public.listing_messages to service_role;

-- Records a message to the live listing p_listing_id from the sender whose email and network
-- addresses hash to p_email_hash and p_ip_hash, and returns the new row's id. In the last day, a
-- sender (by either hash) may send p_sender_limit messages and a listing may get p_listing_limit.
-- Past a limit, nothing is recorded and it raises OB201 (the sender's) or OB202 (the listing's).
-- A listing that isn't live raises no_data_found (P0002). A message that then fails to go out is
-- deleted by its id, so it doesn't count.
--
-- Messages are recorded one at a time, site-wide (a lock until the transaction ends), so messages
-- sent at the same moment can't all pass the counts; a few a day won't queue for long. Rows older
-- than a day are deleted on the way.
create function public.record_listing_message(
  p_listing_id uuid,
  p_email_hash text,
  p_ip_hash text,
  p_sender_limit integer,
  p_listing_limit integer
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

  perform pg_advisory_xact_lock(hashtextextended('listing_messages', 0));

  delete from public.listing_messages
  where listing_messages.sent_at <= now() - interval '1 day';

  if (
    select count(*)
    from public.listing_messages
    where listing_messages.sender_email_hash = p_email_hash
      and listing_messages.sent_at > now() - interval '1 day'
  ) >= p_sender_limit or (
    select count(*)
    from public.listing_messages
    where listing_messages.sender_ip_hash = p_ip_hash
      and listing_messages.sent_at > now() - interval '1 day'
  ) >= p_sender_limit then
    raise exception 'this sender has sent % messages today', p_sender_limit using errcode = 'OB201';
  end if;

  if (
    select count(*)
    from public.listing_messages
    where listing_messages.listing_id = p_listing_id
      and listing_messages.sent_at > now() - interval '1 day'
  ) >= p_listing_limit then
    raise exception 'listing % has had % messages today', p_listing_id, p_listing_limit
      using errcode = 'OB202';
  end if;

  insert into public.listing_messages (listing_id, sender_email_hash, sender_ip_hash)
  values (p_listing_id, p_email_hash, p_ip_hash)
  returning listing_messages.id into recorded;
  return recorded;
end;
$$;

-- Server code only. Supabase's default privileges let anon and authenticated execute new
-- functions in public, and revoking from public leaves those grants, so revoke them by name.
revoke all on function public.record_listing_message(uuid, text, text, integer, integer)
  from public, anon, authenticated;
grant execute on function public.record_listing_message(uuid, text, text, integer, integer)
  to service_role;
