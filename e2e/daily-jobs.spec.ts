import { execFileSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { expect, test, type APIRequestContext, type TestInfo } from "@playwright/test";
import { createMailpitSender, type SendEmail } from "../lib/email/send";
import { runDailyJobs } from "../lib/jobs/daily";
import { createMembershipStore } from "../lib/jobs/membership-store";
import { clearInbox, emailsTo, MAILPIT_URL } from "./support/mailpit";
import { SUPABASE_URL } from "./support/supabase-auth";

// The daily jobs (backlog E-2) against the local database and Mailpit. They don't use a page, so
// they run once, in the desktop project.
//
// The jobs run here in the test, not through the route: the route always works from the real
// clock and across every member, and the local database is shared. Here the clock is fake, in
// June 2001, when only the members this test creates have memberships ending, so it emails nobody
// else. The status update is left out for the same reason: it would move every member in the
// database to "active" (supabase/tests/membership_emails_test.sql covers it).
const inDesktop = (testInfo: TestInfo) => testInfo.project.name === "desktop";
const DESKTOP_ONLY = "No page: runs once, in the desktop project";

const NOW = new Date("2001-06-15T13:00:00Z");
const ADDRESS_PREFIX = "daily-jobs.";

/** The service role's key: SUPABASE_SECRET_KEY, or what `supabase status` prints for the stack. */
function secretKey(): string {
  if (process.env.SUPABASE_SECRET_KEY) return process.env.SUPABASE_SECRET_KEY;
  const status = JSON.parse(
    execFileSync("supabase", ["status", "--output", "json"], { encoding: "utf8" }),
  ) as { SECRET_KEY?: string };
  if (!status.SECRET_KEY) throw new Error("`supabase status` printed no SECRET_KEY");
  return status.SECRET_KEY;
}

/** Deletes this test's members, with their claims, including any an earlier run left behind. */
async function deleteTestMembers(admin: SupabaseClient) {
  const { data, error } = await admin
    .from("profiles")
    .select("id")
    .like("email", `${ADDRESS_PREFIX}%@example.com`);
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

  const store = createMembershipStore(admin);
  const jobs = { ...store, refreshStatuses: async () => ({}) };
  const mailpit = createMailpitSender({ url: MAILPIT_URL, from: "onboarding@resend.dev" });
  const failing = addressOf(MEMBERS[4]);
  const sendFailingOnce: SendEmail = async (email) => {
    if (email.to === failing) throw new Error("Resend refused the email (HTTP 500)");
    return mailpit(email);
  };
  const runJobs = (send: SendEmail) =>
    runDailyJobs({ now: NOW, store: jobs, send, siteUrl: "http://localhost:3000" });

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
