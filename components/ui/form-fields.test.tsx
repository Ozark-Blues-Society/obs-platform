import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CheckboxField, Fieldset, SelectField, TextareaField, TextField } from "./form-fields";

describe("form fields", () => {
  it("label the control and describe it with the help text and the error", () => {
    render(
      <TextField
        label="Email"
        name="email"
        type="email"
        hint="We never share it."
        error="Enter an email address like name@example.com."
      />,
    );

    const input = screen.getByRole("textbox", { name: "Email" });
    expect(input).toHaveAttribute("type", "email");
    expect(input).toHaveAttribute("name", "email");
    expect(input).toBeInvalid();
    expect(input).toHaveAccessibleDescription(
      "We never share it. Enter an email address like name@example.com.",
    );
  });

  it("aren't marked invalid or described when there's nothing to say", () => {
    render(<TextField label="First name" />);

    const input = screen.getByRole("textbox", { name: "First name" });
    expect(input).toHaveAttribute("type", "text");
    expect(input).not.toHaveAttribute("aria-invalid");
    expect(input).not.toHaveAttribute("aria-describedby");
  });

  it("keep a description the caller passes, and an id the caller chooses", () => {
    render(
      <>
        <p id="card-note">Stripe handles the card.</p>
        <TextField
          label="Name on card"
          id="card-name"
          aria-describedby="card-note"
          hint="As printed."
        />
      </>,
    );

    const input = screen.getByRole("textbox", { name: "Name on card" });
    expect(input).toHaveAttribute("id", "card-name");
    expect(input).toHaveAccessibleDescription("Stripe handles the card. As printed.");
  });

  it("cover textareas, selects and checkboxes", () => {
    render(
      <>
        <TextareaField label="Details" error="Add a few details." />
        <SelectField label="Category" defaultValue="gear">
          <option value="merch">Merch</option>
          <option value="gear">Gear</option>
        </SelectField>
        <CheckboxField label="Renew automatically" hint="Cancel anytime." defaultChecked />
      </>,
    );

    expect(screen.getByRole("textbox", { name: "Details" })).toHaveAccessibleDescription(
      "Add a few details.",
    );
    expect(screen.getByRole("combobox", { name: "Category" })).toHaveValue("gear");
    const checkbox = screen.getByRole("checkbox", { name: "Renew automatically" });
    expect(checkbox).toBeChecked();
    expect(checkbox).toHaveAccessibleDescription("Cancel anytime.");
  });

  it("group checkboxes under a legend", () => {
    render(
      <Fieldset legend="I can help with…" hint="Pick any.">
        <CheckboxField label="Door / merch table" />
        <CheckboxField label="Blues in the Schools" />
      </Fieldset>,
    );

    const group = screen.getByRole("group", { name: "I can help with…" });
    expect(group).toHaveAccessibleDescription("Pick any.");
    expect(group).toContainElement(screen.getByRole("checkbox", { name: "Blues in the Schools" }));
  });
});
