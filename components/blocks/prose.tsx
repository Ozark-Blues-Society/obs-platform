import type { ReactNode } from "react";
import { cx } from "@/lib/cx";

// Styles for the elements rich text produces (the text block's headings, paragraphs, lists,
// links, quotes and inline photos), so editors' text needs no classes of its own.
const PROSE = [
  "max-w-prose",
  "[&>*+*]:mt-4",
  "[&>h2]:mt-10 [&>h3]:mt-8",
  "[&_ul]:list-disc [&_ol]:list-decimal [&_ul]:pl-5 [&_ol]:pl-5 [&_li+li]:mt-1.5",
  "[&_blockquote]:border-l-3 [&_blockquote]:border-line-strong [&_blockquote]:pl-4 [&_blockquote]:italic",
  "[&_figcaption]:mt-2 [&_figcaption]:text-small [&_figcaption]:text-muted",
  "[&_strong]:font-semibold",
].join(" ");

/** Rich text: the text block's content, in the Society's type. */
export function Prose({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cx(PROSE, className)}>{children}</div>;
}
