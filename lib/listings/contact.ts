import "server-only";
import { createHash, randomUUID } from "node:crypto";
import { headers } from "next/headers";
import ListingMessageEmail from "@/emails/listing-message";
import { renderEmail } from "@/emails/render";
import { getCurrentUser } from "@/lib/auth/user";
import { getEmailSender } from "@/lib/email/send";
import { serverEnv } from "@/lib/env/server";
import { siteUrl } from "@/lib/site/site-url";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { posterName } from "./moderation-state";
import { profilePhone } from "./public";
import {
  CONTACT_MESSAGES,
  MESSAGES_PER_LISTING,
  MESSAGES_PER_SENDER,
  MIN_SECONDS_TO_SEND,
  TRAP_FIELD,
  checkContact,
  isListingId,
  listingPath,
  readContactForm,
  sentMessage,
  type ContactField,
  type ContactState,
} from "./public-state";

// The form on a listing's page that writes to its poster (backlog K-3, decision 0009). Anyone,
// visitors included, can write. Not a Server Function file: the page gets its Server Function from
// contactFormAction() below, which seals in the listing and the time the page was made (Next.js
// encrypts what a Server Function closes over), so nobody can send a time of their own.
//
// The poster's email address is read with the service role, used as the email's To and never
// returned or logged: the answer holds only what the sender typed and the poster's name, which the
// listing shows anyway. The poster answers with Reply, which goes to the address the sender gave.
//
// Decision 0009's checks, with no third party: a hidden field that people leave empty and scripts
// fill in, a few seconds between the page appearing and the message going, and the database's
// daily limits per sender email address, per network address and per listing
// (supabase/migrations/20261127195203_listing_messages.sql). The email itself says the sender's
// address is unchecked and shows links as text (emails/listing-message.tsx).

type ListingRow = { id: string; profile_id: string; title: string; contact_pref: string };
type PosterRow = { email: unknown; first_name: unknown; last_name: unknown; phone: unknown };

const sha256 = (text: string) => createHash("sha256").update(text).digest("hex");

/**
 * The visitor's network address, as Netlify (x-nf-client-connection-ip) or another host's proxy
 * (x-real-ip) gives it, or null. x-forwarded-for isn't used: its first entry is whatever the
 * visitor sent.
 *
 * Netlify sets x-nf-client-connection-ip itself, to the address the connection came from, in place
 * of any value the visitor sent. A host that doesn't set it (Vercel, CLAUDE.md's fallback, is one)
 * passes on whatever the visitor sends, so one visitor could pass for many networks: on such a
 * host, read its own header here first.
 */
export function clientAddress(requestHeaders: Headers): string | null {
  for (const name of ["x-nf-client-connection-ip", "x-real-ip"]) {
    const value = requestHeaders.get(name)?.trim();
    if (value) return value;
  }
  return null;
}

/**
 * Emails the message in the form to the poster of the live listing `listingId`, with the sender's
 * name and address so the poster can reply. `shownAt` is when the page with the form was made
 * (milliseconds since 1970), sealed into the page's Server Function.
 */
export async function sendContactMessage(
  listingId: string,
  shownAt: number,
  formData: FormData,
): Promise<ContactState> {
  const values = readContactForm(formData);
  const fail = (message: string, field: ContactField | null = null): ContactState => ({
    status: "error",
    field,
    message,
    values,
  });

  // People never see the field; whatever fills it in is told the message went, and nothing goes.
  const trap = formData.get(TRAP_FIELD);
  if (typeof trap === "string" && trap.trim()) {
    return { status: "sent", message: sentMessage(null, values.email.trim()) };
  }
  // The page never sends anything else, so someone made the request up.
  if (!isListingId(listingId)) return fail(CONTACT_MESSAGES.gone);
  const checked = checkContact(values);
  if ("problem" in checked) return fail(checked.problem, checked.field);
  if (Date.now() - shownAt < MIN_SECONDS_TO_SEND * 1000) return fail(CONTACT_MESSAGES.tooQuick);
  const { name, email, message } = checked.contact;

  let poster: string | null;
  try {
    const [supabase, viewer, requestHeaders] = await Promise.all([
      createClient(),
      getCurrentUser(),
      headers(),
    ]);
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
    if (viewer?.id === listing.profile_id) return fail(CONTACT_MESSAGES.own);

    const admin = createAdminClient();
    const { data: posterData, error: posterError } = await admin
      .from("profiles")
      .select("email, first_name, last_name, phone")
      .eq("id", listing.profile_id)
      .maybeSingle();
    if (posterError) {
      throw new Error(`reading the poster failed: ${posterError.code} ${posterError.message}`);
    }
    const posterProfile = (posterData ?? null) as PosterRow | null;
    const to = typeof posterProfile?.email === "string" ? posterProfile.email : "";
    if (!to) throw new Error("the poster's profile has no email address");
    // The same rule as the page (lib/listings/public.ts contactFor): a signed-in viewer gets the
    // number of a poster who asked for calls, and a visitor, who may not see it, writes instead.
    if (viewer && listing.contact_pref === "phone" && profilePhone(posterProfile?.phone)) {
      return fail(CONTACT_MESSAGES.byPhone);
    }
    poster = posterName(posterProfile?.first_name, posterProfile?.last_name);

    // Without an address from the host (locally, say), there's no network limit: a made-up one per
    // message, rather than one shared by everyone.
    const address = clientAddress(requestHeaders) ?? `none:${randomUUID()}`;
    const { data: recorded, error: recordError } = await admin.rpc("record_listing_message", {
      p_listing_id: listing.id,
      p_email_hash: sha256(email.toLowerCase()),
      p_ip_hash: sha256(address),
      p_sender_limit: MESSAGES_PER_SENDER,
      p_listing_limit: MESSAGES_PER_LISTING,
    });
    if (recordError?.code === "P0002") return fail(CONTACT_MESSAGES.gone);
    if (recordError?.code === "OB201") return fail(CONTACT_MESSAGES.senderLimit);
    if (recordError?.code === "OB202") return fail(CONTACT_MESSAGES.listingLimit);
    if (recordError || typeof recorded !== "number") {
      throw new Error(`recording the message failed: ${recordError?.code} ${recordError?.message}`);
    }

    try {
      const rendered = await renderEmail(ListingMessageEmail, {
        siteUrl: siteUrl(),
        firstName: typeof posterProfile?.first_name === "string" ? posterProfile.first_name : null,
        listingTitle: listing.title,
        listingPath: listingPath(listing.id),
        senderName: name,
        senderEmail: email,
        message,
      });
      const send = getEmailSender(serverEnv("EMAIL_FROM", "RESEND_API_KEY", "MAILPIT_URL"));
      await send({
        to,
        replyTo: email,
        ...rendered,
        // The same message twice (a retry) is delivered once.
        idempotencyKey: `listing_message/${listing.id}/${sha256(`${email.toLowerCase()}\n${message}`)}`,
      });
    } catch (cause) {
      // It didn't go, so it doesn't count against the sender's day or the listing's.
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

  return { status: "sent", message: sentMessage(poster, email) };
}

/**
 * The contact form's Server Function for the page being made for the live listing `listingId`.
 * The listing and the time come back from the browser as they left, encrypted by Next.js, so the
 * form can tell a person, who takes a few seconds to write, from a script that posts at once.
 */
export function contactFormAction(
  listingId: string,
): (previous: ContactState, formData: FormData) => Promise<ContactState> {
  const shownAt = Date.now();
  return async function contact(_previous: ContactState, formData: FormData) {
    "use server";
    return sendContactMessage(listingId, shownAt, formData);
  };
}
