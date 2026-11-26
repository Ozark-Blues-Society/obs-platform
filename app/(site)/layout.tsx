import { draftMode } from "next/headers";
import { isConfigured } from "@/sanity/env";
import { SanityLive } from "@/sanity/live";
import { PreviewBanner } from "./draft-mode/preview-banner";
import { PreviewVisualEditing } from "./draft-mode/visual-editing";

// Layout for the public site. The Studio (app/studio) sits outside this group, so none of this
// renders inside it. D-2 adds the header and footer here.
export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  // Draft mode is on only for live preview in the Studio and for shared preview links.
  const { isEnabled: isDraftMode } = await draftMode();

  return (
    <>
      {isDraftMode && <PreviewBanner />}
      {children}
      {/* Keeps cached Sanity content fresh when editors publish. Needs a real project. */}
      {isConfigured && <SanityLive includeDrafts={isDraftMode} />}
      {isDraftMode && <PreviewVisualEditing />}
    </>
  );
}
