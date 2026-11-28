// @vitest-environment node
// The requests the listing store makes to Supabase's Data API, with a stand-in for fetch.
// e2e/daily-jobs.spec.ts runs the store against the local database.
import { createClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";
import { createListingStore } from "./listing-store";
import type { DueListingReminder } from "./listings";

const NOW = new Date("2026-11-26T13:00:00Z");

const DUE: DueListingReminder = {
  listingId: "00000000-0000-4000-8200-000000000002",
  expiresAt: "2026-11-30T22:41:07.123+00:00",
  title: "Vocalist available for weekend gigs",
  email: "tasha.moore@example.com",
  firstName: "Tasha",
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
  return { store: createListingStore(client), request };
}

describe("createListingStore", () => {
  it("takes down the listings whose time is up as of the run's time, and counts them", async () => {
    const { store, request } = storeAnswering(200, 3);

    expect(await store.expire(NOW)).toBe(3);
    const sent = request();
    expect(sent.method).toBe("POST");
    expect(sent.url.pathname).toBe("/rest/v1/rpc/expire_listings");
    expect(sent.body).toEqual({ p_now: "2026-11-26T13:00:00.000Z" });
  });

  it("refuses an answer without a count", async () => {
    const { store } = storeAnswering(200, null);

    await expect(store.expire(NOW)).rejects.toThrow("expire_listings returned no count");
  });

  it("lists the reminders due as of the run's time", async () => {
    const { store, request } = storeAnswering(200, [
      {
        listing_id: DUE.listingId,
        expires_at: DUE.expiresAt,
        title: DUE.title,
        email: DUE.email,
        first_name: DUE.firstName,
      },
      {
        ...{ listing_id: "l2", expires_at: "2026-12-01T18:00:00+00:00", title: "Drum kit" },
        ...{ email: "dale.ramsey@example.com", first_name: null },
      },
    ]);

    expect(await store.dueReminders(NOW)).toEqual([
      DUE,
      {
        listingId: "l2",
        expiresAt: "2026-12-01T18:00:00+00:00",
        title: "Drum kit",
        email: "dale.ramsey@example.com",
        firstName: null,
      },
    ]);
    const sent = request();
    expect(sent.url.pathname).toBe("/rest/v1/rpc/due_listing_reminders");
    expect(sent.body).toEqual({ p_now: "2026-11-26T13:00:00.000Z" });
  });

  it("refuses a due reminder it couldn't send, rather than guessing", async () => {
    const { store } = storeAnswering(200, [
      { listing_id: DUE.listingId, expires_at: DUE.expiresAt, title: DUE.title, email: null },
    ]);

    await expect(store.dueReminders(NOW)).rejects.toThrow(
      `due_listing_reminders returned a row it shouldn't: ${DUE.listingId}`,
    );
  });

  it("claims a reminder with an insert that skips an existing claim", async () => {
    const { store, request } = storeAnswering(201, [{ id: 7 }]);

    expect(await store.claim(DUE)).toBe(7);
    const sent = request();
    expect(sent.method).toBe("POST");
    expect(sent.url.pathname).toBe("/rest/v1/listing_reminders");
    expect(sent.url.searchParams.get("on_conflict")).toBe("listing_id,expires_at");
    expect(sent.url.searchParams.get("select")).toBe("id");
    expect(sent.headers.get("prefer")).toContain("resolution=ignore-duplicates");
    expect(sent.headers.get("prefer")).toContain("return=representation");
    expect(sent.body).toEqual({ listing_id: DUE.listingId, expires_at: DUE.expiresAt });
  });

  it("gets no claim when another run already has the reminder", async () => {
    const { store } = storeAnswering(201, []);

    expect(await store.claim(DUE)).toBeNull();
  });

  it("records a sent reminder on its claim", async () => {
    const { store, request } = storeAnswering(204, null);

    await store.markSent(
      7,
      "49a3999c-0ce1-4ea6-ab68-afcd6dc2e794",
      new Date("2026-11-26T13:00:02Z"),
    );

    const sent = request();
    expect(sent.method).toBe("PATCH");
    expect(sent.url.pathname).toBe("/rest/v1/listing_reminders");
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
    expect(sent.url.pathname).toBe("/rest/v1/listing_reminders");
    expect(sent.url.searchParams.get("id")).toBe("eq.7");
  });

  it("throws the database's error code and message", async () => {
    const { store } = storeAnswering(403, {
      code: "42501",
      message: "permission denied for function expire_listings",
    });

    await expect(store.expire(NOW)).rejects.toThrow(
      "expire_listings: 42501 permission denied for function expire_listings",
    );
  });
});
