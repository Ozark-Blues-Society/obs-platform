import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { Visibility } from "@/lib/members/access";
import { levelTitles, MembersOnlyLock } from "./members-only-lock";

const MEMBERS: Visibility = { audience: "members", levels: [] };
const BAND_UP: Visibility = { audience: "levels", levels: ["band", "business", "sponsor"] };

function lock(reason: Parameters<typeof MembersOnlyLock>[0]["reason"], visibility = MEMBERS) {
  render(
    <MembersOnlyLock
      reason={reason}
      visibility={visibility}
      thing="post"
      returnTo="/blog/jam?x=1"
    />,
  );
}

describe("MembersOnlyLock", () => {
  it("asks a visitor to sign in, and brings them back, or to join", () => {
    lock("sign-in");
    expect(screen.getByRole("heading", { name: "This post is for members" })).toBeVisible();
    expect(screen.getByText("Sign in or join to read it.")).toBeVisible();
    expect(screen.getByRole("link", { name: "Sign in" })).toHaveAttribute(
      "href",
      "/sign-in?next=%2Fblog%2Fjam%3Fx%3D1",
    );
    expect(screen.getByRole("link", { name: "Join now" })).toHaveAttribute("href", "/join");
  });

  it("names the levels an item is for", () => {
    lock("sign-in", BAND_UP);
    expect(
      screen.getByRole("heading", { name: "This post is for Band, Business and Sponsor members" }),
    ).toBeVisible();
  });

  it("asks someone who never paid to join, with no Sign in button", () => {
    lock("join");
    expect(screen.getByText("Join the Society to read it.")).toBeVisible();
    expect(screen.queryByRole("link", { name: "Sign in" })).toBeNull();
    expect(screen.getByRole("link", { name: "Join now" })).toHaveAttribute("href", "/join");
  });

  it("asks a member whose membership ended to renew", () => {
    lock("renew");
    expect(screen.getByRole("heading", { name: "Your membership has ended" })).toBeVisible();
    expect(screen.getByRole("link", { name: "Renew" })).toHaveAttribute("href", "/join");
    expect(screen.queryByRole("link", { name: "Sign in" })).toBeNull();
  });

  it("tells a member at another level whom the item is for", () => {
    lock("level", BAND_UP);
    expect(
      screen.getByRole("heading", { name: "This post is for Band, Business and Sponsor members" }),
    ).toBeVisible();
    expect(screen.getByText("It isn't part of your membership level.")).toBeVisible();
    expect(screen.getByRole("link", { name: "See membership levels" })).toBeVisible();
  });

  it("says see rather than read for pages and events", () => {
    render(
      <MembersOnlyLock reason="sign-in" visibility={MEMBERS} thing="event" returnTo="/events/x" />,
    );
    expect(screen.getByRole("heading", { name: "This event is for members" })).toBeVisible();
    expect(screen.getByText("Sign in or join to see it.")).toBeVisible();
  });

  it("locks the venue directory as a block, under its heading", () => {
    render(
      <MembersOnlyLock
        reason="sign-in"
        visibility={MEMBERS}
        thing="directory"
        returnTo="/venues"
        headingLevel={3}
      />,
    );
    expect(
      screen.getByRole("heading", { level: 3, name: "This directory is for members" }),
    ).toBeVisible();
    expect(screen.getByText("Sign in or join to see it.")).toBeVisible();
    expect(screen.getByRole("link", { name: "Sign in" })).toHaveAttribute(
      "href",
      "/sign-in?next=%2Fvenues",
    );
  });
});

describe("levelTitles", () => {
  it("names the levels in the board's order, joined for a sentence", () => {
    expect(levelTitles(["sponsor", "band", "business"])).toBe("Band, Business and Sponsor");
    expect(levelTitles(["business", "band"])).toBe("Band and Business");
    expect(levelTitles(["individual"])).toBe("Individual");
  });

  it("is empty for no level, and skips values that aren't levels", () => {
    expect(levelTitles([])).toBe("");
    expect(levelTitles(["family"])).toBe("");
    expect(levelTitles(["family", "band"])).toBe("Band");
  });
});
