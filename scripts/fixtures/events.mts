/**
 * Synthetic events and venues, shaped after the event and venue fields in
 * docs/spec/architecture.md. Events live in Sanity, so these are for Sanity's development dataset:
 * `pnpm fixtures:sanity` loads them (./sanity-fixtures.mts). In C-1's schemas
 * (sanity/schemas/documents/) each fixture venue becomes a public venue (name, address, mapUrl)
 * plus a members-only directoryEntry (capacity, pay, notes, booking contact). Names follow the
 * placeholders in the approved design concept (docs/design/prototype.html); none of them is a real
 * venue or band.
 */

/** Event categories in the design concept. */
export const EVENT_CATEGORIES = ["Concert", "Jam", "Workshop", "Society"] as const;
export type EventCategory = (typeof EVENT_CATEGORIES)[number];

/** Start times are local to the Ozarks (Central Time). */
export const EVENT_TIME_ZONE = "America/Chicago";

export interface FixtureVenue {
  /** Sanity document id. */
  id: string;
  name: string;
  address: string;
  mapUrl: string;
  capacity: string;
  /** How the venue usually pays bands, as the directory's Pay column shows it. */
  pay: string | null;
  /** Venue directory booking contact: visible to Band, Business and Sponsor members only. */
  booking: { contact: string; email: string | null; phone: string | null };
  notes: string | null;
}

export interface FixtureEvent {
  /** Sanity document id. */
  id: string;
  title: string;
  /** Days from now to the first (or only) date. Negative for past events. */
  startsInDays: number;
  /** "HH:MM", 24-hour, in EVENT_TIME_ZONE. */
  startTime: string;
  recurrence: { frequency: "weekly" | "monthly"; untilInDays: number } | null;
  /** Null for a private members-only gathering (the address goes out by email). */
  venueId: string | null;
  category: EventCategory;
  priceText: string;
  memberPrice: string | null;
  membersOnly: boolean;
  body: string;
}

export const VENUES: readonly FixtureVenue[] = [
  {
    id: "fixture-venue-old-mill",
    name: "Old Mill Music Hall",
    address: "410 Mill Street, Riverbend",
    mapUrl: "https://example.com/map/old-mill-music-hall",
    capacity: "350",
    pay: "Door split or guarantee",
    booking: { contact: "Sam Ortega", email: "booking.oldmill@example.com", phone: null },
    notes: "Sound tech provided.",
  },
  {
    id: "fixture-venue-riverside-tap",
    name: "The Riverside Tap",
    address: "22 Front Street, Riverbend",
    mapUrl: "https://example.com/map/the-riverside-tap",
    capacity: "120",
    pay: "Guarantee plus tips",
    booking: { contact: "Darnell Hughes", email: null, phone: "(479) 555-0161" },
    notes: "Backline drum kit.",
  },
  {
    id: "fixture-venue-riverbend-brewing",
    name: "Riverbend Brewing Co.",
    address: "1800 Riverbend Parkway, Riverbend",
    mapUrl: "https://example.com/map/riverbend-brewing-co",
    capacity: "180",
    pay: "Flat fee",
    booking: { contact: "Events desk", email: "events.riverbend@example.com", phone: null },
    notes: "Patio stage from April to October.",
  },
  {
    id: "fixture-venue-courthouse-square",
    name: "Courthouse Square Stage",
    address: "Courthouse Square, Riverbend",
    mapUrl: "https://example.com/map/courthouse-square-stage",
    capacity: "Open air",
    pay: "Grant-funded",
    booking: { contact: "City Parks Department", email: "parks@example.com", phone: null },
    notes: "Summer series only.",
  },
  {
    id: "fixture-venue-bluebird",
    name: "The Bluebird Lounge",
    address: "305 Elm Street, Riverbend",
    mapUrl: "https://example.com/map/the-bluebird-lounge",
    capacity: "80",
    pay: "Tips plus bar tab",
    booking: { contact: "Ana Ruiz", email: null, phone: "(479) 555-0162" },
    notes: "Acoustic and duo acts only.",
  },
  {
    id: "fixture-venue-library",
    name: "Riverbend Public Library, Room B",
    address: "100 Library Lane, Riverbend",
    mapUrl: "https://example.com/map/riverbend-public-library",
    capacity: "60",
    pay: null,
    booking: { contact: "Community room desk", email: null, phone: "(479) 555-0163" },
    notes: null,
  },
];

