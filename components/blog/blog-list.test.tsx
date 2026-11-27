import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { PostListItem } from "@/lib/blog/posts";
import { BlogList } from "./blog-list";

// next-sanity's <Image> builds Sanity CDN addresses; here it shows what it was given instead.
vi.mock("next-sanity/image", () => ({
  Image: (props: { src: { asset: { _ref: string } }; alt: string; fill?: boolean }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      alt={props.alt}
      data-asset={props.src.asset._ref}
      data-fill={String(Boolean(props.fill))}
    />
  ),
}));

const ASSET = "image-Tb9Ew8CXIwaY6R1kjMvI0uRR-2000x1125-jpg";

function post(slug: string, overrides: Partial<PostListItem> = {}): PostListItem {
  return {
    _id: `post-${slug}`,
    _type: "post",
    slug,
    title: `Post ${slug}`,
    category: "recap",
    publishedAt: "2026-11-25T15:00:00Z",
    visibility: { audience: "everyone", levels: [] },
    access: { allowed: true },
    content: { excerpt: `The summary of ${slug}.` },
    ...overrides,
  };
}

const page = { total: 1, page: 1, pageCount: 1, category: null };

const card = (title: string) =>
  screen.getByRole("heading", { level: 2, name: title }).closest("article") as HTMLElement;

