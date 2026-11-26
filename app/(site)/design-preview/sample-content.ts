// Sample content for the Design Approval package (backlog D-4), in the approved concept's style
// (docs/design/prototype.html). Every event, post, person, venue and sponsor here is made up:
// the Society's real content is still to come (docs/spec/board-decisions.md, "Brand and content").
// Phone numbers use the 555-01xx range set aside for fiction; web addresses use example.com.
import type { PlaceholderPhotoTone } from "@/components/ui/placeholder-photo";

export const PREVIEW_PATH = "/design-preview";

export const PREVIEW_PAGES = {
  overview: { label: "Overview", href: PREVIEW_PATH },
  home: { label: "Home", href: `${PREVIEW_PATH}/home` },
  standard: { label: "Standard", href: `${PREVIEW_PATH}/standard` },
  directory: { label: "Directory", href: `${PREVIEW_PATH}/directory` },
  spotlight: { label: "Band Spotlight", href: `${PREVIEW_PATH}/band-spotlight` },
  promo: { label: "Promo Feature", href: `${PREVIEW_PATH}/promo-feature` },
} as const;

export type PreviewPage = keyof typeof PREVIEW_PAGES;

/** The Directory page as each kind of visitor sees it (docs/spec/board-decisions.md §1). */
export const DIRECTORY_VIEWS = {
  contacts: { label: "Band, Business or Sponsor member", href: `${PREVIEW_PATH}/directory` },
  individual: { label: "Individual member", href: `${PREVIEW_PATH}/directory/individual` },
  visitor: { label: "Visitor", href: `${PREVIEW_PATH}/directory/visitor` },
} as const;

export type DirectoryView = keyof typeof DIRECTORY_VIEWS;

export const NEXT_EVENT = {
  title: "Friday Blues Jam",
  href: "/events/friday-blues-jam",
  startsAt: "2026-12-18T19:00:00-06:00",
  venue: "The Riverside Tap",
};

export const UPCOMING_EVENTS = [
  {
    title: "Delta Night: Mavis Crane Band",
    href: "/events/delta-night-mavis-crane-band",
    startsAt: "2026-12-19T20:00:00-06:00",
    category: "Concert",
    venue: "Old Mill Music Hall",
    price: "$15",
    memberPrice: "$10",
  },
  {
    // Members only: visitors don't see where it is.
    title: "Members’ Holiday Social",
    href: "/events/members-holiday-social",
    startsAt: "2026-12-20T17:00:00-06:00",
    category: "Society",
    membersOnly: true,
    price: "Free",
  },
  {
    title: "Slide Guitar Workshop with Lou Tate",
    href: "/events/slide-guitar-workshop",
    startsAt: "2027-01-09T13:00:00-06:00",
    category: "Workshop",
    venue: "Hilltop Guitar Works",
    price: "$20",
    memberPrice: "$15",
  },
];

type SamplePost = {
  title: string;
  href: string;
  publishedAt: string;
  category: string;
  tone: PlaceholderPhotoTone;
} & ({ locked?: false; excerpt: string } | { locked: true });

export const LATEST_POSTS: SamplePost[] = [
  {
    title: "Band Spotlight: The Muddy Ridge Trio",
    href: PREVIEW_PAGES.spotlight.href,
    publishedAt: "2026-11-18T12:00:00-06:00",
    category: "Band Spotlight",
    excerpt: "Three friends, one beat-up Silvertone, and a sound that’s pure hill-country.",
    tone: "rust",
  },
  {
    // Members only: visitors see the headline and a blurred stand-in, never the summary.
    title: "Board Notes: November",
    href: "/blog/board-notes-november",
    publishedAt: "2026-11-12T12:00:00-06:00",
    category: "Society News",
    locked: true,
    tone: "brass",
  },
  {
    title: "Fall Fest Recap: 1,200 Fans and a Whole Lot of Slide Guitar",
    href: "/blog/fall-fest-recap",
    publishedAt: "2026-10-24T12:00:00-05:00",
    category: "Recap",
    excerpt: "Two days, eleven bands, and one very muddy field. Here are the highlights.",
    tone: "night",
  },
];

export const FEATURED_SPONSOR = {
  name: "Riverbend Brewing Co.",
  href: "https://example.com/",
  blurb:
    "Riverbend has hosted our Tuesday Open Jam for six years, and keeps a stage open for local players every week.",
};

export const SPONSORS = [
  { name: "Riverbend Brewing Co." },
  { name: "Old Mill Music Hall" },
  { name: "Hilltop Guitar Works" },
  { name: "Ozark Community Bank" },
  { name: "Community Radio 90.1" },
];

/** The lowest yearly dues (Individual, docs/spec/board-decisions.md §1). */
export const LOWEST_DUES = "$30";

export const DIRECTORY = {
  title: "Venue & Booking Directory",
  intro: "Venues that book blues in the region, who to contact, and what to expect.",
  columns: ["Venue", "Booking contact", "Capacity", "Pays", "Notes"],
  /** The column only Band, Business and Sponsor members see. */
  contactColumn: 1,
  rows: [
    [
      "Old Mill Music Hall",
      "Sam Ortega · booking@example.com",
      "350",
      "Door split or guarantee",
      "Sound tech provided",
    ],
    [
      "The Riverside Tap",
      "Casey Dunn · 555-0142",
      "120",
      "Guarantee plus tips",
      "Backline drum kit",
    ],
    [
      "Riverbend Brewing Co.",
      "Events desk · events@example.com",
      "180",
      "Flat fee",
      "Patio stage April to October",
    ],
    [
      "Courthouse Square Stage",
      "City Parks Department",
      "Open air",
      "Grant-funded",
      "Summer series only",
    ],
    [
      "The Bluebird Lounge",
      "Ana Ruiz · 555-0177",
      "80",
      "Tips plus bar tab",
      "Acoustic and duos only",
    ],
  ],
};
