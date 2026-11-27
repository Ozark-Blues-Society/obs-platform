import { describe, expect, it } from "vitest";
import { videoEmbed } from "./video";

describe("videoEmbed", () => {
  it("plays YouTube links in YouTube's privacy-enhanced player", () => {
    const player = "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ";
    for (const link of [
      "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      "https://youtube.com/watch?v=dQw4w9WgXcQ&t=30s",
      "https://m.youtube.com/watch?v=dQw4w9WgXcQ",
      "https://youtu.be/dQw4w9WgXcQ",
      "https://youtu.be/dQw4w9WgXcQ?si=share-tracking",
      "https://www.youtube.com/shorts/dQw4w9WgXcQ",
      "https://www.youtube.com/live/dQw4w9WgXcQ",
      "https://www.youtube.com/embed/dQw4w9WgXcQ",
      "  https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ  ",
    ]) {
      expect(videoEmbed(link), link).toEqual({ provider: "youtube", src: player });
    }
  });

  it("plays Vimeo links in Vimeo's player with tracking off, keeping an unlisted video's hash", () => {
    expect(videoEmbed("https://vimeo.com/76979871")).toEqual({
      provider: "vimeo",
      src: "https://player.vimeo.com/video/76979871?dnt=1",
    });
    expect(videoEmbed("https://vimeo.com/76979871/abc123def")).toEqual({
      provider: "vimeo",
      src: "https://player.vimeo.com/video/76979871?h=abc123def&dnt=1",
    });
    expect(videoEmbed("https://player.vimeo.com/video/76979871?h=abc123def&autoplay=1")).toEqual({
      provider: "vimeo",
      src: "https://player.vimeo.com/video/76979871?h=abc123def&dnt=1",
    });
    // A hash that isn't one is dropped rather than passed on.
    expect(videoEmbed("https://player.vimeo.com/video/76979871?h=%22x")?.src).toBe(
      "https://player.vimeo.com/video/76979871?dnt=1",
    );
  });

  it("plays a Bandcamp player link as Bandcamp gives it", () => {
    const link =
      "https://bandcamp.com/EmbeddedPlayer/album=1234567890/size=large/bgcol=ffffff/linkcol=0687f5/tracklist=false/artwork=small/transparent=true/";
    expect(videoEmbed(link)).toEqual({ provider: "bandcamp", src: link });
  });

  it("refuses links it can't embed, so an <iframe> only ever shows these three players", () => {
    for (const link of [
      "",
      "not a link",
      "http://www.youtube.com/watch?v=dQw4w9WgXcQ",
      "https://www.youtube.com/watch",
      "https://www.youtube.com/watch?v=abc",
      "https://www.youtube.com/watch?v=dQw4w9WgXcQ%22onload",
      "https://www.youtube.com/@ozarkblues",
      "https://youtube.com.example.com/watch?v=dQw4w9WgXcQ",
      "https://vimeo.com/channels/staffpicks",
      "https://player.vimeo.com/video/abc",
      "https://example.bandcamp.com/album/live-at-old-mill",
      "https://bandcamp.com/EmbeddedPlayer/album=1/%22%3E%3Cscript%3E/",
      "javascript:alert(1)",
    ]) {
      expect(videoEmbed(link), link).toBeNull();
    }
  });
});
