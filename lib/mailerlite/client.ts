// MailerLite's API (https://developers.mailerlite.com, read 2026-11-26), as far as the member group
// sync (lib/mailerlite/sync.ts) uses it: the groups, and subscribers and their groups.
//
// The sync is off until MAILERLITE_API_KEY is set: getMailerLiteClient() returns null without it.
// The tests use a stand-in for the API (lib/mailerlite/fake-api.ts), never MailerLite itself.

const API_URL = "https://connect.mailerlite.com/api/";

/** The API version this code was written against: MailerLite answers in it, whatever comes later. */
const API_VERSION = "2026-11-26";

/** A request that hangs gives up after this long, so one member can't stall a whole run. */
const REQUEST_TIMEOUT_MS = 10_000;

export interface MailerLiteGroup {
  id: string;
  name: string;
}

/** MailerLite's own subscriber fields for the name. null clears one (updateSubscriber only). */
export interface SubscriberFields {
  name?: string | null;
  last_name?: string | null;
}

/** MailerLite answered with an error: `status` is the HTTP status. */
export class MailerLiteError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "MailerLiteError";
  }
}

export interface MailerLiteClient {
  /** The groups whose name contains `search`. */
  listGroups(search: string): Promise<MailerLiteGroup[]>;
  createGroup(name: string): Promise<MailerLiteGroup>;
  /** The subscriber with this address (or id), or null when there's none. */
  findSubscriber(idOrEmail: string): Promise<{ id: string } | null>;
  /**
   * Adds a subscriber with this address, or updates the one there is: sets the fields given and
   * adds the groups, leaving the subscriber's other fields and groups as they are. It sends no
   * status, so a new subscriber gets the account's default (active, or unconfirmed with double
   * opt-in) and an existing one keeps theirs. For a subscriber who unsubscribed, bounced or marked
   * a campaign as spam, MailerLite refuses this with 422, since only a resubscribe would bring them
   * back, and that's for them to ask for.
   */
  upsertSubscriber(subscriber: {
    email: string;
    fields: SubscriberFields;
    groups: readonly string[];
  }): Promise<{ id: string }>;
  /** Changes a subscriber's address, name or both. Never their status or groups. */
  updateSubscriber(
    id: string,
    changes: { email?: string; fields: SubscriberFields },
  ): Promise<void>;
  addToGroup(subscriberId: string, groupId: string): Promise<void>;
  /** Takes the subscriber out of the group. Resolves when they weren't in it either. */
  removeFromGroup(subscriberId: string, groupId: string): Promise<void>;
}

type Fetch = typeof globalThis.fetch;

const isGroup = (value: unknown): value is MailerLiteGroup =>
  typeof (value as MailerLiteGroup | null)?.id === "string" &&
  typeof (value as MailerLiteGroup).name === "string";

const idOf = (data: unknown, what: string): string => {
  const id = (data as { id?: unknown } | null)?.id;
  if (typeof id !== "string") throw new Error(`MailerLite's answer to ${what} had no id`);
  return id;
};

export function createMailerLiteClient(options: {
  apiKey: string;
  fetch?: Fetch;
}): MailerLiteClient {
  const { apiKey, fetch = globalThis.fetch } = options;

  /**
   * Sends one request and returns the `data` of MailerLite's answer. `what` names the request in
   * errors, which end up in logs: never the path, which can hold a member's address.
   */
  async function request(what: string, method: string, url: URL, body?: unknown) {
    const response = await fetch(url, {
      method,
      headers: {
        authorization: `Bearer ${apiKey}`,
        accept: "application/json",
        "content-type": "application/json",
        "x-version": API_VERSION,
        "user-agent": "obs-platform",
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    const json = (await response.json().catch(() => null)) as {
      data?: unknown;
      message?: unknown;
    } | null;
    if (!response.ok) {
      // MailerLite's messages are general ("The given data was invalid.", "Too Many Attempts."),
      // while its per-field errors can repeat what was sent, so only the message goes in.
      const message = typeof json?.message === "string" && json.message ? `: ${json.message}` : "";
      throw new MailerLiteError(
        `MailerLite refused to ${what} (HTTP ${response.status})${message}`,
        response.status,
      );
    }
    return json?.data;
  }

  const url = (path: string) => new URL(path, API_URL);
  const subscriberPath = (id: string) => `subscribers/${encodeURIComponent(id)}`;
  const memberPath = (subscriberId: string, groupId: string) =>
    `${subscriberPath(subscriberId)}/groups/${encodeURIComponent(groupId)}`;

  return {
    async listGroups(search) {
      const target = url("groups");
      target.searchParams.set("filter[name]", search);
      // An account holds at most 1,000 groups, so one page has them all.
      target.searchParams.set("limit", "1000");
      const data = await request("list the groups", "GET", target);
      if (!Array.isArray(data) || !data.every(isGroup)) {
        throw new Error("MailerLite's list of groups wasn't one");
      }
      return data.map(({ id, name }) => ({ id, name }));
    },

    async createGroup(name) {
      const data = await request("create a group", "POST", url("groups"), { name });
      if (!isGroup(data)) throw new Error("MailerLite's answer to creating a group had no group");
      return { id: data.id, name: data.name };
    },

    async findSubscriber(idOrEmail) {
      try {
        const data = await request("find a subscriber", "GET", url(subscriberPath(idOrEmail)));
        return { id: idOf(data, "finding a subscriber") };
      } catch (error) {
        if (error instanceof MailerLiteError && error.status === 404) return null;
        throw error;
      }
    },

    async upsertSubscriber({ email, fields, groups }) {
      const data = await request("add a subscriber", "POST", url("subscribers"), {
        email,
        fields,
        groups,
      });
      return { id: idOf(data, "adding a subscriber") };
    },

    async updateSubscriber(id, changes) {
      await request("update a subscriber", "PUT", url(subscriberPath(id)), changes);
    },

    async addToGroup(subscriberId, groupId) {
      await request("add a subscriber to a group", "POST", url(memberPath(subscriberId, groupId)));
    },

    async removeFromGroup(subscriberId, groupId) {
      try {
        await request(
          "remove a subscriber from a group",
          "DELETE",
          url(memberPath(subscriberId, groupId)),
        );
      } catch (error) {
        // 404: they aren't in the group (or MailerLite no longer has them), which is what we want.
        if (!(error instanceof MailerLiteError && error.status === 404)) throw error;
      }
    },
  };
}

/**
 * The MailerLite client for this environment, from MAILERLITE_API_KEY, or null while it isn't set:
 * the member group sync is off until then.
 */
export function getMailerLiteClient(
  env: Readonly<Record<string, string | undefined>> = process.env,
): MailerLiteClient | null {
  const apiKey = env.MAILERLITE_API_KEY?.trim();
  return apiKey ? createMailerLiteClient({ apiKey }) : null;
}
