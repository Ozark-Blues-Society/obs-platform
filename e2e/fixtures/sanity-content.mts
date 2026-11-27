/**
 * Synthetic Sanity documents that the e2e stand-in for Sanity serves (../support/sanity-stand-in.mts):
 * blog posts for each audience, one scheduled post and one draft, pages in each template and for
 * each audience, sponsors for the sponsor logos blocks, venues and their Directory entries for the
 * venue directory, and the secret for shared preview links. Each members-only field holds a
 * marker, so a test can check that no response reaches a viewer who may not see it. All but the
 * post for Band and up are marked for the monthly email digest.
 *
 * Nothing here is in a menu and there are no Site settings, so the header and footer stay the
 * built-in ones that other tests expect.
 */

/** In every members-only field. A response to someone who may not see the post must not hold it. */
export const MEMBERS_ONLY_MARKER = "E2E-MEMBERS-ONLY-7f3a";
/** In the draft's members-only fields: only a preview could show it, and never to a visitor. */
export const DRAFT_MARKER = "E2E-DRAFT-ONLY-2c9d";
/** A members-only file attached to the members' post (the link only; the file isn't created). */
export const MEMBER_FILE_CODE = "00000000-0000-4000-8930-000000000001";
/** A members-only file attached to the members' Directory page (the link only, like the post's). */
export const PAGE_FILE_CODE = "00000000-0000-4000-8930-000000000002";
/** In a block of a type the site doesn't know, which must never show. */
export const UNKNOWN_BLOCK_MARKER = "E2E-UNKNOWN-BLOCK-5e1b";
/** The secret in the Studio's shared preview links (made-up, like everything here). */
export const SHARED_PREVIEW_SECRET = "e2e-shared-preview-secret-4d8b";
/** In the venue directory's details (capacity, pay, notes): for members with an active membership. */
export const DIRECTORY_MARKER = "E2E-DIRECTORY-ONLY-8d2f";
/** In the venue directory's booking contacts: for Band, Business and Sponsor members only. */
export const BOOKING_CONTACT_MARKER = "E2E-BOOKING-CONTACT-3b6e";

const DAY = 24 * 60 * 60 * 1000;
const daysFromNow = (days: number) => new Date(Date.now() + days * DAY).toISOString();

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

type Visibility = { _type: "visibility"; audience: string; levels?: string[] };

function post(
  slug: string,
  title: string,
  visibility: Visibility,
  {
    publishedInDays = -3,
    secret = "",
    inDigest = true,
  }: { publishedInDays?: number; secret?: string; inDigest?: boolean } = {},
) {
  return {
    _id: `post-${slug}`,
    _type: "post",
    _createdAt: daysFromNow(-10),
    _updatedAt: daysFromNow(-1),
    _rev: "e2e",
    title,
    slug: { _type: "slug", current: slug },
    category: "society-news",
    excerpt: `The summary of ${title}. ${secret}`.trim(),
    body: body(`The post ${title} in full. ${secret}`.trim()),
    visibility,
    includeInDigest: inDigest,
    publishedAt: daysFromNow(publishedInDays),
  };
}

export const POSTS = {
  public: { slug: "e2e-open-post", title: "E2E open post" },
  members: { slug: "e2e-members-post", title: "E2E members post" },
  bandUp: { slug: "e2e-band-post", title: "E2E post for Band and up" },
  scheduled: { slug: "e2e-scheduled-post", title: "E2E scheduled post" },
  recap: { slug: "e2e-recap-post", title: "E2E recap post" },
  education: { slug: "e2e-education-post", title: "E2E education post" },
} as const;

/** The author of the recap post, from People. */
export const AUTHOR = {
  id: "person-e2e-author",
  name: "E2E Dee Harmon",
  role: "E2E volunteer coordinator",
  bio: "E2E bio: twelve years at the door table.",
} as const;

