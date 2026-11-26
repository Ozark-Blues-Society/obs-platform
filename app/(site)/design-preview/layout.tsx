import type { Metadata } from "next";

// The Design Approval package (backlog D-4): sample pages for the Society to review. Search
// engines are asked to leave them out. Remove this folder once the real home page (P-1) and
// pages (C-2) render the approved design from the Studio.
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function DesignPreviewLayout({ children }: LayoutProps<"/design-preview">) {
  return children;
}
