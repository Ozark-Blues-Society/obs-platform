// The MailerLite sync's data in Supabase (supabase/migrations/20261126193121_mailerlite_subscribers.sql),
// through a client with the service role: mailerlite_subscribers and its functions are for server
// code only. lib/supabase/admin.ts makes that client.

import type { SupabaseClient } from "@supabase/supabase-js";
import { MEMBERSHIP_STATUSES, type MembershipStatus } from "@/lib/jobs/daily";
import { isMembershipLevel } from "@/lib/members/access";
import type { MailerLiteStore, Member, SyncedMember } from "./sync";

/**
 * How long a run holds a member it has taken. A run starts no request after its deadline, and a
 * request gives up after 10 seconds, so a run is done with a member well within this; if it stops
 * halfway (a crash), another run can take the member a minute later.
 */
const LEASE_SECONDS = 60;

/** The Data API answers at most this many rows at a time (max_rows in supabase/config.jsonc). */
const PAGE_SIZE = 1000;

const isStatus = (value: unknown): value is MembershipStatus =>
  MEMBERSHIP_STATUSES.includes(value as MembershipStatus);

const text = (value: unknown) => (typeof value === "string" ? value : null);

function failure(what: string, error: { code?: string; message: string }): Error {
  return new Error(`${what}: ${error.code ? `${error.code} ` : ""}${error.message}`);
}

/** A profile row as the sync reads it, or null for a profile that's gone. */
function toMember(row: Record<string, unknown>, what: string): Member | null {
  if (row.is_profile === false) return null;
  const { email } = row;
  // undefined: neither null nor one of the values.
  const level = row.level === null ? null : isMembershipLevel(row.level) ? row.level : undefined;
  const status = row.status === null ? null : isStatus(row.status) ? row.status : undefined;
  if (typeof email !== "string" || level === undefined || status === undefined) {
    throw new Error(`${what} returned a profile it shouldn't`);
  }
  return {
    email,
    firstName: text(row.first_name),
    lastName: text(row.last_name),
    level,
    status,
  };
}

/** What MailerLite was last given, from mailerlite_subscribers; null before the first sync ends. */
function toSynced(row: {
  subscriber_id?: unknown;
  email?: unknown;
  first_name?: unknown;
  last_name?: unknown;
  group_ids?: unknown;
}): SyncedMember | null {
  const { subscriber_id, email, group_ids } = row;
  if (typeof subscriber_id !== "string" || typeof email !== "string") return null;
  return {
    subscriberId: subscriber_id,
    email,
    firstName: text(row.first_name),
    lastName: text(row.last_name),
    groupIds: Array.isArray(group_ids) ? group_ids.filter((id) => typeof id === "string") : [],
  };
}

export function createMailerLiteStore(supabase: SupabaseClient): MailerLiteStore {
  /** Every row of a query, a page at a time. */
  async function readAll(
    what: string,
    query: (
      from: number,
      to: number,
    ) => PromiseLike<{
      data: Record<string, unknown>[] | null;
      error: { code?: string; message: string } | null;
    }>,
  ) {
    const rows: Record<string, unknown>[] = [];
    for (let from = 0; ; from += PAGE_SIZE) {
      const { data, error } = await query(from, from + PAGE_SIZE - 1);
      if (error) throw failure(what, error);
      rows.push(...(data ?? []));
      if ((data ?? []).length < PAGE_SIZE) return rows;
    }
  }

  return {
    async list(profileIds) {
      const members = new Map<string, Member>();
      const synced = new Map<string, SyncedMember | null>();
      if (profileIds?.length === 0) return { members, synced };

      const profiles = await readAll("Reading profiles", (from, to) => {
        let query = supabase
          .from("profiles")
          .select("id, email, first_name, last_name, level, status")
          .not("level", "is", null)
          .not("status", "is", null);
        if (profileIds) query = query.in("id", [...profileIds]);
        return query.order("id").range(from, to);
      });
      for (const row of profiles) {
        const member = toMember(row, "Reading profiles");
        if (typeof row.id === "string" && member) members.set(row.id, member);
      }

      const rows = await readAll("Reading mailerlite_subscribers", (from, to) => {
        let query = supabase
          .from("mailerlite_subscribers")
          .select("profile_id, subscriber_id, email, first_name, last_name, group_ids");
        if (profileIds) query = query.in("profile_id", [...profileIds]);
        return query.order("profile_id").range(from, to);
      });
      for (const row of rows) {
        if (typeof row.profile_id === "string") synced.set(row.profile_id, toSynced(row));
      }
      return { members, synced };
    },

    async claim(profileId) {
      const { data, error } = await supabase.rpc("claim_mailerlite_member", {
        p_profile_id: profileId,
        p_lease_seconds: LEASE_SECONDS,
      });
      if (error) throw failure("claim_mailerlite_member", error);
      const row = ((data ?? []) as Record<string, unknown>[])[0];
      if (!row) return null;
      return {
        member: toMember(row, "claim_mailerlite_member"),
        synced: toSynced({
          subscriber_id: row.subscriber_id,
          email: row.synced_email,
          first_name: row.synced_first_name,
          last_name: row.synced_last_name,
          group_ids: row.synced_group_ids,
        }),
      };
    },

    async finish(profileId, result) {
      const { data, error } = await supabase.rpc("finish_mailerlite_member", {
        p_profile_id: profileId,
        p_subscriber_id: result?.subscriberId ?? null,
        p_email: result?.email ?? null,
        p_first_name: result?.firstName ?? null,
        p_last_name: result?.lastName ?? null,
        p_group_ids: result?.groupIds ?? null,
      });
      if (error) throw failure("finish_mailerlite_member", error);
      const row = ((data ?? []) as Record<string, unknown>[])[0];
      if (!row) throw new Error("finish_mailerlite_member returned no row");
      return toMember(row, "finish_mailerlite_member");
    },

    async release(profileId) {
      const { error } = await supabase
        .from("mailerlite_subscribers")
        .update({ lease_until: null })
        .eq("profile_id", profileId);
      if (error) throw failure("Releasing in mailerlite_subscribers", error);
    },
  };
}
