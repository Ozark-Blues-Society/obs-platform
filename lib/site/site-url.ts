/**
 * The site's own address, from SITE_URL, such as https://example.org: links in an email must be
 * absolute. Throws when SITE_URL isn't a web address.
 */
export function siteUrl(): string {
  const value = process.env.SITE_URL;
  const url = value ? URL.parse(value) : null;
  if (!url || (url.protocol !== "https:" && url.protocol !== "http:")) {
    throw new Error("SITE_URL must be the site's address, such as https://<Society domain>.");
  }
  return url.origin;
}
