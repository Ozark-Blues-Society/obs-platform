import { randomBytes } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { expect, test, type TestInfo } from "@playwright/test";
import { createMailerLiteClient } from "../lib/mailerlite/client";
import { FAKE_API_KEY, fakeMailerLite } from "../lib/mailerlite/fake-api";
import { createMailerLiteStore } from "../lib/mailerlite/store";
import { MEMBER_GROUPS, syncMailerLite } from "../lib/mailerlite/sync";
import { secretKey, SUPABASE_URL } from "./support/supabase-auth";

// The MailerLite group sync (backlog E-3) against the local database, with a stand-in for
// MailerLite's API (lib/mailerlite/fake-api.ts): nothing reaches MailerLite. It doesn't use a page,
// so it runs once, in the desktop project.
//
// The sync runs only for the members this test creates, as it does after a change to them: the
// local database is shared, and a run across every member would record the fixture members as
// synced.
const inDesktop = (testInfo: TestInfo) => testInfo.project.name === "desktop";
const DESKTOP_ONLY = "No page: runs once, in the desktop project";

const ADDRESS_PREFIX = "mailerlite-sync.";
const NOTHING = { synced: 0, removed: 0, claimedElsewhere: 0, deferred: 0, failed: 0, errors: [] };

/** Deletes this test's members and their records, including any an earlier run left behind. */
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
  // A record outlives its profile (it isn't a foreign key), so delete those by address.
  const { error: recordsError } = await admin
    .from("mailerlite_subscribers")
    .delete()
    .like("email", `${ADDRESS_PREFIX}%@example.com`);
  expect(recordsError).toBeNull();
}

