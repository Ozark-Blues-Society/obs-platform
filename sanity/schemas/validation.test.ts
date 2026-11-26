// @vitest-environment node
import type { ValidationContext } from "sanity";
import { describe, expect, it, vi } from "vitest";
import {
  OTHER_FEATURED_SPONSORS_QUERY,
  dateInSocietyTimeZone,
  featuredSponsorRule,
  hrefRule,
  imageAltRule,
  linkRule,
  recurrenceUntilRule,
  slugRule,
  spotlightTextRule,
  tableColumnsRule,
  tableRowsRule,
  videoProvider,
  videoUrlRule,
  visibilityLevelsRule,
} from "./validation";

/** The parts of Sanity's validation context the rules read. */
function context(parts: {
  parent?: unknown;
  document?: Record<string, unknown>;
  fetch?: (query: string, params: Record<string, unknown>) => unknown;
}) {
  const fetch = vi.fn(async (query: string, params: Record<string, unknown>) =>
    parts.fetch ? parts.fetch(query, params) : [],
  );
  const getClient = vi.fn(() => ({ fetch }));
  const ctx = { parent: parts.parent, document: parts.document, getClient };
  return { ctx: ctx as unknown as ValidationContext, fetch, getClient };
}

describe("dateInSocietyTimeZone", () => {
  it("gives the calendar date in Central Time", () => {
    // 7 p.m. on December 3 in Central (standard) time is already December 4 in UTC.
    expect(dateInSocietyTimeZone("2026-12-04T01:00:00Z")).toBe("2026-12-03");
    // Daylight saving time: UTC−5.
    expect(dateInSocietyTimeZone("2026-07-01T04:59:00Z")).toBe("2026-06-30");
    expect(dateInSocietyTimeZone("2026-07-01T05:00:00Z")).toBe("2026-07-01");
  });

  it("returns undefined for something that isn't a date", () => {
    expect(dateInSocietyTimeZone("not a date")).toBeUndefined();
  });
});

describe("recurrenceUntilRule", () => {
  const start = "2026-12-04T01:00:00Z"; // Thursday December 3, 7 p.m. Central

  it("ignores the last date when the event doesn't repeat", () => {
    expect(recurrenceUntilRule(undefined, context({ parent: { frequency: "none" } }).ctx)).toBe(
      true,
    );
    expect(
      recurrenceUntilRule(
        "2020-01-01",
        context({ parent: { frequency: "none" }, document: { start } }).ctx,
      ),
    ).toBe(true);
  });

  it("needs a last date for weekly and monthly events", () => {
    for (const frequency of ["weekly", "monthly"]) {
      expect(
        recurrenceUntilRule(undefined, context({ parent: { frequency }, document: { start } }).ctx),
      ).toBe("Choose the last date it repeats on.");
    }
  });

  it("needs the last date to be after the first date, in Central Time", () => {
    const repeat = (until: string) =>
      recurrenceUntilRule(
        until,
        context({ parent: { frequency: "weekly" }, document: { start } }).ctx,
      );
    expect(repeat("2026-12-03")).toBe(
      "The last date must be after the first date (December 3, 2026).",
    );
    expect(repeat("2026-11-30")).toMatch(/after the first date/);
    // In UTC the first date is December 4, but the event is on December 3 in the Ozarks.
    expect(repeat("2026-12-04")).toBe(true);
    expect(repeat("2027-03-31")).toBe(true);
  });

  it("leaves a missing first date to the start field's own check", () => {
    expect(
      recurrenceUntilRule(
        "2026-12-31",
        context({ parent: { frequency: "monthly" }, document: {} }).ctx,
      ),
    ).toBe(true);
  });
});

describe("visibilityLevelsRule", () => {
  it("needs at least one level when only some levels can see it", () => {
    const rule = (levels: string[] | undefined) =>
      visibilityLevelsRule(levels, context({ parent: { audience: "levels" } }).ctx);
    expect(rule(undefined)).toMatch(/Tick at least one membership level/);
    expect(rule([])).toMatch(/Tick at least one membership level/);
    expect(rule(["band"])).toBe(true);
  });

  it("doesn't care about levels for everyone or all members", () => {
    for (const audience of ["everyone", "members"]) {
      expect(visibilityLevelsRule(undefined, context({ parent: { audience } }).ctx)).toBe(true);
    }
  });
});

describe("imageAltRule", () => {
  const asset = { _type: "reference", _ref: "image-abc-800x600-jpg" };

  it("needs alt text once an image is uploaded", () => {
    expect(imageAltRule(undefined, context({ parent: { asset } }).ctx)).toBe(
      "Describe the image for people who can't see it.",
    );
    expect(imageAltRule("   ", context({ parent: { asset } }).ctx)).toMatch(/Describe the image/);
    expect(imageAltRule("Crowd at Fall Fest", context({ parent: { asset } }).ctx)).toBe(true);
  });

  it("doesn't ask for alt text without an image", () => {
    expect(imageAltRule(undefined, context({ parent: {} }).ctx)).toBe(true);
    expect(imageAltRule(undefined, context({}).ctx)).toBe(true);
  });
});

