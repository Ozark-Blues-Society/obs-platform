import type { Metadata } from "next";
import { HeroBlock } from "@/components/blocks/hero-block";
import { UpcomingEventsBlock } from "@/components/blocks/list-blocks";
import { QuoteBlock, VideoBlock } from "@/components/blocks/media-blocks";
import { Prose } from "@/components/blocks/prose";
import { PageTemplate } from "@/components/templates/page-template";
import { PlaceholderPhoto } from "@/components/ui/placeholder-photo";
import { PreviewBar } from "../preview-bar";
import { UPCOMING_EVENTS } from "../sample-content";

export const metadata: Metadata = {
  title: "Band Spotlight page (design preview) · Ozark Blues Society",
};

/** The Band Spotlight template: a hero photo with the band's name, their story, a video and shows. */
export default function BandSpotlightPreview() {
  return (
    <>
      <PreviewBar current="spotlight" />
      <PageTemplate
        title="Band Spotlight: The Muddy Ridge Trio"
        hero={
          <HeroBlock
            headingLevel={1}
            eyebrow="Band Spotlight"
            heading="The Muddy Ridge Trio"
            text="Three friends, one beat-up Silvertone and a sound that’s pure hill-country. We sat down with the trio before their December show."
            photo={<PlaceholderPhoto tone="rust" />}
          />
        }
      >
        <Prose>
          <p>
            Dale, Rosa and Pete have played together since high school, first in a garage, then at
            every jam that would have them. This year they took second place at the Ozark Blues
            Challenge.
          </p>
          <h2>How did the trio start?</h2>
          <p>
            <strong>Dale:</strong> My uncle left me his old Silvertone and a box of records. Rosa
            lived next door and already played bass, and Pete had a snare drum and a lot of
            patience.
          </p>
          <h2>Who do you listen to?</h2>
          <p>
            <strong>Rosa:</strong> The hill-country players first of all: that one-chord groove that
            just keeps rolling. Then whoever’s on stage at the Friday jam. We learn something every
            week.
          </p>
        </Prose>
        <QuoteBlock
          quote="We play it the way we learned it: loud, and from the heart."
          attribution="Dale Pruitt, guitar and vocals"
        />
        <VideoBlock
          title="The Muddy Ridge Trio live at Old Mill Music Hall"
          caption="Recorded at Fall Fest 2026."
        />
        <UpcomingEventsBlock heading="Upcoming shows" events={UPCOMING_EVENTS} />
      </PageTemplate>
    </>
  );
}
