// @vitest-environment node
// The MailerLite group sync against a stand-in for MailerLite's API (./fake-api.ts) and a store
// kept in memory that works like the database: a run takes a member before working on them, and
// a member another run has taken can't be taken. supabase/tests/mailerlite_subscribers_test.sql
// tests the database's side; e2e/mailerlite-sync.spec.ts runs the sync against it.
import { describe, expect, it, vi } from "vitest";
import { createMailerLiteClient } from "./client";
import { FAKE_API_KEY, fakeMailerLite, type FakeMailerLite } from "./fake-api";
import {
  MEMBER_GROUPS,
  syncMailerLite,
  type MailerLiteStore,
  type MailerLiteSyncOptions,
  type Member,
  type SyncedMember,
} from "./sync";

const ACTIVE = MEMBER_GROUPS.active;
const EXPIRING = MEMBER_GROUPS.expiring;
const LAPSED = MEMBER_GROUPS.lapsed;
const INDIVIDUAL = MEMBER_GROUPS.individual;
const BAND = MEMBER_GROUPS.band;
const BUSINESS = MEMBER_GROUPS.business;
const SPONSOR = MEMBER_GROUPS.sponsor;

const ADA = "profile-ada";
const BO = "profile-bo";
const CY = "profile-cy";
const DI = "profile-di";

/** Four members: active, expiring, lapsed, and one who has never paid. */
function profiles(): Record<string, Member> {
  return {
    [ADA]: {
      email: "ada.quinn@example.com",
      firstName: "Ada",
      lastName: "Quinn",
      level: "band",
      status: "active",
    },
    [BO]: {
      email: "bo.reyes@example.com",
      firstName: "Bo",
      lastName: null,
      level: "sponsor",
      status: "expiring",
    },
    [CY]: {
      email: "cy.okafor@example.com",
      firstName: null,
      lastName: "Okafor",
      level: "individual",
      status: "lapsed",
    },
    [DI]: {
      email: "di.mercer@example.com",
      firstName: "Di",
      lastName: "Mercer",
      level: null,
      status: null,
    },
  };
}

/** A store in memory, over these profiles (change them to change the members). */
function memoryStore(members: Record<string, Member>) {
  const rows = new Map<string, { synced: SyncedMember | null; taken: boolean }>();
  const copy = <T>(value: T): T => structuredClone(value);
  const store = {
    members,
    rows,
    list: vi.fn<MailerLiteStore["list"]>(async (profileIds) => {
      const wanted = (id: string) => !profileIds || profileIds.includes(id);
      return {
        members: new Map(
          Object.entries(members)
            .filter(([id, m]) => wanted(id) && m.level && m.status)
            .map(([id, m]) => [id, copy(m)]),
        ),
        synced: new Map(
          [...rows].filter(([id]) => wanted(id)).map(([id, row]) => [id, copy(row.synced)]),
        ),
      };
    }),
    claim: vi.fn<MailerLiteStore["claim"]>(async (profileId) => {
      const row = rows.get(profileId);
      if (row?.taken) return null;
      if (row) row.taken = true;
      else rows.set(profileId, { synced: null, taken: true });
      return {
        member: copy(members[profileId] ?? null),
        synced: copy(rows.get(profileId)!.synced),
      };
    }),
    finish: vi.fn<MailerLiteStore["finish"]>(async (profileId, synced) => {
      if (synced) rows.set(profileId, { synced: copy(synced), taken: false });
      else rows.delete(profileId);
      return copy(members[profileId] ?? null);
    }),
    release: vi.fn<MailerLiteStore["release"]>(async (profileId) => {
      const row = rows.get(profileId);
      if (row) row.taken = false;
    }),
  };
  return store satisfies MailerLiteStore;
}

function sync(
  api: FakeMailerLite,
  store: MailerLiteStore,
  extra: Partial<MailerLiteSyncOptions> = {},
) {
  return syncMailerLite({
    client: createMailerLiteClient({ apiKey: FAKE_API_KEY, fetch: api.fetch }),
    store,
    ...extra,
  });
}

