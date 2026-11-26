import type { Metadata } from "next";
import { HeroBlock } from "@/components/blocks/hero-block";
import { SponsorStripBlock } from "@/components/blocks/list-blocks";
import { Prose } from "@/components/blocks/prose";
import { PageTemplate } from "@/components/templates/page-template";
import { ButtonLink } from "@/components/ui/button";
import { PlaceholderPhoto } from "@/components/ui/placeholder-photo";
import { PreviewBar } from "../preview-bar";
import { SPONSORS } from "../sample-content";

export const metadata: Metadata = {
  title: "Promo Feature page (design preview) · Ozark Blues Society",
};

/** The Promo Feature template: a big banner and headline, the details, a button and sponsors. */
export default function PromoFeaturePreview() {
  return (
    <>
      <PreviewBar current="promo" />
      <PageTemplate
        title="Blues Challenge 2027: Bands Wanted"
        hero={
          <HeroBlock
            headingLevel={1}
            eyebrow="Applications close January 2"
            heading="Blues Challenge 2027: Bands Wanted"
            text="Bands compete for a spot at the national finals in Memphis. Auditions are on January 16 at Old Mill Music Hall."
            photo={<PlaceholderPhoto tone="brass" />}
            button={{ label: "How to apply", href: "#how-to-apply" }}
          />
        }
      >
        <Prose>
          <h2>How it works</h2>
          <p>
            Each band plays a 20-minute set for a panel of three judges, who score the blues
            content, the musicianship and the stage presence. The winning band represents the
            Society at the national finals.
          </p>
          <h2 id="how-to-apply">How to apply</h2>
          <ul>
            <li>Fill in the application by January 2.</li>
            <li>Include a link to a recent live recording: a phone video is fine.</li>
            <li>We’ll email every band its audition time by January 6.</li>
          </ul>
        </Prose>
        <div>
          <ButtonLink href="https://example.com/apply">Apply to compete</ButtonLink>
        </div>
        <SponsorStripBlock heading="Presented with our sponsors" sponsors={SPONSORS.slice(0, 3)} />
      </PageTemplate>
    </>
  );
}
