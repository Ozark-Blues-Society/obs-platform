"use server";

import type { SupabaseClient } from "@supabase/supabase-js";
import { refresh } from "next/cache";
import { requireUser } from "@/lib/auth/user";
import { createClient } from "@/lib/supabase/server";
import { emailPoster, moderatesListings } from "./moderation";
import {
  MODERATION_MESSAGES,
  MODERATION_PATH,
  approvedMessage,
  checkReason,
  notDecidedMessage,
  rejectedMessage,
  type ModerationResult,
  type ModerationTarget,
} from "./moderation-state";

// The moderation queue's Server Functions (app/admin/classifieds; backlog K-2, A-3). Anyone can call
// a Server Function, so each checks the session and the role itself. The change runs as the
// signed-in moderator: row level security and the guard trigger let only moderators and
// administrators change a listing's status, and approving starts its 60 days
// (supabase/migrations/20261126210923_listings.sql).
//
// A decision changes the listing only while it's still pending at the revision the queue showed
// (supabase/migrations/20261126225448_listing_moderation.sql), so a listing the poster changed in
// the meantime, or that another moderator decided on, is left alone. Then the poster gets an email.

type Decided = {
  id: string;
  profile_id: string;
  title: string;
  revision: number;
  expires_at: string | null;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** The listing and revision the request names, or null for anything the queue never sends. */
function parseTarget(input: { id?: unknown; revision?: unknown }): ModerationTarget | null {
  const { id, revision } = input;
  if (typeof id !== "string" || !UUID.test(id)) return null;
  if (typeof revision !== "number" || !Number.isSafeInteger(revision) || revision < 1) return null;
  return { id, revision };
}

const failed = (message: string): ModerationResult => ({ status: "error", message });

/**
 * Checks the caller's role, then applies `change` to the pending listing at the revision the queue
 * showed. Resolves with the listing as the change left it, or with what to tell the moderator.
 */
async function decide(
  userId: string,
  target: ModerationTarget | null,
  change: { status: "live" } | { status: "rejected"; reject_reason: string },
): Promise<Decided | ModerationResult> {
  // The queue never sends anything else, so someone made the request up.
  if (!target) return failed(MODERATION_MESSAGES.unavailable);
  if (!(await moderatesListings(userId))) return failed(MODERATION_MESSAGES.notModerator);

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("listings")
    .update(change)
    .eq("id", target.id)
    .eq("status", "pending")
    .eq("revision", target.revision)
    .select("id, profile_id, title, revision, expires_at")
    .maybeSingle();
  // The queue is out of date whatever happened, so show it afresh.
  refresh();
  if (error) {
    if (error.code === "42501") return failed(MODERATION_MESSAGES.notModerator);
    console.error("Moderating a listing failed:", error.code, error.message);
    return failed(MODERATION_MESSAGES.unavailable);
  }
  return (data as Decided | null) ?? failed(await whyNotDecided(supabase, target));
}

/** What to tell the moderator when their decision matched no pending listing at that revision. */
async function whyNotDecided(supabase: SupabaseClient, target: ModerationTarget): Promise<string> {
  const { data, error } = await supabase
    .from("listings")
    .select("title, status, revision")
    .eq("id", target.id)
    .maybeSingle();
  if (error) {
    console.error("Reading a listing after a refused decision failed:", error.code, error.message);
    return MODERATION_MESSAGES.unavailable;
  }
  if (!data) return MODERATION_MESSAGES.withdrawn;
  const listing = data as { title: string; status: string; revision: number };
  return notDecidedMessage({ ...listing, seenRevision: target.revision });
}

const isDecided = (outcome: Decided | ModerationResult): outcome is Decided => "id" in outcome;

/** Approves the listing: it goes live for 60 days, and the poster gets the approved email. */
export async function approveListing(input: ModerationTarget): Promise<ModerationResult> {
  const user = await requireUser(MODERATION_PATH);
  try {
    const outcome = await decide(user.id, parseTarget(input), { status: "live" });
    if (!isDecided(outcome)) return outcome;
    // Approving always sets it (the trigger, and the listings_live_dates check).
    const expiresAt = outcome.expires_at;
    if (!expiresAt) throw new Error(`approved listing ${outcome.id} has no expiry date`);
    const emailed = await emailPoster({
      decision: "approved",
      listingId: outcome.id,
      profileId: outcome.profile_id,
      title: outcome.title,
      expiresAt,
    });
    return { status: "approved", message: approvedMessage(outcome.title, expiresAt, emailed) };
  } catch (cause) {
    console.error("Approving a listing failed:", cause);
    return failed(MODERATION_MESSAGES.unavailable);
  }
}

/** Rejects the listing with the moderator's reason, which the poster gets by email. */
export async function rejectListing(
  input: ModerationTarget & { reason: string },
): Promise<ModerationResult> {
  const user = await requireUser(MODERATION_PATH);
  try {
    const checked = checkReason(input.reason);
    if ("problem" in checked) return failed(checked.problem);
    const outcome = await decide(user.id, parseTarget(input), {
      status: "rejected",
      reject_reason: checked.reason,
    });
    if (!isDecided(outcome)) return outcome;
    const emailed = await emailPoster({
      decision: "rejected",
      listingId: outcome.id,
      profileId: outcome.profile_id,
      title: outcome.title,
      revision: outcome.revision,
      reason: checked.reason,
    });
    return { status: "rejected", message: rejectedMessage(outcome.title, emailed) };
  } catch (cause) {
    console.error("Rejecting a listing failed:", cause);
    return failed(MODERATION_MESSAGES.unavailable);
  }
}