// Covers weekly and monthly repeats, members-only events (one with no public venue), member
// pricing, free events and a past event.
export const EVENTS: readonly FixtureEvent[] = [
  {
    id: "fixture-event-open-jam",
    title: "Weekly Open Jam",
    startsInDays: 2,
    startTime: "19:00",
    recurrence: { frequency: "weekly", untilInDays: 120 },
    venueId: "fixture-venue-riverbend-brewing",
    category: "Jam",
    priceText: "Free",
    memberPrice: null,
    membersOnly: false,
    body: "Bring your instrument and sign up at the door. The house band backs every set.",
  },
  {
    id: "fixture-event-monthly-jam",
    title: "Monthly Blues Jam",
    startsInDays: 10,
    startTime: "19:00",
    recurrence: { frequency: "monthly", untilInDays: 180 },
    venueId: "fixture-venue-riverside-tap",
    category: "Jam",
    priceText: "Free",
    memberPrice: null,
    membersOnly: false,
    body: "Players of every level welcome. Sign-up sheet opens at 6:30.",
  },
  {
    id: "fixture-event-delta-night",
    title: "Delta Night: The Mavis Crane Band",
    startsInDays: 9,
    startTime: "20:00",
    recurrence: null,
    venueId: "fixture-venue-old-mill",
    category: "Concert",
    priceText: "$15",
    memberPrice: "$10",
    membersOnly: false,
    body: "Hill-country grooves and slide guitar. Doors at 7.",
  },
  {
    id: "fixture-event-challenge-auditions",
    title: "Ozark Blues Challenge: Band Auditions",
    startsInDays: 16,
    startTime: "13:00",
    recurrence: null,
    venueId: "fixture-venue-old-mill",
    category: "Concert",
    priceText: "$10",
    memberPrice: "Free",
    membersOnly: false,
    body: "Eight bands, twenty minutes each. The winner goes on to the regional final.",
  },
  {
    id: "fixture-event-harmonica-workshop",
    title: "Harmonica Workshop for Beginners",
    startsInDays: 22,
    startTime: "18:30",
    recurrence: null,
    venueId: "fixture-venue-riverbend-brewing",
    category: "Workshop",
    priceText: "$20",
    memberPrice: "$12",
    membersOnly: false,
    body: "Bring a harmonica in C. Loaners available.",
  },
  {
    id: "fixture-event-holiday-social",
    title: "Members' Holiday Social",
    startsInDays: 24,
    startTime: "19:00",
    recurrence: null,
    venueId: null,
    category: "Society",
    priceText: "Free",
    memberPrice: null,
    membersOnly: true,
    body: "Potluck and a members' jam. The address is in your member email.",
  },
  {
    id: "fixture-event-volunteer-orientation",
    title: "Blues in the Schools: Volunteer Orientation",
    startsInDays: 12,
    startTime: "18:00",
    recurrence: null,
    venueId: "fixture-venue-library",
    category: "Society",
    priceText: "Free",
    memberPrice: null,
    membersOnly: false,
    body: "Learn how our classroom visits work and sign up for a school.",
  },
  {
    id: "fixture-event-duo-night",
    title: "Acoustic Duo Night",
    startsInDays: 30,
    startTime: "19:00",
    recurrence: null,
    venueId: "fixture-venue-bluebird",
    category: "Concert",
    priceText: "$10",
    memberPrice: "$8",
    membersOnly: false,
    body: "Three acoustic duos in an intimate room.",
  },
  {
    id: "fixture-event-winter-revue",
    title: "Winter Blues Revue",
    startsInDays: 38,
    startTime: "19:30",
    recurrence: null,
    venueId: "fixture-venue-old-mill",
    category: "Concert",
    priceText: "$18",
    memberPrice: "$12",
    membersOnly: false,
    body: "Our biggest indoor show of the year, with four local bands.",
  },
  {
    id: "fixture-event-annual-meeting",
    title: "Annual Meeting and Board Election",
    startsInDays: 45,
    startTime: "17:00",
    recurrence: null,
    venueId: "fixture-venue-riverbend-brewing",
    category: "Society",
    priceText: "Free",
    memberPrice: null,
    membersOnly: true,
    body: "Reports from the board, then voting. Members only.",
  },
  {
    id: "fixture-event-summer-finale",
    title: "Courthouse Square Summer Series Finale",
    startsInDays: -60,
    startTime: "18:00",
    recurrence: null,
    venueId: "fixture-venue-courthouse-square",
    category: "Concert",
    priceText: "Free",
    memberPrice: null,
    membersOnly: false,
    body: "The last outdoor show of the summer.",
  },
];
