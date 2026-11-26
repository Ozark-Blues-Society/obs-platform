// @vitest-environment node
// Pages and components take their colors from the design tokens in app/globals.css (backlog D-1,
// docs/design/tokens.md), so the real brand colors can replace the placeholders in one place.
// This test fails on a hard-coded color anywhere else in the app's source.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const ROOT = fileURLToPath(new URL("../../", import.meta.url));
const SCANNED_DIRS = ["app", "components", "lib", "emails"];
const SOURCE_FILE = /\.(?:[cm]?[jt]sx?|css)$/;
const TEST_FILE = /\.(?:test|spec)\.[cm]?[jt]sx?$/;
// Files that may hold color values, with the reason.
const ALLOWED: Record<string, string> = {
  "app/globals.css": "the design tokens themselves",
  "emails/_lib/theme.ts":
    "the emails' copy of the tokens (email clients can't read CSS variables); theme.test.ts checks it",
};

const TAILWIND_PALETTE =
  "slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose";
const COLOR_UTILITY =
  "bg|text|border|ring|outline|fill|stroke|from|via|to|divide|placeholder|decoration|accent|caret|shadow";

const RULES: { name: string; pattern: RegExp }[] = [
  // Not after a word character, "." or "&": skips private fields (this.#add) and entities (&#123;).
  { name: "hex color", pattern: /(?<![\w.&])#(?:[0-9a-f]{8}|[0-9a-f]{6}|[0-9a-f]{3})\b/gi },
  {
    name: "CSS color function",
    pattern: /\b(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch|color-mix)\(/gi,
  },
  {
    name: "Tailwind palette color",
    pattern: new RegExp(
      `\\b(?:${COLOR_UTILITY})(?:-[a-z]+)*-(?:(?:${TAILWIND_PALETTE})-(?:50|[1-9]00|950)|black)\\b`,
      "g",
    ),
  },
];

function findHardCodedColors(source: string): string[] {
  return source
    .split("\n")
    .flatMap((line, index) =>
      RULES.flatMap(({ name, pattern }) =>
        [...line.matchAll(pattern)].map((match) => `line ${index + 1}: ${match[0]} (${name})`),
      ),
    );
}

function sourceFiles(dir: string): string[] {
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return []; // components/ doesn't exist yet
  }
  return entries.flatMap((entry) => {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return SOURCE_FILE.test(entry) && !TEST_FILE.test(entry) ? [path] : [];
  });
}

describe("findHardCodedColors", () => {
  it("flags hex values, color functions and Tailwind palette classes", () => {
    expect(
      findHardCodedColors(`className="bg-[#fff] text-neutral-700 border-t-red-500/50"`),
    ).toEqual([
      "line 1: #fff (hex color)",
      "line 1: text-neutral-700 (Tailwind palette color)",
      "line 1: border-t-red-500 (Tailwind palette color)",
    ]);
    expect(findHardCodedColors(`style={{ color: "rgb(0 0 0)" }}\nshadow-black/20`)).toEqual([
      "line 1: rgb( (CSS color function)",
      "line 2: shadow-black (Tailwind palette color)",
    ]);
  });

  it("allows tokens, private fields, entities and ordinary numbers", () => {
    const fine = `className="bg-canvas text-primary-dark border-line-strong outline-focus ring-2"
      this.#add(1); &#123; issue #42; <a href="#main">`;
    expect(findHardCodedColors(fine)).toEqual([]);
  });
});

describe("app source", () => {
  it("uses design tokens instead of hard-coded colors", () => {
    const files = SCANNED_DIRS.flatMap((dir) => sourceFiles(join(ROOT, dir)));
    expect(files.length).toBeGreaterThan(0);

    const problems = files.flatMap((file) => {
      const path = relative(ROOT, file).split("\\").join("/");
      if (path in ALLOWED) return [];
      return findHardCodedColors(readFileSync(file, "utf8")).map((hit) => `${path} ${hit}`);
    });
    expect(
      problems,
      "Use a color token from app/globals.css instead (see docs/design/tokens.md)",
    ).toEqual([]);
  });
});
