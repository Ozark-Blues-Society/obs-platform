// Building blocks for the content of Society emails, styled with the design tokens
// (../_lib/theme.ts). Every text/background pair used here is in the contrast table of
// docs/design/tokens.md, and theme.test.ts checks them again.
import type { ReactNode } from "react";
import { Button, Heading, Section, Text } from "react-email";
import { colors, fonts } from "../_lib/theme";

/** The small label above the title, like the site's eyebrows. */
export function Eyebrow({ children }: { children: ReactNode }) {
  return (
    <Text
      style={{
        margin: "0 0 8px",
        fontSize: "12px",
        lineHeight: "1.5",
        fontWeight: "bold",
        letterSpacing: "0.14em",
        textTransform: "uppercase",
        color: colors.accentDark,
      }}
    >
      {children}
    </Text>
  );
}

/** The email's heading. DM Serif Display has a single weight, so headings stay at normal. */
export function Title({ children }: { children: ReactNode }) {
  return (
    <Heading
      as="h1"
      style={{
        margin: "0 0 16px",
        fontFamily: fonts.serif,
        fontSize: "28px",
        fontWeight: "normal",
        lineHeight: "1.2",
        color: colors.ink,
      }}
    >
      {children}
    </Heading>
  );
}

export function Subheading({ children }: { children: ReactNode }) {
  return (
    <Heading
      as="h2"
      style={{
        margin: "28px 0 8px",
        fontFamily: fonts.serif,
        fontSize: "20px",
        fontWeight: "normal",
        lineHeight: "1.2",
        color: colors.ink,
      }}
    >
      {children}
    </Heading>
  );
}

export function Paragraph({ children }: { children: ReactNode }) {
  return (
    <Text style={{ margin: "0 0 16px", fontSize: "16px", lineHeight: "1.55", color: colors.ink }}>
      {children}
    </Text>
  );
}

/** Secondary text, such as a note under a button. */
export function Note({ children }: { children: ReactNode }) {
  return (
    <Text style={{ margin: "0 0 16px", fontSize: "14px", lineHeight: "1.5", color: colors.muted }}>
      {children}
    </Text>
  );
}

/** The main call to action, styled like the site's dark pill buttons. */
export function PrimaryButton({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Section style={{ margin: "8px 0 24px" }}>
      <Button
        href={href}
        style={{
          padding: "12px 28px",
          backgroundColor: colors.primary,
          borderRadius: "999px",
          color: colors.white,
          fontSize: "16px",
          fontWeight: "bold",
          textDecoration: "none",
        }}
      >
        {children}
      </Button>
    </Section>
  );
}

export function BulletList({ items }: { items: readonly string[] }) {
  return (
    <ul style={{ margin: "0 0 16px", paddingLeft: "22px" }}>
      {items.map((item, index) => (
        <li
          // A static list, and two items may read the same.
          key={index}
          style={{ margin: "0 0 6px", fontSize: "16px", lineHeight: "1.5", color: colors.ink }}
        >
          {item}
        </li>
      ))}
    </ul>
  );
}

/**
 * Label/value rows, such as a payment's amount and date, on a panel. It's a real table (row headers
 * and cells) so screen readers announce each label with its value, and the plain-text version
 * keeps each row on one line.
 */
export function Details({ rows }: { rows: readonly { label: string; value: string }[] }) {
  return (
    <table
      data-text-format="dataTable"
      cellPadding={0}
      cellSpacing={0}
      style={{
        width: "100%",
        margin: "0 0 24px",
        borderCollapse: "separate",
        backgroundColor: colors.canvas,
        borderRadius: "8px",
      }}
    >
      <tbody>
        {rows.map(({ label, value }, index) => {
          // The panel's padding goes on the first and last rows' cells.
          const top = index === 0 ? 16 : 6;
          const bottom = index === rows.length - 1 ? 16 : 6;
          return (
            <tr key={label}>
              <th
                scope="row"
                style={{
                  width: "42%",
                  padding: `${top}px 12px ${bottom}px 20px`,
                  textAlign: "left",
                  verticalAlign: "top",
                  fontSize: "14px",
                  // The same line height as the value, so label and value sit on one line.
                  lineHeight: "24px",
                  fontWeight: "normal",
                  color: colors.muted,
                }}
              >
                {label}
              </th>
              <td
                style={{
                  padding: `${top}px 20px ${bottom}px 0`,
                  verticalAlign: "top",
                  fontSize: "16px",
                  lineHeight: "24px",
                  fontWeight: "bold",
                  color: colors.ink,
                }}
              >
                {value}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

/** The closing line and the Society's name. */
export function SignOff({ children }: { children: ReactNode }) {
  return (
    <Text style={{ margin: "24px 0 0", fontSize: "16px", lineHeight: "1.55", color: colors.ink }}>
      {children}
      <br />
      The Ozark Blues Society
    </Text>
  );
}
