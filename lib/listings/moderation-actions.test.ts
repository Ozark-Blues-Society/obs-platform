// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { OutgoingEmail } from "@/lib/email/send";
import { MODERATION_MESSAGES } from "./moderation-state";

const MODERATOR_ID = "00000000-0000-4000-8100-000000000017";
const POSTER_ID = "00000000-0000-4000-8100-000000000022";
const LISTING_ID = "00000000-0000-4000-8200-000000000004";
const TITLE = "Harmonica set (7 keys) with case";

// Stand-ins for Supabase, as the signed-in member (`member`) and with the service role (`admin`),
// and for the email sender. Every call is recorded in `calls`.
const { db, query } = vi.hoisted(() => {
  const db = {
    signedIn: true,
    roles: ["moderator"] as string[],
    /** The row the conditional update returns: null when it matched none. */
    decided: null as object | null,
    updateError: null as { code: string; message: string } | null,
    /** The listing as a read finds it after a decision that matched nothing. */
    current: null as object | null,
    poster: null as object | null,
    sendError: null as Error | null,
    calls: [] as unknown[][],
  };
  type Result = { data: unknown; error: unknown };
  const result = (table: string, op: string): Result => {
    if (table === "user_roles") return { data: db.roles.map((role) => ({ role })), error: null };
    if (table === "listings" && op === "update") {
      return { data: db.updateError ? null : db.decided, error: db.updateError };
    }
    if (table === "listings") return { data: db.current, error: null };
    return { data: db.poster, error: null };
  };
  const query = (client: string, table: string) => {
    let op = "select";
    const builder = {
      select: (columns: string) => (db.calls.push([client, table, "select", columns]), builder),
      update: (values: object) => {
        op = "update";
        db.calls.push([client, table, "update", values]);
        return builder;
      },
      eq: (column: string, value: unknown) => (
        db.calls.push([client, table, "eq", column, value]),
        builder
      ),
      maybeSingle: async () => result(table, op),
      then: (resolve: (value: Result) => unknown) =>
        Promise.resolve(result(table, op)).then(resolve),
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
vi.mock("next/cache", () => ({ refresh: () => db.calls.push(["refresh"]) }));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: {
      getClaims: async () =>
        db.signedIn
          ? {
              data: { claims: { sub: MODERATOR_ID, email: "dale.ramsey@example.com" } },
              error: null,
            }
          : { data: null, error: null },
    },
    from: (table: string) => query("member", table),
  }),
}));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({ from: (table: string) => query("admin", table) }),
}));
vi.mock("@/lib/email/send", () => ({
  getEmailSender: () => async (email: OutgoingEmail) => {
    db.calls.push(["send", email]);
    if (db.sendError) throw db.sendError;
    return { id: "email-1" };
  },
}));

const { approveListing, rejectListing } = await import("./moderation-actions");

const sent = () =>
  db.calls.filter((call) => call[0] === "send").map((call) => call[1] as OutgoingEmail);
const updates = () => db.calls.filter((call) => call[2] === "update");

