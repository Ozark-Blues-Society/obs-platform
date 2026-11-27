// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { OutgoingEmail } from "@/lib/email/send";
import { CONTACT_MESSAGES, type ContactState } from "./public-state";

const SENDER_ID = "00000000-0000-4000-8100-000000000031";
const SENDER_EMAIL = "jo.ames@example.com";
const POSTER_ID = "00000000-0000-4000-8100-000000000014";
const POSTER_EMAIL = "lou.tate@example.com";
const LISTING_ID = "00000000-0000-4000-8200-000000000003";
const TITLE = "Tweed-style 1x12 tube amp, 15 W";

// Stand-ins for Supabase, as the signed-in member (`member`) and with the service role (`admin`),
// and for the email sender. Every call is recorded in `calls`.
const { db, query } = vi.hoisted(() => {
  type Failure = { code: string; message: string } | null;
  const db = {
    signedIn: true,
    /** The live listing the member's read finds, or null. */
    listing: null as object | null,
    listingError: null as Failure,
    poster: null as object | null,
    posterError: null as Failure,
    sender: null as object | null,
    /** What record_listing_message answers: a new row's id, or null at the limit. */
    recorded: 41 as number | null,
    recordError: null as Failure,
    sendError: null as Error | null,
    calls: [] as unknown[][],
  };
  type Result = { data: unknown; error: unknown };
  const result = (client: string, table: string, op: string): Result => {
    if (op === "delete") return { data: null, error: null };
    if (table === "listings") return { data: db.listing, error: db.listingError };
    if (client === "admin") return { data: db.poster, error: db.posterError };
    return { data: db.sender, error: null };
  };
  const query = (client: string, table: string) => {
    let op = "select";
    const record =
      (name: string) =>
      (...args: unknown[]) => (db.calls.push([client, table, name, ...args]), builder);
    const builder = {
      select: record("select"),
      eq: record("eq"),
      gt: record("gt"),
      delete: (...args: unknown[]) => ((op = "delete"), record("delete")(...args)),
      maybeSingle: async () => result(client, table, op),
      then: (resolve: (value: Result) => unknown) =>
        Promise.resolve(result(client, table, op)).then(resolve),
    };
    return builder;
  };
  return { db, query };
});

vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`redirect ${url}`);
  },
}));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: {
      getClaims: async () =>
        db.signedIn
          ? { data: { claims: { sub: SENDER_ID, email: SENDER_EMAIL } }, error: null }
          : { data: null, error: null },
    },
    from: (table: string) => query("member", table),
  }),
}));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: (table: string) => query("admin", table),
    rpc: async (name: string, args: object) => {
      db.calls.push(["admin", "rpc", name, args]);
      return { data: db.recordError ? null : db.recorded, error: db.recordError };
    },
  }),
}));
vi.mock("@/lib/email/send", () => ({
  getEmailSender: () => async (email: OutgoingEmail) => {
    db.calls.push(["send", email]);
    if (db.sendError) throw db.sendError;
    return { id: "email-1" };
  },
}));

const { contactPoster } = await import("./contact-actions");

const IDLE: ContactState = { status: "idle" };

function form(message: string): FormData {
  const data = new FormData();
  data.set("message", message);
  return data;
}

const sent = () =>
  db.calls.filter((call) => call[0] === "send").map((call) => call[1] as OutgoingEmail);
const recorded = () => db.calls.filter((call) => call[1] === "rpc");

