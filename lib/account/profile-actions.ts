"use server";

import { refresh } from "next/cache";
import { after } from "next/server";
import { requireUser } from "@/lib/auth/user";
import { syncMembersToMailerLite } from "@/lib/mailerlite/on-change";
import { ACCOUNT_PATH } from "@/lib/site/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  PROFILE_MESSAGES,
  checkProfile,
  profileValues,
  readProfileForm,
  type ProfileState,
} from "./profile-state";

/**
 * Saves the "Your details" form on My Account (backlog M-8): the member's own name and phone. It
 * runs as the signed-in member, so row level security and the column privileges hold whatever is
 * sent: a member changes only their own first_name, last_name and phone, never their level, status
 * or expires_at (supabase/tests/profiles_test.sql).
 */
export async function saveProfile(
  _previous: ProfileState,
  formData: FormData,
): Promise<ProfileState> {
  // Anyone can call a Server Function, so check the session here, not only on the page.
  const user = await requireUser(ACCOUNT_PATH);

  const values = readProfileForm(formData);
  const checked = checkProfile(values);
  if (!("profile" in checked)) return { status: "error", ...checked, values };
  const { firstName, lastName, phone } = checked.profile;
  const unavailable: ProfileState = {
    status: "error",
    field: null,
    message: PROFILE_MESSAGES.unavailable,
    values,
  };

  try {
    const supabase = await createClient();
    const { data: before, error: readError } = await supabase
      .from("profiles")
      .select("first_name, last_name")
      .eq("id", user.id)
      .maybeSingle();
    if (readError || !before) {
      console.error("Reading a profile to save it failed:", readError?.code, readError?.message);
      return unavailable;
    }
    const { data: saved, error } = await supabase
      .from("profiles")
      .update({ first_name: firstName, last_name: lastName, phone })
      .eq("id", user.id)
      .select("id");
    if (error || saved?.length !== 1) {
      console.error("Saving a profile failed:", error?.code, error?.message);
      return unavailable;
    }
    // MailerLite has each member's name (lib/mailerlite/sync.ts), so it follows a new one. After
    // the answer is sent; it does nothing while the sync is off and never throws.
    const name = before as { first_name: unknown; last_name: unknown };
    if (name.first_name !== firstName || name.last_name !== lastName) {
      after(() => syncMembersToMailerLite([user.id]));
    }
  } catch (cause) {
    console.error("Saving a profile failed:", cause);
    return unavailable;
  }

  // Render the page afresh, so its own copy of the profile (the form's starting values) is current.
  refresh();
  return { status: "saved", values: profileValues(checked.profile) };
}
