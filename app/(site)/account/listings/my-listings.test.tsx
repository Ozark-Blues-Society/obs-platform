import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import {
  MY_LISTINGS_MESSAGES,
  listingStanding,
  type MyListing,
  type MyListingResult,
} from "@/lib/listings/my-listings-state";
import { ListingsCard } from "../listings-card";
import { MyListings, type MyListingItem } from "./my-listings";

// 8 AM on November 27, 2026 in the Ozarks.
const NOW = new Date("2026-11-27T14:00:00Z");

const base = {
  category: "gear",
  price: null,
  rejectReason: null,
  createdAt: "2026-10-01T15:00:00Z",
} as const;

const ENDING: MyListing = {
  ...base,
  id: "00000000-0000-4000-8940-000000000001",
  title: "Tweed-style amp",
  price: 650,
  status: "live",
  // In 5 days: renewable.
  expiresAt: "2026-12-02T18:00:00Z",
};
const RUNNING: MyListing = {
  ...base,
  id: "00000000-0000-4000-8940-000000000002",
  category: "musicians_wanted",
  title: "Bass player wanted",
  status: "live",
  expiresAt: "2027-01-20T18:00:00Z",
};
const EXPIRED: MyListing = {
  ...base,
  id: "00000000-0000-4000-8940-000000000003",
  title: "Drum kit",
  status: "expired",
  expiresAt: "2026-11-02T18:00:00Z",
};
const PENDING: MyListing = {
  ...base,
  id: "00000000-0000-4000-8940-000000000004",
  title: "Harmonica set",
  status: "pending",
  expiresAt: null,
};
const REJECTED: MyListing = {
  ...base,
  id: "00000000-0000-4000-8940-000000000005",
  title: "Cheap sunglasses",
  status: "rejected",
  rejectReason: "Not about music.",
  expiresAt: null,
};

const items = (...listings: MyListing[]): MyListingItem[] =>
  listings.map((listing) => ({ listing, standing: listingStanding(listing, NOW) }));

const never = () => new Promise<MyListingResult>(() => {});

function renderList({
  listings = [ENDING, RUNNING, EXPIRED, PENDING, REJECTED],
  canRenew = true,
  highlight = null as string | null,
  renew = vi.fn(never),
  remove = vi.fn(never),
}: {
  listings?: MyListing[];
  canRenew?: boolean;
  highlight?: string | null;
  renew?: (input: { id: string }) => Promise<MyListingResult>;
  remove?: (input: { id: string }) => Promise<MyListingResult>;
} = {}) {
  render(
    <MyListings
      items={items(...listings)}
      canRenew={canRenew}
      highlight={highlight}
      renew={renew}
      remove={remove}
    />,
  );
  return { renew, remove };
}

const card = (title: string) => {
  const item = screen
    .getByRole("heading", { level: 3, name: (name) => name.startsWith(title) })
    .closest("li");
  if (!item) throw new Error(`No card for ${title}`);
  return within(item);
};

