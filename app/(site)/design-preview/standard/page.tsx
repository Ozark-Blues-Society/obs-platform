import type { Metadata } from "next";
import Link from "next/link";
import { ImageBlock } from "@/components/blocks/media-blocks";
import { Prose } from "@/components/blocks/prose";
import { PageTemplate } from "@/components/templates/page-template";
import { ButtonLink } from "@/components/ui/button";
import { JOIN_PATH } from "@/lib/site/navigation";
import { EVENTS_PATH } from "@/sanity/paths";
import { PreviewBar } from "../preview-bar";
import { PHOTO_CREDIT, PHOTOS } from "../sample-content";
import { SamplePhoto } from "../sample-images";

export const metadata: Metadata = {
  title: "Standard page (design preview) · Ozark Blues Society",
};

/** The Standard template: a title, text and photos, and an optional button. */
export default function StandardPreview() {
  return (
    <>
      <PreviewBar current="standard" />
      <PageTemplate
        title="About the Society"
        intro="Who we are, what we do, and how to get involved."
      >
        <Prose>
          <h2>Our mission</h2>
          {/* The Society's own words, from its current website. */}
          <p>
            The Ozark Blues Society is dedicated to preserving and promoting the rich heritage of
            blues music. Through education and community outreach, we aim to inspire a new
            generation of blues artists and enthusiasts.
          </p>
          <h2>What we do</h2>
          <ul>
            <li>
              Jams and concerts with local and touring players, all year round (see the{" "}
              <Link href={EVENTS_PATH}>events calendar</Link>).
            </li>
            <li>Blues in the Schools: free programs that bring the music into classrooms.</li>
            <li>The Ozark Blues Challenge, which sends a local band to the national finals.</li>
          </ul>
        </Prose>
        <ImageBlock
          image={
            <SamplePhoto
              src={PHOTOS.festivalStage}
              alt="A band on an outdoor festival stage"
              sizes="(min-width: 48rem) 48rem, 100vw"
            />
          }
          caption={`On stage at an outdoor festival. ${PHOTO_CREDIT}.`}
        />
        <Prose>
          <h2>Get involved</h2>
          <p>
            Members keep the Society going. Volunteers run the door and the merchandise table, take
            photos, help with Blues in the Schools and set up for the festivals. However much time
            you have, there’s a place for you.
          </p>
        </Prose>
        <div>
          <ButtonLink href={JOIN_PATH}>Become a member</ButtonLink>
        </div>
      </PageTemplate>
    </>
  );
}
