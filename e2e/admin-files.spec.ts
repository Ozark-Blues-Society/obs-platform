import { expect, test, type Browser, type Page, type TestInfo } from "@playwright/test";
import { EDITOR, FIXTURE_PASSWORD, accessToken, supabaseHeaders } from "./support/member-files";
import { SUPABASE_URL } from "./support/supabase-auth";

// The members-only files screen (backlog M-7) against the local Supabase stack, with the synthetic
// fixture members (scripts/fixtures/members.mts): the fixture editor uploads a file for Band and up,
// members download it (or don't), and the editor removes it. Both members' memberships end within
// 30 days ("expiring"), which doesn't change what they can download.
const BAND_MEMBER = "ray.booker@example.com";
const INDIVIDUAL_MEMBER = "rosa.delgado@example.com";

/**
 * A title of this test's own, so tests running at the same time (the two browser projects, and
 * this file's tests in parallel workers) never touch each other's file. A testId starts with a
 * hash of the file and ends with a hash of the project and the test's title path, so the end is
 * what differs between tests.
 */
function fileTitle(testInfo: TestInfo): string {
  return `E2E booking guide (${testInfo.project.name}, ${testInfo.testId.slice(-8)})`;
}

async function signIn(page: Page, email: string, next: string) {
  await page.goto(`/sign-in?next=${encodeURIComponent(next)}`);
  const form = page.getByRole("region", { name: "Sign in with a password" });
  await form.getByLabel("Email address").fill(email);
  await form.getByLabel("Password").fill(FIXTURE_PASSWORD);
  await form.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(new RegExp(`${next}$`));
}

async function memberPage(browser: Browser, email: string): Promise<Page> {
  const context = await browser.newContext();
  const page = await context.newPage();
  await signIn(page, email, "/account");
  return page;
}

test("a visitor is sent to sign in first", async ({ page }) => {
  await page.goto("/admin/files");
  await expect(page).toHaveURL(/\/sign-in\?next=%2Fadmin%2Ffiles$/);
});

test("members without the Editor role can't manage files", async ({ page }) => {
  await signIn(page, INDIVIDUAL_MEMBER, "/admin/files");
  const main = page.getByRole("main");
  await expect(main).toContainText(
    "Only editors and administrators can manage members-only files.",
  );
  await expect(main.getByLabel("File")).toHaveCount(0);
});

test.describe("an editor", () => {
  // Remove this run's file through the Data API and Storage if a step failed before the test
  // removed it itself.
  test.afterEach(async ({ request }, testInfo) => {
    const token = await accessToken(request, EDITOR);
    const rows = await request.get(`${SUPABASE_URL}/rest/v1/member_files`, {
      headers: supabaseHeaders(token),
      params: { select: "id,object_path", title: `eq.${fileTitle(testInfo)}` },
    });
    for (const row of (await rows.json()) as { id: string; object_path: string }[]) {
      await request.delete(`${SUPABASE_URL}/rest/v1/member_files`, {
        headers: supabaseHeaders(token),
        params: { id: `eq.${row.id}` },
      });
      await request.delete(`${SUPABASE_URL}/storage/v1/object/member-files`, {
        headers: supabaseHeaders(token),
        data: { prefixes: [row.object_path] },
      });
    }
  });

  test("uploads a file for some levels, members at those levels download it, and removes it", async ({
    page,
    browser,
    context,
  }, testInfo) => {
    const title = fileTitle(testInfo);
    const body = `Booking guide for ${testInfo.project.name}`;
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    await signIn(page, EDITOR, "/admin/files");

    const upload = page.getByRole("region", { name: "Upload a file" });
    await upload.getByLabel("File").setInputFiles({
      name: "Booking guide.pdf",
      mimeType: "application/pdf",
      buffer: Buffer.from(body),
    });
    await upload.getByLabel("Name").fill(title);
    await upload.getByLabel("Only some membership levels").check();
    await upload.getByLabel("Band").check();
    await upload.getByLabel("Business").check();
    await upload.getByRole("button", { name: "Upload file" }).click();

    await expect(upload.getByText(`Added "${title}".`)).toBeVisible();
    const code = (await upload.locator("code").textContent()) ?? "";
    expect(code).toMatch(/^[0-9a-f-]{36}$/);
    await upload.getByRole("button", { name: "Copy code for the new file" }).click();
    await expect(upload.getByText("Code copied.")).toBeVisible();
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(code);

    const listed = page
      .getByRole("region", { name: "Files" })
      .getByRole("listitem")
      .filter({ hasText: title });
    await expect(listed).toContainText("Band and Business members");
    await expect(listed).toContainText("Booking guide.pdf");
    await expect(listed).toContainText(code);

    // A Band member gets it; an Individual member doesn't.
    const band = await memberPage(browser, BAND_MEMBER);
    const allowed = await band.request.get(`/files/${code}`);
    expect(allowed.status()).toBe(200);
    expect(await allowed.text()).toBe(body);
    expect(allowed.headers()["content-disposition"]).toMatch(
      /attachment.*Booking(%20| )guide\.pdf/,
    );
    const individual = await memberPage(browser, INDIVIDUAL_MEMBER);
    expect((await individual.request.get(`/files/${code}`, { maxRedirects: 0 })).status()).toBe(
      404,
    );

    // Removing it, after confirming, stops the download at once.
    page.once("dialog", (dialog) => dialog.accept());
    await listed.getByRole("button", { name: `Remove ${title}` }).click();
    await expect(page.getByText(`Removed "${title}".`)).toBeVisible();
    await expect(listed).toHaveCount(0);
    expect((await band.request.get(`/files/${code}`, { maxRedirects: 0 })).status()).toBe(404);

    await band.context().close();
    await individual.context().close();
  });

  test("keeps a file when the removal isn't confirmed", async ({ page, request }, testInfo) => {
    const title = fileTitle(testInfo);
    await signIn(page, EDITOR, "/admin/files");
    const upload = page.getByRole("region", { name: "Upload a file" });
    // With nothing chosen, focus goes to the field to fix, which the message now describes.
    await upload.getByRole("button", { name: "Upload file" }).click();
    await expect(upload.getByLabel("File")).toBeFocused();
    await expect(upload.getByLabel("File")).toHaveAccessibleDescription(
      /Choose the file to upload\./,
    );
    await upload.getByLabel("File").setInputFiles({
      name: "minutes.txt",
      mimeType: "text/plain",
      buffer: Buffer.from("Minutes"),
    });
    // Enter in the empty Name box: focus is already there, so the message is announced instead.
    await upload.getByLabel("Name").press("Enter");
    await expect(upload.getByRole("alert")).toHaveText(
      "Give the file a name members will recognize.",
    );
    await expect(upload.getByLabel("Name")).toBeFocused();
    await upload.getByLabel("Name").fill(title);
    await upload.getByRole("button", { name: "Upload file" }).click();
    await expect(upload.getByText(`Added "${title}".`)).toBeVisible();

    const listed = page
      .getByRole("region", { name: "Files" })
      .getByRole("listitem")
      .filter({ hasText: title });
    await expect(listed).toContainText("Every member");
    page.once("dialog", (dialog) => dialog.dismiss());
    await listed.getByRole("button", { name: `Remove ${title}` }).click();
    await expect(listed).toHaveCount(1);

    const token = await accessToken(request, EDITOR);
    const rows = await request.get(`${SUPABASE_URL}/rest/v1/member_files`, {
      headers: supabaseHeaders(token),
      params: { select: "title", title: `eq.${title}` },
    });
    expect(await rows.json()).toEqual([{ title }]);
  });
});
