import { expect, test, type BrowserContext, type Page, type TestInfo } from "@playwright/test";
import { clearInbox, signInLinkFor } from "./support/mailpit";

// Sign-in against the local Supabase stack, with the synthetic fixture members
// (scripts/fixtures/members.mts), who all share this password locally. Every test and browser
// project uses a member of its own, so tests running in parallel never share a session or inbox.
const PASSWORD = "obs-local-dev";
const MEMBERS = {
  emailLink: { desktop: "casey.brooks@example.com", phone: "robin.fields@example.com" },
  password: { desktop: "jesse.carter@example.com", phone: "terry.mills@example.com" },
  signOut: { desktop: "glen.pruitt@example.com", phone: "june.little@example.com" },
  refresh: { desktop: "bev.grant@example.com", phone: "otis.ivy@example.com" },
};

function member(flow: keyof typeof MEMBERS, testInfo: TestInfo): string {
  return MEMBERS[flow][testInfo.project.name as "desktop" | "phone"];
}

function emailLinkForm(page: Page) {
  return page.getByRole("region", { name: "Email me a sign-in link" });
}

function passwordForm(page: Page) {
  return page.getByRole("region", { name: "Sign in with a password" });
}

async function signInWithPassword(page: Page, email: string, password: string) {
  const form = passwordForm(page);
  await form.getByLabel("Email address").fill(email);
  await form.getByLabel("Password").fill(password);
  await form.getByRole("button", { name: "Sign in" }).click();
}

async function expectSignedInAs(page: Page, email: string) {
  await expect(page).toHaveURL(/\/account$/);
  await expect(page.getByRole("heading", { level: 1, name: "My Account" })).toBeVisible();
  await expect(page.getByRole("main")).toContainText(`signed in as ${email}`);
}

test.describe("email-link sign-in", () => {
  test("a member signs in with the link from their email", async ({ page, request }, testInfo) => {
    const email = member("emailLink", testInfo);
    await clearInbox(request, email);

    await page.goto("/sign-in");
    const form = emailLinkForm(page);
    await form.getByLabel("Email address").fill(email);
    await form.getByRole("button", { name: "Email me a sign-in link" }).click();
    await expect(form.getByRole("status")).toContainText("Check your email.");

    const link = await signInLinkFor(request, email);
    expect(link.pathname).toBe("/auth/confirm");
    // The link uses the stack's site URL. Open it on the server under test, so the session
    // cookie lands on the site this test is browsing.
    await page.goto(`${link.pathname}${link.search}`);

    await expectSignedInAs(page, email);
  });

  test("an unknown address gets the same answer as a member's", async ({ page }) => {
    await page.goto("/sign-in");
    const form = emailLinkForm(page);
    await form.getByLabel("Email address").fill("not-a-member@example.com");
    await form.getByRole("button", { name: "Email me a sign-in link" }).click();

    await expect(form.getByRole("status")).toContainText("Check your email.");
  });

  test("a used or expired link explains what happened", async ({ page }) => {
    await page.goto("/auth/confirm?token_hash=not-a-real-token&type=email");

    await expect(page).toHaveURL(/\/sign-in\?error=link-expired$/);
    // Scoped to <main>: Next.js adds its own (empty) role="alert" route announcer to every page.
    await expect(page.getByRole("main").getByRole("alert")).toContainText(
      "expired or was already used",
    );
  });
});

test.describe("password sign-in", () => {
  test("a member signs in and returns to the page that asked", async ({ page }, testInfo) => {
    const email = member("password", testInfo);

    await page.goto("/account");
    await expect(page).toHaveURL(/\/sign-in\?next=%2Faccount$/);
    await signInWithPassword(page, email, PASSWORD);

    await expectSignedInAs(page, email);
  });

  test("a wrong password is refused with a clear message", async ({ page }, testInfo) => {
    const email = member("password", testInfo);

    await page.goto("/sign-in");
    await signInWithPassword(page, email, "not-the-password");

    const form = passwordForm(page);
    await expect(form.getByRole("alert")).toContainText("don't match");
    await expect(page).toHaveURL(/\/sign-in$/);
    await expect(form.getByLabel("Email address")).toHaveValue(email);
  });

  test("the sign-in page fits a phone screen without scrolling sideways", async ({ page }) => {
    await page.goto("/sign-in");
    await expect(passwordForm(page)).toBeVisible();

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
  });
});

test("signing out ends the session", async ({ page, context }, testInfo) => {
  const email = member("signOut", testInfo);
  await page.goto("/sign-in");
  await signInWithPassword(page, email, PASSWORD);
  await expectSignedInAs(page, email);

  await page.getByRole("button", { name: "Sign out" }).click();

  await expect(page).toHaveURL(/^http:\/\/[^/]+\/$/);
  expect(await sessionCookies(context)).toEqual([]);
  await page.goto("/account");
  await expect(page).toHaveURL(/\/sign-in\?next=%2Faccount$/);
});

test("the proxy refreshes an expired session before the page renders", async ({
  page,
  context,
}, testInfo) => {
  const email = member("refresh", testInfo);
  await page.goto("/sign-in");
  await signInWithPassword(page, email, PASSWORD);
  await expectSignedInAs(page, email);

  // Make the stored session look expired, as it will be an hour after signing in.
  const before = await readSession(context);
  await writeSession(context, { ...before, expires_at: Math.floor(Date.now() / 1000) - 60 });

  await page.reload();

  await expectSignedInAs(page, email);
  const after = await readSession(context);
  expect(after.refresh_token).not.toBe(before.refresh_token);
  expect(after.expires_at).toBeGreaterThan(Date.now() / 1000);
});

// The session lives in cookies named sb-<project>-auth-token, split into .0, .1, ... chunks when
// long, holding "base64-" plus the base64url-encoded session JSON (the @supabase/ssr format).
const SESSION_COOKIE = /^sb-.+-auth-token(?:\.(\d+))?$/;
const CHUNK_SIZE = 3180;

type StoredSession = { refresh_token: string; expires_at: number } & Record<string, unknown>;

async function sessionCookies(context: BrowserContext) {
  const cookies = (await context.cookies()).filter((cookie) => SESSION_COOKIE.test(cookie.name));
  const chunk = (name: string) => Number(SESSION_COOKIE.exec(name)?.[1] ?? 0);
  return cookies.sort((a, b) => chunk(a.name) - chunk(b.name));
}

async function readSession(context: BrowserContext): Promise<StoredSession> {
  const value = (await sessionCookies(context)).map((cookie) => cookie.value).join("");
  expect(value, "a session cookie").toMatch(/^base64-/);
  return JSON.parse(Buffer.from(value.slice("base64-".length), "base64url").toString("utf8"));
}

async function writeSession(context: BrowserContext, session: StoredSession) {
  const cookies = await sessionCookies(context);
  const template = cookies[0];
  const name = template.name.replace(/\.\d+$/, "");
  const value = `base64-${Buffer.from(JSON.stringify(session)).toString("base64url")}`;
  const chunks: string[] = [];
  for (let start = 0; start < value.length; start += CHUNK_SIZE) {
    chunks.push(value.slice(start, start + CHUNK_SIZE));
  }

  await context.clearCookies({ name: SESSION_COOKIE });
  await context.addCookies(
    chunks.map((chunkValue, index) => ({
      ...template,
      name: chunks.length === 1 ? name : `${name}.${index}`,
      value: chunkValue,
    })),
  );
}
