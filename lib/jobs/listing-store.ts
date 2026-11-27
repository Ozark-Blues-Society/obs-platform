// The daily jobs' classifieds data in Supabase
// (supabase/migrations/20261127221430_listing_expiry.sql), through a client with the service role:
// the functions and listing_reminders are for server code only. lib/supabase/admin.ts makes that
// client.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { DueListingReminder, ListingStore } from "./listings";

function failure(what: string, error: { code?: string; message: string }): Error {
  return new Error(`${what}: ${error.code ? `${error.code} ` : ""}${error.message}`);
}

export function createListingStore(supabase: SupabaseClient): ListingStore {
  return {
    async expire(now) {
      const { data, error } = await supabase.rpc("expire_listings", { p_now: now.toISOString() });
      if (error) throw failure("expire_listings", error);
      if (typeof data !== "number") throw new Error("expire_listings returned no count");
      return data;
    },

    async dueReminders(now) {
      const { data, error } = await supabase.rpc("due_listing_reminders", {
        p_now: now.toISOString(),
      });
      if (error) throw failure("due_listing_reminders", error);
      return ((data ?? []) as Record<string, unknown>[]).map((row): DueListingReminder => {
        const { listing_id, expires_at, title, email, first_name } = row;
        if (
          typeof listing_id !== "string" ||
          typeof expires_at !== "string" ||
          typeof title !== "string" ||
          typeof email !== "string"
        ) {
          throw new Error(
            `due_listing_reminders returned a row it shouldn't: ${String(listing_id)}`,
          );
        }
        return {
          listingId: listing_id,
          expiresAt: expires_at,
          title,
          email,
          firstName: typeof first_name === "string" ? first_name : null,
        };
      });
    },

    async claim(reminder) {
      // INSERT ... ON CONFLICT DO NOTHING RETURNING id: no row back means another run claimed it.
      const { data, error } = await supabase
        .from("listing_reminders")
        .upsert(
          { listing_id: reminder.listingId, expires_at: reminder.expiresAt },
          { onConflict: "listing_id,expires_at", ignoreDuplicates: true },
        )
        .select("id");
      if (error) throw failure("Claiming in listing_reminders", error);
      const id = (data as { id: unknown }[] | null)?.[0]?.id;
      return typeof id === "number" ? id : null;
    },

    async markSent(claimId, providerId, sentAt) {
      const { error } = await supabase
        .from("listing_reminders")
        .update({ sent_at: sentAt.toISOString(), provider_id: providerId })
        .eq("id", claimId);
      if (error) throw failure("Recording in listing_reminders", error);
    },

    async release(claimId) {
      const { error } = await supabase.from("listing_reminders").delete().eq("id", claimId);
      if (error) throw failure("Deleting from listing_reminders", error);
    },
  };
}
