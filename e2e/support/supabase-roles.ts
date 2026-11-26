import { expect, type APIRequestContext } from "@playwright/test";
import { PUBLISHABLE_KEY, SUPABASE_URL } from "./supabase-auth";

/**
 * Takes `role` away from `email` through the Data API, signed in as the fixture administrator
 * (`admin`, with `password`), the way the roles screen does. Does nothing when they don't have it.
 */
export async function removeRole(
  request: APIRequestContext,
  { admin, password }: { admin: string; password: string },
  email: string,
  role: string,
): Promise<void> {
  const signIn = await request.post(`${SUPABASE_URL}/auth/v1/token`, {
    params: { grant_type: "password" },
    headers: { apikey: PUBLISHABLE_KEY },
    data: { email: admin, password },
  });
  expect(signIn.ok(), `signing in ${admin}`).toBe(true);
  const { access_token } = (await signIn.json()) as { access_token: string };
  const headers = { apikey: PUBLISHABLE_KEY, authorization: `Bearer ${access_token}` };

  const profiles = await request.get(`${SUPABASE_URL}/rest/v1/profiles`, {
    headers,
    params: { select: "id", email: `eq.${email}` },
  });
  const [profile] = (await profiles.json()) as { id: string }[];
  expect(profile, `${email}'s profile`).toBeDefined();

  const removal = await request.delete(`${SUPABASE_URL}/rest/v1/user_roles`, {
    headers,
    params: { profile_id: `eq.${profile.id}`, role: `eq.${role}` },
  });
  expect(removal.ok(), `removing ${email}'s ${role} role`).toBe(true);
}
