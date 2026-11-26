import type { Metadata } from "next";
import { DirectoryPreview } from "../directory-preview";

export const metadata: Metadata = {
  title: "Directory page, visitor (design preview) · Ozark Blues Society",
};

/** The Directory template as a visitor sees it: the page's title and a lock, none of the content. */
export default function DirectoryVisitorPreview() {
  return <DirectoryPreview view="visitor" />;
}
