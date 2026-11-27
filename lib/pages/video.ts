// The video and Bandcamp players that page blocks and rich text embed (backlog C-2): which links the
// site can play, and the player's address for each. The Studio's check on a video link
// (videoUrlRule in sanity/schemas/validation.ts) uses the same rules, so editors can only save a
// link that plays here. No server code, so the Studio, pages and tests share it.

export type VideoProvider = "youtube" | "vimeo" | "bandcamp";

/** A player for an `<iframe>`: who serves it, and its address. */
export type VideoEmbed = { provider: VideoProvider; src: string };

const YOUTUBE_ID = /^[\w-]{6,}$/;

// YouTube's privacy-enhanced mode: no cookies until the visitor plays the video.
function youtube(id: string | null | undefined): VideoEmbed | null {
  return id && YOUTUBE_ID.test(id)
    ? { provider: "youtube", src: `https://www.youtube-nocookie.com/embed/${id}` }
    : null;
}

// dnt=1 asks Vimeo not to track the visitor. An unlisted video needs its hash (h).
function vimeo(id: string, hash: string | null | undefined): VideoEmbed {
  const params = new URLSearchParams(hash && /^\w+$/.test(hash) ? { h: hash } : {});
  params.set("dnt", "1");
  return { provider: "vimeo", src: `https://player.vimeo.com/video/${id}?${params}` };
}

/**
 * The player for a YouTube or Vimeo link, or a Bandcamp player link (the one inside Bandcamp's
 * Share / Embed code), or null if the site can't embed it. Only https links, and the player's
 * address is built from the video's id, never copied from the link, so an `<iframe>` can only
 * ever show one of these three players.
 */
export function videoEmbed(link: string): VideoEmbed | null {
  let url: URL;
  try {
    url = new URL(link.trim());
  } catch {
    return null;
  }
  if (url.protocol !== "https:") return null;
  const host = url.hostname.replace(/^(www|m)\./, "");
  const path = url.pathname;
  if (host === "youtu.be") return youtube(/^\/([\w-]+)$/.exec(path)?.[1]);
  if (host === "youtube.com" || host === "youtube-nocookie.com") {
    if (path === "/watch") return youtube(url.searchParams.get("v"));
    return youtube(/^\/(?:embed|shorts|live)\/([\w-]+)$/.exec(path)?.[1]);
  }
  if (host === "vimeo.com") {
    const match = /^\/(\d+)(?:\/(\w+))?$/.exec(path);
    return match ? vimeo(match[1], match[2]) : null;
  }
  if (host === "player.vimeo.com") {
    const match = /^\/video\/(\d+)$/.exec(path);
    return match ? vimeo(match[1], url.searchParams.get("h")) : null;
  }
  // The player's settings are in its path, such as /EmbeddedPlayer/album=123/size=large/.
  if (host === "bandcamp.com" && /^\/EmbeddedPlayer\/[\w=/,.-]*$/.test(path)) {
    return { provider: "bandcamp", src: `https://bandcamp.com${path}` };
  }
  return null;
}
