// The daily jobs' data in Supabase (supabase/migrations/20261126143035_membership_emails.sql),
// through a client with the service role: the functions and membership_emails are for server code
// only. lib/supabase/admin.ts makes that client.

import type { SupabaseClient } from "@supabase/supabase-js";
import { isMembershipLevel } from "@/lib/members/access";
import {
  MEMBERSHIP_EMAIL_KINDS,
  MEMBERSHIP_STATUSES,
  type DueMembershipEmail,
  type MembershipEmailKind,
  type MembershipStatus,
  type MembershipStore,
} from "./daily";

const isKind = (value: unknown): value is MembershipEmailKind =>
  MEMBERSHIP_EMAIL_KINDS.includes(value as MembershipEmailKind);

const isStatus = (value: unknown): value is MembershipStatus =>
  MEMBERSHIP_STATUSES.includes(value as MembershipStatus);

function failure(what: string, error: { code?: string; message: string }): Error {
  return new Error(`${what}: ${error.code ? `${error.code} ` : ""}${error.message}`);
}

export function createMembershipStore(supabase: SupabaseClient): MembershipStore {
  return {
    async refreshStatuses(now) {
      const { data, error } = await supabase.rpc("refresh_membership_statuses", {
        p_now: now.toISOString(),
      });
      if (error) throw failure("refresh_membership_statuses", error);
      const moved: Partial<Record<MembershipStatus, number>> = {};
      for (const row of (data ?? []) as { new_status: unknown; members: unknown }[]) {
        if (isStatus(row.new_status) && typeof row.members === "number") {
          moved[row.new_status] = row.members;
        }
      }
      return moved;
    },

    async dueEmails(now) {
      const { data, error } = await supabase.rpc("due_membership_emails", {
        p_now: now.toISOString(),
      });
      if (error) throw failure("due_membership_emails", error);
      return ((data ?? []) as Record<string, unknown>[]).map((row): DueMembershipEmail => {
        const { profile_id, kind, expires_at, email, first_name, level } = row;
        if (
          typeof profile_id !== "string" ||
          !isKind(kind) ||
          typeof expires_at !== "string" ||
          typeof email !== "string" ||
          !isMembershipLevel(level)
        ) {
          throw new Error(
            `due_membership_emails returned a row it shouldn't: ${String(profile_id)}`,
          );
        }
        return {
          profileId: profile_id,
          kind,
          expiresAt: expires_at,
          email,
          firstName: typeof first_name === "string" ? first_name : null,
          level,
        };
      });
    },

    async claim(email) {
      // INSERT ... ON CONFLICT DO NOTHING RETURNING id: no row back means another run claimed it.
      const { data, error } = await supabase
        .from("membership_emails")
        .upsert(
          { profile_id: email.profileId, kind: email.kind, expires_at: email.expiresAt },
          { onConflict: "profile_id,kind,expires_at", ignoreDuplicates: true },
        )
        .select("id");
      if (error) throw failure("Claiming in membership_emails", error);
      const id = (data as { id: unknown }[] | null)?.[0]?.id;
      return typeof id === "number" ? id : null;
    },

    async markSent(claimId, providerId, sentAt) {
      const { error } = await supabase
        .from("membership_emails")
        .update({ sent_at: sentAt.toISOString(), provider_id: providerId })
        .eq("id", claimId);
      if (error) throw failure("Recording in membership_emails", error);
    },

    async release(claimId) {
      const { error } = await supabase.from("membership_emails").delete().eq("id", claimId);
      if (error) throw failure("Deleting from membership_emails", error);
    },
  };
}
