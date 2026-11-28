import type { Metadata } from "next";
import Link from "next/link";
import { Prose } from "@/components/blocks/prose";
import { PageTemplate } from "@/components/templates/page-template";
import { Card } from "@/components/ui/card";
import { CardGrid } from "@/components/ui/card-grid";
import { cardLinkClasses } from "@/components/ui/card-link";
import { PreviewBar } from "./preview-bar";
import { DIRECTORY_VIEWS, PREVIEW_PAGES } from "./sample-content";

export const metadata: Metadata = {
  title: "Design preview · Ozark Blues Society",
};

const PAGES = [
  {
    ...PREVIEW_PAGES.home,
    title: "Home page",
    about:
      "The next event, upcoming events, the latest blog posts, the featured sponsor and the call to join.",
  },
  {
    ...PREVIEW_PAGES.standard,
    title: "Standard page",
    about: "Most pages, such as About: a title, text and photos, and a button.",
  },
  {
    ...PREVIEW_PAGES.directory,
    title: "Directory page",
    about:
      "Lists such as the members-only venue directory: a table people can search. See it as each kind of visitor below.",
  },
  {
    ...PREVIEW_PAGES.spotlight,
    title: "Band Spotlight page",
    about: "Profiles: a hero photo with the band's name, their story, a quote, a video and shows.",
  },
  {
    ...PREVIEW_PAGES.promo,
    title: "Promo Feature page",
    about: "Campaigns: a big banner and headline, the details, a button and the sponsors.",
  },
];

/** The Design Approval package's front page: what it holds and how to review it. */
export default function DesignPreviewOverview() {
  return (
    <>
      <PreviewBar current="overview" />
      <PageTemplate
        title="Design preview"
        intro="The home page and the four page templates, filled with sample content, for the Society to review and approve."
      >
        <Prose>
          <h2>How to review</h2>
          <ul>
            <li>Open each page on a phone and on a computer.</li>
            <li>
              The events, posts, people and venues are made up. The logo, the colors, the photos and
              the sponsors are the Society’s own, from its current website, until the board sends
              its own files.
            </li>
            <li>
              Links to pages that aren’t built yet, such as the events calendar, lead to a “page not
              found” page.
            </li>
          </ul>
        </Prose>
        <CardGrid>
          {PAGES.map((page) => (
            <li key={page.href}>
              <Card as="article" className="relative h-full p-5">
                <h2 className="text-h3">
                  <Link href={page.href} className={cardLinkClasses}>
                    {page.title}
                  </Link>
                </h2>
                <p className="mt-2 text-small text-muted">{page.about}</p>
              </Card>
            </li>
          ))}
        </CardGrid>
        <Prose>
          <h2>The Directory page, three ways</h2>
          <ul>
            <li>
              <Link href={DIRECTORY_VIEWS.contacts.href}>
                As a Band, Business or Sponsor member
              </Link>
              : every venue, with booking contacts.
            </li>
            <li>
              <Link href={DIRECTORY_VIEWS.individual.href}>As an Individual member</Link>: the
              venues, without booking contacts.
            </li>
            <li>
              <Link href={DIRECTORY_VIEWS.visitor.href}>As a visitor</Link>: the title and a lock,
              with none of the content.
            </li>
          </ul>
        </Prose>
      </PageTemplate>
    </>
  );
}
