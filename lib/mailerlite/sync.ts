// The MailerLite group sync (backlog E-3). It keeps seven groups in the Society's MailerLite account
// in step with the members' profiles, so volunteers can send a campaign to the members who need it:
//   - one group per status: active, expiring (the membership ends within 30 days) and lapsed;
//   - one group per level, for the members of that level whose membership hasn't lapsed.
// A member is in their status's group and, until their membership lapses, their level's group.
// The website made these groups and owns them: it adds and removes members, and nothing else. A
// subscriber's other groups, and their status, are MailerLite's: someone who unsubscribed stays
// unsubscribed.
//
// It runs every night, after the daily jobs update the statuses (lib/jobs/daily.ts), and whenever
// server code changes a membership (lib/mailerlite/on-change.ts). Each run compares the profiles
// with what MailerLite was last given (supabase/migrations/20261126193121_mailerlite_subscribers.sql)
// and calls MailerLite only for the members who changed, so running it again changes nothing. It
// takes each of those members before working on them, so two runs never work on the same member.
//
// Off until MAILERLITE_API_KEY is set (lib/mailerlite/client.ts).

import type { MembershipStatus } from "@/lib/jobs/daily";
import type { MembershipLevel } from "@/sanity/schemas/options";
import { MailerLiteError, type MailerLiteClient, type SubscriberFields } from "./client";

/**
 * The member groups, by the status or level they're for. The sync finds them by these names, and
 * makes any that's missing: a group renamed in MailerLite is no longer the website's.
 */
export const MEMBER_GROUPS = {
  active: "Website: Active members",
  expiring: "Website: Expiring members",
  lapsed: "Website: Lapsed members",
  individual: "Website: Individual members",
  band: "Website: Band members",
  business: "Website: Business members",
  sponsor: "Website: Sponsor members",
} as const satisfies Record<MembershipStatus | MembershipLevel, string>;

type GroupKey = keyof typeof MEMBER_GROUPS;

/** What every member group's name starts with: one search lists them all. */
const GROUP_PREFIX = "Website: ";

/** A member as the sync reads them from their profile. */
export interface Member {
  email: string;
  firstName: string | null;
  lastName: string | null;
  /** Null until the first payment. */
  level: MembershipLevel | null;
  status: MembershipStatus | null;
}

/** What MailerLite was last given for a member. */
export interface SyncedMember {
  subscriberId: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  /** The MailerLite ids of the member groups the subscriber was put in. */
  groupIds: string[];
}

/** What the sync reads and writes. lib/mailerlite/store.ts keeps it in Supabase. */
export interface MailerLiteStore {
  /**
   * The members (profiles with a level and a status) and what MailerLite was last given for each
   * member synced so far (null while a member's first sync hasn't finished), by profile id; only
   * for `profileIds` when they're given.
   */
  list(profileIds?: readonly string[]): Promise<{
    members: Map<string, Member>;
    synced: Map<string, SyncedMember | null>;
  }>;
  /**
   * Takes the member for this run: their profile as it is now (null once it's deleted) and what
   * MailerLite was last given (null if nothing yet). Null when another run has them.
   */
  claim(profileId: string): Promise<{ member: Member | null; synced: SyncedMember | null } | null>;
  /**
   * Records what MailerLite now has for a member this run has taken (null: out of every member
   * group, so there's nothing to keep) and lets go of them. Returns their profile as it is now.
   */
  finish(profileId: string, synced: SyncedMember | null): Promise<Member | null>;
  /** Lets go of a member without recording anything, after an error or at the deadline. */
  release(profileId: string): Promise<void>;
}

export interface MailerLiteSyncOptions {
  client: MailerLiteClient;
  store: MailerLiteStore;
  /** Only these members, after a change to them; every member when left out. */
  profileIds?: readonly string[];
  /** No request is started after this time (milliseconds since 1970); the next run does the rest. */
  deadline?: number;
  /** The current time in milliseconds, for the deadline. Defaults to Date.now. */
  clock?: () => number;
}

