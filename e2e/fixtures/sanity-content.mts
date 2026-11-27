/**
 * Synthetic Sanity documents that the e2e stand-in for Sanity serves (../support/sanity-stand-in.mts):
 * blog posts for each audience, one scheduled post and one draft, pages in each template and for
 * each audience, and the secret for shared preview links. Each members-only field holds a marker,
 * so a test can check that no response reaches a viewer who may not see it. All but the post for
 * Band and up are marked for the monthly email digest.
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
} as const;

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
  ...PAGE_DOCUMENTS,
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
