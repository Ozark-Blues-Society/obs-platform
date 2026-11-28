import { randomBytes } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { expect, test, type APIRequestContext, type TestInfo } from "@playwright/test";
import { createMailpitSender, type SendEmail } from "../lib/email/send";
import { runDailyJobs } from "../lib/jobs/daily";
import { createListingStore } from "../lib/jobs/listing-store";
import { createMembershipStore } from "../lib/jobs/membership-store";
import { clearInbox, emailsTo, MAILPIT_URL } from "./support/mailpit";
import { secretKey, SUPABASE_URL } from "./support/supabase-auth";

// The daily jobs (backlog E-2, and K-4's classifieds step) against the local database and Mailpit.
// They don't use a page, so they run once, in the desktop project.
//
// The jobs run here in the test, not through the route: the route always works from the real
// clock and across every member, and the local database is shared. Here the clock is fake, in
// 2001 and 2002, when only the members and listings these tests create have memberships ending or
// listings coming down, so it emails nobody else and takes no one else's listing down. Each test
// has its own date and its own addresses, so the two can run at the same time without touching
// each other's members. The status update is left out for the same reason: it would move every
// member in the database to "active" (supabase/tests/membership_emails_test.sql covers it).
const inDesktop = (testInfo: TestInfo) => testInfo.project.name === "desktop";
const DESKTOP_ONLY = "No page: runs once, in the desktop project";

const NOW = new Date("2001-06-15T13:00:00Z");
const ADDRESS_PREFIX = "daily-jobs.";

/**
 * Deletes a test's members (their addresses start with `prefix`), with their listings and claims,
 * including any an earlier run left behind.
 */
async function deleteTestMembers(admin: SupabaseClient, prefix = ADDRESS_PREFIX) {
  const { data, error } = await admin
    .from("profiles")
    .select("id")
    .like("email", `${prefix}%@example.com`);
  expect(error).toBeNull();
  for (const { id } of data ?? []) {
    const { error: deleteError } = await admin.auth.admin.deleteUser(id);
    expect(deleteError).toBeNull();
  }
}

type TestMember = {
  name: string;
  expiresAt: string;
  autoRenew: boolean;
  /** The subject of the one email the member should get, or null for none. */
  subject: string | null;
};

const MEMBERS: TestMember[] = [
  {
    name: "reminder",
    expiresAt: "2001-07-15T23:00:00Z",
    autoRenew: false,
    subject: "Time to renew your Ozark Blues Society membership",
  },
  {
    name: "last-reminder",
    expiresAt: "2001-06-22T17:00:00Z",
    autoRenew: false,
    subject: "Last reminder: your membership ends on June 22, 2001",
  },
  {
    name: "lapsed",
    expiresAt: "2001-06-01T17:00:00Z",
    autoRenew: false,
    subject: "Your Ozark Blues Society membership has ended",
  },
  { name: "auto-renew", expiresAt: "2001-07-15T23:00:00Z", autoRenew: true, subject: null },
  {
    name: "send-fails",
    expiresAt: "2001-07-10T23:00:00Z",
    autoRenew: false,
    subject: "Time to renew your Ozark Blues Society membership",
  },
];

