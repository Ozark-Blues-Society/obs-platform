// One date of an event as an event card shows it (components/ui/event-card.tsx), for the calendar
// and the blocks that list upcoming events.
import type { ComponentProps } from "react";
import type { EventCard } from "@/components/ui/event-card";
import type { EventOccurrence } from "./load";

export type EventCardProps = Omit<ComponentProps<typeof EventCard>, "headingLevel">;

/**
 * EventCard's props for one date of an event. The venue comes only if the viewer may see it: for
 * a locked event the card says the place is for members, as the event page does.
 */
export function eventCardProps(occurrence: EventOccurrence): EventCardProps {
  return {
    title: occurrence.title,
    href: occurrence.href,
    startsAt: occurrence.startsAt,
    category: occurrence.categoryTitle ?? undefined,
    repeats: occurrence.repeats ?? undefined,
    membersOnly: occurrence.membersOnly,
    venue: occurrence.locked ? "Location visible to members" : (occurrence.venue ?? undefined),
    price: occurrence.priceText ?? undefined,
    memberPrice: occurrence.memberPrice ?? undefined,
  };
}