export interface MailerLiteSyncCounts {
  /** Members MailerLite now has in different groups, or with a new address or name. */
  synced: number;
  /** Members taken out of every member group: they're no longer members, or their profile is gone. */
  removed: number;
  /** Members another run was syncing at the same time: that run syncs them. */
  claimedElsewhere: number;
  /**
   * Members this run didn't get to, at its deadline or because MailerLite asked it to slow down:
   * the next run syncs them. When that happens before the groups are listed, every member counts.
   */
  deferred: number;
  /** Members not synced because of an error (listed in `errors`); the next run tries again. */
  failed: number;
}

export interface MailerLiteSyncSummary extends MailerLiteSyncCounts {
  /** What went wrong, for the logs. Profile ids, never addresses. */
  errors: string[];
}

/** How many times a run syncs a member who keeps changing while it does, before leaving them. */
const MAX_PASSES = 3;

/** The groups a member belongs in: none for someone who has never been a member. */
function groupKeys(member: Member | null): GroupKey[] {
  if (!member?.level || !member.status) return [];
  return member.status === "lapsed" ? ["lapsed"] : [member.status, member.level];
}

/** The deadline passed, or MailerLite asked us to slow down: the next run carries on. */
class OutOfTime extends Error {}

const describeError = (error: unknown) => (error instanceof Error ? error.message : String(error));

/** Whether an error is about one member, so the run can go on with the others. */
const isAboutTheMember = (error: unknown) =>
  error instanceof MailerLiteError &&
  error.status >= 400 &&
  error.status < 500 &&
  ![401, 403, 429].includes(error.status);

/** MailerLite didn't find the subscriber or refused the request: 404 or 422. */
const isRefused = (error: unknown) =>
  error instanceof MailerLiteError && (error.status === 404 || error.status === 422);

/** MailerLite's name fields for a member. `clear` sends null for a missing name, to remove it. */
function fieldsOf(member: Member, clear: boolean): SubscriberFields {
  const fields: SubscriberFields = {};
  if (member.firstName !== null || clear) fields.name = member.firstName;
  if (member.lastName !== null || clear) fields.last_name = member.lastName;
  return fields;
}

const sameSet = (a: readonly string[], b: readonly string[]) =>
  a.length === b.length && a.every((id) => b.includes(id));

