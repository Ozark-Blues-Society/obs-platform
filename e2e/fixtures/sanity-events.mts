/**
 * Synthetic events and venues for the events calendar's end-to-end tests (backlog P-2), which the
 * e2e stand-in for Sanity serves with the documents in ./sanity-content.mts. Events start at
 * 01:00 UTC some days from today (7 or 8 PM the evening before in Central Time): the same all day,
 * in the stand-in and in the tests, which read their expectations from these starts. The
 * members-only event's venue and description hold MEMBERS_ONLY_MARKER, so a test can check that
 * no response reaches a viewer who may not see it.
 */
import { MEMBERS_ONLY_MARKER } from "./sanity-content.mts";

const DAY = 24 * 60 * 60 * 1000;
const daysFromNow = (days: number) => new Date(Date.now() + days * DAY).toISOString();

/** 01:00 UTC, `days` days from today in UTC. */
function startIn(days: number): string {
  const today = new Date();
  return new Date(
    Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() + days, 1),
  ).toISOString();
}

export const VENUES = {
  open: {
    id: "venue-e2e-old-mill",
    name: "E2E Old Mill Music Hall",
    address: "410 Mill Street, Riverbend",
    mapUrl: "https://example.com/map/e2e-old-mill",
  },
  secret: {
    id: "venue-e2e-secret-hall",
    name: `E2E secret hall ${MEMBERS_ONLY_MARKER}`,
    address: `1 Hidden Lane ${MEMBERS_ONLY_MARKER}`,
  },
} as const;

export const EVENTS = {
  /** A concert for everyone, with a members' price. */
  concert: { slug: "e2e-open-concert", title: "E2E open concert", start: startIn(6) },
  /** For members only, at a venue only members may see. */
  social: { slug: "e2e-members-social", title: "E2E members social", start: startIn(9) },
  /** Weekly since 16 days ago, for six weeks more: next in 5 days, before the concert. */
  jam: {
    slug: "e2e-weekly-jam",
    title: "E2E weekly jam",
    start: startIn(-16),
    until: startIn(45).slice(0, 10),
  },
  /** Over: three weeks ago. */
  past: { slug: "e2e-past-show", title: "E2E past show", start: startIn(-20) },
} as const;

function body(text: string) {
  return [
    {
      _type: "block",
      _key: "b1",
      style: "normal",
      markDefs: [],
      children: [{ _type: "span", _key: "s1", text, marks: [] }],
    },
  ];
}

function event(
  { slug, title, start }: { slug: string; title: string; start: string },
  fields: Record<string, unknown>,
) {
  return {
    _id: `event-${slug}`,
    _type: "event",
    _createdAt: daysFromNow(-30),
    _updatedAt: daysFromNow(-1),
    _rev: "e2e",
    title,
    slug: { _type: "slug", current: slug },
    start,
    recurrence: { frequency: "none" },
    visibility: { _type: "visibility", audience: "everyone" },
    ...fields,
  };
}

const venueRef = (id: string) => ({ _type: "reference", _ref: id });

export const EVENT_DOCUMENTS = [
  ...Object.values(VENUES).map(({ id, ...fields }) => ({
    _id: id,
    _type: "venue",
    _createdAt: daysFromNow(-30),
    _updatedAt: daysFromNow(-30),
    _rev: "e2e",
    ...fields,
  })),
  event(EVENTS.concert, {
    category: "concert",
    priceText: "$15",
    memberPrice: "$10",
    venue: venueRef(VENUES.open.id),
    body: body(`The ${EVENTS.concert.title} in full.`),
  }),
  event(EVENTS.social, {
    category: "society",
    priceText: "Free",
    visibility: { _type: "visibility", audience: "members" },
    venue: venueRef(VENUES.secret.id),
    body: body(`The ${EVENTS.social.title} in full. ${MEMBERS_ONLY_MARKER}`),
  }),
  event(EVENTS.jam, {
    category: "jam",
    priceText: "Free",
    recurrence: { frequency: "weekly", until: EVENTS.jam.until },
    venue: venueRef(VENUES.open.id),
    body: body(`The ${EVENTS.jam.title} in full.`),
  }),
  event(EVENTS.past, {
    category: "concert",
    priceText: "$10",
    venue: venueRef(VENUES.open.id),
    body: body(`The ${EVENTS.past.title} in full.`),
  }),
];
