// @vitest-environment node
// The two lists (Newsletter, Event announcements) against a stand-in for MailerLite's API
// (./fake-api.ts): the blog's signup box and the email switches on My Account.
import { describe, expect, it } from "vitest";
import { createMailerLiteClient } from "./client";
import { FAKE_API_KEY, fakeMailerLite, type FakeMailerLite } from "./fake-api";
import {
  findTopicGroups,
  readEmailChoices,
  saveEmailChoices,
  subscribeToNewsletter,
  TOPIC_GROUPS,
  type EmailChoices,
} from "./topics";

const NEWSLETTER = TOPIC_GROUPS.newsletter;
const EVENTS = TOPIC_GROUPS.events;
const ADA = "ada.quinn@example.com";

const clientFor = (api: FakeMailerLite) =>
  createMailerLiteClient({ apiKey: FAKE_API_KEY, fetch: api.fetch });

/** The names of the groups a subscriber is in, sorted. */
const groupsOf = (api: FakeMailerLite, email: string) =>
  [...(api.subscriber(email)?.groups ?? [])].map((id) => api.groups.get(id)).sort();

/** Every request's body had neither a status nor a resubscribe. */
const sentNoStatus = (api: FakeMailerLite) =>
  api.requests.every(({ body }) => !body || (!("status" in body) && !("resubscribe" in body)));

describe("findTopicGroups", () => {
  it("finds the lists' groups by their exact names, in one request", async () => {
    const api = fakeMailerLite();
    api.addGroup("Newsletter archive 2019");
    const newsletter = api.addGroup(NEWSLETTER);

    expect(await findTopicGroups(clientFor(api))).toEqual({ newsletter });
    expect(api.requests.map((r) => `${r.method} ${r.path}`)).toEqual(["GET groups?limit=1000"]);
  });

  it("makes only the missing groups it's asked to", async () => {
    const api = fakeMailerLite();

    const ids = await findTopicGroups(clientFor(api), ["events"]);

    expect(ids).toEqual({ events: api.groupId(EVENTS) });
    expect([...api.groups.values()]).toEqual([EVENTS]);
  });

  it("uses the group someone else just made", async () => {
    const api = fakeMailerLite();
    // The group appears between the listing and the attempt to make it.
    const listed = api.fetch;
    let made: string | undefined;
    const fetch: typeof globalThis.fetch = async (input, init) => {
      if (init?.method === "POST" && String(input).endsWith("/groups"))
        made ??= api.addGroup(EVENTS);
      return listed(input, init);
    };

    const ids = await findTopicGroups(createMailerLiteClient({ apiKey: FAKE_API_KEY, fetch }), [
      "events",
    ]);

    expect(ids).toEqual({ events: made });
    expect(api.groups.size).toBe(1);
  });
});

describe("subscribeToNewsletter", () => {
  it("adds a new address to the Newsletter group, and MailerLite asks it to confirm", async () => {
    const api = fakeMailerLite({ doubleOptIn: true });

    expect(await subscribeToNewsletter(clientFor(api), ADA)).toBe("added");

    expect(api.membersOf(NEWSLETTER)).toEqual([ADA]);
    expect(api.subscriber(ADA)?.status).toBe("unconfirmed");
    expect(api.confirmationEmails).toEqual([ADA]);
    // The group is made the first time; Event announcements isn't the box's.
    expect([...api.groups.values()]).toEqual([NEWSLETTER]);
    expect(sentNoStatus(api)).toBe(true);
  });

  it("adds someone MailerLite has to the group as they are", async () => {
    const api = fakeMailerLite({ doubleOptIn: true });
    api.addSubscriber(ADA, "active", ["Website: Band members"]);

    expect(await subscribeToNewsletter(clientFor(api), ADA)).toBe("added");

    expect(groupsOf(api, ADA)).toEqual([NEWSLETTER, "Website: Band members"]);
    expect(api.subscriber(ADA)?.status).toBe("active");
    expect(api.confirmationEmails).toEqual([]);
  });

  it.each(["unsubscribed", "bounced", "junk"] as const)(
    "never brings back someone who's %s, and doesn't say so",
    async (status) => {
      const api = fakeMailerLite({ doubleOptIn: true });
      api.addSubscriber(ADA, status);

      expect(await subscribeToNewsletter(clientFor(api), ADA)).toBe("refused");

      expect(api.subscriber(ADA)?.status).toBe(status);
      expect(groupsOf(api, ADA)).toEqual([]);
      expect(sentNoStatus(api)).toBe(true);
    },
  );

  it("takes an address MailerLite refuses as refused", async () => {
    const api = fakeMailerLite();
    expect(await subscribeToNewsletter(clientFor(api), "ada.quinn@localhost")).toBe("refused");
    expect(api.subscribers.size).toBe(0);
  });

  it("throws when MailerLite can't take it", async () => {
    const api = fakeMailerLite();
    api.fail((r) => r.method === "POST" && r.path === "subscribers", 500);

    await expect(subscribeToNewsletter(clientFor(api), ADA)).rejects.toThrow(
      "MailerLite refused to add a subscriber (HTTP 500)",
    );
  });
});

