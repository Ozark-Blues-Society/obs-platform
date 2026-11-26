// A stand-in for MailerLite's API, for tests only: an account kept in memory behind a `fetch`, to
// give createMailerLiteClient(). Nothing here talks to MailerLite. It answers the requests the
// sync makes the way MailerLite's documentation says it does (developers.mailerlite.com, read
// 2026-11-26):
//   - an upsert (POST /subscribers) adds groups and never removes any; it fails with 422 for a
//     subscriber who unsubscribed, bounced or marked a campaign as spam unless the request has a
//     status or resubscribe, and a status of "active" doesn't bring such a subscriber back;
//   - a new subscriber is active, or unconfirmed when the account uses double opt-in;
//   - an address can change once a month, and not to one another subscriber has;
//   - group names are unique; removing a subscriber from a group they aren't in answers 404.
// lib/mailerlite/sync.test.ts and e2e/mailerlite-sync.spec.ts use it.

export type SubscriberStatus = "active" | "unsubscribed" | "unconfirmed" | "bounced" | "junk";

export interface FakeSubscriber {
  id: string;
  email: string;
  status: SubscriberStatus;
  fields: Record<string, string | null>;
  groups: Set<string>;
  addressChanges: number;
}

export interface FakeRequest {
  method: string;
  /** The path after /api/, with its query. */
  path: string;
  body?: Record<string, unknown>;
}

/** A failure to answer with instead of the real thing, for requests that `match`. */
interface Failure {
  match: (request: FakeRequest) => boolean;
  status: number;
  /** How many more requests it fails; Infinity for every one. */
  times: number;
}

const BLOCKED: SubscriberStatus[] = ["unsubscribed", "bounced", "junk"];

export const FAKE_API_KEY = "fake-mailerlite-api-key";

