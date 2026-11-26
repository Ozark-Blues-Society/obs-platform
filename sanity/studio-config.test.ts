// @vitest-environment node
import type { Workspace } from "sanity";
// createStructureBuilder is internal to Sanity; it's how the Structure tool builds the navigation.
import { createStructureBuilder, type ListBuilder } from "sanity/structure";
import { beforeAll, describe, expect, it } from "vitest";
import { resolve } from "./presentation";
import { documentTypes } from "./schemas";
import { BOARD_BENEFITS } from "./schemas/documents/site-settings";
import { structure } from "./structure";
import { createTestWorkspace } from "./test-workspace";

let workspace: Workspace;

beforeAll(async () => {
  workspace = await createTestWorkspace(() => []);
});

describe("the Content Studio", () => {
  it("lists the content in the concept's order, with Site settings last", () => {
    const S = createStructureBuilder({
      source: workspace.unstable_sources[0],
      perspectiveStack: [],
    });
    const items = (structure(S, {} as never) as ListBuilder).serialize({ path: [] }).items;
    expect(items.map((item) => (item.type === "divider" ? "—" : item.title))).toEqual([
      "Pages",
      "Events",
      "Blog posts",
      "Sponsors",
      "Sponsor tiers",
      "Venues",
      "Directory entries",
      "People",
      "—",
      "Site settings",
    ]);
    expect(items.map((item) => item.id).filter((id) => !id.startsWith("__"))).toEqual(
      documentTypes.map((type) => type.name),
    );
  });

  it("keeps exactly one Site settings: nobody can create, duplicate, delete or unpublish it", () => {
    const creatable = workspace.document
      .resolveNewDocumentOptions({ type: "global" })
      .map((option) => option.templateId);
    expect(creatable).not.toContain("siteSettings");
    expect(creatable).toContain("page");

    const actionsFor = (schemaType: string, singleton?: string) =>
      workspace.document
        .actions({
          schemaType,
          documentId: schemaType,
          ...(singleton ? { singleton } : {}),
        } as never)
        .map((action) => action.action);
    const settingsActions = actionsFor("siteSettings", "siteSettings");
    expect(settingsActions).toContain("publish");
    for (const hidden of ["delete", "duplicate", "unpublish"]) {
      expect(settingsActions).not.toContain(hidden);
      expect(actionsFor("page")).toContain(hidden);
    }
  });

  it("starts Site settings with the board's benefits table", () => {
    const template = workspace.templates.find((t) => t.id === "siteSettings");
    expect(template?.value).toEqual({ membershipBenefits: BOARD_BENEFITS });
  });
});

describe("the Presentation tool", () => {
  type Resolver = { resolve: (doc: { title?: string; slug?: string } | null) => unknown };
  const locations = resolve.locations as Record<string, Resolver>;

  it("knows where pages, posts and events appear on the site", () => {
    expect(
      locations.page.resolve({ title: "About & Volunteer", slug: "about-and-volunteer" }),
    ).toEqual({
      locations: [{ title: "About & Volunteer", href: "/about-and-volunteer" }],
    });
    expect(locations.post.resolve({ title: "Fall Fest Recap", slug: "fall-fest-recap" })).toEqual({
      locations: [
        { title: "Fall Fest Recap", href: "/blog/fall-fest-recap" },
        { title: "Blog", href: "/blog" },
      ],
    });
    expect(locations.event.resolve({ slug: "weekly-open-jam" })).toEqual({
      locations: [
        { title: "Untitled event", href: "/events/weekly-open-jam" },
        { title: "Events calendar", href: "/events" },
      ],
    });
    expect(locations.page.resolve(null)).toEqual({ locations: [] });
  });

  it("finds the document behind a page, post or event address", () => {
    expect(resolve.mainDocuments).toEqual([
      { route: "/blog/:slug", filter: '_type == "post" && slug.current == $slug' },
      { route: "/events/:slug", filter: '_type == "event" && slug.current == $slug' },
      { route: "/:slug", filter: '_type == "page" && slug.current == $slug' },
    ]);
  });
});
