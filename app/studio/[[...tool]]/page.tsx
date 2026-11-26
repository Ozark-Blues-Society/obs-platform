import type { Metadata } from "next";
import { NextStudio, metadata as studioMetadata } from "next-sanity/studio";
import config from "@/sanity.config";

// The Content Studio, embedded in the site. It has its own sign-in (Sanity accounts), and the root
// layout only. The site's draft-mode tools live in app/(site)/layout.tsx, so they stay out of here.
export const metadata: Metadata = {
  ...studioMetadata,
  title: "Content Studio | Ozark Blues Society",
};

export { viewport } from "next-sanity/studio";

export default function StudioPage() {
  return <NextStudio config={config} />;
}
