import { expect, test, type Page, type TestInfo } from "@playwright/test";
import { removeRole } from "./support/supabase-roles";

// The roles screen (backlog A-2) against the local Supabase stack, with the synthetic fixture
// members (scripts/fixtures/members.mts), who all share this password locally. The fixture
// administrator is the only one, so these tests never give anyone the Administrator role: the test
// of the last administrator relies on it, whichever browser project runs first.
const PASSWORD = "obs-local-dev";
const ADMIN = { email: "avery.collins@example.com", name: "Avery Collins" };
const MEMBERSHIP_MANAGER = "jordan.ellis@example.com";
// Each browser project gives a role to a member of its own, so the two can run side by side.
const NEW_EDITOR = {
  desktop: { email: "irene.coleman@example.com", name: "Irene Coleman" },
  phone: { email: "victor.nash@example.com", name: "Victor Nash" },
};

function newEditor(testInfo: TestInfo) {
  return NEW_EDITOR[testInfo.project.name as "desktop" | "phone"];
}

async function signInTo(page: Page, path: string, email: string) {
  await page.goto(`/sign-in?next=${encodeURIComponent(path)}`);
  const form = page.getByRole("region", { name: "Sign in with a password" });
  await form.getByLabel("Email address").fill(email);
  await form.getByLabel("Password").fill(PASSWORD);
  await form.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(new RegExp(`${path}$`));
}

function staffEntry(page: Page, name: string) {
  return page
    .getByRole("region", { name: "People with roles" })
    .getByRole("listitem")
    .filter({
      has: page.getByRole("list", { name: `Roles of ${name}` }),
    });
}

test("a visitor is sent to sign in first", async ({ page }) => {
  await page.goto("/admin/roles");

  await expect(page).toHaveURL(/\/sign-in\?next=%2Fadmin%2Froles$/);
});

test("staff who aren't administrators can't manage roles", async ({ page }) => {
  await signInTo(page, "/admin/roles", MEMBERSHIP_MANAGER);

  const main = page.getByRole("main");
  await expect(main).toContainText("Only administrators can give and remove roles.");
  await expect(main.getByRole("button")).toHaveCount(0);
  await expect(main.getByLabel("Email address")).toHaveCount(0);
});

test.describe("an administrator", () => {
  // Put the member back the way the seed has them, before the test in case an earlier run stopped
  // halfway, and after: supabase/tests/seed_test.sql expects the fixture roles. Only this test may
  // have these hooks: tests run in parallel, so another test's hooks would take the role away
  // mid-test.
  test.beforeEach(async ({ request }, testInfo) => {
    await removeRole(
      request,
      { admin: ADMIN.email, password: PASSWORD },
      newEditor(testInfo).email,
      "editor",
    );
  });
  test.afterEach(async ({ request }, testInfo) => {
    await removeRole(
      request,
      { admin: ADMIN.email, password: PASSWORD },
      newEditor(testInfo).email,
      "editor",
    );
  });

  test("gives a member a role and takes it away again", async ({ page }, testInfo) => {
    const member = newEditor(testInfo);
    await signInTo(page, "/admin/roles", ADMIN.email);
    await expect(
      page.getByRole("navigation", { name: "Admin" }).getByRole("link", { name: "Roles" }),
    ).toHaveAttribute("aria-current", "page");
    await expect(staffEntry(page, ADMIN.name)).toContainText("Avery Collins (you)");
    await expect(staffEntry(page, member.name)).toHaveCount(0);

    const form = page.getByRole("region", { name: "Give someone a role" });
    await form.getByLabel("Email address").fill("no.such.member@example.com");
    await form.getByLabel("Role").selectOption({ label: "Editor" });
    await form.getByRole("button", { name: "Give role" }).click();
    await expect(form.getByRole("alert")).toContainText("No account uses that email address.");
    await expect(form.getByLabel("Email address")).toHaveAttribute("aria-invalid", "true");
    await expect(form.getByLabel("Role")).toHaveValue("editor");

    await form.getByLabel("Email address").fill(member.email.toUpperCase());
    await form.getByRole("button", { name: "Give role" }).click();
    await expect(form.getByRole("status")).toHaveText(`${member.name} now has the Editor role.`);
    await expect(staffEntry(page, member.name)).toContainText("Editor");

    // The role is in the database, not only on this page.
    await page.reload();
    await expect(staffEntry(page, member.name)).toContainText(member.email);

    await page.getByRole("button", { name: `Remove the Editor role from ${member.name}` }).click();
    const people = page.getByRole("region", { name: "People with roles" });
    await expect(people.getByRole("status")).toHaveText(
      `${member.name} no longer has the Editor role.`,
    );
    await expect(staffEntry(page, member.name)).toHaveCount(0);

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow, "no sideways scrolling at phone width").toBeLessThanOrEqual(0);
  });
});

test("the last administrator can't be removed", async ({ page }) => {
  await signInTo(page, "/admin/roles", ADMIN.email);

  const remove = page.getByRole("button", { name: "Remove your Administrator role" });
  await remove.click();

  const people = page.getByRole("region", { name: "People with roles" });
  const refusal = people.getByRole("alert");
  const message =
    "You can't remove the last administrator. Give someone else the Administrator role first.";
  await expect(refusal).toHaveText(message);
  await expect(staffEntry(page, ADMIN.name)).toContainText("Administrator");

  // Focus stays on the button (a disabled one would lose it while the form sends). Pressing it
  // again shows the refusal in a new alert, which screen readers read out again.
  await expect(remove).toBeFocused();
  await refusal.evaluate((node) => node.setAttribute("data-first-try", ""));
  await page.keyboard.press("Enter");
  await expect(people.locator("[data-first-try]")).toHaveCount(0);
  await expect(refusal).toHaveText(message);
  await expect(remove).toBeFocused();
});
