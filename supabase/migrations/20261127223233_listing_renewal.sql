-- K-4, part 2: posters renew their classifieds listings from My listings (backlog K-4;
-- board-decisions §7). Builds on K-1's listings (20261126210923_listings.sql) and part 1's expiry
-- (20261127221430_listing_expiry.sql).
--
-- A renewal keeps a listing up for another 60 days from the moment of renewal, as it is, with no new
-- review: the listing is exactly what a moderator approved, and any change a poster makes still
-- goes back to the moderators (K-1's guard trigger). That's option A of Parker's question
-- Q-20261127-221243-29891, built while the answer is pending.
--
-- Who can renew what, and when:
--   - only the poster, while their membership is current (a level, and expires_at still ahead),
--     as for posting;
--   - a live listing from 5 days before it comes down (the day the reminder goes out, counted on
--     the Society's calendar in Central Time, as the reminder is), or a listing that has come down:
--     expired, or live past its expires_at before the daily job has marked it;
--   - never a pending or rejected listing, which no moderator has approved as it stands.
-- Renewing sets the status to live, approved_at to now and expires_at 60 days later, as approving
-- does: the guard trigger does the same when the status changes to live. A renewed listing goes
-- back to the top of the classifieds, which list the newest approval first. The 5-day window keeps
-- that to once per run of a listing.
--
-- Members can't write the status or the dates (column privileges and the guard trigger), so My
-- listings' Server Function (lib/listings/my-listings-actions.ts) calls renew_listing() with the
-- service role, passing the signed-in member's id from their session. The function checks
-- everything else itself, and changes nothing when a check fails. Two renewals at once renew once:
-- the second re-checks the window on the renewed row and finds it 60 days out.

create function public.renew_listing(p_listing_id uuid, p_profile_id uuid)
returns table (id uuid, title text, expires_at timestamptz)
language sql
security invoker
set search_path = ''
as $$
  update public.listings as l
  set status = 'live', approved_at = now(), expires_at = now() + interval '60 days'
  where l.id = p_listing_id
    and l.profile_id = p_profile_id
    and exists (
      select 1
      from public.profiles as p
      where p.id = p_profile_id and p.level is not null and p.expires_at > now()
    )
    and (
      l.status = 'expired'
      or (
        l.status = 'live'
        and (l.expires_at at time zone 'America/Chicago')::date
          - (now() at time zone 'America/Chicago')::date <= 5
      )
    )
  returning l.id, l.title, l.expires_at;
$$;

-- Server code only. Supabase's default privileges let anon and authenticated execute new
-- functions in public, and revoking from public leaves those grants, so revoke them by name.
revoke all on function public.renew_listing(uuid, uuid) from public, anon, authenticated;
grant execute on function public.renew_listing(uuid, uuid) to service_role;
