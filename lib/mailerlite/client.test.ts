// @vitest-environment node
// The requests the client sends MailerLite and how it reads the answers, with a stand-in for
// fetch. lib/mailerlite/sync.test.ts runs the client against a stand-in for the whole API.
import { describe, expect, it, vi } from "vitest";
import { parseServerEnv } from "@/lib/env/schema";
import { createMailerLiteClient, getMailerLiteClient, MailerLiteError } from "./client";

/** A client whose fetch answers every request with `status` and `body` (none for 204). */
function clientAnswering(status: number, body?: unknown) {
  const fetch = vi.fn<typeof globalThis.fetch>(async () =>
    body === undefined ? new Response(null, { status }) : Response.json(body, { status }),
  );
  const request = () => {
    expect(fetch).toHaveBeenCalledOnce();
    const [url, init] = fetch.mock.calls[0];
    return {
      url: new URL(String(url)),
      href: String(url),
      method: init?.method,
      headers: new Headers(init?.headers),
      body: init?.body ? JSON.parse(String(init.body)) : undefined,
    };
  };
  return { client: createMailerLiteClient({ apiKey: "test-api-key", fetch }), request };
}

const SUBSCRIBER = { data: { id: "31897397363737859", email: "ada.quinn@example.com" } };

describe("createMailerLiteClient", () => {
  it("sends the key and pins the API version on every request", async () => {
    const { client, request } = clientAnswering(200, { data: [] });

    await client.listGroups("Website: ");

    const { url, method, headers } = request();
    expect(method).toBe("GET");
    expect(url.origin + url.pathname).toBe("https://connect.mailerlite.com/api/groups");
    expect(url.searchParams.get("filter[name]")).toBe("Website: ");
    expect(url.searchParams.get("limit")).toBe("1000");
    expect(Object.fromEntries(headers)).toEqual({
      authorization: "Bearer test-api-key",
      accept: "application/json",
      "content-type": "application/json",
      "x-version": "2026-11-26",
      "user-agent": "obs-platform",
    });
  });

  it("lists and creates groups", async () => {
    const listed = clientAnswering(200, {
      data: [{ id: "1", name: "Website: Band members", active_count: 3 }],
    });
    expect(await listed.client.listGroups("Website: ")).toEqual([
      { id: "1", name: "Website: Band members" },
    ]);

    const created = clientAnswering(201, { data: { id: "2", name: "Website: Active members" } });
    expect(await created.client.createGroup("Website: Active members")).toEqual({
      id: "2",
      name: "Website: Active members",
    });
    expect(created.request()).toMatchObject({
      method: "POST",
      href: "https://connect.mailerlite.com/api/groups",
      body: { name: "Website: Active members" },
    });
  });

  it("adds a subscriber with the name and groups, and no status", async () => {
    const { client, request } = clientAnswering(201, SUBSCRIBER);

    expect(
      await client.upsertSubscriber({
        email: "ada.quinn@example.com",
        fields: { name: "Ada" },
        groups: ["1", "2"],
      }),
    ).toEqual({ id: "31897397363737859" });
    expect(request()).toMatchObject({
      method: "POST",
      href: "https://connect.mailerlite.com/api/subscribers",
      body: { email: "ada.quinn@example.com", fields: { name: "Ada" }, groups: ["1", "2"] },
    });
    expect(Object.keys(request().body).sort()).toEqual(["email", "fields", "groups"]);
  });

  it("lists every group when no name is given", async () => {
    const { client, request } = clientAnswering(200, { data: [{ id: "1", name: "Newsletter" }] });

    expect(await client.listGroups()).toEqual([{ id: "1", name: "Newsletter" }]);
    expect(request().url.searchParams.has("filter[name]")).toBe(false);
    expect(request().url.searchParams.get("limit")).toBe("1000");
  });

  it("sends a status or a resubscribe only when asked", async () => {
    const active = clientAnswering(200, SUBSCRIBER);
    await active.client.upsertSubscriber({
      email: "ada.quinn@example.com",
      fields: {},
      groups: ["7"],
      status: "active",
    });
    expect(active.request().body).toEqual({
      email: "ada.quinn@example.com",
      fields: {},
      groups: ["7"],
      status: "active",
    });

    const back = clientAnswering(200, SUBSCRIBER);
    await back.client.upsertSubscriber({
      email: "ada.quinn@example.com",
      fields: {},
      groups: ["7"],
      resubscribe: true,
    });
    expect(back.request().body).toEqual({
      email: "ada.quinn@example.com",
      fields: {},
      groups: ["7"],
      resubscribe: true,
    });
  });

  it("fetches a subscriber with their status and groups, and says when there's none", async () => {
    const found = clientAnswering(200, {
      data: {
        ...SUBSCRIBER.data,
        status: "unsubscribed",
        groups: [
          { id: "7", name: "Newsletter", active_count: 12 },
          { id: "8", name: "Event announcements", active_count: 9 },
        ],
      },
    });
    expect(await found.client.getSubscriber("ada+obs@example.com")).toEqual({
      id: "31897397363737859",
      email: "ada.quinn@example.com",
      status: "unsubscribed",
      groupIds: ["7", "8"],
    });
    const { url, method } = found.request();
    expect(method).toBe("GET");
    expect(url.pathname).toBe("/api/subscribers/ada%2Bobs%40example.com");
    expect(url.searchParams.get("include")).toBe("groups");

    const missing = clientAnswering(404, { message: "Resource not found." });
    expect(await missing.client.getSubscriber("nobody@example.com")).toBeNull();
  });

  it.each([
    ["without the list of groups", { ...SUBSCRIBER.data, status: "active" }],
    ["with a status it doesn't know", { ...SUBSCRIBER.data, status: "paused", groups: [] }],
    ["with a group that has no id", { ...SUBSCRIBER.data, status: "active", groups: [{}] }],
  ])("throws on a subscriber %s, rather than show them in no group", async (_case, data) => {
    const { client } = clientAnswering(200, { data });
    await expect(client.getSubscriber("31897397363737859")).rejects.toThrow(
      "MailerLite's answer to fetching a subscriber wasn't a subscriber with groups",
    );
  });

  it("finds a subscriber by address, and says when there's none", async () => {
    const found = clientAnswering(200, SUBSCRIBER);
    expect(await found.client.findSubscriber("ada+obs@example.com")).toEqual({
      id: "31897397363737859",
    });
    expect(found.request().url.pathname).toBe("/api/subscribers/ada%2Bobs%40example.com");

    const missing = clientAnswering(404, { message: "Resource not found." });
    expect(await missing.client.findSubscriber("nobody@example.com")).toBeNull();
  });

  it("changes a subscriber's address and name, and their groups one at a time", async () => {
    const updated = clientAnswering(200, SUBSCRIBER);
    await updated.client.updateSubscriber("31897", {
      email: "ada.q@example.com",
      fields: { name: "Ada", last_name: null },
    });
    expect(updated.request()).toMatchObject({
      method: "PUT",
      href: "https://connect.mailerlite.com/api/subscribers/31897",
      body: { email: "ada.q@example.com", fields: { name: "Ada", last_name: null } },
    });

    const added = clientAnswering(200, { data: { id: "5", name: "Website: Band members" } });
    await added.client.addToGroup("31897", "5");
    expect(added.request()).toMatchObject({
      method: "POST",
      href: "https://connect.mailerlite.com/api/subscribers/31897/groups/5",
      body: undefined,
    });

    const removed = clientAnswering(204);
    await removed.client.removeFromGroup("31897", "5");
    expect(removed.request()).toMatchObject({
      method: "DELETE",
      href: "https://connect.mailerlite.com/api/subscribers/31897/groups/5",
    });
  });

  it("takes removing a subscriber from a group they aren't in as done", async () => {
    const { client } = clientAnswering(404, { message: "" });
    await expect(client.removeFromGroup("31897", "5")).resolves.toBeUndefined();
  });

  it("throws MailerLite's status and message, never the address it was sent", async () => {
    const { client } = clientAnswering(422, {
      message: "The given data was invalid.",
      errors: { email: ["The email ada.quinn@example has to be a valid email address."] },
    });

    const error = await client.findSubscriber("ada.quinn@example").catch((e: unknown) => e);

    expect(error).toBeInstanceOf(MailerLiteError);
    expect(error).toMatchObject({
      status: 422,
      message: "MailerLite refused to find a subscriber (HTTP 422): The given data was invalid.",
    });
  });

  it("throws on an answer without what it should have", async () => {
    const { client } = clientAnswering(200, { data: { email: "ada.quinn@example.com" } });
    await expect(
      client.upsertSubscriber({ email: "ada.quinn@example.com", fields: {}, groups: [] }),
    ).rejects.toThrow("MailerLite's answer to adding a subscriber had no id");
  });
});