test("sends each membership email due once, and retries one that failed", async ({
  request,
}, testInfo) => {
  test.skip(!inDesktop(testInfo), DESKTOP_ONLY);
  const admin = createClient(SUPABASE_URL, secretKey(), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  await deleteTestMembers(admin);
  try {
    await sendsEachEmailOnce(request, admin);
  } finally {
    await deleteTestMembers(admin);
  }
});

async function sendsEachEmailOnce(request: APIRequestContext, admin: SupabaseClient) {
  const run = randomBytes(4).toString("hex");
  const addressOf = (member: TestMember) => `${ADDRESS_PREFIX}${run}.${member.name}@example.com`;
  const ids = new Map<string, string>();
  for (const member of MEMBERS) {
    await clearInbox(request, addressOf(member));
    const { data, error } = await admin.auth.admin.createUser({
      email: addressOf(member),
      email_confirm: true,
      user_metadata: { first_name: "Sam" },
    });
    expect(error).toBeNull();
    const id = data.user!.id;
    ids.set(member.name, id);
    // As the Stripe webhook will: the sign-up trigger has made the profile.
    const { error: updateError } = await admin
      .from("profiles")
      .update({ level: "band", expires_at: member.expiresAt, auto_renew: member.autoRenew })
      .eq("id", id);
    expect(updateError).toBeNull();
  }

  const mailpit = createMailpitSender({ url: MAILPIT_URL, from: "onboarding@resend.dev" });
  const failing = addressOf(MEMBERS[4]);
  const sendFailingOnce: SendEmail = async (email) => {
    if (email.to === failing) throw new Error("Resend refused the email (HTTP 500)");
    return mailpit(email);
  };
  const runJobs = (send: SendEmail) => runJobsAt(admin, send, NOW);

  const first = await runJobs(sendFailingOnce);

  expect(first.errors).toEqual([
    `Sending renewal_reminder for profile ${ids.get("send-fails")}: Resend refused the email (HTTP 500)`,
  ]);
  for (const member of MEMBERS) {
    const expected = member.name === "send-fails" ? [] : member.subject ? [member.subject] : [];
    const subjects = (await emailsTo(request, addressOf(member))).map((email) => email.Subject);
    expect(subjects, `emails to the ${member.name} member`).toEqual(expected);
  }

  // Each email sent has a claim recording Mailpit's id for it; the failed one has none.
  const claims = async () => {
    const { data, error } = await admin
      .from("membership_emails")
      .select("profile_id, kind, expires_at, sent_at, provider_id")
      .in("profile_id", [...ids.values()]);
    expect(error).toBeNull();
    return data!;
  };
  const afterFirst = await claims();
  expect(afterFirst.map((claim) => claim.kind).sort()).toEqual([
    "membership_lapsed",
    "renewal_last_reminder",
    "renewal_reminder",
  ]);
  for (const claim of afterFirst) {
    const member = MEMBERS.find((m) => ids.get(m.name) === claim.profile_id)!;
    const [email] = await emailsTo(request, addressOf(member));
    expect(claim.provider_id).toBe(email.ID);
    expect(claim.sent_at).not.toBeNull();
    expect(new Date(claim.expires_at).toISOString()).toBe(new Date(member.expiresAt).toISOString());
  }

  // The same day again: only the email that failed goes out.
  const second = await runJobs(mailpit);

  expect(second.errors).toEqual([]);
  for (const member of MEMBERS) {
    const subjects = (await emailsTo(request, addressOf(member))).map((email) => email.Subject);
    expect(subjects, `emails to the ${member.name} member`).toEqual(
      member.subject ? [member.subject] : [],
    );
  }
  expect(await claims()).toHaveLength(4);

  for (const member of MEMBERS) await clearInbox(request, addressOf(member));
}

/** Runs the daily jobs at `now`, without the status update (see the top of this file). */
function runJobsAt(admin: SupabaseClient, send: SendEmail, now: Date) {
  const jobs = { ...createMembershipStore(admin), refreshStatuses: async () => ({}) };
  return runDailyJobs({
    now,
    store: jobs,
    listings: createListingStore(admin),
    send,
    siteUrl: "http://localhost:3000",
  });
}

/** The classifieds test's clock and addresses, apart from the membership test's. */
const LISTINGS_NOW = new Date("2002-03-15T13:00:00Z");
const LISTINGS_PREFIX = "daily-jobs-listings.";

test("takes down listings whose time is up and reminds posters once", async ({
  request,
}, testInfo) => {
  test.skip(!inDesktop(testInfo), DESKTOP_ONLY);
  const admin = createClient(SUPABASE_URL, secretKey(), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  await deleteTestMembers(admin, LISTINGS_PREFIX);
  try {
    await remindsAndTakesDown(request, admin);
  } finally {
    await deleteTestMembers(admin, LISTINGS_PREFIX);
  }
});

async function remindsAndTakesDown(request: APIRequestContext, admin: SupabaseClient) {
  const address = `${LISTINGS_PREFIX}${randomBytes(4).toString("hex")}.poster@example.com`;
  await clearInbox(request, address);
  const { data, error } = await admin.auth.admin.createUser({
    email: address,
    email_confirm: true,
    user_metadata: { first_name: "Sam" },
  });
  expect(error).toBeNull();
  const posterId = data.user!.id;

  // Live listings, as a moderator's approval leaves them: one whose 60 days ended yesterday, one
  // that ends in 3 days (inside the 5-day reminder) and one that ends next month.
  const listing = (title: string, expiresAt: string) => ({
    profile_id: posterId,
    category: "gear",
    title,
    body: "Details.",
    status: "live",
    approved_at: new Date(Date.parse(expiresAt) - 60 * 24 * 60 * 60 * 1000).toISOString(),
    expires_at: expiresAt,
  });
  const { data: rows, error: insertError } = await admin
    .from("listings")
    .insert([
      listing("Ended yesterday", "2002-03-14T18:00:00Z"),
      listing("Ends in 3 days", "2002-03-18T18:00:00Z"),
      listing("Ends next month", "2002-04-20T17:00:00Z"),
    ])
    .select("id, title");
  expect(insertError).toBeNull();
  const idOf = (title: string) => rows!.find((row) => row.title === title)!.id as string;
  const statuses = async () => {
    const { data: now, error: readError } = await admin
      .from("listings")
      .select("title, status")
      .eq("profile_id", posterId)
      .order("expires_at");
    expect(readError).toBeNull();
    return now;
  };

  const mailpit = createMailpitSender({ url: MAILPIT_URL, from: "onboarding@resend.dev" });
  const first = await runJobsAt(admin, mailpit, LISTINGS_NOW);

  expect(first.errors).toEqual([]);
  expect(first.listings).toEqual({
    expired: 1,
    reminders: { sent: 1, failed: 0, claimedElsewhere: 0, deferred: 0 },
  });
  expect(await statuses()).toEqual([
    { title: "Ended yesterday", status: "expired" },
    { title: "Ends in 3 days", status: "live" },
    { title: "Ends next month", status: "live" },
  ]);
  const emails = await emailsTo(request, address);
  expect(emails.map((email) => email.Subject)).toEqual(["Your classified listing expires soon"]);
  const message = (await (
    await request.get(`${MAILPIT_URL}/api/v1/message/${emails[0].ID}`)
  ).json()) as { HTML: string; Text: string };
  // Mailpit hands the text part back with CRLF line ends.
  expect(message.Text).toMatch(/Listing +Ends in 3 days\r?\n/);
  expect(message.Text).toMatch(/Expires on +March 18, 2002\r?\n/);
  expect(message.HTML).toContain(
    `href="http://localhost:3000/account/listings?renew=${idOf("Ends in 3 days")}"`,
  );

  // Its claim records Mailpit's id for it.
  const { data: claims, error: claimError } = await admin
    .from("listing_reminders")
    .select("listing_id, expires_at, sent_at, provider_id")
    .in(
      "listing_id",
      rows!.map((row) => row.id),
    );
  expect(claimError).toBeNull();
  expect(claims).toHaveLength(1);
  expect(claims![0].listing_id).toBe(idOf("Ends in 3 days"));
  expect(new Date(claims![0].expires_at).toISOString()).toBe("2002-03-18T18:00:00.000Z");
  expect(claims![0].provider_id).toBe(emails[0].ID);
  expect(claims![0].sent_at).not.toBeNull();

  // The same day again: nothing more.
  const second = await runJobsAt(admin, mailpit, LISTINGS_NOW);

  expect(second.errors).toEqual([]);
  expect(second.listings).toEqual({
    expired: 0,
    reminders: { sent: 0, failed: 0, claimedElsewhere: 0, deferred: 0 },
  });
  expect(await emailsTo(request, address)).toHaveLength(1);

  await clearInbox(request, address);
}

test("the daily jobs' route runs nothing without the secret", async ({ request }, testInfo) => {
  test.skip(!inDesktop(testInfo), DESKTOP_ONLY);
  // 503 while CRON_SECRET isn't set (as in these tests), 401 when it is.
  const attempts: Record<string, string>[] = [{}, { authorization: "Bearer not-the-secret" }];
  for (const headers of attempts) {
    const response = await request.post("/api/cron/daily", { headers });
    expect([401, 503]).toContain(response.status());
  }
  // Netlify's scheduled function posts; nothing else runs the jobs.
  expect((await request.get("/api/cron/daily")).status()).toBe(405);
});