describe("BlogList", () => {
  it("links each category, with the one shown as the current page", () => {
    const { rerender } = render(<BlogList posts={[post("a")]} {...page} />);

    const nav = screen.getByRole("navigation", { name: "Blog categories" });
    const links = within(nav).getAllByRole("link");
    expect(links.map((link) => [link.textContent, link.getAttribute("href")])).toEqual([
      ["All", "/blog"],
      ["Recap", "/blog?category=recap"],
      ["Band Spotlight", "/blog?category=band-spotlight"],
      ["Society News", "/blog?category=society-news"],
      ["Education", "/blog?category=education"],
    ]);
    expect(within(nav).getByRole("link", { current: "page" })).toHaveTextContent("All");

    rerender(<BlogList posts={[post("a")]} {...page} category="education" />);
    const current = within(nav).getAllByRole("link", { current: "page" });
    expect(current.map((link) => link.textContent)).toEqual(["Education"]);
  });

  it("shows each post's card: headline linked to the post, category, date and summary", () => {
    render(
      <BlogList
        posts={[
          post("fall-fest-recap", { title: "Fall Fest Recap" }),
          post("board-notes", { title: "Board Notes", category: "society-news" }),
        ]}
        {...page}
        total={2}
      />,
    );

    const items = screen.getAllByRole("listitem").filter((li) => li.querySelector("article"));
    expect(items).toHaveLength(2);
    const recap = card("Fall Fest Recap");
    expect(within(recap).getByRole("link", { name: "Fall Fest Recap" })).toHaveAttribute(
      "href",
      "/blog/fall-fest-recap",
    );
    expect(within(recap).getByText("Recap")).toBeInTheDocument();
    expect(within(recap).getByText("Nov 25, 2026")).toHaveAttribute(
      "datetime",
      "2026-11-25T15:00:00.000Z",
    );
    expect(within(recap).getByText("The summary of fall-fest-recap.")).toBeInTheDocument();
    expect(within(recap).queryByText("Members only")).not.toBeInTheDocument();
    expect(within(card("Board Notes")).getByText("Society News")).toBeInTheDocument();
    expect(screen.queryByRole("navigation", { name: "Blog pages" })).not.toBeInTheDocument();
  });

  it("locks a members-only post the viewer can't read, never showing a summary", () => {
    render(
      <BlogList
        posts={[
          post("board-notes", {
            title: "Board Notes",
            visibility: { audience: "members", levels: [] },
            access: { allowed: false, reason: "sign-in" },
            content: null,
          }),
          // sanity/content never sends content with a lock; even so, none of it shows.
          post("band-notes", {
            title: "Band Notes",
            visibility: { audience: "levels", levels: ["band"] },
            access: { allowed: false, reason: "level" },
            content: { excerpt: "Should never show." },
          }),
        ]}
        {...page}
        total={2}
      />,
    );

    for (const title of ["Board Notes", "Band Notes"]) {
      const locked = card(title);
      expect(within(locked).getByText("Members only")).toBeInTheDocument();
      expect(
        within(locked).getByText("This post is for members. Sign in or join to read it."),
      ).toBeInTheDocument();
    }
    expect(screen.queryByText("Should never show.")).not.toBeInTheDocument();
  });

  it("gives a members-only post the viewer may read its summary and the Members only tag", () => {
    render(
      <BlogList
        posts={[post("board-notes", { visibility: { audience: "members", levels: [] } })]}
        {...page}
      />,
    );
    const open = card("Post board-notes");
    expect(within(open).getByText("Members only")).toBeInTheDocument();
    expect(within(open).getByText("The summary of board-notes.")).toBeInTheDocument();
  });

  it("shows the cover photo as decoration, or a drawn stage without one", () => {
    render(
      <BlogList
        posts={[
          post("with-cover", {
            coverImage: { _type: "image", asset: { _ref: ASSET }, alt: "Crowd" },
          }),
          post("no-cover", { category: "education" }),
        ]}
        {...page}
        total={2}
      />,
    );

    // The headline says what the post is: the photo has empty alt text, so screen readers skip it.
    const photo = card("Post with-cover").querySelector("img");
    expect(photo).toHaveAttribute("data-asset", ASSET);
    expect(photo).toHaveAttribute("alt", "");
    expect(photo).toHaveAttribute("data-fill", "true");
    const drawn = card("Post no-cover");
    expect(drawn.querySelector("img")).toBeNull();
    expect(drawn.querySelector("svg[aria-hidden='true']")).not.toBeNull();
  });

  it("says when there are no posts, or none in the category, with a way back to all", () => {
    const { rerender } = render(<BlogList posts={[]} {...page} total={0} />);
    const status = screen.getByRole("status");
    expect(status).toHaveTextContent("No posts yet. Check back soon.");
    expect(status).not.toHaveClass("sr-only");
    expect(document.querySelector("article")).toBeNull();

    rerender(<BlogList posts={[]} {...page} total={0} category="band-spotlight" />);
    // The same live region, so a screen reader hears the change after a pill is followed.
    expect(screen.getByRole("status")).toBe(status);
    expect(status).toHaveTextContent("No Band Spotlight posts yet. See all posts");
    expect(within(status).getByRole("link", { name: "See all posts" })).toHaveAttribute(
      "href",
      "/blog",
    );
  });

  it("tells screen readers how many posts the list holds, and which page this is", () => {
    const { rerender } = render(<BlogList posts={[post("a")]} {...page} />);
    const status = screen.getByRole("status");
    expect(status).toHaveTextContent(/^1 post\.$/);
    expect(status).toHaveClass("sr-only");

    rerender(<BlogList posts={[post("a")]} {...page} total={3} category="society-news" />);
    expect(screen.getByRole("status")).toBe(status);
    expect(status).toHaveTextContent(/^3 Society News posts\.$/);

    rerender(<BlogList posts={[post("a")]} total={30} page={2} pageCount={3} category={null} />);
    expect(status).toHaveTextContent(/^30 posts, page 2 of 3\.$/);
  });

  it("links the newer and older pages of the same category", () => {
    const posts = [post("a")];
    const { rerender } = render(
      <BlogList posts={posts} total={30} page={2} pageCount={3} category="recap" />,
    );

    const pages = screen.getByRole("navigation", { name: "Blog pages" });
    expect(within(pages).getByRole("link", { name: "Newer posts" })).toHaveAttribute(
      "href",
      "/blog?category=recap",
    );
    expect(within(pages).getByRole("link", { name: "Older posts" })).toHaveAttribute(
      "href",
      "/blog?category=recap&page=3",
    );
    expect(pages).toHaveTextContent("Page 2 of 3");

    rerender(<BlogList posts={posts} total={30} page={1} pageCount={3} category={null} />);
    expect(screen.queryByRole("link", { name: "Newer posts" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Older posts" })).toHaveAttribute(
      "href",
      "/blog?page=2",
    );

    rerender(<BlogList posts={posts} total={30} page={3} pageCount={3} category={null} />);
    expect(screen.getByRole("link", { name: "Newer posts" })).toHaveAttribute(
      "href",
      "/blog?page=2",
    );
    expect(screen.queryByRole("link", { name: "Older posts" })).not.toBeInTheDocument();

    // Two pages are enough for the links: 13 posts.
    rerender(<BlogList posts={posts} total={13} page={2} pageCount={2} category="education" />);
    expect(screen.getByRole("navigation", { name: "Blog pages" })).toHaveTextContent("Page 2 of 2");
    expect(screen.getByRole("link", { name: "Newer posts" })).toHaveAttribute(
      "href",
      "/blog?category=education",
    );
  });
});