const NOTHING = { synced: 0, removed: 0, claimedElsewhere: 0, deferred: 0, failed: 0, errors: [] };

/** The requests made since `from`, as "METHOD path". */
const requestsSince = (api: FakeMailerLite, from: number) =>
  api.requests.slice(from).map(({ method, path }) => `${method} ${path.split("?")[0]}`);

describe("syncMailerLite", () => {
  it("puts each member in their status's group and, until it lapses, their level's group", async () => {
    const api = fakeMailerLite();
    const store = memoryStore(profiles());

    expect(await sync(api, store)).toEqual({ ...NOTHING, synced: 3 });

    expect([...api.groups.values()].sort()).toEqual(Object.values(MEMBER_GROUPS).sort());
    expect(api.membersOf(ACTIVE)).toEqual(["ada.quinn@example.com"]);
    expect(api.membersOf(EXPIRING)).toEqual(["bo.reyes@example.com"]);
    expect(api.membersOf(LAPSED)).toEqual(["cy.okafor@example.com"]);
    expect(api.membersOf(BAND)).toEqual(["ada.quinn@example.com"]);
    expect(api.membersOf(SPONSOR)).toEqual(["bo.reyes@example.com"]);
    // Cy's membership lapsed: in the lapsed group only, not the Individual members'.
    expect(api.membersOf(INDIVIDUAL)).toEqual([]);
    expect(api.membersOf(BUSINESS)).toEqual([]);
    // Di has never paid: not sent to MailerLite at all.
    expect(api.subscriber("di.mercer@example.com")).toBeUndefined();
    expect(api.subscriber("ada.quinn@example.com")?.fields).toEqual({
      name: "Ada",
      last_name: "Quinn",
    });
    expect(api.subscriber("bo.reyes@example.com")?.fields).toEqual({ name: "Bo" });
    // What MailerLite was given is recorded, and nobody is left taken.
    expect(store.rows.get(ADA)).toEqual({
      synced: {
        subscriberId: api.subscriber("ada.quinn@example.com")?.id,
        email: "ada.quinn@example.com",
        firstName: "Ada",
        lastName: "Quinn",
        groupIds: [api.groupId(ACTIVE), api.groupId(BAND)],
      },
      taken: false,
    });
    expect([...store.rows.keys()].sort()).toEqual([ADA, BO, CY]);
  });

  it("changes nothing when it runs again: its one request lists the groups", async () => {
    const api = fakeMailerLite();
    const store = memoryStore(profiles());
    await sync(api, store);
    const before = api.requests.length;

    expect(await sync(api, store)).toEqual(NOTHING);

    expect(requestsSince(api, before)).toEqual(["GET groups"]);
    expect(store.claim).toHaveBeenCalledTimes(3);
  });

  it("makes the member groups that are missing and uses the ones that exist", async () => {
    const api = fakeMailerLite();
    const band = api.addGroup(BAND);
    api.addGroup("Newsletter");

    await sync(api, memoryStore(profiles()));

    expect(api.groupId(BAND)).toBe(band);
    expect(api.requests.filter((r) => r.method === "POST" && r.path === "groups")).toHaveLength(6);
    expect(api.groups.size).toBe(8);
  });

  it("moves members between groups when their status or level changes", async () => {
    const api = fakeMailerLite();
    const store = memoryStore(profiles());
    await sync(api, store);
    const ids = new Map([...api.subscribers.values()].map((s) => [s.email, s.id]));
    store.members[ADA].status = "expiring";
    store.members[BO].status = "lapsed";
    Object.assign(store.members[CY], { status: "active", level: "business" });
    const before = api.requests.length;

    expect(await sync(api, store)).toEqual({ ...NOTHING, synced: 3 });

    expect(api.membersOf(ACTIVE)).toEqual(["cy.okafor@example.com"]);
    expect(api.membersOf(EXPIRING)).toEqual(["ada.quinn@example.com"]);
    expect(api.membersOf(LAPSED)).toEqual(["bo.reyes@example.com"]);
    expect(api.membersOf(BAND)).toEqual(["ada.quinn@example.com"]);
    expect(api.membersOf(BUSINESS)).toEqual(["cy.okafor@example.com"]);
    expect(api.membersOf(SPONSOR)).toEqual([]);
    // The same subscribers, moved by their MailerLite id: no new ones.
    expect(new Map([...api.subscribers.values()].map((s) => [s.email, s.id]))).toEqual(ids);
    expect(requestsSince(api, before).filter((r) => r === "POST subscribers")).toEqual([]);
  });

  it("takes people out of every member group once they aren't members, and leaves the rest", async () => {
    const api = fakeMailerLite();
    api.addSubscriber("ada.quinn@example.com", "active", ["Newsletter"]);
    const store = memoryStore(profiles());
    await sync(api, store);
    // Ada's payment is refunded and Bo's account deleted.
    Object.assign(store.members[ADA], { level: null, status: null });
    delete store.members[BO];

    expect(await sync(api, store)).toEqual({ ...NOTHING, removed: 2 });

    for (const name of Object.values(MEMBER_GROUPS)) {
      expect(api.membersOf(name)).not.toContain("ada.quinn@example.com");
      expect(api.membersOf(name)).not.toContain("bo.reyes@example.com");
    }
    // They stay in MailerLite, as they were, in the groups that aren't the website's.
    expect(api.membersOf("Newsletter")).toEqual(["ada.quinn@example.com"]);
    expect(api.subscriber("ada.quinn@example.com")?.status).toBe("active");
    expect(api.subscriber("bo.reyes@example.com")).toBeDefined();
    expect([...store.rows.keys()]).toEqual([CY]);
  });

  it("never sends a status: unsubscribed people stay so, and new ones get the account's default", async () => {
    const api = fakeMailerLite({ doubleOptIn: true });
    api.addSubscriber("ada.quinn@example.com", "unsubscribed", ["Newsletter"]);
    api.addSubscriber("cy.okafor@example.com", "bounced");

    expect(await sync(api, memoryStore(profiles()))).toEqual({ ...NOTHING, synced: 3 });

    const ada = api.subscriber("ada.quinn@example.com");
    expect(ada?.status).toBe("unsubscribed");
    expect(api.membersOf(ACTIVE)).toEqual(["ada.quinn@example.com"]);
    expect(api.membersOf(BAND)).toEqual(["ada.quinn@example.com"]);
    expect(api.membersOf("Newsletter")).toEqual(["ada.quinn@example.com"]);
    expect(ada?.fields).toEqual({ name: "Ada", last_name: "Quinn" });
    expect(api.subscriber("cy.okafor@example.com")?.status).toBe("bounced");
    expect(api.membersOf(LAPSED)).toEqual(["cy.okafor@example.com"]);
    // With double opt-in, MailerLite asks a new subscriber to confirm, as for its own forms.
    expect(api.subscriber("bo.reyes@example.com")?.status).toBe("unconfirmed");
    for (const { body } of api.requests) {
      expect(body ?? {}).not.toHaveProperty("status");
      expect(body ?? {}).not.toHaveProperty("resubscribe");
    }
  });

  it("gives MailerLite a member's new address and name", async () => {
    const api = fakeMailerLite();
    const store = memoryStore(profiles());
    await sync(api, store);
    const id = api.subscriber("ada.quinn@example.com")?.id;
    // A new address and name; a first name alone; a last name taken away.
    Object.assign(store.members[ADA], { email: "ada.q@example.com", firstName: "Adaline" });
    Object.assign(store.members[BO], { firstName: "Bonnie" });
    Object.assign(store.members[CY], { lastName: null });

    expect(await sync(api, store)).toEqual({ ...NOTHING, synced: 3 });

    const ada = api.subscriber("ada.q@example.com");
    expect(ada?.id).toBe(id);
    expect(ada?.fields).toEqual({ name: "Adaline", last_name: "Quinn" });
    expect(api.subscriber("ada.quinn@example.com")).toBeUndefined();
    expect(api.membersOf(ACTIVE)).toEqual(["ada.q@example.com"]);
    expect(api.subscriber("bo.reyes@example.com")?.fields).toEqual({
      name: "Bonnie",
      last_name: null,
    });
    expect(api.subscriber("cy.okafor@example.com")?.fields).toEqual({
      name: null,
      last_name: null,
    });
  });

  it("adds a member under their new address when MailerLite won't move the old subscriber", async () => {
    const api = fakeMailerLite();
    const store = memoryStore(profiles());
    await sync(api, store);
    // The new address is already a subscriber, from MailerLite's own sign-up form.
    api.addSubscriber("ada.q@example.com", "active", ["Newsletter"]);
    store.members[ADA].email = "ada.q@example.com";

    expect(await sync(api, store)).toEqual({ ...NOTHING, synced: 1 });

    expect(api.membersOf(ACTIVE)).toEqual(["ada.q@example.com"]);
    expect(api.membersOf(BAND)).toEqual(["ada.q@example.com"]);
    expect(api.membersOf("Newsletter")).toEqual(["ada.q@example.com"]);
    // The old subscriber is out of the member groups, and otherwise left alone.
    expect(api.subscriber("ada.quinn@example.com")?.groups.size).toBe(0);
    expect(store.rows.get(ADA)?.synced?.subscriberId).toBe(api.subscriber("ada.q@example.com")?.id);
  });

  it("adds a member again when their subscriber was deleted in MailerLite", async () => {
    const api = fakeMailerLite();
    const store = memoryStore(profiles());
    await sync(api, store);
    api.subscribers.delete(api.subscriber("ada.quinn@example.com")!.id);
    store.members[ADA].status = "expiring";

    expect(await sync(api, store)).toEqual({ ...NOTHING, synced: 1 });

    expect(api.membersOf(EXPIRING)).toEqual(["ada.quinn@example.com", "bo.reyes@example.com"]);
    expect(api.membersOf(BAND)).toEqual(["ada.quinn@example.com"]);
  });

  it("makes a member group again, with its members, when it was deleted in MailerLite", async () => {
    const api = fakeMailerLite();
    const store = memoryStore(profiles());
    await sync(api, store);
    const band = api.groupId(BAND)!;
    api.groups.delete(band);
    for (const subscriber of api.subscribers.values()) subscriber.groups.delete(band);

    expect(await sync(api, store)).toEqual({ ...NOTHING, synced: 1 });

    expect(api.groupId(BAND)).not.toBe(band);
    expect(api.membersOf(BAND)).toEqual(["ada.quinn@example.com"]);
  });

  it("syncs only the members it's given, after a change to them", async () => {
    const api = fakeMailerLite();
    const store = memoryStore(profiles());

    expect(await sync(api, store, { profileIds: [ADA, DI] })).toEqual({ ...NOTHING, synced: 1 });

    expect([...api.subscribers.values()].map((s) => s.email)).toEqual(["ada.quinn@example.com"]);
    expect(store.list).toHaveBeenCalledWith([ADA, DI]);
  });

  it("leaves a member another run is syncing to that run", async () => {
    const api = fakeMailerLite();
    const store = memoryStore(profiles());
    store.rows.set(BO, { synced: null, taken: true });

    expect(await sync(api, store)).toEqual({ ...NOTHING, synced: 2, claimedElsewhere: 1 });

    expect(api.subscriber("bo.reyes@example.com")).toBeUndefined();
  });

  it("goes round again when a member changes while it syncs them", async () => {
    const api = fakeMailerLite();
    const store = memoryStore(profiles());
    const finish = store.finish.getMockImplementation()!;
    // Ada renews at a new level just as the first pass records what it did.
    store.finish.mockImplementationOnce(async (profileId, synced) => {
      Object.assign(store.members[ADA], { level: "business", status: "active" });
      return finish(profileId, synced);
    });

    expect(await sync(api, store, { profileIds: [ADA] })).toEqual({ ...NOTHING, synced: 1 });

    expect(api.membersOf(BUSINESS)).toEqual(["ada.quinn@example.com"]);
    expect(api.membersOf(BAND)).toEqual([]);
    expect(store.claim).toHaveBeenCalledTimes(2);
    expect(store.rows.get(ADA)?.taken).toBe(false);
  });

  it("starts no request after the deadline and leaves the rest for the next run", async () => {
    const api = fakeMailerLite();
    const store = memoryStore(profiles());
    // The clock moves one step per request: listing the groups and making them takes 8.
    const clock = () => api.requests.length;

    expect(await sync(api, store, { clock, deadline: 9 })).toEqual({
      ...NOTHING,
      synced: 1,
      deferred: 2,
    });
    expect([...api.subscribers.values()].map((s) => s.email)).toEqual(["ada.quinn@example.com"]);
    expect(store.release).toHaveBeenCalledExactlyOnceWith(BO);

    expect(await sync(api, store)).toEqual({ ...NOTHING, synced: 2 });
    expect(api.membersOf(LAPSED)).toEqual(["cy.okafor@example.com"]);
  });

  it("stops without an error when MailerLite asks it to slow down", async () => {
    const api = fakeMailerLite();
    const store = memoryStore(profiles());
    api.fail((r) => r.method === "POST" && r.path === "subscribers", 429);

    expect(await sync(api, store)).toEqual({ ...NOTHING, deferred: 3 });
    expect(await sync(api, store)).toEqual({ ...NOTHING, synced: 3 });
  });

  it("goes on with the others when MailerLite refuses a member, and logs no address", async () => {
    const api = fakeMailerLite();
    const members = profiles();
    members[ADA].email = "ada.quinn@localhost";
    const store = memoryStore(members);

    const summary = await sync(api, store);

    expect(summary).toEqual({
      ...NOTHING,
      synced: 2,
      failed: 1,
      errors: [
        "MailerLite sync: syncing profile profile-ada failed: MailerLite refused to add a subscriber (HTTP 422): The given data was invalid.",
      ],
    });
    // Ada stays due: her row has no subscriber, and nobody holds her.
    expect(store.rows.get(ADA)).toEqual({ synced: null, taken: false });
  });

  it("stops at an error that isn't about one member", async () => {
    const api = fakeMailerLite();
    const store = memoryStore(profiles());
    api.fail((r) => r.method === "POST" && r.path === "subscribers", 503, Infinity);

    expect(await sync(api, store)).toEqual({
      ...NOTHING,
      failed: 1,
      deferred: 2,
      errors: [
        "MailerLite sync: syncing profile profile-ada failed: MailerLite refused to add a subscriber (HTTP 503): Server Error",
      ],
    });

    const refused = await syncMailerLite({
      client: createMailerLiteClient({ apiKey: "a-revoked-key", fetch: api.fetch }),
      store,
    });
    expect(refused).toEqual({
      ...NOTHING,
      errors: [
        "MailerLite sync: finding or making the member groups failed: MailerLite refused to list the groups (HTTP 401): Unauthenticated.",
      ],
    });
  });

  it("calls nobody while there are no members", async () => {
    const api = fakeMailerLite();
    const members = profiles();

    expect(await sync(api, memoryStore({ [DI]: members[DI] }))).toEqual(NOTHING);
    expect(api.requests).toEqual([]);
  });

  it("reports a failure to read the members, without throwing", async () => {
    const api = fakeMailerLite();
    const store = memoryStore(profiles());
    store.list.mockRejectedValueOnce(new Error("Reading profiles: PGRST000 connection refused"));

    expect(await sync(api, store)).toEqual({
      ...NOTHING,
      errors: [
        "MailerLite sync: reading the members failed: Reading profiles: PGRST000 connection refused",
      ],
    });
    expect(api.requests).toEqual([]);
  });
});
