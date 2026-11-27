import { describe, expect, it } from "vitest";
import { LISTING_CATEGORIES } from "./listing-state";
import {
  CONTACT_MESSAGES,
  MESSAGE_MAX_LENGTH,
  categoryTone,
  checkContact,
  classifiedsCategory,
  classifiedsHref,
  classifiedsTitle,
  isListingId,
  listingPath,
  listingsSummary,
  readContactForm,
  sentMessage,
} from "./public-state";

describe("the classifieds' web addresses", () => {
  it("names each category in the address with hyphens, and reads it back", () => {
    expect(classifiedsHref(null)).toBe("/classifieds");
    expect(classifiedsHref("musicians_wanted")).toBe("/classifieds?category=musicians-wanted");
    for (const { value } of LISTING_CATEGORIES) {
      const query = new URL(classifiedsHref(value), "https://obs.example.org").searchParams;
      expect(classifiedsCategory(query.get("category") ?? undefined)).toBe(value);
    }
  });

  it("shows every listing for an unknown category or none", () => {
    expect(classifiedsCategory(undefined)).toBeNull();
    expect(classifiedsCategory("")).toBeNull();
    expect(classifiedsCategory("lessons")).toBeNull();
    // The database's own spelling isn't an address the site makes.
    expect(classifiedsCategory("street_team")).toBeNull();
    expect(classifiedsCategory(["gear", "merch"])).toBe("gear");
  });

  it("gives each listing its own page", () => {
    expect(listingPath("00000000-0000-4000-8200-000000000003")).toBe(
      "/classifieds/00000000-0000-4000-8200-000000000003",
    );
  });

  it("knows a listing's id when it sees one", () => {
    expect(isListingId("00000000-0000-4000-8200-000000000003")).toBe(true);
    expect(isListingId("1B4E28BA-2FA1-41D2-883F-0016D3CCA427")).toBe(true);
    for (const value of ["amp", "", "00000000-0000-4000-8200-00000000000", undefined, 42]) {
      expect(isListingId(value)).toBe(false);
    }
    expect(isListingId("00000000-0000-4000-8200-000000000003/../x")).toBe(false);
  });
});

describe("classifiedsTitle", () => {
  it("names the category in the tab, so screen readers hear which list opened", () => {
    expect(classifiedsTitle(null)).toBe("Classifieds · Ozark Blues Society");
    expect(classifiedsTitle("member_connect")).toBe(
      "Member Connect · Classifieds · Ozark Blues Society",
    );
  });
});

describe("listingsSummary", () => {
  it("says how many listings the list holds", () => {
    expect(listingsSummary(7, null)).toBe("7 listings.");
    expect(listingsSummary(1, "gear")).toBe("1 Gear listing.");
    expect(listingsSummary(2, "street_team")).toBe("2 Street Team listings.");
  });

  it("says when there are none", () => {
    expect(listingsSummary(0, null)).toBe("No listings right now. Check back soon.");
    expect(listingsSummary(0, "merch")).toBe("No Merch listings right now. Check back soon.");
  });
});

describe("categoryTone", () => {
  it("gives each category a color of its own, as the concept does", () => {
    const tones = LISTING_CATEGORIES.map(({ value }) => categoryTone(value));
    expect(new Set(tones).size).toBe(LISTING_CATEGORIES.length);
  });
});

describe("readContactForm and checkContact", () => {
  const values = { name: "Jo Ames", email: "jo.ames@example.com", message: "Still for sale?" };

  it("reads the three fields, and nothing for one that's missing", () => {
    const data = new FormData();
    data.set("name", "Jo");
    data.set("message", "Hi");
    expect(readContactForm(data)).toEqual({ name: "Jo", email: "", message: "Hi" });
  });

  it("tidies what was typed: the name on one line, the address trimmed, plain line breaks", () => {
    expect(
      checkContact({
        name: "  Jo \n Ames ",
        email: " jo.ames@example.com ",
        message: "  Is the amp still for sale?\r\nThanks!\r\n",
      }),
    ).toEqual({
      contact: {
        name: "Jo Ames",
        email: "jo.ames@example.com",
        message: "Is the amp still for sale?\nThanks!",
      },
    });
  });

  it("needs a name, an address that looks like one and a message, checked in that order", () => {
    expect(checkContact({ name: " ", email: "", message: "" })).toEqual({
      field: "name",
      problem: CONTACT_MESSAGES.nameMissing,
    });
    expect(checkContact({ ...values, name: "a".repeat(101) })).toMatchObject({ field: "name" });
    for (const email of ["", "jo.ames", "jo@example", "jo ames@example.com", "@example.com"]) {
      expect(checkContact({ ...values, email })).toEqual({
        field: "email",
        problem: CONTACT_MESSAGES.emailInvalid,
      });
    }
    expect(checkContact({ ...values, email: `${"a".repeat(250)}@example.com` })).toMatchObject({
      field: "email",
    });
    expect(checkContact({ ...values, message: "  \n " })).toEqual({
      field: "message",
      problem: CONTACT_MESSAGES.messageMissing,
    });
  });

  it("takes a message up to the limit, and no more", () => {
    expect(checkContact({ ...values, message: "a".repeat(MESSAGE_MAX_LENGTH) })).toMatchObject({
      contact: { message: "a".repeat(MESSAGE_MAX_LENGTH) },
    });
    expect(checkContact({ ...values, message: "a".repeat(MESSAGE_MAX_LENGTH + 1) })).toEqual({
      field: "message",
      problem: "Keep your message to 2,000 characters.",
    });
  });
});

describe("sentMessage", () => {
  it("tells the sender where the poster can reply", () => {
    expect(sentMessage("Lou T.", "jo.ames@example.com")).toBe(
      "Message sent. Lou T. can reply to you at jo.ames@example.com.",
    );
    expect(sentMessage(null, "jo.ames@example.com")).toBe(
      "Message sent. The poster can reply to you at jo.ames@example.com.",
    );
  });
});