export const PAGES = {
  standard: { slug: "e2e-standard-page", title: "E2E standard page" },
  spotlight: {
    slug: "e2e-spotlight-page",
    title: "E2E spotlight page",
    hero: "E2E spotlight hero",
  },
  members: { slug: "e2e-members-directory", title: "E2E members directory" },
  bandUp: { slug: "e2e-band-page", title: "E2E page for Band and up", hero: "E2E band hero" },
  // Open to everyone, with the venue directory, whose rows are for members whatever the page.
  venues: { slug: "e2e-venue-directory", title: "E2E venue directory" },
} as const;

/** The venue directory: three venues with Directory entries, one entry not finished yet. */
export const DIRECTORY = {
  heading: "E2E directory",
  venues: {
    jukeJoint: "E2E Juke Joint",
    riverbend: "E2E Riverbend Hall",
    courthouse: "E2E Courthouse Stage",
  },
  /** The Juke Joint's booking contact. */
  contact: {
    name: `E2E booker ${BOOKING_CONTACT_MARKER}`,
    email: "e2e.booker@example.com",
    phone: "(479) 555-0142",
  },
  /** Riverbend Hall's booking contact: a desk with an email address only. */
  desk: { name: "E2E events desk", email: "e2e.events@example.com" },
  /** In the entry that has no venue yet, which must never show. */
  unfinished: "E2E-UNFINISHED-ENTRY-6a1c",
} as const;

/** Sponsors: two current ones (one without a logo) and one whose sponsorship has ended. */
export const SPONSORS = {
  current: {
    id: "sponsor-e2e-riverbend",
    name: "E2E Riverbend Brewing",
    logoAlt: "E2E Riverbend logo",
    website: "https://riverbend.example.com",
    // The featured sponsor in the spotlight on the Sponsors page and the home page (backlog P-4).
    blurb: "E2E Riverbend hosts the Tuesday jam.",
  },
  noLogo: { id: "sponsor-e2e-hilltop", name: "E2E Hilltop Guitar Works" },
  ended: { id: "sponsor-e2e-gone", name: "E2E Gone Diner" },
} as const;

/**
 * More for the Sponsors page (backlog P-4): a second tier, which comes after the first by its order
 * though not by its name; two more featured sponsors, neither of which may be in the spotlight; and
 * a name long enough to wrap on a phone.
 */
export const SPONSORS_PAGE = {
  /** The fixtures' first tier: logos. */
  tier: { name: "E2E Sponsor", price: "$500 a year", benefit: "E2E logo on the Sponsors page" },
  /** The second tier: names only, even for a sponsor with a logo. */
  friendTier: { name: "E2E Friend", benefit: "E2E name on the Sponsors page" },
  /** Featured too, but changed before Riverbend was. */
  featuredBefore: {
    id: "sponsor-e2e-old-mill",
    name: "E2E Old Mill Hall",
    blurb: "E2E-OLDER-SPOTLIGHT-3b7e",
  },
  /** Featured and changed last, but its sponsorship has ended. */
  featuredEnded: {
    id: "sponsor-e2e-closed",
    name: "E2E Closed Cafe",
    blurb: "E2E-ENDED-SPOTLIGHT-8d2f",
  },
  friend: {
    id: "sponsor-e2e-second-spin",
    name: "E2E Second Spin Records",
    logoAlt: "E2E Second Spin logo",
    website: "https://secondspin.example.com",
  },
  longName: {
    id: "sponsor-e2e-long-name",
    name: "E2E Ozark Mountain Vintage Guitar, Amplifier and Record Repair Workshop",
  },
} as const;

/** A date `days` from today, as Sanity stores date fields. */
const dateFromNow = (days: number) => daysFromNow(days).slice(0, 10);

/** A photo in the Studio: an asset id names its file. Tests refuse requests to Sanity's CDN. */
function photo(name: string, alt: string) {
  return {
    _type: "image",
    asset: { _type: "reference", _ref: `image-${name}-1600x900-jpg` },
    alt,
  };
}

/** A page, in none of the menus. */
function page(
  slug: string,
  title: string,
  visibility: Visibility,
  template: string,
  blocks: object[],
  extra: object = {},
) {
  return {
    _id: `page-${slug}`,
    _type: "page",
    _createdAt: daysFromNow(-10),
    _updatedAt: daysFromNow(-1),
    _rev: "e2e",
    title,
    slug: { _type: "slug", current: slug },
    template,
    visibility,
    menuPlacement: "none",
    blocks,
    ...extra,
  };
}

