import type { Metadata } from "next";
import { DirectoryPreview } from "./directory-preview";

export const metadata: Metadata = {
  title: "Directory page (design preview) · Ozark Blues Society",
};

/** The Directory template as a Band, Business or Sponsor member sees it: booking contacts too. */
export default function DirectoryContactsPreview() {
  return <DirectoryPreview view="contacts" />;
}
