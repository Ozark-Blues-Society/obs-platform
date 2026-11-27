import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { MembershipStanding } from "@/lib/members/membership";
import type { MemberPerks } from "@/sanity/content/member-perks";
import { MembershipCard } from "./membership-card";
import { PerksCard } from "./perks-card";

// 6 PM on March 14, 2027 in Central Time.
const EXPIRES = "2027-03-15T00:00:00Z";
const JOINED = "2019-03-15T00:00:00Z";

const active = (changes: Partial<Extract<MembershipStanding, { kind: "active" }>> = {}) =>
  ({
    kind: "active",
    level: "sponsor",
    expiresAt: EXPIRES,
    autoRenew: false,
    endsSoon: false,
    ...changes,
  }) as const;
const LAPSED: MembershipStanding = { kind: "lapsed", level: "band", expiresAt: EXPIRES };
const NONE: MembershipStanding = { kind: "none" };

/** Each term in the card's definition list with its definition, as the page reads them. */
function facts(): [string, string][] {
  const card = screen.getByRole("region", { name: /member|membership/i });
  return within(card)
    .queryAllByRole("term")
    .map((term) => [term.textContent ?? "", term.nextElementSibling?.textContent ?? ""]);
}

describe("MembershipCard", () => {
  it("shows an active membership's level, status, renewal date and auto-renew", () => {
    render(<MembershipCard membership={active()} joinedAt={JOINED} />);

    expect(screen.getByRole("heading", { level: 2 })).toHaveTextContent("Sponsor member");
    expect(facts()).toEqual([
      ["Level", "Sponsor"],
      ["Status", "Active"],
      ["Renewal date", "March 14, 2027"],
      ["Auto-renew", "Off"],
      ["Member since", "2019"],
    ]);
    expect(screen.queryByRole("link")).toBeNull();
  });

  it("asks a member whose membership ends soon to renew", () => {
    render(<MembershipCard membership={active({ endsSoon: true })} joinedAt={null} />);

    expect(facts()).toEqual([
      ["Level", "Sponsor"],
      ["Status", "Expiring soon"],
      ["Renewal date", "March 14, 2027"],
      ["Auto-renew", "Off"],
    ]);
    expect(screen.getByText("Renew by March 14, 2027 to keep your member perks.")).toBeVisible();
    expect(screen.getByRole("link", { name: "Renew now" })).toHaveAttribute("href", "/join");
  });

  it("tells a member on auto-renew nothing needs doing", () => {
    render(<MembershipCard membership={active({ autoRenew: true })} joinedAt={JOINED} />);

    expect(facts()).toContainEqual(["Auto-renew", "On"]);
    expect(facts()).toContainEqual(["Status", "Active"]);
    expect(screen.queryByRole("link")).toBeNull();
  });

  it("says when a lapsed membership ended, and offers renewal", () => {
    render(<MembershipCard membership={LAPSED} joinedAt={JOINED} />);

    expect(screen.getByRole("heading", { level: 2 })).toHaveTextContent(
      "Your membership has ended",
    );
    expect(facts()).toEqual([
      ["Level", "Band"],
      ["Status", "Ended"],
      ["Ended on", "March 14, 2027"],
    ]);
    expect(screen.getByRole("link", { name: "Renew your membership" })).toHaveAttribute(
      "href",
      "/join",
    );
  });

  it("invites someone who isn't a member yet to join", () => {
    render(<MembershipCard membership={NONE} joinedAt={null} />);

    expect(screen.getByRole("heading", { level: 2 })).toHaveTextContent("Not a member yet");
    expect(screen.queryAllByRole("term")).toEqual([]);
    expect(screen.getByRole("link", { name: "Join the Society" })).toHaveAttribute("href", "/join");
  });
});

const PERKS: MemberPerks = {
  level: "sponsor",
  benefits: [
    { key: "classifieds", text: "Post in the classifieds" },
    { key: "sponsor-discount", text: "10% off paid Society events and other paid items" },
  ],
  perkCodes: [
    {
      key: "member",
      label: "Member discount code",
      code: "BLUES-MBR-26",
      details: "15% off Society merchandise (not bulk orders).",
    },
    { key: "sponsor", label: "Sponsor discount code", code: "BLUES-SPN-26" },
  ],
};

describe("PerksCard", () => {
  it("shows each perk code with what it's for, then the level's benefits", () => {
    render(<PerksCard membership={active()} perks={PERKS} />);

    const card = screen.getByRole("region", { name: "Member perks" });
    const codes = within(card)
      .getAllByRole("term")
      .map((term) => term.textContent);
    expect(codes).toEqual(["Member discount code", "Sponsor discount code"]);
    expect(
      within(card)
        .getAllByRole("definition")
        .map((each) => each.textContent),
    ).toEqual(["BLUES-MBR-26", "15% off Society merchandise (not bulk orders).", "BLUES-SPN-26"]);
    expect(
      within(card).getByRole("heading", { name: "Your Sponsor membership includes" }),
    ).toBeVisible();
    expect(
      within(card)
        .getAllByRole("listitem")
        .map((item) => item.textContent),
    ).toEqual(["Post in the classifieds", "10% off paid Society events and other paid items"]);
  });

  it("tells a lapsed member their perks come back when they renew", () => {
    render(<PerksCard membership={LAPSED} perks={{ level: null, benefits: [], perkCodes: [] }} />);
    expect(
      screen.getByText("Your perk codes and member benefits come back when you renew."),
    ).toBeVisible();
    expect(screen.queryAllByRole("term")).toEqual([]);
  });

  it("tells someone who hasn't joined that perks come with membership", () => {
    render(<PerksCard membership={NONE} perks={{ level: null, benefits: [], perkCodes: [] }} />);
    expect(
      screen.getByText("Your perk codes and member benefits will appear here once you join."),
    ).toBeVisible();
  });

  it("says so when the perks couldn't be loaded", () => {
    render(
      <PerksCard
        membership={active()}
        perks={{ level: "sponsor", benefits: [], perkCodes: [], unavailable: true }}
      />,
    );
    expect(
      screen.getByText("Your perks can’t be shown right now. Please try again in a few minutes."),
    ).toBeVisible();
  });

  it("says perks are coming when editors haven't added any yet", () => {
    render(
      <PerksCard membership={active()} perks={{ level: "sponsor", benefits: [], perkCodes: [] }} />,
    );
    expect(screen.getByText("Your perks will appear here soon.")).toBeVisible();
  });
});