const PAGE_DOCUMENTS = [
  // Everyone: one of every block that needs nothing else, and one of a type the site doesn't know.
  page(
    PAGES.standard.slug,
    PAGES.standard.title,
    { _type: "visibility", audience: "everyone" },
    "standard",
    [
      {
        _type: "textBlock",
        _key: "text",
        body: [
          {
            _type: "block",
            _key: "h",
            style: "h2",
            markDefs: [],
            children: [{ _type: "span", _key: "h1", text: "E2E heading in the text", marks: [] }],
          },
          {
            _type: "block",
            _key: "p",
            style: "normal",
            markDefs: [{ _type: "link", _key: "l1", href: "/events" }],
            children: [
              { _type: "span", _key: "p1", text: "Read on, or see ", marks: [] },
              { _type: "span", _key: "p2", text: "the events calendar", marks: ["l1"] },
              { _type: "span", _key: "p3", text: ".", marks: [] },
            ],
          },
        ],
      },
      {
        _type: "imageBlock",
        _key: "photo",
        image: photo("e2eStagePhoto1", "E2E band on stage"),
        caption: "E2E photo caption",
      },
      {
        _type: "videoBlock",
        _key: "video",
        url: "https://youtu.be/dQw4w9WgXcQ",
        title: "E2E video",
        caption: "E2E video caption",
      },
      {
        _type: "tableBlock",
        _key: "table",
        heading: "E2E venues",
        source: "custom",
        columns: ["Venue", "Capacity", "Notes"],
        rows: [
          { _key: "r1", cells: ["E2E Old Mill Music Hall", "350", "Sunday afternoon shows"] },
          { _key: "r2", cells: ["E2E Riverside Tap", "120", "Friday jam, sign up at the door"] },
        ],
      },
      {
        _type: "buttonBlock",
        _key: "button",
        label: "E2E read the open post",
        link: {
          _type: "link",
          internal: { _type: "reference", _ref: `post-${POSTS.public.slug}` },
        },
      },
      { _type: "quoteBlock", _key: "quote", quote: "E2E pull quote", attribution: "E2E player" },
      // Every current sponsor.
      { _type: "sponsorStripBlock", _key: "sponsors", heading: "E2E sponsors" },
      { _type: "e2eCarouselBlock", _key: "unknown", heading: UNKNOWN_BLOCK_MARKER },
    ],
    { intro: "E2E intro for the standard page." },
  ),
  // Everyone: a Band Spotlight that opens with its hero.
  page(
    PAGES.spotlight.slug,
    PAGES.spotlight.title,
    { _type: "visibility", audience: "everyone" },
    "spotlight",
    [
      {
        _type: "heroBlock",
        _key: "hero",
        heading: PAGES.spotlight.hero,
        text: "E2E hero text",
        image: photo("e2eHeroPhoto1", "E2E hero photo"),
        button: {
          _type: "buttonBlock",
          label: "E2E hero button",
          link: { _type: "link", href: "/events" },
        },
      },
      { _type: "quoteBlock", _key: "quote", quote: "E2E spotlight quote" },
      // Two picked sponsors, one of them past its last day.
      {
        _type: "sponsorStripBlock",
        _key: "sponsors",
        heading: "E2E picked sponsors",
        sponsors: [
          { _type: "reference", _key: "s1", _ref: SPONSORS.ended.id },
          { _type: "reference", _key: "s2", _ref: SPONSORS.noLogo.id },
        ],
      },
    ],
  ),
  // Members only: a Directory page with a searchable table and a file. The intro is public.
  page(
    PAGES.members.slug,
    PAGES.members.title,
    { _type: "visibility", audience: "members" },
    "directory",
    [
      {
        _type: "textBlock",
        _key: "text",
        body: body(`E2E members-only text. ${MEMBERS_ONLY_MARKER}`),
      },
      {
        _type: "tableBlock",
        _key: "table",
        heading: "E2E booking venues",
        source: "custom",
        columns: ["Venue", "Contact"],
        rows: [
          { _key: "r1", cells: ["E2E Bluebird Lounge", `E2E booker ${MEMBERS_ONLY_MARKER}`] },
          { _key: "r2", cells: ["E2E Old Mill Music Hall", "E2E front desk"] },
        ],
      },
    ],
    {
      intro: "E2E intro for members, public like the title.",
      memberFiles: [
        {
          _type: "memberFile",
          _key: "f1",
          title: "E2E booking guide (PDF)",
          fileId: PAGE_FILE_CODE,
        },
      ],
    },
  ),
  // Band, Business and Sponsor members: a Band Spotlight whose hero is members-only too.
  page(
    PAGES.bandUp.slug,
    PAGES.bandUp.title,
    { _type: "visibility", audience: "levels", levels: ["band", "business", "sponsor"] },
    "spotlight",
    [
      {
        _type: "heroBlock",
        _key: "hero",
        heading: PAGES.bandUp.hero,
        text: `E2E band hero text. ${MEMBERS_ONLY_MARKER}`,
        image: photo("e2eBandPhoto1", "E2E band photo"),
      },
      { _type: "quoteBlock", _key: "quote", quote: `E2E band quote. ${MEMBERS_ONLY_MARKER}` },
    ],
  ),
];

