import { describe, expect, it } from "vitest";
import { eventCardProps } from "./cards";
import type { EventOccurrence } from "./load";

const jam: EventOccurrence = {
  key: "jam@2026-12-02T01:00:00.000Z",
  eventId: "jam",
  href: "/events/jam",
  slug: "jam",
  title: "Weekly Open Jam",
  startsAt: "2026-12-02T01:00:00.000Z",
  category: "jam",
  categoryTitle: "Jam",
  repeats: "weekly",
  membersOnly: false,
  locked: false,
  venue: "Riverbend Brewing Co.",
  priceText: "Free",
  memberPrice: null,
};

describe("eventCardProps", () => {
  it("gives the card one date of an event", () => {
    expect(eventCardProps(jam)).toEqual({
      title: "Weekly Open Jam",
      href: "/events/jam",
      startsAt: "2026-12-02T01:00:00.000Z",
      category: "Jam",
      repeats: "weekly",
      membersOnly: false,
      venue: "Riverbend Brewing Co.",
      price: "Free",
      memberPrice: undefined,
    });
  });

  it("leaves out what a locked event doesn't have", () => {
    const social = { ...jam, membersOnly: true, locked: true, venue: null, repeats: null };
    expect(eventCardProps(social)).toMatchObject({
      membersOnly: true,
      venue: undefined,
      repeats: undefined,
    });
  });
});
