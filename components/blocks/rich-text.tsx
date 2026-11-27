import Link from "next/link";
import {
  PortableText,
  stegaClean,
  type PortableTextBlock,
  type PortableTextComponents,
} from "next-sanity";
import { blockPhoto, blockVideo } from "@/lib/pages/blocks";
import { safeHref } from "@/lib/site/navigation";
import { VideoBlock } from "./media-blocks";
import { SanityImage } from "./sanity-image";
import { VideoPlayer } from "./video-player";

// Rich text from the Studio (sanity/schemas/objects/rich-text.ts): paragraphs, headings, quotes,
// lists, bold and italic in the elements Prose styles, plus links, photos and videos. A link whose
// address isn't safe shows as plain text, and a photo or video that isn't complete yet, or a kind of
// content this code doesn't know, shows nothing.
const components: PortableTextComponents = {
  marks: {
    link: ({ value, children }) => {
      const href = safeHref(typeof value?.href === "string" ? stegaClean(value.href) : "");
      if (!href) return <>{children}</>;
      return href.startsWith("/") ? (
        <Link href={href}>{children}</Link>
      ) : (
        <a href={href}>{children}</a>
      );
    },
  },
  types: {
    image: ({ value }) => {
      const photo = blockPhoto(value);
      if (!photo) return null;
      // Not trimmed: in a preview the caption ends with invisible edit markers.
      const caption =
        typeof value?.caption === "string" && stegaClean(value.caption).trim() ? value.caption : "";
      return (
        <figure>
          <SanityImage
            photo={photo}
            sizes="(min-width: 48rem) 42rem, 100vw"
            className="h-auto w-full rounded-card"
          />
          {caption && <figcaption>{caption}</figcaption>}
        </figure>
      );
    },
    videoBlock: ({ value }) => {
      const video = blockVideo(value);
      return video ? (
        <VideoBlock
          title={video.title}
          caption={video.caption}
          player={<VideoPlayer embed={video.embed} title={video.title} />}
        />
      ) : null;
    },
  },
  unknownType: () => null,
  unknownMark: ({ children }) => <>{children}</>,
};

/** Rich text: render it inside `<Prose>`, which styles the elements it produces. */
export function RichText({ value }: { value: PortableTextBlock[] }) {
  return <PortableText value={value} components={components} onMissingComponent={false} />;
}