describe("readEmailChoices", () => {
  const member = { email: ADA, subscriberId: null };
  const both = (newsletter: boolean, events: boolean): EmailChoices => ({ newsletter, events });

  it("shows both off for someone MailerLite doesn't have, and makes no group", async () => {
    const api = fakeMailerLite();

    expect(await readEmailChoices(clientFor(api), member)).toEqual({
      choices: both(false, false),
      paused: false,
    });
    expect(api.groups.size).toBe(0);
  });

  it("shows the lists an active subscriber is on", async () => {
    const api = fakeMailerLite();
    api.addSubscriber(ADA, "active", [NEWSLETTER, "Website: Active members"]);
    api.addGroup(EVENTS);

    expect(await readEmailChoices(clientFor(api), member)).toEqual({
      choices: both(true, false),
      paused: false,
    });
  });

  it.each(["unconfirmed", "unsubscribed", "bounced", "junk"] as const)(
    "shows both off, and paused, for someone who's %s, as nothing reaches them",
    async (status) => {
      const api = fakeMailerLite();
      api.addSubscriber(ADA, status, [NEWSLETTER, EVENTS]);

      expect(await readEmailChoices(clientFor(api), member)).toEqual({
        choices: both(false, false),
        paused: true,
      });
    },
  );

  it("finds the member by their subscriber id first, whatever their address in MailerLite", async () => {
    const api = fakeMailerLite();
    // Ada changed her address in MailerLite's preference center.
    const ada = api.addSubscriber("ada.q@example.com", "active", [EVENTS]);

    expect(await readEmailChoices(clientFor(api), { email: ADA, subscriberId: ada.id })).toEqual({
      choices: both(false, true),
      paused: false,
    });
  });

  it("finds the member by address when their subscriber was deleted", async () => {
    const api = fakeMailerLite();
    api.addSubscriber(ADA, "active", [NEWSLETTER]);

    expect(await readEmailChoices(clientFor(api), { email: ADA, subscriberId: "999" })).toEqual({
      choices: both(true, false),
      paused: false,
    });
  });

  it("throws when MailerLite can't be reached", async () => {
    const api = fakeMailerLite();
    api.fail((r) => r.method === "GET" && r.path.startsWith("subscribers/"), 503);

    await expect(readEmailChoices(clientFor(api), member)).rejects.toThrow("HTTP 503");
  });
});

