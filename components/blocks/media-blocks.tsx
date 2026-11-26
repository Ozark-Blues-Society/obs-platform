import type { ReactNode } from "react";

type ImageBlockProps = {
  /** The photo, filling a 16:9 frame (for example `next/image` with `fill` and `object-cover`). */
  image: ReactNode;
  caption?: string;
};

/** The photo block: a wide photo with an optional caption. */
export function ImageBlock({ image, caption }: ImageBlockProps) {
  return (
    <figure className="max-w-3xl">
      <div className="relative aspect-video overflow-hidden rounded-card bg-muted-soft">
        {image}
      </div>
      {caption && <figcaption className="mt-2 text-small text-muted">{caption}</figcaption>}
    </figure>
  );
}

type VideoBlockProps = {
  /** What the video is, for screen readers: "The Muddy Ridge Trio live at Old Mill". */
  title: string;
  caption?: string;
  /**
   * The player: a YouTube, Vimeo or Bandcamp `<iframe>` titled with `title`, filling the frame.
   * Without one, a placeholder frame shows where the player goes.
   */
  player?: ReactNode;
};

/** The video block: a video or Bandcamp player in a 16:9 frame, with an optional caption. */
export function VideoBlock({ title, caption, player }: VideoBlockProps) {
  return (
    <figure className="max-w-3xl">
      <div className="relative aspect-video overflow-hidden rounded-card bg-primary-dark">
        {player ?? (
          <div
            role="img"
            aria-label={`Video placeholder: ${title}`}
            className="flex size-full flex-col items-center justify-center gap-3 p-4 text-center text-white"
          >
            <svg aria-hidden="true" viewBox="0 0 64 64" className="size-16">
              <circle
                cx="32"
                cy="32"
                r="30"
                className="fill-white/10 stroke-white"
                strokeWidth="2"
              />
              <path d="M26 20 L46 32 L26 44 Z" className="fill-white" />
            </svg>
            <span className="text-small text-muted-on-dark">{title}</span>
          </div>
        )}
      </div>
      {caption && <figcaption className="mt-2 text-small text-muted">{caption}</figcaption>}
    </figure>
  );
}

type QuoteBlockProps = {
  /** The words, without quotation marks. */
  quote: string;
  /** Who said it: "Lou Tate, harmonica". */
  attribution?: string;
};

/** The pull quote block: a few words in large type, with a brass rule. */
export function QuoteBlock({ quote, attribution }: QuoteBlockProps) {
  return (
    <figure className="max-w-prose border-l-3 border-accent py-1 pl-5">
      <blockquote className="font-serif text-[1.625rem] leading-snug">
        <p>&ldquo;{quote}&rdquo;</p>
      </blockquote>
      {attribution && (
        <figcaption className="mt-2 text-small text-muted">&mdash; {attribution}</figcaption>
      )}
    </figure>
  );
}
