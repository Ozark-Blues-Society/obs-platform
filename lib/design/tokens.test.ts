// @vitest-environment node
// Checks docs/design/tokens.md against the tokens in app/globals.css: every color is documented
// with its current value, and every text/background pair in the contrast table meets WCAG 2.1 AA
// at the ratio the table shows. When the real brand colors arrive, this test lists what to update.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { contrastRatio } from "./contrast";

const read = (path: string) => readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");

const css = read("app/globals.css");
const doc = read("docs/design/tokens.md");

const cssColors = Object.fromEntries(
  [...css.matchAll(/^\s*--color-([a-z-]+):\s*(#[0-9a-f]{6})\s*;/gim)].map(([, name, value]) => [
    name,
    value.toLowerCase(),
  ]),
);

// The table rows ("| `...") in one "## <heading>" section of the doc.
function tableRows(heading: string): string[] {
  const section = doc.split(/^## /m).find((part) => part.startsWith(heading));
  if (!section) throw new Error(`docs/design/tokens.md has no "## ${heading}" section`);
  return section.split("\n").filter((line) => line.startsWith("| `"));
}

const COLOR_ROW = /^\|\s*`([a-z-]+)`\s*\|\s*`(#[0-9a-f]{6})`\s*\|/i;
const CONTRAST_ROW =
  /^\|\s*`([a-z-]+)`\s*\|\s*`([a-z-]+)`\s*\|\s*([^|]+?)\s*\|\s*([\d.]+):1\s*\|\s*(4\.5|3):1\s*\|$/;

describe("design tokens", () => {
  it("finds the color tokens in app/globals.css", () => {
    expect(Object.keys(cssColors).length).toBeGreaterThan(10);
    expect(css).toContain("--color-*: initial;");
  });

  it("documents every color token with its current value", () => {
    const rows = tableRows("Colors");
    const malformed = rows.filter((row) => !COLOR_ROW.test(row));
    expect(malformed, "rows that don't start with | `token` | `#rrggbb` |").toEqual([]);

    const documented = Object.fromEntries(
      rows.map((row) => {
        const [, name, value] = COLOR_ROW.exec(row)!;
        return [name, value.toLowerCase()];
      }),
    );
    expect(documented, "Colors table (received) vs app/globals.css (expected)").toEqual(cssColors);
  });

  it("meets WCAG AA for every documented pair, at the ratio the table shows", () => {
    const rows = tableRows("Contrast");
    expect(rows.length).toBeGreaterThan(0);

    const problems = rows.flatMap((row) => {
      const match = CONTRAST_ROW.exec(row);
      if (!match) return [`malformed row (a minimum must be 4.5:1 or 3:1): ${row}`];
      const [, fg, bg, where, shown, minimum] = match;
      if (!cssColors[fg] || !cssColors[bg]) return [`${fg} on ${bg}: unknown token`];

      const ratio = contrastRatio(cssColors[fg], cssColors[bg]);
      const found: string[] = [];
      if (ratio < Number(minimum)) {
        found.push(`${fg} on ${bg} (${where}): ${ratio.toFixed(2)}:1, needs ${minimum}:1`);
      }
      if (shown !== ratio.toFixed(2)) {
        found.push(`${fg} on ${bg}: the table shows ${shown}:1, it is ${ratio.toFixed(2)}:1`);
      }
      return found;
    });
    expect(problems).toEqual([]);
  });
});
