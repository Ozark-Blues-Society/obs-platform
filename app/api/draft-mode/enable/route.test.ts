// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// A stand-in for next-sanity's handler. The real one checks the secret with Sanity, turns on draft
// mode (the __prerender_bypass cookie) and redirects to the preview page.
const sanity = vi.hoisted(() => ({
  enableDraftMode: vi.fn(
    async () => new Response(null, { status: 307, headers: { Location: "/events" } }),
  ),
}));
vi.mock("next-sanity/draft-mode", () => ({
  defineEnableDraftMode: () => ({ GET: sanity.enableDraftMode }),
}));

const server = vi.hoisted(() => ({ connection: vi.fn(async () => {}) }));
vi.mock("next/server", () => server);

// sanity/live only runs in React Server Components (next-sanity/live), so stand in for it too.
const live = vi.hoisted(() => ({ client: {}, hasReadToken: true }));
vi.mock("@/sanity/live", () => live);

const { GET } = await import("./route");

/** A request like the one a shared preview link makes, for the given preview page. */
function enableRequest(pathname?: string): Request {
  const url = new URL("https://ozarkblues.example/api/draft-mode/enable");
  url.searchParams.set("sanity-preview-secret", "a-shared-secret");
  url.searchParams.set("sanity-preview-perspective", "drafts");
  if (pathname !== undefined) {
    url.searchParams.set("sanity-preview-pathname", pathname);
  }
  return new Request(url);
}

describe("GET /api/draft-mode/enable", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    live.hasReadToken = true;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it.each([
    ["no page (Sanity then opens the home page)", undefined],
    ["the home page", "/"],
    ["a page with a query", "/events?x=1"],
    ["a full URL, of which Sanity keeps only the path", "https://ozarkblues.example/events"],
  ])("passes a request for %s to Sanity's handler unchanged", async (_case, pathname) => {
    const request = enableRequest(pathname);

    const response = await GET(request);

    expect(sanity.enableDraftMode).toHaveBeenCalledExactlyOnceWith(request);
    expect(response.status).toBe(307);
  });

  it.each([
    ["a protocol-relative path", "https://x//evil.example/"],
    ["a protocol-relative path on localhost", "http://localhost//evil.example"],
    ["a dot segment that leaves a protocol-relative path", "/.//evil.example"],
    ["a backslash, which becomes a slash", "https://x/\\evil.example"],
    ["a backslash that another scheme keeps", "x:/\\evil.example"],
    ["another scheme, whose path is a full URL", "x:https://evil.example/login"],
    ["a value that isn't a URL", "http://exa mple.com/"],
  ])("refuses %s with a 400, before draft mode is on", async (_case, pathname) => {
    const response = await GET(enableRequest(pathname));

    expect(response.status).toBe(400);
    // Only Sanity's handler turns on draft mode and sets cookies.
    expect(sanity.enableDraftMode).not.toHaveBeenCalled();
    expect(response.headers.has("set-cookie")).toBe(false);
  });

  it.each([
    ["an ordinary page", "/events"],
    ["a page on another site", "https://x//evil.example/"],
  ])("answers 503 for %s while the read token is missing", async (_case, pathname) => {
    live.hasReadToken = false;
    const error = vi.spyOn(console, "error").mockImplementation(() => {});

    const response = await GET(enableRequest(pathname));

    expect(response.status).toBe(503);
    expect(sanity.enableDraftMode).not.toHaveBeenCalled();
    expect(error).toHaveBeenCalledOnce();
    // Without connection(), Next.js would prerender this 503 at build time.
    expect(server.connection).toHaveBeenCalledOnce();
  });
});
