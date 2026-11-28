"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useTransition, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import {
  FormError,
  Fieldset,
  SelectField,
  SuccessBox,
  TextField,
  TextareaField,
} from "@/components/ui/form-fields";
import {
  BODY_MAX_LENGTH,
  LISTING_CATEGORIES,
  LISTING_MESSAGES,
  PHOTO_TYPES,
  TITLE_MAX_LENGTH,
  checkListing,
  checkPhoto,
  type ListingDraft,
  type ListingField,
  type PreparePhotoResult,
  type SubmitListingResult,
} from "@/lib/listings/listing-state";
import { MY_LISTINGS_PATH } from "@/lib/site/navigation";

// The Server Functions arrive as props (from page.tsx), so the form can be tested on its own.
type Props = {
  prepare: (photo: { size: number; type: string }) => Promise<PreparePhotoResult>;
  submit: (input: ListingDraft & { photoPath: string | null }) => Promise<SubmitListingResult>;
  /** The phone number on the member's profile, which they may offer instead of email. */
  phone: string | null;
  /** Sends the photo to the one-time upload link; true when Storage accepted it. */
  upload?: (url: string, photo: File) => Promise<boolean>;
};

type State =
  | { status: "idle" }
  // `attempt` counts the failures, so a repeat of the last one is still a new alert (fieldError).
  | {
      status: "error";
      field: ListingField | null;
      message: string;
      announce?: boolean;
      attempt: number;
    }
  | { status: "submitted"; title: string };

/** Where focus goes when a check fails on `field`: its first control, if the form shows one. */
function controlOf(form: HTMLFormElement | null, field: ListingField) {
  const control = form?.querySelector<HTMLInputElement>(`[name="${field}"]`) ?? null;
  return control && control.type !== "hidden" ? control : null;
}

/**
 * Posts a classifieds listing for a moderator to review. A photo goes straight from the browser to
 * Storage, through a one-time link the server makes for active members
 * (lib/listings/listing-actions.ts), so it never passes through the website's server.
 */
