// The venue directory (backlog M-9): venues that book blues, for members with an active
// membership, with each venue's booking contact for Band, Business and Sponsor members only
// (board-decisions §1). Its rows are Directory entries, which sit in the private dataset with the
// rest of the members-only content and are read here, on the server, with the read token
// (decision 0001).
//
// As for pages, posts and events (./index.ts), who sees what is decided twice. The query returns
// no entries unless $memberLevel is an active member's level, and it selects the booking contact
// only for the levels in BOOKING_CONTACT_LEVELS, so a contact never leaves Sanity for anyone else.
// Then this module checks the answer again before handing it on. A request from someone without
// an active membership doesn't reach Sanity at all.
//
// Read Directory entries only here: never with `...`, and never through another document's query
// (a page's blocks, an event's venue). Either would skip these rules. Event pages and the
// calendar dereference the venue, which holds nothing members-only (sanity/schemas/documents/
// venue.ts).
import "server-only";
import { stegaClean } from "next-sanity";
import { connection } from "next/server";
import {
  activeLevel,
  BOOKING_CONTACT_LEVELS,
  checkAccess,
  seesBookingContacts,
  type Access,
} from "@/lib/members/access";
import { getViewer } from "@/lib/members/viewer";
import type { MembershipLevel } from "@/sanity/schemas/options";
import { isConfigured } from "../env";
import { getDynamicFetchOptions, sanityFetch, type DynamicFetchOptions } from "../live";

/**
 * Directory entries with a venue, as an active member at $memberLevel may see them: none for
 * null, and the booking contact only for the levels that see it. No server code, so tests run it
 * with groq-js.
 */
export const DIRECTORY_QUERY = `*[_type == "directoryEntry" && $memberLevel != null && defined(venue)]{
  _id,
  "venue": venue->{ name },
  capacity,
  pay,
  notes,
  "bookingContact": select($memberLevel in ${JSON.stringify(BOOKING_CONTACT_LEVELS)} => bookingContact{ name, email, phone })
}`;

export type DirectoryContact = { name?: string; email?: string; phone?: string };

/** A row of the directory. Text keeps its edit markers in a preview. */
export type DirectoryEntry = {
  id: string;
  /** The venue's name. */
  venue: string;
  capacity?: string;
  pay?: string;
  notes?: string;
  /** Who books the music: only for Band, Business and Sponsor members, and only if it's filled in. */
  contact?: DirectoryContact;
};

export type VenueDirectory = {
  /** Whether the viewer may see the rows, and if not, why: what the lock should say. */
  access: Access;
  /** Whether the rows carry booking contacts: for Band, Business and Sponsor members. */
  contacts: boolean;
  /** The rows by venue name. Empty unless access.allowed. */
  entries: DirectoryEntry[];
};

type Fields = Record<string, unknown>;

const fields = (value: unknown): Fields | undefined =>
  value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Fields)
    : undefined;
// Text people read keeps a preview's invisible edit markers, so it isn't trimmed: trim() would
// also cut the markers' U+FEFF characters.
const text = (value: unknown): string | undefined =>
  typeof value === "string" && stegaClean(value).trim() !== "" ? value : undefined;

function contactOf(value: unknown): DirectoryContact | undefined {
  const contact = fields(value);
  const name = text(contact?.name);
  const email = text(contact?.email);
  const phone = text(contact?.phone);
  if (!name && !email && !phone) return undefined;
  return { ...(name && { name }), ...(email && { email }), ...(phone && { phone }) };
}

const byName = new Intl.Collator("en", { sensitivity: "base", numeric: true });

/**
 * Turns the query's answer into the directory's rows, by venue name, skipping entries whose venue
 * is missing or has no name (a draft venue, or one that was deleted). Booking contacts stay only
 * when `withContacts`, whatever Sanity sent.
 */
export function parseDirectory(data: unknown, withContacts: boolean): DirectoryEntry[] {
  const entries = (Array.isArray(data) ? data : []).flatMap((item): DirectoryEntry[] => {
    const entry = fields(item);
    const id = typeof entry?._id === "string" ? stegaClean(entry._id) : "";
    const venue = text(fields(entry?.venue)?.name);
    if (!id || !venue) return [];
    const contact = withContacts ? contactOf(entry?.bookingContact) : undefined;
    return [
      {
        id,
        venue,
        capacity: text(entry?.capacity),
        pay: text(entry?.pay),
        notes: text(entry?.notes),
        ...(contact && { contact }),
      },
    ];
  });
  return entries.sort((a, b) => byName.compare(stegaClean(a.venue), stegaClean(b.venue)));
}

/** "Members" as a page's visibility: an active membership at any level. */
const MEMBERS = { audience: "members" };

/**
 * The venue directory as this viewer may see it: no rows without an active membership (with the
 * reason, for the lock), and booking contacts only for Band, Business and Sponsor members. It
 * reads the session, so call it inside a <Suspense> boundary.
 */
export async function listDirectory(): Promise<VenueDirectory> {
  // At request time only: the rows never end up in a prerendered page.
  await connection();
  const viewer = await getViewer();
  const now = new Date();
  // The same rule as a members-only page: allowed exactly when there's an active level, and
  // otherwise the reason (sign in, join or renew) for the lock.
  const access = checkAccess(MEMBERS, viewer, now);
  const level = activeLevel(viewer, now);
  if (level === null) return { access, contacts: false, entries: [] };

  const contacts = seesBookingContacts(level);
  if (!isConfigured) return { access, contacts, entries: [] };
  const data = await fetchForLevel(level, await getDynamicFetchOptions());
  return { access, contacts, entries: parseDirectory(data, contacts) };
}

// Not exported, so nothing can ask for another level's rows: listDirectory works out the level
// from the session. Its arguments are the cache key, so each level gets its own entry, never a
// person. Sanity Live refreshes the entries when editors publish.
async function fetchForLevel(
  memberLevel: MembershipLevel,
  { perspective, stega }: DynamicFetchOptions,
): Promise<unknown> {
  "use cache";
  const { data } = await sanityFetch({
    query: DIRECTORY_QUERY,
    params: { memberLevel },
    perspective,
    stega,
  });
  return data;
}
