// @vitest-environment node
// Checks that hold for every email template. A template is a .tsx file in emails/ with a default
// export, as the preview server finds them, so a new template is checked without listing it here.
// Each one is rendered with its PreviewProps.
import { readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { EmailTemplate } from "./_lib/template";
import { colors } from "./_lib/theme";
import { renderEmail } from "./render";

const files = readdirSync(new URL(".", import.meta.url)).filter(
  (file) => file.endsWith(".tsx") && !file.endsWith(".test.tsx"),
);

const templates = await Promise.all(
  files.map(async (file) => {
    // Resolved when the test runs, so Vite can't analyze it ahead of time and shouldn't try.
    const imported = await import(/* @vite-ignore */ `./${file}`);
    const template = imported.default as EmailTemplate<{ siteUrl: string }>;
    return { file, template, rendered: await renderEmail(template, template.PreviewProps) };
  }),
);

const decode = (html: string) =>
  html
    .replaceAll("&#x27;", "'")
    .replaceAll("&quot;", '"')
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&amp;", "&");

const all = (html: string, pattern: RegExp) => [...html.matchAll(pattern)].map((match) => match[1]);

it("finds the templates", () => {
  expect(files).toEqual(expect.arrayContaining(["receipt.tsx", "welcome.tsx"]));
});

describe.each(templates)("$file", ({ template, rendered: { subject, html, text } }) => {
  const siteUrl = template.PreviewProps.siteUrl;

  it("has a subject, which is also the document's only title", () => {
    expect(subject.trim()).not.toBe("");
    expect(all(html, /<title>(.*?)<\/title>/g).map(decode)).toEqual([subject]);
  });

  it("declares its language and has one main heading", () => {
    expect(html).toMatch(/<html[^>]* lang="en"/);
    expect(html.match(/<h1[\s>]/g)).toHaveLength(1);
  });

  it("has preview text that the plain-text version leaves out", () => {
    const [preview] = all(html, /<div [^>]*data-skip-in-text="true"[^>]*>([^<]+)</g);
    expect(preview?.trim()).toBeTruthy();
    expect(text).not.toContain(decode(preview!).trim());
  });

  it("links only to absolute addresses on the site", () => {
    const links = all(html, / href="([^"]*)"/g).map(decode);
    expect(links.length).toBeGreaterThan(0);
    expect(links.filter((link) => !link.startsWith(`${siteUrl}/`))).toEqual([]);
  });

  it("uses only the design tokens' colors", () => {
    // Also catches colors that React Email's components bring with them (a blue for links).
    const palette = new Set<string>(Object.values(colors));
    const used = all(html, /(?<![\w&])(#[0-9a-f]{6}|#[0-9a-f]{3})\b/gi).map((c) => c.toLowerCase());
    expect(used.length).toBeGreaterThan(0);
    expect(used.filter((color) => !palette.has(color))).toEqual([]);
    expect(html).not.toMatch(/\b(?:rgba?|hsla?)\(/);
  });

  it("marks layout tables as presentation, leaving data tables to screen readers", () => {
    const tables = html.match(/<table[^>]*>/g) ?? [];
    const dataTables = tables.filter((tag) => tag.includes('data-text-format="dataTable"'));
    expect(tables.filter((tag) => !tag.includes('role="presentation"'))).toEqual(dataTables);
  });

  it("gives every image a text alternative", () => {
    expect((html.match(/<img\b[^>]*>/g) ?? []).filter((tag) => !/ alt="/.test(tag))).toEqual([]);
  });

  it("has a plain-text version with the same content and no markup or missing values", () => {
    expect(text).not.toMatch(/<[a-z!/]/i);
    expect(text).not.toMatch(/\b(?:undefined|null|NaN|Invalid Date)\b/);
    expect(text).toContain("Replies to this email aren't read.");
    expect(text).toContain(`contact page ${siteUrl}/contact`);
  });
});
