import { Image } from "next-sanity/image";
import type { BlockPhoto } from "@/lib/pages/blocks";
import { dataset, projectId } from "@/sanity/env";

type SanityImageProps = {
  photo: BlockPhoto;
  /** How wide the image shows at each screen width, so phones get a smaller file. */
  sizes: string;
  /** Fill the parent (which sets the size), cropped around the editor's focal point. */
  fill?: boolean;
  /** Load it first: the page's main photo, such as the opening hero's. */
  preload?: boolean;
  className?: string;
};

/**
 * A photo from the Studio, served by Sanity's image CDN at the size each screen needs, with the
 * crop and focal point the editor set. Sanity serves uploaded images publicly by URL, so only
 * photos are uploaded to the Studio, never private files (decision 0001).
 */
export function SanityImage({ photo, sizes, fill = false, preload, className }: SanityImageProps) {
  return (
    <Image
      src={photo.image}
      alt={photo.alt}
      projectId={projectId}
      dataset={dataset}
      sizes={sizes}
      fill={fill}
      preload={preload}
      className={className}
    />
  );
}
