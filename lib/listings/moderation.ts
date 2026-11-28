import "server-only";
import ListingApprovedEmail from "@/emails/listing-approved";
import ListingRejectedEmail from "@/emails/listing-rejected";
import { renderEmail } from "@/emails/render";
import { getRoles } from "@/lib/auth/user";
import { getEmailSender } from "@/lib/email/send";
import { serverEnv } from "@/lib/env/server";
import { siteUrl } from "@/lib/site/site-url";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { ContactPreference, ListingCategory } from "./listing-state";
import type { PendingListing } from "./moderation-state";
import { posterNames } from "./poster-names";

// Reads and emails for the moderation queue (backlog K-2, A-3) and its Server Functions. Not a
// Server Function file: anyone can call those, so keep this one free of "use server".
//
// The listings and their photos are read as the signed-in moderator, whom row level security and
// the Storage policies let see every listing (supabase/migrations/20261126210923_listings.sql).
// Moderators can't read profiles, so the posters' names and email addresses come through the
// service role, and only after the caller's role has been checked.

const BUCKET = "listing-photos";

/** How long the queue's links to the photos work: long enough to review a full queue. */
const PHOTO_LINK_SECONDS = 60 * 60;

/** Whether the signed-in member `userId` moderates the classifieds: moderators and admins. */
export async function moderatesListings(userId: string): Promise<boolean> {
  const roles = await getRoles(userId);
  return roles.includes("moderator") || roles.includes("admin");
}

type PendingRow = {
  id: string;
  revision: number;
  profile_id: string;
  category: ListingCategory;
  title: string;
  body: string;
  price: number | null;
  photo_path: string | null;
  photo_version: string | null;
  contact_pref: ContactPreference;
  created_at: string;
};

/**
 * The listings waiting for a moderator, oldest first. Call it only for a moderator or an
 * administrator (moderatesListings). Throws if the listings can't be read.
 */
export async function listPendingListings(): Promise<PendingListing[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("listings")
    .select(
      "id, revision, profile_id, category, title, body, price, photo_path, photo_version, contact_pref, created_at",
    )
    .eq("status", "pending")
    .order("created_at", { ascending: true })
    .order("id", { ascending: true });
  if (error) throw new Error(`Reading the pending listings failed: ${error.code} ${error.message}`);
  const rows = (data ?? []) as PendingRow[];

  const storage = supabase.storage.from(BUCKET);
  // Signed for the version the listing keeps, so the moderator sees exactly what visitors will:
  // a photo replaced in Storage since doesn't sign (and never shows to visitors either).
  const photo = async (row: PendingRow): Promise<PendingListing["photo"]> => {
    if (!row.photo_path) return null;
    const { data: signed, error: signError } = await storage.createSignedUrl(
      row.photo_path,
      PHOTO_LINK_SECONDS,
      { versionId: row.photo_version ?? undefined },
    );
    return signError || !signed
      ? { status: "missing" }
      : { status: "shown", url: signed.signedUrl };
  };
  const [names, photos] = await Promise.all([
    posterNames(rows.map((row) => row.profile_id)),
    Promise.all(rows.map(photo)),
  ]);

  return rows.map((row, index) => ({
    id: row.id,
    revision: row.revision,
    category: row.category,
    title: row.title,
    body: row.body,
    price: row.price,
    contactPref: row.contact_pref,
    submittedAt: row.created_at,
    poster: names.get(row.profile_id) ?? null,
    photo: photos[index],
  }));
}

/** A decision to tell a poster about: the listing as the decision left it. */
export type PosterNotice =
  | { decision: "approved"; listingId: string; profileId: string; title: string; expiresAt: string }
  | {
      decision: "rejected";
      listingId: string;
      profileId: string;
      title: string;
      revision: number;
      reason: string;
    };

/**
 * Emails the poster the decision: the listing-approved or listing-rejected email, through the
 * site's one sender (lib/email/send.ts: Mailpit locally and in tests, never real people). Resolves
 * with whether the email went out; a failure is logged, without the poster's address.
 */
export async function emailPoster(notice: PosterNotice): Promise<boolean> {
  try {
    const { data, error } = await createAdminClient()
      .from("profiles")
      .select("email, first_name")
      .eq("id", notice.profileId)
      .maybeSingle();
    if (error) throw new Error(`reading the poster failed: ${error.code} ${error.message}`);
    const poster = (data ?? {}) as { email?: unknown; first_name?: unknown };
    if (typeof poster.email !== "string" || !poster.email) {
      throw new Error("the poster's profile has no email address");
    }
    const firstName = typeof poster.first_name === "string" ? poster.first_name : null;

    const rendered =
      notice.decision === "approved"
        ? await renderEmail(ListingApprovedEmail, {
            siteUrl: siteUrl(),
            firstName,
            listingTitle: notice.title,
            expiresAt: notice.expiresAt,
          })
        : await renderEmail(ListingRejectedEmail, {
            siteUrl: siteUrl(),
            firstName,
            listingTitle: notice.title,
            reason: notice.reason,
          });
    // One email per decision: an approval has its own expiry, and each rejection is of a revision.
    const idempotencyKey =
      notice.decision === "approved"
        ? `listing_approved/${notice.listingId}/${notice.expiresAt}`
        : `listing_rejected/${notice.listingId}/${notice.revision}`;
    const send = getEmailSender(serverEnv("EMAIL_FROM", "RESEND_API_KEY", "MAILPIT_URL"));
    await send({ to: poster.email, ...rendered, idempotencyKey });
    return true;
  } catch (cause) {
    const reason = cause instanceof Error ? cause.message : String(cause);
    console.error(`Emailing the poster of listing ${notice.listingId} failed: ${reason}`);
    return false;
  }
}
