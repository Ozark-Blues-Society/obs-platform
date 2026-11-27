import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { ListingCategory } from "./listing-state";
import { LISTING_STATUSES, type ListingStatus, type MyListing } from "./my-listings-state";

// Reads for My listings (backlog K-4) and its Server Functions. Not a Server Function file: anyone
// can call those, so keep this one free of "use server".
//
// The listings are read as the signed-in member. Row level security lets them read all their own
// listings, whatever the status, and other members' live ones only
// (supabase/migrations/20261126210923_listings.sql), so each read asks for the member's own.

const COLUMNS = "id, category, title, price, status, reject_reason, created_at, expires_at";

type Row = {
  id: string;
  category: ListingCategory;
  title: string;
  price: number | null;
  status: string;
  reject_reason: string | null;
  created_at: string;
  expires_at: string | null;
};

const isStatus = (value: string): value is ListingStatus =>
  (LISTING_STATUSES as readonly string[]).includes(value);

function myListing(row: Row): MyListing {
  if (!isStatus(row.status)) throw new Error(`listing ${row.id} has no known status`);
  return {
    id: row.id,
    category: row.category,
    title: row.title,
    price: row.price,
    status: row.status,
    rejectReason: row.reject_reason,
    createdAt: row.created_at,
    expiresAt: row.expires_at,
  };
}

/** The member `userId`'s listings, newest first. Throws if they can't be read. */
export async function listMyListings(userId: string): Promise<MyListing[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("listings")
    .select(COLUMNS)
    .eq("profile_id", userId)
    .order("created_at", { ascending: false })
    .order("id", { ascending: true });
  if (error) {
    throw new Error(`Reading the member's listings failed: ${error.code} ${error.message}`);
  }
  return ((data ?? []) as Row[]).map(myListing);
}

/** The member `userId`'s listing `id`, or null when they have no such listing. Throws on errors. */
export async function getMyListing(userId: string, id: string): Promise<MyListing | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("listings")
    .select(COLUMNS)
    .eq("profile_id", userId)
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(`Reading listing ${id} failed: ${error.code} ${error.message}`);
  return data ? myListing(data as Row) : null;
}
