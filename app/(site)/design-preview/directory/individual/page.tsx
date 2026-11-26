import type { Metadata } from "next";
import { DirectoryPreview } from "../directory-preview";

export const metadata: Metadata = {
  title: "Directory page, Individual member (design preview) · Ozark Blues Society",
};

/** The Directory template as an Individual member sees it: the venues without booking contacts. */
export default function DirectoryIndividualPreview() {
  return <DirectoryPreview view="individual" />;
}
