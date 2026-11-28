// @vitest-environment node
import { createHash } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { OutgoingEmail } from "@/lib/email/send";
import { CONTACT_MESSAGES, type ContactValues } from "./public-state";

const VIEWER_ID = "00000000-0000-4000-8100-000000000031";
const POSTER_ID = "00000000-0000-4000-8100-000000000014";
const POSTER_EMAIL = "lou.tate@example.com";
const LISTING_ID = "00000000-0000-4000-8200-000000000003";
const TITLE = "Tweed-style 1x12 tube amp, 15 W";
const SENDER: ContactValues = {
  name: "Jo Ames",
  email: "Jo.Ames@example.com",
  message: "Is the amp still for sale?",
};

// Stand-ins for Supabase, as the viewer (`member`, or a visitor when `signedIn` is false) and with
// the service role (`admin`), for the request's headers and for the email sender. Every call is
// recorded in `calls`.
const { db, query } = vi.hoisted(() => {
  type Failure = { code: string; message: string } | null;
  const db = {
    signedIn: false,
    /** The live listing the viewer's read finds, or null. */
    listing: null as object | null,
    listingError: null as Failure,
    poster: null as object | null,
    posterError: null as Failure,
    /** What record_listing_message answers: a new row's id. */
    recorded: 41 as number | null,
    recordError: null as Failure,
    sendError: null as Error | null,
    headers: {} as Record<string, string>,
    calls: [] as unknown[][],
  };
  type Result = { data: unknown; error: unknown };
  const result = (client: string, table: string, op: string): Result => {
    if (op === "delete") return { data: null, error: null };
    if (table === "listings") return { data: db.listing, error: db.listingError };
    return { data: db.poster, error: db.posterError };
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

vi.mock("next/headers", () => ({ headers: async () => new Headers(db.headers) }));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: {
      getClaims: async () =>
        db.signedIn
          ? { data: { claims: { sub: VIEWER_ID, email: "jo.ames@example.com" } }, error: null }
          : { data: null, error: null },
    },
    from: (table: string) => query("viewer", table),
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

const { clientAddress, contactFormAction, sendContactMessage } = await import("./contact");

/** When the page appeared: a minute ago, unless a test says otherwise. */
const A_MINUTE_AGO = () => Date.now() - 60_000;

function form(values: Partial<ContactValues & { website: string }> = {}): FormData {
  const data = new FormData();
  for (const [name, value] of Object.entries({ ...SENDER, ...values })) data.set(name, value);
  return data;
}

const send = (data = form(), shownAt = A_MINUTE_AGO()) =>
  sendContactMessage(LISTING_ID, shownAt, data);
const sha256 = (text: string) => createHash("sha256").update(text).digest("hex");
const sent = () =>
  db.calls.filter((call) => call[0] === "send").map((call) => call[1] as OutgoingEmail);
const recorded = () => db.calls.filter((call) => call[1] === "rpc");

beforeEach(() => {
  process.env.SITE_URL = "https://obs.example.org";
  db.signedIn = false;
  db.listing = { id: LISTING_ID, profile_id: POSTER_ID, title: TITLE, contact_pref: "email" };
  db.listingError = null;
  db.poster = { email: POSTER_EMAIL, first_name: "Lou", last_name: "Tate", phone: null };
  db.posterError = null;
  db.recorded = 41;
  db.recordError = null;
  db.sendError = null;
  db.headers = { "x-nf-client-connection-ip": "203.0.113.7" };
  db.calls = [];
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("sendContactMessage", () => {
  it("emails a visitor's message to the poster, who replies to the visitor, and never answers with the poster's address", async () => {
    const result = await send(
      form({ name: "  Jo   Ames ", message: "  Is the amp still for sale?\r\nCall me.  " }),
    );

    expect(result).toEqual({
      status: "sent",
      message: "Message sent. Lou T. can reply to you at Jo.Ames@example.com.",
    });
    expect(JSON.stringify(result)).not.toContain(POSTER_EMAIL);
    expect(sent()).toHaveLength(1);
    const [email] = sent();
    expect(email.to).toBe(POSTER_EMAIL);
    expect(email.replyTo).toBe("Jo.Ames@example.com");
    expect(email.subject).toBe(`A message about your listing “${TITLE}”`);
    expect(email.text).toContain("Jo Ames (Jo");
    expect(email.text).toContain("Is the amp still for sale?");
    expect(email.text).toContain("Call me.");
    expect(email.text).toContain("We haven't checked that this address belongs to Jo Ames");
    expect(email.text).toContain(`https://obs.example.org/classifieds/${LISTING_ID}`);
    expect(email.idempotencyKey).toMatch(
      new RegExp(`^listing_message/${LISTING_ID}/[0-9a-f]{64}$`),
    );
  });

  it("reads a live listing as the viewer, then records the message by hashes of the sender's addresses", async () => {
    await send();

    expect(db.calls).toContainEqual(["viewer", "listings", "eq", "id", LISTING_ID]);
    expect(db.calls).toContainEqual(["viewer", "listings", "eq", "status", "live"]);
    expect(db.calls).toContainEqual(["viewer", "listings", "gt", "expires_at", expect.any(String)]);
    expect(recorded()).toEqual([
      [
        "admin",
        "rpc",
        "record_listing_message",
        {
          p_listing_id: LISTING_ID,
          p_email_hash: sha256("jo.ames@example.com"),
          p_ip_hash: sha256("203.0.113.7"),
          p_sender_limit: 10,
          p_listing_limit: 20,
        },
      ],
    ]);
  });

  it("counts no network address it can't trust, rather than putting every sender in one", async () => {
    db.headers = { "x-forwarded-for": "198.51.100.1" };
    await send();
    await send();

    const hashes = recorded().map((call) => (call[3] as { p_ip_hash: string }).p_ip_hash);
    expect(hashes[0]).not.toBe(hashes[1]);
    expect(hashes).not.toContain(sha256("198.51.100.1"));
  });

  it("pretends to send what fills in the hidden field, and sends nothing", async () => {
    const result = await send(form({ website: "https://spam.example" }));

    expect(result).toMatchObject({ status: "sent" });
    expect(db.calls).toEqual([]);
  });

  it("asks a sender who answers within seconds of the page appearing to send again", async () => {
    expect(await send(form(), Date.now() - 1_000)).toEqual({
      status: "error",
      field: null,
      message: CONTACT_MESSAGES.tooQuick,
      values: SENDER,
    });
    expect(db.calls).toEqual([]);
  });

  it("checks each field, in order, keeping what was typed", async () => {
    expect(await send(form({ name: " " }))).toMatchObject({
      field: "name",
      message: CONTACT_MESSAGES.nameMissing,
    });
    expect(await send(form({ email: "jo.ames" }))).toMatchObject({
      field: "email",
      message: CONTACT_MESSAGES.emailInvalid,
      values: { ...SENDER, email: "jo.ames" },
    });
    expect(await send(form({ message: "" }))).toMatchObject({ field: "message" });
    expect(recorded()).toEqual([]);
    expect(sent()).toEqual([]);
  });

  it("refuses an id the page never sends", async () => {
    expect(await sendContactMessage("amp", A_MINUTE_AGO(), form())).toMatchObject({
      message: CONTACT_MESSAGES.gone,
    });
    expect(db.calls).toEqual([]);
  });

  it("sends nothing about a listing that isn't live", async () => {
    db.listing = null;
    expect(await send()).toMatchObject({ message: CONTACT_MESSAGES.gone });
    expect(recorded()).toEqual([]);
    expect(sent()).toEqual([]);
  });

  it("sends nothing to a signed-in poster about their own listing", async () => {
    db.signedIn = true;
    db.listing = { id: LISTING_ID, profile_id: VIEWER_ID, title: TITLE, contact_pref: "email" };
    expect(await send()).toMatchObject({ message: CONTACT_MESSAGES.own });
    expect(sent()).toEqual([]);
  });

  it("follows a poster who asked for calls for signed-in viewers, who see the number, but lets visitors write", async () => {
    db.listing = { id: LISTING_ID, profile_id: POSTER_ID, title: TITLE, contact_pref: "phone" };
    db.poster = {
      email: POSTER_EMAIL,
      first_name: "Lou",
      last_name: "Tate",
      phone: "479-555-0142",
    };
    db.signedIn = true;
    expect(await send()).toMatchObject({ message: CONTACT_MESSAGES.byPhone });
    expect(sent()).toEqual([]);

    db.signedIn = false;
    expect(await send()).toMatchObject({ status: "sent" });
    expect(sent()).toHaveLength(1);
  });

  it.each([
    ["OB201", CONTACT_MESSAGES.senderLimit],
    ["OB202", CONTACT_MESSAGES.listingLimit],
    ["P0002", CONTACT_MESSAGES.gone],
  ])("sends nothing when the database refuses with %s", async (code, message) => {
    db.recordError = { code, message: "refused" };
    expect(await send()).toMatchObject({ status: "error", message, values: SENDER });
    expect(sent()).toEqual([]);
  });

  it("takes the message back off the day's counts when the email doesn't go", async () => {
    db.sendError = new Error("Mailpit didn't take the email (HTTP 500)");
    expect(await send()).toEqual({
      status: "error",
      field: null,
      message: CONTACT_MESSAGES.unavailable,
      values: SENDER,
    });
    expect(db.calls).toContainEqual(["admin", "listing_messages", "delete"]);
    expect(db.calls).toContainEqual(["admin", "listing_messages", "eq", "id", 41]);
    const logged = vi.mocked(console.error).mock.calls.flat().join(" ");
    expect(logged).toContain(LISTING_ID);
    expect(logged).not.toContain(POSTER_EMAIL);
    expect(logged).not.toContain(SENDER.email);
  });

  it("sends nothing when the poster can't be read", async () => {
    db.posterError = { code: "57014", message: "canceling statement due to statement timeout" };
    expect(await send()).toMatchObject({ message: CONTACT_MESSAGES.unavailable });
    expect(recorded()).toEqual([]);
    expect(sent()).toEqual([]);
  });
});

describe("clientAddress", () => {
  it("takes the address the host's proxy gives, never the visitor's own x-forwarded-for", () => {
    expect(clientAddress(new Headers({ "x-nf-client-connection-ip": " 203.0.113.7 " }))).toBe(
      "203.0.113.7",
    );
    expect(clientAddress(new Headers({ "x-real-ip": "203.0.113.8" }))).toBe("203.0.113.8");
    expect(clientAddress(new Headers({ "x-forwarded-for": "198.51.100.1, 203.0.113.9" }))).toBe(
      null,
    );
    expect(clientAddress(new Headers())).toBeNull();
  });
});

describe("contactFormAction", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("seals in the listing and the moment the page was made", async () => {
    vi.useFakeTimers({ now: new Date("2026-12-01T18:00:00Z"), toFake: ["Date"] });
    const action = contactFormAction(LISTING_ID);

    vi.setSystemTime(new Date("2026-12-01T18:00:01Z"));
    expect(await action({ status: "idle" }, form())).toMatchObject({
      message: CONTACT_MESSAGES.tooQuick,
    });

    vi.setSystemTime(new Date("2026-12-01T18:00:04Z"));
    expect(await action({ status: "idle" }, form())).toMatchObject({ status: "sent" });
    expect(db.calls).toContainEqual(["viewer", "listings", "eq", "id", LISTING_ID]);
  });
});