/** A public venue, as events and the directory point at it. */
function venue(id: string, name: string, address: string) {
  return {
    _id: id,
    _type: "venue",
    _createdAt: daysFromNow(-10),
    _updatedAt: daysFromNow(-1),
    _rev: "e2e",
    name,
    address,
    mapUrl: "https://maps.example.com/e2e",
  };
}

/** A row of the venue directory: members-only details, and the booking contact for Band and up. */
function directoryEntry(id: string, venueId: string | null, fields: object) {
  return {
    _id: id,
    _type: "directoryEntry",
    _createdAt: daysFromNow(-10),
    _updatedAt: daysFromNow(-1),
    _rev: "e2e",
    ...(venueId && { venue: { _type: "reference", _ref: venueId } }),
    ...fields,
  };
}

const DIRECTORY_DOCUMENTS = [
  venue("venue-e2e-juke-joint", DIRECTORY.venues.jukeJoint, "1 E2E Street, Springdale"),
  venue("venue-e2e-riverbend", DIRECTORY.venues.riverbend, "2 E2E Avenue, Rogers"),
  venue("venue-e2e-courthouse", DIRECTORY.venues.courthouse, "3 E2E Square, Bentonville"),
  directoryEntry("directory-entry-e2e-juke-joint", "venue-e2e-juke-joint", {
    capacity: "150",
    pay: `E2E door split ${DIRECTORY_MARKER}`,
    notes: "E2E backline drum kit",
    bookingContact: { _type: "object", ...DIRECTORY.contact },
  }),
  directoryEntry("directory-entry-e2e-riverbend", "venue-e2e-riverbend", {
    capacity: "300",
    notes: `E2E patio stage ${DIRECTORY_MARKER}`,
    bookingContact: { _type: "object", ...DIRECTORY.desk },
  }),
  // No booking contact yet.
  directoryEntry("directory-entry-e2e-courthouse", "venue-e2e-courthouse", {
    capacity: "Open air",
    pay: "E2E grant-funded",
  }),
  // An editor hasn't picked the venue yet.
  directoryEntry("directory-entry-e2e-unfinished", null, {
    notes: DIRECTORY.unfinished,
    bookingContact: { _type: "object", name: `${DIRECTORY.unfinished} ${BOOKING_CONTACT_MARKER}` },
  }),
  // Everyone: a Directory page with the venue directory, and a draft of it for previews.
  page(
    PAGES.venues.slug,
    PAGES.venues.title,
    { _type: "visibility", audience: "everyone" },
    "directory",
    [
      {
        _type: "textBlock",
        _key: "text",
        body: body("E2E text for everyone, above the directory."),
      },
      { _type: "tableBlock", _key: "directory", heading: DIRECTORY.heading, source: "directory" },
    ],
    { intro: "E2E intro for the venue directory." },
  ),
  {
    ...page(
      PAGES.venues.slug,
      `${PAGES.venues.title} (draft)`,
      { _type: "visibility", audience: "everyone" },
      "directory",
      [{ _type: "tableBlock", _key: "directory", heading: DIRECTORY.heading, source: "directory" }],
    ),
    _id: `drafts.page-${PAGES.venues.slug}`,
  },
];