describe("slugRule", () => {
  const slug = (current: string) => ({ _type: "slug" as const, current });

  it("accepts lowercase words joined by hyphens", () => {
    expect(slugRule()(slug("fall-fest-recap"))).toBe(true);
    expect(slugRule()(slug("blues-challenge-2027"))).toBe(true);
  });

  it("rejects anything that isn't safe in a web address", () => {
    for (const bad of [
      "Fall-Fest",
      "fall fest",
      "fall--fest",
      "-fall",
      "fall-",
      "fall/fest",
      "café",
    ]) {
      expect(slugRule()(slug(bad)), bad).toMatch(/lowercase letters, numbers and hyphens/);
    }
  });

  it("rejects addresses the app's own routes use", () => {
    expect(slugRule(["events", "studio"])(slug("events"))).toBe(
      "The website already uses /events for something else. Choose a different web address.",
    );
    expect(slugRule(["events"])(slug("events-archive"))).toBe(true);
  });

  it("leaves a missing web address to rule.required()", () => {
    expect(slugRule()(undefined)).toBe(true);
    expect(slugRule()({ _type: "slug" } as never)).toBe(true);
  });
});

describe("hrefRule", () => {
  it("accepts site paths, web addresses, email and phone links", () => {
    for (const ok of [
      "/events",
      "/",
      "/join?level=band",
      "https://example.org/festival",
      "http://example.org",
      "mailto:info@example.org",
      "tel:+1 (479) 555-0100",
      undefined,
      "",
    ]) {
      expect(hrefRule(ok), String(ok)).toBe(true);
    }
  });

  it("rejects links that would break or go somewhere unexpected", () => {
    for (const bad of [
      "events",
      "//evil.example/path",
      "javascript:alert(1)",
      "ftp://example.org/file",
      "https://localhost",
      "mailto:nobody",
      "www.example.org",
      "/two words",
    ]) {
      expect(hrefRule(bad), bad).toMatch(/^Use a web address/);
    }
  });
});

describe("linkRule", () => {
  const internal = { _type: "reference", _ref: "page-about" };

  it("needs exactly one destination", () => {
    expect(linkRule({ internal })).toBe(true);
    expect(linkRule({ href: "/events" })).toBe(true);
    expect(linkRule({})).toBe("Choose a page or type a web address.");
    expect(linkRule({ href: "  " })).toBe("Choose a page or type a web address.");
    expect(linkRule({ internal, href: "/events" })).toBe(
      "Choose a page or type a web address, not both.",
    );
  });

  it("leaves an unset link to rule.required()", () => {
    expect(linkRule(undefined)).toBe(true);
  });
});

describe("table rules", () => {
  const custom = (columns: string[] | undefined, rows?: { cells?: string[] }[]) =>
    context({ parent: { source: "custom", columns, rows } }).ctx;

  it("needs column headings for a table you type", () => {
    expect(tableColumnsRule(undefined, custom(undefined))).toBe("Add at least one column heading.");
    expect(tableColumnsRule([], custom([]))).toBe("Add at least one column heading.");
    expect(tableColumnsRule(["Venue", "Capacity"], custom(["Venue", "Capacity"]))).toBe(true);
  });

  it("needs one cell per column in every row", () => {
    const columns = ["Venue", "Capacity"];
    const rows = [{ cells: ["Old Mill", "350"] }, { cells: ["The Bluebird"] }];
    expect(tableRowsRule(undefined, custom(columns))).toBe("Add at least one row.");
    expect(tableRowsRule(rows, custom(columns, rows))).toBe(
      "Row 2 has 1 cell, but the table has 2 columns. Give every row one cell per column.",
    );
    const fixed = [rows[0], { cells: ["The Bluebird", "80"] }];
    expect(tableRowsRule(fixed, custom(columns, fixed))).toBe(true);
  });

  it("asks for nothing when the table shows the venue directory", () => {
    const directory = context({ parent: { source: "directory" } }).ctx;
    expect(tableColumnsRule(undefined, directory)).toBe(true);
    expect(tableRowsRule(undefined, directory)).toBe(true);
  });
});

