/**
 * Synthetic Sanity documents that the e2e stand-in for Sanity serves (../support/sanity-stand-in.mts):
 * blog posts for each audience, one scheduled post and one draft. Each members-only field holds a
 * marker, so a test can check that no response reaches a viewer who may not see it.
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
  { publishedInDays = -3, secret = "" }: { publishedInDays?: number; secret?: string } = {},
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
    publishedAt: daysFromNow(publishedInDays),
  };
}

export const POSTS = {
  public: { slug: "e2e-open-post", title: "E2E open post" },
  members: { slug: "e2e-members-post", title: "E2E members post" },
  bandUp: { slug: "e2e-band-post", title: "E2E post for Band and up" },
  scheduled: { slug: "e2e-scheduled-post", title: "E2E scheduled post" },
} as const;

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
    { secret: MEMBERS_ONLY_MARKER },
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
];
