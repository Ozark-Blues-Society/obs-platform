import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { buildMainNav } from "@/lib/site/navigation";
import { HeaderNavView } from "./header-nav";

// Breakpoint classes don't apply in jsdom, so the bar's menu (lg and up) and the phone menu are
// both in the document. The phone menu sits in a `hidden` panel until its button opens it.
const ITEMS = buildMainNav([
  { label: "About & Volunteer", href: "/about-and-volunteer", placement: "main" },
  { label: "Board", href: "/board", placement: "about" },
  { label: "History", href: "/history", placement: "about" },
]);
// A same-page link: ESLint wants next/link for links to the site's pages.
const ACCOUNT = <a href="#sign-in">Sign in</a>;

function renderNav(pathname: string | null = "/") {
  const view = render(<HeaderNavView items={ITEMS} account={ACCOUNT} pathname={pathname} />);
  const menuButton = screen.getByRole("button", { name: "Menu" });
  const panel = () => document.getElementById(menuButton.getAttribute("aria-controls")!)!;
  // The visitor moves to another page (the header stays, with a new path from usePathname).
  const goTo = (path: string) =>
    view.rerender(<HeaderNavView items={ITEMS} account={ACCOUNT} pathname={path} />);
  return { ...view, menuButton, panel, goTo };
}

describe("the phone menu", () => {
  it("opens from its button, which says whether it's open", () => {
    const { menuButton, panel } = renderNav();
    expect(menuButton).toHaveAttribute("aria-expanded", "false");
    expect(panel()).not.toBeVisible();

    fireEvent.click(menuButton);

    expect(menuButton).toHaveAttribute("aria-expanded", "true");
    expect(panel()).toBeVisible();
    const menu = within(panel()).getByRole("navigation", { name: "Main" });
    expect(within(menu).getByRole("link", { name: "Donate" })).toHaveAttribute("href", "/donate");
    // Groups are labeled lists of their links.
    expect(
      within(within(menu).getByRole("list", { name: "About" })).getAllByRole("link"),
    ).toHaveLength(2);
    // Below the sm breakpoint the account links are in the menu too.
    expect(within(panel()).getByRole("link", { name: "Sign in" })).toBeInTheDocument();
  });

  it("closes on Escape and gives focus back to its button", () => {
    const { menuButton, panel } = renderNav();
    fireEvent.click(menuButton);
    within(panel()).getByRole("link", { name: "Blog" }).focus();

    fireEvent.keyDown(document, { key: "Escape" });

    expect(menuButton).toHaveAttribute("aria-expanded", "false");
    expect(panel()).not.toBeVisible();
    expect(menuButton).toHaveFocus();
  });

  it("closes on Escape from a field on the page, leaving focus in the field", () => {
    const { menuButton, panel } = renderNav();
    render(<input aria-label="Email address" />);
    const field = screen.getByRole("textbox", { name: "Email address" });
    fireEvent.click(menuButton);
    field.focus();

    fireEvent.keyDown(document, { key: "Escape" });

    expect(menuButton).toHaveAttribute("aria-expanded", "false");
    expect(panel()).not.toBeVisible();
    expect(field).toHaveFocus();
  });

  it("closes when a link in it is chosen, or the page changes", () => {
    const { menuButton, panel, goTo } = renderNav();
    // jsdom can't follow the link itself.
    const stayHere = (event: Event) => event.preventDefault();
    document.addEventListener("click", stayHere);
    fireEvent.click(menuButton);
    fireEvent.click(within(panel()).getByRole("link", { name: "Blog" }));
    document.removeEventListener("click", stayHere);
    expect(menuButton).toHaveAttribute("aria-expanded", "false");

    fireEvent.click(menuButton);
    goTo("/blog");
    expect(menuButton).toHaveAttribute("aria-expanded", "false");
  });

  it("stays closed when the visitor comes back to the page it was opened on", () => {
    const { menuButton, panel, goTo } = renderNav("/");
    fireEvent.click(menuButton);
    expect(menuButton).toHaveAttribute("aria-expanded", "true");

    // A link outside the menu, such as Sign in, leaves the page; Back or the logo returns to it.
    goTo("/sign-in");
    expect(menuButton).toHaveAttribute("aria-expanded", "false");
    goTo("/");
    expect(menuButton).toHaveAttribute("aria-expanded", "false");
    expect(panel()).not.toBeVisible();
  });

  it("toggles closed from its button", () => {
    const { menuButton } = renderNav();
    fireEvent.click(menuButton);
    fireEvent.click(menuButton);
    expect(menuButton).toHaveAttribute("aria-expanded", "false");
  });
});

describe("the bar's menu", () => {
  // The phone panel is hidden, so only the bar's menu is in the accessibility tree.
  const barMenu = () => screen.getByRole("navigation", { name: "Main" });

  it("opens a group from its button and closes it on Escape, returning focus", () => {
    renderNav();
    const about = within(barMenu()).getByRole("button", { name: "About" });
    const list = document.getElementById(about.getAttribute("aria-controls")!)!;
    expect(about).toHaveAttribute("aria-expanded", "false");
    expect(list).not.toBeVisible();

    fireEvent.click(about);
    expect(about).toHaveAttribute("aria-expanded", "true");
    expect(list).toBeVisible();
    const board = within(list).getByRole("link", { name: "Board" });
    board.focus();

    fireEvent.keyDown(document, { key: "Escape" });
    expect(about).toHaveAttribute("aria-expanded", "false");
    expect(about).toHaveFocus();
  });

  it("closes a group on a click elsewhere or when focus leaves it", () => {
    renderNav();
    const about = within(barMenu()).getByRole("button", { name: "About" });

    fireEvent.click(about);
    fireEvent.pointerDown(document.body);
    expect(about).toHaveAttribute("aria-expanded", "false");

    fireEvent.click(about);
    fireEvent.focusOut(about, {
      relatedTarget: within(barMenu()).getByRole("link", { name: "Donate" }),
    });
    expect(about).toHaveAttribute("aria-expanded", "false");
  });

  it("keeps a group open while focus moves within it", () => {
    renderNav();
    const about = within(barMenu()).getByRole("button", { name: "About" });
    fireEvent.click(about);
    const list = document.getElementById(about.getAttribute("aria-controls")!)!;

    fireEvent.focusOut(about, { relatedTarget: within(list).getByRole("link", { name: "Board" }) });
    expect(about).toHaveAttribute("aria-expanded", "true");
  });

  it("keeps a group closed when the visitor comes back to the page it was opened on", () => {
    const { goTo } = renderNav("/");
    const about = within(barMenu()).getByRole("button", { name: "About" });
    const list = document.getElementById(about.getAttribute("aria-controls")!)!;
    fireEvent.click(about);
    expect(about).toHaveAttribute("aria-expanded", "true");

    // Back with the group open, then Forward.
    goTo("/sign-in");
    expect(about).toHaveAttribute("aria-expanded", "false");
    goTo("/");
    expect(about).toHaveAttribute("aria-expanded", "false");
    expect(list).not.toBeVisible();
  });

  it("marks the current page for screen readers", () => {
    renderNav("/blog");
    expect(within(barMenu()).getByRole("link", { name: "Blog" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(within(barMenu()).getByRole("link", { name: "Donate" })).not.toHaveAttribute(
      "aria-current",
    );
  });

  it("marks nothing while the path isn't known", () => {
    const { container } = renderNav(null);
    expect(container.querySelectorAll("[aria-current]")).toHaveLength(0);
  });
});
