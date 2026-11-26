import {
  expect,
  test,
  type APIRequestContext,
  type BrowserContext,
  type Page,
  type TestInfo,
} from "@playwright/test";
import { clearInbox, signInLinkFor } from "./support/mailpit";
import { restorePassword } from "./support/supabase-auth";

// Sign-in against the local Supabase stack, with the synthetic fixture members
// (scripts/fixtures/members.mts), who all share this password locally. Every test and browser
// project uses a member of its own, so tests running in parallel never share a session or inbox.
const PASSWORD = "obs-local-dev";
const MEMBERS = {
  emailLink: { desktop: "casey.brooks@example.com", phone: "robin.fields@example.com" },
  offSiteNext: { desktop: "marcus.lane@example.com", phone: "ruth.abbott@example.com" },
  password: { desktop: "jesse.carter@example.com", phone: "terry.mills@example.com" },
  signOut: { desktop: "glen.pruitt@example.com", phone: "june.little@example.com" },
  refresh: { desktop: "bev.grant@example.com", phone: "otis.ivy@example.com" },
  setPassword: { desktop: "hazel.monroe@example.com", phone: "walt.ferris@example.com" },
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

/** Asks for a sign-in link on /sign-in and returns the link from the email that arrives. */
async function emailedSignInLink(page: Page, request: APIRequestContext, email: string) {
  await page.goto("/sign-in");
  return requestSignInLink(page, request, email);
}

/** Asks for a sign-in link with the sign-in page's form and returns the link from the email. */
async function requestSignInLink(page: Page, request: APIRequestContext, email: string) {
  await clearInbox(request, email);
  const form = emailLinkForm(page);
  await form.getByLabel("Email address").fill(email);
  await form.getByRole("button", { name: "Email me a sign-in link" }).click();
  await expect(form.getByRole("status")).toContainText("Check your email.");
  return signInLinkFor(request, email);
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

    const link = await emailedSignInLink(page, request, email);
    expect(link.pathname).toBe("/auth/confirm");
    // The link uses the stack's site URL. Open it on the server under test, so the session
    // cookie lands on the site this test is browsing.
    await page.goto(`${link.pathname}${link.search}`);

    await expectSignedInAs(page, email);
  });

  test("a link whose next leads off the site lands on My Account", async ({
    page,
    request,
  }, testInfo) => {
    const email = member("offSiteNext", testInfo);
    const link = await emailedSignInLink(page, request, email);

    // Resolving the dot segment turns "/.//evil.example" into "//evil.example", another site.
    link.searchParams.set("next", "/.//evil.example");
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

test.describe("setting a password", () => {
  const NEW_PASSWORD = "delta blues forever";

  // Both tests change the same member's password, so they run one after the other. Other tests and
  // supabase/tests/seed_test.sql expect the fixture password, so it goes back after each test, and
  // before each in case an earlier run stopped halfway.
  test.describe.configure({ mode: "default" });
  test.beforeEach(async ({ request }, testInfo) => {
    await restorePassword(request, member("setPassword", testInfo), NEW_PASSWORD, PASSWORD);
  });
  test.afterEach(async ({ request }, testInfo) => {
    await restorePassword(request, member("setPassword", testInfo), NEW_PASSWORD, PASSWORD);
  });

  function newPasswordField(page: Page) {
    return page.getByLabel("New password", { exact: true });
  }

  function confirmField(page: Page) {
    return page.getByLabel("Type the new password again");
  }

  async function saveNewPassword(page: Page, password: string, confirm: string) {
    await newPasswordField(page).fill(password);
    await confirmField(page).fill(confirm);
    await page.getByRole("button", { name: "Save password" }).click();
  }

  async function signOut(page: Page) {
    await page.getByRole("link", { name: "Back to My Account" }).click();
    await page.getByRole("button", { name: "Sign out" }).click();
    await expect(page).toHaveURL(/^http:\/\/[^/]+\/$/);
  }

  test("a signed-in member changes their password", async ({ page }, testInfo) => {
    const email = member("setPassword", testInfo);
    await page.goto("/sign-in");
    await signInWithPassword(page, email, PASSWORD);
    await expectSignedInAs(page, email);

    await page.getByRole("link", { name: "Set or change your password" }).click();
    await expect(page).toHaveURL(/\/account\/password$/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Set or change your password");

    // Each problem is announced and tied to the field it's about.
    const main = page.getByRole("main");
    await saveNewPassword(page, "short", "short");
    await expect(main.getByRole("alert")).toContainText("too short");
    await expect(newPasswordField(page)).toHaveAttribute("aria-invalid", "true");
    await expect(newPasswordField(page)).toHaveAccessibleDescription(
      /At least 8 characters.+too short/,
    );

    await saveNewPassword(page, NEW_PASSWORD, `${NEW_PASSWORD}!`);
    await expect(main.getByRole("alert")).toContainText("don't match");
    await expect(confirmField(page)).toHaveAttribute("aria-invalid", "true");
    await expect(confirmField(page)).toHaveAccessibleDescription(/don't match/);

    await saveNewPassword(page, NEW_PASSWORD, NEW_PASSWORD);
    await expect(main.getByRole("status")).toContainText("Your new password is saved.");
    await expect(main.getByRole("alert")).toHaveCount(0);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow, "no sideways scrolling at phone width").toBeLessThanOrEqual(0);

    // The old password stops working and the new one signs in.
    await signOut(page);
    await page.goto("/sign-in");
    await signInWithPassword(page, email, PASSWORD);
    await expect(passwordForm(page).getByRole("alert")).toContainText("don't match");
    await signInWithPassword(page, email, NEW_PASSWORD);
    await expectSignedInAs(page, email);
  });

  test("a member who forgot their password gets in with an email link and sets a new one", async ({
    page,
    request,
  }, testInfo) => {
    const email = member("setPassword", testInfo);
    await page.goto("/sign-in");

    // The password form points to the email link.
    const help = passwordForm(page).getByText("Forgot your password, or never set one?");
    await expect(help).toBeVisible();
    await help.getByRole("link", { name: "Email yourself a sign-in link" }).click();
    await expect(page).toHaveURL(/\/sign-in#email-link$/);
    await expect(emailLinkForm(page).getByLabel("Email address")).toBeInViewport();

    const link = await requestSignInLink(page, request, email);
    await page.goto(`${link.pathname}${link.search}`);
    await expectSignedInAs(page, email);

    await page.getByRole("link", { name: "Set or change your password" }).click();
    await saveNewPassword(page, NEW_PASSWORD, NEW_PASSWORD);
    await expect(page.getByRole("main").getByRole("status")).toContainText(
      "Your new password is saved.",
    );

    await signOut(page);
    await page.goto("/sign-in");
    await signInWithPassword(page, email, NEW_PASSWORD);
    await expectSignedInAs(page, email);
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
