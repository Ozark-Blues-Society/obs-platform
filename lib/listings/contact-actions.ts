"use server";

import { createHash } from "node:crypto";
import ListingMessageEmail from "@/emails/listing-message";
import { renderEmail } from "@/emails/render";
import { requireUser } from "@/lib/auth/user";
import { getEmailSender } from "@/lib/email/send";
import { serverEnv } from "@/lib/env/server";
import { CLASSIFIEDS_PATH } from "@/lib/site/navigation";
import { siteUrl } from "@/lib/site/site-url";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { posterName } from "./moderation-state";
import { profilePhone } from "./public";
import {
  CONTACT_MESSAGES,
  MESSAGES_PER_DAY,
  checkMessage,
  isListingId,
  listingPath,
  sentMessage,
  type ContactState,
} from "./public-state";

// The form on a listing's page that writes to its poster (backlog K-3). Anyone can call a Server
// Function, so this one checks everything itself: the sender is signed in, the listing is live and
// not their own, and its poster takes messages (not only calls).
//
// The poster's email address is read with the service role, used as the email's To and never
// returned: the answer holds only what the sender typed and the poster's name, which the listing
// shows anyway. The poster answers with Reply, which goes to the sender's sign-in address. The
// database records each message (who, which listing, when: not what they wrote), and refuses one
// past MESSAGES_PER_DAY (supabase/migrations/20261127195203_listing_messages.sql).

type ListingRow = { id: string; profile_id: string; title: string; contact_pref: string };
type PosterRow = { email: unknown; first_name: unknown; last_name: unknown; phone: unknown };

/** "Jordan Ellis" from a profile's names; null when it has neither. */
function fullName(profile: { first_name?: unknown; last_name?: unknown } | null): string | null {
  const name = [profile?.first_name, profile?.last_name]
    .map((part) => (typeof part === "string" ? part.trim() : ""))
    .filter(Boolean)
    .join(" ");
  return name || null;
}

/**
 * Emails the message in the form to the poster of the live listing `listingId`, with the sender's
 * name and address so the poster can reply. A visitor is sent to sign in first.
 */
export async function contactPoster(
  listingId: string,
  _previous: ContactState,
  formData: FormData,
): Promise<ContactState> {
  const user = await requireUser(
    isListingId(listingId) ? listingPath(listingId) : CLASSIFIEDS_PATH,
  );

  const typed = formData.get("message");
  const value = typeof typed === "string" ? typed : "";
  const fail = (message: string, field: "message" | null = null): ContactState => ({
    status: "error",
    field,
    message,
    value,
  });

  // The page never sends anything else, so someone made the request up.
  if (!isListingId(listingId)) return fail(CONTACT_MESSAGES.gone);
  const checked = checkMessage(value);
  if ("problem" in checked) return fail(checked.problem, "message");
  // Every member signs in with an address; without one, there's nowhere for a reply to go.
  if (!user.email) return fail(CONTACT_MESSAGES.unavailable);

  let poster: string | null;
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("listings")
      .select("id, profile_id, title, contact_pref")
      .eq("id", listingId)
      .eq("status", "live")
      .gt("expires_at", new Date().toISOString())
      .maybeSingle();
    if (error) throw new Error(`reading the listing failed: ${error.code} ${error.message}`);
    if (!data) return fail(CONTACT_MESSAGES.gone);
    const listing = data as ListingRow;
    if (listing.profile_id === user.id) return fail(CONTACT_MESSAGES.own);

    const admin = createAdminClient();
    const [posterRead, senderRead] = await Promise.all([
      admin
        .from("profiles")
        .select("email, first_name, last_name, phone")
        .eq("id", listing.profile_id)
        .maybeSingle(),
      // The sender's own profile, which row level security lets them read.
      supabase.from("profiles").select("first_name, last_name").eq("id", user.id).maybeSingle(),
    ]);
    if (posterRead.error) {
      throw new Error(
        `reading the poster failed: ${posterRead.error.code} ${posterRead.error.message}`,
      );
    }
    const posterProfile = (posterRead.data ?? null) as PosterRow | null;
    const to = typeof posterProfile?.email === "string" ? posterProfile.email : "";
    if (!to) throw new Error("the poster's profile has no email address");
    // The same rule as the page (lib/listings/public.ts contactFor): calls when there's a number.
    if (listing.contact_pref === "phone" && profilePhone(posterProfile?.phone)) {
      return fail(CONTACT_MESSAGES.byPhone);
    }
    poster = posterName(posterProfile?.first_name, posterProfile?.last_name);

    const { data: recorded, error: recordError } = await admin.rpc("record_listing_message", {
      p_sender_id: user.id,
      p_listing_id: listing.id,
      p_daily_limit: MESSAGES_PER_DAY,
    });
    if (recordError?.code === "P0002") return fail(CONTACT_MESSAGES.gone);
    if (recordError) {
      throw new Error(`recording the message failed: ${recordError.code} ${recordError.message}`);
    }
    if (recorded === null) return fail(CONTACT_MESSAGES.limit);

    try {
      const rendered = await renderEmail(ListingMessageEmail, {
        siteUrl: siteUrl(),
        firstName: typeof posterProfile?.first_name === "string" ? posterProfile.first_name : null,
        listingTitle: listing.title,
        listingPath: listingPath(listing.id),
        senderName: fullName(senderRead.data as { first_name?: unknown } | null),
        senderEmail: user.email,
        message: checked.message,
      });
      const send = getEmailSender(serverEnv("EMAIL_FROM", "RESEND_API_KEY", "MAILPIT_URL"));
      // The same message twice (a retry) is delivered once.
      const digest = createHash("sha256").update(checked.message).digest("hex");
      await send({
        to,
        replyTo: user.email,
        ...rendered,
        idempotencyKey: `listing_message/${listing.id}/${user.id}/${digest}`,
      });
    } catch (cause) {
      // It didn't go, so it doesn't count against the sender's day.
      const { error: undoError } = await admin.from("listing_messages").delete().eq("id", recorded);
      if (undoError) console.error("Taking back an unsent message failed:", undoError.code);
      throw cause;
    }
  } catch (cause) {
    // No addresses in the log: only the listing.
    const reason = cause instanceof Error ? cause.message : String(cause);
    console.error(`Sending a message about listing ${listingId} failed: ${reason}`);
    return fail(CONTACT_MESSAGES.unavailable);
  }

  return { status: "sent", message: sentMessage(poster, user.email) };
}
