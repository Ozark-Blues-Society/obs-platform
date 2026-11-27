import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { EventOccurrence } from "@/lib/events/load";
import { EventsCalendarView } from "./events-calendar";

function date(
  id: string,
  startsAt: string,
  fields: Partial<EventOccurrence> = {},
): EventOccurrence {
  return {
    key: `${id}@${startsAt}`,
    eventId: id,
    href: `/events/${id}`,
    slug: id,
    title: `Event ${id}`,
    startsAt,
    category: "concert",
    categoryTitle: "Concert",
    repeats: null,
    membersOnly: false,
    locked: false,
    venue: "Old Mill Music Hall",
    priceText: "$15",
    memberPrice: null,
    ...fields,
  };
}

// December 2026, in Central Time: the revue on Thursday the 10th, the jam on Tuesdays the 1st and
// 8th, the members' social on Saturday the 12th.
const REVUE = date("revue", "2026-12-11T01:30:00.000Z");
const JAM = { category: "jam", categoryTitle: "Jam", repeats: "weekly" as const };
const JAM_1 = date("jam", "2026-12-02T01:00:00.000Z", JAM);
const JAM_8 = date("jam", "2026-12-09T01:00:00.000Z", JAM);
const SOCIAL = date("social", "2026-12-13T01:00:00.000Z", {
  category: "society",
  categoryTitle: "Society",
  membersOnly: true,
  locked: true,
  venue: null,
});
const FEED = {
  https: "https://ozarkblues.example/events/feed.ics",
  webcal: "webcal://ozarkblues.example/events/feed.ics",
};

/**
 * Renders the calendar at `address`. `follow()` gives it the address again after something changed
 * it, as Next.js does through useSearchParams: after a pill's change, or Back and Forward.
 */
function renderCalendar(address = "/events?month=2026-12") {
  window.history.replaceState(null, "", address);
  const calendar = () => (
    <EventsCalendarView
      month="2026-12"
      today="2026-12-08"
      dates={[JAM_1, JAM_8, REVUE, SOCIAL]}
      upcoming={[JAM_8, REVUE, SOCIAL]}
      feed={FEED}
      search={new URLSearchParams(window.location.search)}
    />
  );
  const view = render(calendar());
  return { follow: () => view.rerender(calendar()) };
}

const table = () => screen.getByRole("table", { name: "December 2026" });
/** The grid cell for a day of the month. */
const cellOf = (day: string) =>
  within(table())
    .getAllByRole("cell")
    .find((cell) => cell.querySelector("span")?.textContent === day)!;
const comingUp = () => screen.getByRole("complementary", { name: "Coming up" });

beforeEach(() => {
  window.history.replaceState(null, "", "/events?month=2026-12");
});

afterEach(() => {
  window.history.replaceState(null, "", "/");
});

describe("EventsCalendar", () => {
  it("draws the month with each date on its day, and today marked", () => {
    renderCalendar();
    expect(screen.getByRole("heading", { level: 2, name: "December 2026" })).toBeInTheDocument();
    expect(within(cellOf("1")).getByRole("link", { name: "Event jam" })).toHaveAttribute(
      "href",
      "/events/jam",
    );
    expect(within(cellOf("8")).getByRole("link", { name: "Event jam" })).toBeInTheDocument();
    expect(within(cellOf("10")).getByRole("link", { name: "Event revue" })).toBeInTheDocument();
    expect(
      within(cellOf("12")).getByRole("link", { name: "Event social, members only" }),
    ).toBeInTheDocument();
    expect(cellOf("8")).toHaveAttribute("aria-current", "date");
    expect(cellOf("9")).not.toHaveAttribute("aria-current");
    // December 1, 2026 is a Tuesday: two blank days before it.
    expect(
      within(table())
        .getAllByRole("cell")
        .slice(0, 3)
        .map((cell) => cell.textContent),
    ).toEqual(["", "", "1Event jam"]);
  });

  it("links to the months before and after, keeping the view and category", () => {
    renderCalendar("/events?month=2026-12&view=list&category=jam");
    expect(screen.getByRole("link", { name: "Previous month, November 2026" })).toHaveAttribute(
      "href",
      "/events?month=2026-11&view=list&category=jam",
    );
    expect(screen.getByRole("link", { name: "Next month, January 2027" })).toHaveAttribute(
      "href",
      "/events?month=2027-01&view=list&category=jam",
    );
  });

  it("filters the grid and Coming up by category, and puts it in the address", () => {
    const { follow } = renderCalendar();
    const status = screen.getByRole("status");
    expect(status).toHaveTextContent("4 dates in December 2026");
    fireEvent.click(screen.getByRole("button", { name: "Jam" }));
    expect(window.location.search).toBe("?month=2026-12&category=jam");
    follow();

    expect(screen.getByRole("button", { name: "Jam" })).toHaveAttribute("aria-pressed", "true");
    expect(
      within(table())
        .getAllByRole("link")
        .map((link) => link.textContent),
    ).toEqual(["Event jam", "Event jam"]);
    expect(within(comingUp()).getAllByRole("article")).toHaveLength(1);
    expect(status).toHaveTextContent("2 dates (Jam) in December 2026");
    expect(window.location.search).toBe("?month=2026-12&category=jam");
    expect(screen.getByRole("link", { name: "Next month, January 2027" })).toHaveAttribute(
      "href",
      "/events?month=2027-01&category=jam",
    );

    fireEvent.click(screen.getByRole("button", { name: "Workshop" }));
    follow();
    expect(
      screen.getByText("Nothing on the calendar in December 2026 under Workshop."),
    ).toBeVisible();
    expect(within(comingUp()).getByText("Nothing coming up yet. Check back soon.")).toBeVisible();

    fireEvent.click(screen.getByRole("button", { name: "All" }));
    expect(window.location.search).toBe("?month=2026-12");
  });

  it("shows what the address says when it changes, as after Back", () => {
    const { follow } = renderCalendar("/events?month=2026-12&category=jam");
    expect(screen.getByRole("button", { name: "Jam" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("status")).toHaveTextContent("2 dates (Jam) in December 2026");

    // Back to an entry whose address has the list and every category.
    window.history.replaceState(null, "", "/events?month=2026-12&view=list");
    follow();
    expect(screen.getByRole("button", { name: "All" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "List" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("4 dates in December 2026");
  });

  it("shows the month as a list of event cards", () => {
    const { follow } = renderCalendar();
    fireEvent.click(screen.getByRole("button", { name: "List" }));
    expect(window.location.search).toBe("?month=2026-12&view=list");
    follow();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
    const month = screen.getByRole("region", { name: "December 2026" });
    expect(
      within(month)
        .getAllByRole("article")
        .map((card) => within(card).getByRole("heading").textContent),
    ).toEqual(["Event jam", "Event jam", "Event revue", "Event social"]);
    // A locked event's card says its place is for members.
    expect(within(month).getAllByRole("article")[3]).toHaveTextContent(
      "Location visible to members",
    );
  });

  it("offers the calendar feed", () => {
    renderCalendar();
    expect(within(comingUp()).getByRole("link", { name: "Apple Calendar" })).toHaveAttribute(
      "href",
      FEED.webcal,
    );
    expect(within(comingUp()).getByRole("link", { name: FEED.https })).toHaveAttribute(
      "href",
      FEED.https,
    );
  });
});
