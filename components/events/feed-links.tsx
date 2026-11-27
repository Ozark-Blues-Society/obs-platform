import { FEED_NAME } from "@/lib/events/ics";

/** The calendar feed's address: over https, and as a webcal:// link that calendar apps open. */
export type FeedAddress = { https: string; webcal: string };

/**
 * "Subscribe to this calendar in Google / Apple / Outlook" (the approved concept): links that add
 * the calendar feed to each app, and the feed's address for any other. Google and Outlook fetch the
 * feed from their own servers, so these work only once the site is on the internet.
 */
export function FeedLinks({ feed }: { feed: FeedAddress }) {
  const google = `https://calendar.google.com/calendar/render?cid=${encodeURIComponent(feed.webcal)}`;
  const outlook = `https://outlook.live.com/calendar/0/addfromweb?${new URLSearchParams({
    url: feed.https,
    name: FEED_NAME,
  })}`;
  return (
    <div className="mt-4 grid gap-1 text-small text-muted">
      <p>
        Subscribe to this calendar in <a href={google}>Google Calendar</a>,{" "}
        <a href={feed.webcal}>Apple Calendar</a> or <a href={outlook}>Outlook</a>, and new events
        appear there by themselves.
      </p>
      <p className="wrap-break-word">
        Another app? Add this address: <a href={feed.https}>{feed.https}</a>
      </p>
    </div>
  );
}
