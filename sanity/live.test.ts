import { beforeEach, describe, expect, it, vi } from "vitest";

const headers = vi.hoisted(() => ({
  draftMode: vi.fn(),
  cookies: vi.fn(),
}));
vi.mock("next/headers", () => headers);

// next-sanity/live only works in React Server Components, so stand in for it here. The perspective
// resolver reads the cookie the Presentation tool sets when an editor switches perspective.
const live = vi.hoisted(() => ({
  defineLive: () => ({ sanityFetch: () => {}, SanityLive: () => null }),
  resolvePerspectiveFromCookies: vi.fn(),
}));
vi.mock("next-sanity/live", () => live);

const { getDynamicFetchOptions } = await import("./live");

describe("getDynamicFetchOptions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("reads published content, without edit markers, outside draft mode", async () => {
    headers.draftMode.mockResolvedValue({ isEnabled: false });

    await expect(getDynamicFetchOptions()).resolves.toEqual({
      perspective: "published",
      stega: false,
    });
    expect(headers.cookies).not.toHaveBeenCalled();
  });

  it("reads drafts, with edit markers, in draft mode", async () => {
    const jar = { get: () => undefined };
    headers.draftMode.mockResolvedValue({ isEnabled: true });
    headers.cookies.mockResolvedValue(jar);
    live.resolvePerspectiveFromCookies.mockResolvedValue("drafts");

    await expect(getDynamicFetchOptions()).resolves.toEqual({
      perspective: "drafts",
      stega: true,
    });
    expect(live.resolvePerspectiveFromCookies).toHaveBeenCalledWith({ cookies: jar });
  });

  it("follows the perspective an editor picks in the Presentation tool", async () => {
    headers.draftMode.mockResolvedValue({ isEnabled: true });
    headers.cookies.mockResolvedValue({});
    live.resolvePerspectiveFromCookies.mockResolvedValue("published");

    await expect(getDynamicFetchOptions()).resolves.toEqual({
      perspective: "published",
      stega: true,
    });
  });
});