/** Runs the sync once. Never throws: what failed is in the summary's `errors`. */
export async function syncMailerLite(
  options: MailerLiteSyncOptions,
): Promise<MailerLiteSyncSummary> {
  const { client, store, deadline = Number.POSITIVE_INFINITY, clock = Date.now } = options;
  const summary: MailerLiteSyncSummary = {
    synced: 0,
    removed: 0,
    claimedElsewhere: 0,
    deferred: 0,
    failed: 0,
    errors: [],
  };
  const fail = (what: string, error: unknown) =>
    summary.errors.push(`MailerLite sync: ${what}: ${describeError(error)}`);

  /** Starts a request to MailerLite, unless the deadline has passed. */
  async function call<T>(request: (client: MailerLiteClient) => Promise<T>): Promise<T> {
    if (clock() >= deadline) throw new OutOfTime();
    try {
      return await request(client);
    } catch (error) {
      if (error instanceof MailerLiteError && error.status === 429) throw new OutOfTime();
      throw error;
    }
  }

  let listed: Awaited<ReturnType<MailerLiteStore["list"]>>;
  try {
    listed = await store.list(options.profileIds);
  } catch (error) {
    fail("reading the members failed", error);
    return summary;
  }
  // Every member, and everyone MailerLite was given before (some may no longer be members).
  const listedIds = [...new Set([...listed.members.keys(), ...listed.synced.keys()])].sort();
  // Nobody to sync: MailerLite isn't called, and the groups aren't made yet.
  if (listedIds.length === 0) return summary;

  // The member groups' ids, by status and level.
  let groups: Record<GroupKey, string>;
  try {
    groups = await findOrCreateGroups(call);
  } catch (error) {
    if (error instanceof OutOfTime) summary.deferred = listedIds.length;
    else fail("finding or making the member groups failed", error);
    return summary;
  }
  const memberGroupIds = new Set(Object.values(groups));
  const wantedGroups = (member: Member | null) => groupKeys(member).map((key) => groups[key]);
  /** The member groups MailerLite was given, leaving out any group that's no longer ours. */
  const syncedGroups = (synced: SyncedMember) =>
    synced.groupIds.filter((id) => memberGroupIds.has(id));

  /** Whether MailerLite needs telling about the member. `synced` is undefined if never synced. */
  function needsSync(member: Member | null, synced: SyncedMember | null | undefined): boolean {
    const wanted = wantedGroups(member);
    if (synced === undefined) return wanted.length > 0;
    // A first sync that didn't finish, or a member to take out of the groups.
    if (synced === null || wanted.length === 0 || !member) return true;
    return (
      member.email !== synced.email ||
      member.firstName !== synced.firstName ||
      member.lastName !== synced.lastName ||
      !sameSet(wanted, syncedGroups(synced))
    );
  }

  /** Adds the member to MailerLite under their address, in the groups they belong in. */
  async function addSubscriber(member: Member, wanted: string[]): Promise<SyncedMember> {
    let subscriberId: string;
    try {
      ({ id: subscriberId } = await call((c) =>
        c.upsertSubscriber({
          email: member.email,
          fields: fieldsOf(member, false),
          groups: wanted,
        }),
      ));
    } catch (error) {
      if (!(error instanceof MailerLiteError && error.status === 422)) throw error;
      // MailerLite refuses this for a subscriber who unsubscribed, bounced or marked a campaign as
      // spam. They still belong in the groups (a campaign skips them), so add them one group at a
      // time, which leaves them unsubscribed. If there's no such subscriber, the address itself
      // was refused.
      const found = await call((c) => c.findSubscriber(member.email));
      if (!found) throw error;
      subscriberId = found.id;
      for (const groupId of wanted) await call((c) => c.addToGroup(subscriberId, groupId));
      // The name, as the upsert would have set it.
      const fields = fieldsOf(member, false);
      if (Object.keys(fields).length > 0) {
        await call((c) => c.updateSubscriber(subscriberId, { fields }));
      }
    }
    const { email, firstName, lastName } = member;
    return { subscriberId, email, firstName, lastName, groupIds: wanted };
  }

  /**
   * Brings MailerLite in line with the profile of a member this run has taken. Returns what
   * MailerLite now has, null when the member is out of every member group, or "unchanged" when
   * there was nothing to do.
   */
  async function bringInLine(
    member: Member | null,
    synced: SyncedMember | null,
  ): Promise<SyncedMember | null | "unchanged"> {
    const wanted = wantedGroups(member);
    if (!member || wanted.length === 0) {
      if (synced) {
        for (const groupId of syncedGroups(synced)) {
          await call((c) => c.removeFromGroup(synced.subscriberId, groupId));
        }
      }
      return null;
    }
    if (!synced) return addSubscriber(member, wanted);
    if (!needsSync(member, synced)) return "unchanged";

    const { subscriberId } = synced;
    const current = syncedGroups(synced);
    const newAddress = member.email !== synced.email;
    if (
      newAddress ||
      member.firstName !== synced.firstName ||
      member.lastName !== synced.lastName
    ) {
      try {
        await call((c) =>
          c.updateSubscriber(subscriberId, {
            ...(newAddress ? { email: member.email } : {}),
            fields: fieldsOf(member, true),
          }),
        );
      } catch (error) {
        if (!isRefused(error)) throw error;
        // 404: the subscriber was deleted in MailerLite. 422: MailerLite refused the change, such
        // as an address another subscriber already has, or a second change of address in a
        // month. Either way, take the old subscriber out of the member groups and add the member
        // under their address.
        for (const groupId of current) {
          await call((c) => c.removeFromGroup(subscriberId, groupId));
        }
        return addSubscriber(member, wanted);
      }
    }
    for (const groupId of wanted.filter((id) => !current.includes(id))) {
      try {
        await call((c) => c.addToGroup(subscriberId, groupId));
      } catch (error) {
        if (!isRefused(error)) throw error;
        // The subscriber was deleted in MailerLite: add the member again.
        return addSubscriber(member, wanted);
      }
    }
    for (const groupId of current.filter((id) => !wanted.includes(id))) {
      await call((c) => c.removeFromGroup(subscriberId, groupId));
    }
    const { email, firstName, lastName } = member;
    return { subscriberId, email, firstName, lastName, groupIds: wanted };
  }

  /** Syncs one member, going round again while they change under it. */
  async function syncMember(profileId: string): Promise<"synced" | "removed" | "busy" | "none"> {
    let outcome: "synced" | "removed" | "none" = "none";
    for (let pass = 1; pass <= MAX_PASSES; pass++) {
      const claimed = await store.claim(profileId);
      if (!claimed) return pass === 1 ? "busy" : outcome;
      let result: SyncedMember | null | "unchanged";
      try {
        result = await bringInLine(claimed.member, claimed.synced);
      } catch (error) {
        await store.release(profileId).catch((releaseError: unknown) => {
          fail(`letting go of profile ${profileId} failed`, releaseError);
        });
        throw error;
      }
      if (result === "unchanged") {
        await store.release(profileId);
        return outcome;
      }
      const now = await store.finish(profileId, result);
      // Out of the groups: "removed" if MailerLite had them in some, nothing to count otherwise.
      if (result) outcome = "synced";
      else if (claimed.synced) outcome = "removed";
      // A change made while the member was being synced shows here: go round again.
      if (!needsSync(now, result ?? undefined)) return outcome;
    }
    return outcome;
  }

  const due = listedIds.filter((id) =>
    needsSync(listed.members.get(id) ?? null, listed.synced.get(id)),
  );
  for (const [index, profileId] of due.entries()) {
    try {
      const outcome = await syncMember(profileId);
      if (outcome === "synced") summary.synced += 1;
      else if (outcome === "removed") summary.removed += 1;
      else if (outcome === "busy") summary.claimedElsewhere += 1;
    } catch (error) {
      if (error instanceof OutOfTime) {
        summary.deferred = due.length - index;
        break;
      }
      summary.failed += 1;
      fail(`syncing profile ${profileId} failed`, error);
      if (!isAboutTheMember(error)) {
        // A refused key, MailerLite down or the database unreachable: the rest would fail too.
        summary.deferred = due.length - index - 1;
        break;
      }
    }
  }
  return summary;
}

/** The member groups' ids, by status and level; makes any group that's missing. */
async function findOrCreateGroups(
  call: <T>(request: (client: MailerLiteClient) => Promise<T>) => Promise<T>,
): Promise<Record<GroupKey, string>> {
  const existing = await call((c) => c.listGroups(GROUP_PREFIX));
  const ids: Partial<Record<GroupKey, string>> = {};
  for (const [key, name] of Object.entries(MEMBER_GROUPS) as [GroupKey, string][]) {
    let id = existing.find((group) => group.name === name)?.id;
    if (!id) {
      try {
        ({ id } = await call((c) => c.createGroup(name)));
      } catch (error) {
        // Group names are unique in an account: another run may just have made it.
        if (!(error instanceof MailerLiteError && error.status === 422)) throw error;
        id = (await call((c) => c.listGroups(name))).find((group) => group.name === name)?.id;
        if (!id) throw error;
      }
    }
    ids[key] = id;
  }
  return ids as Record<GroupKey, string>;
}
