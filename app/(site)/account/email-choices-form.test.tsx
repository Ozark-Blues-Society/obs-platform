import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import {
  EMAIL_CHOICES_MESSAGES,
  type EmailChoicesFormState,
} from "@/lib/account/email-choices-state";
import { EmailChoicesForm } from "./email-choices-form";

function answering(state: EmailChoicesFormState) {
  return vi.fn(async (): Promise<EmailChoicesFormState> => state);
}

const newsletter = () => screen.getByRole("checkbox", { name: "Monthly newsletter" });
const events = () => screen.getByRole("checkbox", { name: "Event announcements" });
const save = () => fireEvent.click(screen.getByRole("button", { name: "Save email choices" }));

describe("EmailChoicesForm", () => {
  it("shows the two switches as MailerLite has them, each with what it sends", () => {
    render(
      <EmailChoicesForm
        action={vi.fn()}
        initial={{ choices: { newsletter: true, events: false }, paused: false }}
      />,
    );

    expect(screen.getByRole("group", { name: "Email me" })).toBeInTheDocument();
    expect(newsletter()).toBeChecked();
    expect(newsletter()).toHaveAccessibleDescription(EMAIL_CHOICES_MESSAGES.newsletterHint);
    expect(events()).not.toBeChecked();
    expect(events()).toHaveAccessibleDescription(EMAIL_CHOICES_MESSAGES.eventsHint);
    expect(screen.getByText(EMAIL_CHOICES_MESSAGES.membershipEmails)).toBeInTheDocument();
    expect(screen.queryByText(EMAIL_CHOICES_MESSAGES.paused)).not.toBeInTheDocument();
    expect(screen.getByRole("status")).toBeEmptyDOMElement();
  });

  it("sends the switches that are on, and says the choices are saved", async () => {
    const action = answering({
      status: "saved",
      choices: { newsletter: false, events: true },
      paused: false,
    });
    render(
      <EmailChoicesForm
        action={action}
        initial={{ choices: { newsletter: true, events: false }, paused: false }}
      />,
    );

    fireEvent.click(newsletter());
    fireEvent.click(events());
    save();

    expect(await screen.findByText(EMAIL_CHOICES_MESSAGES.saved)).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent(EMAIL_CHOICES_MESSAGES.saved);
    const sent = action.mock.calls[0] as unknown as [EmailChoicesFormState, FormData];
    expect(Object.fromEntries(sent[1])).toEqual({ events: "on" });
    expect(newsletter()).not.toBeChecked();
    expect(events()).toBeChecked();
  });

  it("says when nothing reaches the member, until they save a choice", async () => {
    render(
      <EmailChoicesForm
        action={answering({
          status: "saved",
          choices: { newsletter: true, events: false },
          paused: false,
        })}
        initial={{ choices: { newsletter: false, events: false }, paused: true }}
      />,
    );
    expect(screen.getByText(EMAIL_CHOICES_MESSAGES.paused)).toBeInTheDocument();

    fireEvent.click(newsletter());
    save();

    expect(await screen.findByText(EMAIL_CHOICES_MESSAGES.saved)).toBeInTheDocument();
    expect(screen.queryByText(EMAIL_CHOICES_MESSAGES.paused)).not.toBeInTheDocument();
  });

  it("says when the choices couldn't be saved, and keeps what was chosen", async () => {
    render(
      <EmailChoicesForm
        action={answering({
          status: "error",
          message: EMAIL_CHOICES_MESSAGES.unavailable,
          choices: { newsletter: true, events: true },
        })}
        initial={{ choices: { newsletter: true, events: false }, paused: true }}
      />,
    );

    fireEvent.click(events());
    save();

    expect(await screen.findByRole("alert")).toHaveTextContent(EMAIL_CHOICES_MESSAGES.unavailable);
    expect(newsletter()).toBeChecked();
    expect(events()).toBeChecked();
    // Nothing changed in MailerLite, so the note stays.
    expect(screen.getByText(EMAIL_CHOICES_MESSAGES.paused)).toBeInTheDocument();
    expect(screen.getByRole("status")).toBeEmptyDOMElement();
  });
});