export function fakeMailerLite(options: { doubleOptIn?: boolean } = {}) {
  const groups = new Map<string, string>(); // id to name
  const subscribers = new Map<string, FakeSubscriber>();
  const requests: FakeRequest[] = [];
  const failures: Failure[] = [];
  let nextId = 1000;

  const json = (status: number, body?: unknown) =>
    body === undefined ? new Response(null, { status }) : Response.json(body, { status });
  const invalid = (field: string) =>
    json(422, { message: "The given data was invalid.", errors: { [field]: ["Invalid."] } });
  const subscriberData = (s: FakeSubscriber) => ({
    data: { id: s.id, email: s.email, status: s.status, fields: s.fields, groups: [] },
  });
  const byEmail = (email: string) =>
    [...subscribers.values()].find((s) => s.email.toLowerCase() === email.toLowerCase());
  const find = (idOrEmail: string) => subscribers.get(idOrEmail) ?? byEmail(idOrEmail);
  const setFields = (subscriber: FakeSubscriber, fields: unknown) => {
    for (const [key, value] of Object.entries((fields ?? {}) as Record<string, unknown>)) {
      subscriber.fields[key] = typeof value === "string" ? value : null;
    }
  };

  function answer(request: FakeRequest, url: URL): Response {
    const { method, body = {} } = request;
    const parts = url.pathname
      .replace(/^\/api\//, "")
      .split("/")
      .map(decodeURIComponent);

    if (parts[0] === "groups" && parts.length === 1) {
      if (method === "GET") {
        const search = (url.searchParams.get("filter[name]") ?? "").toLowerCase();
        const data = [...groups]
          .filter(([, name]) => name.toLowerCase().includes(search))
          .map(([id, name]) => ({ id, name, active_count: 0 }));
        return json(200, { data, meta: { total: data.length } });
      }
      if (method === "POST") {
        const name = body.name;
        if (typeof name !== "string" || [...groups.values()].includes(name)) return invalid("name");
        const id = String(nextId++);
        groups.set(id, name);
        return json(201, { data: { id, name, active_count: 0 } });
      }
    }

    if (parts[0] === "subscribers" && parts.length === 1 && method === "POST") {
      const { email, fields, groups: groupIds = [], status, resubscribe } = body;
      if (typeof email !== "string" || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
        return invalid("email");
      }
      if (!Array.isArray(groupIds) || !groupIds.every((id) => groups.has(id))) {
        return invalid("groups");
      }
      const existing = byEmail(email);
      if (existing) {
        if (BLOCKED.includes(existing.status) && !resubscribe && status === undefined) {
          return invalid("status");
        }
        if (resubscribe) existing.status = "active";
        else if (typeof status === "string" && status !== "active") {
          existing.status = status as SubscriberStatus;
        }
        setFields(existing, fields);
        for (const id of groupIds as string[]) existing.groups.add(id);
        return json(200, subscriberData(existing));
      }
      const subscriber: FakeSubscriber = {
        id: String(nextId++),
        email,
        status: (status as SubscriberStatus) ?? (options.doubleOptIn ? "unconfirmed" : "active"),
        fields: {},
        groups: new Set(groupIds as string[]),
        addressChanges: 0,
      };
      setFields(subscriber, fields);
      subscribers.set(subscriber.id, subscriber);
      return json(201, subscriberData(subscriber));
    }

    if (parts[0] === "subscribers" && parts.length === 2) {
      const subscriber = find(parts[1]);
      if (method === "GET") return subscriber ? json(200, subscriberData(subscriber)) : json(404);
      if (method === "PUT") {
        if (!subscriber) return json(404, { message: "" });
        const { email, fields } = body;
        if (typeof email === "string" && email !== subscriber.email) {
          const taken = byEmail(email);
          if (taken || subscriber.addressChanges >= 1) return invalid("email");
          subscriber.email = email;
          subscriber.addressChanges += 1;
        }
        setFields(subscriber, fields);
        return json(200, subscriberData(subscriber));
      }
    }

    if (parts[0] === "subscribers" && parts.length === 4 && parts[2] === "groups") {
      const subscriber = subscribers.get(parts[1]);
      const groupId = parts[3];
      if (method === "POST") {
        if (!subscriber || !groups.has(groupId)) return invalid("id");
        subscriber.groups.add(groupId);
        return json(200, { data: { id: groupId, name: groups.get(groupId) } });
      }
      if (method === "DELETE") {
        if (!subscriber || !subscriber.groups.has(groupId)) return json(404, { message: "" });
        subscriber.groups.delete(groupId);
        return json(204);
      }
    }

    return json(405, { message: "The stand-in doesn't answer this request." });
  }

  const fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = new URL(String(input));
    const request: FakeRequest = {
      method: init?.method ?? "GET",
      path: url.pathname.replace(/^\/api\//, "") + url.search,
      ...(init?.body ? { body: JSON.parse(String(init.body)) as Record<string, unknown> } : {}),
    };
    requests.push(request);
    if (url.origin !== "https://connect.mailerlite.com" || !url.pathname.startsWith("/api/")) {
      return json(404, { message: "Not MailerLite's API." });
    }
    if (new Headers(init?.headers).get("authorization") !== `Bearer ${FAKE_API_KEY}`) {
      return json(401, { message: "Unauthenticated." });
    }
    const failure = failures.find((f) => f.times > 0 && f.match(request));
    if (failure) {
      failure.times -= 1;
      return json(failure.status, {
        message: failure.status === 429 ? "Too Many Attempts." : "Server Error",
      });
    }
    return answer(request, url);
  };

  return {
    fetch,
    groups,
    subscribers,
    requests,
    /** The id of the group with this name. */
    groupId(name: string): string | undefined {
      return [...groups].find(([, groupName]) => groupName === name)?.[0];
    },
    /** The addresses in the group with this name, sorted. */
    membersOf(name: string): string[] {
      const id = this.groupId(name);
      return [...subscribers.values()]
        .filter((s) => id !== undefined && s.groups.has(id))
        .map((s) => s.email)
        .sort();
    },
    /** The subscriber with this address. */
    subscriber(email: string): FakeSubscriber | undefined {
      return byEmail(email);
    },
    /** Adds a group, as a volunteer would in MailerLite. */
    addGroup(name: string): string {
      const id = String(nextId++);
      groups.set(id, name);
      return id;
    },
    /** Adds a subscriber, as MailerLite's own forms or an import would. */
    addSubscriber(email: string, status: SubscriberStatus, groupNames: string[] = []) {
      const subscriber: FakeSubscriber = {
        id: String(nextId++),
        email,
        status,
        fields: {},
        groups: new Set(groupNames.map((name) => this.groupId(name) ?? this.addGroup(name))),
        addressChanges: 0,
      };
      subscribers.set(subscriber.id, subscriber);
      return subscriber;
    },
    /** Answers the next `times` requests that match with an error. */
    fail(match: (request: FakeRequest) => boolean, status: number, times = 1) {
      failures.push({ match, status, times });
    },
  };
}

export type FakeMailerLite = ReturnType<typeof fakeMailerLite>;
