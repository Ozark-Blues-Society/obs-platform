// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  BODY_MAX_LENGTH,
  LISTING_CATEGORIES,
  LISTING_MESSAGES,
  MAX_PHOTO_BYTES,
  PHOTO_TYPES,
  TITLE_MAX_LENGTH,
  checkListing,
  checkPhoto,
  isOwnPhotoPath,
  parsePrice,
  photoPathFor,
} from "./listing-state";

const USER_ID = "00000000-0000-4000-8100-000000000017";
const OTHER_ID = "00000000-0000-4000-8100-000000000018";
const PHOTO_ID = "3f2b9c1e-8d4a-4e6f-9b2c-7a1d5e8f0c3b";

const DRAFT = {
  category: "gear",
  title: "  Tweed-style   amp ",
  body: "Hand-wired.\r\nLocal pickup only.\n",
  price: "$1,200.50",
  contactPref: "email",
};

describe("LISTING_CATEGORIES", () => {
  it("lists the board's five categories, every level posts in all of them", () => {
    expect(LISTING_CATEGORIES.map((category) => category.title)).toEqual([
      "Musicians Wanted",
      "Gear",
      "Merch",
      "Street Team",
      "Member Connect",
    ]);
  });
});

describe("parsePrice", () => {
  it("reads dollars as people type them", () => {
    expect(parsePrice("650")).toEqual({ price: 650 });
    expect(parsePrice(" $1,200 ")).toEqual({ price: 1200 });
    expect(parsePrice("$ 19.99")).toEqual({ price: 19.99 });
    expect(parsePrice("0")).toEqual({ price: 0 });
    expect(parsePrice("999999.99")).toEqual({ price: 999999.99 });
  });

  it("takes a blank price as nothing for sale", () => {
    expect(parsePrice("")).toEqual({ price: null });
    expect(parsePrice("   ")).toEqual({ price: null });
    expect(parsePrice(undefined)).toEqual({ price: null });
  });

  it("refuses anything that isn't an amount of dollars and cents the table can keep", () => {
    for (const value of ["-5", "free", "12.345", "1e3", "$", "12 dollars", "0x10"]) {
      expect(parsePrice(value), value).toEqual({ problem: LISTING_MESSAGES.priceInvalid });
    }
    expect(parsePrice("1000000")).toEqual({ problem: LISTING_MESSAGES.priceTooHigh });
  });
});

describe("checkListing", () => {
  it("tidies a listing: the title on one line, plain line breaks, both trimmed", () => {
    expect(checkListing(DRAFT, null)).toEqual({
      listing: {
        category: "gear",
        title: "Tweed-style amp",
        body: "Hand-wired.\nLocal pickup only.",
        price: 1200.5,
        contactPref: "email",
      },
    });
  });

  it("names the first field to fix, in the form's order", () => {
    expect(checkListing({ ...DRAFT, category: "lessons", title: "" }, null)).toEqual({
      field: "category",
      message: LISTING_MESSAGES.categoryMissing,
    });
    expect(checkListing({ ...DRAFT, title: "   " }, null)).toEqual({
      field: "title",
      message: LISTING_MESSAGES.titleMissing,
    });
    expect(checkListing({ ...DRAFT, title: "x".repeat(TITLE_MAX_LENGTH + 1) }, null)).toEqual({
      field: "title",
      message: LISTING_MESSAGES.titleTooLong,
    });
    expect(checkListing({ ...DRAFT, body: "\n \n" }, null)).toEqual({
      field: "body",
      message: LISTING_MESSAGES.bodyMissing,
    });
    expect(checkListing({ ...DRAFT, body: "x".repeat(BODY_MAX_LENGTH + 1) }, null)).toEqual({
      field: "body",
      message: LISTING_MESSAGES.bodyTooLong,
    });
    expect(checkListing({ ...DRAFT, price: "cheap" }, null)).toEqual({
      field: "price",
      message: LISTING_MESSAGES.priceInvalid,
    });
    expect(checkListing({ ...DRAFT, contactPref: "" }, null)).toEqual({
      field: "contactPref",
      message: LISTING_MESSAGES.contactMissing,
    });
  });

  it("keeps a title and details of exactly the most characters allowed", () => {
    const checked = checkListing(
      { ...DRAFT, title: "x".repeat(TITLE_MAX_LENGTH), body: "y".repeat(BODY_MAX_LENGTH) },
      null,
    );
    expect("listing" in checked).toBe(true);
  });

  it("offers phone contact only to a member whose profile has a phone number", () => {
    expect(checkListing({ ...DRAFT, contactPref: "phone" }, null)).toEqual({
      field: "contactPref",
      message: LISTING_MESSAGES.phoneMissing,
    });
    expect(checkListing({ ...DRAFT, contactPref: "phone" }, "(479) 555-0117")).toMatchObject({
      listing: { contactPref: "phone" },
    });
  });

  it("refuses values that aren't text, as a made-up request might send", () => {
    expect(checkListing({ ...DRAFT, title: 42 }, null)).toMatchObject({ field: "title" });
    expect(checkListing({ ...DRAFT, body: ["a"] }, null)).toMatchObject({ field: "body" });
    expect(checkListing({ ...DRAFT, price: 650 }, null)).toMatchObject({
      listing: { price: null },
    });
  });
});

