import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { DirectoryEntry, VenueDirectory as Directory } from "@/sanity/content/directory";
import { VenueDirectory } from "./venue-directory";

const listDirectory = vi.hoisted(() => vi.fn<() => Promise<Directory>>());
vi.mock("@/sanity/content/directory", () => ({ listDirectory }));

const OLD_MILL: DirectoryEntry = {
  id: "entry-old-mill",
  venue: "Old Mill Music Hall",
  capacity: "350",
  pay: "Door split or guarantee",
  notes: "Sound tech provided",
  contact: { name: "Sam Ortega", email: "booking@example.com", phone: "(479) 555-0100" },
};
const BLUEBIRD: DirectoryEntry = {
  id: "entry-bluebird",
  venue: "The Bluebird Lounge",
  notes: "Acoustic and duos only",
  contact: { phone: "(479) 555-0177" },
};
const COURTHOUSE: DirectoryEntry = { id: "entry-courthouse", venue: "Courthouse Square Stage" };

async function directory(result: Directory, returnTo = "/venues") {
  listDirectory.mockResolvedValueOnce(result);
  return render(await VenueDirectory({ heading: "Venues", returnTo }));
}

describe("VenueDirectory", () => {
  beforeEach(() => listDirectory.mockReset());

  it("shows Band, Business and Sponsor members every venue with its booking contact", async () => {
    await directory({
      access: { allowed: true },
      contacts: true,
      entries: [OLD_MILL, BLUEBIRD, COURTHOUSE],
    });

    expect(screen.getByRole("heading", { level: 2, name: "Venues" })).toBeInTheDocument();
    const table = screen.getByRole("table", { name: "Venues" });
    expect(
      within(table)
        .getAllByRole("columnheader")
        .map((header) => header.textContent),
    ).toEqual(["Venue", "Booking contact", "Capacity", "Pays", "Notes"]);
    const rows = within(table).getAllByRole("row").slice(1);
    expect(rows.map((row) => [...row.children].map((cell) => cell.textContent))).toEqual([
      [
        "Old Mill Music Hall",
        "Sam Ortega · booking@example.com · (479) 555-0100",
        "350",
        "Door split or guarantee",
        "Sound tech provided",
      ],
      ["The Bluebird Lounge", "(479) 555-0177", "", "", "Acoustic and duos only"],
      ["Courthouse Square Stage", "", "", "", ""],
    ]);
    expect(screen.queryByText(/Booking contacts are for/)).not.toBeInTheDocument();
  });

  it("searches the rows, booking contacts included", async () => {
    await directory({ access: { allowed: true }, contacts: true, entries: [OLD_MILL, BLUEBIRD] });
    fireEvent.change(screen.getByRole("searchbox", { name: "Search the directory" }), {
      target: { value: "ortega" },
    });
    const table = screen.getByRole("table", { name: "Venues" });
    expect(
      within(table)
        .getAllByRole("rowheader")
        .map((cell) => cell.textContent),
    ).toEqual(["Old Mill Music Hall"]);
    expect(screen.getByRole("status")).toHaveTextContent("Showing 1 of 2");
  });

  it("shows Individual members the venues without a contact column, and who sees contacts", async () => {
    const { container } = await directory({
      access: { allowed: true },
      contacts: false,
      entries: [{ ...OLD_MILL, contact: undefined }],
    });

    const table = screen.getByRole("table", { name: "Venues" });
    expect(
      within(table)
        .getAllByRole("columnheader")
        .map((header) => header.textContent),
    ).toEqual(["Venue", "Capacity", "Pays", "Notes"]);
    expect(within(table).getByRole("rowheader")).toHaveTextContent("Old Mill Music Hall");
    expect(
      screen.getByText(/^Booking contacts are for Band, Business and Sponsor members\./),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Compare membership levels" })).toHaveAttribute(
      "href",
      "/join",
    );
    expect(container).not.toHaveTextContent("Sam Ortega");
  });

  it("never shows a contact column without contacts, even if an entry has one", async () => {
    // The loader leaves contacts out for Individual members; this is the component's own guard.
    const { container } = await directory({
      access: { allowed: true },
      contacts: false,
      entries: [OLD_MILL],
    });
    expect(screen.queryByRole("columnheader", { name: "Booking contact" })).toBeNull();
    expect(container).not.toHaveTextContent("Sam Ortega");
    expect(container).not.toHaveTextContent("booking@example.com");
  });

  it("asks a visitor to sign in, and brings them back to the page, or to join", async () => {
    await directory(
      { access: { allowed: false, reason: "sign-in" }, contacts: false, entries: [] },
      "/about",
    );
    expect(screen.getByRole("heading", { level: 2, name: "Venues" })).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { level: 3, name: "This directory is for members" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Sign in" })).toHaveAttribute(
      "href",
      "/sign-in?next=%2Fabout",
    );
    expect(screen.getByRole("link", { name: "Join now" })).toHaveAttribute("href", "/join");
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
    expect(screen.queryByRole("searchbox")).not.toBeInTheDocument();
  });

  it("asks a member whose membership has ended to renew", async () => {
    await directory({ access: { allowed: false, reason: "renew" }, contacts: false, entries: [] });
    expect(screen.getByRole("heading", { name: "Your membership has ended" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Renew" })).toHaveAttribute("href", "/join");
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it("says so when the directory has no venues yet", async () => {
    await directory({ access: { allowed: true }, contacts: true, entries: [] });
    expect(screen.getByRole("heading", { level: 2, name: "Venues" })).toBeInTheDocument();
    expect(screen.getByText("No venues in the directory yet. Check back soon.")).toBeVisible();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });
});
