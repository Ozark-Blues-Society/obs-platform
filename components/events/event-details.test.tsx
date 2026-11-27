import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { EventDetails } from "./event-details";

// 8 PM on Friday, December 4 in Central Time.
const START = "2026-12-05T02:00:00.000Z";
const VENUE = {
  name: "Old Mill Music Hall",
  address: "410 Mill Street, Riverbend",
  mapUrl: "https://maps.example.com/old-mill",
};

const facts = () => screen.getByRole("region", { name: "Event details" });

describe("EventDetails", () => {
  it("says when, where and what it costs, with a link to add it to a calendar", () => {
    render(
      <EventDetails
        startsAt={START}
        locked={false}
        venue={VENUE}
        price="$15"
        memberPrice="$10"
        calendarHref="/events/delta-night/calendar.ics"
      />,
    );
    expect(within(facts()).getByText(/Friday, December 4, 2026 · 8:00\sPM/)).toHaveAttribute(
      "datetime",
      START,
    );
    expect(facts()).toHaveTextContent("Old Mill Music Hall410 Mill Street, Riverbend");
    expect(screen.getByRole("link", { name: "Map and directions" })).toHaveAttribute(
      "href",
      VENUE.mapUrl,
    );
    expect(facts()).toHaveTextContent("$15 · Members $10");
    expect(screen.queryByText(/Your member price/)).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Add to calendar" })).toHaveAttribute(
      "href",
      "/events/delta-night/calendar.ics",
    );
  });

  it("hides the place of a locked event and offers no calendar file", () => {
    render(<EventDetails startsAt={START} locked venue={VENUE} price="Free" />);
    expect(facts()).toHaveTextContent("Location visible to members");
    expect(facts()).not.toHaveTextContent("Old Mill");
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it("highlights an active member's price", () => {
    render(<EventDetails startsAt={START} locked={false} price="$15" memberPrice="$10" member />);
    expect(screen.getByText("Your member price: $10")).toBeInTheDocument();
  });

  it("says how a repeating event repeats, until when, and its next dates", () => {
    render(
      <EventDetails
        startsAt={START}
        locked={false}
        repeats={{
          text: "Every Friday",
          until: "2027-03-26",
          next: ["2026-12-12T02:00:00.000Z", "2026-12-19T02:00:00.000Z"],
        }}
      />,
    );
    expect(facts()).toHaveTextContent(/Every Friday, 8:00\sPM/);
    expect(facts()).toHaveTextContent("Until March 26, 2027");
    expect(
      within(facts())
        .getAllByRole("listitem")
        .map((item) => item.textContent),
    ).toEqual(["Fri, Dec 11", "Fri, Dec 18"]);
  });

  it("says when an event is over, with nothing to add to a calendar", () => {
    render(
      <EventDetails
        startsAt={START}
        locked={false}
        over
        calendarHref="/events/delta-night/calendar.ics"
      />,
    );
    expect(facts()).toHaveTextContent("This event is over.");
    expect(screen.queryByRole("link", { name: "Add to calendar" })).not.toBeInTheDocument();
  });

  it("links only to a web address for the map, and leaves out an empty place", () => {
    const { unmount } = render(
      <EventDetails
        startsAt={START}
        locked={false}
        venue={{ name: "Old Mill", mapUrl: "javascript:alert(1)" }}
      />,
    );
    expect(screen.queryByRole("link", { name: "Map and directions" })).not.toBeInTheDocument();
    unmount();
    render(<EventDetails startsAt={START} locked={false} />);
    expect(facts()).not.toHaveTextContent("Where");
    expect(facts()).not.toHaveTextContent("Price");
  });
});