describe("checkPhoto", () => {
  it("takes JPEG, PNG and WebP photos up to 10 MB", () => {
    expect(PHOTO_TYPES).toBe("image/jpeg,image/png,image/webp");
    for (const type of ["image/jpeg", "image/png", "image/webp"]) {
      expect(checkPhoto({ type, size: MAX_PHOTO_BYTES }), type).toBeNull();
    }
  });

  it("refuses other types, empty files and anything over 10 MB", () => {
    for (const type of ["image/gif", "image/heic", "application/pdf", "", "constructor"]) {
      expect(checkPhoto({ type, size: 100 }), type).toBe(LISTING_MESSAGES.photoType);
    }
    expect(checkPhoto({ type: "image/png", size: 0 })).toBe(LISTING_MESSAGES.photoEmpty);
    expect(checkPhoto({ type: "image/png", size: MAX_PHOTO_BYTES + 1 })).toBe(
      LISTING_MESSAGES.photoTooBig,
    );
  });
});

describe("photo paths", () => {
  it("puts a photo in the member's own folder, under a new random name with its type's extension", () => {
    const jpeg = photoPathFor(USER_ID, "image/jpeg");
    expect(jpeg).toMatch(new RegExp(`^${USER_ID}/[0-9a-f-]{36}\\.jpg$`));
    expect(photoPathFor(USER_ID, "image/jpeg")).not.toBe(jpeg);
    expect(photoPathFor(USER_ID, "image/png")).toMatch(/\.png$/);
    expect(photoPathFor(USER_ID, "image/webp")).toMatch(/\.webp$/);
    expect(photoPathFor(USER_ID, "image/gif")).toBeNull();
    expect(photoPathFor(USER_ID, "toString")).toBeNull();
  });

  it("accepts only the member's own photo paths", () => {
    expect(isOwnPhotoPath(USER_ID, photoPathFor(USER_ID, "image/png"))).toBe(true);
    expect(isOwnPhotoPath(USER_ID, `${USER_ID}/${PHOTO_ID}.webp`)).toBe(true);
    expect(isOwnPhotoPath(USER_ID, `${OTHER_ID}/${PHOTO_ID}.jpg`)).toBe(false);
    expect(isOwnPhotoPath(USER_ID, `${USER_ID}/${PHOTO_ID}.gif`)).toBe(false);
    expect(isOwnPhotoPath(USER_ID, `${USER_ID}/../${OTHER_ID}/${PHOTO_ID}.jpg`)).toBe(false);
    expect(isOwnPhotoPath(USER_ID, `${USER_ID}/a/${PHOTO_ID}.jpg`)).toBe(false);
    expect(isOwnPhotoPath(USER_ID, null)).toBe(false);
  });
});
