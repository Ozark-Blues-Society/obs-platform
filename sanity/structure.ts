// The Content Studio's navigation, in the order of the approved concept (docs/design/screenshots,
// 12–15): content types first, then Site settings.
import type { StructureBuilder, StructureResolver } from "sanity/structure";

function typeList(S: StructureBuilder, type: string, title: string, orderBy?: string) {
  const list = S.documentTypeList(type).title(title);
  return S.documentTypeListItem(type)
    .title(title)
    .child(orderBy ? list.defaultOrdering([{ field: orderBy, direction: "desc" }]) : list);
}

export const structure: StructureResolver = (S) =>
  S.list()
    .title("Content")
    .items([
      typeList(S, "page", "Pages"),
      typeList(S, "event", "Events", "start"),
      typeList(S, "post", "Blog posts", "publishedAt"),
      typeList(S, "sponsor", "Sponsors"),
      typeList(S, "sponsorTier", "Sponsor tiers"),
      typeList(S, "venue", "Venues"),
      typeList(S, "directoryEntry", "Directory entries"),
      typeList(S, "person", "People"),
      S.divider(),
      S.listItem().singleton("siteSettings"),
    ]);
