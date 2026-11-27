import { loadFeedEntries } from "@/lib/events/feed";
import { calendarFile, FEED_NAME } from "@/lib/events/ics";
import { siteOrigin } from "@/lib/events/site-origin";

// The subscribable calendar feed (backlog P-2): every event as Google Calendar, Apple Calendar and
// Outlook read it, refreshed as they check back. It holds only what anyone may see: members-only
// events come with their public fields only, whoever asks (lib/events/feed.ts). So, unlike the
// event pages, a shared cache may keep it for a while.

export async function GET(request: Request) {
  const now = new Date();
  const entries = await loadFeedEntries(now, siteOrigin(request));
  return new Response(calendarFile({ name: FEED_NAME, entries, now, refreshHours: 6 }), {
    headers: {
      "content-type": "text/calendar; charset=utf-8",
      "cache-control": "public, max-age=3600",
    },
  });
}
