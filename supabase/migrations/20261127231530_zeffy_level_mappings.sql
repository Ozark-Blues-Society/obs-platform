-- M-3: which membership level each rate of the Zeffy membership form buys (decision 0007,
-- docs/spec/architecture.md "Zeffy → Supabase"). Zeffy payments carry no metadata, so the webhook
-- and the nightly reconciliation (M-5) look up a payment's campaign_id and rate_id here to find
-- the level, and send a payment whose rate isn't here to the admin review list.
--
-- Who can do what:
--   - Administrators read, add, change and remove mappings (M-5 adds the screen for it).
--   - Nobody else reads them through the Data API: not members, other staff or visitors.
--   - Server code with the service role reads them, and doesn't change them.
--
-- The local seed (supabase/seed.sql) fills it from lib/zeffy/level-mapping.ts, whose ids are
-- synthetic. The real ones go into the production table at launch (backlog Q-5).

create table public.zeffy_level_mappings (
  -- Zeffy's ids. Its campaign ids are UUIDs, but the spec doesn't say what a rate id looks like,
  -- so both are text.
  campaign_id text not null check (char_length(campaign_id) between 1 and 64),
  rate_id text not null check (char_length(rate_id) between 1 and 64),
  level public.membership_level not null,
  primary key (campaign_id, rate_id)
);

comment on table public.zeffy_level_mappings is
  'The membership level each Zeffy campaign and rate buys (the membership form''s rates). '
  'Administrators edit it; the service role reads it.';

alter table public.zeffy_level_mappings enable row level security;

-- Supabase's default privileges give anon, authenticated and service_role every privilege on new
-- tables in public, TRUNCATE (which skips row level security) among them. Start from nothing.
revoke all on table public.zeffy_level_mappings from anon, authenticated, service_role;
grant select, insert, update, delete on table public.zeffy_level_mappings to authenticated;
grant select on table public.zeffy_level_mappings to service_role;

create policy "Admins manage the Zeffy level mapping"
  on public.zeffy_level_mappings
  for all
  to authenticated
  using ((select private.has_role('admin')))
  with check ((select private.has_role('admin')));
