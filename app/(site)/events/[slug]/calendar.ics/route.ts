import { CALENDAR_CONTENT, calendarEntry, type CalendarContent } from "@/lib/events/calendar-entry";
import { calendarFile } from "@/lib/events/ics";
import { siteOrigin } from "@/lib/events/site-origin";
import { getGatedItem } from "@/sanity/content";

// "Add to calendar" on an event page (backlog P-2): the event as a calendar file, which Google
// Calendar, Apple Calendar and Outlook open. A repeating event comes with its repeats. It's read
// through sanity/content like the page, so it has the place and description only for a viewer who
// may see the event (a locked event's file has its public fields only), and no cache may keep it.

/** Web addresses as the Studio makes them (sanity/schemas/validation.ts slugRule). */
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const NOT_CACHED = { "cache-control": "private, no-store" };

export async function GET(
  request: Request,
  { params }: RouteContext<"/events/[slug]/calendar.ics">,
) {
  const { slug } = await params;
  const event = SLUG.test(slug)
    ? await getGatedItem<"event", CalendarContent>("event", slug, CALENDAR_CONTENT)
    : null;
  const entry = event && calendarEntry(event, siteOrigin(request));
  if (!entry) {
    return new Response("There's no such event.\n", {
      status: 404,
      headers: { ...NOT_CACHED, "content-type": "text/plain; charset=utf-8" },
    });
  }
  return new Response(calendarFile({ entries: [entry], now: new Date() }), {
    headers: {
      ...NOT_CACHED,
      "content-type": "text/calendar; charset=utf-8",
      "content-disposition": `attachment; filename="${slug}.ics"`,
    },
  });
}
