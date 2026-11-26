import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PageTemplate } from "@/components/templates/page-template";
import { HeroBlock } from "./hero-block";
import { SponsorStripBlock, TableBlock, UpcomingEventsBlock } from "./list-blocks";
import { QuoteBlock, VideoBlock } from "./media-blocks";

const COLUMNS = ["Venue", "Capacity"];
const ROWS = [
  ["Old Mill Music Hall", "350"],
  ["The Riverside Tap", "120"],
  ["The Bluebird Lounge", "80"],
];

const bodyRows = () => screen.getAllByRole("row").slice(1);

describe("TableBlock", () => {
  it("names the table with its heading and makes the first column the row headers", () => {
    render(<TableBlock heading="Venues" columns={COLUMNS} rows={ROWS} />);

    expect(screen.getByRole("heading", { level: 2, name: "Venues" })).toBeInTheDocument();
    expect(screen.getByRole("table", { name: "Venues" })).toBeInTheDocument();
    expect(screen.getByRole("rowheader", { name: "The Riverside Tap" })).toBeInTheDocument();
    expect(screen.queryByRole("searchbox")).not.toBeInTheDocument();
  });

  it("with a search label, keeps only the rows containing what's typed and says how many", () => {
    render(
      <TableBlock heading="Venues" columns={COLUMNS} rows={ROWS} searchLabel="Search venues" />,
    );
    const search = screen.getByRole("searchbox", { name: "Search venues" });
    expect(bodyRows()).toHaveLength(3);
    expect(screen.getByRole("status")).toHaveTextContent("");

    fireEvent.change(search, { target: { value: "  TAP " } });
    expect(bodyRows()).toHaveLength(1);
    expect(within(bodyRows()[0]).getByRole("rowheader")).toHaveTextContent("The Riverside Tap");
    expect(screen.getByRole("status")).toHaveTextContent("Showing 1 of 3");

    // Any cell matches, not just the first.
    fireEvent.change(search, { target: { value: "80" } });
    expect(bodyRows()).toHaveLength(1);
    expect(within(bodyRows()[0]).getByRole("rowheader")).toHaveTextContent("The Bluebird Lounge");

    fireEvent.change(search, { target: { value: "harmonica" } });
    expect(screen.getByText("Nothing matches “harmonica”.")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Showing 0 of 3");

    fireEvent.change(search, { target: { value: "" } });
    expect(bodyRows()).toHaveLength(3);
  });

  it("shows a notice between the heading and the table", () => {
    render(
      <TableBlock
        heading="Venues"
        columns={COLUMNS}
        rows={ROWS}
        notice={<p>Booking contacts are for Band members and up.</p>}
      />,
    );
    expect(screen.getByText("Booking contacts are for Band members and up.")).toBeInTheDocument();
  });
});

describe("VideoBlock", () => {
  it("shows a labelled placeholder until there is a player", () => {
    render(<VideoBlock title="The trio live at Old Mill" caption="Recorded at Fall Fest." />);

    expect(
      screen.getByRole("img", { name: "Video placeholder: The trio live at Old Mill" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Recorded at Fall Fest.")).toBeInTheDocument();
  });

  it("shows the player it's given instead", () => {
    render(
      <VideoBlock
        title="The trio live at Old Mill"
        player={<iframe title="The trio live at Old Mill" src="about:blank" />}
      />,
    );

    expect(screen.queryByRole("img")).not.toBeInTheDocument();
    expect(screen.getByTitle("The trio live at Old Mill")).toBeInTheDocument();
  });
});

describe("QuoteBlock", () => {
  it("adds the quotation marks and the attribution", () => {
    render(<QuoteBlock quote="Loud, and from the heart." attribution="Dale, guitar" />);

    expect(screen.getByText("“Loud, and from the heart.”")).toBeInTheDocument();
    expect(screen.getByText(/Dale, guitar/)).toBeInTheDocument();
  });
});

describe("UpcomingEventsBlock and SponsorStripBlock", () => {
  it("lists the events and links to the calendar", () => {
    render(
      <UpcomingEventsBlock
        heading="Upcoming shows"
        events={[
          {
            title: "Delta Night",
            href: "/events/delta-night",
            startsAt: "2026-12-19T20:00:00-06:00",
          },
        ]}
      />,
    );

    expect(screen.getByRole("heading", { level: 2, name: "Upcoming shows" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Delta Night" })).toHaveAttribute(
      "href",
      "/events/delta-night",
    );
    expect(screen.getByRole("link", { name: /Full calendar/ })).toHaveAttribute("href", "/events");
  });

  it("says so when the calendar is empty", () => {
    render(<UpcomingEventsBlock heading="Upcoming shows" events={[]} />);
    expect(screen.getByText(/Nothing on the calendar yet/)).toBeInTheDocument();
  });

  it("shows the sponsors, and nothing at all without any", () => {
    const { container, rerender } = render(
      <SponsorStripBlock
        heading="With our sponsors"
        sponsors={[{ name: "Hilltop Guitar Works" }]}
      />,
    );
    expect(screen.getByRole("listitem")).toHaveTextContent("Hilltop Guitar Works");

    rerender(<SponsorStripBlock heading="With our sponsors" sponsors={[]} />);
    expect(container).toBeEmptyDOMElement();
  });
});

describe("PageTemplate", () => {
  it("opens with the page header, its title as the only level-1 heading", () => {
    render(
      <PageTemplate title="About the Society" intro="Who we are.">
        <p>Body</p>
      </PageTemplate>,
    );

    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("About the Society");
    expect(screen.getByText("Who we are.")).toBeInTheDocument();
    expect(screen.queryByText("Members only")).not.toBeInTheDocument();
  });

  it("tags a members-only page above its title", () => {
    render(
      <PageTemplate title="Venue directory" membersOnly>
        <p>Body</p>
      </PageTemplate>,
    );
    expect(screen.getByText("Members only")).toBeInTheDocument();
  });

  it("lets a hero take the page header's place, with the hero's headline as the title", () => {
    render(
      <PageTemplate
        title="Band Spotlight: The Muddy Ridge Trio"
        hero={<HeroBlock headingLevel={1} heading="The Muddy Ridge Trio" photo={null} />}
      >
        <p>Body</p>
      </PageTemplate>,
    );

    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("The Muddy Ridge Trio");
    expect(screen.queryByText("Band Spotlight: The Muddy Ridge Trio")).not.toBeInTheDocument();
  });
});

describe("HeroBlock", () => {
  it("is a level-2 heading unless it holds the page title, and links its button", () => {
    render(
      <HeroBlock
        heading="Bands wanted"
        eyebrow="Applications close January 2"
        text="Compete for the finals."
        photo={null}
        button={{ label: "Apply", href: "#apply" }}
      />,
    );

    expect(screen.getByRole("heading", { level: 2, name: "Bands wanted" })).toBeInTheDocument();
    expect(screen.getByText("Applications close January 2")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Apply" })).toHaveAttribute("href", "#apply");
  });
});