describe("videoProvider and videoUrlRule", () => {
  it("recognizes YouTube, Vimeo and Bandcamp player links", () => {
    expect(videoProvider("https://www.youtube.com/watch?v=dQw4w9WgXcQ")).toBe("youtube");
    expect(videoProvider("https://youtu.be/dQw4w9WgXcQ")).toBe("youtube");
    expect(videoProvider("https://m.youtube.com/shorts/dQw4w9WgXcQ")).toBe("youtube");
    expect(videoProvider("https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ")).toBe("youtube");
    expect(videoProvider("https://vimeo.com/76979871")).toBe("vimeo");
    expect(videoProvider("https://vimeo.com/76979871/abc123def")).toBe("vimeo");
    expect(videoProvider("https://player.vimeo.com/video/76979871")).toBe("vimeo");
    expect(
      videoProvider(
        "https://bandcamp.com/EmbeddedPlayer/album=1234567890/size=large/tracklist=false/",
      ),
    ).toBe("bandcamp");
  });

  it("rejects links the site can't embed", () => {
    for (const bad of [
      "http://www.youtube.com/watch?v=dQw4w9WgXcQ",
      "https://www.youtube.com/@ozarkblues",
      "https://www.youtube.com/watch",
      "https://example.bandcamp.com/album/live-at-old-mill",
      "https://vimeo.com/channels/staffpicks",
      "https://example.org/video.mp4",
      "not a link",
    ]) {
      expect(videoProvider(bad), bad).toBeNull();
      expect(videoUrlRule(bad), bad).toMatch(/YouTube or Vimeo/);
    }
  });

  it("leaves an empty link to rule.required()", () => {
    expect(videoUrlRule(undefined)).toBe(true);
    expect(videoUrlRule("https://youtu.be/dQw4w9WgXcQ")).toBe(true);
  });
});

describe("spotlightTextRule", () => {
  it("needs spotlight text while the sponsor is featured", () => {
    const featured = context({ document: { featured: true } }).ctx;
    expect(spotlightTextRule(undefined, featured)).toMatch(/Write the spotlight text/);
    expect(spotlightTextRule(" ", featured)).toMatch(/Write the spotlight text/);
    expect(spotlightTextRule("Hosts our Tuesday jam.", featured)).toBe(true);
    expect(spotlightTextRule(undefined, context({ document: { featured: false } }).ctx)).toBe(true);
  });
});

describe("featuredSponsorRule", () => {
  it("doesn't ask Sanity anything for a sponsor that isn't featured", async () => {
    const { ctx, fetch } = context({ document: { _id: "drafts.sponsor-a", featured: false } });
    expect(await featuredSponsorRule(false, ctx)).toBe(true);
    expect(await featuredSponsorRule(undefined, ctx)).toBe(true);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("allows featuring when no other published, current sponsor is featured", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    // 11 p.m. Central on November 30 is December 1 in UTC.
    vi.setSystemTime(new Date("2026-12-01T05:00:00Z"));
    try {
      const { ctx, fetch, getClient } = context({ document: { _id: "drafts.sponsor-a" } });
      expect(await featuredSponsorRule(true, ctx)).toBe(true);
      expect(getClient).toHaveBeenCalledWith({
        apiVersion: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
      });
      expect(fetch).toHaveBeenCalledWith(OTHER_FEATURED_SPONSORS_QUERY, {
        publishedId: "sponsor-a",
        today: "2026-11-30",
      });
    } finally {
      vi.useRealTimers();
    }
  });

  it("excludes the sponsor's own published copy when checking a release version", async () => {
    const { ctx, fetch } = context({ document: { _id: "versions.spring.sponsor-a" } });
    await featuredSponsorRule(true, ctx);
    expect(fetch.mock.calls[0][1]).toMatchObject({ publishedId: "sponsor-a" });
  });

  it("refuses a second featured sponsor and names the one featured now", async () => {
    const { ctx } = context({
      document: { _id: "drafts.sponsor-b" },
      fetch: () => ["Riverbend Brewing Co."],
    });
    expect(await featuredSponsorRule(true, ctx)).toBe(
      "Only one sponsor can be featured at a time, and Riverbend Brewing Co. is featured now. Turn off Featured there and publish that sponsor first.",
    );
  });

  it("names every featured sponsor if several already are", async () => {
    const { ctx } = context({
      document: { _id: "drafts.sponsor-c" },
      fetch: () => ["Old Mill Music Hall", null, "Smokehouse BBQ"],
    });
    expect(await featuredSponsorRule(true, ctx)).toMatch(
      /Old Mill Music Hall, another sponsor and Smokehouse BBQ is featured now/,
    );
  });

  it("only counts published sponsors whose sponsorship hasn't ended", () => {
    expect(OTHER_FEATURED_SPONSORS_QUERY).toContain('!(_id in path("drafts.**"))');
    expect(OTHER_FEATURED_SPONSORS_QUERY).toContain('!(_id in path("versions.**"))');
    expect(OTHER_FEATURED_SPONSORS_QUERY).toContain("_id != $publishedId");
    expect(OTHER_FEATURED_SPONSORS_QUERY).toContain("(!defined(endsAt) || endsAt >= $today)");
  });
});
