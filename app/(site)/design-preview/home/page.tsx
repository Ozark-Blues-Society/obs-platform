import type { Metadata } from "next";
import { CardSection } from "@/components/home/card-section";
import { HomeHero } from "@/components/home/home-hero";
import { MembershipCta } from "@/components/home/membership-cta";
import { SponsorBand } from "@/components/home/sponsor-band";
import { EventCard } from "@/components/ui/event-card";
import { PostCard } from "@/components/ui/post-card";
import { JOIN_PATH } from "@/lib/site/navigation";
import { BLOG_PATH, EVENTS_PATH } from "@/sanity/paths";
import { PreviewBar } from "../preview-bar";
import {
  FEATURED_SPONSOR,
  LATEST_POSTS,
  LOWEST_DUES,
  NEXT_EVENT,
  PHOTOS,
  SPONSORS,
  UPCOMING_EVENTS,
} from "../sample-content";
import { SamplePhoto, bandSponsor } from "../sample-images";

export const metadata: Metadata = {
  title: "Home (design preview) · Ozark Blues Society",
};

/** The home page's design with sample content (P-1 builds the real one from the Studio). */
export default function HomePreview() {
  return (
    <>
      <PreviewBar current="home" />
      <HomeHero
        eyebrow="Since 19XX · A community nonprofit"
        heading="Live music, local players, and the people who keep the blues alive."
        intro="Concerts, jams, workshops, and a home for Ozarks musicians. Become a member and get discounts, members-only events, and first word on everything we do."
        primaryAction={{ label: "Become a Member", href: JOIN_PATH }}
        secondaryAction={{ label: "See Upcoming Shows", href: EVENTS_PATH }}
        nextEvent={NEXT_EVENT}
        photo={<SamplePhoto src={PHOTOS.trioOnStage} sizes="100vw" preload />}
      />
      <CardSection
        eyebrow="On the calendar"
        title="Upcoming events"
        action={{ label: "Full calendar", href: EVENTS_PATH }}
        className="py-section"
      >
        {UPCOMING_EVENTS.map((event) => (
          <li key={event.href}>
            <EventCard {...event} />
          </li>
        ))}
      </CardSection>
      <CardSection
        eyebrow="From the blog"
        title="News, recaps & band spotlights"
        action={{ label: "All posts", href: BLOG_PATH }}
        className="pb-section"
      >
        {LATEST_POSTS.map(({ cover, ...post }) => (
          <li key={post.href}>
            <PostCard
              {...post}
              cover={
                <SamplePhoto
                  src={cover}
                  sizes="(min-width: 72.5rem) 17rem, (min-width: 40rem) 50vw, 100vw"
                />
              }
            />
          </li>
        ))}
      </CardSection>
      <SponsorBand featured={FEATURED_SPONSOR} sponsors={SPONSORS.map(bandSponsor)} />
      <MembershipCta
        heading={`Membership starts at ${LOWEST_DUES} a year.`}
        text="Members-only events, the monthly newsletter, merchandise discounts, giveaways and more."
        action={{ label: "See membership benefits", href: JOIN_PATH }}
      />
    </>
  );
}