export function ListingForm({ prepare, submit, phone, upload = putPhoto }: Props) {
  const [state, setState] = useState<State>({ status: "idle" });
  const [contactPref, setContactPref] = useState("email");
  const [pending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);
  const failures = useRef(0);
  // While a listing is on its way, the last try's message is hidden: it isn't this try's outcome,
  // and the next message is then a new element, which screen readers read out even when it's the
  // same.
  const outcome: State = pending ? { status: "idle" } : state;
  // A field's message, as an alert when focus couldn't move to the field (see `fail`). The key
  // makes each failure's alert a new element, which screen readers announce, even if the same
  // text was there.
  const fieldError = (field: ListingField) => {
    if (outcome.status !== "error" || outcome.field !== field) return undefined;
    const { announce, attempt, message } = outcome;
    return (
      <span key={announce ? `alert-${attempt}` : "text"} role={announce ? "alert" : undefined}>
        {message}
      </span>
    );
  };

  // When a check fails, focus goes to the field to fix, after the message has rendered: the
  // field's description then includes it, so screen readers read it out. Keyed on the state
  // itself, so the same failure twice moves focus again.
  useEffect(() => {
    if (state.status === "error" && state.field) controlOf(formRef.current, state.field)?.focus();
  }, [state]);

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const input = form.elements.namedItem("photo");
    const photo = input instanceof HTMLInputElement ? (input.files?.[0] ?? null) : null;
    const text = (name: string) => {
      const value = data.get(name);
      return typeof value === "string" ? value : "";
    };
    const draft: ListingDraft = {
      category: text("category"),
      title: text("title"),
      body: text("body"),
      price: text("price"),
      contactPref: text("contactPref"),
    };
    // A message for a field the form doesn't show goes with the form's own messages. Focus can't
    // move to a field that already has it (Enter in an empty Title box), and nothing would be read
    // out, so that message is announced instead.
    const fail = (field: ListingField | null, message: string) => {
      const control = field ? controlOf(form, field) : null;
      setState({
        status: "error",
        field: control ? field : null,
        message,
        announce: control !== null && control === document.activeElement,
        attempt: ++failures.current,
      });
    };

    // Checked in the order the fields appear: the photo comes before the contact choice.
    const checked = checkListing(draft, phone);
    const photoProblem = photo ? checkPhoto(photo) : null;
    if ("field" in checked && checked.field !== "contactPref") {
      return fail(checked.field, checked.message);
    }
    if (photoProblem) return fail("photo", photoProblem);
    if ("field" in checked) return fail(checked.field, checked.message);

    startTransition(async () => {
      let photoPath: string | null = null;
      if (photo) {
        const prepared = await prepare({ size: photo.size, type: photo.type });
        if (prepared.status === "error") return fail(null, prepared.message);
        if (!(await upload(prepared.uploadUrl, photo))) {
          return fail(null, LISTING_MESSAGES.uploadFailed);
        }
        photoPath = prepared.path;
      }
      const result = await submit({ ...draft, photoPath });
      if (result.status === "error") return fail(result.field, result.message);
      form.reset();
      setContactPref("email");
      setState(result);
    });
  }

  return (
    <form
      ref={formRef}
      onSubmit={onSubmit}
      noValidate
      className="mt-6 flex max-w-xl flex-col gap-5"
    >
      <SelectField
        name="category"
        label="Category"
        error={fieldError("category")}
        defaultValue=""
        required
      >
        <option value="" disabled>
          Choose a category
        </option>
        {LISTING_CATEGORIES.map((category) => (
          <option key={category.value} value={category.value}>
            {category.title}
          </option>
        ))}
      </SelectField>
      <TextField
        name="title"
        label="Title"
        hint="For example: Bass player wanted for a Chicago-style blues band."
        error={fieldError("title")}
        maxLength={TITLE_MAX_LENGTH}
        autoComplete="off"
        required
      />
      <TextareaField
        name="body"
        label="Details"
        hint="What you're offering or looking for, and anything people should know."
        error={fieldError("body")}
        maxLength={BODY_MAX_LENGTH}
        rows={6}
        required
      />
      <TextField
        name="price"
        label="Price (optional)"
        hint="In dollars. Leave it blank if nothing is for sale."
        error={fieldError("price")}
        inputMode="decimal"
        autoComplete="off"
      />
      <TextField
        type="file"
        name="photo"
        label="Photo (optional)"
        hint="A JPEG, PNG or WebP photo, up to 10 MB."
        error={fieldError("photo")}
        accept={PHOTO_TYPES}
      />
      {phone ? (
        <Fieldset legend="How should people contact you?" error={fieldError("contactPref")}>
          {[
            {
              value: "email",
              label: "By email, through this website. Your address stays private.",
            },
            { value: "phone", label: `By phone, at ${phone} (the number on your profile).` },
          ].map((choice) => (
            <label key={choice.value} className="flex items-start gap-2">
              <input
                type="radio"
                name="contactPref"
                value={choice.value}
                checked={contactPref === choice.value}
                onChange={() => setContactPref(choice.value)}
                className="mt-1 size-4 flex-none accent-primary"
              />
              {choice.label}
            </label>
          ))}
        </Fieldset>
      ) : (
        <p className="text-sm">
          <input type="hidden" name="contactPref" value="email" />
          People will contact you by email, through this website. Your address stays private.
        </p>
      )}
      <div>
        <Button type="submit" variant="dark" pending={pending}>
          {pending ? "Sending…" : "Submit for review"}
        </Button>
        {outcome.status === "error" && outcome.field === null && (
          <FormError key={outcome.attempt} className="mt-2">
            {outcome.message}
          </FormError>
        )}
      </div>
      {/* Always in the page, so screen readers announce the message when it appears. */}
      <div role="status">
        {outcome.status === "submitted" && (
          <SuccessBox>
            <p>
              Thanks! &ldquo;{outcome.title}&rdquo; is waiting for a moderator. We&rsquo;ll email
              you once it&rsquo;s been reviewed, and{" "}
              <Link href={MY_LISTINGS_PATH}>My listings</Link> shows where it stands.
            </p>
          </SuccessBox>
        )}
      </div>
    </form>
  );
}

async function putPhoto(url: string, photo: File): Promise<boolean> {
  try {
    const response = await fetch(url, {
      method: "PUT",
      body: photo,
      headers: { "content-type": photo.type, "x-upsert": "false" },
    });
    return response.ok;
  } catch {
    return false;
  }
}