describe("saveEmailChoices", () => {
  const member = { email: ADA, subscriberId: null };

  it("adds a member MailerLite doesn't have, active at once: signing in showed the address is theirs", async () => {
    const api = fakeMailerLite({ doubleOptIn: true });

    const saved = await saveEmailChoices(clientFor(api), member, {
      newsletter: true,
      events: true,
    });

    expect(saved).toEqual({ choices: { newsletter: true, events: true }, paused: false });
    expect(api.subscriber(ADA)?.status).toBe("active");
    expect(groupsOf(api, ADA)).toEqual([EVENTS, NEWSLETTER]);
    expect(api.confirmationEmails).toEqual([]);
    expect(await readEmailChoices(clientFor(api), member)).toEqual(saved);
  });

  it("takes a member off a list and leaves the rest as it was", async () => {
    const api = fakeMailerLite();
    api.addSubscriber(ADA, "active", [NEWSLETTER, EVENTS, "Website: Band members"]);

    const saved = await saveEmailChoices(clientFor(api), member, {
      newsletter: true,
      events: false,
    });

    expect(saved).toEqual({ choices: { newsletter: true, events: false }, paused: false });
    expect(groupsOf(api, ADA)).toEqual([NEWSLETTER, "Website: Band members"]);
    expect(api.subscriber(ADA)?.status).toBe("active");
  });

  it("takes a member off both lists and changes nothing else", async () => {
    const api = fakeMailerLite();
    api.addSubscriber(ADA, "active", [NEWSLETTER, EVENTS, "Website: Band members"]);

    const saved = await saveEmailChoices(clientFor(api), member, {
      newsletter: false,
      events: false,
    });

    expect(saved).toEqual({ choices: { newsletter: false, events: false }, paused: false });
    expect(groupsOf(api, ADA)).toEqual(["Website: Band members"]);
    expect(api.subscriber(ADA)?.status).toBe("active");
    expect(sentNoStatus(api)).toBe(true);
  });

  it.each(["unsubscribed", "bounced", "junk"] as const)(
    "brings back a member who's %s when they choose a list: they asked to",
    async (status) => {
      const api = fakeMailerLite();
      api.addSubscriber(ADA, status, [NEWSLETTER, EVENTS]);

      const saved = await saveEmailChoices(clientFor(api), member, {
        newsletter: true,
        events: false,
      });

      expect(saved).toEqual({ choices: { newsletter: true, events: false }, paused: false });
      expect(api.subscriber(ADA)?.status).toBe("active");
      expect(groupsOf(api, ADA)).toEqual([NEWSLETTER]);
      const upsert = api.requests.find((r) => r.method === "POST" && r.path === "subscribers");
      expect(upsert?.body).toMatchObject({ email: ADA, resubscribe: true });
      expect(upsert?.body).not.toHaveProperty("status");
    },
  );

  it("leaves a member who unsubscribed so when they choose neither list", async () => {
    const api = fakeMailerLite();
    api.addSubscriber(ADA, "unsubscribed", [NEWSLETTER]);

    const saved = await saveEmailChoices(clientFor(api), member, {
      newsletter: false,
      events: false,
    });

    expect(saved).toEqual({ choices: { newsletter: false, events: false }, paused: true });
    expect(api.subscriber(ADA)?.status).toBe("unsubscribed");
    expect(groupsOf(api, ADA)).toEqual([]);
    expect(sentNoStatus(api)).toBe(true);
  });

  it("makes an unconfirmed member active when they choose a list", async () => {
    const api = fakeMailerLite();
    api.addSubscriber(ADA, "unconfirmed", [NEWSLETTER]);

    await saveEmailChoices(clientFor(api), member, { newsletter: false, events: true });

    expect(api.subscriber(ADA)?.status).toBe("active");
    expect(groupsOf(api, ADA)).toEqual([EVENTS]);
  });

  it("changes the member's own subscriber, under their address in MailerLite", async () => {
    const api = fakeMailerLite();
    const ada = api.addSubscriber("ada.q@example.com", "unsubscribed", [EVENTS]);

    await saveEmailChoices(
      clientFor(api),
      { email: ADA, subscriberId: ada.id },
      { newsletter: true, events: false },
    );

    expect(api.subscribers.size).toBe(1);
    expect(ada.status).toBe("active");
    expect(groupsOf(api, "ada.q@example.com")).toEqual([NEWSLETTER]);
  });

  it("does nothing for someone MailerLite doesn't have who chooses neither list", async () => {
    const api = fakeMailerLite();

    const saved = await saveEmailChoices(clientFor(api), member, {
      newsletter: false,
      events: false,
    });

    expect(saved).toEqual({ choices: { newsletter: false, events: false }, paused: false });
    expect(api.subscribers.size).toBe(0);
    expect(api.groups.size).toBe(0);
    expect(api.requests.every((r) => r.method === "GET")).toBe(true);
  });

  it("throws when MailerLite refuses", async () => {
    const api = fakeMailerLite();
    api.fail((r) => r.method === "POST" && r.path === "subscribers", 500);

    await expect(
      saveEmailChoices(clientFor(api), member, { newsletter: true, events: true }),
    ).rejects.toThrow("HTTP 500");
  });
});
