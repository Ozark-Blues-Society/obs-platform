import { expect, test, type Page } from "@playwright/test";
import {
  EDITOR,
  FIXTURE_PASSWORD,
  accessToken,
  addMemberFile,
  readThroughSupabase,
  removeMemberFile,
  type TestFile,
} from "./support/member-files";
import { SUPABASE_URL } from "./support/supabase-auth";

// Members-only files (backlog M-7, decision 0001) against the local Supabase stack, with the
// synthetic fixture members (scripts/fixtures/members.mts):
const MEMBERS = {
  // an active Band member;
  band: "tasha.moore@example.com",
  // an active Individual member: the wrong level for a file for Band and up;
  individual: "shannon.oneal@example.com",
  // a Band member whose membership ended yesterday.
  lapsed: "mae.whitfield@example.com",
};

// Two files, made fresh for each run by the fixture editor: one for every member, one for Band,
// Business and Sponsor members.
let editorToken: string;
let forMembers: TestFile;
let forBandUp: TestFile;

test.beforeAll(async ({ request }) => {
  editorToken = await accessToken(request, EDITOR);
  forMembers = await addMemberFile(request, editorToken, {
    title: "Meeting minutes",
    audience: "members",
  });
  forBandUp = await addMemberFile(request, editorToken, {
    title: "Venue booking guide",
    audience: "levels",
    levels: ["band", "business", "sponsor"],
  });
});

test.afterAll(async ({ request }) => {
  for (const file of [forMembers, forBandUp]) {
    if (file) await removeMemberFile(request, editorToken, file);
  }
});

async function signIn(page: Page, email: string, next = "/account") {
  await page.goto(`/sign-in?next=${encodeURIComponent(next)}`);
  const form = page.getByRole("region", { name: "Sign in with a password" });
  await form.getByLabel("Email address").fill(email);
  await form.getByLabel("Password").fill(FIXTURE_PASSWORD);
  await form.getByRole("button", { name: "Sign in" }).click();
}

test.describe("through Supabase's own APIs", () => {
  test("visitors can't read members-only files in any way", async ({ request }) => {
    for (const file of [forMembers, forBandUp]) {
      const result = await readThroughSupabase(request, file);
      expect(result.row.status, "the Data API refuses visitors").toBe(401);
      expect(JSON.parse(result.list.text), "listing the folder finds nothing").toEqual([]);
      for (const answer of [result.download, result.publicDownload, result.sign]) {
        expect(answer.status).toBe(400);
      }
      expect(JSON.stringify(result)).not.toContain(file.body);
      expect(JSON.stringify(result)).not.toContain(file.title);
    }
  });

  test("a member whose membership has ended can't read any of them", async ({ request }) => {
    const token = await accessToken(request, MEMBERS.lapsed);
    for (const file of [forMembers, forBandUp]) {
      const result = await readThroughSupabase(request, file, token);
      expect(JSON.parse(result.row.text)).toEqual([]);
      expect(JSON.parse(result.list.text)).toEqual([]);
      for (const answer of [result.download, result.publicDownload, result.sign]) {
        expect(answer.status).toBe(400);
      }
      expect(JSON.stringify(result)).not.toContain(file.body);
    }
  });

  test("an Individual member can't read a file for other levels, only the one for every member", async ({
    request,
  }) => {
    const token = await accessToken(request, MEMBERS.individual);

    const refused = await readThroughSupabase(request, forBandUp, token);
    expect(JSON.parse(refused.row.text)).toEqual([]);
    expect(JSON.parse(refused.list.text)).toEqual([]);
    expect(refused.download.status).toBe(400);
    expect(refused.sign.status).toBe(400);
    expect(JSON.stringify(refused)).not.toContain(forBandUp.body);

    const allowed = await readThroughSupabase(request, forMembers, token);
    expect(JSON.parse(allowed.row.text)).toEqual([{ title: "Meeting minutes" }]);
    expect(allowed.download).toEqual({ status: 200, text: forMembers.body });
    expect(allowed.sign.status).toBe(200);
    // Even a member who may download it gets nothing from a public address: the bucket is private.
    expect(allowed.publicDownload.status).toBe(400);
  });

  test("a Band member can read both", async ({ request }) => {
    const token = await accessToken(request, MEMBERS.band);
    for (const file of [forMembers, forBandUp]) {
      const result = await readThroughSupabase(request, file, token);
      expect(result.download).toEqual({ status: 200, text: file.body });
    }
  });
});

