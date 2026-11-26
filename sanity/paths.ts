// Where each kind of Sanity document lives on the site. The slug fields' descriptions, the
// Presentation tool (sanity/presentation.ts) and the site's routes (C-2, P-2, P-3) use these.

export const pagePath = (slug: string) => `/${slug}`;
export const postPath = (slug: string) => `/blog/${slug}`;
export const eventPath = (slug: string) => `/events/${slug}`;

export const BLOG_PATH = "/blog";
export const EVENTS_PATH = "/events";
