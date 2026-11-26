// Tells the Studio's Presentation tool which document a site page shows (mainDocuments), and
// where on the site a document appears (locations), so the preview and the editor stay in step.
// The detail routes arrive with C-2 (pages), P-2 (events) and P-3 (blog).
import {
  defineDocuments,
  defineLocations,
  type DocumentLocation,
  type PresentationPluginOptions,
} from "sanity/presentation";
import { BLOG_PATH, EVENTS_PATH, eventPath, pagePath, postPath } from "./paths";

type Selected = { title?: string; slug?: string } | null;

function locations(untitled: string, path: (slug: string) => string, listing?: DocumentLocation) {
  return defineLocations({
    select: { title: "title", slug: "slug.current" },
    resolve: (doc: Selected) => ({
      locations: [
        ...(doc?.slug ? [{ title: doc.title || untitled, href: path(doc.slug) }] : []),
        ...(listing ? [listing] : []),
      ],
    }),
  });
}

export const resolve: NonNullable<PresentationPluginOptions["resolve"]> = {
  mainDocuments: defineDocuments([
    { route: `${BLOG_PATH}/:slug`, filter: `_type == "post" && slug.current == $slug` },
    { route: `${EVENTS_PATH}/:slug`, filter: `_type == "event" && slug.current == $slug` },
    { route: "/:slug", filter: `_type == "page" && slug.current == $slug` },
  ]),
  locations: {
    page: locations("Untitled page", pagePath),
    post: locations("Untitled post", postPath, { title: "Blog", href: BLOG_PATH }),
    event: locations("Untitled event", eventPath, { title: "Events calendar", href: EVENTS_PATH }),
  },
};
