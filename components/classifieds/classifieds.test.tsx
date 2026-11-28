import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeAll, describe, expect, it, vi } from "vitest";
import type { ContactState, ListingDetail, PublicListing } from "@/lib/listings/public-state";
import { ClassifiedsList } from "./classifieds-list";
import { ContactForm } from "./contact-form";
import { ListingView } from "./listing-view";
import { PostListingLink } from "./post-listing-link";

// jsdom has <dialog> but not showModal() or close() (see components/ui/modal.test.tsx).
beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function showModal(this: HTMLDialogElement) {
    this.setAttribute("open", "");
  };
  HTMLDialogElement.prototype.close = function close(this: HTMLDialogElement) {
    if (!this.open) return;
    this.removeAttribute("open");
    setTimeout(() => this.dispatchEvent(new Event("close")), 0);
  };
});

const AMP: PublicListing = {
  id: "00000000-0000-4000-8200-000000000003",
  category: "gear",
  title: "Tweed-style 1x12 tube amp, 15 W",
  body: "Hand-wired and in great condition.\nLocal pickup only.",
  price: 650,
  postedAt: "2026-11-08T18:00:00+00:00",
  poster: "Marcus L.",
};
const CREW: PublicListing = {
  id: "00000000-0000-4000-8200-000000000008",
  category: "street_team",
  title: "Poster crew for the Winter Blues Revue",
  body: "Help hang posters.",
  price: null,
  postedAt: "2026-11-20T18:00:00+00:00",
  poster: null,
};

describe("ClassifiedsList", () => {
  it("links each category, with the one shown as the current page", () => {
    render(<ClassifiedsList listings={[AMP]} category="gear" signedIn={false} />);

    const nav = screen.getByRole("navigation", { name: "Classifieds categories" });
    const links = within(nav).getAllByRole("link");
    expect(links.map((link) => [link.textContent, link.getAttribute("href")])).toEqual([
      ["All", "/classifieds"],
      ["Musicians Wanted", "/classifieds?category=musicians-wanted"],
      ["Gear", "/classifieds?category=gear"],
      ["Merch", "/classifieds?category=merch"],
      ["Street Team", "/classifieds?category=street-team"],
      ["Member Connect", "/classifieds?category=member-connect"],
    ]);
    expect(within(nav).getByRole("link", { current: "page" })).toHaveTextContent("Gear");
    expect(screen.getByRole("status")).toHaveTextContent("1 Gear listing.");
  });

  it("shows each listing as a card linking to its page, and Contact to the form there", () => {
    render(<ClassifiedsList listings={[AMP, CREW]} category={null} signedIn />);

    const cards = screen.getAllByRole("article");
    expect(cards).toHaveLength(2);
    const amp = within(cards[0]);
    expect(amp.getByText("Gear")).toBeInTheDocument();
    expect(amp.getByRole("heading", { level: 2 })).toHaveTextContent(
      "Tweed-style 1x12 tube amp, 15 W — $650",
    );
    expect(amp.getByRole("link", { name: /^Tweed-style/ })).toHaveAttribute(
      "href",
      `/classifieds/${AMP.id}`,
    );
    expect(amp.getByText("Posted by Marcus L.")).toBeInTheDocument();
    expect(
      amp.getByRole("link", { name: "Contact Marcus L. about “Tweed-style 1x12 tube amp, 15 W”" }),
    ).toHaveAttribute("href", `/classifieds/${AMP.id}#contact`);

    const crew = within(cards[1]);
    expect(crew.getByRole("heading", { level: 2 })).toHaveTextContent(CREW.title);
    expect(crew.getByText("Posted by a member")).toBeInTheDocument();
    expect(
      crew.getByRole("link", { name: `Contact the poster about “${CREW.title}”` }),
    ).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("2 listings.");
  });

  it("says when a category has nothing, with a way back to every listing", () => {
    render(<ClassifiedsList listings={[]} category="merch" signedIn={false} />);

    const status = screen.getByRole("status");
    expect(status).toHaveTextContent(
      "No Merch listings right now. Check back soon. See all listings",
    );
    expect(within(status).getByRole("link", { name: "See all listings" })).toHaveAttribute(
      "href",
      "/classifieds",
    );
    expect(screen.queryByRole("article")).not.toBeInTheDocument();
  });
});

