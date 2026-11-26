"use server";

import { requireUser } from "@/lib/auth/user";
import { NEW_LISTING_PATH } from "@/lib/site/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  LISTING_MESSAGES,
  checkListing,
  checkPhoto,
  isOwnPhotoPath,
  photoPathFor,
  type ListingDraft,
  type PreparePhotoResult,
  type SubmitListingResult,
} from "./listing-state";
import { getPoster, postingAccess, type Poster } from "./poster";

// The "Post a listing" form's Server Functions (backlog K-1). Anyone can call a Server Function, so
// each checks the session and the membership itself. Everything runs as the signed-in member: row
// level security and the Storage policies enforce the same rules
// (supabase/migrations/20261126210923_listings.sql).
//
// A listing with a photo takes three steps, so the photo goes straight from the browser to Storage
// and never through the website's server (hosts limit request sizes):
//   1. preparePhotoUpload: a one-time upload link for a new object in the member's own folder;
//   2. the browser uploads the photo to that link;
//   3. submitListing: checks Storage has the photo, then adds the listing, which waits for a
//      moderator. Until a moderator approves it, only the poster and the moderators see it.

const BUCKET = "listing-photos";

/** Why the poster can't post, in words; null when they can. */
function postingProblem(poster: Poster): string | null {
  const access = postingAccess(poster, new Date());
  if (access.allowed) return null;
  return access.reason === "renew" ? LISTING_MESSAGES.renew : LISTING_MESSAGES.join;
}

/** Step 1: a one-time link to upload a photo of this size and type to, if the member may post. */
export async function preparePhotoUpload(photo: {
  size: number;
  type: string;
}): Promise<PreparePhotoResult> {
  const user = await requireUser(NEW_LISTING_PATH);
  const problem = checkPhoto(photo);
  if (problem) return { status: "error", message: problem };
  try {
    const notAllowed = postingProblem(await getPoster(user.id));
    if (notAllowed) return { status: "error", message: notAllowed };
    const path = photoPathFor(user.id, photo.type);
    if (!path) return { status: "error", message: LISTING_MESSAGES.photoType };
    const supabase = await createClient();
    const { data, error } = await supabase.storage.from(BUCKET).createSignedUploadUrl(path);
    if (error || !data) {
      console.error("Preparing a listing photo upload failed:", error);
      return { status: "error", message: LISTING_MESSAGES.unavailable };
    }
    return { status: "ready", path: data.path, uploadUrl: data.signedUrl };
  } catch (cause) {
    console.error("Preparing a listing photo upload failed:", cause);
    return { status: "error", message: LISTING_MESSAGES.unavailable };
  }
}

/** Step 3 (or the only step, without a photo): adds the listing, which waits for a moderator. */
export async function submitListing(
  input: ListingDraft & { photoPath: unknown },
): Promise<SubmitListingResult> {
  const user = await requireUser(NEW_LISTING_PATH);
  try {
    const poster = await getPoster(user.id);
    const notAllowed = postingProblem(poster);
    if (notAllowed) return { status: "error", field: null, message: notAllowed };
    const checked = checkListing(input, poster.phone);
    if (!("listing" in checked)) return { status: "error", ...checked };
    const { listing } = checked;

    const photoPath = input.photoPath ?? null;
    if (photoPath !== null && !isOwnPhotoPath(user.id, photoPath)) {
      // The form only sends a path preparePhotoUpload made, so someone made this one up.
      return { status: "error", field: null, message: LISTING_MESSAGES.unavailable };
    }
    const supabase = await createClient();
    const storage = supabase.storage.from(BUCKET);
    if (photoPath) {
      const { data: info, error: infoError } = await storage.info(photoPath);
      if (infoError || !info) {
        return { status: "error", field: "photo", message: LISTING_MESSAGES.photoNotUploaded };
      }
    }

    const { error } = await supabase.from("listings").insert({
      category: listing.category,
      title: listing.title,
      body: listing.body,
      price: listing.price,
      contact_pref: listing.contactPref,
      photo_path: photoPath,
    });
    if (error) {
      console.error("Adding a listing failed:", error.code, error.message);
      // No listing shows the photo, so don't leave it in the bucket. If one does (a repeated
      // request), the Storage policies keep it: nobody removes a photo a listing shows.
      if (photoPath) await storage.remove([photoPath]);
      return { status: "error", field: null, message: LISTING_MESSAGES.unavailable };
    }
    return { status: "submitted", title: listing.title };
  } catch (cause) {
    console.error("Adding a listing failed:", cause);
    return { status: "error", field: null, message: LISTING_MESSAGES.unavailable };
  }
}
