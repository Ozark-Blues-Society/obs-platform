import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { PostItem } from "@/lib/blog/posts";
import { PostView } from "./post-view";

// next-sanity's <Image> builds Sanity CDN addresses; here it shows what it was given instead.
vi.mock("next-sanity/image", () => ({
  Image: (props: {
    src: { asset: { _ref: string } };
    alt: string;
    fill?: boolean;
    preload?: boolean;
  }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      alt={props.alt}
      data-asset={props.src.asset._ref}
      data-fill={String(Boolean(props.fill))}
      data-preload={String(Boolean(props.preload))}
    />
  ),
}));

const COVER = "image-Tb9Ew8CXIwaY6R1kjMvI0uRR-2000x1125-jpg";
const PORTRAIT = "image-Ab9Ew8CXIwaY6R1kjMvI0uRR-600x600-jpg";

const paragraph = (key: string, text: string, style = "normal") => ({
  _type: "block",
  _key: key,
  style,
  markDefs: [],
  children: [{ _type: "span", _key: `${key}s`, text, marks: [] }],
});

function post(overrides: Partial<PostItem> = {}): PostItem {
  return {
    _id: "post-fall-fest-recap",
    _type: "post",
    slug: "fall-fest-recap",
    title: "Fall Fest Recap",
    category: "recap",
    publishedAt: "2026-10-14T15:00:00Z",
    coverImage: { _type: "image", asset: { _ref: COVER }, alt: "The crowd at Fall Fest" },
    visibility: { audience: "everyone", levels: [] },
    access: { allowed: true },
    content: {
      excerpt: "Two days, eleven bands, and one very muddy field.",
      body: [
        paragraph("p1", "The rain held off until Sunday."),
        paragraph("h", "The highlights", "h2"),
        paragraph("p2", "Slide guitar all weekend."),
      ],
      author: {
        name: "Dee Harmon",
        role: "Volunteer coordinator",
        bio: "Twelve years at the door table.",
        photo: { _type: "image", asset: { _ref: PORTRAIT }, alt: "Dee Harmon" },
      },
      memberFiles: [],
    },
    ...overrides,
  };
}

describe("PostView", () => {
  it("shows the post: header, cover photo, summary, byline, text and the author", () => {
    render(<PostView post={post()} />);

    expect(screen.getByRole("heading", { level: 1, name: "Fall Fest Recap" })).toBeInTheDocument();
    expect(screen.getByText("Oct 14, 2026")).toHaveAttribute(
      "datetime",
      "2026-10-14T15:00:00.000Z",
    );
    expect(screen.getByText(/^Recap/)).toBeInTheDocument();
    expect(screen.queryByText("Members only")).not.toBeInTheDocument();

    // The cover is the page's main photo: loaded first, with the editor's alt text.
    const cover = screen.getByRole("img", { name: "The crowd at Fall Fest" });
    expect(cover).toHaveAttribute("data-asset", COVER);
    expect(cover).toHaveAttribute("data-preload", "true");

    const article = screen.getByRole("article");
    expect(
      within(article).getByText("Two days, eleven bands, and one very muddy field."),
    ).toBeInTheDocument();
    expect(within(article).getByText("By Dee Harmon")).toBeInTheDocument();
    expect(within(article).getByText("The rain held off until Sunday.")).toBeInTheDocument();
    expect(
      within(article).getByRole("heading", { level: 2, name: "The highlights" }),
    ).toBeInTheDocument();

    // Under the post: who wrote it. The name is beside the photo, so the photo is decoration.
    // A <footer> inside the article: the article's own footer, not the page's contentinfo.
    const about = article.querySelector("footer") as HTMLElement;
    expect(about).toHaveTextContent("Dee Harmon · Volunteer coordinator");
    expect(about).toHaveTextContent("Twelve years at the door table.");
    expect(about.querySelector("img")).toHaveAttribute("alt", "");
    expect(about.querySelector("img")).toHaveAttribute("data-asset", PORTRAIT);

    expect(screen.getByRole("link", { name: "All posts" })).toHaveAttribute("href", "/blog");
  });

  it("names an author without a bio or photo in the byline only, and leaves out what's missing", () => {
    render(
      <PostView
        post={post({
          coverImage: undefined,
          content: { excerpt: "", body: [paragraph("p", "Short.")], author: { name: "Board" } },
        })}
      />,
    );
    expect(screen.getByText("By Board")).toBeInTheDocument();
    expect(screen.getByRole("article").querySelector("footer")).toBeNull();
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
    expect(screen.getByText("Short.")).toBeInTheDocument();
  });

  it("lists a members-only post's files and tags it for a member who may read it", () => {
    render(
      <PostView
        post={post({
          visibility: { audience: "members", levels: [] },
          content: {
            body: [paragraph("p", "Budget update.")],
            memberFiles: [
              { title: "October minutes (PDF)", fileId: "00000000-0000-4000-8930-000000000001" },
            ],
          },
        })}
      />,
    );
    // In the header, and on the file.
    expect(screen.getAllByText("Members only")).toHaveLength(2);
    expect(screen.getByText("Budget update.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "October minutes (PDF)" })).toHaveAttribute(
      "href",
      "/files/00000000-0000-4000-8930-000000000001",
    );
  });

  it("gives a visitor the headline, category, date, cover and a lock, and no post", () => {
    render(
      <PostView
        post={post({
          visibility: { audience: "members", levels: [] },
          access: { allowed: false, reason: "sign-in" },
          content: null,
        })}
      />,
    );

    expect(screen.getByRole("heading", { level: 1, name: "Fall Fest Recap" })).toBeInTheDocument();
    expect(screen.getByText("Members only")).toBeInTheDocument();
    expect(screen.getByText("Oct 14, 2026")).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "The crowd at Fall Fest" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "This post is for members" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Sign in" })).toHaveAttribute(
      "href",
      "/sign-in?next=%2Fblog%2Ffall-fest-recap",
    );
    expect(screen.queryByRole("article")).not.toBeInTheDocument();
    expect(screen.queryByText(/By /)).not.toBeInTheDocument();
  });

  it("tells a member at another level whom the post is for, even if content came along", () => {
    render(
      <PostView
        post={post({
          visibility: { audience: "levels", levels: ["band", "business", "sponsor"] },
          access: { allowed: false, reason: "level" },
          // sanity/content never sends content with a lock; even so, none of it shows.
          content: { excerpt: "Should never show.", body: [paragraph("p", "Nor this.")] },
        })}
      />,
    );
    expect(
      screen.getByRole("heading", { name: "This post is for Band, Business and Sponsor members" }),
    ).toBeInTheDocument();
    expect(screen.queryByText("Should never show.")).not.toBeInTheDocument();
    expect(screen.queryByText("Nor this.")).not.toBeInTheDocument();
  });

  it("calls a post with no headline Untitled, and shows no date it can't read", () => {
    render(
      <PostView post={post({ title: undefined, publishedAt: "soon", category: undefined })} />,
    );
    expect(screen.getByRole("heading", { level: 1, name: "Untitled post" })).toBeInTheDocument();
    expect(document.querySelector("time")).toBeNull();
  });
});