describe("PostListingLink", () => {
  it("opens the form for someone signed in", () => {
    render(<PostListingLink signedIn />);
    const link = screen.getByRole("link", { name: "Post a listing" });
    expect(link).toHaveAttribute("href", "/account/listings/new");
    expect(link).not.toHaveAttribute("aria-haspopup");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("asks a visitor to sign in or join, and goes back to the link on Escape", async () => {
    render(<PostListingLink signedIn={false} />);
    const link = screen.getByRole("link", { name: "Post a listing" });
    expect(link).toHaveAttribute("href", "/account/listings/new");
    expect(link).toHaveAttribute("aria-haspopup", "dialog");

    // A browser focuses a link as it's pressed; jsdom's click doesn't.
    link.focus();
    fireEvent.click(link);
    const dialog = screen.getByRole("dialog", { name: "Posting is a member benefit" });
    expect(within(dialog).getByRole("link", { name: "Sign in" })).toHaveAttribute(
      "href",
      "/sign-in?next=%2Faccount%2Flistings%2Fnew",
    );
    expect(within(dialog).getByRole("link", { name: "Join" })).toHaveAttribute("href", "/join");

    fireEvent.keyDown(dialog, { key: "Escape" });
    await act(() => new Promise<void>((resolve) => setTimeout(resolve, 0)));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(link).toHaveFocus();
  });
});

const NO_DEFAULTS = { name: "", email: "" };

function detail(overrides: Partial<ListingDetail> = {}): ListingDetail {
  return {
    ...AMP,
    photo: null,
    contact: { kind: "message", phoneForMembers: false, defaults: NO_DEFAULTS },
    ...overrides,
  };
}

const contactRegion = () => screen.getByRole("region", { name: "Contact the poster" });

describe("ListingView", () => {
  it("shows the listing: category, title, price, details and who posted it when", () => {
    render(<ListingView listing={detail()} contact={vi.fn()} />);

    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(AMP.title);
    expect(screen.getByText("Gear")).toBeInTheDocument();
    expect(screen.getByText("$650")).toBeInTheDocument();
    expect(screen.getByText(/Hand-wired and in great condition\./)).toHaveClass(
      "whitespace-pre-line",
    );
    expect(screen.getByText(/Posted by Marcus L\. on/)).toHaveTextContent(
      "Posted by Marcus L. on Nov 8, 2026",
    );
    expect(screen.getByRole("link", { name: "See all listings" })).toHaveAttribute(
      "href",
      "/classifieds",
    );
    expect(contactRegion()).toHaveAttribute("id", "contact");
  });

  it("shows the approved photo, and nothing in its place when it can't be shown", () => {
    const { unmount } = render(
      <ListingView
        listing={detail({ photo: { status: "shown", url: "https://storage.example.org/p.jpg" } })}
        contact={vi.fn()}
      />,
    );
    expect(
      screen.getByRole("img", { name: `The poster's photo for “${AMP.title}”` }),
    ).toHaveAttribute("src", "https://storage.example.org/p.jpg");
    unmount();

    render(<ListingView listing={detail({ photo: { status: "missing" } })} contact={vi.fn()} />);
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });

  it("lets anyone write to the poster", () => {
    render(<ListingView listing={detail()} contact={vi.fn()} />);
    const region = within(contactRegion());
    expect(region.getByRole("textbox", { name: "Your message to Marcus L." })).toBeInTheDocument();
    expect(region.queryByRole("link", { name: "Sign in" })).not.toBeInTheDocument();
  });

  it("tells a visitor that a poster who asked for calls shows members the number", () => {
    render(
      <ListingView
        listing={detail({
          contact: { kind: "message", phoneForMembers: true, defaults: NO_DEFAULTS },
        })}
        contact={vi.fn()}
      />,
    );
    const region = within(contactRegion());
    expect(contactRegion()).toHaveTextContent(
      "Marcus L. prefers phone calls. Sign in to see their number, or write to them here.",
    );
    expect(region.getByRole("link", { name: "Sign in" })).toHaveAttribute(
      "href",
      `/sign-in?next=${encodeURIComponent(`/classifieds/${AMP.id}`)}`,
    );
    expect(region.getByRole("textbox", { name: "Your message to Marcus L." })).toBeInTheDocument();
  });

  it("tells the poster it's their listing, with no form", () => {
    render(<ListingView listing={detail({ contact: { kind: "own" } })} contact={vi.fn()} />);
    expect(contactRegion()).toHaveTextContent("This is your listing.");
    expect(within(contactRegion()).queryByRole("textbox")).not.toBeInTheDocument();
  });

  it("gives a signed-in viewer the number of a poster who asked for calls, as a link to call", () => {
    render(
      <ListingView
        listing={detail({ contact: { kind: "phone", phone: "(479) 555-0142" } })}
        contact={vi.fn()}
      />,
    );
    expect(contactRegion()).toHaveTextContent("Marcus L. asked to be contacted by phone:");
    expect(within(contactRegion()).getByRole("link", { name: "(479) 555-0142" })).toHaveAttribute(
      "href",
      "tel:4795550142",
    );
    expect(within(contactRegion()).queryByRole("textbox")).not.toBeInTheDocument();
  });
});

function answering(state: ContactState) {
  return vi.fn(async (): Promise<ContactState> => state);
}

const VALUES = { name: "Jo Ames", email: "jo.ames@example.com", message: "Hello again" };
const field = (name: string) => screen.getByRole("textbox", { name });
const message = () => field("Your message to Lou T.");
const send = () => fireEvent.click(screen.getByRole("button", { name: "Send message" }));

function fill(values: Partial<typeof VALUES>) {
  const labels = {
    name: "Your name",
    email: "Your email address",
    message: "Your message to Lou T.",
  };
  for (const [name, value] of Object.entries(values)) {
    fireEvent.change(field(labels[name as keyof typeof labels]), { target: { value } });
  }
}

describe("ContactForm", () => {
  it("asks for a name, an address to reply to and the message, in labelled fields", () => {
    render(<ContactForm action={vi.fn()} poster="Lou T." defaults={NO_DEFAULTS} />);

    expect(field("Your name")).toBeRequired();
    expect(field("Your name")).toHaveAttribute("autocomplete", "name");
    expect(field("Your email address")).toHaveAttribute("type", "email");
    expect(field("Your email address")).toHaveAttribute("autocomplete", "email");
    expect(field("Your email address")).toHaveAccessibleDescription(
      "Lou T. replies to this address.",
    );
    expect(message()).toBeRequired();
    expect(message()).toHaveAccessibleDescription(
      "We email it to them with your name and address. Their own address stays private.",
    );
  });

  it("fills in a signed-in member's name and address", () => {
    render(
      <ContactForm
        action={vi.fn()}
        poster="Lou T."
        defaults={{ name: "Jo Ames", email: "jo.ames@example.com" }}
      />,
    );
    expect(field("Your name")).toHaveValue("Jo Ames");
    expect(field("Your email address")).toHaveValue("jo.ames@example.com");
    expect(message()).toHaveValue("");
  });

  it("hides the field that catches scripts from people, keyboards and screen readers", () => {
    const { container } = render(
      <ContactForm action={vi.fn()} poster={null} defaults={NO_DEFAULTS} />,
    );
    const trap = container.querySelector<HTMLInputElement>('input[name="website"]');
    expect(trap).not.toBeNull();
    expect(trap).toHaveAttribute("tabindex", "-1");
    expect(trap).toHaveAttribute("autocomplete", "off");
    expect(trap?.closest('[aria-hidden="true"]')).not.toBeNull();
    expect(screen.getAllByRole("textbox")).toHaveLength(3);
    expect(field("Your message to the poster")).toBeInTheDocument();
  });

  it("reads out a problem on its field, and keeps what was typed", async () => {
    const action = answering({
      status: "error",
      field: "email",
      message: "Enter your email address, such as name@example.com, so the poster can reply.",
      values: { ...VALUES, email: "jo.ames" },
    });
    render(<ContactForm action={action} poster="Lou T." defaults={NO_DEFAULTS} />);
    fill({ ...VALUES, email: "jo.ames" });
    send();

    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent("Enter your email address"),
    );
    expect(field("Your email address")).toHaveAttribute("aria-invalid", "true");
    expect(field("Your email address")).toHaveValue("jo.ames");
    expect(message()).toHaveValue("Hello again");
    expect(action).toHaveBeenCalledOnce();
  });

  it("reads out a failure that isn't a field's", async () => {
    render(
      <ContactForm
        action={answering({
          status: "error",
          field: null,
          message: "That was quick. Check your message, then send it again.",
          values: VALUES,
        })}
        poster="Lou T."
        defaults={NO_DEFAULTS}
      />,
    );
    fill(VALUES);
    send();

    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("That was quick."));
    expect(message()).toHaveValue("Hello again");
    expect(message()).not.toHaveAttribute("aria-invalid");
  });

  it("says the message went, and empties the message", async () => {
    render(
      <ContactForm
        action={answering({ status: "sent", message: "Message sent. Lou T. can reply to you." })}
        poster="Lou T."
        defaults={{ name: "Jo Ames", email: "jo.ames@example.com" }}
      />,
    );
    fill({ message: "Is it still for sale?" });
    send();

    await waitFor(() =>
      expect(screen.getByRole("status")).toHaveTextContent(
        "Message sent. Lou T. can reply to you.",
      ),
    );
    expect(message()).toHaveValue("");
    expect(field("Your name")).toHaveValue("Jo Ames");
  });
});
