import type { Metadata } from "next";
import Link from "next/link";
import { ImageBlock } from "@/components/blocks/media-blocks";
import { Prose } from "@/components/blocks/prose";
import { PageTemplate } from "@/components/templates/page-template";
import { ButtonLink } from "@/components/ui/button";
import { PlaceholderPhoto } from "@/components/ui/placeholder-photo";
import { JOIN_PATH } from "@/lib/site/navigation";
import { EVENTS_PATH } from "@/sanity/paths";
import { PreviewBar } from "../preview-bar";

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
          <p>
            Placeholder mission statement: to preserve, promote and celebrate blues music in the
            Ozarks through live performance, education and community.
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
          image={<PlaceholderPhoto tone="green" label="Placeholder photo: a band on stage" />}
          caption="The Friday Blues Jam at The Riverside Tap. (Placeholder photo.)"
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
