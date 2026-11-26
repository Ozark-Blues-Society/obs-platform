import { execFileSync } from "node:child_process";
import { expect, type APIRequestContext } from "@playwright/test";

// The local Supabase stack. CI sets these from `supabase status`; locally the defaults are the
// stack's well-known values, the same as in .env.example.
export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321";
export const PUBLISHABLE_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
  "sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH";

/** The service role's key: SUPABASE_SECRET_KEY, or what `supabase status` prints for the stack. */
export function secretKey(): string {
  if (process.env.SUPABASE_SECRET_KEY) return process.env.SUPABASE_SECRET_KEY;
  const status = JSON.parse(
    execFileSync("supabase", ["status", "--output", "json"], { encoding: "utf8" }),
  ) as { SECRET_KEY?: string };
  if (!status.SECRET_KEY) throw new Error("`supabase status` printed no SECRET_KEY");
  return status.SECRET_KEY;
}

/**
 * If `email`'s password is `changed`, sets it back to `original` through Supabase Auth, the way
 * the member's own browser would. Does nothing when `changed` doesn't sign in.
 */
export async function restorePassword(
  request: APIRequestContext,
  email: string,
  changed: string,
  original: string,
): Promise<void> {
  const signIn = await request.post(`${SUPABASE_URL}/auth/v1/token`, {
    params: { grant_type: "password" },
    headers: { apikey: PUBLISHABLE_KEY },
    data: { email, password: changed },
  });
  const body = (await signIn.json()) as { access_token?: string; error_code?: string };
  if (body.error_code === "invalid_credentials") {
    return; // The password wasn't changed.
  }
  expect(signIn.ok(), `signing in ${email} with the changed password`).toBe(true);

  const update = await request.put(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { apikey: PUBLISHABLE_KEY, authorization: `Bearer ${body.access_token}` },
    data: { password: original },
  });
  expect(update.ok(), `setting ${email}'s password back`).toBe(true);
}
