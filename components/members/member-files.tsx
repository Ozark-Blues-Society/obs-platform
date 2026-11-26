import { stegaClean } from "next-sanity";
import { useId } from "react";
import { Tag } from "@/components/ui/tag";
import { isFileId, memberFilePath } from "@/lib/members/files";

/** One entry of a page's, post's or event's memberFiles, as Sanity returns it. */
export type MemberFileLink = { title?: unknown; fileId?: unknown };

/**
 * The members-only files an editor attached to a page, post or event (backlog M-7). Each link goes
 * to /files/<code>, which checks the member before the download starts, so the list itself holds
 * nothing private beyond the link text. Render it only where the viewer may see the item: inside
 * the item's members-only `content` (sanity/content).
 *
 * Plain links, not next/link: prefetching them would ask Storage for download links nobody
 * clicked.
 */
export function MemberFiles({
  files,
  headingLevel = 2,
}: {
  files: readonly MemberFileLink[] | null | undefined;
  headingLevel?: 2 | 3;
}) {
  const headingId = useId();
  const listed = new Set<string>();
  const links = (files ?? []).flatMap((file) => {
    // In a preview, text carries invisible edit markers: clean the code before using it.
    const id = typeof file.fileId === "string" ? stegaClean(file.fileId).trim() : "";
    const title =
      typeof file.title === "string" && stegaClean(file.title).trim() !== "" ? file.title : "";
    // A file attached twice is listed once, under its first link text.
    if (!isFileId(id) || !title || listed.has(id)) return [];
    listed.add(id);
    return [{ id, title }];
  });
  if (links.length === 0) return null;

  const Heading = headingLevel === 3 ? "h3" : "h2";
  return (
    <section aria-labelledby={headingId} className="mt-10">
      <Heading id={headingId} className="text-h3">
        Files for members
      </Heading>
      <ul className="mt-3 grid gap-2">
        {links.map(({ id, title }) => (
          <li key={id} className="flex flex-wrap items-center gap-2">
            <a href={memberFilePath(id)} className="font-semibold">
              {title}
            </a>
            <Tag tone="accent">Members only</Tag>
          </li>
        ))}
      </ul>
    </section>
  );
}
