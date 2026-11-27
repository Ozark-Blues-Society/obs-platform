import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ContentPage, type ContentPageItem } from "./content-page";

// next-sanity's <Image> builds Sanity CDN addresses; here it shows what it was given instead.
vi.mock("next-sanity/image", () => ({
  Image: (props: {
    src: { asset: { _ref: string } };
    alt: string;
    sizes: string;
    fill?: boolean;
    preload?: boolean;
  }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      alt={props.alt}
      data-asset={props.src.asset._ref}
      data-sizes={props.sizes}
      data-fill={String(Boolean(props.fill))}
      data-preload={String(Boolean(props.preload))}
    />
  ),
}));

// The sponsor logos block loads its sponsors on the server (components/blocks/current-sponsors.tsx,
// tested there); here it shows what it was given.
vi.mock("@/components/blocks/current-sponsors", () => ({
  CurrentSponsors: ({ heading, sponsorIds }: { heading: string; sponsorIds: string[] }) => (
    <p>
      Sponsor logos: {heading} [{sponsorIds.join(", ")}]
    </p>
  ),
}));

const ASSET = "image-Tb9Ew8CXIwaY6R1kjMvI0uRR-2000x1125-jpg";
const photo = (alt: string) => ({ _type: "image", asset: { _ref: ASSET }, alt });
const paragraph = (key: string, text: string, markDefs: unknown[] = [], marks: string[] = []) => ({
  _type: "block",
  _key: key,
  style: "normal",
  markDefs,
  children: [{ _type: "span", _key: `${key}s`, text, marks }],
});

function page(overrides: Partial<ContentPageItem> = {}): ContentPageItem {
  return {
    _id: "page-about",
    _type: "page",
    slug: "about",
    title: "About the Society",
    intro: "Who we are and what we do.",
    template: "standard",
    visibility: { audience: "everyone", levels: [] },
    access: { allowed: true },
    content: { blocks: [] },
    ...overrides,
  };
}

const hero = (heading: string) => ({
  _type: "heroBlock",
  _key: `hero-${heading}`,
  heading,
  text: "Hill-country blues from three old friends.",
  image: photo("The trio on stage"),
  button: { label: "See their shows", link: { href: "/events" } },
});

const quote = { _type: "quoteBlock", _key: "q", quote: "Loud, and from the heart." };
const table = {
  _type: "tableBlock",
  _key: "t",
  heading: "Venues",
  source: "custom",
  columns: ["Venue", "Capacity"],
  rows: [{ cells: ["Old Mill Music Hall", "350"] }, { cells: ["The Riverside Tap", "120"] }],
};