test("keeps the member groups in step with the members' profiles", async ({}, testInfo) => {
  test.skip(!inDesktop(testInfo), DESKTOP_ONLY);
  const admin = createClient(SUPABASE_URL, secretKey(), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  await deleteTestMembers(admin);
  try {
    await keepsGroupsInStep(admin);
  } finally {
    await deleteTestMembers(admin);
  }
});

async function keepsGroupsInStep(admin: SupabaseClient) {
  const run = randomBytes(4).toString("hex");
  const address = (name: string) => `${ADDRESS_PREFIX}${run}.${name}@example.com`;
  const members = {
    ada: { level: "band", status: "active", expires_at: "2031-07-15T23:00:00Z" },
    bo: { level: "sponsor", status: "expiring", expires_at: "2031-01-10T23:00:00Z" },
    cy: { level: "individual", status: "lapsed", expires_at: "2030-11-01T23:00:00Z" },
    di: { level: null, status: null, expires_at: null },
  };
  const ids: Record<string, string> = {};
  for (const [name, membership] of Object.entries(members)) {
    const { data, error } = await admin.auth.admin.createUser({
      email: address(name),
      email_confirm: true,
      user_metadata: { first_name: name.toUpperCase(), last_name: "Tester" },
    });
    expect(error).toBeNull();
    ids[name] = data.user!.id;
    // As the Stripe webhook will: the sign-up trigger has made the profile.
    const { error: updateError } = await admin
      .from("profiles")
      .update(membership)
      .eq("id", ids[name]);
    expect(updateError).toBeNull();
  }

  const api = fakeMailerLite();
  const client = createMailerLiteClient({ apiKey: FAKE_API_KEY, fetch: api.fetch });
  const store = createMailerLiteStore(admin);
  const sync = () => syncMailerLite({ client, store, profileIds: Object.values(ids) });
  const records = async () => {
    const { data, error } = await admin
      .from("mailerlite_subscribers")
      .select("profile_id, subscriber_id, email, first_name, last_name, group_ids, lease_until")
      .in("profile_id", Object.values(ids))
      .order("email");
    expect(error).toBeNull();
    return data!;
  };

  // The first run makes the groups and adds the three members.
  expect(await sync()).toEqual({ ...NOTHING, synced: 3 });
  expect(api.membersOf(MEMBER_GROUPS.active)).toEqual([address("ada")]);
  expect(api.membersOf(MEMBER_GROUPS.band)).toEqual([address("ada")]);
  expect(api.membersOf(MEMBER_GROUPS.expiring)).toEqual([address("bo")]);
  expect(api.membersOf(MEMBER_GROUPS.sponsor)).toEqual([address("bo")]);
  expect(api.membersOf(MEMBER_GROUPS.lapsed)).toEqual([address("cy")]);
  expect(api.membersOf(MEMBER_GROUPS.individual)).toEqual([]);
  expect(api.subscriber(address("di"))).toBeUndefined();
  expect(await records()).toEqual(
    ["ada", "bo", "cy"].map((name) => {
      const subscriber = api.subscriber(address(name))!;
      return {
        profile_id: ids[name],
        subscriber_id: subscriber.id,
        email: address(name),
        first_name: name.toUpperCase(),
        last_name: "Tester",
        group_ids: [...subscriber.groups],
        lease_until: null,
      };
    }),
  );

  // Nothing changed: the second run only lists the groups.
  let before = api.requests.length;
  expect(await sync()).toEqual(NOTHING);
  expect(api.requests.slice(before).map((r) => `${r.method} ${r.path.split("?")[0]}`)).toEqual([
    "GET groups",
  ]);

  // Ada's membership lapses, Cy renews at Business, Di pays, and Bo's account is deleted.
  const changes = {
    ada: { status: "lapsed" },
    cy: { level: "business", status: "active", expires_at: "2031-11-01T23:00:00Z" },
    di: { level: "individual", status: "active", expires_at: "2031-12-01T23:00:00Z" },
  };
  for (const [name, change] of Object.entries(changes)) {
    const { error } = await admin.from("profiles").update(change).eq("id", ids[name]);
    expect(error).toBeNull();
  }
  expect((await admin.auth.admin.deleteUser(ids.bo)).error).toBeNull();

  expect(await sync()).toEqual({ ...NOTHING, synced: 3, removed: 1 });
  expect(api.membersOf(MEMBER_GROUPS.active)).toEqual([address("cy"), address("di")]);
  expect(api.membersOf(MEMBER_GROUPS.lapsed)).toEqual([address("ada")]);
  expect(api.membersOf(MEMBER_GROUPS.band)).toEqual([]);
  expect(api.membersOf(MEMBER_GROUPS.business)).toEqual([address("cy")]);
  expect(api.membersOf(MEMBER_GROUPS.individual)).toEqual([address("di")]);
  expect(api.membersOf(MEMBER_GROUPS.expiring)).toEqual([]);
  expect(api.membersOf(MEMBER_GROUPS.sponsor)).toEqual([]);
  expect((await records()).map((record) => record.profile_id).sort()).toEqual(
    [ids.ada, ids.cy, ids.di].sort(),
  );

  // While another run has Ada, this one leaves her to it; once she's let go, it syncs her.
  const { data: taken, error: takeError } = await admin.rpc("claim_mailerlite_member", {
    p_profile_id: ids.ada,
    p_lease_seconds: 60,
  });
  expect(takeError).toBeNull();
  expect(taken).toHaveLength(1);
  const renewed = { status: "active", expires_at: "2032-01-01T23:00:00Z" };
  expect((await admin.from("profiles").update(renewed).eq("id", ids.ada)).error).toBeNull();

  before = api.requests.length;
  expect(await sync()).toEqual({ ...NOTHING, claimedElsewhere: 1 });
  expect(api.requests.length).toBe(before + 1);

  const { error: releaseError } = await admin
    .from("mailerlite_subscribers")
    .update({ lease_until: null })
    .eq("profile_id", ids.ada);
  expect(releaseError).toBeNull();
  expect(await sync()).toEqual({ ...NOTHING, synced: 1 });
  expect(api.membersOf(MEMBER_GROUPS.active)).toEqual([
    address("ada"),
    address("cy"),
    address("di"),
  ]);
  expect(api.membersOf(MEMBER_GROUPS.band)).toEqual([address("ada")]);
  expect(api.membersOf(MEMBER_GROUPS.lapsed)).toEqual([]);
}