describe("MyListings", () => {
  it("shows each listing with its category, price, when it was posted and where it stands", () => {
    renderList();

    expect(screen.getByRole("heading", { level: 2 })).toHaveTextContent("Your listings (5)");
    const amp = card("Tweed-style amp");
    expect(amp.getByRole("heading", { level: 3 })).toHaveTextContent("Tweed-style amp — $650");
    expect(amp.getByText("Gear")).toBeInTheDocument();
    expect(amp.getByText("Oct 1, 2026")).toHaveAttribute("datetime", "2026-10-01T15:00:00Z");
    expect(amp.getByText("Live")).toBeInTheDocument();
    expect(
      amp.getByText(
        "On the classifieds until Dec 2, 2026. Renew it to keep it up for another 60 days.",
      ),
    ).toBeInTheDocument();
    expect(
      card("Bass player wanted").getByText(/You can renew it from Jan 15, 2027\./),
    ).toBeVisible();
    expect(card("Drum kit").getByText("Expired")).toBeInTheDocument();
    expect(card("Harmonica set").getByText("Awaiting review")).toBeInTheDocument();
    expect(
      card("Cheap sunglasses").getByText("The moderator's reason: Not about music."),
    ).toBeInTheDocument();
  });

  it("offers Renew for the listings that can be renewed now, and Remove for every one", () => {
    renderList();

    const renewable = ["Tweed-style amp", "Drum kit"];
    for (const title of [
      "Tweed-style amp",
      "Bass player wanted",
      "Drum kit",
      "Harmonica set",
      "Cheap sunglasses",
    ]) {
      expect(card(title).queryByRole("button", { name: "Renew" }) !== null, title).toBe(
        renewable.includes(title),
      );
      expect(card(title).getByRole("button", { name: "Remove" })).toBeInTheDocument();
    }
  });

  it("offers no Renew when the member's membership isn't current", () => {
    renderList({ canRenew: false });

    expect(screen.queryByRole("button", { name: "Renew" })).toBeNull();
    expect(card("Drum kit").getByText("Came down on Nov 2, 2026.")).toBeInTheDocument();
  });

  it("renews a listing, says so, and moves focus to the list's heading", async () => {
    const renew = vi.fn(async () => ({
      status: "renewed" as const,
      message: "“Tweed-style amp” is renewed: it's on the classifieds until Jan 26, 2027.",
    }));
    renderList({ renew });

    fireEvent.click(card("Tweed-style amp").getByRole("button", { name: "Renew" }));

    expect(renew).toHaveBeenCalledWith({ id: ENDING.id });
    await waitFor(() =>
      expect(screen.getByRole("status")).toHaveTextContent(
        "“Tweed-style amp” is renewed: it's on the classifieds until Jan 26, 2027.",
      ),
    );
    expect(screen.getByRole("heading", { level: 2 })).toHaveFocus();
  });

  it("shows why a renewal didn't happen, as an alert", async () => {
    renderList({
      renew: async () => ({ status: "error", message: MY_LISTINGS_MESSAGES.renew }),
    });

    fireEvent.click(card("Drum kit").getByRole("button", { name: "Renew" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(MY_LISTINGS_MESSAGES.renew);
  });

  it("says to try again when the answer never came back", async () => {
    renderList({
      renew: async () => {
        throw new Error("Failed to fetch");
      },
    });

    fireEvent.click(card("Drum kit").getByRole("button", { name: "Renew" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(MY_LISTINGS_MESSAGES.unavailable);
  });

  it("asks before removing a listing, and keeps it when the member changes their mind", async () => {
    const { remove } = renderList();
    const drums = card("Drum kit");
    const toggle = drums.getByRole("button", { name: "Remove" });

    fireEvent.click(toggle);

    expect(toggle).toHaveAttribute("aria-expanded", "true");
    expect(drums.getByText(/Remove “Drum kit” for good\?/)).toBeVisible();
    await waitFor(() =>
      expect(drums.getByRole("button", { name: "Remove the listing" })).toHaveFocus(),
    );

    fireEvent.click(drums.getByRole("button", { name: "Keep it" }));

    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(toggle).toHaveFocus();
    expect(remove).not.toHaveBeenCalled();
  });

  it("removes a listing once the member confirms, and says so", async () => {
    const remove = vi.fn(async () => ({
      status: "removed" as const,
      message: "“Drum kit” is removed. It's no longer on the classifieds.",
    }));
    renderList({ remove });
    const drums = card("Drum kit");

    fireEvent.click(drums.getByRole("button", { name: "Remove" }));
    fireEvent.click(drums.getByRole("button", { name: "Remove the listing" }));

    expect(remove).toHaveBeenCalledWith({ id: EXPIRED.id });
    await waitFor(() =>
      expect(screen.getByRole("status")).toHaveTextContent("“Drum kit” is removed."),
    );
    expect(screen.getByRole("heading", { level: 2 })).toHaveFocus();
  });

  it("puts the listing a reminder linked to first, and marks it", () => {
    renderList({ highlight: EXPIRED.id });

    const titles = screen
      .getAllByRole("heading", { level: 3 })
      .map((heading) => heading.textContent);
    expect(titles[0]).toBe("Drum kit");
    expect(card("Drum kit").getByText("Your reminder email was about this listing.")).toBeVisible();
    expect(screen.getAllByText("Your reminder email was about this listing.")).toHaveLength(1);
  });

  it("ignores a reminder link to a listing that isn't the member's", () => {
    renderList({ highlight: "00000000-0000-4000-8940-000000000099" });

    expect(screen.queryByText("Your reminder email was about this listing.")).toBeNull();
    expect(screen.getAllByRole("heading", { level: 3 })[0]).toHaveTextContent("Tweed-style amp");
  });

  it("says when the member has no listings", () => {
    renderList({ listings: [] });

    expect(screen.getByRole("heading", { level: 2 })).toHaveTextContent("Your listings (0)");
    expect(screen.getByText("You haven’t posted any listings yet.")).toBeInTheDocument();
  });
});

describe("ListingsCard", () => {
  it("sums up each listing on My Account, with a link to My listings", () => {
    render(<ListingsCard items={items(ENDING, EXPIRED, PENDING, REJECTED)} />);

    const section = screen.getByRole("region", { name: "My listings" });
    expect(
      within(section)
        .getAllByRole("listitem")
        .map((item) => item.textContent),
    ).toEqual([
      "Tweed-style ampLive, until Dec 2, 2026",
      "Drum kitExpired on Nov 2, 2026",
      "Harmonica setAwaiting review",
      "Cheap sunglassesNot approved",
    ]);
    expect(
      within(section).getByRole("link", { name: "Renew or remove your listings" }),
    ).toHaveAttribute("href", "/account/listings");
  });

  it("says when there are none", () => {
    render(<ListingsCard items={[]} />);

    const section = screen.getByRole("region", { name: "My listings" });
    expect(within(section).getByText("You haven’t posted any listings yet.")).toBeInTheDocument();
    expect(within(section).getByRole("link", { name: "Go to My listings" })).toHaveAttribute(
      "href",
      "/account/listings",
    );
  });
});