/** A sponsor in the fixtures' one tier. */
function sponsor(id: string, name: string, extra: object = {}) {
  return {
    _id: id,
    _type: "sponsor",
    _createdAt: daysFromNow(-10),
    _updatedAt: daysFromNow(-1),
    _rev: "e2e",
    name,
    tier: { _type: "reference", _ref: "sponsor-tier-e2e" },
    ...extra,
  };
}

const SPONSOR_DOCUMENTS = [
  {
    _id: "sponsor-tier-e2e",
    _type: "sponsorTier",
    _createdAt: daysFromNow(-10),
    _updatedAt: daysFromNow(-10),
    _rev: "e2e",
    name: SPONSORS_PAGE.tier.name,
    sortOrder: 1,
    logoPlacement: "logo",
    pricePerYear: 500,
    benefits: [SPONSORS_PAGE.tier.benefit],
  },
  {
    _id: "sponsor-tier-e2e-friend",
    _type: "sponsorTier",
    _createdAt: daysFromNow(-10),
    _updatedAt: daysFromNow(-10),
    _rev: "e2e",
    name: SPONSORS_PAGE.friendTier.name,
    sortOrder: 2,
    logoPlacement: "name",
    benefits: [SPONSORS_PAGE.friendTier.benefit],
  },
  sponsor(SPONSORS_PAGE.friend.id, SPONSORS_PAGE.friend.name, {
    tier: { _type: "reference", _ref: "sponsor-tier-e2e-friend" },
    website: SPONSORS_PAGE.friend.website,
    logo: photo("e2eSponsorLogo2", SPONSORS_PAGE.friend.logoAlt),
  }),
  sponsor(SPONSORS_PAGE.longName.id, SPONSORS_PAGE.longName.name, {
    tier: { _type: "reference", _ref: "sponsor-tier-e2e-friend" },
  }),
  sponsor(SPONSORS_PAGE.featuredBefore.id, SPONSORS_PAGE.featuredBefore.name, {
    featured: true,
    blurb: SPONSORS_PAGE.featuredBefore.blurb,
    _updatedAt: daysFromNow(-5),
  }),
  sponsor(SPONSORS_PAGE.featuredEnded.id, SPONSORS_PAGE.featuredEnded.name, {
    featured: true,
    blurb: SPONSORS_PAGE.featuredEnded.blurb,
    _updatedAt: daysFromNow(0),
    // Days before today in any time zone, so it has ended on the Society's calendar too.
    endsAt: dateFromNow(-3),
  }),
  sponsor(SPONSORS.current.id, SPONSORS.current.name, {
    website: SPONSORS.current.website,
    logo: photo("e2eSponsorLogo1", SPONSORS.current.logoAlt),
    endsAt: dateFromNow(30),
    featured: true,
    blurb: SPONSORS.current.blurb,
  }),
  sponsor(SPONSORS.noLogo.id, SPONSORS.noLogo.name),
  sponsor(SPONSORS.ended.id, SPONSORS.ended.name, { endsAt: dateFromNow(-30) }),
];

/** A paragraph of formatted text, or a list item with `listItem`. */
function block(key: string, text: string, extra: object = {}) {
  return {
    ...body(text)[0],
    _key: key,
    children: [{ _type: "span", _key: `${key}s`, text, marks: [] }],
    ...extra,
  };
}

/**
 * Two more posts for the blog's own tests (e2e/blog.spec.ts), and the author of one: a recap with a
 * cover photo, an author and formatted text, and an older education post. Neither is marked for the
 * monthly email digest, so the digest's tests don't see them.
 */
