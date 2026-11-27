import { describe, expect, it } from "vitest";
import {
  NAME_MAX_LENGTH,
  PHONE_MAX_LENGTH,
  PROFILE_MESSAGES,
  checkProfile,
  profileValues,
  readProfileForm,
  type ProfileValues,
} from "./profile-state";

const values = (changes: Partial<ProfileValues> = {}): ProfileValues => ({
  firstName: "Jordan",
  lastName: "Ellis",
  phone: "(479) 555-0102",
  ...changes,
});

describe("readProfileForm", () => {
  it("reads each field as typed, and a missing one as blank", () => {
    const form = new FormData();
    form.set("firstName", " Jordan ");
    form.set("phone", "479 555 0102");
    expect(readProfileForm(form)).toEqual({
      firstName: " Jordan ",
      lastName: "",
      phone: "479 555 0102",
    });
  });
});

describe("checkProfile", () => {
  it("tidies the details: one line each, single spaces, trimmed", () => {
    expect(
      checkProfile({ firstName: "  Mary \t Lou ", lastName: "O'Neal\n", phone: " 479  555-0102 " }),
    ).toEqual({ profile: { firstName: "Mary Lou", lastName: "O'Neal", phone: "479 555-0102" } });
  });

  it("needs a first name", () => {
    for (const firstName of ["", "   ", "\n"]) {
      expect(checkProfile(values({ firstName }))).toEqual({
        field: "firstName",
        message: PROFILE_MESSAGES.firstNameMissing,
      });
    }
  });

  it("clears a blank last name or phone", () => {
    expect(checkProfile(values({ lastName: "  ", phone: "" }))).toEqual({
      profile: { firstName: "Jordan", lastName: null, phone: null },
    });
  });

  it("keeps names within the database's 100 characters, counted as it counts them", () => {
    const longest = "é".repeat(NAME_MAX_LENGTH);
    expect(checkProfile(values({ firstName: longest, lastName: longest }))).toMatchObject({
      profile: { firstName: longest, lastName: longest },
    });
    // 100 emoji are 200 UTF-16 code units, but 100 characters to the database.
    expect(checkProfile(values({ lastName: "🎸".repeat(NAME_MAX_LENGTH) }))).toMatchObject({
      profile: { lastName: "🎸".repeat(NAME_MAX_LENGTH) },
    });
    expect(checkProfile(values({ firstName: "a".repeat(NAME_MAX_LENGTH + 1) }))).toEqual({
      field: "firstName",
      message: PROFILE_MESSAGES.firstNameTooLong,
    });
    expect(checkProfile(values({ lastName: "a".repeat(NAME_MAX_LENGTH + 1) }))).toEqual({
      field: "lastName",
      message: PROFILE_MESSAGES.lastNameTooLong,
    });
  });

  it("drops control characters, which the database can't always store", () => {
    expect(checkProfile(values({ firstName: "Jor\u0000dan\u0007" }))).toMatchObject({
      profile: { firstName: "Jordan" },
    });
  });

  it("takes phone numbers with an area code, written any usual way", () => {
    for (const phone of [
      "(479) 555-0102",
      "479-555-0102",
      "479.555.0102",
      "4795550102",
      "+1 479 555 0102",
      "(479) 555-0102 x12",
      "479-555-0102 ext. 4",
      "+44 20 7946 0958",
    ]) {
      expect(checkProfile(values({ phone })), phone).toMatchObject({ profile: { phone } });
    }
  });

  it("refuses anything else as a phone number", () => {
    for (const phone of [
      "555-0102",
      "call me",
      "479-555-01O2",
      "+1 479 555 0102 0102 0102",
      "479/555/0102",
      "x12",
    ]) {
      expect(checkProfile(values({ phone })), phone).toEqual({
        field: "phone",
        message: PROFILE_MESSAGES.phoneInvalid,
      });
    }
    expect(checkProfile(values({ phone: "1".repeat(PHONE_MAX_LENGTH + 1) }))).toEqual({
      field: "phone",
      message: PROFILE_MESSAGES.phoneTooLong,
    });
  });

  it("reports the first problem, in the form's order", () => {
    expect(checkProfile({ firstName: "", lastName: "a".repeat(101), phone: "nope" })).toMatchObject(
      { field: "firstName" },
    );
    expect(checkProfile(values({ lastName: "a".repeat(101), phone: "nope" }))).toMatchObject({
      field: "lastName",
    });
  });
});

describe("profileValues", () => {
  it("shows empty profile fields as blanks", () => {
    expect(profileValues({ firstName: null, lastName: "Ellis", phone: null })).toEqual({
      firstName: "",
      lastName: "Ellis",
      phone: "",
    });
  });
});