describe("getMailerLiteClient", () => {
  /** The variable as the app passes it: checked (and trimmed) by lib/env first. */
  const mailerLiteEnv = (value: string | undefined) =>
    parseServerEnv({ MAILERLITE_API_KEY: value }, ["MAILERLITE_API_KEY"]);

  it("is off without MAILERLITE_API_KEY", () => {
    expect(getMailerLiteClient({})).toBeNull();
    expect(getMailerLiteClient(mailerLiteEnv(undefined))).toBeNull();
    expect(getMailerLiteClient(mailerLiteEnv("  "))).toBeNull();
  });

  it("talks to the end-to-end tests' stand-in when MAILERLITE_API_URL_STAND_IN is set", async () => {
    const fetch = vi.spyOn(globalThis, "fetch").mockResolvedValue(Response.json({ data: [] }));
    try {
      const env = parseServerEnv(
        { MAILERLITE_API_KEY: "fake-key", MAILERLITE_API_URL_STAND_IN: "http://127.0.0.1:3500" },
        ["MAILERLITE_API_KEY", "MAILERLITE_API_URL_STAND_IN"],
      );
      await getMailerLiteClient(env)!.listGroups();
      expect(String(fetch.mock.calls[0][0])).toBe("http://127.0.0.1:3500/api/groups?limit=1000");
    } finally {
      fetch.mockRestore();
    }
  });

  it("uses MAILERLITE_API_KEY when it's set", async () => {
    const fetch = vi.spyOn(globalThis, "fetch").mockResolvedValue(Response.json({ data: [] }));
    try {
      await getMailerLiteClient(mailerLiteEnv(" test-api-key "))!.listGroups("Website: ");
      expect(new Headers(fetch.mock.calls[0][1]?.headers).get("authorization")).toBe(
        "Bearer test-api-key",
      );
    } finally {
      fetch.mockRestore();
    }
  });
});
