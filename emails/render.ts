import { createElement } from "react";
import { render, type Options } from "react-email";
import type { EmailTemplate } from "./_lib/template";

/**
 * React Email turns the HTML into plain text with html-to-text, which capitalizes headings and the
 * labels of a details table by default. Keep them as written.
 */
const PLAIN_TEXT: Options = {
  plainText: true,
  htmlToTextOptions: {
    selectors: [
      { selector: "h1", options: { uppercase: false } },
      { selector: "h2", options: { uppercase: false } },
      {
        selector: '[data-text-format="dataTable"]',
        format: "dataTable",
        options: { uppercaseHeaderCells: false },
      },
    ],
  },
};

export interface RenderedEmail {
  subject: string;
  html: string;
  /** The plain-text version, for email clients that don't show HTML. */
  text: string;
}

/**
 * Renders an email for sending: its subject, its HTML and its plain-text version, all three of
 * which go to Resend. The sender's address isn't part of a template: whatever sends the email
 * supplies it from the one setting every sender shares (decision 0005).
 */
export async function renderEmail<Props extends object>(
  template: EmailTemplate<Props>,
  props: Props,
): Promise<RenderedEmail> {
  const element = createElement(template, props);
  const [html, text] = await Promise.all([render(element), render(element, PLAIN_TEXT)]);
  return { subject: template.subject(props), html, text };
}
