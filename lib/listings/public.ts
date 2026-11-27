import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getCurrentUser, type CurrentUser } from "@/lib/auth/user";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { ContactPreference, ListingCategory } from "./listing-state";
import { posterName } from "./moderation-state";
import { posterNames } from "./poster-names";
import {
  isListingId,
  type ContactDefaults,
  type ListingContact,
  type ListingDetail,
  type PublicListing,
} from "./public-state";

// Reads for the public classifieds (backlog K-3). Not a Server Function file: anyone can call
// those, so keep this one free of "use server".
//
// Listings are read as the person viewing them. Row level security shows visitors live listings
// only, but it also shows members their own and moderators every listing, so each read here asks
// for live ones itself (supabase/migrations/20261126210923_listings.sql). Nobody may read other
// members' profiles, so the posters' names, and the phone number of a poster who asked for calls,
// come through the service role; the number reaches only a signed-in viewer's page (decision 0009).
// No poster's email address is read here: only the contact form's server code reads one, to send
// the message (lib/listings/contact.ts).

const BUCKET = "listing-photos";

/** How long a listing page's link to its photo works. The page is made for each visit. */
const PHOTO_LINK_SECONDS = 60 * 60;

const CARD_COLUMNS = "id, profile_id, category, title, body, price, approved_at";

type CardRow = {
  id: string;
  profile_id: string;
  category: ListingCategory;
  title: string;
  body: string;
  price: number | null;
  approved_at: string;
};

type PageRow = CardRow & {
  photo_path: string | null;
  photo_version: string | null;
  contact_pref: ContactPreference;
};

function publicListing(row: CardRow, poster: string | null): PublicListing {
  return {
    id: row.id,
    category: row.category,
    title: row.title,
    body: row.body,
    price: row.price,
    postedAt: row.approved_at,
    poster,
  };
}

/**
 * The live listings, newest first: those of one category, or all of them. Throws if they can't be
 * read.
 */
export async function listLiveListings(category: ListingCategory | null): Promise<PublicListing[]> {
  const supabase = await createClient();
  let query = supabase
    .from("listings")
    .select(CARD_COLUMNS)
    .eq("status", "live")
    .gt("expires_at", new Date().toISOString());
  if (category) query = query.eq("category", category);
  const { data, error } = await query
    .order("approved_at", { ascending: false })
    .order("id", { ascending: true });
  if (error) throw new Error(`Reading the live listings failed: ${error.code} ${error.message}`);
  const rows = (data ?? []) as CardRow[];
  const names = await posterNames(rows.map((row) => row.profile_id));
  return rows.map((row) => publicListing(row, names.get(row.profile_id) ?? null));
}

/**
 * The live listing `id` for its own page, with its photo and how the viewer can reach the poster;
 * null when no live listing has that id. Throws if it can't be read.
 */
export async function getLiveListing(id: string): Promise<ListingDetail | null> {
  if (!isListingId(id)) return null;
  const [supabase, viewer] = await Promise.all([createClient(), getCurrentUser()]);
  const { data, error } = await supabase
    .from("listings")
    .select(`${CARD_COLUMNS}, photo_path, photo_version, contact_pref`)
    .eq("id", id)
    .eq("status", "live")
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();
  if (error) throw new Error(`Reading listing ${id} failed: ${error.code} ${error.message}`);
  if (!data) return null;
  const row = data as PageRow;

  const own = viewer !== null && viewer.id === row.profile_id;
  // The number is read to know whether there is one; contactFor gives it to signed-in viewers only.
  const wantsPhone = row.contact_pref === "phone" && !own;
  const [poster, photo, defaults] = await Promise.all([
    readPoster(row.profile_id, wantsPhone),
    signPhoto(supabase, row),
    contactDefaults(supabase, own ? null : viewer),
  ]);
  return {
    ...publicListing(row, poster.name),
    photo,
    contact: contactFor(row, viewer, poster.phone, defaults),
  };
}

/** How `viewer` can reach the poster of `row`: see ListingContact. */
export function contactFor(
  row: { profile_id: string; contact_pref: ContactPreference },
  viewer: CurrentUser | null,
  phone: string | null,
  defaults: ContactDefaults,
): ListingContact {
  if (viewer?.id === row.profile_id) return { kind: "own" };
  // A poster may take the number off their profile after posting: then the site passes messages on.
  const callable = row.contact_pref === "phone" && phone !== null;
  if (callable && viewer) return { kind: "phone", phone };
  return { kind: "message", phoneForMembers: callable, defaults };
}

/**
 * What the contact form starts with: a signed-in viewer's own name, from their profile, which row
 * level security lets them read, and their sign-in address. Empty for a visitor, or when the
 * profile can't be read.
 */
async function contactDefaults(
  supabase: SupabaseClient,
  viewer: CurrentUser | null,
): Promise<ContactDefaults> {
  if (!viewer) return { name: "", email: "" };
  const { data } = await supabase
    .from("profiles")
    .select("first_name, last_name")
    .eq("id", viewer.id)
    .maybeSingle();
  const profile = (data ?? {}) as { first_name?: unknown; last_name?: unknown };
  const name = [profile.first_name, profile.last_name]
    .map((part) => (typeof part === "string" ? part.trim() : ""))
    .filter(Boolean)
    .join(" ");
  return { name, email: viewer.email ?? "" };
}

/** The number on a profile, or null when it has none. */
export function profilePhone(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

/**
 * The poster's name for the page, and their phone number when `withPhone`. The page works without
 * them, so a failure is logged and gives neither: the viewer is offered a message instead.
 */
async function readPoster(
  profileId: string,
  withPhone: boolean,
): Promise<{ name: string | null; phone: string | null }> {
  try {
    const { data, error } = await createAdminClient()
      .from("profiles")
      .select(withPhone ? "first_name, last_name, phone" : "first_name, last_name")
      .eq("id", profileId)
      .maybeSingle();
    if (error) throw new Error(`${error.code} ${error.message}`);
    const profile = (data ?? {}) as { first_name?: unknown; last_name?: unknown; phone?: unknown };
    return {
      name: posterName(profile.first_name, profile.last_name),
      phone: withPhone ? profilePhone(profile.phone) : null,
    };
  } catch (cause) {
    console.error("Reading a listing's poster failed:", cause);
    return { name: null, phone: null };
  }
}

/**
 * A short-lived link to the photo as the moderator approved it: signed for the version the listing
 * keeps, so a photo replaced in Storage since doesn't sign, and never shows (K-1's fix round).
 */
async function signPhoto(supabase: SupabaseClient, row: PageRow): Promise<ListingDetail["photo"]> {
  if (!row.photo_path) return null;
  if (!row.photo_version) return { status: "missing" };
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(row.photo_path, PHOTO_LINK_SECONDS, { versionId: row.photo_version });
  return error || !data ? { status: "missing" } : { status: "shown", url: data.signedUrl };
}
