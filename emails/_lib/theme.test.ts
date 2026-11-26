// @vitest-environment node
// The emails keep their own copy of the design tokens (email clients can't read CSS variables).
// These tests keep that copy in step with app/globals.css and check the contrast of every
// text/background pair the emails use, so a brand change can't leave the emails behind.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { contrastRatio } from "@/lib/design/contrast";
import { colors } from "./theme";

const css = readFileSync(new URL("../../app/globals.css", import.meta.url), "utf8");
const tokens = Object.fromEntries(
  [...css.matchAll(/^\s*--color-([a-z-]+):\s*(#[0-9a-f]{6})\s*;/gim)].map(([, name, value]) => [
    name,
    value.toLowerCase(),
  ]),
);

const kebab = (name: string) => name.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);

type Color = keyof typeof colors;

// Every text (or control) color on every background the emails use. Each pair is also in the
// contrast table of docs/design/tokens.md.
const PAIRS: [text: Color, background: Color, where: string][] = [
  ["ink", "surface", "text on the card"],
  ["muted", "surface", "notes on the card"],
  ["accentDark", "surface", "eyebrow"],
  ["primaryLight", "surface", "links on the card"],
  ["ink", "canvas", "values on the details panel"],
  ["muted", "canvas", "labels on the details panel, footer text"],
  ["primaryLight", "canvas", "footer links"],
  ["white", "primary", "button"],
  ["white", "primaryDark", "logo"],
  ["accentLight", "primaryDark", "logo tagline"],
];

describe("email theme", () => {
  it("uses the design tokens' values", () => {
    const expected = Object.fromEntries(
      Object.keys(colors).map((name) => [name, tokens[kebab(name)] ?? "(no such token)"]),
    );
    expect(colors, "emails/_lib/theme.ts (received) vs app/globals.css (expected)").toEqual(
      expected,
    );
  });

  it("meets WCAG AA (4.5:1) for every pair the emails use", () => {
    const failing = PAIRS.filter(
      ([text, background]) => contrastRatio(colors[text], colors[background]) < 4.5,
    ).map(([text, background, where]) => `${text} on ${background} (${where})`);
    expect(failing).toEqual([]);
  });
});
