import { cx } from "@/lib/cx";

/**
 * Classes for one filter pill (the concept's `.pill`), selected or not: the toggle buttons of
 * `PillFilters` and the links of `PillLinks` look the same. Not in either component's file, so
 * server and client components can both import it.
 */
export function pillClasses(selected: boolean): string {
  return cx(
    "rounded-full border px-3 py-1.25 text-small no-underline",
    selected
      ? // Forced-colors mode (Windows High Contrast) drops background colors, so the selected
        // pill uses the system's highlight colors there.
        "border-primary bg-primary text-white forced-colors:border-[Highlight] " +
          "forced-colors:bg-[Highlight] forced-colors:text-[HighlightText] " +
          "forced-colors:forced-color-adjust-none"
      : "border-line bg-white text-ink hover:border-line-strong",
  );
}
