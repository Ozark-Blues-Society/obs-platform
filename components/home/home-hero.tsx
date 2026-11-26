import { useId, type ReactNode } from "react";
import { ButtonLink } from "@/components/ui/button";
import { eventDateParts } from "@/lib/society-time";

export type HeroLink = { label: string; href: string };

export type NextUpEvent = {
  title: string;
  /** The event's page. */
  href: string;
  /** When it starts (an ISO date-time), shown in the Society's time zone. */
  startsAt: string | Date;
  /** The venue's name. Leave it out where the viewer may not see it (a members-only event). */
  venue?: string;
};

type HomeHeroProps = {
  /** The page's level-1 heading. */
  heading: string;
  /** A short label above the heading. */
  eyebrow?: string;
  /** A sentence or two under the heading. */
  intro?: string;
  /** The main call to action (brass), and an optional second one (outlined). */
  primaryAction: HeroLink;
  secondaryAction?: HeroLink;
  /** The soonest event, in the "Next up" panel. */
  nextEvent?: NextUpEvent;
  /** A photo behind the hero, shown faintly (for example `next/image` with `fill`). */
  photo?: ReactNode;
};

/** The top of the home page: the Society's headline, two calls to action and the next event. */
export function HomeHero({
  heading,
  eyebrow,
  intro,
  primaryAction,
  secondaryAction,
  nextEvent,
  photo,
}: HomeHeroProps) {
  return (
    <div className="relative isolate overflow-hidden bg-primary-dark text-white">
      {photo && (
        <div aria-hidden="true" className="absolute inset-0 -z-10 opacity-30">
          {photo}
        </div>
      )}
      {/* Keeps the text readable over a bright photo: the side with the text stays darkest. */}
      <div className="absolute inset-0 -z-10 bg-linear-to-b from-primary-dark/70 to-primary-dark/20 md:bg-linear-to-r" />
      <div className="mx-auto grid max-w-site items-center gap-10 px-gutter py-16 md:grid-cols-[1.3fr_1fr]">
        <div>
          {eyebrow && <p className="text-eyebrow text-accent uppercase">{eyebrow}</p>}
          <h1 className="mt-2">{heading}</h1>
          {intro && <p className="mt-4 max-w-xl text-lead text-muted-on-dark">{intro}</p>}
          <div className="mt-6 flex flex-wrap gap-2.5">
            <ButtonLink href={primaryAction.href}>{primaryAction.label}</ButtonLink>
            {secondaryAction && (
              <ButtonLink href={secondaryAction.href} variant="ghost">
                {secondaryAction.label}
              </ButtonLink>
            )}
          </div>
        </div>
        {nextEvent && <NextUp event={nextEvent} />}
      </div>
    </div>
  );
}

function NextUp({ event }: { event: NextUpEvent }) {
  const headingId = useId();
  const { iso, month, day, time } = eventDateParts(event.startsAt);
  return (
    <section
      aria-labelledby={headingId}
      className="rounded-panel border border-accent-light/35 bg-white/6 p-5.5"
    >
      <h2 id={headingId} className="font-sans text-eyebrow text-accent uppercase">
        Next up
      </h2>
      <div className="my-3 flex items-center gap-4">
        <time
          dateTime={iso}
          className="flex flex-none flex-col font-serif text-[2.75rem] leading-none text-accent-light"
        >
          <span>{month}</span>
          <span>{day}</span>
        </time>
        <div className="min-w-0">
          <h3 className="text-white">{event.title}</h3>
          <p className="mt-1 text-small text-muted-on-dark">
            {[event.venue, time].filter(Boolean).join(" · ")}
          </p>
        </div>
      </div>
      <ButtonLink href={event.href} size="sm">
        Details<span className="sr-only">: {event.title}</span>
      </ButtonLink>
    </section>
  );
}
