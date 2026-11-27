import type { VideoEmbed } from "@/lib/pages/video";

/**
 * A YouTube, Vimeo or Bandcamp player filling the video block's frame. `title` names it for screen
 * readers. It loads only when scrolled near, and YouTube's and Vimeo's players are their
 * privacy-respecting ones (lib/pages/video.ts).
 */
export function VideoPlayer({ embed, title }: { embed: VideoEmbed; title: string }) {
  return (
    <iframe
      src={embed.src}
      title={title}
      loading="lazy"
      allow="autoplay; encrypted-media; fullscreen; picture-in-picture"
      allowFullScreen
      referrerPolicy="strict-origin-when-cross-origin"
      className="absolute inset-0 size-full border-0"
    />
  );
}
