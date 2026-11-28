import Image, { type StaticImageData } from "next/image";
import type { BandSponsor } from "@/components/home/sponsor-band";
import type { SampleSponsor } from "./sample-content";

type SamplePhotoProps = {
  src: StaticImageData;
  /** What the photo shows, for screen readers. Leave it empty where the photo is decoration. */
  alt?: string;
  /** How wide it shows at each screen width, so phones get a smaller file. */
  sizes: string;
  /** Load it first: the photo of the hero that opens the page. */
  preload?: boolean;
};

/** One of the Society's photos, filling its frame and cropped to fit. */
export function SamplePhoto({ src, alt = "", sizes, preload }: SamplePhotoProps) {
  return (
    <Image src={src} alt={alt} fill sizes={sizes} preload={preload} className="object-cover" />
  );
}

/** A sample sponsor as the sponsor components take it: its logo 40px high, its name as alt text. */
export function bandSponsor({ name, logo }: SampleSponsor): BandSponsor {
  return {
    name,
    logo: logo && (
      <Image
        src={logo.src}
        alt={name}
        width={logo.width}
        height={logo.height}
        sizes="10rem"
        className="h-10 w-auto"
      />
    ),
  };
}