test.describe("through the site's download link", () => {
  test("a visitor is sent to sign in, and gets the file after signing in", async ({ page }) => {
    const path = `/files/${forMembers.id}`;
    const first = await page.request.get(path, { maxRedirects: 0 });
    expect(first.status()).toBe(303);
    expect(first.headers()["location"]).toBe(`/sign-in?next=${encodeURIComponent(path)}`);
    expect(first.headers()["cache-control"]).toBe("private, no-store");

    const download = page.waitForEvent("download");
    await signIn(page, MEMBERS.individual, path);
    const file = await download;
    expect(file.suggestedFilename()).toBe("Meeting minutes.txt");
    const stream = await file.createReadStream();
    const chunks: Buffer[] = [];
    for await (const chunk of stream) chunks.push(chunk as Buffer);
    expect(Buffer.concat(chunks).toString()).toBe(forMembers.body);
  });

  test("a member who may download a file gets a one-minute Storage link, and nobody after them gets it", async ({
    page,
    playwright,
  }) => {
    await signIn(page, MEMBERS.band);
    await expect(page).toHaveURL(/\/account$/);

    const path = `/files/${forBandUp.id}`;
    const response = await page.request.get(path, { maxRedirects: 0 });
    expect(response.status()).toBe(303);
    expect(response.headers()["cache-control"]).toBe("private, no-store");
    const location = response.headers()["location"];
    expect(location.startsWith(`${SUPABASE_URL}/storage/v1/object/sign/member-files/`)).toBe(true);

    // The link names the file, downloads it rather than showing it, and lasts a minute.
    const token = new URL(location).searchParams.get("token") ?? "";
    const claims = JSON.parse(Buffer.from(token.split(".")[1], "base64url").toString()) as {
      url: string;
      iat: number;
      exp: number;
    };
    expect(claims.url).toBe(`member-files/${forBandUp.objectPath}`);
    expect(claims.exp - claims.iat).toBe(60);
    const fileResponse = await page.request.get(location);
    expect(fileResponse.status()).toBe(200);
    expect(await fileResponse.text()).toBe(forBandUp.body);
    expect(fileResponse.headers()["content-disposition"]).toContain("attachment");

    // Right after, a visitor asking for the same link is still sent to sign in: nothing is cached.
    const visitor = await playwright.request.newContext({ baseURL: page.url() });
    const again = await visitor.get(path, { maxRedirects: 0 });
    expect(again.status()).toBe(303);
    expect(again.headers()["location"]).toBe(`/sign-in?next=${encodeURIComponent(path)}`);
    expect(await again.text()).not.toContain(forBandUp.body);
    await visitor.dispose();
  });

  test("an Individual member is told a file for other levels isn't available to them", async ({
    page,
  }) => {
    await signIn(page, MEMBERS.individual);
    await expect(page).toHaveURL(/\/account$/);

    const response = await page.goto(`/files/${forBandUp.id}`);
    expect(response?.status()).toBe(404);
    expect(response?.headers()["location"]).toBeUndefined();
    await expect(
      page.getByRole("heading", { level: 1, name: /This file isn.t available to you/ }),
    ).toBeVisible();
    await expect(page.locator("body")).not.toContainText(forBandUp.body);
  });

  test("a member whose membership has ended is asked to renew", async ({ page }) => {
    await signIn(page, MEMBERS.lapsed);
    await expect(page).toHaveURL(/\/account$/);

    const response = await page.goto(`/files/${forMembers.id}`);
    expect(response?.status()).toBe(403);
    await expect(
      page.getByRole("heading", { level: 1, name: "Your membership has ended" }),
    ).toBeVisible();
    await expect(page.getByRole("link", { name: "Renew your membership" })).toHaveAttribute(
      "href",
      "/join",
    );
  });
});
