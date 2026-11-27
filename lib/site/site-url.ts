import { requireEnv } from "@/lib/env/schema";
import { serverEnv } from "@/lib/env/server";

/**
 * The site's own address, from SITE_URL, such as https://example.org: links in an email must be
 * absolute. Throws an EnvError when SITE_URL isn't set or isn't a web address.
 */
export function siteUrl(): string {
  const value = requireEnv(
    serverEnv("SITE_URL"),
    "SITE_URL",
    "links in emails need the site's address, such as https://<Society domain>.",
  );
  return new URL(value).origin;
}