beforeEach(() => {
  process.env.SITE_URL = "https://obs.example.org";
  db.signedIn = true;
  db.roles = ["moderator"];
  db.decided = null;
  db.updateError = null;
  db.current = null;
  db.poster = { email: "pat.walsh@example.com", first_name: "Pat" };
  db.sendError = null;
  db.calls = [];
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("approveListing", () => {
  beforeEach(() => {
    db.decided = {
      id: LISTING_ID,
      profile_id: POSTER_ID,
      title: TITLE,
      revision: 3,
      expires_at: "2027-01-25T18:00:00+00:00",
    };
  });

  it("approves the pending listing at the revision shown, as the moderator, and emails the poster", async () => {
    const result = await approveListing({ id: LISTING_ID, revision: 3 });

    expect(result).toEqual({
      status: "approved",
      message: `“${TITLE}” is approved and on the classifieds until Jan 25, 2027. We emailed the poster to let them know.`,
    });
    expect(db.calls).toContainEqual(["member", "listings", "update", { status: "live" }]);
    for (const filter of [
      ["id", LISTING_ID],
      ["status", "pending"],
      ["revision", 3],
    ]) {
      expect(db.calls).toContainEqual(["member", "listings", "eq", ...filter]);
    }
    expect(db.calls).toContainEqual(["refresh"]);
    // The poster's address comes through the service role: moderators can't read profiles.
    expect(db.calls).toContainEqual(["admin", "profiles", "eq", "id", POSTER_ID]);
    const [email] = sent();
    expect(email).toMatchObject({
      to: "pat.walsh@example.com",
      subject: "Your classified listing is live",
      idempotencyKey: `listing_approved/${LISTING_ID}/2027-01-25T18:00:00+00:00`,
    });
    expect(email.text).toContain(TITLE);
    expect(email.text).toContain("January 25, 2027");
    expect(email.text).toContain("Pat");
    expect(email.html).toContain("https://obs.example.org/account/listings");
  });

  it("lets an administrator approve too", async () => {
    db.roles = ["admin"];

    expect((await approveListing({ id: LISTING_ID, revision: 3 })).status).toBe("approved");
  });

  it("sends a visitor to sign in first", async () => {
    db.signedIn = false;

    await expect(approveListing({ id: LISTING_ID, revision: 3 })).rejects.toThrow(
      "redirect /sign-in?next=%2Fadmin%2Fclassifieds",
    );
    expect(updates()).toEqual([]);
  });

  it("refuses members who don't moderate, before touching the listing", async () => {
    db.roles = ["editor", "membership_manager"];

    expect(await approveListing({ id: LISTING_ID, revision: 3 })).toEqual({
      status: "error",
      message: MODERATION_MESSAGES.notModerator,
    });
    expect(updates()).toEqual([]);
    expect(sent()).toEqual([]);
  });

  it.each([
    { id: "not-a-uuid", revision: 3 },
    { id: LISTING_ID, revision: 0 },
    { id: LISTING_ID, revision: 1.5 },
    { id: LISTING_ID, revision: "3" },
  ])("refuses a made-up request (%o)", async (input) => {
    const result = await approveListing(input as { id: string; revision: number });

    expect(result).toEqual({ status: "error", message: MODERATION_MESSAGES.unavailable });
    expect(updates()).toEqual([]);
  });

  it.each([
    {
      current: { title: TITLE, status: "pending", revision: 4 },
      message: `The poster changed “${TITLE}” while you were looking at it, so nothing was decided. Check the new version below, then decide.`,
    },
    {
      current: { title: TITLE, status: "live", revision: 3 },
      message: `“${TITLE}” was already approved, perhaps by another moderator.`,
    },
    {
      current: { title: TITLE, status: "rejected", revision: 3 },
      message: `“${TITLE}” was already rejected, perhaps by another moderator.`,
    },
    {
      current: { title: TITLE, status: "expired", revision: 3 },
      message: `“${TITLE}” isn't waiting for review any more.`,
    },
    { current: null, message: MODERATION_MESSAGES.withdrawn },
  ])("says why when the listing isn't pending at that revision ($message)", async (example) => {
    db.decided = null;
    db.current = example.current;

    expect(await approveListing({ id: LISTING_ID, revision: 3 })).toEqual({
      status: "error",
      message: example.message,
    });
    expect(sent()).toEqual([]);
    expect(db.calls).toContainEqual(["refresh"]);
  });

  it.each([
    { code: "42501", message: MODERATION_MESSAGES.notModerator },
    { code: "08006", message: MODERATION_MESSAGES.unavailable },
  ])("explains a refusal from the database ($code)", async ({ code, message }) => {
    db.updateError = { code, message: "refused" };

    expect(await approveListing({ id: LISTING_ID, revision: 3 })).toEqual({
      status: "error",
      message,
    });
    expect(sent()).toEqual([]);
  });

  it("says when the approved listing's poster couldn't be emailed", async () => {
    db.sendError = new Error("Mailpit didn't take the email (HTTP 500)");

    const result = await approveListing({ id: LISTING_ID, revision: 3 });

    expect(result).toEqual({
      status: "approved",
      message: `“${TITLE}” is approved and on the classifieds until Jan 25, 2027. The email to the poster didn't go out, though, so they don't know yet.`,
    });
    // The log names the listing, never the poster's address.
    expect(String(vi.mocked(console.error).mock.calls.at(-1))).toContain(LISTING_ID);
    expect(String(vi.mocked(console.error).mock.calls.at(-1))).not.toContain("pat.walsh");
  });

  it("doesn't email a poster whose profile has no address", async () => {
    db.poster = { email: null, first_name: "Pat" };

    const result = await approveListing({ id: LISTING_ID, revision: 3 });

    expect(result.message).toContain("The email to the poster didn't go out");
    expect(sent()).toEqual([]);
  });
});

describe("rejectListing", () => {
  beforeEach(() => {
    db.decided = {
      id: LISTING_ID,
      profile_id: POSTER_ID,
      title: TITLE,
      revision: 3,
      expires_at: null,
    };
  });

  it("rejects with the reason, tidied, and emails the poster the reason word for word", async () => {
    const result = await rejectListing({
      id: LISTING_ID,
      revision: 3,
      reason: "  Instruments for sale go in Gear.\r\nPlease post it again there.  ",
    });

    expect(result).toEqual({
      status: "rejected",
      message: `“${TITLE}” is rejected. We emailed the poster your reason.`,
    });
    const reason = "Instruments for sale go in Gear.\nPlease post it again there.";
    expect(db.calls).toContainEqual([
      "member",
      "listings",
      "update",
      { status: "rejected", reject_reason: reason },
    ]);
    expect(db.calls).toContainEqual(["member", "listings", "eq", "revision", 3]);
    const [email] = sent();
    expect(email).toMatchObject({
      to: "pat.walsh@example.com",
      subject: "Your classified listing wasn't approved",
      idempotencyKey: `listing_rejected/${LISTING_ID}/3`,
    });
    expect(email.text).toContain("Instruments for sale go in Gear.");
    expect(email.text).toContain("Please post it again there.");
  });

  it.each([
    { reason: " \n ", message: MODERATION_MESSAGES.reasonMissing },
    { reason: "x".repeat(501), message: MODERATION_MESSAGES.reasonTooLong },
  ])("asks for a reason the poster can read ($message)", async ({ reason, message }) => {
    expect(await rejectListing({ id: LISTING_ID, revision: 3, reason })).toEqual({
      status: "error",
      message,
    });
    expect(updates()).toEqual([]);
  });

  it("refuses members who don't moderate", async () => {
    db.roles = [];

    expect(await rejectListing({ id: LISTING_ID, revision: 3, reason: "Spam." })).toEqual({
      status: "error",
      message: MODERATION_MESSAGES.notModerator,
    });
    expect(updates()).toEqual([]);
  });

  it("says when the rejected listing's poster couldn't be emailed", async () => {
    db.sendError = new Error("Resend refused the email (HTTP 429)");

    expect(await rejectListing({ id: LISTING_ID, revision: 3, reason: "Spam." })).toEqual({
      status: "rejected",
      message: `“${TITLE}” is rejected, but the email to the poster didn't go out, so they haven't seen your reason.`,
    });
  });
});