beforeEach(() => {
  process.env.SITE_URL = "https://obs.example.org";
  db.signedIn = true;
  db.listing = { id: LISTING_ID, profile_id: POSTER_ID, title: TITLE, contact_pref: "email" };
  db.listingError = null;
  db.poster = { email: POSTER_EMAIL, first_name: "Lou", last_name: "Tate", phone: null };
  db.posterError = null;
  db.sender = { first_name: "Jo", last_name: "Ames" };
  db.recorded = 41;
  db.recordError = null;
  db.sendError = null;
  db.calls = [];
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("contactPoster", () => {
  it("emails the message to the poster, who replies to the sender, and never answers with the poster's address", async () => {
    const result = await contactPoster(
      LISTING_ID,
      IDLE,
      form("  Is the amp still for sale?\r\nI could come Saturday.  "),
    );

    expect(result).toEqual({
      status: "sent",
      message: `Message sent. Lou T. will see your email address, ${SENDER_EMAIL}, and can reply to you there.`,
    });
    expect(JSON.stringify(result)).not.toContain(POSTER_EMAIL);
    const [email] = sent();
    expect(sent()).toHaveLength(1);
    expect(email.to).toBe(POSTER_EMAIL);
    expect(email.replyTo).toBe(SENDER_EMAIL);
    expect(email.subject).toBe(`A message about your listing “${TITLE}”`);
    expect(email.text).toContain("Is the amp still for sale?");
    expect(email.text).toContain("I could come Saturday.");
    expect(email.text).toContain(`Jo Ames at ${SENDER_EMAIL}`);
    expect(email.text).toContain(`https://obs.example.org/classifieds/${LISTING_ID}`);
    expect(email.idempotencyKey).toMatch(
      new RegExp(`^listing_message/${LISTING_ID}/${SENDER_ID}/[0-9a-f]{64}$`),
    );
  });

  it("reads a live listing as the sender, then records the message against their day", async () => {
    await contactPoster(LISTING_ID, IDLE, form("Still for sale?"));

    expect(db.calls).toContainEqual(["member", "listings", "eq", "id", LISTING_ID]);
    expect(db.calls).toContainEqual(["member", "listings", "eq", "status", "live"]);
    expect(db.calls).toContainEqual(["member", "listings", "gt", "expires_at", expect.any(String)]);
    expect(recorded()).toEqual([
      [
        "admin",
        "rpc",
        "record_listing_message",
        { p_sender_id: SENDER_ID, p_listing_id: LISTING_ID, p_daily_limit: 10 },
      ],
    ]);
  });

  it("names the sender by address when their profile has no name", async () => {
    db.sender = { first_name: null, last_name: null };
    await contactPoster(LISTING_ID, IDLE, form("Still for sale?"));

    expect(sent()[0].text).toContain(`${SENDER_EMAIL} wrote to you about your listing`);
  });

  it("sends a visitor to sign in, and back to the listing", async () => {
    db.signedIn = false;
    await expect(contactPoster(LISTING_ID, IDLE, form("Hello"))).rejects.toThrow(
      `redirect /sign-in?next=${encodeURIComponent(`/classifieds/${LISTING_ID}`)}`,
    );
    expect(sent()).toEqual([]);
  });

  it("needs a message, and keeps what was typed when it's too long", async () => {
    expect(await contactPoster(LISTING_ID, IDLE, form("   "))).toEqual({
      status: "error",
      field: "message",
      message: CONTACT_MESSAGES.messageMissing,
      value: "   ",
    });
    const long = "a".repeat(2001);
    expect(await contactPoster(LISTING_ID, IDLE, form(long))).toMatchObject({
      field: "message",
      value: long,
    });
    expect(recorded()).toEqual([]);
    expect(sent()).toEqual([]);
  });

  it("refuses an id the page never sends", async () => {
    expect(await contactPoster("amp", IDLE, form("Hello"))).toMatchObject({
      status: "error",
      message: CONTACT_MESSAGES.gone,
    });
    expect(db.calls).toEqual([]);
  });

  it("sends nothing about a listing that isn't live", async () => {
    db.listing = null;
    expect(await contactPoster(LISTING_ID, IDLE, form("Hello"))).toEqual({
      status: "error",
      field: null,
      message: CONTACT_MESSAGES.gone,
      value: "Hello",
    });
    expect(recorded()).toEqual([]);
    expect(sent()).toEqual([]);
  });

  it("sends nothing to the sender about their own listing", async () => {
    db.listing = { id: LISTING_ID, profile_id: SENDER_ID, title: TITLE, contact_pref: "email" };
    expect(await contactPoster(LISTING_ID, IDLE, form("Hello"))).toMatchObject({
      message: CONTACT_MESSAGES.own,
    });
    expect(sent()).toEqual([]);
  });

  it("follows a poster who asked for calls, unless their profile has no number", async () => {
    db.listing = { id: LISTING_ID, profile_id: POSTER_ID, title: TITLE, contact_pref: "phone" };
    db.poster = {
      email: POSTER_EMAIL,
      first_name: "Lou",
      last_name: "Tate",
      phone: "479-555-0142",
    };
    expect(await contactPoster(LISTING_ID, IDLE, form("Hello"))).toMatchObject({
      message: CONTACT_MESSAGES.byPhone,
    });
    expect(sent()).toEqual([]);

    db.poster = { email: POSTER_EMAIL, first_name: "Lou", last_name: "Tate", phone: "  " };
    expect(await contactPoster(LISTING_ID, IDLE, form("Hello"))).toMatchObject({ status: "sent" });
    expect(sent()).toHaveLength(1);
  });

  it("sends nothing past the day's limit", async () => {
    db.recorded = null;
    expect(await contactPoster(LISTING_ID, IDLE, form("Hello"))).toMatchObject({
      message: CONTACT_MESSAGES.limit,
      value: "Hello",
    });
    expect(sent()).toEqual([]);
  });

  it("says the listing has gone when the database finds it isn't live any more", async () => {
    db.recordError = { code: "P0002", message: "listing isn't live" };
    expect(await contactPoster(LISTING_ID, IDLE, form("Hello"))).toMatchObject({
      message: CONTACT_MESSAGES.gone,
    });
    expect(sent()).toEqual([]);
  });

  it("takes the message back off the sender's day when the email doesn't go", async () => {
    db.sendError = new Error("Mailpit didn't take the email (HTTP 500)");
    expect(await contactPoster(LISTING_ID, IDLE, form("Hello"))).toEqual({
      status: "error",
      field: null,
      message: CONTACT_MESSAGES.unavailable,
      value: "Hello",
    });
    expect(db.calls).toContainEqual(["admin", "listing_messages", "delete"]);
    expect(db.calls).toContainEqual(["admin", "listing_messages", "eq", "id", 41]);
    const logged = vi.mocked(console.error).mock.calls.flat().join(" ");
    expect(logged).toContain(LISTING_ID);
    expect(logged).not.toContain(POSTER_EMAIL);
    expect(logged).not.toContain(SENDER_EMAIL);
  });

  it("sends nothing when the poster can't be read", async () => {
    db.posterError = { code: "57014", message: "canceling statement due to statement timeout" };
    expect(await contactPoster(LISTING_ID, IDLE, form("Hello"))).toMatchObject({
      message: CONTACT_MESSAGES.unavailable,
    });
    expect(recorded()).toEqual([]);
    expect(sent()).toEqual([]);
  });
});
