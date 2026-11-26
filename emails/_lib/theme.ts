// The emails' copy of the design tokens (backlog D-1, docs/design/tokens.md). Email clients can't
// read the site's CSS variables, so the templates use these literal values instead.
// theme.test.ts fails when a color here no longer matches its token in app/globals.css, so a brand
// change shows up here too.

/** Token colors, named like the tokens in app/globals.css (camelCase for kebab-case). */
export const colors = {
  primaryDark: "#0e1a2b",
  primary: "#1d3557",
  primaryLight: "#2b4c7e",
  accentLight: "#f0d49a",
  accentDark: "#7a5512",
  canvas: "#f7f2e8",
  surface: "#fffdf8",
  white: "#ffffff",
  ink: "#1c1a17",
  muted: "#6b6458",
  line: "#e4dccb",
} as const;

/**
 * Font stacks. Most email clients don't load web fonts, and loading them from Google would tell
 * Google who opened the email, so the brand fonts are used only where they're installed; Georgia
 * and Arial stand in for them elsewhere.
 */
export const fonts = {
  serif: '"DM Serif Display", Georgia, "Times New Roman", serif',
  sans: "Inter, Arial, Helvetica, sans-serif",
} as const;