const BLOG_DOCUMENTS = [
  {
    _id: AUTHOR.id,
    _type: "person",
    _createdAt: daysFromNow(-10),
    _updatedAt: daysFromNow(-10),
    _rev: "e2e",
    name: AUTHOR.name,
    role: AUTHOR.role,
    bio: AUTHOR.bio,
    photo: photo("e2eAuthorPhoto1", AUTHOR.name),
  },
  // The latest post: a recap with a cover photo, an author and every kind of formatted text.
  {
    ...post(
      POSTS.recap.slug,
      POSTS.recap.title,
      { _type: "visibility", audience: "everyone" },
      { publishedInDays: -1, inDigest: false },
    ),
    category: "recap",
    coverImage: photo("e2eRecapCover1", "E2E recap cover photo"),
    author: { _type: "reference", _ref: AUTHOR.id },
    body: [
      block("p1", `The post ${POSTS.recap.title} in full.`),
      block("h2", "E2E recap highlights", { style: "h2" }),
      block("li1", "E2E first highlight", { listItem: "bullet", level: 1 }),
      block("li2", "E2E second highlight", { listItem: "bullet", level: 1 }),
      {
        ...block("p2", "See the events calendar for more."),
        markDefs: [{ _type: "link", _key: "l1", href: "/events" }],
        children: [
          { _type: "span", _key: "p2a", text: "See ", marks: [] },
          { _type: "span", _key: "p2b", text: "the events calendar", marks: ["l1"] },
          { _type: "span", _key: "p2c", text: " for more.", marks: [] },
        ],
      },
      {
        ...photo("e2eRecapInline1", "E2E photo in the recap"),
        _key: "img",
        caption: "E2E caption",
      },
    ],
  },
  // An older post in another category, with no cover photo and no author.
  {
    ...post(
      POSTS.education.slug,
      POSTS.education.title,
      { _type: "visibility", audience: "everyone" },
      { publishedInDays: -20, inDigest: false },
    ),
    category: "education",
  },
];

export const DOCUMENTS = [
  post(POSTS.public.slug, POSTS.public.title, { _type: "visibility", audience: "everyone" }),
  {
    ...post(
      POSTS.members.slug,
      POSTS.members.title,
      { _type: "visibility", audience: "members" },
      { secret: MEMBERS_ONLY_MARKER },
    ),
    memberFiles: [
      { _type: "memberFile", _key: "f1", title: "E2E minutes (PDF)", fileId: MEMBER_FILE_CODE },
    ],
  },
  post(
    POSTS.bandUp.slug,
    POSTS.bandUp.title,
    { _type: "visibility", audience: "levels", levels: ["band", "business", "sponsor"] },
    { secret: MEMBERS_ONLY_MARKER, inDigest: false },
  ),
  post(
    POSTS.scheduled.slug,
    POSTS.scheduled.title,
    { _type: "visibility", audience: "everyone" },
    { publishedInDays: 5 },
  ),
  // An editor's unpublished changes to the members' post: a preview shows them, to members only.
  {
    ...post(
      POSTS.members.slug,
      `${POSTS.members.title} (draft)`,
      { _type: "visibility", audience: "members" },
      { secret: `${MEMBERS_ONLY_MARKER} ${DRAFT_MARKER}` },
    ),
    _id: `drafts.post-${POSTS.members.slug}`,
  },
  ...BLOG_DOCUMENTS,
  ...PAGE_DOCUMENTS,
  ...SPONSOR_DOCUMENTS,
  ...DIRECTORY_DOCUMENTS,
  // Preview sharing turned on in the Studio, as @sanity/preview-url-secret stores it. A shared link
  // turns on draft mode only if its secret matches this one.
  {
    _id: "sanity-preview-url-secret.share-access",
    _type: "sanity.previewUrlShareAccess",
    _createdAt: daysFromNow(-10),
    _updatedAt: daysFromNow(-10),
    _rev: "e2e",
    secret: SHARED_PREVIEW_SECRET,
    studioUrl: "http://localhost:3000/studio",
  },
];
