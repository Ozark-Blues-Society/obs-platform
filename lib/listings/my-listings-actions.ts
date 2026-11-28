"use server";

import { refresh } from "next/cache";
import { requireUser } from "@/lib/auth/user";
import { MY_LISTINGS_PATH } from "@/lib/site/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { getMyListing } from "./my-listings";
import {
  MY_LISTINGS_MESSAGES,
  notRenewedMessage,
  removedMessage,
  renewedMessage,
  type MyListingResult,
} from "./my-listings-state";
import { getPoster, postingAccess } from "./poster";

// My listings' Server Functions (backlog K-4). Anyone can call a Server Function, so each checks the
// session itself, and acts only on the signed-in member's own listings.
//
// Renewing: members can't write a listing's status or dates (column privileges and the guard
// trigger in supabase/migrations/20261126210923_listings.sql), so renewListing calls the database
// function renew_listing() with the service role, passing the member's id from their session.
// The function checks the rest itself (whose listing, a current membership, the 5-day window) and
// changes nothing when a check fails (supabase/migrations/20261127223233_listing_renewal.sql).
//
// Removing runs as the member: row level security lets posters delete their own listings at any
// time, and the Storage policies let them remove a photo once no listing shows it.

const BUCKET = "listing-photos";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** The listing id the request names, or null for anything My listings never sends. */
function parseId(input: { id?: unknown }): string | null {
  return typeof input.id === "string" && UUID.test(input.id) ? input.id : null;
}

const failed = (message: string): MyListingResult => ({ status: "error", message });

/** Renews the member's listing for another 60 days, if it can be renewed now. */
export async function renewListing(input: { id?: unknown }): Promise<MyListingResult> {
  const user = await requireUser(MY_LISTINGS_PATH);
  // My listings never sends anything else, so someone made the request up.
  const id = parseId(input);
  if (!id) return failed(MY_LISTINGS_MESSAGES.unavailable);
  try {
    const { data, error } = await createAdminClient().rpc("renew_listing", {
      p_listing_id: id,
      p_profile_id: user.id,
    });
    // My listings is out of date whatever happened, so show it afresh.
    refresh();
    if (error) {
      console.error("Renewing a listing failed:", error.code, error.message);
      return failed(MY_LISTINGS_MESSAGES.unavailable);
    }
    const renewed = (data as { title: string; expires_at: string }[] | null)?.[0];
    if (renewed) {
      return { status: "renewed", message: renewedMessage(renewed.title, renewed.expires_at) };
    }
    return failed(await whyNotRenewed(user.id, id));
  } catch (cause) {
    console.error("Renewing a listing failed:", cause);
    return failed(MY_LISTINGS_MESSAGES.unavailable);
  }
}

/** What to tell the member when renew_listing() renewed nothing. */
async function whyNotRenewed(userId: string, id: string): Promise<string> {
  const now = new Date();
  const [listing, poster] = await Promise.all([getMyListing(userId, id), getPoster(userId)]);
  const access = postingAccess(poster, now);
  const membership = access.allowed ? "current" : access.reason === "renew" ? "renew" : "join";
  return notRenewedMessage(listing, membership, now);
}

/** Deletes the member's listing, and its photo. */
export async function removeListing(input: { id?: unknown }): Promise<MyListingResult> {
  const user = await requireUser(MY_LISTINGS_PATH);
  const id = parseId(input);
  if (!id) return failed(MY_LISTINGS_MESSAGES.unavailable);
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("listings")
      .delete()
      .eq("id", id)
      .eq("profile_id", user.id)
      .select("title, photo_path")
      .maybeSingle();
    refresh();
    if (error) {
      console.error("Removing a listing failed:", error.code, error.message);
      return failed(MY_LISTINGS_MESSAGES.unavailable);
    }
    if (!data) return failed(MY_LISTINGS_MESSAGES.gone);
    const removed = data as { title: string; photo_path: string | null };
    if (removed.photo_path) {
      // No listing shows the photo now, so its uploader may remove it. If that fails, the photo
      // stays in the bucket, seen by nobody but them.
      const { error: photoError } = await supabase.storage
        .from(BUCKET)
        .remove([removed.photo_path]);
      if (photoError) console.error("Removing a listing's photo failed:", photoError.message);
    }
    return { status: "removed", message: removedMessage(removed.title) };
  } catch (cause) {
    console.error("Removing a listing failed:", cause);
    return failed(MY_LISTINGS_MESSAGES.unavailable);
  }
}