describe("ContentPage", () => {
  it("draws a Standard page's header and every kind of block that needs nothing else", () => {
    render(
      <ContentPage
        page={page({
          content: {
            blocks: [
              {
                _type: "textBlock",
                _key: "text",
                body: [
                  { ...paragraph("h", "Our mission"), style: "h2" },
                  paragraph(
                    "p1",
                    "See the calendar",
                    [{ _type: "link", _key: "l1", href: "/events" }],
                    ["l1"],
                  ),
                  paragraph(
                    "p2",
                    "Read the history",
                    [{ _type: "link", _key: "l2", href: "https://example.com/history" }],
                    ["l2"],
                  ),
                  paragraph(
                    "p3",
                    "Not a real link",
                    [{ _type: "link", _key: "l3", href: "javascript:alert(1)" }],
                    ["l3"],
                  ),
                  {
                    _key: "img",
                    ...photo("Volunteers at the door"),
                    caption: "Fall Fest",
                  },
                  {
                    _type: "videoBlock",
                    _key: "vid",
                    url: "https://vimeo.com/76979871",
                    title: "A jam",
                  },
                  { _type: "carousel", _key: "x", text: "A kind of content nobody built" },
                ],
              },
              {
                _type: "imageBlock",
                _key: "photo",
                image: photo("A band on stage"),
                caption: "The Friday jam",
              },
              {
                _type: "videoBlock",
                _key: "video",
                url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
                title: "The Muddy Ridge Trio live",
                caption: "Recorded at Fall Fest",
              },
              table,
              {
                _type: "buttonBlock",
                _key: "button",
                label: "Volunteer with us",
                link: { target: { _type: "page", slug: "volunteer", title: "Volunteer" } },
              },
              { ...quote, attribution: "Dale Pruitt, guitar" },
              { _type: "galleryBlock", _key: "unknown", heading: "From a newer schema" },
            ],
            memberFiles: [],
          },
        })}
      />,
    );

    expect(
      screen.getByRole("heading", { level: 1, name: "About the Society" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Who we are and what we do.")).toBeInTheDocument();
    expect(screen.queryByText("Members only")).not.toBeInTheDocument();

    // Rich text: headings, links (only safe ones), photos and videos.
    expect(screen.getByRole("heading", { level: 2, name: "Our mission" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "See the calendar" })).toHaveAttribute(
      "href",
      "/events",
    );
    expect(screen.getByRole("link", { name: "Read the history" })).toHaveAttribute(
      "href",
      "https://example.com/history",
    );
    expect(screen.getByText("Not a real link")).not.toHaveAttribute("href");
    expect(screen.queryByRole("link", { name: "Not a real link" })).not.toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Volunteers at the door" })).toHaveAttribute(
      "data-fill",
      "false",
    );
    expect(screen.getByText("Fall Fest")).toBeInTheDocument();
    expect(screen.getByTitle("A jam")).toHaveAttribute(
      "src",
      "https://player.vimeo.com/video/76979871?dnt=1",
    );
    expect(screen.queryByText("A kind of content nobody built")).not.toBeInTheDocument();
    // Not even Portable Text's hidden "Unknown block type" note for developers.
    expect(document.body).not.toHaveTextContent(/Unknown block type/);

    // The photo block fills its frame, cropped around the focal point.
    const bandPhoto = screen.getByRole("img", { name: "A band on stage" });
    expect(bandPhoto).toHaveAttribute("data-asset", ASSET);
    expect(bandPhoto).toHaveAttribute("data-fill", "true");
    expect(screen.getByText("The Friday jam")).toBeInTheDocument();

    const player = screen.getByTitle("The Muddy Ridge Trio live");
    expect(player.tagName).toBe("IFRAME");
    expect(player).toHaveAttribute("src", "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ");
    expect(player).toHaveAttribute("loading", "lazy");
    expect(screen.getByText("Recorded at Fall Fest")).toBeInTheDocument();

    expect(screen.getByRole("table", { name: "Venues" })).toBeInTheDocument();
    expect(screen.queryByRole("searchbox")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Volunteer with us" })).toHaveAttribute(
      "href",
      "/volunteer",
    );
    expect(screen.getByText(/Loud, and from the heart\./)).toBeInTheDocument();
    expect(screen.getByText(/Dale Pruitt, guitar/)).toBeInTheDocument();
    expect(screen.queryByText("From a newer schema")).not.toBeInTheDocument();
  });

  it("opens with a hero instead of the page header when the first block is one", () => {
    render(
      <ContentPage
        page={page({
          title: "Band Spotlight: The Muddy Ridge Trio",
          template: "spotlight",
          content: { blocks: [hero("The Muddy Ridge Trio"), quote, hero("A second hero")] },
        })}
      />,
    );

    // The hero's headline is the page's one level-1 heading, with the template's name above it.
    const h1 = screen.getByRole("heading", { level: 1 });
    expect(h1).toHaveTextContent("The Muddy Ridge Trio");
    expect(screen.queryByText("Band Spotlight: The Muddy Ridge Trio")).not.toBeInTheDocument();
    expect(screen.queryByText("Who we are and what we do.")).not.toBeInTheDocument();
    expect(screen.getAllByText("Band Spotlight")).toHaveLength(1);
    expect(
      screen.getByText("Hill-country blues from three old friends.", { selector: "h1 ~ p" }),
    ).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: "See their shows" })[0]).toHaveAttribute(
      "href",
      "/events",
    );
    const photos = screen.getAllByRole("img", { name: "The trio on stage" });
    expect(photos[0]).toHaveAttribute("data-preload", "true");
    expect(photos[0]).toHaveAttribute("data-sizes", "100vw");

    // A hero further down is a section of the page: a level-2 heading, no eyebrow, not preloaded.
    expect(screen.getByRole("heading", { level: 2, name: "A second hero" })).toBeInTheDocument();
    expect(photos[1]).toHaveAttribute("data-preload", "false");
  });

  it("shows no eyebrow on a Promo Feature's hero, and the header when the first block isn't a hero", () => {
    const { unmount } = render(
      <ContentPage
        page={page({ template: "promo", content: { blocks: [hero("Bands wanted")] } })}
      />,
    );
    expect(screen.getByRole("heading", { level: 1, name: "Bands wanted" })).toBeInTheDocument();
    expect(screen.queryByText("Promo Feature")).not.toBeInTheDocument();
    unmount();

    render(
      <ContentPage
        page={page({ template: "spotlight", content: { blocks: [quote, hero("Later")] } })}
      />,
    );
    expect(
      screen.getByRole("heading", { level: 1, name: "About the Society" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: "Later" })).toBeInTheDocument();
    expect(screen.queryByText("Band Spotlight")).not.toBeInTheDocument();
  });

  it("gives a Directory page's tables a search box", () => {
    render(<ContentPage page={page({ template: "directory", content: { blocks: [table] } })} />);
    expect(screen.getByRole("searchbox", { name: "Search Venues" })).toBeInTheDocument();
    expect(screen.getByRole("table", { name: "Venues" })).toBeInTheDocument();
  });

  it("marks a members-only page for a member who may see it, in the header or the hero", () => {
    const membersOnly = { audience: "members", levels: [] };
    const { unmount } = render(
      <ContentPage page={page({ visibility: membersOnly, content: { blocks: [quote] } })} />,
    );
    expect(screen.getByText("Members only")).toBeInTheDocument();
    expect(screen.getByText(/Loud, and from the heart\./)).toBeInTheDocument();
    unmount();

    render(
      <ContentPage
        page={page({
          template: "spotlight",
          visibility: membersOnly,
          content: { blocks: [hero("The Muddy Ridge Trio")] },
        })}
      />,
    );
    const h1 = screen.getByRole("heading", { level: 1, name: "The Muddy Ridge Trio" });
    expect(within(h1.parentElement!).getByText("Members only")).toBeInTheDocument();
  });

  it("lists a page's files for members", () => {
    render(
      <ContentPage
        page={page({
          content: {
            blocks: [quote],
            memberFiles: [
              { title: "Booking guide (PDF)", fileId: "00000000-0000-4000-8000-000000000001" },
            ],
          },
        })}
      />,
    );
    const files = screen.getByRole("region", { name: "Files for members" });
    expect(within(files).getByRole("link", { name: "Booking guide (PDF)" })).toHaveAttribute(
      "href",
      "/files/00000000-0000-4000-8000-000000000001",
    );
  });

  it("fills the sponsor logos block with its own loader, with the sponsors the editor picked", () => {
    render(
      <ContentPage
        page={page({
          content: {
            blocks: [
              { _type: "sponsorStripBlock", _key: "all", heading: "Our sponsors" },
              {
                _type: "sponsorStripBlock",
                _key: "picked",
                heading: "Presented by",
                sponsors: [{ _ref: "sp-2" }, { _ref: "sp-1" }],
              },
            ],
          },
        })}
      />,
    );
    expect(screen.getByText("Sponsor logos: Our sponsors []")).toBeInTheDocument();
    expect(screen.getByText("Sponsor logos: Presented by [sp-2, sp-1]")).toBeInTheDocument();
  });

  it("shows nothing yet for the blocks whose loaders other backlog items build", () => {
    const { container } = render(
      <ContentPage
        page={page({
          content: {
            blocks: [
              { _type: "upcomingEventsBlock", _key: "e", heading: "Upcoming shows", count: 3 },
              { _type: "tableBlock", _key: "d", heading: "Venue directory", source: "directory" },
              { _type: "formBlock", _key: "f", form: "volunteer", heading: "Sign up" },
            ],
          },
        })}
      />,
    );
    for (const heading of ["Upcoming shows", "Venue directory", "Sign up"]) {
      expect(screen.queryByText(heading)).not.toBeInTheDocument();
    }
    expect(container.querySelectorAll("h1")).toHaveLength(1);
  });

  it("shows a viewer who may not see the page its header and a lock, and nothing else", () => {
    render(
      <ContentPage
        page={page({
          template: "directory",
          visibility: { audience: "members", levels: [] },
          access: { allowed: false, reason: "sign-in" },
          content: null,
        })}
      />,
    );
    expect(
      screen.getByRole("heading", { level: 1, name: "About the Society" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Who we are and what we do.")).toBeInTheDocument();
    expect(screen.getByText("Members only")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { level: 2, name: "This page is for members" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Sign in or join to see it.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Sign in" })).toHaveAttribute(
      "href",
      "/sign-in?next=%2Fabout",
    );
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it("tells a member at another level which levels the page is for", () => {
    render(
      <ContentPage
        page={page({
          visibility: { audience: "levels", levels: ["band", "business", "sponsor"] },
          access: { allowed: false, reason: "level" },
          content: null,
        })}
      />,
    );
    expect(
      screen.getByRole("heading", { name: "This page is for Band, Business and Sponsor members" }),
    ).toBeInTheDocument();
    expect(screen.getByText("It isn't part of your membership level.")).toBeInTheDocument();
  });

  it("draws just the header for a page whose blocks are all incomplete", () => {
    const { container } = render(
      <ContentPage
        page={page({ intro: "  ", content: { blocks: [{ _type: "quoteBlock", _key: "q" }] } })}
      />,
    );
    expect(
      screen.getByRole("heading", { level: 1, name: "About the Society" }),
    ).toBeInTheDocument();
    expect(container.querySelectorAll("h1 ~ p")).toHaveLength(0);
    expect(container.querySelector("figure")).toBeNull();
  });
});
