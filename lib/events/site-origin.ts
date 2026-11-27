import { siteUrl } from "@/lib/site/site-url";

/**
 * The site's address for the links in a calendar file: SITE_URL, or else the address the request
 * came to (a local server or a preview without SITE_URL).
 */
export function siteOrigin(request: Request): string {
  try {
    return siteUrl();
  } catch {
    return new URL(request.url).origin;
  }
}
