// The "Your details" form on My Account (backlog M-8): the checks, limits and wording that the form
// and its Server Function share. No server code, so the form and the tests can use it.
//
// Members change only their name and phone (the column privileges in
// supabase/migrations/20261126050904_profiles_and_roles.sql). The database allows up to 100
// characters for each name and 40 for the phone; the checks here say so before it refuses.

/** The most characters profiles.first_name and last_name take. */
export const NAME_MAX_LENGTH = 100;
/** The most characters profiles.phone takes. */
export const PHONE_MAX_LENGTH = 40;

/** A field a check can fail on: also the name of its input in the form. */
export type ProfileField = "firstName" | "lastName" | "phone";

/** The form's values as typed, or as saved: what its fields show. */
export type ProfileValues = Record<ProfileField, string>;

/** Details that passed the checks, ready for the profiles table. */
export type ProfileDetails = { firstName: string; lastName: string | null; phone: string | null };

export type ProfileState =
  | { status: "idle" }
  | { status: "saved"; values: ProfileValues }
  | {
      status: "error";
      /** The field the message is about, or null for a problem with the whole form. */
      field: ProfileField | null;
      message: string;
      /** What was sent, so the fields keep it: React resets a form after each submission. */
      values: ProfileValues;
    };

export const PROFILE_MESSAGES = {
  phoneHint:
    "Optional. Society staff can see it. A classifieds listing shows it only if you choose to be contacted by phone.",
  firstNameMissing: "Enter your first name.",
  firstNameTooLong: `Keep your first name to ${NAME_MAX_LENGTH} characters.`,
  lastNameTooLong: `Keep your last name to ${NAME_MAX_LENGTH} characters.`,
  phoneInvalid:
    "Enter a phone number with its area code, such as (479) 555-0123, or leave it blank.",
  phoneTooLong: `Keep the phone number to ${PHONE_MAX_LENGTH} characters.`,
  saved: "Your details are saved.",
  unavailable: "Your details couldn't be saved right now. Please try again in a few minutes.",
} as const;

/** The form's values from a submission: each field as typed, or "" when it's missing. */
export function readProfileForm(formData: FormData): ProfileValues {
  const value = (field: ProfileField) => {
    const entry = formData.get(field);
    return typeof entry === "string" ? entry : "";
  };
  return { firstName: value("firstName"), lastName: value("lastName"), phone: value("phone") };
}

/** On one line, with single spaces and no control characters, trimmed. */
function tidy(text: string): string {
  return text
    .replace(/\s+/g, " ")
    .replace(/\p{Cc}/gu, "")
    .trim();
}

/** Characters as the database counts them (char_length): an emoji is one. */
const length = (text: string) => [...text].length;

// A phone number: digits, spaces and + ( ) - . with 10 to 15 digits (an area code, or a country
// code too; 15 is the most any number has), and maybe an extension such as "x12" or "ext. 12".
const EXTENSION = /\s*(?:x|ext\.?)\s*\d{1,6}$/i;
const PHONE_CHARACTERS = /^\+?[\d ().-]+$/;

function isPhoneNumber(phone: string): boolean {
  const number = phone.replace(EXTENSION, "");
  const digits = number.replace(/\D/g, "").length;
  return PHONE_CHARACTERS.test(number) && digits >= 10 && digits <= 15;
}

/**
 * Checks the details the way the database will, and tidies them: each on one line and trimmed.
 * The first name is needed (emails greet members by it); the last name and phone may be blank,
 * which clears them.
 */
export function checkProfile(
  values: ProfileValues,
): { profile: ProfileDetails } | { field: ProfileField; message: string } {
  const firstName = tidy(values.firstName);
  if (!firstName) return { field: "firstName", message: PROFILE_MESSAGES.firstNameMissing };
  if (length(firstName) > NAME_MAX_LENGTH) {
    return { field: "firstName", message: PROFILE_MESSAGES.firstNameTooLong };
  }
  const lastName = tidy(values.lastName);
  if (length(lastName) > NAME_MAX_LENGTH) {
    return { field: "lastName", message: PROFILE_MESSAGES.lastNameTooLong };
  }
  const phone = tidy(values.phone);
  if (length(phone) > PHONE_MAX_LENGTH) {
    return { field: "phone", message: PROFILE_MESSAGES.phoneTooLong };
  }
  if (phone && !isPhoneNumber(phone)) {
    return { field: "phone", message: PROFILE_MESSAGES.phoneInvalid };
  }
  return { profile: { firstName, lastName: lastName || null, phone: phone || null } };
}

/** What the form's fields show for saved details: blanks for what's empty. */
export function profileValues(details: {
  firstName: string | null;
  lastName: string | null;
  phone: string | null;
}): ProfileValues {
  return {
    firstName: details.firstName ?? "",
    lastName: details.lastName ?? "",
    phone: details.phone ?? "",
  };
}
