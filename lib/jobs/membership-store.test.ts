// @vitest-environment node
// The requests the store makes to Supabase's Data API, with a stand-in for fetch. e2e/daily-jobs.spec.ts
// runs the store against the local database.
import { createClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";
import type { DueMembershipEmail } from "./daily";
import { createMembershipStore } from "./membership-store";

const NOW = new Date("2026-11-26T13:00:00Z");

const DUE: DueMembershipEmail = {
  profileId: "00000000-0000-4000-8100-000000000011",
  kind: "renewal_reminder",
  expiresAt: "2026-12-26T18:00:00+00:00",
  email: "bev.grant@example.com",
  firstName: "Bev",
  level: "individual",
};

/** A store whose Data API answers every request with `status` and `body` (none for 204). */
function storeAnswering(status: number, body: unknown) {
  const fetch = vi.fn<typeof globalThis.fetch>(async () =>
    status === 204 ? new Response(null, { status }) : Response.json(body, { status }),
  );
  const client = createClient("http://127.0.0.1:54321", "test-service-key", {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch },
  });
  const request = () => {
    expect(fetch).toHaveBeenCalledOnce();
    const [url, init] = fetch.mock.calls[0];
    return {
      url: new URL(String(url)),
      method: init?.method,
      headers: new Headers(init?.headers),
      body: init?.body ? JSON.parse(String(init.body)) : undefined,
    };
  };
  return { store: createMembershipStore(client), request };
}

describe("createMembershipStore", () => {
  it("refreshes the statuses as of the run's time and counts the moves", async () => {
    const { store, request } = storeAnswering(200, [
      { new_status: "expiring", members: 2 },
      { new_status: "lapsed", members: 1 },
    ]);

    expect(await store.refreshStatuses(NOW)).toEqual({ expiring: 2, lapsed: 1 });
    const sent = request();
    expect(sent.method).toBe("POST");
    expect(sent.url.pathname).toBe("/rest/v1/rpc/refresh_membership_statuses");
    expect(sent.body).toEqual({ p_now: "2026-11-26T13:00:00.000Z" });
  });

  it("lists the emails due as of the run's time", async () => {
    const { store, request } = storeAnswering(200, [
      {
        profile_id: DUE.profileId,
        kind: DUE.kind,
        expires_at: DUE.expiresAt,
        email: DUE.email,
        first_name: DUE.firstName,
        level: DUE.level,
      },
      {
        ...{ profile_id: "p2", kind: "membership_lapsed", expires_at: "2026-11-12T18:00:00+00:00" },
        email: "lena.park@example.com",
        first_name: null,
        level: "band",
      },
    ]);

    expect(await store.dueEmails(NOW)).toEqual([
      DUE,
      {
        profileId: "p2",
        kind: "membership_lapsed",
        expiresAt: "2026-11-12T18:00:00+00:00",
        email: "lena.park@example.com",
        firstName: null,
        level: "band",
      },
    ]);
    const sent = request();
    expect(sent.url.pathname).toBe("/rest/v1/rpc/due_membership_emails");
    expect(sent.body).toEqual({ p_now: "2026-11-26T13:00:00.000Z" });
  });

  it("refuses a due email it couldn't send, rather than guessing", async () => {
    const { store } = storeAnswering(200, [
      {
        profile_id: DUE.profileId,
        kind: "welcome",
        expires_at: DUE.expiresAt,
        email: DUE.email,
        first_name: null,
        level: "band",
      },
    ]);

    await expect(store.dueEmails(NOW)).rejects.toThrow(
      `due_membership_emails returned a row it shouldn't: ${DUE.profileId}`,
    );
  });

  it("claims an email with an insert that skips an existing claim", async () => {
    const { store, request } = storeAnswering(201, [{ id: 7 }]);

    expect(await store.claim(DUE)).toBe(7);
    const sent = request();
    expect(sent.method).toBe("POST");
    expect(sent.url.pathname).toBe("/rest/v1/membership_emails");
    expect(sent.url.searchParams.get("on_conflict")).toBe("profile_id,kind,expires_at");
    expect(sent.url.searchParams.get("select")).toBe("id");
    expect(sent.headers.get("prefer")).toContain("resolution=ignore-duplicates");
    expect(sent.headers.get("prefer")).toContain("return=representation");
    expect(sent.body).toEqual({
      profile_id: DUE.profileId,
      kind: "renewal_reminder",
      expires_at: "2026-12-26T18:00:00+00:00",
    });
  });

  it("gets no claim when another run already has the email", async () => {
    const { store } = storeAnswering(201, []);

    expect(await store.claim(DUE)).toBeNull();
  });

  it("records a sent email on its claim", async () => {
    const { store, request } = storeAnswering(204, null);

    await store.markSent(
      7,
      "49a3999c-0ce1-4ea6-ab68-afcd6dc2e794",
      new Date("2026-11-26T13:00:02Z"),
    );

    const sent = request();
    expect(sent.method).toBe("PATCH");
    expect(sent.url.searchParams.get("id")).toBe("eq.7");
    expect(sent.body).toEqual({
      sent_at: "2026-11-26T13:00:02.000Z",
      provider_id: "49a3999c-0ce1-4ea6-ab68-afcd6dc2e794",
    });
  });

  it("releases a claim by deleting its row", async () => {
    const { store, request } = storeAnswering(204, null);

    await store.release(7);

    const sent = request();
    expect(sent.method).toBe("DELETE");
    expect(sent.url.pathname).toBe("/rest/v1/membership_emails");
    expect(sent.url.searchParams.get("id")).toBe("eq.7");
  });

  it("throws the database's error code and message", async () => {
    const { store } = storeAnswering(403, {
      code: "42501",
      message: "permission denied for function due_membership_emails",
    });

    await expect(store.dueEmails(NOW)).rejects.toThrow(
      "due_membership_emails: 42501 permission denied for function due_membership_emails",
    );
  });
});
