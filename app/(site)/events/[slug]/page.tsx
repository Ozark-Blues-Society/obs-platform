import type { Metadata } from "next";
import { PortableText, stegaClean, type PortableTextBlock } from "next-sanity";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache, Suspense } from "react";
import { EventDetails, type EventVenue } from "@/components/events/event-details";
import { PageHeader } from "@/components/layout/page-header";
import { MemberFiles, type MemberFileLink } from "@/components/members/member-files";
import { MembersOnlyLock } from "@/components/members/members-only-lock";
import { Tag } from "@/components/ui/tag";
import { repeatText } from "@/lib/events/describe";
import { readSchedule, upcomingOccurrences } from "@/lib/events/occurrences";
import { activeLevel } from "@/lib/members/access";
import { getViewer } from "@/lib/members/viewer";
import { getGatedItem } from "@/sanity/content";
import { EVENTS_PATH, eventPath } from "@/sanity/paths";
import { EVENT_CATEGORIES, optionTitle } from "@/sanity/schemas/options";

// An event's page (backlog P-2): what, when, where and what it costs, the description and
// "Add to calendar". A members-only event shows a viewer who may not see it the title, the date
// and the prices, as the approved concept does, with a lock instead of the place and the
// description.
//
// The event is read through sanity/content, which leaves the venue, the description and the files
// out of Sanity's answer for a viewer who may not see them, so they never reach this page, its
// HTML or its RSC payload. It reads the session, so everything below the layout renders at
// request time.

/** The members-only fields. Venues can be dereferenced freely (sanity/content). */
const EVENT_CONTENT =
  '{ body, "venue": venue->{ name, address, mapUrl }, memberFiles[]{ title, fileId } }';

type EventContent = {
  body?: PortableTextBlock[];
  venue?: { name?: string; address?: string; mapUrl?: string } | null;
  memberFiles?: MemberFileLink[];
};

/** Web addresses as the Studio makes them (sanity/schemas/validation.ts slugRule). */
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** How many of a repeating event's dates the page lists. */
const NEXT_DATES = 4;

// One read per request, shared by the metadata and the page. An address no event could have isn't
// sent to Sanity at all.
const loadEvent = cache(async (slug: string) =>
  SLUG.test(slug) ? getGatedItem<"event", EventContent>("event", slug, EVENT_CONTENT) : null,
);

export async function generateMetadata({ params }: PageProps<"/events/[slug]">): Promise<Metadata> {
  const event = await loadEvent((await params).slug);
  // The title is public, like the page header that shows it. In a preview it carries edit markers.
  const title = event?.title ? stegaClean(event.title).trim() : "";
  return { title: `${title || "Events"} · Ozark Blues Society` };
}

export default function EventPage({ params }: PageProps<"/events/[slug]">) {
  return (
    <Suspense fallback={<p className="mx-auto w-full max-w-site px-gutter py-10">Loading…</p>}>
      <Event params={params} />
    </Suspense>
  );
}

async function Event({ params }: Pick<PageProps<"/events/[slug]">, "params">) {
  const { slug } = await params;
  const event = await loadEvent(slug);
  if (!event) notFound();
  const recurrence = (event.recurrence ?? {}) as { frequency?: unknown; until?: unknown };
  const schedule = readSchedule(clean(event.start), {
    frequency: clean(recurrence.frequency),
    until: clean(recurrence.until),
  });
  // Only a draft can lack a start.
  if (!schedule) notFound();

  const now = new Date();
  const viewer = await getViewer();
  const next = upcomingOccurrences(schedule, now, NEXT_DATES).map((date) => date.toISOString());
  const repeats = repeatText(schedule);
  const { access, content } = event;
  const allowed = access.allowed && content !== null;
  const category = optionTitle(EVENT_CATEGORIES, clean(event.category) as string);

  return (
    <>
      <PageHeader title={event.title || "Untitled event"} eyebrow={category}>
        {event.visibility.audience !== "everyone" && (
          <Tag tone="accent" className="mt-3">
            Members only
          </Tag>
        )}
      </PageHeader>
      <div className="mx-auto grid w-full max-w-site gap-8 px-gutter py-10 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start">
        <div className="lg:col-start-2 lg:row-start-1">
          <EventDetails
            startsAt={schedule.start.toISOString()}
            repeats={
              repeats ? { text: repeats, until: schedule.repeat?.until ?? null, next } : null
            }
            over={next.length === 0}
            locked={!allowed}
            venue={allowed ? venueOf(content.venue) : null}
            price={event.priceText}
            memberPrice={event.memberPrice}
            member={activeLevel(viewer, now) !== null}
            calendarHref={allowed ? `${eventPath(slug)}/calendar.ics` : null}
          />
        </div>
        <div className="min-w-0 lg:col-start-1 lg:row-start-1">
          {allowed ? (
            <article className="grid max-w-prose gap-4">
              {content.body && <PortableText value={content.body} />}
              <MemberFiles files={content.memberFiles} />
            </article>
          ) : (
            !access.allowed && (
              <MembersOnlyLock
                reason={access.reason}
                visibility={event.visibility}
                thing="event"
                returnTo={eventPath(slug)}
              />
            )
          )}
          <p className="mt-8">
            <Link href={EVENTS_PATH}>See the full calendar</Link>
          </p>
        </div>
      </div>
    </>
  );
}

/** A value the page acts on, without a preview's edit markers. */
function clean(value: unknown): unknown {
  return typeof value === "string" ? stegaClean(value).trim() : value;
}

function venueOf(venue: EventContent["venue"]): EventVenue | null {
  const name = typeof venue?.name === "string" && stegaClean(venue.name).trim() ? venue.name : "";
  if (!name) return null;
  return { name, address: venue?.address ?? null, mapUrl: clean(venue?.mapUrl) as string | null };
}
